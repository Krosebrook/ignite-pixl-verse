/**
 * Integration tests for useAuthActions hook
 * Tests authentication actions (sign in, sign up, magic link, etc.)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

// Mock dependencies
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signInWithOtp: vi.fn(),
      signInWithOAuth: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      getUser: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

vi.mock('@/lib/onboarding', () => ({
  checkOnboardingStatus: vi.fn(),
}));

vi.mock('@/components/auth/TotpVerification', () => ({
  checkTotpEnabled: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Import after mocks
import { useAuthActions } from '@/hooks/useAuthActions';
import { supabase } from '@/integrations/supabase/client';
import { checkOnboardingStatus } from '@/lib/onboarding';
import { checkTotpEnabled } from '@/components/auth/TotpVerification';
import { toast } from 'sonner';

const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

// Mock options for the hook
const createMockOptions = () => ({
  onModeChange: vi.fn(),
  onLoginAttempt: vi.fn().mockReturnValue(false),
  onMagicLinkRequest: vi.fn(),
  checkRateLimit: vi.fn().mockReturnValue(true),
  setResetEmail: vi.fn(),
  setPendingTotp: vi.fn(),
});

// Create mock form event
const createMockEvent = () => ({
  preventDefault: vi.fn(),
} as unknown as React.FormEvent);

describe('useAuthActions Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
  });
  
  describe('Initial State', () => {
    it('should start with loading false', () => {
      const { result } = renderHook(() => useAuthActions(createMockOptions()), { wrapper });
      
      expect(result.current.loading).toBe(false);
    });
    
    it('should provide all action methods', () => {
      const { result } = renderHook(() => useAuthActions(createMockOptions()), { wrapper });
      
      expect(result.current.handleSignIn).toBeDefined();
      expect(result.current.handleSignUp).toBeDefined();
      expect(result.current.handleMagicLinkSignIn).toBeDefined();
      expect(result.current.handleForgotPassword).toBeDefined();
      expect(result.current.handleGoogleSignIn).toBeDefined();
      expect(result.current.completeSignIn).toBeDefined();
    });
  });
  
  describe('handleSignIn', () => {
    it('should validate email before sign in', async () => {
      const mockOptions = createMockOptions();
      const { result } = renderHook(() => useAuthActions(mockOptions), { wrapper });
      
      await act(async () => {
        await result.current.handleSignIn(createMockEvent(), 'invalid', 'password123');
      });
      
      expect(toast.error).toHaveBeenCalledWith('Please enter a valid email address');
      expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
    });
    
    it('should validate password before sign in', async () => {
      const mockOptions = createMockOptions();
      const { result } = renderHook(() => useAuthActions(mockOptions), { wrapper });
      
      await act(async () => {
        await result.current.handleSignIn(createMockEvent(), 'test@example.com', 'short');
      });
      
      expect(toast.error).toHaveBeenCalledWith('Password must be at least 8 characters');
      expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
    });
    
    it('should sign in successfully without 2FA', async () => {
      const mockOptions = createMockOptions();
      
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
        error: null,
      } as any);
      
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      } as any);
      
      vi.mocked(checkTotpEnabled).mockResolvedValue(false);
      vi.mocked(checkOnboardingStatus).mockResolvedValue({
        onboardingComplete: true,
        hasProfile: true,
        hasOrg: true,
        hasBrandKit: true,
      });
      
      const { result } = renderHook(() => useAuthActions(mockOptions), { wrapper });
      
      await act(async () => {
        await result.current.handleSignIn(createMockEvent(), 'test@example.com', 'password123');
      });
      
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
      
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
      });
    });
    
    it('should redirect to TOTP verification when 2FA enabled', async () => {
      const mockOptions = createMockOptions();
      
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
        error: null,
      } as any);
      
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      } as any);
      
      vi.mocked(checkTotpEnabled).mockResolvedValue(true);
      vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null });
      
      const { result } = renderHook(() => useAuthActions(mockOptions), { wrapper });
      
      await act(async () => {
        await result.current.handleSignIn(createMockEvent(), 'test@example.com', 'password123');
      });
      
      expect(supabase.auth.signOut).toHaveBeenCalled();
      expect(mockOptions.setPendingTotp).toHaveBeenCalledWith('user-123', 'test@example.com');
      expect(mockOptions.onModeChange).toHaveBeenCalledWith('totp-verification');
    });
    
    it('should handle invalid credentials error', async () => {
      const mockOptions = createMockOptions();
      
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { session: null },
        error: { message: 'Invalid login credentials', code: 'invalid_credentials' },
      } as any);
      
      const { result } = renderHook(() => useAuthActions(mockOptions), { wrapper });
      
      await act(async () => {
        await result.current.handleSignIn(createMockEvent(), 'test@example.com', 'wrongpassword');
      });
      
      expect(mockOptions.onLoginAttempt).toHaveBeenCalledWith('test@example.com');
      expect(toast.error).toHaveBeenCalled();
    });
    
    it('should show lockout message when account is locked', async () => {
      const mockOptions = createMockOptions();
      mockOptions.onLoginAttempt.mockReturnValue(true); // Returns true when locked
      
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { session: null },
        error: { message: 'Invalid login credentials' },
      } as any);
      
      const { result } = renderHook(() => useAuthActions(mockOptions), { wrapper });
      
      await act(async () => {
        await result.current.handleSignIn(createMockEvent(), 'test@example.com', 'wrongpassword');
      });
      
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Account temporarily locked'),
        expect.objectContaining({ duration: 8000 })
      );
    });
  });
  
  describe('handleSignUp', () => {
    it('should validate email before sign up', async () => {
      const mockOptions = createMockOptions();
      const { result } = renderHook(() => useAuthActions(mockOptions), { wrapper });
      
      await act(async () => {
        await result.current.handleSignUp(createMockEvent(), 'invalid', 'password123', 'password123');
      });
      
      expect(toast.error).toHaveBeenCalledWith('Please enter a valid email address');
    });
    
    it('should validate password match', async () => {
      const mockOptions = createMockOptions();
      const { result } = renderHook(() => useAuthActions(mockOptions), { wrapper });
      
      await act(async () => {
        await result.current.handleSignUp(
          createMockEvent(), 
          'test@example.com', 
          'password123', 
          'different'
        );
      });
      
      expect(toast.error).toHaveBeenCalledWith('Passwords do not match');
    });
    
    it('should sign up with email confirmation required', async () => {
      const mockOptions = createMockOptions();
      
      vi.mocked(supabase.auth.signUp).mockResolvedValue({
        data: { user: { id: 'user-123' }, session: null },
        error: null,
      } as any);
      
      const { result } = renderHook(() => useAuthActions(mockOptions), { wrapper });
      
      await act(async () => {
        await result.current.handleSignUp(
          createMockEvent(), 
          'test@example.com', 
          'password123', 
          'password123'
        );
      });
      
      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        options: {
          emailRedirectTo: expect.stringContaining('/auth'),
        },
      });
      
      expect(mockOptions.setResetEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockOptions.onModeChange).toHaveBeenCalledWith('pending-verification');
    });
    
    it('should sign up with auto-confirm and redirect', async () => {
      const mockOptions = createMockOptions();
      
      vi.mocked(supabase.auth.signUp).mockResolvedValue({
        data: { 
          user: { id: 'user-123' }, 
          session: { access_token: 'token' }
        },
        error: null,
      } as any);
      
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      } as any);
      
      vi.mocked(checkOnboardingStatus).mockResolvedValue({
        onboardingComplete: false,
        hasProfile: true,
        hasOrg: false,
        hasBrandKit: false,
      });
      
      const { result } = renderHook(() => useAuthActions(mockOptions), { wrapper });
      
      await act(async () => {
        await result.current.handleSignUp(
          createMockEvent(), 
          'test@example.com', 
          'password123', 
          'password123'
        );
      });
      
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/onboarding');
      });
    });
    
    it('should handle sign up error', async () => {
      const mockOptions = createMockOptions();
      
      vi.mocked(supabase.auth.signUp).mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'User already registered' },
      } as any);
      
      const { result } = renderHook(() => useAuthActions(mockOptions), { wrapper });
      
      await act(async () => {
        await result.current.handleSignUp(
          createMockEvent(), 
          'test@example.com', 
          'password123', 
          'password123'
        );
      });
      
      expect(toast.error).toHaveBeenCalledWith(
        'Unable to create account. Please try a different email or contact support.'
      );
    });
  });
  
  describe('handleMagicLinkSignIn', () => {
    it('should validate email', async () => {
      const mockOptions = createMockOptions();
      const { result } = renderHook(() => useAuthActions(mockOptions), { wrapper });
      
      await act(async () => {
        await result.current.handleMagicLinkSignIn(createMockEvent(), 'invalid');
      });
      
      expect(toast.error).toHaveBeenCalledWith('Please enter a valid email address');
    });
    
    it('should check rate limit', async () => {
      const mockOptions = createMockOptions();
      mockOptions.checkRateLimit.mockReturnValue(false);
      
      const { result } = renderHook(() => useAuthActions(mockOptions), { wrapper });
      
      await act(async () => {
        await result.current.handleMagicLinkSignIn(createMockEvent(), 'test@example.com');
      });
      
      expect(toast.error).toHaveBeenCalledWith('Too many requests. Please wait before trying again.');
      expect(supabase.auth.signInWithOtp).not.toHaveBeenCalled();
    });
    
    it('should send magic link successfully', async () => {
      const mockOptions = createMockOptions();
      
      vi.mocked(supabase.auth.signInWithOtp).mockResolvedValue({
        data: {},
        error: null,
      } as any);
      
      const { result } = renderHook(() => useAuthActions(mockOptions), { wrapper });
      
      await act(async () => {
        await result.current.handleMagicLinkSignIn(createMockEvent(), 'test@example.com');
      });
      
      expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
        email: 'test@example.com',
        options: {
          emailRedirectTo: expect.stringContaining('/auth'),
        },
      });
      
      expect(mockOptions.onMagicLinkRequest).toHaveBeenCalled();
      expect(mockOptions.onModeChange).toHaveBeenCalledWith('magic-link-sent');
      expect(toast.success).toHaveBeenCalledWith('Magic link sent! Check your email.');
    });
    
    it('should handle rate limit error from Supabase', async () => {
      const mockOptions = createMockOptions();
      
      vi.mocked(supabase.auth.signInWithOtp).mockResolvedValue({
        data: null,
        error: { message: 'Rate limit exceeded', status: 429 },
      } as any);
      
      const { result } = renderHook(() => useAuthActions(mockOptions), { wrapper });
      
      await act(async () => {
        await result.current.handleMagicLinkSignIn(createMockEvent(), 'test@example.com');
      });
      
      expect(toast.error).toHaveBeenCalledWith(
        'Too many requests. Please wait before trying again.'
      );
    });
  });
  
  describe('handleForgotPassword', () => {
    it('should validate email', async () => {
      const mockOptions = createMockOptions();
      const { result } = renderHook(() => useAuthActions(mockOptions), { wrapper });
      
      await act(async () => {
        await result.current.handleForgotPassword(createMockEvent(), 'invalid');
      });
      
      expect(toast.error).toHaveBeenCalledWith('Please enter a valid email address');
    });
    
    it('should send password reset email', async () => {
      const mockOptions = createMockOptions();
      
      vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({
        data: {},
        error: null,
      } as any);
      
      const { result } = renderHook(() => useAuthActions(mockOptions), { wrapper });
      
      await act(async () => {
        await result.current.handleForgotPassword(createMockEvent(), 'test@example.com');
      });
      
      expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'test@example.com',
        { redirectTo: expect.stringContaining('/auth/reset-password') }
      );
      
      expect(mockOptions.setResetEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockOptions.onModeChange).toHaveBeenCalledWith('reset-sent');
      expect(toast.success).toHaveBeenCalledWith('Password reset link sent! Check your email.');
    });
    
    it('should handle password reset error', async () => {
      const mockOptions = createMockOptions();
      
      vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({
        data: null,
        error: { message: 'User not found' },
      } as any);
      
      const { result } = renderHook(() => useAuthActions(mockOptions), { wrapper });
      
      await act(async () => {
        await result.current.handleForgotPassword(createMockEvent(), 'test@example.com');
      });
      
      expect(toast.error).toHaveBeenCalledWith('User not found');
    });
  });
  
  describe('handleGoogleSignIn', () => {
    it('should initiate Google OAuth', async () => {
      const mockOptions = createMockOptions();
      
      vi.mocked(supabase.auth.signInWithOAuth).mockResolvedValue({
        data: {},
        error: null,
      } as any);
      
      const { result } = renderHook(() => useAuthActions(mockOptions), { wrapper });
      
      await act(async () => {
        await result.current.handleGoogleSignIn();
      });
      
      expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: expect.stringContaining('/auth'),
        },
      });
    });
    
    it('should handle Google OAuth error', async () => {
      const mockOptions = createMockOptions();
      
      vi.mocked(supabase.auth.signInWithOAuth).mockResolvedValue({
        data: null,
        error: { message: 'OAuth error' },
      } as any);
      
      const { result } = renderHook(() => useAuthActions(mockOptions), { wrapper });
      
      await act(async () => {
        await result.current.handleGoogleSignIn();
      });
      
      expect(toast.error).toHaveBeenCalledWith(
        'Failed to sign in with Google. Please try again.'
      );
    });
  });
  
  describe('completeSignIn', () => {
    it('should navigate to dashboard when onboarding complete', async () => {
      const mockOptions = createMockOptions();
      
      vi.mocked(checkOnboardingStatus).mockResolvedValue({
        onboardingComplete: true,
        hasProfile: true,
        hasOrg: true,
        hasBrandKit: true,
      });
      
      const { result } = renderHook(() => useAuthActions(mockOptions), { wrapper });
      
      await act(async () => {
        await result.current.completeSignIn('user-123');
      });
      
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
      expect(toast.success).toHaveBeenCalledWith('Welcome back!');
    });
    
    it('should navigate to onboarding when not complete', async () => {
      const mockOptions = createMockOptions();
      
      vi.mocked(checkOnboardingStatus).mockResolvedValue({
        onboardingComplete: false,
        hasProfile: true,
        hasOrg: false,
        hasBrandKit: false,
      });
      
      const { result } = renderHook(() => useAuthActions(mockOptions), { wrapper });
      
      await act(async () => {
        await result.current.completeSignIn('user-123');
      });
      
      expect(mockNavigate).toHaveBeenCalledWith('/onboarding');
      expect(toast.success).toHaveBeenCalledWith("Welcome! Let's complete your setup.");
    });
    
    it('should handle completeSignIn error', async () => {
      const mockOptions = createMockOptions();
      
      vi.mocked(checkOnboardingStatus).mockRejectedValue(new Error('Failed'));
      
      const { result } = renderHook(() => useAuthActions(mockOptions), { wrapper });
      
      await act(async () => {
        await result.current.completeSignIn('user-123');
      });
      
      expect(toast.error).toHaveBeenCalledWith('An error occurred. Please try again.');
    });
  });
  
  describe('Loading State', () => {
    it('should set loading during sign in', async () => {
      const mockOptions = createMockOptions();
      
      let resolveSignIn: (value: any) => void;
      const signInPromise = new Promise((resolve) => {
        resolveSignIn = resolve;
      });
      
      vi.mocked(supabase.auth.signInWithPassword).mockReturnValue(signInPromise as any);
      
      const { result } = renderHook(() => useAuthActions(mockOptions), { wrapper });
      
      expect(result.current.loading).toBe(false);
      
      act(() => {
        result.current.handleSignIn(createMockEvent(), 'test@example.com', 'password123');
      });
      
      expect(result.current.loading).toBe(true);
      
      await act(async () => {
        resolveSignIn!({ data: { session: null }, error: { message: 'Error' } });
      });
      
      expect(result.current.loading).toBe(false);
    });
  });
});
