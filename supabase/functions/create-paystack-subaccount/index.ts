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
      return new Response(JSON.stringify({ error: "PAYSTACK_SECRET_KEY not configured on server" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { 
      org_id, 
      business_name, 
      settlement_bank, 
      account_number, 
      account_name, 
      bank_name 
    } = await req.json();

    if (!org_id || !settlement_bank || !account_number) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: org_id, settlement_bank, account_number" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // 1. Call Paystack to create subaccount (0% platform charge — all money routes to merchant)
    const paystackPayload = {
      business_name: business_name || "Commercial Partner Workspace",
      settlement_bank: settlement_bank,
      account_number: account_number,
      percentage_charge: 0,
      description: `Settlement subaccount for ${business_name || "Commercial Org"} on BizaDesk`
    };

    const paystackRes = await fetch("https://api.paystack.co/subaccount", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(paystackPayload)
    });

    const result = await paystackRes.json();

    if (!paystackRes.ok || !result.status) {
      return new Response(
        JSON.stringify({ error: result.message || "Failed to create Paystack subaccount" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const subaccountCode = result.data.subaccount_code;

    // 2. Persist subaccount code and bank details into organizations table via Service Role
    const { error: dbError } = await supabase
      .from("organizations")
      .update({
        paystack_subaccount_code: subaccountCode,
        paystack_bank_name: bank_name || result.data.settlement_bank,
        paystack_account_number: account_number,
        paystack_account_name: account_name || result.data.account_name || business_name,
        paystack_settlement_bank: settlement_bank
      })
      .eq("id", org_id);

    if (dbError) {
      return new Response(
        JSON.stringify({ error: `Subaccount created (${subaccountCode}) but failed to update organization: ${dbError.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        subaccount_code: subaccountCode,
        bank_name: bank_name || result.data.settlement_bank,
        account_name: account_name || result.data.account_name || business_name,
        account_number: account_number
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
