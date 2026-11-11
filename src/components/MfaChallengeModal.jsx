import { useState, useRef, useEffect } from "react";
import { ShieldCheck, KeyRound, AlertCircle, Loader2, ArrowRight, LogOut } from "lucide-react";
import { supabase } from "../supabase";

export default function MfaChallengeModal({ isOpen, factorId, userEmail, onSuccess, onCancel }) {
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setCode("");
      setErrorMsg("");
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleVerify = async (e) => {
    if (e) e.preventDefault();
    const cleanCode = code.replace(/\s+/g, "").trim();
    if (cleanCode.length !== 6) {
      setErrorMsg("Please enter the 6-digit code from your authenticator app.");
      return;
    }

    setVerifying(true);
    setErrorMsg("");

    try {
      const { data, error } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: cleanCode
      });

      if (error) throw error;

      if (onSuccess) {
        onSuccess(data);
      }
    } catch (err) {
      setErrorMsg(err.message || "Invalid authenticator code. Please check your app and try again.");
    } finally {
      setVerifying(false);
    }
  };

  const handleChange = (val) => {
    const cleaned = val.replace(/[^0-9]/g, "").slice(0, 6);
    setCode(cleaned);
    if (cleaned.length === 6) {
      // Auto-submit when 6th digit is typed or pasted
      setTimeout(() => {
        handleAutoSubmit(cleaned);
      }, 50);
    }
  };

  const handleAutoSubmit = async (cleanCode) => {
    setVerifying(true);
    setErrorMsg("");
    try {
      const { data, error } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: cleanCode
      });
      if (error) throw error;
      if (onSuccess) onSuccess(data);
    } catch (err) {
      setErrorMsg(err.message || "Invalid code. Please try again.");
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 text-center space-y-2 border-b border-slate-800 bg-slate-950">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-100">Two-Factor Authentication</h3>
          <p className="text-xs text-slate-400">
            Enter the 6-digit verification code from your Microsoft or Google Authenticator app for <span className="text-slate-200 font-medium">{userEmail}</span>.
          </p>
        </div>

        {/* Input Form */}
        <form onSubmit={handleVerify} className="p-6 space-y-4">
          <div className="space-y-1">
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="000000"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-center text-2xl font-mono tracking-[0.45em] text-white focus:outline-none focus:border-indigo-500 placeholder:text-slate-700"
            />
          </div>

          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={verifying || code.length !== 6}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
          >
            {verifying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying...</span>
              </>
            ) : (
              <>
                <span>Verify & Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="w-full py-2 text-xs text-slate-400 hover:text-slate-200 flex items-center justify-center gap-1.5 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Cancel & Sign Out</span>
            </button>
          )}
        </form>

      </div>
    </div>
  );
}

