import { useState, useEffect } from "react";

/**
 * Isolated live clock component — prevents full App re-render every second.
 * Only this tiny component re-renders on each tick.
 */
export default function LiveClock() {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  }));

  useEffect(() => {
    const t = setInterval(() => {
      setTime(new Date().toLocaleTimeString("en-GB", {
        hour: "2-digit", minute: "2-digit", second: "2-digit"
      }));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  return <span className="font-mono text-xs text-slate-400">{time}</span>;
}

