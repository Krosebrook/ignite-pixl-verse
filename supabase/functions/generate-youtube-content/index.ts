import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { YouTubeRequestSchema, TIER_LIMITS } from '../_shared/validation.ts';
import { checkRateLimit } from '../_shared/ratelimit.ts';
import { Logger, trackRequest, metrics } from '../_shared/observability.ts';
import { corsPreflightResponse, successResponse, errorResponse, rateLimitResponse, getAuthToken } from '../_shared/http.ts';
import { withCircuitBreaker } from '../_shared/circuit-breaker.ts';
import { withRetry } from '../_shared/retry.ts';

const FUNCTION_NAME = 'generate-youtube-content';

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
    const rateLimit = await checkRateLimit(user.id, 'youtube_gen', 20, 3600000);

    if (!rateLimit.allowed) {
      logger.warn('Rate limit exceeded', { userId: user.id, resetAt: rateLimit.resetAt });
      logResponse(429);
      return rateLimitResponse('Rate limit exceeded');
    }

    // Parse and validate request
    const rawBody = await req.json();
    const validation = YouTubeRequestSchema.safeParse(rawBody);

    if (!validation.success) {
      logger.warn('Validation failed', { errors: validation.error.format() });
      logResponse(400);
      return errorResponse('Validation failed', 400, requestId, {
        details: validation.error.format()
      });
    }

    const { org_id, prompt, quality_tier, duration_seconds, layers } = validation.data;
    logger.info('Request validated', { orgId: org_id, qualityTier: quality_tier });

    // Tier limits check
    const tierLimits = TIER_LIMITS[quality_tier as keyof typeof TIER_LIMITS];
    if (layers.length > tierLimits.max_layers) {
      logResponse(402);
      return errorResponse('Layer limit exceeded', 402, requestId, {
        max_layers: tierLimits.max_layers,
        current_layers: layers.length
      });
    }

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
      return errorResponse('Not authorized for this organization', 403, requestId);
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
        limit: credits.video_minutes_limit
      });
    }

    // Generate content with circuit breaker
    const generateVideo = async () => {
      // Mock video generation (replace with actual API call)
      const mockVideoUrl = `https://placehold.co/1920x1080.mp4`;
      const mockThumbnailUrl = `https://placehold.co/1920x1080.png`;
      return { videoUrl: mockVideoUrl, thumbnailUrl: mockThumbnailUrl };
    };

    const { videoUrl, thumbnailUrl } = await withCircuitBreaker(
      'youtube-video-gen',
      () => withRetry(generateVideo, { maxRetries: 2, baseDelayMs: 500 })
    );

    // Save asset
    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .insert({
        org_id,
        user_id: user.id,
        type: 'video',
        name: `YouTube Video - ${new Date().toISOString()}`,
        content_url: videoUrl,
        thumbnail_url: thumbnailUrl,
        quality_tier,
        platform_config: { youtube: { aspect_ratio: '16:9', duration_seconds } },
        layers,
        provenance: {
          model: 'runway-gen-3',
          prompt_hash: btoa(prompt).slice(0, 16),
          timestamp: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (assetError) {
      logger.error('Failed to save asset', assetError);
      throw assetError;
    }

    // Update usage
    await supabase.rpc('increment_video_usage', { p_org_id: org_id, p_minutes: estimatedMinutes });

    // Track metrics
    metrics.counter(`${FUNCTION_NAME}.success`);
    metrics.gauge('video.duration_seconds', duration_seconds);

    logger.info('YouTube video generated successfully', { assetId: asset.id });
    logResponse(200);

    return successResponse({
      asset_id: asset.id,
      video_url: videoUrl,
      thumbnail_url: thumbnailUrl
    });

  } catch (error) {
    logger.error('Unexpected error', error as Error);
    metrics.counter(`${FUNCTION_NAME}.error`);
    logResponse(500);
    return errorResponse(
      error instanceof Error ? error.message : 'Internal error',
      500,
      requestId
    );
  }
});
