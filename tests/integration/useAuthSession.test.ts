/**
 * Integration tests for useAuthSession hook
 * Tests session checking, redirects, and OAuth loading states
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
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
      getSession: vi.fn(),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  },
}));

vi.mock('@/lib/onboarding', () => ({
  checkOnboardingStatus: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Import after mocks
import { useAuthSession, completeSignInFlow } from '@/hooks/useAuthSession';
import { supabase } from '@/integrations/supabase/client';
import { checkOnboardingStatus } from '@/lib/onboarding';
import { toast } from 'sonner';

const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

describe('useAuthSession Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
  });
  
  describe('Initial State', () => {
    it('should start with isCheckingAuth true', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      });
      
      const { result } = renderHook(() => useAuthSession(), { wrapper });
      
      // Initial state before async check completes
      expect(result.current.isCheckingAuth).toBe(true);
      expect(result.current.oauthLoading).toBe(false);
      
      await waitFor(() => {
        expect(result.current.isCheckingAuth).toBe(false);
      });
    });
    
    it('should have oauthLoading false by default', () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      });
      
      const { result } = renderHook(() => useAuthSession(), { wrapper });
      
      expect(result.current.oauthLoading).toBe(false);
    });
    
    it('should allow setting oauthLoading', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      });
      
      const { result } = renderHook(() => useAuthSession(), { wrapper });
      
      result.current.setOauthLoading(true);
      expect(result.current.oauthLoading).toBe(true);
      
      result.current.setOauthLoading(false);
      expect(result.current.oauthLoading).toBe(false);
    });
  });
  
  describe('No Session', () => {
    it('should stop checking auth when no session exists', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      });
      
      const { result } = renderHook(() => useAuthSession(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.isCheckingAuth).toBe(false);
      });
      
      expect(mockNavigate).not.toHaveBeenCalled();
    });
    
    it('should not redirect when no session', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      });
      
      const { result } = renderHook(() => useAuthSession(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.isCheckingAuth).toBe(false);
      });
      
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
  
  describe('With Session - Onboarding Complete', () => {
    it('should redirect to dashboard when onboarding is complete', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: {
          session: {
            user: { id: 'user-123', email: 'test@example.com' },
            access_token: 'token',
          },
        },
        error: null,
      } as any);
      
      vi.mocked(checkOnboardingStatus).mockResolvedValue({
        onboardingComplete: true,
        hasProfile: true,
        hasOrg: true,
        hasBrandKit: true,
      });
      
      renderHook(() => useAuthSession(), { wrapper });
      
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
      });
    });
  });
  
  describe('With Session - Onboarding Incomplete', () => {
    it('should redirect to onboarding when not complete', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: {
          session: {
            user: { id: 'user-123', email: 'test@example.com' },
            access_token: 'token',
          },
        },
        error: null,
      } as any);
      
      vi.mocked(checkOnboardingStatus).mockResolvedValue({
        onboardingComplete: false,
        hasProfile: true,
        hasOrg: false,
        hasBrandKit: false,
      });
      
      renderHook(() => useAuthSession(), { wrapper });
      
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/onboarding', { replace: true });
      });
    });
  });
  
  describe('Error Handling', () => {
    it('should handle auth check errors gracefully', async () => {
      vi.mocked(supabase.auth.getSession).mockRejectedValue(new Error('Auth error'));
      
      const { result } = renderHook(() => useAuthSession(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.isCheckingAuth).toBe(false);
      });
      
      expect(mockNavigate).not.toHaveBeenCalled();
    });
    
    it('should handle onboarding check errors', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: {
          session: {
            user: { id: 'user-123', email: 'test@example.com' },
            access_token: 'token',
          },
        },
        error: null,
      } as any);
      
      vi.mocked(checkOnboardingStatus).mockRejectedValue(new Error('Onboarding error'));
      
      const { result } = renderHook(() => useAuthSession(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.isCheckingAuth).toBe(false);
      });
    });
  });
  
  describe('Invitation Handling', () => {
    it('should accept invitation when valid', async () => {
      const mockAcceptInvitation = vi.fn().mockResolvedValue({ success: true });
      
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: {
          session: {
            user: { id: 'user-123', email: 'test@example.com' },
            access_token: 'token',
          },
        },
        error: null,
      } as any);
      
      vi.mocked(checkOnboardingStatus).mockResolvedValue({
        onboardingComplete: true,
        hasProfile: true,
        hasOrg: true,
        hasBrandKit: true,
      });
      
      renderHook(
        () => useAuthSession({
          onInvitationFound: {
            isValid: true,
            orgName: 'Test Org',
            acceptInvitation: mockAcceptInvitation,
          },
        }),
        { wrapper }
      );
      
      await waitFor(() => {
        expect(mockAcceptInvitation).toHaveBeenCalled();
      });
    });
    
    it('should show success toast on successful invitation acceptance', async () => {
      const mockAcceptInvitation = vi.fn().mockResolvedValue({ success: true });
      
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: {
          session: {
            user: { id: 'user-123', email: 'test@example.com' },
            access_token: 'token',
          },
        },
        error: null,
      } as any);
      
      vi.mocked(checkOnboardingStatus).mockResolvedValue({
        onboardingComplete: true,
        hasProfile: true,
        hasOrg: true,
        hasBrandKit: true,
      });
      
      renderHook(
        () => useAuthSession({
          onInvitationFound: {
            isValid: true,
            orgName: 'Test Org',
            acceptInvitation: mockAcceptInvitation,
          },
        }),
        { wrapper }
      );
      
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          expect.stringContaining('Test Org')
        );
      });
    });
    
    it('should show error toast on failed invitation acceptance', async () => {
      const mockAcceptInvitation = vi.fn().mockResolvedValue({ 
        success: false, 
        error: 'Invitation expired' 
      });
      
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: {
          session: {
            user: { id: 'user-123', email: 'test@example.com' },
            access_token: 'token',
          },
        },
        error: null,
      } as any);
      
      vi.mocked(checkOnboardingStatus).mockResolvedValue({
        onboardingComplete: true,
        hasProfile: true,
        hasOrg: true,
        hasBrandKit: true,
      });
      
      renderHook(
        () => useAuthSession({
          onInvitationFound: {
            isValid: true,
            orgName: 'Test Org',
            acceptInvitation: mockAcceptInvitation,
          },
        }),
        { wrapper }
      );
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Invitation expired');
      });
    });
  });
  
  describe('Only Checks Once', () => {
    it('should only check auth once on mount', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      });
      
      const { result, rerender } = renderHook(() => useAuthSession(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.isCheckingAuth).toBe(false);
      });
      
      // Rerender should not trigger another check
      rerender();
      
      expect(supabase.auth.getSession).toHaveBeenCalledTimes(1);
    });
  });
});

describe('completeSignInFlow Helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
  });
  
  it('should navigate to dashboard when onboarding complete', async () => {
    vi.mocked(checkOnboardingStatus).mockResolvedValue({
      onboardingComplete: true,
      hasProfile: true,
      hasOrg: true,
      hasBrandKit: true,
    });
    
    await completeSignInFlow('user-123', mockNavigate);
    
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    expect(toast.success).toHaveBeenCalledWith('Welcome back!');
  });
  
  it('should navigate to onboarding when not complete', async () => {
    vi.mocked(checkOnboardingStatus).mockResolvedValue({
      onboardingComplete: false,
      hasProfile: true,
      hasOrg: false,
      hasBrandKit: false,
    });
    
    await completeSignInFlow('user-123', mockNavigate);
    
    expect(mockNavigate).toHaveBeenCalledWith('/onboarding');
    expect(toast.success).toHaveBeenCalledWith("Welcome! Let's complete your setup.");
  });
  
  it('should show error toast on failure', async () => {
    vi.mocked(checkOnboardingStatus).mockRejectedValue(new Error('Failed'));
    
    await completeSignInFlow('user-123', mockNavigate);
    
    expect(toast.error).toHaveBeenCalledWith('An error occurred. Please try again.');
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
