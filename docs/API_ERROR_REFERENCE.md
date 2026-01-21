# API Error Reference

> **Last Updated**: 2026-01-21  
> **Version**: 1.0.0  
> **Applies to**: All Edge Functions and REST API endpoints

## Table of Contents

1. [Error Response Format](#error-response-format)
2. [HTTP Status Code Reference](#http-status-code-reference)
3. [Error Code Catalog](#error-code-catalog)
4. [Function-Specific Errors](#function-specific-errors)
5. [Troubleshooting Guide](#troubleshooting-guide)
6. [Client-Side Error Handling](#client-side-error-handling)

---

## Error Response Format

All API errors follow a standardized JSON response format:

```typescript
interface ErrorResponse {
  error: string;           // Human-readable error message
  code?: string;           // Machine-readable error code
  status: number;          // HTTP status code
  requestId?: string;      // Unique request identifier for debugging
  details?: {
    cause?: string;        // Root cause explanation
    fix?: string;          // Suggested remediation
    retry?: boolean;       // Whether the request can be retried
    retryAfter?: number;   // Seconds to wait before retry (rate limiting)
  };
}
```

### Example Error Response

```json
{
  "error": "Rate limit exceeded. Please try again later.",
  "code": "RATE_LIMIT_EXCEEDED",
  "status": 429,
  "requestId": "req_abc123xyz",
  "details": {
    "cause": "Too many requests from this user",
    "fix": "Wait before making additional requests",
    "retry": true,
    "retryAfter": 60
  }
}
```

---

## HTTP Status Code Reference

### Success Codes (2xx)

| Status | Name | Usage |
|--------|------|-------|
| `200` | OK | Successful GET, PUT, PATCH requests |
| `201` | Created | Successful POST that creates a resource |
| `204` | No Content | Successful DELETE requests |

### Client Error Codes (4xx)

| Status | Name | Common Causes |
|--------|------|---------------|
| `400` | Bad Request | Invalid JSON, missing required fields, validation failure |
| `401` | Unauthorized | Missing or invalid authentication token |
| `403` | Forbidden | Valid auth but insufficient permissions |
| `404` | Not Found | Resource doesn't exist or not accessible |
| `405` | Method Not Allowed | HTTP method not supported for endpoint |
| `409` | Conflict | Resource already exists, concurrent modification |
| `413` | Payload Too Large | Request body exceeds size limit |
| `422` | Unprocessable Entity | Valid JSON but semantic validation failed |
| `429` | Too Many Requests | Rate limit exceeded |

### Server Error Codes (5xx)

| Status | Name | Common Causes |
|--------|------|---------------|
| `500` | Internal Server Error | Unexpected server-side error |
| `502` | Bad Gateway | Upstream service unavailable |
| `503` | Service Unavailable | Circuit breaker open, maintenance mode |
| `504` | Gateway Timeout | Request took too long to process |

---

## Error Code Catalog

### Authentication Errors (AUTH_*)

| Code | Status | Message | Cause | Resolution |
|------|--------|---------|-------|------------|
| `AUTH_MISSING_TOKEN` | 401 | Missing authorization header | No Bearer token provided | Include `Authorization: Bearer <token>` header |
| `AUTH_INVALID_TOKEN` | 401 | Invalid authentication token | Token expired, malformed, or revoked | Refresh token or re-authenticate |
| `AUTH_TOKEN_EXPIRED` | 401 | Token has expired | JWT past expiration time | Call refresh token endpoint |
| `AUTH_INSUFFICIENT_SCOPE` | 403 | Insufficient permissions | Token lacks required scope | Request additional permissions |
| `AUTH_MFA_REQUIRED` | 403 | MFA verification required | 2FA enabled but not verified | Complete MFA challenge |
| `AUTH_ACCOUNT_LOCKED` | 403 | Account temporarily locked | Too many failed login attempts | Wait for lockout period or contact support |
| `AUTH_EMAIL_NOT_VERIFIED` | 403 | Email not verified | User hasn't confirmed email | Check email for verification link |

### Validation Errors (VALIDATION_*)

| Code | Status | Message | Cause | Resolution |
|------|--------|---------|-------|------------|
| `VALIDATION_REQUIRED_FIELD` | 400 | Missing required field: {field} | Required parameter not provided | Include all required fields |
| `VALIDATION_INVALID_FORMAT` | 400 | Invalid format for field: {field} | Value doesn't match expected format | Check API documentation for format |
| `VALIDATION_INVALID_TYPE` | 400 | Invalid type for field: {field} | Wrong data type provided | Ensure correct data types |
| `VALIDATION_OUT_OF_RANGE` | 400 | Value out of range for field: {field} | Numeric value outside bounds | Use value within allowed range |
| `VALIDATION_INVALID_UUID` | 400 | Invalid UUID format | UUID doesn't match UUID v4 format | Provide valid UUID v4 |
| `VALIDATION_INVALID_URL` | 400 | Invalid URL format | URL doesn't parse correctly | Provide valid absolute URL |
| `VALIDATION_STRING_TOO_LONG` | 400 | String exceeds maximum length | Text exceeds character limit | Truncate to allowed length |

### Resource Errors (RESOURCE_*)

| Code | Status | Message | Cause | Resolution |
|------|--------|---------|-------|------------|
| `RESOURCE_NOT_FOUND` | 404 | Resource not found | ID doesn't exist or not accessible | Verify resource ID and permissions |
| `RESOURCE_ALREADY_EXISTS` | 409 | Resource already exists | Duplicate unique constraint | Use different identifier |
| `RESOURCE_DELETED` | 410 | Resource has been deleted | Soft-deleted resource accessed | Resource no longer available |
| `RESOURCE_LOCKED` | 423 | Resource is locked | Concurrent modification in progress | Retry after short delay |

### Rate Limiting Errors (RATE_*)

| Code | Status | Message | Cause | Resolution |
|------|--------|---------|-------|------------|
| `RATE_LIMIT_EXCEEDED` | 429 | Rate limit exceeded | Too many requests in time window | Wait for `retryAfter` seconds |
| `RATE_LIMIT_USER` | 429 | User rate limit exceeded | Per-user limit reached | Reduce request frequency |
| `RATE_LIMIT_ORG` | 429 | Organization rate limit exceeded | Org-wide limit reached | Contact support for limit increase |
| `RATE_LIMIT_IP` | 429 | IP rate limit exceeded | IP-based limit triggered | Wait for block to expire |

### Usage & Billing Errors (USAGE_*)

| Code | Status | Message | Cause | Resolution |
|------|--------|---------|-------|------------|
| `USAGE_LIMIT_EXCEEDED` | 402 | Usage limit exceeded | Token/generation limit reached | Upgrade plan or wait for reset |
| `USAGE_QUOTA_EXCEEDED` | 402 | Monthly quota exceeded | Monthly allocation exhausted | Upgrade plan |
| `USAGE_FEATURE_UNAVAILABLE` | 403 | Feature not available on plan | Plan doesn't include feature | Upgrade to higher tier |

### Content Generation Errors (CONTENT_*)

| Code | Status | Message | Cause | Resolution |
|------|--------|---------|-------|------------|
| `CONTENT_GENERATION_FAILED` | 500 | Content generation failed | AI service error | Retry with exponential backoff |
| `CONTENT_MODERATION_FAILED` | 400 | Content violates guidelines | Generated content flagged | Modify prompt or input |
| `CONTENT_BRAND_VIOLATION` | 400 | Content violates brand guidelines | Brand validation failed | Adjust content to match brand kit |
| `CONTENT_INVALID_TYPE` | 400 | Invalid content type | Unsupported content type requested | Use supported type: text, image, video, music |
| `CONTENT_SIZE_EXCEEDED` | 413 | Content exceeds size limit | Generated content too large | Request smaller dimensions/duration |

### Integration Errors (INTEGRATION_*)

| Code | Status | Message | Cause | Resolution |
|------|--------|---------|-------|------------|
| `INTEGRATION_NOT_CONNECTED` | 400 | Integration not connected | OAuth not completed | Complete integration setup |
| `INTEGRATION_TOKEN_EXPIRED` | 401 | Integration token expired | OAuth token needs refresh | Re-authorize integration |
| `INTEGRATION_SCOPE_INSUFFICIENT` | 403 | Integration lacks required scope | Missing OAuth permissions | Re-authorize with full permissions |
| `INTEGRATION_RATE_LIMITED` | 429 | External service rate limited | Third-party API limit | Wait for external limit reset |
| `INTEGRATION_UNAVAILABLE` | 503 | Integration service unavailable | Third-party service down | Check service status, retry later |

### Campaign Errors (CAMPAIGN_*)

| Code | Status | Message | Cause | Resolution |
|------|--------|---------|-------|------------|
| `CAMPAIGN_INVALID_DATES` | 400 | Invalid campaign date range | End date before start date | Correct date range |
| `CAMPAIGN_ASSET_REQUIRED` | 400 | Campaign requires assets | No assets attached | Add at least one asset |
| `CAMPAIGN_PLATFORM_REQUIRED` | 400 | No platforms selected | Missing target platforms | Select target platforms |
| `CAMPAIGN_ALREADY_PUBLISHED` | 409 | Campaign already published | Cannot modify published campaign | Create new campaign |

### Schedule Errors (SCHEDULE_*)

| Code | Status | Message | Cause | Resolution |
|------|--------|---------|-------|------------|
| `SCHEDULE_PAST_DATE` | 400 | Cannot schedule in the past | Scheduled time already passed | Use future datetime |
| `SCHEDULE_CONFLICT` | 409 | Schedule conflict exists | Overlapping scheduled post | Choose different time |
| `SCHEDULE_LIMIT_EXCEEDED` | 400 | Schedule limit exceeded | Too many pending schedules | Complete or cancel existing schedules |

### Server Errors (SERVER_*)

| Code | Status | Message | Cause | Resolution |
|------|--------|---------|-------|------------|
| `SERVER_INTERNAL_ERROR` | 500 | Internal server error | Unexpected exception | Retry, contact support if persists |
| `SERVER_DATABASE_ERROR` | 500 | Database operation failed | Query execution error | Retry with exponential backoff |
| `SERVER_EXTERNAL_SERVICE` | 502 | External service error | Upstream dependency failed | Check service status, retry |
| `SERVER_TIMEOUT` | 504 | Request timeout | Operation took too long | Retry with smaller payload |
| `SERVER_CIRCUIT_OPEN` | 503 | Service temporarily unavailable | Circuit breaker activated | Wait for circuit to close |

---

## Function-Specific Errors

### generate-content

| Error | Status | Cause | Resolution |
|-------|--------|-------|------------|
| Missing prompt | 400 | `prompt` field not provided | Include prompt in request body |
| Invalid content type | 400 | Type not in: text, image, video, music | Use supported content type |
| Brand kit not found | 404 | Referenced brand_kit_id doesn't exist | Verify brand kit ID |
| AI service unavailable | 503 | OpenAI/Google AI temporarily down | Retry with fallback model |

### campaigns-draft

| Error | Status | Cause | Resolution |
|-------|--------|-------|------------|
| Missing campaign name | 400 | `name` field not provided | Include campaign name |
| Invalid objective | 400 | Objective not in allowed values | Use: awareness, engagement, conversion |
| Organization required | 400 | `org_id` not provided | Include organization ID |
| Not organization member | 403 | User not member of specified org | Verify organization membership |

### schedule

| Error | Status | Cause | Resolution |
|-------|--------|-------|------------|
| Missing asset_id | 400 | No asset specified | Include asset_id in request |
| Invalid platform | 400 | Platform not supported | Use: instagram, twitter, linkedin, tiktok, youtube |
| Integration not found | 404 | Platform not connected for org | Connect platform integration first |
| Past scheduled time | 400 | scheduled_at is in the past | Use future datetime |

### marketplace-install

| Error | Status | Cause | Resolution |
|-------|--------|-------|------------|
| Pack not found | 404 | Invalid pack ID | Verify marketplace pack ID |
| Insufficient permissions | 403 | User not admin/owner of org | Request admin access |
| Pack size exceeded | 413 | Pack larger than 5MB limit | Choose smaller pack |
| Missing secrets | 200* | Integration pack needs API keys | Provide required secrets |

*Note: Returns 200 with `status: "needs_config"` for missing secrets

### publish-post

| Error | Status | Cause | Resolution |
|-------|--------|-------|------------|
| Schedule not found | 404 | Invalid schedule ID | Verify schedule ID |
| Already published | 409 | Post already published | No action needed |
| Max retries exceeded | 500 | Publishing failed after 3 attempts | Manual intervention required |
| Platform API error | 502 | Social platform rejected post | Check content requirements |

### integrations-connect

| Error | Status | Cause | Resolution |
|-------|--------|-------|------------|
| Invalid provider | 400 | Provider not supported | Use supported provider |
| Invalid redirect URI | 400 | Redirect not in allowed list | Configure redirect URI |
| OAuth state mismatch | 400 | State parameter doesn't match | Restart OAuth flow |

### integrations-callback

| Error | Status | Cause | Resolution |
|-------|--------|-------|------------|
| Missing code | 400 | OAuth code not provided | Complete OAuth flow |
| Invalid state | 400 | State validation failed | Restart OAuth flow |
| Token exchange failed | 500 | Provider rejected token exchange | Check OAuth credentials |

---

## Troubleshooting Guide

### Common Issues & Solutions

#### "Missing authorization header" (401)

**Symptoms:**
- API returns 401 on authenticated endpoints
- Works in development but fails in production

**Solutions:**
1. Verify token is being sent:
```typescript
const { data, error } = await supabase.functions.invoke('endpoint', {
  headers: {
    Authorization: `Bearer ${session.access_token}`
  }
});
```

2. Check token expiration:
```typescript
const { data: { session } } = await supabase.auth.getSession();
if (session?.expires_at && Date.now() > session.expires_at * 1000) {
  await supabase.auth.refreshSession();
}
```

#### "Rate limit exceeded" (429)

**Symptoms:**
- Requests suddenly start failing
- Error includes `retryAfter` value

**Solutions:**
1. Implement exponential backoff:
```typescript
async function fetchWithRetry(fn: () => Promise<any>, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 429) {
        const delay = error.details?.retryAfter || Math.pow(2, i) * 1000;
        await new Promise(r => setTimeout(r, delay));
      } else throw error;
    }
  }
}
```

2. Rate limit configurations:

| Endpoint | Limit | Window |
|----------|-------|--------|
| generate-content | 20/hour | Per user |
| campaigns-draft | 50/hour | Per user |
| schedule | 100/hour | Per user |
| marketplace-install | 30/hour | Per user |
| usage-check | 100/minute | Per user |

#### "Not a member of organization" (403)

**Symptoms:**
- User can login but can't access org resources
- Works for some users, not others

**Solutions:**
1. Verify membership:
```typescript
const { data: member } = await supabase
  .from('members')
  .select('role')
  .eq('org_id', orgId)
  .eq('user_id', userId)
  .single();
```

2. Check if user needs invitation acceptance

#### "Circuit breaker open" (503)

**Symptoms:**
- Requests fail immediately without reaching external service
- Error includes "circuit breaker" message

**Solutions:**
1. Wait for circuit to close (default: 30 seconds)
2. Check external service status
3. Monitor `/functions/v1/health` for circuit status

#### "Content generation failed" (500)

**Symptoms:**
- Text/image/video generation returns error
- Inconsistent failures

**Solutions:**
1. Check AI service status (OpenAI, Google AI)
2. Verify API keys are configured
3. Check usage limits:
```typescript
const { data } = await supabase.functions.invoke('usage-check', {
  body: { org_id: orgId, estimated_tokens: 1000 }
});
```

### Debug Information

Include these headers for debugging:

| Header | Purpose |
|--------|---------|
| `X-Request-Id` | Correlate logs across services |
| `X-Debug-Mode: true` | Enable verbose error details (dev only) |

### Error Logging Best Practices

```typescript
// Client-side error logging
try {
  const { data, error } = await supabase.functions.invoke('endpoint');
  if (error) {
    console.error('API Error:', {
      code: error.code,
      message: error.message,
      requestId: error.requestId,
      details: error.details
    });
    // Report to error tracking service
    Sentry.captureException(error, {
      extra: { requestId: error.requestId }
    });
  }
} catch (networkError) {
  console.error('Network Error:', networkError);
}
```

---

## Client-Side Error Handling

### React Query Error Handling

```typescript
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

// Query with error handling
const { data, error, isError } = useQuery({
  queryKey: ['resource', id],
  queryFn: () => fetchResource(id),
  retry: (failureCount, error) => {
    // Don't retry on 4xx errors
    if (error.status >= 400 && error.status < 500) return false;
    return failureCount < 3;
  },
  onError: (error) => {
    handleApiError(error);
  }
});

// Mutation with error handling
const mutation = useMutation({
  mutationFn: createResource,
  onError: (error) => {
    handleApiError(error);
  }
});

// Centralized error handler
function handleApiError(error: ApiError) {
  const message = getErrorMessage(error);
  
  switch (error.status) {
    case 401:
      // Redirect to login
      window.location.href = '/auth';
      break;
    case 403:
      toast.error('You don\'t have permission for this action');
      break;
    case 429:
      toast.error(`Too many requests. Please wait ${error.details?.retryAfter || 60} seconds.`);
      break;
    case 500:
    case 502:
    case 503:
      toast.error('Service temporarily unavailable. Please try again.');
      break;
    default:
      toast.error(message);
  }
}

function getErrorMessage(error: ApiError): string {
  if (error.details?.fix) {
    return error.details.fix;
  }
  return error.message || 'An unexpected error occurred';
}
```

### Error Boundary Component

```typescript
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Wrap components that may throw
<ErrorBoundary
  fallback={(error, reset) => (
    <div className="error-state">
      <h2>Something went wrong</h2>
      <p>{error.message}</p>
      <Button onClick={reset}>Try Again</Button>
    </div>
  )}
>
  <YourComponent />
</ErrorBoundary>
```

### Form Validation Error Display

```typescript
// Display API validation errors on form
function handleSubmitError(error: ApiError, form: UseFormReturn) {
  if (error.code === 'VALIDATION_REQUIRED_FIELD') {
    const field = error.message.match(/field: (\w+)/)?.[1];
    if (field) {
      form.setError(field, { message: 'This field is required' });
    }
  }
  
  if (error.code === 'VALIDATION_INVALID_FORMAT') {
    const field = error.message.match(/field: (\w+)/)?.[1];
    if (field) {
      form.setError(field, { message: 'Invalid format' });
    }
  }
}
```

---

## Appendix: Error Code Quick Reference

```
AUTH_*          Authentication & authorization errors
VALIDATION_*    Input validation errors  
RESOURCE_*      Resource lifecycle errors
RATE_*          Rate limiting errors
USAGE_*         Usage & billing errors
CONTENT_*       Content generation errors
INTEGRATION_*   Third-party integration errors
CAMPAIGN_*      Campaign management errors
SCHEDULE_*      Scheduling errors
SERVER_*        Server-side errors
```

---

*For additional support, contact: support@flashfusion.co*
