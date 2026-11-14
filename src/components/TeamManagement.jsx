import { useState, useEffect, useCallback } from "react";
import { Users, Plus, Trash2, Mail, Webhook, Star, StarOff, Edit3, Check, X, Shield } from "lucide-react";
import { supabase } from "../supabase";

const FAILURE_LABELS = {
  connection_refused: { label: "Server Unreachable / No Connection", color: "text-rose-400", hint: "Cannot reach host (DNS fail, firewall, cable down)" },
  http_5xx:          { label: "HTTP 5xx Server Error", color: "text-orange-400", hint: "Server returned 500, 502, 503, or 504" },
  body_db_keyword:   { label: "Database / SQL Error in Response", color: "text-purple-400", hint: "Response body contains: database, sql, query, connection pool" },
  slow_response:     { label: "Slow Response (> 3 seconds)", color: "text-amber-400", hint: "Service is reachable but severely delayed" },
  http_4xx:          { label: "HTTP 4xx Auth / Config Error", color: "text-cyan-400", hint: "Server returned 401, 403, or 404 (config/auth issue)" },
  default:           { label: "All Other / Catch-All Failures", color: "text-slate-300", hint: "Any failure type not matched above" },
};

function TeamCard({ team, onDelete, onToggleDefault, onEdit }) {
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ team_name: team.team_name, alert_email: team.alert_email || "", webhook_url: team.webhook_url || "" });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onEdit(team.id, editForm);
    setSaving(false);
    setEditing(false);
  };

  return (
    <div className={`bg-slate-900 border rounded-xl p-4 shadow-sm transition-all ${team.is_default ? "border-indigo-500/40 bg-indigo-950/10" : "border-slate-800"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-2">
              <input
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                value={editForm.team_name}
                onChange={e => setEditForm({ ...editForm, team_name: e.target.value })}
                placeholder="Team Name"
              />
              <input
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                value={editForm.alert_email}
                onChange={e => setEditForm({ ...editForm, alert_email: e.target.value })}
                placeholder="alert@company.com"
                type="email"
              />
              <input
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                value={editForm.webhook_url}
                onChange={e => setEditForm({ ...editForm, webhook_url: e.target.value })}
                placeholder="https://hooks.teams.microsoft.com/... (optional)"
              />
              <div className="flex gap-2 pt-1">
                <button onClick={handleSave} disabled={saving} className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
                  <Check className="w-3 h-3" /> {saving ? "Saving..." : "Save"}
                </button>
                <button onClick={() => setEditing(false)} className="flex items-center gap-1 bg-slate-800 text-slate-300 text-xs px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-700">
                  <X className="w-3 h-3" /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-sm text-slate-100">{team.team_name}</span>
                {team.is_default && (
                  <span className="text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" /> DEFAULT FALLBACK TEAM
                  </span>
                )}
              </div>
              {team.is_default && (
                <p className="text-[10px] text-amber-400/80 mb-1.5 font-medium">
                  â˜… Catches all tickets &amp; incidents that do not match specific department rules.
                </p>
              )}
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <Mail className="w-3 h-3 text-slate-500" />
                <span className="truncate">{team.alert_email || <em className="text-slate-600">No email set</em>}</span>
              </div>
              {team.webhook_url && (
                <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                  <Webhook className="w-3 h-3" />
                  <span className="truncate font-mono text-[11px]">{team.webhook_url}</span>
                </div>
              )}
            </>
          )}
        </div>

        {!editing && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onToggleDefault(team)}
              title={team.is_default ? "Remove as default" : "Set as default team"}
              className="p-1.5 text-slate-500 hover:text-amber-400 transition-colors"
            >
              {team.is_default ? <Star className="w-4 h-4 text-amber-400" /> : <StarOff className="w-4 h-4" />}
            </button>
            <button onClick={() => setEditing(true)} className="p-1.5 text-slate-500 hover:text-indigo-400 transition-colors">
              <Edit3 className="w-4 h-4" />
            </button>
            <button onClick={() => onDelete(team)} className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TeamManagement({ orgId, onTeamsChange }) {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ team_name: "", alert_email: "", webhook_url: "", is_default: false });
  const [adding, setAdding] = useState(false);
  const [banner, setBanner] = useState(null);

  const notify = (msg, color = "#22c55e") => {
    setBanner({ msg, color });
    setTimeout(() => setBanner(null), 3500);
  };

  const loadTeams = useCallback(async () => {
    if (!orgId) { setLoading(false); return; }
    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: true });
    if (!error && data) {
      setTeams(data);
      if (onTeamsChange) onTeamsChange(data);
    }
    setLoading(false);
  }, [orgId, onTeamsChange]);

  useEffect(() => {
    let isMounted = true;
    if (!orgId) return;

    supabase
      .from("teams")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (!error && data) {
          setTeams(data);
          if (onTeamsChange) onTeamsChange(data);
        }
        setLoading(false);
      });
    return () => { isMounted = false; };
  }, [orgId, onTeamsChange]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!addForm.team_name.trim()) return;
    setAdding(true);

    // If this is marked default, clear other defaults first
    if (addForm.is_default) {
      await supabase.from("teams").update({ is_default: false }).eq("org_id", orgId);
    }

    const { error } = await supabase.from("teams").insert({
      org_id: orgId,
      team_name: addForm.team_name.trim(),
      alert_email: addForm.alert_email.trim() || null,
      webhook_url: addForm.webhook_url.trim() || null,
      is_default: addForm.is_default
    });

    if (error) {
      notify(`Error: ${error.message}`, "#ef4444");
    } else {
      notify(`Team "${addForm.team_name}" added successfully!`);
      setAddForm({ team_name: "", alert_email: "", webhook_url: "", is_default: false });
      setShowAdd(false);
      loadTeams();
    }
    setAdding(false);
  };

  const handleDelete = async (team) => {
    await supabase.from("teams").delete().eq("id", team.id);
    notify(`Team "${team.team_name}" removed.`, "#64748b");
    loadTeams();
  };

  const handleToggleDefault = async (team) => {
    if (team.is_default) {
      await supabase.from("teams").update({ is_default: false }).eq("id", team.id);
    } else {
      // Clear all other defaults first
      await supabase.from("teams").update({ is_default: false }).eq("org_id", orgId);
      await supabase.from("teams").update({ is_default: true }).eq("id", team.id);
    }
    notify(team.is_default ? "Default removed." : `"${team.team_name}" is now the default fallback team.`);
    loadTeams();
  };

  const handleEdit = async (teamId, form) => {
    await supabase.from("teams").update({
      team_name: form.team_name,
      alert_email: form.alert_email || null,
      webhook_url: form.webhook_url || null,
    }).eq("id", teamId);
    notify("Team updated.");
    loadTeams();
  };

  const defaultTeam = teams.find(t => t.is_default);

  return (
    <div className="space-y-6">
      {/* Banner */}
      {banner && (
        <div
          className="fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl border text-xs font-semibold shadow-2xl"
          style={{ background: "#0f172a", borderColor: banner.color, color: banner.color }}
        >
          {banner.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            IT Department Queues & Ticket Routing
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure functional department queues for ticket routing (e.g. Network Team, Security Team). To add individual technicians or staff, go to the Staff &amp; Member Directory tab.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-lg shadow-indigo-950 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Add Team
        </button>
      </div>

      {/* Default Team Info Banner */}
      {defaultTeam ? (
        <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-4 flex items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
              <Star className="w-4 h-4 fill-amber-400" />
            </div>
            <div className="text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-amber-300">Default Catch-All Team: </span>
                <span className="font-semibold text-white px-2 py-0.5 rounded bg-slate-900 border border-slate-700">
                  {defaultTeam.team_name}
                </span>
              </div>
              <p className="text-slate-400 text-[11px] mt-0.5">
                When a user speaks or submits an issue that does not match a specific department or knowledge base rule, the ticket routes here automatically.
              </p>
            </div>
          </div>
          <span className="text-[10px] text-slate-500 hidden sm:block shrink-0">
            Click â˜… on any other team to switch default
          </span>
        </div>
      ) : teams.length > 0 ? (
        <div className="bg-amber-950/30 border border-amber-500/20 rounded-xl p-4 flex items-center gap-3">
          <Star className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-xs text-amber-300">
            No default team set. Click the â˜† star icon on a team to set it as the fallback for all unmatched incidents.
          </span>
        </div>
      ) : null}

      {/* Teams List */}
      {loading ? (
        <div className="text-center text-slate-500 text-xs py-10">Loading teams...</div>
      ) : teams.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
          <Users className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm font-medium mb-1">No teams configured yet</p>
          <p className="text-xs text-slate-500">
            Add your first team. For small IT departments, one team (e.g. "IT Support") is enough â€” mark it as default and all incidents will route there automatically.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {teams.map(team => (
            <TeamCard
              key={team.id}
              team={team}
              teams={teams}
              onDelete={handleDelete}
              onToggleDefault={handleToggleDefault}
              onEdit={handleEdit}
            />
          ))}
        </div>
      )}

      {/* How routing works info */}
      {teams.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">How Automatic Incident Routing Works</h3>
          <div className="space-y-2">
            {Object.entries(FAILURE_LABELS).map(([key, val]) => (
              <div key={key} className="flex items-start gap-3 text-xs">
                <span className={`font-semibold shrink-0 w-52 ${val.color}`}>{val.label}</span>
                <span className="text-slate-500">â†’ {val.hint}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-800 mt-2">
            Each monitored app can override which team handles which failure type. Configure this in the <strong className="text-slate-400">Monitored Apps</strong> tab when adding or editing an app.
          </p>
        </div>
      )}

      {/* Add Team Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-semibold text-slate-100 text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-400" /> Add Support Team
              </h3>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdd} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Team Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. IT Support, Network Team, Database Team"
                  value={addForm.team_name}
                  onChange={e => setAddForm({ ...addForm, team_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Alert Email Address</label>
                <input
                  type="email"
                  placeholder="network@company.com (or leave blank)"
                  value={addForm.alert_email}
                  onChange={e => setAddForm({ ...addForm, alert_email: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                />
                <p className="text-[11px] text-slate-500 mt-1">BizaDesk will email this address when an incident routes to this team.</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Teams / Slack / Zoho Webhook (Optional)</label>
                <input
                  type="url"
                  placeholder="https://hooks.slack.com/services/... or Teams URL"
                  value={addForm.webhook_url}
                  onChange={e => setAddForm({ ...addForm, webhook_url: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-3 bg-slate-950 border border-slate-800 rounded-lg px-4 py-3">
                <input
                  type="checkbox"
                  id="is_default"
                  checked={addForm.is_default}
                  onChange={e => setAddForm({ ...addForm, is_default: e.target.checked })}
                  className="accent-indigo-500 w-4 h-4"
                />
                <label htmlFor="is_default" className="text-xs text-slate-300 cursor-pointer">
                  <span className="font-semibold">Set as Default Fallback Team</span>
                  <span className="block text-slate-500 text-[11px]">All unmatched or unrouted incidents go to this team.</span>
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-2.5 rounded-lg border border-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adding}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium py-2.5 rounded-lg shadow-lg shadow-indigo-950 transition-colors"
                >
                  {adding ? "Adding..." : "Add Team"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}



