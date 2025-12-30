# FlashFusion Creative Mega App

<div align="center">

**AI-powered content creation platform for multi-channel campaigns, brand-enforced assets, and intelligent scheduling.**

[![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)](./CHANGELOG.md)
[![License](https://img.shields.io/badge/license-Proprietary-red.svg)](./LICENSE)
[![Tests](https://img.shields.io/badge/tests-passing-green.svg)]()
[![Coverage](https://img.shields.io/badge/coverage-72%25-yellow.svg)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)]()
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg)]()

[Documentation](./docs/) | [Roadmap](./ROADMAP.md) | [Contributing](./CONTRIBUTING.md) | [Changelog](./CHANGELOG.md)

</div>

---

## Overview

FlashFusion is a production-ready SaaS platform that enables creators, marketers, and agencies to:

- **Generate** AI-powered content (text, images, video, music)
- **Manage** multi-platform marketing campaigns
- **Schedule** and publish to social media channels
- **Enforce** brand consistency across all assets
- **Analyze** performance with real-time metrics

### Key Features

| Feature | Description |
|---------|-------------|
| **AI Content Studio** | Generate text, images with AI; video/music coming soon |
| **Campaign Builder** | Multi-step wizard with AI-powered suggestions |
| **Smart Scheduling** | Timeline view with platform-specific optimization |
| **Brand Kit** | Centralized brand guidelines, colors, fonts, voice |
| **Marketplace** | Install template packs to accelerate content creation |
| **Analytics** | Track performance with charts and metrics |
| **Multi-Tenant** | Org-based data isolation with RLS security |

---

## Quick Start

### Prerequisites

- **Node.js** v18+ ([install via nvm](https://github.com/nvm-sh/nvm))
- **npm** v9+ or **pnpm** v8+
- **Git**

### Installation

```bash
# Clone the repository
git clone https://github.com/flashfusion/creative-mega-app.git
cd creative-mega-app

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

### Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Required variables are auto-configured via Lovable Cloud. See [.env.example](./.env.example) for all options.

---

## Tech Stack

### Frontend

| Technology | Purpose |
|------------|---------|
| [React 18](https://react.dev) | UI framework |
| [TypeScript 5](https://typescriptlang.org) | Type safety |
| [Vite 5](https://vitejs.dev) | Build tooling |
| [TanStack Query](https://tanstack.com/query) | Server state management |
| [React Router 6](https://reactrouter.com) | Routing |
| [Tailwind CSS v4](https://tailwindcss.com) | Styling |
| [shadcn/ui](https://ui.shadcn.com) | Component library (59 components) |
| [Recharts](https://recharts.org) | Charts |
| [Lucide](https://lucide.dev) | Icons |

### Backend (Lovable Cloud / Supabase)

| Technology | Purpose |
|------------|---------|
| [PostgreSQL 15](https://postgresql.org) | Database |
| [Supabase Auth](https://supabase.com/auth) | Authentication |
| [Edge Functions](https://supabase.com/edge-functions) | Serverless APIs (17 functions) |
| [Row-Level Security](https://supabase.com/docs/guides/auth/row-level-security) | Multi-tenant data isolation |
| [Realtime](https://supabase.com/realtime) | Live updates |

### Observability

| Tool | Purpose |
|------|---------|
| [Sentry](https://sentry.io) | Error tracking |
| [PostHog](https://posthog.com) | Product analytics |
| [OpenTelemetry](https://opentelemetry.io) | Distributed tracing |

### Testing

| Tool | Purpose |
|------|---------|
| [Vitest](https://vitest.dev) | Unit testing |
| [Playwright](https://playwright.dev) | E2E testing |
| [axe-core](https://www.deque.com/axe/) | Accessibility |

---

## Project Structure

```
flashfusion/
├── src/
│   ├── components/       # React components
│   │   ├── ui/          # shadcn/ui primitives (59 components)
│   │   ├── analytics/   # Analytics visualizations
│   │   ├── campaigns/   # Campaign management
│   │   ├── content/     # Content generation
│   │   ├── monitoring/  # System monitoring
│   │   ├── roadmap/     # Roadmap display
│   │   └── schedule/    # Scheduling UI
│   ├── pages/           # Route pages (21 pages)
│   ├── hooks/           # Custom React hooks (8 hooks)
│   ├── lib/             # Utilities, validation, API
│   └── integrations/    # Supabase client
├── supabase/
│   ├── functions/       # Edge Functions (17 functions)
│   │   ├── _shared/    # Shared utilities
│   │   └── [name]/     # Individual functions
│   └── migrations/      # Database migrations
├── tests/
│   ├── unit/           # Vitest tests
│   ├── e2e/            # Playwright tests
│   ├── contract/       # API schema tests
│   ├── accessibility/  # axe-core tests
│   └── security/       # RLS security tests
├── docs/               # Technical documentation (28 files)
└── example_packs/      # Marketplace pack examples
```

---

## Testing

### Run All Tests

```bash
npm test
```

### Test Suites

| Command | Description |
|---------|-------------|
| `npm run test:unit` | Unit tests (Vitest) |
| `npm run test:unit:watch` | Watch mode |
| `npm run test:unit:coverage` | With coverage report |
| `npm run test:e2e` | E2E tests (Playwright) |
| `npm run test:e2e:ui` | E2E with UI |
| `npm run test:a11y` | Accessibility tests |
| `npm run test:contract` | API schema validation |
| `npm run test:security` | RLS security tests |
| `npm run test:smoke` | Post-deployment health checks |

### Coverage Thresholds

- **Core modules**: ≥90%
- **Overall**: ≥70%

### Golden Paths (E2E)

1. Generate asset → Lint brand rules → Save
2. Draft campaign → Schedule post
3. Translate content → Approve → Publish

---

## Architecture

### Multi-Tenant Design

FlashFusion uses org-based data isolation via Row-Level Security:

```sql
CREATE POLICY "Users can view org data"
ON public.assets FOR SELECT
USING (org_id IN (
  SELECT org_id FROM public.org_members
  WHERE user_id = auth.uid()
));
```

### Core Entities

| Entity | Description |
|--------|-------------|
| **Orgs** | Workspaces (single owner, multiple members) |
| **Members** | Users with roles (owner/admin/editor/viewer) |
| **Assets** | Generated content with provenance tracking |
| **Campaigns** | Multi-platform content plans |
| **Schedules** | Timed posts with retry logic |
| **Brand Kits** | Colors, fonts, logos, guidelines |
| **Marketplace Items** | Community packs (templates, presets) |

### Key Patterns

- **Org-scoped RLS policies** on all tables
- **Provenance tracking** for AI-generated assets
- **Idempotency headers** for all mutations
- **Expand-Migrate-Contract** for DB migrations

See [docs/architecture.md](./docs/architecture.md) for detailed diagrams.

---

## Edge Functions

| Function | Purpose | Auth |
|----------|---------|------|
| `generate-content` | AI text/image generation | JWT |
| `generate-youtube-content` | YouTube-optimized | JWT |
| `generate-tiktok-content` | TikTok-optimized | JWT |
| `campaigns-draft` | AI campaign planning | JWT |
| `schedule` | Post scheduling | JWT |
| `publish-post` | Publish to platforms | - |
| `marketplace-install` | Install packs | JWT |
| `library-install` | Install templates | JWT |
| `integrations-connect` | OAuth connection | JWT |
| `integrations-callback` | OAuth callback | - |
| `events-ingest` | Analytics tracking | JWT |
| `gdpr-export` | Data export | JWT |
| `gdpr-delete` | Data deletion | JWT |
| `usage-check` | Quota checking | JWT |
| `health` | Health check | - |

### Calling Edge Functions

```typescript
import { supabase } from '@/integrations/supabase/client';

const { data, error } = await supabase.functions.invoke('generate-content', {
  body: { prompt: '...', type: 'image' }
});
```

---

## Development

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run storybook` | Start Storybook on :6006 |

### Code Style

- **ESLint** + **Prettier** enforced
- **TypeScript strict mode**
- Conventional Commits for messages

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes and commit
git add .
git commit -m "feat(scope): add new feature"

# Push and create PR
git push origin feature/my-feature
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for full guidelines.

---

## Deployment

### Via Lovable (Recommended)

1. Open [Lovable Project](https://lovable.dev/projects/e1555869-7b06-4a0a-aec3-bb505229dbf1)
2. Click **Share → Publish**
3. Edge functions and migrations deploy automatically

### Custom Domain

Navigate to **Project > Settings > Domains** in Lovable.

### CI/CD Pipeline

Every push triggers:

1. **Lint** + **TypeCheck**
2. **Unit Tests** (90% core, 70% overall coverage)
3. **Contract Tests** (API schema validation)
4. **E2E Tests** (Playwright golden paths)
5. **Accessibility Tests** (WCAG 2.2 AA)
6. **Security Scan** (RLS, npm audit, secret scanning)
7. **Lighthouse CI** (performance budgets)
8. **Gate Check** (all gates must pass)
9. **Deploy** (production with health checks)

See [docs/ci_cd.md](./docs/ci_cd.md) for details.

### Rollback

```bash
# Manual rollback
./scripts/rollback.sh <target-version>

# Via GitHub Actions
# Navigate to Actions > Rollback Production > Run workflow
```

---

## Performance

### Budgets & Current Metrics

| Metric | Target | Current |
|--------|--------|---------|
| TTFB | ≤150ms | 120ms ✅ |
| LCP | ≤2.5s | 2.1s ✅ |
| INP | ≤200ms | 180ms ✅ |
| CLS | ≤0.08 | 0.06 ✅ |
| JS Bundle | ≤180KB | 168KB ✅ |
| CSS Bundle | ≤35KB | 32KB ✅ |

Enforced via Lighthouse CI in every deploy.

---

## Security

### Authentication

- Email + password (auto-confirm in dev)
- JWT-based sessions with auto-refresh
- Role-based access (owner/admin/editor/viewer)

### Data Protection

- **Row-Level Security** on all tables
- **Input validation** with Zod schemas
- **CORS** configured per environment
- **Secrets** in environment variables

### Compliance

- **GDPR**: Export/delete endpoints
- **WCAG 2.2 AA**: Accessibility tested
- **SOC 2**: Audit logging

See [SECURITY.md](./SECURITY.md) for vulnerability reporting.

---

## Documentation

### Root Level

| Document | Description |
|----------|-------------|
| [README.md](./README.md) | This file |
| [CHANGELOG.md](./CHANGELOG.md) | Version history |
| [ROADMAP.md](./ROADMAP.md) | Product roadmap |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Contributor guide |
| [SECURITY.md](./SECURITY.md) | Security policy |
| [CLAUDE.md](./CLAUDE.md) | AI assistant development guide |
| [AGENTS.md](./AGENTS.md) | Multi-agent architecture |
| [GEMINI.md](./GEMINI.md) | Gemini integration guide |
| [LICENSE](./LICENSE) | License terms |

### Technical Docs (`/docs`)

| Document | Description |
|----------|-------------|
| [architecture.md](./docs/architecture.md) | System design |
| [orchestrator.md](./docs/orchestrator.md) | AI orchestration |
| [performance.md](./docs/performance.md) | Optimization guide |
| [security.md](./docs/security.md) | Threat model |
| [marketplace.md](./docs/marketplace.md) | Pack format |
| [ci_cd.md](./docs/ci_cd.md) | Pipeline docs |
| [verification.md](./docs/verification.md) | Acceptance criteria |
| [demo_script.md](./docs/demo_script.md) | Product walkthrough |
| [openapi.yaml](./docs/openapi.yaml) | API specification |

---

## Roadmap

### Current (v1.1.0)
- ✅ Theme system enhancements
- ✅ Developer documentation (CLAUDE.md, AGENTS.md, GEMINI.md)
- ✅ Error handling improvements

### Next (v1.2.0)
- [ ] Brand rule enforcement
- [ ] Social media OAuth
- [ ] Marketplace pack installation
- [ ] Translation workflow

### Future
- [ ] Video/Music generation
- [ ] A/B testing framework
- [ ] Real-time collaboration
- [ ] Mobile app (React Native)
- [ ] Enterprise features (SSO, custom roles)

See [ROADMAP.md](./ROADMAP.md) for full details.

---

## Troubleshooting

### Common Issues

**Build fails with "Module not found"**
```bash
rm -rf node_modules package-lock.json
npm install
```

**Supabase types out of sync**
Types are auto-generated. Never edit `src/integrations/supabase/types.ts`.

**Tests failing locally but passing in CI**
```bash
npm run test:unit -- --clearCache
```

**Edge function not receiving auth token**
Check `supabase/config.toml` for `verify_jwt = true`.

---

## Contributing

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make changes and add tests
3. Run full test suite: `npm test`
4. Commit with conventional commits: `feat: add marketplace filters`
5. Push and open a PR

### Code Standards

- **ESLint** + **Prettier** enforced
- **TypeScript strict mode**
- 90% test coverage for core modules
- WCAG 2.2 AA accessibility
- Lighthouse score ≥90

See [CONTRIBUTING.md](./CONTRIBUTING.md) for full guidelines.

---

## Support

| Channel | Purpose |
|---------|---------|
| [Documentation](https://docs.lovable.dev) | Official docs |
| [Discord](https://discord.gg/lovable) | Community |
| [GitHub Issues](https://github.com/flashfusion/issues) | Bug reports |
| [Email](mailto:support@lovable.dev) | Support |

---

## License

Proprietary. All rights reserved. See [LICENSE](./LICENSE).

---

<div align="center">

Built with ❤️ by the FlashFusion team

</div>
