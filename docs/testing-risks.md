# Testing & Reliability Risks — Unknown Unknowns Radar

Last updated: 2025-10-01

## Overview
This document identifies 5 critical reliability risks that could cause production failures despite comprehensive testing strategy.

---

## 1. Test Data Staleness & Environment Drift

**Risk:**  
Tests pass in CI/staging but fail in production due to:
- **Schema drift**: Test DB schema lags behind production migrations
- **Stale mocks**: Supabase client mocks don't match actual API responses
- **Seed data decay**: Test data becomes unrealistic over time (e.g., old campaign structures)
- **Environment variables**: `.env.test` diverges from production secrets

**Impact:**
- False confidence from green CI builds
- Production bugs only discoverable by users
- Flaky tests due to inconsistent data state
- Integration test failures due to auth/RLS changes

**Mitigation:**
```bash
# Automated schema sync check in CI
#!/bin/bash
# .github/workflows/test-schema-sync.sh

# Export production schema
supabase db dump --schema-only > prod_schema.sql

# Export test schema
supabase db dump --schema-only --local > test_schema.sql

# Compare and fail if different
diff prod_schema.sql test_schema.sql || {
  echo "❌ Test DB schema is out of sync with production!"
  exit 1
}
```

**Additional safeguards:**
- Run weekly "prod snapshot → test DB restore" workflow
- Add schema version check in test setup:
  ```typescript
  beforeAll(async () => {
    const { data } = await supabase.rpc('get_schema_version');
    expect(data.version).toBe(EXPECTED_PROD_VERSION);
  });
  ```
- Use realistic production data samples (anonymized) for E2E tests
- Implement contract tests that fetch actual OpenAPI spec from staging

---

## 2. Flaky Tests Due to AI Non-Determinism

**Risk:**  
Tests involving AI generation are inherently flaky:
- **Variable response times**: Gemini Flash usually responds in 2s, but can take 20s+ under load
- **Content variance**: Same prompt produces different outputs, breaking assertion checks
- **Rate limiting**: Tests hit 429 errors during parallel execution
- **Moderation failures**: AI unexpectedly rejects prompts in certain test runs

**Impact:**
- CI builds fail randomly, developers lose trust in tests
- Race conditions in E2E tests waiting for AI responses
- Test suite becomes too slow (30+ min) due to conservative timeouts
- Developers skip tests locally to avoid wait times

**Mitigation:**
```typescript
// Use snapshot testing with flexible matchers
import { expect } from 'vitest';

test('generates campaign draft', async () => {
  const response = await generateCampaignDraft({
    name: 'Test Campaign',
    objective: 'Test objective',
  });

  // Instead of exact match:
  // expect(response.assets).toEqual({ messaging: [...] });

  // Use schema validation:
  expect(response).toMatchObject({
    id: expect.any(String),
    name: 'Test Campaign',
    status: 'draft',
    assets: expect.objectContaining({
      messaging: expect.arrayContaining([
        expect.objectContaining({
          title: expect.any(String),
          description: expect.any(String),
        }),
      ]),
    }),
  });

  // Verify content quality heuristics instead of exact text
  expect(response.assets.messaging.length).toBeGreaterThanOrEqual(3);
  expect(response.assets.messaging.length).toBeLessThanOrEqual(7);
});
```

**Additional safeguards:**
- Mock AI responses in unit/contract tests, use real AI only in E2E
- Implement retry logic with exponential backoff for AI tests:
  ```typescript
  await retry(
    () => generateContent({ prompt: 'Test' }),
    { attempts: 3, delay: 2000, backoff: 2 }
  );
  ```
- Add `@slow` tag to AI tests, run them separately in CI
- Create "AI health check" endpoint that validates model availability before test suite
- Use deterministic seed prompts for consistent outputs (where supported)

---

## 3. Missing Negative Test Coverage

**Risk:**  
Current test suite focuses on happy paths, missing critical failure modes:
- **Authorization bypass**: No tests for cross-org data access
- **Input fuzzing**: No tests with malformed JSON, SQL injection attempts, XSS payloads
- **Race conditions**: No tests for concurrent updates to same resource
- **Resource exhaustion**: No tests for large file uploads, pagination limits, query timeouts

**Impact:**
- Security vulnerabilities discovered in production
- Data corruption from race conditions (two users editing same campaign)
- DoS attacks via resource exhaustion
- Compliance violations (GDPR data leaks)

**Mitigation:**
```typescript
// Add comprehensive negative tests
describe('Security Tests', () => {
  test('prevents cross-org asset access', async () => {
    // User from Org A tries to access Org B's asset
    const { error } = await supabase
      .from('assets')
      .select('*')
      .eq('id', ORG_B_ASSET_ID);

    expect(error || data.length === 0).toBeTruthy();
  });

  test('rejects SQL injection in prompt', async () => {
    const maliciousPrompt = "'; DROP TABLE assets; --";
    
    const { error } = await fetch('/functions/v1/generate-content', {
      method: 'POST',
      body: JSON.stringify({
        type: 'text',
        prompt: maliciousPrompt,
        org_id: TEST_ORG_ID,
      }),
    });

    // Should reject or sanitize, not throw DB error
    expect(error?.message).not.toContain('syntax error');
  });

  test('handles concurrent campaign updates', async () => {
    const campaignId = await createCampaign({ name: 'Conflict Test' });

    // Two simultaneous updates
    const [update1, update2] = await Promise.all([
      supabase.from('campaigns').update({ name: 'Update 1' }).eq('id', campaignId),
      supabase.from('campaigns').update({ name: 'Update 2' }).eq('id', campaignId),
    ]);

    // One should succeed, one might fail or latest wins
    expect(update1.error || update2.error).toBeTruthy();
    
    // Verify final state is consistent
    const { data } = await supabase.from('campaigns').select('*').eq('id', campaignId).single();
    expect(['Update 1', 'Update 2']).toContain(data.name);
  });

  test('prevents large payload DoS', async () => {
    const hugePrompt = 'a'.repeat(1_000_000); // 1MB prompt
    
    const response = await fetch('/functions/v1/generate-content', {
      method: 'POST',
      body: JSON.stringify({
        type: 'text',
        prompt: hugePrompt,
        org_id: TEST_ORG_ID,
      }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining('4000'),
    });
  });
});
```

**Additional safeguards:**
- Add fuzzing library like `fast-check` for property-based testing
- Run OWASP ZAP security scans in CI
- Implement chaos engineering: kill random edge functions during E2E tests
- Add load tests with k6 or Artillery (100 concurrent users)

---

## 4. Visual Regression False Positives/Negatives

**Risk:**  
Storybook snapshot tests are brittle:
- **Font loading timing**: Fonts not loaded during snapshot → false positive diff
- **Animation states**: Components captured mid-animation → flaky snapshots
- **Dynamic dates**: "Created 5 minutes ago" changes every test run
- **Responsive breakpoints**: Snapshots don't cover all viewport sizes
- **Timezone-dependent rendering**: Tests pass in UTC, fail in PST

**Impact:**
- Developers ignore/update snapshots without reviewing (defeats purpose)
- Real visual bugs slip through due to "boy who cried wolf" effect
- CI blocked by irrelevant diffs (1px spacing change)
- No coverage for critical responsive layouts

**Mitigation:**
```typescript
// Stabilize snapshots with test harness
import { within, expect } from '@storybook/test';
import { waitFor } from '@storybook/testing-library';

export default {
  title: 'Components/MetricTile',
  component: MetricTile,
  parameters: {
    // Disable animations
    chromatic: { disableSnapshot: false, delay: 500 },
  },
};

export const Default = {
  args: {
    label: 'Total Users',
    value: '1,234',
    icon: Users,
    trend: { value: 12, isPositive: true },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Wait for fonts to load
    await document.fonts.ready;
    
    // Wait for any animations to complete
    await waitFor(() => {
      const tile = canvas.getByText('Total Users');
      return getComputedStyle(tile).opacity === '1';
    });

    // Verify critical elements (not full snapshot)
    expect(canvas.getByText('Total Users')).toBeInTheDocument();
    expect(canvas.getByText('1,234')).toBeInTheDocument();
    expect(canvas.getByText('+12%')).toHaveClass('text-accent');
  },
};
```

**Additional safeguards:**
- Use Percy or Chromatic for visual regression (better diff algorithms)
- Freeze time in tests: `vi.useFakeTimers().setSystemTime(new Date('2025-01-01'))`
- Test responsive layouts explicitly:
  ```typescript
  export const Mobile = {
    ...Default,
    parameters: { viewport: { defaultViewport: 'mobile1' } },
  };
  ```
- Implement "visual acceptance threshold": allow 0.1% pixel difference
- Run visual tests only on main branch merges (not every commit)

---

## 5. Test-Production Parity Gaps

**Risk:**  
Tests don't replicate production environment:
- **Edge function cold starts**: Tests use warm functions, prod has 5s+ cold starts
- **Network latency**: Tests run localhost → localhost, prod has multi-region latency
- **Database scale**: Test DB has 100 rows, prod has 1M+ rows
- **Third-party failures**: Tests mock Stripe/OAuth, but prod depends on their uptime
- **Browser versions**: Tests use latest Chrome, users have Safari 14, IE11

**Impact:**
- Timeouts in production that never occurred in tests
- Performance regressions not caught until production
- Features work in dev but break for Safari users
- Payment flows fail due to untested Stripe webhook signatures

**Mitigation:**
```typescript
// Add production-realistic test suite
describe('Production Parity Tests', () => {
  beforeAll(async () => {
    // Warm up and then cool down edge functions
    await fetch('${SUPABASE_URL}/functions/v1/generate-content', {
      method: 'OPTIONS', // Warm up
    });
    await new Promise((r) => setTimeout(r, 60000)); // Wait for cooldown
  });

  test('handles edge function cold start', async () => {
    const startTime = Date.now();
    
    const response = await fetch('${SUPABASE_URL}/functions/v1/generate-content', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({
        type: 'text',
        prompt: 'Cold start test prompt',
        org_id: TEST_ORG_ID,
      }),
    });

    const duration = Date.now() - startTime;
    
    // Should complete within 10s even with cold start
    expect(duration).toBeLessThan(10000);
    expect(response.ok).toBe(true);
  });

  test('performs well with production data volumes', async () => {
    // Seed 10K assets
    await seedLargeDataset('assets', 10_000);

    const startTime = Date.now();
    const { data } = await supabase
      .from('assets')
      .select('*')
      .eq('org_id', TEST_ORG_ID)
      .order('created_at', { ascending: false })
      .limit(20);

    const duration = Date.now() - startTime;

    // Should return paginated results in <500ms even with 10K rows
    expect(duration).toBeLessThan(500);
    expect(data.length).toBe(20);
  });

  test('handles real Stripe webhook signatures', async () => {
    // Use actual Stripe test keys + webhook secret
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_TEST;
    const payload = JSON.stringify({ type: 'payment_intent.succeeded' });
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: webhookSecret,
    });

    const response = await fetch('/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': signature },
      body: payload,
    });

    expect(response.status).toBe(200);
  });
});

// Run tests across multiple browsers
test.describe.configure({ mode: 'parallel' });
test.describe('Cross-Browser Tests', () => {
  for (const browserType of ['chromium', 'firefox', 'webkit']) {
    test(`dashboard renders correctly in ${browserType}`, async ({ page }) => {
      await page.goto('/dashboard');
      await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
    });
  }
});
```

**Additional safeguards:**
- Add synthetic monitoring in production (Pingdom, Datadog)
- Run smoke tests against production after deploys
- Use feature flags to test in production with 1% of users
- Implement blue-green deployments with automated rollback on error spike
- Add real user monitoring (RUM) to track actual performance metrics

---

## Testing Strategy Summary

### Test Pyramid
```
       /\
      /  \  E2E (Playwright) — 10% of tests
     /____\
    /      \
   / Contract\ API schema validation — 15%
  /__________\
 /            \
/  Unit Tests  \ Component + validator tests — 75%
/________________\
```

### Coverage Targets
- **Line coverage**: 70% minimum (enforced in CI)
- **Branch coverage**: 65% minimum
- **Critical paths**: 100% (auth, payments, data mutations)
- **Visual regression**: Hero, dashboard, campaign cards

### Test Execution Strategy
| Test Type | Local Dev | PR CI | Main CI | Production |
|-----------|-----------|-------|---------|------------|
| Unit      | ✅ On save | ✅ Required | ✅ Required | ❌ |
| Contract  | ⚠️ Manual | ✅ Required | ✅ Required | ❌ |
| E2E       | ⚠️ Manual | ✅ Required | ✅ Required | ❌ |
| Visual    | ❌        | ⚠️ Chromium | ✅ All browsers | ❌ |
| Smoke     | ❌        | ❌        | ❌        | ✅ Post-deploy |

---

## Action Items

### Immediate (P0)
- [ ] Add negative security tests (cross-org access, SQL injection)
- [ ] Implement AI test retry logic with exponential backoff
- [ ] Fix flaky snapshot tests with font loading wait
- [ ] Add schema version check to test setup

### Short-term (P1)
- [ ] Create production data snapshot restore workflow
- [ ] Add fuzzing tests with `fast-check`
- [ ] Implement cold start simulation tests
- [ ] Set up visual regression with Percy/Chromatic

### Long-term (P2)
- [ ] Add load testing with k6 (100 concurrent users)
- [ ] Implement chaos engineering (random function kills)
- [ ] Set up synthetic monitoring in production
- [ ] Create feature flag system for safe prod testing

---

## References
- [Testing Best Practices](https://martinfowler.com/testing/)
- [Google Testing Blog](https://testing.googleblog.com/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Vitest Guide](https://vitest.dev/guide/)
