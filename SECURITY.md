# Security Policy

## Reporting a Vulnerability

**DO NOT** disclose security vulnerabilities publicly via GitHub Issues.

### Contact

**Email**: security@flashfusion.co  
**PGP Key**: [Available at keybase.io/flashfusion](https://keybase.io/flashfusion)

### Expected Response Time

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 5 business days
- **Fix timeline**: Provided within 7 business days

### What to Include

1. **Description**: Clear explanation of the vulnerability
2. **Steps to reproduce**: Detailed reproduction steps
3. **Impact**: Potential damage or data exposure
4. **Suggested fix**: If you have one (optional)
5. **Disclosure timeline**: Your expectations for public disclosure

---

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | ✅ Active support  |
| 0.x.x   | ❌ No longer supported |

Security patches are backported to the latest minor version only.

---

## Security Architecture

### Authentication & Authorization

- **Supabase Auth**: JWT-based authentication with 1-hour expiry
- **RLS Policies**: Row-level security enforces org-scoped data access
- **RBAC**: Role-based access control via `user_roles` table with `SECURITY DEFINER` functions

### Data Protection

- **Encryption at rest**: Supabase handles database encryption (AES-256)
- **Encryption in transit**: HTTPS/TLS 1.3 for all API calls
- **Secrets management**: Environment variables (never committed), rotated monthly

### Input Validation

- **Client-side**: Zod schema validation + React Hook Form
- **Server-side**: Zod validation in Edge Functions before processing
- **Sanitization**: DOMPurify for user-generated HTML (if applicable)

### API Security

- **CORS**: Configured per environment (staging/production domains only)
- **Rate limiting**: Implemented via Supabase Edge Functions (TODO: verify)
- **Idempotency**: All mutating endpoints support idempotency keys

---

## Security Checklist for Contributors

### Before Submitting PR

- [ ] **No hardcoded secrets**: Check with `grep -r "API_KEY\|SECRET\|PASSWORD" src/`
- [ ] **RLS enabled**: All tables with sensitive data have RLS policies
- [ ] **Input validation**: All user inputs validated with Zod
- [ ] **SQL injection**: No raw SQL with string interpolation
- [ ] **XSS protection**: No `dangerouslySetInnerHTML` without sanitization
- [ ] **CSRF tokens**: Stateful operations use CSRF protection (if applicable)
- [ ] **Audit trail**: Sensitive actions logged to `audit_log` table

### Security Tests

Run before submitting:

```bash
npm run test:security  # RLS negative tests
npm run lint           # ESLint security rules
npm audit              # Dependency vulnerabilities
```

---

## Known Security Considerations

### 1. JWT Secret Rotation

**Risk**: JWT secret rotation invalidates all existing tokens  
**Mitigation**: Dual-key rotation with grace period (see `docs/secrets-rotation.md`)

### 2. RLS Policy Bugs

**Risk**: Incorrectly written policies may allow cross-org access  
**Mitigation**: Automated negative tests in `tests/security/rls-negative.test.ts`

### 3. Edge Function Cold Starts

**Risk**: Attackers may probe for timing attacks during cold starts  
**Mitigation**: Implement rate limiting and monitoring for anomalous patterns

### 4. XSS in User-Generated Content

**Risk**: Malicious scripts in prompts/campaigns  
**Mitigation**: Sanitize all inputs, use Content Security Policy (CSP)

### 5. GDPR Data Export

**Risk**: Data export may include other users' data due to RLS misconfiguration  
**Mitigation**: Explicit `user_id` checks in export functions (see `supabase/functions/gdpr-export`)

---

## Compliance

### GDPR (General Data Protection Regulation)

- **Right to access**: `/api/gdpr/export` endpoint
- **Right to deletion**: `/api/gdpr/delete` endpoint
- **Data minimization**: Only collect necessary data
- **Retention policy**: Assets/events purged after 90 days (configurable)

### SOC 2 Type II

- **Access controls**: Role-based access via `user_roles`
- **Audit logging**: All admin actions logged to `audit_log` table
- **Incident response**: Documented in `docs/security.md`

### WCAG 2.2 AA (Web Accessibility)

- **Keyboard navigation**: All features accessible without mouse
- **Screen reader**: ARIA labels on all interactive elements
- **Color contrast**: 4.5:1 for normal text, 3:1 for large text

---

## Incident Response Plan

### Phase 1: Detection (0-30 minutes)

1. **Alert received**: Via Sentry, user report, or automated scan
2. **Triage**: Assess severity (Critical / High / Medium / Low)
3. **Notify**: Security team via Slack #security-alerts

### Phase 2: Containment (30 minutes - 2 hours)

1. **Isolate**: Disable affected feature/endpoint if necessary
2. **Preserve evidence**: Capture logs, database snapshots
3. **Communicate**: Notify affected users if data breach suspected

### Phase 3: Eradication (2-24 hours)

1. **Root cause analysis**: Identify how breach occurred
2. **Deploy fix**: Push hotfix to production
3. **Rotate secrets**: If keys/tokens compromised

### Phase 4: Recovery (24-72 hours)

1. **Re-enable services**: Gradually restore functionality
2. **Monitor**: Watch for anomalous behavior
3. **Validate**: Run security tests to confirm fix

### Phase 5: Post-Incident (1 week)

1. **Write post-mortem**: Document timeline, root cause, action items
2. **Update docs**: Security policy, runbooks, ADRs
3. **Training**: Share lessons learned with team

---

## Security Tools & Monitoring

### Automated Scans

- **Trivy**: Vulnerability scanning (CI/CD)
- **npm audit**: Dependency vulnerabilities (CI/CD)
- **TruffleHog**: Secret scanning (CI/CD)
- **axe-core**: Accessibility testing (CI/CD)

### Runtime Monitoring

- **Sentry**: Error tracking + performance monitoring
- **PostHog**: User behavior analytics (privacy-preserving)
- **Supabase Logs**: Database query audit trail

### Penetration Testing

- **Schedule**: Quarterly (external security firm)
- **Scope**: Web app, API, database, infrastructure
- **Reports**: Shared with security team, action items tracked in GitHub Issues

---

## Security Training

All contributors should review:

1. **OWASP Top 10**: https://owasp.org/www-project-top-ten/
2. **Supabase Security Best Practices**: https://supabase.com/docs/guides/auth/security
3. **This project's security docs**: `docs/security.md`, `docs/secrets-rotation.md`

---

## Responsible Disclosure

We support responsible disclosure and will:

- **Credit**: Publicly acknowledge researchers (with permission)
- **Reward**: Bug bounty program (coming soon)
- **Collaborate**: Work with researchers to understand and fix issues

---

## Contact

- **General security questions**: security@flashfusion.co
- **Vulnerability reports**: security@flashfusion.co (PGP available)
- **Security team lead**: security-lead@flashfusion.co

Last updated: 2025-10-02
