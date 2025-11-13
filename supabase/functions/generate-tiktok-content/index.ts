import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { TikTokRequestSchema, TIER_LIMITS } from '../_shared/validation.ts';
import { checkRateLimit } from '../_shared/ratelimit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const QUALITY_TIERS = {
  starter: {
    resolution: '720x1280',
    bitrate_kbps: 2500,
    max_layers: 5,
    watermark: true,
    features: ['basic_effects', 'trending_library_limited']
  },
  pro: {
    resolution: '1080x1920',
    bitrate_kbps: 8000,
    max_layers: 15,
    watermark: false,
    features: ['full_effects_library', 'ai_auto_caption', 'trending_sounds_api']
  },
  enterprise: {
    resolution: '2160x3840',
    bitrate_kbps: 25000,
    max_layers: 999,
    watermark: false,
    features: ['custom_effects', 'brand_safety_filters', 'api_access']
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Rate limiting for TikTok generation
    const rateLimit = await checkRateLimit(user.id, 'tiktok_generation', 20, 3600000); // 20 per hour
    
    if (!rateLimit.allowed) {
      return new Response(JSON.stringify({
        error: 'Rate limit exceeded',
        retry_after: new Date(rateLimit.resetAt).toISOString()
      }), {
        status: 429,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': '20',
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.resetAt.toString()
        }
      });
    }

    const body = await req.json();
    
    // Validate request body using Zod
    const validation = TikTokRequestSchema.safeParse(body);
    if (!validation.success) {
      return new Response(JSON.stringify({ 
        error: 'Validation failed',
        details: validation.error.format()
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const { org_id, prompt, quality_tier, duration_seconds, layers, effects = [] } = validation.data;

    // Verify org membership
    const { data: membership } = await supabase
      .from('members')
      .select('org_id')
      .eq('user_id', user.id)
      .eq('org_id', org_id)
      .single();

    if (!membership) {
      return new Response(JSON.stringify({ error: 'Not a member of this organization' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check usage limits
    const { data: credits } = await supabase
      .from('usage_credits')
      .select('*')
      .eq('org_id', org_id)
      .single();

    const estimatedMinutes = duration_seconds / 60;
    if (credits && credits.video_minutes_used + estimatedMinutes > credits.video_minutes_limit) {
      return new Response(JSON.stringify({
        error: 'Video minutes limit exceeded',
        used: credits.video_minutes_used,
        limit: credits.video_minutes_limit,
        upgrade_url: '/pricing'
      }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Enforce tier limits using shared TIER_LIMITS
    const tierLimits = TIER_LIMITS[quality_tier];
    const tierConfig = QUALITY_TIERS[quality_tier as keyof typeof QUALITY_TIERS];
    
    if (layers.length > tierLimits.max_layers) {
      return new Response(JSON.stringify({
        error: `${quality_tier} tier allows max ${tierLimits.max_layers} layers`,
        current_layers: layers.length,
        max_layers: tierLimits.max_layers,
        upgrade_url: '/pricing'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Generating TikTok content for org ${org_id}: ${prompt}`);
    console.log(`Quality tier: ${quality_tier}, Layers: ${layers.length}, Effects: ${effects.length}`);

    // Simulate video generation (replace with actual video generation logic)
    const mockVideoUrl = `https://placehold.co/1080x1920/1e293b/ffffff.mp4?text=TikTok+Video+${quality_tier}`;
    const mockThumbnailUrl = `https://placehold.co/1080x1920/1e293b/ffffff.png?text=TikTok`;

    // Save asset to database
    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .insert({
        org_id,
        user_id: user.id,
        name: `TikTok Video - ${prompt.substring(0, 50)}`,
        type: 'video',
        content_url: mockVideoUrl,
        thumbnail_url: mockThumbnailUrl,
        quality_tier,
        platform_config: {
          tiktok: {
            aspect_ratio: '9:16',
            resolution: tierConfig.resolution,
            duration_seconds,
            effects
          }
        },
        resolution_config: {
          width: parseInt(tierConfig.resolution.split('x')[0]),
          height: parseInt(tierConfig.resolution.split('x')[1]),
          bitrate_kbps: tierConfig.bitrate_kbps
        },
        layers,
        provenance: {
          model: 'tiktok-generator-v1',
          prompt,
          quality_tier,
          layers_count: layers.length,
          effects_count: effects.length,
          timestamp: new Date().toISOString()
        },
        metadata: {
          platform: 'tiktok',
          has_watermark: tierConfig.watermark,
          render_time_ms: 3000,
          vertical_video: true
        }
      })
      .select()
      .single();

    if (assetError) {
      console.error('Error saving asset:', assetError);
      return new Response(JSON.stringify({ error: 'Failed to save asset' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Update usage credits
    if (credits) {
      await supabase
        .from('usage_credits')
        .update({
          video_minutes_used: credits.video_minutes_used + estimatedMinutes
        })
        .eq('org_id', org_id);
    }

    // Track analytics
    await supabase.from('analytics_events').insert({
      org_id,
      user_id: user.id,
      event_type: 'tiktok_video_generated',
      event_category: 'content_generation',
      duration_ms: 3000,
      metadata: {
        quality_tier,
        layers_count: layers.length,
        effects_count: effects.length,
        duration_seconds
      }
    });

    return new Response(JSON.stringify({
      asset_id: asset.id,
      video_url: mockVideoUrl,
      thumbnail_url: mockThumbnailUrl,
      duration_seconds,
      resolution: tierConfig.resolution,
      render_time_ms: 3000,
      provenance: asset.provenance,
      metadata: asset.metadata
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in generate-tiktok-content:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
