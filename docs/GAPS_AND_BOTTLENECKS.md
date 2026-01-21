# FlashFusion: Gaps, Bottlenecks & Unknown Unknowns

**Last Updated**: January 21, 2026  
**Status**: Active Tracking Document

---

## 🚨 CRITICAL GAPS (Launch Blockers)

### 1. Social Media Publishing Not Functional
**Severity**: CRITICAL  
**Status**: ❌ Not Connected  
**Location**: `supabase/functions/publish-post/index.ts`

**What's Missing**:
- OAuth flows for Instagram, Twitter, LinkedIn, Facebook
- Platform API integrations
- Token storage and refresh
- Retry logic for failed posts

**Impact**: Core value proposition non-functional. Users can schedule but not publish.

**Effort**: 3-4 weeks  
**Dependencies**: OAuth credentials from each platform

---

### 2. Brand Rule Enforcement Incomplete
**Severity**: HIGH  
**Status**: ⚠️ Partial  
**Location**: `supabase/functions/generate-content/index.ts`, `src/components/content/BrandValidator.tsx`

**What's Missing**:
- Brand rule parser (`brand_kits.rules` JSONB)
- Real-time validation during generation
- Compliance scoring
- Override mechanism for intentional deviations

**Impact**: Core differentiator not working. Users cannot enforce brand consistency.

**Effort**: 2 weeks

---

### 3. Translation Workflow Missing
**Severity**: HIGH  
**Status**: ❌ Not Implemented  
**Location**: UI placeholder only

**What's Missing**:
- `translations` table in database
- Translation API integration (Lovable AI supports multilingual)
- Language selector in Content Studio
- Review/approve workflow

**Impact**: Multi-language campaigns not possible.

**Effort**: 2 weeks

---

## ⚠️ MODERATE GAPS

### 4. Marketplace Pack Installation Incomplete
**Severity**: MEDIUM  
**Status**: ⚠️ Partial  
**Location**: `supabase/functions/marketplace-install/index.ts`

**What's Missing**:
- Complete pack extraction logic
- Version management
- Update checker
- Rating/review system

**Current State**: Browse works, install has placeholder logic.

**Effort**: 2-3 weeks

---

### 5. Video/Music Generation Placeholder
**Severity**: MEDIUM  
**Status**: ❌ Placeholder  
**Location**: `src/pages/ContentStudio.tsx`

**What's Missing**:
- Video generation API integration
- Music generation API integration
- Progress indicators for long-running jobs
- Result preview

**Current State**: UI exists, API calls are placeholders.

**Effort**: 4 weeks (defer to Phase 2)

---

### 6. A/B Testing Not Implemented
**Severity**: LOW  
**Status**: ❌ Not Started  
**Location**: Schema exists, no UI/logic

**What's Missing**:
- Variant creation UI
- Traffic splitting logic
- Results analysis dashboard
- Statistical significance calculation

**Effort**: 4 weeks (defer to Phase 2)

---

## 🔄 BOTTLENECKS

### Performance Bottlenecks

| Bottleneck | Location | Impact | Mitigation |
|------------|----------|--------|------------|
| Edge Function Cold Starts | All edge functions | 500ms-2s first request latency | Connection pooling, keep-alive |
| AI Generation Time | generate-content | 3-10s per request | Async queue, progress UI |
| Large Asset Downloads | assets table | Slow on mobile | CDN, image optimization |
| Analytics Query Speed | analytics_events | Slow with 100K+ rows | Daily aggregation, indexes |

### Development Bottlenecks

| Bottleneck | Impact | Mitigation |
|------------|--------|------------|
| Single contributor | Bus factor = 1 | Document everything, pair programming |
| Manual testing | Slow iteration | Expand E2E test coverage |
| No staging environment | Risk of production issues | Set up staging |

### Scalability Bottlenecks

| Bottleneck | Threshold | Mitigation |
|------------|-----------|------------|
| Supabase free tier | 500MB storage | Upgrade plan, prune old data |
| AI API costs | $0.02/generation | Rate limiting, caching |
| Realtime connections | 200 concurrent | Connection management |

---

## ❓ UNKNOWN UNKNOWNS

### Things That Could Break Unexpectedly

#### 1. **Social Platform API Changes**
**Probability**: HIGH  
**Impact**: CRITICAL

Meta, Twitter, and LinkedIn frequently change their APIs with short notice. Breaking changes could disable publishing overnight.

**Monitoring**:
- Subscribe to platform dev blogs
- Set up API health checks
- Build abstraction layer for quick swaps

#### 2. **AI Model Deprecation**
**Probability**: MEDIUM  
**Impact**: HIGH

OpenAI/Anthropic/Google retire models regularly. Current prompts may not work on new models.

**Monitoring**:
- Track model version in provenance
- Test prompts against new models before production
- Have fallback model configured

#### 3. **RLS Policy Edge Cases**
**Probability**: LOW  
**Impact**: CRITICAL

Complex JOINs or subqueries might bypass RLS in unexpected ways.

**Monitoring**:
- Quarterly security audit
- Negative tests for all sensitive queries
- Enable Supabase audit logging

#### 4. **Timezone Handling**
**Probability**: MEDIUM  
**Impact**: MEDIUM

Scheduling posts across timezones is complex. DST transitions could cause posts at wrong times.

**Monitoring**:
- Store all times in UTC
- Test around DST transitions
- Display user's timezone in UI

#### 5. **Third-Party Service Outages**
**Probability**: HIGH  
**Impact**: VARIABLE

Dependencies: Supabase, OpenAI, social platforms, CDN, Sentry, PostHog.

**Monitoring**:
- Status page for each service
- Fallback for non-critical services
- Circuit breakers for external calls

#### 6. **Cost Explosions**
**Probability**: MEDIUM  
**Impact**: CRITICAL

AI API abuse or viral growth could cause unexpected bills.

**Monitoring**:
- Daily cost alerts
- Per-user rate limits
- Hard budget caps with circuit breakers

---

## 🧩 DEPENDENCY RISKS

### External Dependencies

| Dependency | Risk Level | Mitigation |
|------------|------------|------------|
| Supabase | LOW | Managed service, good uptime |
| OpenAI API | MEDIUM | Multiple model fallbacks |
| Social Platform APIs | HIGH | Abstraction layer, manual export fallback |
| Resend (email) | LOW | Queue emails, retry logic |

### Package Dependencies

| Package | Risk | Notes |
|---------|------|-------|
| React 18 | LOW | Stable, LTS |
| Vite 5 | LOW | Stable, modern |
| @tanstack/react-query | LOW | Well-maintained |
| shadcn/ui | LOW | Copy-paste, self-maintained |
| date-fns | LOW | Stable |

---

## 📊 TECHNICAL DEBT HEAT MAP

```
┌─────────────────────────────────────────────────────────────┐
│                    TECHNICAL DEBT HEAT MAP                   │
├─────────────────┬─────────────────┬─────────────────────────┤
│                 │    LOW EFFORT   │     HIGH EFFORT         │
├─────────────────┼─────────────────┼─────────────────────────┤
│                 │                 │                         │
│  HIGH IMPACT    │  • Console logs │  • Social publishing    │
│                 │  • Error types  │  • Brand enforcement    │
│                 │                 │  • Translation          │
│                 │                 │                         │
├─────────────────┼─────────────────┼─────────────────────────┤
│                 │                 │                         │
│  LOW IMPACT     │  • Duplicate    │  • Video generation     │
│                 │    retry logic  │  • A/B testing          │
│                 │  • Large files  │  • Mobile app           │
│                 │                 │                         │
└─────────────────┴─────────────────┴─────────────────────────┘
```

---

## 🎯 PRIORITIZED ACTION PLAN

### This Sprint (1-2 weeks)
1. ✅ Remove console.log statements (1 hour)
2. ✅ Add transaction handling to CampaignBuilder (4 hours)
3. 🔄 Start social media OAuth integration

### Next Sprint (2-4 weeks)
4. Complete social media publishing for 2 platforms
5. Implement brand rule enforcement
6. Add cost monitoring and alerts

### Backlog
7. Translation workflow
8. Marketplace pack installation completion
9. Video/music generation
10. A/B testing framework

---

## 📝 NOTES FOR FUTURE AUDITS

### What to Check Next Time
- [ ] Load test results (simulated 1000 concurrent users)
- [ ] Social platform API integration stability
- [ ] AI cost trends over time
- [ ] User feedback themes from beta
- [ ] Database query performance with real data

### Metrics to Track
- Error rate (Sentry)
- P95 response times
- AI generation success rate
- User activation rate
- MRR (if monetized)

---

**Owner**: Technical Team  
**Review Cadence**: Monthly  
**Next Review**: February 21, 2026
