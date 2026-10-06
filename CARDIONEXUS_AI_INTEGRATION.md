# CardioNexus AI Explainer — Integration Guide

> **Who this is for:** The developer integrating the CardioNexus AI Explainer into the NCEP product.
>
> **What you have:**
> - This repo (`TavusIO`) — the complete CardioNexus AI Explainer (Tavus CVI service) + this doc
> - The NCEP product repo (`ncep/`) — the existing Next.js frontend + FastAPI backend
>
> **Goal:** Add a "Talk to Dr. Raj" button on every report in both the Doctor and Patient
> dashboards. Clicking it starts a live AI video consultation with Dr. Raj, who has already
> read the report and will explain the findings conversationally.
>
> **What you do NOT need to touch in this repo:** The AI Explainer codebase is complete and working.
> You only need to **run it** (Part 1) and **wire it into the NCEP product** (Part 3 onwards).

---

## Quick Overview — How it Works

```
User clicks "Talk to Dr. Raj" on a report
            │
            ▼
NCEP Frontend (Next.js)
  1. Reads the report fields already loaded on the page
  2. Converts them to plain text (reportToText helper you'll create)
  3. Calls POST http://localhost:3001/api/cvi/start  ──► AI Explainer Backend
                                                              │
                                                    Creates Tavus Persona +
                                                    Conversation room with
                                                    the report as context
                                                              │
  4. Receives { conversation_url } ◄────────────────────────┘
  5. Opens a full-screen modal
  6. Connects to Daily.co using the conversation_url
            │
            ▼
  Dr. Raj appears on screen — greets the user, asks
  "Shall we go through the key findings together?"
  User says "yes" → Dr. Raj explains the report
  User can ask any follow-up questions
```

---

## Part 1 — Set Up & Run the AI Explainer Service

### 1.1 Folder Structure (what you received)

```
TAVUS integration/
├── backend/
│   └── server.js          ← Node.js Express API (the only backend you care about)
├── frontend/
│   ├── CardioNexusApp.jsx ← Full standalone UI (not used in NCEP integration)
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       └── index.css
├── .env                   ← Tavus credentials (already filled in)
├── package.json
└── README.md
```

### 1.2 Install & Run

```bash
# In the TAVUS integration/ folder
npm install
npm run dev
```

This starts two processes via `concurrently`:
- **Backend** on `http://localhost:3001` — the API your NCEP integration will call
- **Frontend** on `http://localhost:3000` — standalone demo UI (not needed for NCEP)

Confirm it's running — you should see:

```
╔══════════════════════════════════════════════════════╗
║         CardioNexus — Tavus CVI Backend              ║
╚══════════════════════════════════════════════════════╝
  Listening on http://localhost:3001

  POST /api/cvi/upload-pdf    — Upload & scrape PDF
  POST /api/cvi/start         — Start Dr. Raj CVI session
  POST /api/cvi/end/:id       — End CVI session
  GET  /api/logs              — SSE log stream

  TAVUS_API_KEY : OK (7fdc9ab6...)
  TAVUS_REPLICA : rf8f3aa4b33e
  TEST_MODE     : false
```

### 1.3 Environment Variables

The `.env` file in `TAVUS integration/` is already configured:

```env
TAVUS_API_KEY=7fdc9ab6d2974e7f9785c6cc3dee5354
TAVUS_REPLICA_ID=rf8f3aa4b33e
TAVUS_TEST_MODE=false
API_PORT=3001
```

**Do not change these** unless you have your own Tavus account credentials.

---

## Part 2 — AI Explainer API Reference

You'll only call two endpoints from the NCEP frontend.

### `POST /api/cvi/start`

Starts a Dr. Raj session with the report text as context.

**Request body (JSON):**
```json
{
  "extracted_text": "CARDIAC REPORT — ECG Analysis Report\nPatient: John Smith\n..."
}
```

`extracted_text` is plain text — not a PDF, not HTML. You compose it from the report's
database fields (see Part 3).

**Successful response `201`:**
```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "persona_id": "pa8e3870c870",
  "conversation_id": "c8286e7889c8b486",
  "conversation_url": "https://tavus.daily.co/c8286e7889c8b486",
  "greeting": "Hi, I'm Dr. Raj, welcome to CardioNexus...",
  "is_mock": false
}
```

You use `conversation_url` to connect the Daily.co video call.
You use `conversation_id` to end the session later.

**Error response `400`:**
```json
{ "error": "No report text provided. Please upload a PDF first." }
```

---

### `POST /api/cvi/end/:conversationId`

Ends the session and cleans up Tavus resources.

```
POST http://localhost:3001/api/cvi/end/c8286e7889c8b486
```

No request body. Call this when the user closes the video modal.

---

## Part 3 — NCEP Frontend Integration

### 3.1 Where to Make Changes

You'll be working inside the `ncep/NCEPfrontend/` folder (the Next.js project).

Key files in the NCEP frontend:
```
NCEPfrontend/src/
├── app/
│   ├── doctor/
│   │   └── reports/
│   │       ├── page.tsx          ← Doctor reports list  ← ADD BUTTON HERE
│   │       └── [reportId]/       ← Doctor report detail ← OPTIONALLY ADD HERE
│   └── patient/
│       └── reports/
│           └── page.tsx          ← Patient reports list ← ADD BUTTON HERE
├── services/
│   ├── reports.service.ts        ← Existing report API calls
│   └── index.ts                  ← Re-exports all services
├── components/
│   └── ui/
│       └── Button.tsx            ← Existing Button component (use this)
└── types/                        ← TypeScript types including ClinicalReport
```

---

### 3.2 Step 1 — Add Environment Variable

In `NCEPfrontend/.env.local`, add:

```env
NEXT_PUBLIC_AI_EXPLAINER_URL=http://localhost:3001
```

For production, replace with the deployed URL of the AI Explainer service.

---

### 3.3 Step 2 — Install Daily.co SDK

The AI Explainer uses Daily.co for the video call. You need these in the NCEP frontend too.

```bash
# Inside NCEPfrontend/
npm install @daily-co/daily-js @daily-co/daily-react
```

> **Note:** `@daily-co/daily-js` version `^0.91.0` is already used in the AI Explainer.
> Use the same major version to avoid conflicts.

---

### 3.4 Step 3 — Create the Report-to-Text Helper

The AI Explainer expects plain text. The NCEP `ClinicalReport` object already has all the
fields — just serialize them.

Create file: `NCEPfrontend/src/lib/reportToText.ts`

```typescript
import type { ClinicalReport } from "@/types";

/**
 * Converts a ClinicalReport object into plain text for the AI Explainer.
 * The AI Explainer (Dr. Raj) reads this text to ground its spoken summary.
 */
export function reportToText(report: ClinicalReport): string {
  const lines: string[] = [];

  lines.push(`CARDIAC REPORT — ${report.title}`);
  lines.push(`Patient: ${report.patientName}`);
  lines.push(`Physician: ${report.doctorName}`);
  lines.push(`Date: ${new Date(report.updatedAt).toLocaleDateString("en-GB")}`);
  lines.push(`Status: ${report.status}`);
  lines.push("");

  if (report.clinicalObservations) {
    lines.push("CLINICAL OBSERVATIONS:");
    lines.push(report.clinicalObservations);
    lines.push("");
  }

  if (report.findings) {
    lines.push("FINDINGS:");
    lines.push(report.findings);
    lines.push("");
  }

  if (report.interpretation) {
    lines.push("INTERPRETATION:");
    lines.push(report.interpretation);
    lines.push("");
  }

  if (report.recommendations) {
    lines.push("RECOMMENDATIONS:");
    lines.push(report.recommendations);
  }

  return lines.join("\n");
}
```

> **Type mapping note:** The NCEP `ClinicalReport` TypeScript type uses camelCase
> (`clinicalObservations`, `patientName`, etc.) which maps to the Python snake_case model
> (`clinical_observations`, `patient_name`). Use whatever the TypeScript type already has.

---

### 3.5 Step 4 — Create the AI Explainer Service Client

Create file: `NCEPfrontend/src/services/aiExplainer.service.ts`

```typescript
const BASE_URL =
  process.env.NEXT_PUBLIC_AI_EXPLAINER_URL ?? "http://localhost:3001";

export interface CVISession {
  session_id: string;
  persona_id: string;
  conversation_id: string;
  conversation_url: string | null;
  greeting: string;
  is_mock: boolean;
}

/**
 * Starts a Dr. Raj CVI session with the given report text as context.
 * Returns session data including the Daily.co room URL.
 */
export async function startCVISession(extractedText: string): Promise<CVISession> {
  const res = await fetch(`${BASE_URL}/api/cvi/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ extracted_text: extractedText }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, string>;
    throw new Error(err.error ?? `AI Explainer error: ${res.status}`);
  }

  return res.json() as Promise<CVISession>;
}

/**
 * Ends a CVI session and cleans up Tavus resources.
 * Call this when the user closes the video modal.
 */
export async function endCVISession(conversationId: string): Promise<void> {
  await fetch(`${BASE_URL}/api/cvi/end/${conversationId}`, {
    method: "POST",
  }).catch(console.error); // non-critical — fire and forget
}
```

---

### 3.6 Step 5 — Create the Dr. Raj Video Modal

This component handles the Daily.co connection and renders the video window.
It uses the same Daily.co approach as the AI Explainer's `CardioNexusApp.jsx`
(which you can reference in `TAVUS integration/frontend/CardioNexusApp.jsx`).

Create file: `NCEPfrontend/src/components/DrRajModal.tsx`

```typescript
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import DailyIframe from "@daily-co/daily-js";
import { DailyProvider, DailyVideo, DailyAudio, useParticipantIds } from "@daily-co/daily-react";
import { endCVISession, type CVISession } from "@/services/aiExplainer.service";
import { X, Mic, MicOff, PhoneOff } from "lucide-react";

// ── Video Tile (renders Dr. Raj's video stream) ──────────────────────────────
function AvatarVideoTile({ onAvatarJoined }: { onAvatarJoined: () => void }) {
  const remoteIds = useParticipantIds({ filter: "remote" });

  useEffect(() => {
    if (remoteIds.length > 0) onAvatarJoined();
  }, [remoteIds, onAvatarJoined]);

  return (
    <>
      <DailyAudio />
      {remoteIds.map((id) => (
        <DailyVideo
          key={id}
          sessionId={id}
          type="video"
          style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "12px" }}
        />
      ))}
    </>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
interface Props {
  session: CVISession;
  onClose: () => void;
}

export function DrRajModal({ session, onClose }: Props) {
  const callRef = useRef<ReturnType<typeof DailyIframe.createCallObject> | null>(null);
  const [callObj, setCallObj] = useState<ReturnType<typeof DailyIframe.createCallObject> | null>(null);
  const [callState, setCallState] = useState<"joining" | "joined" | "left" | "error">("joining");
  const [avatarReady, setAvatarReady] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleClose = useCallback(async () => {
    const co = callRef.current;
    callRef.current = null;
    setCallObj(null);
    if (co) {
      try { await co.leave(); } catch {}
      try { co.destroy(); } catch {}
    }
    if (session.conversation_id) {
      endCVISession(session.conversation_id);
    }
    onClose();
  }, [session.conversation_id, onClose]);

  // Join the Daily.co room
  useEffect(() => {
    if (!session.conversation_url) return;

    const co = DailyIframe.createCallObject({ subscribeToTracksAutomatically: true });
    callRef.current = co;

    co.on("joined-meeting", () => setCallState("joined"));
    co.on("left-meeting",   () => setCallState("left"));
    co.on("error",          (e) => { setErrorMsg(e?.errorMsg ?? "Connection error"); setCallState("error"); });

    setCallObj(co);
    co.join({ url: session.conversation_url, startVideoOff: true, startAudioOff: false })
      .catch((err: Error) => { setErrorMsg(err.message); setCallState("error"); });

    return () => {
      co.off("joined-meeting", () => {});
      co.off("left-meeting",   () => {});
      co.off("error",          () => {});
    };
  }, [session.conversation_url]);

  // Mic toggle
  useEffect(() => {
    if (callObj && callState === "joined") {
      callObj.setLocalAudio(!micMuted);
    }
  }, [micMuted, callState, callObj]);

  // Auto-close when call ends
  useEffect(() => {
    if (callState === "left") handleClose();
  }, [callState, handleClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
      <div className="relative flex w-full max-w-3xl flex-col rounded-2xl bg-neutral-900 shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-white">Dr. Raj · CardioNexus AI</span>
            {callState === "joined" && (
              <span className="flex items-center gap-1.5 rounded-full bg-green-500/15 px-2 py-0.5 text-xs text-green-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
                Live
              </span>
            )}
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Video Area */}
        <div className="relative aspect-video w-full bg-black">
          {callObj && callState === "joined" ? (
            <DailyProvider callObject={callObj}>
              <AvatarVideoTile onAvatarJoined={() => setAvatarReady(true)} />
            </DailyProvider>
          ) : callState === "joining" ? (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              <p className="text-sm text-white/50">Connecting to Dr. Raj…</p>
            </div>
          ) : callState === "error" ? (
            <div className="flex h-full flex-col items-center justify-center gap-2">
              <p className="text-sm text-red-400">Connection failed</p>
              <p className="text-xs text-white/30">{errorMsg}</p>
            </div>
          ) : null}

          {/* Avatar joining badge */}
          {callState === "joined" && !avatarReady && (
            <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-blue-500/20 px-3 py-1 text-xs text-blue-300">
              Dr. Raj is joining…
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 border-t border-white/10 py-4">
          <button
            onClick={() => setMicMuted((m) => !m)}
            className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
              micMuted
                ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
            title={micMuted ? "Unmute" : "Mute"}
          >
            {micMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>

          <button
            onClick={handleClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30"
            title="End call"
          >
            <PhoneOff className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

### 3.7 Step 6 — Add Button to Doctor Reports List

**File:** `NCEPfrontend/src/app/doctor/reports/page.tsx`

**6a. Add imports** at the top of the file (after the existing imports):

```typescript
import { Bot } from "lucide-react";
import { reportToText } from "@/lib/reportToText";
import { startCVISession, type CVISession } from "@/services/aiExplainer.service";
import { DrRajModal } from "@/components/DrRajModal";
```

**6b. Add state** inside the `DoctorReportsList` component (after existing `useState` calls):

```typescript
const [cviSession,  setCviSession]  = useState<CVISession | null>(null);
const [cviLoading,  setCviLoading]  = useState<string | null>(null); // report.id while loading
```

**6c. Add handler** (after `handleShare`):

```typescript
const handleTalkToRaj = async (report: ClinicalReport) => {
  setCviLoading(report.id);
  try {
    const text = reportToText(report);
    const session = await startCVISession(text);
    setCviSession(session);
  } catch {
    toast("Could not start AI session. Please try again.", "error");
  } finally {
    setCviLoading(null);
  }
};
```

**6d. Add the button** in the table actions `<div className="flex justify-end gap-2">` 
(around line 140, after the Download button and before the View link):

```tsx
<Button
  variant="ghost"
  className="h-8 w-8 p-0 text-secondary hover:text-primary"
  onClick={() => handleTalkToRaj(report)}
  disabled={cviLoading === report.id}
  title="Talk to Dr. Raj about this report"
>
  {cviLoading === report.id ? (
    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
  ) : (
    <Bot className="h-4 w-4" />
  )}
</Button>
```

**6e. Add the modal** at the bottom of the `return` statement, just before the closing `</div>`:

```tsx
{cviSession && (
  <DrRajModal
    session={cviSession}
    onClose={() => setCviSession(null)}
  />
)}
```

---

### 3.8 Step 7 — Add Button to Patient Reports List

**File:** `NCEPfrontend/src/app/patient/reports/page.tsx`

Apply the **exact same changes** as Step 6 (6a through 6e).

The only difference: patients only see reports where `sharedWithPatient === true`, which is
already enforced by the NCEP backend. No extra filtering needed.

The button label can be changed to "Explain my report" in the `title` attribute if desired.

---

### 3.9 Step 8 — (Optional) Add Button to Report Detail Pages

If there is a report detail page (e.g., `NCEPfrontend/src/app/report/[reportId]/page.tsx`
or `NCEPfrontend/src/app/doctor/reports/[reportId]/page.tsx`), you can add the same button
to the report header.

The pattern is identical — fetch the report via `getReportById(reportId)`, convert with
`reportToText()`, call `startCVISession()`, render `<DrRajModal />`.

---

## Part 4 — What Dr. Raj Does (for QA reference)

When a user clicks the button and the session connects:

1. **Dr. Raj speaks immediately** (verbatim, no user input needed):
   > *"Hi, I'm Dr. Raj, welcome to CardioNexus. I've reviewed your cardiac report. Shall we
   > go through the key findings together?"*

2. **User says "yes" / "sure" / "go ahead"**
   → Dr. Raj delivers a spoken summary of the 3–5 most important findings from the report
   in plain language. No jargon. Natural sentences.

3. **User can interrupt at any time** — Dr. Raj stops and responds to whatever the user says.

4. **Q&A** — user can ask follow-up questions about any finding. Dr. Raj answers from the
   report context, never fabricates values.

5. **End call** — user clicks End Call button → session ends → `endCVISession()` is called.

---

## Part 5 — Access Control

No changes to NCEP auth are needed. The NCEP backend already enforces:

- **Doctor role** → sees only their own reports (`doctorId === session.doctorId`)
- **Patient role** → sees only `sharedWithPatient === true` reports
- **Admin/Superadmin** → sees all reports in their organisation

Since `reportToText()` only serializes data already fetched from the authenticated API, the
AI Explainer never sees data the user isn't already authorized to see.

---

## Part 6 — Running Both Services Together (Dev)

You'll have three processes running during development:

| Service | Command | Port |
|---|---|---|
| AI Explainer (backend + frontend) | `npm run dev` in `TAVUS integration/` | `:3001` (backend), `:3000` (standalone demo) |
| NCEP Backend (FastAPI) | `uvicorn app.main:app --reload` in `ncep/backend/` | `:8000` |
| NCEP Frontend (Next.js) | `npm run dev` in `ncep/NCEPfrontend/` | `:3001` or `:3002` |

> **Port conflict warning:** The AI Explainer backend runs on `:3001` by default. The NCEP
> frontend Vite dev server may also use `:3001`. If there's a conflict, change
> `API_PORT=3002` in `TAVUS integration/.env` and update `NEXT_PUBLIC_AI_EXPLAINER_URL`
> in `NCEPfrontend/.env.local` accordingly.

---

## Part 7 — Production Deployment

For production, the AI Explainer backend should be deployed as a separate service
(e.g., a separate Docker container or Cloud Run instance).

**Backend-only start command** (no Vite frontend needed in production integration):
```bash
node backend/server.js
```

Or use the `dev:backend` script:
```bash
npm run dev:backend
```

Set `NEXT_PUBLIC_AI_EXPLAINER_URL` in the NCEP frontend deployment to point to
the production AI Explainer URL.

**Recommended CORS config** — add to `TAVUS integration/backend/server.js` for production:

```javascript
import cors from 'cors';
app.use(cors({
  origin: ['https://your-ncep-app-domain.com'],
}));
// npm install cors
```

---

## Part 8 — Files You Create/Edit Summary

| Location | File | Action |
|---|---|---|
| `NCEPfrontend/` | `.env.local` | **Edit** — add `NEXT_PUBLIC_AI_EXPLAINER_URL` |
| `NCEPfrontend/src/lib/` | `reportToText.ts` | **Create** (new file) |
| `NCEPfrontend/src/services/` | `aiExplainer.service.ts` | **Create** (new file) |
| `NCEPfrontend/src/components/` | `DrRajModal.tsx` | **Create** (new file) |
| `NCEPfrontend/src/app/doctor/reports/` | `page.tsx` | **Edit** — add imports, state, handler, button, modal |
| `NCEPfrontend/src/app/patient/reports/` | `page.tsx` | **Edit** — same as above |
| `TAVUS integration/` | `.env` | **Do not change** (credentials already set) |

**Total:** 3 new files, 3 file edits, 1 env var.

---

*Prepared by the CardioNexus AI team — October 2026.*
