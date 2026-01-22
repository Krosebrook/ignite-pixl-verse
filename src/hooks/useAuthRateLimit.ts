/**
 * Auth Rate Limiting Hook
 * Handles rate limiting for magic links and login attempts with progressive lockout
 */

import { useState, useCallback, useEffect } from 'react';

// Rate limiting constants
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_MAGIC_LINK_REQUESTS = 3;
const MAX_LOGIN_ATTEMPTS = 5;
const COOLDOWN_SECONDS = 60;

// CAPTCHA threshold - show CAPTCHA after this many failed attempts
const CAPTCHA_THRESHOLD = 3;

// Progressive lockout durations (in seconds): 5 min, 15 min, 1 hour
const LOCKOUT_DURATIONS = [300, 900, 3600];
const LOCKOUT_STORAGE_KEY = 'ff_lockout_level';
const LOCKOUT_RESET_HOURS = 24;

interface UseAuthRateLimitReturn {
  // Magic link rate limiting
  isRateLimited: boolean;
  rateLimitCooldown: number;
  checkRateLimit: () => boolean;
  trackMagicLinkRequest: () => void;
  
  // Login attempt tracking
  isLoginLocked: boolean;
  loginLockoutCooldown: number;
  lockoutLevel: number;
  getRemainingLoginAttempts: () => number;
  trackLoginAttempt: (userEmail?: string) => boolean;
  shouldShowCaptcha: () => boolean;
  
  // CAPTCHA state
  captchaVerified: boolean;
  setCaptchaVerified: (verified: boolean) => void;
  
  // Reset functions
  resetRateLimit: () => void;
  resetLoginAttempts: () => void;
}

export function useAuthRateLimit(
  onLockout?: (email: string, duration: number, level: number) => void
): UseAuthRateLimitReturn {
  // Magic link rate limiting state
  const [magicLinkRequests, setMagicLinkRequests] = useState<number[]>([]);
  const [rateLimitCooldown, setRateLimitCooldown] = useState(0);
  const [isRateLimited, setIsRateLimited] = useState(false);
  
  // Login attempt tracking with progressive lockout
  const [loginAttempts, setLoginAttempts] = useState<number[]>([]);
  const [loginLockoutCooldown, setLoginLockoutCooldown] = useState(0);
  const [isLoginLocked, setIsLoginLocked] = useState(false);
  const [lockoutLevel, setLockoutLevel] = useState(0);
  
  // CAPTCHA state
  const [captchaVerified, setCaptchaVerified] = useState(false);

  // Load lockout level from storage on mount
  useEffect(() => {
    const stored = localStorage.getItem(LOCKOUT_STORAGE_KEY);
    if (stored) {
      try {
        const { level, timestamp } = JSON.parse(stored);
        const hoursSinceLastLockout = (Date.now() - timestamp) / (1000 * 60 * 60);
        // Reset level if 24 hours have passed
        if (hoursSinceLastLockout >= LOCKOUT_RESET_HOURS) {
          localStorage.removeItem(LOCKOUT_STORAGE_KEY);
          setLockoutLevel(0);
        } else {
          setLockoutLevel(level);
        }
      } catch {
        localStorage.removeItem(LOCKOUT_STORAGE_KEY);
      }
    }
  }, []);

  // Rate limit cooldown timer
  useEffect(() => {
    if (rateLimitCooldown > 0) {
      const timer = setInterval(() => {
        setRateLimitCooldown((prev) => {
          if (prev <= 1) {
            setIsRateLimited(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [rateLimitCooldown]);

  // Login lockout cooldown timer
  useEffect(() => {
    if (loginLockoutCooldown > 0) {
      const timer = setInterval(() => {
        setLoginLockoutCooldown((prev) => {
          if (prev <= 1) {
            setIsLoginLocked(false);
            setLoginAttempts([]);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [loginLockoutCooldown]);

  // Check if rate limited for magic links
  const checkRateLimit = useCallback(() => {
    const now = Date.now();
    const recentRequests = magicLinkRequests.filter(
      (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS
    );
    setMagicLinkRequests(recentRequests);
    
    if (recentRequests.length >= MAX_MAGIC_LINK_REQUESTS) {
      const oldestRequest = Math.min(...recentRequests);
      const waitTime = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - oldestRequest)) / 1000);
      setRateLimitCooldown(waitTime);
      setIsRateLimited(true);
      return false;
    }
    return true;
  }, [magicLinkRequests]);

  // Track magic link request
  const trackMagicLinkRequest = useCallback(() => {
    setMagicLinkRequests((prev) => [...prev, Date.now()]);
  }, []);

  // Get remaining login attempts
  const getRemainingLoginAttempts = useCallback(() => {
    const now = Date.now();
    const recentAttempts = loginAttempts.filter(
      (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS * 5 // 5 minute window
    );
    return Math.max(0, MAX_LOGIN_ATTEMPTS - recentAttempts.length);
  }, [loginAttempts]);

  // Check if CAPTCHA should be shown
  const shouldShowCaptcha = useCallback(() => {
    const now = Date.now();
    const recentAttempts = loginAttempts.filter(
      (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS * 5
    );
    return recentAttempts.length >= CAPTCHA_THRESHOLD && !captchaVerified;
  }, [loginAttempts, captchaVerified]);

  // Track failed login attempt with progressive lockout
  const trackLoginAttempt = useCallback((userEmail?: string) => {
    const now = Date.now();
    const recentAttempts = loginAttempts.filter(
      (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS * 5
    );
    const newAttempts = [...recentAttempts, now];
    setLoginAttempts(newAttempts);
    
    if (newAttempts.length >= MAX_LOGIN_ATTEMPTS) {
      // Get current lockout duration and increment level
      const currentDuration = LOCKOUT_DURATIONS[Math.min(lockoutLevel, LOCKOUT_DURATIONS.length - 1)];
      const newLevel = Math.min(lockoutLevel + 1, LOCKOUT_DURATIONS.length - 1);
      
      setIsLoginLocked(true);
      setLoginLockoutCooldown(currentDuration);
      setLockoutLevel(newLevel);
      
      // Store lockout level with timestamp
      localStorage.setItem(LOCKOUT_STORAGE_KEY, JSON.stringify({
        level: newLevel,
        timestamp: now,
      }));
      
      // Trigger lockout callback if provided
      if (userEmail && onLockout) {
        onLockout(userEmail, currentDuration, newLevel);
      }
      
      return true; // Locked
    }
    return false; // Not locked
  }, [loginAttempts, lockoutLevel, onLockout]);

  // Reset functions
  const resetRateLimit = useCallback(() => {
    setMagicLinkRequests([]);
    setRateLimitCooldown(0);
    setIsRateLimited(false);
  }, []);

  const resetLoginAttempts = useCallback(() => {
    setLoginAttempts([]);
    setLoginLockoutCooldown(0);
    setIsLoginLocked(false);
    setCaptchaVerified(false);
  }, []);

  return {
    // Magic link rate limiting
    isRateLimited,
    rateLimitCooldown,
    checkRateLimit,
    trackMagicLinkRequest,
    
    // Login attempt tracking
    isLoginLocked,
    loginLockoutCooldown,
    lockoutLevel,
    getRemainingLoginAttempts,
    trackLoginAttempt,
    shouldShowCaptcha,
    
    // CAPTCHA state
    captchaVerified,
    setCaptchaVerified,
    
    // Reset functions
    resetRateLimit,
    resetLoginAttempts,
  };
}

// Export constants for use in other components
export const AUTH_RATE_LIMIT_CONSTANTS = {
  RATE_LIMIT_WINDOW_MS,
  MAX_MAGIC_LINK_REQUESTS,
  MAX_LOGIN_ATTEMPTS,
  COOLDOWN_SECONDS,
  CAPTCHA_THRESHOLD,
  LOCKOUT_DURATIONS,
  LOCKOUT_STORAGE_KEY,
  LOCKOUT_RESET_HOURS,
};
