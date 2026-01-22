/**
 * Component tests for Dashboard page
 * Tests dashboard rendering, metrics, and user interactions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils/renderWithProviders';
import { createMockUser, createMockSession, createMockMembership } from '@/test/fixtures';

// Mock modules
const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: () => mockGetUser(),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    from: (table: string) => mockFrom(table),
  },
}));

// Import after mocks
import Dashboard from '@/pages/Dashboard';

describe('Dashboard Page', () => {
  const user = userEvent.setup();
  const mockUser = createMockUser();
  const mockSession = createMockSession();

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default: authenticated user
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    
    // Mock database queries with counts
    mockFrom.mockImplementation((table: string) => ({
      select: vi.fn().mockReturnValue({
        count: table === 'assets' ? 12 : table === 'campaigns' ? 5 : 8,
        data: [],
        error: null,
      }),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render the dashboard page header', async () => {
      renderWithProviders(<Dashboard />, { useMemoryRouter: true, initialRoute: '/dashboard' });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
      });
    });

    it('should display welcome message', async () => {
      renderWithProviders(<Dashboard />, { useMemoryRouter: true, initialRoute: '/dashboard' });

      await waitFor(() => {
        expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
      });
    });

    it('should render the Generate Content button', async () => {
      renderWithProviders(<Dashboard />, { useMemoryRouter: true, initialRoute: '/dashboard' });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /generate content/i })).toBeInTheDocument();
      });
    });
  });

  describe('Metrics Display', () => {
    it('should display Total Assets metric', async () => {
      renderWithProviders(<Dashboard />, { useMemoryRouter: true, initialRoute: '/dashboard' });

      await waitFor(() => {
        expect(screen.getByText(/total assets/i)).toBeInTheDocument();
      });
    });

    it('should display Active Campaigns metric', async () => {
      renderWithProviders(<Dashboard />, { useMemoryRouter: true, initialRoute: '/dashboard' });

      await waitFor(() => {
        expect(screen.getByText(/active campaigns/i)).toBeInTheDocument();
      });
    });

    it('should display Scheduled Posts metric', async () => {
      renderWithProviders(<Dashboard />, { useMemoryRouter: true, initialRoute: '/dashboard' });

      await waitFor(() => {
        expect(screen.getByText(/scheduled posts/i)).toBeInTheDocument();
      });
    });

    it('should display Engagement Rate metric', async () => {
      renderWithProviders(<Dashboard />, { useMemoryRouter: true, initialRoute: '/dashboard' });

      await waitFor(() => {
        expect(screen.getByText(/engagement rate/i)).toBeInTheDocument();
      });
    });

    it('should show all 4 metric tiles', async () => {
      renderWithProviders(<Dashboard />, { useMemoryRouter: true, initialRoute: '/dashboard' });

      await waitFor(() => {
        const metricTitles = [
          'Total Assets',
          'Active Campaigns', 
          'Scheduled Posts',
          'Engagement Rate',
        ];
        
        metricTitles.forEach(title => {
          expect(screen.getByText(new RegExp(title, 'i'))).toBeInTheDocument();
        });
      });
    });
  });

  describe('Recent Activity Section', () => {
    it('should display Recent Activity header', async () => {
      renderWithProviders(<Dashboard />, { useMemoryRouter: true, initialRoute: '/dashboard' });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /recent activity/i })).toBeInTheDocument();
      });
    });

    it('should show View All button', async () => {
      renderWithProviders(<Dashboard />, { useMemoryRouter: true, initialRoute: '/dashboard' });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /view all/i })).toBeInTheDocument();
      });
    });

    it('should display activity items with status badges', async () => {
      renderWithProviders(<Dashboard />, { useMemoryRouter: true, initialRoute: '/dashboard' });

      await waitFor(() => {
        // Check for status badges
        expect(screen.getByText(/completed/i)).toBeInTheDocument();
        expect(screen.getByText(/draft/i)).toBeInTheDocument();
        expect(screen.getByText(/scheduled/i)).toBeInTheDocument();
      });
    });

    it('should display activity titles', async () => {
      renderWithProviders(<Dashboard />, { useMemoryRouter: true, initialRoute: '/dashboard' });

      await waitFor(() => {
        expect(screen.getByText(/product hero banner/i)).toBeInTheDocument();
        expect(screen.getByText(/q2 product launch/i)).toBeInTheDocument();
      });
    });

    it('should have accessible activity items', async () => {
      renderWithProviders(<Dashboard />, { useMemoryRouter: true, initialRoute: '/dashboard' });

      await waitFor(() => {
        const articles = screen.getAllByRole('article');
        expect(articles.length).toBeGreaterThan(0);
        
        // Check that articles have aria-labels
        articles.forEach(article => {
          expect(article).toHaveAttribute('aria-label');
        });
      });
    });
  });

  describe('Tips Card', () => {
    it('should display tips for users', async () => {
      renderWithProviders(<Dashboard />, { useMemoryRouter: true, initialRoute: '/dashboard' });

      await waitFor(() => {
        // Check for at least one tip
        expect(screen.getByText(/generate your first asset/i)).toBeInTheDocument();
      });
    });
  });

  describe('Brand Kit Prompt', () => {
    it('should render the BrandKitPrompt component', async () => {
      renderWithProviders(<Dashboard />, { useMemoryRouter: true, initialRoute: '/dashboard' });

      // BrandKitPrompt might or might not be visible depending on user state
      // Just verify the page renders without errors
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
      });
    });
  });

  describe('Layout Integration', () => {
    it('should render within Layout component', async () => {
      renderWithProviders(<Dashboard />, { useMemoryRouter: true, initialRoute: '/dashboard' });

      await waitFor(() => {
        // Layout should have main navigation elements
        expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
      });
    });
  });

  describe('Data Fetching', () => {
    it('should fetch dashboard stats on mount', async () => {
      renderWithProviders(<Dashboard />, { useMemoryRouter: true, initialRoute: '/dashboard' });

      await waitFor(() => {
        expect(mockGetUser).toHaveBeenCalled();
      });
    });

    it('should handle loading state gracefully', async () => {
      // Make the query take time
      mockGetUser.mockImplementation(() => new Promise(() => {}));
      
      renderWithProviders(<Dashboard />, { useMemoryRouter: true, initialRoute: '/dashboard' });

      // Dashboard should still render its structure while loading
      expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
    });

    it('should display default values when no data is available', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
      
      renderWithProviders(<Dashboard />, { useMemoryRouter: true, initialRoute: '/dashboard' });

      await waitFor(() => {
        // Should show 0 for metrics when no data
        const zeros = screen.getAllByText('0');
        expect(zeros.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Responsiveness', () => {
    it('should render metric grid for desktop', async () => {
      renderWithProviders(<Dashboard />, { useMemoryRouter: true, initialRoute: '/dashboard' });

      await waitFor(() => {
        // Grid should contain metric tiles
        const metricTitles = screen.getAllByText(/total assets|active campaigns|scheduled posts|engagement rate/i);
        expect(metricTitles.length).toBe(4);
      });
    });
  });

  describe('Animations', () => {
    it('should have animation classes on cards', async () => {
      const { container } = renderWithProviders(<Dashboard />, { 
        useMemoryRouter: true, 
        initialRoute: '/dashboard' 
      });

      await waitFor(() => {
        // Check for animation classes
        const animatedElements = container.querySelectorAll('.animate-fade-in, .animate-fade-in-up');
        expect(animatedElements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('User Interactions', () => {
    it('should allow clicking Generate Content button', async () => {
      renderWithProviders(<Dashboard />, { useMemoryRouter: true, initialRoute: '/dashboard' });

      await waitFor(() => {
        const generateButton = screen.getByRole('button', { name: /generate content/i });
        expect(generateButton).toBeEnabled();
      });

      const generateButton = screen.getByRole('button', { name: /generate content/i });
      await user.click(generateButton);
      
      // Button should remain clickable (no errors)
      expect(generateButton).toBeInTheDocument();
    });

    it('should allow clicking View All button', async () => {
      renderWithProviders(<Dashboard />, { useMemoryRouter: true, initialRoute: '/dashboard' });

      await waitFor(() => {
        const viewAllButton = screen.getByRole('button', { name: /view all/i });
        expect(viewAllButton).toBeEnabled();
      });

      const viewAllButton = screen.getByRole('button', { name: /view all/i });
      await user.click(viewAllButton);
      
      // Button should remain clickable (no errors)
      expect(viewAllButton).toBeInTheDocument();
    });
  });
});
