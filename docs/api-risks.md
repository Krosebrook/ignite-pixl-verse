# API & Database Risks — Unknown Unknowns Radar

Last updated: 2025-10-01

## Overview
This document identifies 5 critical risk areas that could impact API reliability, data integrity, and system performance despite current safeguards.

---

## 1. Idempotency Key Collision & Staleness

**Risk:**  
Idempotency keys prevent duplicate operations but can cause issues:
- **Collision risk**: UUIDs are statistically unique but not guaranteed. Two clients might generate the same key.
- **Stale cache**: Current implementation returns cached response for 24h. If user retries a failed operation with same key, they get stale data.
- **No expiration cleanup**: Old idempotency records accumulate indefinitely in metadata/result columns.

**Impact:**
- Users receive outdated responses thinking operation succeeded
- Database bloat from never-cleaned idempotency data
- Race conditions if two requests with same key arrive simultaneously

**Mitigation:**
```sql
-- Add TTL-based cleanup (run daily via cron)
DELETE FROM assets 
WHERE created_at < NOW() - INTERVAL '7 days'
  AND metadata->>'idempotency_key' IS NOT NULL;

-- Or use Redis for idempotency with automatic expiration
-- SET idempotency:{key} {response_json} EX 86400
```

**Additional safeguards:**
- Enforce idempotency key format validation (UUID v4 only)
- Add composite unique constraint on `(org_id, idempotency_key)` for stronger guarantees
- Return `X-Idempotent-Replay: true` header on cached responses
- Implement background job to prune stale keys after 7 days

---

## 2. Retry Exhaustion Without Dead Letter Queue

**Risk:**  
Schedules table has `retries` capped at 5, but:
- **No DLQ**: Failed posts after 5 retries just stay in `failed` status forever
- **No exponential backoff**: Retries happen at fixed intervals, worsening platform rate limits
- **No alert system**: Admins don't know when posts permanently fail

**Impact:**
- Users lose scheduled content silently
- Platform API bans from aggressive retries
- No audit trail for why posts failed permanently

**Mitigation:**
```sql
-- Create dead letter queue table
CREATE TABLE schedule_dlq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES schedules(id),
  final_error JSONB,
  moved_at TIMESTAMPTZ DEFAULT NOW()
);

-- Move failed schedules to DLQ after max retries
CREATE OR REPLACE FUNCTION archive_failed_schedules()
RETURNS void AS $$
BEGIN
  INSERT INTO schedule_dlq (schedule_id, final_error)
  SELECT id, result 
  FROM schedules 
  WHERE status = 'failed' AND retries >= 5;
  
  DELETE FROM schedules 
  WHERE status = 'failed' AND retries >= 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
```

**Additional safeguards:**
- Implement exponential backoff: `delay = base_delay * (2 ^ retry_count)`
- Add webhook notifications for DLQ entries
- Create dashboard view for failed schedules requiring manual review
- Store platform-specific error codes for better debugging

---

## 3. Provenance Data Manipulation

**Risk:**  
Provenance is stored as JSONB with no schema validation:
- **Forgery**: Users could manually edit `provenance.model` to claim content from premium model
- **Missing fields**: No enforcement that `prompt_hash`, `timestamp`, `provider` are present
- **Hash collisions**: SHA-256 prompt hashes could theoretically collide (extremely rare but possible)

**Impact:**
- Legal liability if provenance is falsified for licensing disputes
- Can't trust audit logs for compliance (GDPR, copyright)
- Users bypass usage quotas by spoofing model names

**Mitigation:**
```sql
-- Add provenance validation function
CREATE OR REPLACE FUNCTION validate_provenance(prov JSONB)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    prov ? 'model' AND
    prov ? 'provider' AND
    prov ? 'prompt_hash' AND
    prov ? 'timestamp' AND
    prov->>'model' IN ('google/gemini-2.5-flash', 'google/gemini-2.5-pro', 'openai/gpt-5') AND
    prov->>'provider' = 'lovable-ai' AND
    length(prov->>'prompt_hash') = 71 -- sha256: prefix + 64 hex chars
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = '';

-- Add constraint
ALTER TABLE assets 
  ADD CONSTRAINT valid_provenance 
  CHECK (provenance IS NULL OR validate_provenance(provenance));
```

**Additional safeguards:**
- Sign provenance with HMAC using server secret: `hmac_sha256(secret, provenance_json)`
- Store signature in `provenance.signature` field
- Verify signature before trusting provenance data
- Add read-only provenance field via trigger (prevent updates after creation)

---

## 4. Campaign Metrics Aggregation Lag

**Risk:**  
Campaigns table has `metrics` JSONB field for performance data, but:
- **No real-time updates**: Metrics likely aggregated batch-style, causing stale dashboards
- **Unbounded growth**: Metrics JSON could grow infinitely as campaign runs
- **No time-series**: Can't query "metrics at timestamp X" for historical analysis

**Impact:**
- Dashboards show 10-minute-old data, hurting real-time decisions
- Campaign metrics bloat database, slow queries
- Can't do time-series analysis ("What was CTR on day 3 vs day 10?")

**Mitigation:**
```sql
-- Create dedicated metrics table with time-series partitioning
CREATE TABLE campaign_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  conversions BIGINT DEFAULT 0,
  spend_cents BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (metric_date);

-- Create monthly partitions
CREATE TABLE campaign_metrics_2025_10 PARTITION OF campaign_metrics
  FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');

-- Index for fast aggregation
CREATE INDEX idx_campaign_metrics_campaign_date 
  ON campaign_metrics(campaign_id, metric_date DESC);
```

**Additional safeguards:**
- Use materialized views refreshed every 5 minutes for dashboard queries
- Add trigger to populate `campaigns.metrics` with latest summary on insert to `campaign_metrics`
- Implement metric streaming via Supabase Realtime for live updates
- Archive old metrics to cold storage after 90 days

---

## 5. Org-Scoped RLS Policy Bypass via Joins

**Risk:**  
Current RLS policies check `org_id` membership, but complex queries can bypass:
- **Join-based leaks**: If user joins `assets` to `campaigns` without proper RLS on both, they might see other orgs' data
- **Function security definer**: Stored procedures with `SECURITY DEFINER` ignore caller's RLS
- **Foreign key traversal**: Following `campaign_id` foreign key from schedules might expose campaign name even if user can't query campaigns directly

**Impact:**
- Cross-org data leakage violates multi-tenancy guarantees
- GDPR violations if users see others' personal data
- Competitors could spy on campaign strategies

**Mitigation:**
```sql
-- Add explicit org_id check in all functions
CREATE OR REPLACE FUNCTION get_campaign_stats(campaign_uuid UUID)
RETURNS JSONB AS $$
DECLARE
  user_org UUID;
  campaign_org UUID;
BEGIN
  -- Get user's org
  SELECT org_id INTO user_org 
  FROM members 
  WHERE user_id = auth.uid() 
  LIMIT 1;
  
  -- Get campaign's org
  SELECT org_id INTO campaign_org 
  FROM campaigns 
  WHERE id = campaign_uuid;
  
  -- Verify match
  IF user_org IS NULL OR user_org != campaign_org THEN
    RAISE EXCEPTION 'Unauthorized access to campaign';
  END IF;
  
  -- Safe to proceed...
  RETURN jsonb_build_object('impressions', 1000, 'clicks', 50);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
```

**Additional safeguards:**
- Run automated RLS tests with multiple org accounts
- Add `org_id` to every table (even junction tables like `campaign_assets`)
- Use `SECURITY INVOKER` by default for functions (avoids privilege escalation)
- Audit all queries in functions for missing `WHERE org_id = ...` clauses
- Enable Postgres row-level audit logging for sensitive tables

---

## Testing Strategy

### Negative Tests (Included)
```typescript
// Test 1: Cross-org asset access fails
const { error } = await supabase
  .from('assets')
  .select('*')
  .eq('org_id', 'other-org-uuid'); // Should return empty or error

expect(error || data.length === 0).toBe(true);

// Test 2: Idempotency key reuse returns 200 (not 201)
const key = crypto.randomUUID();
const resp1 = await fetch('/functions/v1/schedule', { 
  headers: { 'idempotency-key': key },
  body: JSON.stringify({...})
});
expect(resp1.status).toBe(201);

const resp2 = await fetch('/functions/v1/schedule', { 
  headers: { 'idempotency-key': key },
  body: JSON.stringify({...})
});
expect(resp2.status).toBe(200);
expect(await resp2.json()).toEqual(await resp1.json());

// Test 3: Schedule retry limit enforced
const schedule = { retries: 5, status: 'failed' };
const { error } = await supabase
  .from('schedules')
  .update({ retries: 6 })
  .eq('id', schedule.id);
expect(error?.code).toBe('23514'); // CHECK constraint violation

// Test 4: Invalid provenance rejected
const { error } = await supabase
  .from('assets')
  .insert({ 
    provenance: { model: 'fake-model', provider: 'hacker' }
  });
expect(error).toBeTruthy();

// Test 5: Rate limiting respected
for (let i = 0; i < 100; i++) {
  const resp = await fetch('/functions/v1/generate-content', {...});
  if (resp.status === 429) {
    expect(i).toBeGreaterThan(10); // Should hit limit before 100 requests
    break;
  }
}
```

---

## Action Items

### Immediate (P0)
- [ ] Add composite unique constraint on `(org_id, idempotency_key)` in assets/campaigns/schedules
- [ ] Implement provenance signature verification
- [ ] Add `X-Idempotent-Replay` header to cached responses

### Short-term (P1)
- [ ] Create `schedule_dlq` table and archival function
- [ ] Migrate to Redis for idempotency with TTL
- [ ] Add exponential backoff for schedule retries
- [ ] Create `campaign_metrics` partitioned table

### Long-term (P2)
- [ ] Implement webhook notifications for DLQ entries
- [ ] Add materialized views for real-time metrics
- [ ] Run quarterly RLS policy audit with penetration testing
- [ ] Add automated negative test suite to CI/CD

---

## References
- [Supabase RLS Best Practices](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Constraint Triggers](https://www.postgresql.org/docs/current/sql-createtrigger.html)
- [Idempotency Keys (Stripe)](https://stripe.com/docs/api/idempotent_requests)
- [Redis TTL for Caching](https://redis.io/commands/expire/)
