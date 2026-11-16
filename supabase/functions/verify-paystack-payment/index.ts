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
    const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecret) {
      return new Response(JSON.stringify({ error: "PAYSTACK_SECRET_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { reference, org_id, user_email, payment_type, metadata } = await req.json();

    if (!reference) {
      return new Response(JSON.stringify({ error: "Missing transaction reference" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 1. Verify directly with Paystack API server-side
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        "Content-Type": "application/json"
      }
    });

    const verifyData = await verifyRes.json();

    if (!verifyRes.ok || !verifyData.status || verifyData.data?.status !== "success") {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: verifyData.message || "Payment verification failed or status is not successful" 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const paystackTx = verifyData.data;
    const amountInKobo = paystackTx.amount;
    const nowIso = new Date().toISOString();

    // 2. Record or update status in 'payments' table using service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error: upsertError } = await supabase
      .from("payments")
      .upsert({
        reference: reference,
        org_id: org_id || null,
        user_email: user_email || paystackTx.customer?.email,
        amount: amountInKobo,
        status: "success",
        payment_type: payment_type || "REMOTE",
        metadata: {
          ...(metadata || {}),
          paystack_channel: paystackTx.channel,
          subaccount: paystackTx.subaccount?.subaccount_code || null,
          gateway_response: paystackTx.gateway_response
        },
        verified_at: nowIso
      }, { onConflict: "reference" });

    if (upsertError) {
      console.warn("Could not upsert payment record:", upsertError.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        reference: reference,
        amount: amountInKobo,
        customer_email: paystackTx.customer?.email,
        subaccount: paystackTx.subaccount?.subaccount_code || null,
        verified_at: nowIso
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
