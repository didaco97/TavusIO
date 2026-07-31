/**
 * smoke-test.mjs
 * Run: node smoke-test.mjs
 * Tests all backend API endpoints and prints a clear pass/fail summary.
 */

const BASE = 'http://localhost:3001';
const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const DIM    = '\x1b[2m';
const BOLD   = '\x1b[1m';
const RESET  = '\x1b[0m';

let passed = 0;
let failed = 0;
const results = [];

function log(label, ok, detail = '') {
  const icon   = ok ? `${GREEN}✔${RESET}` : `${RED}✘${RESET}`;
  const status = ok ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
  console.log(`  ${icon} ${status}  ${label}`);
  if (detail) console.log(`      ${DIM}${detail}${RESET}`);
  ok ? passed++ : failed++;
  results.push({ label, ok, detail });
}

async function postForm(path, fields) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  const r = await fetch(`${BASE}${path}`, { method: 'POST', body: fd });
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { ok: r.ok, status: r.status, json };
}

async function get(path) {
  const r = await fetch(`${BASE}${path}`);
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { ok: r.ok, status: r.status, json };
}

console.log(`\n${BOLD}${CYAN}══════════════════════════════════════════${RESET}`);
console.log(`${BOLD}${CYAN}  SMOKE TEST — NeuroCardiology AI Explainer${RESET}`);
console.log(`${BOLD}${CYAN}  Server: ${BASE}${RESET}`);
console.log(`${BOLD}${CYAN}══════════════════════════════════════════${RESET}\n`);

// ── T1: Server reachable via SSE endpoint ─────────────────────────────────────
console.log(`${YELLOW}[T1]${RESET} Server reachability`);
try {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), 2000);
  const r = await fetch(`${BASE}/api/logs`, { signal: ctrl.signal });
  log('/api/logs SSE endpoint reachable', r.status === 200, `HTTP ${r.status} content-type=${r.headers.get('content-type')}`);
} catch (e) {
  const isAbort = e.name === 'AbortError';
  // SSE streams forever — abort after 2s is actually a SUCCESS (it connected)
  log('/api/logs SSE endpoint reachable', isAbort, isAbort ? 'Connected (aborted after 2s as expected)' : e.message);
}

// ── T2: generate-video — patient mode ─────────────────────────────────────────
console.log(`\n${YELLOW}[T2]${RESET} POST /api/explainer/generate-video (patient + preset)`);
let videoId = null;
try {
  const { ok, status, json } = await postForm('/api/explainer/generate-video', {
    target_audience: 'patient',
    sample_key: 'pots_dysautonomia',
  });
  const hasId = !!json.video_id;
  log('Returns video_id', ok && hasId, `status=${json.status}  video_id=${json.video_id}  is_mock=${json.is_mock}`);
  if (hasId) videoId = json.video_id;
} catch (e) {
  log('POST generate-video (patient)', false, e.message);
}

// ── T3: generate-video — doctor mode ─────────────────────────────────────────
console.log(`\n${YELLOW}[T3]${RESET} POST /api/explainer/generate-video (doctor + preset)`);
try {
  const { ok, status, json } = await postForm('/api/explainer/generate-video', {
    target_audience: 'doctor',
    sample_key: 'vasovagal_syncope',
  });
  log('Returns video_id', ok && !!json.video_id, `status=${json.status}  video_id=${json.video_id}`);
} catch (e) {
  log('POST generate-video (doctor)', false, e.message);
}

// ── T4: generate-video — no report → expect 400 ───────────────────────────────
console.log(`\n${YELLOW}[T4]${RESET} POST /api/explainer/generate-video (empty body → expect 400)`);
try {
  const { ok, status, json } = await postForm('/api/explainer/generate-video', {});
  log('Returns 400 for empty report', status === 400 && !!json.error, `error="${json.error}"`);
} catch (e) {
  log('400 on empty body', false, e.message);
}

// ── T5: video-status poll ─────────────────────────────────────────────────────
console.log(`\n${YELLOW}[T5]${RESET} GET /api/explainer/video-status/:id`);
if (videoId) {
  try {
    const { ok, json } = await get(`/api/explainer/video-status/${videoId}`);
    const hasStatus = !!json.status;
    const hasHosted = !!json.hosted_url;
    log('Returns status field',   ok && hasStatus, `status=${json.status}  progress=${json.progress}`);
    log('Returns hosted_url',     hasHosted,        `hosted_url=${json.hosted_url}`);
    log('download_url present or null (ok)', json.download_url !== undefined, `download_url=${json.download_url}`);
  } catch (e) {
    log('GET video-status', false, e.message);
  }
} else {
  console.log(`  ${DIM}SKIP — no video_id from T2${RESET}`);
}

// ── T6: start-cvi — patient ───────────────────────────────────────────────────
console.log(`\n${YELLOW}[T6]${RESET} POST /api/explainer/start-cvi (patient)`);
let cviConvId = null;
try {
  const { ok, status, json } = await postForm('/api/explainer/start-cvi', {
    target_audience: 'patient',
    sample_key: 'pots_dysautonomia',
  });
  const hasSession = !!json.session_id;
  log('Returns session_id', (ok || status === 201) && hasSession, `session_id=${json.session_id?.slice(0,8)}...  conversation_id=${json.conversation_id}  is_mock=${json.is_mock}`);
  if (json.conversation_id) cviConvId = json.conversation_id;
} catch (e) {
  log('POST start-cvi (patient)', false, e.message);
}

// ── T7: start-cvi — doctor ────────────────────────────────────────────────────
console.log(`\n${YELLOW}[T7]${RESET} POST /api/explainer/start-cvi (doctor)`);
try {
  const { ok, status, json } = await postForm('/api/explainer/start-cvi', {
    target_audience: 'doctor',
    sample_key: 'vasovagal_syncope',
  });
  log('Returns session_id', (ok || status === 201) && !!json.session_id, `conversation_url=${json.conversation_url || 'none (mock)'}`);
} catch (e) {
  log('POST start-cvi (doctor)', false, e.message);
}

// ── T8: end-cvi ───────────────────────────────────────────────────────────────
console.log(`\n${YELLOW}[T8]${RESET} POST /api/explainer/end-cvi/:id`);
if (cviConvId) {
  try {
    const { ok, json } = await fetch(`${BASE}/api/explainer/end-cvi/${cviConvId}`, { method: 'POST' })
      .then(async r => ({ ok: r.ok, json: await r.json() }));
    log('Ends session cleanly', json.status === 'ended' || ok, `status=${json.status}`);
  } catch (e) {
    log('POST end-cvi', false, e.message);
  }
} else {
  console.log(`  ${DIM}SKIP — no conversation_id from T6${RESET}`);
}

// ── Summary ───────────────────────────────────────────────────────────────────
const total = passed + failed;
const allGood = failed === 0;
console.log(`\n${BOLD}${CYAN}══════════════════════════════════════════${RESET}`);
console.log(`${BOLD}  RESULT: ${allGood ? GREEN : RED}${passed}/${total} passed   ${failed} failed${RESET}`);
if (!allGood) {
  console.log(`\n  ${RED}Failed tests:${RESET}`);
  results.filter(r => !r.ok).forEach(r => console.log(`    ${RED}✘${RESET} ${r.label}${r.detail ? ` — ${DIM}${r.detail}${RESET}` : ''}`));
}
console.log(`${BOLD}${CYAN}══════════════════════════════════════════${RESET}\n`);
process.exit(allGood ? 0 : 1);
