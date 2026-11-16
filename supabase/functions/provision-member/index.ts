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
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Missing Supabase configuration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { org_id, email, password, full_name, role, department } = await req.json();

    if (!email || !password || !org_id) {
      return new Response(JSON.stringify({ error: "Missing required fields: email, password, org_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const assignedRole = role || "technician";
    const assignedDept = department || "General IT";
    const cleanName = full_name?.trim() || cleanEmail.split("@")[0];

    let userId: string | null = null;

    // 1. Check if user already exists in Supabase Auth
    const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
    const existingAuthUser = userList?.users?.find(
      (u: any) => u.email?.toLowerCase().trim() === cleanEmail
    );

    if (existingAuthUser) {
      userId = existingAuthUser.id;
      // Update their password and metadata so they can log in immediately
      const { error: updateAuthErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: password,
        email_confirm: true,
        user_metadata: {
          full_name: cleanName,
          role: assignedRole,
          org_id: org_id
        }
      });
      if (updateAuthErr) {
        console.warn("Could not update existing auth user password:", updateAuthErr.message);
      }
    } else {
      // 2. Create the user in Supabase Auth with password pre-confirmed
      const { data: newUser, error: createAuthErr } = await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password: password,
        email_confirm: true,
        user_metadata: {
          full_name: cleanName,
          role: assignedRole,
          org_id: org_id
        }
      });

      if (createAuthErr || !newUser?.user) {
        return new Response(
          JSON.stringify({ error: createAuthErr?.message || "Failed to create user in auth system" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }
      userId = newUser.user.id;
    }

    // 3. Upsert into public.profiles directly so they are immediately an ACTIVE member
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: userId,
        org_id: org_id,
        email: cleanEmail,
        full_name: cleanName,
        role: assignedRole,
        department: assignedDept,
        account_type: "business",
        is_active: true
      })
      .select()
      .maybeSingle();

    if (profileErr) {
      console.error("Profile upsert error:", profileErr.message);
      return new Response(
        JSON.stringify({ error: `User created in auth, but profile sync failed: ${profileErr.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // 4. Mark any invitation record as accepted or upsert it
    try {
      await supabaseAdmin
        .from("organization_invitations")
        .update({ status: "accepted", accepted_at: new Date().toISOString() })
        .eq("email", cleanEmail);
    } catch (_) {}

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        email: cleanEmail,
        full_name: cleanName,
        role: assignedRole,
        department: assignedDept,
        message: "User account provisioned successfully with login credentials"
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
