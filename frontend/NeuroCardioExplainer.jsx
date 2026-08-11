import React, { useState, useEffect, useRef } from "react";
import DailyIframe from "@daily-co/daily-js";
import { DailyProvider, DailyVideo, DailyAudio, useParticipantIds } from "@daily-co/daily-react";
import {
  Upload,
  Play,
  MessageCircle,
  ArrowRight,
  ArrowLeft,
  Check,
  Loader,
  User,
  Terminal,
  X,
  ChevronDown,
  Mic,
  MicOff,
  Brain,
  Clock,
  MoreVertical,
  Activity,
  FileText,
  AlertCircle
} from "lucide-react";

const PRESETS = {
  pots_dysautonomia: {
    label: "POTS — Autonomic Tachycardia",
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
    label: "Vasovagal Syncope",
    text: `EXAMINATION: Autonomic Reflex Screen & Continuous ECG Syncope Evaluation

CLINICAL INDICATION: 3 episodes of sudden loss of consciousness preceded by diaphoresis and nausea.

FINDINGS:
1. HEAD-UP TILT TEST: Minute 18 tilt showed precipitous HR drop to 34 bpm with BP drop to 70/40 mmHg.
2. BAROREFLEX SENSITIVITY: Sequence BRS = 4.2 ms/mmHg (Depressed baroreflex buffering).
3. HOLTER: Normal sinus rhythm at rest; no structural heart disease.

IMPRESSION: Neurocardiogenic (Vasovagal) Syncope - Mixed Cardioinhibitory & Vasodepressor response.`,
  },
};

// ─── Live Log Terminal ─────────────────────────────────────────────────────────
let dailyCleanupChain = Promise.resolve();

async function destroyDailyInstance(callObject) {
  if (!callObject || callObject.isDestroyed?.()) return;
  try { await callObject.leave(); } catch {}
  try { await callObject.destroy(); } catch (err) { console.warn("[CVI] Daily cleanup warning:", err); }
}

function queueDailyCleanup(callObject) {
  dailyCleanupChain = dailyCleanupChain.then(() => destroyDailyInstance(callObject));
  return dailyCleanupChain;
}

async function destroyExistingDailyInstance() {
  await dailyCleanupChain;
  try {
    const existing = DailyIframe.getCallInstance?.();
    if (existing && !existing.isDestroyed?.()) {
      await destroyDailyInstance(existing);
    }
  } catch (err) {
    console.warn("[CVI] Existing Daily cleanup warning:", err);
  }
}

function LogTerminal({ onClose }) {
  const [logs, setLogs]   = useState([]);
  const [open, setOpen]   = useState(true);
  const bottomRef         = useRef(null);
  const esRef             = useRef(null);

  useEffect(() => {
    esRef.current = new EventSource("/api/logs");
    esRef.current.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        setLogs((prev) => [...prev.slice(-299), data]);
      } catch {}
    };
    esRef.current.onerror = () => {
      setLogs((prev) => [
        ...prev,
        { level: "error", msg: "[STREAM] Disconnected from log stream.", ts: new Date().toISOString() },
      ]);
    };
    return () => esRef.current?.close();
  }, []);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, open]);

  const colorFor = (l) =>
    l === "error" ? "text-red-400" : l === "warn" ? "text-amber-400" : "text-emerald-300";

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a151d] border-t border-white/10 shadow-2xl font-mono">
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer select-none border-b border-white/5"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs font-medium text-white/70">Backend Terminal</span>
          <span className="text-[11px] text-white/30">localhost:3001</span>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={(e) => { e.stopPropagation(); setLogs([]); }} className="text-white/40 hover:text-white text-xs">clear</button>
          <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="text-white/40 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
          <ChevronDown className={`w-3.5 h-3.5 text-white/40 transition-transform duration-200 ${open ? "" : "rotate-180"}`} />
        </div>
      </div>
      {open && (
        <div className="h-44 overflow-y-auto px-3 py-2 text-[11px] space-y-0.5 bg-[#081118]">
          {logs.length === 0 && <p className="text-white/30">Waiting for server events...</p>}
          {logs.map((log, i) => (
            <div key={i} className="flex gap-2 leading-relaxed">
              <span className="text-white/30 shrink-0 tabular-nums">{new Date(log.ts).toLocaleTimeString("en-US", { hour12: false })}</span>
              <span className={`break-all ${colorFor(log.level)}`}>{log.msg}</span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}

// ─── Minimalist Square Dashboard Shell ──────────────────────────────────────────
function DashboardShell({ children, showTerm, setShowTerm, onEnd, callState, micMuted, setMicMuted, micLabel, isMock }) {
  return (
    <div className={`min-h-screen bg-[#0b1a23] text-white flex flex-col font-sans ${showTerm ? "pb-48" : ""}`}>
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-2.5 bg-[#0e212d] border-b border-white/10 shadow-sm relative z-20">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-[#4fc3f7]" />
          <span className="text-lg font-bold tracking-tight text-white">22Neuro</span>
        </div>
        
        <div className="flex items-center gap-2 absolute left-1/2 -translate-x-1/2">
           <span className="text-[13px] text-[#7ca0b5]">Consultation Status:</span>
           <span className={`text-[13px] font-semibold ${callState === "joined" ? "text-[#34d399]" : callState === "error" ? "text-red-400" : "text-amber-400"}`}>
             {callState === "joined" ? "Active" : callState === "error" ? "Error" : "Connecting..."}
           </span>
        </div>
        
        <div className="flex items-center gap-6">
          <button onClick={onEnd} className="text-xs text-red-400 hover:text-white hover:bg-red-500/20 border border-red-500/30 px-2.5 py-1 rounded-sm transition-colors">Exit</button>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="flex-1 p-3 flex flex-col items-center justify-center max-h-[calc(100vh-50px)] overflow-hidden">
        <section className="w-full max-w-4xl flex flex-col gap-2.5 h-full min-h-0">
          <div className="flex-1 relative rounded-sm overflow-hidden bg-black border border-white/10 shadow-lg flex items-center justify-center">
            {children}
          </div>

          {/* Functional Mic Control for CVI */}
          {setMicMuted && (
            <div className="bg-[#142b37] rounded-sm p-3 border border-white/10 shadow-sm flex items-center justify-center gap-4">
              <span className="text-xs text-[#7ca0b5] font-semibold uppercase tracking-wider">
                {callState === 'joined' ? "Live Audio Active" : "Microphone"}
              </span>
              <button 
                onClick={() => setMicMuted(!micMuted)}
                title={micLabel}
                className={`w-10 h-10 rounded-sm flex items-center justify-center transition-colors border ${
                  micMuted ? 'bg-red-500/20 border-red-500/40 text-red-400' : 
                  'bg-[#0288d1] border-[#0288d1] hover:bg-[#0277bd] text-white'
                }`}
              >
                {micMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
            </div>
          )}
        </section>
      </main>

      {!showTerm && (
        <button onClick={() => setShowTerm(true)} className="fixed bottom-2 right-2 bg-[#0e212d] text-[#7ca0b5] text-[10px] font-mono px-2.5 py-1 rounded-sm border border-white/10 hover:text-white transition-colors z-50 flex items-center gap-1">
          <Terminal className="w-3 h-3" /> Logs
        </button>
      )}
    </div>
  );
}

// ─── Avatar video player ──────────────────────────────────────────────────────
function AvatarExplainerPlayer({ videoData, onBack }) {
  const isMock = videoData.is_mock;
  const [status,      setStatus]      = useState(videoData.status || "generating");
  const [downloadUrl, setDownloadUrl] = useState(videoData.download_url || null);
  const [hostedUrl,   setHostedUrl]   = useState(videoData.hosted_url || videoData.video_url || null);
  const [progress,    setProgress]    = useState(videoData.progress ?? null);
  const [dots,        setDots]        = useState(".");
  const [showTerm,    setShowTerm]    = useState(!isMock); // Auto-open logs for real renders
  const pollRef = useRef(null);

  // Animated dots for loading text
  useEffect(() => {
    if (status !== "ready" && status !== "failed") {
      const t = setInterval(() => setDots((d) => (d.length >= 3 ? "." : d + ".")), 600);
      return () => clearInterval(t);
    }
  }, [status]);

  // Poll video status for real (non-mock) videos
  useEffect(() => {
    if (status === "ready" || status === "failed" || isMock) return;
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`/api/explainer/video-status/${videoData.video_id}`);
        const d = await r.json();
        if (d.progress != null) setProgress(d.progress);
        if (d.status) setStatus(d.status);
        if (d.status === "ready") {
          setDownloadUrl(d.download_url || null);
          setHostedUrl(d.hosted_url || d.video_url || null);
          clearInterval(pollRef.current);
        } else if (d.status === "failed") {
          clearInterval(pollRef.current);
        }
      } catch {}
    }, 5000);
    return () => clearInterval(pollRef.current);
  }, [videoData.video_id, status, isMock]);

  // Calculate progress percentage — handles both number and "50/100" string formats
  const pct = (() => {
    if (progress == null) return 5;
    if (typeof progress === "number") return Math.max(5, Math.min(100, progress));
    if (typeof progress === "string") {
      const [n] = progress.split("/");
      return Math.max(5, Math.min(100, parseInt(n, 10) || 5));
    }
    return 5;
  })();

  // Determine the best playable video URL
  const playableUrl = downloadUrl || hostedUrl;
  const isMp4 = playableUrl && (playableUrl.endsWith('.mp4') || playableUrl.includes('.mp4'));

  // Render the video/loading content
  const videoContent = (
    <div className="w-full h-full relative">
      {status !== "ready" ? (
         /* ── LOADING / GENERATING STATE ── */
         <div className="flex flex-col items-center justify-center h-full text-white p-8">
           <div className="relative mx-auto w-20 h-20 mb-4">
             <div className="absolute inset-0 rounded-full border border-sky-400/30 animate-ping" />
             <div className="absolute inset-3 rounded-full bg-sky-400/10 flex items-center justify-center">
               <Loader className="w-6 h-6 text-sky-300 animate-spin" />
             </div>
           </div>
           <h2 className="text-base font-medium capitalize">
             {status === "queued" ? `In queue${dots}` : status === "failed" ? "Generation failed" : `${status}${dots}`}
           </h2>
           <p className="text-[#7ca0b5] text-xs mt-1">Dr. Anya is recording your report. Takes 1-4 minutes.</p>
           {/* Progress bar with percentage */}
           <div className="w-64 mt-4">
             <div className="flex justify-between text-[10px] text-[#7ca0b5] mb-1">
               <span className="capitalize">{status}</span>
               <span>{pct}%</span>
             </div>
             <div className="w-full bg-white/10 rounded-sm h-1.5 overflow-hidden">
               <div className="h-full bg-sky-400 rounded-sm transition-all duration-1000 ease-out" style={{ width: `${pct}%` }} />
             </div>
           </div>
         </div>
      ) : (
        /* ── READY STATE — Play the video ── */
        <>
          {playableUrl ? (
            isMp4 ? (
              <video src={playableUrl} controls autoPlay playsInline className="w-full h-full object-contain bg-black" />
            ) : (
              <iframe src={playableUrl} className="w-full h-full border-0" allow="autoplay; fullscreen" title="Dr. Anya" />
            )
          ) : (
            <div className="flex items-center justify-center h-full text-white/30 text-xs">No playback URL available.</div>
          )}
          {/* Mock/Preview badge */}
          {isMock && (
            <div className="absolute top-3 right-3 bg-amber-500/90 text-black text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider">
              Preview — Demo Video
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <>
      <DashboardShell 
        showTerm={showTerm} 
        setShowTerm={setShowTerm} 
        onEnd={onBack}
        callState={status === "ready" ? "joined" : "init"}
      >
        {videoContent}
      </DashboardShell>
      {showTerm && <LogTerminal onClose={() => setShowTerm(false)} />}
    </>
  );
}

// ─── CVI: Inner video area (MUST be inside DailyProvider to use hooks) ───────
function CVIVideoArea({ onRemoteParticipantChange }) {
  const remoteIds = useParticipantIds({ filter: "remote" });
  const avatarId  = remoteIds[0];

  useEffect(() => {
    onRemoteParticipantChange(remoteIds.length > 0);
  }, [remoteIds.length, onRemoteParticipantChange]);

  return (
    <div className="w-full h-full relative">
      <DailyAudio />

      {avatarId ? (
        <DailyVideo
          sessionId={avatarId}
          type="video"
          autoPlay
          mirror={false}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <div className="flex flex-col items-center justify-center h-full gap-3 relative">
          <div className="absolute inset-0 z-0">
             <img src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=800&q=80" alt="Background Placeholder" className="w-full h-full object-cover opacity-25" />
          </div>
          <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin z-10" />
          <p className="text-white/70 text-xs font-medium z-10">Connecting to Dr. Anya's video stream...</p>
        </div>
      )}
    </div>
  );
}

// ─── CVI Room (uses DailyProvider + DailyVideo) ──────────────────────────────
function CVIRoom({ sessionData, onClose }) {
  const [callObj,   setCallObj]   = useState(null);
  const [callState, setCallState] = useState("init");
  const [micMuted,  setMicMuted]  = useState(false);
  const [showTerm,  setShowTerm]  = useState(false);
  const [errorMsg,  setErrorMsg]  = useState("");
  const [avatarJoined, setAvatarJoined] = useState(false);
  const callRef = useRef(null);
  const initRunRef = useRef(0);

  const isMock  = sessionData?.is_mock;
  const roomUrl = sessionData?.conversation_url;

  useEffect(() => {
    if (isMock || !roomUrl) return;
    let active = true;
    const runId = ++initRunRef.current;
    const isActiveRun = () => active && runId === initRunRef.current;

    const handleJoined = () => { if (isActiveRun()) setCallState("joined"); };
    const handleLeft = () => { if (isActiveRun()) setCallState("left"); };
    const handleError = (e) => {
      console.error("[CVI] error:", e?.errorMsg || e);
      if (isActiveRun()) {
        setErrorMsg(e?.errorMsg || "Connection failed");
        setCallState("error");
      }
    };

    async function init() {
      try {
        setErrorMsg("");
        setAvatarJoined(false);
        setCallObj(null);
        setCallState("joining");

        await destroyExistingDailyInstance();
        if (!isActiveRun()) return;

        const co = DailyIframe.createCallObject({ subscribeToTracksAutomatically: true });
        callRef.current = co;

        co.on("joined-meeting", handleJoined);
        co.on("left-meeting", handleLeft);
        co.on("error", handleError);

        if (!isActiveRun()) {
          co.off("joined-meeting", handleJoined);
          co.off("left-meeting", handleLeft);
          co.off("error", handleError);
          if (callRef.current === co) callRef.current = null;
          await queueDailyCleanup(co);
          return;
        }

        setCallObj(co);
        await co.join({ url: roomUrl, startVideoOff: true, startAudioOff: false });
      } catch (err) {
        console.error("[CVI] Failed:", err);
        if (isActiveRun()) {
          setErrorMsg(err?.message || "Connection failed");
          setCallState("error");
        }
      }
    }

    init();

    return () => {
      active = false;
      initRunRef.current += 1;
      const co = callRef.current;
      callRef.current = null;
      if (co) {
        co.off("joined-meeting", handleJoined);
        co.off("left-meeting", handleLeft);
        co.off("error", handleError);
        queueDailyCleanup(co);
      }
    };
  }, [roomUrl, isMock]);

  useEffect(() => {
    if (callState !== "joined" || avatarJoined) return;
    const timeout = setTimeout(() => {
      setErrorMsg("Dr. Anya did not join this room. Please start a new session.");
      setCallState("error");
    }, 45000);
    return () => clearTimeout(timeout);
  }, [callState, avatarJoined]);

  useEffect(() => {
    if (callObj && callState === "joined") callObj.setLocalAudio(!micMuted);
  }, [micMuted, callState, callObj]);

  const handleEnd = async () => {
    const co = callRef.current || callObj;
    callRef.current = null;
    if (co) {
      setCallObj(null);
      setCallState("left");
      await queueDailyCleanup(co);
    }
    if (sessionData?.conversation_id && !isMock) {
      try { await fetch(`/api/explainer/end-cvi/${sessionData.conversation_id}`, { method: "POST" }); } catch {}
    }
    onClose();
  };

  const micLabel = micMuted ? "Microphone muted" : "Microphone active";

  const shellProps = {
    showTerm, setShowTerm, onEnd: handleEnd, callState, micMuted, setMicMuted, micLabel, isMock
  };

  if (isMock) {
    return (
      <>
        <DashboardShell {...shellProps}>
          <img src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=800&q=80" alt="Dr. Anya Mock" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center flex-col">
             <div className="bg-[#142b37]/90 border border-white/15 rounded-sm p-5 text-sky-50 max-w-xs text-center shadow-xl">
               <h3 className="text-base font-semibold mb-1.5">Preview Mode</h3>
               <p className="text-xs opacity-80 mb-3">Viewing sample layout. Live video requires API keys.</p>
               <p className="text-[11px] bg-black/40 p-2 rounded-sm font-mono">Add TAVUS_API_KEY to .env</p>
             </div>
          </div>
        </DashboardShell>
        {showTerm && <LogTerminal onClose={() => setShowTerm(false)} />}
      </>
    );
  }

  if (callState === "error") {
    return (
      <>
        <DashboardShell {...shellProps}>
           <div className="flex flex-col items-center justify-center h-full text-center">
             <div className="w-12 h-12 rounded-sm bg-red-500/20 flex items-center justify-center mb-3 border border-red-500/40"><X className="w-6 h-6 text-red-400" /></div>
             <h3 className="text-base font-semibold text-red-400 mb-1">Connection Failed</h3>
             <p className="text-xs text-white/60">{errorMsg}</p>
           </div>
        </DashboardShell>
        {showTerm && <LogTerminal onClose={() => setShowTerm(false)} />}
      </>
    );
  }

  if (!callObj || callState === "init" || callState === "joining") {
    return (
      <>
        <DashboardShell {...shellProps}>
           <div className="flex flex-col items-center justify-center h-full text-center gap-3">
             <div className="w-10 h-10 rounded-full border-2 border-sky-500/20 border-t-sky-400 animate-spin" />
             <p className="text-xs text-white/70">Connecting to video stream...</p>
           </div>
        </DashboardShell>
        {showTerm && <LogTerminal onClose={() => setShowTerm(false)} />}
      </>
    );
  }

  return (
    <>
      <DailyProvider callObject={callObj}>
        <DashboardShell {...shellProps}>
          <CVIVideoArea onRemoteParticipantChange={setAvatarJoined} />
        </DashboardShell>
      </DailyProvider>
      {showTerm && <LogTerminal onClose={() => setShowTerm(false)} />}
    </>
  );
}

// ─── Main Upload / Selection Screen (Minimalist Square Design) ────────────────
export default function NeuroCardioExplainer() {
  const [audience,       setAudience]       = useState("patient");
  const [selectedPreset, setSelectedPreset] = useState("pots_dysautonomia");
  const [reportText,     setReportText]     = useState(PRESETS.pots_dysautonomia.text);
  const [uploadedFile,   setUploadedFile]   = useState("");
  const [showTerm,       setShowTerm]       = useState(false);

  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [videoData,       setVideoData]       = useState(null);

  const [startingCVI, setStartingCVI] = useState(false);
  const [cviData,     setCviData]     = useState(null);

  // Tavus Knowledge Base document state
  const [docUploadStatus, setDocUploadStatus] = useState("idle"); // "idle" | "uploading" | "processing" | "ready" | "error"
  const [docId,           setDocId]           = useState(null);
  const [docProgress,     setDocProgress]     = useState(null);
  const [docError,        setDocError]        = useState("");
  const docPollRef = useRef(null);

  const handlePreset = (key) => {
    setSelectedPreset(key);
    setReportText(PRESETS[key].text);
    setUploadedFile("");
    // Clear any previous document upload state
    setDocUploadStatus("idle");
    setDocId(null);
    setDocProgress(null);
    setDocError("");
    if (docPollRef.current) { clearInterval(docPollRef.current); docPollRef.current = null; }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFile(file.name);
    setSelectedPreset("");
    setDocError("");
    setDocId(null);
    setDocProgress(null);
    if (docPollRef.current) { clearInterval(docPollRef.current); docPollRef.current = null; }

    const isPdf = file.name.toLowerCase().endsWith(".pdf");

    // For text-based files, also read locally so the textarea shows content
    if (!isPdf) {
      const reader = new FileReader();
      reader.onload = (ev) => setReportText(ev.target.result || "");
      reader.readAsText(file);
    } else {
      setReportText("Extracting PDF text...");
    }

    // Upload to our backend → Tavus Knowledge Base
    setDocUploadStatus("uploading");
    try {
      const fd = new FormData();
      fd.append("report_file", file);
      const r = await fetch("/api/explainer/upload-document", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) {
        setDocUploadStatus("error");
        setDocError(d.error || "Upload failed");
        return;
      }

      setDocId(d.document_id);
      if (d.extracted_text) setReportText(d.extracted_text);

      if (d.status === "ready" || d.is_mock) {
        setDocUploadStatus("ready");
        setDocProgress(100);
        return;
      }

      // Start polling for document processing status
      setDocUploadStatus("processing");
      setDocProgress(d.progress || 0);

      docPollRef.current = setInterval(async () => {
        try {
          const sr = await fetch(`/api/explainer/document-status/${d.document_id}`);
          const sd = await sr.json();
          if (sd.progress != null) setDocProgress(sd.progress);

          if (sd.status === "ready") {
            setDocUploadStatus("ready");
            setDocProgress(100);
            clearInterval(docPollRef.current);
            docPollRef.current = null;
          } else if (sd.status === "error") {
            setDocUploadStatus("error");
            setDocError(sd.error_message || "Document processing failed");
            clearInterval(docPollRef.current);
            docPollRef.current = null;
          }
        } catch {}
      }, 3000);
    } catch (err) {
      setDocUploadStatus("error");
      setDocError("Upload failed: " + err.message);
    }
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => { if (docPollRef.current) clearInterval(docPollRef.current); };
  }, []);

  const buildFormData = () => {
    const fd = new FormData();
    fd.append("target_audience", audience);
    if (selectedPreset) {
      fd.append("sample_key", selectedPreset);
    } else {
      fd.append("report_text", reportText);
      const fi = document.querySelector('input[type="file"]');
      if (fi?.files[0]) fd.append("report_file", fi.files[0]);
    }
    // Attach Tavus document_ids for CVI Knowledge Base RAG
    if (docId) fd.append("document_ids", JSON.stringify([docId]));
    return fd;
  };

  const handleGenerateVideo = async () => {
    if (!reportText.trim()) return;
    setGeneratingVideo(true);
    try {
      const r = await fetch("/api/explainer/generate-video", { method: "POST", body: buildFormData() });
      const d = await r.json();
      if (!r.ok) { alert(d.error || "Error"); return; }
      setVideoData(d);
    } catch (err) { alert("Backend error: " + err.message); }
    finally { setGeneratingVideo(false); }
  };

  const handleStartCVI = async () => {
    if (!reportText.trim()) return;
    setStartingCVI(true);
    try {
      const r = await fetch("/api/explainer/start-cvi", { method: "POST", body: buildFormData() });
      const d = await r.json();
      if (!r.ok) { alert(d.error || "Error"); return; }
      setCviData(d);
    } catch (err) { alert("Backend error: " + err.message); }
    finally { setStartingCVI(false); }
  };

  if (videoData) return <AvatarExplainerPlayer videoData={videoData} onBack={() => setVideoData(null)} />;
  if (cviData)   return <CVIRoom sessionData={cviData} onClose={() => setCviData(null)} />;

  return (
    <div className={`min-h-screen bg-[#0b1a23] text-white font-sans ${showTerm ? "pb-48" : ""}`}>
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0e212d]">
        <div className="flex items-center gap-2">
          <Brain className="w-6 h-6 text-[#4fc3f7]" />
          <span className="text-xl font-bold tracking-tight text-white">22Neuro</span>
        </div>
      </header>
      
      <div className="max-w-2xl mx-auto px-5 py-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-white">AI Cardiology Explainer</h1>
          <p className="text-[#7ca0b5] text-sm">Upload an ECG report to consult with our AI specialist.</p>
        </div>

        <div className="flex justify-center">
          <div className="bg-[#142b37] p-1 rounded-sm inline-flex gap-1 border border-white/10">
            {[["patient", "For Patients"], ["doctor", "For Doctors"]].map(([val, label]) => (
              <button key={val} onClick={() => setAudience(val)}
                className={`px-6 py-2 rounded-sm text-xs font-semibold transition-all ${audience === val ? "bg-[#0288d1] text-white" : "text-[#7ca0b5] hover:text-white"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-[#0b1a23] rounded-sm border border-white/10 shadow-sm p-6 space-y-4">
          <h2 className="text-[13px] font-semibold text-white uppercase tracking-widest flex items-center gap-2 pb-2">
             <Upload className="w-4 h-4 text-[#4fc3f7]" />
             Select or upload a report
          </h2>
          
          <div className="flex flex-col gap-0 border border-white/10 rounded-sm overflow-hidden bg-[#0a151d]">
            {/* Tabs Row */}
            <div className="grid grid-cols-2 bg-[#0e212d]">
              {Object.entries(PRESETS).map(([key, preset]) => (
                <button key={key} onClick={() => handlePreset(key)}
                  className={`relative p-3.5 text-left transition-all border-b border-r border-white/5 last:border-r-0 ${selectedPreset === key ? "border-b-0 border-[#0288d1] bg-[#0a151d] text-white" : "hover:bg-white/5 text-[#86a8bc]"}`}>
                  {selectedPreset === key && <Check className="absolute top-3.5 right-3 w-4 h-4 text-[#4fc3f7]" />}
                  <p className="text-[13px] font-medium leading-snug pr-5">{preset.label}</p>
                </button>
              ))}
            </div>
            
            {/* Textarea inside the container block */}
            <textarea value={reportText} onChange={(e) => { setReportText(e.target.value); setSelectedPreset(""); }} rows={6} placeholder="Or paste your neurocardiology report text here..."
              className="w-full bg-[#0a151d] p-4 text-[13px] leading-relaxed focus:outline-none focus:ring-0 border-none text-white placeholder-[#5a7d90] resize-y transition-colors" />
          </div>

          {/* Upload button below textarea */}
          <div className="flex items-center gap-3 pt-2">
            <label className={`flex items-center gap-2 cursor-pointer text-xs font-medium transition-colors border bg-[#142b37] px-4 py-2 rounded-sm w-fit ${
              docUploadStatus === "ready" ? "text-emerald-400 border-emerald-500/30 hover:border-emerald-500/50" :
              docUploadStatus === "error" ? "text-red-400 border-red-500/30" :
              docUploadStatus === "uploading" || docUploadStatus === "processing" ? "text-amber-400 border-amber-500/30 pointer-events-none" :
              "text-[#4fc3f7] hover:text-white border-white/10 hover:border-white/30"
            }`}>
              {docUploadStatus === "uploading" || docUploadStatus === "processing" ? (
                <Loader className="w-3.5 h-3.5 animate-spin" />
              ) : docUploadStatus === "ready" ? (
                <Check className="w-3.5 h-3.5" />
              ) : docUploadStatus === "error" ? (
                <AlertCircle className="w-3.5 h-3.5" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              <span>
                {docUploadStatus === "uploading" ? "Uploading..." :
                 docUploadStatus === "processing" ? `Processing${docProgress != null ? ` (${docProgress}%)` : "..."}` :
                 docUploadStatus === "ready" ? `Ready: ${uploadedFile}` :
                 docUploadStatus === "error" ? "Upload failed" :
                 uploadedFile ? `Loaded: ${uploadedFile}` : "Upload PDF or TXT"}
              </span>
              <input type="file" accept=".pdf,.txt,.md,.docx,.doc,.csv,.xlsx" onChange={handleUpload} className="hidden" disabled={docUploadStatus === "uploading" || docUploadStatus === "processing"} />
            </label>

            {/* Document status badge */}
            {docUploadStatus === "ready" && docId && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-400/80 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-sm">
                <FileText className="w-3 h-3" />
                Knowledge Base linked
              </span>
            )}
            {docUploadStatus === "processing" && (
              <div className="flex items-center gap-2">
                <div className="w-24 bg-white/10 rounded-none h-1 overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-none transition-all duration-700" style={{ width: `${docProgress || 5}%` }} />
                </div>
                <span className="text-[10px] text-amber-400/80">Tavus ingesting</span>
              </div>
            )}
            {docUploadStatus === "error" && docError && (
              <span className="text-[10px] text-red-400/80">{docError}</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button onClick={handleGenerateVideo} disabled={generatingVideo || startingCVI || !reportText.trim()}
            className="flex flex-col items-start gap-3 bg-[#142b37] border border-white/10 hover:border-[#0288d1] rounded-sm p-5 text-left transition-all disabled:opacity-50 shadow-sm">
            <div className="w-9 h-9 rounded-sm bg-[#0288d1]/20 text-[#4fc3f7] flex items-center justify-center shrink-0 border border-[#0288d1]/30">
              {generatingVideo ? <Loader className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 ml-0.5" />}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Avatar Explainer</h3>
              <p className="text-xs text-[#7ca0b5] mt-1">Full AI recorded video explanation.</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#4fc3f7] mt-auto uppercase tracking-wider">
              {generatingVideo ? "Submitting..." : <><span>Generate video</span> <ArrowRight className="w-3.5 h-3.5" /></>}
            </div>
          </button>

          <button onClick={handleStartCVI} disabled={startingCVI || generatingVideo || !reportText.trim()}
            className="flex flex-col items-start gap-3 bg-[#0288d1] hover:bg-[#0277bd] border border-[#0288d1] rounded-sm p-5 text-left transition-all disabled:opacity-50 shadow-sm">
            <div className="w-9 h-9 rounded-sm bg-white/20 text-white flex items-center justify-center shrink-0 border border-white/30">
              {startingCVI ? <Loader className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Interactive Q&A</h3>
              <p className="text-xs text-sky-100 mt-1">Live voice conversation with Dr. Anya.</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-white mt-auto uppercase tracking-wider">
              {startingCVI ? "Connecting..." : <><span>Start live chat</span> <ArrowRight className="w-3.5 h-3.5" /></>}
            </div>
          </button>
        </div>

        <div className="flex justify-center pt-4">
          <button onClick={() => setShowTerm((s) => !s)}
            className="flex items-center gap-1.5 text-xs font-mono text-[#7ca0b5] hover:text-white border border-white/10 bg-[#142b37] px-4 py-2 rounded-sm transition-colors">
            <Terminal className="w-3.5 h-3.5" />
            {showTerm ? "Hide Backend Terminal" : "Show Backend Terminal"}
          </button>
        </div>
      </div>
      {showTerm && <LogTerminal onClose={() => setShowTerm(false)} />}
    </div>
  );
}
