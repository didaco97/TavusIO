# AI Avatar Explainer — Integration API Documentation

> **Module:** Dual-Path AI Avatar Video Pipeline
> **Base URL (local):** `http://localhost:3001`
> **Base URL (production):** Set via `PUBLIC_SERVER_URL` env variable
> **Content-Type:** File-upload endpoints use `multipart/form-data`. Text-only requests use `application/json`.

---

## Overview

This module sits between your Report Generation Module and the Tavus AI Avatar platform. When your module produces a report (PDF or plain text), you pass it to one of two pipeline branches:

```
Your Report Module
       │
       ▼
[AI Avatar Explainer API]
       │
       ├─── Branch A (Non-Interactive)
       │    PDF/Text → PDF Parser → Gemini 2.5 Flash → Tavus Video
       │    Use when: You want a pre-rendered 2-minute avatar video summary
       │
       └─── Branch B (Interactive CVI)
            PDF/Text → PDF Parser → Tavus Avatar → Live Q&A
            Use when: You want a live, interactive avatar the user can talk to
```

---

## Environment Variables (`.env`)

The integrating team must configure these before running the server:

| Variable | Required | Description |
|---|---|---|
| `TAVUS_API_KEY` | Yes | Your Tavus platform API key |
| `TAVUS_REPLICA_ID` | Yes | The Tavus avatar Replica ID to use |
| `GEMINI_API_KEY` | Yes (Branch A) | Google Gemini API key for script generation |
| `GEMINI_MODEL` | Optional | Default: `gemini-flash-latest` |
| `API_PORT` | Optional | Server port. Default: `3001` |
| `PUBLIC_SERVER_URL` | Production only | Your public domain e.g. `https://api.yourdomain.com`. Required for Tavus Knowledge Base document ingestion outside localhost. |
| `TAVUS_TEST_MODE` | Optional | `true` = CVI sessions run in Tavus test mode (no cost). Default: `false` |

---

## Integration Patterns

### Pattern 1 — Direct Text Injection (Recommended for Report Module)

If your report generation module produces the report as a **text string**, this is the simplest integration — a single JSON POST, no file handling needed.

```http
POST /api/explainer/generate-video
Content-Type: application/json

{
  "report_text": "EXAMINATION: ...\n\nIMPRESSION: POTS confirmed.",
  "target_audience": "patient"
}
```

### Pattern 2 — PDF Upload

If your module produces a **PDF file**, send it as a multipart form upload. The server extracts the text internally.

```http
POST /api/explainer/generate-video
Content-Type: multipart/form-data

report_file: <binary PDF>
target_audience: patient
```

> Both patterns are supported by all endpoints below.

---

## Endpoints

---

### 1. `POST /api/explainer/generate-video`

**Branch A — Non-Interactive Video**
**Pipeline:** Report → PDF Parser → Gemini 2.5 Flash → Tavus Video Render

Use this to generate a pre-rendered, non-interactive 2-minute avatar video that summarises the report.

#### Request Fields

**Option A — JSON body (plain text):**

| Field | Type | Required | Description |
|---|---|---|---|
| `report_text` | string | Yes | The full report text content |
| `target_audience` | string | Optional | `patient` (default) or `doctor` — controls the language register of the script |

**Option B — Multipart form (PDF upload):**

| Field | Type | Required | Description |
|---|---|---|---|
| `report_file` | File | Yes | PDF, TXT, DOCX, or CSV file (max 50 MB) |
| `target_audience` | string | Optional | `patient` or `doctor` |

#### Response — `200 OK`

```json
{
  "video_id":         "23fc8611f3",
  "status":           "queued",
  "video_url":        null,
  "is_mock":          false,
  "script_source":    "gemini",
  "extracted_text":   "EXAMINATION: Comprehensive Autonomic...",
  "generated_script": "Hello and welcome. I am here to walk you through..."
}
```

| Field | Description |
|---|---|
| `video_id` | Unique ID — use this to poll for the final video URL |
| `status` | Initial status: `queued` / `generating` / `ready` / `failed` |
| `video_url` | `null` initially. Populated when `status === ready` |
| `script_source` | `gemini` or `fallback` (static template if Gemini is unavailable) |
| `extracted_text` | The raw text extracted from the uploaded document |
| `generated_script` | The full spoken-word script sent to Tavus |
| `is_mock` | `true` if running without Tavus API keys (demo/dev mode) |

> **Important:** Video rendering takes 1–4 minutes. After this call returns, poll `/api/explainer/video-status/:id` every 5 seconds until `status === ready`.

---

### 2. `GET /api/explainer/video-status/:videoId`

**Poll for video render completion**

#### Request

```http
GET /api/explainer/video-status/23fc8611f3
```

#### Response — `200 OK`

```json
{
  "video_id":     "23fc8611f3",
  "status":       "generating",
  "video_url":    "https://stream.mux.com/kjqE9Ftf.../high.mp4",
  "hosted_url":   "https://stream.mux.com/kjqE9Ftf.../high.mp4",
  "download_url": "https://stream.mux.com/kjqE9Ftf.../high.mp4?download=23fc8611f3",
  "progress":     "75/100",
  "is_mock":      false
}
```

| Field | Description |
|---|---|
| `status` | `queued` to `generating` to `ready` or `failed` |
| `video_url` | Direct `.mp4` URL when ready — best for HTML `<video>` tags |
| `hosted_url` | Tavus-hosted playback URL (browser viewable) |
| `download_url` | Direct MP4 download link |
| `progress` | Render progress e.g. `75/100`, or `null` |

**Recommended polling logic:**

```javascript
async function pollVideoStatus(videoId) {
  while (true) {
    const res  = await fetch(`/api/explainer/video-status/${videoId}`);
    const data = await res.json();
    if (data.status === 'ready')  return data.video_url;
    if (data.status === 'failed') throw new Error('Video render failed');
    await new Promise(r => setTimeout(r, 5000)); // wait 5 seconds
  }
}
```

---

### 3. `POST /api/explainer/start-cvi`

**Branch B — Interactive Live CVI Session**
**Pipeline:** Report → PDF Parser → Tavus Avatar Persona → Live Conversation

Use this to start a live, interactive conversation where the user can speak directly to the AI avatar and ask questions about the report. Gemini is **not** used in this branch — the full report context is injected directly into the avatar's system prompt.

#### Request Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `report_text` | string | Yes (or file) | The full report text |
| `report_file` | File | Yes (or text) | PDF/TXT file alternative |
| `target_audience` | string | Optional | `patient` or `doctor` |
| `document_ids` | string (JSON array) | Optional | Tavus KB document IDs from a prior `/upload-document` call, for enhanced RAG retrieval |

#### Response — `201 Created`

```json
{
  "session_id":       "a3f9-...",
  "target_audience":  "patient",
  "persona_id":       "p_abc123",
  "conversation_id":  "c_xyz789",
  "conversation_url": "https://tavus.daily.co/abc123",
  "greeting":         "Hello! I'm Dr. Ava, your AI NeuroCardiology Specialist...",
  "is_mock":          false
}
```

| Field | Description |
|---|---|
| `conversation_url` | The Daily.co room URL — embed this in a `DailyIframe` to start the session |
| `conversation_id` | Use this to end the session via `/end-cvi/:id` |
| `greeting` | The avatar's opening line (audience-adapted) |
| `persona_id` | The Tavus persona created for this session |

**Embedding the video call (React/JavaScript example):**

```javascript
import DailyIframe from '@daily-co/daily-js';

const call = DailyIframe.createCallObject({ subscribeToTracksAutomatically: true });
await call.join({ url: data.conversation_url, startVideoOff: true });
```

---

### 4. `POST /api/explainer/end-cvi/:conversationId`

**Terminate a live CVI session**

Always call this when the user ends the conversation to release the Tavus resource and stop billing.

#### Request

```http
POST /api/explainer/end-cvi/c_xyz789
```

No body required.

#### Response — `200 OK`

```json
{ "status": "ended" }
```

---

### 5. `POST /api/explainer/upload-document`

**Pre-upload a document to the Tavus Knowledge Base (optional — Branch B enhancement)**

This endpoint is optional. Use it to pre-register a document in the Tavus Knowledge Base before starting a CVI session. This enables Tavus's internal RAG (Retrieval-Augmented Generation) for enhanced accuracy with very large documents. The returned `document_id` is then passed to `/start-cvi`.

> **Note on localhost:** Tavus cloud cannot reach your local server URL, so this always returns a `mock_doc_*` ID in development. The system works correctly regardless — extracted text is still injected into the system prompt.

#### Request

```http
POST /api/explainer/upload-document
Content-Type: multipart/form-data
```

| Field | Type | Required | Description |
|---|---|---|---|
| `report_file` | File | Yes | PDF, TXT, DOCX, DOC, PNG, JPG, CSV, XLSX, PPTX (max 50 MB) |

#### Response — `200 OK`

```json
{
  "document_id":    "doc_ab12cd34",
  "document_name":  "patient_report_2024.pdf",
  "extracted_text": "EXAMINATION: Comprehensive Autonomic...",
  "status":         "processing",
  "progress":       0,
  "is_mock":        false
}
```

| Field | Description |
|---|---|
| `document_id` | Pass this to `/start-cvi` in the `document_ids` JSON array field |
| `extracted_text` | Text extracted immediately (useful for a live preview in your UI) |
| `status` | `processing` / `ready` / `error` |
| `is_mock` | `true` when running on localhost |

---

### 6. `GET /api/explainer/document-status/:docId`

**Poll Tavus Knowledge Base document processing**

After uploading a document, poll this until `status === ready` before starting a CVI session with enhanced RAG.

#### Request

```http
GET /api/explainer/document-status/doc_ab12cd34
```

#### Response — `200 OK`

```json
{
  "document_id":   "doc_ab12cd34",
  "status":        "ready",
  "progress":      100,
  "error_message": null,
  "is_mock":       false
}
```

---

### 7. `GET /api/logs`

**Real-time Server Log Stream (Server-Sent Events)**

Subscribe to this SSE stream to receive real-time backend log events — useful for showing live pipeline progress to users.

#### Request

```http
GET /api/logs
Accept: text/event-stream
```

#### Event Format

```json
{
  "level": "info",
  "msg":   "[BRANCH-A] Step 2 — Script ready. Source: gemini, Words: 261",
  "ts":    "2026-08-15T01:13:06.000Z"
}
```

| Field | Values |
|---|---|
| `level` | `info` / `warn` / `error` |
| `msg` | The log message text |
| `ts` | ISO 8601 timestamp |

**JavaScript usage:**

```javascript
const es = new EventSource('/api/logs');
es.onmessage = (event) => {
  const log = JSON.parse(event.data);
  console.log(`[${log.level}] ${log.msg}`);
};
es.close(); // close when component unmounts
```

---

## Error Handling

All endpoints return standard HTTP error codes with a JSON body:

```json
{ "error": "Human-readable error message" }
```

| HTTP Status | Meaning |
|---|---|
| `400` | Bad request — missing field, unsupported file type, or PDF parse failure |
| `404` | Resource not found (e.g., expired temp file) |
| `502` | Upstream API failure (Tavus or Gemini returned an error) |

### Automatic Fallback Behaviour

The server handles upstream failures gracefully:

| Scenario | Fallback |
|---|---|
| Gemini API unavailable | Falls back to a built-in static template script builder |
| Gemini model overloaded | Retries with `gemini-3.6-flash` then `gemini-3.5-flash` automatically |
| Tavus credit limit reached (video) | Returns a hosted demo MP4 with `is_mock: true` |
| Tavus CVI concurrent session limit | Returns a preview mock session with `is_mock: true` |

Always check `is_mock: true` in responses and show an indicator to the user.

---

## Complete Integration Flow

```
1. Your module generates a report (text string or PDF file)
   │
   ▼
2. Choose a branch:
   │
   ├─ Branch A: POST /api/explainer/generate-video
   │            Body: { "report_text": "...", "target_audience": "patient" }
   │            Response: { "video_id": "23fc8611f3", "status": "queued" }
   │            │
   │            └─ Poll every 5s: GET /api/explainer/video-status/23fc8611f3
   │                              until status === "ready"
   │                              then render: <video src={video_url} />
   │
   └─ Branch B: POST /api/explainer/start-cvi
                Body: { "report_text": "...", "target_audience": "patient" }
                Response: { "conversation_url": "https://...", "conversation_id": "c_xyz" }
                │
                └─ Embed conversation_url in DailyIframe
                   User speaks to avatar live
                   When done: POST /api/explainer/end-cvi/c_xyz
```

---

## Local vs Production Differences

| Concern | Local (localhost) | Production |
|---|---|---|
| `tmp_uploads` folder | Temp staging only — Tavus KB upload is mocked | Tavus cloud fetches files from your public URL |
| `PUBLIC_SERVER_URL` | Not required | Must be set to your public domain |
| Tavus Knowledge Base RAG | Bypassed — text injected via system prompt | Full RAG is enabled |
| `TAVUS_TEST_MODE` | Set to `true` for development (no cost) | Set to `false` for production |
| CORS | Unrestricted (`*`) | Restrict to your frontend domain |

---

## Quick-Start Checklist (for integrating team)

- [ ] Copy `.env` and fill in `TAVUS_API_KEY`, `TAVUS_REPLICA_ID`, `GEMINI_API_KEY`
- [ ] Run `npm install` in the project root
- [ ] Start the server: `node backend/server.js` (or `npm run dev` for full stack)
- [ ] Test Branch A: `POST /api/explainer/generate-video` with `report_text` in JSON body
- [ ] Poll `GET /api/explainer/video-status/:id` until `status === "ready"`, then play the video
- [ ] Test Branch B: `POST /api/explainer/start-cvi` and embed the `conversation_url` in a Daily.co iframe
- [ ] For production: set `PUBLIC_SERVER_URL` in `.env` to your public server domain
