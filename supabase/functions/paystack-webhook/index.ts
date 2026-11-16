import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  // Paystack webhooks are strictly POST requests
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecret) {
      console.error("PAYSTACK_SECRET_KEY not configured");
      return new Response("Webhook secret not configured", { status: 500 });
    }

    // 1. Validate signature using HMAC SHA-512
    const signatureHeader = req.headers.get("x-paystack-signature") || "";
    const rawBody = await req.text();

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(paystackSecret),
      { name: "HMAC", hash: "SHA-512" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
    const computedSignature = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    if (!signatureHeader || signatureHeader !== computedSignature) {
      console.warn("Invalid Paystack webhook signature rejected.");
      return new Response("Invalid signature", { status: 401 });
    }

    // 2. Parse payload safely
    const payload = JSON.parse(rawBody);
    const event = payload?.event;
    const data = payload?.data;

    console.log(`Processing verified Paystack webhook event: ${event}`);

    if (event === "charge.success" && data?.reference) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const reference = data.reference;
      const amount = data.amount; // in kobo
      const customerEmail = data.customer?.email || "";
      const serviceType = data.metadata?.service || data.metadata?.support_type || "REMOTE";
      const nowIso = new Date().toISOString();

      // Check if payment record exists in 'payments' table
      const { data: existingPayment } = await supabase
        .from("payments")
        .select("id")
        .eq("reference", reference)
        .maybeSingle();

      if (existingPayment) {
        // Update existing pending payment to verified success
        const { error: updateError } = await supabase
          .from("payments")
          .update({
            status: "success",
            verified_at: nowIso,
            metadata: data.metadata || {}
          })
          .eq("reference", reference);

        if (updateError) {
          console.error(`Error updating payment ${reference}:`, updateError.message);
        } else {
          console.log(`Successfully verified payment: ${reference}`);
        }
      } else {
        // If row was not pre-created by client, insert it directly as verified
        const { error: insertError } = await supabase
          .from("payments")
          .insert({
            reference: reference,
            user_email: customerEmail,
            amount: amount,
            status: "success",
            payment_type: serviceType,
            metadata: data.metadata || {},
            verified_at: nowIso
          });

        if (insertError) {
          console.error(`Error inserting verified payment ${reference}:`, insertError.message);
        } else {
          console.log(`Successfully recorded verified payment: ${reference}`);
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err: any) {
    console.error("Webhook processing error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
