import { useState } from "react";
import { Monitor, X, ShieldCheck, Key, CheckCircle, Video, Globe, Laptop, ExternalLink } from "lucide-react";
import { getSystemDiagnostics } from "../engine/diagnosticSensor";

export default function RemoteSessionModal({ onClose, onConfirmSession, orgConfig }) {
  const diagnostics = getSystemDiagnostics();
  const detectedOS = diagnostics.os || "Unknown";
  const isWindows = detectedOS.toLowerCase().includes("win");

  // Default provider selected based on OS
  const [provider, setProvider] = useState(isWindows ? "quickassist" : "webshare");
  const [code, setCode] = useState("");
  const [consented, setConsented] = useState(false);
  const [status, setStatus] = useState("ready"); // 'ready', 'connected'

  const handleConnect = () => {
    if (!consented) return;
    setStatus("connected");
    if (onConfirmSession) {
      onConfirmSession({ 
        provider,
        code: code.trim(), 
        consented: true, 
        os: detectedOS,
        timestamp: Date.now() 
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Monitor className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="font-semibold text-slate-100 text-sm">Cross-Platform Remote Support</h3>
              <p className="text-[10px] text-slate-400">Detected Workstation: <strong className="text-indigo-300">{detectedOS}</strong></p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {status === "ready" ? (
            <>
              {/* Provider Tabs */}
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 mb-5 text-xs">
                <button
                  type="button"
                  onClick={() => setProvider("quickassist")}
                  className={`flex-1 py-1.5 px-2 rounded-lg font-medium flex items-center justify-center gap-1.5 transition-all ${
                    provider === "quickassist"
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-950"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Laptop className="w-3.5 h-3.5" />
                  Quick Assist (Win)
                </button>

                <button
                  type="button"
                  onClick={() => setProvider("rustdesk")}
                  className={`flex-1 py-1.5 px-2 rounded-lg font-medium flex items-center justify-center gap-1.5 transition-all ${
                    provider === "rustdesk"
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-950"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  AnyDesk / RustDesk
                </button>

                <button
                  type="button"
                  onClick={() => setProvider("webshare")}
                  className={`flex-1 py-1.5 px-2 rounded-lg font-medium flex items-center justify-center gap-1.5 transition-all ${
                    provider === "webshare"
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-950"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Video className="w-3.5 h-3.5" />
                  Meet / Teams Share
                </button>
              </div>

              {/* Security Shield Banner */}
              <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3.5 mb-5 flex gap-3 text-xs text-indigo-200 leading-relaxed">
                <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-indigo-300 font-semibold mb-0.5">Attended Remote Session</strong>
                  A technician will only see your screen with your explicit authorization. You can terminate the session at any second.
                </div>
              </div>

              {/* Provider Specific Instructions */}
              {provider === "quickassist" && (
                <div className="space-y-4 mb-6">
                  <div className="text-xs text-slate-300 space-y-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <div className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-slate-800 text-slate-300 text-[10px] flex items-center justify-center shrink-0">1</span>
                      <span>Press <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-200 font-mono text-[10px]">Ctrl + Win + Q</kbd> on your keyboard.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-slate-800 text-slate-300 text-[10px] flex items-center justify-center shrink-0">2</span>
                      <span>Click <strong>&quot;Get help&quot;</strong> and type the 6-digit code provided by your technician.</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                      6-Digit Security Code (From Technician):
                    </label>
                    <div className="relative">
                      <Key className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="text"
                        maxLength={7}
                        placeholder="e.g. 842-194"
                        value={code}
                        onChange={e => setCode(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-100 font-mono focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {provider === "rustdesk" && (
                <div className="space-y-4 mb-6">
                  <div className="text-xs text-slate-300 space-y-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <p className="text-slate-400">Works across <strong>macOS, Linux, and Windows</strong>.</p>
                    <p>Open AnyDesk or RustDesk and share your connection address or ID with the technician.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                      Your AnyDesk / RustDesk 9-Digit ID or Session Code:
                    </label>
                    <div className="relative">
                      <Monitor className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="text"
                        placeholder="e.g. 918 274 051"
                        value={code}
                        onChange={e => setCode(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-100 font-mono focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {provider === "webshare" && (
                <div className="space-y-4 mb-6">
                  <div className="text-xs text-slate-300 space-y-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <p className="text-slate-400">Zero-install screen sharing — works on any browser without downloads.</p>
                    <p>Paste the Google Meet, Teams, or Zoom link provided by your IT technician below.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                      Meeting or Screen Share URL:
                    </label>
                    <div className="relative">
                      <Globe className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="url"
                        placeholder="https://meet.google.com/abc-defg-hij"
                        value={code}
                        onChange={e => setCode(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 font-mono focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Consent Checkbox */}
              <label className="flex items-start gap-2.5 cursor-pointer pt-1 mb-5">
                <input
                  type="checkbox"
                  checked={consented}
                  onChange={e => setConsented(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs text-slate-300 leading-snug">
                  I authorize the IT Helpdesk to initiate an attended remote assistance session on this workstation.
                </span>
              </label>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs py-2.5 px-4 rounded-xl transition-colors border border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!consented || !code.trim()}
                  onClick={handleConnect}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white font-medium text-xs py-2.5 px-4 rounded-xl transition-all shadow-lg shadow-indigo-950"
                >
                  Confirm & Connect
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-6 space-y-4">
              <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-semibold text-slate-100">Remote Session Dispatched</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                Remote session request recorded for <strong className="text-indigo-300">{provider.toUpperCase()}</strong>.
                {provider === "webshare" && code.startsWith("http") ? (
                  <span className="block mt-2">
                    <a 
                      href={code} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="inline-flex items-center gap-1 text-indigo-400 hover:underline"
                    >
                      Join Meeting Now <ExternalLink className="w-3 h-3" />
                    </a>
                  </span>
                ) : (
                  " Please accept the connection prompt on your screen to begin screen sharing with the technician."
                )}
              </p>
              <button
                onClick={onClose}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs py-2.5 rounded-xl border border-slate-700"
              >
                Close Window
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
