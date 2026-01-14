# FlashFusion - Recommended Tools, Libraries & Frameworks

**For**: 3-Month Launch Roadmap  
**Date**: January 14, 2026  
**Context**: Production launch preparation

---

## 🔧 IMMEDIATE ADDITIONS (Phase 0-1)

### Testing & Quality Assurance

#### **Vitest** (Already Installed ✅)
**Purpose**: Unit testing framework  
**Why**: Fast, modern, integrates well with Vite  
**Usage**: Add test scripts to package.json
```bash
npm install -D vitest @vitest/ui @testing-library/react @testing-library/user-event
```

#### **Playwright** (Already Installed ✅)
**Purpose**: E2E testing  
**Why**: Cross-browser, reliable, great debugging  
**Usage**: Already configured, just need test scripts

#### **MSW (Mock Service Worker)**
**Purpose**: API mocking for tests  
**Why**: Test without hitting real APIs, faster tests, more reliable
```bash
npm install -D msw
```

---

### Rate Limiting & Security

#### **@upstash/ratelimit**
**Purpose**: Rate limiting for Edge Functions  
**Why**: Simple, works with Deno, backed by Redis (Upstash)  
**Alternative**: Deno KV (built-in, free)
```typescript
// Deno KV approach (recommended for cost)
const kv = await Deno.openKv();
const key = `ratelimit:${userId}:${Date.now() / 60000}`; // per minute
const count = await kv.get(key);
if (count.value > 10) throw new Error("Rate limit exceeded");
await kv.set(key, (count.value || 0) + 1, { expireIn: 60000 });
```

#### **DOMPurify** (Already Installed ✅)
**Purpose**: XSS sanitization  
**Why**: Industry standard for HTML sanitization  
**Usage**: Sanitize all user-generated content before rendering

#### **helmet** (For Express-like headers)
**Purpose**: Security headers  
**Why**: Easy way to set security headers (CSP, HSTS, etc.)  
**Note**: For Edge Functions, set headers manually
```typescript
return new Response(data, {
  headers: {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'"
  }
});
```

---

### Social Media Integrations

#### **instagram-graph-api**
**Purpose**: Instagram publishing  
**Why**: Simplifies Instagram Graph API calls  
**Alternative**: Direct API calls (recommended for control)
```bash
# For Edge Functions (Deno), use fetch directly
# For Node.js backend, could use:
npm install instagram-graph-api
```

#### **twitter-api-v2**
**Purpose**: Twitter/X publishing  
**Why**: Well-maintained, supports v2 API
```bash
npm install twitter-api-v2
```

#### **linkedin-api-client**
**Purpose**: LinkedIn publishing  
**Why**: Handles OAuth and post formatting
```bash
npm install linkedin-api-client
```

#### **fb-graph-api**
**Purpose**: Facebook publishing  
**Why**: Official Facebook SDK
```bash
npm install fb
```

**Recommendation**: Use direct `fetch` calls for all platforms to reduce dependencies. Wrap in utility functions:
```typescript
// utils/socialMedia.ts
export async function publishToInstagram(token: string, imageUrl: string, caption: string) {
  const response = await fetch('https://graph.instagram.com/v18.0/me/media', {
    method: 'POST',
    body: JSON.stringify({ image_url: imageUrl, caption }),
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
}
```

---

### Translation

#### **DeepL API** (Recommended)
**Purpose**: Translation service  
**Why**: Best quality, reasonable pricing ($5/500K chars), simple API  
**Pricing**: Free tier 500K chars/month, Pro $5.49/month
```bash
# No npm package needed, use fetch
const response = await fetch('https://api-free.deepl.com/v2/translate', {
  method: 'POST',
  headers: { 'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}` },
  body: `text=${encodeURIComponent(text)}&target_lang=ES`
});
```

**Alternative**: Google Translate API (more expensive, $20/1M chars)

---

### Cost Monitoring & Alerts

#### **PostHog** (Already Installed ✅)
**Purpose**: Product analytics + feature flags  
**Why**: Track user behavior, monitor costs, A/B test  
**Usage**: Add custom events for cost tracking
```typescript
posthog.capture('ai_generation_cost', {
  cost: 0.05,
  model: 'gpt-4',
  tokens: 1500
});
```

#### **Sentry** (Already Installed ✅)
**Purpose**: Error tracking + performance monitoring  
**Why**: Essential for production debugging  
**Usage**: Add context to errors
```typescript
Sentry.captureException(error, {
  tags: { feature: 'content-generation' },
  extra: { prompt, model, userId }
});
```

#### **Custom Cost Dashboard**
**Purpose**: Real-time cost monitoring  
**Why**: Track AI API spend, prevent overruns  
**Implementation**: Simple dashboard showing:
- Daily AI API costs
- Per-user costs
- Per-org costs
- Budget alerts
```sql
-- Create view for cost tracking
CREATE VIEW daily_ai_costs AS
SELECT 
  DATE(created_at) as date,
  org_id,
  SUM(metadata->>'cost')::DECIMAL as total_cost
FROM assets
WHERE metadata->>'cost' IS NOT NULL
GROUP BY DATE(created_at), org_id;
```

---

## 🎨 UI/UX ENHANCEMENTS

### Component Libraries (Already Have shadcn/ui ✅)
Keep existing shadcn/ui, add these for specific needs:

#### **react-hot-toast** or **sonner** (Already installed ✅)
**Purpose**: Toast notifications  
**Why**: Better user feedback for actions  
**Usage**: Success/error messages
```typescript
import { toast } from 'sonner';
toast.success('Post published to Instagram!');
toast.error('Failed to publish. Try again.');
```

#### **framer-motion** (Already installed ✅)
**Purpose**: Animations  
**Why**: Polish, delightful UX  
**Keep it**: Already configured

#### **react-i18next**
**Purpose**: Internationalization (UI language)  
**Why**: If supporting multiple UI languages (English, Spanish, etc.)  
**Priority**: Low for MVP, add in Q2
```bash
npm install react-i18next i18next
```

---

### Loading & Progress

#### **nprogress** or **pace.js**
**Purpose**: Page loading indicators  
**Why**: Show progress during route changes
```bash
npm install nprogress
npm install -D @types/nprogress
```

#### **react-loading-skeleton**
**Purpose**: Skeleton loaders  
**Why**: Better perceived performance
```bash
npm install react-loading-skeleton
```

---

### Forms (Already Have React Hook Form ✅)
Keep existing setup, already excellent.

---

## 📊 MONITORING & OBSERVABILITY

### Uptime Monitoring

#### **BetterUptime** (Recommended)
**Purpose**: Uptime monitoring + status page  
**Why**: Free tier, easy setup, beautiful status page  
**Pricing**: Free for 10 monitors, $18/month for 30  
**Alternative**: UptimeRobot (free tier is generous)

Setup:
1. Monitor key endpoints:
   - `https://flashfusion.lovable.app/health`
   - `https://flashfusion.lovable.app/api/health`
2. Alert via Slack/email if down
3. Public status page at `status.flashfusion.co`

---

### Log Management

#### **Supabase Logs** (Built-in ✅)
**Purpose**: Edge Function logs  
**Why**: Free, integrated  
**Usage**: Already available in Supabase dashboard

#### **Logflare** (Optional)
**Purpose**: Advanced log search/analytics  
**Why**: Better than Supabase UI for debugging  
**Pricing**: Free for 10K events/day  
**Priority**: Low, add if Supabase logs insufficient

---

### Performance Monitoring

#### **Web Vitals**
**Purpose**: Real user monitoring (RUM)  
**Why**: Track LCP, FID, CLS in production
```bash
npm install web-vitals
```

```typescript
// src/lib/webVitals.ts
import { getCLS, getFID, getLCP } from 'web-vitals';

function sendToAnalytics(metric) {
  posthog.capture('web_vital', {
    name: metric.name,
    value: metric.value,
    id: metric.id
  });
}

getCLS(sendToAnalytics);
getFID(sendToAnalytics);
getLCP(sendToAnalytics);
```

---

## 🔐 SECURITY TOOLS

### Secret Management

#### **Supabase Vault** (Built-in ✅)
**Purpose**: Encrypted secrets storage  
**Why**: Better than environment variables for sensitive data  
**Usage**: Store OAuth tokens, API keys
```sql
-- Store encrypted secret
INSERT INTO vault.secrets (name, secret)
VALUES ('stripe_secret_key', 'sk_live_...');

-- Retrieve secret (only in Edge Functions)
SELECT decrypted_secret FROM vault.decrypted_secrets 
WHERE name = 'stripe_secret_key';
```

---

### Vulnerability Scanning (Already in CI/CD ✅)
Keep existing:
- Trivy (container scanning)
- npm audit (dependency scanning)
- TruffleHog (secret scanning)

---

### CSRF Protection

#### **csrf-csrf**
**Purpose**: CSRF token generation/validation  
**Why**: Simple, well-tested
```bash
npm install csrf-csrf
```

**Alternative**: DIY with crypto
```typescript
// Generate CSRF token
const token = crypto.randomUUID();
await kv.set(`csrf:${sessionId}`, token, { expireIn: 3600000 });

// Validate CSRF token
const storedToken = await kv.get(`csrf:${sessionId}`);
if (storedToken.value !== requestToken) {
  throw new Error('Invalid CSRF token');
}
```

---

## 🚀 DEPLOYMENT & INFRASTRUCTURE

### CI/CD (Already Excellent ✅)
Keep existing GitHub Actions setup. Add:

#### **Changesets** (Optional)
**Purpose**: Version management, changelog generation  
**Why**: Automate semantic versioning
```bash
npm install -D @changesets/cli
```

---

### Database Migrations

#### **Supabase CLI** (Recommended)
**Purpose**: Database migration management  
**Why**: Official tool, integrates with Supabase
```bash
npm install -D supabase
```

Usage:
```bash
# Create migration
npx supabase migration new add_indexes

# Apply migrations
npx supabase db push

# Rollback
npx supabase db reset
```

---

### Feature Flags

#### **PostHog Feature Flags** (Already available ✅)
**Purpose**: Gradual rollout, A/B testing  
**Why**: Already paying for PostHog  
**Usage**: Wrap new features in flags
```typescript
if (posthog.isFeatureEnabled('social-publishing-v2')) {
  // New publishing logic
} else {
  // Old publishing logic
}
```

**Alternative**: LaunchDarkly (more features, $8/seat/month)

---

## 📱 FUTURE ADDITIONS (Q2-Q3)

### Mobile Development

#### **Expo** (Recommended for MVP)
**Purpose**: React Native framework  
**Why**: Faster development, easier deployment  
**Pricing**: Free, $29/month for EAS Build
```bash
npx create-expo-app flashfusion-mobile
```

**Alternative**: React Native CLI (more control, steeper learning curve)

---

### Video/Music Generation

#### **Replicate** (Recommended)
**Purpose**: Run AI models (Stable Diffusion, etc.)  
**Why**: Pay-per-use, no infrastructure management  
**Pricing**: ~$0.001/second of compute
```bash
npm install replicate
```

Models to consider:
- Video: Runway Gen-2, Pika Labs
- Music: MusicGen, Mubert

---

### Real-time Collaboration

#### **Supabase Realtime** (Built-in ✅)
**Purpose**: Real-time subscriptions  
**Why**: Already available, free  
**Usage**: Subscribe to campaign changes
```typescript
const subscription = supabase
  .channel('campaign-changes')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'campaigns' },
    (payload) => console.log('Change!', payload)
  )
  .subscribe();
```

#### **Liveblocks** (Optional)
**Purpose**: Advanced collaboration (presence, cursors, etc.)  
**Why**: Better than building from scratch  
**Pricing**: Free for 100 monthly active users  
**Priority**: Q3, if collaboration is priority

---

### Email Service

#### **Resend** (Recommended)
**Purpose**: Transactional emails  
**Why**: Modern API, great DX, generous free tier  
**Pricing**: 3K emails/month free, $20/month for 50K
```bash
npm install resend
```

**Alternative**: SendGrid (more features, complex), AWS SES (cheapest, complex)

---

### Customer Support

#### **Intercom** or **Crisp**
**Purpose**: In-app chat, help desk  
**Why**: Better than email for support  
**Pricing**: 
- Crisp: Free for 2 operators
- Intercom: $39/month
**Priority**: Add at launch or Q2

---

### Billing

#### **Stripe** (Recommended)
**Purpose**: Payment processing, subscriptions  
**Why**: Industry standard, great API  
**Pricing**: 2.9% + $0.30 per transaction
```bash
npm install stripe
npm install -D @types/stripe
```

**Alternative**: Paddle (merchant of record, simpler compliance)

---

## 💾 STORAGE & CDN

### Image Optimization

#### **Cloudinary** (Recommended)
**Purpose**: Image transformation, CDN  
**Why**: Automatic WebP conversion, responsive images  
**Pricing**: 25GB storage + 25GB bandwidth free, $89/month for 100GB  
**Alternative**: Supabase Storage (free up to 1GB, $0.021/GB after)

```typescript
// Cloudinary URL
const optimizedUrl = `https://res.cloudinary.com/flashfusion/image/upload/w_800,f_auto,q_auto/${imageId}`;
```

---

### Video Storage

#### **Mux**
**Purpose**: Video streaming, encoding  
**Why**: Optimized for web playback, adaptive bitrate  
**Pricing**: $0.01/GB storage, $0.05/GB delivery  
**Priority**: Q2/Q3 when adding video features

---

## 📈 ANALYTICS & BUSINESS INTELLIGENCE

### Product Analytics (Already Have PostHog ✅)
Keep PostHog. Consider adding:

#### **Mixpanel** (Alternative)
**Purpose**: Product analytics, funnels, cohorts  
**Why**: More mature than PostHog, better cohort analysis  
**Pricing**: Free for 20M events/month  
**Recommendation**: Stick with PostHog for now, evaluate in Q2

---

### Business Intelligence

#### **Metabase**
**Purpose**: BI dashboards, SQL queries  
**Why**: Connect to Supabase, create custom reports  
**Pricing**: Open source (free), cloud $85/month  
**Priority**: Q2, when need custom reports

---

## 🧪 TESTING ADDITIONS

### Visual Regression Testing

#### **Percy** or **Chromatic**
**Purpose**: Screenshot testing  
**Why**: Catch UI regressions automatically  
**Pricing**: 
- Percy: Free for 5K snapshots/month
- Chromatic: Free for open source, $149/month for teams  
**Priority**: Q2, nice-to-have

---

### Load Testing

#### **k6** (Recommended)
**Purpose**: Load testing, stress testing  
**Why**: Modern, JavaScript-based, great for APIs  
**Pricing**: Open source (free), cloud $49/month
```bash
npm install -D k6
```

```javascript
// load-test.js
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  vus: 100, // 100 virtual users
  duration: '5m',
};

export default function() {
  let res = http.get('https://flashfusion.lovable.app/api/assets');
  check(res, { 'status is 200': (r) => r.status === 200 });
}
```

**Alternative**: Artillery (Node.js), Locust (Python)

---

### Accessibility Testing

#### **axe-core** (Already installed ✅)
**Purpose**: Automated accessibility testing  
**Why**: Industry standard, comprehensive  
**Keep it**: Already configured in CI/CD

#### **Pa11y**
**Purpose**: Automated accessibility testing (alternative)  
**Why**: Complements axe-core, different rules  
**Priority**: Low, axe-core is sufficient

---

## 📚 DOCUMENTATION TOOLS

### API Documentation

#### **Scalar** or **Swagger UI**
**Purpose**: Beautiful OpenAPI documentation  
**Why**: Already have OpenAPI spec, need UI  
**Pricing**: Free (open source)
```bash
npm install @scalar/api-reference
```

Add to docs site:
```html
<scalar-api-reference spec-url="/docs/openapi.yaml" />
```

---

### User Documentation

#### **Notion** (Recommended)
**Purpose**: Knowledge base, help center  
**Why**: Easy to use, collaborative, embeddable  
**Pricing**: Free for individuals, $8/user/month for teams  
**Alternative**: GitBook (version control for docs), Docusaurus (static site)

---

## 🎯 COST OPTIMIZATION TOOLS

### AI API Cost Tracking

#### **LangSmith** or **PromptLayer**
**Purpose**: LLM observability, cost tracking  
**Why**: Track AI API usage, optimize prompts  
**Pricing**: 
- LangSmith: Free for 5K traces/month
- PromptLayer: Free for 1K requests/month  
**Priority**: Q2, when costs become significant

---

### Cloud Cost Monitoring

#### **Infracost**
**Purpose**: Cloud cost estimates  
**Why**: Predict infrastructure costs before deploying  
**Pricing**: Free (open source)  
**Priority**: Low, Lovable abstracts infrastructure

---

## 🛠️ DEVELOPER EXPERIENCE

### Code Quality

#### **ESLint** (Already installed ✅)
**Purpose**: Linting  
**Keep it**: Already configured

#### **Prettier** (Already installed ✅)
**Purpose**: Code formatting  
**Keep it**: Already configured

#### **Husky**
**Purpose**: Git hooks (pre-commit, pre-push)  
**Why**: Enforce linting, tests before commit
```bash
npm install -D husky lint-staged
```

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"]
  }
}
```

---

### Development Tools

#### **React DevTools** (Browser Extension)
**Purpose**: Debug React components  
**Why**: Essential for React development  
**Free**: Yes

#### **Supabase Studio** (Built-in ✅)
**Purpose**: Database GUI  
**Why**: Already available in Supabase dashboard

---

## 📊 SUMMARY & PRIORITIES

### MUST ADD (Phase 0-1)
1. ✅ Test scripts in package.json
2. 🔐 Rate limiting (Deno KV)
3. 📱 Social media API clients (direct fetch, no libs)
4. 🌍 DeepL for translation
5. 🔔 BetterUptime for monitoring
6. 🧪 MSW for API mocking in tests
7. 📊 Cost tracking dashboard

### SHOULD ADD (Phase 2-3)
1. 💬 Intercom/Crisp for support
2. 💳 Stripe for billing
3. 🖼️ Cloudinary for image optimization
4. 🧪 k6 for load testing
5. 🎨 react-loading-skeleton
6. 📖 Scalar for API docs

### NICE TO HAVE (Q2-Q3)
1. 📱 Expo for mobile app
2. 🎥 Replicate for video/music
3. 🤝 Liveblocks for collaboration
4. 📊 Metabase for BI
5. 👀 Percy for visual regression
6. 🔍 LangSmith for AI observability

---

## 💰 ESTIMATED COSTS (Monthly)

### Current Stack (Free)
- Supabase: $0 (free tier sufficient for now)
- Sentry: $0 (free tier)
- PostHog: $0 (free tier)
- GitHub Actions: $0 (free for public repos)
- **Total**: $0

### With Recommended Additions
- Supabase: $25 (Pro plan at ~100 users)
- Sentry: $26 (Team plan)
- PostHog: $0 (free tier adequate)
- BetterUptime: $0 (free tier)
- DeepL: $5.49 (Pro plan)
- Cloudinary: $0 (free tier, upgrade to $89 if needed)
- Stripe: Pay-as-you-go (2.9% + $0.30)
- Intercom: $39 (Starter plan)
- **Total**: ~$95/month (before AI API costs)

### At Scale (1K users)
- Supabase: $125
- Sentry: $89
- PostHog: $225
- BetterUptime: $18
- DeepL: $5.49
- Cloudinary: $89
- Intercom: $79
- **Total**: ~$630/month (before AI API costs)

**Note**: AI API costs will dominate at scale ($2K-20K/month depending on usage)

---

## 🎓 LEARNING RESOURCES

### For Team
- **Supabase Docs**: https://supabase.com/docs
- **Deno Docs**: https://deno.land/manual
- **React 18 Docs**: https://react.dev
- **TanStack Query Docs**: https://tanstack.com/query
- **Playwright Docs**: https://playwright.dev

### Security
- **OWASP Top 10**: https://owasp.org/www-project-top-ten/
- **Supabase Security**: https://supabase.com/docs/guides/auth/security

### Platform APIs
- **Instagram Graph API**: https://developers.facebook.com/docs/instagram-api
- **Twitter API v2**: https://developer.twitter.com/en/docs/twitter-api
- **LinkedIn API**: https://learn.microsoft.com/en-us/linkedin/
- **Facebook Graph API**: https://developers.facebook.com/docs/graph-api

---

**Last Updated**: January 14, 2026  
**Maintained By**: Engineering Team  
**Next Review**: February 14, 2026
