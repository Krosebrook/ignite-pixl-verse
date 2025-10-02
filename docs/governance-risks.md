# Governance & QA Risks (Unknown Unknowns)

**Purpose**: Identify critical gaps in compliance, QA reliability, and governance clarity that could lead to production failures or legal exposure.

---

## Risk 1: Compliance Drift (GDPR, SOC 2)

### Problem
Compliance requirements evolve over time. New GDPR interpretations, SOC 2 control changes, or regional regulations (e.g., CCPA, LGPD) may introduce obligations we don't currently meet.

### Scenario
- GDPR updates require explicit consent for analytics tracking (not just cookie banners)
- SOC 2 auditor flags missing encryption at rest for PII fields
- California CCPA requires "Do Not Sell My Data" option
- New EU AI Act regulations require disclosure of AI-generated content

### Likelihood
**HIGH** - Regulations change frequently, especially for AI/ML systems.

### Impact
**CRITICAL** - Fines (up to 4% annual revenue for GDPR), loss of certifications, legal liability.

### Current Gaps
- No automated compliance monitoring (e.g., GDPR consent checks)
- No regular legal review of data practices
- No encryption at rest for `profiles.email` or `audit_log.metadata`
- No AI-generated content watermarking or disclosure

### Mitigations
1. **Compliance Monitoring**:
   - Automated checks for GDPR consent (PostHog or custom script)
   - Quarterly legal review of data collection and retention policies
   - Subscribe to regulatory update newsletters (IAPP, GDPR.eu)

2. **Encryption at Rest**:
   - Enable Supabase column-level encryption for PII fields
   - Document encryption keys in `docs/secrets-rotation.md`

3. **AI Content Disclosure**:
   - Add watermark or metadata tag to AI-generated assets
   - Include "AI-generated" disclaimer in frontend UI
   - Update `docs/brand-rules.md` to mandate disclosure

4. **Regular Audits**:
   - Annual SOC 2 Type II audit (hire external auditor)
   - Quarterly GDPR compliance review (legal counsel)
   - Document findings in `docs/compliance-audit-<date>.md`

### Action Items
- [ ] **Immediate**: Encrypt `profiles.email` and `audit_log.metadata`
- [ ] **Short-term (1 month)**: Add AI-generated content watermarking
- [ ] **Long-term (3 months)**: Implement automated GDPR consent checks

---

## Risk 2: QA Test Flakiness

### Problem
E2E tests (Playwright) may pass locally but fail in CI due to timing issues, network variability, or environment differences. Flaky tests reduce confidence in CI/CD pipeline.

### Scenario
- E2E test "Generate asset → save" passes 9/10 times, fails randomly
- Visual regression test fails due to font loading race condition
- Test passes on `main` branch, fails on PR (merge conflict in test data)
- Test depends on external API (Lovable AI) which has intermittent timeouts

### Likelihood
**MEDIUM** - Common issue with E2E tests, especially with async operations.

### Impact
**HIGH** - Blocks deployments, requires manual re-runs, erodes trust in CI/CD.

### Current Gaps
- No retry logic for flaky tests (Playwright config: `retries: 0` locally)
- No baseline for acceptable flakiness (e.g., "fail <5% of runs")
- No monitoring of test duration (detect performance regressions)
- External API dependencies not mocked (relies on Lovable AI availability)

### Mitigations
1. **Retry Logic**:
   - Update `playwright.config.ts`: `retries: process.env.CI ? 2 : 0`
   - Document flaky test patterns in `docs/testing-risks.md`

2. **Test Stability Monitoring**:
   - Track test pass rates over time (e.g., "golden-paths.spec.ts: 95% pass rate")
   - Alert if pass rate drops below 90%
   - Use Playwright's `--repeat-each` flag to detect flakiness locally

3. **Mock External APIs**:
   - Create mock server for Lovable AI API (MSW or Playwright's `route` API)
   - Use real API in "smoke tests" (separate from golden paths)
   - Document mocking strategy in `docs/testing-risks.md`

4. **Visual Regression Stability**:
   - Wait for fonts to load before screenshot (`page.waitForLoadState('networkidle')`)
   - Freeze dynamic content (dates, random IDs) in test harness
   - Use `maxDiffPixels` threshold to allow minor differences

5. **Test Data Isolation**:
   - Each test creates its own org/user (avoids shared data conflicts)
   - Clean up test data after each run (delete org/assets)
   - Use unique identifiers (timestamps, UUIDs) to avoid collisions

### Action Items
- [ ] **Immediate**: Add retry logic to Playwright config
- [ ] **Short-term (1 week)**: Mock Lovable AI API for E2E tests
- [ ] **Long-term (1 month)**: Implement test stability monitoring (track pass rates)

---

## Risk 3: Governance Clarity (Who Decides What?)

### Problem
As team grows, decision-making authority becomes unclear. Without explicit governance, architectural decisions may be made ad-hoc, leading to inconsistent practices or technical debt.

### Scenario
- Developer A adds new database table without RLS policies (assumes someone else will add them)
- Developer B refactors core component without ADR (breaking change undocumented)
- Product manager requests feature that requires breaking API change (no approval process)
- Security issue reported, unclear who has authority to deploy hotfix

### Likelihood
**HIGH** - Common issue as teams scale beyond 2-3 people.

### Impact
**MEDIUM-HIGH** - Technical debt accumulates, security vulnerabilities introduced, team friction.

### Current Gaps
- No explicit RACI matrix (who is Responsible, Accountable, Consulted, Informed)
- No process for breaking changes (API versioning, migration plan)
- No definition of "critical hotfix" (when can we skip CI/CD gates?)
- No escalation path for disagreements (who has final say?)

### Mitigations
1. **Define RACI Matrix**:
   ```
   Decision Type               | Responsible | Accountable | Consulted | Informed
   ----------------------------|-------------|-------------|-----------|----------
   Database schema changes     | Engineer    | Tech Lead   | Team      | PM
   Breaking API changes        | Engineer    | Tech Lead   | PM, Users | Support
   Security hotfix deployment  | Engineer    | Security    | Tech Lead | PM
   Feature prioritization      | PM          | PM          | Tech Lead | Team
   Architecture (ADR)          | Tech Lead   | Tech Lead   | Team      | PM
   ```

2. **ADR Requirement**:
   - All significant architectural decisions require an ADR
   - ADR template: `docs/ADR-template.md`
   - ADRs reviewed in weekly tech sync
   - Breaking changes require migration plan + deprecation notice

3. **Hotfix Process**:
   - Define "critical hotfix": security vulnerability, data loss, site outage
   - Hotfix approval: 1 approval from Tech Lead or Security Team
   - Skip E2E tests, run unit tests + manual verification
   - Deploy to staging first, then production (with rollback plan)

4. **Escalation Path**:
   - Technical disagreements: Tech Lead has final say
   - Product disagreements: PM has final say
   - Security disagreements: Security Team has final say
   - If cross-functional, escalate to VP Engineering

### Action Items
- [ ] **Immediate**: Create RACI matrix (add to `CONTRIBUTING.md`)
- [ ] **Short-term (1 week)**: Document hotfix process (add to `docs/ci_cd.md`)
- [ ] **Long-term (1 month)**: Enforce ADR requirement (add CI check for breaking changes)

---

## Risk 4: Secret Rotation Fatigue

### Problem
Manual monthly secret rotation is error-prone and relies on human memory. Missed rotations increase risk of key compromise.

### Scenario
- Engineer forgets to rotate Supabase service role key (90 days overdue)
- Stripe API key rotation causes downtime (old key invalidated before new key deployed)
- Lovable AI API key compromised, attacker generates content using our credits
- Automated rotation script fails silently (no alert, no rollback)

### Likelihood
**MEDIUM** - Depends on discipline, easy to forget during busy periods.

### Impact
**HIGH** - Security breach, service outage, financial loss (fraudulent API usage).

### Current Gaps
- No automated secret rotation (fully manual, documented in `docs/secrets-rotation.md`)
- No expiry tracking (no alert when secret is 60 days old)
- No rotation testing (can't verify new key works before invalidating old key)
- No rollback plan if rotation causes outage

### Mitigations
1. **Automated Secret Rotation**:
   - GitHub Actions workflow (runs monthly, triggered manually for emergencies)
   - Script generates new key, updates Supabase/Lovable Cloud, verifies, invalidates old key
   - Example: `.github/workflows/rotate-secrets.yml`

2. **Expiry Tracking**:
   - Store rotation dates in `secrets_metadata` table (secret_name, last_rotated_at, expires_at)
   - Alert 7 days before expiry (email or Slack notification)
   - Dashboard widget showing days until next rotation

3. **Rotation Testing**:
   - Dual-key pattern: Deploy new key alongside old key
   - Grace period: 7 days before invalidating old key
   - Monitor error rates during grace period (if errors spike, rollback)

4. **Rollback Plan**:
   - Keep old keys in secure escrow (1Password, encrypted USB)
   - Document rollback steps in `docs/secrets-rotation.md`
   - Practice rollback quarterly (tabletop exercise)

### Action Items
- [ ] **Immediate**: Add expiry tracking to `secrets_metadata` table
- [ ] **Short-term (2 weeks)**: Implement rotation alerts (7 days before expiry)
- [ ] **Long-term (2 months)**: Automate secret rotation (GitHub Actions)

---

## Risk 5: Audit Log Incompleteness

### Problem
Audit logging is implemented for some actions (GDPR export/delete) but not all. Incomplete logs hinder incident response and compliance audits.

### Scenario
- Security incident: User reports unauthorized asset deletion, no audit log entry
- SOC 2 audit: Auditor asks for proof of access control, missing logs for org member invites
- Legal request: Subpoena for user activity, can't prove who modified campaign
- Debugging: Bug in scheduling logic, no logs to trace which user triggered failure

### Likelihood
**HIGH** - Easy to forget logging when adding new features.

### Impact
**HIGH** - Compliance failure, legal liability, difficult debugging.

### Current Gaps
- Audit logging only for GDPR actions (export, delete)
- No logging for:
  - Asset creation/update/deletion
  - Campaign creation/update/deletion
  - Org member invites/removals
  - Brand kit changes
  - Schedule creation/cancellation

### Mitigations
1. **Expand Audit Logging**:
   - Add `audit_log` entries for all mutating operations
   - Use database triggers for automatic logging (INSERT/UPDATE/DELETE triggers)
   - Include: `user_id`, `org_id`, `action`, `resource_type`, `resource_id`, `metadata`

2. **Audit Log Schema**:
   ```sql
   CREATE TABLE public.audit_log (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     org_id UUID NOT NULL,
     user_id UUID NOT NULL,
     action TEXT NOT NULL,  -- 'create', 'update', 'delete', 'invite', etc.
     resource_type TEXT NOT NULL,  -- 'asset', 'campaign', 'org_member', etc.
     resource_id UUID NOT NULL,
     ip_address INET,
     user_agent TEXT,
     metadata JSONB,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

3. **Logging Enforcement**:
   - Add CI check: All mutating Edge Functions must log to `audit_log`
   - Code review checklist: "Did you add audit logging?"
   - Unit test: Verify `audit_log` entry created after mutation

4. **Audit Log Retention**:
   - Keep audit logs for 7 years (compliance requirement)
   - Implement archival (move logs >1 year old to cold storage)
   - Document retention policy in `docs/security.md`

### Action Items
- [ ] **Immediate**: Expand `audit_log` schema (add IP, user agent)
- [ ] **Short-term (1 week)**: Add logging to all mutating Edge Functions
- [ ] **Long-term (1 month)**: Implement database triggers for automatic logging

---

## Summary

| Risk                      | Likelihood | Impact     | Priority |
|---------------------------|------------|------------|----------|
| Compliance Drift          | HIGH       | CRITICAL   | 🔴 P0    |
| QA Test Flakiness         | MEDIUM     | HIGH       | 🟠 P1    |
| Governance Clarity        | HIGH       | MEDIUM-HIGH| 🟠 P1    |
| Secret Rotation Fatigue   | MEDIUM     | HIGH       | 🟠 P1    |
| Audit Log Incompleteness  | HIGH       | HIGH       | 🔴 P0    |

---

## Action Plan

### Immediate (This Week)
1. Encrypt PII fields in database (`profiles.email`, `audit_log.metadata`)
2. Add retry logic to Playwright config
3. Create RACI matrix for decision-making
4. Expand `audit_log` schema (IP, user agent)
5. Add expiry tracking for secrets

### Short-Term (1 Month)
1. Add AI-generated content watermarking
2. Mock external APIs in E2E tests
3. Document hotfix process
4. Implement rotation alerts (7 days before expiry)
5. Add logging to all mutating Edge Functions

### Long-Term (3 Months)
1. Implement automated GDPR consent checks
2. Implement test stability monitoring
3. Enforce ADR requirement (CI check for breaking changes)
4. Automate secret rotation (GitHub Actions)
5. Implement database triggers for automatic audit logging

---

Last Updated: 2025-10-02  
Version: 1.0.0
