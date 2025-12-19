/**
 * Health Check Edge Function
 * Reports status of all circuit breakers and service dependencies
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsPreflightResponse, successResponse, errorResponse, corsHeaders } from '../_shared/http.ts';
import { Logger, generateRequestId, metrics } from '../_shared/observability.ts';

const kv = await Deno.openKv();

interface CircuitState {
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  successes: number;
  lastFailureTime: number;
  lastStateChange: number;
}

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs?: number;
  message?: string;
  lastCheck?: string;
}

interface CircuitBreakerStatus {
  name: string;
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  successes: number;
  lastFailureTime: string | null;
  lastStateChange: string;
}

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  services: ServiceHealth[];
  circuitBreakers: CircuitBreakerStatus[];
  metrics: {
    requestsTotal: number;
    errorsTotal: number;
    avgLatencyMs: number;
  };
}

// Known circuit breaker names to check
const CIRCUIT_BREAKER_NAMES = [
  'lovable-ai',
  'openai',
  'social-media',
  'database',
  'external-api',
];

const startTime = Date.now();

async function getCircuitBreakerStatus(name: string): Promise<CircuitBreakerStatus> {
  try {
    const key = ['circuit', name];
    const result = await kv.get<CircuitState>(key);
    
    const state = result.value || {
      state: 'closed' as const,
      failures: 0,
      successes: 0,
      lastFailureTime: 0,
      lastStateChange: Date.now(),
    };
    
    return {
      name,
      state: state.state,
      failures: state.failures,
      successes: state.successes,
      lastFailureTime: state.lastFailureTime ? new Date(state.lastFailureTime).toISOString() : null,
      lastStateChange: new Date(state.lastStateChange).toISOString(),
    };
  } catch (error) {
    return {
      name,
      state: 'closed',
      failures: 0,
      successes: 0,
      lastFailureTime: null,
      lastStateChange: new Date().toISOString(),
    };
  }
}

async function checkDatabaseHealth(): Promise<ServiceHealth> {
  const startTime = performance.now();
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      return {
        name: 'database',
        status: 'unhealthy',
        message: 'Missing database configuration',
      };
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Simple health query
    const { error } = await supabase
      .from('orgs')
      .select('id')
      .limit(1);
    
    const latencyMs = Math.round(performance.now() - startTime);
    
    if (error) {
      return {
        name: 'database',
        status: 'unhealthy',
        latencyMs,
        message: error.message,
        lastCheck: new Date().toISOString(),
      };
    }
    
    return {
      name: 'database',
      status: latencyMs > 1000 ? 'degraded' : 'healthy',
      latencyMs,
      message: latencyMs > 1000 ? 'Slow response' : undefined,
      lastCheck: new Date().toISOString(),
    };
  } catch (error) {
    return {
      name: 'database',
      status: 'unhealthy',
      latencyMs: Math.round(performance.now() - startTime),
      message: (error as Error).message,
      lastCheck: new Date().toISOString(),
    };
  }
}

async function checkKVHealth(): Promise<ServiceHealth> {
  const startTime = performance.now();
  
  try {
    // Test KV read/write
    const testKey = ['health-check', 'test'];
    await kv.set(testKey, { timestamp: Date.now() }, { expireIn: 60000 });
    const result = await kv.get(testKey);
    
    const latencyMs = Math.round(performance.now() - startTime);
    
    if (!result.value) {
      return {
        name: 'kv-store',
        status: 'degraded',
        latencyMs,
        message: 'KV read returned null',
        lastCheck: new Date().toISOString(),
      };
    }
    
    return {
      name: 'kv-store',
      status: latencyMs > 500 ? 'degraded' : 'healthy',
      latencyMs,
      message: latencyMs > 500 ? 'Slow response' : undefined,
      lastCheck: new Date().toISOString(),
    };
  } catch (error) {
    return {
      name: 'kv-store',
      status: 'unhealthy',
      latencyMs: Math.round(performance.now() - startTime),
      message: (error as Error).message,
      lastCheck: new Date().toISOString(),
    };
  }
}

async function checkExternalApiHealth(): Promise<ServiceHealth> {
  const startTime = performance.now();
  
  try {
    // Check if we can reach external API (Lovable AI proxy)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch('https://api.lovable.dev/v1/health', {
      method: 'GET',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    const latencyMs = Math.round(performance.now() - startTime);
    
    return {
      name: 'lovable-api',
      status: response.ok ? (latencyMs > 2000 ? 'degraded' : 'healthy') : 'unhealthy',
      latencyMs,
      message: response.ok ? undefined : `HTTP ${response.status}`,
      lastCheck: new Date().toISOString(),
    };
  } catch (error) {
    const errorMessage = (error as Error).message;
    
    // Skip if endpoint doesn't exist - that's expected
    if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
      return {
        name: 'lovable-api',
        status: 'healthy',
        message: 'Health endpoint not available (expected)',
        lastCheck: new Date().toISOString(),
      };
    }
    
    return {
      name: 'lovable-api',
      status: 'degraded',
      latencyMs: Math.round(performance.now() - startTime),
      message: errorMessage,
      lastCheck: new Date().toISOString(),
    };
  }
}

function determineOverallStatus(services: ServiceHealth[], circuitBreakers: CircuitBreakerStatus[]): 'healthy' | 'degraded' | 'unhealthy' {
  // Check if any service is unhealthy
  const hasUnhealthy = services.some(s => s.status === 'unhealthy');
  if (hasUnhealthy) return 'unhealthy';
  
  // Check if any circuit breaker is open
  const hasOpenCircuit = circuitBreakers.some(cb => cb.state === 'open');
  if (hasOpenCircuit) return 'degraded';
  
  // Check if any service is degraded
  const hasDegraded = services.some(s => s.status === 'degraded');
  if (hasDegraded) return 'degraded';
  
  // Check if any circuit breaker is half-open
  const hasHalfOpen = circuitBreakers.some(cb => cb.state === 'half-open');
  if (hasHalfOpen) return 'degraded';
  
  return 'healthy';
}

Deno.serve(async (req) => {
  const requestId = generateRequestId();
  const logger = new Logger('health', { requestId });
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return corsPreflightResponse();
  }
  
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  try {
    logger.info('Health check requested');
    const startTime = performance.now();
    
    // Gather all health checks in parallel
    const [
      dbHealth,
      kvHealth,
      apiHealth,
      ...circuitBreakerStatuses
    ] = await Promise.all([
      checkDatabaseHealth(),
      checkKVHealth(),
      checkExternalApiHealth(),
      ...CIRCUIT_BREAKER_NAMES.map(name => getCircuitBreakerStatus(name)),
    ]);
    
    const services: ServiceHealth[] = [dbHealth, kvHealth, apiHealth];
    const circuitBreakers: CircuitBreakerStatus[] = circuitBreakerStatuses;
    
    const overallStatus = determineOverallStatus(services, circuitBreakers);
    
    const response: HealthResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      uptime: Math.floor((Date.now() - globalThis.startTime) / 1000) || 0,
      services,
      circuitBreakers,
      metrics: {
        requestsTotal: metrics.getMetrics().filter(m => m.name.includes('requests')).reduce((acc, m) => acc + m.value, 0),
        errorsTotal: metrics.getMetrics().filter(m => m.name.includes('error')).reduce((acc, m) => acc + m.value, 0),
        avgLatencyMs: Math.round(
          metrics.getMetrics()
            .filter(m => m.name.includes('latency'))
            .reduce((acc, m, _, arr) => acc + m.value / arr.length, 0) || 0
        ),
      },
    };
    
    const duration = Math.round(performance.now() - startTime);
    logger.info('Health check completed', { 
      status: overallStatus, 
      durationMs: duration,
      servicesCount: services.length,
      circuitBreakersCount: circuitBreakers.length,
    });
    
    metrics.counter('health.checks');
    metrics.timing('health.check.latency', duration);
    
    // Return 503 if unhealthy, 200 otherwise
    const httpStatus = overallStatus === 'unhealthy' ? 503 : 200;
    
    return new Response(JSON.stringify(response), {
      status: httpStatus,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logger.error('Health check failed', error);
    
    return errorResponse(
      'Health check failed',
      500,
      requestId,
      { error: (error as Error).message }
    );
  }
});

// Set global start time for uptime tracking
declare global {
  var startTime: number;
}
globalThis.startTime = globalThis.startTime || Date.now();
