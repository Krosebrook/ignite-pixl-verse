# Contributing to FlashFusion

Thank you for your interest in contributing to FlashFusion! This document outlines the process and guidelines.

---

## Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please:
- Be respectful and constructive
- Assume good faith
- Focus on what's best for the community
- Show empathy towards other contributors

Violations can be reported to: conduct@flashfusion.co

---

## Getting Started

### Prerequisites

- **Node.js**: v20 or later
- **pnpm**: v8 or later (recommended) or npm
- **Git**: Latest stable version
- **Supabase CLI**: For local database development (optional)

### Setup

```bash
# Clone the repository
git clone https://github.com/flashfusion/creative-mega-app.git
cd creative-mega-app

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# Run development server
npm run dev

# Run tests
npm run test:unit
npm run test:e2e
```

---

## Branching Strategy

We follow **Git Flow** with these branch types:

- **`main`**: Production-ready code (protected, requires PR + review)
- **`staging`**: Pre-production testing (auto-deploys to staging)
- **`feature/*`**: New features (`feature/campaign-scheduling`)
- **`fix/*`**: Bug fixes (`fix/rls-policy-bypass`)
- **`docs/*`**: Documentation updates (`docs/api-reference`)
- **`refactor/*`**: Code improvements without functionality changes
- **`test/*`**: Test additions or improvements

### Branch Naming Convention

```
<type>/<short-description>

Examples:
- feature/gdpr-export
- fix/image-upload-timeout
- docs/architecture-diagrams
- refactor/ui-component-library
```

---

## Pull Request Process

### Before Opening a PR

1. **Create an issue** (unless it's a trivial fix)
2. **Fork the repository** (external contributors)
3. **Create a feature branch** from `staging`
4. **Write tests** for your changes
5. **Ensure all tests pass** locally

### PR Checklist

- [ ] **Branch**: Created from `staging` (not `main`)
- [ ] **Tests**: Added/updated unit tests for new features
- [ ] **E2E Tests**: Updated golden paths if user flow changed
- [ ] **Linting**: `npm run lint` passes
- [ ] **Type Check**: `npm run typecheck` passes
- [ ] **Performance**: Lighthouse scores meet budgets (if UI changed)
- [ ] **Accessibility**: WCAG 2.2 AA compliance verified (if UI changed)
- [ ] **Security**: No hardcoded secrets, RLS policies updated
- [ ] **Documentation**: Updated relevant docs (README, API, ADRs)
- [ ] **Changelog**: Added entry to CHANGELOG.md (if user-facing)

### PR Title Format

```
<type>(<scope>): <short summary>

Examples:
- feat(campaigns): add multi-platform scheduling
- fix(auth): resolve JWT refresh race condition
- docs(api): update OpenAPI spec for /generate-content
- refactor(ui): extract button variants to design system
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`

### PR Description Template

```markdown
## Description
Brief summary of changes and motivation.

## Related Issue
Fixes #123

## Type of Change
- [ ] Bug fix (non-breaking)
- [ ] New feature (non-breaking)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing performed

## Screenshots (if applicable)
[Before/After screenshots for UI changes]

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Commented on complex sections
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests pass locally
```

---

## Code Style Guidelines

### TypeScript/JavaScript

- **ESLint**: Follow `.eslintrc` rules (auto-enforced in CI)
- **Prettier**: Auto-format with `npm run format`
- **Naming**:
  - Components: PascalCase (`AssetGrid.tsx`)
  - Hooks: camelCase with `use` prefix (`useAssetLibrary.ts`)
  - Utilities: camelCase (`formatDate.ts`)
  - Constants: UPPER_SNAKE_CASE (`API_BASE_URL`)

### React Best Practices

- **Functional components** with hooks (no class components)
- **PropTypes**: Use TypeScript interfaces instead
- **State management**: React Query for server state, Zustand for client state
- **Naming**: Event handlers → `handle<Action>`, boolean props → `is/has/should`

### SQL/Database

- **Migrations**: All schema changes via `supabase/migrations/`
- **RLS Policies**: Every table with `org_id` must have RLS enabled
- **Indexes**: Add indexes for frequently queried columns
- **Functions**: Use `SECURITY DEFINER` for role checks, avoid recursion

---

## Testing Guidelines

### Unit Tests (Vitest)

- **Coverage**: ≥70% overall, ≥90% for core components
- **Location**: `tests/unit/<component>.test.tsx`
- **Naming**: `describe()` = component name, `it()` = behavior

```typescript
describe('Button', () => {
  it('renders with correct variant', () => {
    const { getByRole } = render(<Button variant="primary">Click</Button>);
    expect(getByRole('button')).toHaveClass('bg-primary');
  });
});
```

### E2E Tests (Playwright)

- **Golden paths**: Critical user journeys (must pass before merge)
- **Power paths**: Edge cases (nice-to-have)
- **Location**: `tests/e2e/<feature>.spec.ts`

### Accessibility Tests

- **axe-core**: Run `npm run test:a11y` before submitting PR
- **Manual**: Test keyboard navigation and screen reader

---

## Commit Message Convention

Follow **Conventional Commits**:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Examples:**
```
feat(campaigns): add drag-drop scheduling interface

Implements timeline view with drag-drop for rescheduling posts.
Uses react-dnd library with collision detection.

Closes #456

---

fix(auth): prevent race condition in JWT refresh

Previous implementation allowed multiple refresh requests.
Now uses mutex to ensure single refresh at a time.

Fixes #789
```

---

## Review Process

### For Reviewers

- **Response time**: Within 48 hours (business days)
- **Focus areas**:
  - Security: RLS policies, input validation
  - Performance: Bundle size, query optimization
  - Accessibility: WCAG compliance
  - Maintainability: Code clarity, documentation

### For Contributors

- **Be patient**: Reviews may take up to 2 business days
- **Be responsive**: Address feedback within 1 week (or comment if delayed)
- **Be collaborative**: Discuss alternative approaches if disagreeing

### Approval Requirements

- ✅ 1 approval from maintainer (for external contributors)
- ✅ All CI checks pass (lint, typecheck, tests, security)
- ✅ No merge conflicts with target branch

---

## Security & Privacy

### Reporting Vulnerabilities

**DO NOT** open public GitHub issues for security vulnerabilities.

Email: security@flashfusion.co (PGP key available)

We will respond within 48 hours and provide a fix timeline.

### Handling Secrets

- **Never commit**: API keys, passwords, tokens
- **Use `.env`**: For local development (add to `.gitignore`)
- **CI/CD secrets**: Stored in GitHub Secrets, injected at build time

---

## Documentation Standards

### ADRs (Architecture Decision Records)

For significant architectural changes, create an ADR:

```bash
cp docs/ADR-template.md docs/ADR-XXX-your-decision.md
```

Fill in:
- Context: Why is this decision needed?
- Decision: What did we decide?
- Consequences: Trade-offs and implications
- Alternatives: What else was considered?

### API Documentation

- **OpenAPI**: Update `docs/openapi.yaml` for API changes
- **Inline docs**: JSDoc comments for complex functions

---

## Release Process

We use **semantic versioning** (MAJOR.MINOR.PATCH):

- **MAJOR**: Breaking changes (v2.0.0)
- **MINOR**: New features, backward-compatible (v1.3.0)
- **PATCH**: Bug fixes, backward-compatible (v1.2.1)

### Release Cycle

- **Staging**: Deployed automatically on merge to `staging`
- **Production**: Deployed automatically on merge to `main` (after gate checks)
- **Rollback**: Available via `.github/workflows/rollback.yml`

---

## Questions?

- **General questions**: GitHub Discussions
- **Bug reports**: GitHub Issues
- **Feature requests**: GitHub Issues (use template)
- **Security**: security@flashfusion.co
- **Legal/Licensing**: legal@flashfusion.co

Thank you for contributing! 🎉
