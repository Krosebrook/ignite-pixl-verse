/**
 * Observability utilities for edge functions
 * Provides structured logging, metrics, and tracing
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  requestId?: string;
  userId?: string;
  orgId?: string;
  functionName?: string;
  [key: string]: unknown;
}

export interface MetricData {
  name: string;
  value: number;
  unit?: 'ms' | 'count' | 'bytes' | 'percent';
  tags?: Record<string, string>;
}

// Generate unique request ID
export function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

// Structured logger class
export class Logger {
  private context: LogContext;
  private functionName: string;

  constructor(functionName: string, context: LogContext = {}) {
    this.functionName = functionName;
    this.context = {
      ...context,
      functionName,
      requestId: context.requestId || generateRequestId(),
    };
  }

  private formatLog(level: LogLevel, message: string, data?: Record<string, unknown>): string {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      function: this.functionName,
      requestId: this.context.requestId,
      message,
      ...this.context,
      ...(data || {}),
    };
    
    return JSON.stringify(logEntry);
  }

  debug(message: string, data?: Record<string, unknown>): void {
    console.debug(this.formatLog('debug', message, data));
  }

  info(message: string, data?: Record<string, unknown>): void {
    console.log(this.formatLog('info', message, data));
  }

  warn(message: string, data?: Record<string, unknown>): void {
    console.warn(this.formatLog('warn', message, data));
  }

  error(message: string, error?: Error | unknown, data?: Record<string, unknown>): void {
    const errorData: Record<string, unknown> = { ...data };
    
    if (error instanceof Error) {
      errorData.errorName = error.name;
      errorData.errorMessage = error.message;
      errorData.errorStack = error.stack;
    } else if (error) {
      errorData.error = String(error);
    }
    
    console.error(this.formatLog('error', message, errorData));
  }

  // Add context for child operations
  child(additionalContext: LogContext): Logger {
    return new Logger(this.functionName, {
      ...this.context,
      ...additionalContext,
    });
  }

  // Get request ID for response headers
  getRequestId(): string {
    return this.context.requestId || '';
  }
}

// Metrics collector (in-memory for now, can be extended to external service)
class MetricsCollector {
  private metrics: MetricData[] = [];

  record(metric: MetricData): void {
    this.metrics.push({
      ...metric,
      tags: {
        ...metric.tags,
        timestamp: new Date().toISOString(),
      },
    });
    
    // Log metric for observability
    console.log(JSON.stringify({
      type: 'metric',
      ...metric,
      timestamp: new Date().toISOString(),
    }));
  }

  timing(name: string, durationMs: number, tags?: Record<string, string>): void {
    this.record({ name, value: durationMs, unit: 'ms', tags });
  }

  counter(name: string, value: number = 1, tags?: Record<string, string>): void {
    this.record({ name, value, unit: 'count', tags });
  }

  gauge(name: string, value: number, unit: MetricData['unit'] = 'count', tags?: Record<string, string>): void {
    this.record({ name, value, unit, tags });
  }

  getMetrics(): MetricData[] {
    return [...this.metrics];
  }

  clear(): void {
    this.metrics = [];
  }
}

export const metrics = new MetricsCollector();

// Trace/span utilities for distributed tracing
export interface Span {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  attributes: Record<string, unknown>;
  events: Array<{ name: string; timestamp: number; attributes?: Record<string, unknown> }>;
  status: 'ok' | 'error' | 'unset';
  error?: Error;
}

export class Tracer {
  private spans: Map<string, Span> = new Map();
  private requestId: string;

  constructor(requestId: string) {
    this.requestId = requestId;
  }

  startSpan(name: string, attributes: Record<string, unknown> = {}): string {
    const spanId = `span_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 5)}`;
    
    this.spans.set(spanId, {
      name,
      startTime: performance.now(),
      attributes: {
        ...attributes,
        requestId: this.requestId,
      },
      events: [],
      status: 'unset',
    });
    
    return spanId;
  }

  addEvent(spanId: string, eventName: string, attributes?: Record<string, unknown>): void {
    const span = this.spans.get(spanId);
    if (span) {
      span.events.push({
        name: eventName,
        timestamp: performance.now(),
        attributes,
      });
    }
  }

  endSpan(spanId: string, status: 'ok' | 'error' = 'ok', error?: Error): void {
    const span = this.spans.get(spanId);
    if (span) {
      span.endTime = performance.now();
      span.duration = span.endTime - span.startTime;
      span.status = status;
      span.error = error;
      
      // Log span completion
      console.log(JSON.stringify({
        type: 'span',
        requestId: this.requestId,
        spanId,
        name: span.name,
        durationMs: Math.round(span.duration),
        status: span.status,
        attributes: span.attributes,
        events: span.events.map(e => ({
          ...e,
          timestamp: Math.round(e.timestamp),
        })),
        error: span.error ? {
          name: span.error.name,
          message: span.error.message,
        } : undefined,
      }));
      
      // Record timing metric
      metrics.timing(`span.${span.name}`, span.duration, { status: span.status });
    }
  }

  // Convenience method for tracing async operations
  async trace<T>(
    name: string,
    operation: () => Promise<T>,
    attributes: Record<string, unknown> = {}
  ): Promise<T> {
    const spanId = this.startSpan(name, attributes);
    
    try {
      const result = await operation();
      this.endSpan(spanId, 'ok');
      return result;
    } catch (error) {
      this.endSpan(spanId, 'error', error as Error);
      throw error;
    }
  }

  getSpans(): Span[] {
    return Array.from(this.spans.values());
  }
}

// Error tracking utilities
export interface ErrorReport {
  name: string;
  message: string;
  stack?: string;
  context: LogContext;
  timestamp: string;
  fingerprint: string;
}

export function reportError(error: Error, context: LogContext): ErrorReport {
  const report: ErrorReport = {
    name: error.name,
    message: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
    fingerprint: generateErrorFingerprint(error),
  };
  
  console.error(JSON.stringify({
    type: 'error_report',
    ...report,
  }));
  
  return report;
}

function generateErrorFingerprint(error: Error): string {
  const input = `${error.name}:${error.message}:${error.stack?.split('\n')[1] || ''}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `err_${Math.abs(hash).toString(36)}`;
}

// Health check utilities
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, { status: 'pass' | 'fail' | 'warn'; message?: string; latencyMs?: number }>;
  timestamp: string;
}

export async function checkHealth(
  checks: Record<string, () => Promise<boolean>>
): Promise<HealthStatus> {
  const results: HealthStatus['checks'] = {};
  let overallHealthy = true;
  let hasDegraded = false;

  for (const [name, check] of Object.entries(checks)) {
    const startTime = performance.now();
    try {
      const passed = await check();
      const latencyMs = Math.round(performance.now() - startTime);
      
      results[name] = {
        status: passed ? 'pass' : 'fail',
        latencyMs,
      };
      
      if (!passed) {
        overallHealthy = false;
      }
      
      // Mark as degraded if check is slow (>1s)
      if (latencyMs > 1000) {
        hasDegraded = true;
        results[name].status = 'warn';
        results[name].message = 'Slow response';
      }
    } catch (error) {
      results[name] = {
        status: 'fail',
        message: (error as Error).message,
        latencyMs: Math.round(performance.now() - startTime),
      };
      overallHealthy = false;
    }
  }

  const status: HealthStatus = {
    status: overallHealthy ? (hasDegraded ? 'degraded' : 'healthy') : 'unhealthy',
    checks: results,
    timestamp: new Date().toISOString(),
  };

  console.log(JSON.stringify({ type: 'health_check', ...status }));
  
  return status;
}

// Request/Response tracking
export function trackRequest(
  logger: Logger,
  req: Request,
  functionName: string
): { logRequest: () => void; logResponse: (status: number, durationMs?: number) => void } {
  const startTime = performance.now();
  
  return {
    logRequest: () => {
      logger.info('Request received', {
        method: req.method,
        url: req.url,
        userAgent: req.headers.get('user-agent'),
        contentLength: req.headers.get('content-length'),
      });
      metrics.counter(`${functionName}.requests`);
    },
    logResponse: (status: number, durationMs?: number) => {
      const duration = durationMs ?? Math.round(performance.now() - startTime);
      logger.info('Response sent', {
        status,
        durationMs: duration,
      });
      metrics.timing(`${functionName}.latency`, duration);
      metrics.counter(`${functionName}.responses.${Math.floor(status / 100)}xx`);
    },
  };
}
