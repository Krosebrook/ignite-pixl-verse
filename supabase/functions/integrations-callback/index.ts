import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Logger, Tracer, metrics, reportError, trackRequest } from '../_shared/observability.ts';
import {
  corsPreflightResponse,
  badRequestResponse,
  unauthorizedResponse,
  forbiddenResponse,
  errorResponse,
  rateLimitResponse,
  getAuthToken,
  getRequestId,
} from '../_shared/http.ts';
import { withRetry } from '../_shared/retry.ts';
import { checkDistributedRateLimit, RATE_LIMITS } from '../_shared/ratelimit-redis.ts';

const FUNCTION_NAME = 'integrations-callback';

async function verifyStateToken(stateToken: string, expectedUserId: string, logger: Logger): Promise<boolean> {
  try {
    const [userId, timestampStr, signature] = stateToken.split(':');

    if (userId !== expectedUserId) {
      logger.warn('State user_id mismatch', { expected: expectedUserId, received: userId });
      return false;
    }

    const timestamp = parseInt(timestampStr);
    const now = Date.now();
    if (now - timestamp > 10 * 60 * 1000) {
      logger.warn('State token expired', { tokenAge: now - timestamp });
      return false;
    }

    const secret = Deno.env.get('OAUTH_STATE_SECRET');
    if (!secret) {
      logger.warn('OAUTH_STATE_SECRET not configured - skipping signature verification');
      return true;
    }

    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );

    const data = encoder.encode(`${userId}:${timestampStr}`);
    const signatureBytes = new Uint8Array(
      signature.match(/.{2}/g)!.map(byte => parseInt(byte, 16))
    );

    return await crypto.subtle.verify('HMAC', key, signatureBytes, data);
  } catch (error) {
    logger.error('State token verification error', error as Error);
    return false;
  }
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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      logResponse(401);
      return unauthorizedResponse('Missing authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify JWT
    const authSpanId = tracer.startSpan('auth.verify');
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      tracer.endSpan(authSpanId, 'error');
      logger.warn('Authentication failed', { error: authError?.message });
      logResponse(403);
      return forbiddenResponse('Invalid authentication token');
    }
    tracer.endSpan(authSpanId, 'ok');

    // Rate limiting - OAuth callbacks should be rate limited to prevent abuse
    const rateLimitConfig = RATE_LIMITS.integrations_connect;
    const rateLimit = await checkDistributedRateLimit(
      user.id,
      'integrations_callback',
      rateLimitConfig.limit,
      rateLimitConfig.windowMs
    );

    if (!rateLimit.allowed) {
      logger.warn('Rate limit exceeded for OAuth callback', { userId: user.id });
      metrics.counter('rate_limit.exceeded', 1, { function: FUNCTION_NAME });
      logResponse(429);
      return rateLimitResponse(
        'Too many OAuth attempts. Please try again later.',
        Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
      );
    }

    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const provider = url.searchParams.get('provider');

    if (!code || !state || !provider) {
      logResponse(400);
      return badRequestResponse('Missing OAuth parameters: code, state, provider');
    }

    // Verify state token matches authenticated user
    const isValidState = await verifyStateToken(state, user.id, logger);
    if (!isValidState) {
      logger.warn('State verification failed', { userId: user.id, provider });

      // Log security event
      await supabase.from('audit_log').insert({
        user_id: user.id,
        action: 'oauth_state_mismatch',
        resource_type: 'integration',
        resource_id: provider,
        metadata: { provider, state_partial: state.substring(0, 8), request_id: requestId }
      });

      logResponse(403);
      return forbiddenResponse('Invalid state token - possible CSRF attack');
    }

    // Get user's org_id
    const { data: memberData, error: memberError } = await supabase
      .from('members')
      .select('org_id')
      .eq('user_id', user.id)
      .single();

    if (memberError || !memberData) {
      logger.warn('User not member of any organization', { userId: user.id });
      logResponse(400);
      return badRequestResponse('User must belong to an organization');
    }

    const org_id = memberData.org_id;
    const baseUrl = Deno.env.get('SUPABASE_URL')!;
    const callbackUrl = `${baseUrl}/functions/v1/integrations-callback`;

    // Exchange code for tokens (provider-specific)
    const exchangeSpanId = tracer.startSpan('oauth.exchange', { provider });
    let accessToken: string;
    let refreshToken: string | null = null;
    let expiresAt: string | null = null;
    let scope: string | null = null;

    try {
      switch (provider) {
        case 'instagram': {
          const instagramAppId = Deno.env.get('INSTAGRAM_APP_ID');
          const instagramAppSecret = Deno.env.get('INSTAGRAM_APP_SECRET');

          const fbData = await withRetry(async () => {
            const fbResponse = await fetch('https://graph.facebook.com/v18.0/oauth/access_token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                client_id: instagramAppId!,
                client_secret: instagramAppSecret!,
                redirect_uri: `${callbackUrl}?provider=instagram`,
                code,
              }),
            });
            if (!fbResponse.ok) throw new Error(`Facebook API error: ${fbResponse.status}`);
            return fbResponse.json();
          }, { maxRetries: 2, baseDelayMs: 1000 });

          if (fbData.error) throw new Error(fbData.error.message);

          // Exchange for long-lived token
          const longLivedData = await withRetry(async () => {
            const response = await fetch(
              `https://graph.facebook.com/v18.0/oauth/access_token?` +
              `grant_type=fb_exchange_token&client_id=${instagramAppId}&` +
              `client_secret=${instagramAppSecret}&fb_exchange_token=${fbData.access_token}`
            );
            return response.json();
          }, { maxRetries: 2, baseDelayMs: 1000 });

          accessToken = longLivedData.access_token || fbData.access_token;
          expiresAt = longLivedData.expires_in
            ? new Date(Date.now() + longLivedData.expires_in * 1000).toISOString()
            : null;
          scope = 'instagram_basic,instagram_content_publish';
          break;
        }

        case 'twitter': {
          const twitterClientId = Deno.env.get('TWITTER_CLIENT_ID');
          const twitterClientSecret = Deno.env.get('TWITTER_CLIENT_SECRET');

          const twitterData = await withRetry(async () => {
            const response = await fetch('https://api.twitter.com/2/oauth2/token', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${btoa(`${twitterClientId}:${twitterClientSecret}`)}`,
              },
              body: new URLSearchParams({
                code,
                grant_type: 'authorization_code',
                redirect_uri: `${callbackUrl}?provider=twitter`,
                code_verifier: 'challenge',
              }),
            });
            if (!response.ok) throw new Error(`Twitter API error: ${response.status}`);
            return response.json();
          }, { maxRetries: 2, baseDelayMs: 1000 });

          if (twitterData.error) throw new Error(twitterData.error_description || twitterData.error);

          accessToken = twitterData.access_token;
          refreshToken = twitterData.refresh_token;
          expiresAt = twitterData.expires_in
            ? new Date(Date.now() + twitterData.expires_in * 1000).toISOString()
            : null;
          scope = twitterData.scope;
          break;
        }

        case 'linkedin': {
          const linkedinClientId = Deno.env.get('LINKEDIN_CLIENT_ID');
          const linkedinClientSecret = Deno.env.get('LINKEDIN_CLIENT_SECRET');

          const linkedinData = await withRetry(async () => {
            const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: `${callbackUrl}?provider=linkedin`,
                client_id: linkedinClientId!,
                client_secret: linkedinClientSecret!,
              }),
            });
            if (!response.ok) throw new Error(`LinkedIn API error: ${response.status}`);
            return response.json();
          }, { maxRetries: 2, baseDelayMs: 1000 });

          if (linkedinData.error) throw new Error(linkedinData.error_description || linkedinData.error);

          accessToken = linkedinData.access_token;
          refreshToken = linkedinData.refresh_token;
          expiresAt = linkedinData.expires_in
            ? new Date(Date.now() + linkedinData.expires_in * 1000).toISOString()
            : null;
          scope = 'r_liteprofile,w_member_social';
          break;
        }

        case 'google_drive': {
          const googleClientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
          const googleClientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET');

          const googleData = await withRetry(async () => {
            const response = await fetch('https://oauth2.googleapis.com/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                code,
                client_id: googleClientId!,
                client_secret: googleClientSecret!,
                redirect_uri: `${callbackUrl}?provider=google_drive`,
                grant_type: 'authorization_code',
              }),
            });
            if (!response.ok) throw new Error(`Google API error: ${response.status}`);
            return response.json();
          }, { maxRetries: 2, baseDelayMs: 1000 });

          accessToken = googleData.access_token;
          refreshToken = googleData.refresh_token;
          expiresAt = new Date(Date.now() + googleData.expires_in * 1000).toISOString();
          scope = googleData.scope;
          break;
        }

        case 'shopify': {
          const shopifyClientId = Deno.env.get('SHOPIFY_CLIENT_ID');
          const shopifyClientSecret = Deno.env.get('SHOPIFY_CLIENT_SECRET');
          const shopName = url.searchParams.get('shop');

          const shopifyData = await withRetry(async () => {
            const response = await fetch(`https://${shopName}/admin/oauth/access_token`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                client_id: shopifyClientId,
                client_secret: shopifyClientSecret,
                code,
              }),
            });
            if (!response.ok) throw new Error(`Shopify API error: ${response.status}`);
            return response.json();
          }, { maxRetries: 2, baseDelayMs: 1000 });

          accessToken = shopifyData.access_token;
          scope = shopifyData.scope;
          break;
        }

        case 'notion': {
          const notionClientId = Deno.env.get('NOTION_CLIENT_ID');
          const notionClientSecret = Deno.env.get('NOTION_CLIENT_SECRET');

          const notionData = await withRetry(async () => {
            const response = await fetch('https://api.notion.com/v1/oauth/token', {
              method: 'POST',
              headers: {
                'Authorization': `Basic ${btoa(`${notionClientId}:${notionClientSecret}`)}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                grant_type: 'authorization_code',
                code,
                redirect_uri: `${callbackUrl}?provider=notion`,
              }),
            });
            if (!response.ok) throw new Error(`Notion API error: ${response.status}`);
            return response.json();
          }, { maxRetries: 2, baseDelayMs: 1000 });

          accessToken = notionData.access_token;
          break;
        }

        default:
          logResponse(400);
          return badRequestResponse(`Unsupported provider: ${provider}`);
      }

      tracer.endSpan(exchangeSpanId, 'ok');
    } catch (error) {
      tracer.endSpan(exchangeSpanId, 'error', error as Error);
      throw error;
    }

    // Store encrypted tokens
    const writeSpanId = tracer.startSpan('token.write');
    const writeTokenResponse = await fetch(
      `${baseUrl}/functions/v1/integrations-write-token`,
      {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          org_id,
          provider,
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: expiresAt,
          scope,
          metadata: { connected_at: new Date().toISOString(), request_id: requestId }
        })
      }
    );

    if (!writeTokenResponse.ok) {
      tracer.endSpan(writeSpanId, 'error');
      const errorData = await writeTokenResponse.json();
      logger.error('Failed to write tokens', errorData);
      throw new Error('Token storage failed');
    }
    tracer.endSpan(writeSpanId, 'ok');

    metrics.counter(`${FUNCTION_NAME}.success`, 1, { provider });
    logger.info('OAuth callback completed', { provider, orgId: org_id });

    // Redirect back to app with success
    const redirectUrl = new URL('/integrations', Deno.env.get('SITE_URL') ?? 'http://localhost:5173');
    redirectUrl.searchParams.set('success', 'true');
    redirectUrl.searchParams.set('provider', provider);

    return Response.redirect(redirectUrl.toString(), 302);

  } catch (error) {
    logger.error('OAuth callback error', error as Error);
    reportError(error as Error, { function: FUNCTION_NAME });
    metrics.counter(`${FUNCTION_NAME}.error`);

    const redirectUrl = new URL('/integrations', Deno.env.get('SITE_URL') ?? 'http://localhost:5173');
    redirectUrl.searchParams.set('error', 'oauth_failed');

    return Response.redirect(redirectUrl.toString(), 302);
  }
});
