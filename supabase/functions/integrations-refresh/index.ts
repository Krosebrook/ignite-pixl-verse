import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Logger, Tracer, metrics, reportError, trackRequest } from '../_shared/observability.ts';
import {
  corsPreflightResponse,
  successResponse,
  errorResponse,
  getRequestId,
} from '../_shared/http.ts';
import { checkDistributedRateLimit, getRateLimitHeaders } from '../_shared/ratelimit-redis.ts';

const FUNCTION_NAME = 'integrations-refresh';

interface RefreshResult {
  provider: string;
  success: boolean;
  error?: string;
  new_expires_at?: string;
}

// Token refresh configurations per provider
const PROVIDER_CONFIGS: Record<string, {
  tokenUrl: string | null;
  clientIdEnv: string | null;
  clientSecretEnv: string | null;
}> = {
  google_drive: {
    tokenUrl: 'https://oauth2.googleapis.com/token',
    clientIdEnv: 'GOOGLE_OAUTH_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_OAUTH_CLIENT_SECRET',
  },
  instagram: {
    tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
    clientIdEnv: 'INSTAGRAM_APP_ID',
    clientSecretEnv: 'INSTAGRAM_APP_SECRET',
  },
  twitter: {
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    clientIdEnv: 'TWITTER_CLIENT_ID',
    clientSecretEnv: 'TWITTER_CLIENT_SECRET',
  },
  linkedin: {
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    clientIdEnv: 'LINKEDIN_CLIENT_ID',
    clientSecretEnv: 'LINKEDIN_CLIENT_SECRET',
  },
  shopify: {
    tokenUrl: null, // Shopify tokens don't expire
    clientIdEnv: null,
    clientSecretEnv: null,
  },
  notion: {
    tokenUrl: null, // Notion tokens don't expire
    clientIdEnv: null,
    clientSecretEnv: null,
  },
  zapier: {
    tokenUrl: null, // Zapier doesn't use OAuth refresh
    clientIdEnv: null,
    clientSecretEnv: null,
  },
};

interface Integration {
  id: string;
  org_id: string;
  provider: string;
  refresh_token_encrypted: string | null;
  expires_at: string | null;
}

async function refreshProviderToken(
  provider: string,
  refreshToken: string,
  // deno-lint-ignore no-explicit-any
  supabase: SupabaseClient<any>,
  integration: Integration,
  logger: Logger
): Promise<RefreshResult> {
  const config = PROVIDER_CONFIGS[provider];
  
  if (!config || !config.tokenUrl) {
    return { provider, success: true }; // Token doesn't need refresh
  }
  
  const clientId = Deno.env.get(config.clientIdEnv!);
  const clientSecret = Deno.env.get(config.clientSecretEnv!);
  
  if (!clientId || !clientSecret) {
    logger.warn(`Missing OAuth credentials for ${provider}`);
    return { 
      provider, 
      success: false, 
      error: 'Missing OAuth credentials' 
    };
  }
  
  try {
    let response: Response;
    
    if (provider === 'twitter') {
      // Twitter uses Basic Auth for token refresh
      const credentials = btoa(`${clientId}:${clientSecret}`);
      response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      });
    } else if (provider === 'instagram') {
      // Instagram/Facebook long-lived token exchange
      response = await fetch(`${config.tokenUrl}?` + new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: clientId,
        client_secret: clientSecret,
        fb_exchange_token: refreshToken,
      }));
    } else {
      // Standard OAuth2 refresh
      response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Token refresh failed for ${provider}`, { 
        status: response.status, 
        error: errorText 
      });
      return { 
        provider, 
        success: false, 
        error: `HTTP ${response.status}: ${errorText}` 
      };
    }
    
    const tokenData = await response.json();
    
    // Calculate new expiration
    const expiresIn = tokenData.expires_in || 3600;
    const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    
    // Get encryption key
    const KEYRING_TOKEN = Deno.env.get('KEYRING_TOKEN');
    if (!KEYRING_TOKEN) {
      throw new Error('KEYRING_TOKEN not configured');
    }
    
    // Update token in database using RPC
    const { error: updateError } = await supabase.rpc(
      'write_encrypted_integration',
      {
        p_org_id: integration.org_id,
        p_provider: provider,
        p_access_token: tokenData.access_token,
        p_refresh_token: tokenData.refresh_token || refreshToken,
        p_expires_at: newExpiresAt,
        p_encryption_key: KEYRING_TOKEN,
      }
    );
    
    if (updateError) {
      throw updateError;
    }
    
    logger.info(`Token refreshed for ${provider}`, { 
      integrationId: integration.id.substring(0, 8) + '...',
      newExpiresAt 
    });
    
    return { 
      provider, 
      success: true, 
      new_expires_at: newExpiresAt 
    };
    
  } catch (error) {
    logger.error(`Token refresh error for ${provider}`, error as Error);
    return { 
      provider, 
      success: false, 
      error: (error as Error).message 
    };
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Rate limiting - 10 refresh operations per minute
    const rateLimit = await checkDistributedRateLimit('system', 'token_refresh', 10, 60000);
    const rateLimitHeaders = getRateLimitHeaders(rateLimit);
    
    if (!rateLimit.allowed) {
      logger.warn('Rate limit exceeded for token refresh');
      logResponse(429);
      return errorResponse('Rate limit exceeded. Please try again later.', 429, undefined, rateLimitHeaders);
    }

    // Find integrations expiring within 24 hours
    const expirationThreshold = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    
    const querySpanId = tracer.startSpan('db.query_expiring');
    const { data: expiringIntegrations, error: queryError } = await supabase
      .from('integrations')
      .select('id, org_id, provider, refresh_token_encrypted, expires_at')
      .lt('expires_at', expirationThreshold)
      .eq('status', 'connected')
      .not('refresh_token_encrypted', 'is', null);

    if (queryError) {
      tracer.endSpan(querySpanId, 'error', queryError);
      throw queryError;
    }
    tracer.endSpan(querySpanId, 'ok');

    if (!expiringIntegrations || expiringIntegrations.length === 0) {
      logger.info('No integrations need refresh');
      logResponse(200);
      return successResponse({ 
        message: 'No integrations need refresh',
        refreshed: 0 
      }, rateLimitHeaders);
    }

    logger.info(`Found ${expiringIntegrations.length} integrations to refresh`);

    // Get encryption key for decryption
    const KEYRING_TOKEN = Deno.env.get('KEYRING_TOKEN');
    if (!KEYRING_TOKEN) {
      logger.error('KEYRING_TOKEN not configured');
      logResponse(500);
      return errorResponse('Server configuration error', 500);
    }

    const results: RefreshResult[] = [];

    for (const integration of expiringIntegrations as Integration[]) {
      // Decrypt refresh token
      const { data: decryptedToken, error: decryptError } = await supabase.rpc(
        'decrypt_integration_token',
        {
          p_integration_id: integration.id,
          p_token_type: 'refresh',
          p_encryption_key: KEYRING_TOKEN,
        }
      );

      if (decryptError || !decryptedToken) {
        logger.warn(`Could not decrypt refresh token for ${integration.provider}`, { 
          error: decryptError?.message 
        });
        results.push({ 
          provider: integration.provider, 
          success: false, 
          error: 'Decryption failed' 
        });
        continue;
      }

      const refreshSpanId = tracer.startSpan('token.refresh', { 
        provider: integration.provider 
      });
      
      const result = await refreshProviderToken(
        integration.provider,
        decryptedToken as string,
        supabase,
        integration,
        logger
      );
      
      tracer.endSpan(refreshSpanId, result.success ? 'ok' : 'error');
      results.push(result);
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    metrics.counter(`${FUNCTION_NAME}.success`, successCount);
    metrics.counter(`${FUNCTION_NAME}.failure`, failureCount);

    logger.info('Token refresh completed', { 
      total: results.length, 
      success: successCount, 
      failure: failureCount 
    });
    logResponse(200);

    return successResponse({
      message: 'Token refresh completed',
      refreshed: successCount,
      failed: failureCount,
      results,
    }, rateLimitHeaders);

  } catch (error) {
    logger.error('Token refresh error', error as Error);
    reportError(error as Error, { function: FUNCTION_NAME });
    metrics.counter(`${FUNCTION_NAME}.error`);
    logResponse(500);
    return errorResponse('Internal server error', 500);
  }
});
