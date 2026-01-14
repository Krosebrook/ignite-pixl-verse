# CLAUDE.md - AI Assistant Development Guide

This document provides comprehensive context for AI assistants (Claude, GPT, Gemini, etc.) working with the FlashFusion Creative Mega App codebase.

---

## Project Overview

**FlashFusion** is an AI-powered content creation and campaign management platform built for creators, marketers, and agencies. It enables users to:

- Generate AI content (text, images, video, music)
- Manage multi-channel marketing campaigns
- Schedule and publish to social platforms
- Enforce brand consistency across assets
- Analyze performance metrics

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript 5, Vite 5 |
| Styling | Tailwind CSS v4, shadcn/ui |
| State | TanStack Query (server), useState (local) |
| Routing | React Router v6 |
| Backend | Supabase (Postgres, Auth, Edge Functions) |
| Testing | Vitest, Playwright, axe-core |
| Observability | Sentry, PostHog, OpenTelemetry |

---

## Directory Structure

```
ignite-pixl-verse/
├── src/
│   ├── components/           # React components
│   │   ├── ui/              # shadcn/ui primitives (59 components)
│   │   ├── analytics/       # Analytics visualizations
│   │   ├── campaigns/       # Campaign management
│   │   ├── content/         # Content generation
│   │   ├── monitoring/      # System monitoring
│   │   ├── roadmap/         # Roadmap display
│   │   ├── schedule/        # Scheduling UI
│   │   ├── AppSidebar.tsx   # Main navigation
│   │   ├── ErrorBoundary.tsx
│   │   ├── Layout.tsx
│   │   ├── MobileNav.tsx
│   │   ├── ThemeProvider.tsx
│   │   └── ThemeToggle.tsx
│   ├── pages/               # Route pages (21 total)
│   ├── hooks/               # Custom React hooks (8 hooks)
│   ├── lib/                 # Utilities and services
│   ├── integrations/        # Supabase client and types
│   └── assets/              # Static assets
├── supabase/
│   ├── functions/           # Edge Functions (17 functions)
│   │   ├── _shared/        # Shared utilities
│   │   └── [function-name]/ # Individual functions
│   ├── migrations/          # Database migrations
│   └── config.toml         # Supabase configuration
├── tests/
│   ├── unit/               # Vitest tests
│   ├── e2e/                # Playwright tests
│   ├── contract/           # API schema tests
│   ├── accessibility/      # axe-core tests
│   ├── security/           # RLS tests
│   └── setup.ts            # Test configuration
├── docs/                    # Technical documentation (28 files)
├── example_packs/           # Marketplace pack examples
└── .github/workflows/       # CI/CD pipelines
```

---

## Key Files to Understand

### Entry Points
- `src/main.tsx` - Application entry point
- `src/App.tsx` - Route configuration and providers
- `index.html` - HTML template

### Core Components
- `src/components/AppSidebar.tsx` - Navigation structure
- `src/components/Layout.tsx` - Page layout wrapper
- `src/components/ErrorBoundary.tsx` - Error handling

### State Management
- `src/hooks/useAuth.ts` - Authentication state and methods
- `src/hooks/useOrganization.ts` - Org data fetching
- `src/hooks/useCampaignBuilder.ts` - Campaign form state

### API Layer
- `src/lib/api.ts` - Error handling, retry logic, types
- `src/lib/validation.ts` - Zod schemas for input validation
- `src/integrations/supabase/client.ts` - Supabase client

### Styling
- `src/index.css` - Global styles, CSS variables
- `tailwind.config.ts` - Tailwind customization

---

## Architecture Patterns

### 1. Multi-Tenant Data Isolation

All data is scoped to organizations via Row-Level Security:

```sql
-- Every table with org_id has policies like:
CREATE POLICY "Users can view org data"
ON public.table_name FOR SELECT
USING (org_id IN (
  SELECT org_id FROM public.org_members
  WHERE user_id = auth.uid()
));
```

**Important**: Never bypass RLS. Always use the authenticated Supabase client.

### 2. Protected Routes

Routes are protected in two layers:

```tsx
// Layer 1: Authentication check
<ProtectedRoute>
  // Layer 2: Onboarding completion check
  <RequiresOnboardingRoute>
    <Page />
  </RequiresOnboardingRoute>
</ProtectedRoute>
```

### 3. Server State with React Query

```tsx
// Fetching data
const { data, isLoading, error } = useQuery({
  queryKey: ['campaigns', orgId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('org_id', orgId);
    if (error) throw error;
    return data;
  }
});

// Mutations
const mutation = useMutation({
  mutationFn: async (newCampaign) => {
    const { data, error } = await supabase
      .from('campaigns')
      .insert(newCampaign);
    if (error) throw error;
    return data;
  },
  onSuccess: () => {
    queryClient.invalidateQueries(['campaigns']);
  }
});
```

### 4. Form Validation with Zod

```tsx
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const schema = z.object({
  name: z.string().min(1, 'Name required').max(100),
  email: z.string().email('Invalid email'),
});

const form = useForm({
  resolver: zodResolver(schema),
});
```

### 5. Edge Function Pattern

```typescript
// supabase/functions/[name]/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  // CORS handling
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth check
  const authHeader = req.headers.get('Authorization');
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  // Get user
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Business logic here
  // ...

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
```

---

## Database Schema

### Core Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `orgs` | Workspaces | id, name, slug, settings |
| `org_members` | User-org relationships | org_id, user_id, role |
| `assets` | Generated content | org_id, type, content, metadata |
| `campaigns` | Marketing campaigns | org_id, name, status, platforms |
| `schedules` | Scheduled posts | campaign_id, platform, scheduled_at |
| `analytics_events` | Event tracking | org_id, event_type, metadata |
| `audit_log` | Security audit trail | org_id, action, resource_type |
| `brand_kits` | Brand guidelines | org_id, colors, fonts, rules |

### Asset Types
- `text` - Generated copy
- `image` - Generated visuals
- `video` - Video content (placeholder)
- `music` - Audio content (placeholder)

### Campaign Statuses
- `draft` - In progress
- `active` - Currently running
- `completed` - Finished
- `archived` - Stored for reference

### Member Roles
- `owner` - Full access, billing
- `admin` - Full access, no billing
- `member` - Create and edit own content
- `viewer` - Read-only access

---

## Common Development Tasks

### Adding a New Page

1. Create page component in `src/pages/`:
```tsx
// src/pages/NewFeature.tsx
import Layout from "@/components/Layout";

export default function NewFeature() {
  return (
    <Layout>
      <div className="container mx-auto py-6">
        <h1 className="text-2xl font-bold">New Feature</h1>
      </div>
    </Layout>
  );
}
```

2. Add route in `src/App.tsx`:
```tsx
<Route path="/new-feature" element={
  <ProtectedRoute>
    <RequiresOnboardingRoute>
      <NewFeature />
    </RequiresOnboardingRoute>
  </ProtectedRoute>
} />
```

3. Add to sidebar in `src/components/AppSidebar.tsx`

### Adding a New Edge Function

1. Create function directory:
```bash
mkdir supabase/functions/new-function
```

2. Create `index.ts`:
```typescript
// supabase/functions/new-function/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// ... implementation
```

3. Deploy:
```bash
supabase functions deploy new-function
```

### Adding a UI Component

Use shadcn/ui CLI:
```bash
npx shadcn-ui@latest add [component-name]
```

Or create custom in `src/components/`:
```tsx
interface Props {
  title: string;
  children: React.ReactNode;
}

export function CustomCard({ title, children }: Props) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="font-semibold">{title}</h3>
      {children}
    </div>
  );
}
```

### Creating a Custom Hook

```tsx
// src/hooks/useFeature.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useFeature(id: string) {
  return useQuery({
    queryKey: ['feature', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('features')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}
```

---

## Code Style Guidelines

### TypeScript
- Use strict mode (enabled in tsconfig)
- Prefer interfaces over types for objects
- Avoid `any` - use `unknown` and type guards
- Export types alongside implementations

### React
- Functional components only (no classes)
- Use named exports for components
- Props interface named `[Component]Props`
- Hooks start with `use`

### Naming Conventions
```
Components:     PascalCase    (UserCard.tsx)
Hooks:          camelCase     (useAuth.ts)
Utilities:      camelCase     (formatDate.ts)
Constants:      UPPER_SNAKE   (API_BASE_URL)
CSS classes:    kebab-case    (user-card-container)
```

### File Organization
```tsx
// 1. Imports (external, then internal)
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

// 2. Types/Interfaces
interface Props {
  id: string;
}

// 3. Component
export function Component({ id }: Props) {
  // 3a. Hooks
  const { user } = useAuth();
  const [state, setState] = useState('');

  // 3b. Handlers
  const handleClick = () => { /* ... */ };

  // 3c. Render
  return <div>...</div>;
}
```

---

## Testing Guidelines

### Unit Tests (Vitest)

```typescript
// tests/unit/Component.test.tsx
import { render, screen } from '@testing-library/react';
import { Component } from '@/components/Component';

describe('Component', () => {
  it('renders correctly', () => {
    render(<Component title="Test" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});
```

Run: `npm run test:unit`

### E2E Tests (Playwright)

```typescript
// tests/e2e/feature.spec.ts
import { test, expect } from '@playwright/test';

test('user can create campaign', async ({ page }) => {
  await page.goto('/campaigns');
  await page.click('text=New Campaign');
  await page.fill('[name="name"]', 'Test Campaign');
  await page.click('text=Save');
  await expect(page.locator('text=Test Campaign')).toBeVisible();
});
```

Run: `npm run test:e2e`

---

## Security Considerations

### Do's
- Always use parameterized queries via Supabase client
- Validate all user input with Zod schemas
- Check user permissions before mutations
- Log sensitive actions to audit_log
- Use environment variables for secrets

### Don'ts
- Never expose service role key to client
- Never trust client-side data without validation
- Never bypass RLS policies
- Never commit secrets to repository
- Never use `dangerouslySetInnerHTML` without sanitization

### Input Validation Patterns

```typescript
// lib/validation.ts includes safety patterns:
const BLOCKED_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /jailbreak/i,
  /bypass/i,
  /<script/i,  // XSS prevention
];

export function validatePrompt(prompt: string): boolean {
  return !BLOCKED_PATTERNS.some(pattern => pattern.test(prompt));
}
```

---

## Performance Guidelines

### Bundle Size Targets
- JS: ≤180KB (gzip) per route
- CSS: ≤35KB (gzip)
- Images: Lazy load, use WebP

### Core Web Vitals Targets
- LCP: ≤2.5s
- INP: ≤200ms
- CLS: ≤0.1

### Optimization Patterns

```tsx
// Lazy loading pages
const Dashboard = lazy(() => import('./pages/Dashboard'));

// Image optimization
<img
  src={src}
  loading="lazy"
  decoding="async"
  width={300}
  height={200}
/>

// Memoization for expensive computations
const expensiveValue = useMemo(() => compute(data), [data]);
```

---

## Debugging Tips

### Common Issues

1. **"RLS policy violation"**
   - Check user is authenticated
   - Verify org membership
   - Check policy conditions

2. **"Component not found"**
   - Verify import path aliases (@/)
   - Check file exists and is exported

3. **"Hook called outside component"**
   - Hooks must be in component body
   - Check for conditional hook calls

4. **"Type error on Supabase response"**
   - Regenerate types: `supabase gen types typescript`
   - Check for schema changes

### Logging

```typescript
// Development logging
if (import.meta.env.DEV) {
  console.log('[Debug]', data);
}

// Production error tracking
import * as Sentry from '@sentry/react';
Sentry.captureException(error);
```

---

## API Reference

### Edge Functions

| Function | Method | Auth | Purpose |
|----------|--------|------|---------|
| `generate-content` | POST | JWT | AI content generation |
| `campaigns-draft` | POST | JWT | AI campaign planning |
| `schedule` | POST | JWT | Schedule posts |
| `publish-post` | POST | - | Publish to platforms |
| `marketplace-install` | POST | JWT | Install packs |
| `events-ingest` | POST | JWT | Track analytics |
| `gdpr-export` | POST | JWT | Export user data |
| `gdpr-delete` | POST | JWT | Delete user data |
| `health` | GET | - | Health check |

### Supabase Client Usage

```typescript
import { supabase } from '@/integrations/supabase/client';

// Query
const { data, error } = await supabase
  .from('table')
  .select('*')
  .eq('column', value);

// Insert
const { data, error } = await supabase
  .from('table')
  .insert({ column: value });

// Update
const { data, error } = await supabase
  .from('table')
  .update({ column: value })
  .eq('id', id);

// Delete
const { error } = await supabase
  .from('table')
  .delete()
  .eq('id', id);

// Call Edge Function
const { data, error } = await supabase.functions.invoke('function-name', {
  body: { key: 'value' }
});
```

---

## Environment Variables

### Required (Client)
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
```

### Optional (Client)
```
VITE_SENTRY_DSN=https://xxx@sentry.io/xxx
VITE_POSTHOG_KEY=phc_xxx
VITE_ENABLE_VIDEO_GENERATION=true
```

### Edge Functions (Server)
```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
OPENAI_API_KEY=sk-xxx
```

---

## Incomplete Features (Known Gaps)

These features are partially implemented:

1. **Video/Music Generation** - UI exists, API not integrated
2. **Social Media OAuth** - UI exists, flows incomplete
3. **Marketplace Installation** - Edge function exists, logic incomplete
4. **Brand Rule Enforcement** - Rules defined, validation not integrated
5. **Translation Workflow** - UI placeholder, API not integrated
6. **A/B Testing** - Schema ready, no UI or logic

See `docs/roadmap.md` for implementation plans.

---

## Getting Help

- **Architecture Questions**: See `docs/architecture.md`
- **Security Questions**: See `docs/security.md`, `SECURITY.md`
- **API Documentation**: See `docs/openapi.yaml`
- **Contributing**: See `CONTRIBUTING.md`

---

## Quick Commands

```bash
# Development
npm run dev              # Start dev server
npm run build           # Production build
npm run preview         # Preview build

# Testing
npm test                # All tests
npm run test:unit       # Unit tests
npm run test:e2e        # E2E tests
npm run test:a11y       # Accessibility

# Linting
npm run lint            # ESLint
npm run typecheck       # TypeScript

# Supabase
supabase start          # Local Supabase
supabase db push        # Apply migrations
supabase functions serve # Local functions
```

---

*Last updated: 2025-12-30*
