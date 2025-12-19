/**
 * Retry utilities with exponential backoff and jitter
 * for resilient edge function operations
 */

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitter: boolean;
  retryableErrors?: (error: Error) => boolean;
  onRetry?: (attempt: number, error: Error, nextDelayMs: number) => void;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true,
};

// Common retryable error patterns
export const isRetryableError = (error: Error): boolean => {
  const message = error.message.toLowerCase();
  const retryablePatterns = [
    'network',
    'timeout',
    'econnreset',
    'econnrefused',
    'socket hang up',
    'service unavailable',
    '503',
    '502',
    '504',
    'temporarily unavailable',
    'rate limit',
    '429',
  ];
  
  return retryablePatterns.some(pattern => message.includes(pattern));
};

// Non-retryable error patterns
export const isNonRetryableError = (error: Error): boolean => {
  const message = error.message.toLowerCase();
  const nonRetryablePatterns = [
    'unauthorized',
    '401',
    'forbidden',
    '403',
    'not found',
    '404',
    'bad request',
    '400',
    'validation',
    'invalid',
  ];
  
  return nonRetryablePatterns.some(pattern => message.includes(pattern));
};

function calculateDelay(
  attempt: number,
  config: RetryConfig
): number {
  let delay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt);
  delay = Math.min(delay, config.maxDelayMs);
  
  if (config.jitter) {
    // Add random jitter between 0-50% of delay
    delay = delay * (1 + Math.random() * 0.5);
  }
  
  return Math.floor(delay);
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Check if error is non-retryable
      if (isNonRetryableError(lastError)) {
        throw lastError;
      }

      // Check custom retryable logic
      if (finalConfig.retryableErrors && !finalConfig.retryableErrors(lastError)) {
        throw lastError;
      }

      // Last attempt, throw error
      if (attempt === finalConfig.maxRetries) {
        throw lastError;
      }

      const delay = calculateDelay(attempt, finalConfig);
      
      // Call onRetry callback if provided
      finalConfig.onRetry?.(attempt + 1, lastError, delay);
      
      console.warn(`[Retry] Attempt ${attempt + 1}/${finalConfig.maxRetries} failed, retrying in ${delay}ms:`, lastError.message);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// Convenience wrappers for common retry scenarios
export const retryWithDefaults = <T>(operation: () => Promise<T>) => 
  withRetry(operation);

export const retryDatabaseOperation = <T>(operation: () => Promise<T>) =>
  withRetry(operation, {
    maxRetries: 5,
    baseDelayMs: 500,
    maxDelayMs: 10000,
  });

export const retryExternalAPI = <T>(operation: () => Promise<T>) =>
  withRetry(operation, {
    maxRetries: 3,
    baseDelayMs: 2000,
    maxDelayMs: 30000,
  });

export const retrySocialMediaAPI = <T>(operation: () => Promise<T>) =>
  withRetry(operation, {
    maxRetries: 2,
    baseDelayMs: 5000,
    maxDelayMs: 30000,
    retryableErrors: (error) => {
      // Don't retry auth errors for social media
      if (error.message.includes('unauthorized') || error.message.includes('forbidden')) {
        return false;
      }
      return isRetryableError(error);
    },
  });

/**
 * Retry with timeout - wraps operation with both retry and timeout logic
 */
export async function withRetryAndTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  retryConfig: Partial<RetryConfig> = {}
): Promise<T> {
  return withRetry(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const result = await Promise.race([
        operation(),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new Error(`Operation timed out after ${timeoutMs}ms`));
          });
        }),
      ]);
      return result;
    } finally {
      clearTimeout(timeoutId);
    }
  }, retryConfig);
}
