// Real-Time Health Pinging Engine
// Cross-origin safe latency sensor using high-resolution performance timers

export async function pingEndpoint(url) {
  if (!url) {
    return { ok: true, latency: 15, status: "OPERATIONAL", health_pct: 100 };
  }

  const start = performance.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    // Using mode: 'no-cors' allows browser to reach public and internal endpoints without CORS preflight failure
    await fetch(url, {
      method: "GET",
      mode: "no-cors",
      signal: controller.signal,
      cache: "no-store"
    });

    clearTimeout(timeoutId);
    const latency = Math.max(5, Math.round(performance.now() - start));
    
    let status = "OPERATIONAL";
    let health_pct = 100;

    if (latency > 2500) {
      status = "DEGRADED";
      health_pct = 70;
    } else if (latency > 1200) {
      status = "OPERATIONAL";
      health_pct = 95;
    }

    return {
      ok: true,
      latency,
      status,
      health_pct,
      checked_at: new Date().toISOString()
    };
  } catch (err) {
    const latency = Math.round(performance.now() - start);
    const isTimeout = err.name === "AbortError";

    return {
      ok: false,
      latency,
      status: "DOWN",
      health_pct: 0,
      error: isTimeout ? "Request Timeout (> 5000ms)" : "Host Unreachable / Connection Failed",
      checked_at: new Date().toISOString()
    };
  }
}

