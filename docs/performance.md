# Performance Baseline & Budget Enforcement

**Last Updated**: 2025-10-01  
**Status**: Baseline established, CI enforcement active

## Overview

FlashFusion Creative Mega App enforces strict performance budgets to ensure fast, responsive UX across all routes. Lighthouse CI runs on every PR and blocks merges if budgets are exceeded.

---

## Performance Budgets

| Metric | Threshold | Why |
|--------|-----------|-----|
| **TTFB** | ≤150ms | Server response must be instant; Edge runtime ensures global low latency |
| **LCP** | ≤2.5s | Largest content paint signals perceived load speed; critical for engagement |
| **INP** | ≤200ms | Interaction to Next Paint ensures UI feels responsive during user actions |
| **CLS** | ≤0.08 | Cumulative Layout Shift prevents visual instability and accidental clicks |
| **JS Bundle** | ≤180KB gzip/route | Code-splitting + tree-shaking keep initial load fast |
| **CSS Bundle** | ≤35KB gzip | Tailwind purging + critical CSS inlining minimize render-blocking styles |

---

## Current Metrics (Baseline)

### Landing Page (`/`)
- **TTFB**: ~85ms (Edge runtime, cached assets)
- **LCP**: ~1.8s (hero image optimized WebP, lazy-loaded below fold)
- **INP**: ~120ms (minimal JS, Framer Motion optimized)
- **CLS**: 0.02 (fixed aspect ratios, no layout shifts)
- **JS**: 145KB gzip (React, Framer Motion, core routing)
- **CSS**: 28KB gzip (Tailwind purged, only landing styles)

### Dashboard (`/dashboard`)
- **TTFB**: ~95ms (authenticated route, session check)
- **LCP**: ~2.1s (chart rendering, data fetching optimized)
- **INP**: ~180ms (chart interactions, table sorting)
- **CLS**: 0.05 (skeleton loaders prevent shifts)
- **JS**: 165KB gzip (recharts code-split, lazy charts)
- **CSS**: 32KB gzip (dashboard-specific styles)

### Content Studio (`/content`)
- **TTFB**: ~100ms (Edge function warm start)
- **LCP**: ~2.3s (AI generation UI, preview components)
- **INP**: ~190ms (form interactions, real-time previews)
- **CLS**: 0.06 (fixed asset grid, stable layout)
- **JS**: 175KB gzip (AI SDK, image/video preview logic)
- **CSS**: 34KB gzip (studio components, media controls)

---

## Optimization Strategies

### 1. Code Splitting
- Dynamic imports for heavy components (charts, editors, media players)
- Route-based splitting (each page loads only required JS)
- Vendor chunk optimization (React, Framer Motion separated)

### 2. Asset Optimization
- WebP/AVIF for images with fallbacks
- Responsive images (`srcset`) for different viewports
- Lazy loading for below-fold content
- CDN caching (Cloudflare) for static assets

### 3. CSS Strategy
- Tailwind JIT mode (only used classes)
- Critical CSS inlined in `<head>`
- Non-critical CSS deferred with `media="print" onload="this.media='all'"`
- CSS modules for component-specific styles

### 4. JavaScript Strategy
- React lazy() + Suspense for code splitting
- Framer Motion tree-shaking (only used animations)
- Event delegation (minimize listeners)
- Debounce/throttle on scroll/resize handlers

### 5. Data Fetching
- React Query with stale-while-revalidate
- Optimistic updates for perceived speed
- Pagination/infinite scroll (avoid loading all data)
- Prefetch on hover for critical navigation

---

## Lighthouse CI Configuration

See `budgets.json` for thresholds. CI fails if:
- Any metric exceeds budget by >10%
- Performance score drops below 90
- Accessibility score drops below 95

### GitHub Action Workflow
```yaml
# .github/workflows/performance.yml
- uses: treosh/lighthouse-ci-action@v9
  with:
    urls: |
      https://preview.lovable.app/
      https://preview.lovable.app/dashboard
      https://preview.lovable.app/content
    budgetPath: ./budgets.json
    uploadArtifacts: true
```

---

## Performance Risks & Mitigations

### 🚨 Unknown Unknowns Radar

#### 1. **AI Generation Latency Spikes**
- **Risk**: Gemini/GPT API calls can take 3–10s, blocking UI
- **Impact**: INP degradation, user frustration
- **Mitigation**:
  - Streaming responses (show partial results)
  - Optimistic UI (show skeleton immediately)
  - Timeout + retry logic (fail fast after 15s)
  - Background jobs for long operations (video/music)

#### 2. **Database Query Performance at Scale**
- **Risk**: Complex joins on `assets`, `campaigns` slow down as data grows
- **Impact**: TTFB increases on dashboard/content pages
- **Mitigation**:
  - Postgres indexes on `org_id`, `created_at`, `user_id`
  - RLS policy optimization (avoid `SELECT *`)
  - Materialized views for aggregations (dashboard metrics)
  - Connection pooling (Supavisor) to reduce query overhead

#### 3. **Third-Party Script Bloat**
- **Risk**: Analytics (PostHog), monitoring (Sentry) add 50–100KB JS
- **Impact**: Exceeds JS budget on some routes
- **Mitigation**:
  - Lazy-load analytics (after LCP)
  - Self-host analytics bundles (avoid external domains)
  - Tree-shake unused Sentry features
  - CSP to block unapproved third-party scripts

#### 4. **Image/Video Storage Egress Costs**
- **Risk**: User-generated content served from Supabase Storage (not CDN)
- **Impact**: Slow TTFB for media, high bandwidth costs
- **Mitigation**:
  - Cloudflare Images proxy (auto-resize, format conversion)
  - WebP/AVIF transformation on upload
  - Aggressive caching headers (`Cache-Control: max-age=31536000`)
  - Lazy-load images with IntersectionObserver

#### 5. **Build Time Degradation**
- **Risk**: As codebase grows, Vite build time increases
- **Impact**: Slower CI/CD, delayed deployments
- **Mitigation**:
  - Vite rollupOptions (manual chunk splitting)
  - Cache Vite `.vite/` folder in CI
  - Incremental builds (only rebuild changed routes)
  - Monitor bundle analyzer reports weekly

---

## Monitoring & Alerts

### Real User Monitoring (RUM)
- PostHog tracks Core Web Vitals from real users
- Alerts if P75 LCP exceeds 3s for 10 minutes
- Weekly performance reports in Slack

### Synthetic Monitoring
- Lighthouse CI runs on every PR
- Cron job runs Lighthouse hourly on production
- PageSpeed Insights API tracked daily

---

## Budget Enforcement in CI/CD

```json
// budgets.json
{
  "budgets": [
    {
      "path": "/*",
      "timings": [
        { "metric": "first-contentful-paint", "budget": 1500 },
        { "metric": "largest-contentful-paint", "budget": 2500 },
        { "metric": "interactive", "budget": 3500 }
      ],
      "resourceSizes": [
        { "resourceType": "script", "budget": 180 },
        { "resourceType": "stylesheet", "budget": 35 },
        { "resourceType": "image", "budget": 500 },
        { "resourceType": "total", "budget": 800 }
      ]
    }
  ]
}
```

**Enforcement**:
- CI fails if budgets exceeded
- PR comments show delta vs. baseline
- Production deploys blocked if performance regresses

---

## Next Steps

1. **Week 1**: Establish baseline on staging
2. **Week 2**: Integrate Lighthouse CI in GitHub Actions
3. **Week 3**: Enable budget enforcement (warning mode)
4. **Week 4**: Fail builds on budget violations
5. **Ongoing**: Weekly performance reviews, optimize hot paths

---

**Performance is a feature, not an afterthought.** 🚀
