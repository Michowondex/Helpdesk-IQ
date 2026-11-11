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

    // Authenticate user & ensure admin privileges
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const authHeader = req.headers.get("Authorization");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify token
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Check role
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.role !== "admin") {
        return new Response(JSON.stringify({ error: "Only Admins can issue Paystack refunds" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    const { ticketId, paystackRef, amount, reason, paymentStatus, settlementNote } = await req.json();

    if (!paystackRef) {
      return new Response(JSON.stringify({ error: "Missing Paystack transaction reference" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Call Paystack Refund API
    const refundPayload: any = {
      transaction: paystackRef,
      merchant_note: reason || `BizaDesk Ticket ${ticketId} Unresolved Refund`
    };

    if (amount) {
      refundPayload.amount = Math.round(Number(amount) * 100); // Paystack amounts in kobo
    }

    const paystackRes = await fetch("https://api.paystack.co/refund", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${paystackSecret}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(refundPayload)
    });

    const paystackData = await paystackRes.json();

    if (!paystackRes.ok || !paystackData.status) {
      return new Response(JSON.stringify({ 
        error: paystackData.message || "Paystack refund request failed",
        details: paystackData 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const refundRef = paystackData.data?.id || paystackData.data?.transaction_reference || "RFD_SUCCESS";

    // Update ticket in database
    if (ticketId) {
      const updatePayload: Record<string, any> = {
        payment_status: paymentStatus || "REFUNDED",
        status: "RESOLVED",
        refund_ref: String(refundRef),
        refunded_at: new Date().toISOString()
      };
      if (amount !== undefined && amount !== null) {
        updatePayload.refunded_amount = Number(amount);
      }
      if (paymentStatus === "PARTIALLY_REFUNDED") {
        updatePayload.settlement_status = "PARTIAL_REFUND";
      } else {
        updatePayload.settlement_status = "FULL_REFUND";
      }
      if (settlementNote) {
        updatePayload.settlement_note = settlementNote;
      }

      await supabase
        .from("tickets")
        .update(updatePayload)
        .eq("id", ticketId);
    }

    return new Response(JSON.stringify({
      success: true,
      message: "Refund processed successfully via Paystack",
      refundRef: refundRef,
      data: paystackData.data
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

