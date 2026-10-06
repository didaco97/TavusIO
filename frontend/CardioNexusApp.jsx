import React, { useState, useEffect, useRef, useCallback } from "react";
import DailyIframe from "@daily-co/daily-js";
import { DailyProvider, DailyVideo, DailyAudio, useParticipantIds } from "@daily-co/daily-react";

/* ═══════════════════════════════════════════════════════════════════
   ICONS  (inline SVG — no extra dep)
═══════════════════════════════════════════════════════════════════ */
const Icon = ({ d, size = 18, cls = "", stroke = "currentColor", fill = "none", strokeWidth = 1.8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke}
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={cls}>
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
  </svg>
);

const Icons = {
  heart:      "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z",
  upload:     ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4","M17 8l-5-5-5 5","M12 3v12"],
  pdf:        ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z","M14 2v6h6","M16 13H8","M16 17H8","M10 9H8"],
  mic:        ["M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z","M19 10v2a7 7 0 0 1-14 0v-2","M12 19v4","M8 23h8"],
  micOff:     ["M1 1l22 22","M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6","M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23","M12 19v4","M8 23h8"],
  phone:      "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 10.15 19.79 19.79 0 0 1 1.6 1.52 2 2 0 0 1 3.6 0h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 7.91a16 16 0 0 0 6.1 6.1l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16z", // simplified
  x:          ["M18 6 6 18","M6 6l12 12"],
  check:      ["M20 6 9 17l-5-5"],
  loader:     "M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83",
  terminal:   ["M4 17l6-6-6-6","M12 19h8"],
  chevDown:   "M6 9l6 6 6-6",
  info:       ["M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z","M12 16v-4","M12 8h.01"],
  sparkle:    ["M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"],
  arrowUp:    ["M12 19V5","M5 12l7-7 7 7"],
  settings:   ["M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z", "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"],
};

/* ═══════════════════════════════════════════════════════════════════
   DAILY.JS CLEANUP
═══════════════════════════════════════════════════════════════════ */
let dailyChain = Promise.resolve();
async function destroyDaily(co) {
  if (!co || co.isDestroyed?.()) return;
  try { await co.leave(); } catch {}
  try { await co.destroy(); } catch {}
}
function queueDestroy(co) { dailyChain = dailyChain.then(() => destroyDaily(co)); return dailyChain; }
async function destroyAll() {
  await dailyChain;
  try { const e = DailyIframe.getCallInstance?.(); if (e && !e.isDestroyed?.()) await destroyDaily(e); } catch {}
}

/* ═══════════════════════════════════════════════════════════════════
   ECG BACKGROUND SVG
═══════════════════════════════════════════════════════════════════ */
function EcgBackground() {
  return (
    <div className="ecg-bg" aria-hidden="true">
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="ecg" x="0" y="0" width="300" height="80" patternUnits="userSpaceOnUse">
            <polyline
              points="0,40 20,40 30,40 35,15 40,65 45,40 55,40 60,35 65,45 70,40 120,40 125,10 130,70 135,40 180,40 185,32 190,48 195,40 300,40"
              fill="none" stroke="#e8303a" strokeWidth="1.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#ecg)" />
      </svg>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   LOG TERMINAL
═══════════════════════════════════════════════════════════════════ */
function LogTerminal({ onClose }) {
  const [logs, setLogs]   = useState([]);
  const [open, setOpen]   = useState(true);
  const bottomRef = useRef(null);
  const esRef     = useRef(null);

  useEffect(() => {
    esRef.current = new EventSource("/api/logs");
    esRef.current.onmessage = (e) => {
      try { setLogs(p => [...p.slice(-399), JSON.parse(e.data)]); } catch {}
    };
    esRef.current.onerror = () =>
      setLogs(p => [...p, { level: "error", msg: "[STREAM] Disconnected.", ts: new Date().toISOString() }]);
    return () => esRef.current?.close();
  }, []);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, open]);

  const color = (l) =>
    l === "error" ? "#f87171" : l === "warn" ? "#fbbf24" : "#34d399";

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 200,
      background: "#020609", borderTop: "1px solid rgba(255,255,255,0.08)",
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      {/* Header */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "6px 14px", cursor: "pointer",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon d={Icons.terminal} size={13} cls="" style={{ color: "#34d399" }} />
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: "'JetBrains Mono', monospace" }}>
            Backend Terminal
          </span>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399", animation: "pulse 2s infinite" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={e => { e.stopPropagation(); setLogs([]); }}
            style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", cursor: "pointer", background: "none", border: "none" }}
          >clear</button>
          <button
            onClick={e => { e.stopPropagation(); onClose(); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)" }}
          >
            <Icon d={Icons.x} size={13} />
          </button>
          <Icon
            d={Icons.chevDown} size={13}
            cls={`transition-transform duration-200 ${open ? "" : "rotate-180"}`}
            stroke="rgba(255,255,255,0.3)"
          />
        </div>
      </div>

      {open && (
        <div style={{ height: 140, overflowY: "auto", padding: "8px 14px", background: "#030b10" }}
          className="terminal-log">
          {logs.length === 0 && (
            <span style={{ color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>Waiting for events…</span>
          )}
          {logs.map((log, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 1 }}>
              <span style={{ color: "rgba(255,255,255,0.2)", flexShrink: 0 }}>
                {new Date(log.ts).toLocaleTimeString("en-US", { hour12: false })}
              </span>
              <span style={{ color: color(log.level), wordBreak: "break-all" }}>{log.msg}</span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   CVI VIDEO AREA (inside DailyProvider)
═══════════════════════════════════════════════════════════════════ */
function CVIVideoArea({ onAvatarJoined }) {
  const remoteIds = useParticipantIds({ filter: "remote" });
  const avatarId  = remoteIds[0];

  useEffect(() => { onAvatarJoined(remoteIds.length > 0); }, [remoteIds.length]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <DailyAudio />
      {avatarId ? (
        <DailyVideo
          sessionId={avatarId}
          type="video"
          autoPlay
          mirror={false}
          style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 0 }}
        />
      ) : (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", height: "100%", gap: 12,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            border: "2px solid rgba(232,48,58,0.3)",
            borderTop: "2px solid #e8303a",
            animation: "spin 1s linear infinite",
          }} />
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Connecting to Dr. Raj…</p>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   CVI SESSION WINDOW (full-screen overlay)
═══════════════════════════════════════════════════════════════════ */
function CVIWindow({ sessionData, extractedText, onEnd }) {
  const [callObj,     setCallObj]     = useState(null);
  const [callState,   setCallState]   = useState("init");   // init | joining | joined | left | error
  const [micMuted,    setMicMuted]    = useState(false);
  const [errorMsg,    setErrorMsg]    = useState("");
  const [avatarReady, setAvatarReady] = useState(false);
  const [elapsed,     setElapsed]     = useState(0);
  const [showInfo,    setShowInfo]    = useState(false);
  const callRef    = useRef(null);
  const initRunRef = useRef(0);
  const timerRef   = useRef(null);

  const isMock  = sessionData?.is_mock;
  const roomUrl = sessionData?.conversation_url;

  // ── Timer ──────────────────────────────────────────────────────
  useEffect(() => {
    if (callState === "joined") {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [callState]);

  const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // ── Daily.js connection ────────────────────────────────────────
  useEffect(() => {
    if (isMock || !roomUrl) return;
    let active = true;
    const runId = ++initRunRef.current;
    const ok = () => active && runId === initRunRef.current;

    const hJ = () => { if (ok()) setCallState("joined"); };
    const hL = () => { if (ok()) setCallState("left"); };
    const hE = (e) => { if (ok()) { setErrorMsg(e?.errorMsg || "Connection error"); setCallState("error"); } };

    (async () => {
      try {
        setCallObj(null); setCallState("joining"); setErrorMsg(""); setAvatarReady(false);
        await destroyAll();
        if (!ok()) return;
        const co = DailyIframe.createCallObject({ subscribeToTracksAutomatically: true });
        callRef.current = co;
        co.on("joined-meeting", hJ);
        co.on("left-meeting",   hL);
        co.on("error",          hE);
        if (!ok()) { co.off("joined-meeting", hJ); co.off("left-meeting", hL); co.off("error", hE); await queueDestroy(co); return; }
        setCallObj(co);
        await co.join({ url: roomUrl, startVideoOff: true, startAudioOff: false });
      } catch (err) {
        if (ok()) { setErrorMsg(err?.message || "Failed to join"); setCallState("error"); }
      }
    })();

    return () => {
      active = false; initRunRef.current++;
      const co = callRef.current; callRef.current = null;
      if (co) { co.off("joined-meeting", hJ); co.off("left-meeting", hL); co.off("error", hE); queueDestroy(co); }
    };
  }, [roomUrl, isMock]);

  // ── Avatar join timeout ────────────────────────────────────────
  useEffect(() => {
    if (callState !== "joined" || avatarReady) return;
    const t = setTimeout(() => {
      setErrorMsg("Avatar did not join within 45 seconds. Please try again.");
      setCallState("error");
    }, 45000);
    return () => clearTimeout(t);
  }, [callState, avatarReady]);

  // ── Mic toggle ────────────────────────────────────────────────
  useEffect(() => {
    if (callObj && callState === "joined") callObj.setLocalAudio(!micMuted);
  }, [micMuted, callState, callObj]);

  // ── End call ──────────────────────────────────────────────────
  const handleEnd = useCallback(async () => {
    const co = callRef.current || callObj;
    callRef.current = null;
    if (co) { setCallObj(null); setCallState("left"); await queueDestroy(co); }
    if (sessionData?.conversation_id && !isMock) {
      try { await fetch(`/api/cvi/end/${sessionData.conversation_id}`, { method: "POST" }); } catch {}
    }
    onEnd();
  }, [callObj, sessionData, isMock, onEnd]);

  // ─────────────────────────────────────────────────────────────
  // MOCK mode
  // ─────────────────────────────────────────────────────────────
  if (isMock) {
    return (
      <div className="cvi-overlay animate-fade-in">
        <div style={{
          maxWidth: 480, width: "100%", padding: "0 24px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 24,
        }}>
          {/* Avatar placeholder */}
          <div style={{
            width: 120, height: 120, borderRadius: "50%",
            background: "linear-gradient(135deg, #e8303a22, #0ea5e922)",
            border: "2px solid rgba(232,48,58,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            position: "relative",
          }}>
            <div style={{
              position: "absolute", inset: -8, borderRadius: "50%",
              border: "1px solid rgba(232,48,58,0.15)",
              animation: "pulse-ring 2s ease-in-out infinite",
            }} />
            <span style={{ fontSize: 48 }}>👨‍⚕️</span>
          </div>

          <div style={{ textAlign: "center" }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Preview Mode</h2>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, lineHeight: 1.6 }}>
              Dr. Raj would say:<br />
              <em style={{ color: "rgba(255,255,255,0.7)", fontStyle: "italic" }}>
                "{sessionData?.greeting}"
              </em>
            </p>
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 12 }}>
              Add your Tavus API keys to enable the live CVI session.
            </p>
          </div>

          <button onClick={handleEnd} className="btn-primary"
            style={{ padding: "10px 28px", borderRadius: 10, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <Icon d={Icons.x} size={15} /> Close Preview
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // ERROR state
  // ─────────────────────────────────────────────────────────────
  if (callState === "error") {
    return (
      <div className="cvi-overlay animate-fade-in">
        <div style={{ textAlign: "center", maxWidth: 400, padding: "0 24px" }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
          }}>
            <Icon d={Icons.x} size={22} stroke="#f87171" />
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: "#f87171", marginBottom: 8 }}>Connection Failed</h3>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 24 }}>{errorMsg}</p>
          <button onClick={handleEnd} className="btn-ghost"
            style={{ padding: "10px 24px", borderRadius: 10, fontSize: 13 }}>
            Close
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // JOINING / INIT state
  // ─────────────────────────────────────────────────────────────
  if (!callObj || callState === "init" || callState === "joining") {
    return (
      <div className="cvi-overlay animate-fade-in">
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
          {/* Animated heart + rings */}
          <div style={{ position: "relative", width: 80, height: 80 }}>
            <div style={{
              position: "absolute", inset: 0, borderRadius: "50%",
              border: "1px solid rgba(232,48,58,0.2)", animation: "pulse-ring 1.8s ease-in-out infinite",
            }} />
            <div style={{
              position: "absolute", inset: 8, borderRadius: "50%",
              background: "rgba(232,48,58,0.1)", border: "1px solid rgba(232,48,58,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Icon d={Icons.heart} size={28} stroke="#e8303a" fill="rgba(232,48,58,0.3)" strokeWidth={1.5} />
            </div>
          </div>
          <div>
            <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Connecting to Dr. Raj</p>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Setting up your CardioNexus session…</p>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 6, height: 6, borderRadius: "50%", background: "#e8303a",
                animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
              }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // LIVE session
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="cvi-overlay animate-fade-in" style={{ padding: 0, justifyContent: "flex-start", background: "#03080f" }}>
      {/* ── Top bar ── */}
      <div style={{
        width: "100%", padding: "12px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(3,8,15,0.9)", zIndex: 10, flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon d={Icons.heart} size={18} stroke="#e8303a" fill="rgba(232,48,58,0.2)" strokeWidth={2} className="animate-heartbeat" />
            <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.3px" }}>CardioNexus</span>
          </div>
          <div style={{
            width: 1, height: 16,
            background: "rgba(255,255,255,0.1)",
          }} />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Live with Dr. Raj</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Timer */}
          <span style={{
            fontSize: 13, fontFamily: "'JetBrains Mono', monospace",
            color: "rgba(255,255,255,0.4)",
          }}>{fmtTime(elapsed)}</span>

          {/* Info toggle */}
          <button
            onClick={() => setShowInfo(s => !s)}
            title="View report context"
            style={{
              background: showInfo ? "rgba(14,165,233,0.15)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${showInfo ? "rgba(14,165,233,0.3)" : "rgba(255,255,255,0.1)"}`,
              borderRadius: 8, padding: "5px 10px", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
              color: showInfo ? "#0ea5e9" : "rgba(255,255,255,0.4)",
              fontSize: 12, transition: "all 0.2s",
            }}
          >
            <Icon d={Icons.pdf} size={13} /> Report
          </button>

          {/* End button */}
          <button
            onClick={handleEnd}
            style={{
              background: "rgba(239,68,68,0.15)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 8, padding: "5px 14px",
              display: "flex", alignItems: "center", gap: 6,
              color: "#f87171", fontSize: 12, fontWeight: 600,
              cursor: "pointer", transition: "all 0.2s",
            }}
          >
            <Icon d={Icons.phone} size={13} /> End Call
          </button>
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>

        {/* ── Video Feed ── */}
        <div style={{
          flex: 1, position: "relative",
          background: "#010408",
          transition: "all 0.3s ease",
        }}>
          <DailyProvider callObject={callObj}>
            <CVIVideoArea onAvatarJoined={setAvatarReady} />
          </DailyProvider>

          {/* ── Controls overlay (bottom center) ── */}
          <div style={{
            position: "absolute", bottom: 28, left: "50%", transform: "translateX(-50%)",
            display: "flex", alignItems: "center", gap: 12,
            background: "rgba(3,8,15,0.85)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 16, padding: "10px 20px",
          }}>
            {/* Mic button */}
            <button
              onClick={() => setMicMuted(m => !m)}
              title={micMuted ? "Unmute mic" : "Mute mic"}
              style={{
                width: 42, height: 42, borderRadius: "50%",
                background: micMuted ? "rgba(239,68,68,0.2)" : "rgba(34,197,94,0.15)",
                border: `1px solid ${micMuted ? "rgba(239,68,68,0.4)" : "rgba(34,197,94,0.3)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", transition: "all 0.2s",
                color: micMuted ? "#f87171" : "#22c55e",
              }}
            >
              <Icon d={micMuted ? Icons.micOff : Icons.mic} size={18} />
            </button>

            {/* Status indicator */}
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 2 }}>
                {micMuted ? "Mic muted" : avatarReady ? "Listening…" : "Waiting for Dr. Raj…"}
              </p>
              <div style={{ display: "flex", gap: 3, justifyContent: "center" }}>
                {!micMuted && [0, 1, 2, 3].map(i => (
                  <div key={i} style={{
                    width: 3, height: 8 + Math.random() * 12,
                    background: "#22c55e", borderRadius: 2,
                    animation: `pulse 0.6s ease-in-out ${i * 0.12}s infinite`,
                  }} />
                ))}
              </div>
            </div>

            {/* End call */}
            <button
              onClick={handleEnd}
              title="End call"
              style={{
                width: 42, height: 42, borderRadius: "50%",
                background: "rgba(239,68,68,0.2)",
                border: "1px solid rgba(239,68,68,0.4)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", transition: "all 0.2s",
                color: "#f87171",
              }}
            >
              <Icon d={Icons.x} size={18} />
            </button>
          </div>

          {/* ── Avatar not yet joined badge ── */}
          {!avatarReady && callState === "joined" && (
            <div style={{
              position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)",
              background: "rgba(14,165,233,0.15)",
              border: "1px solid rgba(14,165,233,0.3)",
              borderRadius: 10, padding: "6px 14px",
              fontSize: 12, color: "#0ea5e9",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#0ea5e9", animation: "pulse 1.5s infinite" }} />
              Dr. Raj is joining…
            </div>
          )}
        </div>

        {/* ── Info / Report Panel (collapsible) ── */}
        {showInfo && (
          <div className="animate-slide-up" style={{
            width: 340, flexShrink: 0,
            background: "rgba(7,14,23,0.95)",
            borderLeft: "1px solid rgba(255,255,255,0.07)",
            display: "flex", flexDirection: "column",
            overflow: "hidden",
          }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Patient Report
              </p>
            </div>
            <div style={{
              flex: 1, overflowY: "auto", padding: "12px 16px",
              fontSize: 11.5, lineHeight: 1.75, color: "rgba(255,255,255,0.6)",
              fontFamily: "'JetBrains Mono', monospace",
              whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}>
              {extractedText || "No report text available."}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   STEP INDICATOR
═══════════════════════════════════════════════════════════════════ */
function StepBadge({ num, label, active, done }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{
        width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
        background: done ? "rgba(34,197,94,0.2)" : active ? "rgba(232,48,58,0.2)" : "rgba(255,255,255,0.05)",
        border: `1.5px solid ${done ? "rgba(34,197,94,0.5)" : active ? "rgba(232,48,58,0.5)" : "rgba(255,255,255,0.1)"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.3s",
      }}>
        {done
          ? <Icon d={Icons.check} size={11} stroke="#22c55e" strokeWidth={2.5} />
          : <span style={{ fontSize: 9.5, fontWeight: 700, color: active ? "#e8303a" : "rgba(255,255,255,0.3)" }}>{num}</span>
        }
      </div>
      <span style={{ fontSize: 12, color: done ? "rgba(255,255,255,0.7)" : active ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.3)", fontWeight: active || done ? 500 : 400 }}>
        {label}
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════════════════════ */
export default function CardioNexusApp() {
  /* ── State ── */
  const [step,          setStep]          = useState(1);   // 1=upload 2=ready
  const [pdfFile,       setPdfFile]       = useState(null);
  const [isDragging,    setIsDragging]    = useState(false);
  const [uploadState,   setUploadState]   = useState("idle");   // idle | uploading | done | error
  const [uploadError,   setUploadError]   = useState("");
  const [extractedText, setExtractedText] = useState("");
  const [wordCount,     setWordCount]     = useState(0);
  const [startingCVI,   setStartingCVI]   = useState(false);
  const [cviData,       setCviData]       = useState(null);
  const [showTerm,      setShowTerm]      = useState(false);
  const [cviError,      setCviError]      = useState("");

  const fileInputRef = useRef(null);

  /* ── Upload PDF ── */
  const uploadPDF = useCallback(async (file) => {
    if (!file || !file.name.toLowerCase().endsWith(".pdf")) {
      setUploadError("Please upload a PDF file.");
      return;
    }
    setPdfFile(file);
    setUploadState("uploading");
    setUploadError("");
    setExtractedText("");
    setWordCount(0);

    try {
      const fd = new FormData();
      fd.append("report_file", file);
      const r = await fetch("/api/cvi/upload-pdf", { method: "POST", body: fd });
      const d = await r.json();

      if (!r.ok) {
        setUploadState("error");
        setUploadError(d.error || "Upload failed. Please try again.");
        return;
      }

      setExtractedText(d.extracted_text);
      setWordCount(d.word_count);
      setUploadState("done");
      setStep(2);
    } catch (err) {
      setUploadState("error");
      setUploadError("Network error: " + err.message);
    }
  }, []);

  /* ── File input handler ── */
  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) uploadPDF(file);
  };

  /* ── Drag & drop ── */
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadPDF(file);
  };
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  /* ── Start CVI ── */
  const handleStartCVI = async () => {
    if (!extractedText) return;
    setStartingCVI(true);
    setCviError("");
    try {
      const r = await fetch("/api/cvi/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extracted_text: extractedText,
        }),
      });
      const d = await r.json();
      if (!r.ok) { setCviError(d.error || "Failed to start session."); return; }
      setCviData(d);
    } catch (err) {
      setCviError("Network error: " + err.message);
    } finally {
      setStartingCVI(false);
    }
  };

  /* ── Reset ── */
  const handleReset = () => {
    setCviData(null); setPdfFile(null); setExtractedText(""); setWordCount(0);
    setUploadState("idle"); setUploadError("");
    setStep(1); setCviError("");
  };

  /* ───────────────────────────────────────────────────────────────
     If CVI is active, show full-screen window
  ─────────────────────────────────────────────────────────────── */
  if (cviData) {
    return (
      <>
        <CVIWindow
          sessionData={cviData}
          extractedText={extractedText}
          onEnd={handleReset}
        />
        {showTerm && <LogTerminal onClose={() => setShowTerm(false)} />}

        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
          @keyframes pulse-ring { 0%{transform:scale(0.9);opacity:0.7} 50%{transform:scale(1.1);opacity:0.2} 100%{transform:scale(0.9);opacity:0.7} }
        `}</style>
      </>
    );
  }

  /* ───────────────────────────────────────────────────────────────
     MAIN UPLOAD + CONFIGURE PAGE
  ─────────────────────────────────────────────────────────────── */
  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #03080f 0%, #06101a 50%, #04090f 100%)",
      position: "relative",
      overflow: "hidden",
      paddingBottom: showTerm ? 180 : 0,
    }}>
      <EcgBackground />

      {/* ── Glow orbs ── */}
      <div style={{
        position: "fixed", top: -200, left: "50%", transform: "translateX(-50%)",
        width: 700, height: 400, borderRadius: "50%",
        background: "radial-gradient(ellipse, rgba(232,48,58,0.06) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "fixed", bottom: -100, right: -100,
        width: 500, height: 500, borderRadius: "50%",
        background: "radial-gradient(ellipse, rgba(14,165,233,0.04) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* ── Header ── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 24px",
        background: "rgba(3,8,15,0.8)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: "linear-gradient(135deg, rgba(232,48,58,0.3), rgba(232,48,58,0.1))",
            border: "1px solid rgba(232,48,58,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Icon d={Icons.heart} size={17} stroke="#e8303a" fill="rgba(232,48,58,0.3)" strokeWidth={2} className="animate-heartbeat" />
          </div>
          <div>
            <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.5px", color: "#f0f4f8" }}>
              CardioNexus
            </span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", display: "block", lineHeight: 1, marginTop: 1 }}>
              AI Cardiac Consultant
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            padding: "4px 10px", borderRadius: 20,
            background: "rgba(34,197,94,0.08)",
            border: "1px solid rgba(34,197,94,0.2)",
            display: "flex", alignItems: "center", gap: 5,
          }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 11, color: "rgba(34,197,94,0.8)", fontWeight: 500 }}>Dr. Raj Online</span>
          </div>
          <button
            onClick={() => setShowTerm(s => !s)}
            style={{
              background: showTerm ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8, padding: "6px 12px",
              display: "flex", alignItems: "center", gap: 5,
              color: "rgba(255,255,255,0.4)", fontSize: 11.5, cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            <Icon d={Icons.terminal} size={13} /> Logs
          </button>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main style={{
        maxWidth: 680, margin: "0 auto", padding: "48px 24px",
        position: "relative", zIndex: 1,
      }}>

        {/* ── Hero ── */}
        <div className="animate-slide-up" style={{ textAlign: "center", marginBottom: 48 }}>
          {/* Pulsing avatar ring */}
          <div style={{
            width: 80, height: 80, margin: "0 auto 24px",
            position: "relative",
          }}>
            <div style={{
              position: "absolute", inset: -12, borderRadius: "50%",
              border: "1px solid rgba(232,48,58,0.12)",
              animation: "pulse-ring 2.5s ease-in-out infinite",
            }} />
            <div style={{
              position: "absolute", inset: -6, borderRadius: "50%",
              border: "1px solid rgba(232,48,58,0.2)",
              animation: "pulse-ring 2.5s ease-in-out 0.4s infinite",
            }} />
            <div style={{
              width: "100%", height: "100%", borderRadius: "50%",
              background: "linear-gradient(135deg, rgba(232,48,58,0.25), rgba(14,165,233,0.1))",
              border: "1.5px solid rgba(232,48,58,0.35)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 34,
            }}>👨‍⚕️</div>
          </div>

          <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.8px", lineHeight: 1.15, marginBottom: 12 }}>
            Talk to{" "}
            <span style={{
              background: "linear-gradient(135deg, #e8303a, #ff7070)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              Dr. Raj
            </span>
          </h1>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.45)", lineHeight: 1.7, maxWidth: 440, margin: "0 auto" }}>
            Upload your cardiac report and start a live video consultation.<br />
            Dr. Raj will review your report and answer all your questions.
          </p>
        </div>

        {/* ── Step Indicators ── */}
        <div className="animate-slide-up" style={{
          display: "flex", alignItems: "center", gap: 8,
          marginBottom: 32, justifyContent: "center",
        }}>
          <StepBadge num="1" label="Upload Report" active={step === 1} done={step > 1} />
          <div style={{ width: 32, height: 1, background: step > 1 ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.1)", transition: "all 0.5s" }} />
          <StepBadge num="2" label="Start Session" active={step === 2} done={false} />
        </div>

        {/* ────────────────────────────────────────────
            STEP 1 — PDF Upload
        ──────────────────────────────────────────── */}
        <div className="glass-card animate-slide-up" style={{ borderRadius: 20, marginBottom: 16, overflow: "hidden" }}>
          {/* Card header */}
          <div style={{
            padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: uploadState === "done" ? "rgba(34,197,94,0.15)" : "rgba(232,48,58,0.15)",
              border: `1px solid ${uploadState === "done" ? "rgba(34,197,94,0.3)" : "rgba(232,48,58,0.3)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, transition: "all 0.3s",
            }}>
              {uploadState === "done"
                ? <Icon d={Icons.check} size={14} stroke="#22c55e" strokeWidth={2.5} />
                : <Icon d={Icons.pdf} size={14} stroke="#e8303a" />
              }
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600 }}>Upload Cardiac Report</p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>PDF format only · max 50MB</p>
            </div>
            {uploadState === "done" && (
              <div style={{ marginLeft: "auto" }}>
                <button
                  onClick={() => {
                    setPdfFile(null); setExtractedText(""); setWordCount(0);
                    setUploadState("idle"); setStep(1); setUploadError("");
                  }}
                  style={{
                    fontSize: 11, color: "rgba(255,255,255,0.35)",
                    background: "none", border: "none", cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >Change file</button>
              </div>
            )}
          </div>

          {/* Drop zone */}
          <div style={{ padding: 20 }}>
            {uploadState === "done" ? (
              /* Success state */
              <div style={{
                background: "rgba(34,197,94,0.05)",
                border: "1px solid rgba(34,197,94,0.2)",
                borderRadius: 14, padding: "16px 20px",
                display: "flex", alignItems: "center", gap: 14,
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: "rgba(34,197,94,0.1)",
                  border: "1px solid rgba(34,197,94,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <Icon d={Icons.pdf} size={20} stroke="#22c55e" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#f0f4f8", marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {pdfFile?.name}
                  </p>
                  <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.4)" }}>
                    {wordCount.toLocaleString()} words extracted · Ready for Dr. Raj
                  </p>
                </div>
                <Icon d={Icons.check} size={20} stroke="#22c55e" strokeWidth={2.5} />
              </div>
            ) : (
              /* Drop zone */
              <div
                className={`drop-zone ${isDragging ? "active" : ""}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => uploadState !== "uploading" && fileInputRef.current?.click()}
                style={{
                  borderRadius: 14, padding: "36px 24px",
                  display: "flex", flexDirection: "column", alignItems: "center",
                  gap: 12, cursor: uploadState === "uploading" ? "default" : "pointer",
                  transition: "all 0.25s", textAlign: "center",
                  minHeight: 160, justifyContent: "center",
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileInput}
                  style={{ display: "none" }}
                  disabled={uploadState === "uploading"}
                />

                {uploadState === "uploading" ? (
                  <>
                    <div style={{
                      width: 48, height: 48, borderRadius: "50%",
                      border: "2px solid rgba(232,48,58,0.2)",
                      borderTop: "2px solid #e8303a",
                      animation: "spin 0.9s linear infinite",
                    }} />
                    <p style={{ fontSize: 13.5, fontWeight: 500, color: "rgba(255,255,255,0.7)" }}>
                      Extracting report text…
                    </p>
                    <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.3)" }}>
                      {pdfFile?.name}
                    </p>
                  </>
                ) : (
                  <>
                    <div style={{
                      width: 52, height: 52, borderRadius: 14,
                      background: isDragging ? "rgba(232,48,58,0.15)" : "rgba(255,255,255,0.04)",
                      border: `1.5px dashed ${isDragging ? "rgba(232,48,58,0.6)" : "rgba(255,255,255,0.15)"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.25s",
                    }}>
                      <Icon d={Icons.upload} size={22} stroke={isDragging ? "#e8303a" : "rgba(255,255,255,0.35)"} />
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.7)", marginBottom: 4 }}>
                        {isDragging ? "Drop your PDF here" : "Drop your report or click to browse"}
                      </p>
                      <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.25)" }}>
                        ECG reports, echo reports, cath lab reports, discharge summaries…
                      </p>
                    </div>
                    {uploadState === "error" && (
                      <div style={{
                        background: "rgba(239,68,68,0.1)",
                        border: "1px solid rgba(239,68,68,0.2)",
                        borderRadius: 8, padding: "8px 14px",
                        fontSize: 12, color: "#f87171",
                        display: "flex", alignItems: "center", gap: 6,
                      }}>
                        <Icon d={Icons.info} size={13} stroke="#f87171" /> {uploadError}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>


        {/* ────────────────────────────────────────────
            STEP 3 — Start CVI Button
        ──────────────────────────────────────────── */}
        {step >= 2 && (
          <div className="animate-slide-up">
            {cviError && (
              <div style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: 12, padding: "10px 16px", marginBottom: 14,
                fontSize: 12.5, color: "#f87171",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <Icon d={Icons.info} size={14} stroke="#f87171" /> {cviError}
              </div>
            )}

            <button
              onClick={handleStartCVI}
              disabled={startingCVI || !extractedText}
              className="btn-primary animate-glow"
              style={{
                width: "100%", padding: "16px 24px",
                borderRadius: 16, fontSize: 15,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              }}
            >
              {startingCVI ? (
                <>
                  <Icon d={Icons.loader} size={18} cls="animate-spin" />
                  Starting session…
                </>
              ) : (
                <>
                  <Icon d={Icons.heart} size={18} stroke="white" fill="rgba(255,255,255,0.2)" strokeWidth={2} />
                  Start Consultation with Dr. Raj
                </>
              )}
            </button>

            {/* Greeting preview */}
            <div style={{
              marginTop: 14,
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 12, padding: "12px 16px",
              display: "flex", gap: 10, alignItems: "flex-start",
            }}>
              <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>👨‍⚕️</span>
              <div>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Dr. Raj will greet you with
                </p>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.6, fontStyle: "italic" }}>
                  "Hi, I'm Dr. Raj, welcome to CardioNexus. How can I help you today with your report?"
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Footer note ── */}
        <div style={{ textAlign: "center", marginTop: 36 }}>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.18)", lineHeight: 1.7 }}>
            Powered by Tavus CVI · For informational purposes only<br />
            Not a substitute for professional medical advice
          </p>
        </div>
      </main>

      {/* ── Log Terminal ── */}
      {showTerm && <LogTerminal onClose={() => setShowTerm(false)} />}

      {/* ── Global keyframes ── */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.45} }
        @keyframes pulse-ring {
          0%  { transform: scale(0.9); opacity: 0.6; }
          50% { transform: scale(1.1); opacity: 0.15; }
          100%{ transform: scale(0.9); opacity: 0.6; }
        }
        .rotate-180 { transform: rotate(180deg); }
        .animate-spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}
