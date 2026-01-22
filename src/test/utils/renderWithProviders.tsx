/**
 * Custom render utilities for testing with providers
 * Wraps components with all required context providers
 */

import React, { ReactElement, ReactNode } from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/components/ThemeProvider';
import { Toaster } from '@/components/ui/toaster';

/**
 * Options for renderWithProviders
 */
interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Initial route for MemoryRouter */
  initialRoute?: string;
  /** Use MemoryRouter instead of BrowserRouter */
  useMemoryRouter?: boolean;
  /** Custom QueryClient instance */
  queryClient?: QueryClient;
  /** Initial entries for MemoryRouter */
  initialEntries?: string[];
}

/**
 * Creates a fresh QueryClient for testing
 * Disables retries and caching for predictable test behavior
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * All providers wrapper component
 */
interface AllProvidersProps {
  children: ReactNode;
  queryClient: QueryClient;
  useMemoryRouter?: boolean;
  initialEntries?: string[];
}

function AllProviders({ 
  children, 
  queryClient, 
  useMemoryRouter = false,
  initialEntries = ['/'],
}: AllProvidersProps): ReactElement {
  const Router = useMemoryRouter ? MemoryRouter : BrowserRouter;
  const routerProps = useMemoryRouter ? { initialEntries } : {};

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <Router {...routerProps}>
          {children}
          <Toaster />
        </Router>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

/**
 * Custom render function that wraps component with all providers
 * 
 * @example
 * ```tsx
 * import { renderWithProviders, screen } from '@/test/utils/renderWithProviders';
 * 
 * test('renders component', () => {
 *   renderWithProviders(<MyComponent />);
 *   expect(screen.getByText('Hello')).toBeInTheDocument();
 * });
 * ```
 */
export function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {}
): RenderResult & { queryClient: QueryClient } {
  const {
    initialRoute,
    useMemoryRouter = false,
    queryClient = createTestQueryClient(),
    initialEntries = initialRoute ? [initialRoute] : ['/'],
    ...renderOptions
  } = options;

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <AllProviders 
      queryClient={queryClient}
      useMemoryRouter={useMemoryRouter}
      initialEntries={initialEntries}
    >
      {children}
    </AllProviders>
  );

  const result = render(ui, { wrapper: Wrapper, ...renderOptions });

  return {
    ...result,
    queryClient,
  };
}

/**
 * Render with MemoryRouter for route testing
 */
export function renderWithRoute(
  ui: ReactElement,
  initialRoute: string,
  options: Omit<RenderWithProvidersOptions, 'useMemoryRouter' | 'initialRoute'> = {}
): RenderResult & { queryClient: QueryClient } {
  return renderWithProviders(ui, {
    ...options,
    useMemoryRouter: true,
    initialRoute,
  });
}

// Re-export everything from testing-library for convenience
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
