import { useState } from "react";
import { 
  Mail, Server, ShieldCheck, Send, CheckCircle2, AlertCircle, Save, 
  KeyRound, Image, FileText, Sparkles, Eye, RotateCcw, Building,
  LifeBuoy, Flame, Palette, AlignLeft, Check
} from "lucide-react";
import { supabase } from "../supabase";
import { 
  sendEmailViaResend, 
  DEFAULT_INCIDENT_TEMPLATES, 
  DEFAULT_TICKET_TEMPLATES, 
  DEFAULT_FOOTER_CONFIG,
  fillTemplate,
  generateBrandedHtmlEmail 
} from "../engine/emailDispatcher";

const INCIDENT_PLACEHOLDERS = [
  { tag: "{{incident_id}}", desc: "e.g. INC-005" },
  { tag: "{{title}}", desc: "Incident headline" },
  { tag: "{{application}}", desc: "Affected app (e.g. Core Banking API)" },
  { tag: "{{severity}}", desc: "LOW, HIGH, CRITICAL" },
  { tag: "{{team}}", desc: "Assigned team" },
  { tag: "{{time_open}}", desc: "Duration open (mins)" },
  { tag: "{{time_detected}}", desc: "Initial detection timestamp" },
  { tag: "{{resolved_by}}", desc: "Resolving engineer" },
  { tag: "{{company_name}}", desc: "Your company name" },
  { tag: "{{description}}", desc: "Incident details" },
];

const TICKET_PLACEHOLDERS = [
  { tag: "{{ticket_id}}", desc: "e.g. TKT-104" },
  { tag: "{{submitter}}", desc: "Employee name" },
  { tag: "{{title}}", desc: "Ticket subject" },
  { tag: "{{category}}", desc: "e.g. Hardware, VPN" },
  { tag: "{{priority}}", desc: "LOW, MEDIUM, HIGH, URGENT" },
  { tag: "{{assigned_to}}", desc: "Assigned technician" },
  { tag: "{{status}}", desc: "OPEN, IN_PROGRESS, RESOLVED" },
  { tag: "{{update_note}}", desc: "Work note or comment" },
  { tag: "{{resolution_note}}", desc: "Resolution explanation" },
  { tag: "{{company_name}}", desc: "Your company name" },
  { tag: "{{portal_url}}", desc: "Helpdesk portal link" },
  { tag: "{{team}}", desc: "Assigned support team" }
];

export default function EmailSettings({ orgConfig, onSaveEmailConfig }) {
  // Navigation Section: 'incidents' | 'tickets' | 'branding' | 'footer' | 'delivery'
  const [activeSection, setActiveSection] = useState("incidents");

  // Delivery Provider Config
  const [provider, setProvider] = useState(orgConfig?.email_provider || "resend");
  const [resendApiKey, setResendApiKey] = useState(orgConfig?.resend_api_key || "");
  const [resendFrom, setResendFrom] = useState(orgConfig?.resend_from_email || "helpdesk@bizadoc.com");

  const [smtpHost, setSmtpHost] = useState(orgConfig?.smtp_host || "smtp.office365.com");
  const [smtpPort, setSmtpPort] = useState(orgConfig?.smtp_port || 587);
  const [smtpUser, setSmtpUser] = useState(orgConfig?.smtp_user || "");
  const [smtpPass, setSmtpPass] = useState(orgConfig?.smtp_pass || "");
  const [smtpFromName, setSmtpFromName] = useState(orgConfig?.smtp_from_name || orgConfig?.name || "Company IT Support");
  const [smtpFromEmail, setSmtpFromEmail] = useState(orgConfig?.smtp_from_email || "");

  // Brand & Watermark Config
  const existingBranding = orgConfig?.email_branding || {};
  const [logoUrl, setLogoUrl] = useState(existingBranding.logo_url || orgConfig?.logo_url || "");
  const [headerBannerUrl, setHeaderBannerUrl] = useState(existingBranding.header_banner_url || "");
  const [showWatermark, setShowWatermark] = useState(existingBranding.show_watermark !== undefined ? existingBranding.show_watermark : true);
  const [watermarkUrl, setWatermarkUrl] = useState(existingBranding.watermark_url || "");
  const [accentColor, setAccentColor] = useState(existingBranding.accent_color || "#2563eb");

  // Global Email Footer Config
  const existingFooter = orgConfig?.email_footer || {};
  const [footerTeamName, setFooterTeamName] = useState(existingFooter.team_name || `${orgConfig?.name || "Corporate"} IT Operations Team`);
  const [footerContact, setFooterContact] = useState(existingFooter.contact_info || "+1 (800) 555-0199 / WhatsApp Support");
  const [footerEmail, setFooterEmail] = useState(existingFooter.support_email || orgConfig?.support_email || "helpdesk@bizadoc.com");
  const [footerPortalUrl, setFooterPortalUrl] = useState(existingFooter.portal_url || "https://desk.bizadoc.com");
  const [footerAddress, setFooterAddress] = useState(existingFooter.address || "Corporate HQ • Global IT Service Command");
  const [footerDisclaimer, setFooterDisclaimer] = useState(existingFooter.disclaimer || DEFAULT_FOOTER_CONFIG.disclaimer);

  // Template State
  const existingTemplates = orgConfig?.email_templates || {};
  const [incidentTab, setIncidentTab] = useState("initial"); // 'initial' | 'manager_escalation' | 'allstaff' | 'resolution'
  const [ticketTab, setTicketTab] = useState("ticket_created"); // 'ticket_created' | 'ticket_assigned' | 'ticket_updated' | 'ticket_resolved'

  const [incidentTemplates, setIncidentTemplates] = useState({
    initial: existingTemplates.initial || DEFAULT_INCIDENT_TEMPLATES.initial.body,
    manager_escalation: existingTemplates.manager_escalation || DEFAULT_INCIDENT_TEMPLATES.manager_escalation.body,
    allstaff: existingTemplates.allstaff || DEFAULT_INCIDENT_TEMPLATES.allstaff.body,
    resolution: existingTemplates.resolution || DEFAULT_INCIDENT_TEMPLATES.resolution.body,
  });

  const [ticketTemplates, setTicketTemplates] = useState({
    ticket_created: existingTemplates.ticket_created || DEFAULT_TICKET_TEMPLATES.ticket_created.body,
    ticket_assigned: existingTemplates.ticket_assigned || DEFAULT_TICKET_TEMPLATES.ticket_assigned.body,
    ticket_updated: existingTemplates.ticket_updated || DEFAULT_TICKET_TEMPLATES.ticket_updated.body,
    ticket_resolved: existingTemplates.ticket_resolved || DEFAULT_TICKET_TEMPLATES.ticket_resolved.body,
  });

  // Preview Mode: 'incident' | 'ticket'
  const [previewMode, setPreviewMode] = useState("incident");

  // Test Email state
  const [testEmailAddress, setTestEmailAddress] = useState(orgConfig?.support_email || "");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleInsertPlaceholder = (tag, isTicket = false) => {
    if (isTicket) {
      setTicketTemplates(prev => ({
        ...prev,
        [ticketTab]: (prev[ticketTab] || "") + " " + tag
      }));
    } else {
      setIncidentTemplates(prev => ({
        ...prev,
        [incidentTab]: (prev[incidentTab] || "") + " " + tag
      }));
    }
  };

  const handleResetTemplate = (isTicket = false) => {
    if (isTicket) {
      setTicketTemplates(prev => ({
        ...prev,
        [ticketTab]: DEFAULT_TICKET_TEMPLATES[ticketTab].body
      }));
    } else {
      setIncidentTemplates(prev => ({
        ...prev,
        [incidentTab]: DEFAULT_INCIDENT_TEMPLATES[incidentTab].body
      }));
    }
  };

  const handleSaveAll = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);

    const mergedTemplates = {
      ...incidentTemplates,
      ...ticketTemplates
    };

    const brandingPayload = {
      logo_url: logoUrl.trim(),
      header_banner_url: headerBannerUrl.trim(),
      show_watermark: Boolean(showWatermark),
      watermark_url: watermarkUrl.trim() || logoUrl.trim(),
      accent_color: accentColor.trim() || "#2563eb"
    };

    const footerPayload = {
      team_name: footerTeamName.trim(),
      contact_info: footerContact.trim(),
      support_email: footerEmail.trim(),
      portal_url: footerPortalUrl.trim(),
      address: footerAddress.trim(),
      disclaimer: footerDisclaimer.trim()
    };

    const config = {
      email_provider: provider,
      resend_api_key: resendApiKey.trim(),
      resend_from_email: resendFrom.trim(),
      smtp_host: smtpHost.trim(),
      smtp_port: Number(smtpPort) || 587,
      smtp_user: smtpUser.trim(),
      smtp_pass: smtpPass.trim(),
      smtp_from_name: smtpFromName.trim(),
      smtp_from_email: smtpFromEmail.trim(),
      logo_url: logoUrl.trim(),
      email_templates: mergedTemplates,
      email_branding: brandingPayload,
      email_footer: footerPayload
    };

    if (onSaveEmailConfig) {
      await onSaveEmailConfig(config);
    }
    setSaving(false);
    setTestResult({ success: true, message: "Email templates, watermark, and footer saved successfully!" });
    setTimeout(() => setTestResult(null), 4000);
  };

  const handleSendTestEmail = async () => {
    if (!testEmailAddress.trim()) return;
    setTesting(true);
    setTestResult(null);

    const testSubject = `[TEST] ${orgConfig?.name || "BizaDesk"} Branded Email Verification`;
    const testBody = `Hello,\n\nThis is a verification test of your white-label email branding and delivery engine.\n\nProvider: ${provider === "resend" ? "Resend API" : `Custom SMTP (${smtpHost}:${smtpPort})`}\nSender: ${provider === "resend" ? resendFrom : smtpFromEmail || smtpUser}\nTimestamp: ${new Date().toLocaleString()}\n\nIf you received this with your brand logo, white card, and footer intact, your email setup is 100% operational!`;

    const html = generateBrandedHtmlEmail({
      title: "Email Delivery & Branding Verification",
      bodyText: testBody,
      badgeText: "VERIFICATION PASSED",
      badgeColor: "#16a34a",
      badgeBg: "#f0fdf4",
      badgeBorder: "#bbf7d0",
      orgConfig: {
        ...orgConfig,
        name: orgConfig?.name || "Your Company",
        logo_url: logoUrl,
        email_branding: {
          logo_url: logoUrl,
          header_banner_url: headerBannerUrl,
          show_watermark: showWatermark,
          watermark_url: watermarkUrl || logoUrl,
          accent_color: accentColor
        },
        email_footer: {
          team_name: footerTeamName,
          contact_info: footerContact,
          support_email: footerEmail,
          portal_url: footerPortalUrl,
          address: footerAddress,
          disclaimer: footerDisclaimer
        }
      },
      details: [
        { label: "Delivery Engine", value: provider === "resend" ? "Resend Global Relay" : `SMTP ${smtpHost}` },
        { label: "Brand Accent", value: accentColor },
        { label: "Watermark Status", value: showWatermark ? "Active (Faint 5%)" : "Disabled" }
      ]
    });

    try {
      if (provider === "resend") {
        const result = await sendEmailViaResend({
          to: testEmailAddress.trim(),
          subject: testSubject,
          body: testBody,
          html,
          apiKey: resendApiKey,
          fromEmail: resendFrom,
          orgId: orgConfig?.id
        });

        if (result.success) {
          setTestResult({ success: true, message: `✅ Test email successfully delivered to ${testEmailAddress}!` });
        } else {
          setTestResult({ success: false, message: `Delivery failed: ${result.error}` });
        }
      } else {
        setTestResult({
          success: false,
          message: "Custom SMTP relay requires your outbound port 587 relay to be unblocked by your network admin. For instant turnkey sending, choose Resend."
        });
      }
    } catch (err) {
      setTestResult({ success: false, message: `Error: ${err.message}` });
    } finally {
      setTesting(false);
    }
  };

  // Generate Live Dynamic Sample for Preview Card
  const dummyIncidentData = {
    incident_id: "INC-042",
    title: "Core Payment Gateway Latency Spike",
    application: "Customer Checkout API",
    severity: "HIGH",
    team: "Database & Backend Team",
    time_open: "18",
    time_detected: "Today at 03:15 PM",
    resolved_by: "Alex Johnson (Senior SRE)",
    company_name: orgConfig?.name || "Acme Corporation",
    description: "Database connection pool reached 98% capacity resulting in queued requests and timeouts."
  };

  const dummyTicketData = {
    ticket_id: "TKT-108",
    submitter: "David Adeleke",
    title: "Cannot access internal staging VPN gateway",
    category: "Network & VPN",
    priority: "HIGH",
    assigned_to: "Sarah Connor (IT Tier 2)",
    status: ticketTab === "ticket_resolved" ? "RESOLVED" : "IN_PROGRESS",
    update_note: "Re-provisioned your OpenVPN certificate. Please re-import and test connection.",
    resolution_note: "User confirmed VPN authentication passed after certificate renew.",
    company_name: orgConfig?.name || "Acme Corporation",
    portal_url: footerPortalUrl || "https://desk.bizadoc.com",
    team: footerTeamName || "IT Helpdesk Team"
  };

  const activeRawTemplate = previewMode === "incident" 
    ? incidentTemplates[incidentTab] 
    : ticketTemplates[ticketTab];

  const previewBody = fillTemplate(
    activeRawTemplate, 
    previewMode === "incident" ? dummyIncidentData : dummyTicketData
  );

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Palette className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-slate-100">Email Templates, White-Label & Delivery Engine</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Brand all outbound incident alerts and helpdesk ticket emails with your company logo, subtle watermark, custom wording, and legal disclaimers. Sent on crisp, mobile-responsive white cards.
            </p>
          </div>
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving All Changes..." : "Save Settings"}
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 mt-6 pt-5 border-t border-slate-800">
          <button
            onClick={() => { setActiveSection("incidents"); setPreviewMode("incident"); }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
              activeSection === "incidents"
                ? "bg-rose-500/10 text-rose-300 border border-rose-500/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            Incident Templates
          </button>

          <button
            onClick={() => { setActiveSection("tickets"); setPreviewMode("ticket"); }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
              activeSection === "tickets"
                ? "bg-indigo-500/10 text-indigo-300 border border-indigo-500/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <LifeBuoy className="w-3.5 h-3.5" />
            Ticket Templates
          </button>

          <button
            onClick={() => setActiveSection("branding")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
              activeSection === "branding"
                ? "bg-purple-500/10 text-purple-300 border border-purple-500/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <Image className="w-3.5 h-3.5" />
            Brand Logo & Watermark
          </button>

          <button
            onClick={() => setActiveSection("footer")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
              activeSection === "footer"
                ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <AlignLeft className="w-3.5 h-3.5" />
            Global Email Footer
          </button>

          <button
            onClick={() => setActiveSection("delivery")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
              activeSection === "delivery"
                ? "bg-blue-500/10 text-blue-300 border border-blue-500/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            Delivery Engine & Test
          </button>
        </div>
      </div>

      {/* Main Grid: Left Config Panel, Right Live White Card Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Form Controls (7 cols) */}
        <div className="lg:col-span-7 space-y-6">

          {/* SECTION: INCIDENT TEMPLATES */}
          {activeSection === "incidents" && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                    <Flame className="w-4 h-4 text-rose-400" />
                    Incident Notification Templates
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Customize wording for automated outage notices and escalations.</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleResetTemplate(false)}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 px-2.5 py-1.5 rounded transition-all"
                  title="Reset this template to system default"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset to Default
                </button>
              </div>

              {/* Sub-tabs for 4 stages */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
                {[
                  { id: "initial", label: "Initial Alert" },
                  { id: "manager_escalation", label: "Tier 2 Manager" },
                  { id: "allstaff", label: "Tier 3 All-Staff" },
                  { id: "resolution", label: "Resolution" },
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => { setIncidentTab(tab.id); setPreviewMode("incident"); }}
                    className={`py-2 px-2 text-center text-xs font-medium rounded-md transition-all ${
                      incidentTab === tab.id
                        ? "bg-slate-800 text-white font-semibold shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Textarea */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  Email Message Body ({incidentTab.replace("_", " ").toUpperCase()})
                </label>
                <textarea
                  rows={9}
                  value={incidentTemplates[incidentTab]}
                  onChange={e => setIncidentTemplates({ ...incidentTemplates, [incidentTab]: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500 leading-relaxed resize-y"
                  placeholder="Enter custom incident notification text..."
                />
              </div>

              {/* Clickable Placeholders */}
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Click to Insert Dynamic Placeholders:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {INCIDENT_PLACEHOLDERS.map(p => (
                    <button
                      key={p.tag}
                      type="button"
                      onClick={() => handleInsertPlaceholder(p.tag, false)}
                      className="px-2.5 py-1 rounded bg-slate-800/80 hover:bg-indigo-600 hover:text-white border border-slate-700/60 text-[11px] font-mono text-indigo-300 transition-all flex items-center gap-1"
                      title={p.desc}
                    >
                      <span>{p.tag}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SECTION: TICKET TEMPLATES */}
          {activeSection === "tickets" && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                    <LifeBuoy className="w-4 h-4 text-indigo-400" />
                    Helpdesk Ticket Email Templates
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Customize wording for employee tickets, dispatch, and resolutions.</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleResetTemplate(true)}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 px-2.5 py-1.5 rounded transition-all"
                  title="Reset this template to system default"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset to Default
                </button>
              </div>

              {/* Sub-tabs for 4 ticket stages */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
                {[
                  { id: "ticket_created", label: "Ticket Logged" },
                  { id: "ticket_assigned", label: "Tech Assigned" },
                  { id: "ticket_updated", label: "Status Update" },
                  { id: "ticket_resolved", label: "Ticket Resolved" },
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => { setTicketTab(tab.id); setPreviewMode("ticket"); }}
                    className={`py-2 px-2 text-center text-xs font-medium rounded-md transition-all ${
                      ticketTab === tab.id
                        ? "bg-slate-800 text-white font-semibold shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Textarea */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  Email Message Body ({ticketTab.replace("ticket_", "").replace("_", " ").toUpperCase()})
                </label>
                <textarea
                  rows={9}
                  value={ticketTemplates[ticketTab]}
                  onChange={e => setTicketTemplates({ ...ticketTemplates, [ticketTab]: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500 leading-relaxed resize-y"
                  placeholder="Enter custom ticket notification text..."
                />
              </div>

              {/* Clickable Placeholders */}
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  Click to Insert Dynamic Placeholders:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {TICKET_PLACEHOLDERS.map(p => (
                    <button
                      key={p.tag}
                      type="button"
                      onClick={() => handleInsertPlaceholder(p.tag, true)}
                      className="px-2.5 py-1 rounded bg-slate-800/80 hover:bg-indigo-600 hover:text-white border border-slate-700/60 text-[11px] font-mono text-indigo-300 transition-all flex items-center gap-1"
                      title={p.desc}
                    >
                      <span>{p.tag}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SECTION: BRANDING & WATERMARK */}
          {activeSection === "branding" && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                  <Palette className="w-4 h-4 text-purple-400" />
                  Visual Identity & Watermark Controls
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Control company logos, headers, subtle body watermark, and accent colors.</p>
              </div>

              {/* Brand Logo URL */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Company Brand Logo (Header URL)
                </label>
                <div className="relative">
                  <input
                    type="url"
                    value={logoUrl}
                    onChange={e => setLogoUrl(e.target.value)}
                    placeholder="https://yourcompany.com/assets/logo.png"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                  <Image className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Recommended: Transparent PNG or JPG, max height 50px. Renders crisp at top of email.</p>
              </div>

              {/* Optional Full Header Banner URL */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Full Header Banner Graphic (Optional)
                </label>
                <div className="relative">
                  <input
                    type="url"
                    value={headerBannerUrl}
                    onChange={e => setHeaderBannerUrl(e.target.value)}
                    placeholder="https://yourcompany.com/assets/email-banner.png"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                  <Image className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">If provided, replaces the logo with a full-width 600×120px corporate banner graphic.</p>
              </div>

              {/* Watermark Logo Option */}
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-semibold text-slate-200 block">
                      Subtle Body Watermark Logo
                    </label>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Renders a faint (5% opacity) centered company emblem underneath the email text.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowWatermark(!showWatermark)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      showWatermark ? "bg-indigo-600" : "bg-slate-700"
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        showWatermark ? "translate-x-4" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                {showWatermark && (
                  <div className="pt-2 border-t border-slate-800">
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Watermark Image URL (defaults to your Brand Logo if left empty)
                    </label>
                    <input
                      type="url"
                      value={watermarkUrl}
                      onChange={e => setWatermarkUrl(e.target.value)}
                      placeholder={logoUrl || "https://yourcompany.com/assets/watermark-crest.png"}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}
              </div>

              {/* Brand Accent Color */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Brand Primary Accent Color (Borders & CTA Buttons)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={e => setAccentColor(e.target.value)}
                    className="w-9 h-9 rounded cursor-pointer bg-transparent border-0"
                  />
                  <input
                    type="text"
                    value={accentColor}
                    onChange={e => setAccentColor(e.target.value)}
                    className="w-32 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                  <div className="flex items-center gap-1.5">
                    {["#2563eb", "#4f46e5", "#059669", "#dc2626", "#7c3aed", "#d97706"].map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setAccentColor(c)}
                        className="w-6 h-6 rounded-full border border-white/20 transition-transform hover:scale-110"
                        style={{ backgroundColor: c }}
                        title={c}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: GLOBAL EMAIL FOOTER */}
          {activeSection === "footer" && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                  <AlignLeft className="w-4 h-4 text-emerald-400" />
                  Global Branded Email Footer
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  This structured footer is automatically attached to the bottom of all incident and ticket emails.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Sending Team / Department Name
                  </label>
                  <input
                    type="text"
                    value={footerTeamName}
                    onChange={e => setFooterTeamName(e.target.value)}
                    placeholder="e.g. IT Operations & Helpdesk Team"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Support Hotline / Contact Info
                  </label>
                  <input
                    type="text"
                    value={footerContact}
                    onChange={e => setFooterContact(e.target.value)}
                    placeholder="e.g. +1 (800) 555-0199 / WhatsApp"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Support Reply-To Email
                  </label>
                  <input
                    type="email"
                    value={footerEmail}
                    onChange={e => setFooterEmail(e.target.value)}
                    placeholder="helpdesk@company.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Helpdesk Portal URL
                  </label>
                  <input
                    type="url"
                    value={footerPortalUrl}
                    onChange={e => setFooterPortalUrl(e.target.value)}
                    placeholder="https://desk.bizadoc.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Physical HQ / Compliance Address
                </label>
                <input
                  type="text"
                  value={footerAddress}
                  onChange={e => setFooterAddress(e.target.value)}
                  placeholder="e.g. 100 Innovation Way, Suite 400 • Corporate IT Command"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Legal Confidentiality & Cogent Notice (Disclaimer)
                </label>
                <textarea
                  rows={3}
                  value={footerDisclaimer}
                  onChange={e => setFooterDisclaimer(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 leading-relaxed resize-y"
                  placeholder="CONFIDENTIALITY NOTICE: This transmission is intended only for..."
                />
              </div>
            </div>
          )}

          {/* SECTION: DELIVERY ENGINE & TEST */}
          {activeSection === "delivery" && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                  <Server className="w-4 h-4 text-blue-400" />
                  Email Delivery Provider
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Select how your organization dispatches outbound notification emails.</p>
              </div>

              {/* Provider Radio Tabs */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setProvider("resend")}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    provider === "resend"
                      ? "bg-indigo-600/10 border-indigo-500/60 text-white"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs text-slate-200">Resend API (Recommended)</span>
                    {provider === "resend" && <Check className="w-4 h-4 text-indigo-400" />}
                  </div>
                  <p className="text-[11px] text-slate-400">High deliverability, instant edge dispatch, zero SMTP port blocking.</p>
                </button>

                <button
                  type="button"
                  onClick={() => setProvider("custom_smtp")}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    provider === "custom_smtp"
                      ? "bg-indigo-600/10 border-indigo-500/60 text-white"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs text-slate-200">Custom Corporate SMTP</span>
                    {provider === "custom_smtp" && <Check className="w-4 h-4 text-indigo-400" />}
                  </div>
                  <p className="text-[11px] text-slate-400">Connect your Office 365, Google Workspace, or internal SMTP relay.</p>
                </button>
              </div>

              {provider === "resend" ? (
                <div className="space-y-4 pt-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Resend API Key
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        value={resendApiKey}
                        onChange={e => setResendApiKey(e.target.value)}
                        placeholder="re_xxxxxxxxxxxxxxxxxxxxxxxx"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                      <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Sender Email ("From")
                    </label>
                    <input
                      type="email"
                      value={resendFrom}
                      onChange={e => setResendFrom(e.target.value)}
                      placeholder="helpdesk@bizadoc.com or alerts@yourdomain.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-slate-300 mb-1">SMTP Host</label>
                      <input
                        type="text"
                        value={smtpHost}
                        onChange={e => setSmtpHost(e.target.value)}
                        placeholder="smtp.office365.com"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Port</label>
                      <input
                        type="number"
                        value={smtpPort}
                        onChange={e => setSmtpPort(e.target.value)}
                        placeholder="587"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">SMTP Username</label>
                      <input
                        type="text"
                        value={smtpUser}
                        onChange={e => setSmtpUser(e.target.value)}
                        placeholder="alerts@company.com"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">SMTP Password</label>
                      <input
                        type="password"
                        value={smtpPass}
                        onChange={e => setSmtpPass(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Test Dispatcher Box */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                  <Send className="w-3.5 h-3.5 text-indigo-400" />
                  Send Test Verification Email
                </div>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={testEmailAddress}
                    onChange={e => setTestEmailAddress(e.target.value)}
                    placeholder="Enter your email (e.g. you@company.com)"
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleSendTestEmail}
                    disabled={testing || !testEmailAddress}
                    className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-all disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {testing ? "Sending..." : "Dispatch Test"}
                  </button>
                </div>
                {testResult && (
                  <div className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                    testResult.success ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30" : "bg-rose-500/10 text-rose-300 border border-rose-500/30"
                  }`}>
                    {testResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                    <span>{testResult.message}</span>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Right Column: Live Interactive White-Background Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-indigo-400" />
              Live Inbox Preview (Crisp White Card)
            </span>
            <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[11px]">
              <button
                type="button"
                onClick={() => setPreviewMode("incident")}
                className={`px-2 py-0.5 rounded transition-all ${
                  previewMode === "incident" ? "bg-indigo-600 text-white font-semibold" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Incident
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode("ticket")}
                className={`px-2 py-0.5 rounded transition-all ${
                  previewMode === "ticket" ? "bg-indigo-600 text-white font-semibold" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Ticket
              </button>
            </div>
          </div>

          {/* Email Preview Outer Wrapper: Light Grey Background like Gmail / Outlook */}
          <div className="bg-[#f1f5f9] rounded-xl border border-slate-700/60 p-4 shadow-xl overflow-hidden text-slate-800">
            
            {/* Inner 100% Pure White Card Container */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden relative">
              
              {/* Header Banner or Logo */}
              {headerBannerUrl ? (
                <div className="w-full border-b-2" style={{ borderColor: accentColor }}>
                  <img src={headerBannerUrl} alt="Company Banner" className="w-full h-auto max-h-24 object-cover" />
                </div>
              ) : logoUrl ? (
                <div className="p-4 text-center border-b-2 bg-white" style={{ borderColor: accentColor }}>
                  <img src={logoUrl} alt="Company Logo" className="max-h-10 max-w-[200px] mx-auto object-contain" />
                </div>
              ) : (
                <div 
                  className="p-4 text-center text-white"
                  style={{ background: `linear-gradient(135deg, ${accentColor} 0%, #1d4ed8 100%)` }}
                >
                  <div className="text-base font-extrabold tracking-tight">{orgConfig?.name || "Acme Corporation"}</div>
                  <div className="text-[10px] tracking-wider opacity-90 uppercase mt-0.5">IT Service Desk & Incident Command</div>
                </div>
              )}

              {/* White Body Card with Centered Translucent Watermark */}
              <div className="p-5 relative min-h-[220px]">
                
                {/* Watermark Behind Text */}
                {showWatermark && (watermarkUrl || logoUrl) && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.05] overflow-hidden select-none">
                    <img
                      src={watermarkUrl || logoUrl}
                      alt="Watermark"
                      className="max-w-[180px] max-h-[180px] object-contain filter grayscale"
                    />
                  </div>
                )}

                {/* Content Layer (Dark text on white card) */}
                <div className="relative z-10 space-y-3">
                  <div className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                    style={{ 
                      backgroundColor: previewMode === "incident" ? "#fee2e2" : "#e0e7ff",
                      color: previewMode === "incident" ? "#b91c1c" : "#3730a3",
                      border: `1px solid ${previewMode === "incident" ? "#fca5a5" : "#c7d2fe"}`
                    }}
                  >
                    {previewMode === "incident" 
                      ? `${dummyIncidentData.severity} INCIDENT NOTIFICATION`
                      : `${dummyTicketData.priority} PRIORITY TICKET`
                    }
                  </div>

                  <h4 className="text-sm font-bold text-slate-900 leading-snug">
                    {previewMode === "incident" ? dummyIncidentData.title : dummyTicketData.title}
                  </h4>

                  <div className="text-[12px] text-slate-700 whitespace-pre-wrap leading-relaxed font-sans border-l-2 pl-3 py-1 bg-slate-50/80 rounded" style={{ borderColor: accentColor }}>
                    {previewBody}
                  </div>

                  {/* Action CTA Button */}
                  <div className="pt-2 text-center">
                    <span
                      className="inline-block px-5 py-2 rounded-md text-[11px] font-bold text-white shadow-sm"
                      style={{ backgroundColor: accentColor }}
                    >
                      {previewMode === "incident" ? "View Incident in Portal →" : "Track Ticket Status →"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Branded Global Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 text-center text-slate-600 space-y-1">
                <div className="text-xs font-bold text-slate-800">
                  {footerTeamName || `${orgConfig?.name || "Corporate"} IT Operations Team`}
                </div>
                {footerContact && (
                  <div className="text-[11px] text-slate-600">
                    <span className="font-semibold">Hotline:</span> {footerContact}
                  </div>
                )}
                {footerEmail && (
                  <div className="text-[11px] text-slate-600">
                    <span className="font-semibold">Email:</span> <span style={{ color: accentColor }}>{footerEmail}</span>
                  </div>
                )}
                {footerAddress && (
                  <div className="text-[10px] text-slate-400 mt-1">
                    {footerAddress}
                  </div>
                )}
                {footerDisclaimer && (
                  <div className="text-[9px] text-slate-400 border-t border-dashed border-slate-200 pt-2 mt-2 leading-tight italic">
                    {footerDisclaimer}
                  </div>
                )}
              </div>

            </div>

            <div className="mt-2.5 text-center text-[10px] text-slate-500">
              ⚡ Emails dispatch on pure white cards with Outlook-safe typography and mobile dark mode protection.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
