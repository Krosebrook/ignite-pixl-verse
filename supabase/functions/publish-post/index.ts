import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// Import shared utilities
import { CircuitBreaker } from "../_shared/circuit-breaker.ts";
import { withRetry, retrySocialMediaAPI } from "../_shared/retry.ts";
import { Logger, Tracer, metrics, reportError, trackRequest } from "../_shared/observability.ts";
import {
  corsPreflightResponse,
  successResponse,
  errorResponse,
  getRequestId,
  defaultHeaders,
} from "../_shared/http.ts";
import { checkRateLimit } from "../_shared/ratelimit.ts";

const FUNCTION_NAME = "publish-post";

// Circuit breakers for each social platform
const circuitBreakers = {
  instagram: new CircuitBreaker("instagram-api", { failureThreshold: 3, resetTimeoutMs: 120000 }),
  twitter: new CircuitBreaker("twitter-api", { failureThreshold: 3, resetTimeoutMs: 60000 }),
  linkedin: new CircuitBreaker("linkedin-api", { failureThreshold: 3, resetTimeoutMs: 60000 }),
};

interface ScheduleRecord {
  id: string;
  org_id: string;
  platform: string;
  asset_id: string;
  scheduled_at: string;
  status: string;
  retries: number;
}

interface PublishResult {
  success: boolean;
  postId?: string;
  error?: string;
}

// Publish to Instagram via Graph API with retry
async function publishToInstagram(
  accessToken: string,
  content: string,
  imageUrl: string | undefined,
  logger: Logger,
  tracer: Tracer
): Promise<PublishResult> {
  const spanId = tracer.startSpan("instagram.publish");
  
  try {
    return await circuitBreakers.instagram.execute(async () => {
      return await retrySocialMediaAPI(async () => {
        // Get Instagram Business Account ID
        const accountsResponse = await fetch(
          `https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`
        );
        const accountsData = await accountsResponse.json();
        
        if (!accountsData.data?.[0]?.id) {
          throw new Error('No Facebook page found');
        }

        const pageId = accountsData.data[0].id;
        const pageAccessToken = accountsData.data[0].access_token;

        // Get Instagram Business Account
        const igAccountResponse = await fetch(
          `https://graph.facebook.com/v18.0/${pageId}?fields=instagram_business_account&access_token=${pageAccessToken}`
        );
        const igAccountData = await igAccountResponse.json();
        
        if (!igAccountData.instagram_business_account?.id) {
          throw new Error('No Instagram Business account linked');
        }

        const igAccountId = igAccountData.instagram_business_account.id;

        if (!imageUrl) {
          throw new Error('Instagram requires an image');
        }

        // Create media container for image post
        const createMediaResponse = await fetch(
          `https://graph.facebook.com/v18.0/${igAccountId}/media`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              image_url: imageUrl,
              caption: content,
              access_token: pageAccessToken,
            }),
          }
        );
        
        const mediaData = await createMediaResponse.json();
        if (mediaData.error) {
          throw new Error(mediaData.error.message);
        }

        // Publish the media container
        const publishResponse = await fetch(
          `https://graph.facebook.com/v18.0/${igAccountId}/media_publish`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              creation_id: mediaData.id,
              access_token: pageAccessToken,
            }),
          }
        );

        const publishData = await publishResponse.json();
        if (!publishData.id) {
          throw new Error(publishData.error?.message || 'Publish failed');
        }

        tracer.endSpan(spanId, "ok");
        metrics.counter("publish.success", 1, { platform: "instagram" });
        return { success: true, postId: publishData.id };
      });
    });
  } catch (error) {
    tracer.endSpan(spanId, "error", error as Error);
    logger.error("Instagram publish failed", error as Error);
    metrics.counter("publish.failure", 1, { platform: "instagram" });
    return { success: false, error: (error as Error).message };
  }
}

// Publish to Twitter/X via v2 API with retry
async function publishToTwitter(
  accessToken: string,
  content: string,
  logger: Logger,
  tracer: Tracer
): Promise<PublishResult> {
  const spanId = tracer.startSpan("twitter.publish");
  
  try {
    return await circuitBreakers.twitter.execute(async () => {
      return await retrySocialMediaAPI(async () => {
        const response = await fetch('https://api.twitter.com/2/tweets', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: content }),
        });

        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.detail || data.title || `Twitter API error: ${response.status}`);
        }
        
        if (!data.data?.id) {
          throw new Error('Tweet failed - no ID returned');
        }

        tracer.endSpan(spanId, "ok");
        metrics.counter("publish.success", 1, { platform: "twitter" });
        return { success: true, postId: data.data.id };
      });
    });
  } catch (error) {
    tracer.endSpan(spanId, "error", error as Error);
    logger.error("Twitter publish failed", error as Error);
    metrics.counter("publish.failure", 1, { platform: "twitter" });
    return { success: false, error: (error as Error).message };
  }
}

// Publish to LinkedIn via v2 API with retry
async function publishToLinkedIn(
  accessToken: string,
  content: string,
  logger: Logger,
  tracer: Tracer
): Promise<PublishResult> {
  const spanId = tracer.startSpan("linkedin.publish");
  
  try {
    return await circuitBreakers.linkedin.execute(async () => {
      return await retrySocialMediaAPI(async () => {
        // Get user profile URN
        const profileResponse = await fetch('https://api.linkedin.com/v2/me', {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        
        if (!profileResponse.ok) {
          throw new Error(`LinkedIn profile fetch failed: ${profileResponse.status}`);
        }
        
        const profileData = await profileResponse.json();
        const authorUrn = `urn:li:person:${profileData.id}`;

        // Create share
        const shareResponse = await fetch('https://api.linkedin.com/v2/ugcPosts', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
          },
          body: JSON.stringify({
            author: authorUrn,
            lifecycleState: 'PUBLISHED',
            specificContent: {
              'com.linkedin.ugc.ShareContent': {
                shareCommentary: { text: content },
                shareMediaCategory: 'NONE',
              },
            },
            visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
          }),
        });

        const shareData = await shareResponse.json();
        
        if (!shareData.id) {
          throw new Error(shareData.message || 'LinkedIn share failed');
        }

        tracer.endSpan(spanId, "ok");
        metrics.counter("publish.success", 1, { platform: "linkedin" });
        return { success: true, postId: shareData.id };
      });
    });
  } catch (error) {
    tracer.endSpan(spanId, "error", error as Error);
    logger.error("LinkedIn publish failed", error as Error);
    metrics.counter("publish.failure", 1, { platform: "linkedin" });
    return { success: false, error: (error as Error).message };
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
  logger.info('Publish-post function triggered');

  try {
    // Rate limiting for the cron job caller (service role) - 60 calls per hour
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     'cron';
    const rateLimit = await checkRateLimit(clientIp, 'publish_post', 60, 3600000);
    
    if (!rateLimit.allowed) {
      logger.warn('Publish-post rate limit exceeded', { clientIp });
      metrics.counter("rate_limit.exceeded", 1, { function: FUNCTION_NAME });
      logResponse(429);
      return errorResponse('Rate limit exceeded', 429);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get pending schedules that are due
    const fetchSpanId = tracer.startSpan("db.fetch_schedules");
    const now = new Date().toISOString();
    const { data: pendingSchedules, error: fetchError } = await supabase
      .from('schedules')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', now)
      .lt('retries', 3)
      .order('scheduled_at', { ascending: true })
      .limit(10);
    tracer.endSpan(fetchSpanId, fetchError ? "error" : "ok");

    if (fetchError) {
      logger.error('Failed to fetch schedules', fetchError);
      throw fetchError;
    }

    if (!pendingSchedules?.length) {
      logger.info('No pending schedules to process');
      const response = successResponse({ processed: 0 });
      logResponse(200);
      return response;
    }

    logger.info(`Processing ${pendingSchedules.length} scheduled posts`, { count: pendingSchedules.length });
    metrics.gauge("schedules.pending", pendingSchedules.length);

    const results: Array<{ scheduleId: string } & PublishResult> = [];
    const keyringToken = Deno.env.get('KEYRING_TOKEN');

    for (const schedule of pendingSchedules as ScheduleRecord[]) {
      const scheduleLogger = logger.child({ scheduleId: schedule.id, platform: schedule.platform });
      const scheduleSpanId = tracer.startSpan("schedule.process", { scheduleId: schedule.id });

      try {
        // Get integration for this org and platform
        const { data: integration, error: integrationError } = await supabase
          .from('integrations')
          .select('id, access_token_encrypted')
          .eq('org_id', schedule.org_id)
          .eq('provider', schedule.platform)
          .eq('status', 'connected')
          .single();

        if (integrationError || !integration) {
          scheduleLogger.warn('No integration found', { error: integrationError?.message });
          await supabase
            .from('schedules')
            .update({
              status: 'failed',
              error_message: `No ${schedule.platform} integration found`,
              retries: schedule.retries + 1,
            })
            .eq('id', schedule.id);
          tracer.endSpan(scheduleSpanId, "error");
          continue;
        }

        // Decrypt access token
        const { data: decryptedToken, error: decryptError } = await supabase.rpc(
          'decrypt_integration_token',
          {
            p_integration_id: integration.id,
            p_encryption_key: keyringToken,
            p_token_type: 'access',
          }
        );

        if (decryptError || !decryptedToken) {
          scheduleLogger.error('Failed to decrypt token', decryptError);
          await supabase
            .from('schedules')
            .update({
              status: 'failed',
              error_message: 'Token decryption failed',
              retries: schedule.retries + 1,
            })
            .eq('id', schedule.id);
          tracer.endSpan(scheduleSpanId, "error");
          continue;
        }

        // Get asset content
        const { data: asset, error: assetError } = await supabase
          .from('assets')
          .select('content_data, content_url, name, type')
          .eq('id', schedule.asset_id)
          .single();

        if (assetError || !asset) {
          scheduleLogger.warn('Asset not found', { assetId: schedule.asset_id });
          await supabase
            .from('schedules')
            .update({
              status: 'failed',
              error_message: 'Asset not found',
              retries: schedule.retries + 1,
            })
            .eq('id', schedule.id);
          tracer.endSpan(scheduleSpanId, "error");
          continue;
        }

        const content = typeof asset.content_data === 'object' && asset.content_data !== null
          ? (asset.content_data as { text?: string }).text || asset.name
          : asset.name;
        const imageUrl = asset.content_url;

        let result: PublishResult;

        switch (schedule.platform) {
          case 'instagram':
            result = await publishToInstagram(decryptedToken, content, imageUrl, scheduleLogger, tracer);
            break;
          case 'twitter':
            result = await publishToTwitter(decryptedToken, content, scheduleLogger, tracer);
            break;
          case 'linkedin':
            result = await publishToLinkedIn(decryptedToken, content, scheduleLogger, tracer);
            break;
          default:
            result = { success: false, error: `Unsupported platform: ${schedule.platform}` };
        }

        if (result.success) {
          await supabase
            .from('schedules')
            .update({
              status: 'published',
              posted_url: result.postId,
              result: result,
            })
            .eq('id', schedule.id);

          scheduleLogger.info('Successfully published', { postId: result.postId });
          tracer.endSpan(scheduleSpanId, "ok");
        } else {
          const newRetries = schedule.retries + 1;
          await supabase
            .from('schedules')
            .update({
              status: newRetries >= 3 ? 'failed' : 'pending',
              error_message: result.error,
              retries: newRetries,
            })
            .eq('id', schedule.id);

          scheduleLogger.warn('Publish failed', { error: result.error, retries: newRetries });
          tracer.endSpan(scheduleSpanId, "error");
        }

        results.push({ scheduleId: schedule.id, ...result });
      } catch (error) {
        scheduleLogger.error('Error processing schedule', error as Error);
        reportError(error as Error, { scheduleId: schedule.id, platform: schedule.platform });
        await supabase
          .from('schedules')
          .update({
            status: 'failed',
            error_message: (error as Error).message || 'Unknown error',
            retries: schedule.retries + 1,
          })
          .eq('id', schedule.id);
        tracer.endSpan(scheduleSpanId, "error", error as Error);
      }
    }

    metrics.counter("schedules.processed", results.length);
    const response = successResponse({ processed: results.length, results }, { "X-Request-Id": requestId });
    logResponse(200);
    return response;
    
  } catch (error) {
    logger.error('Publish-post error', error as Error);
    reportError(error as Error, { function: FUNCTION_NAME });
    const response = errorResponse((error as Error).message || 'Unknown error', 500);
    logResponse(500);
    return response;
  }
});
