import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, idempotency-key, x-idempotency-key",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

interface GenerateRequest {
  type: "text" | "image";
  prompt: string;
  org_id: string;
  name?: string;
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

    const body: GenerateRequest = await req.json();

    // Validate required fields
    if (!body.type || !body.prompt || !body.org_id) {
      return new Response(JSON.stringify({ error: "Missing required fields: type, prompt, org_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["text", "image"].includes(body.type)) {
      return new Response(JSON.stringify({ error: "Invalid type. Must be 'text' or 'image'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.prompt.length < 10 || body.prompt.length > 4000) {
      return new Response(JSON.stringify({ error: "Prompt must be between 10 and 4000 characters" }), {
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
        .from("assets")
        .select("*")
        .eq("org_id", body.org_id)
        .contains("metadata", { idempotency_key: idempotencyKey })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        console.log("Returning cached asset for idempotency key:", idempotencyKey);
        return new Response(JSON.stringify(existing), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json", "X-Idempotent-Replay": "true" },
        });
      }
    }

    // Generate prompt hash for provenance
    const encoder = new TextEncoder();
    const promptData = encoder.encode(body.prompt);
    const hashBuffer = await crypto.subtle.digest("SHA-256", promptData);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    const promptHash = `sha256:${hashHex}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const timestamp = new Date().toISOString();
    let contentData: any = null;
    let contentUrl: string | null = null;
    let thumbnailUrl: string | null = null;
    const model = body.type === "text" ? "google/gemini-2.5-flash" : "google/gemini-2.5-flash-image-preview";

    if (body.type === "text") {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: "You are a professional content creator. Generate high-quality, engaging content based on user prompts. Be creative, concise, and compelling.",
            },
            { role: "user", content: body.prompt },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("AI API error:", response.status, errorText);
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later" }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Payment required, please add funds to your workspace" }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error(`AI API error: ${response.status}`);
      }

      const data = await response.json();
      contentData = { text: data.choices[0]?.message?.content };
    } else if (body.type === "image") {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image-preview",
          messages: [{ role: "user", content: body.prompt }],
          modalities: ["image", "text"],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("AI API error:", response.status, errorText);
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later" }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Payment required, please add funds to your workspace" }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error(`AI API error: ${response.status}`);
      }

      const data = await response.json();
      const imageUrl = data.choices[0]?.message?.images?.[0]?.image_url?.url;
      if (!imageUrl) {
        throw new Error("No image generated");
      }
      contentUrl = imageUrl;
      thumbnailUrl = imageUrl;
    }

    // Create asset with provenance
    const assetName = body.name || `${body.type === "text" ? "Text" : "Image"} - ${new Date().toLocaleDateString()}`;
    const { data: asset, error: insertError } = await supabase
      .from("assets")
      .insert({
        org_id: body.org_id,
        user_id: user.id,
        type: body.type,
        name: assetName,
        content_url: contentUrl,
        content_data: contentData,
        thumbnail_url: thumbnailUrl,
        license: "all-rights-reserved",
        human_edited: false,
        provenance: {
          model,
          provider: "lovable-ai",
          prompt_hash: promptHash,
          timestamp,
        },
        metadata: {
          ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
          user_agent: userAgent,
          prompt_length: body.prompt.length,
        },
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      throw insertError;
    }

    console.log("Asset created:", asset.id, "Type:", body.type);
    return new Response(JSON.stringify(asset), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in generate-content function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
