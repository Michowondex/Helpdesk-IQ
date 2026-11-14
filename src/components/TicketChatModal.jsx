import { useState, useEffect, useRef } from "react";
import { MessageSquare, Send, Shield, User, Clock, CheckCircle2, AlertCircle, X, Lock, Paperclip, Monitor, Globe, Cpu, Copy, Check, RefreshCw, Key, Share2, GitBranch, Pause } from "lucide-react";
import { supabase } from "../supabase";
import { calculateBusinessSla } from "../engine/businessSla";

export default function TicketChatModal({ ticket, currentUser, currentUserProfile, orgConfig, teams = [], members = [], onClose, onTicketUpdated }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(ticket?.status || "OPEN");
  const [showQuickAssistModal, setShowQuickAssistModal] = useState(false);
  const [assistCode, setAssistCode] = useState("842-194");
  const [copiedCode, setCopiedCode] = useState(false);
  const messagesEndRef = useRef(null);

  // Re-route panel state (Admin only)
  const isAdmin = currentUserProfile?.role === "admin" || currentUser?.email?.toLowerCase().endsWith("@bizadoc.com");
  const [showReroute, setShowReroute] = useState(false);
  const [rerouteTeam, setRerouteTeam] = useState(ticket?.team || "IT Helpdesk");
  const [rerouteTechId, setRerouteTechId] = useState(ticket?.assigned_to || "auto");
  const [savingReroute, setSavingReroute] = useState(false);

  // Live SLA calculation (With Business Hours Pause)
  const slaHours = Number(orgConfig?.ticket_sla_hours) || 1;
  const slaData = calculateBusinessSla({
    createdTimestamp: ticket?.created,
    slaHours,
    workStartHour: orgConfig?.work_start_hour ?? 8,
    workEndHour: orgConfig?.work_end_hour ?? 18,
    workDaysStr: orgConfig?.work_days || "1,2,3,4,5",
    isBreachedDirect: ticket?.sla_breached,
    resolvedTimestamp: ticket?.resolved_at
  });
  const { isBreached, remainingMins, breachMins, pctRemaining, isPaused, nextResumeText } = slaData;

  // Pure technicians list (strictly excluding Admins)
  const pureTechs = members.filter(m => m.role === "technician" && m.is_active !== false);
  const teamTechs = pureTechs.filter(m => !m.department || m.department.toLowerCase() === rerouteTeam.toLowerCase());

  const handleApplyReroute = async () => {
    setSavingReroute(true);
    try {
      const chosenTech = pureTechs.find(t => t.id === rerouteTechId);
      const newAssigneeName = chosenTech ? (chosenTech.full_name || chosenTech.email) : `Unassigned (${rerouteTeam})`;
      const newAssigneeId = chosenTech ? chosenTech.id : null;

      await supabase.from("tickets").update({
        team: rerouteTeam,
        assigned_to: newAssigneeId,
        assignee_name: newAssigneeName
      }).eq("id", ticket.id);

      const auditMsg = {
        ticket_id: ticket.id,
        org_id: ticket.org_id || null,
        sender_id: currentUser?.id || "admin-system",
        sender_name: "Admin Dispatch",
        sender_role: "admin",
        is_internal: true,
        message: `🔄 Ticket re-routed to queue "${rerouteTeam}" — Assigned to: ${newAssigneeName}`,
        created_at: new Date().toISOString()
      };

      try {
        await supabase.from("ticket_messages").insert(auditMsg);
        setMessages(prev => [...prev, { ...auditMsg, id: `msg-${Date.now()}` }]);
      } catch (_) {}

      if (onTicketUpdated) {
        onTicketUpdated({
          ...ticket,
          team: rerouteTeam,
          assigned_to: newAssigneeId,
          assignee_name: newAssigneeName
        });
      }
      setShowReroute(false);
    } catch (err) {
      console.warn("Re-route error:", err);
    } finally {
      setSavingReroute(false);
    }
  };

  const isTechOrAdmin = currentUserProfile?.role === "technician" || currentUserProfile?.role === "admin";

  const loadMessages = async () => {
    if (!ticket?.id) return;
    try {
      const { data, error } = await supabase
        .from("ticket_messages")
        .select("*")
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: true });

      if (!error && data) {
        setMessages(data);
      }
    } catch (err) {
      console.warn("Error loading ticket messages:", err);
    }
  };

  useEffect(() => {
    loadMessages();
    setCurrentStatus(ticket?.status || "OPEN");

    // Optional: Realtime subscription for live messages on this ticket
    const channel = supabase
      .channel(`ticket-chat-${ticket?.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ticket_messages", filter: `ticket_id=eq.${ticket?.id}` }, (payload) => {
        setMessages((prev) => {
          if (prev.find((m) => m.id === payload.new.id)) return prev;
          return [...prev, payload.new];
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticket?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    const msgPayload = {
      ticket_id: ticket.id,
      org_id: ticket.org_id || currentUserProfile?.org_id || null,
      sender_id: currentUser?.id || "demo-sender-id",
      sender_name: currentUserProfile?.full_name || currentUser?.email || "User",
      sender_role: currentUserProfile?.role || "user",
      message: newMessage.trim(),
      is_internal: isTechOrAdmin && isInternal,
      created_at: new Date().toISOString()
    };

    try {
      const { data, error } = await supabase.from("ticket_messages").insert(msgPayload).select().single();
      if (!error && data) {
        setMessages((prev) => [...prev, data]);
      } else {
        // Optimistic local fallback if offline or demo mode
        setMessages((prev) => [...prev, { ...msgPayload, id: `msg-${Date.now()}` }]);
      }
      setNewMessage("");
    } catch (err) {
      console.warn("Message send error:", err);
      setMessages((prev) => [...prev, { ...msgPayload, id: `msg-${Date.now()}` }]);
      setNewMessage("");
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (newStat) => {
    setUpdatingStatus(true);
    setCurrentStatus(newStat);
    try {
      await supabase.from("tickets").update({ status: newStat }).eq("id", ticket.id);
      if (onTicketUpdated) onTicketUpdated({ ...ticket, status: newStat });
    } catch (err) {
      console.warn("Status change error:", err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const fmtTime = (ts) => {
    if (!ts) return "--:--";
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const handleSendQuickAssistInvite = async () => {
    const inviteText = `🖥 Windows Quick Assist Remote Session\n\nA technician is ready to assist you via screen share:\n1. Press Ctrl + Win + Q on your keyboard.\n2. Click "Get help".\n3. Enter this 6-digit security code: ${assistCode}\n4. Click "Share Screen" and authorize connection.`;

    const msgPayload = {
      ticket_id: ticket.id,
      org_id: ticket.org_id || currentUserProfile?.org_id || null,
      sender_id: currentUser?.id || "tech-sender-id",
      sender_name: currentUserProfile?.full_name || currentUser?.email || "Technician",
      sender_role: currentUserProfile?.role || "technician",
      message: inviteText,
      is_internal: false,
      created_at: new Date().toISOString()
    };

    try {
      const { data, error } = await supabase.from("ticket_messages").insert(msgPayload).select().single();
      if (!error && data) {
        setMessages((prev) => [...prev, data]);
      } else {
        setMessages((prev) => [...prev, { ...msgPayload, id: `msg-${Date.now()}` }]);
      }
    } catch (err) {
      console.warn("Error posting Quick Assist invite:", err);
      setMessages((prev) => [...prev, { ...msgPayload, id: `msg-${Date.now()}` }]);
    }
    setShowQuickAssistModal(false);
  };

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(assistCode.replace("-", ""));
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full h-[88vh] flex flex-col overflow-hidden">
        {/* Chat Header */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30 shrink-0">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-xs text-white">{ticket.id}</span>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                  currentStatus === "RESOLVED"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : currentStatus === "IN_PROGRESS"
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                }`}>
                  {currentStatus}
                </span>
                <span className="text-[10px] text-slate-500 hidden sm:inline">• {ticket.team}</span>
              </div>
              <h2 className="text-xs font-semibold text-slate-200 truncate max-w-md">{ticket.title}</h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Admin Re-Route Button */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowReroute(!showReroute)}
                className={`text-xs px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-colors font-medium border ${
                  showReroute 
                    ? "bg-amber-600/30 text-amber-300 border-amber-500/50" 
                    : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                }`}
                title="Re-route ticket to a different team or technician"
              >
                <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden sm:inline">Re-route</span>
              </button>
            )}

            {/* Quick Assist Launch Button (Technicians / Admins only) */}
            {isTechOrAdmin && (
              <button
                type="button"
                onClick={() => {
                  const p1 = Math.floor(100 + Math.random() * 900);
                  const p2 = Math.floor(100 + Math.random() * 900);
                  setAssistCode(`${p1}-${p2}`);
                  setShowQuickAssistModal(true);
                }}
                className="bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-colors font-medium"
                title="Initiate Windows Quick Assist Remote Session"
              >
                <Monitor className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden sm:inline">Quick Assist</span>
              </button>
            )}

            {/* Status Change Dropdown (for Technicians / Admins) */}
            {isTechOrAdmin && (
              <select
                value={currentStatus}
                disabled={updatingStatus}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none cursor-pointer"
              >
                <option value="OPEN">Status: OPEN</option>
                <option value="IN_PROGRESS">Status: IN PROGRESS</option>
                <option value="PENDING">Status: PENDING</option>
                <option value="RESOLVED">Status: RESOLVED</option>
              </select>
            )}

            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live SLA Progress Bar */}
        <div className="px-5 py-2.5 bg-slate-950 border-b border-slate-800 shrink-0 space-y-1">
          <div className="flex items-center justify-between text-xs">
            {currentStatus === "RESOLVED" ? (
              <span className="font-semibold flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Resolved in {Math.max(1, Math.round((slaData.businessElapsedMs || (Date.now() - ticket.created)) / 60000))}m business time</span>
              </span>
            ) : isPaused ? (
              <span className="font-semibold flex items-center gap-1.5 text-sky-400">
                <Pause className="w-3.5 h-3.5 animate-pulse" />
                <span>⏸️ SLA Paused (Resumes {nextResumeText}) • {remainingMins}m remaining</span>
              </span>
            ) : (
              <span className={`font-semibold flex items-center gap-1.5 ${
                isBreached 
                  ? "text-rose-400 animate-pulse" 
                  : pctRemaining < 25 
                  ? "text-rose-400" 
                  : pctRemaining < 50 
                  ? "text-amber-400" 
                  : "text-slate-300"
              }`}>
                <Clock className="w-3.5 h-3.5" />
                {isBreached ? `🚨 SLA Breached by ${breachMins}m` : `${remainingMins}m remaining before breach`}
              </span>
            )}
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span>Queue: <strong className="text-indigo-300">{ticket.team}</strong></span>
              <span>• Assignee: <strong className="text-slate-200">{ticket.assignee_name || "Unassigned"}</strong></span>
            </div>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                currentStatus === "RESOLVED"
                  ? "bg-emerald-500"
                  : isBreached
                  ? "bg-rose-500 animate-pulse"
                  : isPaused
                  ? "bg-sky-500/70"
                  : pctRemaining < 25
                  ? "bg-rose-500"
                  : pctRemaining < 50
                  ? "bg-amber-500"
                  : "bg-emerald-500"
              }`}
              style={{ width: currentStatus === "RESOLVED" ? "100%" : isBreached ? "100%" : `${pctRemaining}%` }}
            />
          </div>
        </div>

        {/* Admin Re-Route Panel (Collapsible) */}
        {showReroute && (
          <div className="px-5 py-3 bg-indigo-950/30 border-b border-indigo-500/30 shrink-0 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
                Re-Route Ticket Queue & Assignee (Admin Control)
              </span>
              <button onClick={() => setShowReroute(false)} className="text-slate-400 hover:text-white text-xs">✕</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Target IT Queue / Department</label>
                <select
                  value={rerouteTeam}
                  onChange={e => {
                    setRerouteTeam(e.target.value);
                    setRerouteTechId("auto");
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                >
                  {teams.length > 0 ? (
                    teams.map(t => (
                      <option key={t.id} value={t.team_name}>
                        {t.team_name}{t.is_default ? " ★ (Default Fallback)" : ""}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="IT Helpdesk">IT Helpdesk</option>
                      <option value="Network Team">Network Team</option>
                      <option value="Database Team">Database Team</option>
                      <option value="Security Team">Security Team</option>
                    </>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Specific Technician (Technicians Only)</label>
                <select
                  value={rerouteTechId}
                  onChange={e => setRerouteTechId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="auto">⚡ Next Available in Queue (Auto)</option>
                  {teamTechs.length > 0 ? (
                    teamTechs.map(tech => (
                      <option key={tech.id} value={tech.id}>
                        {tech.full_name || tech.email}
                      </option>
                    ))
                  ) : (
                    <option value="auto" disabled>No technicians assigned to {rerouteTeam}</option>
                  )}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowReroute(false)}
                className="px-3 py-1 text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingReroute}
                onClick={handleApplyReroute}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold px-4 py-1.5 rounded-lg shadow transition-colors flex items-center gap-1"
              >
                {savingReroute ? "Re-routing..." : "Apply Re-Route"}
              </button>
            </div>
          </div>
        )}

        {/* Pre-Diagnostic System Context Bar */}
        {ticket.diagnostics && (
          <div className="px-5 py-2 bg-slate-950/70 border-b border-slate-800 text-[11px] text-slate-400 flex flex-wrap items-center gap-4 shrink-0">
            <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Workstation Context:</span>
            <span className="flex items-center gap-1 text-slate-300">
              <Monitor className="w-3 h-3 text-cyan-400" />
              {ticket.diagnostics.os}
            </span>
            <span className="flex items-center gap-1 text-slate-300">
              <Globe className="w-3 h-3 text-indigo-400" />
              {ticket.diagnostics.browser}
            </span>
            <span className="flex items-center gap-1 text-slate-300">
              <Cpu className="w-3 h-3 text-amber-400" />
              {ticket.diagnostics.device}
            </span>
            <span className="text-emerald-400 text-[10px] bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
              {ticket.diagnostics.network}
            </span>
          </div>
        )}

        {/* Messages Feed */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 bg-slate-900/50">
          {/* Original Ticket Description Card */}
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5 text-xs space-y-1.5">
            <div className="flex items-center justify-between text-slate-400 text-[10px]">
              <span className="font-semibold text-slate-300">
                Ticket Description (by {ticket.submitter || "Staff"})
              </span>
              <span>{fmtTime(ticket.created)}</span>
            </div>
            <p className="text-slate-200 leading-relaxed whitespace-pre-wrap">{ticket.description || "No additional description provided."}</p>
          </div>

          {messages.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              <MessageSquare className="w-6 h-6 mx-auto mb-2 text-slate-600 opacity-60" />
              <p>No messages yet in this ticket.</p>
              <p className="text-[11px] text-slate-600 mt-0.5">Start the conversation below.</p>
            </div>
          ) : (
            messages.map((m) => {
              const isSenderMe = m.sender_id === currentUser?.id || m.sender_name === currentUserProfile?.full_name;
              const isInternalNote = m.is_internal;

              // If message is internal and viewer is a regular staff user, hide it completely!
              if (isInternalNote && !isTechOrAdmin) return null;

              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isSenderMe ? "items-end" : "items-start"}`}
                >
                  <div className="flex items-center gap-1.5 mb-1 text-[10px] text-slate-400">
                    <span className="font-semibold text-slate-300">
                      {m.sender_name || (isSenderMe ? "You" : "Staff Member")}
                    </span>
                    {m.sender_role && (
                      <span className={`text-[8px] uppercase tracking-wider font-bold px-1.5 py-0.2 rounded border ${
                        m.sender_role === "admin"
                          ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                          : m.sender_role === "technician"
                          ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                          : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      }`}>
                        {m.sender_role}
                      </span>
                    )}
                    <span>• {fmtTime(m.created_at)}</span>
                    {isInternalNote && (
                      <span className="bg-amber-500/15 text-amber-400 text-[9px] font-bold px-1.5 py-0.2 rounded border border-amber-500/30 flex items-center gap-0.5">
                        <Lock className="w-2.5 h-2.5" /> INTERNAL NOTE
                      </span>
                    )}
                  </div>

                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed whitespace-pre-wrap shadow-sm ${
                      isInternalNote
                        ? "bg-amber-950/40 border border-amber-500/30 text-amber-200"
                        : isSenderMe
                        ? "bg-indigo-600 text-white rounded-br-xs"
                        : "bg-slate-800 text-slate-200 border border-slate-700/60 rounded-bl-xs"
                    }`}
                  >
                    {m.message}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSendMessage} className="p-3 bg-slate-950 border-t border-slate-800 shrink-0 space-y-2">
          {/* Technician Internal Note Toggle */}
          {isTechOrAdmin && (
            <div className="flex items-center justify-between text-xs px-1">
              <label className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-slate-200 select-none">
                <input
                  type="checkbox"
                  checked={isInternal}
                  onChange={(e) => setIsInternal(e.target.checked)}
                  className="accent-amber-500 w-3.5 h-3.5 rounded"
                />
                <span className={`text-[11px] font-medium flex items-center gap-1 ${isInternal ? "text-amber-400" : "text-slate-400"}`}>
                  <Lock className="w-3 h-3" /> Post as Private Internal Note (Hidden from staff user)
                </span>
              </label>

              <span className="text-[10px] text-slate-500 hidden sm:inline">Press Enter to send</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder={isInternal ? "Write private note for technicians only..." : "Type reply to user / technician..."}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className={`flex-1 bg-slate-900 border rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors ${
                isInternal ? "border-amber-500/50 focus:border-amber-500" : "border-slate-800 focus:border-indigo-500"
              }`}
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || sending}
              className={`p-2.5 rounded-xl font-medium text-xs flex items-center justify-center transition-all disabled:opacity-40 text-white shadow-lg ${
                isInternal ? "bg-amber-600 hover:bg-amber-500 shadow-amber-950" : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-950"
              }`}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>

      {/* Windows Quick Assist Remote Session Modal */}
      {showQuickAssistModal && (
        <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Monitor className="w-5 h-5 text-indigo-400" />
                <h3 className="font-semibold text-slate-100 text-sm">Windows Quick Assist Remote Session</h3>
              </div>
              <button onClick={() => setShowQuickAssistModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3.5 text-xs text-indigo-200 leading-relaxed">
                <strong className="block text-indigo-300 font-semibold mb-1">Attended Remote Screen Share</strong>
                Initiate a secure screen-sharing session with the user reporting ticket <span className="font-mono font-bold text-white">{ticket.id}</span>.
              </div>

              {/* Code Box */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-center space-y-2">
                <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">6-Digit Security Code</div>
                <div className="text-2xl font-mono font-black text-indigo-400 tracking-widest">{assistCode}</div>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedCode ? "Copied!" : "Copy Code"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const p1 = Math.floor(100 + Math.random() * 900);
                      const p2 = Math.floor(100 + Math.random() * 900);
                      setAssistCode(`${p1}-${p2}`);
                    }}
                    className="text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Regenerate
                  </button>
                </div>
              </div>

              {/* Instructions */}
              <div className="text-xs text-slate-300 space-y-2 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 text-xs flex items-center justify-center shrink-0">1</span>
                  <span>Press <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-200 font-mono text-[11px]">Ctrl + Win + Q</kbd> on your PC, then select <strong>&quot;Help someone&quot;</strong>.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 text-xs flex items-center justify-center shrink-0">2</span>
                  <span>Click <strong>&quot;Post Code &amp; Instructions to Chat&quot;</strong> below so the user receives the code and connects.</span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQuickAssistModal(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-2.5 px-3 rounded-lg border border-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendQuickAssistInvite}
                  className="flex-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs py-2.5 px-4 rounded-lg transition-all shadow-lg shadow-indigo-950 flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  Post Code &amp; Instructions to Chat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

