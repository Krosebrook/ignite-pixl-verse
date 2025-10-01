# CI/CD Risks — Unknown Unknowns Radar

## 1. Deployment Race Conditions
**Risk**: Multiple PRs merged rapidly cause conflicting deployments.
**Mitigation**: Queue deployments, add deployment locks.

## 2. Rollback State Inconsistency
**Risk**: Code rolled back but database not, or vice versa.
**Mitigation**: Expand-migrate-contract pattern, backup before rollback.

## 3. Flaky CI Tests Block Valid Deploys
**Risk**: Intermittent test failures (network, AI) block good code.
**Mitigation**: Retry logic, separate flaky tests, manual override process.

## 4. Secrets Rotation During Deploy
**Risk**: Secrets rotated mid-deploy cause auth failures.
**Mitigation**: Grace period for old keys, blue-green deployment.

## 5. Monitoring Blind Spots
**Risk**: Deploy succeeds but users see errors not caught by smoke tests.
**Mitigation**: Real user monitoring (RUM), error rate alerts, gradual rollout.
