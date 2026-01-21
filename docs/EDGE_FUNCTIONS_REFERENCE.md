# Edge Functions Reference

> **Last Updated**: 2026-01-21  
> **Runtime**: Deno (Supabase Edge Runtime)  
> **Base URL**: `https://trxmsoyjjoopnvzohmvi.supabase.co/functions/v1`

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Common Headers](#common-headers)
4. [Function Reference](#function-reference)
5. [Shared Utilities](#shared-utilities)
6. [Error Handling](#error-handling)
7. [Rate Limiting](#rate-limiting)
8. [Testing](#testing)

---

## Overview

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Edge Functions                           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Content    │  │  Campaign   │  │   Integrations      │ │
│  │  Functions  │  │  Functions  │  │   Functions         │ │
│  ├─────────────┤  ├─────────────┤  ├─────────────────────┤ │
│  │ generate-   │  │ campaigns-  │  │ integrations-       │ │
│  │ content     │  │ draft       │  │ connect/callback    │ │
│  │ generate-   │  │             │  │ integrations-       │ │
│  │ youtube     │  │             │  │ write-token/refresh │ │
│  │ generate-   │  │             │  │                     │ │
│  │ tiktok      │  │             │  │                     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Schedule   │  │ Marketplace │  │   Infrastructure    │ │
│  │  Functions  │  │  Functions  │  │   Functions         │ │
│  ├─────────────┤  ├─────────────┤  ├─────────────────────┤ │
│  │ schedule    │  │ marketplace-│  │ health              │ │
│  │ publish-    │  │ install     │  │ csp-report          │ │
│  │ post        │  │ library-    │  │ events-ingest       │ │
│  │             │  │ install     │  │ usage-check         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                   _shared/ Utilities                    ││
│  │  circuit-breaker │ retry │ observability │ http │ ...   ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Function Categories

| Category | Functions | Purpose |
|----------|-----------|---------|
| **Content** | generate-content, generate-youtube-content, generate-tiktok-content | AI content generation |
| **Campaign** | campaigns-draft | Campaign creation and management |
| **Schedule** | schedule, publish-post | Social media scheduling and publishing |
| **Integration** | integrations-connect, integrations-callback, integrations-write-token, integrations-refresh | OAuth and third-party integrations |
| **Marketplace** | marketplace-install, library-install | Pack and library installation |
| **User** | send-invitation, accept-invitation, login-notification, account-lockout-notification | User management and notifications |
| **Security** | security-activity, csp-report, gdpr-export, gdpr-delete | Security and compliance |
| **Infrastructure** | health, events-ingest, usage-check | System health and analytics |

---

## Authentication

### JWT Authentication

Most endpoints require JWT authentication via Bearer token:

```bash
curl -X POST \
  https://trxmsoyjjoopnvzohmvi.supabase.co/functions/v1/generate-content \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Generate content"}'
```

### Authentication Flow

```typescript
// Get session token from Supabase client
const { data: { session } } = await supabase.auth.getSession();

// Invoke authenticated function
const { data, error } = await supabase.functions.invoke('generate-content', {
  body: { prompt: 'Generate content' }
});
// Token automatically included by Supabase client
```

### JWT Verification in Functions

```typescript
// Standard JWT verification pattern
const authToken = getAuthToken(req);
if (!authToken) {
  return unauthorizedResponse('Missing authorization header');
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const { data: { user }, error } = await supabase.auth.getUser(authToken);
if (error || !user) {
  return unauthorizedResponse('Invalid authentication token');
}
```

### Public Endpoints

These endpoints do not require authentication:

| Function | Reason |
|----------|--------|
| `health` | System health checks |
| `csp-report` | CSP violation reporting |
| `publish-post` | Called by scheduler (internal) |
| `integrations-refresh` | CRON job (internal) |

---

## Common Headers

### Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes* | Bearer JWT token |
| `Content-Type` | Yes | Must be `application/json` |
| `X-Request-Id` | No | Custom request ID for tracing |
| `X-Idempotency-Key` | No | Prevent duplicate operations |

*Not required for public endpoints

### Response Headers

| Header | Description |
|--------|-------------|
| `Content-Type` | Always `application/json` |
| `X-Request-Id` | Request correlation ID |
| `Access-Control-Allow-Origin` | CORS header (`*`) |
| `X-RateLimit-Remaining` | Remaining requests in window |
| `Retry-After` | Seconds to wait (on 429) |

---

## Function Reference

### generate-content

Generates AI-powered content (text, image, video, music).

**Endpoint:** `POST /generate-content`  
**Auth:** Required  
**Rate Limit:** 20/hour per user

#### Request Schema

```typescript
interface GenerateContentRequest {
  prompt: string;              // Required: Content generation prompt
  type: 'text' | 'image' | 'video' | 'music';  // Required
  org_id: string;              // Required: Organization UUID
  brand_kit_id?: string;       // Optional: Brand kit for validation
  template_id?: string;        // Optional: Template to use
  platform?: string;           // Optional: Target platform
  style?: {                    // Optional: Style parameters
    tone?: string;
    format?: string;
    length?: 'short' | 'medium' | 'long';
  };
  metadata?: Record<string, unknown>;  // Optional: Custom metadata
}
```

#### Response Schema

```typescript
interface GenerateContentResponse {
  success: true;
  asset: {
    id: string;
    type: string;
    name: string;
    content_url?: string;
    content_data?: Record<string, unknown>;
    thumbnail_url?: string;
    provenance: {
      model: string;
      provider: string;
      prompt_hash: string;
      generated_at: string;
    };
  };
  usage: {
    tokens_used: number;
    remaining_tokens: number;
  };
}
```

#### Example

```bash
curl -X POST \
  https://trxmsoyjjoopnvzohmvi.supabase.co/functions/v1/generate-content \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a professional LinkedIn post about AI in marketing",
    "type": "text",
    "org_id": "uuid-here",
    "platform": "linkedin",
    "style": {
      "tone": "professional",
      "length": "medium"
    }
  }'
```

---

### generate-youtube-content

Generates YouTube-specific content (titles, descriptions, thumbnails).

**Endpoint:** `POST /generate-youtube-content`  
**Auth:** Required  
**Rate Limit:** 20/hour per user

#### Request Schema

```typescript
interface GenerateYouTubeRequest {
  prompt: string;              // Required: Video topic/description
  org_id: string;              // Required: Organization UUID
  content_type: 'title' | 'description' | 'thumbnail' | 'script' | 'tags';
  brand_kit_id?: string;       // Optional: Brand kit
  video_length?: number;       // Optional: Estimated video length (seconds)
  target_audience?: string;    // Optional: Target demographic
}
```

#### Response Schema

```typescript
interface GenerateYouTubeResponse {
  success: true;
  content: {
    type: string;
    data: string | string[];  // String for text, array for tags
    alternatives?: string[];  // Alternative suggestions
  };
  seo_score?: number;         // 0-100 SEO optimization score
  usage: {
    tokens_used: number;
  };
}
```

---

### generate-tiktok-content

Generates TikTok-specific content (captions, hashtags, hooks).

**Endpoint:** `POST /generate-tiktok-content`  
**Auth:** Required  
**Rate Limit:** 20/hour per user

#### Request Schema

```typescript
interface GenerateTikTokRequest {
  prompt: string;              // Required: Video concept
  org_id: string;              // Required: Organization UUID
  content_type: 'caption' | 'hashtags' | 'hook' | 'cta';
  brand_kit_id?: string;
  trend_alignment?: boolean;   // Align with current trends
  sound_suggestion?: boolean;  // Include sound recommendations
}
```

---

### campaigns-draft

Creates AI-generated campaign drafts.

**Endpoint:** `POST /campaigns-draft`  
**Auth:** Required  
**Rate Limit:** 50/hour per user

#### Request Schema

```typescript
interface CampaignsDraftRequest {
  name: string;                // Required: Campaign name
  org_id: string;              // Required: Organization UUID
  objective: 'awareness' | 'engagement' | 'conversion' | 'retention';
  description?: string;        // Optional: Campaign description
  target_audience?: {
    demographics?: string[];
    interests?: string[];
    behaviors?: string[];
  };
  platforms?: string[];        // Target platforms
  budget_cents?: number;       // Budget in cents
  start_date?: string;         // ISO date string
  end_date?: string;           // ISO date string
  brand_kit_id?: string;       // Brand kit to apply
}
```

#### Response Schema

```typescript
interface CampaignsDraftResponse {
  success: true;
  campaign: {
    id: string;
    name: string;
    status: 'draft';
    objective: string;
    strategy: {
      messaging: string[];
      content_pillars: string[];
      posting_schedule: Record<string, unknown>;
    };
    suggested_assets: {
      type: string;
      description: string;
    }[];
  };
}
```

---

### schedule

Schedules content for social media posting.

**Endpoint:** `POST /schedule`  
**Auth:** Required  
**Rate Limit:** 100/hour per user

#### Request Schema

```typescript
interface ScheduleRequest {
  asset_id: string;            // Required: Asset to post
  org_id: string;              // Required: Organization UUID
  platform: 'instagram' | 'twitter' | 'linkedin' | 'tiktok' | 'youtube';
  scheduled_at: string;        // Required: ISO datetime (future)
  campaign_id?: string;        // Optional: Associated campaign
  caption?: string;            // Optional: Override asset caption
  metadata?: {
    hashtags?: string[];
    mentions?: string[];
    location?: string;
  };
}
```

#### Response Schema

```typescript
interface ScheduleResponse {
  success: true;
  schedule: {
    id: string;
    asset_id: string;
    platform: string;
    scheduled_at: string;
    status: 'pending';
  };
}
```

---

### publish-post

Publishes scheduled posts (called by scheduler).

**Endpoint:** `POST /publish-post`  
**Auth:** Not required (internal)  
**Rate Limit:** None (internal)

#### Request Schema

```typescript
interface PublishPostRequest {
  schedule_id: string;         // Required: Schedule to publish
}
```

#### Response Schema

```typescript
interface PublishPostResponse {
  success: boolean;
  posted_url?: string;         // URL of published post
  platform_post_id?: string;   // Platform's post ID
  error?: string;              // Error message if failed
}
```

---

### marketplace-install

Installs marketplace packs (templates, presets, integrations).

**Endpoint:** `POST /marketplace-install`  
**Auth:** Required (admin/owner)  
**Rate Limit:** 30/hour per user

#### Request Schema

```typescript
interface MarketplaceInstallRequest {
  packId: string;              // Required: Marketplace pack ID
  orgId: string;               // Required: Organization UUID
  secrets?: Record<string, string>;  // Optional: Required secrets for integrations
}
```

#### Response Schema

```typescript
interface MarketplaceInstallResponse {
  status: 'installed' | 'needs_config';
  installedResources?: {
    templates?: string[];
    presets?: string[];
    integrations?: string[];
    workflows?: string[];
  };
  requiredSecrets?: string[];  // If needs_config
  message: string;
}
```

---

### library-install

Installs items from the component library.

**Endpoint:** `POST /library-install`  
**Auth:** Required (admin/owner)  
**Rate Limit:** 30/hour per user

#### Request Schema

```typescript
interface LibraryInstallRequest {
  item_id: string;             // Required: Library item ID
  org_id: string;              // Required: Organization UUID
}
```

---

### integrations-connect

Initiates OAuth flow for third-party integrations.

**Endpoint:** `POST /integrations-connect`  
**Auth:** Required  
**Rate Limit:** 20/hour per user

#### Request Schema

```typescript
interface IntegrationsConnectRequest {
  provider: 'instagram' | 'twitter' | 'linkedin' | 'tiktok' | 'youtube' | 'google' | 'facebook';
  org_id: string;              // Required: Organization UUID
  redirect_uri: string;        // Required: OAuth callback URL
  scopes?: string[];           // Optional: Requested scopes
}
```

#### Response Schema

```typescript
interface IntegrationsConnectResponse {
  success: true;
  authorization_url: string;   // Redirect user here
  state: string;               // OAuth state parameter
}
```

---

### integrations-callback

Handles OAuth callback and token exchange.

**Endpoint:** `POST /integrations-callback`  
**Auth:** Required  
**Rate Limit:** 20/hour per user

#### Request Schema

```typescript
interface IntegrationsCallbackRequest {
  provider: string;            // Required: OAuth provider
  code: string;                // Required: Authorization code
  state: string;               // Required: OAuth state
  org_id: string;              // Required: Organization UUID
}
```

#### Response Schema

```typescript
interface IntegrationsCallbackResponse {
  success: true;
  integration: {
    id: string;
    provider: string;
    status: 'connected';
    scope: string;
    expires_at?: string;
  };
}
```

---

### integrations-write-token

Securely stores encrypted integration tokens.

**Endpoint:** `POST /integrations-write-token`  
**Auth:** Required  
**Rate Limit:** 20/hour per user

#### Request Schema

```typescript
interface IntegrationsWriteTokenRequest {
  org_id: string;              // Required
  provider: string;            // Required
  access_token: string;        // Required
  refresh_token?: string;      // Optional
  expires_at?: string;         // Optional: ISO datetime
  scope?: string;              // Optional
  metadata?: Record<string, unknown>;
}
```

---

### integrations-refresh

CRON job to refresh expiring OAuth tokens.

**Endpoint:** `POST /integrations-refresh`  
**Auth:** Not required (internal CRON)  
**Schedule:** Every 6 hours (`0 */6 * * *`)

---

### usage-check

Checks organization usage limits before operations.

**Endpoint:** `POST /usage-check`  
**Auth:** Required  
**Rate Limit:** 100/minute per user

#### Request Schema

```typescript
interface UsageCheckRequest {
  org_id: string;              // Required
  estimated_tokens: number;    // Required: Tokens for operation
}
```

#### Response Schema

```typescript
interface UsageCheckResponse {
  ok: boolean;                 // true if within limits
  used_tokens: number;
  remaining_tokens: number;
  limit: number;
  plan: string;
  estimated_tokens?: number;
}
```

**Note:** Returns 402 status if limit would be exceeded.

---

### health

System health check endpoint.

**Endpoint:** `GET /health`  
**Auth:** Not required  
**Rate Limit:** None

#### Response Schema

```typescript
interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  timestamp: string;
  checks: {
    database: 'ok' | 'error';
    storage: 'ok' | 'error';
    external_apis: 'ok' | 'error';
  };
  circuit_breakers: {
    [service: string]: 'closed' | 'open' | 'half-open';
  };
}
```

---

### events-ingest

Ingests analytics events for tracking.

**Endpoint:** `POST /events-ingest`  
**Auth:** Required  
**Rate Limit:** 1000/minute per org

#### Request Schema

```typescript
interface EventsIngestRequest {
  events: {
    event_type: string;
    event_category: string;
    org_id: string;
    user_id: string;
    duration_ms?: number;
    metadata?: Record<string, unknown>;
  }[];
}
```

---

### gdpr-export

Exports user data for GDPR compliance.

**Endpoint:** `POST /gdpr-export`  
**Auth:** Required  
**Rate Limit:** 1/day per user

#### Request Schema

```typescript
interface GDPRExportRequest {
  user_id?: string;            // Optional: Admin can specify user
  format?: 'json' | 'csv';     // Default: json
}
```

---

### gdpr-delete

Deletes user data for GDPR compliance.

**Endpoint:** `POST /gdpr-delete`  
**Auth:** Required  
**Rate Limit:** 1/day per user

#### Request Schema

```typescript
interface GDPRDeleteRequest {
  user_id?: string;            // Optional: Admin can specify user
  confirmation: string;        // Must be "DELETE"
}
```

---

### send-invitation

Sends team member invitation emails.

**Endpoint:** `POST /send-invitation`  
**Auth:** Required (admin/owner)  
**Rate Limit:** 50/hour per org

#### Request Schema

```typescript
interface SendInvitationRequest {
  email: string;               // Required: Invitee email
  org_id: string;              // Required
  role: 'admin' | 'member' | 'viewer';
}
```

---

### accept-invitation

Accepts a team invitation.

**Endpoint:** `POST /accept-invitation`  
**Auth:** Required  
**Rate Limit:** 10/hour per user

#### Request Schema

```typescript
interface AcceptInvitationRequest {
  token: string;               // Required: Invitation token
}
```

---

### security-activity

Logs security-related activities.

**Endpoint:** `POST /security-activity`  
**Auth:** Required  
**Rate Limit:** 100/hour per user

#### Request Schema

```typescript
interface SecurityActivityRequest {
  event_type: string;          // Required
  event_category: string;      // Required
  success: boolean;            // Required
  metadata?: Record<string, unknown>;
}
```

---

### csp-report

Receives Content Security Policy violation reports.

**Endpoint:** `POST /csp-report`  
**Auth:** Not required  
**Rate Limit:** 100/minute per IP

---

### login-notification

Sends notifications for new login events.

**Endpoint:** `POST /login-notification`  
**Auth:** Internal  
**Rate Limit:** 10/hour per user

---

### account-lockout-notification

Sends notification when account is locked.

**Endpoint:** `POST /account-lockout-notification`  
**Auth:** Internal  
**Rate Limit:** 5/hour per user

---

## Shared Utilities

### Location: `supabase/functions/_shared/`

### circuit-breaker.ts

Implements circuit breaker pattern for external API calls.

```typescript
import { CircuitBreaker } from '../_shared/circuit-breaker.ts';

const breaker = new CircuitBreaker('openai', {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 30000,
});

const result = await breaker.execute(async () => {
  return await callExternalAPI();
});
```

**States:**
- `closed`: Normal operation
- `open`: Failing fast (circuit tripped)
- `half-open`: Testing if service recovered

### retry.ts

Exponential backoff retry logic.

```typescript
import { withRetry, withRetryAndTimeout } from '../_shared/retry.ts';

const result = await withRetry(
  () => riskyOperation(),
  {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    onRetry: (error, attempt) => {
      logger.warn(`Retry ${attempt}`, { error });
    }
  }
);
```

### observability.ts

Structured logging, metrics, and tracing.

```typescript
import { Logger, Tracer, metrics, reportError } from '../_shared/observability.ts';

const logger = new Logger('function-name', { requestId });
const tracer = new Tracer(requestId);

logger.info('Operation started', { userId });

const spanId = tracer.startSpan('db.query');
// ... operation
tracer.endSpan(spanId, 'ok');

metrics.counter('operations.success', 1, { type: 'create' });
metrics.timing('operation.duration', durationMs);
```

### http.ts

HTTP response helpers and request parsing.

```typescript
import {
  successResponse,
  createdResponse,
  errorResponse,
  badRequestResponse,
  unauthorizedResponse,
  forbiddenResponse,
  rateLimitResponse,
  corsPreflightResponse,
  getAuthToken,
  getRequestId,
  parseJsonBody,
  validateRequiredFields,
} from '../_shared/http.ts';

// CORS preflight
if (req.method === 'OPTIONS') {
  return corsPreflightResponse();
}

// Parse body
const body = await parseJsonBody<RequestType>(req);

// Validate
const validation = validateRequiredFields(body, ['field1', 'field2']);
if (!validation.valid) {
  return badRequestResponse(validation.error);
}

// Success response
return successResponse({ data: result });
```

### ratelimit.ts

User-based rate limiting.

```typescript
import { checkRateLimit } from '../_shared/ratelimit.ts';

const rateLimit = await checkRateLimit(userId, 'operation_name', 20, 3600000);
if (!rateLimit.allowed) {
  return rateLimitResponse(rateLimit.retryAfter);
}
```

### validation.ts

Input validation utilities.

```typescript
import { sanitizeInput, validateUUID, validateEmail } from '../_shared/validation.ts';

const sanitized = sanitizeInput(userInput);
if (!validateUUID(id)) {
  return badRequestResponse('Invalid ID format');
}
```

### sanitize.ts

Content sanitization for security.

```typescript
import { sanitizeHtml, sanitizePrompt } from '../_shared/sanitize.ts';

const safeHtml = sanitizeHtml(userHtml);
const safePrompt = sanitizePrompt(userPrompt);
```

---

## Error Handling

### Standard Error Response

```typescript
// All errors follow this format
{
  "error": "Human-readable message",
  "code": "MACHINE_READABLE_CODE",
  "status": 400,
  "requestId": "req_abc123",
  "details": {
    "cause": "Root cause explanation",
    "fix": "How to resolve",
    "retry": true
  }
}
```

### Error Handling Pattern

```typescript
Deno.serve(async (req) => {
  const requestId = getRequestId(req);
  const logger = new Logger(FUNCTION_NAME, { requestId });
  
  if (req.method === 'OPTIONS') {
    return corsPreflightResponse();
  }
  
  try {
    // Auth check
    const authToken = getAuthToken(req);
    if (!authToken) {
      return unauthorizedResponse('Missing authorization header');
    }
    
    // Parse and validate
    const body = await parseJsonBody<RequestType>(req);
    if (!body) {
      return badRequestResponse('Invalid JSON body');
    }
    
    // Business logic
    const result = await processRequest(body);
    
    return successResponse(result);
    
  } catch (error) {
    logger.error('Operation failed', error as Error);
    reportError(error as Error, { function: FUNCTION_NAME, requestId });
    
    if (error instanceof ValidationError) {
      return badRequestResponse(error.message);
    }
    
    return errorResponse('Internal server error', 500);
  }
});
```

---

## Rate Limiting

### Rate Limit Configuration

| Function | Limit | Window | Scope |
|----------|-------|--------|-------|
| generate-content | 20 | 1 hour | user |
| generate-youtube-content | 20 | 1 hour | user |
| generate-tiktok-content | 20 | 1 hour | user |
| campaigns-draft | 50 | 1 hour | user |
| schedule | 100 | 1 hour | user |
| marketplace-install | 30 | 1 hour | user |
| library-install | 30 | 1 hour | user |
| integrations-* | 20 | 1 hour | user |
| usage-check | 100 | 1 minute | user |
| events-ingest | 1000 | 1 minute | org |
| send-invitation | 50 | 1 hour | org |

### Rate Limit Headers

```
X-RateLimit-Limit: 20
X-RateLimit-Remaining: 15
X-RateLimit-Reset: 1642531200
Retry-After: 3600
```

---

## Testing

### Local Testing

```bash
# Start Supabase locally
supabase start

# Serve functions locally
supabase functions serve

# Test function
curl -X POST http://localhost:54321/functions/v1/health
```

### Integration Testing

```typescript
// tests/integration/edge-functions.test.ts
import { supabase } from '@/integrations/supabase/client';

describe('Edge Functions', () => {
  it('should check health', async () => {
    const { data, error } = await supabase.functions.invoke('health');
    expect(error).toBeNull();
    expect(data.status).toBe('healthy');
  });
  
  it('should require auth for protected endpoints', async () => {
    const { error } = await supabase.functions.invoke('generate-content', {
      body: { prompt: 'test' }
    });
    expect(error?.message).toContain('Unauthorized');
  });
});
```

### MCP Inspector

For testing MCP server functions:

```bash
npx @modelcontextprotocol/inspector
```

---

## Configuration

### supabase/config.toml

```toml
[functions.generate-content]
verify_jwt = true

[functions.health]
verify_jwt = false

[functions.publish-post]
verify_jwt = false

[[functions.integrations-refresh.schedule]]
cron = "0 */6 * * *"
```

### Environment Variables

Available in all edge functions:

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key |

Custom secrets (configured via Lovable Cloud):

| Secret | Purpose |
|--------|---------|
| `OPENAI_API_KEY` | OpenAI API access |
| `GOOGLE_AI_API_KEY` | Google AI access |
| `KEYRING_TOKEN` | Token encryption |
| `RESEND_API_KEY` | Email delivery |
| `STRIPE_SECRET_KEY` | Payment processing |

---

*For additional documentation, see [API_ERROR_REFERENCE.md](./API_ERROR_REFERENCE.md) and [OPERATIONS_RUNBOOK.md](./OPERATIONS_RUNBOOK.md)*
