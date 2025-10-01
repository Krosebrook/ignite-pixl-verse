import * as Sentry from '@sentry/react';

// Check if Sentry is configured
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const ENVIRONMENT = import.meta.env.VITE_ENVIRONMENT || import.meta.env.MODE;
const RELEASE = import.meta.env.VITE_SENTRY_RELEASE || 'unknown';

export function initializeSentry() {
  if (!SENTRY_DSN) {
    console.warn('Sentry DSN not configured, error tracking disabled');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,
    release: RELEASE,
    
    // Performance Monitoring
    integrations: [
      Sentry.browserTracingIntegration({
        // Track navigation and router changes
        routingInstrumentation: Sentry.reactRouterV6Instrumentation(
          React.useEffect,
          useLocation,
          useNavigationType,
          createRoutesFromChildren,
          matchRoutes
        ),
      }),
      Sentry.replayIntegration({
        // Capture 10% of sessions for replay
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Performance monitoring sample rates
    tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
    
    // Session replay sample rates
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors

    // Filter out non-error events
    beforeSend(event, hint) {
      // Don't send events for cancelled requests
      const error = hint.originalException as any;
      if (error?.message?.includes('AbortError')) {
        return null;
      }

      // Add user context if available
      const user = getCurrentUser();
      if (user) {
        event.user = {
          id: user.id,
          email: user.email,
        };
      }

      return event;
    },

    // Add additional context
    initialScope: {
      tags: {
        app_version: RELEASE,
        environment: ENVIRONMENT,
      },
    },

    // Ignore specific errors
    ignoreErrors: [
      // Browser extensions
      'top.GLOBALS',
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      
      // Network errors
      'NetworkError',
      'Failed to fetch',
      
      // React suspense (expected)
      'Suspense',
    ],
  });
}

// Helper to get current user from Supabase
function getCurrentUser() {
  try {
    const userStr = localStorage.getItem('supabase.auth.token');
    if (userStr) {
      const { user } = JSON.parse(userStr);
      return user;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

// Custom error boundary wrapper
export function withSentryErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  options?: { fallback?: React.ReactNode; showDialog?: boolean }
) {
  return Sentry.withErrorBoundary(Component, {
    fallback: options?.fallback || <ErrorFallback />,
    showDialog: options?.showDialog || false,
  });
}

// Default error fallback UI
function ErrorFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full space-y-4 text-center">
        <h1 className="text-4xl font-display font-bold text-primary">
          Something went wrong
        </h1>
        <p className="text-muted-foreground">
          We've been notified and are working on a fix.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
        >
          Reload Page
        </button>
      </div>
    </div>
  );
}

// Manual error reporting
export function captureException(error: Error, context?: Record<string, any>) {
  Sentry.captureException(error, {
    extra: context,
  });
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
  Sentry.captureMessage(message, level);
}

// Performance tracking
export function startTransaction(name: string, op: string) {
  return Sentry.startTransaction({ name, op });
}

export function addBreadcrumb(breadcrumb: {
  message: string;
  category?: string;
  level?: 'info' | 'warning' | 'error';
  data?: Record<string, any>;
}) {
  Sentry.addBreadcrumb(breadcrumb);
}
