/**
 * Integration tests for useAuthRateLimit hook
 * Tests rate limiting, progressive lockout, and CAPTCHA logic
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { 
  useAuthRateLimit, 
  AUTH_RATE_LIMIT_CONSTANTS 
} from '@/hooks/useAuthRateLimit';

describe('useAuthRateLimit Hook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });
  
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });
  
  describe('Magic Link Rate Limiting', () => {
    it('should allow requests under the limit', () => {
      const { result } = renderHook(() => useAuthRateLimit());
      
      expect(result.current.isRateLimited).toBe(false);
      expect(result.current.checkRateLimit()).toBe(true);
    });
    
    it('should track magic link requests', () => {
      const { result } = renderHook(() => useAuthRateLimit());
      
      // Make first request
      act(() => {
        result.current.trackMagicLinkRequest();
      });
      
      expect(result.current.checkRateLimit()).toBe(true);
    });
    
    it('should rate limit after max requests', () => {
      const { result } = renderHook(() => useAuthRateLimit());
      
      // Make max requests
      for (let i = 0; i < AUTH_RATE_LIMIT_CONSTANTS.MAX_MAGIC_LINK_REQUESTS; i++) {
        act(() => {
          result.current.trackMagicLinkRequest();
        });
      }
      
      act(() => {
        const isAllowed = result.current.checkRateLimit();
        expect(isAllowed).toBe(false);
      });
      
      expect(result.current.isRateLimited).toBe(true);
      expect(result.current.rateLimitCooldown).toBeGreaterThan(0);
    });
    
    it('should reset rate limit after cooldown', () => {
      const { result } = renderHook(() => useAuthRateLimit());
      
      // Trigger rate limit
      for (let i = 0; i < AUTH_RATE_LIMIT_CONSTANTS.MAX_MAGIC_LINK_REQUESTS; i++) {
        act(() => {
          result.current.trackMagicLinkRequest();
        });
      }
      
      act(() => {
        result.current.checkRateLimit();
      });
      
      expect(result.current.isRateLimited).toBe(true);
      
      // Fast-forward past the rate limit window
      act(() => {
        vi.advanceTimersByTime(AUTH_RATE_LIMIT_CONSTANTS.RATE_LIMIT_WINDOW_MS + 1000);
      });
      
      // Advance timers for cooldown countdown
      act(() => {
        for (let i = 0; i < 70; i++) {
          vi.advanceTimersByTime(1000);
        }
      });
      
      expect(result.current.isRateLimited).toBe(false);
    });
    
    it('should manually reset rate limit', () => {
      const { result } = renderHook(() => useAuthRateLimit());
      
      // Trigger rate limit
      for (let i = 0; i < AUTH_RATE_LIMIT_CONSTANTS.MAX_MAGIC_LINK_REQUESTS; i++) {
        act(() => {
          result.current.trackMagicLinkRequest();
        });
      }
      
      act(() => {
        result.current.checkRateLimit();
      });
      
      expect(result.current.isRateLimited).toBe(true);
      
      act(() => {
        result.current.resetRateLimit();
      });
      
      expect(result.current.isRateLimited).toBe(false);
      expect(result.current.rateLimitCooldown).toBe(0);
    });
  });
  
  describe('Login Attempt Tracking', () => {
    it('should start with full login attempts', () => {
      const { result } = renderHook(() => useAuthRateLimit());
      
      expect(result.current.getRemainingLoginAttempts()).toBe(
        AUTH_RATE_LIMIT_CONSTANTS.MAX_LOGIN_ATTEMPTS
      );
      expect(result.current.isLoginLocked).toBe(false);
    });
    
    it('should track failed login attempts', () => {
      const { result } = renderHook(() => useAuthRateLimit());
      
      act(() => {
        result.current.trackLoginAttempt('test@example.com');
      });
      
      expect(result.current.getRemainingLoginAttempts()).toBe(
        AUTH_RATE_LIMIT_CONSTANTS.MAX_LOGIN_ATTEMPTS - 1
      );
    });
    
    it('should lock after max login attempts', () => {
      const { result } = renderHook(() => useAuthRateLimit());
      
      // Make max attempts
      for (let i = 0; i < AUTH_RATE_LIMIT_CONSTANTS.MAX_LOGIN_ATTEMPTS; i++) {
        act(() => {
          result.current.trackLoginAttempt('test@example.com');
        });
      }
      
      expect(result.current.isLoginLocked).toBe(true);
      expect(result.current.loginLockoutCooldown).toBeGreaterThan(0);
    });
    
    it('should return true when locked', () => {
      const { result } = renderHook(() => useAuthRateLimit());
      let isLocked = false;
      
      // Make max attempts
      for (let i = 0; i < AUTH_RATE_LIMIT_CONSTANTS.MAX_LOGIN_ATTEMPTS; i++) {
        act(() => {
          isLocked = result.current.trackLoginAttempt('test@example.com');
        });
      }
      
      expect(isLocked).toBe(true);
    });
    
    it('should manually reset login attempts', () => {
      const { result } = renderHook(() => useAuthRateLimit());
      
      // Make some attempts
      for (let i = 0; i < 3; i++) {
        act(() => {
          result.current.trackLoginAttempt('test@example.com');
        });
      }
      
      expect(result.current.getRemainingLoginAttempts()).toBeLessThan(
        AUTH_RATE_LIMIT_CONSTANTS.MAX_LOGIN_ATTEMPTS
      );
      
      act(() => {
        result.current.resetLoginAttempts();
      });
      
      expect(result.current.getRemainingLoginAttempts()).toBe(
        AUTH_RATE_LIMIT_CONSTANTS.MAX_LOGIN_ATTEMPTS
      );
      expect(result.current.isLoginLocked).toBe(false);
    });
  });
  
  describe('Progressive Lockout', () => {
    it('should start at lockout level 0', () => {
      const { result } = renderHook(() => useAuthRateLimit());
      
      expect(result.current.lockoutLevel).toBe(0);
    });
    
    it('should increment lockout level on each lockout', () => {
      const { result } = renderHook(() => useAuthRateLimit());
      
      // First lockout
      for (let i = 0; i < AUTH_RATE_LIMIT_CONSTANTS.MAX_LOGIN_ATTEMPTS; i++) {
        act(() => {
          result.current.trackLoginAttempt('test@example.com');
        });
      }
      
      expect(result.current.lockoutLevel).toBe(1);
    });
    
    it('should persist lockout level to localStorage', () => {
      const { result } = renderHook(() => useAuthRateLimit());
      
      // Trigger lockout
      for (let i = 0; i < AUTH_RATE_LIMIT_CONSTANTS.MAX_LOGIN_ATTEMPTS; i++) {
        act(() => {
          result.current.trackLoginAttempt('test@example.com');
        });
      }
      
      const stored = localStorage.getItem(AUTH_RATE_LIMIT_CONSTANTS.LOCKOUT_STORAGE_KEY);
      expect(stored).not.toBeNull();
      
      const parsed = JSON.parse(stored!);
      expect(parsed.level).toBe(1);
      expect(parsed.timestamp).toBeDefined();
    });
    
    it('should load lockout level from localStorage on mount', () => {
      // Pre-set lockout level
      localStorage.setItem(AUTH_RATE_LIMIT_CONSTANTS.LOCKOUT_STORAGE_KEY, JSON.stringify({
        level: 2,
        timestamp: Date.now(),
      }));
      
      const { result } = renderHook(() => useAuthRateLimit());
      
      expect(result.current.lockoutLevel).toBe(2);
    });
    
    it('should reset lockout level after 24 hours', () => {
      // Pre-set old lockout level
      localStorage.setItem(AUTH_RATE_LIMIT_CONSTANTS.LOCKOUT_STORAGE_KEY, JSON.stringify({
        level: 2,
        timestamp: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago
      }));
      
      const { result } = renderHook(() => useAuthRateLimit());
      
      expect(result.current.lockoutLevel).toBe(0);
    });
    
    it('should call onLockout callback when locked', () => {
      const onLockout = vi.fn();
      const { result } = renderHook(() => useAuthRateLimit(onLockout));
      
      // Trigger lockout
      for (let i = 0; i < AUTH_RATE_LIMIT_CONSTANTS.MAX_LOGIN_ATTEMPTS; i++) {
        act(() => {
          result.current.trackLoginAttempt('test@example.com');
        });
      }
      
      expect(onLockout).toHaveBeenCalledWith(
        'test@example.com',
        AUTH_RATE_LIMIT_CONSTANTS.LOCKOUT_DURATIONS[0],
        1
      );
    });
  });
  
  describe('CAPTCHA Logic', () => {
    it('should not show CAPTCHA initially', () => {
      const { result } = renderHook(() => useAuthRateLimit());
      
      expect(result.current.shouldShowCaptcha()).toBe(false);
    });
    
    it('should show CAPTCHA after threshold attempts', () => {
      const { result } = renderHook(() => useAuthRateLimit());
      
      // Make CAPTCHA_THRESHOLD attempts
      for (let i = 0; i < AUTH_RATE_LIMIT_CONSTANTS.CAPTCHA_THRESHOLD; i++) {
        act(() => {
          result.current.trackLoginAttempt('test@example.com');
        });
      }
      
      expect(result.current.shouldShowCaptcha()).toBe(true);
    });
    
    it('should not show CAPTCHA when verified', () => {
      const { result } = renderHook(() => useAuthRateLimit());
      
      // Make CAPTCHA_THRESHOLD attempts
      for (let i = 0; i < AUTH_RATE_LIMIT_CONSTANTS.CAPTCHA_THRESHOLD; i++) {
        act(() => {
          result.current.trackLoginAttempt('test@example.com');
        });
      }
      
      // Verify CAPTCHA
      act(() => {
        result.current.setCaptchaVerified(true);
      });
      
      expect(result.current.captchaVerified).toBe(true);
      expect(result.current.shouldShowCaptcha()).toBe(false);
    });
    
    it('should reset CAPTCHA state on login reset', () => {
      const { result } = renderHook(() => useAuthRateLimit());
      
      act(() => {
        result.current.setCaptchaVerified(true);
      });
      
      expect(result.current.captchaVerified).toBe(true);
      
      act(() => {
        result.current.resetLoginAttempts();
      });
      
      expect(result.current.captchaVerified).toBe(false);
    });
  });
  
  describe('Cooldown Timers', () => {
    it('should decrement rate limit cooldown every second', () => {
      const { result } = renderHook(() => useAuthRateLimit());
      
      // Trigger rate limit
      for (let i = 0; i < AUTH_RATE_LIMIT_CONSTANTS.MAX_MAGIC_LINK_REQUESTS; i++) {
        act(() => {
          result.current.trackMagicLinkRequest();
        });
      }
      
      act(() => {
        result.current.checkRateLimit();
      });
      
      const initialCooldown = result.current.rateLimitCooldown;
      expect(initialCooldown).toBeGreaterThan(0);
      
      // Advance 1 second
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      
      expect(result.current.rateLimitCooldown).toBe(initialCooldown - 1);
    });
    
    it('should decrement login lockout cooldown every second', () => {
      const { result } = renderHook(() => useAuthRateLimit());
      
      // Trigger lockout
      for (let i = 0; i < AUTH_RATE_LIMIT_CONSTANTS.MAX_LOGIN_ATTEMPTS; i++) {
        act(() => {
          result.current.trackLoginAttempt('test@example.com');
        });
      }
      
      const initialCooldown = result.current.loginLockoutCooldown;
      expect(initialCooldown).toBeGreaterThan(0);
      
      // Advance 1 second
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      
      expect(result.current.loginLockoutCooldown).toBe(initialCooldown - 1);
    });
  });
});

describe('AUTH_RATE_LIMIT_CONSTANTS', () => {
  it('should export all required constants', () => {
    expect(AUTH_RATE_LIMIT_CONSTANTS.RATE_LIMIT_WINDOW_MS).toBeDefined();
    expect(AUTH_RATE_LIMIT_CONSTANTS.MAX_MAGIC_LINK_REQUESTS).toBeDefined();
    expect(AUTH_RATE_LIMIT_CONSTANTS.MAX_LOGIN_ATTEMPTS).toBeDefined();
    expect(AUTH_RATE_LIMIT_CONSTANTS.COOLDOWN_SECONDS).toBeDefined();
    expect(AUTH_RATE_LIMIT_CONSTANTS.CAPTCHA_THRESHOLD).toBeDefined();
    expect(AUTH_RATE_LIMIT_CONSTANTS.LOCKOUT_DURATIONS).toBeDefined();
    expect(AUTH_RATE_LIMIT_CONSTANTS.LOCKOUT_STORAGE_KEY).toBeDefined();
    expect(AUTH_RATE_LIMIT_CONSTANTS.LOCKOUT_RESET_HOURS).toBeDefined();
  });
  
  it('should have progressive lockout durations', () => {
    expect(AUTH_RATE_LIMIT_CONSTANTS.LOCKOUT_DURATIONS).toEqual([300, 900, 3600]);
  });
  
  it('should have sensible default values', () => {
    expect(AUTH_RATE_LIMIT_CONSTANTS.MAX_MAGIC_LINK_REQUESTS).toBe(3);
    expect(AUTH_RATE_LIMIT_CONSTANTS.MAX_LOGIN_ATTEMPTS).toBe(5);
    expect(AUTH_RATE_LIMIT_CONSTANTS.CAPTCHA_THRESHOLD).toBe(3);
  });
});
