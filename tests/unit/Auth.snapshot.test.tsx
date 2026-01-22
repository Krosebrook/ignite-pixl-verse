/**
 * Snapshot tests for Auth page
 * Catches visual regressions in authentication UI
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock modules before imports
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signInWithOtp: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
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
  checkOnboardingStatus: vi.fn().mockResolvedValue({ onboardingComplete: false }),
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

// Helper to create consistent test wrapper
function createTestWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/auth']}>
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    );
  };
}

describe('Auth Page Snapshots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should match snapshot for sign in view', async () => {
    const { container, findByRole } = render(<Auth />, { wrapper: createTestWrapper() });
    
    // Wait for the component to finish loading
    await findByRole('tab', { name: /sign in/i });
    
    // Create a simplified snapshot of the key UI elements
    const signInTab = container.querySelector('[data-state="active"]');
    const form = container.querySelector('form');
    
    expect(signInTab).toMatchSnapshot('sign-in-active-tab');
    expect(form).toMatchSnapshot('sign-in-form');
  });

  it('should match snapshot for form structure', async () => {
    const { container, findByRole } = render(<Auth />, { wrapper: createTestWrapper() });
    
    await findByRole('tab', { name: /sign in/i });
    
    // Snapshot the form inputs structure
    const emailInput = container.querySelector('input[type="email"]');
    const passwordInput = container.querySelector('input[type="password"]');
    const submitButton = container.querySelector('button[type="submit"]');
    
    expect({
      hasEmailInput: !!emailInput,
      hasPasswordInput: !!passwordInput,
      hasSubmitButton: !!submitButton,
      emailPlaceholder: emailInput?.getAttribute('placeholder'),
    }).toMatchSnapshot('form-structure');
  });

  it('should match snapshot for tab navigation', async () => {
    const { container, findByRole } = render(<Auth />, { wrapper: createTestWrapper() });
    
    await findByRole('tab', { name: /sign in/i });
    
    // Snapshot the tabs list
    const tabsList = container.querySelector('[role="tablist"]');
    
    expect(tabsList).toMatchSnapshot('tabs-navigation');
  });

  it('should match snapshot for branding elements', async () => {
    const { container, findByText } = render(<Auth />, { wrapper: createTestWrapper() });
    
    // Wait for branding to appear
    const branding = await findByText(/flashfusion/i);
    
    expect({
      brandingText: branding.textContent,
      brandingTagName: branding.tagName,
    }).toMatchSnapshot('branding-elements');
  });

  it('should match snapshot for OAuth buttons', async () => {
    const { container, findByRole } = render(<Auth />, { wrapper: createTestWrapper() });
    
    await findByRole('tab', { name: /sign in/i });
    
    // Find OAuth buttons
    const oauthButtons = container.querySelectorAll('button');
    const googleButton = Array.from(oauthButtons).find(btn => 
      btn.textContent?.toLowerCase().includes('google')
    );
    
    expect({
      hasGoogleButton: !!googleButton,
      googleButtonText: googleButton?.textContent,
    }).toMatchSnapshot('oauth-buttons');
  });

  it('should match snapshot for remember me checkbox', async () => {
    const { container, findByRole } = render(<Auth />, { wrapper: createTestWrapper() });
    
    await findByRole('checkbox', { name: /remember/i });
    
    const checkbox = container.querySelector('input[type="checkbox"], [role="checkbox"]');
    const label = container.querySelector('label');
    
    expect({
      hasCheckbox: !!checkbox,
      isCheckedByDefault: checkbox?.getAttribute('data-state') === 'checked' || 
                          checkbox?.getAttribute('checked') !== null,
    }).toMatchSnapshot('remember-me');
  });

  it('should match snapshot for magic link option', async () => {
    const { findByText } = render(<Auth />, { wrapper: createTestWrapper() });
    
    const magicLinkText = await findByText(/magic link/i);
    
    expect({
      hasMagicLinkOption: !!magicLinkText,
      text: magicLinkText.textContent,
    }).toMatchSnapshot('magic-link-option');
  });

  it('should match snapshot for forgot password link', async () => {
    const { findByText } = render(<Auth />, { wrapper: createTestWrapper() });
    
    const forgotPasswordLink = await findByText(/forgot password/i);
    
    expect({
      hasForgotPassword: !!forgotPasswordLink,
      text: forgotPasswordLink.textContent,
      tagName: forgotPasswordLink.tagName,
    }).toMatchSnapshot('forgot-password-link');
  });

  it('should match snapshot for accessibility attributes', async () => {
    const { container, findByRole } = render(<Auth />, { wrapper: createTestWrapper() });
    
    await findByRole('tab', { name: /sign in/i });
    
    const emailInput = container.querySelector('input[type="email"]');
    const passwordInput = container.querySelector('input[type="password"]');
    const tabs = container.querySelectorAll('[role="tab"]');
    
    expect({
      emailHasLabel: !!container.querySelector('label[for]'),
      emailType: emailInput?.getAttribute('type'),
      passwordType: passwordInput?.getAttribute('type'),
      tabsHaveAriaSelected: Array.from(tabs).every(tab => 
        tab.hasAttribute('aria-selected')
      ),
      tabCount: tabs.length,
    }).toMatchSnapshot('accessibility-attributes');
  });

  it('should match snapshot for social proof section', async () => {
    const { container, findByRole } = render(<Auth />, { wrapper: createTestWrapper() });
    
    await findByRole('tab', { name: /sign in/i });
    
    // Look for social proof elements (may or may not be present)
    const socialProof = container.querySelector('[class*="social"]') ||
                        container.querySelector('[class*="proof"]') ||
                        container.querySelector('[class*="testimonial"]');
    
    expect({
      hasSocialProof: !!socialProof,
    }).toMatchSnapshot('social-proof-section');
  });

  it('should match snapshot for overall page layout', async () => {
    const { container, findByRole } = render(<Auth />, { wrapper: createTestWrapper() });
    
    await findByRole('tab', { name: /sign in/i });
    
    // Get high-level layout structure
    const cards = container.querySelectorAll('[class*="card"]');
    const forms = container.querySelectorAll('form');
    const buttons = container.querySelectorAll('button');
    
    expect({
      cardCount: cards.length,
      formCount: forms.length,
      buttonCount: buttons.length,
      hasTabPanel: !!container.querySelector('[role="tabpanel"]'),
    }).toMatchSnapshot('page-layout-structure');
  });
});
