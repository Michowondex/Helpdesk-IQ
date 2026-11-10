import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://desk.bizadoc.com",
  "https://helpdeskiq.bizadoc.com",
  "http://localhost:5173",
  "http://localhost:4173",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { orgId } = await req.json().catch(() => ({ orgId: null }));

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing Supabase configuration." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch active monitored services
    let query = supabaseAdmin.from("monitored_services").select("*");
    if (orgId) {
      query = query.eq("org_id", orgId);
    }
    const { data: services, error: svcError } = await query;

    if (svcError) {
      return new Response(
        JSON.stringify({ success: false, error: svcError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = [];

    // 2. Perform authentic server-side HTTP probes for each service
    for (const svc of services || []) {
      if (!svc.health_url) continue;

      const start = performance.now();
      let status = "OPERATIONAL";
      let health_pct = 100;
      let httpCode = 0;
      let latency = 0;
      let lastError = null;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const res = await fetch(svc.health_url, {
          method: "GET",
          signal: controller.signal,
          headers: {
            "User-Agent": "BizaDesk-Sentinel-HealthProbe/1.0"
          }
        });

        clearTimeout(timeoutId);
        latency = Math.max(5, Math.round(performance.now() - start));
        httpCode = res.status;

        const bodyText = await res.text().catch(() => "");
        const lowerBody = bodyText.toLowerCase();

        // Categorize response status
        if (httpCode >= 500) {
          status = "DOWN";
          health_pct = 0;
          lastError = `Server Crash (HTTP ${httpCode})`;
        } else if (httpCode >= 400) {
          status = "DEGRADED";
          health_pct = 60;
          lastError = `Client/Auth Error (HTTP ${httpCode})`;
        } else if (lowerBody.includes("database") || lowerBody.includes("sql") || lowerBody.includes("connection pool")) {
          status = "DEGRADED";
          health_pct = 50;
          lastError = "Database Keyword Error Detected in Response";
        } else if (latency > 3000) {
          status = "DEGRADED";
          health_pct = 70;
          lastError = `Slow Response (${latency}ms)`;
        } else {
          status = "OPERATIONAL";
          health_pct = latency > 1500 ? 90 : 100;
          lastError = null;
        }
      } catch (err: any) {
        latency = Math.round(performance.now() - start);
        status = "DOWN";
        health_pct = 0;
        const isTimeout = err?.name === "AbortError";
        lastError = isTimeout ? "Timeout (> 6000ms)" : (err?.message || "Connection Refused");
      }

      // Update monitored_services table
      await supabaseAdmin.from("monitored_services").update({
        status,
        health_pct,
        latency_ms: latency,
        http_code: httpCode,
        last_error: lastError,
        last_checked_at: new Date().toISOString()
      }).eq("id", svc.id);

      results.push({
        id: svc.id,
        name: svc.name,
        status,
        latency_ms: latency,
        http_code: httpCode,
        last_error: lastError
      });
    }

    return new Response(
      JSON.stringify({ success: true, count: results.length, services: results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

