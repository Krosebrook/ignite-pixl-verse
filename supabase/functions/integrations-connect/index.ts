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

const FUNCTION_NAME = 'integrations-connect';

type Provider = 'instagram' | 'twitter' | 'linkedin' | 'shopify' | 'notion' | 'google_drive' | 'zapier';

interface ConnectRequest {
  provider: Provider;
  redirectUri?: string;
}

async function generateStateToken(userId: string): Promise<string> {
  const timestamp = Date.now();
  const stateData = `${userId}:${timestamp}`;
  const oauthSecret = Deno.env.get('OAUTH_STATE_SECRET');

  if (!oauthSecret) {
    return stateData;
  }

  const encoder = new TextEncoder();
  const keyData = encoder.encode(oauthSecret);
  const key = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(stateData));
  const signatureHex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return `${stateData}:${signatureHex}`;
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

    // Rate limiting - 20 connect requests per hour
    const rateLimit = await checkRateLimit(user.id, 'integrations_connect', 20, 3600000);
    if (!rateLimit.allowed) {
      logger.warn('Rate limit exceeded', { userId: user.id });
      logResponse(429);
      return errorResponse('Rate limit exceeded. Please try again later.', 429);
    }

    // Parse body
    const body = await parseJsonBody<ConnectRequest>(req);
    if (!body) {
      logResponse(400);
      return badRequestResponse('Invalid JSON body');
    }

    const { provider } = body;

    if (!provider) {
      logResponse(400);
      return badRequestResponse('Missing required field: provider');
    }

    const validProviders: Provider[] = ['instagram', 'twitter', 'linkedin', 'shopify', 'notion', 'google_drive', 'zapier'];
    if (!validProviders.includes(provider)) {
      logResponse(400);
      return badRequestResponse(`Invalid provider. Must be one of: ${validProviders.join(', ')}`);
    }

    // Generate CSRF-protected state token
    const stateToken = await generateStateToken(user.id);

    // Generate OAuth URLs based on provider
    const baseUrl = Deno.env.get('SUPABASE_URL')!;
    const callbackUrl = `${baseUrl}/functions/v1/integrations-callback`;

    let authUrl = '';

    const urlSpanId = tracer.startSpan('oauth.generate_url', { provider });

    switch (provider) {
      case 'instagram': {
        const instagramAppId = Deno.env.get('INSTAGRAM_APP_ID');
        authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
          `client_id=${instagramAppId}&` +
          `redirect_uri=${encodeURIComponent(callbackUrl + '?provider=instagram')}&` +
          `scope=instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement&` +
          `state=${encodeURIComponent(stateToken)}`;
        break;
      }

      case 'twitter': {
        const twitterClientId = Deno.env.get('TWITTER_CLIENT_ID');
        authUrl = `https://twitter.com/i/oauth2/authorize?` +
          `response_type=code&client_id=${twitterClientId}&` +
          `redirect_uri=${encodeURIComponent(callbackUrl + '?provider=twitter')}&` +
          `scope=tweet.read%20tweet.write%20users.read%20offline.access&` +
          `state=${encodeURIComponent(stateToken)}&` +
          `code_challenge=challenge&code_challenge_method=plain`;
        break;
      }

      case 'linkedin': {
        const linkedinClientId = Deno.env.get('LINKEDIN_CLIENT_ID');
        authUrl = `https://www.linkedin.com/oauth/v2/authorization?` +
          `response_type=code&client_id=${linkedinClientId}&` +
          `redirect_uri=${encodeURIComponent(callbackUrl + '?provider=linkedin')}&` +
          `scope=r_liteprofile%20w_member_social&` +
          `state=${encodeURIComponent(stateToken)}`;
        break;
      }

      case 'shopify': {
        const shopifyClientId = Deno.env.get('SHOPIFY_CLIENT_ID');
        const shopName = 'example-shop'; // Would be provided by user
        authUrl = `https://${shopName}.myshopify.com/admin/oauth/authorize?` +
          `client_id=${shopifyClientId}&` +
          `scope=read_products,write_products,read_orders&` +
          `redirect_uri=${encodeURIComponent(callbackUrl + '?provider=shopify')}&` +
          `state=${encodeURIComponent(stateToken)}`;
        break;
      }

      case 'notion': {
        const notionClientId = Deno.env.get('NOTION_CLIENT_ID');
        authUrl = `https://api.notion.com/v1/oauth/authorize?` +
          `client_id=${notionClientId}&response_type=code&owner=user&` +
          `redirect_uri=${encodeURIComponent(callbackUrl + '?provider=notion')}&` +
          `state=${encodeURIComponent(stateToken)}`;
        break;
      }

      case 'google_drive': {
        const googleClientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
        authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
          `client_id=${googleClientId}&response_type=code&` +
          `scope=https://www.googleapis.com/auth/drive.file&` +
          `redirect_uri=${encodeURIComponent(callbackUrl + '?provider=google_drive')}&` +
          `state=${encodeURIComponent(stateToken)}&` +
          `access_type=offline&prompt=consent`;
        break;
      }

      case 'zapier':
        authUrl = 'https://zapier.com/app/dashboard';
        break;
    }

    tracer.endSpan(urlSpanId, 'ok');

    metrics.counter(`${FUNCTION_NAME}.success`, 1, { provider });
    logger.info('OAuth URL generated', { provider });
    logResponse(200);

    return successResponse({ authUrl, provider });

  } catch (error) {
    logger.error('Connect error', error as Error);
    reportError(error as Error, { function: FUNCTION_NAME });
    metrics.counter(`${FUNCTION_NAME}.error`);
    logResponse(500);
    return errorResponse(
      error instanceof Error ? error.message : 'Unknown error',
      500
    );
  }
});
