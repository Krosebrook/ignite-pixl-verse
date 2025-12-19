import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Logger, Tracer, metrics, reportError, trackRequest } from '../_shared/observability.ts';
import {
  corsPreflightResponse,
  successResponse,
  badRequestResponse,
  unauthorizedResponse,
  forbiddenResponse,
  errorResponse,
  getAuthToken,
  getRequestId,
  parseJsonBody,
} from '../_shared/http.ts';
import { checkRateLimit } from '../_shared/ratelimit.ts';

const FUNCTION_NAME = 'usage-check';

interface UsageCheckRequest {
  org_id: string;
  estimated_tokens: number;
}

Deno.serve(async (req) => {
  const requestId = getRequestId(req);
  const logger = new Logger(FUNCTION_NAME, { requestId });
  const tracer = new Tracer(requestId);
  const { logRequest, logResponse } = trackRequest(logger, req, FUNCTION_NAME);

  if (req.method === 'OPTIONS') {
    return corsPreflightResponse();
  }

  logRequest();

  try {
    // Auth check
    const authToken = getAuthToken(req);
    if (!authToken) {
      logResponse(401);
      return unauthorizedResponse('Missing authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify JWT
    const authSpanId = tracer.startSpan('auth.verify');
    const { data: { user }, error: authError } = await supabase.auth.getUser(authToken);

    if (authError || !user) {
      tracer.endSpan(authSpanId, 'error');
      logger.warn('Authentication failed', { error: authError?.message });
      logResponse(401);
      return unauthorizedResponse('Invalid authentication token');
    }
    tracer.endSpan(authSpanId, 'ok');
    logger.info('User authenticated', { userId: user.id });

    // Rate limiting - 100 checks per minute (high frequency for usage checks)
    const rateLimit = await checkRateLimit(user.id, 'usage_check', 100, 60000);
    if (!rateLimit.allowed) {
      logger.warn('Rate limit exceeded', { userId: user.id });
      logResponse(429);
      return errorResponse('Rate limit exceeded. Please try again later.', 429);
    }

    // Parse body
    const body = await parseJsonBody<UsageCheckRequest>(req);
    if (!body) {
      logResponse(400);
      return badRequestResponse('Invalid JSON body');
    }

    const { org_id, estimated_tokens } = body;

    if (!org_id || estimated_tokens === undefined) {
      logResponse(400);
      return badRequestResponse('Missing required fields: org_id, estimated_tokens');
    }

    // Verify user is member of org
    const memberSpanId = tracer.startSpan('db.check_membership');
    const { data: member } = await supabase
      .from('members')
      .select('id')
      .eq('org_id', org_id)
      .eq('user_id', user.id)
      .single();
    tracer.endSpan(memberSpanId, member ? 'ok' : 'error');

    if (!member) {
      logger.warn('User not member of organization', { userId: user.id, orgId: org_id });
      logResponse(403);
      return forbiddenResponse('Not a member of organization');
    }

    // Get current usage
    const usageSpanId = tracer.startSpan('db.fetch_usage');
    const { data: usage } = await supabase
      .from('usage_credits')
      .select('*')
      .eq('org_id', org_id)
      .single();
    tracer.endSpan(usageSpanId, 'ok');

    if (!usage) {
      // Initialize usage record
      logger.info('Initializing usage record', { orgId: org_id });
      await supabase
        .from('usage_credits')
        .insert({
          org_id,
          plan: 'starter',
          used_tokens: 0,
          month_start: new Date(new Date().setDate(1)).toISOString(),
          hard_limit_tokens: 1000000,
        });

      logResponse(200);
      return successResponse({
        ok: true,
        used_tokens: 0,
        remaining_tokens: 1000000,
        limit: 1000000,
        plan: 'starter',
      });
    }

    const remaining = Math.max(0, usage.hard_limit_tokens - usage.used_tokens);
    const wouldExceed = (usage.used_tokens + estimated_tokens) > usage.hard_limit_tokens;

    metrics.gauge('usage.tokens_used', usage.used_tokens);
    metrics.gauge('usage.tokens_remaining', remaining);

    logger.info('Usage check completed', {
      orgId: org_id,
      usedTokens: usage.used_tokens,
      remaining,
      estimatedTokens: estimated_tokens,
      wouldExceed
    });
    logResponse(wouldExceed ? 402 : 200);

    return new Response(
      JSON.stringify({
        ok: !wouldExceed,
        used_tokens: usage.used_tokens,
        remaining_tokens: remaining,
        limit: usage.hard_limit_tokens,
        plan: usage.plan,
        estimated_tokens,
      }),
      {
        status: wouldExceed ? 402 : 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      }
    );

  } catch (error) {
    logger.error('Usage check error', error as Error);
    reportError(error as Error, { function: FUNCTION_NAME });
    metrics.counter(`${FUNCTION_NAME}.error`);
    logResponse(500);
    return errorResponse(
      error instanceof Error ? error.message : 'Unknown error',
      500
    );
  }
});
