import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const QUALITY_TIERS = {
  starter: {
    resolution: '1280x720',
    bitrate_kbps: 3000,
    max_layers: 5,
    watermark: true,
    features: ['basic_transitions', 'standard_fonts']
  },
  pro: {
    resolution: '3840x2160',
    bitrate_kbps: 20000,
    max_layers: 15,
    watermark: false,
    features: ['advanced_transitions', 'ai_voice_clone', 'auto_caption', 'color_grading', 'motion_graphics']
  },
  enterprise: {
    resolution: '7680x4320',
    bitrate_kbps: 50000,
    max_layers: 999,
    watermark: false,
    features: ['all_pro_features', 'custom_branding', '8k_export', 'priority_rendering']
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

    const { org_id, prompt, quality_tier = 'starter', duration_seconds = 60, layers = [] } = await req.json();

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

    // Enforce tier limits
    const tierConfig = QUALITY_TIERS[quality_tier as keyof typeof QUALITY_TIERS];
    if (layers.length > tierConfig.max_layers) {
      return new Response(JSON.stringify({
        error: `${quality_tier} tier allows max ${tierConfig.max_layers} layers`,
        current_layers: layers.length,
        max_layers: tierConfig.max_layers
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Generating YouTube content for org ${org_id}: ${prompt}`);
    console.log(`Quality tier: ${quality_tier}, Layers: ${layers.length}, Duration: ${duration_seconds}s`);

    // Simulate video generation (replace with actual video generation logic)
    const mockVideoUrl = `https://placehold.co/1920x1080/1e293b/ffffff.mp4?text=YouTube+Video+${quality_tier}`;
    const mockThumbnailUrl = `https://placehold.co/1920x1080/1e293b/ffffff.png?text=Thumbnail`;

    // Save asset to database
    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .insert({
        org_id,
        user_id: user.id,
        name: `YouTube Video - ${prompt.substring(0, 50)}`,
        type: 'video',
        content_url: mockVideoUrl,
        thumbnail_url: mockThumbnailUrl,
        quality_tier,
        platform_config: {
          youtube: {
            aspect_ratio: '16:9',
            resolution: tierConfig.resolution,
            duration_seconds
          }
        },
        resolution_config: {
          width: parseInt(tierConfig.resolution.split('x')[0]),
          height: parseInt(tierConfig.resolution.split('x')[1]),
          bitrate_kbps: tierConfig.bitrate_kbps
        },
        layers,
        provenance: {
          model: 'youtube-generator-v1',
          prompt,
          quality_tier,
          layers_count: layers.length,
          timestamp: new Date().toISOString()
        },
        metadata: {
          platform: 'youtube',
          has_watermark: tierConfig.watermark,
          render_time_ms: 5000
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
      event_type: 'youtube_video_generated',
      event_category: 'content_generation',
      duration_ms: 5000,
      metadata: {
        quality_tier,
        layers_count: layers.length,
        duration_seconds
      }
    });

    return new Response(JSON.stringify({
      asset_id: asset.id,
      video_url: mockVideoUrl,
      thumbnail_url: mockThumbnailUrl,
      duration_seconds,
      resolution: tierConfig.resolution,
      render_time_ms: 5000,
      provenance: asset.provenance,
      metadata: asset.metadata
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in generate-youtube-content:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
