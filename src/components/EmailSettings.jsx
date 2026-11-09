import { useState } from "react";
import { Mail, Server, ShieldCheck, Send, CheckCircle2, AlertCircle, Save, KeyRound } from "lucide-react";
import { supabase } from "../supabase";
import { sendEmailViaResend } from "../engine/emailDispatcher";

export default function EmailSettings({ orgConfig, onSaveEmailConfig }) {
  const [provider, setProvider] = useState(orgConfig?.email_provider || "resend"); // 'resend' | 'custom_smtp'
  
  // Resend Config
  const [resendApiKey, setResendApiKey] = useState(orgConfig?.resend_api_key || "");
  const [resendFrom, setResendFrom] = useState(orgConfig?.resend_from_email || "notifications@bizadoc.com");

  // Custom SMTP Config
  const [smtpHost, setSmtpHost] = useState(orgConfig?.smtp_host || "smtp.office365.com");
  const [smtpPort, setSmtpPort] = useState(orgConfig?.smtp_port || 587);
  const [smtpUser, setSmtpUser] = useState(orgConfig?.smtp_user || "");
  const [smtpPass, setSmtpPass] = useState(orgConfig?.smtp_pass || "");
  const [smtpFromName, setSmtpFromName] = useState(orgConfig?.smtp_from_name || "Company IT Support");
  const [smtpFromEmail, setSmtpFromEmail] = useState(orgConfig?.smtp_from_email || "");

  // Test Email state
  const [testEmailAddress, setTestEmailAddress] = useState(orgConfig?.support_email || "");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const config = {
      email_provider: provider,
      resend_api_key: resendApiKey.trim(),
      resend_from_email: resendFrom.trim(),
      smtp_host: smtpHost.trim(),
      smtp_port: Number(smtpPort) || 587,
      smtp_user: smtpUser.trim(),
      smtp_pass: smtpPass.trim(),
      smtp_from_name: smtpFromName.trim(),
      smtp_from_email: smtpFromEmail.trim()
    };

    if (onSaveEmailConfig) {
      await onSaveEmailConfig(config);
    }
    setSaving(false);
    setTestResult({ success: true, message: "Email settings saved successfully!" });
    setTimeout(() => setTestResult(null), 4000);
  };

  const handleSendTestEmail = async () => {
    if (!testEmailAddress.trim()) return;
    setTesting(true);
    setTestResult(null);

    const testSubject = `[TEST] HelpDeskIQ Email Server Verification (${provider.toUpperCase()})`;
    const testBody = `Hello,\n\nThis is a verification test from HelpDeskIQ.\n\nProvider: ${provider === "resend" ? "Resend API" : `Custom SMTP (${smtpHost}:${smtpPort})`}\nSender: ${provider === "resend" ? resendFrom : smtpFromEmail || smtpUser}\nTimestamp: ${new Date().toLocaleString()}\n\nIf you received this, your email delivery setup is configured properly!`;

    try {
      if (provider === "resend") {
        const result = await sendEmailViaResend({
          to: testEmailAddress.trim(),
          subject: testSubject,
          body: testBody,
          apiKey: resendApiKey,
          fromEmail: resendFrom,
          orgId: orgConfig?.id
        });

        if (result.success) {
          setTestResult({
            success: true,
            message: `Real email successfully delivered to ${testEmailAddress} via Resend! (Message ID: ${result.id})`
          });
        } else {
          setTestResult({
            success: false,
            message: `Resend dispatch failed: ${result.error}`
          });
        }
      } else {
        // Custom SMTP simulation & audit log
        await supabase.from("emails").insert({
          to_address: testEmailAddress.trim(),
          email_type: "test_verification",
          subject: testSubject,
          body: testBody,
          sent_at: Date.now()
        });
        setTestResult({
          success: true,
          message: `Custom SMTP test logged for ${testEmailAddress}! Connect your company SMTP relay to route out.`
        });
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: `Failed to dispatch test email: ${err.message}`
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Mail className="w-5 h-5 text-indigo-400" />
            Email Delivery & Server Integration
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure how HelpDeskIQ delivers ticket updates, escalation alerts, and resolution notices.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Provider Toggle Tabs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div
            onClick={() => setProvider("resend")}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              provider === "resend"
                ? "bg-indigo-950/20 border-indigo-500 shadow-md shadow-indigo-950"
                : "bg-slate-900 border-slate-800 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-xs text-white flex items-center gap-2">
                <Mail className="w-4 h-4 text-indigo-400" />
                Resend Delivery (Recommended)
              </span>
              <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full font-semibold">
                Default & Fast
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Best for testing, developer sandboxes, and trials. Zero server maintenance; delivers instantly via modern HTTP API.
            </p>
          </div>

          <div
            onClick={() => setProvider("custom_smtp")}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              provider === "custom_smtp"
                ? "bg-indigo-950/20 border-indigo-500 shadow-md shadow-indigo-950"
                : "bg-slate-900 border-slate-800 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-xs text-white flex items-center gap-2">
                <Server className="w-4 h-4 text-emerald-400" />
                Company Custom SMTP Server
              </span>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-semibold">
                Enterprise
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Connect your company Microsoft 365, Google Workspace, or on-premise Exchange server to send directly from your domain.
            </p>
          </div>
        </div>

        {/* Resend Configuration Fields */}
        {provider === "resend" && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
              Resend Configuration
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Resend API Key</label>
                <input
                  type="password"
                  placeholder="re_123456789_abcdef..."
                  value={resendApiKey}
                  onChange={(e) => setResendApiKey(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                />
                <p className="text-[11px] text-slate-500 mt-1">Get your free API key at <a href="https://resend.com" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">resend.com</a> (3,000 emails/mo free).</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">From Address</label>
                <input
                  type="email"
                  placeholder="notifications@bizadoc.com"
                  value={resendFrom}
                  onChange={(e) => setResendFrom(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                />
                <p className="text-[11px] text-slate-500 mt-1">Use a verified domain on Resend (or onboarding@resend.dev for test mode).</p>
              </div>
            </div>
          </div>
        )}

        {/* Custom SMTP Configuration Fields */}
        {provider === "custom_smtp" && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Server className="w-3.5 h-3.5 text-emerald-400" />
              Corporate SMTP Server Settings
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">SMTP Host / Server</label>
                <input
                  type="text"
                  placeholder="smtp.office365.com or smtp.gmail.com"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">SMTP Port</label>
                <input
                  type="number"
                  placeholder="587 (TLS) or 465 (SSL)"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">SMTP Username / Email</label>
                <input
                  type="text"
                  placeholder="it-support@company.com"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">SMTP Password / App Password</label>
                <input
                  type="password"
                  placeholder="••••••••••••••••"
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Sender Display Name</label>
                <input
                  type="text"
                  placeholder="e.g. Acme Global IT Helpdesk"
                  value={smtpFromName}
                  onChange={(e) => setSmtpFromName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Sender Email Address</label>
                <input
                  type="email"
                  placeholder="it-alerts@company.com"
                  value={smtpFromEmail}
                  onChange={(e) => setSmtpFromEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Live Test Email Tool */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Send className="w-3.5 h-3.5 text-amber-400" />
            Verify Delivery with Test Email
          </h3>
          <p className="text-[11px] text-slate-400">
            Send a sample verification message to ensure your credentials and server endpoints can deliver without errors.
          </p>

          <div className="flex flex-col sm:flex-row gap-2 max-w-lg">
            <input
              type="email"
              placeholder="Enter recipient email (e.g. your email)"
              value={testEmailAddress}
              onChange={(e) => setTestEmailAddress(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
            />
            <button
              type="button"
              disabled={testing || !testEmailAddress.trim()}
              onClick={handleSendTestEmail}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-40 text-xs px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              {testing ? "Sending..." : "Send Test Email"}
            </button>
          </div>

          {testResult && (
            <div className={`p-3 rounded-lg text-xs flex items-center gap-2 mt-2 ${
              testResult.success ? "bg-emerald-950/60 text-emerald-300 border border-emerald-900" : "bg-rose-950/60 text-rose-300 border border-rose-900"
            }`}>
              {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>

        {/* Submit Save */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs px-5 py-2.5 rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-indigo-950"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save Email Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}

