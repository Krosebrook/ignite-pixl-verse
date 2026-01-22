/**
 * Component tests for Auth page
 * Tests authentication UI, form validation, and user interactions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils/renderWithProviders';
import { createMockSession, createMockUser } from '@/test/fixtures';

// Mock modules before imports
const mockNavigate = vi.fn();
const mockGetSession = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockSignUp = vi.fn();
const mockSignInWithOtp = vi.fn();
const mockSignInWithOAuth = vi.fn();
const mockSignOut = vi.fn();
const mockGetUser = vi.fn();
const mockOnAuthStateChange = vi.fn();

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
      getSession: () => mockGetSession(),
      signInWithPassword: (creds: unknown) => mockSignInWithPassword(creds),
      signUp: (creds: unknown) => mockSignUp(creds),
      signInWithOtp: (opts: unknown) => mockSignInWithOtp(opts),
      signInWithOAuth: (opts: unknown) => mockSignInWithOAuth(opts),
      signOut: () => mockSignOut(),
      getUser: () => mockGetUser(),
      onAuthStateChange: (callback: (event: string, session: unknown) => void) =>
        mockOnAuthStateChange(callback),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

vi.mock('@/lib/onboarding', () => ({
  checkOnboardingStatus: vi.fn().mockResolvedValue({ onboardingComplete: true }),
}));

vi.mock('@/lib/securityActivity', () => ({
  logSecurityEvent: vi.fn(),
  checkIpRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  resetIpRateLimit: vi.fn(),
  calculateRiskScore: vi.fn().mockReturnValue(0),
  parseUserAgent: vi.fn().mockReturnValue({}),
}));

vi.mock('@/hooks/useInvitationToken', () => ({
  useInvitationToken: vi.fn().mockReturnValue({
    inviteToken: null,
    invitationInfo: null,
    isLoading: false,
    isAccepting: false,
    acceptInvitation: vi.fn(),
    clearInvitation: vi.fn(),
  }),
}));

vi.mock('@/components/auth/TotpVerification', () => ({
  TotpVerification: vi.fn(() => null),
  checkTotpEnabled: vi.fn().mockResolvedValue(false),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Import after mocks
import Auth from '@/pages/Auth';
import { toast } from 'sonner';

describe('Auth Page', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default: no existing session
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    
    // Clear localStorage
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render the sign in form by default', async () => {
      renderWithProviders(<Auth />, { useMemoryRouter: true, initialRoute: '/auth' });

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /sign in/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /sign up/i })).toBeInTheDocument();
      });
    });

    it('should show email and password fields', async () => {
      renderWithProviders(<Auth />, { useMemoryRouter: true, initialRoute: '/auth' });

      await waitFor(() => {
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      });
    });

    it('should show the FlashFusion logo/branding', async () => {
      renderWithProviders(<Auth />, { useMemoryRouter: true, initialRoute: '/auth' });

      await waitFor(() => {
        expect(screen.getByText(/flashfusion/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Validation', () => {
    it('should show error for invalid email format', async () => {
      renderWithProviders(<Auth />, { useMemoryRouter: true, initialRoute: '/auth' });

      await waitFor(() => {
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      });

      const emailInput = screen.getByLabelText(/email/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'invalid-email');
      await user.click(submitButton);

      expect(toast.error).toHaveBeenCalledWith('Please enter a valid email address');
    });

    it('should show error for short password', async () => {
      renderWithProviders(<Auth />, { useMemoryRouter: true, initialRoute: '/auth' });

      await waitFor(() => {
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      });

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'short');
      await user.click(submitButton);

      expect(toast.error).toHaveBeenCalledWith('Password must be at least 8 characters');
    });

    it('should validate password length maximum', async () => {
      renderWithProviders(<Auth />, { useMemoryRouter: true, initialRoute: '/auth' });

      await waitFor(() => {
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      });

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@example.com');
      // Type a password > 72 characters
      await user.type(passwordInput, 'a'.repeat(73));
      await user.click(submitButton);

      expect(toast.error).toHaveBeenCalledWith('Password must be less than 72 characters');
    });
  });

  describe('Sign In Flow', () => {
    it('should call signInWithPassword with correct credentials', async () => {
      const mockSession = createMockSession();
      const mockUser = createMockUser();
      
      mockSignInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });
      mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

      renderWithProviders(<Auth />, { useMemoryRouter: true, initialRoute: '/auth' });

      await waitFor(() => {
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      });

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockSignInWithPassword).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
        });
      });
    });

    it('should show error toast on failed sign in', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: null,
        error: { message: 'Invalid login credentials', code: 'invalid_credentials' },
      });

      renderWithProviders(<Auth />, { useMemoryRouter: true, initialRoute: '/auth' });

      await waitFor(() => {
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      });

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'wrongpassword');
      await user.click(submitButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });
    });

    it('should navigate to dashboard on successful sign in', async () => {
      const mockSession = createMockSession();
      const mockUser = createMockUser();
      
      mockSignInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });
      mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

      renderWithProviders(<Auth />, { useMemoryRouter: true, initialRoute: '/auth' });

      await waitFor(() => {
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      });

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
      });
    });
  });

  describe('Sign Up Tab', () => {
    it('should switch to sign up form when tab is clicked', async () => {
      renderWithProviders(<Auth />, { useMemoryRouter: true, initialRoute: '/auth' });

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /sign up/i })).toBeInTheDocument();
      });

      const signUpTab = screen.getByRole('tab', { name: /sign up/i });
      await user.click(signUpTab);

      await waitFor(() => {
        // Sign up form should have confirm password field
        expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
      });
    });

    it('should validate password confirmation matches', async () => {
      renderWithProviders(<Auth />, { useMemoryRouter: true, initialRoute: '/auth' });

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /sign up/i })).toBeInTheDocument();
      });

      const signUpTab = screen.getByRole('tab', { name: /sign up/i });
      await user.click(signUpTab);

      await waitFor(() => {
        expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
      });

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      await user.type(emailInput, 'new@example.com');
      await user.type(passwordInput, 'password123');
      await user.type(confirmPasswordInput, 'differentpassword');
      await user.click(submitButton);

      expect(toast.error).toHaveBeenCalledWith('Passwords do not match');
    });
  });

  describe('Magic Link Authentication', () => {
    it('should have magic link option available', async () => {
      renderWithProviders(<Auth />, { useMemoryRouter: true, initialRoute: '/auth' });

      await waitFor(() => {
        expect(screen.getByText(/magic link/i)).toBeInTheDocument();
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should track failed login attempts', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: null,
        error: { message: 'Invalid login credentials', code: 'invalid_credentials' },
      });

      renderWithProviders(<Auth />, { useMemoryRouter: true, initialRoute: '/auth' });

      await waitFor(() => {
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      });

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      // Make multiple failed attempts
      for (let i = 0; i < 3; i++) {
        await user.clear(emailInput);
        await user.clear(passwordInput);
        await user.type(emailInput, 'test@example.com');
        await user.type(passwordInput, 'wrongpassword');
        await user.click(submitButton);
        
        await waitFor(() => {
          expect(mockSignInWithPassword).toHaveBeenCalled();
        });
      }

      // Should show remaining attempts warning in error messages
      expect(toast.error).toHaveBeenCalled();
    });
  });

  describe('Remember Me', () => {
    it('should have remember me checkbox', async () => {
      renderWithProviders(<Auth />, { useMemoryRouter: true, initialRoute: '/auth' });

      await waitFor(() => {
        expect(screen.getByRole('checkbox', { name: /remember/i })).toBeInTheDocument();
      });
    });

    it('should be checked by default', async () => {
      renderWithProviders(<Auth />, { useMemoryRouter: true, initialRoute: '/auth' });

      await waitFor(() => {
        const checkbox = screen.getByRole('checkbox', { name: /remember/i });
        expect(checkbox).toBeChecked();
      });
    });
  });

  describe('Forgot Password', () => {
    it('should have forgot password link', async () => {
      renderWithProviders(<Auth />, { useMemoryRouter: true, initialRoute: '/auth' });

      await waitFor(() => {
        expect(screen.getByText(/forgot password/i)).toBeInTheDocument();
      });
    });
  });

  describe('OAuth Sign In', () => {
    it('should have Google sign in button', async () => {
      renderWithProviders(<Auth />, { useMemoryRouter: true, initialRoute: '/auth' });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /google/i })).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper form labels', async () => {
      renderWithProviders(<Auth />, { useMemoryRouter: true, initialRoute: '/auth' });

      await waitFor(() => {
        const emailInput = screen.getByLabelText(/email/i);
        const passwordInput = screen.getByLabelText(/password/i);
        
        expect(emailInput).toHaveAttribute('type', 'email');
        expect(passwordInput).toHaveAttribute('type', 'password');
      });
    });

    it('should have accessible tab navigation', async () => {
      renderWithProviders(<Auth />, { useMemoryRouter: true, initialRoute: '/auth' });

      await waitFor(() => {
        const signInTab = screen.getByRole('tab', { name: /sign in/i });
        const signUpTab = screen.getByRole('tab', { name: /sign up/i });
        
        expect(signInTab).toHaveAttribute('aria-selected', 'true');
        expect(signUpTab).toHaveAttribute('aria-selected', 'false');
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading state when checking existing auth', async () => {
      // Make getSession take some time
      mockGetSession.mockImplementation(() => new Promise(() => {}));

      renderWithProviders(<Auth />, { useMemoryRouter: true, initialRoute: '/auth' });

      // Should show loader while checking auth
      expect(screen.getByRole('status') || screen.queryByTestId('loader')).toBeTruthy;
    });

    it('should disable submit button during sign in', async () => {
      mockSignInWithPassword.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: null, error: null }), 100))
      );

      renderWithProviders(<Auth />, { useMemoryRouter: true, initialRoute: '/auth' });

      await waitFor(() => {
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      });

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      // Button should be disabled during loading
      expect(submitButton).toBeDisabled();
    });
  });
});
