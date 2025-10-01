# CI/CD Pipeline Documentation

## Pipeline Overview

The FlashFusion CI/CD pipeline enforces production-readiness through automated verification gates.

## Pipeline Stages

### 1. Code Quality (Parallel)
- **Lint**: ESLint + Prettier
- **TypeCheck**: TypeScript compilation
- **Security Scan**: Trivy + npm audit + secret scanning

### 2. Testing (Parallel after build)
- **Unit Tests**: Vitest (70% overall, 90% core coverage required)
- **Contract Tests**: API schema validation
- **E2E Tests**: Playwright golden paths
- **Accessibility Tests**: axe-core WCAG 2.2 AA
- **Security Tests**: RLS negative tests

### 3. Performance
- **Lighthouse CI**: Performance budgets enforced (TTFB ≤150ms, LCP ≤2.5s)

### 4. Verification Gate
All tests must pass before deployment.

### 5. Deployment
- **Staging**: Automatic on PR merge
- **Production**: Automatic on main branch push (after gate)
- **Observability**: Sentry release tagging, PostHog analytics

## Rollback Procedure

Automated via `.github/workflows/rollback.yml`:
```bash
# Via GitHub UI: Actions → Rollback → Run workflow
# Or CLI:
./scripts/rollback.sh --database --deployment --target=<SHA>
```

## Performance Budgets
- TTFB: ≤150ms
- LCP: ≤2.5s
- INP: ≤200ms
- CLS: ≤0.08
- JS: ≤180KB gzip
- CSS: ≤35KB gzip

## Observability
- **Sentry**: Error tracking + performance monitoring
- **PostHog**: Product analytics
- **OpenTelemetry**: Distributed tracing (simplified for browser)
