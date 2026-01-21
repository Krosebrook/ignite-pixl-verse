# FlashFusion Verification & Acceptance Criteria

**Purpose**: Stop-fail checklist for production readiness. Every item MUST pass before deployment.

---

## P0: Critical (Cannot Deploy Without)

### Functionality

- [ ] **Auth Flow**
  - [ ] Sign up with email/password succeeds
  - [ ] Sign in with valid credentials succeeds
  - [ ] Sign in with invalid credentials fails with clear error
  - [ ] Sign out clears session and redirects to landing
  - [ ] Protected routes redirect unauthenticated users to /auth
  - [ ] JWT auto-refreshes after 55 minutes (before 1hr expiry)

- [ ] **Content Generation**
  - [ ] Generate text asset with prompt succeeds
  - [ ] Generate image asset with prompt succeeds
  - [ ] Generated asset appears in dashboard
  - [ ] Asset metadata includes provenance (model, prompt hash, timestamp)
  - [ ] Duplicate generation requests (same prompt) are idempotent

- [ ] **Multi-Tenancy**
  - [ ] User A cannot view User B's assets (different orgs)
  - [ ] User A cannot delete User B's org
  - [ ] User A cannot modify User B's brand kit
  - [ ] RLS policies block cross-org SELECT, INSERT, UPDATE, DELETE

- [ ] **Data Persistence**
  - [ ] Created assets persist after page refresh
  - [ ] Dashboard metrics reflect actual database state
  - [ ] No data loss on browser close/reopen

### Security

- [ ] **RLS Enforcement**
  - [ ] All tables with `org_id` have RLS enabled
  - [ ] Bypass attempts (SQL injection, direct API calls) fail
  - [ ] Admin actions (delete org, manage members) require proper role

- [ ] **Input Validation**
  - [ ] XSS: Script tags in prompts are sanitized/rejected
  - [ ] SQL Injection: Single quotes, semicolons in inputs don't break queries
  - [ ] Long inputs: 5000+ character prompts fail gracefully
  - [ ] Invalid types: Sending `type: "invalid"` returns 400 error

- [ ] **Secrets**
  - [ ] No API keys in frontend code (check DevTools → Sources)
  - [ ] .env file not committed to Git
  - [ ] SUPABASE_SERVICE_ROLE_KEY only in Edge Functions

### Performance

- [ ] **Page Load (Lighthouse Mobile)**
  - [ ] Landing page: LCP ≤2.5s, TTFB ≤150ms
  - [ ] Dashboard: LCP ≤2.5s, INP ≤200ms
  - [ ] Content Studio: LCP ≤2.5s, CLS ≤0.08

- [ ] **Bundle Sizes**
  - [ ] Initial JS bundle ≤180KB gzipped
  - [ ] CSS bundle ≤35KB gzipped
  - [ ] Total page weight ≤500KB (excluding images)

- [ ] **API Response Times**
  - [ ] GET /assets: p95 ≤200ms
  - [ ] POST /generate-content (text): p95 ≤3s
  - [ ] POST /generate-content (image): p95 ≤10s

### Accessibility

- [ ] **Keyboard Navigation**
  - [ ] All buttons/links reachable via Tab
  - [ ] Modal can be closed with Escape
  - [ ] Form submission works with Enter key

- [ ] **Screen Reader**
  - [ ] All images have descriptive alt text
  - [ ] Form fields have associated labels
  - [ ] Error messages announced in aria-live regions

- [ ] **Color Contrast**
  - [ ] All text meets WCAG 2.2 AA (4.5:1 for normal, 3:1 for large)
  - [ ] Focus indicators visible on all interactive elements

---

## P1: High Priority (Should Pass Before Launch)

### Functionality

- [ ] **Campaign Management**
  - [ ] Create campaign with name, platforms, assets
  - [ ] Edit campaign details
  - [ ] Delete campaign (with confirmation)
  - [ ] Campaign list shows accurate status (draft, active, completed)

- [ ] **Scheduling**
  - [ ] Schedule asset to platform with future date/time
  - [ ] Scheduled posts appear in timeline view
  - [ ] Past scheduled posts show "Posted" status

- [ ] **Marketplace**
  - [ ] Browse marketplace items (templates, packs)
  - [ ] Filter by type, sort by downloads/price
  - [ ] Download free item adds to org templates

### UX Polish

- [ ] **Loading States**
  - [ ] All async actions show spinners/skeletons
  - [ ] No "flash of empty content" on page load
  - [ ] Error boundaries catch React crashes

- [ ] **Error Handling**
  - [ ] Network failures show "Try again" button
  - [ ] 404 pages have "Go home" link
  - [ ] Form validation errors highlight specific fields

- [ ] **Responsive Design**
  - [ ] All pages usable on mobile (375px width)
  - [ ] Navigation collapses to hamburger menu on small screens
  - [ ] Tables scroll horizontally on narrow viewports

### Performance

- [ ] **Caching**
  - [ ] API responses cached via React Query (5min stale time)
  - [ ] Images use browser cache (1 year max-age)
  - [ ] CDN headers set for static assets

- [ ] **Database Optimization**
  - [ ] Indexes on `org_id`, `user_id`, `created_at` columns
  - [ ] No N+1 queries (check Supabase logs)
  - [ ] Connection pooling enabled (default in Supabase)

---

## P2: Nice to Have (Post-Launch Improvements)

### Functionality

- [ ] **Brand Kit Enforcement**
  - [ ] AI respects brand colors in generated images
  - [ ] Template thumbnails show brand logo watermark
  - [ ] Brand guidelines displayed in Content Studio

- [ ] **Advanced Scheduling**
  - [ ] Recurring posts (daily, weekly)
  - [ ] Timezone support (user selects their TZ)
  - [ ] Bulk schedule (upload CSV of posts)

- [ ] **Analytics**
  - [ ] Dashboard shows total assets, campaigns, scheduled posts
  - [ ] Graph of content creation over time
  - [ ] Top-performing assets by engagement (future: integrate platform APIs)

### Testing & Quality

- [ ] **Golden Paths (E2E - MUST PASS)**
  - [ ] **Path 1: Generate Asset Flow**
    - [ ] Navigate to Content Studio
    - [ ] Generate text asset with prompt
    - [ ] Verify generated content appears
    - [ ] Lint against brand rules (if applicable)
    - [ ] Save asset successfully
    - [ ] Verify asset appears in dashboard
  - [ ] **Path 2: Campaign Draft & Schedule**
    - [ ] Navigate to Campaigns
    - [ ] Create new campaign with name, objective, platforms
    - [ ] Draft campaign generates AI strategy
    - [ ] Navigate to Schedule
    - [ ] Schedule asset for future posting
    - [ ] Verify schedule appears in timeline
  - [ ] **Path 3: Asset Translation Flow**
    - [ ] Select existing asset
    - [ ] Initiate translation to target language
    - [ ] Review translated content
    - [ ] Approve translation
    - [ ] Schedule or publish immediately

- [ ] **Power Paths (Advanced Flows)**
  - [ ] Create campaign → Generate 5 assets → Schedule to 3 platforms → Monitor status
  - [ ] Upload brand kit → Generate image → Verify brand colors applied
  - [ ] Bulk schedule: Upload CSV → Map columns → Schedule 20 posts
  - [ ] Marketplace: Browse → Download template pack → Use in campaign

- [ ] **Test Coverage**
  - [ ] Unit tests (Vitest): ≥70% line coverage, ≥65% branch coverage
  - [ ] Component tests: Button, Card, MetricTile, PageHeader
  - [ ] Validator tests: All API request schemas (zod)
  - [ ] Contract tests: All 3 edge functions conform to OpenAPI spec
  - [ ] E2E tests (Playwright): 3 golden paths + 2 power paths
  - [ ] Visual regression (Storybook): Hero, Dashboard, Campaign cards
  - [ ] Cross-browser: Chromium, Firefox, WebKit
  - [ ] Responsive: Mobile (375px), Tablet (768px), Desktop (1920px)

- [ ] **Test Reliability**
  - [ ] No flaky tests (must pass 5 consecutive runs)
  - [ ] E2E tests complete in <5 minutes
  - [ ] Visual regression false positive rate <5%
  - [ ] AI tests use mock responses (real AI only in E2E)

### DevEx

- [ ] **CI/CD**
  - [ ] All tests run in parallel in CI
  - [ ] Failed tests block merge to main
  - [ ] Coverage reports uploaded to Codecov
  - [ ] Lighthouse CI enforces performance budgets

- [ ] **Monitoring**
  - [ ] Sentry error tracking configured
  - [ ] PostHog analytics events (signup, generate_content, etc.)
  - [ ] Uptime monitoring (UptimeRobot or similar)

- [ ] **Documentation**
  - [ ] README with setup instructions
  - [ ] API docs for edge functions (OpenAPI/Swagger)
  - [ ] Component docs (Storybook)

---

## Stop-Fail Scenarios (Auto-Block Deploy)

### When to Block:

1. **Security Scanner Fails**
   - Trivy finds HIGH/CRITICAL vulnerabilities
   - npm audit reports exploitable packages
   - RLS policies missing on new tables

2. **Performance Budgets Exceeded**
   - Lighthouse CI shows LCP >3s on any route
   - Bundle size >200KB (20KB over budget)
   - TTFB >300ms (2x over budget)

3. **Tests Failing**
   - Any unit test fails
   - E2E critical path fails (signup → generate → save)
   - TypeScript compilation errors

4. **Manual Checks Fail**
   - Cross-org data access succeeds (RLS bypass)
   - Admin actions succeed for non-admin users
   - API keys visible in DevTools

### Override Process:

If blocking issue cannot be fixed immediately:
1. Document reason in JIRA ticket
2. Get approval from Tech Lead + Security Lead
3. Add to "Known Issues" in release notes
4. Schedule fix in next sprint

---

## Pre-Launch Checklist (Final 24 Hours)

- [ ] **Secrets Rotated**
  - [ ] New Supabase anon key generated
  - [ ] Lovable AI key refreshed
  - [ ] Old keys revoked after 1-hour grace period

- [ ] **Database Seeded**
  - [ ] Sample templates in marketplace (5+ items)
  - [ ] Public brand kits for demo users
  - [ ] Test org with realistic data for support team

- [ ] **Monitoring Enabled**
  - [ ] Sentry project created, DSN added to .env
  - [ ] PostHog project configured, events tested
  - [ ] PagerDuty alerts configured for downtime

- [ ] **Legal**
  - [ ] Privacy Policy published at /privacy
  - [ ] Terms of Service published at /terms
  - [ ] Cookie banner (if tracking EU users)

- [ ] **Comms**
  - [ ] Launch tweet drafted
  - [ ] Product Hunt post scheduled (if applicable)
  - [ ] Support team trained on common issues

---

## Post-Launch (Week 1)

- [ ] **Monitor Metrics**
  - [ ] Error rate <1% (Sentry)
  - [ ] API success rate >99% (Supabase logs)
  - [ ] User signup conversion >10% (PostHog)

- [ ] **Gather Feedback**
  - [ ] In-app feedback widget live
  - [ ] User interviews scheduled (5+ sessions)
  - [ ] Bug reports triaged daily

- [ ] **Iterate**
  - [ ] Hotfix critical bugs within 4 hours
  - [ ] Ship performance improvements (if LCP >2.5s)
  - [ ] Add most-requested features to roadmap

---

## Verification Record

| Check Date | Tester | P0 Pass? | P1 Pass? | Blockers | Notes |
|------------|--------|----------|----------|----------|-------|
| 2025-10-01 | AI     | ✅       | ⏳       | None     | Initial scaffold |
| 2026-01-21 | AI     | ⚠️ Partial | ⚠️ Partial | Social publishing, Brand enforcement | See CODEBASE_AUDIT_2026_01.md |
| YYYY-MM-DD |        |          |          |          |       |

---

## Recent Audit Findings (2026-01-21)

### Completed Since Last Check
- ✅ Multi-organization support
- ✅ Team member invitation flow
- ✅ Email verification reminder
- ✅ Skip brand kit during onboarding
- ✅ Resilient onboarding with auto-repair

### Outstanding Items
- ⚠️ 5 console.log statements in production code
- ⚠️ Social media publishing not connected
- ⚠️ Brand rule enforcement incomplete
- ⚠️ Translation workflow not implemented

### Related Documents
- `docs/CODEBASE_AUDIT_2026_01.md` - Full audit report
- `docs/GAPS_AND_BOTTLENECKS.md` - Technical gaps analysis
- `docs/ROADMAP_2026.md` - Updated development roadmap
- `docs/BEST_PRACTICES.md` - Coding standards

---

## Contacts

- **QA Lead**: qa@flashfusion.co
- **Tech Lead**: tech@flashfusion.co
- **Incident Response**: #incidents Slack channel

---

**Last Updated**: 2026-01-21
