/**
 * CSP Headers Edge Function
 * Returns Content Security Policy configuration for the frontend application
 * This can be used to dynamically fetch CSP headers or as a reference endpoint
 */

import { corsPreflightResponse, successResponse, errorResponse, corsHeaders } from '../_shared/http.ts';
import { Logger, generateRequestId } from '../_shared/observability.ts';

/**
 * Comprehensive CSP configuration for FlashFusion app
 * Designed to mitigate XSS, clickjacking, and data injection attacks
 */
const CSP_DIRECTIVES = {
  // Default: block everything unless explicitly allowed
  'default-src': ["'self'"],
  
  // Scripts: allow self, inline for React hydration (with nonce in production)
  'script-src': [
    "'self'",
    "'unsafe-inline'", // Required for Vite/React dev - should use nonces in production
    "https://cdn.jsdelivr.net", // For any CDN scripts
    "https://*.supabase.co", // Supabase JS client
  ],
  
  // Styles: allow self, inline styles (needed for Tailwind/styled-components)
  'style-src': [
    "'self'",
    "'unsafe-inline'", // Required for inline styles from CSS-in-JS
  ],
  
  // Images: allow self, data URIs (for inline images), and common image hosts
  'img-src': [
    "'self'",
    "data:",
    "blob:",
    "https://*.supabase.co", // Supabase storage
    "https://*.unsplash.com", // Stock images
    "https://*.cloudinary.com", // Image CDN
  ],
  
  // Fonts: allow self and common font CDNs
  'font-src': [
    "'self'",
    "data:",
    "https://fonts.gstatic.com",
  ],
  
  // Connect: API endpoints, WebSockets, etc.
  'connect-src': [
    "'self'",
    "https://*.supabase.co", // Supabase API
    "wss://*.supabase.co", // Supabase Realtime WebSocket
    "https://api.lovable.dev", // Lovable AI API
    "https://*.sentry.io", // Error tracking
    "https://*.posthog.com", // Analytics
    "https://api.openai.com", // OpenAI API (if used directly)
  ],
  
  // Media: audio/video sources
  'media-src': [
    "'self'",
    "blob:",
    "https://*.supabase.co",
  ],
  
  // Frames: prevent embedding in iframes (clickjacking protection)
  'frame-ancestors': ["'none'"],
  
  // Forms: only allow form submissions to self
  'form-action': ["'self'"],
  
  // Base URI: prevent base tag hijacking
  'base-uri': ["'self'"],
  
  // Object/embed: block plugins (Flash, Java, etc.)
  'object-src': ["'none'"],
  
  // Worker sources
  'worker-src': ["'self'", "blob:"],
  
  // Child sources (deprecated but kept for compatibility)
  'child-src': ["'self'", "blob:"],
  
  // Manifest for PWA
  'manifest-src': ["'self'"],
  
  // Upgrade insecure requests in production
  'upgrade-insecure-requests': [],
};

/**
 * Build CSP header string from directives
 */
function buildCspHeader(directives: Record<string, string[]>): string {
  return Object.entries(directives)
    .filter(([_, values]) => values.length >= 0) // Include directives with empty arrays (flags)
    .map(([directive, values]) => {
      if (values.length === 0) {
        return directive; // Flag directive like 'upgrade-insecure-requests'
      }
      return `${directive} ${values.join(' ')}`;
    })
    .join('; ');
}

/**
 * Generate CSP with optional nonce for inline scripts
 */
function generateCspWithNonce(nonce?: string): string {
  const directives = { ...CSP_DIRECTIVES };
  
  if (nonce) {
    // Add nonce to script-src for more secure inline script handling
    directives['script-src'] = [
      ...directives['script-src'].filter(v => v !== "'unsafe-inline'"),
      `'nonce-${nonce}'`,
    ];
  }
  
  return buildCspHeader(directives);
}

/**
 * Generate a cryptographically secure nonce
 */
function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
}

interface CspResponse {
  cspHeader: string;
  cspReportOnly?: string;
  nonce?: string;
  directives: Record<string, string[]>;
  recommendations: string[];
}

Deno.serve(async (req) => {
  const requestId = generateRequestId();
  const logger = new Logger('csp-headers', { requestId });
  
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
    const url = new URL(req.url);
    const includeNonce = url.searchParams.get('nonce') === 'true';
    const reportOnly = url.searchParams.get('report-only') === 'true';
    
    logger.info('CSP headers requested', { includeNonce, reportOnly });
    
    const nonce = includeNonce ? generateNonce() : undefined;
    const cspHeader = generateCspWithNonce(nonce);
    
    const response: CspResponse = {
      cspHeader,
      nonce,
      directives: CSP_DIRECTIVES,
      recommendations: [
        "Add this CSP header to your index.html: <meta http-equiv=\"Content-Security-Policy\" content=\"...\">",
        "For production, replace 'unsafe-inline' with nonces for better security",
        "Configure your CDN/reverse proxy to add these headers to all HTML responses",
        "Consider using Content-Security-Policy-Report-Only for testing new policies",
        "Set up a CSP violation reporting endpoint to monitor blocked content",
      ],
    };
    
    if (reportOnly) {
      response.cspReportOnly = cspHeader;
    }
    
    // Return response with actual CSP headers applied
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Content-Security-Policy': cspHeader,
      'X-Request-Id': requestId,
    };
    
    if (reportOnly) {
      headers['Content-Security-Policy-Report-Only'] = cspHeader;
    }
    
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, ...headers },
    });
  } catch (error) {
    logger.error('Failed to generate CSP headers', error);
    
    return errorResponse(
      'Failed to generate CSP headers',
      500,
      requestId,
      { error: (error as Error).message }
    );
  }
});
