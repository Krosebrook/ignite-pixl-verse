/**
 * API utilities for consistent error handling and request management
 */

import { supabase } from '@/integrations/supabase/client';
import { Analytics, trackAPICall } from './observability';

// Error types for better error handling
export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export class NetworkError extends Error {
  constructor(message = 'Network request failed') {
    super(message);
    this.name = 'NetworkError';
  }
}

export class AuthenticationError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public fields?: Record<string, string>
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class RateLimitError extends Error {
  constructor(
    message: string,
    public retryAfter?: Date
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

/**
 * Get the current authenticated user or throw
 */
export async function requireAuth() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new AuthenticationError('You must be logged in to perform this action');
  }
  return user;
}

/**
 * Get the user's organization membership or throw
 */
export async function requireOrgMembership(userId: string) {
  const { data: membership, error } = await supabase
    .from('members')
    .select('org_id, role')
    .eq('user_id', userId)
    .single();

  if (error || !membership) {
    throw new APIError('No organization membership found', 403, 'NO_ORG');
  }

  return membership;
}

/**
 * Generate an idempotency key for requests
 */
export function generateIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Invoke a Supabase Edge Function with proper error handling
 */
export async function invokeEdgeFunction<T = unknown>(
  functionName: string,
  body: Record<string, unknown>,
  options?: {
    idempotencyKey?: string;
    timeout?: number;
  }
): Promise<T> {
  const startTime = performance.now();
  
  try {
    const headers: Record<string, string> = {};
    if (options?.idempotencyKey) {
      headers['x-idempotency-key'] = options.idempotencyKey;
    }

    const { data, error } = await supabase.functions.invoke(functionName, {
      body,
      headers,
    });

    const duration = performance.now() - startTime;
    trackAPICall(`/functions/v1/${functionName}`, 'POST', duration, error ? 500 : 200);

    if (error) {
      // Parse error response
      const errorMessage = typeof error === 'string' ? error : error.message || 'Unknown error';
      
      // Check for specific error types
      if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
        throw new RateLimitError('Rate limit exceeded. Please try again later.');
      }
      if (errorMessage.includes('401') || errorMessage.includes('authentication')) {
        throw new AuthenticationError(errorMessage);
      }
      if (errorMessage.includes('402') || errorMessage.includes('payment')) {
        throw new APIError('Payment required', 402, 'PAYMENT_REQUIRED');
      }
      if (errorMessage.includes('403') || errorMessage.includes('forbidden')) {
        throw new APIError('Access denied', 403, 'FORBIDDEN');
      }

      throw new APIError(errorMessage, 500, 'EDGE_FUNCTION_ERROR');
    }

    return data as T;
  } catch (error) {
    if (error instanceof APIError || error instanceof RateLimitError || 
        error instanceof AuthenticationError || error instanceof NetworkError) {
      throw error;
    }

    // Log unexpected errors
    console.error(`Edge function ${functionName} error:`, error);
    Analytics.errorOccurred('edge_function_error', String(error), { functionName });
    
    throw new NetworkError('Failed to connect to server');
  }
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    shouldRetry?: (error: unknown) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 10000,
    shouldRetry = (error) => error instanceof NetworkError,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }

      // Calculate delay with exponential backoff and jitter
      const delay = Math.min(
        baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000,
        maxDelayMs
      );

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Debounce a function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delayMs);
  };
}

/**
 * Throttle a function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limitMs: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limitMs);
    }
  };
}

/**
 * Create a cache for API responses
 */
export function createCache<T>(ttlMs: number) {
  const cache = new Map<string, { data: T; timestamp: number }>();

  return {
    get(key: string): T | undefined {
      const entry = cache.get(key);
      if (!entry) return undefined;
      if (Date.now() - entry.timestamp > ttlMs) {
        cache.delete(key);
        return undefined;
      }
      return entry.data;
    },
    set(key: string, data: T): void {
      cache.set(key, { data, timestamp: Date.now() });
    },
    delete(key: string): void {
      cache.delete(key);
    },
    clear(): void {
      cache.clear();
    },
  };
}
