# ADR-001: Database Choice - PostgreSQL (Supabase)

**Status**: ✅ Accepted  
**Date**: 2025-10-01  
**Deciders**: Tech Lead, Backend Team  
**Technical Story**: FlashFusion MVP Database Selection

---

## Context and Problem Statement

FlashFusion Creative Mega App requires a database to store multi-tenant data (orgs, members, assets, campaigns, schedules). The system must:
1. Enforce strict org-scoped data isolation (security-critical)
2. Scale to 10K+ organizations with 100K+ assets
3. Integrate seamlessly with Lovable Cloud deployment pipeline
4. Minimize operational overhead (no dedicated DBA in team)
5. Support complex queries (joins across orgs, members, assets)

**Key Constraint**: Must ship MVP within 4 weeks with <$200/month infra cost.

---

## Decision Drivers

* **Security**: Multi-tenancy requires bulletproof RLS (Row-Level Security)
* **Developer Experience**: Fast local setup, auto-generated types, minimal boilerplate
* **Cost**: Stay within startup budget ($0-200/month for first 1K users)
* **Ecosystem**: Must integrate with Lovable Cloud (no custom infra)
* **Query Power**: Need joins (assets + campaigns), aggregations (dashboard metrics)
* **Compliance**: GDPR-ready (data residency, right-to-delete)

---

## Considered Options

1. **PostgreSQL (Supabase)** via Lovable Cloud
2. **MongoDB Atlas** (NoSQL, managed)
3. **Firebase Firestore** (NoSQL, real-time)
4. **Self-Hosted MySQL** on DigitalOcean
5. **SQLite** with Turso (edge database)

---

## Decision Outcome

**Chosen**: **PostgreSQL (Supabase)** via Lovable Cloud

**Justification**:
- Native RLS support (perfect for multi-tenancy)
- Managed by Lovable Cloud (zero ops, auto-migrations)
- Excellent TypeScript DX (auto-generated types from schema)
- Free tier sufficient for MVP (500MB DB, 1GB storage)
- Rich ecosystem (PostgREST API, Realtime, Auth)

**Positive Consequences**:
* ✅ Ship faster: No DB setup, migrations auto-deployed
* ✅ Security by default: RLS enforced at DB layer (can't bypass)
* ✅ Type safety: `supabase gen types` generates TypeScript interfaces
* ✅ Free tier: $0 cost until 500MB DB / 2GB bandwidth

**Negative Consequences**:
* ❌ Vendor lock-in: Migrating off Supabase requires significant refactor
* ❌ Scaling limits: PostgreSQL single-master bottleneck at ~10K RPS
* ❌ Cold start: Edge functions have 100-500ms cold start latency
* ❌ Schema rigidity: Changing columns requires migrations (downtime risk)

---

## Pros and Cons of the Options

### Option 1: PostgreSQL (Supabase) ✅ CHOSEN

**Pros**:
* ✅ **RLS Built-In**: Policies enforce org_id scoping at DB layer
  ```sql
  CREATE POLICY "users_own_assets" ON assets
  FOR ALL USING (org_id IN (SELECT org_id FROM members WHERE user_id = auth.uid()));
  ```
* ✅ **Managed Service**: Lovable Cloud handles backups, scaling, monitoring
* ✅ **TypeScript Integration**: Auto-generated types from schema
  ```typescript
  const { data } = await supabase.from('assets').select('*'); // Fully typed!
  ```
* ✅ **Rich Query Support**: Joins, CTEs, aggregations, full-text search
* ✅ **ACID Guarantees**: No eventual consistency bugs
* ✅ **Realtime Subscriptions**: WebSocket support for live updates

**Cons**:
* ❌ **Vertical Scaling Limits**: Single master can handle ~10K concurrent connections (need read replicas after)
* ❌ **Migration Complexity**: Schema changes require downtime or online DDL tricks
* ❌ **Vendor Lock-In**: Supabase-specific features (RLS, Auth) hard to port
* ❌ **Cost at Scale**: Pro tier ($25/mo) needed after 500MB DB or 2GB bandwidth

**Benchmarks** (from Supabase docs):
- Read latency: p95 <50ms (within same region)
- Write latency: p95 <100ms (with RLS)
- Max connections: 100 (free tier), 500 (pro tier)

---

### Option 2: MongoDB Atlas

**Pros**:
* ✅ **Flexible Schema**: Easy to evolve data models (no migrations)
* ✅ **Horizontal Scaling**: Sharding built-in (scales to millions of docs)
* ✅ **Aggregation Pipeline**: Powerful data transformations

**Cons**:
* ❌ **No Native RLS**: Must implement in app layer (error-prone)
  ```javascript
  // Manual filtering everywhere (easy to forget!)
  const assets = await db.assets.find({ org_id: userOrgId });
  ```
* ❌ **Eventual Consistency**: Harder to reason about data states
* ❌ **No Joins**: Must do multiple queries or embed everything (denormalization)
* ❌ **Higher Cost**: $57/month for M10 cluster (vs $0 for Supabase free tier)

**Why Rejected**: Lack of RLS is a deal-breaker for multi-tenancy. One missed filter = data breach.

---

### Option 3: Firebase Firestore

**Pros**:
* ✅ **Real-Time by Default**: Live updates without WebSockets setup
* ✅ **Great DX**: Simple API (`db.collection('assets').where(...)`)
* ✅ **Generous Free Tier**: 1GB storage, 50K reads/day

**Cons**:
* ❌ **Limited Queries**: No joins, complex filters require denormalization
* ❌ **Security Rules**: Custom language (hard to audit, easy to misconfigure)
  ```javascript
  // Easy to get wrong!
  match /assets/{assetId} {
    allow read: if request.auth.uid == resource.data.user_id;
  }
  ```
* ❌ **Cost Spikes**: Pay per read/write (can explode with N+1 queries)
* ❌ **No Complex Aggregations**: Must use Cloud Functions (slow)

**Why Rejected**: Query limitations make dashboard metrics painful. Security rules less battle-tested than SQL RLS.

---

### Option 4: Self-Hosted MySQL

**Pros**:
* ✅ **Full Control**: Can tune every knob (buffer sizes, replication, etc.)
* ✅ **No Vendor Lock-In**: Easy to migrate providers (AWS, GCP, DO)
* ✅ **Cost Efficient**: $12/month for 2GB DigitalOcean droplet

**Cons**:
* ❌ **Ops Overhead**: Backups, monitoring, security patches = 10+ hours/week
* ❌ **No RLS**: Must roll own (views + app-level checks)
* ❌ **Slower Iteration**: Manual schema migrations, no auto-types
* ❌ **Single Point of Failure**: Droplet goes down = app is down

**Why Rejected**: Team has no DBA expertise. Ops burden too high for MVP stage.

---

### Option 5: SQLite + Turso (Edge Database)

**Pros**:
* ✅ **Ultra-Low Latency**: SQLite at the edge (single-digit ms reads)
* ✅ **Cheap**: $0 for dev, ~$29/month for prod
* ✅ **Simple**: No connection pooling, no network overhead

**Cons**:
* ❌ **Immature Ecosystem**: Turso launched 2023, fewer resources
* ❌ **No RLS**: Must implement in app layer
* ❌ **Limited Concurrency**: SQLite = single-writer (bottleneck for writes)
* ❌ **Unknown Scaling**: Unproven at 10K+ orgs scale

**Why Rejected**: Too bleeding-edge for production. Revisit if we need extreme latency (<10ms reads).

---

## Validation

**Success Metrics** (6-month checkpoints):

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| DB Latency (p95) | ≤100ms | TBD | ⏳ |
| RLS Breaches | 0 | 0 | ✅ |
| Max Orgs Supported | 1,000 | 0 | ⏳ |
| Developer Setup Time | ≤10 min | 5 min | ✅ |
| Monthly DB Cost | ≤$200 | $0 (free tier) | ✅ |

**Failure Scenarios** (triggers re-evaluation):
* ❌ DB latency >500ms for p95 queries (need read replicas or caching)
* ❌ Cost >$500/month before 5K users (need to optimize or switch)
* ❌ RLS bypass discovered (catastrophic, requires incident review)
* ❌ Migration downtime >1 hour (need zero-downtime migration strategy)

**Pivot Plan**:
If PostgreSQL becomes bottleneck (>10K RPS sustained):
1. Add read replicas (Supabase Pro tier: ~$100/month)
2. Implement Redis cache for hot queries (dashboard metrics)
3. Shard by `org_id` (requires custom proxy, complex)
4. Last resort: Migrate to Vitess or CockroachDB (distributed SQL)

---

## Links

* [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
* [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)
* [MongoDB vs PostgreSQL (2024 Benchmark)](https://www.mongodb.com/compare/mongodb-postgresql)
* [Firebase Security Rules Best Practices](https://firebase.google.com/docs/rules/best-practices)
* [ADR Template](./ADR-template.md)

---

## Notes

**Why Not DynamoDB?**
Considered AWS DynamoDB but rejected due to:
- Complex partition key design (org_id vs user_id tradeoffs)
- High learning curve for team unfamiliar with NoSQL
- Cost unpredictability (pay per read/write unit)
- Weak ACID guarantees (eventual consistency by default)

**Future Considerations**:
- If we need global distribution (GDPR data residency), may add Aurora Global Database or CockroachDB
- If real-time collaboration becomes core feature, evaluate Yjs + Supabase Realtime
- If query complexity grows, consider adding Elasticsearch for full-text search

**Team Feedback** (from sprint retro):
> "Supabase has been a dream. Auto-generated types caught 5+ bugs before they hit prod. RLS gives me confidence we won't leak data." — Backend Dev  
> "Migration workflow is smooth. `supabase db push` just works. Only hiccup was forgetting to enable RLS on a new table (caught in code review)." — Eng Lead

---

**Last Updated**: 2025-10-01  
**Next Review**: 2026-01-01 (or when we hit 5K orgs)
