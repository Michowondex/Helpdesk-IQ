import { useState, useEffect } from "react";
import { 
  Settings, Phone, Mail, Clock, Upload, CheckCircle2, AlertCircle, 
  Save, LifeBuoy, Send, MessageSquare, Sparkles, X, ExternalLink, 
  Plus, BookOpen, Trash2, Tag, ListOrdered, FileText, ChevronDown, ChevronUp,
  Download, FileSpreadsheet, Globe, ToggleLeft, ToggleRight,
  ShieldCheck, Smartphone, KeyRound, ShieldAlert, Building2, Copy, Check, DollarSign,
  Crown, CreditCard, Users, Radio
} from "lucide-react";
import { supabase } from "../supabase";
import { sendEmailViaResend } from "../engine/emailDispatcher";
import MfaEnrollModal from "./MfaEnrollModal";

export default function CompanySettings({ 
  orgConfig, 
  onSaveConfig, 
  onUploadKb, 
  currentUser, 
  currentUserProfile,
  customArticles = [],
  onSaveArticle,
  onDeleteArticle
}) {
  const isMasterPlatformOrg = Boolean(
    orgConfig?.is_master_org || 
    orgConfig?.domain === "bizadoc.com" || 
    orgConfig?.support_email?.includes("bizadoc.com") || 
    currentUser?.email?.toLowerCase().endsWith("@bizadoc.com")
  );

  const [form, setForm] = useState({
    name: orgConfig?.name || "Primary Organization",
    support_phone: orgConfig?.support_phone || "+234 800 000 0000",
    support_email: orgConfig?.support_email || "it-support@company.com",
    allstaff_email: orgConfig?.allstaff_email || "all-staff@company.com",
    incident_manager_email: orgConfig?.incident_manager_email || "",
    support_chat_link: orgConfig?.support_chat_link || "",
    support_whatsapp: orgConfig?.support_whatsapp || "",
    incident_sla_minutes: orgConfig?.incident_sla_minutes || 10,
    ticket_sla_hours: orgConfig?.ticket_sla_hours || 1,
    work_start_hour: orgConfig?.work_start_hour !== undefined ? orgConfig.work_start_hour : 8,
    work_end_hour: orgConfig?.work_end_hour !== undefined ? orgConfig.work_end_hour : 18,
    work_days: orgConfig?.work_days || "1,2,3,4,5",
    vpn_gateway: orgConfig?.vpn_gateway || "vpn.company.com",
    enable_global_kb: isMasterPlatformOrg ? true : (orgConfig?.enable_global_kb === true),
    enforce_mfa: orgConfig?.enforce_mfa === true,
    portal_slug: orgConfig?.portal_slug || "",
    remote_fee: orgConfig?.remote_fee !== undefined ? orgConfig.remote_fee : 3500,
    physical_visit_fee: orgConfig?.physical_visit_fee !== undefined ? orgConfig.physical_visit_fee : 10000
  });

  const [copiedPortal, setCopiedPortal] = useState(false);
  const portalSlug = orgConfig?.portal_slug || (orgConfig?.domain ? orgConfig.domain.split(".")[0] : orgConfig?.id || "support");
  const portalUrl = typeof window !== "undefined" ? `${window.location.origin}/?portal=${portalSlug}` : "";

  const copyPortalUrl = () => {
    if (!portalUrl) return;
    navigator.clipboard.writeText(portalUrl);
    setCopiedPortal(true);
    setTimeout(() => setCopiedPortal(false), 2500);
  };

  // 2FA / MFA Management States
  const [showMfaEnroll, setShowMfaEnroll] = useState(false);
  const [mfaStatus, setMfaStatus] = useState("loading"); // 'enabled' | 'disabled' | 'loading'
  const [activeMfaFactor, setActiveMfaFactor] = useState(null);
  const [disablingMfa, setDisablingMfa] = useState(false);
  const [savingMfaPolicy, setSavingMfaPolicy] = useState(false);

  const checkMfaStatus = async () => {
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      const verified = data?.totp?.find(f => f.status === "verified");
      if (verified) {
        setMfaStatus("enabled");
        setActiveMfaFactor(verified);
      } else {
        setMfaStatus("disabled");
        setActiveMfaFactor(null);
      }
    } catch (_) {
      setMfaStatus("disabled");
    }
  };

  useEffect(() => {
    checkMfaStatus();
  }, []);

  const handleDisableMfa = async () => {
    if (!window.confirm("Are you sure you want to remove your authenticator device? You will no longer be prompted for 2FA on login.")) return;
    setDisablingMfa(true);
    try {
      const { data, error: listErr } = await supabase.auth.mfa.listFactors();
      if (listErr) throw listErr;
      const allTotp = data?.totp || [];
      const targetFactor = allTotp.find(f => f.status === "verified") || allTotp[0] || activeMfaFactor;

      if (targetFactor?.id) {
        let { error: unenrollErr } = await supabase.auth.mfa.unenroll({ factorId: targetFactor.id });

        if (unenrollErr) {
          // If unenroll requires AAL2 elevation, prompt user for their 6-digit code
          console.warn("Direct unenroll requires AAL2 elevation, prompting code:", unenrollErr.message);
          const code = window.prompt("To authorize removing 2FA, please enter the 6-digit code currently shown on your Microsoft/Google Authenticator app:");
          if (!code || !code.trim()) {
            alert("Unenroll cancelled: 6-digit security code was not provided.");
            setDisablingMfa(false);
            return;
          }

          const { error: verifyErr } = await supabase.auth.mfa.challengeAndVerify({
            factorId: targetFactor.id,
            code: code.trim()
          });
          if (verifyErr) {
            alert("Verification failed: " + verifyErr.message);
            setDisablingMfa(false);
            return;
          }

          // Session is now elevated to AAL2; unenroll the factor
          const { error: retryErr } = await supabase.auth.mfa.unenroll({ factorId: targetFactor.id });
          if (retryErr) {
            alert("Could not remove 2FA: " + retryErr.message);
            setDisablingMfa(false);
            return;
          }
        }
      }

      // Also clean up any lingering factors
      for (const f of allTotp) {
        if (f.id !== targetFactor?.id) {
          await supabase.auth.mfa.unenroll({ factorId: f.id }).catch(() => {});
        }
      }

      setActiveMfaFactor(null);
      setMfaStatus("disabled");
      alert("✅ Authenticator device removed successfully. 2FA is now disabled for your account.");
      await checkMfaStatus();
    } catch (err) {
      alert("Failed to unenroll 2FA: " + err.message);
    } finally {
      setDisablingMfa(false);
    }
  };

  const handleToggleEnforceMfa = async () => {
    const nextValue = !form.enforce_mfa;
    setForm(prev => ({ ...prev, enforce_mfa: nextValue }));
    setSavingMfaPolicy(true);
    try {
      if (onSaveConfig) {
        await onSaveConfig({ ...form, enforce_mfa: nextValue });
      }
    } catch (err) {
      console.warn("Could not auto-save MFA policy:", err);
    } finally {
      setSavingMfaPolicy(false);
    }
  };

  // Custom KB Article Direct Authoring States
  const [showAddArticleModal, setShowAddArticleModal] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [newArtTitle, setNewArtTitle] = useState("");
  const [newArtCategory, setNewArtCategory] = useState("Internal Applications");
  const [newArtKeywords, setNewArtKeywords] = useState("");
  const [newArtSteps, setNewArtSteps] = useState("");
  const [newArtEscalateTo, setNewArtEscalateTo] = useState("IT Support");
  const [savingArticle, setSavingArticle] = useState(false);

  // Platform Support Modal states
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [supportCategory, setSupportCategory] = useState("Technical & Integration Support");
  const [supportSubject, setSupportSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [sendingSupport, setSendingSupport] = useState(false);
  const [supportSuccess, setSupportSuccess] = useState(false);
  const [supportError, setSupportError] = useState("");

  // Keep form synchronized with Supabase database when orgConfig loads
  useEffect(() => {
    if (orgConfig) {
      setForm(prev => ({
        ...prev,
        name: orgConfig.name || prev.name,
        support_phone: orgConfig.support_phone || prev.support_phone,
        support_email: orgConfig.support_email || prev.support_email,
        allstaff_email: orgConfig.allstaff_email || prev.allstaff_email,
        incident_manager_email: orgConfig.incident_manager_email !== undefined ? orgConfig.incident_manager_email : prev.incident_manager_email,
        support_chat_link: orgConfig.support_chat_link !== undefined ? orgConfig.support_chat_link : prev.support_chat_link,
        support_whatsapp: orgConfig.support_whatsapp !== undefined ? orgConfig.support_whatsapp : prev.support_whatsapp,
        incident_sla_minutes: orgConfig.incident_sla_minutes || prev.incident_sla_minutes,
        ticket_sla_hours: orgConfig.ticket_sla_hours || prev.ticket_sla_hours,
        work_start_hour: orgConfig.work_start_hour !== undefined ? orgConfig.work_start_hour : prev.work_start_hour,
        work_end_hour: orgConfig.work_end_hour !== undefined ? orgConfig.work_end_hour : prev.work_end_hour,
        work_days: orgConfig.work_days || prev.work_days,
        vpn_gateway: orgConfig.vpn_gateway || prev.vpn_gateway,
        enable_global_kb: isMasterPlatformOrg ? true : (orgConfig.enable_global_kb !== undefined ? orgConfig.enable_global_kb : prev.enable_global_kb),
        enforce_mfa: orgConfig.enforce_mfa !== undefined ? orgConfig.enforce_mfa : prev.enforce_mfa,
        portal_slug: orgConfig.portal_slug !== undefined ? orgConfig.portal_slug : prev.portal_slug,
        remote_fee: orgConfig.remote_fee !== undefined ? orgConfig.remote_fee : prev.remote_fee,
        physical_visit_fee: orgConfig.physical_visit_fee !== undefined ? orgConfig.physical_visit_fee : prev.physical_visit_fee
      }));
    }
  }, [orgConfig]);

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [kbFileStatus, setKbFileStatus] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSaveConfig(form);
    setSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleSendSupportRequest = async (e) => {
    e.preventDefault();
    if (!supportMessage.trim()) return;
    setSendingSupport(true);
    setSupportError("");
    setSupportSuccess(false);

    const senderEmail = currentUser?.email || orgConfig?.support_email || "admin@customer.com";
    const senderName = currentUserProfile?.full_name || form.name || "Customer Admin";
    const platformOwnerEmail = "helpdesk@bizadoc.com";

    const emailSubject = `[BizaDesk Platform Inquiry] ${supportCategory}: ${supportSubject || "Assistance Request"}`;
    const emailBody = `A tenant organization administrator has reached out for platform support:\n\n` +
      `Organization: ${form.name} (ID: ${orgConfig?.id || "N/A"})\n` +
      `Admin Name: ${senderName}\n` +
      `Contact Email: ${senderEmail}\n` +
      `Category: ${supportCategory}\n` +
      `Timestamp: ${new Date().toLocaleString()}\n\n` +
      `--- INQUIRY MESSAGE ---\n` +
      `${supportMessage}\n\n` +
      `Please reply directly to ${senderEmail}.`;

    try {
      const res = await sendEmailViaResend({
        to: platformOwnerEmail,
        subject: emailSubject,
        body: emailBody,
        orgId: orgConfig?.id
      });

      if (!res.success && res.error && !res.error.includes("sandbox")) {
        throw new Error(res.error);
      }

      setSupportSuccess(true);
      setSupportSubject("");
      setSupportMessage("");
    } catch (err) {
      setSupportError(err.message || "Failed to deliver support request. Please try direct email.");
    } finally {
      setSendingSupport(false);
    }
  };

  const handleDirectAddArticle = async (e) => {
    e.preventDefault();
    if (!newArtTitle.trim() || !newArtSteps.trim()) return;
    setSavingArticle(true);

    const stepsArray = newArtSteps
      .split("\n")
      .map(s => s.trim())
      .filter(Boolean);

    const keywordsArray = newArtKeywords
      .split(",")
      .map(k => k.trim())
      .filter(Boolean);

    if (onSaveArticle) {
      await onSaveArticle({
        title: newArtTitle.trim(),
        category: newArtCategory,
        keywords: keywordsArray,
        steps: stepsArray,
        escalate_to: newArtEscalateTo
      });
    }

    setSavingArticle(false);
    setShowAddArticleModal(false);
    setNewArtTitle("");
    setNewArtKeywords("");
    setNewArtSteps("");
  };

  // Sanitizes text from formula injection (=, +, -, @) and trims
  const sanitizeText = (txt) => {
    if (!txt) return "";
    let clean = String(txt).trim();
    if (/^[=+\-@\t\r]/.test(clean)) {
      clean = clean.replace(/^[=+\-@\t\r]+/, "");
    }
    return clean;
  };

  // Parses a single CSV line handling quotes and commas cleanly
  const parseCSVLine = (line) => {
    const result = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  const handleDownloadSampleCSV = () => {
    const sampleHeaders = "Title,Category,Keywords,Steps,EscalateTo\n";
    const sampleRow1 = '"Connect to Corporate VPN","VPN & Remote Access","vpn, cisco, anyconnect, remote","1. Open Cisco AnyConnect from the Windows taskbar.\n2. Enter vpn.company.com as the server.\n3. Type your corporate email and password.\n4. Approve the 2FA push on your phone.","Network Team"\n';
    const sampleRow2 = '"Access Internal ERP Portal","Internal Applications","erp, sap, finance, portal","1. Navigate to https://erp.company.internal in Chrome.\n2. Log in using Single Sign-On (SSO).\n3. Clear cache if you encounter session timeout.","Database Team"\n';
    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(sampleHeaders + sampleRow1 + sampleRow2);
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", "helpdeskiq_knowledge_base_sample.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Hard Limit: Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      setKbFileStatus("Error: File exceeds 5 MB limit. Please upload a smaller file.");
      return;
    }

    const fileName = file.name.toLowerCase();
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const rawContent = event.target.result;
        let parsedArticles = [];

        if (fileName.endsWith(".json")) {
          const json = JSON.parse(rawContent);
          const list = Array.isArray(json) ? json : json.articles;
          if (!list || !list.length) throw new Error("No articles array found in JSON file.");
          parsedArticles = list.map(a => ({
            title: sanitizeText(a.title),
            category: sanitizeText(a.category || "General"),
            keywords: Array.isArray(a.keywords) ? a.keywords.map(sanitizeText) : (a.keywords || "").split(",").map(sanitizeText).filter(Boolean),
            steps: Array.isArray(a.steps) ? a.steps.map(sanitizeText) : (a.steps || "").split("\n").map(sanitizeText).filter(Boolean),
            escalateTo: sanitizeText(a.escalateTo || a.escalate_to || "Service Desk")
          }));
        } else if (fileName.endsWith(".csv")) {
          const lines = rawContent.split(/\r?\n/).filter(l => l.trim().length > 0);
          if (lines.length < 2) throw new Error("CSV file must have a header row and at least one data row.");
          
          // Data rows (skip header)
          for (let i = 1; i < lines.length; i++) {
            const cols = parseCSVLine(lines[i]);
            if (cols.length >= 2 && cols[0].trim()) {
              const title = sanitizeText(cols[0]);
              const category = sanitizeText(cols[1] || "General IT");
              const keywords = (cols[2] || "").split(";").flatMap(k => k.split(",")).map(sanitizeText).filter(Boolean);
              const stepsRaw = cols[3] || "";
              const steps = stepsRaw.split(/\\n|\n|;/).map(sanitizeText).filter(Boolean);
              const escalateTo = sanitizeText(cols[4] || "IT Support");

              parsedArticles.push({
                title,
                category,
                keywords,
                steps: steps.length > 0 ? steps : ["Follow standard internal operating procedures."],
                escalateTo
              });
            }
          }
        } else if (fileName.endsWith(".txt") || fileName.endsWith(".md")) {
          // Parse Markdown / Text files: Lines starting with # or ## represent article titles
          const blocks = rawContent.split(/\n(?=#{1,3}\s+)/);
          for (const block of blocks) {
            const lines = block.split(/\r?\n/).filter(l => l.trim().length > 0);
            if (lines.length > 0) {
              const titleLine = lines[0].replace(/^#{1,3}\s+/, "").trim();
              if (titleLine) {
                const stepLines = lines.slice(1).map(l => l.replace(/^[-*•\d.]+\s*/, "")).map(sanitizeText).filter(Boolean);
                parsedArticles.push({
                  title: sanitizeText(titleLine),
                  category: "General IT",
                  keywords: [titleLine.toLowerCase()],
                  steps: stepLines.length > 0 ? stepLines : ["Follow standard instructions."],
                  escalateTo: "Service Desk"
                });
              }
            }
          }
          if (parsedArticles.length === 0 && rawContent.trim()) {
            // Single article fallback from TXT
            const lines = rawContent.split(/\r?\n/).filter(l => l.trim().length > 0);
            parsedArticles.push({
              title: sanitizeText(file.name.replace(/\.[^/.]+$/, "")),
              category: "General IT",
              keywords: ["sop", "guide"],
              steps: lines.map(sanitizeText),
              escalateTo: "Service Desk"
            });
          }
        } else {
          throw new Error("Unsupported format. Please upload a .CSV, .TXT, .MD, or .JSON file.");
        }

        // Hard Limit: Max 200 articles per upload
        if (parsedArticles.length > 200) {
          throw new Error(`File contains ${parsedArticles.length} articles. Maximum allowed per upload is 200.`);
        }

        if (parsedArticles.length === 0) {
          throw new Error("No readable troubleshooting articles could be parsed from the file.");
        }

        if (onUploadKb) onUploadKb(parsedArticles);
        setKbFileStatus(`✅ Successfully imported and saved ${parsedArticles.length} custom articles!`);
      } catch (err) {
        setKbFileStatus(`Error parsing file: ${err.message}`);
      }
    };

    reader.readAsText(file);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Title */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-400" />
            Company Profile & Support Settings
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure your internal IT hotline, support routing, dynamic SLA timers, and custom knowledge base.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Option B: Platform Master Workspace Control Card (ONLY for Master Org / bizadoc.com owner) ── */}
        {orgConfig?.is_master_org && (
          <div className="bg-gradient-to-br from-amber-950/30 via-slate-900 to-indigo-950/20 border-2 border-amber-500/40 rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-amber-500/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                  <Crown className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white tracking-tight">Platform Master Workspace</h3>
                    <span className="text-[10px] font-extrabold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/40 uppercase tracking-wider">
                      Option B Platform Control
                    </span>
                  </div>
                  <p className="text-xs text-amber-200/80 mt-0.5">
                    Settings configured here broadcast across all public individual accounts registered on BizaDesk.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-slate-950/80 border border-amber-500/30 rounded-lg px-3 py-1.5 self-start sm:self-auto">
                <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span className="text-[11px] font-mono text-emerald-400 font-semibold">Broadcasting Live</span>
              </div>
            </div>

            {/* Paystack Gateway & Inheritance Status Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">Paystack Gateway</span>
                  <span className="text-xs font-bold text-emerald-400">Active (Live Cards &amp; NGN)</span>
                </div>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">Public Individual Users</span>
                  <span className="text-xs font-bold text-indigo-300">Linked to this Master Org</span>
                </div>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">Commercial Businesses</span>
                  <span className="text-xs font-bold text-cyan-300">Isolated (Independent)</span>
                </div>
              </div>
            </div>

            {/* Platform Broadcast Channels */}
            <div className="bg-slate-950/80 border border-amber-500/20 rounded-xl p-4 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                <Phone className="w-3.5 h-3.5" />
                Public Individual Support Channels (Auto-Broadcasted)
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                When any public individual clicks &quot;Call IT&quot;, &quot;WhatsApp&quot;, or initiates checkout, these channels and numbers are presented.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Master IT Hotline / Phone
                  </label>
                  <input
                    type="text"
                    value={form.support_phone}
                    onChange={e => setForm({ ...form, support_phone: e.target.value })}
                    placeholder="+234 916 202 9201"
                    className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Master WhatsApp Number / Link
                  </label>
                  <input
                    type="text"
                    value={form.support_whatsapp}
                    onChange={e => setForm({ ...form, support_whatsapp: e.target.value })}
                    placeholder="+2349162029201"
                    className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Master Helpdesk Email
                  </label>
                  <input
                    type="email"
                    value={form.support_email}
                    onChange={e => setForm({ ...form, support_email: e.target.value })}
                    placeholder="helpdesk@bizadoc.com"
                    className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Platform Paystack Pricing Engine */}
            <div className="bg-slate-950/80 border border-amber-500/20 rounded-xl p-4 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                <DollarSign className="w-3.5 h-3.5" />
                Public Individual Paystack Pricing Engine
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                These rates power the Paystack inline checkout modal for all public individual users who require remote screen assistance or physical technician dispatch.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Remote Diagnostics &amp; Guided Fix Fee (₦)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.remote_fee}
                    onChange={e => setForm({ ...form, remote_fee: Number(e.target.value) })}
                    placeholder="3500"
                    className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-white font-mono font-bold focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">Standard public fee: ₦3,500</span>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Physical On-Site Visit Baseline Fee (₦)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.physical_visit_fee}
                    onChange={e => setForm({ ...form, physical_visit_fee: Number(e.target.value) })}
                    placeholder="10000"
                    className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-white font-mono font-bold focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">Standard public baseline: ₦10,000 (auto-scaled by region)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Internal Enterprise IT Mode: Strictly for Enterprise Organizations ── */}
        {orgConfig?.workspace_mode === "ENTERPRISE" && (
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-start gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Internal Enterprise IT Mode</h3>
                <span className="text-[10px] font-bold bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20">
                  STAFF SELF-SERVICE
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                This organization is configured for internal employee support. All ticket submissions, Virtual IT AI assistance, and on-site office dispatches are 100% free for your company staff with zero payment barriers.
              </p>
            </div>
          </div>
        )}

        {/* ── Dedicated Client Support Portal & Client Service Pricing: Strictly for Non-Master Commercial MSPs ── */}
        {orgConfig?.workspace_mode === "COMMERCIAL" && !orgConfig?.is_master_org && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Dedicated Client Support Portal</h3>
                  <p className="text-[11px] text-slate-400">Share this link with your customers to provide 24/7 branded Virtual IT Support</p>
                </div>
              </div>
              <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded border border-emerald-500/20">
                COMMERCIAL MSP
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Your Public Client Portal URL</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 font-mono text-xs text-indigo-300 select-all truncate">
                  {portalUrl}
                </div>
                <button
                  type="button"
                  onClick={copyPortalUrl}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
                >
                  {copiedPortal ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedPortal ? "Copied!" : "Copy Link"}</span>
                </button>
                <a
                  href={portalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs px-3 py-2 rounded-lg transition-colors flex items-center gap-1 shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Preview</span>
                </a>
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">
                Embed this URL on your company website, in client email signatures, or send to customers via WhatsApp.
              </p>
            </div>

            <div className="pt-2 border-t border-slate-800/80">
              <h4 className="text-xs font-bold text-slate-200 mb-2.5 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                Client Service Pricing (What your clients pay)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Remote Support Session Fee (₦)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.remote_fee}
                    onChange={e => setForm({ ...form, remote_fee: Number(e.target.value) })}
                    placeholder="3500"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500">Standard platform baseline: ₦3,500</span>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Physical On-Site Visit Fee (₦)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.physical_visit_fee}
                    onChange={e => setForm({ ...form, physical_visit_fee: Number(e.target.value) })}
                    placeholder="10000"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500">Standard platform baseline: ₦10,000</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Support Contacts Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Phone className="w-4 h-4 text-emerald-400" />
            Support Contact Information
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Company / Organization Name</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">IT Helpdesk Hotline / Phone</label>
              <input
                type="text"
                value={form.support_phone}
                onChange={e => setForm({ ...form, support_phone: e.target.value })}
                placeholder="+234 800 123 4567 or Ext 101"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">IT Support Email (Tickets Reply-To)</label>
              <input
                type="email"
                value={form.support_email}
                onChange={e => setForm({ ...form, support_email: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">All-Staff Escalation Broadcast Email</label>
              <input
                type="email"
                value={form.allstaff_email}
                onChange={e => setForm({ ...form, allstaff_email: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Central Incident Escalation Manager Email <span className="text-slate-500 font-normal">(Tier 2 15-min Incident Command)</span>
              </label>
              <input
                type="email"
                placeholder="incident-manager@company.com (defaults to support email)"
                value={form.incident_manager_email || ""}
                onChange={e => setForm({ ...form, incident_manager_email: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
              />
              <p className="text-[11px] text-slate-500 mt-1">This duty manager receives all Tier 2 incident escalations across the entire workspace.</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Internal Teams / Slack / Chat Link <span className="text-slate-500 font-normal">(Optional for Staff Call IT)</span>
              </label>
              <input
                type="url"
                value={form.support_chat_link}
                onChange={e => setForm({ ...form, support_chat_link: e.target.value })}
                placeholder="https://teams.microsoft.com/l/chat/... or Slack link"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Internal Company IT WhatsApp Number or Link <span className="text-slate-500 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={form.support_whatsapp}
                onChange={e => setForm({ ...form, support_whatsapp: e.target.value })}
                placeholder="+2348012345678 or https://wa.me/234..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* SLA Timers Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            Custom SLA & Auto-Escalation Timers
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-medium text-slate-300">Incident All-Staff Notice:</span>
                <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  {form.incident_sla_minutes} Minutes
                </span>
              </div>
              <input
                type="range"
                min="5"
                max="60"
                step="5"
                value={form.incident_sla_minutes}
                onChange={e => setForm({ ...form, incident_sla_minutes: Number(e.target.value) })}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <p className="text-[11px] text-slate-500 mt-2">
                Trigger company-wide urgent broadcast email if a critical incident stays unacknowledged.
              </p>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-medium text-slate-300">Ticket SLA Breach Threshold:</span>
                <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                  {form.ticket_sla_hours} Hour(s)
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="24"
                step="1"
                value={form.ticket_sla_hours}
                onChange={e => setForm({ ...form, ticket_sla_hours: Number(e.target.value) })}
                className="w-full accent-indigo-500 cursor-pointer"
              />
              <p className="text-[11px] text-slate-500 mt-2">
                Mark open tickets with red SLA Breached badge and alert managers if unresolved.
              </p>
            </div>
          </div>

          {/* Business Operating Hours & SLA Auto-Pause */}
          <div className="mt-4 pt-4 border-t border-slate-800/80">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-semibold text-slate-200">Business Hours &amp; Automatic SLA Pause</h4>
            </div>
            <p className="text-[11px] text-slate-400 mb-3">
              Configure operating hours. Ticket SLA timers will automatically <strong>pause outside these hours</strong> and over weekends, preventing false SLA breaches overnight.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950/60 border border-slate-800/80 rounded-lg p-3.5">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1.5">
                  Business Day Starts At:
                </label>
                <select
                  value={form.work_start_hour}
                  onChange={(e) => setForm({ ...form, work_start_hour: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value={6}>06:00 AM</option>
                  <option value={7}>07:00 AM</option>
                  <option value={8}>08:00 AM (Default)</option>
                  <option value={9}>09:00 AM</option>
                  <option value={10}>10:00 AM</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1.5">
                  Business Day Closes At:
                </label>
                <select
                  value={form.work_end_hour}
                  onChange={(e) => setForm({ ...form, work_end_hour: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value={16}>04:00 PM (16:00)</option>
                  <option value={17}>05:00 PM (17:00)</option>
                  <option value={18}>06:00 PM (18:00 - Default)</option>
                  <option value={19}>07:00 PM (19:00)</option>
                  <option value={20}>08:00 PM (20:00)</option>
                  <option value={21}>09:00 PM (21:00)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ── Security & Multi-Factor Authentication (MFA / 2FA) ── */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-100 text-sm">Security &amp; Multi-Factor Authentication (2FA)</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Protect your corporate IT workspace with time-based one-time passwords (TOTP) compatible with Microsoft and Google Authenticator.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* My Personal 2FA Status */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-200">My Authenticator Status</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                    mfaStatus === "enabled"
                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                      : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                  }`}>
                    {mfaStatus === "enabled" ? "Active (2FA Protected)" : "Not Configured"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {mfaStatus === "enabled"
                    ? "Your account is protected by an authenticator device. A 6-digit code is required on every login."
                    : "Add Microsoft or Google Authenticator to protect your login with a 6-digit security code."}
                </p>
              </div>

              <div className="pt-2 flex items-center gap-2 flex-wrap">
                {mfaStatus === "enabled" ? (
                  <>
                    <button
                      type="button"
                      onClick={handleDisableMfa}
                      disabled={disablingMfa}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/10 hover:border-rose-500/40 hover:text-rose-300 disabled:opacity-50 text-slate-300 text-xs font-medium border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>{disablingMfa ? "Removing..." : "Remove Authenticator"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowMfaEnroll(true)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>Scan New QR Code</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowMfaEnroll(true)}
                    className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Setup Authenticator App (QR Code)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Workspace-Wide Policy (Admin Only) */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-200">Company-Wide Policy</span>
                  <span className="text-[10px] font-semibold text-slate-500">ISO 27001 / PCI-DSS</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Require all staff members and technicians across your organization to enroll an authenticator app upon login.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-300">Enforce 2FA for All Members</span>
                  {savingMfaPolicy && <span className="text-[10px] text-indigo-400 animate-pulse">Saving...</span>}
                </div>
                <button
                  type="button"
                  onClick={handleToggleEnforceMfa}
                  disabled={savingMfaPolicy}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 border transition-all cursor-pointer ${
                    form.enforce_mfa 
                      ? "bg-indigo-600/20 text-indigo-300 border-indigo-500/50 hover:bg-indigo-600/30"
                      : "bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200"
                  }`}
                  title={form.enforce_mfa ? "Click to disable company-wide MFA enforcement" : "Click to enforce 2FA for all staff members"}
                >
                  {form.enforce_mfa ? (
                    <>
                      <ToggleRight className="w-5 h-5 text-indigo-400 shrink-0" />
                      <span>Enforced (ON)</span>
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="w-5 h-5 text-slate-500 shrink-0" />
                      <span>Disabled (OFF)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Organization Troubleshooting Knowledge Base Manager ── */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          
          {/* Global Baseline Toggle Banner */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${form.enable_global_kb ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400" : "bg-slate-800/60 border-slate-700 text-slate-500"}`}>
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-200">Include 36 Global Baseline IT Articles</span>
                  {isMasterPlatformOrg ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider border bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
                      Master Platform Core (Always Active)
                    </span>
                  ) : (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider border ${form.enable_global_kb ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"}`}>
                      {form.enable_global_kb ? "Enabled" : "Strict Tenant Mode"}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {isMasterPlatformOrg
                    ? "As the Master Platform Workspace, all 36 global IT support guides and custom articles are permanently active for your technicians and linked clients."
                    : form.enable_global_kb 
                      ? "Virtual Assistant checks custom articles first, then falls back to 36 standard IT guides." 
                      : "Strict Mode Active: Virtual Assistant will strictly match your company's custom articles only."}
                </p>
              </div>
            </div>
            {isMasterPlatformOrg ? (
              <span className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border bg-indigo-600/20 border-indigo-500/40 text-indigo-300 self-start sm:self-auto">
                <ToggleRight className="w-4 h-4 text-indigo-400" /> Always Active
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, enable_global_kb: !prev.enable_global_kb }))}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all self-start sm:self-auto border ${form.enable_global_kb ? "bg-indigo-600/20 border-indigo-500/40 text-indigo-300 hover:bg-indigo-600/30" : "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"}`}
              >
                {form.enable_global_kb ? (
                  <><ToggleRight className="w-4 h-4 text-indigo-400" /> Active</>
                ) : (
                  <><ToggleLeft className="w-4 h-4 text-slate-500" /> Disabled</>
                )}
              </button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-cyan-400" />
                  Custom Troubleshooting Knowledge Base
                </h3>
                <span className="text-[10px] font-bold text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                  {customArticles.length} Tenant Articles Active
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Company-specific guides (e.g. internal VPN, ERP, printers) take <strong className="text-slate-200">top priority</strong> over the 36 global baseline articles.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowBulkUpload(prev => !prev)}
                className="text-[11px] text-slate-300 hover:text-white border border-slate-700 hover:bg-slate-800 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors font-medium"
              >
                <Upload className="w-3.5 h-3.5 text-cyan-400" />
                {showBulkUpload ? "Hide File Import" : "Import Document (CSV / TXT / MD / JSON)"}
              </button>
              <button
                type="button"
                onClick={() => setShowAddArticleModal(true)}
                className="bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-md shadow-cyan-950 transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> Add Custom Article
              </button>
            </div>
          </div>

          {/* Bulk Document Upload Drawer (Collapsible) */}
          {showBulkUpload && (
            <div className="border border-dashed border-slate-700 bg-slate-950/80 rounded-xl p-5 text-center space-y-3 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-100 font-semibold">Universal Knowledge Base File Importer</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Import company runbooks and standard operating procedures directly into the AI triage engine.
                </p>
                
                {/* Accepted format pills */}
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2 pb-1">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-emerald-300">
                    .CSV (Excel / Sheets)
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-300">
                    .MD (Markdown)
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-indigo-300">
                    .TXT (Plain Text)
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-amber-300">
                    .JSON (Raw Schema)
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
                <input
                  type="file"
                  accept=".csv,.txt,.md,.json"
                  onChange={handleFileUpload}
                  className="text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-cyan-600 file:text-white hover:file:bg-cyan-500 cursor-pointer"
                />
                <button
                  type="button"
                  onClick={handleDownloadSampleCSV}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1.5 bg-cyan-950/40 border border-cyan-500/30 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-400" /> Download Sample CSV Template
                </button>
              </div>

              {/* Visual Schema Blueprint Guide Table */}
              <div className="mt-4 pt-4 border-t border-slate-800/80 text-left">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-2">
                  <FileText className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Column Blueprint &amp; Escalation Mapping Guide</span>
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-800">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-900 text-slate-400 font-mono text-[10px] uppercase border-b border-slate-800">
                      <tr>
                        <th className="py-1.5 px-3">Column Header</th>
                        <th className="py-1.5 px-3">Purpose &amp; AI Behavior</th>
                        <th className="py-1.5 px-3">Example Input</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-sans text-slate-300 bg-slate-950/60">
                      <tr>
                        <td className="py-1.5 px-3 font-mono font-semibold text-cyan-300">Title</td>
                        <td className="py-1.5 px-3 text-slate-400">Heading displayed to the employee during triage</td>
                        <td className="py-1.5 px-3 text-slate-200">Connect to Corporate Cisco VPN</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3 font-mono font-semibold text-cyan-300">Category</td>
                        <td className="py-1.5 px-3 text-slate-400">Classifies the article into quick-access UI chips</td>
                        <td className="py-1.5 px-3 text-slate-200">VPN &amp; Remote Access</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3 font-mono font-semibold text-cyan-300">Keywords</td>
                        <td className="py-1.5 px-3 text-slate-400"><strong className="text-amber-400">Search Triggers:</strong> Words user speaks/types to match</td>
                        <td className="py-1.5 px-3 text-slate-200">vpn, anyconnect, remote, token</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3 font-mono font-semibold text-cyan-300">Steps</td>
                        <td className="py-1.5 px-3 text-slate-400">Interactive numbered action steps for user to follow</td>
                        <td className="py-1.5 px-3 text-slate-200">1. Open AnyConnect. 2. Enter server...</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3 font-mono font-semibold text-emerald-400">EscalateTo</td>
                        <td className="py-1.5 px-3 text-slate-400"><strong className="text-emerald-400">Target Team:</strong> Auto-routes ticket here if steps fail</td>
                        <td className="py-1.5 px-3 text-emerald-300 font-semibold">Network Team</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {kbFileStatus && (
                <div className={`p-2.5 rounded-lg text-xs flex items-center justify-center gap-2 max-w-md mx-auto ${kbFileStatus.includes("Error") ? "bg-rose-950/60 text-rose-300 border border-rose-900" : "bg-emerald-950/60 text-emerald-300 border border-emerald-900"}`}>
                  {kbFileStatus.includes("Error") ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                  <span>{kbFileStatus}</span>
                </div>
              )}
            </div>
          )}

          {/* Active Tenant Knowledge Articles List */}
          <div className="border border-slate-800 rounded-lg overflow-hidden">
            {customArticles.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/50">
                <BookOpen className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs font-medium text-slate-300">No custom articles registered yet</p>
                <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                  {form.enable_global_kb 
                    ? "Currently falling back to the 36 global IT support baseline articles. Add custom company articles to override them." 
                    : "Strict Mode Active: Virtual Assistant will only route tickets until company articles are added. Click 'Add Custom Article' or toggle global baseline ON above."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80 bg-slate-950/40 max-h-72 overflow-y-auto">
                {customArticles.map((art, idx) => {
                  const stepCount = Array.isArray(art.steps) ? art.steps.length : 0;
                  return (
                    <div key={art.id || art.article_id || idx} className="p-3.5 flex items-start justify-between gap-3 hover:bg-slate-800/30 transition-colors">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-slate-200 truncate">{art.title}</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 shrink-0">
                            {art.category || "General"}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                          <span className="flex items-center gap-1 text-cyan-400 font-mono">
                            <ListOrdered className="w-3 h-3" /> {stepCount} action steps
                          </span>
                          {art.keywords && art.keywords.length > 0 && (
                            <span className="flex items-center gap-1 text-slate-500 truncate max-w-xs">
                              <Tag className="w-3 h-3 shrink-0" />
                              {Array.isArray(art.keywords) ? art.keywords.slice(0, 4).join(", ") : art.keywords}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Remove custom article "${art.title}"?`)) {
                            if (onDeleteArticle) onDeleteArticle(art.id || art.article_id);
                          }
                        }}
                        className="text-slate-500 hover:text-rose-400 p-1.5 rounded hover:bg-slate-800 transition-colors shrink-0"
                        title="Delete Article"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {saveSuccess && (
            <span className="text-xs text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              Settings saved successfully!
            </span>
          )}
          <button
            type="submit"
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs px-5 py-2.5 rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-indigo-950"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </form>

      {/* ── BizaDesk Platform Support & Concierge Card ── */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 border border-indigo-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/30 mt-0.5">
              <LifeBuoy className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">BizaDesk Platform Support &amp; Concierge</h3>
                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Tenant SLA
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">
                Need architectural guidance, a custom enterprise plan, or having a platform issue? Our engineering team is directly available for organization owners.
              </p>
              <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-slate-300">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Mail className="w-3.5 h-3.5 text-indigo-400" /> helpdesk@bizadoc.com
                </span>
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" /> Average response: &lt; 2 hours
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowSupportModal(true);
              setSupportSuccess(false);
              setSupportError("");
            }}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-950 flex items-center gap-2 transition-all self-start sm:self-auto shrink-0"
          >
            <MessageSquare className="w-3.5 h-3.5" /> Contact Platform Support
          </button>
        </div>
      </div>

      {/* ── Modal: Add Custom Article ── */}
      {showAddArticleModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg p-6 relative">
            <button
              onClick={() => setShowAddArticleModal(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-800">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Create Custom Troubleshooting Guide</h3>
                <p className="text-[11px] text-slate-400">This article will be prioritized by the Virtual IT Assistant</p>
              </div>
            </div>

            <form onSubmit={handleDirectAddArticle} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Article Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. How to Connect to Headquarters Cisco AnyConnect VPN"
                  value={newArtTitle}
                  onChange={(e) => setNewArtTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Category</label>
                  <select
                    value={newArtCategory}
                    onChange={(e) => setNewArtCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="VPN & Remote Access">VPN &amp; Remote Access</option>
                    <option value="Internal Applications">Internal Applications / ERP</option>
                    <option value="Office Hardware & Printers">Printers &amp; Office Devices</option>
                    <option value="Email & Collaboration">Email &amp; Slack/Teams</option>
                    <option value="Account & Security">Access &amp; Multi-Factor Auth</option>
                    <option value="General IT">General Workplace IT</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Escalate To (Team)</label>
                  <input
                    type="text"
                    placeholder="e.g. Network Team"
                    value={newArtEscalateTo}
                    onChange={(e) => setNewArtEscalateTo(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Search Keywords <span className="text-[10px] text-slate-500 font-normal">(Comma separated)</span>
                </label>
                <input
                  type="text"
                  placeholder="vpn, anyconnect, remote, token, certificate"
                  value={newArtKeywords}
                  onChange={(e) => setNewArtKeywords(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Step-by-Step Instructions * <span className="text-[10px] text-slate-500 font-normal">(Enter each step on a new line)</span>
                </label>
                <textarea
                  required
                  rows={5}
                  placeholder={"1. Open Cisco AnyConnect from the Windows taskbar.\n2. In the gateway field, enter vpn.company.com.\n3. Enter your corporate email and Active Directory password.\n4. Approve the Push request on your Microsoft Authenticator mobile app."}
                  value={newArtSteps}
                  onChange={(e) => setNewArtSteps(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono focus:border-cyan-500 focus:outline-none leading-relaxed"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddArticleModal(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-2.5 rounded-xl border border-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingArticle}
                  className="flex-1 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-medium text-xs py-2.5 rounded-xl shadow-lg shadow-cyan-950 flex items-center justify-center gap-2 transition-all"
                >
                  {savingArticle ? "Saving..." : <><Save className="w-3.5 h-3.5" /> Save to Knowledge Base</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Contact Platform Support ── */}
      {showSupportModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg p-6 relative">
            <button
              onClick={() => setShowSupportModal(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-800">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                <LifeBuoy className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">BizaDesk Concierge Support</h3>
                <p className="text-[11px] text-slate-400">Direct channel to the platform engineering &amp; billing team</p>
              </div>
            </div>

            {supportError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-950/60 border border-rose-900 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{supportError}</span>
              </div>
            )}

            {supportSuccess ? (
              <div className="text-center py-6 space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                <h4 className="text-base font-bold text-white">Inquiry Dispatched!</h4>
                <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
                  Thank you! Your message has been routed to our technical support desk. An engineer will follow up at <strong className="text-indigo-400">{currentUser?.email || orgConfig?.support_email}</strong> shortly.
                </p>
                <button
                  type="button"
                  onClick={() => setShowSupportModal(false)}
                  className="mt-4 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-6 py-2 rounded-xl border border-slate-700 transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendSupportRequest} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Your Organization</label>
                    <input
                      type="text"
                      disabled
                      value={form.name}
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-400 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Category</label>
                    <select
                      value={supportCategory}
                      onChange={(e) => setSupportCategory(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="Technical & Integration Support">Technical &amp; Integration</option>
                      <option value="Billing & Custom Enterprise Tier">Billing &amp; Enterprise Plan</option>
                      <option value="Feature Request & Feedback">Feature Request</option>
                      <option value="Urgent Outage / Platform Glitch">Urgent Bug / Platform Issue</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Subject</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Inquiring about custom SSO / Active Directory sync"
                    value={supportSubject}
                    onChange={(e) => setSupportSubject(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Describe your request *</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Please provide details about what you need assistance with..."
                    value={supportMessage}
                    onChange={(e) => setSupportMessage(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowSupportModal(false)}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-2.5 rounded-xl border border-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={sendingSupport}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs py-2.5 rounded-xl shadow-lg shadow-indigo-950 flex items-center justify-center gap-2 transition-all"
                  >
                    {sendingSupport ? "Dispatching..." : <><Send className="w-3.5 h-3.5" /> Send Request</>}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 2FA Enrollment Modal */}
      {showMfaEnroll && (
        <MfaEnrollModal
          isOpen={showMfaEnroll}
          onClose={() => setShowMfaEnroll(false)}
          onSuccess={async () => {
            setShowMfaEnroll(false);
            await checkMfaStatus();
          }}
        />
      )}
    </div>
  );
}
