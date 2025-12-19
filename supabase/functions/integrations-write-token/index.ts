import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Logger, Tracer, metrics, reportError, trackRequest } from '../_shared/observability.ts';
import {
  corsPreflightResponse,
  successResponse,
  badRequestResponse,
  unauthorizedResponse,
  errorResponse,
  getAuthToken,
  getRequestId,
  parseJsonBody,
} from '../_shared/http.ts';
import { checkRateLimit } from '../_shared/ratelimit.ts';

const FUNCTION_NAME = 'integrations-write-token';

interface TokenWriteRequest {
  org_id: string;
  provider: string;
  access_token: string;
  refresh_token?: string;
  expires_at?: string;
  scope?: string;
  metadata?: Record<string, unknown>;
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    // Rate limiting - 20 token writes per hour
    const rateLimit = await checkRateLimit(user.id, 'token_write', 20, 3600000);
    if (!rateLimit.allowed) {
      logger.warn('Rate limit exceeded', { userId: user.id });
      logResponse(429);
      return errorResponse('Rate limit exceeded. Please try again later.', 429);
    }

    // Parse body
    const body = await parseJsonBody<TokenWriteRequest>(req);
    if (!body) {
      logResponse(400);
      return badRequestResponse('Invalid JSON body');
    }

    const { org_id, provider, access_token, refresh_token, expires_at, scope, metadata } = body;

    if (!org_id || !provider || !access_token) {
      logResponse(400);
      return badRequestResponse('Missing required fields: org_id, provider, access_token');
    }

    // Get encryption key
    const KEYRING_TOKEN = Deno.env.get('KEYRING_TOKEN');
    if (!KEYRING_TOKEN) {
      logger.error('KEYRING_TOKEN not configured');
      logResponse(500);
      return errorResponse('Server configuration error', 500);
    }

    // Use encryption RPC (verifies membership internally)
    const encryptSpanId = tracer.startSpan('db.encrypt_token');
    const { data: integrationId, error: rpcError } = await supabase.rpc(
      'write_encrypted_integration',
      {
        p_org_id: org_id,
        p_provider: provider,
        p_access_token: access_token,
        p_refresh_token: refresh_token || null,
        p_expires_at: expires_at || null,
        p_scope: scope || null,
        p_metadata: metadata || {},
        p_encryption_key: KEYRING_TOKEN
      }
    );

    if (rpcError) {
      tracer.endSpan(encryptSpanId, 'error', rpcError);
      logger.error('Encryption RPC failed', rpcError);
      logResponse(400);
      return badRequestResponse('Failed to store integration', undefined, {
        cause: rpcError.message,
        fix: 'Verify organization membership and try again',
        retry: true
      });
    }
    tracer.endSpan(encryptSpanId, 'ok');

    metrics.counter(`${FUNCTION_NAME}.success`, 1, { provider });
    logger.info('Token encrypted and stored', {
      provider,
      orgId: org_id.substring(0, 8) + '...',
      integrationId
    });
    logResponse(200);

    return successResponse({
      success: true,
      integration_id: integrationId,
      message: 'Integration tokens securely stored'
    });

  } catch (error) {
    logger.error('Token write error', error as Error);
    reportError(error as Error, { function: FUNCTION_NAME });
    metrics.counter(`${FUNCTION_NAME}.error`);
    logResponse(500);
    return errorResponse('Internal server error', 500);
  }
});
