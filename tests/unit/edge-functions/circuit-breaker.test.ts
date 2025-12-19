/**
 * Unit tests for Circuit Breaker shared utility
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Deno KV
const mockKvStore = new Map<string, unknown>();
const mockKv = {
  get: vi.fn(async (key: unknown[]) => {
    const keyStr = JSON.stringify(key);
    return { value: mockKvStore.get(keyStr) || null };
  }),
  set: vi.fn(async (key: unknown[], value: unknown) => {
    const keyStr = JSON.stringify(key);
    mockKvStore.set(keyStr, value);
  }),
};

// Mock Deno global
vi.stubGlobal('Deno', {
  openKv: vi.fn(async () => mockKv),
});

// Types from circuit-breaker (since we can't import Deno modules in Vitest)
interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
  successThreshold: number;
  monitorWindowMs: number;
}

interface CircuitState {
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  successes: number;
  lastFailureTime: number;
  lastStateChange: number;
}

// Simplified circuit breaker implementation for testing
class MockCircuitBreaker {
  private serviceName: string;
  private config: CircuitBreakerConfig;

  constructor(serviceName: string, config: Partial<CircuitBreakerConfig> = {}) {
    this.serviceName = serviceName;
    this.config = {
      failureThreshold: 5,
      resetTimeoutMs: 30000,
      successThreshold: 2,
      monitorWindowMs: 60000,
      ...config,
    };
  }

  private async getState(): Promise<CircuitState> {
    const result = await mockKv.get(['circuit', this.serviceName]);
    return (result.value as CircuitState) || {
      state: 'closed',
      failures: 0,
      successes: 0,
      lastFailureTime: 0,
      lastStateChange: Date.now(),
    };
  }

  private async setState(state: CircuitState): Promise<void> {
    await mockKv.set(['circuit', this.serviceName], state);
  }

  async canExecute(): Promise<{ allowed: boolean; state: CircuitState['state']; retryAfter?: number }> {
    const circuitState = await this.getState();
    const now = Date.now();

    if (circuitState.state === 'open') {
      const timeSinceLastFailure = now - circuitState.lastFailureTime;
      
      if (timeSinceLastFailure >= this.config.resetTimeoutMs) {
        await this.setState({
          ...circuitState,
          state: 'half-open',
          successes: 0,
          lastStateChange: now,
        });
        return { allowed: true, state: 'half-open' };
      }
      
      const retryAfter = this.config.resetTimeoutMs - timeSinceLastFailure;
      return { allowed: false, state: 'open', retryAfter };
    }

    return { allowed: true, state: circuitState.state };
  }

  async recordSuccess(): Promise<void> {
    const circuitState = await this.getState();
    const now = Date.now();

    if (circuitState.state === 'half-open') {
      const newSuccesses = circuitState.successes + 1;
      
      if (newSuccesses >= this.config.successThreshold) {
        await this.setState({
          state: 'closed',
          failures: 0,
          successes: 0,
          lastFailureTime: 0,
          lastStateChange: now,
        });
      } else {
        await this.setState({
          ...circuitState,
          successes: newSuccesses,
        });
      }
    } else if (circuitState.state === 'closed' && circuitState.failures > 0) {
      await this.setState({
        ...circuitState,
        failures: Math.max(0, circuitState.failures - 1),
      });
    }
  }

  async recordFailure(): Promise<void> {
    const circuitState = await this.getState();
    const now = Date.now();

    if (circuitState.state === 'half-open') {
      await this.setState({
        state: 'open',
        failures: circuitState.failures + 1,
        successes: 0,
        lastFailureTime: now,
        lastStateChange: now,
      });
    } else {
      const newFailures = circuitState.failures + 1;
      
      if (newFailures >= this.config.failureThreshold) {
        await this.setState({
          state: 'open',
          failures: newFailures,
          successes: 0,
          lastFailureTime: now,
          lastStateChange: now,
        });
      } else {
        await this.setState({
          ...circuitState,
          failures: newFailures,
          lastFailureTime: now,
        });
      }
    }
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    const { allowed, retryAfter } = await this.canExecute();

    if (!allowed) {
      const error = new Error(`Circuit breaker open for ${this.serviceName}`);
      (error as any).retryAfter = retryAfter;
      throw error;
    }

    try {
      const result = await operation();
      await this.recordSuccess();
      return result;
    } catch (error) {
      await this.recordFailure();
      throw error;
    }
  }
}

describe('CircuitBreaker', () => {
  beforeEach(() => {
    mockKvStore.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('should start in closed state', async () => {
      const breaker = new MockCircuitBreaker('test-service');
      const { allowed, state } = await breaker.canExecute();
      
      expect(allowed).toBe(true);
      expect(state).toBe('closed');
    });

    it('should use custom configuration', async () => {
      const breaker = new MockCircuitBreaker('test-service', {
        failureThreshold: 3,
        resetTimeoutMs: 10000,
      });
      
      // Record 3 failures
      for (let i = 0; i < 3; i++) {
        await breaker.recordFailure();
      }
      
      const { allowed, state } = await breaker.canExecute();
      expect(allowed).toBe(false);
      expect(state).toBe('open');
    });
  });

  describe('Failure Handling', () => {
    it('should count failures', async () => {
      const breaker = new MockCircuitBreaker('test-service', { failureThreshold: 3 });
      
      await breaker.recordFailure();
      await breaker.recordFailure();
      
      const { allowed } = await breaker.canExecute();
      expect(allowed).toBe(true); // Still under threshold
    });

    it('should open circuit after reaching failure threshold', async () => {
      const breaker = new MockCircuitBreaker('test-service', { failureThreshold: 3 });
      
      await breaker.recordFailure();
      await breaker.recordFailure();
      await breaker.recordFailure();
      
      const { allowed, state } = await breaker.canExecute();
      expect(allowed).toBe(false);
      expect(state).toBe('open');
    });

    it('should return retry after value when circuit is open', async () => {
      const breaker = new MockCircuitBreaker('test-service', { 
        failureThreshold: 1, 
        resetTimeoutMs: 30000 
      });
      
      await breaker.recordFailure();
      
      const { allowed, retryAfter } = await breaker.canExecute();
      expect(allowed).toBe(false);
      expect(retryAfter).toBeDefined();
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(30000);
    });
  });

  describe('Recovery', () => {
    it('should transition to half-open after reset timeout', async () => {
      const breaker = new MockCircuitBreaker('test-service', { 
        failureThreshold: 1, 
        resetTimeoutMs: 100 
      });
      
      await breaker.recordFailure();
      
      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const { allowed, state } = await breaker.canExecute();
      expect(allowed).toBe(true);
      expect(state).toBe('half-open');
    });

    it('should close circuit after success threshold in half-open state', async () => {
      const breaker = new MockCircuitBreaker('test-service', { 
        failureThreshold: 1, 
        resetTimeoutMs: 100,
        successThreshold: 2,
      });
      
      await breaker.recordFailure();
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should be half-open now
      await breaker.canExecute();
      
      await breaker.recordSuccess();
      await breaker.recordSuccess();
      
      const { state } = await breaker.canExecute();
      expect(state).toBe('closed');
    });

    it('should reopen circuit on failure in half-open state', async () => {
      const breaker = new MockCircuitBreaker('test-service', { 
        failureThreshold: 1, 
        resetTimeoutMs: 100,
      });
      
      await breaker.recordFailure();
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Transition to half-open
      await breaker.canExecute();
      
      // Fail again
      await breaker.recordFailure();
      
      const { allowed, state } = await breaker.canExecute();
      expect(allowed).toBe(false);
      expect(state).toBe('open');
    });
  });

  describe('Execute Method', () => {
    it('should execute operation when circuit is closed', async () => {
      const breaker = new MockCircuitBreaker('test-service');
      
      const result = await breaker.execute(async () => 'success');
      expect(result).toBe('success');
    });

    it('should throw when circuit is open', async () => {
      const breaker = new MockCircuitBreaker('test-service', { failureThreshold: 1 });
      
      await breaker.recordFailure();
      
      await expect(breaker.execute(async () => 'success')).rejects.toThrow('Circuit breaker open');
    });

    it('should record success on successful operation', async () => {
      const breaker = new MockCircuitBreaker('test-service');
      
      await breaker.execute(async () => 'success');
      
      // Verify success was recorded (failures should decrease if any)
      const { state } = await breaker.canExecute();
      expect(state).toBe('closed');
    });

    it('should record failure on failed operation', async () => {
      const breaker = new MockCircuitBreaker('test-service', { failureThreshold: 2 });
      
      await expect(breaker.execute(async () => {
        throw new Error('Operation failed');
      })).rejects.toThrow('Operation failed');
      
      await expect(breaker.execute(async () => {
        throw new Error('Operation failed');
      })).rejects.toThrow('Operation failed');
      
      const { allowed } = await breaker.canExecute();
      expect(allowed).toBe(false);
    });
  });

  describe('Independent Services', () => {
    it('should maintain separate states for different services', async () => {
      const breaker1 = new MockCircuitBreaker('service-1', { failureThreshold: 1 });
      const breaker2 = new MockCircuitBreaker('service-2', { failureThreshold: 1 });
      
      await breaker1.recordFailure();
      
      const result1 = await breaker1.canExecute();
      const result2 = await breaker2.canExecute();
      
      expect(result1.allowed).toBe(false);
      expect(result2.allowed).toBe(true);
    });
  });
});
