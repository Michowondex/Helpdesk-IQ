import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    const { account_number, bank_code } = await req.json();

    if (!account_number || !bank_code) {
      return new Response(JSON.stringify({ error: "Missing account_number or bank_code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Call Paystack Resolve Account API
    const paystackRes = await fetch(
      `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(account_number)}&bank_code=${encodeURIComponent(bank_code)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          "Content-Type": "application/json"
        }
      }
    );

    const result = await paystackRes.json();

    if (!paystackRes.ok || !result.status) {
      return new Response(
        JSON.stringify({ 
          error: result.message || "Could not resolve bank account details. Please verify your account number and bank." 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        account_name: result.data.account_name,
        account_number: result.data.account_number,
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
