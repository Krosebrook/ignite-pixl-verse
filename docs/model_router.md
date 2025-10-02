# AI Model Router & Cost Guard

## Overview

The Model Router intelligently selects AI models based on task requirements, cost constraints, and quality thresholds. It enforces per-org token limits and provides usage telemetry.

## Architecture

```
┌──────────────┐      ┌──────────────┐      ┌─────────────┐
│   Client     │─────▶│  Cost Guard  │─────▶│   Router    │
│  (estimate)  │      │  (check)     │      │  (policy)   │
└──────────────┘      └──────────────┘      └─────────────┘
                             │                      │
                             ▼                      ▼
                      ┌──────────────┐      ┌─────────────┐
                      │ usage_credits│      │  Provider   │
                      │   (atomic)   │      │  (GPT/etc)  │
                      └──────────────┘      └─────────────┘
```

## Capability Matrix

| Task         | Model               | Cost/1K | Max Tokens | Latency | Quality |
|--------------|---------------------|---------|------------|---------|---------|
| text         | gpt-4o-mini         | $0.15   | 16K        | Low     | High    |
| text         | claude-3-haiku      | $0.25   | 200K       | Low     | High    |
| text         | gemini-pro          | $0.35   | 1M         | Med     | High    |
| image        | dall-e-3            | $0.04   | N/A        | High    | High    |
| image        | stable-diffusion-xl | $0.02   | N/A        | Med     | Med     |
| translate    | gpt-3.5-turbo       | $0.50   | 4K         | Low     | Med     |
| summarize    | claude-instant      | $0.16   | 100K       | Low     | High    |

## Routing Policy

### Selection Logic
1. **Task Match**: Filter models that support the task type
2. **Quality Threshold**: Remove models below min quality tier
3. **Cost Sort**: Sort by cost per 1K tokens (ascending)
4. **Latency Filter**: If real-time, prefer low-latency models
5. **Fallback**: On failure, try next cheapest model

### Policy Configuration (JSON)
```json
{
  "default": {
    "min_quality": "high",
    "prefer_latency": false,
    "max_cost_per_1k": 0.50
  },
  "overrides": {
    "text": {
      "model": "gpt-4o-mini",
      "fallback": ["claude-3-haiku", "gemini-pro"]
    },
    "image": {
      "model": "stable-diffusion-xl",
      "fallback": ["dall-e-3"]
    }
  }
}
```

## Cost Guard

### Usage Credits Schema

```sql
CREATE TABLE usage_credits (
  org_id UUID PRIMARY KEY,
  plan TEXT CHECK (plan IN ('STARTER','PRO','SCALE')),
  used_tokens BIGINT DEFAULT 0,
  month_start TIMESTAMPTZ DEFAULT date_trunc('month', now()),
  hard_limit_tokens BIGINT NOT NULL DEFAULT 1000000
);
```

### Plan Limits

| Plan    | Tokens/Month | Cost/1K Over Limit | Hard Limit |
|---------|--------------|---------------------|------------|
| STARTER | 1M           | $0.02               | Yes        |
| PRO     | 10M          | $0.015              | No         |
| SCALE   | 100M         | $0.01               | No         |

### Atomic Increment Function

```sql
CREATE FUNCTION increment_usage_tokens(p_org_id UUID, p_tokens BIGINT)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_new_used BIGINT;
  v_limit BIGINT;
BEGIN
  UPDATE usage_credits
  SET used_tokens = used_tokens + p_tokens, updated_at = now()
  WHERE org_id = p_org_id
  RETURNING used_tokens, hard_limit_tokens INTO v_new_used, v_limit;
  
  IF NOT FOUND THEN
    INSERT INTO usage_credits (org_id, used_tokens)
    VALUES (p_org_id, p_tokens)
    RETURNING used_tokens, hard_limit_tokens INTO v_new_used, v_limit;
  END IF;
  
  RETURN jsonb_build_object(
    'ok', v_new_used <= v_limit,
    'used_tokens', v_new_used,
    'remaining_tokens', GREATEST(0, v_limit - v_new_used),
    'limit', v_limit
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## API Contracts

### POST /functions/v1/usage-check
**Request**:
```json
{
  "org_id": "uuid",
  "estimated_tokens": 500
}
```

**Response (200)**:
```json
{
  "ok": true,
  "used_tokens": 45000,
  "remaining_tokens": 955000,
  "limit": 1000000,
  "plan": "STARTER"
}
```

**Response (402 Payment Required)**:
```json
{
  "ok": false,
  "used_tokens": 1000100,
  "remaining_tokens": 0,
  "limit": 1000000,
  "plan": "STARTER",
  "estimated_tokens": 500
}
```

## Provider Integration

### Environment Variables

```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_API_KEY=AIza...
```

### Provider Wrappers

Each provider has a wrapper that:
- Normalizes API calls (chat completions format)
- Estimates tokens (input + output)
- Records actual usage
- Handles errors and retries

### Example: OpenAI Wrapper

```typescript
async function callOpenAI(prompt: string, model: string): Promise<string> {
  const estimatedTokens = prompt.length / 4; // rough estimate
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
    }),
  });
  
  const data = await response.json();
  const actualTokens = data.usage.total_tokens;
  
  // Record usage
  await incrementUsageTokens(org_id, actualTokens);
  
  return data.choices[0].message.content;
}
```

## Telemetry

### Metrics Tracked

- **Request Latency**: p50, p95, p99 by model
- **Cost Per Request**: Actual spend per model
- **Error Rate**: Failures by provider
- **Quota Exhaustion**: Orgs hitting limits
- **Model Selection**: Which models chosen by task

### PostHog Events

```typescript
posthog.capture('ai_request', {
  org_id,
  task_type: 'text',
  model_selected: 'gpt-4o-mini',
  cost_per_1k: 0.15,
  tokens_used: 450,
  latency_ms: 1200,
  quality_tier: 'high',
});
```

## Monitoring & Alerts

### Dashboards

1. **Usage Dashboard**: `/usage`
   - Tokens used this month
   - Remaining quota
   - Projected burn rate
   - Model breakdown (pie chart)

2. **Admin Dashboard**: `/admin/usage`
   - All orgs usage
   - Top spenders
   - Anomaly detection

### Alerts

- **Quota Warning (80%)**: Email org admins
- **Quota Exceeded**: Block requests, notify admins
- **Provider Outage**: Switch to fallback, alert ops
- **Cost Spike**: >2x daily average → investigate

## Testing

### Unit Tests

```typescript
describe('Router Policy', () => {
  it('selects cheapest model meeting quality threshold', () => {
    const selected = selectModel({
      task: 'text',
      min_quality: 'high',
      max_cost_per_1k: 0.30,
    });
    expect(selected).toBe('gpt-4o-mini');
  });
  
  it('denies request when over quota', async () => {
    await setUsage(org_id, 1000000); // at limit
    const result = await checkCredits(org_id, 100);
    expect(result.ok).toBe(false);
  });
});
```

### E2E Tests

**Scenario**: Heavy job near limit
1. Set org to 999,500 tokens used (limit 1M)
2. Submit job with 400 token estimate → allowed
3. Submit another 200 token job → denied (402)

## Future Enhancements

- [ ] Dynamic pricing based on real-time provider costs
- [ ] Per-user token limits (in addition to org)
- [ ] Budget alerts and auto-upgrade prompts
- [ ] Model quality benchmarks (BLEU, ROUGE scores)
- [ ] A/B testing different routing policies
- [ ] Dark launch new models with 5% traffic
