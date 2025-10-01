# FlashFusion Creative Mega App

**AI-powered content creation platform** for multi-channel campaigns, brand-enforced assets, and intelligent scheduling.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** v18+ and **npm** v9+ ([install with nvm](https://github.com/nvm-sh/nvm))
- **Git**

### Setup

```bash
# Clone the repository
git clone <YOUR_GIT_URL>
cd flashfusion

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

---

## 📦 Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast builds and HMR
- **TanStack Query** for server state
- **Tailwind CSS v4** + **shadcn/ui** components
- **Framer Motion** for animations
- **Lucide React** icons

### Backend (Lovable Cloud)
- **Supabase** (Postgres + Auth + Storage + Edge Functions)
- **Row-Level Security** for multi-tenancy
- **Deno** runtime for edge functions

### Observability
- **Sentry** for error tracking
- **PostHog** for product analytics
- **OpenTelemetry** for distributed tracing

---

## 🧪 Testing

### Run All Tests
```bash
npm test
```

### Test Suites

#### Unit Tests (Vitest)
```bash
npm run test:unit           # Run unit tests
npm run test:unit:watch     # Watch mode
npm run test:unit:coverage  # With coverage report
```

**Coverage Thresholds:**
- Core modules: ≥90% (lines, branches, functions, statements)
- Overall: ≥70%

#### Contract Tests
```bash
npm run test:contract
```
Validates API request/response schemas for edge functions.

#### E2E Tests (Playwright)
```bash
npm run test:e2e            # Headless mode
npm run test:e2e:ui         # UI mode for debugging
npm run test:e2e:debug      # Debug specific test
```

**Golden Paths:**
1. Generate asset → lint brand rules → save
2. Draft campaign → schedule post
3. Translate content → approve → publish

#### Accessibility Tests
```bash
npm run test:a11y
```
Enforces WCAG 2.2 AA compliance using axe-core.

#### Security Tests
```bash
npm run test:security
```
RLS negative tests, SQL injection prevention, XSS checks.

#### Smoke Tests
```bash
npm run test:smoke
```
Post-deployment health checks.

---

## 🏗️ Architecture

FlashFusion is a **multi-tenant SaaS** with org-scoped data isolation via Row-Level Security (RLS).

### Core Entities
- **Orgs**: Top-level workspace (single owner, multiple members)
- **Members**: Users with roles (owner/admin/editor/viewer)
- **Brand Kits**: Colors, fonts, logos, guidelines
- **Assets**: Generated content (text/image/video/music) with provenance tracking
- **Templates**: Reusable content structures
- **Campaigns**: Multi-platform content plans with metrics
- **Schedules**: Timed posts with retry logic
- **Marketplace Items**: Community packs (templates, presets, integrations)

### Key Design Patterns
- **Org-scoped RLS policies** on all tables
- **Provenance tracking** for AI-generated assets (model, prompt hash, dataset)
- **Idempotency headers** for all mutating API calls
- **Expand-Migrate-Contract** for zero-downtime DB migrations

See [docs/architecture.md](./docs/architecture.md) for detailed diagrams.

---

## 🔧 Development

### Project Structure
```
flashfusion/
├── src/
│   ├── components/       # React components
│   │   └── ui/          # shadcn components + custom
│   ├── pages/           # Route pages
│   ├── lib/             # Utilities, observability
│   ├── hooks/           # Custom React hooks
│   └── integrations/    # Supabase client (auto-generated)
├── supabase/
│   ├── functions/       # Edge functions (Deno)
│   └── config.toml      # Supabase configuration
├── tests/
│   ├── unit/            # Vitest component tests
│   ├── contract/        # API schema validation
│   ├── e2e/             # Playwright tests
│   ├── accessibility/   # Axe-core tests
│   └── security/        # RLS negative tests
├── docs/                # Technical documentation
├── .storybook/          # Storybook config
└── .github/workflows/   # CI/CD pipelines
```

### Environment Variables
All environment variables are auto-configured via Lovable Cloud. **Do not edit `.env` manually.**

Key variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

### Edge Functions
Located in `supabase/functions/`. Auto-deployed with code pushes.

**Available Functions:**
- `generate-content`: AI content generation (text/image/video/music)
- `campaigns-draft`: Campaign planning with AI suggestions
- `schedule`: Post scheduling with retry logic
- `marketplace-install`: Install marketplace packs

Call via Supabase client:
```typescript
const { data } = await supabase.functions.invoke('generate-content', {
  body: { prompt: '...', type: 'image' }
});
```

---

## 🎨 Storybook

Interactive component library with accessibility checks.

```bash
npm run storybook          # Start Storybook on :6006
npm run storybook:build    # Build static Storybook
npm run storybook:test     # Run Storybook tests
```

View components at `http://localhost:6006`

---

## 🚢 Deployment

### Via Lovable (Recommended)
1. Open [Lovable Project](https://lovable.dev/projects/e1555869-7b06-4a0a-aec3-bb505229dbf1)
2. Click **Share → Publish**
3. Edge functions and DB migrations deploy automatically

### Custom Domain
Navigate to **Project > Settings > Domains** in Lovable to connect your domain.

### CI/CD Pipeline
Every push triggers:
1. **Lint** + **Typecheck**
2. **Unit Tests** (coverage threshold: 90% core, 70% overall)
3. **Contract Tests** (API schema validation)
4. **E2E Tests** (Playwright golden paths)
5. **Accessibility Tests** (WCAG 2.2 AA)
6. **Security Scan** (RLS, npm audit, secret scanning)
7. **Lighthouse CI** (performance budgets)
8. **Gate Check** (all gates must pass)
9. **Deploy** (production with health checks)

See [docs/ci_cd.md](./docs/ci_cd.md) for pipeline details.

---

## 📊 Performance Budgets

| Metric | Target |
|--------|--------|
| TTFB | ≤ 150ms |
| LCP | ≤ 2.5s |
| INP | ≤ 200ms |
| CLS | ≤ 0.08 |
| JS Bundle | ≤ 180KB (gzip/route) |
| CSS Bundle | ≤ 35KB (gzip) |

Enforced via Lighthouse CI in every deploy.

---

## 🔒 Security

### Authentication
- Email + password (auto-confirm in dev)
- Social OAuth (Google, GitHub)
- JWT-based sessions with auto-refresh

### Authorization
- **Row-Level Security (RLS)** on all tables
- Org-scoped policies: `auth.uid()` checks membership
- Role-based access: owner/admin/editor/viewer

### Best Practices
- No anonymous sign-ups
- Input validation with Zod schemas
- CORS headers on all edge functions
- Secrets managed via Supabase Vault
- Regular `npm audit` + secret scanning

See [docs/security.md](./docs/security.md) for threat model.

---

## 🔄 Rollback

If a deployment fails, trigger rollback:

```bash
# Manual rollback script
./scripts/rollback.sh <target-version>

# Or via GitHub Actions
# Navigate to Actions > Rollback Production > Run workflow
```

Rollback includes:
1. Database migration revert
2. Application deployment to previous version
3. Smoke tests
4. Sentry release tagging

See [docs/ci_cd.md](./docs/ci_cd.md#rollback-procedure) for details.

---

## 📖 Documentation

- **[Architecture](./docs/architecture.md)**: System design, data model, security
- **[Orchestrator](./docs/orchestrator.md)**: AI orchestration layer
- **[Performance](./docs/performance.md)**: Optimization strategies, budgets
- **[Security](./docs/security.md)**: Threat model, RLS policies
- **[Marketplace](./docs/marketplace.md)**: Pack format, installation flow
- **[CI/CD](./docs/ci_cd.md)**: Pipeline stages, rollback, observability
- **[Verification](./docs/verification.md)**: Stop-fail gates, golden paths
- **[Demo Script](./docs/demo_script.md)**: Product walkthrough

---

## 🛠️ Troubleshooting

### Common Issues

**Build fails with "Module not found"**
```bash
rm -rf node_modules package-lock.json
npm install
```

**Supabase types out of sync**
Types are auto-generated. **Never edit `src/integrations/supabase/types.ts` manually.**

**Tests failing locally but passing in CI**
Ensure you're using Node.js v18+ and clear test cache:
```bash
npm run test:unit -- --clearCache
```

**Edge function not receiving auth token**
Check `supabase/config.toml` for `verify_jwt = true` on the function.

---

## 🤝 Contributing

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

---

## 📝 License

Proprietary. All rights reserved.

---

## 🆘 Support

- **Documentation**: [docs.lovable.dev](https://docs.lovable.dev)
- **Discord**: [Lovable Community](https://discord.gg/lovable)
- **Email**: support@lovable.dev

---

Built with ❤️ by the FlashFusion team
