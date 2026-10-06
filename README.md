# CardioNexus — Tavus CVI Integration

AI cardiac consultant powered by Tavus Conversational Video Intelligence (CVI).

## Flow

1. **Upload PDF** — Patient uploads a cardiac report (ECG, echo, cath lab, discharge summary)
2. **Text Extraction** — Backend scrapes all text from the PDF via `pdf-parse`
3. **CVI Session** — Dr. Raj (Tavus avatar) is initialized with the report as context and greets the patient live

## Setup

```bash
npm install
```

Configure `.env`:
```
TAVUS_API_KEY=your_key_here
TAVUS_REPLICA_ID=your_replica_id
TAVUS_TEST_MODE=false
API_PORT=3001
```

## Run

```bash
npm run dev
```

- Frontend: http://localhost:3000
- Backend:  http://localhost:3001

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/cvi/upload-pdf` | Upload PDF, extract text |
| `POST` | `/api/cvi/start` | Start Dr. Raj CVI session |
| `POST` | `/api/cvi/end/:id` | End CVI session |
| `GET`  | `/api/logs` | SSE backend log stream |
