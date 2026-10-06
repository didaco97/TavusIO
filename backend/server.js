/**
 * CardioNexus — Tavus CVI Backend
 *
 * Flow:
 *   1. POST /api/cvi/upload-pdf        — Upload PDF, extract text, return scraped text
 *   2. POST /api/cvi/start             — Inject scraped text as system prompt → start Tavus CVI
 *   3. POST /api/cvi/end/:id           — End CVI session
 *   GET  /api/logs                     — SSE stream for backend logs
 */

import express from 'express';
import multer from 'multer';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { randomUUID } from 'crypto';

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

dotenv.config({ override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app    = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

app.use(express.json());

// ─── Config ──────────────────────────────────────────────────────────────────
const TAVUS_API_KEY    = process.env.TAVUS_API_KEY    || '';
const TAVUS_REPLICA_ID = process.env.TAVUS_REPLICA_ID || '';
const TAVUS_BASE_URL   = 'https://tavusapi.com/v2';
const TAVUS_TEST_MODE  = (process.env.TAVUS_TEST_MODE || '').toLowerCase() === 'true';
const PORT             = process.env.API_PORT || 3001;

// ─── Medical Summary Extractor ──────────────────────────────────────────────────
// Pulls key clinical findings from raw PDF text to build a spoken greeting.
// Looks for structured section headers common in cardiac reports.
// Falls back to the first dense paragraph if no headers are found.
function extractMedicalSummary(text) {
  if (!text) return '';

  // 1. Try structured section headers (most structured reports)
  const sectionPatterns = [
    /impression[:\s]+([\s\S]{40,600}?)(?=\n[A-Z][A-Z ]{3,}:|\n\n\n|$)/i,
    /conclusion[:\s]+([\s\S]{40,600}?)(?=\n[A-Z][A-Z ]{3,}:|\n\n\n|$)/i,
    /findings[:\s]+([\s\S]{40,600}?)(?=\n[A-Z][A-Z ]{3,}:|\n\n\n|$)/i,
    /diagnosis[:\s]+([\s\S]{40,600}?)(?=\n[A-Z][A-Z ]{3,}:|\n\n\n|$)/i,
    /assessment[:\s]+([\s\S]{40,600}?)(?=\n[A-Z][A-Z ]{3,}:|\n\n\n|$)/i,
    /summary[:\s]+([\s\S]{40,600}?)(?=\n[A-Z][A-Z ]{3,}:|\n\n\n|$)/i,
  ];

  for (const pattern of sectionPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const cleaned = match[1]
        .replace(/\n+/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim()
        .slice(0, 450);
      if (cleaned.length > 40) return cleaned;
    }
  }

  // 2. Fallback: first paragraph with clinical keywords
  const clinicalTerms = [
    'ejection fraction', 'rhythm', 'sinus', 'stenosis', 'regurgitation',
    'hypertension', 'infarction', 'ischemia', 'cardiomegaly', 'normal',
    'mmhg', 'bpm', 'ecg', 'echo', 'echocardiogram', 'troponin',
    'diagnosis', 'result', 'finding', 'impression',
  ];

  const sentences = text
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 25);

  const keySentences = sentences
    .filter(s => clinicalTerms.some(t => s.toLowerCase().includes(t)))
    .slice(0, 3)
    .join(' ');

  if (keySentences.length > 40) return keySentences.slice(0, 450);

  // 3. Last resort: first 350 chars of content
  return text.replace(/\s+/g, ' ').trim().slice(0, 350);
}

// ─── SSE Log Broadcaster ─────────────────────────────────────────────────────
const logClients = new Set();

function broadcast(level, msg) {
  const line = JSON.stringify({ level, msg, ts: new Date().toISOString() });
  for (const res of logClients) {
    try { res.write(`data: ${line}\n\n`); } catch { logClients.delete(res); }
  }
}

const _log   = console.log.bind(console);
const _error = console.error.bind(console);
const _warn  = console.warn.bind(console);
console.log   = (...a) => { _log(...a);   broadcast('info',  a.join(' ')); };
console.error = (...a) => { _error(...a); broadcast('error', a.join(' ')); };
console.warn  = (...a) => { _warn(...a);  broadcast('warn',  a.join(' ')); };

app.get('/api/logs', (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();
  logClients.add(res);
  broadcast('info', '[LOG STREAM] Terminal connected.');
  req.on('close', () => logClients.delete(res));
});

// ─── Tavus Helper ─────────────────────────────────────────────────────────────
async function tavus(method, apiPath, body = null) {
  const url  = `${TAVUS_BASE_URL}${apiPath}`;
  const opts = {
    method,
    headers: { 'x-api-key': TAVUS_API_KEY, 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);

  const res  = await fetch(url, opts);
  const text = await res.text();
  let data   = {};
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!res.ok) {
    const msg = data.error || data.message || `Tavus HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

// ─── 1. POST /api/cvi/upload-pdf ─────────────────────────────────────────────
// Receives PDF, extracts text, returns the scraped content to the frontend.
app.post('/api/cvi/upload-pdf', upload.single('report_file'), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded.' });

  const ext = path.extname(file.originalname).toLowerCase();
  if (ext !== '.pdf') {
    return res.status(400).json({ error: 'Only PDF files are supported.' });
  }

  let extractedText = '';
  try {
    console.log(`[PDF] Extracting text from: ${file.originalname}`);
    const parser  = new PDFParse({ data: file.buffer });
    const pdfData = await parser.getText();
    extractedText = (pdfData.text || '').trim();
    console.log(`[PDF] Extracted ${extractedText.length} characters, ~${extractedText.split(/\s+/).length} words`);
  } catch (err) {
    console.error('[PDF] Parse error:', err.message);
    return res.status(400).json({ error: 'Failed to extract text from PDF: ' + err.message });
  }

  if (!extractedText) {
    return res.status(400).json({ error: 'PDF appears to be empty or image-only (no extractable text).' });
  }

  res.json({
    success: true,
    file_name: file.originalname,
    extracted_text: extractedText,
    word_count: extractedText.split(/\s+/).length,
    char_count: extractedText.length,
  });
});

// ─── 2. POST /api/cvi/start ───────────────────────────────────────────────────
//
// RESEARCH FINDINGS (Tavus CVI docs):
//
//  ┌─────────────────────┬──────────────────┬────────────────────────────────────────────────┐
//  │ Field               │ Set at           │ Behaviour                                      │
//  ├─────────────────────┼──────────────────┼────────────────────────────────────────────────┤
//  │ system_prompt       │ POST /personas   │ Permanent brain — identity, role, guardrails   │
//  │ conversational_ctx  │ POST /convo      │ Session data appended to system prompt         │
//  │ custom_greeting     │ POST /convo      │ Spoken VERBATIM immediately when session starts│
//  └─────────────────────┴──────────────────┴────────────────────────────────────────────────┘
//
// STRATEGY to achieve "greet → summarise → open Q&A":
//
//  1. custom_greeting = greeting line ONLY (spoken verbatim, kept short)
//  2. system_prompt   = full persona + EXPLICIT INSTRUCTION to immediately follow
//     the greeting with a report summary covering key findings, then invite questions
//  3. conversational_context = full report text (session-scoped, additive)
//
//  This is the correct Tavus-native approach. The LLM driving the avatar reads both
//  system_prompt and conversational_context before generating its first real turn
//  (which immediately follows the custom_greeting). So the avatar will:
//    a. Speak the verbatim greeting
//    b. On its very next turn, deliver the proactive report summary
//    c. Then wait and answer patient questions
//
app.post('/api/cvi/start', async (req, res) => {
  const { extracted_text, custom_system_prompt } = req.body;

  if (!extracted_text || !extracted_text.trim()) {
    return res.status(400).json({ error: 'No report text provided. Please upload a PDF first.' });
  }

  const sessionId = randomUUID();


  // ── custom_greeting — SHORT, verbatim, permission-based ───────────────────
  //  Spoken immediately on connect. Kept intentionally brief:
  //  greet → confirm patient is ready → ask permission to summarise.
  //  The LLM then delivers the actual summary only after user says "yes".
  //  This gives natural interruption handling and a conversational feel.
  const greeting = `Hi, I'm Dr. Raj, welcome to CardioNexus. ` +
    `I've reviewed your cardiac report. ` +
    `Shall we go through the key findings together?`;

  // ── system_prompt — Q&A + conditional summary flow ───────────────────────
  const defaultSystemPrompt = `\
## Identity
You are Dr. Raj, a senior AI Cardiologist at CardioNexus — a premium cardiac care platform.
You are calm, warm, empathetic, and highly professional.
Speak like a trusted physician who genuinely cares about the patient's wellbeing.
Your tone is measured and reassuring. Always speak in first person. Never break character.

## Conversation Flow

### Step 1 — Opening (already done via greeting)
You have already greeted the patient with:
"Hi, I'm Dr. Raj, welcome to CardioNexus. I've reviewed your cardiac report. Shall we go through the key findings together?"
Do NOT repeat this greeting.

### Step 2 — When patient confirms (yes / sure / please / go ahead / ok / absolutely)
Immediately deliver a clear spoken summary of the report's KEY FINDINGS:
- Cover the 3 to 5 most clinically significant points from the report.
- Speak in plain, jargon-free language — no bullet points, natural flowing sentences.
- Keep each point brief and clear. Pause naturally between points.
- End the summary by inviting questions:
  "That's the overall picture of your report. Do you have any questions about any of these findings?"

### Step 3 — Q&A (after summary or if patient asks a direct question)
- Answer questions clearly, referring to specific values in the report.
- Use simple analogies where helpful (e.g., "Think of your heart as a pump...").
- Be reassuring — acknowledge that reports can feel overwhelming.
- If asked about treatment or next steps, give a helpful overview and advise confirming with their treating physician.
- If asked something outside the report, redirect warmly: "That's a great question — I'd recommend speaking with your doctor about that directly."
- Never fabricate findings not present in the report.
- Keep each response conversational and concise — the patient can always ask for more.

### Interruptions
If the patient speaks while you are explaining, stop immediately and respond to what they said.
Never continue a monologue if the patient has asked something.

## Tone & Demeanour
Warm. Professional. Calm. Like a senior cardiologist with decades of experience
making complex cardiac information feel accessible and not scary.`;

  const systemPrompt = custom_system_prompt
    ? custom_system_prompt.trim()
    : defaultSystemPrompt;

  // 3. CONVERSATIONAL CONTEXT — full report text injected per-session
  //    This is additive to the system prompt and provides the actual document
  //    the LLM grounds its summary and answers from.
  const reportContext = `\
The following is the patient's uploaded cardiac report. \
Use this as your primary source of truth for the session summary and all Q&A responses.

=== PATIENT CARDIAC REPORT ===
${extracted_text.slice(0, 12000)}
=== END OF REPORT ===`;

  // ── No API Key → Mock Mode ─────────────────────────────────────────────────
  if (!TAVUS_API_KEY || !TAVUS_REPLICA_ID) {
    console.warn('[CVI] No API keys — returning mock session.');
    return res.status(201).json({
      session_id:       sessionId,
      conversation_id:  `mock_${sessionId.slice(0, 8)}`,
      conversation_url: null,
      greeting,
      is_mock: true,
    });
  }

  try {
    // Step 1 — Create Persona with the full system prompt
    console.log('[CVI] Creating Dr. Raj persona...');
    const persona = await tavus('POST', '/personas', {
      persona_name:       `DrRaj-CardioNexus-${sessionId.slice(0, 6)}`,
      system_prompt:      systemPrompt,
      default_replica_id: TAVUS_REPLICA_ID,
      pipeline_mode:      'full',
    });
    console.log(`[CVI] Persona created: ${persona.persona_id}`);

    // Step 2 — Create Conversation
    //   custom_greeting → spoken VERBATIM immediately on connect (no user input needed)
    //                     dynamically built with actual report findings on the backend
    //   conversational_context → full report text for LLM Q&A grounding
    console.log('[CVI] Creating conversation room...');
    const convo = await tavus('POST', '/conversations', {
      persona_id:             persona.persona_id,
      conversation_name:      `CardioNexus-DrRaj-${sessionId.slice(0, 8)}`,
      conversational_context: reportContext,
      custom_greeting:        greeting,
      test_mode:              TAVUS_TEST_MODE,
      max_participants:       2,
    });
    console.log(`[CVI] Conversation ready — id: ${convo.conversation_id}  url: ${convo.conversation_url}`);

    res.status(201).json({
      session_id:       sessionId,
      persona_id:       persona.persona_id,
      conversation_id:  convo.conversation_id,
      conversation_url: convo.conversation_url,
      greeting,
      is_mock: false,
    });
  } catch (err) {
    console.error('[CVI] Error:', err.message);

    // Graceful fallback on API limits / billing errors
    if (
      err.message.includes('concurrent') ||
      err.message.includes('limit') ||
      err.message.includes('Payment required') ||
      err.message.includes('402')
    ) {
      console.warn('[CVI] API limit reached — falling back to mock session.');
      return res.status(201).json({
        session_id:       sessionId,
        conversation_id:  `mock_${sessionId.slice(0, 8)}`,
        conversation_url: null,
        greeting,
        is_mock: true,
      });
    }

    res.status(502).json({ error: err.message });
  }
});

// ─── 3. POST /api/cvi/end/:id ────────────────────────────────────────────────
app.post('/api/cvi/end/:id', async (req, res) => {
  const { id } = req.params;
  if (id.startsWith('mock_')) return res.json({ status: 'ended', is_mock: true });
  try {
    await tavus('POST', `/conversations/${id}/end`);
    console.log(`[CVI] Session ended: ${id}`);
    res.json({ status: 'ended' });
  } catch (err) {
    console.error('[CVI END] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════════════════════╗`);
  console.log(`║         CardioNexus — Tavus CVI Backend              ║`);
  console.log(`╚══════════════════════════════════════════════════════╝`);
  console.log(`  Listening on http://localhost:${PORT}\n`);
  console.log(`  POST /api/cvi/upload-pdf    — Upload & scrape PDF`);
  console.log(`  POST /api/cvi/start         — Start Dr. Raj CVI session`);
  console.log(`  POST /api/cvi/end/:id       — End CVI session`);
  console.log(`  GET  /api/logs              — SSE log stream\n`);
  console.log(`  TAVUS_API_KEY : ${TAVUS_API_KEY  ? 'OK (' + TAVUS_API_KEY.slice(0, 8)  + '...)' : 'MISSING — mock mode'}`);
  console.log(`  TAVUS_REPLICA : ${TAVUS_REPLICA_ID || 'MISSING — mock mode'}`);
  console.log(`  TEST_MODE     : ${TAVUS_TEST_MODE}\n`);
});
