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

const FUNCTION_NAME = 'gdpr-delete';

interface GDPRDeleteRequest {
  user_id: string;
  org_id: string;
  delete_assets?: boolean;
  delete_analytics?: boolean;
  confirmation_code: string;
}

async function generateConfirmationCode(userId: string): Promise<string> {
  const expectedCode = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${userId}${new Date().toISOString().split('T')[0]}`)
  );
  return Array.from(new Uint8Array(expectedCode))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
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

    // Rate limiting - 5 delete requests per hour (very restrictive for safety)
    const rateLimit = await checkRateLimit(user.id, 'gdpr_delete', 5, 3600000);
    if (!rateLimit.allowed) {
      logger.warn('Rate limit exceeded', { userId: user.id });
      logResponse(429);
      return errorResponse('Rate limit exceeded. Please try again later.', 429);
    }

    // Parse body
    const body = await parseJsonBody<GDPRDeleteRequest>(req);
    if (!body) {
      logResponse(400);
      return badRequestResponse('Invalid JSON body');
    }

    const {
      user_id,
      org_id,
      delete_assets = true,
      delete_analytics = true,
      confirmation_code,
    } = body;

    // Validate required fields
    if (!user_id || !org_id || !confirmation_code) {
      logResponse(400);
      return badRequestResponse('Missing required fields: user_id, org_id, confirmation_code');
    }

    // Security check: user can only delete their own data
    if (user_id !== user.id) {
      logger.warn('Attempted to delete another user data', { requesterId: user.id, targetId: user_id });
      logResponse(403);
      return forbiddenResponse('Can only delete own data');
    }

    // Verify confirmation code
    const expectedCode = await generateConfirmationCode(user_id);
    if (confirmation_code.toLowerCase() !== expectedCode) {
      logger.warn('Invalid confirmation code', { userId: user.id });
      logResponse(400);
      return badRequestResponse('Invalid confirmation code');
    }

    // Verify user belongs to org
    const memberSpanId = tracer.startSpan('db.check_membership');
    const { data: member } = await supabase
      .from('members')
      .select('id, role')
      .eq('org_id', org_id)
      .eq('user_id', user_id)
      .single();
    tracer.endSpan(memberSpanId, member ? 'ok' : 'error');

    if (!member) {
      logger.warn('User not member of organization', { userId: user.id, orgId: org_id });
      logResponse(403);
      return forbiddenResponse('User not member of organization');
    }

    // Log deletion request BEFORE deleting
    await supabase.from('audit_log').insert({
      org_id,
      user_id,
      action: 'gdpr_delete_requested',
      resource_type: 'user_data',
      resource_id: user_id,
      metadata: { delete_assets, delete_analytics, request_id: requestId },
    });

    const deletedResources: Record<string, number> = {};
    const deleteSpanId = tracer.startSpan('db.delete_user_data');

    // Delete user-specific data (org-scoped)
    if (delete_assets) {
      const { count: assetsCount } = await supabase
        .from('assets')
        .delete({ count: 'exact' })
        .eq('org_id', org_id)
        .eq('user_id', user_id);
      deletedResources.assets = assetsCount || 0;
    }

    // Delete campaigns
    const { count: campaignsCount } = await supabase
      .from('campaigns')
      .delete({ count: 'exact' })
      .eq('org_id', org_id)
      .eq('user_id', user_id);
    deletedResources.campaigns = campaignsCount || 0;

    // Delete schedules
    const { count: schedulesCount } = await supabase
      .from('schedules')
      .delete({ count: 'exact' })
      .eq('org_id', org_id);
    deletedResources.schedules = schedulesCount || 0;

    // Delete analytics events
    if (delete_analytics) {
      const { count: analyticsCount } = await supabase
        .from('analytics_events')
        .delete({ count: 'exact' })
        .eq('org_id', org_id)
        .eq('user_id', user_id);
      deletedResources.analytics_events = analyticsCount || 0;
    }

    // Delete profile
    const { count: profileCount } = await supabase
      .from('profiles')
      .delete({ count: 'exact' })
      .eq('id', user_id);
    deletedResources.profile = profileCount || 0;

    tracer.endSpan(deleteSpanId, 'ok');

    // Log completion
    await supabase.from('audit_log').insert({
      org_id,
      user_id,
      action: 'gdpr_delete_completed',
      resource_type: 'user_data',
      resource_id: user_id,
      metadata: { deleted_resources: deletedResources, request_id: requestId },
    });

    metrics.counter(`${FUNCTION_NAME}.success`);
    logger.info('GDPR delete completed', { userId: user.id, deletedResources });
    logResponse(200);

    return successResponse({
      success: true,
      message: 'User data deleted successfully',
      deleted_resources: deletedResources,
    });

  } catch (error) {
    logger.error('GDPR delete error', error as Error);
    reportError(error as Error, { function: FUNCTION_NAME });
    metrics.counter(`${FUNCTION_NAME}.error`);
    logResponse(500);
    return errorResponse(
      error instanceof Error ? error.message : 'Unknown error',
      500
    );
  }
});
