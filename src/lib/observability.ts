/**
 * Observability & Analytics Setup
 * 
 * Integrates:
 * - OpenTelemetry for distributed tracing (simplified for browser)
 * - PostHog for product analytics
 * - Performance monitoring
 */

import posthog from 'posthog-js';

// Configuration
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com';
const ENVIRONMENT = import.meta.env.VITE_ENVIRONMENT || import.meta.env.MODE;

// Simplified trace tracking for browser
const traces: Array<{
  name: string;
  startTime: number;
  endTime?: number;
  status?: 'ok' | 'error';
  attributes?: Record<string, any>;
}> = [];

// Initialize OpenTelemetry (simplified for browser)
export function initializeOpenTelemetry() {
  if (ENVIRONMENT !== 'production' && ENVIRONMENT !== 'staging') {
    console.log('OpenTelemetry disabled in development');
    return;
  }

  // Simplified browser-based tracing
  // In production, consider using Sentry Performance Monitoring instead
  console.log('✅ OpenTelemetry (simplified) initialized');
}

// Initialize PostHog
export function initializePostHog() {
  if (!POSTHOG_KEY) {
    console.warn('PostHog key not configured, analytics disabled');
    return;
  }

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    loaded: (posthog) => {
      if (ENVIRONMENT === 'development') {
        posthog.opt_out_capturing();
        console.log('PostHog capturing disabled in development');
      }
    },
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: {
      dom_event_allowlist: ['click', 'submit', 'change'],
      url_allowlist: [window.location.origin],
    },
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: '[data-private]',
    },
  });

  console.log('✅ PostHog initialized');
}

/**
 * Track a custom span for performance monitoring (simplified)
 */
export async function traceOperation<T>(
  name: string,
  operation: () => Promise<T> | T,
  attributes?: Record<string, string | number | boolean>
): Promise<T> {
  const startTime = performance.now();
  
  try {
    const result = await operation();
    const endTime = performance.now();
    
    traces.push({
      name,
      startTime,
      endTime,
      status: 'ok',
      attributes,
    });
    
    // Track in analytics
    trackEvent('trace_operation', {
      operation: name,
      duration_ms: endTime - startTime,
      ...attributes,
    });
    
    return result;
  } catch (error) {
    const endTime = performance.now();
    
    traces.push({
      name,
      startTime,
      endTime,
      status: 'error',
      attributes,
    });
    
    throw error;
  }
}

/**
 * Track analytics events
 */
export function trackEvent(
  eventName: string,
  properties?: Record<string, any>
) {
  if (!POSTHOG_KEY) return;

  posthog.capture(eventName, {
    ...properties,
    $set: {
      environment: ENVIRONMENT,
    },
  });

  // Also add as breadcrumb for error correlation
  addBreadcrumb({
    category: 'analytics',
    message: `Event: ${eventName}`,
    data: properties,
  });
}

/**
 * Identify user for analytics
 */
export function identifyUser(userId: string, properties?: Record<string, any>) {
  if (!POSTHOG_KEY) return;

  posthog.identify(userId, properties);
}

/**
 * Track page views
 */
export function trackPageView(pageName: string, properties?: Record<string, any>) {
  if (!POSTHOG_KEY) return;

  posthog.capture('$pageview', {
    $current_url: window.location.href,
    page_name: pageName,
    ...properties,
  });
}

/**
 * Add breadcrumb for debugging
 */
function addBreadcrumb(breadcrumb: {
  category: string;
  message: string;
  data?: Record<string, any>;
}) {
  // This would integrate with Sentry
  console.debug('[Breadcrumb]', breadcrumb);
}

/**
 * Track API call performance
 */
export function trackAPICall(
  endpoint: string,
  method: string,
  duration: number,
  status: number
) {
  // Track in analytics
  trackEvent('api_call', {
    endpoint,
    method,
    duration,
    status,
    success: status >= 200 && status < 400,
  });
}

/**
 * Track user actions
 */
export const Analytics = {
  // Content generation
  contentGenerated: (type: 'text' | 'image', duration: number) => {
    trackEvent('content_generated', { type, duration_ms: duration });
  },

  contentSaved: (type: string, assetId: string) => {
    trackEvent('content_saved', { type, asset_id: assetId });
  },

  // Campaign actions
  campaignCreated: (campaignId: string, platforms: string[]) => {
    trackEvent('campaign_created', { campaign_id: campaignId, platforms });
  },

  campaignScheduled: (campaignId: string, postCount: number) => {
    trackEvent('campaign_scheduled', { campaign_id: campaignId, post_count: postCount });
  },

  // User lifecycle
  userSignedUp: (userId: string, method: string) => {
    identifyUser(userId);
    trackEvent('user_signed_up', { method });
  },

  userLoggedIn: (userId: string) => {
    identifyUser(userId);
    trackEvent('user_logged_in');
  },

  // Feature usage
  featureUsed: (featureName: string, context?: Record<string, any>) => {
    trackEvent('feature_used', { feature: featureName, ...context });
  },

  // Errors
  errorOccurred: (errorType: string, message: string, context?: Record<string, any>) => {
    trackEvent('error_occurred', {
      error_type: errorType,
      message,
      ...context,
    });
  },
};

/**
 * Performance metrics tracking
 */
export function trackPerformanceMetrics() {
  if (typeof window === 'undefined' || !window.performance) return;

  // Track Core Web Vitals
  if ('PerformanceObserver' in window) {
    // LCP (Largest Contentful Paint)
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1] as any;
      
      trackEvent('web_vital_lcp', {
        value: lastEntry.renderTime || lastEntry.loadTime,
        rating: lastEntry.renderTime < 2500 ? 'good' : lastEntry.renderTime < 4000 ? 'needs-improvement' : 'poor',
      });
    });
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

    // FID (First Input Delay)
    const fidObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        trackEvent('web_vital_fid', {
          value: entry.processingStart - entry.startTime,
          rating: entry.processingStart - entry.startTime < 100 ? 'good' : entry.processingStart - entry.startTime < 300 ? 'needs-improvement' : 'poor',
        });
      });
    });
    fidObserver.observe({ type: 'first-input', buffered: true });

    // CLS (Cumulative Layout Shift)
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as any[]) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      }
      
      trackEvent('web_vital_cls', {
        value: clsValue,
        rating: clsValue < 0.1 ? 'good' : clsValue < 0.25 ? 'needs-improvement' : 'poor',
      });
    });
    clsObserver.observe({ type: 'layout-shift', buffered: true });
  }

  // Track navigation timing
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  if (navigation) {
    trackEvent('page_load_timing', {
      ttfb: navigation.responseStart - navigation.requestStart,
      dom_load: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
      window_load: navigation.loadEventEnd - navigation.loadEventStart,
      total: navigation.loadEventEnd - navigation.fetchStart,
    });
  }
}

// Auto-initialize on module load
if (typeof window !== 'undefined') {
  initializeOpenTelemetry();
  initializePostHog();
  
  // Track performance after page load
  window.addEventListener('load', () => {
    setTimeout(trackPerformanceMetrics, 0);
  });
}
