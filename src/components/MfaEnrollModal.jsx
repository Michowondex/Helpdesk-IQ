import { useState, useEffect } from "react";
import { ShieldCheck, KeyRound, Copy, Check, AlertCircle, X, ArrowRight, Loader2, Smartphone, RefreshCw } from "lucide-react";
import { supabase } from "../supabase";

export default function MfaEnrollModal({ isOpen, isMandatory = false, onClose, onSuccess }) {
  const [loading, setLoading] = useState(true);
  const [factorId, setFactorId] = useState("");
  const [qrCodeSvg, setQrCodeSvg] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [resetting, setResetting] = useState(false);

  const startEnrollment = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      // Step 1: Clean up ALL previous unverified or conflicting factors for this user
      try {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const allTotp = factors?.totp || [];
        for (const f of allTotp) {
          // If factor is unverified or has the friendly name, unenroll to avoid duplicate conflict
          if (f.status === "unverified" || f.friendly_name?.toLowerCase().includes("bizadesk")) {
            await supabase.auth.mfa.unenroll({ factorId: f.id });
          }
        }
      } catch (cleanErr) {
        console.warn("MFA factors pre-cleanup notice:", cleanErr);
      }

      // Step 2: Enroll a fresh factor with a unique friendly name
      const uniqueName = `BizaDesk Authenticator (${Date.now().toString(36)})`;
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: uniqueName
      });

      if (error) throw error;
      if (data) {
        setFactorId(data.id);
        
        // Supabase returns raw SVG string `<svg ...>...</svg>`
        let rawSvg = data.totp?.qr_code || "";
        
        // Ensure SVG has crisp edge rendering and responsive sizing for mobile camera sensors
        if (rawSvg.includes("<svg")) {
          // Normalize SVG style to prevent optical blurring and ensure high contrast
          if (!rawSvg.includes("shape-rendering")) {
            rawSvg = rawSvg.replace("<svg", '<svg style="shape-rendering: crispEdges; image-rendering: pixelated; width: 100%; height: 100%; display: block;"');
          }
        }
        setQrCodeSvg(rawSvg);
        setSecretKey(data.totp?.secret || "");
      }
    } catch (err) {
      setErrorMsg(err.message || "Failed to initialize authenticator enrollment.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    startEnrollment();
  }, [isOpen]);

  const handleReset = async () => {
    setResetting(true);
    setVerificationCode("");
    await startEnrollment();
    setResetting(false);
  };

  if (!isOpen) return null;

  const handleCopySecret = () => {
    if (!secretKey) return;
    navigator.clipboard.writeText(secretKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    const cleanCode = verificationCode.replace(/\s+/g, "").trim();
    if (cleanCode.length !== 6) {
      setErrorMsg("Please enter the complete 6-digit code from your authenticator app.");
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

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm tracking-wide">
                Two-Factor Authentication (2FA)
              </h3>
              <span className="text-[10px] text-slate-400">Microsoft / Google Authenticator</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              disabled={loading || resetting}
              title="Reset and generate fresh QR Code"
              className="text-xs text-slate-400 hover:text-indigo-400 flex items-center gap-1 transition-colors px-2 py-1 rounded-md bg-slate-800/60 border border-slate-700/60 disabled:opacity-40"
            >
              <RefreshCw className={`w-3 h-3 ${resetting || loading ? "animate-spin" : ""}`} />
              <span className="text-[10px]">Reset QR</span>
            </button>
            {!isMandatory && onClose && (
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-200 transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {isMandatory && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
              <Smartphone className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong>Bank Security Policy:</strong> All IT Administrative and Technician accounts must configure 2FA before accessing the operational dashboard.
              </span>
            </div>
          )}

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400 text-xs">
              <Loader2 className="w-7 h-7 text-indigo-500 animate-spin" />
              <span>Generating secure QR code...</span>
            </div>
          ) : (
            <>
              {/* Step 1: Scan QR Code */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">1</span>
                  <span>Scan QR Code with your Authenticator App:</span>
                </div>

                {/* High-contrast pure white container with ample quiet-zone for camera optical detection */}
                <div className="flex justify-center items-center p-5 bg-white rounded-xl shadow-md max-w-[220px] mx-auto overflow-hidden">
                  {qrCodeSvg ? (
                    qrCodeSvg.startsWith("<svg") ? (
                      <div 
                        className="w-44 h-44 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
                        dangerouslySetInnerHTML={{ __html: qrCodeSvg }}
                      />
                    ) : (
                      <img 
                        src={qrCodeSvg} 
                        alt="Authenticator QR Code" 
                        className="w-44 h-44 object-contain"
                      />
                    )
                  ) : (
                    <div className="w-44 h-44 flex items-center justify-center text-slate-400 text-xs">
                      QR Code Unavailable
                    </div>
                  )}
                </div>
              </div>

              {/* Step 2: Manual Key Fallback */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-slate-400">
                  Or enter this secret key manually:
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-indigo-300 tracking-wider truncate select-all">
                    {secretKey}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopySecret}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? "Copied" : "Copy"}</span>
                  </button>
                </div>
              </div>

              {/* Step 3: Verify 6-digit code */}
              <form onSubmit={handleVerify} className="space-y-3 pt-2 border-t border-slate-800">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">2</span>
                  <span>Enter the 6-digit code from your app:</span>
                </div>

                <input
                  type="text"
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="123456"
                  autoFocus
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-center text-xl font-mono tracking-[0.5em] text-white focus:outline-none focus:border-indigo-500 placeholder:text-slate-600"
                />

                {errorMsg && (
                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={verifying || verificationCode.length !== 6}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 mt-2"
                >
                  {verifying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying Token...</span>
                    </>
                  ) : (
                    <>
                      <span>Activate Two-Factor Authentication</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

