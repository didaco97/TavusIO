<div align="center">

# 🧠🫀 NeuroCardiology AI Explainer

**Translating complex neurocardiology diagnostic reports into tailored, accessible insights via AI-powered video avatars.**

[![React](https://img.shields.io/badge/React-18.2-blue.svg?style=for-the-badge&logo=react)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.1-purple.svg?style=for-the-badge&logo=vite)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC.svg?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Express](https://img.shields.io/badge/Express-4.18-lightgrey.svg?style=for-the-badge&logo=express)](https://expressjs.com/)
[![Tavus](https://img.shields.io/badge/Tavus-CVI-brightgreen.svg?style=for-the-badge)](https://tavus.io/)

</div>

---

The **NeuroCardiology AI Explainer** takes complex diagnostic reports — autonomic reflex screens, tilt table tests, POTS evaluations, vasovagal syncope, baroreflex sensitivity, HRV analysis, and stroke-cardiac correlates — and translates them into tailored AI video explanations designed specifically for either **Doctors/Clinicians** or **Patients/Families**.

---

## ✨ Key Features

| Feature | Description |
|---|---|
| 🎥 **Avatar Explainer** | Generates a rendered AI video (MP4) of Dr. Anya reading a custom-scripted explanation of the report |
| 💬 **Interactive Q&A (CVI)** | Launches a live WebRTC video room via Tavus CVI — patients or doctors can talk directly to the AI avatar |
| 📄 **PDF Upload & RAG** | Upload a real clinical PDF report; the backend extracts text for the script and optionally ingests it into the Tavus Knowledge Base for RAG-powered Q&A |
| 🔁 **Preview / Mock Mode** | Runs fully without API keys — useful for UI development and testing |
| 🖥️ **Live Log Terminal** | Real-time backend log stream displayed in the browser via Server-Sent Events |

---

## 🎯 Target Audience Engine

| Feature | 👨‍⚕️ Doctor / Clinician Mode | 🧑‍🤝‍🧑 Patient / Family Mode |
|:---|:---|:---|
| **Tone** | Rigorous, precise, peer-to-peer clinical language | Warm, empathetic, reassuring, zero jargon |
| **Metrics Focus** | Tilt HR delta, BRS slope, RMSSD, QSART, LF/HF ratios | Simple bullet points, clear normal vs elevated flags |
| **Pathophysiology** | Sympathetic surge, cardiovagal withdrawal, baroreflex failure | Brain-heart thermostat analogy |
| **Action Plan** | Pharmacotherapy (Propranolol, Ivabradine), Levine Protocol | Hydration, salt intake, compression socks |

---

## 📁 Project Architecture

This project uses a **Vite + React frontend** and an **Express (Node.js) backend** that runs concurrently in development.

```text
TAVUS integration/           ← Root
├── .env                     ← Runtime secrets (gitignored)
├── .gitignore
├── README.md
├── API_INTEGRATION_DOCS.md  ← API Documentation for the Report Module team
├── package.json             ← npm scripts & Node.js dependencies
├── package-lock.json
│
├── backend/                 ← Backend code
│   ├── server.js            ← ★ Express API server — all routes
│   └── tmp_uploads/         ← Temp file store for Tavus doc ingestion (gitignored)
│
└── frontend/                ← Frontend code
    ├── index.html           ← Vite HTML shell
    ├── vite.config.js       ← Vite dev server config
    ├── postcss.config.js    ← PostCSS config (Tailwind + Autoprefixer)
    ├── tailwind.config.js   ← Tailwind CSS config
    ├── src/                 ← Vite entry point
    │   ├── main.jsx         ← React app mount
    │   └── index.css        ← Tailwind CSS directives
    └── NeuroCardioExplainer.jsx  ← ★ Main split-screen React UI component
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** v18 or higher
- **npm** v9 or higher

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the project root:

```env
# Tavus AI Configuration
TAVUS_API_KEY=your_tavus_api_key_here
TAVUS_REPLICA_ID=your_replica_id_here
TAVUS_TEST_MODE=false

# Gemini AI Configuration (for Branch A scripts)
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-flash-latest

# Optional
API_PORT=3001
PUBLIC_SERVER_URL=https://your-public-domain.com   # Required for Tavus KB doc ingestion in prod
```

> **Note:** If `TAVUS_API_KEY` is not set, the system automatically runs in **preview / mock mode** — all UI flows work, but no real Tavus calls are made.

### 3. Start the Development Server

Starts both the frontend (Vite, port 3000) and backend (Express, port 3001) concurrently:

```bash
npm run dev
```

Individual servers:
```bash
npm run dev:frontend   # Vite only (port 3000)
npm run dev:backend    # Express only (port 3001)
```

---

## 🔌 API Reference — Express Backend (`server.js`)

All routes are served from port **3001** and proxied through Vite on port **3000** in dev.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/logs` | **SSE stream** — real-time backend log feed for the browser terminal |
| `POST` | `/api/explainer/generate-video` | Generate an AI avatar video (MP4) for a report. Accepts `report_file`, `report_text`, `sample_key`, `target_audience`. Returns `video_id` + `status`. |
| `GET` | `/api/explainer/video-status/:videoId` | Poll render status. Returns `status`, `hosted_url`, `download_url`, `progress`. |
| `POST` | `/api/explainer/start-cvi` | Create a Tavus Persona + Conversation (CVI) for live interactive Q&A. Returns `conversation_url`. |
| `POST` | `/api/explainer/end-cvi/:id` | End a live CVI session gracefully. |
| `POST` | `/api/explainer/upload-document` | Upload a PDF/doc to the Tavus Knowledge Base for RAG. Returns `document_id`. |
| `GET` | `/api/explainer/document-status/:docId` | Poll document ingestion progress. |
| `GET` | `/api/uploads/:fileId` | Serve a temporarily stored file (used by Tavus cloud to fetch uploaded docs). |

### Request Fields — `generate-video` & `start-cvi`

| Field | Type | Description |
|---|---|---|
| `target_audience` | `string` | `"patient"` or `"doctor"` |
| `sample_key` | `string` | Optional preset key: `"pots_dysautonomia"` or `"vasovagal_syncope"` |
| `report_text` | `string` | Raw report text (alternative to file upload) |
| `report_file` | `File` | PDF or TXT report file upload |
| `document_ids` | `JSON string` | Optional Tavus KB document IDs for RAG in CVI sessions |

---

## ⚡ Testing

### Integration Smoke Test (Node.js)

Requires the Express backend to be running (`npm run dev:backend`):

```bash
node backend/smoke-test.mjs
```

Tests all 8 API endpoints and prints a pass/fail summary.

---

## 🏗️ How It Works

### Avatar Explainer Flow
1. User selects a preset or uploads a PDF report
2. Frontend posts to `POST /api/explainer/generate-video`
3. Backend extracts text, builds a personalized script (`buildScript()`), and submits to Tavus `POST /v2/videos`
4. Frontend polls `GET /api/explainer/video-status/:id` every 5 seconds
5. When status is `"ready"`, the `<video>` or `<iframe>` player renders the result

### Interactive CVI Flow
1. User clicks "Start Live Chat"
2. Frontend posts to `POST /api/explainer/start-cvi`
3. Backend creates a Tavus Persona (with the report as the system prompt) + a Conversation room
4. Frontend receives `conversation_url` and connects via Daily.co WebRTC (`@daily-co/daily-js`)
5. User speaks directly to the AI avatar in real time
6. On exit, `POST /api/explainer/end-cvi/:id` closes the session

---

## 📝 Environment Variable Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `TAVUS_API_KEY` | No* | `` | Tavus API key. Without it, system runs in mock mode. |
| `TAVUS_REPLICA_ID` | No* | `` | Tavus replica/avatar ID to use. |
| `GEMINI_API_KEY` | No* | `` | Google Gemini API key for generating Branch A scripts. |
| `GEMINI_MODEL` | No | `gemini-flash-latest` | The Gemini LLM to use. |
| `TAVUS_TEST_MODE` | No | `false` | Set to `true` to use Tavus test mode (free, no credits deducted) |
| `API_PORT` | No | `3001` | Port for the Express backend server |
| `PUBLIC_SERVER_URL` | No | `http://localhost:3001` | Public URL for Tavus cloud to fetch uploaded documents |

*Without `TAVUS_API_KEY` and `TAVUS_REPLICA_ID`, the system operates in preview/mock mode.
