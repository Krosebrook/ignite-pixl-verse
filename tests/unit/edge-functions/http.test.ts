/**
 * Unit tests for HTTP shared utility
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Response and Request for testing
class MockHeaders {
  private headers: Map<string, string> = new Map();
  
  get(key: string): string | null {
    return this.headers.get(key.toLowerCase()) || null;
  }
  
  set(key: string, value: string): void {
    this.headers.set(key.toLowerCase(), value);
  }
  
  has(key: string): boolean {
    return this.headers.has(key.toLowerCase());
  }
}

// HTTP utility functions (mirroring the actual implementation)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, idempotency-key, x-idempotency-key, x-request-id',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
};

const defaultHeaders = {
  ...corsHeaders,
  ...securityHeaders,
  'Content-Type': 'application/json',
};

function jsonResponse<T>(
  data: T,
  status: number = 200,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...defaultHeaders, ...headers },
  });
}

function successResponse<T>(data: T, headers?: Record<string, string>): Response {
  return jsonResponse(data, 200, headers);
}

function createdResponse<T>(data: T, headers?: Record<string, string>): Response {
  return jsonResponse(data, 201, headers);
}

function errorResponse(
  message: string,
  status: number = 500,
  requestId?: string,
  details?: unknown
): Response {
  const body: Record<string, unknown> = { error: message };
  if (details) body.details = details;
  
  const headers: Record<string, string> = {};
  if (requestId) {
    headers['X-Request-Id'] = requestId;
  }
  
  return jsonResponse(body, status, headers);
}

function badRequestResponse(message: string, requestId?: string, details?: unknown): Response {
  return errorResponse(message, 400, requestId, details);
}

function unauthorizedResponse(message: string = 'Unauthorized', requestId?: string): Response {
  return errorResponse(message, 401, requestId);
}

function notFoundResponse(message: string = 'Not found', requestId?: string): Response {
  return errorResponse(message, 404, requestId);
}

function rateLimitResponse(message: string = 'Rate limit exceeded', retryAfterSeconds?: number): Response {
  const headers: Record<string, string> = {};
  if (retryAfterSeconds) {
    headers['Retry-After'] = retryAfterSeconds.toString();
  }
  return jsonResponse({ error: message }, 429, headers);
}

function corsPreflightResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

function getAuthToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

function getIdempotencyKey(req: Request): string | null {
  return req.headers.get('idempotency-key') || req.headers.get('x-idempotency-key');
}

function getRequestId(req: Request): string {
  return req.headers.get('x-request-id') || 
    `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

function validateRequiredFields(
  body: Record<string, unknown>,
  fields: string[]
): { valid: boolean; missing: string[] } {
  const missing = fields.filter(field => 
    body[field] === undefined || body[field] === null || body[field] === ''
  );
  
  return {
    valid: missing.length === 0,
    missing,
  };
}

interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

function getPaginationParams(
  url: URL,
  defaultLimit: number = 20,
  maxLimit: number = 100
): PaginationParams {
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(
    maxLimit,
    Math.max(1, parseInt(url.searchParams.get('limit') || String(defaultLimit), 10))
  );
  
  return {
    page,
    limit,
    offset: (page - 1) * limit,
  };
}

describe('HTTP Utilities', () => {
  describe('Headers', () => {
    it('should include CORS headers', () => {
      expect(corsHeaders['Access-Control-Allow-Origin']).toBe('*');
      expect(corsHeaders['Access-Control-Allow-Methods']).toContain('GET');
      expect(corsHeaders['Access-Control-Allow-Methods']).toContain('POST');
    });

    it('should include security headers', () => {
      expect(securityHeaders['X-Content-Type-Options']).toBe('nosniff');
      expect(securityHeaders['X-Frame-Options']).toBe('DENY');
      expect(securityHeaders['X-XSS-Protection']).toBe('1; mode=block');
    });

    it('should combine all default headers', () => {
      expect(defaultHeaders['Content-Type']).toBe('application/json');
      expect(defaultHeaders['Access-Control-Allow-Origin']).toBe('*');
      expect(defaultHeaders['X-Content-Type-Options']).toBe('nosniff');
    });
  });

  describe('Response Helpers', () => {
    describe('jsonResponse', () => {
      it('should create response with correct status', async () => {
        const response = jsonResponse({ message: 'test' }, 201);
        expect(response.status).toBe(201);
      });

      it('should serialize data as JSON', async () => {
        const response = jsonResponse({ foo: 'bar' });
        const body = await response.json();
        expect(body.foo).toBe('bar');
      });

      it('should merge custom headers', async () => {
        const response = jsonResponse({ message: 'test' }, 200, { 'X-Custom': 'value' });
        expect(response.headers.get('X-Custom')).toBe('value');
        expect(response.headers.get('Content-Type')).toBe('application/json');
      });
    });

    describe('successResponse', () => {
      it('should return 200 status', async () => {
        const response = successResponse({ data: 'test' });
        expect(response.status).toBe(200);
      });
    });

    describe('createdResponse', () => {
      it('should return 201 status', async () => {
        const response = createdResponse({ id: '123' });
        expect(response.status).toBe(201);
      });
    });

    describe('errorResponse', () => {
      it('should return error with correct status', async () => {
        const response = errorResponse('Something went wrong', 500);
        expect(response.status).toBe(500);
        const body = await response.json();
        expect(body.error).toBe('Something went wrong');
      });

      it('should include request ID header when provided', async () => {
        const response = errorResponse('Error', 500, 'req-123');
        expect(response.headers.get('X-Request-Id')).toBe('req-123');
      });

      it('should include details when provided', async () => {
        const response = errorResponse('Error', 500, undefined, { field: 'value' });
        const body = await response.json();
        expect(body.details).toEqual({ field: 'value' });
      });
    });

    describe('badRequestResponse', () => {
      it('should return 400 status', async () => {
        const response = badRequestResponse('Invalid input');
        expect(response.status).toBe(400);
      });
    });

    describe('unauthorizedResponse', () => {
      it('should return 401 status', async () => {
        const response = unauthorizedResponse();
        expect(response.status).toBe(401);
      });

      it('should use default message', async () => {
        const response = unauthorizedResponse();
        const body = await response.json();
        expect(body.error).toBe('Unauthorized');
      });
    });

    describe('notFoundResponse', () => {
      it('should return 404 status', async () => {
        const response = notFoundResponse();
        expect(response.status).toBe(404);
      });
    });

    describe('rateLimitResponse', () => {
      it('should return 429 status', async () => {
        const response = rateLimitResponse();
        expect(response.status).toBe(429);
      });

      it('should include Retry-After header when provided', async () => {
        const response = rateLimitResponse('Rate limited', 60);
        expect(response.headers.get('Retry-After')).toBe('60');
      });
    });

    describe('corsPreflightResponse', () => {
      it('should return 204 status', () => {
        const response = corsPreflightResponse();
        expect(response.status).toBe(204);
      });

      it('should include CORS headers', () => {
        const response = corsPreflightResponse();
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      });
    });
  });

  describe('Request Helpers', () => {
    describe('getAuthToken', () => {
      it('should extract Bearer token', () => {
        const req = new Request('http://test.com', {
          headers: { 'Authorization': 'Bearer abc123' },
        });
        expect(getAuthToken(req)).toBe('abc123');
      });

      it('should return null for non-Bearer auth', () => {
        const req = new Request('http://test.com', {
          headers: { 'Authorization': 'Basic abc123' },
        });
        expect(getAuthToken(req)).toBe(null);
      });

      it('should return null for missing header', () => {
        const req = new Request('http://test.com');
        expect(getAuthToken(req)).toBe(null);
      });
    });

    describe('getIdempotencyKey', () => {
      it('should get idempotency-key header', () => {
        const req = new Request('http://test.com', {
          headers: { 'idempotency-key': 'key-123' },
        });
        expect(getIdempotencyKey(req)).toBe('key-123');
      });

      it('should get x-idempotency-key header', () => {
        const req = new Request('http://test.com', {
          headers: { 'x-idempotency-key': 'key-456' },
        });
        expect(getIdempotencyKey(req)).toBe('key-456');
      });

      it('should return null for missing header', () => {
        const req = new Request('http://test.com');
        expect(getIdempotencyKey(req)).toBe(null);
      });
    });

    describe('getRequestId', () => {
      it('should return provided request ID', () => {
        const req = new Request('http://test.com', {
          headers: { 'x-request-id': 'req-provided' },
        });
        expect(getRequestId(req)).toBe('req-provided');
      });

      it('should generate request ID if not provided', () => {
        const req = new Request('http://test.com');
        const id = getRequestId(req);
        expect(id).toMatch(/^req_[a-z0-9]+_[a-z0-9]+$/);
      });
    });
  });

  describe('Validation Helpers', () => {
    describe('validateRequiredFields', () => {
      it('should pass when all required fields present', () => {
        const body = { name: 'test', email: 'test@test.com' };
        const result = validateRequiredFields(body, ['name', 'email']);
        expect(result.valid).toBe(true);
        expect(result.missing).toEqual([]);
      });

      it('should fail when fields are missing', () => {
        const body = { name: 'test' };
        const result = validateRequiredFields(body, ['name', 'email']);
        expect(result.valid).toBe(false);
        expect(result.missing).toEqual(['email']);
      });

      it('should fail when fields are null', () => {
        const body = { name: 'test', email: null };
        const result = validateRequiredFields(body, ['name', 'email']);
        expect(result.valid).toBe(false);
        expect(result.missing).toContain('email');
      });

      it('should fail when fields are empty string', () => {
        const body = { name: 'test', email: '' };
        const result = validateRequiredFields(body, ['name', 'email']);
        expect(result.valid).toBe(false);
        expect(result.missing).toContain('email');
      });
    });
  });

  describe('Pagination Helpers', () => {
    describe('getPaginationParams', () => {
      it('should return default values', () => {
        const url = new URL('http://test.com/api');
        const params = getPaginationParams(url);
        expect(params.page).toBe(1);
        expect(params.limit).toBe(20);
        expect(params.offset).toBe(0);
      });

      it('should parse page and limit from query', () => {
        const url = new URL('http://test.com/api?page=3&limit=50');
        const params = getPaginationParams(url);
        expect(params.page).toBe(3);
        expect(params.limit).toBe(50);
        expect(params.offset).toBe(100);
      });

      it('should enforce max limit', () => {
        const url = new URL('http://test.com/api?limit=500');
        const params = getPaginationParams(url, 20, 100);
        expect(params.limit).toBe(100);
      });

      it('should enforce minimum page of 1', () => {
        const url = new URL('http://test.com/api?page=-5');
        const params = getPaginationParams(url);
        expect(params.page).toBe(1);
      });

      it('should enforce minimum limit of 1', () => {
        const url = new URL('http://test.com/api?limit=0');
        const params = getPaginationParams(url);
        expect(params.limit).toBe(1);
      });

      it('should use custom default limit', () => {
        const url = new URL('http://test.com/api');
        const params = getPaginationParams(url, 50);
        expect(params.limit).toBe(50);
      });
    });
  });
});
