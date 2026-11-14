import { useState } from "react";
import { Activity, Plus, RefreshCw, CheckCircle2, AlertTriangle, XCircle, Trash2, X, ChevronDown, ChevronUp, GitBranch, Zap, Clock, Globe, ShieldAlert } from "lucide-react";
import { pingEndpoint } from "../engine/healthPingEngine";
import { supabase } from "../supabase";

const FAILURE_TYPES = [
  { key: "connection_refused", label: "Server Unreachable / No Connection" },
  { key: "http_5xx",          label: "HTTP 5xx Server Error (500/502/503)" },
  { key: "body_db_keyword",   label: "Database / SQL Error in Response" },
  { key: "slow_response",     label: "Slow Response (> 3 seconds)" },
  { key: "http_4xx",          label: "HTTP 4xx Auth / Config Error" },
  { key: "default",           label: "All Other Failures (Catch-All)" },
];

const STARTER_ENDPOINTS = [
  {
    name: "Customer Web Portal",
    health_url: "https://httpbin.org/status/200",
    responsible_team: "Application Support",
    check_interval_seconds: 60,
    health_alert_threshold: 70,
  },
  {
    name: "Core Authentication API",
    health_url: "https://api.github.com",
    responsible_team: "Security Team",
    check_interval_seconds: 60,
    health_alert_threshold: 70,
  },
  {
    name: "Payment Gateway Health",
    health_url: "https://cloudflare-dns.com/dns-query",
    responsible_team: "Backend Team",
    check_interval_seconds: 60,
    health_alert_threshold: 70,
  }
];

// Checks if a ping result should trigger escalation based on the service threshold
const shouldEscalate = (svc, pingResult) => {
  const threshold = svc.health_alert_threshold ?? 70;
  if (pingResult.status === "DOWN") return true;
  if ((pingResult.health_pct ?? 100) < threshold) return true;
  return false;
};

export default function MonitoredServices({
  services = [],
  teams = [],
  userRole = "user",
  onAddService,
  onDeleteService,
  onRefreshHealth,       // kept for compatibility — only called if services list itself changed
  onServiceOutage,
  onServiceHealthUpdate, // NEW: (svcId, updatedFields) => void — patch one service in-place in parent
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pingingId, setPingingId] = useState(null);
  const [showRouting, setShowRouting] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const [form, setForm] = useState({
    name: "",
    health_url: "",
    check_interval_seconds: 60,
    health_alert_threshold: 70, // NEW: default escalation threshold
  });

  const [routingRules, setRoutingRules] = useState({
    connection_refused: "",
    http_5xx:          "",
    body_db_keyword:   "",
    slow_response:     "",
    http_4xx:          "",
    default:           "",
  });

  const timeAgo = (ts) => {
    if (!ts) return "never";
    const d = Date.now() - new Date(ts).getTime();
    if (d < 60000) return `${Math.max(1, Math.floor(d / 1000))}s ago`;
    if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
    return `${Math.floor(d / 3600000)}h ago`;
  };

  // ── Applies ping result to a service: updates DB + parent state in-place ─────
  // Does NOT call loadData() — that was the bug causing all services to disappear.
  const applyPingResult = async (svc, pingResult) => {
    const updatedFields = {
      status: pingResult.status,
      health_pct: pingResult.health_pct,
      latency_ms: pingResult.latency,
      last_checked_at: pingResult.checked_at,
    };

    // 1. Persist to database (non-blocking, best-effort)
    if (svc.id) {
      try {
        await supabase.from("monitored_services").update(updatedFields).eq("id", svc.id);
      } catch (e) {
        console.warn("Health ping DB update error:", e);
      }
    }

    // 2. Update parent state in-place via callback — SAFE, no full loadData needed
    if (onServiceHealthUpdate) {
      onServiceHealthUpdate(svc.id || svc.name, updatedFields);
    }

    // 3. Fire escalation if threshold breached
    if (shouldEscalate(svc, pingResult) && onServiceOutage) {
      // Only escalate on status transition (was not already down/degraded)
      const prevHealth = svc.health_pct ?? 100;
      const prevStatus = svc.status;
      const threshold = svc.health_alert_threshold ?? 70;
      const nowBelowThreshold = (pingResult.health_pct ?? 100) < threshold;
      const wasAboveThreshold = prevHealth >= threshold && prevStatus !== "DOWN";

      if (pingResult.status === "DOWN" && prevStatus !== "DOWN") {
        onServiceOutage(svc, pingResult, "DOWN");
      } else if (nowBelowThreshold && wasAboveThreshold) {
        onServiceOutage(svc, pingResult, "THRESHOLD");
      }
    }
  };

  // ── Ping ALL services — fixed: no longer calls loadData ─────────────────────
  const handleRefreshAll = async () => {
    setRefreshing(true);
    try {
      // Try server-side edge function first (if deployed)
      const { data, error } = await supabase.functions.invoke("check-services", {
        body: { orgId: services[0]?.org_id || null }
      });

      if (!error && data?.success) {
        // Edge function handled DB updates server-side — just re-fetch services specifically
        // Using a targeted select instead of full loadData to avoid wiping state
        const orgId = services[0]?.org_id;
        if (orgId) {
          const { data: freshSvcs } = await supabase
            .from("monitored_services")
            .select("*")
            .eq("org_id", orgId);
          if (freshSvcs && freshSvcs.length > 0 && onServiceHealthUpdate) {
            freshSvcs.forEach(s => onServiceHealthUpdate(s.id, s));
          } else if (freshSvcs && freshSvcs.length > 0 && onRefreshHealth) {
            await onRefreshHealth();
          }
        }
        setRefreshing(false);
        return;
      }
    } catch (_) {
      // Fall through to client-side pings
    }

    // Client-side fallback: ping each service and update in-place
    for (const svc of services) {
      if (!svc.health_url) continue;
      try {
        const pingResult = await pingEndpoint(svc.health_url);
        await applyPingResult(svc, pingResult);
      } catch (e) {
        console.warn("Ping error for", svc.name, e);
      }
    }

    setRefreshing(false);
  };

  // ── Ping a SINGLE service — fixed: no longer calls loadData ─────────────────
  const handlePingSingle = async (svc) => {
    if (!svc.health_url) return;
    setPingingId(svc.id || svc.name);

    try {
      // Try edge function scoped to this service
      const { data, error } = await supabase.functions.invoke("check-services", {
        body: { orgId: svc.org_id || null, serviceId: svc.id }
      });

      if (!error && data?.success) {
        // Re-fetch just this service from DB
        if (svc.id) {
          const { data: freshSvc } = await supabase
            .from("monitored_services")
            .select("*")
            .eq("id", svc.id)
            .maybeSingle();
          if (freshSvc && onServiceHealthUpdate) {
            onServiceHealthUpdate(freshSvc.id, freshSvc);
          }
        }
        setPingingId(null);
        return;
      }
    } catch (_) {}

    // Client-side fallback
    try {
      const pingResult = await pingEndpoint(svc.health_url);
      await applyPingResult(svc, pingResult);
    } catch (e) {
      console.warn("Single ping error:", e);
    }

    setPingingId(null);
  };

  // ── Seed sample endpoints ────────────────────────────────────────────────────
  const handleSeedStarters = async () => {
    setSeeding(true);
    for (const starter of STARTER_ENDPOINTS) {
      const ping = await pingEndpoint(starter.health_url);
      if (onAddService) {
        await onAddService({
          ...starter,
          health_pct: ping.health_pct,
          status: ping.status,
          latency_ms: ping.latency,
          last_checked_at: ping.checked_at
        });
      }
    }
    setSeeding(false);
  };

  // ── Add new monitored service ────────────────────────────────────────────────
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    const rules = {};
    Object.entries(routingRules).forEach(([k, v]) => { if (v) rules[k] = v; });

    const defaultTeamId = rules.default || Object.values(rules)[0] || null;
    const defaultTeamObj = teams.find(t => t.id === defaultTeamId);

    const ping = await pingEndpoint(form.health_url.trim());

    if (onAddService) {
      await onAddService({
        name: form.name.trim(),
        health_url: form.health_url.trim() || null,
        check_interval_seconds: Number(form.check_interval_seconds) || 60,
        health_alert_threshold: Number(form.health_alert_threshold) || 70,
        routing_rules: Object.keys(rules).length > 0 ? rules : null,
        responsible_team: defaultTeamObj?.team_name || "General IT",
        health_pct: ping.health_pct,
        status: ping.status,
        latency_ms: ping.latency,
        last_checked_at: ping.checked_at
      });
    }

    setForm({ name: "", health_url: "", check_interval_seconds: 60, health_alert_threshold: 70 });
    setRoutingRules({ connection_refused: "", http_5xx: "", body_db_keyword: "", slow_response: "", http_4xx: "", default: "" });
    setShowRouting(false);
    setShowAddModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-400" />
            Live Application & Infrastructure Health
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time latency monitoring, reachability pings, and intelligent failure routing across company services.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefreshAll}
            disabled={refreshing}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors border border-slate-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-indigo-400" : ""}`} />
            {refreshing ? "Pinging All..." : "Ping Live Health"}
          </button>
          {userRole === "admin" && (
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-lg shadow-indigo-950"
            >
              <Plus className="w-4 h-4" />
              Add Monitored App
            </button>
          )}
        </div>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.map((svc, i) => {
          const healthPct = svc.health_pct ?? svc.health ?? 100;
          const threshold = svc.health_alert_threshold ?? 70;
          const isHealthy = svc.status === "OPERATIONAL" || (!svc.status && healthPct >= 90);
          const isDegraded = svc.status === "DEGRADED" || (!svc.status && healthPct < 90 && healthPct >= 50);
          const isDown = svc.status === "DOWN" || (!svc.status && healthPct < 50);
          const isBelowThreshold = healthPct < threshold && !isDown;
          const hasRouting = svc.routing_rules && Object.keys(svc.routing_rules).length > 0;
          const isPinging = pingingId === (svc.id || svc.name);

          return (
            <div
              key={svc.id || svc.name || i}
              className={`bg-slate-900 border rounded-xl p-4 shadow-sm flex flex-col justify-between transition-all ${
                isDown
                  ? "border-rose-500/50 bg-rose-950/10"
                  : isBelowThreshold
                  ? "border-amber-500/60 bg-amber-950/10"
                  : isDegraded
                  ? "border-amber-500/40 bg-amber-950/5"
                  : "border-slate-800 hover:border-slate-700"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-slate-100 truncate pr-2">{svc.name}</h3>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                      isHealthy && !isBelowThreshold
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : isBelowThreshold
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        : isDegraded
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                    }`}
                  >
                    {isDown ? <XCircle className="w-3 h-3" /> : (isBelowThreshold || isDegraded) ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                    {svc.status || (isDown ? "DOWN" : isBelowThreshold ? "DEGRADED" : "OPERATIONAL")}
                  </span>
                </div>

                <div className="text-xs text-slate-400 mb-2 flex items-center justify-between">
                  <span>Team: <strong className="text-slate-300">{svc.responsible_team || "General IT"}</strong></span>
                  <span className={`text-[11px] font-mono font-semibold flex items-center gap-1 ${
                    (svc.latency_ms || 45) < 300
                      ? "text-emerald-400"
                      : (svc.latency_ms || 45) < 1500
                      ? "text-amber-400"
                      : "text-rose-400"
                  }`}>
                    <Zap className="w-3 h-3" />
                    {svc.latency_ms ? `${svc.latency_ms}ms` : "-- ms"}
                    {svc.http_code ? (
                      <span className={`ml-1 text-[9px] px-1.5 py-0.5 rounded font-bold ${
                        svc.http_code >= 500 ? "bg-rose-500/20 text-rose-300 border border-rose-500/30" :
                        svc.http_code >= 400 ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" :
                        "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      }`}>
                        HTTP {svc.http_code}
                      </span>
                    ) : null}
                  </span>
                </div>

                {/* Escalation Threshold Badge */}
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={`text-[10px] flex items-center gap-1 px-1.5 py-0.5 rounded border font-medium ${
                    isBelowThreshold
                      ? "bg-amber-500/15 text-amber-400 border-amber-500/30 animate-pulse"
                      : "bg-slate-800/80 text-slate-500 border-slate-700/50"
                  }`}>
                    <ShieldAlert className="w-3 h-3" />
                    Alert if &lt; {threshold}% health
                  </span>
                  {isBelowThreshold && (
                    <span className="text-[10px] text-amber-400 font-semibold animate-pulse">
                      ⚠️ Below threshold!
                    </span>
                  )}
                </div>

                {hasRouting && (
                  <div className="flex items-center gap-1 text-[11px] text-indigo-400 mb-2">
                    <GitBranch className="w-3 h-3" />
                    Smart routing ({Object.keys(svc.routing_rules).length} rules)
                  </div>
                )}

                {svc.health_url ? (
                  <p className="text-[11px] text-slate-500 font-mono truncate mb-2 flex items-center gap-1">
                    <Globe className="w-3 h-3 shrink-0 text-slate-600" />
                    {svc.health_url}
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-600 italic mb-2">Internal passive monitor (no URL)</p>
                )}
              </div>

              <div className="pt-2 border-t border-slate-800/80">
                <div className="flex justify-between items-center text-xs text-slate-400 mb-1">
                  <span className="flex items-center gap-1 text-[10px] text-slate-500">
                    <Clock className="w-3 h-3" />
                    {timeAgo(svc.last_checked_at)}
                  </span>
                  <span className={`font-semibold ${
                    isBelowThreshold ? "text-amber-400" : isDown ? "text-rose-400" : "text-slate-200"
                  }`}>{healthPct}% Health</span>
                </div>

                <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden mb-3">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isDown ? "bg-rose-500" : isBelowThreshold ? "bg-amber-500" : isDegraded ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                    style={{ width: `${healthPct}%` }}
                  />
                </div>

                {/* Threshold progress line */}
                <div className="relative w-full h-0 mb-2">
                  <div
                    className="absolute top-[-10px] w-px h-3 bg-slate-500 opacity-60"
                    style={{ left: `${threshold}%` }}
                    title={`Escalation threshold: ${threshold}%`}
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  {svc.health_url ? (
                    <button
                      onClick={() => handlePingSingle(svc)}
                      disabled={isPinging}
                      className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium transition-colors"
                    >
                      <RefreshCw className={`w-3 h-3 ${isPinging ? "animate-spin text-indigo-400" : ""}`} />
                      {isPinging ? "Checking..." : "Ping Now"}
                    </button>
                  ) : <span />}

                  {userRole === "admin" && onDeleteService && (
                    <button
                      onClick={() => onDeleteService(svc)}
                      className="text-slate-500 hover:text-rose-400 text-xs flex items-center gap-1 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {services.length === 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center max-w-md mx-auto space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-200">No Live Monitored Services Yet</h3>
            <p className="text-xs text-slate-400 mt-1">
              {userRole === "admin"
                ? "Add your company's APIs, customer portal, or database health endpoints to track uptime and auto-route failures."
                : "No external endpoints are currently configured for uptime monitoring."}
            </p>
          </div>
          {userRole === "admin" ? (
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                onClick={() => setShowAddModal(true)}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium py-2 px-3 rounded-lg shadow-lg shadow-indigo-950 transition-colors"
              >
                <Plus className="w-3.5 h-3.5 inline mr-1" /> Add Custom App
              </button>
              <button
                onClick={handleSeedStarters}
                disabled={seeding}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-2 px-3 rounded-lg border border-slate-700 transition-colors"
              >
                {seeding ? "Loading Endpoints..." : "Load 3 Sample Endpoints"}
              </button>
            </div>
          ) : (
            <div className="pt-2 text-xs text-slate-500 italic">
              Live service endpoints can be configured by system administrators.
            </div>
          )}
        </div>
      )}

      {/* Add Monitored Service Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between sticky top-0">
              <h3 className="font-semibold text-slate-100 text-sm">Add Monitored Application</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Application / Service Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Payroll Portal API, Core Database Service"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Live Healthcheck Endpoint URL</label>
                <input
                  type="url"
                  placeholder="https://api.company.com/health or https://httpbin.org/status/200"
                  value={form.health_url}
                  onChange={e => setForm({ ...form, health_url: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                />
                <p className="text-[11px] text-slate-500 mt-1">BizaDesk pings this URL to measure real response times and uptime.</p>
              </div>

              {/* Health Alert Threshold — NEW */}
              <div className="bg-slate-950/80 border border-amber-500/20 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                  <label className="text-xs font-semibold text-amber-300">Escalation Alert Threshold</label>
                </div>
                <p className="text-[11px] text-slate-400">
                  Auto-trigger an incident and alert the team when this service's health drops below the selected percentage, even if it isn't fully down.
                </p>
                <div className="flex items-center gap-3">
                  <select
                    value={form.health_alert_threshold}
                    onChange={e => setForm({ ...form, health_alert_threshold: Number(e.target.value) })}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                  >
                    <option value={90}>Alert if below 90% health (Strict)</option>
                    <option value={80}>Alert if below 80% health (High)</option>
                    <option value={70}>Alert if below 70% health (Recommended)</option>
                    <option value={60}>Alert if below 60% health (Moderate)</option>
                    <option value={50}>Alert if below 50% health (Lenient)</option>
                    <option value={0}>Only alert when fully DOWN (0%)</option>
                  </select>
                  <span className="text-xs text-amber-400 font-bold shrink-0 w-16 text-center">
                    &lt; {form.health_alert_threshold}%
                  </span>
                </div>
              </div>

              {/* Routing Rules */}
              <div className="border border-slate-700 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowRouting(!showRouting)}
                  className="w-full px-4 py-3 flex items-center justify-between bg-slate-950 hover:bg-slate-900 transition-colors text-xs"
                >
                  <span className="flex items-center gap-2 font-semibold text-slate-200">
                    <GitBranch className="w-4 h-4 text-indigo-400" />
                    Configure Failure-Type Routing
                    {teams.length === 0 && <span className="text-amber-400 font-normal">(Add teams first)</span>}
                  </span>
                  {showRouting ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>

                {showRouting && (
                  <div className="p-4 space-y-3 bg-slate-900/50">
                    <p className="text-[11px] text-slate-500">
                      When this app experiences a specific failure type, automatically route the incident to that team:
                    </p>
                    {FAILURE_TYPES.map(({ key, label }) => (
                      <div key={key} className="flex items-center gap-3">
                        <span className="text-xs text-slate-400 w-52 shrink-0">{label}</span>
                        <span className="text-slate-600 text-xs">→</span>
                        <select
                          value={routingRules[key]}
                          onChange={e => setRoutingRules({ ...routingRules, [key]: e.target.value })}
                          className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                        >
                          <option value="">— Use Default Team —</option>
                          {teams.map(t => (
                            <option key={t.id} value={t.id}>
                              {t.team_name}{t.is_default ? " (Default)" : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-2.5 rounded-lg border border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium py-2.5 rounded-lg shadow-lg shadow-indigo-950"
                >
                  Save & Ping Now
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
