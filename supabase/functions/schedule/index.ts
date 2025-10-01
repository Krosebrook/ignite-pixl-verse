import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, idempotency-key, x-idempotency-key",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

interface ScheduleRequest {
  org_id: string;
  asset_id: string;
  platform: string;
  scheduled_at: string;
  campaign_id?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization header" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const idempotencyKey = req.headers.get("idempotency-key") || req.headers.get("x-idempotency-key");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify JWT and get user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(JSON.stringify({ error: "Invalid authentication token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: ScheduleRequest = await req.json();

    // Validate required fields
    if (!body.org_id || !body.asset_id || !body.platform || !body.scheduled_at) {
      return new Response(JSON.stringify({ 
        error: "Missing required fields: org_id, asset_id, platform, scheduled_at" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate platform
    const validPlatforms = ["instagram", "facebook", "twitter", "linkedin", "tiktok", "youtube"];
    if (!validPlatforms.includes(body.platform.toLowerCase())) {
      return new Response(JSON.stringify({ 
        error: `Invalid platform. Must be one of: ${validPlatforms.join(", ")}` 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate scheduled_at is in the future
    const scheduledDate = new Date(body.scheduled_at);
    if (isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
      return new Response(JSON.stringify({ 
        error: "scheduled_at must be a valid future date in ISO 8601 format" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify org membership
    const { data: membership, error: memberError } = await supabase
      .from("members")
      .select("role")
      .eq("user_id", user.id)
      .eq("org_id", body.org_id)
      .single();

    if (memberError || !membership) {
      return new Response(JSON.stringify({ error: "User not authorized for this organization" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify asset exists and belongs to org
    const { data: asset, error: assetError } = await supabase
      .from("assets")
      .select("id, name, type, org_id")
      .eq("id", body.asset_id)
      .eq("org_id", body.org_id)
      .single();

    if (assetError || !asset) {
      return new Response(JSON.stringify({ error: "Asset not found or not authorized" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If campaign_id provided, verify it belongs to org
    if (body.campaign_id) {
      const { data: campaign, error: campaignError } = await supabase
        .from("campaigns")
        .select("id")
        .eq("id", body.campaign_id)
        .eq("org_id", body.org_id)
        .single();

      if (campaignError || !campaign) {
        return new Response(JSON.stringify({ error: "Campaign not found or not authorized" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Check idempotency
    if (idempotencyKey) {
      const { data: existing } = await supabase
        .from("schedules")
        .select("*")
        .eq("org_id", body.org_id)
        .eq("asset_id", body.asset_id)
        .eq("platform", body.platform)
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24h
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        console.log("Returning cached schedule for idempotency");
        return new Response(JSON.stringify(existing), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Create schedule
    const { data: schedule, error: insertError } = await supabase
      .from("schedules")
      .insert({
        org_id: body.org_id,
        asset_id: body.asset_id,
        campaign_id: body.campaign_id || null,
        platform: body.platform.toLowerCase(),
        scheduled_at: body.scheduled_at,
        status: "pending",
        retries: 0,
        result: null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      throw insertError;
    }

    console.log("Schedule created:", schedule.id, "for", body.platform, "at", body.scheduled_at);
    return new Response(JSON.stringify(schedule), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in schedule function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
