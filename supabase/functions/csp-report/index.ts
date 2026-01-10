/**
 * CSP Violation Reporting Edge Function
 * Receives and logs Content-Security-Policy violation reports
 * Provides monitoring and alerting for blocked content attempts
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsPreflightResponse, corsHeaders, badRequestResponse, errorResponse } from '../_shared/http.ts';
import { Logger, generateRequestId, metrics } from '../_shared/observability.ts';
import { sanitizeForStorage } from '../_shared/sanitize.ts';

// In-memory rate limiting (per instance, resets on cold start)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkInMemoryRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  
  if (entry.count >= limit) {
    return false;
  }
  
  entry.count++;
  return true;
}

// In-memory violation tracking (per instance)
const violationCounts = new Map<string, { count: number; sources: Set<string>; lastSeen: number }>();

/**
 * CSP Violation Report structure (as per W3C spec)
 * https://www.w3.org/TR/CSP3/#violation-reports
 */
interface CspViolationReport {
  'csp-report'?: {
    'document-uri'?: string;
    'referrer'?: string;
    'violated-directive'?: string;
    'effective-directive'?: string;
    'original-policy'?: string;
    'disposition'?: 'enforce' | 'report';
    'blocked-uri'?: string;
    'line-number'?: number;
    'column-number'?: number;
    'source-file'?: string;
    'status-code'?: number;
    'script-sample'?: string;
  };
  // Modern Reporting API format
  type?: string;
  age?: number;
  url?: string;
  user_agent?: string;
  body?: {
    documentURL?: string;
    referrer?: string;
    violatedDirective?: string;
    effectiveDirective?: string;
    originalPolicy?: string;
    disposition?: string;
    blockedURL?: string;
    lineNumber?: number;
    columnNumber?: number;
    sourceFile?: string;
    statusCode?: number;
    sample?: string;
  };
}

interface ViolationSummary {
  directive: string;
  blockedUri: string;
  count: number;
  lastSeen: string;
  sources: string[];
}

interface AlertThreshold {
  directive: string;
  maxPerHour: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// Alert thresholds for different violation types
const ALERT_THRESHOLDS: AlertThreshold[] = [
  { directive: 'script-src', maxPerHour: 10, severity: 'critical' },
  { directive: 'object-src', maxPerHour: 5, severity: 'critical' },
  { directive: 'base-uri', maxPerHour: 5, severity: 'critical' },
  { directive: 'form-action', maxPerHour: 10, severity: 'high' },
  { directive: 'frame-ancestors', maxPerHour: 20, severity: 'high' },
  { directive: 'connect-src', maxPerHour: 50, severity: 'medium' },
  { directive: 'img-src', maxPerHour: 100, severity: 'low' },
  { directive: 'style-src', maxPerHour: 100, severity: 'low' },
];

// Known false positive patterns to filter out
const FALSE_POSITIVE_PATTERNS = [
  /^chrome-extension:/,
  /^moz-extension:/,
  /^safari-extension:/,
  /^about:/,
  /^blob:/,
  // Browser dev tools
  /devtools/i,
  // Common ad blockers
  /adblock/i,
  /ublock/i,
];

function isFalsePositive(blockedUri: string): boolean {
  return FALSE_POSITIVE_PATTERNS.some(pattern => pattern.test(blockedUri));
}

function normalizeReport(report: CspViolationReport): {
  documentUri: string;
  violatedDirective: string;
  blockedUri: string;
  sourceFile: string;
  lineNumber: number;
  disposition: string;
} {
  // Handle both legacy and modern report formats
  const legacyReport = report['csp-report'];
  const modernBody = report.body;

  return {
    documentUri: sanitizeForStorage(
      legacyReport?.['document-uri'] || modernBody?.documentURL || report.url || 'unknown',
      500
    ),
    violatedDirective: sanitizeForStorage(
      legacyReport?.['violated-directive'] || 
      legacyReport?.['effective-directive'] || 
      modernBody?.violatedDirective ||
      modernBody?.effectiveDirective ||
      'unknown',
      100
    ),
    blockedUri: sanitizeForStorage(
      legacyReport?.['blocked-uri'] || modernBody?.blockedURL || 'unknown',
      500
    ),
    sourceFile: sanitizeForStorage(
      legacyReport?.['source-file'] || modernBody?.sourceFile || 'unknown',
      500
    ),
    lineNumber: legacyReport?.['line-number'] || modernBody?.lineNumber || 0,
    disposition: legacyReport?.disposition || modernBody?.disposition || 'enforce',
  };
}

function incrementViolationCount(
  directive: string,
  blockedUri: string,
  sourceFile: string
): number {
  const hourKey = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
  const key = `${hourKey}:${directive}`;
  
  const current = violationCounts.get(key);
  
  if (!current) {
    violationCounts.set(key, {
      count: 1,
      sources: new Set([sourceFile]),
      lastSeen: Date.now(),
    });
    return 1;
  }
  
  current.count++;
  current.lastSeen = Date.now();
  if (current.sources.size < 10) {
    current.sources.add(sourceFile);
  }
  
  return current.count;
}

function checkAlertThreshold(
  directive: string,
  count: number,
  logger: Logger
): { shouldAlert: boolean; severity: string } | null {
  const threshold = ALERT_THRESHOLDS.find(t => directive.includes(t.directive));
  
  if (!threshold) {
    return null;
  }
  
  if (count >= threshold.maxPerHour) {
    logger.warn('CSP violation threshold exceeded', {
      directive,
      count,
      threshold: threshold.maxPerHour,
      severity: threshold.severity,
    });
    
    return { shouldAlert: true, severity: threshold.severity };
  }
  
  return { shouldAlert: false, severity: threshold.severity };
}

function getViolationSummary(): ViolationSummary[] {
  const summaries: ViolationSummary[] = [];
  const hourKey = new Date().toISOString().slice(0, 13);
  
  // Iterate through known directives
  for (const threshold of ALERT_THRESHOLDS) {
    const key = `${hourKey}:${threshold.directive}`;
    const data = violationCounts.get(key);
    
    if (data && data.count > 0) {
      summaries.push({
        directive: threshold.directive,
        blockedUri: 'various',
        count: data.count,
        lastSeen: new Date(data.lastSeen).toISOString(),
        sources: Array.from(data.sources),
      });
    }
  }
  
  return summaries;
}

Deno.serve(async (req) => {
  const requestId = generateRequestId();
  const logger = new Logger('csp-report', { requestId });
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return corsPreflightResponse();
  }
  
  const url = new URL(req.url);
  
  // GET endpoint for retrieving violation summary
  if (req.method === 'GET') {
    try {
      const summary = getViolationSummary();
      
      return new Response(JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        violations: summary,
        thresholds: ALERT_THRESHOLDS,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      logger.error('Failed to get violation summary', error);
      return errorResponse('Failed to get summary', 500, requestId);
    }
  }
  
  // POST endpoint for receiving violation reports
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  try {
    // Rate limiting - generous limit since browsers may batch reports
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     'anonymous';
    
    const isAllowed = checkInMemoryRateLimit(`csp:${clientIp}`, 1000, 60000);
    
    if (!isAllowed) {
      logger.warn('CSP report rate limit exceeded', { clientIp });
      return new Response(null, { status: 429 });
    }
    
    // Parse the report
    const contentType = req.headers.get('content-type') || '';
    let report: CspViolationReport;
    
    if (contentType.includes('application/csp-report') || 
        contentType.includes('application/json') ||
        contentType.includes('application/reports+json')) {
      report = await req.json();
    } else {
      return badRequestResponse('Invalid content type', requestId);
    }
    
    // Normalize the report
    const normalized = normalizeReport(report);
    
    // Filter out known false positives
    if (isFalsePositive(normalized.blockedUri)) {
      logger.debug('Filtered false positive CSP report', { 
        blockedUri: normalized.blockedUri.slice(0, 100) 
      });
      return new Response(null, { status: 204 });
    }
    
    // Log the violation
    logger.info('CSP violation received', {
      directive: normalized.violatedDirective,
      blockedUri: normalized.blockedUri.slice(0, 200),
      documentUri: normalized.documentUri.slice(0, 200),
      sourceFile: normalized.sourceFile.slice(0, 200),
      lineNumber: normalized.lineNumber,
      disposition: normalized.disposition,
    });
    
    // Increment counter and check thresholds
    const count = incrementViolationCount(
      normalized.violatedDirective,
      normalized.blockedUri,
      normalized.sourceFile
    );
    
    const alertCheck = checkAlertThreshold(
      normalized.violatedDirective,
      count,
      logger
    );
    
    // Track metrics
    metrics.counter('csp.violations.total');
    metrics.counter(`csp.violations.${normalized.violatedDirective.split(' ')[0] || 'unknown'}`);
    
    if (alertCheck?.shouldAlert) {
      metrics.counter(`csp.alerts.${alertCheck.severity}`);
      
      // In production, you would send to alerting system here
      // e.g., PagerDuty, Slack, email, etc.
      logger.error('CSP ALERT: High volume of violations detected', {
        directive: normalized.violatedDirective,
        count,
        severity: alertCheck.severity,
      });
    }
    
    // Return 204 No Content (standard for report endpoints)
    return new Response(null, { status: 204 });
  } catch (error) {
    logger.error('Failed to process CSP report', error);
    
    // Still return 204 to avoid browser retries
    return new Response(null, { status: 204 });
  }
});
