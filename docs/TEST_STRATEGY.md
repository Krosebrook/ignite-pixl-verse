# Test Strategy & Quality Assurance

> **Version**: 1.0.0  
> **Last Updated**: 2026-01-21  
> **Classification**: Internal Engineering  
> **Owner**: QA Team

---

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Test Pyramid](#test-pyramid)
3. [Coverage Requirements](#coverage-requirements)
4. [Testing Patterns](#testing-patterns)
5. [Test Types & Tools](#test-types--tools)
6. [CI/CD Integration](#cicd-integration)
7. [Test Data Management](#test-data-management)
8. [Performance Testing](#performance-testing)
9. [Security Testing](#security-testing)
10. [Accessibility Testing](#accessibility-testing)

---

## Testing Philosophy

### Core Principles

| Principle | Description |
|-----------|-------------|
| **Shift Left** | Test early, test often; catch bugs before production |
| **Test Behavior** | Test what the code does, not how it does it |
| **Maintainable Tests** | Tests should be easy to read, update, and debug |
| **Fast Feedback** | Unit tests < 100ms, integration < 5s, E2E < 60s |
| **Deterministic** | Same inputs always produce same outputs |
| **Independent** | Tests don't depend on other tests or external state |

### Testing Mindset

```
✅ DO: Test user-facing behavior
✅ DO: Test edge cases and error paths
✅ DO: Write tests before fixing bugs (TDD for fixes)
✅ DO: Keep tests focused and single-purpose

❌ DON'T: Test implementation details
❌ DON'T: Test third-party libraries
❌ DON'T: Write flaky tests
❌ DON'T: Ignore failing tests
```

---

## Test Pyramid

```
                    ┌───────────┐
                    │    E2E    │  ~10% of tests
                    │  (Slow)   │  User journeys
                    ├───────────┤
                    │           │
               ┌────┴───────────┴────┐
               │    Integration      │  ~20% of tests
               │    (Medium)         │  API, DB, Components
               ├─────────────────────┤
               │                     │
          ┌────┴─────────────────────┴────┐
          │          Unit Tests           │  ~70% of tests
          │          (Fast)               │  Functions, hooks, utils
          └───────────────────────────────┘
```

### Test Distribution

| Layer | Count Target | Execution Time | Purpose |
|-------|--------------|----------------|---------|
| Unit | 70% | < 30s total | Logic, utilities, hooks |
| Integration | 20% | < 2 min total | Components, API calls |
| E2E | 10% | < 10 min total | Critical user journeys |

---

## Coverage Requirements

### Minimum Coverage Thresholds

```javascript
// vitest.config.ts coverage settings
coverage: {
  provider: 'v8',
  reporter: ['text', 'lcov', 'html'],
  thresholds: {
    global: {
      statements: 70,
      branches: 70,
      functions: 70,
      lines: 70,
    },
  },
  include: ['src/**/*.{ts,tsx}'],
  exclude: [
    'src/**/*.stories.tsx',
    'src/**/*.test.{ts,tsx}',
    'src/integrations/supabase/types.ts',
    'src/vite-env.d.ts',
  ],
}
```

### Coverage by Module

| Module | Min Coverage | Current | Status |
|--------|--------------|---------|--------|
| Core utilities (`src/lib/`) | 90% | 85% | ⚠️ |
| Shared hooks (`src/hooks/`) | 85% | 78% | ⚠️ |
| UI components (`src/components/ui/`) | 80% | 82% | ✅ |
| Feature components | 70% | 71% | ✅ |
| Pages | 60% | 55% | ⚠️ |
| Edge functions | 85% | 87% | ✅ |

### Critical Path Coverage (Must be 100%)

- Authentication flows
- Payment processing
- Data encryption/decryption
- RLS policy enforcement
- Rate limiting logic

---

## Testing Patterns

### 1. Unit Testing Patterns

#### Testing Pure Functions

```typescript
// src/lib/utils.test.ts
import { describe, it, expect } from 'vitest';
import { formatCurrency, slugify, truncate } from './utils';

describe('formatCurrency', () => {
  it('formats cents to dollars', () => {
    expect(formatCurrency(1000)).toBe('$10.00');
  });

  it('handles zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('handles negative values', () => {
    expect(formatCurrency(-500)).toBe('-$5.00');
  });
});

describe('slugify', () => {
  it.each([
    ['Hello World', 'hello-world'],
    ['Multiple   Spaces', 'multiple-spaces'],
    ['Special!@#$Chars', 'specialchars'],
    ['Ümlauts & Áccents', 'umlauts-accents'],
  ])('converts "%s" to "%s"', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});
```

#### Testing React Hooks

```typescript
// src/hooks/useAuth.test.ts
import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(),
        })),
      })),
    })),
  },
}));

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with loading state', () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const { result } = renderHook(() => useAuth());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.user).toBeNull();
  });

  it('updates state after session load', async () => {
    const mockUser = { id: 'user-1', email: 'test@example.com' };
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: mockUser } },
      error: null,
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  it('handles sign in', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: { id: 'user-1' }, session: {} },
      error: null,
    });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn('test@example.com', 'password');
    });

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password',
    });
  });
});
```

### 2. Component Testing Patterns

#### Testing UI Components

```typescript
// src/components/ui/Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Button } from './button';

describe('Button', () => {
  it('renders with children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('applies variant classes correctly', () => {
    const { rerender } = render(<Button variant="destructive">Delete</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-destructive');

    rerender(<Button variant="outline">Cancel</Button>);
    expect(screen.getByRole('button')).toHaveClass('border');
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('shows loading state', () => {
    render(<Button loading>Submit</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });
});
```

#### Testing Form Components

```typescript
// src/components/auth/LoginForm.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { LoginForm } from './LoginForm';

describe('LoginForm', () => {
  const user = userEvent.setup();

  it('validates required fields', async () => {
    render(<LoginForm onSubmit={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    });
  });

  it('validates email format', async () => {
    render(<LoginForm onSubmit={vi.fn()} />);

    await user.type(screen.getByLabelText(/email/i), 'invalid-email');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
    });
  });

  it('submits with valid data', async () => {
    const handleSubmit = vi.fn();
    render(<LoginForm onSubmit={handleSubmit} />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'SecurePass123!');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'SecurePass123!',
      });
    });
  });
});
```

### 3. Integration Testing Patterns

#### Testing API Integration

```typescript
// tests/integration/edge-functions.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY!
);

describe('Edge Function Integration', () => {
  let authToken: string;

  beforeAll(async () => {
    const { data } = await supabase.auth.signInWithPassword({
      email: 'test@example.com',
      password: 'testpassword123',
    });
    authToken = data.session?.access_token!;
  });

  describe('generate-content', () => {
    it('generates text content successfully', async () => {
      const response = await supabase.functions.invoke('generate-content', {
        body: {
          type: 'text',
          prompt: 'Write a product description',
          org_id: 'test-org-id',
        },
      });

      expect(response.error).toBeNull();
      expect(response.data).toHaveProperty('content');
      expect(response.data).toHaveProperty('provenance');
    });

    it('rejects unauthenticated requests', async () => {
      const anonClient = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY!
      );

      const response = await anonClient.functions.invoke('generate-content', {
        body: { type: 'text', prompt: 'Test' },
      });

      expect(response.error?.message).toContain('Unauthorized');
    });

    it('enforces rate limits', async () => {
      const requests = Array(15).fill(null).map(() =>
        supabase.functions.invoke('generate-content', {
          body: { type: 'text', prompt: 'Rate limit test', org_id: 'test-org' },
        })
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.some(r => r.error?.message?.includes('rate'));

      expect(rateLimited).toBe(true);
    });
  });
});
```

#### Testing Database Operations

```typescript
// tests/integration/database.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

describe('Database RLS', () => {
  const testOrgId = 'test-org-uuid';
  const otherOrgId = 'other-org-uuid';

  beforeEach(async () => {
    // Sign in as test user (member of testOrgId)
    await supabase.auth.signInWithPassword({
      email: 'member@test.org',
      password: 'testpassword',
    });
  });

  afterEach(async () => {
    await supabase.auth.signOut();
  });

  it('allows reading own org assets', async () => {
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .eq('org_id', testOrgId);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it('blocks reading other org assets', async () => {
    const { data } = await supabase
      .from('assets')
      .select('*')
      .eq('org_id', otherOrgId);

    expect(data).toHaveLength(0); // RLS filters out
  });

  it('blocks inserting to other org', async () => {
    const { error } = await supabase.from('assets').insert({
      name: 'Malicious Asset',
      type: 'image',
      org_id: otherOrgId,
      user_id: 'current-user-id',
    });

    expect(error).not.toBeNull();
    expect(error?.message).toContain('row-level security');
  });
});
```

### 4. E2E Testing Patterns

#### Testing User Journeys

```typescript
// tests/e2e/golden-paths.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Content Generation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/auth');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('generates and saves a text asset', async ({ page }) => {
    // Navigate to content studio
    await page.click('text=Content Studio');
    await expect(page).toHaveURL('/content');

    // Select text generation
    await page.click('[data-testid="content-type-text"]');

    // Fill prompt
    await page.fill('[name="prompt"]', 'Write a product description for sneakers');

    // Generate
    await page.click('button:has-text("Generate")');

    // Wait for result
    await expect(page.locator('[data-testid="generated-content"]')).toBeVisible({
      timeout: 30000,
    });

    // Validate against brand
    await page.click('button:has-text("Validate Brand")');
    await expect(page.locator('[data-testid="brand-score"]')).toBeVisible();

    // Save asset
    await page.fill('[name="asset-name"]', 'Sneaker Description');
    await page.click('button:has-text("Save to Library")');

    // Verify saved
    await expect(page.locator('text=Asset saved successfully')).toBeVisible();

    // Navigate to library and verify
    await page.click('text=Library');
    await expect(page.locator('text=Sneaker Description')).toBeVisible();
  });
});

test.describe('Campaign Creation Flow', () => {
  test('creates and schedules a campaign', async ({ page }) => {
    await page.goto('/campaigns/new');

    // Step 1: Details
    await page.fill('[name="name"]', 'Summer Sale Campaign');
    await page.fill('[name="description"]', 'Promotional campaign');
    await page.click('button:has-text("Next")');

    // Step 2: Platforms
    await page.click('[data-testid="platform-instagram"]');
    await page.click('[data-testid="platform-tiktok"]');
    await page.click('button:has-text("Next")');

    // Step 3: Assets
    await page.click('[data-testid="asset-select"]');
    await page.click('[data-testid="asset-1"]');
    await page.click('button:has-text("Next")');

    // Step 4: Schedule
    await page.click('[data-testid="schedule-date"]');
    await page.click('text=15'); // Select 15th
    await page.fill('[name="time"]', '10:00');
    await page.click('button:has-text("Next")');

    // Step 5: Review
    await expect(page.locator('text=Summer Sale Campaign')).toBeVisible();
    await page.click('button:has-text("Create Campaign")');

    // Verify creation
    await expect(page.locator('text=Campaign created successfully')).toBeVisible();
    await expect(page).toHaveURL(/\/campaigns\/[a-f0-9-]+/);
  });
});
```

---

## Test Types & Tools

### Test Framework Stack

| Purpose | Tool | Version |
|---------|------|---------|
| Unit/Integration | Vitest | 3.2.x |
| Component Testing | Testing Library | 16.x |
| E2E Testing | Playwright | 1.57.x |
| Accessibility | axe-core | 4.10.x |
| Visual Regression | Playwright | Built-in |
| API Contract | Custom + Zod | - |
| Performance | Lighthouse CI | - |

### Test File Naming

```
src/
├── components/
│   └── ui/
│       ├── button.tsx
│       └── button.test.tsx      # Co-located unit test
├── hooks/
│   ├── useAuth.ts
│   └── useAuth.test.ts          # Co-located hook test
└── lib/
    ├── utils.ts
    └── utils.test.ts            # Co-located utility test

tests/
├── unit/                        # Additional unit tests
├── integration/                 # API/DB integration tests
├── e2e/                         # Playwright E2E tests
├── security/                    # Security-focused tests
├── accessibility/               # Accessibility tests
└── regression/                  # Visual regression tests
```

---

## CI/CD Integration

### Pipeline Stages

```yaml
# .github/workflows/ci.yml
name: CI Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      
      - name: Install dependencies
        run: bun install --frozen-lockfile
      
      - name: Lint
        run: bun run lint
      
      - name: Type check
        run: bun run typecheck
      
      - name: Format check
        run: bun run format:check

  unit-tests:
    runs-on: ubuntu-latest
    needs: quality
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      
      - name: Install dependencies
        run: bun install --frozen-lockfile
      
      - name: Run unit tests
        run: bun run test:unit --coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage/lcov.info
          fail_ci_if_error: true

  integration-tests:
    runs-on: ubuntu-latest
    needs: quality
    services:
      postgres:
        image: supabase/postgres:15.1.0.117
        env:
          POSTGRES_PASSWORD: postgres
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      
      - name: Run integration tests
        run: bun run test:integration
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/postgres

  e2e-tests:
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests]
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      
      - name: Install Playwright
        run: bunx playwright install --with-deps chromium
      
      - name: Build app
        run: bun run build
      
      - name: Run E2E tests
        run: bun run test:e2e
      
      - name: Upload test artifacts
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/

  accessibility-tests:
    runs-on: ubuntu-latest
    needs: quality
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      
      - name: Run accessibility tests
        run: bun run test:a11y

  security-tests:
    runs-on: ubuntu-latest
    needs: quality
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      
      - name: Run security tests
        run: bun run test:security
      
      - name: Run dependency audit
        run: bun audit --audit-level=high

  performance:
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests]
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      
      - name: Build
        run: bun run build
      
      - name: Run Lighthouse CI
        run: bunx @lhci/cli autorun
```

### Test Commands

```json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest run --config vitest.config.ts",
    "test:integration": "vitest run --config vitest.integration.config.ts",
    "test:e2e": "playwright test",
    "test:a11y": "vitest run tests/accessibility/",
    "test:security": "vitest run tests/security/",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui"
  }
}
```

### Quality Gates

| Gate | Threshold | Blocks Deploy |
|------|-----------|---------------|
| Unit test pass rate | 100% | ✅ |
| Integration test pass rate | 100% | ✅ |
| E2E test pass rate | 100% | ✅ |
| Code coverage | ≥70% | ✅ |
| Critical path coverage | 100% | ✅ |
| Accessibility violations | 0 critical | ✅ |
| Security vulnerabilities | 0 high/critical | ✅ |
| Lighthouse performance | ≥90 | ⚠️ Warning |

---

## Test Data Management

### Test Fixtures

```typescript
// tests/fixtures/users.ts
export const testUsers = {
  admin: {
    email: 'admin@test.org',
    password: 'AdminPass123!',
    role: 'admin',
    orgId: 'org-test-uuid',
  },
  member: {
    email: 'member@test.org',
    password: 'MemberPass123!',
    role: 'member',
    orgId: 'org-test-uuid',
  },
  viewer: {
    email: 'viewer@test.org',
    password: 'ViewerPass123!',
    role: 'viewer',
    orgId: 'org-test-uuid',
  },
};

// tests/fixtures/assets.ts
export const testAssets = {
  textAsset: {
    id: 'asset-text-uuid',
    name: 'Test Text Asset',
    type: 'text',
    content_data: { text: 'Sample content' },
  },
  imageAsset: {
    id: 'asset-image-uuid',
    name: 'Test Image Asset',
    type: 'image',
    content_url: 'https://example.com/image.jpg',
  },
};
```

### Database Seeding

```typescript
// tests/setup/seed.ts
import { supabase } from '@/integrations/supabase/client';

export async function seedTestDatabase() {
  // Create test organization
  const { data: org } = await supabase.rpc('create_org_with_owner', {
    p_name: 'Test Organization',
    p_slug: 'test-org',
  });

  // Create test members
  for (const user of Object.values(testUsers)) {
    await supabase.from('members').insert({
      org_id: org.id,
      user_id: user.id,
      role: user.role,
    });
  }

  // Create test assets
  for (const asset of Object.values(testAssets)) {
    await supabase.from('assets').insert({
      ...asset,
      org_id: org.id,
      user_id: testUsers.member.id,
    });
  }
}

export async function cleanupTestDatabase() {
  // Delete in reverse dependency order
  await supabase.from('assets').delete().eq('org_id', testOrgId);
  await supabase.from('members').delete().eq('org_id', testOrgId);
  await supabase.from('orgs').delete().eq('id', testOrgId);
}
```

### Test Isolation

```typescript
// tests/setup.ts
import { beforeEach, afterEach } from 'vitest';

beforeEach(async () => {
  // Create isolated test transaction
  await supabase.rpc('begin_test_transaction');
});

afterEach(async () => {
  // Rollback transaction to reset state
  await supabase.rpc('rollback_test_transaction');
});
```

---

## Performance Testing

### Lighthouse CI Configuration

```javascript
// lighthouserc.js
module.exports = {
  ci: {
    collect: {
      url: [
        'http://localhost:3000/',
        'http://localhost:3000/dashboard',
        'http://localhost:3000/content',
      ],
      numberOfRuns: 3,
    },
    assert: {
      preset: 'lighthouse:recommended',
      assertions: {
        'first-contentful-paint': ['warn', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.08 }],
        'total-blocking-time': ['warn', { maxNumericValue: 200 }],
        'speed-index': ['warn', { maxNumericValue: 3000 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
```

### Bundle Size Monitoring

```typescript
// tests/performance/bundle-size.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { gzipSync } from 'zlib';

describe('Bundle Size', () => {
  const distPath = './dist/assets';

  it('JS bundles are under 180KB gzipped', () => {
    const jsFiles = readdirSync(distPath).filter(f => f.endsWith('.js'));
    
    for (const file of jsFiles) {
      const content = readFileSync(`${distPath}/${file}`);
      const gzipped = gzipSync(content);
      const sizeKB = gzipped.length / 1024;
      
      expect(sizeKB, `${file} is ${sizeKB.toFixed(2)}KB`).toBeLessThan(180);
    }
  });

  it('CSS bundles are under 35KB gzipped', () => {
    const cssFiles = readdirSync(distPath).filter(f => f.endsWith('.css'));
    
    for (const file of cssFiles) {
      const content = readFileSync(`${distPath}/${file}`);
      const gzipped = gzipSync(content);
      const sizeKB = gzipped.length / 1024;
      
      expect(sizeKB, `${file} is ${sizeKB.toFixed(2)}KB`).toBeLessThan(35);
    }
  });
});
```

---

## Security Testing

### RLS Negative Tests

```typescript
// tests/security/rls-negative.test.ts
import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

describe('RLS Negative Tests', () => {
  it('blocks cross-org asset access', async () => {
    // Sign in as org A member
    const clientA = createClient(url, key);
    await clientA.auth.signInWithPassword({ email: 'a@org-a.com', password: 'pass' });

    // Attempt to read org B assets
    const { data } = await clientA
      .from('assets')
      .select('*')
      .eq('org_id', 'org-b-uuid');

    expect(data).toHaveLength(0);
  });

  it('blocks privilege escalation', async () => {
    const client = createClient(url, key);
    await client.auth.signInWithPassword({ email: 'member@org.com', password: 'pass' });

    const { error } = await client
      .from('members')
      .update({ role: 'owner' })
      .eq('user_id', 'current-user-id');

    expect(error).not.toBeNull();
  });

  it('blocks unauthenticated access', async () => {
    const anonClient = createClient(url, key);

    const { data, error } = await anonClient.from('assets').select('*');

    expect(data).toHaveLength(0);
  });
});
```

---

## Accessibility Testing

### axe-core Integration

```typescript
// tests/accessibility/axe.test.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility', () => {
  test('Landing page has no violations', async ({ page }) => {
    await page.goto('/');
    
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('Dashboard has no violations', async ({ page }) => {
    await page.goto('/auth');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('Forms are keyboard accessible', async ({ page }) => {
    await page.goto('/auth');

    // Tab through form
    await page.keyboard.press('Tab');
    await expect(page.locator('[name="email"]')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('[name="password"]')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('button[type="submit"]')).toBeFocused();
  });
});
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-21 | QA Team | Initial comprehensive strategy |
