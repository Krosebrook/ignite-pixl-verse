/**
 * Shared HTTP utilities for edge functions
 * Provides consistent CORS headers, response helpers, and error handling
 */

// Standard CORS headers for all edge functions
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, idempotency-key, x-idempotency-key, x-request-id',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
} as const;

// Security headers
export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
} as const;

// Combined default headers
export const defaultHeaders = {
  ...corsHeaders,
  ...securityHeaders,
  'Content-Type': 'application/json',
} as const;

// Response helpers
export function jsonResponse<T>(
  data: T,
  status: number = 200,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...defaultHeaders, ...headers },
  });
}

export function successResponse<T>(data: T, headers?: Record<string, string>): Response {
  return jsonResponse(data, 200, headers);
}

export function createdResponse<T>(data: T, headers?: Record<string, string>): Response {
  return jsonResponse(data, 201, headers);
}

export function errorResponse(
  message: string,
  status: number = 500,
  code?: string,
  details?: unknown
): Response {
  const body: Record<string, unknown> = { error: message };
  if (code) body.code = code;
  if (details) body.details = details;
  
  return jsonResponse(body, status);
}

export function badRequestResponse(message: string, details?: unknown): Response {
  return errorResponse(message, 400, 'BAD_REQUEST', details);
}

export function unauthorizedResponse(message: string = 'Unauthorized'): Response {
  return errorResponse(message, 401, 'UNAUTHORIZED');
}

export function forbiddenResponse(message: string = 'Forbidden'): Response {
  return errorResponse(message, 403, 'FORBIDDEN');
}

export function notFoundResponse(message: string = 'Not found'): Response {
  return errorResponse(message, 404, 'NOT_FOUND');
}

export function rateLimitResponse(
  message: string = 'Rate limit exceeded',
  retryAfter?: number,
  remaining?: number
): Response {
  const headers: Record<string, string> = {};
  if (retryAfter) {
    headers['Retry-After'] = Math.ceil(retryAfter / 1000).toString();
    headers['X-RateLimit-Reset'] = new Date(Date.now() + retryAfter).toISOString();
  }
  if (remaining !== undefined) {
    headers['X-RateLimit-Remaining'] = remaining.toString();
  }
  
  return jsonResponse(
    { 
      error: message, 
      code: 'RATE_LIMIT_EXCEEDED',
      retry_after: retryAfter ? new Date(Date.now() + retryAfter).toISOString() : undefined,
    },
    429,
    headers
  );
}

export function serviceUnavailableResponse(
  message: string = 'Service temporarily unavailable',
  retryAfter?: number
): Response {
  const headers: Record<string, string> = {};
  if (retryAfter) {
    headers['Retry-After'] = Math.ceil(retryAfter / 1000).toString();
  }
  
  return jsonResponse(
    { error: message, code: 'SERVICE_UNAVAILABLE' },
    503,
    headers
  );
}

export function corsPreflightResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

// Request helpers
export function getAuthToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

export function getIdempotencyKey(req: Request): string | null {
  return req.headers.get('idempotency-key') || req.headers.get('x-idempotency-key');
}

export function getRequestId(req: Request): string {
  return req.headers.get('x-request-id') || 
    `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

// Parse JSON body with error handling
export async function parseJsonBody<T>(req: Request): Promise<T | null> {
  try {
    return await req.json() as T;
  } catch {
    return null;
  }
}

// Validate required fields
export function validateRequiredFields<T extends Record<string, unknown>>(
  body: T,
  fields: (keyof T)[]
): { valid: boolean; missing: string[] } {
  const missing = fields.filter(field => 
    body[field] === undefined || body[field] === null || body[field] === ''
  );
  
  return {
    valid: missing.length === 0,
    missing: missing as string[],
  };
}

// Extract and validate pagination params
export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export function getPaginationParams(
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
