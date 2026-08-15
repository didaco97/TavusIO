import React, { useState, useEffect, useRef, useCallback } from "react";
import DailyIframe from "@daily-co/daily-js";
import { DailyProvider, DailyVideo, DailyAudio, useParticipantIds } from "@daily-co/daily-react";
import {
  Upload, Play, MessageCircle, ArrowRight, Check, Loader, Terminal, X,
  ChevronDown, Mic, MicOff, Brain, FileText, AlertCircle, Sparkles,
  Database, Video, Zap, ChevronRight, Eye, EyeOff
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   PRESETS
   ═══════════════════════════════════════════════════════════════════════════ */
const PRESETS = {
  pots_dysautonomia: {
    label: "POTS — Autonomic Tachycardia",
    text: `EXAMINATION: Comprehensive Autonomic Function Testing & Tilt Table Evaluation\n\nCLINICAL INDICATION: Recurrent lightheadedness, exercise intolerance, palpitations upon standing.\n\nFINDINGS:\n1. RESTING PARAMETERS: Supine HR 64 bpm, Supine BP 118/74 mmHg.\n   - 10-Min Head-Up Tilt (HUT): HR spiked from 64 to 112 bpm (+48 bpm spike) within 3 mins of standing. BP remained stable (114/72 mmHg).\n2. CARDIOVAGAL: E:I Ratio 1.18. QSART showed reduced sweat volume in lower extremities (foot: 0.11 ul/cm2).\n3. HRV: LF/HF Ratio 3.4 (Elevated sympathetic predominance).\n\nIMPRESSION: Postural Orthostatic Tachycardia Syndrome (POTS), hyperadrenergic component. Mild sudomotor neuropathy.`,
  },
  vasovagal_syncope: {
    label: "Vasovagal Syncope",
    text: `EXAMINATION: Autonomic Reflex Screen & Continuous ECG Syncope Evaluation\n\nCLINICAL INDICATION: 3 episodes of sudden loss of consciousness preceded by diaphoresis and nausea.\n\nFINDINGS:\n1. HEAD-UP TILT TEST: Minute 18 tilt showed precipitous HR drop to 34 bpm with BP drop to 70/40 mmHg.\n2. BAROREFLEX SENSITIVITY: Sequence BRS = 4.2 ms/mmHg (Depressed baroreflex buffering).\n3. HOLTER: Normal sinus rhythm at rest; no structural heart disease.\n\nIMPRESSION: Neurocardiogenic (Vasovagal) Syncope - Mixed Cardioinhibitory & Vasodepressor response.`,
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   DAILY.JS CLEANUP HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */
let dailyCleanupChain = Promise.resolve();
async function destroyDailyInstance(co) {
  if (!co || co.isDestroyed?.()) return;
  try { await co.leave(); } catch {}
  try { await co.destroy(); } catch {}
}
function queueDailyCleanup(co) { dailyCleanupChain = dailyCleanupChain.then(() => destroyDailyInstance(co)); return dailyCleanupChain; }
async function destroyExistingDailyInstance() {
  await dailyCleanupChain;
  try { const e = DailyIframe.getCallInstance?.(); if (e && !e.isDestroyed?.()) await destroyDailyInstance(e); } catch {}
}

/* ═══════════════════════════════════════════════════════════════════════════
   LOG TERMINAL
   ═══════════════════════════════════════════════════════════════════════════ */
function LogTerminal({ onClose }) {
  const [logs, setLogs] = useState([]);
  const [open, setOpen] = useState(true);
  const bottomRef = useRef(null);
  const esRef = useRef(null);
  useEffect(() => {
    esRef.current = new EventSource("/api/logs");
    esRef.current.onmessage = (e) => { try { setLogs(p => [...p.slice(-299), JSON.parse(e.data)]); } catch {} };
    esRef.current.onerror = () => setLogs(p => [...p, { level: "error", msg: "[STREAM] Disconnected.", ts: new Date().toISOString() }]);
    return () => esRef.current?.close();
  }, []);
  useEffect(() => { if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs, open]);
  const c = (l) => l === "error" ? "text-red-400" : l === "warn" ? "text-amber-400" : "text-emerald-300";
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#060e14] border-t border-white/10 shadow-2xl font-mono">
      <div className="flex items-center justify-between px-4 py-2 cursor-pointer select-none border-b border-white/5" onClick={() => setOpen(o => !o)}>
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs font-medium text-white/70">Backend Terminal</span>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={e => { e.stopPropagation(); setLogs([]); }} className="text-white/40 hover:text-white text-xs">clear</button>
          <button onClick={e => { e.stopPropagation(); onClose(); }} className="text-white/40 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
          <ChevronDown className={`w-3.5 h-3.5 text-white/40 transition-transform duration-200 ${open ? "" : "rotate-180"}`} />
        </div>
      </div>
      {open && (
        <div className="h-36 overflow-y-auto px-4 py-2 text-[11px] space-y-0.5 bg-[#040a0f]">
          {logs.length === 0 && <p className="text-white/30">Waiting for server events...</p>}
          {logs.map((log, i) => (
            <div key={i} className="flex gap-2 leading-relaxed">
              <span className="text-white/25 shrink-0 tabular-nums">{new Date(log.ts).toLocaleTimeString("en-US", { hour12: false })}</span>
              <span className={`break-all ${c(log.level)}`}>{log.msg}</span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SCROLLABLE TEXT WINDOW — used in pipeline viz
   ═══════════════════════════════════════════════════════════════════════════ */
function TextWindow({ title, icon: Icon, iconColor, text, status, accentColor = "sky" }) {
  const [expanded, setExpanded] = useState(false);
  const isEmpty = !text || text.trim().length === 0;
  const wordCount = text ? text.trim().split(/\s+/).length : 0;

  const colors = {
    sky:    { bg: "bg-sky-500/5",    border: "border-sky-500/20",    title: "text-sky-400",    icon: "text-sky-400" },
    violet: { bg: "bg-violet-500/5", border: "border-violet-500/20", title: "text-violet-400", icon: "text-violet-400" },
    teal:   { bg: "bg-teal-500/5",   border: "border-teal-500/20",   title: "text-teal-400",   icon: "text-teal-400" },
    amber:  { bg: "bg-amber-500/5",  border: "border-amber-500/20",  title: "text-amber-400",  icon: "text-amber-400" },
  };
  const col = colors[accentColor] || colors.sky;

  return (
    <div className={`rounded-xl border ${col.border} ${col.bg} overflow-hidden transition-all duration-300`}>
      <div className="flex items-center justify-between px-3 py-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-2">
          {status === "loading" ? (
            <Loader className={`w-3.5 h-3.5 ${col.icon} animate-spin`} />
          ) : status === "done" ? (
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Icon className={`w-3.5 h-3.5 ${col.icon}`} />
          )}
          <span className={`text-[11px] font-semibold uppercase tracking-wider ${col.title}`}>{title}</span>
          {wordCount > 0 && <span className="text-[10px] text-white/30">{wordCount} words</span>}
        </div>
        <div className="flex items-center gap-2">
          {status === "loading" && <span className="text-[10px] text-white/30 animate-pulse">Processing...</span>}
          {expanded ? <EyeOff className="w-3 h-3 text-white/30" /> : <Eye className="w-3 h-3 text-white/30" />}
        </div>
      </div>
      {expanded && (
        <div className="px-3 pb-3">
          <div className="max-h-40 overflow-y-auto bg-black/30 rounded-lg p-3 text-[11px] leading-relaxed text-white/70 font-mono whitespace-pre-wrap">
            {isEmpty ? <span className="text-white/20 italic">Waiting for data...</span> : text}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PIPELINE NODE — single node in the pipeline viz
   ═══════════════════════════════════════════════════════════════════════════ */
function PipelineNode({ icon: Icon, label, sublabel, status, color = "sky", skipped }) {
  const colorMap = {
    sky:    { active: "border-sky-400/50 bg-sky-500/15 text-sky-300",    idle: "border-white/10 bg-white/5 text-white/30" },
    violet: { active: "border-violet-400/50 bg-violet-500/15 text-violet-300", idle: "border-white/10 bg-white/5 text-white/30" },
    teal:   { active: "border-teal-400/50 bg-teal-500/15 text-teal-300",   idle: "border-white/10 bg-white/5 text-white/30" },
    amber:  { active: "border-amber-400/50 bg-amber-500/15 text-amber-300", idle: "border-white/10 bg-white/5 text-white/30" },
  };
  const cm = colorMap[color] || colorMap.sky;
  const isActive = status === "loading" || status === "done";

  return (
    <div className={`flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-2.5 border transition-all duration-500 min-w-[90px] ${
      skipped ? "border-white/5 bg-white/[0.02] text-white/15 opacity-50" :
      isActive ? cm.active : cm.idle
    }`}>
      {status === "loading" ? (
        <Loader className="w-4 h-4 animate-spin" />
      ) : status === "done" ? (
        <Check className="w-4 h-4 text-emerald-400" />
      ) : (
        <Icon className="w-4 h-4" />
      )}
      <span className="text-[10px] font-semibold leading-tight text-center">{label}</span>
      {sublabel && <span className="text-[9px] opacity-60 text-center">{sublabel}</span>}
      {skipped && <span className="text-[8px] italic opacity-40">skipped</span>}
    </div>
  );
}

function PipelineArrow({ active }) {
  return <ChevronRight className={`w-4 h-4 shrink-0 transition-colors duration-500 ${active ? "text-sky-400" : "text-white/10"}`} />;
}

/* ═══════════════════════════════════════════════════════════════════════════
   LIVE PIPELINE VISUALIZATION
   ═══════════════════════════════════════════════════════════════════════════ */
function LivePipeline({ pipelineState }) {
  const { parseStatus, geminiStatus, tavusStatus, extractedText, generatedScript, branchA, branchB, cviStatus, kbStatus } = pipelineState;

  return (
    <div className="bg-white/[0.02] border border-white/8 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold">Live Pipeline</p>
        <div className="flex items-center gap-3">
          {branchA && <span className="text-[9px] font-bold uppercase tracking-widest text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full">Branch A Active</span>}
          {branchB && <span className="text-[9px] font-bold uppercase tracking-widest text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded-full">Branch B Active</span>}
        </div>
      </div>

      {/* Node flow */}
      <div className="flex items-center justify-center gap-1 flex-wrap">
        <PipelineNode icon={FileText} label="PDF Parser" sublabel="extract text" status={parseStatus} color="sky" />
        <PipelineArrow active={parseStatus === "done"} />

        {branchA && (
          <>
            <PipelineNode icon={Sparkles} label="Gemini Flash" sublabel="generate script" status={geminiStatus} color="violet" />
            <PipelineArrow active={geminiStatus === "done"} />
            <PipelineNode icon={Video} label="Tavus Video" sublabel="render avatar" status={tavusStatus} color="sky" />
          </>
        )}
        {branchB && (
          <>
            <PipelineNode icon={Sparkles} label="Gemini Flash" sublabel="LLM" status="idle" color="violet" skipped />
            <PipelineArrow active={false} />
            <PipelineNode icon={Database} label="Tavus KB" sublabel="full context" status={kbStatus || (parseStatus === "done" ? "done" : "idle")} color="teal" />
            <PipelineArrow active={kbStatus === "done" || parseStatus === "done"} />
            <PipelineNode icon={MessageCircle} label="Tavus CVI" sublabel="live Q&A" status={cviStatus} color="teal" />
          </>
        )}
        {!branchA && !branchB && (
          <>
            <PipelineNode icon={Sparkles} label="Gemini Flash" sublabel="generate script" status="idle" color="violet" />
            <PipelineArrow active={false} />
            <PipelineNode icon={Video} label="Tavus Video" sublabel="render avatar" status="idle" color="sky" />
          </>
        )}
      </div>

      {/* Text windows */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <TextWindow
          title="Parsed Document"
          icon={FileText}
          text={extractedText}
          status={parseStatus}
          accentColor="sky"
        />
        {branchA && (
          <TextWindow
            title="Gemini Generated Script"
            icon={Sparkles}
            text={generatedScript}
            status={geminiStatus}
            accentColor="violet"
          />
        )}
        {branchB && (
          <TextWindow
            title="Document → Tavus KB"
            icon={Database}
            text={extractedText ? `Full document injected into Tavus Knowledge Base.\nThe avatar can answer questions about the entire ${extractedText.split(/\s+/).length}-word document.\n\nNo LLM summarisation — Branch B bypasses Gemini entirely.` : ""}
            status={kbStatus || (parseStatus === "done" ? "done" : "idle")}
            accentColor="teal"
          />
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CVI VIDEO AREA (must be inside DailyProvider)
   ═══════════════════════════════════════════════════════════════════════════ */
function CVIVideoArea({ onRemoteParticipantChange }) {
  const remoteIds = useParticipantIds({ filter: "remote" });
  const avatarId = remoteIds[0];
  useEffect(() => { onRemoteParticipantChange(remoteIds.length > 0); }, [remoteIds.length, onRemoteParticipantChange]);
  return (
    <div className="w-full h-full relative">
      <DailyAudio />
      {avatarId ? (
        <DailyVideo sessionId={avatarId} type="video" autoPlay mirror={false} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <div className="flex flex-col items-center justify-center h-full gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
          <p className="text-white/50 text-xs">Connecting to avatar stream…</p>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   INLINE CVI PANEL — renders inside the split-screen, no page navigation
   ═══════════════════════════════════════════════════════════════════════════ */
function InlineCVIPanel({ sessionData, onClose, onStateChange }) {
  const [callObj, setCallObj] = useState(null);
  const [callState, setCallState] = useState("init");
  const [micMuted, setMicMuted] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [avatarJoined, setAvatarJoined] = useState(false);
  const callRef = useRef(null);
  const initRunRef = useRef(0);
  const isMock = sessionData?.is_mock;
  const roomUrl = sessionData?.conversation_url;

  useEffect(() => { onStateChange?.(callState); }, [callState]);

  useEffect(() => {
    if (isMock || !roomUrl) return;
    let active = true;
    const runId = ++initRunRef.current;
    const ok = () => active && runId === initRunRef.current;
    const hJ = () => { if (ok()) setCallState("joined"); };
    const hL = () => { if (ok()) setCallState("left"); };
    const hE = (e) => { if (ok()) { setErrorMsg(e?.errorMsg || "Connection failed"); setCallState("error"); } };

    (async () => {
      try {
        setErrorMsg(""); setAvatarJoined(false); setCallObj(null); setCallState("joining");
        await destroyExistingDailyInstance();
        if (!ok()) return;
        const co = DailyIframe.createCallObject({ subscribeToTracksAutomatically: true });
        callRef.current = co;
        co.on("joined-meeting", hJ); co.on("left-meeting", hL); co.on("error", hE);
        if (!ok()) { co.off("joined-meeting", hJ); co.off("left-meeting", hL); co.off("error", hE); await queueDailyCleanup(co); return; }
        setCallObj(co);
        await co.join({ url: roomUrl, startVideoOff: true, startAudioOff: false });
      } catch (err) { if (ok()) { setErrorMsg(err?.message || "Failed"); setCallState("error"); } }
    })();

    return () => {
      active = false; initRunRef.current++;
      const co = callRef.current; callRef.current = null;
      if (co) { co.off("joined-meeting", hJ); co.off("left-meeting", hL); co.off("error", hE); queueDailyCleanup(co); }
    };
  }, [roomUrl, isMock]);

  useEffect(() => {
    if (callState !== "joined" || avatarJoined) return;
    const t = setTimeout(() => { setErrorMsg("Avatar did not join. Try again."); setCallState("error"); }, 45000);
    return () => clearTimeout(t);
  }, [callState, avatarJoined]);

  useEffect(() => { if (callObj && callState === "joined") callObj.setLocalAudio(!micMuted); }, [micMuted, callState, callObj]);

  const handleEnd = async () => {
    const co = callRef.current || callObj; callRef.current = null;
    if (co) { setCallObj(null); setCallState("left"); await queueDailyCleanup(co); }
    if (sessionData?.conversation_id && !isMock) {
      try { await fetch(`/api/explainer/end-cvi/${sessionData.conversation_id}`, { method: "POST" }); } catch {}
    }
    onClose();
  };

  // Mock / Preview
  if (isMock) {
    return (
      <div className="relative w-full h-full">
        <img src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=800&q=80" alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
          <div className="bg-[#0f2333]/95 border border-white/15 rounded-2xl p-5 text-center max-w-[200px]">
            <Database className="w-8 h-8 text-teal-400 mx-auto mb-2" />
            <h3 className="text-xs font-semibold text-white mb-1">Preview Mode</h3>
            <p className="text-[10px] text-white/50">Live CVI requires API keys</p>
          </div>
        </div>
        <button onClick={handleEnd} className="absolute top-2 right-2 bg-red-500/80 text-white text-[10px] px-2 py-1 rounded-md hover:bg-red-500">End</button>
      </div>
    );
  }

  // Error
  if (callState === "error") {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <X className="w-8 h-8 text-red-400 mb-2" />
        <p className="text-xs text-red-400 font-semibold">Connection Failed</p>
        <p className="text-[10px] text-white/40 mt-1">{errorMsg}</p>
        <button onClick={handleEnd} className="mt-3 text-[10px] text-red-400 border border-red-500/30 px-3 py-1 rounded-md hover:bg-red-500/10">Close</button>
      </div>
    );
  }

  // Connecting
  if (!callObj || callState === "init" || callState === "joining") {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-teal-500/30 border-t-teal-400 animate-spin" />
        <p className="text-xs text-white/50">Connecting to CVI…</p>
      </div>
    );
  }

  // Live
  return (
    <DailyProvider callObject={callObj}>
      <div className="relative w-full h-full">
        <CVIVideoArea onRemoteParticipantChange={setAvatarJoined} />
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/60 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/10">
          <button onClick={() => setMicMuted(!micMuted)}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${micMuted ? "bg-red-500/30 text-red-400" : "bg-teal-500 text-white"}`}>
            {micMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <button onClick={handleEnd} className="text-[10px] text-red-400 border border-red-500/30 px-2.5 py-1 rounded-md hover:bg-red-500/10">End</button>
        </div>
      </div>
    </DailyProvider>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   INLINE VIDEO PANEL — renders the video inside split-screen
   ═══════════════════════════════════════════════════════════════════════════ */
function InlineVideoPanel({ videoData, onBack }) {
  const isMock = videoData.is_mock;
  const [status, setStatus]           = useState(videoData.status || "generating");
  const [downloadUrl, setDownloadUrl] = useState(videoData.download_url || null);
  const [hostedUrl, setHostedUrl]     = useState(videoData.hosted_url || videoData.video_url || null);
  const [progress, setProgress]       = useState(videoData.progress ?? null);
  const [dots, setDots]               = useState(".");
  const pollRef = useRef(null);

  useEffect(() => {
    if (status !== "ready" && status !== "failed") {
      const t = setInterval(() => setDots(d => d.length >= 3 ? "." : d + "."), 600);
      return () => clearInterval(t);
    }
  }, [status]);

  useEffect(() => {
    if (status === "ready" || status === "failed" || isMock) return;
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`/api/explainer/video-status/${videoData.video_id}`);
        const d = await r.json();
        if (d.progress != null) setProgress(d.progress);
        if (d.status) setStatus(d.status);
        if (d.status === "ready") { setDownloadUrl(d.download_url || null); setHostedUrl(d.hosted_url || d.video_url || null); clearInterval(pollRef.current); }
        else if (d.status === "failed") clearInterval(pollRef.current);
      } catch {}
    }, 5000);
    return () => clearInterval(pollRef.current);
  }, [videoData.video_id, status, isMock]);

  const pct = (() => {
    if (progress == null) return 5;
    if (typeof progress === "number") return Math.max(5, Math.min(100, progress));
    if (typeof progress === "string") { const [n] = progress.split("/"); return Math.max(5, Math.min(100, parseInt(n, 10) || 5)); }
    return 5;
  })();

  const playableUrl = downloadUrl || hostedUrl;
  const isMp4 = playableUrl && (playableUrl.endsWith(".mp4") || playableUrl.includes(".mp4"));

  if (status !== "ready") {
    return (
      <div className="flex flex-col items-center justify-center h-full text-white p-6">
        <div className="relative w-14 h-14 mb-4">
          <div className="absolute inset-0 rounded-full border border-sky-400/20 animate-ping" />
          <div className="absolute inset-2 rounded-full bg-sky-400/10 flex items-center justify-center">
            <Loader className="w-5 h-5 text-sky-300 animate-spin" />
          </div>
        </div>
        <h3 className="text-xs font-semibold capitalize">{status === "queued" ? `In queue${dots}` : status === "failed" ? "Failed" : `${status}${dots}`}</h3>
        <p className="text-[10px] text-white/30 mt-1">Rendering avatar video (1–4 min)</p>
        <div className="w-48 mt-4">
          <div className="flex justify-between text-[9px] text-white/25 mb-1"><span className="capitalize">{status}</span><span>{pct}%</span></div>
          <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-violet-500 to-sky-400 rounded-full transition-all duration-1000" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <button onClick={onBack} className="mt-4 text-[10px] text-white/30 hover:text-white border border-white/10 px-3 py-1 rounded-md">Cancel</button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {playableUrl ? (
        isMp4 ? <video src={playableUrl} controls autoPlay playsInline className="w-full h-full object-contain bg-black" />
               : <iframe src={playableUrl} className="w-full h-full border-0" allow="autoplay; fullscreen" title="Avatar Video" />
      ) : (
        <div className="flex items-center justify-center h-full text-white/20 text-xs">No playback URL.</div>
      )}
      {isMock && <div className="absolute top-2 right-2 bg-amber-500/90 text-black text-[9px] font-bold px-2 py-0.5 rounded-md uppercase">Demo</div>}
      <button onClick={onBack} className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white/60 hover:text-white text-[10px] px-2.5 py-1 rounded-md border border-white/10">← Back</button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN APP — Single-page split-screen layout
   ═══════════════════════════════════════════════════════════════════════════ */
export default function NeuroCardioExplainer() {
  const [audience, setAudience]           = useState("patient");
  const [selectedPreset, setSelectedPreset] = useState("pots_dysautonomia");
  const [reportText, setReportText]       = useState(PRESETS.pots_dysautonomia.text);
  const [uploadedFile, setUploadedFile]   = useState("");
  const [showTerm, setShowTerm]           = useState(false);

  // Branch A state
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [videoData, setVideoData]             = useState(null);

  // Branch B state
  const [startingCVI, setStartingCVI] = useState(false);
  const [cviData, setCviData]         = useState(null);

  // Document upload state
  const [docUploadStatus, setDocUploadStatus] = useState("idle");
  const [docId, setDocId]                     = useState(null);
  const [docProgress, setDocProgress]         = useState(null);
  const [docError, setDocError]               = useState("");
  const docPollRef = useRef(null);

  // Pipeline visualization state
  const [pipeline, setPipeline] = useState({
    parseStatus: "idle", geminiStatus: "idle", tavusStatus: "idle",
    extractedText: "", generatedScript: "",
    branchA: false, branchB: false,
    cviStatus: "idle", kbStatus: "idle",
  });

  const hasDocument = reportText.trim().length > 0;

  const handlePreset = (key) => {
    setSelectedPreset(key); setReportText(PRESETS[key].text); setUploadedFile("");
    setDocUploadStatus("idle"); setDocId(null); setDocProgress(null); setDocError("");
    if (docPollRef.current) { clearInterval(docPollRef.current); docPollRef.current = null; }
    setPipeline(p => ({ ...p, parseStatus: "done", extractedText: PRESETS[key].text, geminiStatus: "idle", tavusStatus: "idle", generatedScript: "", branchA: false, branchB: false, cviStatus: "idle", kbStatus: "idle" }));
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFile(file.name); setSelectedPreset(""); setDocError(""); setDocId(null); setDocProgress(null);
    if (docPollRef.current) { clearInterval(docPollRef.current); docPollRef.current = null; }
    setPipeline(p => ({ ...p, parseStatus: "loading", extractedText: "", geminiStatus: "idle", tavusStatus: "idle", generatedScript: "", branchA: false, branchB: false }));

    const isPdf = file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const txt = ev.target.result || "";
        setReportText(txt);
        setPipeline(p => ({ ...p, parseStatus: "done", extractedText: txt }));
      };
      reader.readAsText(file);
    } else {
      setReportText("Extracting PDF text…");
    }

    setDocUploadStatus("uploading");
    try {
      const fd = new FormData(); fd.append("report_file", file);
      const r = await fetch("/api/explainer/upload-document", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) { setDocUploadStatus("error"); setDocError(d.error || "Upload failed"); setPipeline(p => ({ ...p, parseStatus: "idle" })); return; }
      setDocId(d.document_id);
      if (d.extracted_text) {
        setReportText(d.extracted_text);
        setPipeline(p => ({ ...p, parseStatus: "done", extractedText: d.extracted_text }));
      }
      if (d.status === "ready" || d.is_mock) { setDocUploadStatus("ready"); setDocProgress(100); return; }
      setDocUploadStatus("processing"); setDocProgress(d.progress || 0);
      docPollRef.current = setInterval(async () => {
        try {
          const sr = await fetch(`/api/explainer/document-status/${d.document_id}`);
          const sd = await sr.json();
          if (sd.progress != null) setDocProgress(sd.progress);
          if (sd.status === "ready") { setDocUploadStatus("ready"); setDocProgress(100); clearInterval(docPollRef.current); docPollRef.current = null; }
          else if (sd.status === "error") { setDocUploadStatus("error"); setDocError(sd.error_message || "Processing failed"); clearInterval(docPollRef.current); docPollRef.current = null; }
        } catch {}
      }, 3000);
    } catch (err) { setDocUploadStatus("error"); setDocError("Upload failed: " + err.message); setPipeline(p => ({ ...p, parseStatus: "idle" })); }
  };

  useEffect(() => { return () => { if (docPollRef.current) clearInterval(docPollRef.current); }; }, []);

  const buildFormData = () => {
    const fd = new FormData();
    fd.append("target_audience", audience);
    if (selectedPreset) fd.append("sample_key", selectedPreset);
    else {
      fd.append("report_text", reportText);
      const fi = document.querySelector('input[type="file"]');
      if (fi?.files[0]) fd.append("report_file", fi.files[0]);
    }
    if (docId) fd.append("document_ids", JSON.stringify([docId]));
    return fd;
  };

  // Branch A — Generate Video
  const handleGenerateVideo = async () => {
    if (!hasDocument) return;
    setGeneratingVideo(true);
    setPipeline(p => ({ ...p, branchA: true, branchB: false, parseStatus: "done", extractedText: reportText, geminiStatus: "loading", tavusStatus: "idle", generatedScript: "" }));
    try {
      const r = await fetch("/api/explainer/generate-video", { method: "POST", body: buildFormData() });
      const d = await r.json();
      if (!r.ok) { alert(d.error || "Error"); setPipeline(p => ({ ...p, geminiStatus: "idle" })); return; }
      setPipeline(p => ({
        ...p,
        geminiStatus: "done",
        generatedScript: d.generated_script || "",
        extractedText: d.extracted_text || p.extractedText,
        tavusStatus: d.status === "ready" ? "done" : "loading",
      }));
      setVideoData(d);
    } catch (err) { alert("Backend error: " + err.message); setPipeline(p => ({ ...p, geminiStatus: "idle" })); }
    finally { setGeneratingVideo(false); }
  };

  // Branch B — Start CVI
  const handleStartCVI = async () => {
    if (!hasDocument) return;
    setStartingCVI(true);
    setPipeline(p => ({ ...p, branchA: false, branchB: true, parseStatus: "done", extractedText: reportText, geminiStatus: "idle", tavusStatus: "idle", generatedScript: "", kbStatus: "loading", cviStatus: "idle" }));
    try {
      const r = await fetch("/api/explainer/start-cvi", { method: "POST", body: buildFormData() });
      const d = await r.json();
      if (!r.ok) { alert(d.error || "Error"); setPipeline(p => ({ ...p, kbStatus: "idle", branchB: false })); return; }
      setPipeline(p => ({ ...p, kbStatus: "done", cviStatus: "loading" }));
      setCviData(d);
    } catch (err) { alert("Backend error: " + err.message); setPipeline(p => ({ ...p, kbStatus: "idle", branchB: false })); }
    finally { setStartingCVI(false); }
  };

  const docBusy = docUploadStatus === "uploading" || docUploadStatus === "processing";
  const anyLoading = generatingVideo || startingCVI || docBusy;

  return (
    <div className={`min-h-screen bg-[#070f16] text-white ${showTerm ? "pb-44" : ""}`}
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-white/8 bg-[#070f16]/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-500/30 flex items-center justify-center">
            <Brain className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <span className="text-base font-bold tracking-tight">22Neuro</span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-white/25 bg-white/5 border border-white/8 px-2.5 py-1 rounded-full">
          <Zap className="w-3 h-3 text-violet-400" /> Dual-Path AI Avatar Pipeline
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-white/5 p-0.5 rounded-lg inline-flex gap-0.5 border border-white/8">
            {[["patient", "Patient"], ["doctor", "Doctor"]].map(([val, label]) => (
              <button key={val} onClick={() => setAudience(val)}
                className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${audience === val ? "bg-sky-500 text-white shadow-lg shadow-sky-500/20" : "text-white/35 hover:text-white"}`}>
                {label}
              </button>
            ))}
          </div>
          <button onClick={() => setShowTerm(s => !s)}
            className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white border border-white/10 bg-white/5 px-2.5 py-1.5 rounded-md transition-colors">
            <Terminal className="w-3 h-3" /> Logs
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-5 space-y-5">

        {/* ─── Upload Area ───────────────────────────────────────────────── */}
        <div className="bg-white/[0.02] rounded-2xl border border-white/8 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-sky-500/20 border border-sky-500/30 flex items-center justify-center">
                <span className="text-[9px] font-bold text-sky-400">1</span>
              </div>
              <h2 className="text-[11px] font-semibold text-white uppercase tracking-widest">Upload Report</h2>
            </div>
            <label className={`flex items-center gap-1.5 cursor-pointer text-[11px] font-medium transition-all border px-3 py-1.5 rounded-lg ${
              docUploadStatus === "ready" ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" :
              docUploadStatus === "error" ? "text-red-400 border-red-500/30 bg-red-500/10" :
              docBusy ? "text-amber-400 border-amber-500/30 bg-amber-500/10 pointer-events-none" :
              "text-sky-400 hover:text-white border-white/10 bg-white/5 hover:border-sky-500/40"
            }`}>
              {docBusy ? <Loader className="w-3 h-3 animate-spin" /> :
               docUploadStatus === "ready" ? <Check className="w-3 h-3" /> :
               docUploadStatus === "error" ? <AlertCircle className="w-3 h-3" /> :
               <Upload className="w-3 h-3" />}
              {docUploadStatus === "uploading" ? "Uploading…" :
               docUploadStatus === "processing" ? `Processing${docProgress != null ? ` ${docProgress}%` : "…"}` :
               docUploadStatus === "ready" ? uploadedFile :
               docUploadStatus === "error" ? "Failed" :
               uploadedFile || "Upload PDF"}
              <input type="file" accept=".pdf,.txt,.md,.docx,.doc,.csv,.xlsx" onChange={handleUpload} className="hidden" disabled={docBusy} />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {Object.entries(PRESETS).map(([key, preset]) => (
              <button key={key} onClick={() => handlePreset(key)}
                className={`relative p-2.5 text-left rounded-xl border transition-all text-[11px] ${
                  selectedPreset === key ? "bg-sky-500/15 border-sky-400/40 text-white" : "bg-white/[0.02] border-white/8 text-white/40 hover:border-white/20"
                }`}>
                {selectedPreset === key && <Check className="absolute top-2 right-2 w-3 h-3 text-sky-400" />}
                <p className="font-medium pr-5">{preset.label}</p>
              </button>
            ))}
          </div>

          <textarea value={reportText} onChange={e => { setReportText(e.target.value); setSelectedPreset(""); setPipeline(p => ({ ...p, parseStatus: "done", extractedText: e.target.value })); }}
            rows={3} placeholder="Or paste report text…"
            className="w-full bg-black/30 border border-white/8 rounded-xl p-3 text-[11px] leading-relaxed focus:outline-none focus:border-sky-500/40 text-white placeholder-white/15 resize-y" />
        </div>

        {/* ─── Split-Screen: Branch A | Branch B ─────────────────────────── */}
        <div className="bg-white/[0.02] rounded-2xl border border-white/8 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded-full bg-sky-500/20 border border-sky-500/30 flex items-center justify-center">
              <span className="text-[9px] font-bold text-sky-400">2</span>
            </div>
            <h2 className="text-[11px] font-semibold text-white uppercase tracking-widest">Output — Split View</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* ─── Branch A Panel ─────────────────────────────────────────── */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-widest text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full">Branch A — Non-Interactive</span>
                <div className="flex items-center gap-1 text-[8px] text-white/20">
                  <FileText className="w-2.5 h-2.5" /><ChevronRight className="w-2.5 h-2.5" />
                  <Sparkles className="w-2.5 h-2.5 text-violet-400" /><ChevronRight className="w-2.5 h-2.5" />
                  <Video className="w-2.5 h-2.5 text-sky-400" />
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden" style={{ minHeight: "280px" }}>
                {videoData ? (
                  <InlineVideoPanel videoData={videoData} onBack={() => { setVideoData(null); setPipeline(p => ({ ...p, tavusStatus: "idle", branchA: false })); }} />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full min-h-[280px] p-6 text-center">
                    <div className="w-12 h-12 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center mb-3">
                      <Play className="w-5 h-5 text-violet-300 ml-0.5" />
                    </div>
                    <p className="text-[11px] text-white/40 mb-1">PDF → <span className="text-violet-300">Gemini</span> generates script → <span className="text-sky-300">Tavus</span> renders video</p>
                    <p className="text-[10px] text-white/20 mb-4">Avatar reads a 250–300 word summary</p>
                    <button onClick={handleGenerateVideo} disabled={anyLoading || !hasDocument}
                      className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-300 bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 px-4 py-2 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                      {generatingVideo ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                      {generatingVideo ? "Generating…" : "Generate Video"}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ─── Branch B Panel ─────────────────────────────────────────── */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-widest text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded-full">Branch B — Interactive CVI</span>
                <div className="flex items-center gap-1 text-[8px] text-white/20">
                  <FileText className="w-2.5 h-2.5" /><ChevronRight className="w-2.5 h-2.5" />
                  <Database className="w-2.5 h-2.5 text-teal-400" /><ChevronRight className="w-2.5 h-2.5" />
                  <MessageCircle className="w-2.5 h-2.5 text-sky-400" />
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden" style={{ minHeight: "280px" }}>
                {cviData ? (
                  <InlineCVIPanel sessionData={cviData} onClose={() => { setCviData(null); setPipeline(p => ({ ...p, cviStatus: "idle", kbStatus: "idle", branchB: false })); }}
                    onStateChange={(s) => setPipeline(p => ({ ...p, cviStatus: s === "joined" ? "done" : s === "error" ? "idle" : "loading" }))} />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full min-h-[280px] p-6 text-center">
                    <div className="w-12 h-12 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center mb-3">
                      <MessageCircle className="w-5 h-5 text-teal-300" />
                    </div>
                    <p className="text-[11px] text-white/40 mb-1">PDF → directly to <span className="text-teal-300">Tavus KB</span> → live <span className="text-sky-300">CVI</span></p>
                    <p className="text-[10px] text-white/20 mb-4">Bypasses Gemini — avatar has full document context</p>
                    <button onClick={handleStartCVI} disabled={anyLoading || !hasDocument}
                      className="flex items-center gap-1.5 text-[11px] font-semibold text-teal-300 bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 px-4 py-2 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                      {startingCVI ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />}
                      {startingCVI ? "Connecting…" : "Start Live Chat"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ─── Live Pipeline Visualization ────────────────────────────────── */}
        <LivePipeline pipelineState={pipeline} />

      </div>

      {showTerm && <LogTerminal onClose={() => setShowTerm(false)} />}
    </div>
  );
}
