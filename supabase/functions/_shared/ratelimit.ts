// Deno KV-based rate limiter
const kv = await Deno.openKv();

export async function checkRateLimit(
  userId: string,
  action: string,
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
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
      resetAt
    };
  }

  // Add current timestamp
  timestamps.push(now);
  await kv.set(key, timestamps, { expireIn: windowMs });

  return {
    allowed: true,
    remaining: limit - timestamps.length,
    resetAt: now + windowMs
  };
}
