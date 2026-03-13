import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { action, contact_id, email, password, role } = await req.json();

    if (action === "provision") {
      // Create a Supabase Auth account for a contact user
      if (!email || !password) {
        return new Response(
          JSON.stringify({ error: "email and password are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if auth user already exists
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existing = existingUsers?.users?.find(u => u.email === email);

      let userId: string;

      if (existing) {
        userId = existing.id;
      } else {
        // Create auth user
        const { data: userData, error: userError } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });

        if (userError) throw userError;
        userId = userData.user.id;
      }

      // If contact_id provided, update user_roles to use the auth user_id
      // and update the profile
      if (contact_id && role) {
        // Update user_roles: change contact_id -> auth user_id
        const { error: updateError } = await supabase
          .from("user_roles")
          .update({ user_id: userId })
          .eq("user_id", contact_id)
          .eq("role", role);

        if (updateError) {
          console.error("Failed to update user_roles:", updateError);
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          user_id: userId,
          message: existing ? "Auth user already existed, role updated" : "Auth user created successfully" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Legacy: create admin user
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const adminExists = existingUsers?.users?.some(u => u.email === "admin@gov.cn");

    if (adminExists) {
      return new Response(
        JSON.stringify({ message: "Admin user already exists" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email: "admin@gov.cn",
      password: "admin123456",
      email_confirm: true,
    });

    if (userError) throw userError;

    const { error: roleError } = await supabase.from("user_roles").insert({
      user_id: userData.user.id,
      role: "admin",
    });

    if (roleError) throw roleError;

    return new Response(
      JSON.stringify({
        message: "Admin user created successfully",
        email: "admin@gov.cn",
        password: "admin123456",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
