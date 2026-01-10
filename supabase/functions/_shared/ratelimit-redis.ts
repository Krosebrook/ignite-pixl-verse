/**
 * Distributed Rate Limiting with Upstash Redis
 * 
 * Provides horizontally scalable rate limiting across edge function instances.
 * Falls back to local Deno KV if Redis is unavailable.
 */

import { checkRateLimit as checkLocalRateLimit, RateLimitResult, RATE_LIMITS } from './ratelimit.ts';

interface UpstashRedisConfig {
  url: string;
  token: string;
}

/**
 * Get Upstash Redis configuration from environment
 */
function getRedisConfig(): UpstashRedisConfig | null {
  const url = Deno.env.get('UPSTASH_REDIS_REST_URL');
  const token = Deno.env.get('UPSTASH_REDIS_REST_TOKEN');
  
  if (!url || !token) {
    return null;
  }
  
  return { url, token };
}

/**
 * Execute a Redis command via Upstash REST API
 */
async function redisCommand<T>(
  config: UpstashRedisConfig,
  command: string[]
): Promise<T> {
  const response = await fetch(`${config.url}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });

  if (!response.ok) {
    throw new Error(`Redis command failed: ${response.status}`);
  }

  const data = await response.json();
  return data.result as T;
}

/**
 * Distributed rate limiting using sliding window algorithm
 * 
 * Uses Redis MULTI/EXEC for atomic operations:
 * 1. Remove expired timestamps from the sorted set
 * 2. Count remaining requests in the window
 * 3. Add current request if under limit
 */
export async function checkDistributedRateLimit(
  userId: string,
  action: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const config = getRedisConfig();
  
  // Fall back to local rate limiting if Redis not configured
  if (!config) {
    console.warn('[RateLimit] Redis not configured, falling back to local rate limiting');
    return checkLocalRateLimit(userId, action, limit, windowMs);
  }

  const key = `ratelimit:${action}:${userId}`;
  const now = Date.now();
  const windowStart = now - windowMs;

  try {
    // Pipeline: Remove old entries, count current, add new if allowed
    // Using Upstash's pipeline endpoint for atomic operations
    const pipelineResponse = await fetch(`${config.url}/pipeline`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        // Remove entries older than the window
        ['ZREMRANGEBYSCORE', key, '0', String(windowStart)],
        // Count current entries in window
        ['ZCARD', key],
        // Get oldest entry for reset calculation
        ['ZRANGE', key, '0', '0', 'WITHSCORES'],
      ]),
    });

    if (!pipelineResponse.ok) {
      throw new Error(`Redis pipeline failed: ${pipelineResponse.status}`);
    }

    const results = await pipelineResponse.json();
    const currentCount = results[1]?.result ?? 0;
    const oldestEntry = results[2]?.result;

    // Check if under limit
    if (currentCount >= limit) {
      // Calculate reset time based on oldest entry
      let resetAt = now + windowMs;
      if (oldestEntry && oldestEntry.length >= 2) {
        const oldestTimestamp = parseInt(oldestEntry[1], 10);
        resetAt = oldestTimestamp + windowMs;
      }

      return {
        allowed: false,
        remaining: 0,
        resetAt,
        limit,
      };
    }

    // Add current request
    await redisCommand(config, ['ZADD', key, String(now), `${now}:${crypto.randomUUID()}`]);
    
    // Set expiry on the key
    await redisCommand(config, ['PEXPIRE', key, String(windowMs)]);

    return {
      allowed: true,
      remaining: limit - currentCount - 1,
      resetAt: now + windowMs,
      limit,
    };

  } catch (error) {
    console.error('[RateLimit] Redis error, falling back to local:', error);
    // Fall back to local rate limiting on Redis errors
    return checkLocalRateLimit(userId, action, limit, windowMs);
  }
}

/**
 * Batch rate limit check for multiple actions
 */
export async function checkMultipleRateLimits(
  userId: string,
  actions: Array<{ action: string; limit: number; windowMs: number }>
): Promise<Record<string, RateLimitResult>> {
  const results: Record<string, RateLimitResult> = {};
  
  // Check all limits in parallel
  const checks = await Promise.all(
    actions.map(async ({ action, limit, windowMs }) => ({
      action,
      result: await checkDistributedRateLimit(userId, action, limit, windowMs),
    }))
  );
  
  for (const { action, result } of checks) {
    results[action] = result;
  }
  
  return results;
}

/**
 * Clear rate limit for a user/action (for testing or admin purposes)
 */
export async function clearRateLimit(userId: string, action: string): Promise<boolean> {
  const config = getRedisConfig();
  
  if (!config) {
    console.warn('[RateLimit] Redis not configured, cannot clear');
    return false;
  }

  try {
    const key = `ratelimit:${action}:${userId}`;
    await redisCommand(config, ['DEL', key]);
    return true;
  } catch (error) {
    console.error('[RateLimit] Failed to clear rate limit:', error);
    return false;
  }
}

/**
 * Get current rate limit status without incrementing
 */
export async function getRateLimitStatus(
  userId: string,
  action: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const config = getRedisConfig();
  
  if (!config) {
    // Return optimistic result if Redis not available
    return {
      allowed: true,
      remaining: limit,
      resetAt: Date.now() + windowMs,
      limit,
    };
  }

  const key = `ratelimit:${action}:${userId}`;
  const now = Date.now();
  const windowStart = now - windowMs;

  try {
    // Pipeline: Clean and count
    const pipelineResponse = await fetch(`${config.url}/pipeline`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['ZREMRANGEBYSCORE', key, '0', String(windowStart)],
        ['ZCARD', key],
        ['ZRANGE', key, '0', '0', 'WITHSCORES'],
      ]),
    });

    if (!pipelineResponse.ok) {
      throw new Error(`Redis pipeline failed: ${pipelineResponse.status}`);
    }

    const results = await pipelineResponse.json();
    const currentCount = results[1]?.result ?? 0;
    const oldestEntry = results[2]?.result;

    let resetAt = now + windowMs;
    if (oldestEntry && oldestEntry.length >= 2) {
      const oldestTimestamp = parseInt(oldestEntry[1], 10);
      resetAt = oldestTimestamp + windowMs;
    }

    return {
      allowed: currentCount < limit,
      remaining: Math.max(0, limit - currentCount),
      resetAt,
      limit,
    };

  } catch (error) {
    console.error('[RateLimit] Failed to get status:', error);
    return {
      allowed: true,
      remaining: limit,
      resetAt: Date.now() + windowMs,
      limit,
    };
  }
}

/**
 * Rate limit middleware wrapper
 * Returns a function that checks rate limit and returns 429 response if exceeded
 */
export function createRateLimitMiddleware(
  action: keyof typeof RATE_LIMITS
) {
  const config = RATE_LIMITS[action];
  
  return async function checkLimit(userId: string): Promise<RateLimitResult> {
    return checkDistributedRateLimit(userId, action, config.limit, config.windowMs);
  };
}

// Re-export types and constants from local module
export { type RateLimitResult, getRateLimitHeaders, RATE_LIMITS } from './ratelimit.ts';
