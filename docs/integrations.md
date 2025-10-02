# Integrations Hub

## Overview

The Integrations Hub provides first-class OAuth connectors for external services, enabling seamless data sync and workflow automation.

## Supported Providers

### Shopify
- **Scope**: `read_products,write_products,read_orders`
- **Use Cases**: Product sync, order management, inventory tracking
- **Token Refresh**: Every 24 hours
- **Metadata**: Shop name, plan, primary domain

### Notion
- **Scope**: Workspace access
- **Use Cases**: Content management, documentation, knowledge base
- **Token Refresh**: N/A (long-lived tokens)
- **Metadata**: Workspace name, bot ID

### Google Drive
- **Scope**: `https://www.googleapis.com/auth/drive.file`
- **Use Cases**: File storage, asset management
- **Token Refresh**: Every 1 hour (access tokens) 
- **Metadata**: Root folder ID, quota info

### Zapier
- **Type**: Webhook-based
- **Use Cases**: Workflow automation, cross-platform triggers
- **Setup**: No OAuth; configure webhook URLs directly

## Architecture

```
┌─────────────┐      ┌──────────────────┐      ┌─────────────┐
│   Client    │─────▶│ integrations-    │─────▶│  Provider   │
│             │      │ connect (Edge)   │      │  OAuth      │
└─────────────┘      └──────────────────┘      └─────────────┘
                            │
                            ▼
                     ┌──────────────────┐
                     │ integrations-    │
                     │ callback (Edge)  │
                     └──────────────────┘
                            │
                            ▼
                     ┌──────────────────┐
                     │  integrations    │
                     │  table (RLS)     │
                     └──────────────────┘
```

## API Contracts

### POST /functions/v1/integrations-connect
**Request**:
```json
{
  "provider": "shopify" | "notion" | "google_drive" | "zapier",
  "redirectUri": "https://your-app.com/callback" // optional
}
```

**Response**:
```json
{
  "authUrl": "https://provider.com/oauth/authorize?...",
  "provider": "shopify"
}
```

### GET /functions/v1/integrations-callback/:provider
**Query Params**: `code`, `state` (user_id)  
**Response**: 302 redirect to `/integrations?success={provider}`

### Database Schema

```sql
CREATE TABLE integrations (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL,
  provider TEXT CHECK (provider IN ('shopify','notion','google_drive','zapier')),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  scope TEXT,
  expires_at TIMESTAMPTZ,
  status TEXT DEFAULT 'connected',
  last_sync_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, provider)
);
```

## Background Jobs

### Token Refresh (Every 10 minutes)
- Scans for tokens expiring within 5 minutes
- Refreshes using provider-specific refresh endpoints
- Exponential backoff on failure (1m, 2m, 4m, 8m)
- Updates `expires_at` and `last_sync_at`

### Metadata Sync (Hourly)
- **Shopify**: Fetch shop info, plan details
- **Notion**: Workspace name, member count
- **Google Drive**: Quota usage, root folder
- **Zapier**: Webhook status

## Security

- **Token Storage**: Encrypted at rest in database
- **Access Control**: Org-scoped RLS policies
- **Audit Trail**: All connect/disconnect actions logged
- **Rotation**: Automatic refresh before expiry

## Troubleshooting

### Common Errors

**Error**: `Invalid grant`
- **Cause**: Authorization code expired or already used
- **Fix**: Re-initiate OAuth flow

**Error**: `Insufficient scope`
- **Cause**: User denied required permissions
- **Fix**: Request scope again or adjust required permissions

**Error**: `Token refresh failed`
- **Cause**: Refresh token revoked or expired
- **Fix**: Force user to re-authenticate

### Monitoring

- **Metrics**: Token refresh success rate, sync latency, error rate
- **Alerts**: Failed refreshes >3 consecutive attempts
- **Logs**: All OAuth exchanges logged with timestamps

## Setup Guide

### Environment Variables Required

```bash
# Shopify
SHOPIFY_CLIENT_ID=your_client_id
SHOPIFY_CLIENT_SECRET=your_client_secret

# Notion
NOTION_CLIENT_ID=your_client_id
NOTION_CLIENT_SECRET=your_client_secret

# Google Drive
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret

# App
SITE_URL=https://your-app.com
```

### Provider-Specific Setup

#### Shopify
1. Create Shopify Partner account
2. Create app in Partner Dashboard
3. Configure OAuth redirect URL: `{SUPABASE_URL}/functions/v1/integrations-callback/shopify`
4. Request scopes: `read_products,write_products,read_orders`

#### Notion
1. Create integration at notion.so/my-integrations
2. Set redirect URL: `{SUPABASE_URL}/functions/v1/integrations-callback/notion`
3. Enable Public Integration

#### Google Drive
1. Create project in Google Cloud Console
2. Enable Drive API
3. Create OAuth 2.0 credentials
4. Add redirect URI: `{SUPABASE_URL}/functions/v1/integrations-callback/google_drive`

## Testing

### Unit Tests
```bash
npm test tests/unit/integrations.test.ts
```

### E2E Tests
```bash
npm run test:e2e -- integrations.spec.ts
```

**Test Scenarios**:
- Connect → Status shows "Connected"
- Force refresh → Last sync updated
- Disconnect → Status cleared
- Token expiry → Auto-refresh

## Future Enhancements

- [ ] Slack integration
- [ ] Airtable sync
- [ ] Stripe for billing
- [ ] HubSpot CRM
- [ ] Real-time sync status WebSocket
- [ ] Retry queue for failed syncs
