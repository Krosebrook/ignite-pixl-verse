# Security Architecture & Baseline

**Status:** ✅ Production-Ready  
**Last Review:** 2025-10-01  
**Next Review:** 2026-01-01

---

## Table of Contents
1. [Threat Model](#threat-model)
2. [Row-Level Security (RLS)](#row-level-security)
3. [Authentication Flow](#authentication-flow)
4. [Content Security Policy](#content-security-policy)
5. [API Security](#api-security)
6. [Secrets Management](#secrets-management)
7. [Input Validation](#input-validation)
8. [Security Testing](#security-testing)
9. [Unknown Unknowns Radar](#unknown-unknowns-radar)

---

## Threat Model

### Assets
- **User-generated content**: Text, images, videos, brand kits
- **Organization data**: Members, campaigns, schedules, analytics
- **Authentication credentials**: JWTs, session tokens
- **API keys**: AI provider keys, third-party integrations
- **PII**: User emails, profile data, payment information

### Threats
1. **Cross-org data access**: Users accessing data from other organizations
2. **Privilege escalation**: Member attempting admin actions
3. **Injection attacks**: SQL, XSS, command injection via user input
4. **API abuse**: Rate limiting bypass, resource exhaustion
5. **Token theft**: JWT/session hijacking
6. **Supply chain**: Compromised dependencies
7. **Data exfiltration**: Bulk export attacks

### Attack Vectors
- Malicious org members
- Compromised user accounts
- Public-facing edge functions
- Client-side code manipulation
- Third-party integrations

---

## Row-Level Security (RLS)

### Philosophy
**Zero-trust, org-scoped by default.** Every table enforces:
1. User must be authenticated (`auth.uid()` returns valid UUID)
2. User must be a member of the org (`org_id` check via `members` table)
3. Role-based actions (owner/admin for destructive ops)

### Enabled Tables
✅ All tables have RLS enabled:
- `orgs`
- `members`
- `brand_kits`
- `templates`
- `assets`
- `campaigns`
- `schedules`
- `marketplace_items`

### Policy Patterns

#### 1. Org-Scoped Read (SELECT)
```sql
-- Users can view records belonging to their orgs
CREATE POLICY "users_view_org_data" ON public.assets
FOR SELECT USING (
  org_id IN (
    SELECT org_id FROM public.members 
    WHERE user_id = auth.uid()
  )
);
```

#### 2. User-Owned Write (INSERT/UPDATE)
```sql
-- Users can create assets in their orgs
CREATE POLICY "users_create_org_assets" ON public.assets
FOR INSERT WITH CHECK (
  org_id IN (
    SELECT org_id FROM public.members 
    WHERE user_id = auth.uid()
  )
  AND user_id = auth.uid()
);

-- Users can only update their own assets
CREATE POLICY "users_update_own_assets" ON public.assets
FOR UPDATE USING (user_id = auth.uid());
```

#### 3. Role-Based Admin Actions
```sql
-- Only org owners/admins can manage members
CREATE POLICY "admins_manage_members" ON public.members
FOR ALL USING (
  org_id IN (
    SELECT org_id FROM public.members 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin')
  )
);
```

#### 4. Public Read (Marketplace)
```sql
-- Anyone can view marketplace items
CREATE POLICY "public_view_marketplace" ON public.marketplace_items
FOR SELECT USING (true);

-- Only creators can manage their items
CREATE POLICY "creators_manage_items" ON public.marketplace_items
FOR ALL USING (creator_id = auth.uid());
```

### Testing RLS Policies

**Negative Tests (Must Fail):**
```sql
-- Test 1: User A cannot read User B's org data
-- Login as user_a, attempt: SELECT * FROM assets WHERE org_id = '<user_b_org>';
-- Expected: 0 rows returned

-- Test 2: Member cannot delete org
-- Login as member, attempt: DELETE FROM orgs WHERE id = '<org_id>';
-- Expected: Error or 0 rows deleted

-- Test 3: Non-member cannot create assets in org
-- Login as outsider, attempt: INSERT INTO assets (org_id, ...) VALUES ('<other_org>', ...);
-- Expected: RLS policy violation error
```

**Positive Tests (Must Succeed):**
```sql
-- Test 1: User can read own org data
SELECT * FROM assets WHERE org_id IN (SELECT org_id FROM members WHERE user_id = auth.uid());
-- Expected: Returns user's org assets

-- Test 2: Admin can invite members
INSERT INTO members (org_id, user_id, role) VALUES (...);
-- Expected: Success if caller is admin

-- Test 3: Creator can update marketplace items
UPDATE marketplace_items SET price_cents = 999 WHERE creator_id = auth.uid();
-- Expected: Success
```

---

## Authentication Flow

### Stack
- **Provider**: Supabase Auth (OAuth, magic link, email/password)
- **Storage**: localStorage (persistent sessions)
- **Token**: JWT (1hr expiry, auto-refresh enabled)

### Flow Diagram
```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │ 1. signUp/signIn
       ▼
┌─────────────────┐
│  Supabase Auth  │◄──── Email verification (auto-confirm in dev)
└────────┬────────┘
         │ 2. Returns JWT + session
         ▼
┌─────────────────┐
│  localStorage   │◄──── Persisted by @supabase/supabase-js
└────────┬────────┘
         │ 3. onAuthStateChange listener
         ▼
┌─────────────────┐
│   React Context │◄──── Sets user/session state
└────────┬────────┘
         │ 4. Renders <ProtectedRoute>
         ▼
┌─────────────────┐
│  Edge Functions │◄──── All requests include Authorization: Bearer <JWT>
└─────────────────┘
         │ 5. Validates JWT (verify_jwt = true by default)
         ▼
┌─────────────────┐
│   RLS Policies  │◄──── auth.uid() extracts user_id from JWT
└─────────────────┘
```

### Implementation

**Frontend (src/App.tsx):**
```typescript
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (isAuthenticated === null) return <LoadingSpinner />;
  return isAuthenticated ? <>{children}</> : <Navigate to="/auth" />;
}
```

**Edge Functions (supabase/functions/*/index.ts):**
```typescript
// JWT verification enabled by default (supabase/config.toml)
// Authorization header required for all requests

const authHeader = req.headers.get('Authorization');
if (!authHeader) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Supabase client automatically validates JWT
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_ANON_KEY')!,
  { global: { headers: { Authorization: authHeader } } }
);

const { data: { user }, error } = await supabaseClient.auth.getUser();
if (error || !user) {
  return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401 });
}
```

### Session Management
- **Expiry**: 1 hour (configurable in Supabase dashboard)
- **Refresh**: Automatic via `autoRefreshToken: true`
- **Logout**: `supabase.auth.signOut()` clears localStorage + invalidates server session

---

## Content Security Policy

### CSP Headers (index.html)
```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: https: blob:;
  connect-src 'self' https://*.supabase.co https://api.lovable.app;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
">
```

**Why `unsafe-inline` / `unsafe-eval`?**
- **Development**: Vite HMR requires eval
- **Production TODO**: Migrate to `strict-dynamic` + nonces for scripts
- **Mitigation**: All user content is sanitized before rendering

### Upgrade Path
1. Generate CSP nonces in Vite build
2. Replace `'unsafe-inline'` with `'nonce-<random>'`
3. Remove `'unsafe-eval'` (ensure no dynamic code execution)
4. Add `report-uri` for CSP violation monitoring

---

## API Security

### Edge Functions

**1. Input Validation (Zod)**
```typescript
import { z } from 'zod';

const GenerateContentSchema = z.object({
  type: z.enum(['text', 'image', 'video', 'music']),
  prompt: z.string().min(1).max(2000),
  brand_kit_id: z.string().uuid().optional(),
  org_id: z.string().uuid()
});

const body = await req.json();
const validated = GenerateContentSchema.parse(body); // Throws on invalid
```

**2. Idempotency Keys**
```typescript
const idempotencyKey = req.headers.get('Idempotency-Key');
if (idempotencyKey) {
  // Check if request with this key was already processed
  const { data: existing } = await supabase
    .from('assets')
    .select('id')
    .eq('metadata->idempotency_key', idempotencyKey)
    .single();
  
  if (existing) {
    return new Response(JSON.stringify(existing), { status: 200 });
  }
}
```

**3. Distributed Rate Limiting (Upstash Redis + Deno KV fallback)**
```typescript
import { checkDistributedRateLimit, RATE_LIMITS } from '../_shared/ratelimit-redis.ts';

// Distributed rate limiting with automatic fallback
const config = RATE_LIMITS.content_generation;
const rateLimit = await checkDistributedRateLimit(
  user.id, 
  'content_generation', 
  config.limit, 
  config.windowMs
);

if (!rateLimit.allowed) {
  return new Response(JSON.stringify({
    error: 'Rate limit exceeded',
    retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
  }), {
    status: 429,
    headers: {
      'X-RateLimit-Limit': String(rateLimit.limit),
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
      'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000))
    }
  });
}
```

**Rate Limit Architecture:**
- **Primary**: Upstash Redis (distributed, horizontally scalable)
- **Fallback**: Deno KV (per-instance, for Redis failures)
- **Algorithm**: Sliding window with sorted sets

**Rate Limit Configuration:**
| Action | Limit | Window | Purpose |
|--------|-------|--------|---------|
| `content_generation` | 20 | 1 hour | Prevent AI API abuse |
| `tiktok_generation` | 10 | 1 hour | Video generation is expensive |
| `youtube_generation` | 10 | 1 hour | Video generation is expensive |
| `campaigns_draft` | 30 | 1 hour | Campaign creation limits |
| `schedule_create` | 50 | 1 hour | Prevent scheduling floods |
| `library_install` | 50 | 1 hour | Prevent install abuse |
| `marketplace_install` | 30 | 1 hour | Prevent install abuse |
| `integrations_connect` | 20 | 1 hour | OAuth rate limiting |
| `token_write` | 20 | 1 hour | Token storage limits |
| `publish_post` | 60 | 1 hour | Social posting limits |
| `health_check` | 100 | 1 minute | Monitoring overhead |
| `usage_check` | 100 | 1 minute | Usage checks |
| `gdpr_export` | 5 | 1 hour | Prevent data scraping |
| `gdpr_delete` | 3 | 24 hours | Prevent deletion attacks |
| `events_ingest` | 1000 | 1 minute | Analytics throughput |
| `login_notification` | 10 | 1 hour | Notification spam prevention |

**4. Audit Logging**
```typescript
await supabase.from('audit_logs').insert({
  user_id: user.id,
  action: 'generate_content',
  resource_type: 'asset',
  resource_id: assetId,
  metadata: { prompt_hash: hashPrompt(prompt), model: 'gpt-4' }
});
```

### CORS
```typescript
// Supabase Edge Functions: CORS handled by framework
// Custom headers in response:
headers: {
  'Access-Control-Allow-Origin': 'https://flashfusion.lovable.app',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Idempotency-Key'
}
```

### CSRF Protection
- **Not needed for API-only endpoints** (no cookies, only JWT)
- **If adding cookie-based auth**: Implement SameSite=Strict + CSRF tokens

---

## Secrets Management

### Secret Inventory
| Secret | Usage | Rotation Frequency | Storage |
|--------|-------|-------------------|---------|
| `SUPABASE_URL` | DB/Auth endpoint | Never (infra constant) | Lovable Cloud |
| `SUPABASE_ANON_KEY` | Client-side auth | Quarterly | Lovable Cloud |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side admin | Quarterly | Lovable Cloud (Edge Functions) |
| `LOVABLE_API_KEY` | AI generation | Monthly | Lovable Cloud |
| `STRIPE_SECRET_KEY` | Payments | Quarterly | Lovable Cloud |
| `SENTRY_DSN` | Error tracking | Never (public DSN) | Env vars |

### Access Control
- **Frontend**: Only `SUPABASE_URL` + `SUPABASE_ANON_KEY` (public keys)
- **Edge Functions**: All secrets via `Deno.env.get()` (injected by Supabase)
- **CI/CD**: GitHub Secrets for deployment

### Rotation Playbook
See [secrets-rotation.md](./secrets-rotation.md) for step-by-step procedures.

---

## Input Validation

### Client-Side (React Hook Form + Zod)
```typescript
const formSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  platforms: z.array(z.enum(['instagram', 'facebook', 'twitter'])).min(1)
});

const form = useForm({
  resolver: zodResolver(formSchema)
});
```

### Server-Side (Edge Functions)
```typescript
// ALWAYS validate even if client validates
const validated = schema.safeParse(body);
if (!validated.success) {
  return new Response(
    JSON.stringify({ errors: validated.error.errors }),
    { status: 400 }
  );
}
```

### Sanitization
```typescript
// HTML sanitization (if rendering user content)
import DOMPurify from 'isomorphic-dompurify';
const clean = DOMPurify.sanitize(userInput);

// SQL injection: Prevented by Supabase parameterized queries
// XSS: React escapes by default; avoid dangerouslySetInnerHTML
```

---

## Security Testing

### Manual Tests

**1. Cross-Org Access**
```bash
# Setup: Create user A (org X) and user B (org Y)
# Test: User A attempts to read org Y assets
curl -H "Authorization: Bearer <user_a_jwt>" \
  https://<project>.supabase.co/rest/v1/assets?org_id=eq.<org_y_id>
# Expected: Empty array or 403
```

**2. Privilege Escalation**
```bash
# Setup: Create member user (not admin) in org
# Test: Member attempts to delete org
curl -X DELETE \
  -H "Authorization: Bearer <member_jwt>" \
  https://<project>.supabase.co/rest/v1/orgs?id=eq.<org_id>
# Expected: 403 or RLS error
```

**3. JWT Expiry**
```bash
# Setup: Generate JWT, wait 1+ hour
# Test: Use expired JWT
curl -H "Authorization: Bearer <expired_jwt>" \
  https://<project>.supabase.co/rest/v1/assets
# Expected: 401 Unauthorized
```

### Automated Tests (TODO: Playwright)
```typescript
// tests/security/cross-org.spec.ts
test('user cannot access other org data', async ({ page }) => {
  await loginAs(page, 'user-a@example.com');
  const orgBData = await page.evaluate(async () => {
    const { data } = await supabase
      .from('assets')
      .select('*')
      .eq('org_id', '<org-b-id>');
    return data;
  });
  expect(orgBData).toEqual([]);
});
```

---

## Unknown Unknowns Radar

### 1. 🚨 JWT Secret Rotation During Traffic
**Risk**: Rotating `SUPABASE_ANON_KEY` invalidates all active sessions.  
**Impact**: Mass logouts, angry users.  
**Mitigation**:
- Dual-key rotation: Issue new key, keep old valid for 24h
- Announce maintenance window
- Add session migration endpoint

### 2. 🚨 RLS Policy Bugs in Complex Joins
**Risk**: Multi-table queries may bypass policies if joins aren't secured.  
**Impact**: Data leakage (e.g., `assets JOIN campaigns` exposes cross-org data).  
**Mitigation**:
- Audit all queries with `.explain()` to verify RLS filters applied
- Add integration tests for every join pattern
- Use security definer functions for complex queries

### 3. 🚨 Edge Function Cold Start = Timeout
**Risk**: User waits 10s for AI generation, assumes failure, retries → duplicate charges.  
**Impact**: Financial loss, double content.  
**Mitigation**:
- Implement idempotency keys (already planned)
- Add client-side retry backoff
- Use Supabase Realtime for async job status

### 4. 🚨 Marketplace XSS via Template Names
**Risk**: Attacker uploads template with `name: "<script>alert(1)</script>"`.  
**Impact**: XSS when rendering marketplace grid.  
**Mitigation**:
- Validate `name` field: `z.string().regex(/^[a-zA-Z0-9 _-]+$/)`
- Use `textContent` instead of `innerHTML` in React
- Add CSP to block inline scripts

### 5. 🚨 GDPR Right-to-Delete Cascade Failures
**Risk**: User requests account deletion; foreign key constraints block it.  
**Impact**: Legal non-compliance, manual cleanup needed.  
**Mitigation**:
- Add `ON DELETE CASCADE` to all user_id foreign keys
- Create `handle_user_deletion` trigger to anonymize assets
- Test deletion flow in staging with real data

---

## CI/CD Security Scanning

The CI/CD pipeline includes comprehensive automated security scanning at every deployment:

### Scanning Layers

| Layer | Tool | Purpose | Runs On |
|-------|------|---------|---------|
| **SAST** | Semgrep | Static code analysis for vulnerabilities | Every PR/push |
| **SCA** | Trivy + npm audit | Dependency vulnerability scanning | Every PR/push |
| **Secrets** | TruffleHog + Gitleaks | Detect hardcoded credentials | Every PR/push |
| **OWASP** | Dependency-Check | Known CVE detection | Every PR/push |
| **DAST** | ZAP Baseline | Runtime vulnerability testing | PRs only |
| **RLS** | Custom tests | Database security verification | Every PR/push |

### Security Gates

Deployments are blocked if:
- Any HIGH/CRITICAL vulnerability found by Trivy
- npm audit finds HIGH severity issues
- Hardcoded secrets detected in source code
- RLS negative tests fail
- DAST finds critical issues

### Edge Function Auditing

The CI pipeline automatically audits edge functions for:
- Missing authentication checks
- Missing rate limiting
- Unsafe input handling

### SARIF Integration

All scan results are uploaded to GitHub Security tab in SARIF format for:
- Centralized vulnerability tracking
- Historical trend analysis
- Automated issue creation

---

## Compliance Checklist

- [x] **GDPR Article 32**: Encryption at rest (Supabase managed)
- [x] **GDPR Article 17**: Right to delete (via `supabase.auth.admin.deleteUser()`)
- [x] **SOC 2 Type II**: Audit logs for access (partial, needs expansion)
- [x] **Rate Limiting**: All edge functions protected against abuse
- [ ] **WCAG 2.2 AA**: Accessibility audit needed
- [ ] **PCI DSS**: Stripe handles card data (no PCI scope for us)

---

## Security Review Schedule

| Frequency | Activity | Owner |
|-----------|----------|-------|
| Per Commit | Automated SAST/SCA/DAST scanning | CI/CD |
| Weekly | Dependency updates (`npm audit`) | DevOps |
| Monthly | RLS policy review | Backend Lead |
| Quarterly | Secret rotation | Security Team |
| Annually | Penetration test | External Vendor |

---

## Contacts

- **Security Lead**: [security@flashfusion.co](mailto:security@flashfusion.co)
- **Bug Bounty**: [hackerone.com/flashfusion](https://hackerone.com/flashfusion) (TODO)
- **Incident Response**: Slack #security-incidents

---

**Last Updated**: 2026-01-10  
**Next Review**: 2026-04-10
