import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Logger, trackRequest, metrics } from '../_shared/observability.ts';
import { corsPreflightResponse, successResponse, createdResponse, errorResponse, rateLimitResponse, getAuthToken, getIdempotencyKey } from '../_shared/http.ts';
import { withCircuitBreaker } from '../_shared/circuit-breaker.ts';
import { withRetry } from '../_shared/retry.ts';
import { checkDistributedRateLimit, getRateLimitHeaders, RATE_LIMITS } from '../_shared/ratelimit-redis.ts';

const FUNCTION_NAME = 'campaigns-draft';

interface DraftRequest {
  org_id: string;
  name: string;
  objective: string;
  platforms?: string[];
  description?: string;
}

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
      return errorResponse('Missing authorization header', 401, requestId);
    }

    const idempotencyKey = getIdempotencyKey(req);
    const userAgent = req.headers.get('user-agent') || 'unknown';

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify JWT and get user
    const { data: authData, error: authError } = await supabase.auth.getUser(authToken);

    if (authError || !authData.user) {
      logger.warn('Authentication failed', { error: authError?.message });
      logResponse(401);
      return errorResponse('Invalid authentication token', 401, requestId);
    }

    const user = authData.user;
    logger.info('User authenticated', { userId: user.id });

    // Rate limiting - using distributed rate limiting with Redis
    const rateLimitConfig = RATE_LIMITS.content_generation;
    const rateLimit = await checkDistributedRateLimit(
      user.id, 
      'campaigns_draft', 
      rateLimitConfig.limit, 
      rateLimitConfig.windowMs
    );

    if (!rateLimit.allowed) {
      logger.warn('Rate limit exceeded', { userId: user.id, resetAt: rateLimit.resetAt });
      metrics.counter('rate_limit.exceeded', 1, { function: FUNCTION_NAME });
      logResponse(429);
      return rateLimitResponse(
        'Rate limit exceeded. Please try again later.',
        Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
      );
    }

    // Parse body
    const body: DraftRequest = await req.json();

    // Validate required fields
    if (!body.org_id || !body.name || !body.objective) {
      logResponse(400);
      return errorResponse('Missing required fields: org_id, name, objective', 400, requestId);
    }

    // Verify org membership
    const { data: membership, error: memberError } = await supabase
      .from('members')
      .select('role')
      .eq('user_id', user.id)
      .eq('org_id', body.org_id)
      .single();

    if (memberError || !membership) {
      logger.warn('User not authorized for org', { userId: user.id, orgId: body.org_id });
      logResponse(403);
      return errorResponse('User not authorized for this organization', 403, requestId);
    }

    // Check idempotency
    if (idempotencyKey) {
      const { data: existing } = await supabase
        .from('campaigns')
        .select('*')
        .eq('org_id', body.org_id)
        .contains('metadata', { idempotency_key: idempotencyKey })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        logger.info('Returning cached campaign', { idempotencyKey, campaignId: existing.id });
        logResponse(200);
        return successResponse(existing, { "X-Idempotent-Replay": "true" });
      }
    }

    // Generate campaign draft using AI with circuit breaker
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const generateDraft = async () => {
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
Platforms: ${body.platforms?.join(', ') || 'all major social platforms'}
Description: ${body.description || 'N/A'}`;

      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        logger.error('AI API error', undefined, { status: aiResponse.status, body: errorText });
        
        if (aiResponse.status === 429) {
          throw { status: 429, message: 'Rate limit exceeded, please try again later' };
        }
        if (aiResponse.status === 402) {
          throw { status: 402, message: 'Payment required, please add funds to your workspace' };
        }
        throw new Error(`AI API error: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      return JSON.parse(aiData.choices[0].message.content);
    };

    let draftContent;
    try {
      draftContent = await withCircuitBreaker(
        'campaigns-draft-ai',
        () => withRetry(generateDraft, { maxRetries: 2, baseDelayMs: 1000 })
      );
    } catch (err: unknown) {
      const error = err as { status?: number; message?: string };
      if (error.status === 429) {
        logResponse(429);
        return rateLimitResponse('Rate limit exceeded, please try again later', 60);
      }
      if (error.status === 402) {
        logResponse(402);
        return errorResponse(error.message || 'Payment required', 402, requestId);
      }
      throw err;
    }

    // Create campaign with draft content
    const { data: campaign, error: insertError } = await supabase
      .from('campaigns')
      .insert({
        org_id: body.org_id,
        user_id: user.id,
        name: body.name,
        description: body.description || '',
        objective: body.objective,
        platforms: body.platforms || [],
        status: 'draft',
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
      logger.error('Failed to insert campaign', insertError);
      throw insertError;
    }

    metrics.counter(`${FUNCTION_NAME}.success`);
    logger.info('Campaign draft created', { campaignId: campaign.id });
    logResponse(201);

    return createdResponse(campaign, { "X-Request-Id": requestId });

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
