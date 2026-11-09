import { useState, useEffect } from "react";
import { WifiOff, AlertTriangle, X, ChevronRight } from "lucide-react";

export default function ProactiveBanner({ activeIncidents = [], onOpenTroubleshooting }) {
  const [isOffline, setIsOffline] = useState(typeof navigator !== "undefined" ? !navigator.onLine : false);
  const [dismissedIncidents, setDismissedIncidents] = useState({});

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Check for critical active incidents
  const criticalIncident = activeIncidents.find(
    i => !i.resolved && (i.severity === "CRITICAL" || i.escalated) && !dismissedIncidents[i.id]
  );

  if (isOffline) {
    return (
      <div className="bg-rose-950/90 border-b border-rose-800/80 px-4 py-2.5 text-rose-200 text-xs flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2.5">
          <WifiOff className="w-4 h-4 text-rose-400 shrink-0 animate-pulse" />
          <span>
            <strong>Connection Lost:</strong> Your computer appears to be offline. Network cables or Wi-Fi may be disconnected.
          </span>
        </div>
        {onOpenTroubleshooting && (
          <button
            onClick={() => onOpenTroubleshooting("No internet connection")}
            className="flex items-center gap-1 bg-rose-800 hover:bg-rose-700 text-white font-medium px-2.5 py-1 rounded text-[11px] transition-colors shrink-0"
          >
            Fix Cable / Wi-Fi
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  }

  if (criticalIncident) {
    return (
      <div className="bg-amber-950/80 border-b border-amber-800/60 px-4 py-2 text-amber-200 text-xs flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong>Live Outage:</strong> {criticalIncident.title} ({criticalIncident.app}) is currently degraded. IT is already actively working on resolution.
          </span>
        </div>
        <button
          onClick={() => setDismissedIncidents(prev => ({ ...prev, [criticalIncident.id]: true }))}
          className="text-amber-400 hover:text-amber-200 p-1"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return null;
}
