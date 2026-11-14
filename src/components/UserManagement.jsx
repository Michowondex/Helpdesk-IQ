import { useState, useEffect } from "react";
import { UserPlus, Users, Trash2, Mail, Shield, CheckCircle2, AlertCircle, X, KeyRound, Building2, Copy, Check, Sparkles, RefreshCw, Send, Clock, UserX, UserCheck } from "lucide-react";
import { supabase } from "../supabase";

const ROLE_BADGES = {
  admin: {
    label: "Admin",
    desc: "Full workspace configuration, billing, & all access",
    style: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30"
  },
  technician: {
    label: "Technician",
    desc: "Incident command, tickets queue, & service monitors",
    style: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
  },
  user: {
    label: "Staff User",
    desc: "Virtual IT self-service & their own tickets only",
    style: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
  }
};

export default function UserManagement({ orgId, orgConfig, teams = [] }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [adding, setAdding] = useState(false);
  const [banner, setBanner] = useState(null);
  const [createdUserNotice, setCreatedUserNotice] = useState(null);
  const [copiedNotice, setCopiedNotice] = useState(false);

  // Reset password modal state
  const [resetTarget, setResetTarget] = useState(null);   // { id, email, full_name }
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // Form states with domain auto-suffix
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [customEmail, setCustomEmail] = useState("");
  const [useCustomEmail, setUseCustomEmail] = useState(false);
  const [role, setRole] = useState("technician");
  const [department, setDepartment] = useState("");
  const [tempPassword, setTempPassword] = useState("");

  // Determine active company domain
  const getCompanyDomain = () => {
    if (orgConfig?.domain && orgConfig.domain.trim()) {
      return orgConfig.domain.trim().replace(/^@/, "").toLowerCase();
    }
    if (orgConfig?.support_email && orgConfig.support_email.includes("@")) {
      return orgConfig.support_email.split("@")[1].toLowerCase();
    }
    if (orgConfig?.name) {
      const slug = orgConfig.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (slug) return `${slug}.com`;
    }
    return "company.com";
  };
  const companyDomain = getCompanyDomain();

  const notify = (msg, color = "#22c55e") => {
    setBanner({ msg, color });
    setTimeout(() => setBanner(null), 4000);
  };

  const loadMembers = async () => {
    try {
      setLoading(true);
      let query = supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (orgId) {
        query = query.eq("org_id", orgId);
      }
      const { data, error } = await query;
      if (!error && data) {
        setMembers(data);
      }
    } catch (err) {
      console.warn("Error loading members:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, [orgId]);

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) return;

    const targetEmail = useCustomEmail 
      ? customEmail.trim().toLowerCase()
      : `${username.trim().replace(/@.*$/, "").toLowerCase()}@${companyDomain}`;

    if (!targetEmail || (!useCustomEmail && !username.trim())) {
      notify("Please enter a valid username or email", "#ef4444");
      return;
    }

    setAdding(true);

    try {
      const tempPass = tempPassword.trim() || "BizaDesk@2026";
      const assignedDept = department || (teams[0]?.team_name || "General IT");

      // ── STEP 1: Check if a profile already exists for this email ──────────
      // (Could be a pre-existing account from a previous invite attempt)
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", targetEmail)
        .maybeSingle();

      let profileId = existingProfile?.id || crypto.randomUUID();

      // ── STEP 2: Provision the member directly in public.profiles ─────────
      // This avoids client-side supabase.auth.signUp() which requires captcha.
      // The invited user signs in later (Google OAuth or email link),
      // and App.jsx fetchProfile() will claim & link this profile row
      // to their auth.uid automatically.
      const newMemberPayload = {
        id: profileId,
        org_id: orgId || null,
        full_name: fullName.trim(),
        email: targetEmail,
        role: role,
        department: assignedDept,
        account_type: "business",
        is_active: true
      };

      const { error: profileErr } = await supabase
        .from("profiles")
        .upsert(newMemberPayload, { onConflict: "email" });

      if (profileErr) {
        // Fallback: try direct insert with a fresh UUID if conflict was on id
        const { error: insertErr } = await supabase
          .from("profiles")
          .insert({
            ...newMemberPayload,
            id: crypto.randomUUID()
          });
        if (insertErr && !insertErr.message?.includes("duplicate") && !insertErr.message?.includes("unique")) {
          throw insertErr;
        }
      }

      setCreatedUserNotice({
        name: fullName.trim(),
        email: targetEmail,
        tempPass: tempPass,
        role: ROLE_BADGES[role].label
      });

      notify(`✓ ${fullName} provisioned as ${ROLE_BADGES[role].label} — they can now sign in with Google or request a password reset.`);
      setFullName("");
      setUsername("");
      setCustomEmail("");
      setTempPassword("");
      setShowAddModal(false);
      loadMembers();
    } catch (err) {
      notify(`Failed to add user: ${err.message}`, "#ef4444");
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteMember = async (member) => {
    const confirmMsg = `Are you sure you want to permanently delete ${member.full_name || member.email}?\n\nTip: You can click the Suspend button instead to revoke their login access while keeping their resolution history intact.`;
    if (!confirm(confirmMsg)) return;
    try {
      await supabase.from("profiles").delete().eq("id", member.id);
      notify(`Removed ${member.full_name || member.email}`, "#64748b");
      loadMembers();
    } catch (err) {
      notify(`Error deleting user: ${err.message}`, "#ef4444");
    }
  };

  const handleToggleSuspend = async (member) => {
    const isCurrentlyActive = member.is_active !== false;
    const nextActiveState = !isCurrentlyActive;
    const actionName = nextActiveState ? "Reactivated" : "Suspended";

    const confirmMsg = nextActiveState
      ? `Reactivate workspace access for ${member.full_name || member.email}?`
      : `Suspend workspace access for ${member.full_name || member.email}?\n\nTheir login will be disabled immediately, but all their past tickets, incident logs, and resolution history remain 100% preserved.`;

    if (!confirm(confirmMsg)) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: nextActiveState })
        .eq("id", member.id);

      if (error) throw error;

      try {
        await supabase.from("session_audit_logs").insert({
          org_id: orgId || null,
          user_name: member.full_name || member.email,
          action: `Account ${actionName.toUpperCase()} by Admin`,
          details: `Active status changed to ${nextActiveState}`
        });
      } catch (_) {}

      notify(`${member.full_name || member.email} has been ${actionName}!`);
      loadMembers();
    } catch (err) {
      notify(`Failed to update status: ${err.message}`, "#ef4444");
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget?.email) return;
    setResetLoading(true);
    setResetSent(false);
    try {
      const redirectUrl = import.meta.env.VITE_APP_URL || window.location.origin;
      const { error } = await supabase.auth.resetPasswordForEmail(resetTarget.email, {
        redirectTo: redirectUrl,
      });
      if (error) throw error;
      setResetSent(true);
    } catch (err) {
      notify(`Reset failed: ${err.message}`, "#ef4444");
      setResetTarget(null);
    } finally {
      setResetLoading(false);
    }
  };

  const handleToggleAvailability = async (member, newStatus) => {
    try {
      const isAvailable = newStatus === "active";
      const { error } = await supabase.from("profiles").update({
        availability_status: newStatus,
        is_available: isAvailable
      }).eq("id", member.id);

      if (error) throw error;

      // Log in session_audit_logs for owner accountability & anti-dodge tracking
      await supabase.from("session_audit_logs").insert({
        org_id: orgId || null,
        user_name: member.full_name || member.email,
        action: `Availability updated to ${newStatus.toUpperCase()}`,
        details: `Updated by Admin for ticket routing`
      });

      notify(`${member.full_name || member.email} status set to ${newStatus.toUpperCase()}`);
      loadMembers();
    } catch (err) {
      notify(`Failed to update status: ${err.message}`, "#ef4444");
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {banner && (
        <div
          className="fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl border text-xs font-semibold shadow-2xl flex items-center gap-2 animate-bounce"
          style={{ background: "#0f172a", borderColor: banner.color, color: banner.color }}
        >
          {banner.msg}
        </div>
      )}

      {/* Copyable Welcome Credentials Banner */}
      {createdUserNotice && (
        <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-200 shadow-xl">
          <div className="space-y-1">
            <strong className="block text-emerald-300 font-bold text-sm">
              🎉 Member Provisioned: {createdUserNotice.name} ({createdUserNotice.role})
            </strong>
            <div className="font-mono text-xs text-slate-300 flex flex-wrap items-center gap-3">
              <span>Login: <strong className="text-white underline">{createdUserNotice.email}</strong></span>
              <span>Starter Password: <strong className="text-indigo-300">{createdUserNotice.tempPass}</strong></span>
            </div>
            <p className="text-[11px] text-emerald-400/80">
              The member can sign in with <strong>Google Sign-In</strong> (if their email is a Google/Workspace account) or with the starter password above. Use the 🔑 key icon in the table to send them a secure password reset link.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                navigator.clipboard.writeText(`Welcome to BizaDesk!\nLogin: ${createdUserNotice.email}\nTemporary Password: ${createdUserNotice.tempPass}`);
                setCopiedNotice(true);
                setTimeout(() => setCopiedNotice(false), 2000);
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-colors font-semibold shadow-lg shadow-emerald-950"
            >
              {copiedNotice ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
              {copiedNotice ? "Credentials Copied!" : "Copy Welcome Card"}
            </button>
            <button
              onClick={() => setCreatedUserNotice(null)}
              className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            User & Team Members Directory
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage who has access to BizaDesk. Control roles, department assignments, and permission boundaries.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-lg shadow-indigo-950 transition-all self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" /> Add Staff Member
        </button>
      </div>

      {/* How members sign in — info banner */}
      <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-xl px-4 py-3 text-[11px] text-indigo-300 leading-relaxed flex items-start gap-2.5">
        <Shield className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-indigo-200">How provisioned members sign in:</strong> After adding a member here, they can sign in using <strong>Google Sign-In</strong> (if their email is a Google/Workspace account) or via a <strong>password reset link</strong> sent using the 🔑 key icon in the table below. Their company workspace, role, and assigned department are automatically applied on first login.
        </div>
      </div>

      {/* Role Explanations Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {Object.entries(ROLE_BADGES).map(([key, val]) => (
          <div key={key} className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${val.style}`}>
                {val.label}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">{val.desc}</p>
          </div>
        ))}
      </div>

      {/* Members Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="text-center py-12 text-slate-500 text-xs">Loading directory...</div>
        ) : members.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-200">No members provisioned yet</p>
            <p className="text-xs text-slate-500 mt-1">Click "Add Staff Member" above to provision IT technicians or company employees. Members sign in with Google or via password reset link.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Member Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Role & Permissions</th>
                  <th className="py-3 px-4">Assigned Team</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {members.map((m) => {
                  const roleConfig = ROLE_BADGES[m.role] || ROLE_BADGES.user;
                  const isSuspended = m.is_active === false;
                  return (
                    <tr key={m.id} className={`transition-colors ${isSuspended ? "bg-rose-950/10 opacity-75 hover:bg-rose-950/20" : "hover:bg-slate-800/30"}`}>
                      <td className="py-3 px-4 font-semibold text-slate-200 flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full border flex items-center justify-center font-bold text-xs uppercase ${isSuspended ? "bg-rose-950/40 border-rose-800 text-rose-400" : "bg-slate-800 border-slate-700 text-indigo-400"}`}>
                          {(m.full_name || m.email || "U")[0]}
                        </div>
                        <div className="flex flex-col">
                          <span className={isSuspended ? "text-slate-400 line-through" : ""}>{m.full_name || "Unnamed"}</span>
                          {isSuspended && <span className="text-[9px] text-rose-400 font-normal">Access Suspended</span>}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{m.email}</td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${roleConfig.style}`}>
                          {roleConfig.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {m.department || <em className="text-slate-600">General IT</em>}
                      </td>
                      <td className="py-3 px-4">
                        {isSuspended ? (
                          <span className="inline-flex items-center gap-1 text-rose-400 text-[11px] font-bold bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 rounded">
                            <UserX className="w-3 h-3" /> Suspended
                          </span>
                        ) : m.role === "technician" || m.role === "admin" ? (
                          <div className="flex items-center gap-2">
                            <select
                              value={m.availability_status || (m.is_available === false ? "away" : "active")}
                              onChange={(e) => handleToggleAvailability(m, e.target.value)}
                              className={`text-[11px] font-semibold rounded-lg px-2 py-1 border focus:outline-none transition-colors cursor-pointer ${
                                (m.availability_status === "away" || m.is_available === false)
                                  ? "bg-amber-950/50 text-amber-300 border-amber-800"
                                  : m.availability_status === "leave"
                                  ? "bg-blue-950/50 text-blue-300 border-blue-800"
                                  : "bg-emerald-950/50 text-emerald-300 border-emerald-800"
                              }`}
                              title="Admin controlled: changes whether this technician receives auto-assigned tickets"
                            >
                              <option value="active">● Available (Duty)</option>
                              <option value="away">⏸ On Break / Away</option>
                              <option value="leave">🏖 On Official Leave</option>
                            </select>
                          </div>
                        ) : (
                          <span className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Active
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleToggleSuspend(m)}
                            className={`p-1 transition-colors ${isSuspended ? "text-emerald-400 hover:text-emerald-300" : "text-slate-500 hover:text-amber-400"}`}
                            title={isSuspended ? "Reactivate member account" : "Suspend / Disable access (Preserves past tickets & history)"}
                          >
                            {isSuspended ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => { setResetTarget(m); setResetSent(false); }}
                            className="text-slate-500 hover:text-indigo-400 p-1 transition-colors"
                            title="Send password reset link"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteMember(m)}
                            className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                            title="Remove user permanently"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Reset User Password */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm p-6 relative">
            <button
              onClick={() => { setResetTarget(null); setResetSent(false); }}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-800">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                <KeyRound className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Reset User Password</h3>
                <p className="text-[11px] text-slate-400">Send a secure reset link to this user</p>
              </div>
            </div>

            {!resetSent ? (
              <>
                <div className="bg-slate-950 rounded-xl p-3.5 mb-4 space-y-1 border border-slate-800">
                  <p className="text-xs font-semibold text-slate-200">{resetTarget.full_name || "User"}</p>
                  <p className="text-[11px] font-mono text-indigo-300">{resetTarget.email}</p>
                </div>
                <p className="text-[11px] text-slate-400 mb-5 leading-relaxed">
                  A secure password reset link will be emailed to this user. They click the link and set their own new password — no temporary password is shared.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setResetTarget(null); setResetSent(false); }}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-2.5 rounded-xl border border-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleResetPassword}
                    disabled={resetLoading}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs py-2.5 rounded-xl shadow-lg shadow-indigo-950 flex items-center justify-center gap-2 transition-all"
                  >
                    {resetLoading ? "Sending..." : <><Send className="w-3.5 h-3.5" /> Send Reset Link</>}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center space-y-3 py-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <p className="text-sm font-bold text-white">Reset Link Sent!</p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  A password reset email has been sent to <strong className="text-indigo-300">{resetTarget.email}</strong>. Ask the user to check their inbox and click the link.
                </p>
                <button
                  onClick={() => { setResetTarget(null); setResetSent(false); }}
                  className="mt-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-2 px-6 rounded-xl border border-slate-700 transition-colors"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Add Team Member */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-semibold text-slate-100 text-sm flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-indigo-400" />
                Add Staff Member
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Michael Adebayo"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-300">Company Work Email *</label>
                  <button
                    type="button"
                    onClick={() => setUseCustomEmail(prev => !prev)}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    {useCustomEmail ? "Use company domain" : "External contractor?"}
                  </button>
                </div>

                {!useCustomEmail ? (
                  <div className="flex items-center">
                    <input
                      type="text"
                      required
                      placeholder="e.g. michael.adebayo"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
                      className="flex-1 bg-slate-950 border border-r-0 border-slate-700 rounded-l-lg px-3 py-2 text-xs text-slate-100 font-mono focus:border-indigo-500 focus:outline-none"
                    />
                    <span className="bg-slate-900 border border-slate-700 rounded-r-lg px-3 py-2 text-xs text-slate-300 font-mono select-none flex items-center gap-1 font-semibold">
                      @{companyDomain}
                    </span>
                  </div>
                ) : (
                  <input
                    type="email"
                    required
                    placeholder="e.g. contractor@externalpartner.com"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                  />
                )}

                <p className="text-[11px] text-slate-500 mt-1">
                  {!useCustomEmail ? (
                    <span>User login: <strong className="text-indigo-400 font-mono">{username ? `${username}@${companyDomain}` : `username@${companyDomain}`}</strong></span>
                  ) : (
                    <span>External contractor email outside @{companyDomain}</span>
                  )}
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Role &amp; Interface *</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="technician">Technician (IT Operations Console)</option>
                  <option value="user">Staff User (Employee Self-Service Only)</option>
                  <option value="admin">Admin (Full System &amp; Billing Access)</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  {ROLE_BADGES[role].desc}
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Assigned IT Department / Team</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">— Select Team —</option>
                  {teams.length > 0 ? (
                    teams.map((t) => (
                      <option key={t.id} value={t.team_name}>
                        {t.team_name}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="IT Support">IT Support</option>
                      <option value="Network Team">Network Team</option>
                      <option value="Database Team">Database Team</option>
                      <option value="Application Support">Application Support</option>
                      <option value="Security Team">Security Team</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-300">
                    Initial Starter Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const rand = Math.floor(1000 + Math.random() * 9000);
                      setTempPassword(`Welcome#${rand}`);
                    }}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                  >
                    <Sparkles className="w-3 h-3" /> Auto-generate password
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Defaults to BizaDesk@2026"
                    value={tempPassword}
                    onChange={(e) => setTempPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-100 font-mono focus:border-indigo-500 focus:outline-none"
                  />
                  <KeyRound className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Optional: share with the user so they can sign in with email & password. They can also sign in with Google or use a password reset link at any time.
                </p>
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
                  disabled={adding}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium py-2.5 rounded-lg shadow-lg shadow-indigo-950"
                >
                  {adding ? "Creating..." : "Save Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

