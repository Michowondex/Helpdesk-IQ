import { useState, useEffect } from "react";
import { CheckCircle2, ChevronRight, AlertCircle, X, Wrench, PhoneCall, Volume2, VolumeX } from "lucide-react";

// Inline SVG diagrams for hardware troubleshooting steps
function DiagramSvg({ name }) {
  if (name === "cable") {
    return (
      <svg viewBox="0 0 240 80" className="w-full h-24 my-3 bg-slate-900/80 rounded border border-slate-800">
        <rect x="20" y="30" width="60" height="20" rx="4" fill="#334155" stroke="#64748b" strokeWidth="2" />
        <rect x="75" y="35" width="20" height="10" rx="2" fill="#0284c7" />
        <path d="M 85 28 L 95 35 L 85 42 Z" fill="#38bdf8" />
        <rect x="130" y="25" width="70" height="30" rx="4" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        <rect x="135" y="32" width="16" height="16" rx="2" fill="#0f172a" stroke="#38bdf8" strokeDasharray="2" />
        <circle cx="160" cy="40" r="3" fill="#22c55e" />
        <text x="170" y="44" fill="#94a3b8" fontSize="10" fontFamily="sans-serif">LINK OK</text>
      </svg>
    );
  }
  if (name === "printer") {
    return (
      <svg viewBox="0 0 240 80" className="w-full h-24 my-3 bg-slate-900/80 rounded border border-slate-800">
        <rect x="50" y="20" width="140" height="45" rx="6" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        <rect x="70" y="10" width="100" height="15" rx="2" fill="#334155" />
        <rect x="65" y="32" width="50" height="20" rx="3" fill="#0284c7" opacity="0.3" stroke="#38bdf8" />
        <text x="73" y="45" fill="#38bdf8" fontSize="9" fontFamily="sans-serif">PANEL READY</text>
        <circle cx="165" cy="42" r="4" fill="#22c55e" />
      </svg>
    );
  }
  return null;
}

export default function StepCardModal({ 
  article, 
  defaultAutoRead = false,
  onClose, 
  onResolved, 
  onEscalate 
}) {
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [isReadingAloud, setIsReadingAloud] = useState(false);
  const [autoRead, setAutoRead] = useState(defaultAutoRead);

  const rawSteps = article?.steps || [];
  // Normalize steps: handle both array of strings and array of objects { text: "..." }
  const steps = rawSteps.map(s => {
    if (typeof s === "string") return s;
    if (typeof s === "object" && s !== null) return s.text || s.step || JSON.stringify(s);
    return String(s || "");
  });
  const currentStep = steps[currentStepIdx] || "Follow the recommended troubleshooting process.";
  const isLastStep = currentStepIdx >= steps.length - 1;

  const isNetworkCable = article?.id?.includes("net") || article?.title?.toLowerCase().includes("cable") || article?.title?.toLowerCase().includes("internet");
  const isPrinter = article?.category?.toLowerCase().includes("print") || article?.title?.toLowerCase().includes("printer");

  const readCurrentStep = (text) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const cleanText = (text || "").replace(/[*_#`]/g, "");
    const utterance = new SpeechSynthesisUtterance(
      `Step ${currentStepIdx + 1} of ${steps.length}. ${cleanText}`
    );
    utterance.rate = 0.92;
    utterance.pitch = 1;
    utterance.onstart = () => setIsReadingAloud(true);
    utterance.onend = () => setIsReadingAloud(false);
    utterance.onerror = () => setIsReadingAloud(false);
    window.speechSynthesis.speak(utterance);
  };

  const stopReading = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsReadingAloud(false);
  };

  // Auto-read whenever step changes if autoRead is true
  useEffect(() => {
    if (autoRead && currentStep) {
      readCurrentStep(currentStep);
    }
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [currentStepIdx, autoRead]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleNextStep = () => {
    stopReading();
    setCurrentStepIdx(i => i + 1);
  };

  const handleClose = () => {
    stopReading();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-indigo-400" />
            <h3 className="font-semibold text-slate-100 text-sm tracking-wide">{article.title}</h3>
          </div>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Body */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">
              Step {currentStepIdx + 1} of {steps.length}
            </span>
            <span className="text-xs text-slate-400">Category: {article.category}</span>
          </div>

          <p className="text-slate-200 text-sm leading-relaxed mb-4">
            {currentStep}
          </p>

          {/* Visual Diagram */}
          {isNetworkCable && currentStepIdx === 0 && <DiagramSvg name="cable" />}
          {isPrinter && currentStepIdx === 0 && <DiagramSvg name="printer" />}

          {/* Voice Read Aloud Controls */}
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-800/60 flex-wrap">
            {!isReadingAloud ? (
              <button
                type="button"
                onClick={() => readCurrentStep(currentStep)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/10 border border-indigo-500/30 text-indigo-300 text-xs font-medium hover:bg-indigo-600/20 transition-all"
              >
                <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                🔊 Read This Step
              </button>
            ) : (
              <button
                type="button"
                onClick={stopReading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium hover:bg-rose-500/20 transition-all"
              >
                <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                ⏸ Stop Reading
              </button>
            )}

            <button
              type="button"
              onClick={() => setAutoRead(prev => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                autoRead
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20"
                  : "bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200"
              }`}
              title="Automatically read each step aloud when advancing"
            >
              🔁 Auto-Read {autoRead ? "ON" : "OFF"}
            </button>
          </div>

          {/* Interactive Satisfaction Loop */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 bg-slate-950/40 -mx-6 -mb-6 p-6">
            <p className="text-xs font-medium text-slate-400 text-center mb-3">Did this step resolve your problem?</p>
            <div className="flex gap-3">
              <button
                onClick={() => { stopReading(); onResolved(article); }}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950"
              >
                <CheckCircle2 className="w-4 h-4" />
                Yes, Fixed!
              </button>

              {!isLastStep ? (
                <button
                  onClick={handleNextStep}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors border border-slate-700"
                >
                  No, Next Step
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => { stopReading(); onEscalate(article); }}
                  className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-950"
                >
                  <AlertCircle className="w-4 h-4" />
                  Still Broken, Escalate
                </button>
              )}
            </div>

            <button
              onClick={() => { stopReading(); onEscalate(article); }}
              className="w-full mt-3 text-xs text-slate-400 hover:text-indigo-400 flex items-center justify-center gap-1.5 transition-colors py-1"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              Need human technician now? Connect with IT
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
