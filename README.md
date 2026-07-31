<div align="center">
  
# 🧠🫀 NeuroCardiology AI Explainer

**Translating complex neurocardiology diagnostic reports into tailored, accessible insights.**

[![React](https://img.shields.io/badge/React-18.2-blue.svg?style=for-the-badge&logo=react)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.1-purple.svg?style=for-the-badge&logo=vite)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC.svg?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Express](https://img.shields.io/badge/Express-4.18-lightgrey.svg?style=for-the-badge&logo=express)](https://expressjs.com/)
[![Python](https://img.shields.io/badge/Python-Backend-3776AB.svg?style=for-the-badge&logo=python)](https://python.org/)

</div>

---

The **NeuroCardiology AI Explainer** takes complex diagnostic reports (autonomic reflex screens, tilt table tests, POTS, vasovagal syncope, baroreflex sensitivity, HRV, stroke-cardiac correlates) and translates them into tailored explanations designed specifically for either **Doctors/Clinicians** or **Patients/Families**.

## ✨ Key Features

The platform provides two distinct, powerful explanation modes:

1. 📄 **Static Explainer**: Generates instant, structured clinical syntheses for doctors, or jargon-free plain language guides (complete with visual analogies) for patients.
2. 🎥 **Interactive CVI (Conversational Video Interface)**: Connects users to a live face-to-face WebRTC video avatar room powered by **Tavus AI**, pre-seeded with the patient's specific neurocardiology report context.

---

## 🎯 Target Audience Engine

Our dual-mode engine ensures the right tone, metrics, and actionable advice are delivered to the right audience.

| Feature | 👨‍⚕️ Doctor / Clinician Mode | 🧑‍🤝‍🧑 Patient / Family Mode |
| :--- | :--- | :--- |
| **Tone** | Rigorous, precise, peer-to-peer clinical language | Warm, empathetic, reassuring, zero jargon |
| **Metrics Focus** | Tilt HR delta, BRS slope, RMSSD, QSART, LF/HF ratios | Simple bullet points, clear normal vs elevated flags |
| **Pathophysiology** | Sympathetic surge, cardiovagal withdrawal, baroreflex failure | Smart thermostat analogy (brain-heart thermostat) |
| **Action Plan** | Pharmacotherapy (Propranolol, Ivabradine), Levine Protocol | Hydration (2.5-3L), salt intake, compression socks |

---

## 📁 Project Architecture

A full-stack application leveraging a React frontend (Vite) and an Express/Python backend.

```text
TAVUS integration/
├── 📄 .env                           # Environment variables
├── 📄 package.json                   # Node dependencies & scripts
├── 📂 src/                           # Vite entry points (main.jsx, index.css)
├── 📂 backend/                       # Python & Express Backend
│   ├── explainer_prompts.py          # Clinical prompts, report parser & sample presets
│   ├── explainer_routes.py           # REST endpoints for report analysis & CVI room creation
│   ├── interview_routes.py           # Additional routes for Interview modes
│   ├── tavus_client.py               # Tavus V2 API wrapper (persona & conversation management)
│   └── test_*.py                     # CLI test suites
└── 📂 frontend/                      # React Frontend Components
    ├── NeuroCardioExplainer.jsx      # Main dashboard UI (Audience selector, Mode toggle)
    ├── CVIExplainerRoom.jsx          # React WebRTC video room component for Tavus CVI
    └── InterviewRoom.jsx             # React WebRTC room for interviews
```

---

## 🚀 Getting Started

Follow these steps to set up the project locally.

### 1. Prerequisites
- Node.js (v18+ recommended)
- Python (3.9+ recommended)

### 2. Installation

Clone the repository and install dependencies:

```bash
npm install
```

### 3. Environment Variables

Create a `.env` file in the root directory based on the following template:

```env
# Tavus AI Configuration
TAVUS_API_KEY=your_tavus_api_key
TAVUS_BASE_URL=https://tavusapi.com/v2
TAVUS_REPLICA_ID=your_replica_id   # (Optional specific visual replica)
```

> **Note**: If `TAVUS_API_KEY` is not supplied, the system automatically runs in interactive preview / mock mode for UI testing.

### 4. Running the Development Server

Start both the frontend (Vite) and backend (Express/Python) simultaneously:

```bash
npm run dev
```

You can also run them separately if needed:
- Frontend: `npm run dev:frontend`
- Backend: `npm run dev:backend`

---

## 🔌 API Reference (`backend/explainer_routes.py`)

- `GET /api/explainer/sample-reports/`
  Retrieves pre-loaded test cases (e.g., POTS, Vasovagal Syncope, Cardioembolic Stroke Risk).
- `POST /api/explainer/analyze/`
  Accepts uploaded report file (`.pdf`, `.txt`) or raw text and target audience (`doctor` or `patient`), returning a structured static analysis.
- `POST /api/explainer/start-cvi/`
  Creates a Tavus AI NeuroCardiology Persona tuned to the uploaded report and returns a WebRTC video room iframe URL.
- `POST /api/explainer/end-cvi/<conversation_id>/`
  Concludes a live video session and fetches the transcript Q&A log.

---

## ⚡ Testing

Run the Python test suite from the terminal to verify prompts, parsing, and the Tavus API integration:

```bash
python backend/test_explainer.py
python backend/test_tavus.py
```
