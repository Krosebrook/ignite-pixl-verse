import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Logger, Tracer, metrics, reportError, trackRequest } from '../_shared/observability.ts';
import {
  corsPreflightResponse,
  badRequestResponse,
  unauthorizedResponse,
  forbiddenResponse,
  errorResponse,
  getAuthToken,
  getRequestId,
  parseJsonBody,
  defaultHeaders,
} from '../_shared/http.ts';
import { checkRateLimit } from '../_shared/ratelimit.ts';

const FUNCTION_NAME = 'gdpr-export';

interface GDPRExportRequest {
  user_id: string;
  org_id: string;
  include_analytics?: boolean;
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

    // Rate limiting - 10 exports per hour
    const rateLimit = await checkRateLimit(user.id, 'gdpr_export', 10, 3600000);
    if (!rateLimit.allowed) {
      logger.warn('Rate limit exceeded', { userId: user.id });
      logResponse(429);
      return errorResponse('Rate limit exceeded. Please try again later.', 429);
    }

    // Parse body
    const body = await parseJsonBody<GDPRExportRequest>(req);
    if (!body) {
      logResponse(400);
      return badRequestResponse('Invalid JSON body');
    }

    const { user_id, org_id, include_analytics = true } = body;

    // Validate required fields
    if (!user_id || !org_id) {
      logResponse(400);
      return badRequestResponse('Missing required fields: user_id, org_id');
    }

    // Security check: user can only export their own data
    if (user_id !== user.id) {
      logger.warn('Attempted to export another user data', { requesterId: user.id, targetId: user_id });
      logResponse(403);
      return forbiddenResponse('Can only export own data');
    }

    // Verify user belongs to org
    const memberSpanId = tracer.startSpan('db.check_membership');
    const { data: member } = await supabase
      .from('members')
      .select('id')
      .eq('org_id', org_id)
      .eq('user_id', user_id)
      .single();
    tracer.endSpan(memberSpanId, member ? 'ok' : 'error');

    if (!member) {
      logger.warn('User not member of organization', { userId: user.id, orgId: org_id });
      logResponse(403);
      return forbiddenResponse('User not member of organization');
    }

    // Collect all user data
    const exportSpanId = tracer.startSpan('db.collect_export_data');
    const exportData: Record<string, unknown> = {
      export_date: new Date().toISOString(),
      user_id,
      org_id,
      request_id: requestId,
    };

    // User profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user_id)
      .single();
    exportData.profile = profile;

    // User's assets
    const { data: assets } = await supabase
      .from('assets')
      .select('*')
      .eq('org_id', org_id)
      .eq('user_id', user_id);
    exportData.assets = assets;

    // User's campaigns
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('*')
      .eq('org_id', org_id)
      .eq('user_id', user_id);
    exportData.campaigns = campaigns;

    // User's scheduled posts
    const { data: schedules } = await supabase
      .from('schedules')
      .select('*')
      .eq('org_id', org_id);
    exportData.schedules = schedules;

    // User's brand kits
    const { data: brandKits } = await supabase
      .from('brand_kits')
      .select('*')
      .eq('org_id', org_id);
    exportData.brand_kits = brandKits;

    // Analytics events (if requested)
    if (include_analytics) {
      const { data: analytics } = await supabase
        .from('analytics_events')
        .select('*')
        .eq('org_id', org_id)
        .eq('user_id', user_id)
        .order('created_at', { ascending: false })
        .limit(10000); // Cap at 10k events
      exportData.analytics_events = analytics;
    }

    tracer.endSpan(exportSpanId, 'ok');

    // Log export request
    await supabase.from('audit_log').insert({
      org_id,
      user_id,
      action: 'gdpr_export',
      resource_type: 'user_data',
      resource_id: user_id,
      metadata: { include_analytics, request_id: requestId },
    });

    metrics.counter(`${FUNCTION_NAME}.success`);
    logger.info('GDPR export completed', { userId: user.id, includeAnalytics: include_analytics });
    logResponse(200);

    return new Response(JSON.stringify(exportData), {
      status: 200,
      headers: {
        ...defaultHeaders,
        'Content-Disposition': `attachment; filename="gdpr-export-${user_id}-${Date.now()}.json"`,
      },
    });

  } catch (error) {
    logger.error('GDPR export error', error as Error);
    reportError(error as Error, { function: FUNCTION_NAME });
    metrics.counter(`${FUNCTION_NAME}.error`);
    logResponse(500);
    return errorResponse(
      error instanceof Error ? error.message : 'Unknown error',
      500
    );
  }
});
