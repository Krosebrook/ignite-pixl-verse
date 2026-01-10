// Deno KV-based rate limiter
const kv = await Deno.openKv();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}

export async function checkRateLimit(
  userId: string,
  action: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const key = ['ratelimit', action, userId];
  const now = Date.now();
  const windowStart = now - windowMs;

  // Get current request timestamps
  const result = await kv.get<number[]>(key);
  const timestamps = (result.value || []).filter(ts => ts > windowStart);

  if (timestamps.length >= limit) {
    const oldestRequest = Math.min(...timestamps);
    const resetAt = oldestRequest + windowMs;

    return {
      allowed: false,
      remaining: 0,
      resetAt,
      limit
    };
  }

  // Add current timestamp
  timestamps.push(now);
  await kv.set(key, timestamps, { expireIn: windowMs });

  return {
    allowed: true,
    remaining: limit - timestamps.length,
    resetAt: now + windowMs,
    limit
  };
}

/**
 * Get standard rate limit headers for responses
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': new Date(result.resetAt).toISOString(),
    ...(result.allowed ? {} : { 'Retry-After': String(Math.ceil((result.resetAt - Date.now()) / 1000)) }),
  };
}

/**
 * Rate limit configurations for different actions
 * Centralized configuration for consistent rate limiting across all edge functions
 */
export const RATE_LIMITS = {
  // Content generation - resource intensive
  content_generation: { limit: 20, windowMs: 3600000 }, // 20/hour
  tiktok_generation: { limit: 10, windowMs: 3600000 },  // 10/hour
  youtube_generation: { limit: 10, windowMs: 3600000 }, // 10/hour
  
  // API operations
  schedule_create: { limit: 50, windowMs: 3600000 },    // 50/hour
  library_install: { limit: 50, windowMs: 3600000 },    // 50/hour
  marketplace_install: { limit: 30, windowMs: 3600000 },// 30/hour
  integrations_connect: { limit: 20, windowMs: 3600000 },// 20/hour
  
  // Campaigns
  campaigns_draft: { limit: 30, windowMs: 3600000 },    // 30/hour
  
  // Publishing
  publish_post: { limit: 60, windowMs: 3600000 },       // 60/hour
  
  // Health & monitoring
  health_check: { limit: 100, windowMs: 60000 },        // 100/minute
  usage_check: { limit: 100, windowMs: 60000 },         // 100/minute
  
  // GDPR operations
  gdpr_export: { limit: 5, windowMs: 3600000 },         // 5/hour
  gdpr_delete: { limit: 3, windowMs: 86400000 },        // 3/day
  
  // Analytics
  events_ingest: { limit: 1000, windowMs: 60000 },      // 1000/minute
  
  // Notifications
  login_notification: { limit: 10, windowMs: 3600000 }, // 10/hour
  
  // Token operations
  token_write: { limit: 20, windowMs: 3600000 },        // 20/hour
} as const;
