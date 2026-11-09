import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { domain } = await req.json().catch(() => ({ domain: "" }));
    const cleanDomain = (domain || "").toLowerCase().trim();

    if (!cleanDomain || !cleanDomain.includes(".")) {
      return new Response(
        JSON.stringify({ valid: false, error: "Invalid domain format." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Perform DNS lookup for MX (Mail Exchange) records using Google Public DNS-over-HTTPS
    const dnsUrl = `https://dns.google/resolve?name=${encodeURIComponent(cleanDomain)}&type=MX`;
    const res = await fetch(dnsUrl);
    const data = await res.json();

    const hasMxRecords = Array.isArray(data?.Answer) && data.Answer.length > 0;

    return new Response(
      JSON.stringify({
        valid: hasMxRecords,
        domain: cleanDomain,
        mxCount: hasMxRecords ? data.Answer.length : 0,
        message: hasMxRecords
          ? "Domain has valid mail servers."
          : "Domain does not have active mail exchange (MX) servers."
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ valid: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

