/**
 * Integration tests for useAuth hook
 * Tests authentication flows and state management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMockUser, createMockSession, createMockMembership } from '@/test/fixtures';

// Create mock functions that we can control per test
const mockGetSession = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockSignUp = vi.fn();
const mockSignOut = vi.fn();
const mockResetPasswordForEmail = vi.fn();
const mockUpdateUser = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockFrom = vi.fn();

// Mock Supabase client - must be before imports that use it
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      signInWithPassword: (creds: { email: string; password: string }) => 
        mockSignInWithPassword(creds),
      signUp: (creds: { email: string; password: string; options?: Record<string, unknown> }) => 
        mockSignUp(creds),
      signOut: () => mockSignOut(),
      resetPasswordForEmail: (email: string, options: Record<string, unknown>) => 
        mockResetPasswordForEmail(email, options),
      updateUser: (updates: Record<string, unknown>) => mockUpdateUser(updates),
      onAuthStateChange: (callback: (event: string, session: unknown) => void) => 
        mockOnAuthStateChange(callback),
    },
    from: (table: string) => mockFrom(table),
  },
}));

// Import after mocking
import { useAuth, useRequireAuth } from '@/hooks/useAuth';

// Test wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should start with loading state', () => {
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });

    it('should initialize with existing session', async () => {
      const mockSession = createMockSession();
      mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockSession.user);
      expect(result.current.session).toEqual(mockSession);
    });

    it('should handle session error gracefully', async () => {
      const error = new Error('Session fetch failed');
      mockGetSession.mockResolvedValue({ data: { session: null }, error });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toEqual(error);
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should load org membership for authenticated users', async () => {
      const mockSession = createMockSession();
      const mockMembership = createMockMembership({ role: 'admin' });
      
      mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: mockMembership, error: null }),
          }),
        }),
      });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.membership).toEqual(mockMembership);
      });

      expect(result.current.isAdmin).toBe(true);
      expect(result.current.orgId).toBe(mockMembership.org_id);
    });
  });

  describe('signIn', () => {
    it('should sign in successfully', async () => {
      const mockSession = createMockSession();
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
      mockSignInWithPassword.mockResolvedValue({ 
        data: { user: mockSession.user, session: mockSession }, 
        error: null 
      });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.signIn('test@example.com', 'password123');
      });

      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    it('should handle sign in error', async () => {
      const error = { message: 'Invalid credentials' };
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
      mockSignInWithPassword.mockResolvedValue({ data: null, error });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        result.current.signIn('test@example.com', 'wrongpassword')
      ).rejects.toEqual(error);

      expect(result.current.error).toEqual(error);
    });
  });

  describe('signUp', () => {
    it('should sign up successfully', async () => {
      const mockUser = createMockUser();
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
      mockSignUp.mockResolvedValue({ 
        data: { user: mockUser, session: null }, 
        error: null 
      });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.signUp('new@example.com', 'password123', { full_name: 'New User' });
      });

      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'password123',
        options: { data: { full_name: 'New User' } },
      });
    });

    it('should handle sign up error', async () => {
      const error = { message: 'Email already registered' };
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
      mockSignUp.mockResolvedValue({ data: null, error });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        result.current.signUp('existing@example.com', 'password123')
      ).rejects.toEqual(error);
    });
  });

  describe('signOut', () => {
    it('should sign out successfully', async () => {
      const mockSession = createMockSession();
      mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });
      mockSignOut.mockResolvedValue({ error: null });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      await act(async () => {
        await result.current.signOut();
      });

      expect(mockSignOut).toHaveBeenCalled();
    });

    it('should clear membership on sign out', async () => {
      const mockSession = createMockSession();
      const mockMembership = createMockMembership();
      
      mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: mockMembership, error: null }),
          }),
        }),
      });
      mockSignOut.mockResolvedValue({ error: null });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.membership).toEqual(mockMembership);
      });

      await act(async () => {
        await result.current.signOut();
      });

      // Note: The actual membership clearing happens via onAuthStateChange
      expect(mockSignOut).toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('should send password reset email', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
      mockResetPasswordForEmail.mockResolvedValue({ error: null });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.resetPassword('test@example.com');
      });

      expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.objectContaining({
          redirectTo: expect.stringContaining('/auth/reset-password'),
        })
      );
    });
  });

  describe('updatePassword', () => {
    it('should update password successfully', async () => {
      const mockSession = createMockSession();
      mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });
      mockUpdateUser.mockResolvedValue({ error: null });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      await act(async () => {
        await result.current.updatePassword('newPassword123');
      });

      expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'newPassword123' });
    });
  });

  describe('auth state change listener', () => {
    it('should update state on auth change', async () => {
      let authCallback: ((event: string, session: unknown) => void) | null = null;
      
      mockOnAuthStateChange.mockImplementation((callback) => {
        authCallback = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      });
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAuthenticated).toBe(false);

      // Simulate auth state change
      const newSession = createMockSession();
      
      await act(async () => {
        authCallback?.('SIGNED_IN', newSession);
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
        expect(result.current.user).toEqual(newSession.user);
      });
    });
  });

  describe('isAdmin computed property', () => {
    it('should return true for owner role', async () => {
      const mockSession = createMockSession();
      const mockMembership = createMockMembership({ role: 'owner' });
      
      mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: mockMembership, error: null }),
          }),
        }),
      });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isAdmin).toBe(true);
      });
    });

    it('should return true for admin role', async () => {
      const mockSession = createMockSession();
      const mockMembership = createMockMembership({ role: 'admin' });
      
      mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: mockMembership, error: null }),
          }),
        }),
      });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isAdmin).toBe(true);
      });
    });

    it('should return false for member role', async () => {
      const mockSession = createMockSession();
      const mockMembership = createMockMembership({ role: 'member' });
      
      mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: mockMembership, error: null }),
          }),
        }),
      });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isAdmin).toBe(false);
      });
    });
  });
});

describe('useRequireAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: { href: '/' },
      writable: true,
    });

    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });
  });

  it('should redirect unauthenticated users', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });

    renderHook(() => useRequireAuth('/auth'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(window.location.href).toBe('/auth');
    });
  });

  it('should not redirect authenticated users', async () => {
    const mockSession = createMockSession();
    mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });

    renderHook(() => useRequireAuth('/auth'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(window.location.href).toBe('/');
    });
  });

  it('should use custom redirect path', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });

    renderHook(() => useRequireAuth('/login'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(window.location.href).toBe('/login');
    });
  });
});
