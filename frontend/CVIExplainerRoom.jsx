import React, { useState, useEffect, useRef } from "react";
import { 
  Mic, 
  MicOff, 
  PhoneOff, 
  ShieldCheck, 
  AlertCircle, 
  Sparkles,
} from "lucide-react";

export default function CVIExplainerRoom({ 
  sessionData, 
  targetAudience, 
  mode,
  onClose 
}) {
  const [loading, setLoading] = useState(true);
  const [micMuted, setMicMuted] = useState(false);
  const iframeRef = useRef(null);

  const isDoctor = targetAudience === "doctor";
  const isPresentation = mode === 'presentation';
  const embedUrl = sessionData?.embed_url || sessionData?.conversation_url;
  const isMock = sessionData?.is_mock;

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleEndSession = async () => {
    if (sessionData?.conversation_id) {
      try {
        await fetch(`/api/explainer/end-cvi/${sessionData.conversation_id}/`, {
          method: 'POST'
        });
      } catch (err) {
        console.error("Failed to end session gracefully", err);
      }
    }
    onClose();
  };

  return (
    <div className="w-full bg-black rounded-3xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col h-[70vh] min-h-[600px]">
      
      {/* Header Overlay */}
      <div className="absolute top-8 left-8 right-8 z-20 flex items-center justify-between pointer-events-none">
        <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 flex items-center space-x-3 pointer-events-auto">
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </div>
          <div>
            <h4 className="text-sm font-medium text-white flex items-center gap-2">
              Dr. Ava Vance
            </h4>
          </div>
        </div>

        <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-xs font-mono text-white pointer-events-auto flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>{isPresentation ? 'Encrypted Video Stream' : 'HIPAA Compliant CVI'}</span>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black text-white space-y-4">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-2 border-white/20 animate-ping"></div>
            <div className="absolute inset-0 rounded-full border-2 border-t-white border-r-transparent border-b-white border-l-transparent animate-spin"></div>
          </div>
          <p className="text-white/60 font-medium text-sm animate-pulse">
            Connecting to Dr. Ava...
          </p>
        </div>
      )}

      {/* Mock Mode Alert */}
      {isMock && !loading && (
        <div className="absolute top-24 left-8 right-8 z-20 bg-amber-500/20 border border-amber-500/30 backdrop-blur-md rounded-2xl p-4 text-amber-200 text-sm flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
          <span>
            <strong>Preview Mode:</strong> Connect your Tavus API key to stream live interactive avatar video.
          </span>
        </div>
      )}

      {/* Main Video Stream */}
      <div className="flex-1 relative w-full h-full flex items-center justify-center bg-black">
        {!isMock && embedUrl ? (
          <iframe
            ref={iframeRef}
            src={embedUrl}
            allow="camera; microphone; autoplay; fullscreen"
            className="w-full h-full border-0"
            title="Tavus NeuroCardiology Avatar"
          />
        ) : (
          <div className="text-center p-8 max-w-md space-y-6">
            <div className="w-32 h-32 rounded-full bg-slate-900 mx-auto shadow-2xl relative overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=400&q=80"
                alt="Dr. Ava Vance Avatar"
                className="w-full h-full object-cover filter grayscale-[20%]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
            </div>
            <div>
              <h3 className="text-2xl font-semibold text-white">Dr. Ava Vance</h3>
              <p className="text-white/50 text-sm mt-2">
                {isPresentation 
                  ? "I am reading the report explanation now. Please listen."
                  : "I am ready to answer your questions regarding the report."}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Control Bar */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center space-x-4">
        
        {!isPresentation && (
          <button
            onClick={() => setMicMuted(!micMuted)}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all backdrop-blur-md border ${
              micMuted 
                ? "bg-rose-500/20 border-rose-500/50 text-rose-400 hover:bg-rose-500/30" 
                : "bg-white/10 border-white/20 text-white hover:bg-white/20"
            }`}
          >
            {micMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>
        )}

        <button
          onClick={handleEndSession}
          className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-lg transition-all"
        >
          <PhoneOff className="w-6 h-6" />
        </button>

      </div>
    </div>
  );
}
