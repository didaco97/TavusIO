import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import DailyIframe from "@daily-co/daily-js";
import { DailyProvider, DailyVideo, DailyAudio, useParticipantIds, useLocalSessionId } from "@daily-co/daily-react";
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

// ─── Live Log Terminal (subscribes to /api/logs SSE) ─────────────────────────
let dailyCleanupChain = Promise.resolve();

async function destroyDailyInstance(callObject) {
  if (!callObject || callObject.isDestroyed?.()) return;

  try {
    await callObject.leave();
  } catch {}

  try {
    await callObject.destroy();
  } catch (err) {
    console.warn("[CVI] Daily cleanup warning:", err);
  }
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
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0d1117] border-t border-white/10 shadow-2xl font-mono">
      <div
        className="flex items-center justify-between px-4 py-2.5 cursor-pointer select-none border-b border-white/5"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-3">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold text-white/60">Backend Terminal</span>
          <span className="text-xs text-white/20">localhost:3001</span>
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={(e) => { e.stopPropagation(); setLogs([]); }} className="text-white/25 hover:text-white/60 text-xs transition-colors">clear</button>
          <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="text-white/25 hover:text-red-400 transition-colors"><X className="w-4 h-4" /></button>
          <ChevronDown className={`w-4 h-4 text-white/25 transition-transform duration-200 ${open ? "" : "rotate-180"}`} />
        </div>
      </div>
      {open && (
        <div className="h-48 overflow-y-auto px-4 py-3 text-xs space-y-0.5 bg-[#0d1117]">
          {logs.length === 0 && <p className="text-white/20">Waiting for server events...</p>}
          {logs.map((log, i) => (
            <div key={i} className="flex gap-3 leading-relaxed">
              <span className="text-white/20 shrink-0 tabular-nums">{new Date(log.ts).toLocaleTimeString("en-US", { hour12: false })}</span>
              <span className={`break-all ${colorFor(log.level)}`}>{log.msg}</span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
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
  const [progress,    setProgress]    = useState(videoData.progress || null);
  const [dots,        setDots]        = useState(".");
  const [showTerm,    setShowTerm]    = useState(true);
  const pollRef = useRef(null);

  useEffect(() => {
    if (status !== "ready" && status !== "failed") {
      const t = setInterval(() => setDots((d) => (d.length >= 3 ? "." : d + ".")), 600);
      return () => clearInterval(t);
    }
  }, [status]);

  useEffect(() => {
    if (status === "ready" || status === "failed" || isMock) return;
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`/api/explainer/video-status/${videoData.video_id}`);
        const d = await r.json();
        if (d.progress) setProgress(d.progress);
        if (d.status === "ready") {
          setDownloadUrl(d.download_url || null);
          setHostedUrl(d.hosted_url || d.video_url || null);
          setStatus("ready");
          clearInterval(pollRef.current);
        } else if (d.status === "failed") {
          setStatus("failed");
          clearInterval(pollRef.current);
        }
      } catch {}
    }, 5000);
    return () => clearInterval(pollRef.current);
  }, [videoData.video_id, status, isMock]);

  const pct = (() => {
    if (!progress) return 5;
    const [n] = progress.split("/");
    return Math.max(5, Math.min(99, parseInt(n, 10) || 5));
  })();

  return (
    <div className={`min-h-screen bg-[#0a0a0a] text-white flex flex-col ${showTerm ? "pb-60" : ""}`}>
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/5">
        <button onClick={onBack} className="flex items-center gap-2 text-white/40 hover:text-white transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center gap-3">
          {!showTerm && (
            <button onClick={() => setShowTerm(true)} className="flex items-center gap-2 text-white/30 hover:text-white/60 text-xs font-mono border border-white/10 px-3 py-1.5 rounded-full transition-colors">
              <Terminal className="w-3.5 h-3.5" /> Logs
            </button>
          )}
          <div className="flex items-center gap-2 text-white/25 text-xs font-mono">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Dr. Ava Vance — AI NeuroCardiologist
          </div>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        {status !== "ready" ? (
          <div className="text-center space-y-10 max-w-sm w-full">
            <div className="relative mx-auto w-28 h-28">
              <div className="absolute inset-0 rounded-full border border-white/8 animate-ping" />
              <div className="absolute inset-2 rounded-full border border-white/5 animate-ping" style={{ animationDelay: "0.4s" }} />
              <div className="absolute inset-4 rounded-full bg-white/4 flex items-center justify-center">
                <User className="w-9 h-9 text-white/20" />
              </div>
            </div>
            {status === "failed" ? (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-red-400">Render Failed</h2>
                <p className="text-white/40 text-sm leading-relaxed">Tavus could not complete the render. Check the terminal below.</p>
                <button onClick={onBack} className="px-6 py-3 rounded-full bg-white text-black text-sm font-semibold">Try Again</button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold tracking-tight">{status === "queued" ? `In queue${dots}` : `Generating${dots}`}</h2>
                  <p className="text-white/40 text-sm leading-relaxed">Dr. Ava is recording your report. Takes <strong className="text-white/60">1–4 minutes</strong>.</p>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-mono text-white/25"><span>Tavus render</span><span>{pct}%</span></div>
                  <div className="w-full bg-white/5 rounded-full h-0.5 overflow-hidden">
                    <div className="h-full bg-emerald-400 rounded-full transition-all duration-1000" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <p className="text-white/15 text-xs font-mono pt-2">video_id: {videoData.video_id}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full max-w-4xl space-y-5">
            {isMock && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl px-5 py-3 text-amber-300 text-sm text-center">
                Preview mode — sample video.
              </div>
            )}
            <div className="relative aspect-video rounded-3xl overflow-hidden bg-black shadow-2xl">
              {downloadUrl ? (
                <video src={downloadUrl} controls autoPlay playsInline className="w-full h-full object-cover" />
              ) : hostedUrl ? (
                <iframe src={hostedUrl} className="w-full h-full border-0" allow="autoplay; fullscreen" title="Dr. Ava" />
              ) : (
                <div className="flex items-center justify-center h-full text-white/30 text-sm">No playback URL.</div>
              )}
            </div>
            <p className="text-center text-white/25 text-sm">Pause, rewind or replay anytime.</p>
          </div>
        )}
      </div>
      {showTerm && <LogTerminal onClose={() => setShowTerm(false)} />}
    </div>
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
    <div className="w-full max-w-4xl relative">
      {/* DailyAudio renders a hidden <audio> for all remote audio tracks */}
      <DailyAudio />

      <div className="aspect-video rounded-3xl overflow-hidden bg-black shadow-2xl">
        {avatarId ? (
          <DailyVideo
            sessionId={avatarId}
            type="video"
            autoPlay
            mirror={false}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-white/15 border-t-white animate-spin" />
            <p className="text-white/25 text-sm font-mono">Waiting for Dr. Ava's video stream...</p>
          </div>
        )}
      </div>

      <p className="text-center text-white/20 text-xs mt-4 font-mono">
        {avatarId ? "Speak into your microphone to ask Dr. Ava about the report" : "Avatar is initializing..."}
      </p>
    </div>
  );
}

// ─── CVI Room (uses DailyProvider + DailyVideo — no iframe, no meeting room) ─
function CVIRoom({ sessionData, onClose }) {
  const [callObj,   setCallObj]   = useState(null);
  const [callState, setCallState] = useState("init");
  const [micMuted,  setMicMuted]  = useState(false);
  const [showTerm,  setShowTerm]  = useState(true);
  const [errorMsg,  setErrorMsg]  = useState("");
  const [avatarJoined, setAvatarJoined] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [micMonitor, setMicMonitor] = useState("checking");
  const callRef = useRef(null);
  const initRunRef = useRef(0);

  const isMock  = sessionData?.is_mock;
  const roomUrl = sessionData?.conversation_url;

  // Create call object and join
  useEffect(() => {
    if (isMock || !roomUrl) return;
    let active = true;
    const runId = ++initRunRef.current;
    const isActiveRun = () => active && runId === initRunRef.current;

    const handleJoined = () => {
      if (isActiveRun()) setCallState("joined");
    };
    const handleLeft = () => {
      if (isActiveRun()) setCallState("left");
    };
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

        const co = DailyIframe.createCallObject({
          subscribeToTracksAutomatically: true,
        });
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
      setErrorMsg("Dr. Ava did not join this room. Please start a new session.");
      setCallState("error");
    }, 45000);

    return () => clearTimeout(timeout);
  }, [callState, avatarJoined]);

  // Mic toggle
  useEffect(() => {
    if (callObj && callState === "joined") callObj.setLocalAudio(!micMuted);
  }, [micMuted, callState, callObj]);

  useEffect(() => {
    if (!callObj || callState !== "joined") {
      setMicLevel(0);
      setMicMonitor("checking");
      return;
    }

    let active = true;
    let receivedAudioLevel = false;
    const handleAudioLevel = ({ audioLevel = 0 }) => {
      if (!active) return;
      receivedAudioLevel = true;
      setMicLevel(Math.max(0, Math.min(1, audioLevel)));
      setMicMonitor("ready");
    };

    callObj.on("local-audio-level", handleAudioLevel);
    callObj.startLocalAudioLevelObserver(120).catch(() => {
      if (active) setMicMonitor("unavailable");
    });

    const inputTimeout = setTimeout(() => {
      if (active && !receivedAudioLevel) setMicMonitor("unavailable");
    }, 3000);

    return () => {
      active = false;
      clearTimeout(inputTimeout);
      callObj.off("local-audio-level", handleAudioLevel);
      try { callObj.stopLocalAudioLevelObserver(); } catch {}
    };
  }, [callObj, callState]);

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

  const micHasSignal = micLevel > 0.015;
  const micLabel = micMuted
    ? "Microphone muted"
    : micMonitor === "unavailable"
      ? "Microphone unavailable"
      : micMonitor === "checking"
        ? "Checking microphone"
        : micHasSignal
          ? "Microphone receiving sound"
          : "Microphone on: waiting for sound";
  const micTone = micMuted || micMonitor === "unavailable"
    ? "text-red-400 border-red-500/30 bg-red-500/10"
    : micHasSignal
      ? "text-emerald-300 border-emerald-400/30 bg-emerald-400/10"
      : "text-amber-300 border-amber-400/30 bg-amber-400/10";
  const micMeter = Math.max(0.18, Math.min(1, micLevel * 5));

  // ── UI shell (shared between DailyProvider-wrapped and non-wrapped states) ──
  const shell = (videoContent) => (
    <div className={`min-h-screen bg-[#0a0a0a] text-white flex flex-col ${showTerm ? "pb-60" : ""}`}>
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/5">
        <button onClick={handleEnd} className="flex items-center gap-2 text-white/40 hover:text-white transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" /> End Session
        </button>
        <div className="flex items-center gap-3">
          {!showTerm && (
            <button onClick={() => setShowTerm(true)} className="flex items-center gap-2 text-white/30 hover:text-white/60 text-xs font-mono border border-white/10 px-3 py-1.5 rounded-full transition-colors">
              <Terminal className="w-3.5 h-3.5" /> Logs
            </button>
          )}
          <div className="flex items-center gap-2 text-white/25 text-xs font-mono">
            <div className={`w-2 h-2 rounded-full ${callState === "joined" ? "bg-emerald-400" : callState === "error" ? "bg-red-400" : "bg-amber-400"} animate-pulse`} />
            {callState === "joined" && avatarJoined ? "Live — Dr. Ava Vance" : callState === "joined" ? "Starting Dr. Ava..." : callState === "error" ? "Error" : "Connecting..."}
          </div>
        </div>
      </div>

      <div className="flex-1 relative flex flex-col items-center justify-center px-4 py-10">
        {videoContent}
      </div>

      {!isMock && callState === "joined" && (
        <div className="fixed left-1/2 -translate-x-1/2 flex items-center gap-4" style={{ bottom: showTerm ? "240px" : "2rem" }}>
          <div title={micLabel} aria-label={micLabel} role="status" className={`h-12 w-12 rounded-full border flex items-center justify-center ${micTone}`}>
            {micMuted || micMonitor === "unavailable" ? (
              <MicOff className="w-5 h-5" />
            ) : micMonitor === "checking" ? (
              <Mic className="w-5 h-5 animate-pulse" />
            ) : (
              <div className="flex items-end gap-0.5 h-5" aria-hidden="true">
                {[0.42, 0.7, 1].map((baseHeight) => (
                  <span
                    key={baseHeight}
                    className="w-1 rounded-full bg-current transition-transform duration-100 origin-bottom"
                    style={{ height: `${baseHeight * 18}px`, transform: `scaleY(${micMeter})` }}
                  />
                ))}
              </div>
            )}
          </div>
          <button onClick={() => setMicMuted((m) => !m)} title={micMuted ? "Unmute" : "Mute"}
            className={`w-14 h-14 rounded-full flex items-center justify-center border-2 text-lg transition-all duration-200 ${micMuted ? "bg-red-500/20 border-red-500/40 text-red-400" : "bg-white/10 border-white/15 text-white hover:bg-white/20"}`}>
            {micMuted ? "🔇" : "🎙️"}
          </button>
          <button onClick={handleEnd} title="End session" className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg text-lg border-2 border-red-500/50">✕</button>
        </div>
      )}

      {showTerm && <LogTerminal onClose={() => setShowTerm(false)} />}
    </div>
  );

  // ── Mock mode ──
  if (isMock) {
    return shell(
      <div className="text-center space-y-6 max-w-sm">
        <div className="w-28 h-28 rounded-full overflow-hidden mx-auto bg-white/5 ring-1 ring-white/10">
          <img src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=400&q=80" alt="Dr. Ava" className="w-full h-full object-cover" />
        </div>
        <h3 className="text-lg font-semibold text-white">Dr. Ava Vance</h3>
        <p className="text-white/35 text-sm italic">"{sessionData?.greeting || "I am ready for your questions."}"</p>
        <div className="bg-white/4 border border-white/8 rounded-2xl p-5 text-left text-sm text-white/40">
          <p>Add <code className="text-white/60">TAVUS_API_KEY</code> and <code className="text-white/60">TAVUS_REPLICA_ID</code> to <code className="text-white/60">.env</code></p>
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (callState === "error") {
    return shell(
      <div className="text-center space-y-6 max-w-sm">
        <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto"><X className="w-8 h-8 text-red-400" /></div>
        <h3 className="text-lg font-semibold text-red-400">Connection Failed</h3>
        <p className="text-white/40 text-sm">{errorMsg}</p>
        <button onClick={handleEnd} className="px-6 py-3 rounded-full bg-white text-black text-sm font-semibold">Go Back</button>
      </div>
    );
  }

  // ── Connecting state (no call object yet) ──
  if (!callObj || callState === "init" || callState === "joining") {
    return shell(
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-white/15 border-t-white animate-spin" />
        <p className="text-white/30 text-sm">Connecting to Dr. Ava...</p>
        <p className="text-white/15 text-xs font-mono">Establishing secure video stream</p>
      </div>
    );
  }

  // ── Joined: wrap in DailyProvider so hooks work inside CVIVideoArea ──
  return (
    <DailyProvider callObject={callObj}>
      {shell(<CVIVideoArea onRemoteParticipantChange={setAvatarJoined} />)}
    </DailyProvider>
  );
}

// ─── Main Upload / Selection Screen ──────────────────────────────────────────
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

  const handlePreset = (key) => { setSelectedPreset(key); setReportText(PRESETS[key].text); setUploadedFile(""); };

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFile(file.name);
    setSelectedPreset("");
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      const reader = new FileReader();
      reader.onload = (ev) => setReportText(ev.target.result || "");
      reader.readAsText(file);
    } else {
      setReportText("PDF selected — backend will extract text on submit.");
    }
  };

  const buildFormData = () => {
    const fd = new FormData();
    fd.append("target_audience", audience);
    if (selectedPreset) { fd.append("sample_key", selectedPreset); }
    else { fd.append("report_text", reportText); const fi = document.querySelector('input[type="file"]'); if (fi?.files[0]) fd.append("report_file", fi.files[0]); }
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
    <div className={`min-h-screen bg-[#fafafa] text-slate-900 font-sans ${showTerm ? "pb-60" : ""}`}>
      <div className="max-w-2xl mx-auto px-6 py-16 space-y-12">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full">
            <div className="w-2 h-2 rounded-full bg-emerald-500" /> Powered by Tavus AI
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-black">NeuroCardiology AI</h1>
          <p className="text-slate-500 text-lg">Upload a report. Watch an AI avatar explain it — or ask it questions live.</p>
        </div>

        <div className="flex justify-center">
          <div className="bg-slate-100 p-1 rounded-full inline-flex gap-1">
            {[["patient", "For Patients"], ["doctor", "For Doctors"]].map(([val, label]) => (
              <button key={val} onClick={() => setAudience(val)}
                className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${audience === val ? "bg-white text-black shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 space-y-6">
          <h2 className="text-lg font-bold text-black">Select or upload a report</h2>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(PRESETS).map(([key, preset]) => (
              <button key={key} onClick={() => handlePreset(key)}
                className={`relative p-4 rounded-2xl border text-left transition-all ${selectedPreset === key ? "border-black bg-black text-white" : "border-slate-200 hover:border-slate-300 text-slate-700"}`}>
                {selectedPreset === key && <Check className="absolute top-3 right-3 w-4 h-4 text-white/60" />}
                <p className="text-sm font-semibold leading-snug pr-5">{preset.label}</p>
              </button>
            ))}
          </div>
          <textarea value={reportText} onChange={(e) => { setReportText(e.target.value); setSelectedPreset(""); }} rows={6} placeholder="Or paste your neurocardiology report text here..."
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black resize-none transition-colors" />
          <label className="flex items-center gap-2 cursor-pointer text-sm text-blue-600 hover:text-blue-800 transition-colors w-fit">
            <Upload className="w-4 h-4" />
            <span>{uploadedFile ? `Loaded: ${uploadedFile}` : "Upload PDF or TXT file"}</span>
            <input type="file" accept=".pdf,.txt,.md" onChange={handleUpload} className="hidden" />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button onClick={handleGenerateVideo} disabled={generatingVideo || startingCVI || !reportText.trim()}
            className="group flex flex-col items-start gap-4 bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm rounded-3xl p-7 text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              {generatingVideo ? <Loader className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 ml-0.5" />}
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-black">Avatar Explainer</h3>
              <p className="text-sm text-slate-500 leading-relaxed">An AI avatar records a full video explanation of your report.</p>
            </div>
            <div className="flex items-center gap-1 text-sm font-semibold text-blue-600 mt-auto">
              {generatingVideo ? "Submitting..." : <><span>Generate video</span> <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" /></>}
            </div>
          </button>

          <button onClick={handleStartCVI} disabled={startingCVI || generatingVideo || !reportText.trim()}
            className="group flex flex-col items-start gap-4 bg-black hover:bg-slate-900 rounded-3xl p-7 text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            <div className="w-11 h-11 rounded-2xl bg-white/10 text-white flex items-center justify-center shrink-0">
              {startingCVI ? <Loader className="w-5 h-5 animate-spin" /> : <MessageCircle className="w-5 h-5" />}
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Interactive Q&A</h3>
              <p className="text-sm text-white/50 leading-relaxed">Speak live with an AI avatar about the report.</p>
            </div>
            <div className="flex items-center gap-1 text-sm font-semibold text-white mt-auto">
              {startingCVI ? "Connecting..." : <><span>Start live chat</span> <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" /></>}
            </div>
          </button>
        </div>

        <div className="flex justify-center">
          <button onClick={() => setShowTerm((s) => !s)}
            className="flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-slate-600 border border-slate-200 hover:border-slate-300 px-4 py-2 rounded-full transition-colors">
            <Terminal className="w-3.5 h-3.5" />
            {showTerm ? "Hide Backend Terminal" : "Show Backend Terminal"}
          </button>
        </div>
      </div>
      {showTerm && <LogTerminal onClose={() => setShowTerm(false)} />}
    </div>
  );
}
