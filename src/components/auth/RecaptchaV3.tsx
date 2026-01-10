import { useEffect, useCallback, useRef } from 'react';

// Extend window to include grecaptcha
declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

interface RecaptchaV3Props {
  siteKey: string;
  onVerify?: (token: string) => void;
  onError?: (error: Error) => void;
  action?: string;
  children?: React.ReactNode;
}

export function useRecaptchaV3(siteKey: string | undefined) {
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!siteKey || loadedRef.current) return;

    // Check if script is already loaded
    const existingScript = document.querySelector(`script[src*="recaptcha/api.js"]`);
    if (existingScript) {
      loadedRef.current = true;
      return;
    }

    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      loadedRef.current = true;
    };

    script.onerror = () => {
      console.error('Failed to load reCAPTCHA script');
    };

    document.head.appendChild(script);

    return () => {
      // Don't remove the script on cleanup to avoid issues with React strict mode
    };
  }, [siteKey]);

  const executeRecaptcha = useCallback(async (action: string): Promise<string | null> => {
    if (!siteKey) {
      console.warn('reCAPTCHA site key not configured');
      return null;
    }

    if (typeof window === 'undefined' || !window.grecaptcha) {
      console.warn('reCAPTCHA not loaded');
      return null;
    }

    return new Promise((resolve) => {
      window.grecaptcha.ready(async () => {
        try {
          const token = await window.grecaptcha.execute(siteKey, { action });
          resolve(token);
        } catch (error) {
          console.error('reCAPTCHA execution error:', error);
          resolve(null);
        }
      });
    });
  }, [siteKey]);

  const verifyToken = useCallback(async (
    token: string, 
    action?: string,
    minScore?: number
  ): Promise<{ success: boolean; score?: number; error?: string }> => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/security-activity/verify-recaptcha`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            token,
            action,
            min_score: minScore,
          }),
        }
      );

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('reCAPTCHA verification error:', error);
      return { success: false, error: 'Verification failed' };
    }
  }, []);

  return { executeRecaptcha, verifyToken, isLoaded: loadedRef.current };
}

export function RecaptchaV3Provider({ 
  siteKey, 
  children,
  onVerify,
  onError,
  action = 'submit'
}: RecaptchaV3Props) {
  const { executeRecaptcha, verifyToken } = useRecaptchaV3(siteKey);

  const handleVerify = useCallback(async () => {
    try {
      const token = await executeRecaptcha(action);
      if (token) {
        const result = await verifyToken(token, action);
        if (result.success && onVerify) {
          onVerify(token);
        } else if (!result.success && onError) {
          onError(new Error(result.error || 'Verification failed'));
        }
      }
    } catch (error) {
      if (onError && error instanceof Error) {
        onError(error);
      }
    }
  }, [executeRecaptcha, verifyToken, action, onVerify, onError]);

  return <>{children}</>;
}

// Hook for use in forms
export function useRecaptchaProtection() {
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  const { executeRecaptcha, verifyToken, isLoaded } = useRecaptchaV3(siteKey);

  const protectAction = useCallback(async (
    action: string,
    minScore: number = 0.5
  ): Promise<{ allowed: boolean; score?: number; error?: string }> => {
    // If reCAPTCHA is not configured, allow the action
    if (!siteKey) {
      return { allowed: true };
    }

    // If script hasn't loaded yet, allow with warning
    if (!isLoaded) {
      console.warn('reCAPTCHA not loaded yet, allowing action');
      return { allowed: true };
    }

    try {
      const token = await executeRecaptcha(action);
      if (!token) {
        return { allowed: true }; // Allow if we can't get a token
      }

      const result = await verifyToken(token, action, minScore);
      return {
        allowed: result.success,
        score: result.score,
        error: result.error,
      };
    } catch (error) {
      console.error('reCAPTCHA protection error:', error);
      return { allowed: true }; // Fail open to not block legitimate users
    }
  }, [siteKey, isLoaded, executeRecaptcha, verifyToken]);

  return { protectAction, isReady: !!siteKey && isLoaded };
}
