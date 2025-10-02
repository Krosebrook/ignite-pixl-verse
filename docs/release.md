# Release Process

## Overview
Automated versioning, changelog generation, staged deployment with health checks, and rollback procedures.

## Release Checklist
- [ ] All CI checks pass (tests, lint, typecheck)
- [ ] Security linter passes
- [ ] Performance budgets met
- [ ] Smoke tests pass
- [ ] Database migrations tested
- [ ] Documentation updated

## Deployment Flow
1. **Verify CI Green**: All checks pass
2. **Bump Version**: Update `version.json`
3. **Generate Changelog**: From conventional commits
4. **Tag & Push**: Git tag with version
5. **Deploy Staging**: Wait for health checks
6. **Run Smoke Tests**: Golden paths
7. **Promote to Production**: Blue-green deployment
8. **Notify Team**: Slack/Discord release notes
9. **Monitor**: Watch error rates for 1 hour

## Health Checks
- Database connectivity
- Storage accessibility
- Edge functions responsive
- Auth working

## Rollback Procedure
If issues detected within 1 hour:
1. Revert to previous Docker image
2. Run rollback migration if needed
3. Clear cache
4. Notify team

## Incident Response
Critical issues: ops@flashfusion.co
