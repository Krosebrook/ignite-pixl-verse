import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Logger, trackRequest, metrics } from '../_shared/observability.ts';
import { corsPreflightResponse, successResponse, errorResponse, getAuthToken, rateLimitResponse } from '../_shared/http.ts';
import { checkRateLimit } from '../_shared/ratelimit.ts';

const FUNCTION_NAME = 'events-ingest';

interface AnalyticsEvent {
  org_id: string;
  user_id: string;
  event_type: string;
  event_category: string;
  duration_ms?: number;
  metadata?: Record<string, unknown>;
}

interface BatchEventsRequest {
  events: AnalyticsEvent[];
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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    // Verify user
    const { data: authData, error: authError } = await supabase.auth.getUser(authToken);

    if (authError || !authData.user) {
      logger.warn('Authentication failed', { error: authError?.message });
      logResponse(401);
      return errorResponse('Unauthorized', 401, requestId);
    }

    const user = authData.user;

    // Rate limit events ingestion
    const rateLimit = await checkRateLimit(user.id, 'events_ingest', 100, 60000); // 100 per minute
    if (!rateLimit.allowed) {
      logResponse(429);
      return rateLimitResponse(rateLimit.resetAt, requestId);
    }

    const body = await req.json();

    // Handle batch events
    if (req.method === 'POST' && body.events && Array.isArray(body.events)) {
      const { events } = body as BatchEventsRequest;

      logger.info('Processing batch events', { count: events.length, userId: user.id });

      // Validate events
      const validEvents = events.filter(event => {
        const isValid = event.org_id && event.user_id && event.event_type && event.event_category;
        if (!isValid) {
          logger.warn('Invalid event skipped', { event });
        }
        return isValid;
      });

      if (validEvents.length === 0) {
        logResponse(400);
        return errorResponse('No valid events to process', 400, requestId);
      }

      // Verify user has access to all orgs
      const orgIds = [...new Set(validEvents.map(e => e.org_id))];
      const { data: memberCheck, error: memberError } = await supabase
        .from('members')
        .select('org_id')
        .eq('user_id', user.id)
        .in('org_id', orgIds);

      if (memberError || !memberCheck || memberCheck.length !== orgIds.length) {
        logger.warn('User not member of all orgs', { userId: user.id, orgIds });
        logResponse(403);
        return errorResponse('Unauthorized for one or more organizations', 403, requestId);
      }

      // Batch insert events
      const { error } = await supabase
        .from('analytics_events')
        .insert(validEvents.map(event => ({
          org_id: event.org_id,
          user_id: event.user_id,
          event_type: event.event_type,
          event_category: event.event_category,
          duration_ms: event.duration_ms || null,
          metadata: event.metadata || {},
        })));

      if (error) {
        logger.error('Insert error', error);
        logResponse(500);
        return errorResponse('Failed to insert events', 500, requestId, {
          details: error.message
        });
      }

      metrics.counter(`${FUNCTION_NAME}.events_inserted`, validEvents.length);
      logger.info('Batch events inserted', { inserted: validEvents.length, skipped: events.length - validEvents.length });
      logResponse(200);

      return successResponse({
        success: true,
        inserted: validEvents.length,
        skipped: events.length - validEvents.length
      }, requestId);
    }

    // Handle single event
    if (req.method === 'POST') {
      const event = body as AnalyticsEvent;

      if (!event.org_id || !event.user_id || !event.event_type || !event.event_category) {
        logResponse(400);
        return errorResponse('Missing required fields: org_id, user_id, event_type, event_category', 400, requestId);
      }

      // Verify user has access to org
      const { data: memberCheck, error: memberError } = await supabase
        .from('members')
        .select('org_id')
        .eq('user_id', user.id)
        .eq('org_id', event.org_id)
        .single();

      if (memberError || !memberCheck) {
        logger.warn('User not member of org', { userId: user.id, orgId: event.org_id });
        logResponse(403);
        return errorResponse('Unauthorized for organization', 403, requestId);
      }

      const { error } = await supabase
        .from('analytics_events')
        .insert({
          org_id: event.org_id,
          user_id: event.user_id,
          event_type: event.event_type,
          event_category: event.event_category,
          duration_ms: event.duration_ms || null,
          metadata: event.metadata || {},
        });

      if (error) {
        logger.error('Insert error', error);
        logResponse(500);
        return errorResponse('Failed to insert event', 500, requestId, {
          details: error.message
        });
      }

      metrics.counter(`${FUNCTION_NAME}.events_inserted`);
      logger.info('Single event inserted', { eventType: event.event_type });
      logResponse(200);

      return successResponse({ success: true }, requestId);
    }

    logResponse(405);
    return errorResponse('Method not allowed', 405, requestId);

  } catch (error) {
    logger.error('Unexpected error', error as Error);
    metrics.counter(`${FUNCTION_NAME}.error`);
    logResponse(500);
    return errorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500,
      requestId
    );
  }
});
