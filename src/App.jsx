import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { 
  Bot, AlertTriangle, Ticket, Activity, Mail, Settings, CreditCard,
  Plus, CheckCircle2, RefreshCw, Trash2, Clock, ShieldAlert,
  ChevronRight, Building2, Flame, HelpCircle, LogOut, User, Users,
  Monitor, Cpu, Globe, Sparkles, MessageSquare, KeyRound, X, Eye, EyeOff,
  Sun, Moon, Scale, ShieldCheck, MapPin, Phone, GitBranch, Shield,
  Coffee, Pause, Play
} from "lucide-react";
import { supabase } from "./supabase";
import { pingEndpoint } from "./engine/healthPingEngine";
import VirtualITSupport from "./components/VirtualITSupport";
import ProactiveBanner from "./components/ProactiveBanner";
import AuthScreen from "./components/AuthScreen";
import LandingPage from "./components/LandingPage";
import LegalModal from "./components/LegalModal";
import NotificationBell from "./components/NotificationBell";
import LiveClock from "./components/LiveClock";
import { playNotificationChime } from "./engine/soundEffects";
import { getSystemDiagnostics } from "./engine/diagnosticSensor";
import { 
  sendEmailViaResend, 
  sendWelcomeEmail, 
  fillTemplate, 
  generateBrandedHtmlEmail, 
  DEFAULT_INCIDENT_TEMPLATES, 
  DEFAULT_TICKET_TEMPLATES 
} from "./engine/emailDispatcher";
import { calculateBusinessSla } from "./engine/businessSla";
export { calculateBusinessSla };

// Code splitting / Lazy-load heavy panels for faster initial bundle and instant page render
const CompanySettings = lazy(() => import("./components/CompanySettings"));
const MonitoredServices = lazy(() => import("./components/MonitoredServices"));
const BillingSubscription = lazy(() => import("./components/BillingSubscription"));
const TeamManagement = lazy(() => import("./components/TeamManagement"));
const UserManagement = lazy(() => import("./components/UserManagement"));
const TicketChatModal = lazy(() => import("./components/TicketChatModal"));
const EmailSettings = lazy(() => import("./components/EmailSettings"));
const AuditLogsViewer = lazy(() => import("./components/AuditLogsViewer"));
const TicketSettlementModal = lazy(() => import("./components/TicketSettlementModal"));
const MfaEnrollModal = lazy(() => import("./components/MfaEnrollModal"));

// ── Platform Master Workspace — all individual-user tickets route here ────────
const PLATFORM_MASTER_DOMAIN = "bizadoc.com";

// ── Input sanitizer: strip HTML/script tags before DB writes ─────────────────
function sanitizeInput(str) {
  if (!str || typeof str !== "string") return str;
  return str
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/javascript:/gi, "")
    .trim();
}

const SEV_COLOR = { 
  CRITICAL: "#ef4444", 
  HIGH: "#f97316", 
  MEDIUM: "#eab308", 
  LOW: "#22c55e" 
};

function fmtTime(ts) {
  if (!ts) return "--:--:--";
  return new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function timeAgo(ts) {
  if (!ts) return "just now";
  const d = Date.now() - ts;
  if (d < 60000) return `${Math.floor(d / 1000)}s ago`;
  if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
  return `${Math.floor(d / 3600000)}h ago`;
}

function EmailModal({ email, onClose }) {
  if (!email) return null;
  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-lg w-full shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-800">
          <span className="text-amber-400 font-bold text-xs uppercase tracking-wider flex items-center gap-2">
            <Mail className="w-4 h-4" /> Dispatched Escalation Email
          </span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-xs">✕</button>
        </div>
        <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-4 text-xs space-y-3 font-mono">
          <div>
            <span className="text-slate-500 block text-[10px] uppercase">To Address:</span>
            <span className="text-slate-200">{email.to_address}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase">Subject:</span>
            <span className="text-amber-300 font-semibold">{email.subject}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase">Body:</span>
            <div className="text-slate-300 whitespace-pre-wrap leading-relaxed bg-slate-900/60 p-3 rounded mt-1 border border-slate-800">
              {email.body}
            </div>
          </div>
        </div>
        <div className="mt-4 text-[11px] text-slate-500 text-right">
          Sent at {fmtTime(email.sent_at)}
        </div>
      </div>
    </div>
  );
}

// ── Live SLA Progress Bar for Tickets (With Business Hours Pause) ────────────
function TicketSlaBar({ ticket, slaHours = 1, orgConfig = null }) {
  const isResolved = ticket.status === "RESOLVED";
  const startHour = orgConfig?.work_start_hour ?? 8;
  const endHour = orgConfig?.work_end_hour ?? 18;
  const workDays = orgConfig?.work_days || "1,2,3,4,5";

  const slaData = calculateBusinessSla({
    createdTimestamp: ticket.created,
    slaHours,
    workStartHour: startHour,
    workEndHour: endHour,
    workDaysStr: workDays,
    isBreachedDirect: ticket.sla_breached,
    resolvedTimestamp: ticket.resolved_at
  });

  if (isResolved) {
    const totalMins = Math.max(1, Math.round((slaData.businessElapsedMs || (Date.now() - ticket.created)) / 60000));
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium mt-2">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
        <span>Resolved in {totalMins}m business time {ticket.sla_breached ? "(SLA Breached)" : "(Within SLA ✓)"}</span>
      </div>
    );
  }

  const { isBreached, remainingMins, breachMins, pctRemaining, isPaused, nextResumeText } = slaData;

  const barColor = isBreached
    ? "bg-rose-500 animate-pulse"
    : isPaused
    ? "bg-sky-500/70"
    : pctRemaining < 25
    ? "bg-rose-500"
    : pctRemaining < 50
    ? "bg-amber-500"
    : "bg-emerald-500";

  return (
    <div className="space-y-1 mt-2.5 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
      <div className="flex items-center justify-between text-[11px]">
        {isPaused ? (
          <span className="font-semibold flex items-center gap-1.5 text-sky-400">
            <Pause className="w-3.5 h-3.5 shrink-0 animate-pulse" />
            <span>⏸️ SLA Paused (Resumes {nextResumeText}) • {remainingMins}m left</span>
          </span>
        ) : (
          <span className={`font-semibold flex items-center gap-1.5 ${
            isBreached ? "text-rose-400 animate-pulse" : pctRemaining < 25 ? "text-rose-400" : pctRemaining < 50 ? "text-amber-400" : "text-slate-300"
          }`}>
            <Clock className="w-3.5 h-3.5 shrink-0" />
            {isBreached ? `🚨 SLA Breached by ${breachMins}m` : `${remainingMins}m remaining before breach`}
          </span>
        )}
        <span className="text-[10px] text-slate-500 font-mono">
          {isPaused ? "Business Hours SLA" : `SLA Target: ${slaHours}h`}
        </span>
      </div>
      <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: isBreached ? "100%" : `${pctRemaining}%` }}
        />
      </div>
    </div>
  );
}

export default function HelpdeskAI() {
  const [tab, setTab] = useState("virtual-it"); // 'virtual-it', 'incidents', 'tickets', 'services', 'emails', 'settings', 'billing'
  const [incidents, setIncidents] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [services, setServices] = useState([]);
  const [emailLog, setEmailLog] = useState([]);
  const [viewEmail, setViewEmail] = useState(null);
  const [orgConfig, setOrgConfig] = useState({
    name: "Primary Organization",
    support_phone: "+234 916 202 9201",
    support_email: "it-support@company.com",
    allstaff_email: "all-staff@company.com",
    incident_sla_minutes: 10,
    ticket_sla_hours: 1,
    enable_global_kb: false
  });
  const [subscription, setSubscription] = useState({
    status: "TRIALING",
    plan_type: "TRIAL",
    trial_end: new Date(Date.now() + 28 * 86400000).toISOString()
  });
  const [customArticles, setCustomArticles] = useState([]);
  const [teams, setTeams] = useState([]);
  const [members, setMembers] = useState([]);
  const [settingsSubTab, setSettingsSubTab] = useState("company"); // 'company' | 'teams' | 'users'

  // Light / Dark Theme State
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("bizadesk_theme") || "dark";
    } catch (_) {
      return "dark";
    }
  });

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem("bizadesk_theme", next);
    } catch (_) {
      // Ignored
    }
  };

  // User Authentication & RBAC state
  const [currentUser, setCurrentUser] = useState(null);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  // Platform Master Workspace ID (resolved once on login for individual users)
  const [masterOrgId, setMasterOrgId] = useState(null);

  // Marketing Landing Page vs Auth View for public visitors
  // Shows AuthScreen when URL contains auth parameters (recovery, signup confirmation, etc) or #login
  const [showAuthScreen, setShowAuthScreen] = useState(() => {
    if (typeof window === "undefined") return false;
    const hash = window.location.hash || "";
    const search = window.location.search || "";
    return (
      hash.includes("access_token") || 
      hash.includes("type=recovery") || 
      hash.includes("type=signup") || 
      hash.includes("type=invite") ||
      search.includes("code=") ||
      hash === "#login" ||
      search.includes("login=true")
    );
  });

  // ── Dedicated White-Label Customer Support Portal state (?portal=slug) ──
  const [portalSlug] = useState(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const slugFromUrl = params.get("portal");
    if (slugFromUrl) {
      try {
        sessionStorage.setItem("bizadesk_active_portal", slugFromUrl);
      } catch (_) {}
      return slugFromUrl;
    }
    try {
      return sessionStorage.getItem("bizadesk_active_portal") || null;
    } catch (_) {
      return null;
    }
  });
  const [portalOrg, setPortalOrg] = useState(null);
  const [portalLoading, setPortalLoading] = useState(Boolean(portalSlug));

  // ── Direct URL Links for Google OAuth & Public Compliance (?privacy=true or ?terms=true) ──
  const [legalRoute, setLegalRoute] = useState(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash || "";
    if (params.get("privacy") === "true" || hash.includes("privacy")) return "privacy";
    if (params.get("terms") === "true" || hash.includes("terms")) return "terms";
    return null;
  });

  // Resolve Portal Org if ?portal= is in URL
  useEffect(() => {
    if (!portalSlug) {
      setPortalLoading(false);
      return;
    }

    let isMounted = true;
    async function resolvePortal() {
      try {
        const { data } = await supabase
          .from("organizations")
          .select("*")
          .or(`portal_slug.eq.${portalSlug},id.eq.${portalSlug}`)
          .maybeSingle();

        if (isMounted && data) {
          setPortalOrg(data);
        }
      } catch (err) {
        console.warn("Failed to load portal organization:", err);
      } finally {
        if (isMounted) setPortalLoading(false);
      }
    }

    resolvePortal();
    return () => { isMounted = false; };
  }, [portalSlug]);

  // In-App Notification Center
  const [notifications, setNotifications] = useState([
    {
      id: "notif-init",
      type: "system",
      title: "BizaDesk Operations Live",
      message: "Autonomous IT support and dynamic team routing system online.",
      time: Date.now() - 120000,
      read: false
    }
  ]);

  const [alertBanner, setAlertBanner] = useState(null);
  const [loading, setLoading] = useState(true);
  // Guard to prevent loadData() re-running on every token refresh
  const hasLoadedRef = useRef(false);

  // Modals
  const [newTicket, setNewTicket] = useState(false);
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [ticketForm, setTicketForm] = useState({ 
    title: "", 
    ticket_type: "Network Issue", 
    priority: "MEDIUM", 
    desc: "", 
    submitter: "",
    team: "Network Team",
    assigned_to: "auto"
  });
  const [newIncModal, setNewIncModal] = useState(false);
  const [incForm, setIncForm] = useState({ title: "", severity: "HIGH", app: "", team: "Database Team", desc: "" });
  const [_resolveModal, setResolveModal] = useState(null);
  const [_deleteConfirm, setDeleteConfirm] = useState(null);
  const [activeChatTicket, setActiveChatTicket] = useState(null);
  const [settlementTicket, setSettlementTicket] = useState(null);
  const [showMandatoryMfaEnroll, setShowMandatoryMfaEnroll] = useState(false);

  // RCA (Root Cause Analysis) resolution modal state
  const [rcaModal, setRcaModal] = useState(null);
  const [rcaForm, setRcaForm] = useState({ root_cause: "", resolution_actions: "", preventive_measure: "", affected_count: "" });
  const [submittingRca, setSubmittingRca] = useState(false);

  // Admin Ticket Re-Route modal state
  const [rerouteModalTicket, setRerouteModalTicket] = useState(null);
  const [cardRerouteTeam, setCardRerouteTeam] = useState("");
  const [cardRerouteTechId, setCardRerouteTechId] = useState("auto");
  const [savingCardReroute, setSavingCardReroute] = useState(false);

  // Tickets queue interactive filter states
  const [ticketStatusFilter, setTicketStatusFilter] = useState("ALL"); // 'ALL' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED'
  const [ticketTechFilter, setTicketTechFilter] = useState("ALL");     // 'ALL' | member.id
  const [ticketDateFilter, setTicketDateFilter] = useState("ALL");     // 'ALL' | 'TODAY' | '7DAYS' | '30DAYS'

  // Change Password modal state
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [cpNewPassword, setCpNewPassword] = useState("");
  const [cpConfirmPassword, setCpConfirmPassword] = useState("");
  const [cpShowNew, setCpShowNew] = useState(false);
  const [cpShowConfirm, setCpShowConfirm] = useState(false);
  const [cpLoading, setCpLoading] = useState(false);
  const [cpError, setCpError] = useState("");
  const [cpSuccess, setCpSuccess] = useState("");
  const [corporateBlockNotice, setCorporateBlockNotice] = useState(null); // { companyName, domain }
  const [accountSuspendedNotice, setAccountSuspendedNotice] = useState(null); // { name, email }

  const showBanner = (msg, color = "#6366f1") => {
    setAlertBanner({ msg, color });
    setTimeout(() => setAlertBanner(null), 5000);
  };

  const handleMarkAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    const activeOrgId = currentUserProfile?.org_id || orgConfig?.id;
    if (activeOrgId) {
      await supabase.from("user_notifications").update({ read: true }).eq("org_id", activeOrgId);
    }
  };

  const handleClearNotifications = async () => {
    setNotifications([]);
    const activeOrgId = currentUserProfile?.org_id || orgConfig?.id;
    if (activeOrgId) {
      await supabase.from("user_notifications").delete().eq("org_id", activeOrgId);
    }
  };

  const handleNotificationClick = async (notif) => {
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
    if (notif.id && !String(notif.id).startsWith("notif-")) {
      await supabase.from("user_notifications").update({ read: true }).eq("id", notif.id);
    }
    if (notif.type === "ticket" || notif.ticket_id) {
      setTab("tickets");
    } else if (notif.type === "incident") {
      setTab("incidents");
    }
  };

  // ── Resolve the Platform Master Workspace org ID (bizadoc.com) ──────────────
  // Called once on login. Result is cached in masterOrgId state.
  const resolveMasterOrgId = async () => {
    if (masterOrgId) return masterOrgId;
    let { data } = await supabase
      .from("organizations")
      .select("id")
      .eq("is_master_org", true)
      .limit(1)
      .maybeSingle();
    if (data?.id) {
      setMasterOrgId(data.id);
      return data.id;
    }
    // Fallback: match by domain or support email or name
    const { data: fallback } = await supabase
      .from("organizations")
      .select("id")
      .or("domain.eq.bizadoc.com,support_email.ilike.%bizadoc.com%,name.ilike.%bizadoc%")
      .limit(1)
      .maybeSingle();
    if (fallback?.id) {
      setMasterOrgId(fallback.id);
      try {
        await supabase.from("organizations").update({ is_master_org: true }).eq("id", fallback.id);
      } catch (_) {}
      return fallback.id;
    }
    return null;
  };

  const loadData = async (scopedOrgId) => {
    try {
      let activeOrgId = scopedOrgId || currentUserProfile?.org_id || orgConfig?.id;

      // 1. Resolve Organization record
      let orgData = null;
      if (activeOrgId) {
        const { data: o } = await supabase.from("organizations").select("*").eq("id", activeOrgId).maybeSingle();
        orgData = o;
      }
      if (!orgData) {
        const { data: firstOrg } = await supabase.from("organizations").select("*").limit(1).maybeSingle();
        orgData = firstOrg;
        if (firstOrg?.id) {
          activeOrgId = firstOrg.id;
        }
      }

      // Security: Strip sensitive secrets if current user is not an admin
      if (orgData) {
        const sanitizedOrg = { ...orgData };
        const isMaster = currentUser?.email?.toLowerCase().endsWith("@" + PLATFORM_MASTER_DOMAIN);
        const isAdminUser = isMaster || (currentUserProfile && currentUserProfile.role === "admin");
        if (!isAdminUser) {
          delete sanitizedOrg.resend_api_key;
          delete sanitizedOrg.smtp_pass;
        }
        // Ensure Master Org (bizadoc.com) always has enable_global_kb = true
        if (sanitizedOrg.is_master_org || sanitizedOrg.domain === PLATFORM_MASTER_DOMAIN || sanitizedOrg.support_email?.includes(PLATFORM_MASTER_DOMAIN)) {
          sanitizedOrg.enable_global_kb = true;
        }
        setOrgConfig(sanitizedOrg);
      }

      // 2. Scoped tenant queries with reasonable limits for speed and scalability
      let incQuery = supabase.from("incidents").select("*").order("opened_at", { ascending: false }).limit(50);
      let tktQuery = supabase.from("tickets").select("*").order("created", { ascending: false }).limit(100);
      let emlQuery = supabase.from("emails").select("*").order("sent_at", { ascending: false }).limit(100);
      let svcQuery = supabase.from("monitored_services").select("*");
      let teamQuery = supabase.from("teams").select("*").order("created_at", { ascending: true });
      let profQuery = supabase.from("profiles").select("*");
      let subQuery = supabase.from("subscriptions").select("*");
      let kbQuery = supabase.from("knowledge_base").select("*").order("created_at", { ascending: false });
      let notifQuery = supabase.from("user_notifications").select("*").order("created_at", { ascending: false }).limit(40);

      if (activeOrgId) {
        incQuery = incQuery.eq("org_id", activeOrgId);
        tktQuery = tktQuery.eq("org_id", activeOrgId);
        emlQuery = emlQuery.eq("org_id", activeOrgId);
        svcQuery = svcQuery.eq("org_id", activeOrgId);
        teamQuery = teamQuery.eq("org_id", activeOrgId);
        profQuery = profQuery.eq("org_id", activeOrgId);
        subQuery = subQuery.eq("org_id", activeOrgId);
        kbQuery = kbQuery.eq("org_id", activeOrgId);
        notifQuery = notifQuery.eq("org_id", activeOrgId);
      }

      const [
        { data: inc },
        { data: tkt },
        { data: eml },
        { data: svc },
        { data: sub },
        { data: teamsData },
        { data: profs },
        { data: kb },
        { data: notifsData }
      ] = await Promise.all([
        incQuery,
        tktQuery,
        emlQuery,
        svcQuery,
        subQuery.maybeSingle(),
        teamQuery,
        profQuery,
        kbQuery,
        notifQuery
      ]);

      if (inc) setIncidents(inc);
      if (tkt) setTickets(tkt);
      if (eml) setEmailLog(eml);
      if (svc) setServices(svc);
      if (sub) setSubscription(sub);
      if (teamsData) setTeams(teamsData);
      if (profs) setMembers(profs);

      // For individual users: also fetch global KB articles from the Master Org (bizadoc.com)
      // so they benefit from all published help articles without being part of that workspace.
      let allArticles = kb || [];
      const isMasterUser = currentUser?.email?.toLowerCase().endsWith("@" + PLATFORM_MASTER_DOMAIN);
      const isIndividual = 
        !isMasterUser && (
          currentUserProfile?.account_type === "individual" ||
          currentUser?.user_metadata?.account_type === "individual"
        );
      if (isIndividual) {
        const mOrgId = masterOrgId || await resolveMasterOrgId();
        if (mOrgId && mOrgId !== activeOrgId) {
          const { data: globalKb } = await supabase
            .from("knowledge_base")
            .select("*")
            .eq("org_id", mOrgId)
            .order("created_at", { ascending: false });
          if (globalKb?.length) {
            // Merge: deduplicate by article_id, master org articles appended after own articles
            const ownIds = new Set((kb || []).map(a => a.article_id || a.id));
            const extra = globalKb.filter(a => !ownIds.has(a.article_id || a.id));
            allArticles = [...(kb || []), ...extra];
          }
        }
      }
      setCustomArticles(allArticles);

      if (notifsData && notifsData.length > 0) {
        // Filter notifications based on role:
        // Admin: sees all org notifications
        // Technician: sees notifications assigned to them or their team or system alerts
        // User: sees notifications for tickets they created or general system alerts
        const userRoleLocal = isMasterUser ? "admin" : (currentUserProfile?.role || "user");
        const filteredNotifs = notifsData.filter(n => {
          if (userRoleLocal === "admin") return true;
          if (userRoleLocal === "technician") {
            return (
              !n.user_id || 
              n.user_id === currentUser?.id || 
              (n.assigned_to && currentUser?.email && n.assigned_to.toLowerCase().includes(currentUser.email.toLowerCase())) ||
              (n.assigned_to && currentUserProfile?.department && n.assigned_to.toLowerCase() === currentUserProfile.department.toLowerCase())
            );
          }
          // regular user:
          return (
            n.user_id === currentUser?.id || 
            n.type === "system" ||
            !n.user_id
          );
        });

        setNotifications(filteredNotifs.map(n => ({ ...n, time: n.created_at })));
      }
    } catch (err) {
      console.warn("Supabase loadData error (using local state):", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProfile = async (user) => {
    if (!user) {
      setCurrentUserProfile(null);
      return;
    }
    if (user.demoRole) {
      const { data: defaultOrg } = await supabase.from("organizations").select("id").limit(1).maybeSingle();
      const demoProfile = {
        id: user.id,
        org_id: defaultOrg?.id || null,
        role: user.demoRole,
        full_name: user.user_metadata?.full_name || user.email,
        email: user.email,
        department: user.demoRole === "technician" ? "Network Team" : user.demoRole === "admin" ? "IT Management" : "Operations"
      };
      setCurrentUserProfile(demoProfile);
      if (defaultOrg?.id) {
        loadData(defaultOrg.id);
      }
      return;
    }
    try {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (data) {
        // Enforce account suspension: if an admin deactivated this member, block access immediately
        if (data.is_active === false) {
          await supabase.auth.signOut();
          setCurrentUser(null);
          setCurrentUserProfile(null);
          setAccountSuspendedNotice({
            email: user.email,
            name: data.full_name || user.email
          });
          setLoading(false);
          return;
        }

        const userDomain = user.email && user.email.includes("@") ? user.email.split("@")[1].toLowerCase() : "";
        const isMasterOwner = userDomain === PLATFORM_MASTER_DOMAIN;
        const isIndividual = 
          !isMasterOwner && (
            data.account_type === "individual" || 
            user.user_metadata?.account_type === "individual"
          );
        const hasCompany = Boolean(user.user_metadata?.company_name);

        // 1. Existing Platform Owner Healing: Ensure bound to Master Org as admin & KB permanently active
        if (isMasterOwner) {
          const mOrgId = masterOrgId || await resolveMasterOrgId();
          if (mOrgId) {
            await supabase.from("organizations").update({ enable_global_kb: true, is_master_org: true }).eq("id", mOrgId);
          }
          const targetOrg = mOrgId || data.org_id;
          if (targetOrg) {
            await supabase.from("organizations").update({ enable_global_kb: true, is_master_org: true }).eq("id", targetOrg);
          }

          if (data.org_id !== targetOrg || data.role !== "admin" || data.account_type !== "business") {
            await supabase.from("profiles").update({ 
              ...(targetOrg ? { org_id: targetOrg } : {}),
              role: "admin", 
              account_type: "business" 
            }).eq("id", user.id);
            if (targetOrg) data.org_id = targetOrg;
            data.role = "admin";
            data.account_type = "business";
          }
        } 
        // 2. Existing Public Individual Healing: Ensure bound to Master Org as user
        else if (isIndividual && !hasCompany) {
          const mOrgId = masterOrgId || await resolveMasterOrgId();
          if (mOrgId && (data.org_id !== mOrgId || data.role !== "user" || data.account_type !== "individual")) {
            await supabase.from("profiles").update({ 
              org_id: mOrgId, 
              role: "user", 
              account_type: "individual" 
            }).eq("id", user.id);
            data.org_id = mOrgId;
            data.role = "user";
            data.account_type = "individual";
          }
        }

        setCurrentUserProfile(data);
        if (data.org_id) {
          loadData(data.org_id);
        } else {
          const { data: defaultOrg } = await supabase.from("organizations").select("id").limit(1).maybeSingle();
          if (defaultOrg?.id) {
            await supabase.from("profiles").update({ org_id: defaultOrg.id }).eq("id", user.id);
            setCurrentUserProfile({ ...data, org_id: defaultOrg.id });
            loadData(defaultOrg.id);
          } else {
            loadData();
          }
        }
      } else {
        // ── Profile not found by auth.uid: check if admin pre-provisioned this member by email ──
        // This handles the case where an admin added the user in Staff & Member Directory
        // before the user ever signed in (profile was created with a placeholder UUID).
        const { data: emailMatchedProfile } = await supabase
          .from("profiles")
          .select("*")
          .eq("email", user.email.toLowerCase().trim())
          .maybeSingle();

        if (emailMatchedProfile) {
          // If the pre-provisioned account is deactivated, block access
          if (emailMatchedProfile.is_active === false) {
            await supabase.auth.signOut();
            setCurrentUser(null);
            setCurrentUserProfile(null);
            setAccountSuspendedNotice({
              email: user.email,
              name: emailMatchedProfile.full_name || user.email
            });
            setLoading(false);
            return;
          }

          // ✅ Found pre-provisioned profile! Claim it by updating the id to this user's auth.uid
          // so all future lookups by id = auth.uid() succeed.
          try {
            await supabase.from("profiles").update({ id: user.id }).eq("email", user.email.toLowerCase().trim());
          } catch (_) {
            // If update fails (RLS), insert a new claimed record linking to their org
          }
          const claimedProfile = { ...emailMatchedProfile, id: user.id };
          setCurrentUserProfile(claimedProfile);
          loadData(emailMatchedProfile.org_id);
          return;
        }

        // No pre-provisioned profile found — Multi-Tenant Provisioning for brand-new signups
        let targetOrgId = null;
        const userDomain = user.email && user.email.includes("@") ? user.email.split("@")[1].toLowerCase() : "company.com";
        const isMasterOwner = userDomain === PLATFORM_MASTER_DOMAIN;

        // Consumer webmail domains are always individual public users
        const isConsumer = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com", "aol.com"].includes(userDomain);

        // Retrieve any pending OAuth choice selected on registration screen before Google redirect
        let pendingOAuth = null;
        try {
          const rawPending = sessionStorage.getItem("bizadesk_pending_oauth");
          if (rawPending) {
            pendingOAuth = JSON.parse(rawPending);
            sessionStorage.removeItem("bizadesk_pending_oauth");
          }
        } catch (_) {}

        let companyName = user.user_metadata?.company_name || pendingOAuth?.companyName;
        let accountType = user.user_metadata?.account_type || pendingOAuth?.accountType || (companyName ? "business" : "individual");
        let workspaceMode = user.user_metadata?.workspace_mode || pendingOAuth?.workspaceMode || "ENTERPRISE";

        // Consumer personal emails (e.g. @gmail.com) always link to Master Org as individual users
        if (isConsumer && !isMasterOwner) {
          accountType = "individual";
          companyName = null;
        }

        // Check if user domain belongs to an already-registered corporate workspace
        if (!isConsumer && !isMasterOwner) {
          const { data: existingCorpOrg } = await supabase
            .from("organizations")
            .select("id, name, domain")
            .eq("domain", userDomain)
            .maybeSingle();

          if (existingCorpOrg) {
            // Company is already registered on BizaDesk!
            // Security Rule: Subsequent users cannot self-register as admin or create rogue orgs.
            // They MUST be invited / created by the Admin first in TeamManagement.
            const { data: preCreatedProfile } = await supabase
              .from("profiles")
              .select("*")
              .eq("email", user.email.toLowerCase().trim())
              .maybeSingle();

            if (!preCreatedProfile) {
              // User has NOT been invited or pre-created by the company Admin!
              // Block login, sign out, and display corporate security invitation requirement.
              await supabase.auth.signOut();
              setCurrentUser(null);
              setCurrentUserProfile(null);
              setCorporateBlockNotice({
                companyName: existingCorpOrg.name,
                domain: userDomain
              });
              setLoading(false);
              return;
            } else {
              // User was invited by Admin! Bind them securely to their company org
              targetOrgId = existingCorpOrg.id;
              accountType = "business";
            }
          }
        }

        // If the user signed up as a public individual (no business / enterprise company name)
        // do NOT create an isolated empty org: link them directly to the Platform Master Workspace (bizadoc.com)
        // so they automatically inherit the master org's support channels, Paystack pricing, and knowledge base.
        if (accountType === "individual" && !companyName) {
          const mOrgId = masterOrgId || await resolveMasterOrgId();
          targetOrgId = mOrgId;
        } else if (companyName || accountType === "business") {
          const workspaceName = companyName?.trim() || `${user.user_metadata?.full_name || user.email.split("@")[0]}'s Workspace`;
          const rawSlug = userDomain && userDomain.includes(".") 
            ? userDomain.split(".")[0].toLowerCase() 
            : (companyName ? companyName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-") : `ws-${Date.now().toString(36)}`);
          
          // Create workspace organization record
          const { data: newOrg } = await supabase
            .from("organizations")
            .insert({
              name: workspaceName,
              support_email: user.email,
              support_phone: "+234 916 202 9201",
              allstaff_email: accountType === "business" ? `all-staff@${userDomain}` : user.email,
              incident_sla_minutes: 10,
              ticket_sla_hours: 1,
              enable_global_kb: (accountType === "individual" || userDomain === PLATFORM_MASTER_DOMAIN) ? true : false,
              workspace_mode: workspaceMode,
              portal_slug: rawSlug,
              remote_fee: 3500,
              physical_visit_fee: 10000,
              // Auto-flag as Master Workspace if the owner registers with the platform domain
              is_master_org: accountType === "business" && userDomain === PLATFORM_MASTER_DOMAIN
            })
            .select()
            .single();

          if (newOrg?.id) {
            targetOrgId = newOrg.id;
            try {
              // Seed default teams for this workspace
              await supabase.from("teams").insert([
                { org_id: newOrg.id, team_name: "IT Helpdesk", alert_email: user.email, is_default: true },
                { org_id: newOrg.id, team_name: "Network Team", alert_email: user.email, is_default: false },
                { org_id: newOrg.id, team_name: "Database Team", alert_email: user.email, is_default: false },
                { org_id: newOrg.id, team_name: "Security Team", alert_email: user.email, is_default: false }
              ]);

              // Seed initial 30-day trial subscription
              await supabase.from("subscriptions").insert({
                org_id: newOrg.id,
                status: "TRIALING",
                plan_type: "TRIAL",
                trial_end: new Date(Date.now() + 30 * 86400000).toISOString()
              });

              // Send branded welcome email to newly confirmed user
              sendWelcomeEmail(user, newOrg).catch(() => {});
            } catch (seedErr) {
              console.warn("Could not seed default teams or subscription:", seedErr);
            }
          }
        }

        // Assigned role:
        // - Public individuals linked to master org: role is 'user'
        // - Workspace owners creating their business workspace: role is 'admin'
        // - Master owner (helpdesk@bizadoc.com): role is 'admin'
        const assignedRole = (accountType === "individual" && !isMasterOwner)
          ? "user"
          : (targetOrgId || isMasterOwner) ? "admin" : (user.user_metadata?.role || "user");

        const fallbackProfile = {
          id: user.id,
          org_id: targetOrgId,
          role: assignedRole,
          full_name: user.user_metadata?.full_name || user.email.split("@")[0],
          email: user.email,
          department: user.user_metadata?.department || (assignedRole === "admin" ? "IT Administration" : "Public Customer"),
          account_type: isMasterOwner ? "business" : (user.user_metadata?.account_type || (accountType === "individual" ? "individual" : "business"))
        };

        try {
          await supabase.from("profiles").insert(fallbackProfile);
        } catch (_) {
          // Ignored
        }
        setCurrentUserProfile(fallbackProfile);
        loadData(targetOrgId);
      }
    } catch (err) {
      console.warn("Error fetching profile:", err);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setCurrentUser(session.user);
        fetchProfile(session.user);
      }
      setAuthChecked(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Auto-open password reset modal on recovery link click
      if (event === "PASSWORD_RECOVERY") {
        setShowChangePassword(true);
        showBanner("🔑 Enter your new password below to complete password reset.", "#6366f1");
      }
      // Only process SIGNED_IN once per session to avoid re-fetching on token refresh
      if (session?.user && (event === "SIGNED_IN" || event === "PASSWORD_RECOVERY")) {
        setCurrentUser(session.user);
        fetchProfile(session.user);
      } else if (!session && event === "SIGNED_OUT") {
        setCurrentUser(null);
        setCurrentUserProfile(null);
        hasLoadedRef.current = false;
      }
    });

    loadData();

    return () => subscription?.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    if (currentUser?.demoRole) {
      setCurrentUser(null);
      setCurrentUserProfile(null);
      return;
    }
    await supabase.auth.signOut();
    setCurrentUser(null);
    setCurrentUserProfile(null);
  };

  // ── Technician Break Overdue Monitor ────────────────────────────────────────
  useEffect(() => {
    const isTech = currentUserProfile?.role === "technician";
    if (!isTech || !currentUserProfile?.break_started_at) return;
    const interval = setInterval(() => {
      const elapsed = Date.now() - currentUserProfile.break_started_at;
      const durationMs = (currentUserProfile.break_duration_minutes || 15) * 60000;
      if (elapsed > durationMs && !currentUserProfile.break_overdue) {
        supabase
          .from("profiles")
          .update({ break_overdue: true })
          .eq("id", currentUserProfile.id)
          .then(() => {
            setCurrentUserProfile(prev => ({ ...prev, break_overdue: true }));
          })
          .catch(err => console.warn("Failed to flag overdue break:", err));
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [currentUserProfile?.role, currentUserProfile?.break_started_at, currentUserProfile?.break_duration_minutes, currentUserProfile?.break_overdue, currentUserProfile?.id]);

  // ── PCI-DSS / ISO 27001 Inactivity Session Timeout (15 minutes) ──────
  // Automatically signs the user out after 15 minutes of inactivity for security compliance
  useEffect(() => {
    if (!currentUser) return;

    const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
    let idleTimer = null;

    const resetIdleTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(async () => {
        await handleSignOut();
        setShowAuthScreen(true);
        showBanner("🔒 Session Expired: Signed out after 15 minutes of inactivity for security compliance.", "#f97316");
      }, IDLE_TIMEOUT_MS);
    };

    const activityEvents = ["mousedown", "keydown", "scroll", "touchstart", "click"];
    activityEvents.forEach(evt => window.addEventListener(evt, resetIdleTimer, { passive: true }));
    resetIdleTimer();

    return () => {
      clearTimeout(idleTimer);
      activityEvents.forEach(evt => window.removeEventListener(evt, resetIdleTimer));
    };
  }, [currentUser]);

  // ── Mandatory 2FA Check for Enforced Workspaces ─────────────────────────
  useEffect(() => {
    if (!currentUser || currentUser?.demoRole) return;
    const checkMfaEnforcement = async () => {
      try {
        const isEnforced = orgConfig?.enforce_mfa === true;
        const isPrivileged = currentUserProfile?.role === "admin" || currentUserProfile?.role === "technician";
        if (isEnforced && isPrivileged) {
          const { data, error } = await supabase.auth.mfa.listFactors();
          if (!error) {
            const verifiedTotp = (data?.totp || []).filter(f => f.status === "verified");
            if (verifiedTotp.length === 0) {
              setShowMandatoryMfaEnroll(true);
            }
          }
        }
      } catch (e) {
        console.warn("MFA check failed:", e);
      }
    };

    if (orgConfig && currentUserProfile) {
      checkMfaEnforcement();
    }
  }, [currentUser, orgConfig?.enforce_mfa, currentUserProfile?.role]);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setCpError("");
    setCpSuccess("");
    if (cpNewPassword.length < 8) {
      setCpError("Password must be at least 8 characters.");
      return;
    }
    if (cpNewPassword !== cpConfirmPassword) {
      setCpError("Passwords do not match.");
      return;
    }
    setCpLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: cpNewPassword });
      if (error) throw error;
      setCpSuccess("✅ Password updated successfully! You can now close this dialog.");
      setCpNewPassword("");
      setCpConfirmPassword("");
    } catch (err) {
      setCpError(err.message || "Failed to update password.");
    } finally {
      setCpLoading(false);
    }
  };

  // ── Supabase Realtime WebSocket Subscriptions ──────────────────────────────
  useEffect(() => {
    const activeOrgId = currentUserProfile?.org_id || orgConfig?.id;
    if (!activeOrgId) return; // Don't subscribe until org is known

    const channel = supabase
      .channel(`helpdeskiq-realtime-${activeOrgId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tickets",
          filter: `org_id=eq.${activeOrgId}` // Server-side org filter — no cross-tenant leakage
        },
        (payload) => {
          if (activeOrgId && payload.new?.org_id && payload.new.org_id !== activeOrgId) {
            return;
          }

          if (payload.eventType === "INSERT") {
            setTickets(prev => {
              if (prev.some(t => t.id === payload.new.id)) return prev;
              return [payload.new, ...prev];
            });
            playNotificationChime();
            setNotifications(prev => [
              {
                id: `notif-${Date.now()}`,
                type: "ticket",
                ticket_id: payload.new.id,
                title: `New Ticket: ${payload.new.id}`,
                message: `"${payload.new.title}" assigned to ${payload.new.assignee_name || "Support"}.`,
                time: Date.now(),
                read: false,
                assigned_to: payload.new.assignee_name
              },
              ...prev
            ]);
          } else if (payload.eventType === "UPDATE") {
            setTickets(prev => prev.map(t => t.id === payload.new.id ? payload.new : t));
          } else if (payload.eventType === "DELETE") {
            setTickets(prev => prev.filter(t => t.id !== payload.old.id));
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "incidents",
          filter: `org_id=eq.${activeOrgId}` // Server-side org filter
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setIncidents(prev => {
              if (prev.some(i => i.id === payload.new.id)) return prev;
              return [payload.new, ...prev];
            });
            playNotificationChime();
            showBanner(`🚨 Realtime Alert: New Incident ${payload.new.id} Detected!`, "#ef4444");
          } else if (payload.eventType === "UPDATE") {
            setIncidents(prev => prev.map(i => i.id === payload.new.id ? payload.new : i));
          } else if (payload.eventType === "DELETE") {
            setIncidents(prev => prev.filter(i => i.id !== payload.old.id));
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "organizations",
          filter: `id=eq.${activeOrgId}`
        },
        (payload) => {
          if (payload.new) {
            setOrgConfig(prev => ({ ...prev, ...payload.new }));
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "knowledge_base",
          filter: `org_id=eq.${activeOrgId}`
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setCustomArticles(prev => prev.some(a => a.id === payload.new.id) ? prev : [payload.new, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setCustomArticles(prev => prev.map(a => a.id === payload.new.id ? payload.new : a));
          } else if (payload.eventType === "DELETE") {
            setCustomArticles(prev => prev.filter(a => a.id !== payload.old.id));
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "teams",
          filter: `org_id=eq.${activeOrgId}`
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setTeams(prev => prev.some(t => t.id === payload.new.id) ? prev : [...prev, payload.new]);
          } else if (payload.eventType === "UPDATE") {
            setTeams(prev => prev.map(t => t.id === payload.new.id ? payload.new : t));
          } else if (payload.eventType === "DELETE") {
            setTeams(prev => prev.filter(t => t.id !== payload.old.id));
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
          filter: `org_id=eq.${activeOrgId}`
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setMembers(prev => prev.some(m => m.id === payload.new.id) ? prev : [...prev, payload.new]);
          } else if (payload.eventType === "UPDATE") {
            setMembers(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m));
            setCurrentUserProfile(prev => (prev && prev.id === payload.new.id ? { ...prev, ...payload.new } : prev));
          } else if (payload.eventType === "DELETE") {
            setMembers(prev => prev.filter(m => m.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserProfile?.org_id, orgConfig?.id]);

  // ── Smart Incident Routing ─────────────────────────────────────────────────
  // Given a failure type string, resolve the correct team from loaded teams
  const resolveTeamForFailure = (failureType, serviceRoutingRules) => {
    // 1. Check service-specific rules first
    if (serviceRoutingRules && serviceRoutingRules[failureType]) {
      const teamId = serviceRoutingRules[failureType];
      const team = teams.find(t => t.id === teamId);
      if (team) return team;
    }
    // 2. Fall back to default rule in service routing
    if (serviceRoutingRules && serviceRoutingRules["default"]) {
      const teamId = serviceRoutingRules["default"];
      const team = teams.find(t => t.id === teamId);
      if (team) return team;
    }
    // 3. Fall back to org-wide default team
    const defaultTeam = teams.find(t => t.is_default);
    if (defaultTeam) return defaultTeam;
    // 4. Fall back to first team
    return teams[0] || { team_name: "IT Helpdesk", alert_email: orgConfig.support_email };
  };

  // Detect failure type from a health check error
  const detectFailureType = (error, statusCode, responseBody, responseTimeMs) => {
    if (!statusCode || error?.name === "TypeError") return "connection_refused";
    if (responseTimeMs > 3000) return "slow_response";
    if (statusCode >= 500) {
      const body = (responseBody || "").toLowerCase();
      if (body.includes("database") || body.includes("sql") || body.includes("query") || body.includes("connection pool") || body.includes("pg ")) {
        return "body_db_keyword";
      }
      return "http_5xx";
    }
    if (statusCode >= 400) return "http_4xx";
    return "default";
  };

  // ── Email Builder & Dispatch Helpers ─────────────────────────────────────
  const APP_URL = import.meta.env.VITE_APP_URL || (typeof window !== "undefined" ? window.location.origin : "https://desk.bizadoc.com");

  const saveEmail = async (data) => {
    if (!data) return;
    const payload = {
      ...data,
      org_id: orgConfig?.id || currentUserProfile?.org_id || null,
      sent_at: Date.now()
    };
    await supabase.from("emails").insert(payload);

    // If Resend is configured, also dispatch real email to recipient's inbox
    if (orgConfig?.email_provider === "resend" && (orgConfig?.resend_api_key || orgConfig?.id)) {
      sendEmailViaResend({
        to: data.to_address,
        subject: data.subject,
        body: data.body,
        html: data.html,
        apiKey: orgConfig?.resend_api_key,
        fromEmail: orgConfig?.resend_from_email,
        orgId: orgConfig?.id
      }).catch(err => console.warn("Background email dispatch notice:", err));
    }
  };

  const buildEmail = (inc, emailType) => {
    const ageMins = Math.floor((Date.now() - (inc.opened_at || Date.now())) / 60000);
    const templateData = {
      incident_id: inc.id,
      title: inc.title,
      application: inc.app,
      severity: inc.severity,
      team: inc.team,
      time_open: String(ageMins),
      time_detected: fmtTime(inc.opened_at || Date.now()),
      resolved_by: inc.resolved_by || inc.assignee || inc.team || "IT Operations",
      company_name: orgConfig?.name || "Corporate",
      description: inc.description || "System anomaly detected.",
      rca_summary: inc.rca_summary || inc.description || "Issue investigated and resolved.",
      root_cause: inc.root_cause || "Not specified",
      resolution_actions: inc.resolution_actions || "Systems verified and operating normally.",
      preventive_measure: inc.preventive_measure || "Continuous telemetry monitoring active.",
      resolution_note: inc.rca_summary || inc.description || "Issue has been resolved successfully.",
      portal_url: APP_URL
    };

    const rawTemplate = orgConfig?.email_templates?.[emailType] 
      || DEFAULT_INCIDENT_TEMPLATES[emailType]?.body 
      || DEFAULT_INCIDENT_TEMPLATES.initial.body;

    const bodyText = fillTemplate(rawTemplate, templateData);

    const subjectTemplate = orgConfig?.email_templates?.[emailType]?.subject || DEFAULT_INCIDENT_TEMPLATES[emailType]?.subject;
    const finalSubject = subjectTemplate ? fillTemplate(subjectTemplate, templateData) : `[${inc.severity}] Incident Alert: ${inc.title} — ${inc.app}`;

    const targetTeamRecord = teams.find(t => t.team_name.toLowerCase() === (inc.team || "").toLowerCase());
    const teamAlertEmail = targetTeamRecord?.alert_email || orgConfig?.support_email || "helpdesk@bizadoc.com";
    const supervisorEmail = orgConfig?.incident_manager_email || targetTeamRecord?.supervisor_email || orgConfig?.support_email || "helpdesk@bizadoc.com";
    const allStaffEmail = orgConfig?.allstaff_email || "all-staff@company.com";

    const recipients = {
      initial: teamAlertEmail,
      manager_escalation: supervisorEmail,
      allstaff: allStaffEmail,
      followup: teamAlertEmail,
      resolution: allStaffEmail
    };

    const html = generateBrandedHtmlEmail({
      title: finalSubject,
      bodyText,
      badgeText: `${inc.severity} INCIDENT NOTIFICATION`,
      badgeColor: inc.severity === "CRITICAL" ? "#dc2626" : inc.severity === "HIGH" ? "#ea580c" : "#2563eb",
      badgeBg: inc.severity === "CRITICAL" ? "#fef2f2" : inc.severity === "HIGH" ? "#fff7ed" : "#eff6ff",
      badgeBorder: inc.severity === "CRITICAL" ? "#fecaca" : inc.severity === "HIGH" ? "#fed7aa" : "#bfdbfe",
      orgConfig,
      details: [
        { label: "Incident ID", value: inc.id },
        { label: "Service / App", value: inc.app },
        { label: "Assigned Team", value: inc.team },
        { label: "Status", value: emailType === "resolution" ? "RESOLVED" : "ACTIVE / OPEN" }
      ]
    });

    return {
      inc_id: inc.id,
      email_type: emailType,
      to_address: recipients[emailType] || "helpdesk@bizadoc.com",
      subject: finalSubject,
      body: bodyText,
      html
    };
  };

  const buildTicketEmail = (ticket, emailType, extraNotes = "") => {
    const templateData = {
      ticket_id: ticket.id,
      submitter: ticket.submitter || "Valued Employee",
      title: ticket.title,
      category: ticket.ticket_type || "General Support",
      priority: ticket.priority || "MEDIUM",
      assigned_to: ticket.assignee_name || "Assigned Technician",
      status: ticket.status || "OPEN",
      update_note: extraNotes || `Status updated to ${ticket.status}`,
      resolution_note: extraNotes || "Issue has been resolved successfully.",
      company_name: orgConfig?.name || "Corporate",
      portal_url: APP_URL,
      team: ticket.team || orgConfig?.email_footer?.team_name || "IT Helpdesk Team"
    };

    const rawTemplate = orgConfig?.email_templates?.[emailType] 
      || DEFAULT_TICKET_TEMPLATES[emailType]?.body 
      || DEFAULT_TICKET_TEMPLATES.ticket_created.body;

    const bodyText = fillTemplate(rawTemplate, templateData);

    const subjects = {
      ticket_created: `[${ticket.id}] Support Request Received: ${ticket.title}`,
      ticket_assigned: `[${ticket.id}] Assigned: ${ticket.title}`,
      ticket_updated: `[${ticket.id}] Status Update: ${ticket.title}`,
      ticket_resolved: `[${ticket.id}] RESOLVED: ${ticket.title}`
    };

    const html = generateBrandedHtmlEmail({
      title: subjects[emailType] || `Ticket ${ticket.id}`,
      bodyText,
      badgeText: `${ticket.priority} TICKET`,
      badgeColor: ticket.priority === "URGENT" || ticket.priority === "HIGH" ? "#dc2626" : "#2563eb",
      badgeBg: ticket.priority === "URGENT" || ticket.priority === "HIGH" ? "#fef2f2" : "#eff6ff",
      badgeBorder: ticket.priority === "URGENT" || ticket.priority === "HIGH" ? "#fecaca" : "#bfdbfe",
      orgConfig,
      details: [
        { label: "Ticket ID", value: ticket.id },
        { label: "Category", value: ticket.ticket_type || "General" },
        { label: "Assigned To", value: ticket.assignee_name || "Unassigned" },
        { label: "Status", value: ticket.status }
      ]
    });

    let recipient = "";
    if (emailType === "ticket_assigned") {
      const techUser = members?.find(m => m.id === ticket.assigned_to);
      recipient = techUser?.email || orgConfig?.support_email || "helpdesk@bizadoc.com";
    } else {
      recipient = (ticket.submitter && ticket.submitter.includes("@")) 
        ? ticket.submitter 
        : currentUser?.email || orgConfig?.support_email || "helpdesk@bizadoc.com";
    }

    return {
      ticket_id: ticket.id,
      email_type: emailType,
      to_address: recipient,
      subject: subjects[emailType] || `[${ticket.id}] ${ticket.title}`,
      body: bodyText,
      html
    };
  };

  // Multi-Tier Incident Escalation Ladder Check (Tier 1 -> Tier 2 -> Tier 3)
  useEffect(() => {
    const _tier1ThresholdMs = (orgConfig.incident_sla_minutes || 10) * 60000;
    const tier2ThresholdMs = 15 * 60000; // 15 mins -> Escalate to IT Lead / Dept Manager
    const tier3ThresholdMs = 30 * 60000; // 30 mins -> Escalate to All-Staff ONLY if CRITICAL

    const check = setInterval(async () => {
      for (const inc of incidents) {
        if (inc.resolved) continue;
        const age = Date.now() - inc.opened_at;
        const currentTier = inc.escalation_tier || 1;

        // ── Tier 2 Escalation (at 15 mins) ──────────────────────────────────
        if (age >= tier2ThresholdMs && currentTier < 2) {
          const emailData = buildEmail(inc, "manager_escalation");
          if (emailData) await saveEmail(emailData);
          await supabase.from("incidents").update({ escalation_tier: 2, status: "TIER2_ESCALATED" }).eq("id", inc.id);
          showBanner(`⚠️ Tier 2 Escalation: ${inc.id} escalated to IT Manager`, "#f97316");
          loadData();
          continue;
        }

        // ── Tier 3 Escalation (at 30+ mins) ─────────────────────────────────
        if (age >= tier3ThresholdMs && currentTier < 3) {
          const isCritical = inc.severity === "CRITICAL";
          const emailData = buildEmail(inc, "allstaff");
          if (emailData) await saveEmail(emailData);
          await supabase.from("incidents").update({ 
            escalation_tier: 3, 
            escalated: true, 
            status: isCritical ? "CRITICAL_ALL_STAFF_ESCALATED" : "TIER3_EXECUTIVE_ESCALATED" 
          }).eq("id", inc.id);

          showBanner(`🚨 Tier 3 Escalation: ${inc.id} (${isCritical ? "All-Staff Notified" : "Executive Notified"})`, "#ef4444");
          loadData();
        }
      }
    }, 10000);
    return () => clearInterval(check);
  }, [incidents, orgConfig]);

  // Dynamic Ticket SLA Breach Check
  useEffect(() => {
    const ticketThresholdMs = (orgConfig.ticket_sla_hours || 1) * 3600000;
    const check = setInterval(async () => {
      for (const t of tickets) {
        if (t.status === "RESOLVED" || t.sla_breached) continue;
        if (Date.now() - t.created >= ticketThresholdMs) {
          await supabase.from("tickets").update({ 
            sla_breached: true,
            breached_at: Date.now()
          }).eq("id", t.id);

          try {
            await supabase.from("session_audit_logs").insert({
              org_id: t.org_id || orgConfig?.id,
              user_name: t.assignee_name || "Unassigned",
              action: "SLA_BREACHED",
              details: `Ticket ${t.id} breached SLA (${orgConfig.ticket_sla_hours || 1}h target) in queue "${t.team}". Assigned technician: ${t.assignee_name}`
            });
          } catch (_) {}

          showBanner(`⚠️ SLA BREACHED — Ticket ${t.id} open over ${orgConfig.ticket_sla_hours || 1} hour(s)!`, "#f97316");
          loadData();
        }
      }
    }, 30000);
    return () => clearInterval(check);
  }, [tickets, orgConfig]);

  // ── Automated Background Service Health Monitor (Every 60 Seconds) ─────────
  useEffect(() => {
    if (!services || services.length === 0) return;

    const monitorInterval = setInterval(async () => {
      for (const svc of services) {
        if (!svc.health_url) continue;

        try {
          const ping = await pingEndpoint(svc.health_url);
          const threshold = svc.health_alert_threshold ?? 70;
          const healthPct = ping.health_pct ?? 100;
          const isDown = ping.status === "DOWN";
          const isBelowThreshold = healthPct < threshold;
          const prevHealthPct = svc.health_pct ?? 100;
          const wasAboveThreshold = prevHealthPct >= threshold && svc.status !== "DOWN";

          // Always update DB and local state with latest ping result
          const updatedFields = {
            status: isDown ? "DOWN" : isBelowThreshold ? "DEGRADED" : "OPERATIONAL",
            health_pct: healthPct,
            latency_ms: ping.latency,
            last_checked_at: ping.checked_at,
          };

          if (svc.id) {
            await supabase.from("monitored_services").update(updatedFields).eq("id", svc.id);
          }
          // Patch local state without triggering loadData
          setServices(prev => prev.map(s => s.id === svc.id ? { ...s, ...updatedFields } : s));

          // Guard: no duplicate open incidents for same service
          const openExisting = incidents.find(inc => inc.app === svc.name && !inc.resolved);
          if (openExisting) continue;

          if (isDown && svc.status !== "DOWN") {
            // Full outage escalation
            const failureType = ping.error?.includes("Timeout") ? "slow_response" : "connection_refused";
            const targetTeamObj = resolveTeamForFailure(failureType, svc.routing_rules);
            const teamName = targetTeamObj?.team_name || targetTeamObj || "IT Helpdesk";
            await triggerIncident({
              title: `Automated Outage: ${svc.name} Unreachable`,
              severity: "CRITICAL",
              app: svc.name,
              team: teamName,
              desc: `Autonomous Health Monitor detected that ${svc.name} (${svc.health_url}) is DOWN. Latency: ${ping.latency}ms. Diagnosis: ${ping.error || "Connection refused / Host unreachable."}`
            });
          } else if (isBelowThreshold && wasAboveThreshold) {
            // Threshold breach escalation (degraded but not fully down)
            const targetTeamObj = resolveTeamForFailure("slow_response", svc.routing_rules);
            const teamName = targetTeamObj?.team_name || targetTeamObj || "IT Helpdesk";
            await triggerIncident({
              title: `Degraded Service: ${svc.name} below ${threshold}% health`,
              severity: "HIGH",
              app: svc.name,
              team: teamName,
              desc: `Health Monitor detected ${svc.name} has dropped to ${healthPct}% health — below the configured ${threshold}% alert threshold. Latency: ${ping.latency}ms. Investigating degradation, alerting ${teamName}.`
            });
          }
        } catch (err) {
          console.warn("Background monitor check error:", err);
        }
      }
    }, 60000);

    return () => clearInterval(monitorInterval);
  }, [services, incidents, teams]);

  const triggerIncident = async (formData) => {
    const incCode = `INC-${String(incidents.length + 1).padStart(3, "0")}`;
    const inc = {
      incident_code: incCode,
      org_id: orgConfig?.id || currentUserProfile?.org_id || null,
      title: sanitizeInput(formData.title),
      severity: formData.severity,
      status: "OPEN",
      team: formData.team,
      app: sanitizeInput(formData.app),
      opened_at: Date.now(),
      last_update: Date.now(),
      escalated: false,
      resolved: false,
      description: sanitizeInput(formData.desc),
      assignee: "Unassigned"
    };

    const { data: insertedInc, error } = await supabase.from("incidents").insert(inc).select().single();
    if (error) {
      showBanner(`Error: ${error.message}`, "#ef4444");
      return;
    }
    const realInc = insertedInc || inc;
    const displayIncId = realInc.incident_code || incCode;

    await saveEmail(buildEmail(realInc, "initial"));
    try {
      await supabase.from("user_notifications").insert({
        org_id: realInc.org_id,
        type: "incident",
        incident_id: realInc.id || displayIncId,
        title: `🚨 Incident ${displayIncId} Created: ${realInc.title}`,
        message: `Severity: ${realInc.severity} across ${realInc.app} assigned to ${realInc.team}.`,
        assigned_to: realInc.team,
        read: false,
        created_at: Date.now()
      });
    } catch (_) {
      // Ignored
    }
    showBanner(`🚨 ${displayIncId} Created — ${formData.team} Notified`, "#f97316");
    setNewIncModal(false);
    setIncForm({ title: "", severity: "HIGH", app: "", team: "Database Team", desc: "" });
    setIncidents(prev => [realInc, ...prev.filter(x => x.id !== realInc.id)]);
    loadData();
  };

  const resolveIncident = (inc) => {
    setRcaModal(inc);
    setRcaForm({
      root_cause: inc.root_cause || "",
      resolution_actions: inc.resolution_actions || "",
      preventive_measure: inc.preventive_measure || "",
      affected_count: inc.affected_count || ""
    });
  };

  const handleConfirmRcaResolution = async (e) => {
    if (e) e.preventDefault();
    if (!rcaModal) return;
    if (!rcaForm.root_cause.trim() || !rcaForm.resolution_actions.trim()) {
      showBanner("Please provide Root Cause and Actions Taken to complete resolution.", "#ef4444");
      return;
    }

    setSubmittingRca(true);
    try {
      const resolvedAt = Date.now();
      const resolvedBy = currentUserProfile?.full_name || currentUser?.email || "IT Specialist";
      const rcaSummary = `${rcaForm.root_cause.trim()}. Actions Taken: ${rcaForm.resolution_actions.trim()}`;

      const resolvedInc = {
        ...rcaModal,
        resolved: true,
        status: "RESOLVED",
        resolved_at: resolvedAt,
        resolved_by: resolvedBy,
        rca_summary: rcaSummary,
        root_cause: rcaForm.root_cause.trim(),
        resolution_actions: rcaForm.resolution_actions.trim(),
        preventive_measure: rcaForm.preventive_measure.trim() || null,
        affected_count: Number(rcaForm.affected_count) || 0,
        last_update: resolvedAt
      };

      await saveEmail(buildEmail(resolvedInc, "resolution"));
      await supabase.from("incidents").update({
        resolved: true,
        status: "RESOLVED",
        resolved_at: resolvedAt,
        resolved_by: resolvedBy,
        rca_summary: rcaSummary,
        root_cause: rcaForm.root_cause.trim(),
        resolution_actions: rcaForm.resolution_actions.trim(),
        preventive_measure: rcaForm.preventive_measure.trim() || null,
        affected_count: Number(rcaForm.affected_count) || 0,
        last_update: resolvedAt
      }).eq("id", rcaModal.id);

      try {
        await supabase.from("session_audit_logs").insert({
          org_id: rcaModal.org_id || orgConfig?.id,
          user_name: resolvedBy,
          action: "INCIDENT_RESOLVED_RCA",
          details: `Incident ${rcaModal.id} resolved with RCA by ${resolvedBy}. Cause: ${rcaForm.root_cause.trim()}`
        });
      } catch (_) {}

      showBanner(`✅ ${rcaModal.id} Resolved with RCA — All-staff notified`, "#22c55e");
      setRcaModal(null);
      loadData();
    } catch (err) {
      showBanner(`Resolution error: ${err.message}`, "#ef4444");
    } finally {
      setSubmittingRca(false);
    }
  };

  const sendFollowUp = async (inc) => {
    await saveEmail(buildEmail(inc, "followup"));
    await supabase.from("incidents").update({ last_update: Date.now() }).eq("id", inc.id);
    showBanner(`📧 Follow-up sent for ${inc.id}`, "#eab308");
    loadData();
  };

  // ── Technician Timed Break Handlers (Anti-Dodge Guardrails) ──────────────────
  const handleStartBreak = async (breakType, durationMinutes) => {
    if (!currentUserProfile?.id) return;
    const now = Date.now();
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          availability_status: "break",
          is_available: false,
          break_type: breakType,
          break_started_at: now,
          break_duration_minutes: durationMinutes,
          break_overdue: false
        })
        .eq("id", currentUserProfile.id);

      if (!error) {
        await supabase.from("session_audit_logs").insert({
          org_id: currentUserProfile.org_id || orgConfig?.id || null,
          user_name: currentUserProfile.full_name || currentUserProfile.email,
          action: `Started Break: ${breakType.toUpperCase()} (${durationMinutes}m)`,
          details: `Technician timed break initiated. Automatically excluded from ticket auto-routing.`
        });

        setCurrentUserProfile(prev => ({
          ...prev,
          availability_status: "break",
          is_available: false,
          break_type: breakType,
          break_started_at: now,
          break_duration_minutes: durationMinutes,
          break_overdue: false
        }));
        showBanner(`⏳ Break started (${breakType === "lunch" ? "Lunch" : breakType === "tea" ? "Bio/Tea" : "Meeting"} — ${durationMinutes}m). Ticket auto-routing is paused for you.`, "#f59e0b");
      }
    } catch (err) {
      console.error("Failed to start break:", err);
    }
  };

  const handleEndBreak = async () => {
    if (!currentUserProfile?.id) return;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          availability_status: "active",
          is_available: true,
          break_type: null,
          break_started_at: null,
          break_duration_minutes: null,
          break_overdue: false
        })
        .eq("id", currentUserProfile.id);

      if (!error) {
        await supabase.from("session_audit_logs").insert({
          org_id: currentUserProfile.org_id || orgConfig?.id || null,
          user_name: currentUserProfile.full_name || currentUserProfile.email,
          action: `Ended Break: RESUMED DUTY`,
          details: `Technician returned to active duty. Resumed receiving auto-assigned tickets.`
        });

        setCurrentUserProfile(prev => ({
          ...prev,
          availability_status: "active",
          is_available: true,
          break_type: null,
          break_started_at: null,
          break_duration_minutes: null,
          break_overdue: false
        }));
        showBanner("🟢 Welcome back! You are now Available and on duty.", "#10b981");
      }
    } catch (err) {
      console.error("Failed to end break:", err);
    }
  };

  const submitTicket = async (customTicketData) => {
    const rawTitle = customTicketData?.title || ticketForm.title;
    if (!rawTitle || !rawTitle.trim()) {
      showBanner("Please enter an issue title before submitting.", "#ef4444");
      return;
    }

    setSubmittingTicket(true);
    try {
      const ticketCode = customTicketData?.ticket_code || customTicketData?.id || `TKT-${String(100 + tickets.length + 1)}`;
      const teamMap = {
        "Network Issue": "Network Team",
        "Software Issue": "Application Support",
        "Database Issue": "Database Team",
        "Access Request": "Security Team",
        "Hardware Request": "Infrastructure Team",
        "Other": "IT Support"
      };

    // Fallback team: 1. Defined is_default team, 2. "IT Helpdesk", 3. First team in organization
    const defaultOrgTeam = teams.find(t => t.is_default)?.team_name || "IT Helpdesk";

    const chosenType = customTicketData?.ticket_type || ticketForm.ticket_type;
    const initialTeam = customTicketData?.team || ticketForm.team || teamMap[chosenType] || defaultOrgTeam;
    const chosenPriority = customTicketData?.priority || ticketForm.priority || "MEDIUM";
    const chosenAssigneeId = customTicketData?.assigned_to || ticketForm.assigned_to || "auto";

    // Strictly pure active technicians (Admins are NEVER assigned tickets)
    const pureTechs = members.filter(m => m.role === "technician" && m.is_active !== false);

    let effectiveTeam = initialTeam;
    let assignedTechName = "Unassigned";
    let assignedTechId = null;

    if (chosenAssigneeId && chosenAssigneeId !== "auto") {
      const foundTech = pureTechs.find(m => m.id === chosenAssigneeId);
      if (foundTech) {
        assignedTechId = foundTech.id;
        assignedTechName = foundTech.full_name || foundTech.email;
      }
    } else {
      // 1. Check technicians assigned to the selected team
      const teamTechs = pureTechs.filter(m => 
        m.department && m.department.toLowerCase() === initialTeam.toLowerCase()
      );
      const availableTeamTechs = teamTechs.filter(m => 
        m.is_available !== false && m.availability_status !== "away" && m.availability_status !== "leave" && m.availability_status !== "break" && !m.break_type
      );

      if (availableTeamTechs.length > 0) {
        const picked = availableTeamTechs[tickets.length % availableTeamTechs.length];
        assignedTechId = picked.id;
        assignedTechName = picked.full_name || picked.email;
        effectiveTeam = initialTeam;
      } else {
        // ⚡ FALLBACK QUEUE ROUTING: No technician in chosen team or all away!
        effectiveTeam = defaultOrgTeam;
        const fallbackTechs = pureTechs.filter(m => 
          (!m.department || m.department.toLowerCase() === defaultOrgTeam.toLowerCase() || 
           m.department.toLowerCase() === "it helpdesk" || m.department.toLowerCase() === "it support") &&
          m.is_available !== false && m.availability_status !== "away" && m.availability_status !== "leave" && m.availability_status !== "break" && !m.break_type
        );

        if (fallbackTechs.length > 0) {
          const picked = fallbackTechs[tickets.length % fallbackTechs.length];
          assignedTechId = picked.id;
          assignedTechName = picked.full_name || picked.email;
        } else {
          assignedTechId = null;
          assignedTechName = `Unassigned (${defaultOrgTeam} Queue)`;
        }
      }
    }

    // Capture Workstation Pre-Diagnostics
    const diagnostics = getSystemDiagnostics();

    // ── Individual-user ticket routing ───────────────────────────────────────
    // Individual users don't belong to a business org — route their tickets to
    // the Platform Master Workspace (bizadoc.com) so the owner's technicians
    // handle all public support requests in one place.
    const isIndividualUser = 
      currentUserProfile?.account_type === "individual" ||
      currentUser?.user_metadata?.account_type === "individual";
    let targetOrgId = orgConfig?.id || currentUserProfile?.org_id || null;
    if (isIndividualUser) {
      const mOrgId = masterOrgId || await resolveMasterOrgId();
      if (mOrgId) targetOrgId = mOrgId;
    }

    const t = {
      ticket_code: ticketCode,
      org_id: targetOrgId,
      title: sanitizeInput(customTicketData?.title || ticketForm.title),
      ticket_type: chosenType,
      priority: chosenPriority,
      description: sanitizeInput(customTicketData?.desc || ticketForm.desc),
      submitter: sanitizeInput(customTicketData?.submitter || ticketForm.submitter || currentUserProfile?.full_name || currentUser?.email || "Staff Member"),
      status: "OPEN",
      team: effectiveTeam,
      assigned_to: assignedTechId,
      assignee_name: assignedTechName,
      diagnostics: diagnostics,
      created: Date.now(),
      created_by: currentUser?.id || null,
      sla_breached: false,
      // Payment & Physical Visit Fields
      payment_status: customTicketData?.payment_status || "FREE",
      payment_amount: customTicketData?.payment_amount || 0,
      paystack_ref: customTicketData?.paystack_ref || null,
      support_type: customTicketData?.support_type || "REMOTE",
      visit_address: customTicketData?.visit_address || null,
      visit_city: customTicketData?.visit_city || null
    };

    let insertedTicket = t;
    try {
      const { data: inserted, error: insertError } = await supabase
        .from("tickets")
        .insert(t)
        .select()
        .single();
      if (!insertError && inserted) {
        insertedTicket = inserted;
      } else if (insertError) {
        console.warn("Tickets insert warning:", insertError);
      }
    } catch (err) {
      console.warn("Tickets insert exception:", err);
    }

    const displayId = insertedTicket.ticket_code || ticketCode;
    const realDbId = insertedTicket.id || displayId;

    // Dispatch In-App Notifications & Persist to Database for Next-Day Login
    const newNotif = {
      id: `notif-${Date.now()}`,
      type: "ticket",
      ticket_id: realDbId,
      title: `Ticket ${displayId} Routed & Assigned`,
      message: `"${t.title}" assigned to ${assignedTechName} (${effectiveTeam}) with ${t.priority} priority.`,
      time: Date.now(),
      read: false,
      assigned_to: assignedTechName
    };

    // Store in Supabase user_notifications so offline technicians see it on next login
    try {
      supabase.from("user_notifications").insert({
        org_id: t.org_id,
        user_id: assignedTechId,
        type: "ticket",
        ticket_id: realDbId,
        title: newNotif.title,
        message: newNotif.message,
        assigned_to: assignedTechName,
        read: false,
        created_at: Date.now()
      }).then(({ data }) => {
        if (data?.[0]?.id) newNotif.id = data[0].id;
      });
    } catch (_) {
      // Ignored
    }

    setNotifications(prev => [newNotif, ...prev]);
    playNotificationChime();

    // Dispatch Outbound White-Label Ticket Emails
    try {
      const createdMail = buildTicketEmail(insertedTicket, "ticket_created");
      if (createdMail) await saveEmail(createdMail);
    } catch (e) {
      console.warn("Could not dispatch ticket created email:", e);
    }

    if (assignedTechId) {
      try {
        const assignedMail = buildTicketEmail(insertedTicket, "ticket_assigned");
        if (assignedMail) await saveEmail(assignedMail);
      } catch (e) {
        console.warn("Could not dispatch ticket assigned email:", e);
      }
    }

    setNewTicket(false);
    setTicketForm({
      title: "",
      ticket_type: "Network Issue",
      priority: "MEDIUM",
      desc: "",
      submitter: "",
      team: teams[0]?.team_name || "Network Team",
      assigned_to: "auto"
    });

    setTickets(prev => [insertedTicket, ...prev.filter(x => x.id !== insertedTicket.id)]);
    showBanner(`🎫 Ticket ${displayId} Routed to ${assignedTechName} (${effectiveTeam})`, "#6366f1");
    loadData();
    return insertedTicket;
  } catch (err) {
    console.error("submitTicket error:", err);
    showBanner(`Could not submit ticket: ${err.message}`, "#ef4444");
  } finally {
    setSubmittingTicket(false);
  }
};

  // Status changer for tickets (OPEN -> IN_PROGRESS -> RESOLVED)
  const updateTicketStatus = async (t, newStatus) => {
    try {
      const activeOrgId = orgConfig?.id || currentUserProfile?.org_id;
      const techName = currentUserProfile?.full_name || currentUser?.email || "Technician";

      const updates = { status: newStatus };
      if (newStatus === "RESOLVED") {
        updates.resolved_at = Date.now();
        updates.resolved = true;
      }

      await supabase.from("tickets").update(updates).eq("id", t.id);

      // Notify the ticket submitter / creator in user_notifications
      const notifyMessage = newStatus === "IN_PROGRESS"
        ? `🛠️ Your ticket ${t.id} ("${t.title}") is now Work In Progress. Technician ${techName} is actively working on it.`
        : newStatus === "RESOLVED"
        ? `✅ Your ticket ${t.id} ("${t.title}") has been marked RESOLVED by Technician ${techName}.`
        : `Ticket ${t.id} status changed to ${newStatus}.`;

      const notifItem = {
        org_id: activeOrgId || t.org_id,
        user_id: t.created_by, // Dispatched directly to the creator!
        type: "ticket",
        ticket_id: t.id,
        title: `Ticket ${t.id} ${newStatus === "IN_PROGRESS" ? "Work In Progress (WIP)" : newStatus}`,
        message: notifyMessage,
        assigned_to: t.assignee_name || techName,
        read: false,
        created_at: Date.now()
      };

      try {
        await supabase.from("user_notifications").insert(notifItem);
      } catch (e) {
        console.warn("Could not insert status update notification:", e);
      }

      // Also log in session_audit_logs for admin compliance
      try {
        await supabase.from("session_audit_logs").insert({
          org_id: activeOrgId || t.org_id,
          user_name: techName,
          action: `Ticket ${t.id} status updated to ${newStatus}`,
          result: "SUCCESS",
          details: `Changed by ${techName} (${currentUserProfile?.role || "Staff"})`
        });
      } catch (_) {
        // Ignored
      }

      // Dispatch Outbound White-Label Ticket Update / Resolution Email
      try {
        if (newStatus === "RESOLVED") {
          const resolvedMail = buildTicketEmail({ ...t, status: newStatus }, "ticket_resolved", `Issue marked resolved by ${techName}.`);
          if (resolvedMail) await saveEmail(resolvedMail);
        } else if (newStatus === "IN_PROGRESS") {
          const updatedMail = buildTicketEmail({ ...t, status: newStatus }, "ticket_updated", `Work In Progress: Technician ${techName} is actively working on your ticket.`);
          if (updatedMail) await saveEmail(updatedMail);
        }
      } catch (e) {
        console.warn("Could not dispatch ticket status email:", e);
      }

      showBanner(
        newStatus === "RESOLVED"
          ? `✅ Ticket ${t.id} Resolved — User Notified`
          : `🛠️ Ticket ${t.id} marked In Progress (WIP) — User Notified`,
        newStatus === "RESOLVED" ? "#22c55e" : "#f59e0b"
      );
      loadData();
    } catch (err) {
      console.warn("Failed to update ticket status:", err);
      showBanner(`Error: ${err.message}`, "#ef4444");
    }
  };

  const handleReRouteTicket = async (e) => {
    if (e) e.preventDefault();
    if (!rerouteModalTicket) return;
    setSavingCardReroute(true);

    try {
      const targetTeam = cardRerouteTeam || rerouteModalTicket.team;
      const pureTechs = members.filter(m => m.role === "technician" && m.is_active !== false);
      let assignedTechId = null;
      let assignedTechName = null;

      if (cardRerouteTechId && cardRerouteTechId !== "auto") {
        const picked = pureTechs.find(m => m.id === cardRerouteTechId);
        if (picked) {
          assignedTechId = picked.id;
          assignedTechName = picked.full_name || picked.email;
        }
      } else {
        const teamTechs = pureTechs.filter(m => 
          (!m.department || m.department.toLowerCase() === targetTeam.toLowerCase() || m.department === "General IT" || m.department === "IT Support") &&
          m.is_available !== false && m.availability_status !== "away" && m.availability_status !== "leave" && m.availability_status !== "break" && !m.break_type
        );
        if (teamTechs.length > 0) {
          const picked = teamTechs[Math.floor(Math.random() * teamTechs.length)];
          assignedTechId = picked.id;
          assignedTechName = picked.full_name || picked.email;
        } else {
          assignedTechId = null;
          assignedTechName = `Unassigned (${targetTeam} Queue)`;
        }
      }

      const updates = {
        team: targetTeam,
        assigned_to: assignedTechId,
        assignee_name: assignedTechName
      };

      await supabase.from("tickets").update(updates).eq("id", rerouteModalTicket.id);

      const adminName = currentUserProfile?.full_name || currentUser?.email || "Admin";
      try {
        await supabase.from("session_audit_logs").insert({
          org_id: rerouteModalTicket.org_id || orgConfig?.id,
          user_name: adminName,
          action: `Re-routed Ticket ${rerouteModalTicket.id}`,
          result: "SUCCESS",
          details: `Transferred from ${rerouteModalTicket.team} to ${targetTeam} (Assigned: ${assignedTechName})`
        });
      } catch (_) {}

      try {
        await supabase.from("ticket_messages").insert({
          ticket_id: rerouteModalTicket.id,
          sender_id: currentUser?.id,
          sender_name: adminName,
          sender_role: "admin",
          message: `🔄 Ticket re-routed from [${rerouteModalTicket.team}] to [${targetTeam}]. Assigned technician: ${assignedTechName}.`,
          is_internal: true,
          created_at: Date.now()
        });
      } catch (_) {}

      showBanner(`Ticket re-routed to ${targetTeam} (${assignedTechName})`, "#22c55e");
      setRerouteModalTicket(null);
      loadData();
    } catch (err) {
      console.warn("Re-route failed:", err);
      showBanner(`Failed to re-route ticket: ${err.message}`, "#ef4444");
    } finally {
      setSavingCardReroute(false);
    }
  };

  const _closeTicket = async (t) => {
    await updateTicketStatus(t, "RESOLVED");
  };

  // 1-Click Paystack Refund Handler (Admin only)
  const _handleProcessRefund = async (t) => {
    if (!t.paystack_ref) {
      showBanner("Cannot refund: No Paystack transaction reference on this ticket.", "#ef4444");
      return;
    }

    const confirmRefund = window.confirm(
      `Issue 100% full refund of ₦${Number(t.payment_amount || 0).toLocaleString()} for Ticket ${t.id} to customer's card via Paystack?`
    );
    if (!confirmRefund) return;

    showBanner(`Processing Paystack refund for ${t.id}...`, "#6366f1");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || "";

      const res = await fetch("https://lebbchvpjgxzkkagmawu.supabase.co/functions/v1/process-refund", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ticketId: t.id,
          paystackRef: t.paystack_ref,
          amount: t.payment_amount,
          reason: `Unresolved support request: ${t.title}`
        })
      });

      const result = await res.json();
      if (!res.ok || result.error) {
        throw new Error(result.error || "Paystack refund call failed");
      }

      showBanner(`💸 Full Refund of ₦${Number(t.payment_amount || 0).toLocaleString()} Issued Successfully!`, "#22c55e");
      loadData();
    } catch (err) {
      console.warn("Refund error:", err);
      showBanner(`Refund Error: ${err.message}`, "#ef4444");
    }
  };

  // ── Universal Ticket Resolution Settlement (Admin Only) ─────────────────
  const handleProcessSettlement = async (settlement) => {
    const { action, ticketId, diagnosticFee, refundAmount, reasonNote, paystackRef, refundRef } = settlement;
    const targetTicket = tickets.find(t => t.id === ticketId) || settlementTicket;

    try {
      if (action === "CONFIRM_RESOLVED") {
        await updateTicketStatus(targetTicket, "RESOLVED");
        await supabase.from("tickets").update({
          settlement_status: "CONFIRM_RESOLVED",
          settlement_note: reasonNote || "Admin reviewed and confirmed resolution."
        }).eq("id", ticketId);

        showBanner(`✅ Ticket ${ticketId} resolved and confirmed closed!`, "#22c55e");
        setSettlementTicket(null);
        loadData();
        return;
      }

      // If a manual Paystack refund reference is provided (e.g. from an IT firm)
      if (refundRef && refundRef.startsWith("RFD_")) {
        const newPaymentStatus = action === "FULL_REFUND" ? "REFUNDED" : "PARTIALLY_REFUNDED";
        await supabase.from("tickets").update({
          payment_status: newPaymentStatus,
          refunded_amount: refundAmount,
          settlement_status: action,
          settlement_note: reasonNote || `Admin settled with refund (Ref: ${refundRef})`,
          refund_ref: refundRef,
          refunded_at: new Date().toISOString(),
          status: "RESOLVED"
        }).eq("id", ticketId);

        showBanner(`💸 Settlement recorded! Paystack Refund Ref: ${refundRef}`, "#22c55e");
        setSettlementTicket(null);
        loadData();
        return;
      }

      if (!paystackRef) {
        throw new Error("Cannot process refund: No Paystack payment reference found on this ticket.");
      }

      showBanner(`Processing Paystack ${action === "FULL_REFUND" ? "100% full" : "partial"} refund...`, "#6366f1");

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || "";

      const res = await fetch("https://lebbchvpjgxzkkagmawu.supabase.co/functions/v1/process-refund", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ticketId: ticketId,
          paystackRef: paystackRef,
          amount: refundAmount,
          paymentStatus: action === "FULL_REFUND" ? "REFUNDED" : "PARTIALLY_REFUNDED",
          settlementNote: reasonNote || (action === "FULL_REFUND" 
            ? `100% full refund issued by admin: ${targetTicket?.title}` 
            : `Partial refund of ₦${refundAmount} issued; ₦${diagnosticFee} retained for technician: ${targetTicket?.title}`)
        })
      });

      const result = await res.json();
      if (!res.ok || result.error) {
        throw new Error(result.error || "Paystack refund call failed");
      }

      if (action === "FULL_REFUND") {
        showBanner(`💸 100% Full Refund of ₦${Number(refundAmount).toLocaleString()} Issued Successfully!`, "#22c55e");
      } else {
        showBanner(`⚖️ Partial settlement complete! ₦${Number(refundAmount).toLocaleString()} refunded to customer, ₦${Number(diagnosticFee).toLocaleString()} retained for technician.`, "#22c55e");
      }

      setSettlementTicket(null);
      loadData();
    } catch (err) {
      console.error("Settlement error:", err);
      showBanner(`Settlement Error: ${err.message}`, "#ef4444");
      throw err;
    }
  };

  const deleteIncident = async (inc) => {
    await supabase.from("incidents").delete().eq("id", inc.id);
    showBanner(`🗑️ Incident ${inc.id} Deleted`, "#64748b");
    setDeleteConfirm(null);
    loadData();
  };

  const deleteTicket = async (t) => {
    await supabase.from("tickets").delete().eq("id", t.id);
    showBanner(`🗑️ Ticket ${t.id} Deleted`, "#64748b");
    setDeleteConfirm(null);
    loadData();
  };

  const handleSaveOrgConfig = async (newConfig) => {
    try {
      let savedOrg = null;
      if (orgConfig?.id) {
        const { data, error } = await supabase
          .from("organizations")
          .update(newConfig)
          .eq("id", orgConfig.id)
          .select()
          .maybeSingle();
        if (!error && data) savedOrg = data;
      } else {
        const { data, error } = await supabase
          .from("organizations")
          .insert(newConfig)
          .select()
          .maybeSingle();
        if (!error && data) savedOrg = data;
      }

      if (savedOrg) {
        setOrgConfig(savedOrg);
      } else {
        setOrgConfig(prev => ({ ...prev, ...newConfig }));
      }
      showBanner("Organization profile saved permanently to database!", "#22c55e");
    } catch (err) {
      console.warn("Save org error:", err);
      setOrgConfig(prev => ({ ...prev, ...newConfig }));
      showBanner("Saved to session memory", "#eab308");
    }
  };

  const handleUploadKb = async (newArticles) => {
    try {
      const orgId = orgConfig?.id || currentUserProfile?.org_id || null;
      const formatted = newArticles.map(a => ({
        org_id: orgId,
        article_id: a.id || a.article_id || `import-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        title: a.title,
        category: a.category || "General",
        keywords: a.keywords || [],
        steps: a.steps || [],
        escalate_to: a.escalateTo || a.escalate_to || "Service Desk"
      }));

      for (const item of formatted) {
        await supabase.from("knowledge_base").upsert(item);
      }
      setCustomArticles(prev => [...formatted, ...prev]);
      showBanner(`Successfully imported & saved ${formatted.length} custom articles!`, "#22c55e");
    } catch (err) {
      console.warn("Upload KB error:", err);
      setCustomArticles(prev => [...newArticles, ...prev]);
      showBanner(`Loaded ${newArticles.length} custom articles to session`, "#eab308");
    }
  };

  const handleSaveKbArticle = async (article) => {
    try {
      const orgId = orgConfig?.id || currentUserProfile?.org_id || null;
      const articlePayload = {
        org_id: orgId,
        article_id: article.article_id || `kb-${Date.now()}`,
        title: article.title.trim(),
        category: article.category || "General",
        keywords: Array.isArray(article.keywords) 
          ? article.keywords 
          : (article.keywords || "").split(",").map(k => k.trim()).filter(Boolean),
        steps: Array.isArray(article.steps) 
          ? article.steps 
          : (article.steps || "").split("\n").map(s => s.trim()).filter(Boolean),
        escalate_to: article.escalate_to || "Service Desk"
      };

      const { data, error } = await supabase.from("knowledge_base").upsert(articlePayload).select().single();
      if (!error && data) {
        setCustomArticles(prev => [data, ...prev.filter(a => a.id !== data.id && a.article_id !== data.article_id)]);
        showBanner(`Article "${article.title}" saved permanently!`, "#22c55e");
      } else {
        setCustomArticles(prev => [articlePayload, ...prev]);
        showBanner(`Article saved to session`, "#eab308");
      }
    } catch (err) {
      console.warn("Save KB error:", err);
    }
  };

  const handleDeleteKbArticle = async (articleId) => {
    try {
      await supabase.from("knowledge_base").delete().or(`id.eq.${articleId},article_id.eq.${articleId}`);
      setCustomArticles(prev => prev.filter(a => a.id !== articleId && a.article_id !== articleId));
      showBanner("Article removed from Knowledge Base.", "#64748b");
    } catch (err) {
      console.warn("Delete KB error:", err);
    }
  };

  const handleAddService = async (serviceData) => {
    try {
      const { data, error } = await supabase.from("monitored_services").insert({
        ...serviceData,
        org_id: orgConfig?.id || currentUserProfile?.org_id || null
      }).select().single();

      if (!error && data) {
        setServices(prev => [data, ...prev.filter(s => s.id !== data.id)]);
        showBanner(`Monitored app "${serviceData.name}" added & saved permanently!`, "#22c55e");
      } else {
        if (error) console.error("Monitored services insert error:", error);
        setServices(prev => [{ ...serviceData, id: `svc-${Date.now()}` }, ...prev]);
        showBanner(`Monitored app "${serviceData.name}" added!`, "#22c55e");
      }
    } catch (_err) {
      setServices(prev => [{ ...serviceData, id: `svc-${Date.now()}` }, ...prev]);
      showBanner(`Monitored app "${serviceData.name}" added!`, "#22c55e");
    }
  };

  const activeInc = incidents.filter(i => !i.resolved);

  const userDomain = currentUser?.email && currentUser.email.includes("@")
    ? currentUser.email.split("@")[1].toLowerCase()
    : "";
  const isMasterOwner = userDomain === PLATFORM_MASTER_DOMAIN;

  // Master platform owner (bizadoc.com) is ALWAYS Admin
  const userRole = isMasterOwner ? "admin" : (currentUserProfile?.role || "user");

  // Strict role-based tickets view filtering:
  // Admin -> sees ALL tickets
  // Technician -> sees tickets assigned to them or their department
  // User -> sees ONLY tickets created by them
  const roleFilteredTickets = tickets.filter(t => {
    if (userRole === "admin") return true;
    if (userRole === "technician") {
      const myId = currentUser?.id;
      const myEmail = currentUser?.email?.toLowerCase();
      const myDept = currentUserProfile?.department?.toLowerCase();
      const isAssigned = (myId && t.assigned_to === myId) || 
                         (myEmail && t.assignee_name?.toLowerCase().includes(myEmail));
      const isDept = myDept && t.team && t.team.toLowerCase() === myDept;
      return isAssigned || isDept;
    }
    // user role:
    return (
      (currentUser?.id && t.created_by === currentUser.id) ||
      (t.submitter && (
        t.submitter.toLowerCase().includes((currentUserProfile?.full_name || "").toLowerCase()) ||
        t.submitter.toLowerCase().includes((currentUser?.email || "").toLowerCase())
      ))
    );
  });

  // Individual account type — strictly for public consumers; Master Owner is NEVER individual
  const isIndividualAccount =
    !isMasterOwner && (
      currentUserProfile?.account_type === "individual" ||
      currentUser?.user_metadata?.account_type === "individual"
    );

  const allNavItems = [
    { id: "virtual-it", label: "Virtual IT Support", icon: Bot, roles: ["admin", "technician", "user"] },
    { id: "incidents", label: `Incidents ${activeInc.length ? `(${activeInc.length})` : ""}`, icon: Flame, roles: ["admin", "technician"] },
    { 
      id: "tickets", 
      label: isIndividualAccount
        ? `My Tickets (${roleFilteredTickets.length})`
        : userRole === "user" 
          ? `My Tickets (${roleFilteredTickets.length})` 
          : `Tickets (${roleFilteredTickets.filter(t => t.status !== "RESOLVED").length})`, 
      icon: Ticket, 
      roles: ["admin", "technician", "user"] 
    },
    { id: "services", label: "Monitored Apps", icon: Activity, roles: ["admin", "technician"] },
    { id: "emails", label: `Email Logs (${emailLog.length})`, icon: Mail, roles: ["admin"] },
    { id: "settings", label: "Settings", icon: Settings, roles: ["admin"] },
    { id: "billing", label: "Billing", icon: CreditCard, roles: ["admin"] },
  ];

  // Individual users: only Virtual IT Support + My Tickets (regardless of role assigned at workspace creation)
  // Business users: tabs filtered by their assigned role as usual
  const allowedTabs = isIndividualAccount
    ? allNavItems.filter(item => ["virtual-it", "tickets"].includes(item.id))
    : allNavItems.filter(item => item.roles.includes(userRole));

  useEffect(() => {
    if (currentUser && !allowedTabs.find(t => t.id === tab)) {
      setTab("virtual-it");
    }
  }, [userRole, isIndividualAccount]);

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-indigo-400 font-sans text-sm tracking-wider">
        <Activity className="w-5 h-5 animate-spin mr-2" />
        INITIALIZING BIZADESK...
      </div>
    );
  }

  if (!currentUser) {
    // ── Account Access Suspended Notice (Deactivated by Admin) ──
    if (accountSuspendedNotice) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-slate-900 border border-rose-900/40 rounded-2xl p-8 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">Account Access Suspended</h2>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                The workspace account for <strong className="text-slate-200">{accountSuspendedNotice.name}</strong> (<span className="text-indigo-400 font-mono">{accountSuspendedNotice.email}</span>) has been suspended by your workspace administrator.
              </p>
            </div>
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-left text-xs space-y-2 text-slate-300">
              <p className="font-semibold text-rose-400 uppercase tracking-wider text-[10px]">Access Policy:</p>
              <p>• Access to tickets, incidents, and workspace channels is currently restricted.</p>
              <p>• If you believe this is in error, please contact your company's IT Helpdesk Administrator.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setAccountSuspendedNotice(null);
                setShowAuthScreen(false);
              }}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition-colors border border-slate-700"
            >
              Back to Home
            </button>
          </div>
        </div>
      );
    }

    // ── Corporate Member Block Notice (Admin Invitation Required) ──
    if (corporateBlockNotice) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">Administrator Invitation Required</h2>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                The corporate workspace for <strong className="text-slate-200">{corporateBlockNotice.companyName}</strong> (<span className="text-indigo-400 font-mono">@{corporateBlockNotice.domain}</span>) is already registered on BizaDesk.
              </p>
            </div>
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-left text-xs space-y-2 text-slate-300">
              <p className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">Company Security Policy:</p>
              <p>• To protect corporate IT systems, new members cannot self-register under this domain.</p>
              <p>• Please contact your company's IT Administrator to add or invite your email before signing in.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setCorporateBlockNotice(null);
                setShowAuthScreen(false);
              }}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition-colors shadow-lg shadow-indigo-950"
            >
              Back to Home
            </button>
          </div>
        </div>
      );
    }

    if (portalLoading) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-indigo-400 font-sans text-xs tracking-wider">
          <Activity className="w-5 h-5 animate-spin mr-2" />
          LOADING CLIENT SUPPORT PORTAL...
        </div>
      );
    }

    if (showAuthScreen) {
      return (
        <AuthScreen
          onAuthSuccess={(user) => {
            setCurrentUser(user);
            fetchProfile(user);
          }}
          onBackToLanding={() => setShowAuthScreen(false)}
        />
      );
    }

    // White-Label Customer Support Portal for Commercial IT firms
    if (portalOrg) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
          {/* Branded Header */}
          <header className="border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center text-white shadow-md font-bold overflow-hidden">
                {portalOrg.logo_url ? (
                  <img src={portalOrg.logo_url} alt={portalOrg.name} className="w-full h-full object-cover" />
                ) : (
                  <Bot className="w-5 h-5" />
                )}
              </div>
              <div>
                <h1 className="text-sm font-bold text-white tracking-tight leading-none">{portalOrg.name}</h1>
                <p className="text-[10px] text-slate-400 mt-1">24/7 Virtual IT Support &amp; Incident Desk</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowAuthScreen(true)}
                className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 transition-colors"
              >
                Staff Login →
              </button>
            </div>
          </header>

          {/* Portal Body: Direct Virtual IT Support */}
          <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-6">
            <VirtualITSupport
              incidents={[]}
              services={[]}
              customArticles={customArticles}
              orgConfig={portalOrg}
              userRole="user"
              accountType="individual"
              currentUser={null}
              currentUserProfile={null}
              onSubmitTicket={async (ticketPayload) => {
                const { data, error } = await supabase
                  .from("tickets")
                  .insert({
                    ...ticketPayload,
                    org_id: portalOrg.id
                  })
                  .select()
                  .single();
                if (error) throw error;
                showBanner(`✅ Support Ticket ${data.id} logged with ${portalOrg.name}!`, "#22c55e");
                return data;
              }}
            />
          </main>

          {/* Subtle Whitelabel Footer */}
          <footer className="py-4 text-center border-t border-slate-800/60 text-[11px] text-slate-500">
            <span>Powered by BizaDesk</span> • <span>Enterprise IT Service Cloud</span>
          </footer>
        </div>
      );
    }

    return (
      <LandingPage
        onGoToApp={() => setShowAuthScreen(true)}
      />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-indigo-400 font-sans text-sm tracking-wider">
        <Activity className="w-5 h-5 animate-spin mr-2" />
        LOADING BIZADESK PLATFORM...
      </div>
    );
  }

  // ── 30-Day Free Trial & Subscription Enforcement ───────────────────
  const isBusinessAccount = !isIndividualAccount;
  const isPlatformOwner = isMasterOwner || orgConfig?.is_master_org;
  const trialEndTs = subscription?.trial_end
    ? new Date(subscription.trial_end).getTime()
    : Date.now() + 30 * 86400000;
  const now = Date.now();
  const daysRemaining = Math.ceil((trialEndTs - now) / 86400000);
  const isSubscriptionActive = isPlatformOwner || subscription?.status === "ACTIVE" || subscription?.status === "PAID";
  
  // Trial expired if business account, not platform owner, not active and days remaining <= 0
  const isTrialExpired = !isPlatformOwner && isBusinessAccount && !isSubscriptionActive && daysRemaining <= 0;
  // Grace period: days 0, -1, -2, -3 (up to 3 days after expiry)
  const isGracePeriod = isTrialExpired && daysRemaining >= -3;
  // Hard locked: 4+ days past expiry
  const isHardLocked = isTrialExpired && daysRemaining < -3;

  if (isHardLocked && currentUser) {
    if (userRole !== "admin") {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">Workspace Access Paused</h2>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                The <strong className="text-slate-200">{orgConfig?.name || "Corporate"}</strong> 30-day free trial has expired. Please contact your workspace administrator to renew the subscription.
              </p>
            </div>
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800/80 text-left text-xs space-y-2 text-slate-300">
              <p className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">What to do next:</p>
              <p>• Your Admin can log in anytime to activate a subscription via Paystack.</p>
              <p>• All company tickets, knowledge base articles, and incident history are preserved safely.</p>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-all"
            >
              Sign Out
            </button>
          </div>
        </div>
      );
    }
  }

  return (
    <div className={`min-h-screen ${theme === "light" ? "theme-light bg-slate-50 text-slate-900" : "theme-dark bg-slate-950 text-slate-100"} font-sans text-xs antialiased flex flex-col selection:bg-indigo-500 selection:text-white`}>
      {/* Proactive Disconnection & Outage Sensor */}
      <ProactiveBanner activeIncidents={incidents} onOpenTroubleshooting={() => setTab("virtual-it")} />

      {/* Alert Toast Banner */}
      {alertBanner && (
        <div 
          className="fixed top-4 right-4 z-50 px-4 py-3 rounded-xl border shadow-2xl text-xs font-semibold flex items-center gap-2 animate-bounce"
          style={{ background: "#0f172a", borderColor: alertBanner.color, color: alertBanner.color }}
        >
          {alertBanner.msg}
        </div>
      )}

      {/* Trial Grace Period Warning Banner */}
      {isGracePeriod && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-6 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-amber-300">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              ⚠️ Your 30-day free trial expired {Math.abs(daysRemaining)} day{Math.abs(daysRemaining) > 1 ? "s" : ""} ago.
              You have <strong>{Math.max(0, 3 + daysRemaining + 1)} grace day(s)</strong> remaining before workspace features are locked.
            </span>
          </div>
          <button
            onClick={() => setTab("billing")}
            className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition-all shrink-0 shadow-sm"
          >
            Activate Subscription →
          </button>
        </div>
      )}

      {/* SaaS Header & Navigation Bar */}
      <header className="bg-slate-900/90 border-b border-slate-800/80 sticky top-0 z-40 backdrop-blur-md px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Logo & Org Selector */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`font-extrabold text-sm tracking-tight ${theme === "light" ? "text-slate-900" : "text-white"}`}>
                  Biza<span className={theme === "light" ? "text-indigo-600" : "text-indigo-400"}>Desk</span>
                </span>
                {isIndividualAccount ? (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Personal IT
                  </span>
                ) : (isMasterOwner || orgConfig?.is_master_org) ? (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    Platform Owner
                  </span>
                ) : orgConfig?.workspace_mode === "COMMERCIAL" ? (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                    Commercial
                  </span>
                ) : (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                    Enterprise
                  </span>
                )}
              </div>
              {!isIndividualAccount && (
                <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                  <Building2 className="w-3 h-3 text-slate-500" />
                  {orgConfig.name || "Primary Organization"}
                </span>
              )}
            </div>

            {/* Live System Status Indicator & Clock */}
            <div className="ml-4 pl-4 border-l border-slate-800 hidden sm:flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${activeInc.length > 0 ? "bg-rose-500 animate-ping" : "bg-emerald-500"}`} />
                <span className="text-[11px] text-slate-300">
                  {activeInc.length > 0 ? `${activeInc.length} Outage Active` : "All Systems Operational"}
                </span>
              </div>
              <span className="text-slate-700">|</span>
              <LiveClock />
            </div>
          </div>

          {/* Navigation Tabs (Filtered by Role) */}
          <nav className="flex items-center gap-1 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            {allowedTabs.map(item => {
              const Icon = item.icon;
              const isActive = tab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all whitespace-nowrap ${
                    isActive 
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-950" 
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Notification Center & User Profile (Always pinned to the far right) */}
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            {/* Theme Toggle Button (Light / Dark) */}
            <button
              type="button"
              onClick={toggleTheme}
              title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all border border-transparent hover:border-slate-700"
            >
              {theme === "light" ? (
                <Moon className="w-4 h-4 text-indigo-600" />
              ) : (
                <Sun className="w-4 h-4 text-amber-400" />
              )}
            </button>

            {/* Live Notification Bell */}
            <NotificationBell
              notifications={notifications}
              onMarkAllRead={handleMarkAllRead}
              onClearAll={handleClearNotifications}
              onNotificationClick={handleNotificationClick}
            />

            {/* Technician Timed Break Control & Anti-Dodge Guardrail */}
            {userRole === "technician" && (() => {
              const isOnBreak = currentUserProfile?.availability_status === "break" || Boolean(currentUserProfile?.break_type);
              if (isOnBreak) {
                const breakStarted = Number(currentUserProfile?.break_started_at) || Date.now();
                const durationMs = (Number(currentUserProfile?.break_duration_minutes) || 15) * 60000;
                const elapsedBreak = Math.max(0, Date.now() - breakStarted);
                const remBreakMs = durationMs - elapsedBreak;
                const isBreakOverdue = remBreakMs <= 0 || currentUserProfile?.break_overdue;
                const remBreakMins = Math.max(1, Math.round(remBreakMs / 60000));
                const overdueBreakMins = Math.max(1, Math.round(Math.abs(remBreakMs) / 60000));
                const breakLabel = currentUserProfile?.break_type === "lunch" ? "Lunch" : currentUserProfile?.break_type === "tea" ? "Bio/Tea" : currentUserProfile?.break_type === "meeting" ? "Meeting" : "Break";

                return (
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border ${
                    isBreakOverdue
                      ? "bg-rose-500/15 border-rose-500/40 text-rose-300 animate-pulse"
                      : "bg-amber-500/15 border-amber-500/30 text-amber-300"
                  }`}>
                    <Coffee className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-semibold text-[11px]">
                      {isBreakOverdue
                        ? `🚨 Overdue ${breakLabel} (+${overdueBreakMins}m)`
                        : `⏳ On ${breakLabel} (${remBreakMins}m left)`}
                    </span>
                    <button
                      type="button"
                      onClick={handleEndBreak}
                      className="ml-1 px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] shadow transition-colors cursor-pointer"
                      title="Return from break and resume receiving tickets"
                    >
                      I'm Back ✓
                    </button>
                  </div>
                );
              }

              return (
                <div className="relative group">
                  <button
                    type="button"
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-medium transition-colors cursor-pointer"
                    title="Take a scheduled break (Lunch, Bio/Tea, Meeting). Pauses incoming ticket assignment."
                  >
                    <Coffee className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[11px] font-semibold">Break</span>
                  </button>
                  <div className="absolute right-0 top-full mt-1 w-44 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-1 hidden group-hover:block z-50">
                    <div className="px-2 py-1 text-[10px] text-slate-400 uppercase font-bold tracking-wider border-b border-slate-800 mb-1">
                      Schedule Break
                    </div>
                    <button
                      type="button"
                      onClick={() => handleStartBreak("lunch", 45)}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-slate-800 text-slate-200 flex items-center justify-between cursor-pointer"
                    >
                      <span>🥪 Lunch Break</span>
                      <span className="text-[10px] text-amber-400 font-mono">45m</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStartBreak("tea", 15)}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-slate-800 text-slate-200 flex items-center justify-between cursor-pointer"
                    >
                      <span>☕ Tea / Bio</span>
                      <span className="text-[10px] text-emerald-400 font-mono">15m</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStartBreak("meeting", 30)}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-slate-800 text-slate-200 flex items-center justify-between cursor-pointer"
                    >
                      <span>👥 Meeting / Training</span>
                      <span className="text-[10px] text-indigo-400 font-mono">30m</span>
                    </button>
                  </div>
                </div>
              );
            })()}

            <div className="flex items-center gap-2 pl-3 border-l border-slate-800">
              <div className="w-7 h-7 rounded-full bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 font-bold text-xs uppercase">
                {(currentUserProfile?.full_name || currentUser.email || "U")[0]}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-semibold text-slate-200 leading-none">
                  {currentUserProfile?.full_name || currentUser.email.split("@")[0]}
                </div>
                <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1.5">
                  <span className={`px-1.5 py-0.2 rounded font-bold uppercase tracking-wider text-[9px] border ${
                    userRole === "admin" 
                      ? "bg-indigo-500/15 text-indigo-400 border-indigo-500/30"
                      : userRole === "technician"
                      ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/30"
                      : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  }`}>
                    {userRole === "admin" ? "Admin" : userRole === "technician" ? "Technician" : "Staff User"}
                  </span>
                  <span className="truncate max-w-[100px]">{currentUserProfile?.department || "General"}</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>

            {/* Change Password button — hidden for demo/sandbox users */}
            {!currentUser?.demoRole && (
              <button
                onClick={() => { setShowChangePassword(true); setCpError(""); setCpSuccess(""); setCpNewPassword(""); setCpConfirmPassword(""); }}
                title="Change Password"
                className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800/80 rounded-lg transition-colors"
              >
                <KeyRound className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main App Workspace */}
      <main className="max-w-7xl mx-auto w-full p-6 flex-1">
        <Suspense fallback={<div className="p-12 text-center text-slate-500 text-xs">Loading workspace component...</div>}>
        {/* TAB 1: VIRTUAL IT SUPPORT */}
        {tab === "virtual-it" && (
          <VirtualITSupport
            incidents={incidents}
            services={services}
            customArticles={customArticles}
            orgConfig={
              (isIndividualAccount || isMasterOwner || orgConfig?.is_master_org) 
                ? { ...orgConfig, enable_global_kb: true } 
                : orgConfig
            }
            userRole={userRole}
            accountType={
              currentUserProfile?.account_type ||
              currentUser?.user_metadata?.account_type ||
              (isIndividualAccount ? "individual" : (orgConfig?.workspace_mode === "COMMERCIAL" ? "individual" : "business"))
            }
            currentUser={currentUser}
            currentUserProfile={currentUserProfile}
            onSubmitTicket={submitTicket}
            onLogAudit={async (log) => {
              try {
                await supabase.from("session_audit_logs").insert({
                  org_id: orgConfig?.id || currentUserProfile?.org_id || null,
                  action_run: log.action,
                  result: log.result,
                  user_name: currentUserProfile?.full_name || currentUser?.email || "Staff User"
                });
              } catch (e) {
                console.warn(e);
              }
            }}
          />
        )}

        {/* TAB 2: INCIDENTS MONITORING */}
        {tab === "incidents" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Flame className="w-5 h-5 text-rose-500" />
                  Active Incident Command
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Automated service monitoring and {orgConfig.incident_sla_minutes || 10}-minute SLA escalation.
                </p>
              </div>
              <button
                onClick={() => setNewIncModal(true)}
                className="bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-lg shadow-rose-950 transition-all self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" /> Trigger New Incident
              </button>
            </div>

            {/* Incidents List */}
            <div className="space-y-3">
              {incidents.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  No incidents recorded. All systems healthy.
                </div>
              ) : (
                incidents.map(inc => {
                  const age = Math.floor((Date.now() - inc.opened_at) / 60000);
                  const isResolved = inc.resolved;

                  return (
                    <div
                      key={inc.id}
                      className={`bg-slate-900 border rounded-xl p-5 shadow-sm transition-all ${
                        isResolved 
                          ? "border-slate-800 opacity-60" 
                          : inc.severity === "CRITICAL" 
                          ? "border-rose-500/40 bg-rose-950/10" 
                          : "border-slate-800"
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="font-mono font-bold text-slate-100">{inc.incident_code || (inc.id && inc.id.length > 10 ? `INC-${inc.id.slice(0, 6).toUpperCase()}` : inc.id)}</span>
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded border"
                              style={{ 
                                color: SEV_COLOR[inc.severity] || "#f97316",
                                borderColor: `${SEV_COLOR[inc.severity]}40`,
                                background: `${SEV_COLOR[inc.severity]}15`
                              }}
                            >
                              {inc.severity}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                              isResolved 
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                                : inc.escalated 
                                ? "bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse" 
                                : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                            }`}>
                              {inc.status}
                            </span>
                          </div>
                          <h3 className="text-sm font-semibold text-slate-100">{inc.title}</h3>
                          <p className="text-xs text-slate-400 mt-1">
                            App: <strong className="text-slate-300">{inc.app}</strong> • Team: <strong className="text-slate-300">{inc.team}</strong> • Opened: {timeAgo(inc.opened_at)} ({age}m ago)
                          </p>
                          {inc.description && (
                            <p className="text-xs text-slate-400 mt-2 bg-slate-950 p-2.5 rounded border border-slate-800/80">
                              {inc.description}
                            </p>
                          )}

                          {/* Post-Incident Root Cause Analysis (RCA) Card */}
                          {isResolved && (inc.rca_summary || inc.root_cause) && (
                            <div className="mt-3 p-3.5 bg-slate-950/90 rounded-xl border border-emerald-500/30 text-xs space-y-2">
                              <div className="flex items-center justify-between text-emerald-400 font-bold text-[11px] uppercase tracking-wider">
                                <span className="flex items-center gap-1.5">
                                  <Shield className="w-3.5 h-3.5 text-emerald-400" />
                                  Post-Incident Root Cause Analysis (RCA)
                                </span>
                                <span className="text-slate-400 text-[10px] font-normal">
                                  Resolved by: <strong className="text-slate-200">{inc.resolved_by || "IT Specialist"}</strong> ({fmtTime(inc.resolved_at || inc.last_update)})
                                </span>
                              </div>
                              <div className="space-y-1.5 text-slate-300">
                                <div>
                                  <span className="text-slate-500 font-semibold text-[10px] uppercase block">Root Cause:</span>
                                  <p className="text-slate-200">{inc.root_cause || inc.rca_summary}</p>
                                </div>
                                {inc.resolution_actions && (
                                  <div>
                                    <span className="text-slate-500 font-semibold text-[10px] uppercase block">Actions Taken:</span>
                                    <p className="text-slate-200">{inc.resolution_actions}</p>
                                  </div>
                                )}
                                {inc.preventive_measure && (
                                  <div>
                                    <span className="text-slate-500 font-semibold text-[10px] uppercase block">Preventive Measures:</span>
                                    <p className="text-emerald-300 font-medium">{inc.preventive_measure}</p>
                                  </div>
                                )}
                                {inc.affected_count > 0 && (
                                  <div className="text-[11px] text-slate-400">
                                    Impact Scope: <strong className="text-amber-400 font-semibold">{inc.affected_count} users/services impacted</strong>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Incident Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          {!isResolved && (
                            <>
                              <button
                                onClick={() => sendFollowUp(inc)}
                                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded-lg border border-slate-700 transition-colors"
                              >
                                Follow-Up
                              </button>
                              <button
                                onClick={() => resolveIncident(inc)}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs px-3 py-1.5 rounded-lg transition-all shadow-md shadow-emerald-950"
                              >
                                Mark Resolved
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => deleteIncident(inc)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 3: TICKETS MANAGEMENT */}
        {tab === "tickets" && (() => {
          // Calculate live MTTR (Mean Time To Resolve) metrics
          const resolvedTickets = tickets.filter(t => t.status === "RESOLVED");
          const avgTicketMttrMins = resolvedTickets.length > 0
            ? Math.round(
                resolvedTickets.reduce((acc, t) => {
                  const resolvedTime = t.resolved_at || t.last_update || t.created || Date.now();
                  return acc + Math.max(1, (resolvedTime - (t.created || resolvedTime)) / 60000);
                }, 0) / resolvedTickets.length
              )
            : null;

          const resolvedIncidents = incidents.filter(i => i.status === "RESOLVED");
          const avgIncMttrMins = resolvedIncidents.length > 0
            ? Math.round(
                resolvedIncidents.reduce((acc, i) => {
                  const resolvedTime = i.resolved_at || i.last_update || Date.now();
                  const startTime = i.started_at || i.timestamp || resolvedTime;
                  return acc + Math.max(1, (resolvedTime - startTime) / 60000);
                }, 0) / resolvedIncidents.length
              )
            : null;

          const breachedTicketsCount = tickets.filter(t => t.sla_breached).length;
          const openTicketsCount = tickets.filter(t => t.status !== "RESOLVED").length;

          // Interactive Filtering by Status, Technician, and Date
          const displayedTickets = roleFilteredTickets.filter(t => {
            // 1. Status filter
            if (ticketStatusFilter !== "ALL") {
              if (ticketStatusFilter === "OPEN" && (t.status === "RESOLVED" || t.status === "IN_PROGRESS")) return false;
              if (ticketStatusFilter === "IN_PROGRESS" && t.status !== "IN_PROGRESS") return false;
              if (ticketStatusFilter === "RESOLVED" && t.status !== "RESOLVED") return false;
            }

            // 2. Technician filter (Admin / Lead view)
            if (ticketTechFilter !== "ALL") {
              if (t.assigned_to !== ticketTechFilter) return false;
            }

            // 3. Date filter
            if (ticketDateFilter !== "ALL") {
              const ticketTime = t.created || 0;
              const now = Date.now();
              if (ticketDateFilter === "TODAY" && now - ticketTime > 86400000) return false;
              if (ticketDateFilter === "7DAYS" && now - ticketTime > 7 * 86400000) return false;
              if (ticketDateFilter === "30DAYS" && now - ticketTime > 30 * 86400000) return false;
            }

            return true;
          });

          return (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                    <Ticket className="w-5 h-5 text-indigo-400" />
                    {userRole === "user" ? "My Support Tickets" : "Support Tickets Queue"}
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    {userRole === "user" 
                      ? "Track the status of your reported requests and responses from IT support."
                      : `Manage user tickets, category routing, status progression (WIP / Resolve), and SLA breach flags.`}
                  </p>
                </div>
                <button
                  onClick={() => setNewTicket(true)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-lg shadow-indigo-950 transition-all self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" /> New Ticket
                </button>
              </div>

              {/* Live MTTR & Performance Metrics Bar */}
              {userRole !== "user" && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Ticket MTTR</span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-xl font-bold text-indigo-400">
                        {avgTicketMttrMins !== null ? (avgTicketMttrMins > 60 ? `${(avgTicketMttrMins / 60).toFixed(1)}h` : `${avgTicketMttrMins}m`) : "N/A"}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">avg resolve</span>
                    </div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Incident MTTR</span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-xl font-bold text-amber-400">
                        {avgIncMttrMins !== null ? (avgIncMttrMins > 60 ? `${(avgIncMttrMins / 60).toFixed(1)}h` : `${avgIncMttrMins}m`) : "N/A"}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">avg outage fix</span>
                    </div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">SLA Breaches</span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className={`text-xl font-bold ${breachedTicketsCount > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                        {breachedTicketsCount}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">breached</span>
                    </div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Active Queue</span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-xl font-bold text-slate-100">{openTicketsCount}</span>
                      <span className="text-[10px] text-slate-500 font-medium">open tickets</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Filtering Controls Bar */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                {/* Status Filter Buttons */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-slate-400 font-medium mr-1 flex items-center gap-1">
                    Status:
                  </span>
                  {[
                    { id: "ALL", label: "All" },
                    { id: "OPEN", label: "Open" },
                    { id: "IN_PROGRESS", label: "WIP (In Progress)" },
                    { id: "RESOLVED", label: "Resolved" }
                  ].map(st => (
                    <button
                      key={st.id}
                      onClick={() => setTicketStatusFilter(st.id)}
                      className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                        ticketStatusFilter === st.id
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800"
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  {/* Technician Filter (for Admin / Technicians - Strictly Technicians Only) */}
                  {userRole !== "user" && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 font-medium">Technician:</span>
                      <select
                        value={ticketTechFilter}
                        onChange={e => setTicketTechFilter(e.target.value)}
                        className="bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-indigo-500"
                      >
                        <option value="ALL">All Technicians</option>
                        {members
                          .filter(m => m.role === "technician" && m.is_active !== false)
                          .map(m => (
                            <option key={m.id} value={m.id}>
                              {m.full_name || m.email} ({m.department || "General IT"})
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                  {/* Date Filter */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 font-medium">Date:</span>
                    <select
                      value={ticketDateFilter}
                      onChange={e => setTicketDateFilter(e.target.value)}
                      className="bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-indigo-500"
                    >
                      <option value="ALL">All Dates (Newest First)</option>
                      <option value="TODAY">Created Today</option>
                      <option value="7DAYS">Past 7 Days</option>
                      <option value="30DAYS">Past 30 Days</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Tickets Table / List */}
              <div className="space-y-3">
                {displayedTickets.length === 0 ? (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                    {userRole === "user" 
                      ? "You have no active support tickets matching criteria."
                      : "No tickets matching filter criteria in this queue."}
                  </div>
                ) : (
                  displayedTickets.map(t => {
                    const isClosed = t.status === "RESOLVED";
                    const isWIP = t.status === "IN_PROGRESS";

                    return (
                      <div
                        key={t.id}
                        className={`bg-slate-900 border rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                          isClosed 
                            ? "border-slate-800 opacity-60" 
                            : isWIP 
                            ? "border-amber-500/40 bg-amber-950/5" 
                            : t.sla_breached 
                            ? "border-rose-500/50 bg-rose-950/10" 
                            : "border-slate-800"
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-mono font-bold text-slate-100">{t.ticket_code || (t.id && t.id.length > 10 ? `TKT-${t.id.slice(0, 6).toUpperCase()}` : t.id)}</span>
                            
                            {/* Status Badge */}
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                              isClosed
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : isWIP
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                : "bg-sky-500/10 text-sky-400 border-sky-500/20"
                            }`}>
                              {isClosed ? "RESOLVED" : isWIP ? "WIP (IN PROGRESS)" : "OPEN"}
                            </span>

                            <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                              {t.ticket_type}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                              t.priority === "HIGH" ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            }`}>
                              {t.priority}
                            </span>

                            {/* Payment & Visit Badge (Commercial mode only) */}
                            {orgConfig?.workspace_mode !== "ENTERPRISE" && t.payment_status === "PAID" && (
                              <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                                ₦{Number(t.payment_amount || 0).toLocaleString()} PAID
                                {t.support_type === "PHYSICAL_VISIT" && " (On-Site Visit)"}
                              </span>
                            )}
                            {orgConfig?.workspace_mode !== "ENTERPRISE" && t.payment_status === "REFUNDED" && (
                              <span className="text-[10px] font-bold bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded border border-rose-500/20">
                                100% REFUNDED
                              </span>
                            )}
                            {orgConfig?.workspace_mode !== "ENTERPRISE" && t.payment_status === "PARTIALLY_REFUNDED" && (
                              <span className="text-[10px] font-bold bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20">
                                ⚖️ PARTIALLY SETTLED (Refunded ₦{Number(t.refunded_amount || 0).toLocaleString()})
                              </span>
                            )}
                            {t.sla_breached && (
                              <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 animate-pulse">
                                SLA Breached
                              </span>
                            )}
                          </div>
                          <h3 className="text-sm font-semibold text-slate-100">{t.title}</h3>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Assigned to: <strong className="text-indigo-300">{t.assignee_name || t.team}</strong> ({t.team}) • Submitter: <strong className="text-slate-300">{t.submitter || "Staff"}</strong> • Created: {new Date(t.created).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} ({timeAgo(t.created)})
                          </p>
                          {t.description && (
                            <p className="text-xs text-slate-400 mt-2 bg-slate-950 p-2.5 rounded border border-slate-800/80 whitespace-pre-wrap">
                              {t.description}
                            </p>
                          )}

                          {/* Physical Visit Dispatch Details Highlight Card */}
                          {(t.support_type === "PHYSICAL_VISIT" || t.visit_address) && (
                            <div className="mt-2.5 p-3 rounded-xl bg-gradient-to-r from-emerald-950/40 to-slate-900 border border-emerald-500/30 text-xs space-y-1.5">
                              <div className="flex items-center gap-2 font-bold text-emerald-400 text-[11px] uppercase tracking-wider">
                                <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span>Physical On-Site Dispatch Destination</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-300">
                                <div>
                                  <span className="text-slate-500 block text-[10px]">Location / City:</span>
                                  <strong className="text-white">{t.visit_city || "City Registered"}</strong>
                                </div>
                                <div>
                                  <span className="text-slate-500 block text-[10px]">Street Address & Landmark:</span>
                                  <span className="text-slate-200">{t.visit_address || "Provided in ticket description"}</span>
                                </div>
                              </div>
                            </div>
                          )}
                          {/* Pre-Diagnostic Context Card */}
                          {t.diagnostics && (
                            <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                              <span className="flex items-center gap-1 text-slate-300 font-medium">
                                <Monitor className="w-3.5 h-3.5 text-cyan-400" />
                                {t.diagnostics.os}
                              </span>
                              <span className="flex items-center gap-1 text-slate-300 font-medium">
                                <Globe className="w-3.5 h-3.5 text-indigo-400" />
                                {t.diagnostics.browser}
                              </span>
                              <span className="flex items-center gap-1 text-slate-300 font-medium">
                                <Cpu className="w-3.5 h-3.5 text-amber-400" />
                                {t.diagnostics.device}
                              </span>
                              <span className="text-slate-500 font-mono text-[10px]">
                                Res: {t.diagnostics.resolution}
                              </span>
                              <span className="text-emerald-400 text-[10px] bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                {t.diagnostics.network}
                              </span>
                            </div>
                          )}

                          {/* Live Dynamic SLA Countdown Bar (With Business Hours Pause) */}
                          <TicketSlaBar ticket={t} slaHours={orgConfig?.ticket_sla_hours || 1} orgConfig={orgConfig} />
                        </div>

                        <div className="flex items-center gap-2 shrink-0 flex-wrap">
                          {/* Live Chat & Notes Button */}
                          <button
                            onClick={() => setActiveChatTicket(t)}
                            className="bg-indigo-600/15 hover:bg-indigo-600/25 text-indigo-300 border border-indigo-500/30 text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors font-medium"
                            title="Open ticket messages & internal notes"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Chat & Notes</span>
                          </button>

                          {/* Admin 1-Click Ticket Re-Route */}
                          {userRole === "admin" && !isClosed && (
                            <button
                              onClick={() => {
                                setRerouteModalTicket(t);
                                setCardRerouteTeam(t.team || teams[0]?.team_name || "IT Support");
                                setCardRerouteTechId(t.assigned_to || "auto");
                              }}
                              className="bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-700/50 text-indigo-300 text-xs px-2.5 py-1.5 rounded-lg transition-colors font-medium flex items-center gap-1.5"
                              title="Re-route ticket to another queue or technician"
                            >
                              <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
                              <span>Re-route</span>
                            </button>
                          )}

                          {/* Technician WIP & Resolve Toggles */}
                          {userRole !== "user" && !isClosed && (
                            <>
                              {!isWIP && (
                                <button
                                  onClick={() => updateTicketStatus(t, "IN_PROGRESS")}
                                  className="bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 font-medium text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                                  title="Mark as Work in Progress (Notifies User)"
                                >
                                  <span>Mark WIP</span>
                                </button>
                              )}
                              <button
                                onClick={() => updateTicketStatus(t, "RESOLVED")}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs px-3.5 py-1.5 rounded-lg shadow-md shadow-emerald-950 transition-all flex items-center gap-1"
                                title="Mark as Resolved (Notifies User)"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Resolve Ticket</span>
                              </button>
                            </>
                          )}

                          {userRole !== "user" && isClosed && (
                            <button
                              onClick={() => updateTicketStatus(t, "OPEN")}
                              className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 transition-colors"
                              title="Re-open ticket"
                            >
                              Re-open
                            </button>
                          )}

                          {/* Universal Resolution Review & Settle (Admin Only for Paid Tickets in Commercial Mode) */}
                          {userRole === "admin" && orgConfig?.workspace_mode !== "ENTERPRISE" && t.payment_status === "PAID" && (
                            <button
                              onClick={() => setSettlementTicket(t)}
                              className="bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300 text-xs px-2.5 py-1.5 rounded-lg transition-colors font-medium flex items-center gap-1.5 shadow-sm"
                              title="Review outcome & settle: Confirm resolved, 100% full refund, or partial call-out/diagnostic fee"
                            >
                              <Scale className="w-3.5 h-3.5 text-indigo-400" />
                              <span>Review & Settle (₦{Number(t.payment_amount || 0).toLocaleString()})</span>
                            </button>
                          )}

                          {userRole !== "user" && (
                            <button
                              onClick={() => deleteTicket(t)}
                              className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                              title="Delete ticket"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })()}

        {/* TAB 4: MONITORED APPLICATIONS */}
        {tab === "services" && (
          <MonitoredServices
            services={services}
            teams={teams}
            userRole={userRole}
            onAddService={handleAddService}
            onDeleteService={async (svc) => {
              if (svc.id) {
                await supabase.from("monitored_services").delete().eq("id", svc.id);
              }
              setServices(prev => prev.filter(s => s.name !== svc.name));
            }}
            onRefreshHealth={loadData}
            onServiceHealthUpdate={(svcIdOrName, updatedFields) => {
              // Patch a single service in-place — SAFE, never wipes the full list
              setServices(prev => prev.map(s =>
                (s.id === svcIdOrName || s.name === svcIdOrName)
                  ? { ...s, ...updatedFields }
                  : s
              ));
            }}
            onServiceOutage={async (svc, pingRes, reason) => {
              const targetTeamObj = resolveTeamForFailure(
                pingRes?.error || "ping_failed",
                svc.routing_rules
              );
              const teamName = targetTeamObj?.team_name || targetTeamObj || "IT Helpdesk";
              const threshold = svc.health_alert_threshold ?? 70;
              const isThresholdBreach = reason === "THRESHOLD";
              const severity = isThresholdBreach ? "HIGH" : "CRITICAL";
              const title = isThresholdBreach
                ? `Degraded Service: ${svc.name} below ${threshold}% health`
                : `Service Outage: ${svc.name} is DOWN`;
              const desc = isThresholdBreach
                ? `Health monitor detected ${svc.name} has dropped to ${pingRes?.health_pct ?? "?"}% health, below the configured ${threshold}% alert threshold. Latency: ${pingRes?.latency || 0}ms. Auto-escalating to ${teamName}.`
                : `Health monitor detected ${svc.name} (${svc.health_url}) is fully unreachable. HTTP ${pingRes?.status || "ERR"}, latency: ${pingRes?.latency || 0}ms. Error: ${pingRes?.error || "Connection refused"}. Auto-escalating to ${teamName}.`;
              // Guard: don't create duplicate incidents for the same service
              const openExisting = incidents.find(inc => inc.app === svc.name && !inc.resolved);
              if (!openExisting) {
                await triggerIncident({ title, app: svc.name, severity, team: teamName, desc });
              }
            }}
          />
        )}

        {/* TAB 5: EMAIL DISPATCH LOGS */}
        {tab === "emails" && (
          <div className="space-y-6">
            <div className="pb-4 border-b border-slate-800">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Mail className="w-5 h-5 text-indigo-400" />
                Escalation Email Audit Log
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Automated incident alerts, all-staff urgent broadcasts, and resolution notices.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">To Address</th>
                      <th className="py-3 px-4">Subject</th>
                      <th className="py-3 px-4">Sent At</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {emailLog.map((eml, i) => (
                      <tr key={eml.id || i} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-indigo-400">{eml.email_type}</td>
                        <td className="py-3 px-4 text-slate-300">{eml.to_address}</td>
                        <td className="py-3 px-4 font-medium text-slate-200">{eml.subject}</td>
                        <td className="py-3 px-4 text-slate-400">{fmtTime(eml.sent_at)}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setViewEmail(eml)}
                            className="text-indigo-400 hover:text-indigo-300 font-medium"
                          >
                            View Email
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: COMPANY SETTINGS */}
        {tab === "settings" && (
          <div className="space-y-6">
            {/* Settings Sub-Navigation */}
            <div className="flex items-center gap-1 border-b border-slate-800 pb-1">
              {[
                { id: "company", label: "Company Profile & SLA" },
                { id: "teams",   label: `IT Department Queues (${teams.length})` },
                { id: "users",   label: "Staff & Member Directory" },
                { id: "email",   label: "Email Delivery Setup" },
                { id: "audit",   label: "Audit Logs & Spooling" },
              ].map(st => (
                <button
                  key={st.id}
                  onClick={() => setSettingsSubTab(st.id)}
                  className={`px-4 py-2 text-xs font-medium rounded-t-lg transition-all ${
                    settingsSubTab === st.id
                      ? "bg-indigo-600 text-white"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {settingsSubTab === "company" && (
              <CompanySettings
                orgConfig={orgConfig}
                currentUser={currentUser}
                currentUserProfile={currentUserProfile}
                customArticles={customArticles}
                onSaveConfig={handleSaveOrgConfig}
                onUploadKb={handleUploadKb}
                onSaveArticle={handleSaveKbArticle}
                onDeleteArticle={handleDeleteKbArticle}
              />
            )}

            {settingsSubTab === "teams" && (
              <TeamManagement
                orgId={orgConfig?.id || currentUserProfile?.org_id}
                onTeamsChange={(updatedTeams) => setTeams(updatedTeams)}
              />
            )}

            {settingsSubTab === "users" && (
              <UserManagement
                orgId={orgConfig?.id || currentUserProfile?.org_id}
                orgConfig={orgConfig}
                teams={teams}
                onMembersChange={(updated) => setMembers(updated)}
              />
            )}

            {settingsSubTab === "email" && (
              <EmailSettings
                orgConfig={orgConfig}
                onSaveEmailConfig={async (emailConfig) => {
                  await handleSaveOrgConfig({ ...orgConfig, ...emailConfig });
                }}
              />
            )}

            {settingsSubTab === "audit" && (
              <AuditLogsViewer orgId={orgConfig?.id || currentUserProfile?.org_id} />
            )}
          </div>
        )}

        {/* TAB 7: BILLING & SUBSCRIPTIONS */}
        {tab === "billing" && (
          <BillingSubscription
            subscription={subscription}
            onUpgradePlan={async (planInfo) => {
              showBanner(`Redirecting to secure ${planInfo.gateway.toUpperCase()} checkout...`, "#6366f1");
              const currentOrgId = orgConfig?.id || currentUserProfile?.org_id;
              if (currentOrgId) {
                await supabase.from("subscriptions").upsert({
                  org_id: currentOrgId,
                  status: "ACTIVE",
                  plan_type: planInfo.cycle === "yearly" ? "YEARLY" : "MONTHLY",
                  gateway: planInfo.gateway
                }, { onConflict: "org_id" });
                loadData(currentOrgId);
              }
            }}
          />
        )}
        </Suspense>
      </main>

      {/* Email Viewer Modal */}
      {viewEmail && <EmailModal email={viewEmail} onClose={() => setViewEmail(null)} />}

      {/* New Incident Trigger Modal */}
      {newIncModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-100">Trigger System Incident</h3>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Incident Title *</label>
              <input
                type="text"
                placeholder="e.g. Payment Gateway Failure"
                value={incForm.title}
                onChange={e => setIncForm({ ...incForm, title: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Impacted App / Service *</label>
              <input
                type="text"
                placeholder="e.g. PaymentService"
                value={incForm.app}
                onChange={e => setIncForm({ ...incForm, app: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Severity</label>
                <select
                  value={incForm.severity}
                  onChange={e => setIncForm({ ...incForm, severity: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                >
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="HIGH">HIGH</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="LOW">LOW</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Responsible Team</label>
                <select
                  value={incForm.team}
                  onChange={e => setIncForm({ ...incForm, team: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                >
                  {teams.length > 0 ? (
                    teams.map(t => (
                      <option key={t.id} value={t.team_name}>
                        {t.team_name}{t.is_default ? " (Default)" : ""}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="IT Support">IT Support</option>
                      <option value="Network Team">Network Team</option>
                      <option value="Database Team">Database Team</option>
                      <option value="Security Team">Security Team</option>
                    </>
                  )}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Description</label>
              <textarea
                rows={3}
                placeholder="Error logs, customer impact, etc."
                value={incForm.desc}
                onChange={e => setIncForm({ ...incForm, desc: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setNewIncModal(false)}
                className="flex-1 bg-slate-800 text-slate-300 text-xs py-2 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => triggerIncident(incForm)}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs py-2 rounded-lg"
              >
                Trigger Incident
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Ticket Modal */}
      {newTicket && (() => {
        // Filter technicians belonging to the selected team (or general IT) - strictly technicians, never admin
        const pureTechs = members.filter(m => m.role === "technician" && m.is_active !== false);
        const selectedTeamTechs = pureTechs.filter(m => 
          (!m.department || m.department.toLowerCase() === (ticketForm.team || "").toLowerCase() || m.department === "General IT" || m.department === "IT Support")
        );

        const currentDiag = getSystemDiagnostics();

        return (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Ticket className="w-4 h-4 text-indigo-400" />
                  Create Support Ticket
                </h3>
                <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/20 font-medium">
                  Smart Assisted
                </span>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Issue Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Cannot connect to Office Wi-Fi"
                  value={ticketForm.title}
                  onChange={e => setTicketForm({ ...ticketForm, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Issue Category</label>
                  <select
                    value={ticketForm.ticket_type}
                    onChange={e => {
                      const newType = e.target.value;
                      const typeToTeam = {
                        "Network Issue": "Network Team",
                        "Software Issue": "Application Support",
                        "Database Issue": "Database Team",
                        "Access Request": "Security Team",
                        "Hardware Request": "Infrastructure Team",
                        "Other": "IT Support"
                      };
                      const suggestedTeam = typeToTeam[newType] || teams[0]?.team_name || "IT Support";
                      setTicketForm({ ...ticketForm, ticket_type: newType, team: suggestedTeam, assigned_to: "auto" });
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="Network Issue">Network Issue</option>
                    <option value="Software Issue">Software Issue</option>
                    <option value="Access Request">Access Request</option>
                    <option value="Hardware Request">Hardware Request</option>
                    <option value="Database Issue">Database Issue</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Severity / Priority</label>
                  <select
                    value={ticketForm.priority}
                    onChange={e => setTicketForm({ ...ticketForm, priority: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Cascading Routing: Team ➔ Technician */}
              <div className="grid grid-cols-2 gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <div>
                  <label className="block text-xs text-indigo-300 font-medium mb-1">Target IT Team</label>
                  <select
                    value={ticketForm.team}
                    onChange={e => setTicketForm({ ...ticketForm, team: e.target.value, assigned_to: "auto" })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                  >
                    {teams.length > 0 ? (
                      teams.map(tm => (
                        <option key={tm.id} value={tm.team_name}>
                          {tm.team_name}{tm.is_default ? " (Default)" : ""}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="Network Team">Network Team</option>
                        <option value="Application Support">Application Support</option>
                        <option value="Database Team">Database Team</option>
                        <option value="Security Team">Security Team</option>
                        <option value="IT Support">IT Support</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-indigo-300 font-medium mb-1">Specific Technician</label>
                  <select
                    value={ticketForm.assigned_to}
                    onChange={e => setTicketForm({ ...ticketForm, assigned_to: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="auto">⚡ Next Available (Auto)</option>
                    {selectedTeamTechs.length > 0 ? (
                      selectedTeamTechs.map(tech => (
                        <option key={tech.id} value={tech.id}>
                          {tech.full_name || tech.email} ({tech.department || ticketForm.team})
                        </option>
                      ))
                    ) : pureTechs.length > 0 ? (
                      pureTechs.map(tech => (
                        <option key={tech.id} value={tech.id}>
                          {tech.full_name || tech.email} ({tech.department || "Other Team"})
                        </option>
                      ))
                    ) : (
                      <option value="auto" disabled>No technicians registered</option>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Submitter Identity</label>
                <input
                  type="text"
                  placeholder="Your Name or Email"
                  value={ticketForm.submitter || currentUserProfile?.full_name || currentUser?.email || ""}
                  onChange={e => setTicketForm({ ...ticketForm, submitter: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Description</label>
                <textarea
                  rows={3}
                  placeholder="Describe what happened or error messages you see..."
                  value={ticketForm.desc}
                  onChange={e => setTicketForm({ ...ticketForm, desc: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Pre-Diagnostic Automatic Attachment Pill */}
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">
                  Auto-attached context: <strong className="text-slate-300">{currentDiag.os}</strong> • <strong className="text-slate-300">{currentDiag.browser}</strong> • <span className="text-emerald-400">{currentDiag.network}</span>
                </span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setNewTicket(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-2 rounded-lg border border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submittingTicket}
                  onClick={() => submitTicket()}
                  className={`flex-1 font-medium text-xs py-2 rounded-lg shadow-lg shadow-indigo-950 transition-all flex items-center justify-center gap-2 ${
                    submittingTicket
                      ? "bg-indigo-700/60 text-indigo-300 cursor-not-allowed"
                      : "bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
                  }`}
                >
                  {submittingTicket ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    "Submit Ticket"
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Live In-Ticket Chat & Internal Notes Drawer */}
      {activeChatTicket && (
        <Suspense fallback={null}>
          <TicketChatModal
            ticket={activeChatTicket}
            currentUser={currentUser}
            currentUserProfile={currentUserProfile}
            orgConfig={orgConfig}
            teams={teams}
            members={members}
            onClose={() => setActiveChatTicket(null)}
            onTicketUpdated={(updatedTicket) => {
              setTickets(prev => prev.map(t => t.id === updatedTicket.id ? updatedTicket : t));
              setActiveChatTicket(updatedTicket);
            }}
          />
        </Suspense>
      )}

      {/* Root Cause Analysis (RCA) Resolution Modal */}
      {rcaModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Incident Resolution & Root Cause Analysis (RCA)
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Document the root cause and corrective actions taken for <strong>{rcaModal.title}</strong>
                </p>
              </div>
              <button
                onClick={() => setRcaModal(null)}
                className="text-slate-500 hover:text-slate-300 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmRcaResolution} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Root Cause Analysis (What caused the outage?) *
                </label>
                <textarea
                  required
                  rows={3}
                  value={rcaForm.root_cause}
                  onChange={e => setRcaForm({ ...rcaForm, root_cause: e.target.value })}
                  placeholder="e.g. Memory leak in background worker caused container OOM crash after spike in payload volume."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Actions Taken to Resolve *
                </label>
                <textarea
                  required
                  rows={2}
                  value={rcaForm.resolution_actions}
                  onChange={e => setRcaForm({ ...rcaForm, resolution_actions: e.target.value })}
                  placeholder="e.g. Restarted service cluster, purged stale queue items, and doubled pod memory allocation."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Preventive Measures
                  </label>
                  <input
                    type="text"
                    value={rcaForm.preventive_measure}
                    onChange={e => setRcaForm({ ...rcaForm, preventive_measure: e.target.value })}
                    placeholder="e.g. Added automated heap dump alerts."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Affected Users / Units
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={rcaForm.affected_count}
                    onChange={e => setRcaForm({ ...rcaForm, affected_count: e.target.value })}
                    placeholder="e.g. 150"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRcaModal(null)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRca}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium py-2 rounded-lg shadow-lg shadow-emerald-950 flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{submittingRca ? "Resolving & Logging..." : "Confirm & Send RCA Notice"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Ticket Re-Route Modal */}
      {rerouteModalTicket && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-indigo-400" />
                  Re-Route Ticket #{rerouteModalTicket.id}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Transfer ticket to another department queue or technician
                </p>
              </div>
              <button
                onClick={() => setRerouteModalTicket(null)}
                className="text-slate-500 hover:text-slate-300 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleReRouteTicket} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Destination IT Department Queue
                </label>
                <select
                  value={cardRerouteTeam}
                  onChange={e => {
                    setCardRerouteTeam(e.target.value);
                    setCardRerouteTechId("auto");
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                >
                  {teams.map(tm => (
                    <option key={tm.id} value={tm.team_name}>
                      {tm.team_name} {tm.is_default ? "(Default)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Assigned Technician
                </label>
                <select
                  value={cardRerouteTechId}
                  onChange={e => setCardRerouteTechId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value="auto">⚡ Next Available in Queue (Auto)</option>
                  {members
                    .filter(m => m.role === "technician" && m.is_active !== false)
                    .map(m => (
                      <option key={m.id} value={m.id}>
                        {m.full_name || m.email} ({m.department || "General IT"})
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRerouteModalTicket(null)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCardReroute}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-2 rounded-lg shadow-lg shadow-indigo-950 flex items-center justify-center gap-1.5"
                >
                  <GitBranch className="w-4 h-4" />
                  <span>{savingCardReroute ? "Re-routing..." : "Transfer Ticket"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showChangePassword && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm p-6 relative">
            {/* Close */}
            <button
              onClick={() => setShowChangePassword(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-800">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                <KeyRound className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Change Password</h3>
                <p className="text-[11px] text-slate-400">Set a new secure password for your account</p>
              </div>
            </div>

            {/* Error / Success banners */}
            {cpError && (
              <div className="mb-4 p-2.5 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
                {cpError}
              </div>
            )}
            {cpSuccess && (
              <div className="mb-4 p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs">
                {cpSuccess}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              {/* New Password */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">New Password</label>
                <div className="relative">
                  <input
                    type={cpShowNew ? "text" : "password"}
                    required
                    minLength={8}
                    placeholder="Min 8 characters"
                    value={cpNewPassword}
                    onChange={(e) => setCpNewPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3.5 pr-9 py-2.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none transition-colors"
                  />
                  <button type="button" onClick={() => setCpShowNew(p => !p)} className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300">
                    {cpShowNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Confirm Password</label>
                <div className="relative">
                  <input
                    type={cpShowConfirm ? "text" : "password"}
                    required
                    minLength={8}
                    placeholder="Repeat new password"
                    value={cpConfirmPassword}
                    onChange={(e) => setCpConfirmPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3.5 pr-9 py-2.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none transition-colors"
                  />
                  <button type="button" onClick={() => setCpShowConfirm(p => !p)} className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300">
                    {cpShowConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowChangePassword(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-2.5 rounded-xl border border-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={cpLoading}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs py-2.5 rounded-xl shadow-lg shadow-indigo-950 transition-all"
                >
                  {cpLoading ? "Saving..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Universal Ticket Resolution Settlement Modal */}
      {settlementTicket && (
        <Suspense fallback={null}>
          <TicketSettlementModal
            isOpen={Boolean(settlementTicket)}
            ticket={settlementTicket}
            onClose={() => setSettlementTicket(null)}
            onSettle={handleProcessSettlement}
          />
        </Suspense>
      )}

      {/* Mandatory MFA Enrollment Modal for Enforced Workspaces */}
      {showMandatoryMfaEnroll && (
        <Suspense fallback={null}>
          <MfaEnrollModal
            isOpen={showMandatoryMfaEnroll}
            isMandatory={true}
            onSuccess={() => {
              setShowMandatoryMfaEnroll(false);
              showBanner("🛡️ Two-Factor Authentication successfully enrolled!", "#22c55e");
            }}
          />
        </Suspense>
      )}

      {/* Direct Legal Policy Dialog (?privacy=true or ?terms=true) */}
      <LegalModal
        isOpen={Boolean(legalRoute)}
        initialTab={legalRoute || "privacy"}
        onClose={() => setLegalRoute(null)}
      />
    </div>
  );
}
