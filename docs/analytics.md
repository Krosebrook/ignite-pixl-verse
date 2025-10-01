# Analytics & Insights

## Overview

The FlashFusion Analytics system provides comprehensive tracking and reporting for user activity, content generation, campaign performance, and system health. It combines real-time event tracking with aggregated reporting to deliver actionable insights.

## Architecture

### Components

1. **Event Tracking Layer**
   - Client-side instrumentation via `observability.ts`
   - Server-side event ingestion via Edge Function
   - PostHog integration for product analytics

2. **Database Layer**
   - `analytics_events` table: Raw event storage
   - `daily_aggregates` table: Pre-computed summaries
   - Optimized indexes for query performance

3. **Visualization Layer**
   - React-based dashboard with Recharts
   - Real-time metrics and historical trends
   - Custom analytics components

## Tracked Events

### Content Creation Events

| Event Type | Category | Metadata |
|------------|----------|----------|
| `content_generated` | `content_creation` | `content_type`, `model`, `token_count`, `duration_ms` |
| `asset_saved` | `content_creation` | `asset_type`, `size_bytes`, `brand_kit_applied` |
| `template_applied` | `content_creation` | `template_id`, `template_type` |
| `brand_check_passed` | `content_creation` | `brand_kit_id`, `violations` |

### Campaign Events

| Event Type | Category | Metadata |
|------------|----------|----------|
| `campaign_drafted` | `campaigns` | `platforms[]`, `asset_count`, `duration_ms` |
| `campaign_created` | `campaigns` | `campaign_id`, `objective`, `platforms[]` |
| `campaign_published` | `campaigns` | `campaign_id`, `scheduled_count` |
| `campaign_analytics_viewed` | `campaigns` | `campaign_id`, `metrics` |

### Scheduling Events

| Event Type | Category | Metadata |
|------------|----------|----------|
| `schedule_published` | `scheduling` | `platform`, `scheduled_at`, `days_ahead` |
| `schedule_posted` | `scheduling` | `platform`, `success`, `posted_url` |
| `schedule_failed` | `scheduling` | `platform`, `error_type`, `retry_count` |

### Translation Events

| Event Type | Category | Metadata |
|------------|----------|----------|
| `translation_requested` | `translation` | `source_lang`, `target_lang`, `word_count` |
| `translation_approved` | `translation` | `translation_id`, `edit_count` |
| `translation_rejected` | `translation` | `translation_id`, `reason` |

### User Events

| Event Type | Category | Metadata |
|------------|----------|----------|
| `user_signed_up` | `auth` | `signup_method`, `referral_source` |
| `user_signed_in` | `auth` | `signin_method` |
| `org_created` | `organizations` | `org_name`, `member_count` |
| `member_invited` | `organizations` | `role`, `invite_method` |

## Database Schema

### analytics_events

```sql
CREATE TABLE public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  event_category TEXT NOT NULL,
  duration_ms INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_analytics_events_org_id ON analytics_events(org_id);
CREATE INDEX idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX idx_analytics_events_event_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_events_created_at ON analytics_events(created_at DESC);
```

### daily_aggregates

```sql
CREATE TABLE public.daily_aggregates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  date DATE NOT NULL,
  event_type TEXT NOT NULL,
  count INTEGER DEFAULT 0,
  total_duration_ms BIGINT DEFAULT 0,
  avg_duration_ms INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(org_id, date, event_type)
);
```

## Event Ingestion API

### Edge Function: `/events-ingest`

**Endpoint**: `POST /functions/v1/events-ingest`

**Authentication**: Required (Bearer token)

#### Single Event

```typescript
POST /functions/v1/events-ingest
Authorization: Bearer <token>

{
  "org_id": "uuid",
  "user_id": "uuid",
  "event_type": "content_generated",
  "event_category": "content_creation",
  "duration_ms": 1500,
  "metadata": {
    "content_type": "image",
    "model": "dall-e-3",
    "token_count": 450
  }
}
```

#### Batch Events

```typescript
POST /functions/v1/events-ingest

{
  "events": [
    {
      "org_id": "uuid",
      "user_id": "uuid",
      "event_type": "campaign_drafted",
      "event_category": "campaigns",
      "duration_ms": 3200,
      "metadata": { "platforms": ["instagram", "twitter"] }
    },
    // ... more events
  ]
}
```

**Response**:
```json
{
  "success": true,
  "inserted": 25,
  "skipped": 2
}
```

## Client-Side Tracking

### Using the Analytics Helper

```typescript
import { Analytics } from '@/lib/observability';

// Track content generation
Analytics.contentGenerated(
  'image',           // content type
  'dall-e-3',       // model
  1500,             // duration in ms
  orgId,            // organization ID
  userId            // user ID
);

// Track campaign creation
Analytics.campaignCreated(
  campaignId,
  ['instagram', 'twitter'],
  orgId,
  userId
);

// Track scheduling
Analytics.contentScheduled(
  scheduleId,
  'instagram',
  scheduledTime,
  orgId,
  userId
);
```

## Dashboard Views

### Main Analytics Page

Located at `/analytics`, the dashboard provides:

1. **Key Metrics Cards**
   - Total events
   - Active users
   - Average duration
   - Event categories

2. **Time Series Chart**
   - Daily event counts
   - Trend visualization
   - Configurable date ranges (7/30/90 days)

3. **Event Distribution**
   - Bar chart by event type
   - Pie chart by category
   - Top categories breakdown

4. **Performance Insights**
   - Average event duration
   - Growth rate analysis
   - User engagement metrics

### Custom Reports

Create custom reports by querying `analytics_events`:

```typescript
const { data } = await supabase
  .from('analytics_events')
  .select('*')
  .eq('org_id', orgId)
  .gte('created_at', startDate)
  .lte('created_at', endDate)
  .order('created_at', { ascending: false });
```

## Data Aggregation

### Daily Aggregation Function

Run nightly to pre-compute summaries:

```sql
SELECT public.aggregate_daily_events();
```

Set up a cron job or scheduled function to run this daily at 00:00 UTC.

### Event Summary Function

Get summarized metrics:

```typescript
const { data } = await supabase
  .rpc('get_event_summary', {
    p_org_id: orgId,
    p_start_date: '2025-01-01',
    p_end_date: '2025-01-31'
  });
```

## Privacy & Compliance

### Data Retention

- Raw events: 90 days
- Daily aggregates: 2 years
- Personally identifiable information (PII): Stored in separate tables with stricter RLS

### GDPR Compliance

- User data deletion: Cascade delete all events on user deletion
- Data export: Users can request full event export via support
- Anonymization: Option to anonymize user_id in events older than 30 days

### Row-Level Security (RLS)

All analytics tables have RLS enabled:
- Users can only view events from organizations they're members of
- Events can only be inserted by authenticated organization members
- No cross-org data leakage

## Performance Considerations

### Query Optimization

1. **Use Indexes**: All key columns (org_id, user_id, event_type, created_at) are indexed
2. **Date Filters**: Always include date range filters to limit scan size
3. **Aggregates**: Use `daily_aggregates` for historical reporting instead of raw events

### Batch Processing

For high-volume events:
- Batch events in groups of 50-100
- Use the batch endpoint for better throughput
- Implement client-side queuing if needed

### Caching

Dashboard queries can be cached:
```typescript
const { data } = await supabase
  .from('daily_aggregates')
  .select('*')
  .eq('org_id', orgId)
  .gte('date', startDate)
  .lte('date', endDate);
```

Cache key: `analytics:${orgId}:${startDate}:${endDate}`

## Monitoring & Alerts

### Key Metrics to Monitor

1. **Event Ingestion Rate**
   - Normal: 100-500 events/min
   - Alert threshold: >1000 events/min

2. **Failed Events**
   - Alert on >5% failure rate

3. **Query Performance**
   - P95 latency <500ms
   - Alert on >2s queries

4. **Storage Growth**
   - Monitor daily increase
   - Plan for archival when >10GB

## Integration with External Tools

### PostHog

Events are automatically forwarded to PostHog:

```typescript
posthog.capture('content_generated', {
  content_type: 'image',
  model: 'dall-e-3',
  org_id: orgId,
});
```

### Sentry

Track errors with context:

```typescript
Sentry.captureException(error, {
  tags: { event_type: 'campaign_created' },
  extra: { org_id: orgId, metadata },
});
```

## Best Practices

1. **Event Naming**: Use snake_case, be descriptive
2. **Metadata**: Keep it flat, avoid deep nesting
3. **Duration**: Track all user-facing operations
4. **Categories**: Use consistent categories across events
5. **User Context**: Always include org_id and user_id
6. **Error Handling**: Log failed tracking attempts, don't block UX

## Testing

### Unit Tests

```typescript
import { trackAnalyticsEvent } from '@/lib/observability';

test('tracks event with required fields', async () => {
  await trackAnalyticsEvent(
    'test_event',
    'test_category',
    'org-123',
    'user-456'
  );
  
  // Assert event was stored
});
```

### Integration Tests

```typescript
test('batch event ingestion', async () => {
  const response = await fetch('/functions/v1/events-ingest', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      events: [/* ... */]
    }),
  });
  
  expect(response.ok).toBe(true);
});
```

## Troubleshooting

### Common Issues

1. **Events not appearing**
   - Check RLS policies
   - Verify org membership
   - Check edge function logs

2. **Slow dashboard loading**
   - Use daily_aggregates for historical data
   - Limit date range
   - Add caching layer

3. **Missing metadata**
   - Validate event structure
   - Check JSONB encoding
   - Review edge function validation

## Future Enhancements

- [ ] Real-time event streaming
- [ ] Custom dashboard builder
- [ ] Advanced segmentation
- [ ] Predictive analytics
- [ ] Multi-tenancy reporting
- [ ] Export to data warehouse
- [ ] ML-powered insights
