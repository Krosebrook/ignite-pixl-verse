import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { YouTubeRequestSchema, TIER_LIMITS } from '../_shared/validation.ts';
import { checkRateLimit } from '../_shared/ratelimit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Rate limiting
    const rateLimit = await checkRateLimit(user.id, 'youtube_gen', 20, 3600000);
    if (!rateLimit.allowed) {
      return new Response(JSON.stringify({
        error: 'Rate limit exceeded',
        retry_after: rateLimit.resetAt
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Input validation
    const rawBody = await req.json();
    const body = YouTubeRequestSchema.parse(rawBody);
    const { org_id, prompt, quality_tier, duration_seconds, layers } = body;

    // Tier limits
    const tierLimits = TIER_LIMITS[quality_tier as keyof typeof TIER_LIMITS];
    if (layers.length > tierLimits.max_layers) {
      return new Response(JSON.stringify({
        error: 'Layer limit exceeded',
        max_layers: tierLimits.max_layers
      }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Verify membership
    const { data: membership } = await supabase
      .from('members')
      .select('org_id')
      .eq('user_id', user.id)
      .eq('org_id', org_id)
      .single();

    if (!membership) {
      return new Response(JSON.stringify({ error: 'Not authorized' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Usage check
    const { data: credits } = await supabase
      .from('usage_credits')
      .select('*')
      .eq('org_id', org_id)
      .single();

    const estimatedMinutes = duration_seconds / 60;
    if (credits && credits.video_minutes_used + estimatedMinutes > credits.video_minutes_limit) {
      return new Response(JSON.stringify({
        error: 'Video minutes limit exceeded'
      }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Generate content
    const mockVideoUrl = `https://placehold.co/1920x1080.mp4`;
    const mockThumbnailUrl = `https://placehold.co/1920x1080.png`;

    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .insert({
        org_id,
        user_id: user.id,
        type: 'video',
        name: `YouTube Video - ${new Date().toISOString()}`,
        content_url: mockVideoUrl,
        thumbnail_url: mockThumbnailUrl,
        quality_tier,
        platform_config: { youtube: { aspect_ratio: '16:9', duration_seconds } },
        layers,
        provenance: { model: 'runway-gen-3', timestamp: new Date().toISOString() }
      })
      .select()
      .single();

    if (assetError) throw assetError;

    await supabase.rpc('increment_video_usage', { p_org_id: org_id, p_minutes: estimatedMinutes });

    return new Response(JSON.stringify({
      asset_id: asset.id,
      video_url: mockVideoUrl,
      thumbnail_url: mockThumbnailUrl
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
