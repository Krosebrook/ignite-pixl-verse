# FlashFusion Best Practices Guide

**Last Updated**: January 21, 2026  
**Audience**: All contributors and AI assistants

---

## 📐 Architecture Principles

### 1. Multi-Tenant by Default
Every table with user data MUST be scoped by `org_id` with RLS policies.

```sql
-- Required pattern for all org-scoped tables
CREATE POLICY "Users can view own org data" ON public.table_name
FOR SELECT USING (
  org_id IN (SELECT org_id FROM public.members WHERE user_id = auth.uid())
);
```

### 2. Server-First Data
Use TanStack Query for all server state. Never store fetched data in local state.

```typescript
// ✅ CORRECT
const { data, isLoading } = useQuery({
  queryKey: ['campaigns', orgId],
  queryFn: fetchCampaigns
});

// ❌ WRONG - storing server data in useState
const [campaigns, setCampaigns] = useState([]);
useEffect(() => { setCampaigns(data); }, [data]);
```

### 3. Type Everything
No `any` types. Use `unknown` with type guards when necessary.

```typescript
// ✅ CORRECT
function handleError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Unknown error';
}

// ❌ WRONG
function handleError(error: any): string { ... }
```

---

## 🛡️ Security Best Practices

### Input Validation
1. **Client-side**: Use Zod with React Hook Form
2. **Server-side**: Validate again in Edge Functions (defense in depth)
3. **Never trust**: Any data from the client

```typescript
// Edge function validation
const schema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
});

const parsed = schema.safeParse(body);
if (!parsed.success) {
  return new Response(JSON.stringify({ error: 'Validation failed' }), { status: 400 });
}
```

### Secret Management
- ❌ Never hardcode API keys
- ❌ Never commit .env files
- ✅ Use Supabase secrets for edge functions
- ✅ Use environment variables with VITE_ prefix for client

### RLS Checklist
- [ ] All tables with user data have RLS enabled
- [ ] Policies use `auth.uid()` not client-passed user IDs
- [ ] Negative tests exist for cross-org access
- [ ] Admin actions require role check

---

## 🎨 UI/UX Best Practices

### Component Structure
```typescript
// File: src/components/feature/FeatureCard.tsx

// 1. Imports (external first, then internal)
import { useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';

// 2. Types
interface FeatureCardProps {
  id: string;
  title: string;
  onSelect?: (id: string) => void;
}

// 3. Component (named export)
export function FeatureCard({ id, title, onSelect }: FeatureCardProps) {
  // 3a. Hooks first
  const { user } = useAuth();
  const [isHovered, setIsHovered] = useState(false);

  // 3b. Handlers
  const handleClick = useCallback(() => {
    onSelect?.(id);
  }, [id, onSelect]);

  // 3c. Early returns
  if (!user) return null;

  // 3d. Render
  return (
    <Card onClick={handleClick}>
      {title}
    </Card>
  );
}
```

### Loading & Error States
Every async operation MUST have:
1. Loading indicator during fetch
2. Error boundary or error UI
3. Empty state when no data

```typescript
// ✅ CORRECT - Complete state handling
const { data, isLoading, error } = useQuery({ ... });

if (isLoading) return <LoadingSpinner />;
if (error) return <ErrorMessage error={error} />;
if (!data?.length) return <EmptyState message="No campaigns yet" />;
return <CampaignList data={data} />;
```

### Accessibility Requirements
- [ ] All images have descriptive `alt` text
- [ ] Icon-only buttons have `aria-label`
- [ ] Form fields have associated `<label>`
- [ ] Focus visible on all interactive elements
- [ ] Color contrast ≥4.5:1 for text
- [ ] Keyboard navigable (Tab, Enter, Escape)

---

## 🧪 Testing Best Practices

### Test Pyramid
1. **Unit tests** (Vitest): Core logic, utilities, validators
2. **Component tests**: UI behavior, state changes
3. **Contract tests**: API schema validation
4. **E2E tests** (Playwright): Critical user paths
5. **A11y tests** (axe-core): Accessibility compliance

### What to Test
```typescript
// Test validation logic
describe('campaignSchema', () => {
  it('rejects empty name', () => {
    const result = campaignSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });
});

// Test error boundaries
describe('ErrorBoundary', () => {
  it('catches and displays errors', () => {
    render(<ErrorBoundary><BrokenComponent /></ErrorBoundary>);
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });
});
```

### What NOT to Test
- Implementation details (CSS classes, internal state)
- Third-party library internals
- Auto-generated types

---

## 📝 Documentation Best Practices

### Code Comments
```typescript
// ❌ WRONG - Explains WHAT (obvious)
// Increment counter by 1
counter++;

// ✅ CORRECT - Explains WHY
// Add 1 for the current user (not included in query results)
counter++;
```

### JSDoc for Public APIs
```typescript
/**
 * Validates content against brand rules
 * @param content - The generated content to validate
 * @param brandKit - The org's active brand kit
 * @returns Validation result with score and violations
 */
export function validateBrand(content: string, brandKit: BrandKit): ValidationResult {
  // ...
}
```

### README Updates
Update README.md when:
- [ ] Adding new feature
- [ ] Changing setup steps
- [ ] Adding new environment variables
- [ ] Modifying test commands

---

## 🔧 Edge Function Best Practices

### Standard Structure
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/http.ts";
import { validateRequest } from "../_shared/validation.ts";

serve(async (req) => {
  // 1. CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 2. Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Unauthorized');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('Unauthorized');

    // 3. Validate input
    const body = await req.json();
    const validated = validateRequest(body);

    // 4. Business logic
    const result = await processRequest(supabase, validated, user);

    // 5. Success response
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    // 6. Error response
    console.error('[EdgeFunction]', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: error.message === 'Unauthorized' ? 401 : 500, headers: corsHeaders }
    );
  }
});
```

### Use Shared Utilities
```typescript
// ✅ CORRECT - Use shared retry logic
import { withRetry } from '../_shared/retry.ts';
const result = await withRetry(() => callExternalAPI(), { maxRetries: 3 });

// ❌ WRONG - Duplicate retry implementation
let attempts = 0;
while (attempts < 3) { ... }
```

---

## 📊 Performance Best Practices

### Bundle Size
- Lazy load routes: `const Page = lazy(() => import('./Page'))`
- Import only needed icons: `import { Home } from 'lucide-react'`
- Check bundle: `npm run build && npm run analyze`

### Database Queries
- Add indexes on `org_id`, `user_id`, `created_at`
- Use `.select('id, name')` not `.select('*')` when possible
- Paginate large result sets
- Use `.maybeSingle()` when row might not exist

### React Performance
```typescript
// Memoize expensive computations
const sorted = useMemo(() => 
  data.sort((a, b) => b.date - a.date), 
  [data]
);

// Memoize callbacks passed to children
const handleClick = useCallback((id: string) => {
  setSelected(id);
}, []);

// Avoid inline objects in deps
// ❌ options={{ limit: 10 }}
// ✅ const options = useMemo(() => ({ limit: 10 }), []);
```

---

## 🚀 Deployment Best Practices

### Pre-Deployment Checklist
- [ ] All tests passing
- [ ] No TypeScript errors
- [ ] Bundle size within budget
- [ ] Secrets rotated if needed
- [ ] Database migrations applied
- [ ] Edge functions deployed
- [ ] Rollback plan documented

### Post-Deployment
- [ ] Smoke test critical paths
- [ ] Monitor error rate in Sentry
- [ ] Check performance metrics
- [ ] Verify analytics events firing

---

## 📚 Quick Reference

### Naming Conventions
| Item | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `UserCard.tsx` |
| Hooks | camelCase, use prefix | `useAuth.ts` |
| Utils | camelCase | `formatDate.ts` |
| Constants | UPPER_SNAKE | `MAX_RETRIES` |
| Types | PascalCase | `CampaignStatus` |
| Files | Match export | `UserCard.tsx` |

### Import Order
```typescript
// 1. React
import { useState, useEffect } from 'react';

// 2. External packages
import { useQuery } from '@tanstack/react-query';

// 3. Internal aliases (@/)
import { Button } from '@/components/ui/button';

// 4. Relative imports
import { localUtil } from './utils';

// 5. Types
import type { Campaign } from '@/types';
```

---

**Questions?** See `docs/architecture.md` or `CONTRIBUTING.md`
