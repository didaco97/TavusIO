/**
 * NeuroCardiology AI Explainer — Backend Server
 *
 * Two distinct modes:
 *
 * 1. AVATAR EXPLAINER  (/api/explainer/generate-video)
 *    → Calls Tavus POST /v2/videos with the report-derived script.
 *    → Returns a video_id + status. Frontend polls /api/explainer/video-status/:id
 *      until status === "ready", then plays the returned video_url in a <video> tag.
 *
 * 2. INTERACTIVE Q&A  (/api/explainer/start-cvi)
 *    → Creates a Tavus Persona + Conversation (CVI) so the user can talk to the avatar.
 */

import express from 'express';
import multer from 'multer';
import dotenv from 'dotenv';

// Local .env settings must win over a stale inherited dev-shell variable.
dotenv.config({ override: true });

const app  = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.use(express.json());

// ─── Config ──────────────────────────────────────────────────────────────────
const TAVUS_API_KEY    = process.env.TAVUS_API_KEY   || '';
const TAVUS_REPLICA_ID = process.env.TAVUS_REPLICA_ID || '';
const TAVUS_BASE_URL   = 'https://tavusapi.com/v2';
const TAVUS_TEST_MODE  = (process.env.TAVUS_TEST_MODE || '').toLowerCase() === 'true';

// ─── SSE Log broadcaster ─────────────────────────────────────────────────────
// All connected frontend terminals receive structured log lines in real time.
const logClients = new Set();

function broadcast(level, msg) {
  const line = JSON.stringify({ level, msg, ts: new Date().toISOString() });
  for (const res of logClients) {
    try { res.write(`data: ${line}\n\n`); } catch { logClients.delete(res); }
  }
}

// Override console so every server log also goes to the browser terminal
const _log   = console.log.bind(console);
const _error = console.error.bind(console);
const _warn  = console.warn.bind(console);
console.log   = (...a) => { _log(...a);   broadcast('info',  a.join(' ')); };
console.error = (...a) => { _error(...a); broadcast('error', a.join(' ')); };
console.warn  = (...a) => { _warn(...a);  broadcast('warn',  a.join(' ')); };

// SSE endpoint — frontend subscribes to this
app.get('/api/logs', (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();
  logClients.add(res);
  broadcast('info', '[LOG STREAM] Frontend terminal connected.');
  req.on('close', () => logClients.delete(res));
});

console.log(`[SERVER] TAVUS_API_KEY : ${TAVUS_API_KEY ? 'OK (' + TAVUS_API_KEY.slice(0,8) + '...)' : 'MISSING'}`);
console.log(`[SERVER] TAVUS_REPLICA : ${TAVUS_REPLICA_ID || 'MISSING'}`);
console.log(`[SERVER] TEST_MODE     : ${TAVUS_TEST_MODE}`);

// ─── Tavus helper ─────────────────────────────────────────────────────────────
async function tavus(method, path, body = null) {
  const url = `${TAVUS_BASE_URL}${path}`;
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

// ─── Sample reports ───────────────────────────────────────────────────────────
const SAMPLE_REPORTS = {
  pots_dysautonomia: {
    title: 'POTS — Postural Orthostatic Tachycardia Syndrome',
    text: `EXAMINATION: Comprehensive Autonomic Function Testing & Tilt Table Evaluation

CLINICAL INDICATION: Recurrent lightheadedness, exercise intolerance, palpitations upon standing.

FINDINGS:
1. RESTING PARAMETERS: Supine HR 64 bpm, Supine BP 118/74 mmHg.
   - 10-Min Head-Up Tilt (HUT): HR spiked from 64 to 112 bpm (+48 bpm spike) within 3 mins of standing. BP remained stable (114/72 mmHg).
2. CARDIOVAGAL: E:I Ratio 1.18. QSART showed reduced sweat volume in lower extremities (foot: 0.11 ul/cm2).
3. HRV: LF/HF Ratio 3.4 (Elevated sympathetic predominance).

IMPRESSION: Postural Orthostatic Tachycardia Syndrome (POTS), hyperadrenergic component. Mild sudomotor neuropathy.`,
  },
  vasovagal_syncope: {
    title: 'Vasovagal Syncope & Baroreflex Sensitivity',
    text: `EXAMINATION: Autonomic Reflex Screen & Continuous ECG Syncope Evaluation

CLINICAL INDICATION: 3 episodes of sudden loss of consciousness preceded by diaphoresis and nausea.

FINDINGS:
1. HEAD-UP TILT TEST: Minute 18 tilt showed precipitous HR drop to 34 bpm with BP drop to 70/40 mmHg.
2. BAROREFLEX SENSITIVITY: Sequence BRS = 4.2 ms/mmHg (Depressed baroreflex buffering).
3. HOLTER: Normal sinus rhythm at rest; no structural heart disease.

IMPRESSION: Neurocardiogenic (Vasovagal) Syncope — Mixed Cardioinhibitory & Vasodepressor response.`,
  },
};

// ─── Script builder ───────────────────────────────────────────────────────────
function buildScript(reportText, isDoctor) {
  // Extract IMPRESSION line if present
  const impressionMatch = reportText.match(/IMPRESSION:\s*(.+)/is);
  const impression = impressionMatch ? impressionMatch[1].split('\n')[0].trim() : '';

  if (isDoctor) {
    return `Hello Doctor. I have reviewed the submitted neurocardiology and autonomic evaluation report in full detail.

${impression ? `The overall clinical impression reads: "${impression}".` : ''}

Let me walk you through the key findings now.

${reportText.slice(0, 800)}

From a pathophysiological standpoint, the autonomic nervous system is demonstrating significant dysregulation. The findings indicate impaired baroreflex sensitivity and elevated sympathetic predominance, which together compromise the patient's hemodynamic stability upon orthostatic challenge.

My clinical recommendations are as follows. First, consider low-dose pharmacotherapy such as beta blockers or Ivabradine to reduce the abnormal heart rate response. Second, prescribe non-pharmacological interventions including high sodium intake, adequate fluid loading, and graduated compression garments. Third, initiate supervised recumbent exercise rehabilitation.

I recommend scheduling an autonomic panel re-assessment in twelve weeks to track treatment response. Please do not hesitate to consult further on any of these parameters.`;
  } else {
    return `Hello. I am Doctor Ava, your AI Neurocardiology Specialist, and I have carefully reviewed your health report.

${impression ? `The report's main finding is: "${impression}".` : ''}

Let me explain what all of this means for you in simple terms.

Think of your body's nervous system like a smart thermostat that controls your heart rate automatically. When you stand up, this thermostat should slowly increase your heart rate just a little, to make sure blood keeps reaching your brain. But in your case, this thermostat is overreacting and sending a very strong signal that makes your heart beat much faster than needed. That is what causes the dizziness and palpitations you have been feeling.

The good news is that your heart itself is perfectly healthy and strong. This is a signal regulation issue, not a structural problem.

Here is what you can do to feel better. Make sure you drink around two to three litres of water every day. Adding a little extra salt to your meals will also help your body hold on to more fluid, which supports your blood pressure. Wearing compression stockings will stop blood from pooling in your legs when you stand up. And when you do stand up, do it slowly and take a moment before you start walking.

Your doctor may also consider a gentle medication to stabilise your heart rate. You have very good options ahead of you. I recommend following up with your care team in the next few weeks to check on your progress. Thank you for trusting me with your care.`;
  }
}

// ─── 1. POST /api/explainer/generate-video  (Avatar Explainer — renders MP4) ──
app.post('/api/explainer/generate-video', upload.single('report_file'), async (req, res) => {
  let audience = (req.body.target_audience || 'patient').trim().toLowerCase();
  if (!['doctor', 'patient'].includes(audience)) audience = 'patient';

  let reportText = (req.body.report_text || '').trim();
  if (req.file) {
    try { reportText = req.file.buffer.toString('utf-8'); } catch {}
  }
  const sampleKey = (req.body.sample_key || '').trim();
  if (!reportText && SAMPLE_REPORTS[sampleKey]) {
    reportText = SAMPLE_REPORTS[sampleKey].text;
  }
  if (!reportText) {
    return res.status(400).json({ error: 'Please provide a report or select a sample.' });
  }

  const isDoctor = audience === 'doctor';
  const script   = buildScript(reportText, isDoctor);

  // ── No API key → return a hosted demo video so the UI still works ───────
  if (!TAVUS_API_KEY || !TAVUS_REPLICA_ID) {
    return res.json({
      video_id: 'demo',
      status:   'ready',
      video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      is_mock:  true,
    });
  }

  try {
    console.log('[VIDEO] Submitting to Tavus POST /v2/videos ...');
    const data = await tavus('POST', '/videos', {
      replica_id: TAVUS_REPLICA_ID,
      script,
      video_name: `neurocardio-${audience}-${Date.now()}`,
    });

    console.log(`[VIDEO] video_id=${data.video_id}  status=${data.status}`);
    res.json({
      video_id:  data.video_id,
      status:    data.status,      // usually "queued" or "generating"
      video_url: data.video_url || null,
      is_mock:   false,
    });
  } catch (err) {
    console.error('[VIDEO] Error:', err.message);
    res.status(502).json({ error: err.message });
  }
});

// ─── 2. GET /api/explainer/video-status/:videoId  (poll until "ready") ────────
app.get('/api/explainer/video-status/:videoId', async (req, res) => {
  const { videoId } = req.params;

  // Mock / demo shortcut
  if (videoId === 'demo') {
    return res.json({
      video_id:  'demo',
      status:    'ready',
      video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      is_mock:   true,
    });
  }

  try {
    const data = await tavus('GET', `/videos/${videoId}`);
    // Tavus returns: hosted_url (browser viewable), download_url (direct MP4)
    // hosted_url is always set; download_url appears only when fully rendered.
    const videoUrl = data.download_url || data.hosted_url || null;
    const progress = data.generation_progress || null;
    console.log(`[VIDEO STATUS] id=${videoId}  status=${data.status}  progress=${progress}  url=${videoUrl || '-'}`);
    res.json({
      video_id:  data.video_id,
      status:    data.status,       // "queued" | "generating" | "ready" | "failed"
      video_url: videoUrl,
      hosted_url: data.hosted_url || null,
      download_url: data.download_url || null,
      progress,
      is_mock:   false,
    });
  } catch (err) {
    console.error('[VIDEO STATUS] Error:', err.message);
    res.status(502).json({ error: err.message });
  }
});

// ─── 3. POST /api/explainer/start-cvi  (Interactive Q&A — live conversation) ──
app.post('/api/explainer/start-cvi', upload.single('report_file'), async (req, res) => {
  let audience = (req.body.target_audience || 'patient').trim().toLowerCase();
  if (!['doctor', 'patient'].includes(audience)) audience = 'patient';

  let reportText = (req.body.report_text || '').trim();
  if (req.file) {
    try { reportText = req.file.buffer.toString('utf-8'); } catch {}
  }
  const sampleKey = (req.body.sample_key || '').trim();
  if (!reportText && SAMPLE_REPORTS[sampleKey]) {
    reportText = SAMPLE_REPORTS[sampleKey].text;
  }
  if (!reportText) {
    return res.status(400).json({ error: 'Please provide a report or select a sample.' });
  }

  const isDoctor  = audience === 'doctor';
  const sessionId = crypto.randomUUID();

  const greeting = isDoctor
    ? "Hello Doctor. I have reviewed the patient's neurocardiology evaluation report in detail. Which findings would you like to explore first?"
    : "Hello! I'm Dr. Ava, your AI NeuroCardiology Specialist. I've reviewed your report and I'm here to answer all your questions. How are you feeling today?";

  const systemPrompt = isDoctor
    ? `You are Dr. Ava Vance, a senior AI NeuroCardiologist. You are speaking to a DOCTOR. Use precise clinical language. Discuss BRS slopes, RMSSD values, pathophysiology, and treatment protocols. Always reference the following report:\n\n---\n${reportText}\n---`
    : `You are Dr. Ava Vance, a warm and patient AI NeuroCardiologist. You are speaking to a PATIENT or their family. Use simple language and analogies. Avoid jargon. Be reassuring. Always reference the following report:\n\n---\n${reportText}\n---`;

  // No API key → return a mock room
  if (!TAVUS_API_KEY || !TAVUS_REPLICA_ID) {
    return res.status(201).json({
      session_id:       sessionId,
      target_audience:  audience,
      conversation_id:  `mock_${sessionId.slice(0, 8)}`,
      conversation_url: null,
      greeting,
      is_mock: true,
    });
  }

  try {
    console.log('[CVI] Creating persona ...');
    const persona = await tavus('POST', '/personas', {
      persona_name:       `NeuroCardio-${audience}-${sessionId.slice(0,6)}`,
      system_prompt:      systemPrompt,
      default_replica_id: TAVUS_REPLICA_ID,
      pipeline_mode:      'full',
    });
    console.log(`[CVI] persona_id=${persona.persona_id}`);

    console.log('[CVI] Creating conversation ...');
    const convo = await tavus('POST', '/conversations', {
      persona_id:              persona.persona_id,
      conversation_name:       `NeuroCardio Q&A — ${audience}`,
      conversational_context:  `Report context: ${reportText.slice(0, 500)}`,
      custom_greeting:         greeting,
      test_mode:               TAVUS_TEST_MODE,
      max_participants:        2,
    });
    console.log(`[CVI] conversation_id=${convo.conversation_id}  url=${convo.conversation_url}`);

    res.status(201).json({
      session_id:       sessionId,
      target_audience:  audience,
      persona_id:       persona.persona_id,
      conversation_id:  convo.conversation_id,
      conversation_url: convo.conversation_url,
      greeting,
      is_mock: false,
    });
  } catch (err) {
    console.error('[CVI] Error:', err.message);
    res.status(502).json({ error: err.message });
  }
});

// ─── 4. POST /api/explainer/end-cvi/:id ──────────────────────────────────────
app.post('/api/explainer/end-cvi/:id', async (req, res) => {
  const { id } = req.params;
  if (id.startsWith('mock_')) return res.json({ status: 'ended', is_mock: true });
  try {
    await tavus('POST', `/conversations/${id}/end`);
    res.json({ status: 'ended' });
  } catch (err) {
    console.error('[CVI END] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.API_PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n[SERVER] Running on http://localhost:${PORT}`);
  console.log(`  POST /api/explainer/generate-video   — Avatar Explainer (renders MP4)`);
  console.log(`  GET  /api/explainer/video-status/:id — Poll render status`);
  console.log(`  POST /api/explainer/start-cvi        — Interactive Q&A (live CVI)`);
  console.log(`  POST /api/explainer/end-cvi/:id      — End CVI session\n`);
});
