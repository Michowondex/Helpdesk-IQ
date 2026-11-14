// ── Business Hours SLA Calculator ───────────────────────────────────────────
export function calculateBusinessSla({
  createdTimestamp,
  slaHours = 1,
  workStartHour = 8,
  workEndHour = 18,
  workDaysStr = "1,2,3,4,5",
  isBreachedDirect = false,
  resolvedTimestamp = null
}) {
  const slaMs = (Number(slaHours) || 1) * 3600000;
  const created = Number(createdTimestamp) || Date.now();
  const endTarget = resolvedTimestamp ? Number(resolvedTimestamp) : Date.now();
  const startHour = Number(workStartHour) ?? 8;
  const endHour = Number(workEndHour) ?? 18;
  const workDays = (workDaysStr || "1,2,3,4,5").split(",").map(d => Number(d.trim()));

  const now = new Date(endTarget);
  const nowDay = now.getDay();
  const nowDecimalHour = now.getHours() + (now.getMinutes() / 60);
  const isWorkingDay = workDays.includes(nowDay);
  const isWorkingHour = nowDecimalHour >= startHour && nowDecimalHour < endHour;
  const isCurrentlyBusinessHours = isWorkingDay && isWorkingHour;

  let nextResumeText = `${startHour}:00 AM`;
  if (!isWorkingDay) {
    nextResumeText = "Monday 8:00 AM";
  } else if (nowDecimalHour >= endHour) {
    nextResumeText = `Tomorrow ${startHour}:00 AM`;
  } else if (nowDecimalHour < startHour) {
    nextResumeText = `Today ${startHour}:00 AM`;
  }

  let businessElapsedMs = 0;
  if (endTarget > created) {
    let curr = new Date(created);
    let guard = 0;
    while (curr.getTime() < endTarget && guard < 60) {
      guard++;
      const curDay = curr.getDay();
      if (workDays.includes(curDay)) {
        const y = curr.getFullYear();
        const m = curr.getMonth();
        const d = curr.getDate();
        const dayBusinessStart = new Date(y, m, d, startHour, 0, 0, 0).getTime();
        const dayBusinessEnd = new Date(y, m, d, endHour, 0, 0, 0).getTime();

        const windowStart = Math.max(created, dayBusinessStart);
        const windowEnd = Math.min(endTarget, dayBusinessEnd);
        if (windowEnd > windowStart) {
          businessElapsedMs += (windowEnd - windowStart);
        }
      }
      curr = new Date(curr.getFullYear(), curr.getMonth(), curr.getDate() + 1, 0, 0, 0, 0);
    }
  }

  const remainingMs = slaMs - businessElapsedMs;
  const isBreached = Boolean(isBreachedDirect) || remainingMs <= 0;
  const pctRemaining = Math.max(0, Math.min(100, Math.round((remainingMs / slaMs) * 100)));
  const remainingMins = Math.max(0, Math.round(remainingMs / 60000));
  const breachMins = Math.max(1, Math.round(Math.abs(remainingMs) / 60000));
  const isPaused = !resolvedTimestamp && !isCurrentlyBusinessHours && !isBreached;

  return {
    businessElapsedMs,
    remainingMs,
    remainingMins,
    breachMins,
    isBreached,
    pctRemaining,
    isPaused,
    nextResumeText,
    isCurrentlyBusinessHours
  };
}
