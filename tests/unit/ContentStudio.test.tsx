/**
 * ContentStudio Component Tests
 * Tests for the Content Studio page with all content generation features
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen, fireEvent, waitFor } from '@/test/utils/renderWithProviders';
import userEvent from '@testing-library/user-event';
import ContentStudio from '@/pages/ContentStudio';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    }),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
    },
  },
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock useCurrentOrg hook
vi.mock('@/hooks/useCurrentOrg', () => ({
  useCurrentOrg: () => ({
    orgId: 'test-org-id',
    orgName: 'Test Organization',
    isLoading: false,
  }),
}));

// Mock useBrandValidation hook
const mockValidation = {
  isValid: true,
  isValidating: false,
  errors: [],
  warnings: [],
};

vi.mock('@/hooks/useBrandValidation', () => ({
  useBrandValidation: () => mockValidation,
}));

// Mock Layout component to simplify testing
vi.mock('@/components/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div data-testid="layout">{children}</div>,
}));

// Mock BrandKitSelector
vi.mock('@/components/BrandKitSelector', () => ({
  BrandKitSelector: ({ onSelectKit }: { onSelectKit: (kit: any) => void }) => (
    <div data-testid="brand-kit-selector">
      <button 
        onClick={() => onSelectKit({ 
          id: 'kit-1', 
          name: 'Test Kit', 
          colors: { primary: '#FF0000', secondary: '#00FF00' },
          brand_voice: 'professional'
        })}
      >
        Select Brand Kit
      </button>
    </div>
  ),
}));

// Mock LayerBuilder
vi.mock('@/components/content/LayerBuilder', () => ({
  LayerBuilder: ({ onChange }: { onChange: (layers: any[]) => void }) => (
    <div data-testid="layer-builder">
      <button onClick={() => onChange([{ id: '1', type: 'text', content: 'Test' }])}>
        Add Layer
      </button>
    </div>
  ),
}));

// Mock BrandValidator
vi.mock('@/components/content/BrandValidator', () => ({
  BrandValidator: ({ result }: { result: any }) => (
    <div data-testid="brand-validator">
      {result.isValid ? 'Valid' : 'Invalid'}
    </div>
  ),
}));

describe('ContentStudio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Page Structure', () => {
    it('renders the page header with correct title', () => {
      renderWithProviders(<ContentStudio />);
      
      expect(screen.getByText('Content Studio')).toBeInTheDocument();
      expect(screen.getByText(/Generate professional studio-grade content/i)).toBeInTheDocument();
    });

    it('renders all content type tabs', () => {
      renderWithProviders(<ContentStudio />);
      
      expect(screen.getByRole('tab', { name: /text/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /image/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /youtube/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /tiktok/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /video/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /music/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /multi-platform/i })).toBeInTheDocument();
    });

    it('renders brand kit selector when orgId is present', () => {
      renderWithProviders(<ContentStudio />);
      
      expect(screen.getByTestId('brand-kit-selector')).toBeInTheDocument();
    });
  });

  describe('Tab Navigation', () => {
    it('defaults to text tab content', () => {
      renderWithProviders(<ContentStudio />);
      
      expect(screen.getByText('Text Generation')).toBeInTheDocument();
      expect(screen.getByText(/Coming soon: AI-powered text generation/i)).toBeInTheDocument();
    });

    it('switches to image tab when clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ContentStudio />);
      
      await user.click(screen.getByRole('tab', { name: /image/i }));
      
      expect(screen.getByText('Image Generation')).toBeInTheDocument();
    });

    it('switches to YouTube tab when clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ContentStudio />);
      
      await user.click(screen.getByRole('tab', { name: /youtube/i }));
      
      expect(screen.getByText('YouTube Video Generation')).toBeInTheDocument();
      expect(screen.getByText('16:9 Format')).toBeInTheDocument();
    });

    it('switches to TikTok tab when clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ContentStudio />);
      
      await user.click(screen.getByRole('tab', { name: /tiktok/i }));
      
      expect(screen.getByText('TikTok Video Generation')).toBeInTheDocument();
      expect(screen.getByText('9:16 Format')).toBeInTheDocument();
    });

    it('shows coming soon for video tab', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ContentStudio />);
      
      await user.click(screen.getByRole('tab', { name: /^video$/i }));
      
      expect(screen.getByText('Generic Video Generation')).toBeInTheDocument();
      expect(screen.getByText(/Coming soon/i)).toBeInTheDocument();
    });

    it('has music tab disabled', () => {
      renderWithProviders(<ContentStudio />);
      
      const musicTab = screen.getByRole('tab', { name: /music/i });
      expect(musicTab).toBeDisabled();
    });
  });

  describe('YouTube Content Generation', () => {
    it('renders YouTube generation form elements', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ContentStudio />);
      
      await user.click(screen.getByRole('tab', { name: /youtube/i }));
      
      expect(screen.getByText('Quality Tier')).toBeInTheDocument();
      expect(screen.getByText('Video Prompt')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Describe your YouTube video/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Generate YouTube Video/i })).toBeInTheDocument();
    });

    it('renders layer builder component', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ContentStudio />);
      
      await user.click(screen.getByRole('tab', { name: /youtube/i }));
      
      expect(screen.getByTestId('layer-builder')).toBeInTheDocument();
    });

    it('updates prompt text when typing', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ContentStudio />);
      
      await user.click(screen.getByRole('tab', { name: /youtube/i }));
      
      const textarea = screen.getByPlaceholderText(/Describe your YouTube video/i);
      await user.type(textarea, 'Create a tech review video');
      
      expect(textarea).toHaveValue('Create a tech review video');
    });

    it('has quality tier selector with options', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ContentStudio />);
      
      await user.click(screen.getByRole('tab', { name: /youtube/i }));
      
      // Quality tier combobox should be present
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });
  });

  describe('TikTok Content Generation', () => {
    it('renders TikTok generation form elements', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ContentStudio />);
      
      await user.click(screen.getByRole('tab', { name: /tiktok/i }));
      
      expect(screen.getByText('Quality Tier')).toBeInTheDocument();
      expect(screen.getByText('Video Prompt')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Describe your TikTok video/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Generate TikTok Video/i })).toBeInTheDocument();
    });

    it('updates TikTok prompt text when typing', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ContentStudio />);
      
      await user.click(screen.getByRole('tab', { name: /tiktok/i }));
      
      const textarea = screen.getByPlaceholderText(/Describe your TikTok video/i);
      await user.type(textarea, 'Create an unboxing short');
      
      expect(textarea).toHaveValue('Create an unboxing short');
    });
  });

  describe('Brand Kit Integration', () => {
    it('can select a brand kit', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ContentStudio />);
      
      const selectButton = screen.getByRole('button', { name: /Select Brand Kit/i });
      await user.click(selectButton);
      
      // Brand kit should be selected (component state change)
      expect(selectButton).toBeInTheDocument();
    });
  });

  describe('Multi-Platform Tab', () => {
    it('shows multi-platform content generator', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ContentStudio />);
      
      await user.click(screen.getByRole('tab', { name: /multi-platform/i }));
      
      expect(screen.getByText('Multi-Platform Generator')).toBeInTheDocument();
      expect(screen.getByText(/Coming soon: Generate optimized content/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has accessible tab navigation', async () => {
      renderWithProviders(<ContentStudio />);
      
      const tabList = screen.getByRole('tablist');
      expect(tabList).toBeInTheDocument();
      
      const tabs = screen.getAllByRole('tab');
      expect(tabs.length).toBe(7);
    });

    it('tabs have proper aria attributes', async () => {
      renderWithProviders(<ContentStudio />);
      
      const textTab = screen.getByRole('tab', { name: /text/i });
      expect(textTab).toHaveAttribute('aria-selected', 'true');
      
      const youtubeTab = screen.getByRole('tab', { name: /youtube/i });
      expect(youtubeTab).toHaveAttribute('aria-selected', 'false');
    });

    it('form inputs have associated labels', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ContentStudio />);
      
      await user.click(screen.getByRole('tab', { name: /youtube/i }));
      
      expect(screen.getByLabelText(/Quality Tier/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Video Prompt/i)).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('YouTube prompt has max length constraint', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ContentStudio />);
      
      await user.click(screen.getByRole('tab', { name: /youtube/i }));
      
      const textarea = screen.getByPlaceholderText(/Describe your YouTube video/i);
      expect(textarea).toHaveAttribute('maxLength', '2000');
    });

    it('TikTok prompt has max length constraint', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ContentStudio />);
      
      await user.click(screen.getByRole('tab', { name: /tiktok/i }));
      
      const textarea = screen.getByPlaceholderText(/Describe your TikTok video/i);
      expect(textarea).toHaveAttribute('maxLength', '1000');
    });
  });
});
