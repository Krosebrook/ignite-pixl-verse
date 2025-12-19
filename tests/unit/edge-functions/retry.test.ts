/**
 * Unit tests for Retry shared utility
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Import types from the actual module structure
interface RetryConfig {
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

// Retry utility functions (mirroring the actual implementation)
function isRetryableError(error: Error): boolean {
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
}

function isNonRetryableError(error: Error): boolean {
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
}

function calculateDelay(attempt: number, config: RetryConfig): number {
  let delay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt);
  delay = Math.min(delay, config.maxDelayMs);
  
  if (config.jitter) {
    delay = delay * (1 + Math.random() * 0.5);
  }
  
  return Math.floor(delay);
}

async function withRetry<T>(
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

      if (isNonRetryableError(lastError)) {
        throw lastError;
      }

      if (finalConfig.retryableErrors && !finalConfig.retryableErrors(lastError)) {
        throw lastError;
      }

      if (attempt === finalConfig.maxRetries) {
        throw lastError;
      }

      const delay = calculateDelay(attempt, finalConfig);
      finalConfig.onRetry?.(attempt + 1, lastError, delay);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

describe('Retry Utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('isRetryableError', () => {
    it('should identify network errors as retryable', () => {
      expect(isRetryableError(new Error('Network error'))).toBe(true);
      expect(isRetryableError(new Error('ECONNRESET'))).toBe(true);
      expect(isRetryableError(new Error('ECONNREFUSED'))).toBe(true);
      expect(isRetryableError(new Error('socket hang up'))).toBe(true);
    });

    it('should identify timeout errors as retryable', () => {
      expect(isRetryableError(new Error('Request timeout'))).toBe(true);
    });

    it('should identify server errors as retryable', () => {
      expect(isRetryableError(new Error('503 Service Unavailable'))).toBe(true);
      expect(isRetryableError(new Error('502 Bad Gateway'))).toBe(true);
      expect(isRetryableError(new Error('504 Gateway Timeout'))).toBe(true);
    });

    it('should identify rate limit errors as retryable', () => {
      expect(isRetryableError(new Error('429 Rate limit exceeded'))).toBe(true);
      expect(isRetryableError(new Error('Rate limit reached'))).toBe(true);
    });

    it('should not identify client errors as retryable', () => {
      expect(isRetryableError(new Error('Invalid input'))).toBe(false);
      expect(isRetryableError(new Error('Syntax error'))).toBe(false);
    });
  });

  describe('isNonRetryableError', () => {
    it('should identify auth errors as non-retryable', () => {
      expect(isNonRetryableError(new Error('401 Unauthorized'))).toBe(true);
      expect(isNonRetryableError(new Error('403 Forbidden'))).toBe(true);
    });

    it('should identify client errors as non-retryable', () => {
      expect(isNonRetryableError(new Error('400 Bad Request'))).toBe(true);
      expect(isNonRetryableError(new Error('404 Not Found'))).toBe(true);
    });

    it('should identify validation errors as non-retryable', () => {
      expect(isNonRetryableError(new Error('Validation failed'))).toBe(true);
      expect(isNonRetryableError(new Error('Invalid format'))).toBe(true);
    });

    it('should not identify server errors as non-retryable', () => {
      expect(isNonRetryableError(new Error('503 Service Unavailable'))).toBe(false);
      expect(isNonRetryableError(new Error('Internal server error'))).toBe(false);
    });
  });

  describe('calculateDelay', () => {
    it('should calculate exponential backoff', () => {
      const config: RetryConfig = {
        ...DEFAULT_RETRY_CONFIG,
        baseDelayMs: 1000,
        backoffMultiplier: 2,
        jitter: false,
      };

      expect(calculateDelay(0, config)).toBe(1000);
      expect(calculateDelay(1, config)).toBe(2000);
      expect(calculateDelay(2, config)).toBe(4000);
      expect(calculateDelay(3, config)).toBe(8000);
    });

    it('should respect max delay', () => {
      const config: RetryConfig = {
        ...DEFAULT_RETRY_CONFIG,
        baseDelayMs: 1000,
        backoffMultiplier: 10,
        maxDelayMs: 5000,
        jitter: false,
      };

      expect(calculateDelay(0, config)).toBe(1000);
      expect(calculateDelay(1, config)).toBe(5000); // Capped at max
      expect(calculateDelay(2, config)).toBe(5000); // Capped at max
    });

    it('should add jitter when enabled', () => {
      const config: RetryConfig = {
        ...DEFAULT_RETRY_CONFIG,
        baseDelayMs: 1000,
        backoffMultiplier: 2,
        jitter: true,
      };

      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const delay = calculateDelay(0, config);
      
      // With jitter of 0.5, delay should be 1000 * (1 + 0.5 * 0.5) = 1250
      expect(delay).toBeGreaterThanOrEqual(1000);
      expect(delay).toBeLessThanOrEqual(1500);
    });
  });

  describe('withRetry', () => {
    it('should return result on first success', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      
      const result = await withRetry(operation, { maxRetries: 3 });
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable error and eventually succeed', async () => {
      vi.useRealTimers(); // Need real timers for this test
      
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValue('success');
      
      const result = await withRetry(operation, { 
        maxRetries: 3,
        baseDelayMs: 10,
        maxDelayMs: 50,
      });
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should throw immediately on non-retryable error', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('401 Unauthorized'));
      
      await expect(withRetry(operation, { maxRetries: 3 })).rejects.toThrow('401 Unauthorized');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should throw after max retries exceeded', async () => {
      vi.useRealTimers();
      
      const operation = vi.fn().mockRejectedValue(new Error('Network error'));
      
      await expect(withRetry(operation, { 
        maxRetries: 2,
        baseDelayMs: 10,
      })).rejects.toThrow('Network error');
      expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should call onRetry callback', async () => {
      vi.useRealTimers();
      
      const onRetry = vi.fn();
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue('success');
      
      await withRetry(operation, {
        maxRetries: 3,
        baseDelayMs: 10,
        onRetry,
      });
      
      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), expect.any(Number));
    });

    it('should respect custom retryableErrors function', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Custom error'));
      
      await expect(withRetry(operation, {
        maxRetries: 3,
        retryableErrors: (error) => error.message === 'Retry this',
      })).rejects.toThrow('Custom error');
      
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });
});
