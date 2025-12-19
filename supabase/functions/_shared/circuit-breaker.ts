/**
 * Circuit Breaker Pattern Implementation for Edge Functions
 * Prevents cascading failures by temporarily blocking requests to failing services
 */

const kv = await Deno.openKv();

export interface CircuitBreakerConfig {
  failureThreshold: number;      // Number of failures before opening circuit
  resetTimeoutMs: number;        // Time to wait before trying again (half-open state)
  successThreshold: number;      // Successes needed to close circuit from half-open
  monitorWindowMs: number;       // Window to track failures
}

export interface CircuitState {
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  successes: number;
  lastFailureTime: number;
  lastStateChange: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 30000,      // 30 seconds
  successThreshold: 2,
  monitorWindowMs: 60000,     // 1 minute
};

async function getCircuitState(serviceName: string): Promise<CircuitState> {
  const key = ['circuit', serviceName];
  const result = await kv.get<CircuitState>(key);
  
  return result.value || {
    state: 'closed',
    failures: 0,
    successes: 0,
    lastFailureTime: 0,
    lastStateChange: Date.now(),
  };
}

async function setCircuitState(serviceName: string, state: CircuitState): Promise<void> {
  const key = ['circuit', serviceName];
  await kv.set(key, state, { expireIn: 3600000 }); // 1 hour TTL
}

export class CircuitBreaker {
  private serviceName: string;
  private config: CircuitBreakerConfig;

  constructor(serviceName: string, config: Partial<CircuitBreakerConfig> = {}) {
    this.serviceName = serviceName;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async canExecute(): Promise<{ allowed: boolean; state: CircuitState['state']; retryAfter?: number }> {
    const circuitState = await getCircuitState(this.serviceName);
    const now = Date.now();

    // Check if we should transition from open to half-open
    if (circuitState.state === 'open') {
      const timeSinceLastFailure = now - circuitState.lastFailureTime;
      
      if (timeSinceLastFailure >= this.config.resetTimeoutMs) {
        // Transition to half-open
        await setCircuitState(this.serviceName, {
          ...circuitState,
          state: 'half-open',
          successes: 0,
          lastStateChange: now,
        });
        
        return { allowed: true, state: 'half-open' };
      }
      
      // Still open, reject request
      const retryAfter = this.config.resetTimeoutMs - timeSinceLastFailure;
      return { allowed: false, state: 'open', retryAfter };
    }

    // Clear old failures outside monitoring window
    if (circuitState.state === 'closed' && 
        circuitState.failures > 0 && 
        (now - circuitState.lastFailureTime) > this.config.monitorWindowMs) {
      await setCircuitState(this.serviceName, {
        ...circuitState,
        failures: 0,
      });
    }

    return { allowed: true, state: circuitState.state };
  }

  async recordSuccess(): Promise<void> {
    const circuitState = await getCircuitState(this.serviceName);
    const now = Date.now();

    if (circuitState.state === 'half-open') {
      const newSuccesses = circuitState.successes + 1;
      
      if (newSuccesses >= this.config.successThreshold) {
        // Transition back to closed
        await setCircuitState(this.serviceName, {
          state: 'closed',
          failures: 0,
          successes: 0,
          lastFailureTime: 0,
          lastStateChange: now,
        });
        console.log(`[CircuitBreaker] ${this.serviceName}: closed (recovered)`);
      } else {
        await setCircuitState(this.serviceName, {
          ...circuitState,
          successes: newSuccesses,
        });
      }
    } else if (circuitState.state === 'closed' && circuitState.failures > 0) {
      // Reset failures on success in closed state
      await setCircuitState(this.serviceName, {
        ...circuitState,
        failures: Math.max(0, circuitState.failures - 1),
      });
    }
  }

  async recordFailure(error?: Error): Promise<void> {
    const circuitState = await getCircuitState(this.serviceName);
    const now = Date.now();

    if (circuitState.state === 'half-open') {
      // Immediately open circuit on failure during half-open
      await setCircuitState(this.serviceName, {
        state: 'open',
        failures: circuitState.failures + 1,
        successes: 0,
        lastFailureTime: now,
        lastStateChange: now,
      });
      console.warn(`[CircuitBreaker] ${this.serviceName}: opened (half-open failure)`, error?.message);
    } else {
      const newFailures = circuitState.failures + 1;
      
      if (newFailures >= this.config.failureThreshold) {
        // Open the circuit
        await setCircuitState(this.serviceName, {
          state: 'open',
          failures: newFailures,
          successes: 0,
          lastFailureTime: now,
          lastStateChange: now,
        });
        console.warn(`[CircuitBreaker] ${this.serviceName}: opened (threshold reached)`, error?.message);
      } else {
        await setCircuitState(this.serviceName, {
          ...circuitState,
          failures: newFailures,
          lastFailureTime: now,
        });
      }
    }
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    const { allowed, state, retryAfter } = await this.canExecute();

    if (!allowed) {
      const error = new Error(`Circuit breaker open for ${this.serviceName}`);
      (error as any).retryAfter = retryAfter;
      (error as any).circuitState = state;
      throw error;
    }

    try {
      const result = await operation();
      await this.recordSuccess();
      return result;
    } catch (error) {
      await this.recordFailure(error as Error);
      throw error;
    }
  }
}

// Convenience function for wrapping operations with circuit breaker
export async function withCircuitBreaker<T>(
  serviceName: string,
  operation: () => Promise<T>,
  config?: Partial<CircuitBreakerConfig>
): Promise<T> {
  const breaker = new CircuitBreaker(serviceName, config);
  return breaker.execute(operation);
}

// Pre-configured circuit breakers for common services
export const circuitBreakers = {
  lovableAI: new CircuitBreaker('lovable-ai', { 
    failureThreshold: 3, 
    resetTimeoutMs: 60000 
  }),
  openAI: new CircuitBreaker('openai', { 
    failureThreshold: 3, 
    resetTimeoutMs: 60000 
  }),
  socialMedia: new CircuitBreaker('social-media', { 
    failureThreshold: 5, 
    resetTimeoutMs: 30000 
  }),
  database: new CircuitBreaker('database', { 
    failureThreshold: 10, 
    resetTimeoutMs: 10000,
    successThreshold: 3,
  }),
};
