import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { Shield, Download, Search, RefreshCw, Filter, Calendar, UserCheck, Activity } from "lucide-react";

export default function AuditLogsViewer({ orgId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("all"); // 'all' | 'today' | '7days' | '30days'

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("session_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (orgId) {
        query = query.eq("org_id", orgId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.warn("Failed to load audit logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, [orgId]);

  // Filtering
  const filteredLogs = logs.filter(log => {
    const textMatch = 
      (log.user_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.action || log.action_run || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.result || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.details || "").toLowerCase().includes(searchTerm.toLowerCase());

    if (!textMatch) return false;

    if (dateFilter === "all") return true;
    const logTime = new Date(log.created_at).getTime();
    const now = Date.now();

    if (dateFilter === "today") {
      return now - logTime <= 86400000;
    }
    if (dateFilter === "7days") {
      return now - logTime <= 7 * 86400000;
    }
    if (dateFilter === "30days") {
      return now - logTime <= 30 * 86400000;
    }
    return true;
  });

  // Export / Spool to CSV
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;

    const headers = ["Timestamp", "User", "Action", "Result / Status", "Details"];
    const rows = filteredLogs.map(l => [
      `"${new Date(l.created_at).toLocaleString()}"`,
      `"${l.user_name || "Unknown"}"`,
      `"${(l.action || l.action_run || "").replace(/"/g, '""')}"`,
      `"${(l.result || "SUCCESS").replace(/"/g, '""')}"`,
      `"${(l.details || "").replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `BizaDesk_Audit_Logs_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
      {/* Header with Title & Export / Spool Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-400" />
            Audit Logs & Compliance Record
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time track record of user sessions, KB fixes, technician availability updates, and remote assist events.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadAuditLogs}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs transition-colors flex items-center gap-1.5"
            title="Refresh logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={handleExportCSV}
            disabled={filteredLogs.length === 0}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-md shadow-indigo-950 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Export / Spool CSV
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search by user, action, or keyword..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> Filter:
          </span>
          <select
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Time (Latest 200)</option>
            <option value="today">Past 24 Hours</option>
            <option value="7days">Past 7 Days</option>
            <option value="30days">Past 30 Days</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="border border-slate-800 rounded-lg overflow-x-auto bg-slate-950/60">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
              <th className="py-2.5 px-3 font-medium">Timestamp</th>
              <th className="py-2.5 px-3 font-medium">User</th>
              <th className="py-2.5 px-3 font-medium">Action Performed</th>
              <th className="py-2.5 px-3 font-medium">Status / Result</th>
              <th className="py-2.5 px-3 font-medium">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {loading ? (
              <tr>
                <td colSpan="5" className="py-8 text-center text-slate-500">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1 text-indigo-400" />
                  Loading audit logs...
                </td>
              </tr>
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan="5" className="py-8 text-center text-slate-500">
                  No audit logs found matching criteria.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log, idx) => {
                const actionText = log.action || log.action_run || "User Interaction";
                const isSuccess = (log.result || "").toUpperCase() === "SUCCESS" || !log.result;
                const formattedDate = new Date(log.created_at).toLocaleString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit"
                });

                return (
                  <tr key={log.id || idx} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap font-mono text-[11px]">
                      {formattedDate}
                    </td>
                    <td className="py-2.5 px-3 text-slate-200 font-medium whitespace-nowrap">
                      {log.user_name || "System"}
                    </td>
                    <td className="py-2.5 px-3 text-indigo-300 font-mono text-[11px]">
                      {actionText}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        isSuccess ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      }`}>
                        {log.result || "SUCCESS"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 max-w-xs truncate text-[11px]">
                      {log.details || "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
        <span>Showing {filteredLogs.length} audit records</span>
        <span>Spool to CSV anytime for external IT compliance</span>
      </div>
    </div>
  );
}

