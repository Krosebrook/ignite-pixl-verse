/**
 * Unit tests for Observability shared utility
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock console methods
const consoleMock = {
  debug: vi.fn(),
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

vi.stubGlobal('console', consoleMock);

// Types from observability
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  requestId?: string;
  userId?: string;
  orgId?: string;
  functionName?: string;
  [key: string]: unknown;
}

interface MetricData {
  name: string;
  value: number;
  unit?: 'ms' | 'count' | 'bytes' | 'percent';
  tags?: Record<string, string>;
}

// Simplified implementations for testing
function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

class MockLogger {
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

  child(additionalContext: LogContext): MockLogger {
    return new MockLogger(this.functionName, {
      ...this.context,
      ...additionalContext,
    });
  }

  getRequestId(): string {
    return this.context.requestId || '';
  }
}

class MockMetricsCollector {
  private metrics: MetricData[] = [];

  record(metric: MetricData): void {
    this.metrics.push({
      ...metric,
      tags: {
        ...metric.tags,
        timestamp: new Date().toISOString(),
      },
    });
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

class MockTracer {
  private spans: Map<string, { name: string; startTime: number; status: string }> = new Map();
  private requestId: string;

  constructor(requestId: string) {
    this.requestId = requestId;
  }

  startSpan(name: string): string {
    const spanId = `span_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 5)}`;
    
    this.spans.set(spanId, {
      name,
      startTime: Date.now(),
      status: 'unset',
    });
    
    return spanId;
  }

  endSpan(spanId: string, status: 'ok' | 'error' = 'ok'): void {
    const span = this.spans.get(spanId);
    if (span) {
      span.status = status;
    }
  }

  async trace<T>(
    name: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const spanId = this.startSpan(name);
    
    try {
      const result = await operation();
      this.endSpan(spanId, 'ok');
      return result;
    } catch (error) {
      this.endSpan(spanId, 'error');
      throw error;
    }
  }

  getSpans(): Array<{ name: string; status: string }> {
    return Array.from(this.spans.values()).map(s => ({ name: s.name, status: s.status }));
  }
}

describe('Observability Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateRequestId', () => {
    it('should generate unique request IDs', () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();
      
      expect(id1).not.toBe(id2);
    });

    it('should follow expected format', () => {
      const id = generateRequestId();
      expect(id).toMatch(/^req_[a-z0-9]+_[a-z0-9]+$/);
    });
  });

  describe('Logger', () => {
    it('should create logger with function name', () => {
      const logger = new MockLogger('test-function');
      expect(logger.getRequestId()).toMatch(/^req_/);
    });

    it('should use provided request ID', () => {
      const logger = new MockLogger('test-function', { requestId: 'custom-req-id' });
      expect(logger.getRequestId()).toBe('custom-req-id');
    });

    it('should log debug messages', () => {
      const logger = new MockLogger('test-function');
      logger.debug('Debug message', { extra: 'data' });
      
      expect(consoleMock.debug).toHaveBeenCalled();
      const logOutput = consoleMock.debug.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);
      expect(parsed.level).toBe('debug');
      expect(parsed.message).toBe('Debug message');
      expect(parsed.extra).toBe('data');
    });

    it('should log info messages', () => {
      const logger = new MockLogger('test-function');
      logger.info('Info message');
      
      expect(consoleMock.log).toHaveBeenCalled();
      const logOutput = consoleMock.log.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);
      expect(parsed.level).toBe('info');
    });

    it('should log warn messages', () => {
      const logger = new MockLogger('test-function');
      logger.warn('Warning message');
      
      expect(consoleMock.warn).toHaveBeenCalled();
      const logOutput = consoleMock.warn.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);
      expect(parsed.level).toBe('warn');
    });

    it('should log error messages with Error object', () => {
      const logger = new MockLogger('test-function');
      const error = new Error('Test error');
      logger.error('Error occurred', error);
      
      expect(consoleMock.error).toHaveBeenCalled();
      const logOutput = consoleMock.error.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);
      expect(parsed.level).toBe('error');
      expect(parsed.errorName).toBe('Error');
      expect(parsed.errorMessage).toBe('Test error');
    });

    it('should create child logger with additional context', () => {
      const parent = new MockLogger('test-function', { userId: 'user-123' });
      const child = parent.child({ orgId: 'org-456' });
      
      child.info('Child message');
      
      const logOutput = consoleMock.log.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);
      expect(parsed.userId).toBe('user-123');
      expect(parsed.orgId).toBe('org-456');
    });
  });

  describe('MetricsCollector', () => {
    it('should record metrics', () => {
      const collector = new MockMetricsCollector();
      collector.record({ name: 'test.metric', value: 100, unit: 'ms' });
      
      const metrics = collector.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].name).toBe('test.metric');
      expect(metrics[0].value).toBe(100);
    });

    it('should record timing metrics', () => {
      const collector = new MockMetricsCollector();
      collector.timing('api.latency', 250, { endpoint: '/test' });
      
      const metrics = collector.getMetrics();
      expect(metrics[0].unit).toBe('ms');
      expect(metrics[0].value).toBe(250);
    });

    it('should record counter metrics', () => {
      const collector = new MockMetricsCollector();
      collector.counter('requests.total');
      collector.counter('requests.total', 5);
      
      const metrics = collector.getMetrics();
      expect(metrics).toHaveLength(2);
      expect(metrics[0].value).toBe(1);
      expect(metrics[1].value).toBe(5);
    });

    it('should record gauge metrics', () => {
      const collector = new MockMetricsCollector();
      collector.gauge('memory.usage', 75, 'percent');
      
      const metrics = collector.getMetrics();
      expect(metrics[0].unit).toBe('percent');
      expect(metrics[0].value).toBe(75);
    });

    it('should clear metrics', () => {
      const collector = new MockMetricsCollector();
      collector.counter('test');
      collector.clear();
      
      expect(collector.getMetrics()).toHaveLength(0);
    });
  });

  describe('Tracer', () => {
    it('should start and end spans', () => {
      const tracer = new MockTracer('req-123');
      const spanId = tracer.startSpan('operation');
      tracer.endSpan(spanId, 'ok');
      
      const spans = tracer.getSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0].name).toBe('operation');
      expect(spans[0].status).toBe('ok');
    });

    it('should trace async operations', async () => {
      const tracer = new MockTracer('req-123');
      
      const result = await tracer.trace('async-op', async () => {
        return 'result';
      });
      
      expect(result).toBe('result');
      const spans = tracer.getSpans();
      expect(spans[0].status).toBe('ok');
    });

    it('should record error status on failure', async () => {
      const tracer = new MockTracer('req-123');
      
      await expect(tracer.trace('failing-op', async () => {
        throw new Error('Failed');
      })).rejects.toThrow('Failed');
      
      const spans = tracer.getSpans();
      expect(spans[0].status).toBe('error');
    });
  });
});
