import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── CORS: restrict to known app origins ─────────────────────────────────────
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

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { to, subject, body, html, apiKey, fromEmail, orgId } = await req.json();

    if (!to) {
      return new Response(
        JSON.stringify({ success: false, error: "Recipient email ('to') is required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine Resend API Key:
    // 1. Passed explicitly in body (e.g. during test from EmailSettings)
    // 2. Or from environment variable RESEND_API_KEY (platform-level secret)
    // 3. Or query organizations table by orgId (tenant-level key)
    let effectiveApiKey = apiKey || Deno.env.get("RESEND_API_KEY");
    let effectiveFrom = fromEmail || "BizaDesk <helpdesk@bizadoc.com>";

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!effectiveApiKey && orgId && supabaseUrl && supabaseServiceKey) {
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
      const { data: org } = await supabaseAdmin
        .from("organizations")
        .select("resend_api_key, resend_from_email")
        .eq("id", orgId)
        .single();

      if (org?.resend_api_key) {
        effectiveApiKey = org.resend_api_key;
        if (org.resend_from_email) {
          effectiveFrom = org.resend_from_email;
        }
      }
    }

    if (!effectiveApiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No Resend API Key configured. Please enter your API key in Email Settings or set RESEND_API_KEY secret."
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resend requires valid from format. Default sandbox is onboarding@resend.dev
    // If user has a verified domain in Resend, they can use their custom email.
    const resendPayload: Record<string, unknown> = {
      from: effectiveFrom,
      to: Array.isArray(to) ? to : [to],
      subject: subject || "HelpDeskIQ Notification",
      text: body || "",
      html: html || `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #4f46e5; margin-top: 0; font-size: 18px;">HelpDeskIQ Notification</h2>
          <div style="white-space: pre-wrap; font-size: 14px; color: #334155; margin: 16px 0;">${body || ""}</div>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 11px; color: #94a3b8; margin: 0;">Sent automatically by HelpDeskIQ Support System.</p>
        </div>
      `,
    };

    // Call Resend API
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${effectiveApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(resendPayload),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: resendData.message || resendData.name || "Failed to dispatch email via Resend"
        }),
        { status: resendRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log into emails table if Supabase admin is available
    if (supabaseUrl && supabaseServiceKey) {
      try {
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
        await supabaseAdmin.from("emails").insert({
          org_id: orgId || null,
          to_address: Array.isArray(to) ? to.join(", ") : to,
          email_type: "resend_dispatch",
          subject: subject || "Notification",
          body: body || "",
          sent_at: Date.now()
        });
      } catch (logErr) {
        // Non-fatal: log silently
      }
    }

    return new Response(
      JSON.stringify({ success: true, id: resendData.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
