import { useState, useEffect, useRef } from "react";
import { Bell, CheckCheck, Trash2, X, Ticket, AlertTriangle, ShieldAlert, ExternalLink } from "lucide-react";

export default function NotificationBell({ notifications = [], onMarkAllRead, onClearAll, onNotificationClick }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const timeAgo = (ts) => {
    if (!ts) return "just now";
    const d = Date.now() - ts;
    if (d < 60000) return `${Math.max(1, Math.floor(d / 1000))}s ago`;
    if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
    return `${Math.floor(d / 3600000)}h ago`;
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors focus:outline-none"
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white shadow-lg shadow-rose-500/40 animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Drawer (Viewport anchored to guarantee it never slides off-screen) */}
      {open && (
        <div className="fixed right-3 sm:right-6 top-16 w-80 sm:w-96 max-w-[calc(100vw-1.5rem)] rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl z-50 overflow-hidden backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-white">Notifications</span>
              {unreadCount > 0 && (
                <span className="bg-indigo-500/20 text-indigo-400 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-indigo-500/30">
                  {unreadCount} unread
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {notifications.length > 0 && (
                <>
                  <button
                    onClick={onMarkAllRead}
                    className="p-1 text-slate-400 hover:text-slate-200 text-[10px] flex items-center gap-1 transition-colors"
                    title="Mark all as read"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={onClearAll}
                    className="p-1 text-slate-400 hover:text-rose-400 text-[10px] flex items-center gap-1 transition-colors"
                    title="Clear all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
              <button onClick={() => setOpen(false)} className="p-1 text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                <Bell className="w-6 h-6 mx-auto mb-2 text-slate-600 opacity-60" />
                <p className="font-medium text-slate-400">No new notifications</p>
                <p className="text-[11px] text-slate-600 mt-0.5">Ticket updates and incident alerts will appear here.</p>
              </div>
            ) : (
              notifications.map((n) => {
                const isTicket = n.type === "ticket" || n.ticket_id;
                const isIncident = n.type === "incident";

                return (
                  <div
                    key={n.id}
                    onClick={() => {
                      if (onNotificationClick) onNotificationClick(n);
                      setOpen(false);
                    }}
                    className={`p-3.5 hover:bg-slate-800/50 transition-colors cursor-pointer flex items-start gap-3 ${
                      !n.read ? "bg-indigo-950/20" : ""
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {isTicket ? (
                        <div className="w-7 h-7 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                          <Ticket className="w-3.5 h-3.5" />
                        </div>
                      ) : isIncident ? (
                        <div className="w-7 h-7 rounded-lg bg-rose-600/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
                          <AlertTriangle className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-lg bg-cyan-600/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
                          <ShieldAlert className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 pr-1">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="text-xs font-semibold text-slate-200 leading-snug break-words">{n.title}</span>
                        <span className="text-[10px] text-slate-500 whitespace-nowrap shrink-0 mt-0.5">{timeAgo(n.time)}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed break-words [overflow-wrap:anywhere]">{n.message}</p>
                      {n.assigned_to && (
                        <div className="mt-1 text-[10px] text-indigo-400 font-medium truncate">
                          Assigned: {n.assigned_to}
                        </div>
                      )}
                    </div>

                    {!n.read && (
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0 mt-1.5" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

