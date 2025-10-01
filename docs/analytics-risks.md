# Analytics System — Unknown Unknowns Radar

## 1. Event Data Accuracy & Integrity

### Risk Description
Event tracking may suffer from client-side failures, network issues, or timing discrepancies, leading to incomplete or inaccurate analytics data.

### Potential Impact
- Missing events due to client crashes or network failures
- Duplicate events from retry logic
- Timing skew between client and server
- Lost context when users navigate away before events are flushed

### Indicators
- Sudden drops in event counts
- Spikes in specific event types
- Large discrepancies between PostHog and database counts
- High variance in duration metrics

### Mitigations
1. **Client-Side Buffering**
   ```typescript
   // Queue events locally and flush periodically
   const eventQueue = [];
   const flushEvents = async () => {
     if (eventQueue.length > 0) {
       await fetch('/functions/v1/events-ingest', {
         method: 'POST',
         body: JSON.stringify({ events: eventQueue }),
       });
       eventQueue.length = 0;
     }
   };
   setInterval(flushEvents, 5000);
   ```

2. **Idempotency Keys**
   - Add unique event IDs to prevent duplicates
   - Implement deduplication in edge function

3. **Heartbeat Events**
   - Periodic "session_active" events to validate tracking
   - Compare against expected baseline

4. **Data Validation**
   - Server-side schema validation
   - Reject malformed events
   - Log validation failures

### Monitoring
- Alert on >10% deviation from daily baseline
- Track event/user ratio for anomalies
- Compare PostHog vs database event counts weekly

---

## 2. Privacy & Data Leakage

### Risk Description
Analytics system may inadvertently capture or expose sensitive user data (PII, API keys, secrets) in event metadata or through improper RLS policies.

### Potential Impact
- GDPR/CCPA compliance violations
- Leaked credentials in event metadata
- Cross-org data exposure via misconfigured RLS
- User tracking without proper consent

### Indicators
- Security scan flags PII in analytics_events
- Users from Org A seeing Org B's events
- API keys or tokens in event metadata
- Missing consent records

### Mitigations
1. **Metadata Sanitization**
   ```typescript
   const sanitizeMetadata = (meta: Record<string, any>) => {
     const sensitiveKeys = ['password', 'token', 'api_key', 'secret', 'ssn', 'email'];
     return Object.entries(meta).reduce((acc, [key, value]) => {
       if (!sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
         acc[key] = value;
       }
       return acc;
     }, {} as Record<string, any>);
   };
   ```

2. **RLS Policy Audits**
   - Weekly automated RLS tests
   - Negative tests for cross-org access
   - User deletion cascade tests

3. **Consent Management**
   - Track user consent in database
   - Gate analytics tracking on consent
   - Provide opt-out mechanism

4. **Data Minimization**
   - Only capture necessary metadata
   - Avoid capturing full request/response bodies
   - Hash user IDs in long-term aggregates

### Monitoring
- Run weekly PII scan on analytics_events
- Quarterly RLS policy review
- Track consent opt-out rate

---

## 3. Data Volume & Storage Costs

### Risk Description
As usage grows, analytics data volume may exceed budget or performance limits, especially for high-frequency events or large metadata payloads.

### Potential Impact
- Database storage costs spiral
- Query performance degrades
- Edge function quota exhaustion
- Increased latency on dashboard loads

### Indicators
- analytics_events table >10GB
- Query times >2s on dashboard
- Edge function timeout errors
- Daily data growth >100MB

### Mitigations
1. **Data Retention Policy**
   ```sql
   -- Archive events older than 90 days
   CREATE OR REPLACE FUNCTION archive_old_events()
   RETURNS void AS $$
   BEGIN
     DELETE FROM analytics_events
     WHERE created_at < NOW() - INTERVAL '90 days';
   END;
   $$ LANGUAGE plpgsql;
   ```

2. **Sampling Strategy**
   - Sample high-frequency events (e.g., track 1 in 10 page views)
   - Full capture for critical events (purchase, signup)

3. **Metadata Size Limits**
   ```typescript
   const MAX_METADATA_SIZE = 5000; // 5KB
   if (JSON.stringify(metadata).length > MAX_METADATA_SIZE) {
     metadata = { ...metadata, _truncated: true };
   }
   ```

4. **Aggregation-First Architecture**
   - Compute daily_aggregates in real-time for common queries
   - Serve dashboards from aggregates, not raw events
   - Archive raw events to cold storage (S3)

### Monitoring
- Track table size daily
- Alert on >10% daily growth
- Monitor edge function execution time
- Track average metadata size

---

## 4. Real-Time vs Batch Trade-offs

### Risk Description
Current system mixes real-time event insertion with batch aggregation, creating potential consistency issues and performance bottlenecks.

### Potential Impact
- Dashboard shows stale data (up to 24h old)
- Race conditions between real-time inserts and aggregation
- Edge function cold starts delay event ingestion
- Aggregation function times out on large datasets

### Indicators
- Daily aggregates don't match raw event counts
- Dashboard shows yesterday's data at 3pm
- Edge function timeout errors >5%
- Aggregation job duration >5 minutes

### Mitigations
1. **Hybrid Approach**
   ```typescript
   // Serve last 7 days from raw events
   // Serve older data from aggregates
   const recentData = await supabase
     .from('analytics_events')
     .select('*')
     .gte('created_at', sevenDaysAgo);
   
   const historicalData = await supabase
     .from('daily_aggregates')
     .select('*')
     .lt('date', sevenDaysAgo);
   ```

2. **Streaming Aggregation**
   - Use Postgres triggers to update aggregates in real-time
   - Maintain running totals per day/org/event_type

3. **Materialized Views**
   ```sql
   CREATE MATERIALIZED VIEW recent_event_summary AS
   SELECT 
     org_id,
     event_type,
     COUNT(*) as count,
     AVG(duration_ms) as avg_duration
   FROM analytics_events
   WHERE created_at >= NOW() - INTERVAL '7 days'
   GROUP BY org_id, event_type;
   
   -- Refresh every 15 minutes
   ```

4. **Edge Caching**
   - Cache dashboard queries at edge (Cloudflare, Vercel)
   - 5-minute TTL for non-critical metrics

### Monitoring
- Track aggregation job duration
- Compare real-time vs aggregate counts
- Measure dashboard load time
- Alert on data freshness >1 hour

---

## 5. Event Schema Evolution

### Risk Description
As product evolves, event structure changes, but existing queries and dashboards break or show incorrect data.

### Potential Impact
- Dashboards show null values for new fields
- Queries fail on renamed/removed fields
- Historical data incompatible with new schema
- Migration scripts miss edge cases

### Indicators
- Dashboard errors after deployment
- Null values in new event metadata fields
- Queries returning empty results
- User reports of missing metrics

### Mitigations
1. **Versioned Events**
   ```typescript
   interface AnalyticsEvent {
     schema_version: string; // "v1", "v2"
     event_type: string;
     // ...
   }
   
   // Handle different versions in queries
   const parseEvent = (event: AnalyticsEvent) => {
     switch (event.schema_version) {
       case 'v1': return parseV1(event);
       case 'v2': return parseV2(event);
       default: return parseLatest(event);
     }
   };
   ```

2. **Additive-Only Changes**
   - Never remove fields, only deprecate
   - Add new fields with defaults
   - Document all schema changes

3. **Migration Scripts**
   ```sql
   -- Backfill new field
   UPDATE analytics_events
   SET metadata = jsonb_set(
     metadata,
     '{new_field}',
     '"default_value"'
   )
   WHERE created_at < '2025-01-01'
     AND metadata->>'new_field' IS NULL;
   ```

4. **Schema Registry**
   - Maintain schema changelog in docs
   - Require schema review for event changes
   - Automated schema validation tests

### Monitoring
- Track event schema versions
- Alert on deprecated schema usage >10%
- Validate all events against current schema
- Run schema compatibility tests in CI

---

## Summary Table

| Risk | Likelihood | Impact | Detection Difficulty | Mitigation Priority |
|------|-----------|--------|---------------------|---------------------|
| Event Data Accuracy | High | Medium | Medium | High |
| Privacy & Data Leakage | Medium | Critical | High | Critical |
| Data Volume & Storage | High | High | Low | High |
| Real-Time vs Batch | Medium | Medium | Medium | Medium |
| Event Schema Evolution | Medium | High | Low | High |

## Action Items

### Immediate (Next Sprint)
- [ ] Implement metadata sanitization
- [ ] Add data retention policy
- [ ] Set up PII scanning
- [ ] Create RLS negative tests

### Short-Term (Next Quarter)
- [ ] Implement event buffering & retry
- [ ] Set up materialized views
- [ ] Create schema versioning system
- [ ] Add consent management

### Long-Term (6-12 Months)
- [ ] Evaluate streaming aggregation (Kafka/Flink)
- [ ] Implement cold storage archival (S3)
- [ ] Build custom query DSL for flexible reporting
- [ ] Add ML-powered anomaly detection
