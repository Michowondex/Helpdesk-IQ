import { useState } from "react";
import { X, CheckCircle2 } from "lucide-react";
import { supabase } from "../supabase";
import { sendDemoRequestNotification } from "../engine/emailDispatcher";

export default function DemoRequestModal({ isOpen, onClose }) {
  const [demoForm, setDemoForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    companyName: "",
    orgType: "enterprise",
    message: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSubmitting(true);

    try {
      const demoData = {
        full_name: demoForm.fullName.trim(),
        email: demoForm.email.trim().toLowerCase(),
        phone: demoForm.phone.trim(),
        company_name: demoForm.companyName.trim(),
        org_type: demoForm.orgType,
        message: demoForm.message.trim()
      };

      const { error: dbError } = await supabase
        .from("demo_requests")
        .insert(demoData);

      if (dbError) {
        console.warn("Could not save demo request:", dbError);
      }

      sendDemoRequestNotification(demoData).catch(err => {
        console.warn("Could not send demo notification:", err);
      });

      setSuccess(true);
    } catch (err) {
      setErrorMsg(err.message || "Failed to submit demo request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 relative text-slate-100">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {success ? (
          <div className="text-center py-6 space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-white">Demo Request Received!</h3>
            <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
              Thank you, <strong>{demoForm.fullName}</strong>. Our enterprise executive team has received your request and will reach out to <span className="text-indigo-400 font-mono">{demoForm.email}</span> within 24 hours.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center text-lg">
                🎯
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Schedule an Executive Demo</h3>
                <p className="text-[11px] text-slate-400">Experience BizaDesk tailored to your organization</p>
              </div>
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {errorMsg}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. David Adeleke"
                  value={demoForm.fullName}
                  onChange={e => setDemoForm(p => ({ ...p, fullName: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">Work Email *</label>
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={demoForm.email}
                  onChange={e => setDemoForm(p => ({ ...p, email: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">Company / Organization *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. First Bank"
                  value={demoForm.companyName}
                  onChange={e => setDemoForm(p => ({ ...p, companyName: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">Phone Number</label>
                <input
                  type="tel"
                  placeholder="+234 ..."
                  value={demoForm.phone}
                  onChange={e => setDemoForm(p => ({ ...p, phone: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">Operating Model *</label>
              <select
                value={demoForm.orgType}
                onChange={e => setDemoForm(p => ({ ...p, orgType: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="enterprise">🏦 Bank / Hospital / Enterprise (Internal Employee IT Support)</option>
                <option value="msp">🛠️ IT Service Company / MSP (Services for External Clients)</option>
                <option value="other">🏢 Other Organization</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">IT Requirements / Notes</label>
              <textarea
                rows={2}
                placeholder="Number of staff, main incident pain points, SLA targets..."
                value={demoForm.message}
                onChange={e => setDemoForm(p => ({ ...p, message: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none resize-none"
              />
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-950"
              >
                {submitting ? "Submitting..." : "Schedule My Demo →"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
