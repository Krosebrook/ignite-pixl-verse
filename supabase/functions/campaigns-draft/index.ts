import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, idempotency-key, x-idempotency-key",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

interface DraftRequest {
  org_id: string;
  name: string;
  objective: string;
  platforms?: string[];
  description?: string;
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
  const userAgent = req.headers.get("user-agent") || "unknown";

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

    const body: DraftRequest = await req.json();

    // Validate required fields
    if (!body.org_id || !body.name || !body.objective) {
      return new Response(JSON.stringify({ error: "Missing required fields: org_id, name, objective" }), {
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

    // Check idempotency
    if (idempotencyKey) {
      const { data: existing } = await supabase
        .from("campaigns")
        .select("*")
        .eq("org_id", body.org_id)
        .contains("metadata", { idempotency_key: idempotencyKey })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        console.log("Returning cached campaign for idempotency key:", idempotencyKey);
        return new Response(JSON.stringify(existing), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Generate campaign draft using AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const systemPrompt = `You are a marketing campaign strategist. Generate a comprehensive campaign draft with:
- Key messaging pillars (3-5 points)
- Target audience segments
- Recommended platforms and content types
- Success metrics (KPIs)
- Suggested timeline
Return as structured JSON.`;

    const userPrompt = `Create a campaign draft for:
Name: ${body.name}
Objective: ${body.objective}
Platforms: ${body.platforms?.join(", ") || "all major social platforms"}
Description: ${body.description || "N/A"}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds to your workspace" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const draftContent = JSON.parse(aiData.choices[0].message.content);

    // Create campaign with draft content
    const { data: campaign, error: insertError } = await supabase
      .from("campaigns")
      .insert({
        org_id: body.org_id,
        user_id: user.id,
        name: body.name,
        description: body.description || "",
        objective: body.objective,
        platforms: body.platforms || [],
        status: "draft",
        assets: draftContent,
        metrics: {},
        metadata: {
          ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
          user_agent: userAgent,
          generated_at: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      throw insertError;
    }

    console.log("Campaign draft created:", campaign.id);
    return new Response(JSON.stringify(campaign), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in campaigns-draft function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
