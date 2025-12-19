import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { TikTokRequestSchema, TIER_LIMITS } from '../_shared/validation.ts';
import { checkRateLimit } from '../_shared/ratelimit.ts';
import { Logger, trackRequest, metrics } from '../_shared/observability.ts';
import { corsPreflightResponse, successResponse, errorResponse, rateLimitResponse, getAuthToken } from '../_shared/http.ts';
import { withCircuitBreaker } from '../_shared/circuit-breaker.ts';
import { withRetry } from '../_shared/retry.ts';

const FUNCTION_NAME = 'generate-tiktok-content';

const QUALITY_TIERS = {
  starter: {
    resolution: '720x1280',
    bitrate_kbps: 2500,
    watermark: true,
    features: ['basic_effects', 'trending_library_limited']
  },
  pro: {
    resolution: '1080x1920',
    bitrate_kbps: 8000,
    watermark: false,
    features: ['full_effects_library', 'ai_auto_caption', 'trending_sounds_api']
  },
  enterprise: {
    resolution: '2160x3840',
    bitrate_kbps: 25000,
    watermark: false,
    features: ['custom_effects', 'brand_safety_filters', 'api_access']
  }
} as const;

Deno.serve(async (req) => {
  const logger = new Logger(FUNCTION_NAME);
  const { logRequest, logResponse } = trackRequest(logger, req, FUNCTION_NAME);
  const requestId = logger.getRequestId();

  if (req.method === 'OPTIONS') {
    return corsPreflightResponse();
  }

  logRequest();

  try {
    // Auth check
    const authToken = getAuthToken(req);
    if (!authToken) {
      logResponse(401);
      return errorResponse('Unauthorized', 401, requestId);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${authToken}` } } }
    );

    // Verify user
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      logger.warn('Authentication failed', { error: authError?.message });
      logResponse(401);
      return errorResponse('Unauthorized', 401, requestId);
    }

    const user = authData.user;
    logger.info('User authenticated', { userId: user.id });

    // Rate limiting
    const rateLimit = await checkRateLimit(user.id, 'tiktok_generation', 20, 3600000);

    if (!rateLimit.allowed) {
      logger.warn('Rate limit exceeded', { userId: user.id, resetAt: rateLimit.resetAt });
      logResponse(429);
      return rateLimitResponse(rateLimit.resetAt, requestId);
    }

    // Parse and validate request
    const body = await req.json();
    const validation = TikTokRequestSchema.safeParse(body);

    if (!validation.success) {
      logger.warn('Validation failed', { errors: validation.error.format() });
      logResponse(400);
      return errorResponse('Validation failed', 400, requestId, {
        details: validation.error.format()
      });
    }

    const { org_id, prompt, quality_tier, duration_seconds, layers, effects = [] } = validation.data;
    logger.info('Request validated', { orgId: org_id, qualityTier: quality_tier, layersCount: layers.length });

    // Verify org membership
    const { data: membership } = await supabase
      .from('members')
      .select('org_id')
      .eq('user_id', user.id)
      .eq('org_id', org_id)
      .single();

    if (!membership) {
      logger.warn('User not member of org', { userId: user.id, orgId: org_id });
      logResponse(403);
      return errorResponse('Not a member of this organization', 403, requestId);
    }

    // Usage check
    const { data: credits } = await supabase
      .from('usage_credits')
      .select('*')
      .eq('org_id', org_id)
      .single();

    const estimatedMinutes = duration_seconds / 60;
    if (credits && (credits.video_minutes_used ?? 0) + estimatedMinutes > (credits.video_minutes_limit ?? 0)) {
      logger.warn('Video minutes limit exceeded', { used: credits.video_minutes_used, limit: credits.video_minutes_limit });
      logResponse(402);
      return errorResponse('Video minutes limit exceeded', 402, requestId, {
        used: credits.video_minutes_used,
        limit: credits.video_minutes_limit,
        upgrade_url: '/pricing'
      });
    }

    // Tier limits check
    const tierLimits = TIER_LIMITS[quality_tier];
    const tierConfig = QUALITY_TIERS[quality_tier as keyof typeof QUALITY_TIERS];

    if (layers.length > tierLimits.max_layers) {
      logResponse(400);
      return errorResponse(`${quality_tier} tier allows max ${tierLimits.max_layers} layers`, 400, requestId, {
        current_layers: layers.length,
        max_layers: tierLimits.max_layers
      });
    }

    // Generate content with circuit breaker
    const generateVideo = async () => {
      const mockVideoUrl = `https://placehold.co/1080x1920/1e293b/ffffff.mp4?text=TikTok+Video+${quality_tier}`;
      const mockThumbnailUrl = `https://placehold.co/1080x1920/1e293b/ffffff.png?text=TikTok`;
      return { videoUrl: mockVideoUrl, thumbnailUrl: mockThumbnailUrl, renderTimeMs: 3000 };
    };

    const { videoUrl, thumbnailUrl, renderTimeMs } = await withCircuitBreaker(
      'tiktok-video-gen',
      () => withRetry(generateVideo, { maxRetries: 2, baseDelayMs: 500 })
    );

    // Save asset
    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .insert({
        org_id,
        user_id: user.id,
        name: `TikTok Video - ${prompt.substring(0, 50)}`,
        type: 'video',
        content_url: videoUrl,
        thumbnail_url: thumbnailUrl,
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
          prompt_hash: btoa(prompt).slice(0, 16),
          quality_tier,
          layers_count: layers.length,
          effects_count: effects.length,
          timestamp: new Date().toISOString()
        },
        metadata: {
          platform: 'tiktok',
          has_watermark: tierConfig.watermark,
          render_time_ms: renderTimeMs,
          vertical_video: true
        }
      })
      .select()
      .single();

    if (assetError) {
      logger.error('Failed to save asset', assetError);
      logResponse(500);
      return errorResponse('Failed to save asset', 500, requestId);
    }

    // Update usage credits
    if (credits) {
      await supabase
        .from('usage_credits')
        .update({ video_minutes_used: (credits.video_minutes_used ?? 0) + estimatedMinutes })
        .eq('org_id', org_id);
    }

    // Track analytics
    await supabase.from('analytics_events').insert({
      org_id,
      user_id: user.id,
      event_type: 'tiktok_video_generated',
      event_category: 'content_generation',
      duration_ms: renderTimeMs,
      metadata: {
        quality_tier,
        layers_count: layers.length,
        effects_count: effects.length,
        duration_seconds
      }
    });

    metrics.counter(`${FUNCTION_NAME}.success`);
    metrics.gauge('tiktok.duration_seconds', duration_seconds);

    logger.info('TikTok video generated successfully', { assetId: asset.id });
    logResponse(200);

    return successResponse({
      asset_id: asset.id,
      video_url: videoUrl,
      thumbnail_url: thumbnailUrl,
      duration_seconds,
      resolution: tierConfig.resolution,
      render_time_ms: renderTimeMs,
      provenance: asset.provenance,
      metadata: asset.metadata
    }, requestId);

  } catch (error) {
    logger.error('Unexpected error', error as Error);
    metrics.counter(`${FUNCTION_NAME}.error`);
    logResponse(500);
    return errorResponse(
      error instanceof Error ? error.message : 'Unknown error',
      500,
      requestId
    );
  }
});
