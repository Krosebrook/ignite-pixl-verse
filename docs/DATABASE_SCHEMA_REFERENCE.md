# Database Schema Reference

> **Last Updated:** 2026-01-21  
> **Database:** PostgreSQL (Supabase)  
> **Schema Version:** 1.0.0

## Table of Contents

1. [Overview](#overview)
2. [Entity Relationship Diagram](#entity-relationship-diagram)
3. [Core Tables](#core-tables)
4. [Authentication & Security Tables](#authentication--security-tables)
5. [Content & Assets Tables](#content--assets-tables)
6. [Campaign & Scheduling Tables](#campaign--scheduling-tables)
7. [Analytics & Monitoring Tables](#analytics--monitoring-tables)
8. [Marketplace & Library Tables](#marketplace--library-tables)
9. [Database Functions](#database-functions)
10. [Indexes](#indexes)
11. [Row-Level Security Policies](#row-level-security-policies)
12. [Enums](#enums)
13. [Views](#views)

---

## Overview

FlashFusion uses a multi-tenant PostgreSQL database with strict Row-Level Security (RLS) policies. All tenant data is isolated by `org_id`, with membership verified through the `members` table.

### Key Design Principles

- **Multi-tenancy**: All user data is scoped to organizations via `org_id`
- **RLS-first**: Every table has RLS enabled with explicit policies
- **UUID Primary Keys**: All tables use `uuid` primary keys with `gen_random_uuid()` or `extensions.uuid_generate_v4()`
- **Timestamps**: All tables include `created_at`, most include `updated_at`
- **Soft References**: User IDs reference `auth.users` but without foreign key constraints

---

## Entity Relationship Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   auth.users │────▶│   profiles  │     │    orgs     │
└─────────────┘     └─────────────┘     └──────┬──────┘
       │                                        │
       │            ┌─────────────┐            │
       └───────────▶│   members   │◀───────────┘
                    └──────┬──────┘
                           │
       ┌───────────────────┼───────────────────┐
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   assets    │     │  campaigns  │     │ brand_kits  │
└──────┬──────┘     └──────┬──────┘     └─────────────┘
       │                   │
       │            ┌──────┴──────┐
       ▼            ▼             ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  schedules  │ │campaign_goals│ │  segments   │
└─────────────┘ └─────────────┘ └─────────────┘
```

---

## Core Tables

### `orgs`

Organizations are the top-level tenant containers.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `extensions.uuid_generate_v4()` | Primary key |
| `name` | `text` | NO | - | Organization display name |
| `slug` | `text` | NO | - | URL-safe unique identifier |
| `owner_id` | `uuid` | NO | - | User ID of the organization owner |
| `timezone` | `text` | NO | `'UTC'` | IANA timezone string |
| `locale` | `text` | NO | `'en-US'` | Locale for formatting |
| `created_at` | `timestamptz` | YES | `now()` | Creation timestamp |
| `updated_at` | `timestamptz` | YES | `now()` | Last update timestamp |

**Constraints:**
- Primary Key: `id`
- Unique: `slug`

**RLS Policies:**
- SELECT: Members can view orgs they belong to
- INSERT: Authenticated users can create orgs (must be owner)
- UPDATE: Only owners/admins can update
- DELETE: Not allowed via client

---

### `members`

Junction table linking users to organizations with roles.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `extensions.uuid_generate_v4()` | Primary key |
| `org_id` | `uuid` | NO | - | FK to `orgs.id` |
| `user_id` | `uuid` | NO | - | Reference to `auth.users.id` |
| `role` | `text` | NO | - | Role: `owner`, `admin`, `member`, `viewer` |
| `granted_by` | `uuid` | YES | - | User who granted membership |
| `created_at` | `timestamptz` | YES | `now()` | Creation timestamp |

**Constraints:**
- Primary Key: `id`
- Unique: `(org_id, user_id)`
- Foreign Key: `org_id` → `orgs.id`

**RLS Policies:**
- SELECT: Via `is_member_of_org()` function
- INSERT/UPDATE/DELETE: Via `is_member_admin()` function

**Role Hierarchy:**
```
owner > admin > member > viewer
```

---

### `profiles`

Extended user profile data (public schema, linked to auth.users).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | - | PK, matches `auth.users.id` |
| `display_name` | `text` | YES | - | User's display name |
| `avatar_url` | `text` | YES | - | Profile picture URL |
| `bio` | `text` | YES | - | User biography |
| `onboarding_step` | `integer` | NO | `0` | Current onboarding progress |
| `created_at` | `timestamptz` | NO | `now()` | Creation timestamp |
| `updated_at` | `timestamptz` | NO | `now()` | Last update timestamp |

**Constraints:**
- Primary Key: `id`

**Trigger:** Created automatically via `handle_new_user()` trigger on `auth.users`

---

### `invitations`

Pending organization invitations.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `org_id` | `uuid` | NO | - | FK to `orgs.id` |
| `email` | `text` | NO | - | Invitee email address |
| `role` | `text` | NO | `'member'` | Role to assign on acceptance |
| `token` | `text` | NO | `encode(gen_random_bytes(32), 'hex')` | Secure invitation token |
| `invited_by` | `uuid` | NO | - | User who sent invitation |
| `status` | `text` | NO | `'pending'` | Status: `pending`, `accepted`, `expired` |
| `expires_at` | `timestamptz` | NO | `now() + '7 days'` | Expiration timestamp |
| `accepted_at` | `timestamptz` | YES | - | When invitation was accepted |
| `created_at` | `timestamptz` | NO | `now()` | Creation timestamp |

**Constraints:**
- Primary Key: `id`
- Foreign Key: `org_id` → `orgs.id`

---

## Authentication & Security Tables

### `user_totp`

TOTP (Time-based One-Time Password) configuration for 2FA.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `user_id` | `uuid` | NO | - | Reference to `auth.users.id` |
| `secret` | `text` | NO | - | Encrypted TOTP secret |
| `verified` | `boolean` | YES | `false` | Whether TOTP is verified |
| `verified_at` | `timestamptz` | YES | - | Verification timestamp |
| `created_at` | `timestamptz` | YES | `now()` | Creation timestamp |

**RLS:** Users can only access their own TOTP settings.

---

### `user_passkeys`

WebAuthn/Passkey credentials for passwordless authentication.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `user_id` | `uuid` | NO | - | Reference to `auth.users.id` |
| `credential_id` | `text` | NO | - | WebAuthn credential ID |
| `public_key` | `text` | NO | - | Public key for verification |
| `counter` | `bigint` | NO | `0` | Signature counter |
| `transports` | `jsonb` | YES | `'[]'` | Supported transports array |
| `device_name` | `text` | YES | - | User-friendly device name |
| `device_type` | `text` | YES | - | Device type classification |
| `created_at` | `timestamptz` | NO | `now()` | Registration timestamp |
| `last_used_at` | `timestamptz` | YES | - | Last authentication timestamp |

**Constraints:**
- Primary Key: `id`
- Unique: `credential_id`

---

### `backup_codes`

Recovery codes for 2FA bypass.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `user_id` | `uuid` | NO | - | Reference to `auth.users.id` |
| `codes` | `jsonb` | NO | `'[]'` | Array of hashed backup codes |
| `created_at` | `timestamptz` | NO | `now()` | Creation timestamp |
| `updated_at` | `timestamptz` | NO | `now()` | Last update timestamp |

---

### `security_questions`

Account recovery security questions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `user_id` | `uuid` | NO | - | Reference to `auth.users.id` |
| `questions` | `jsonb` | NO | `'[]'` | Array of Q&A pairs (answers hashed) |
| `created_at` | `timestamptz` | NO | `now()` | Creation timestamp |
| `updated_at` | `timestamptz` | NO | `now()` | Last update timestamp |

---

### `user_sessions`

Active user sessions for session management.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `user_id` | `uuid` | NO | - | Reference to `auth.users.id` |
| `session_token` | `text` | NO | - | Unique session identifier |
| `device_name` | `text` | YES | - | Device description |
| `device_type` | `text` | YES | - | Device category |
| `browser` | `text` | YES | - | Browser name |
| `os` | `text` | YES | - | Operating system |
| `ip_address` | `text` | YES | - | Client IP address |
| `location` | `text` | YES | - | Geo-location string |
| `is_current` | `boolean` | YES | `false` | Whether this is current session |
| `created_at` | `timestamptz` | NO | `now()` | Session start |
| `last_active_at` | `timestamptz` | NO | `now()` | Last activity timestamp |
| `expires_at` | `timestamptz` | YES | - | Session expiration |

---

### `login_history`

Audit trail of user login attempts.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `user_id` | `uuid` | NO | - | Reference to `auth.users.id` |
| `ip_address` | `text` | YES | - | Client IP address |
| `user_agent` | `text` | YES | - | Full user agent string |
| `device_name` | `text` | YES | - | Parsed device name |
| `device_type` | `text` | YES | - | Device category |
| `browser` | `text` | YES | - | Browser name |
| `os` | `text` | YES | - | Operating system |
| `location` | `text` | YES | - | Geo-location |
| `is_new_device` | `boolean` | YES | `false` | First login from device |
| `notification_sent` | `boolean` | YES | `false` | Alert sent for new device |
| `created_at` | `timestamptz` | YES | `now()` | Login timestamp |

**RLS:** Insert and select only for own records. No update/delete.

---

### `security_activity_log`

Security-related event logging.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `user_id` | `uuid` | NO | - | Reference to `auth.users.id` |
| `event_type` | `text` | NO | - | Event identifier |
| `event_category` | `text` | NO | `'security'` | Category classification |
| `success` | `boolean` | NO | `true` | Whether action succeeded |
| `failure_reason` | `text` | YES | - | Reason for failure |
| `ip_address` | `text` | YES | - | Client IP |
| `user_agent` | `text` | YES | - | User agent string |
| `device_type` | `text` | YES | - | Device category |
| `browser` | `text` | YES | - | Browser name |
| `os` | `text` | YES | - | Operating system |
| `location` | `text` | YES | - | Geo-location |
| `risk_score` | `integer` | YES | `0` | Calculated risk (0-100) |
| `metadata` | `jsonb` | YES | `'{}'` | Additional event data |
| `created_at` | `timestamptz` | NO | `now()` | Event timestamp |

**RLS:** Insert allowed with valid user_id. Select own records only. No update/delete.

---

### `ip_rate_limits`

IP-based rate limiting state.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `ip_address` | `text` | NO | - | Client IP address |
| `action` | `text` | NO | - | Rate-limited action identifier |
| `attempt_count` | `integer` | NO | `1` | Attempts in current window |
| `first_attempt_at` | `timestamptz` | NO | `now()` | Window start |
| `last_attempt_at` | `timestamptz` | NO | `now()` | Most recent attempt |
| `blocked_until` | `timestamptz` | YES | - | Block expiration (if blocked) |
| `block_count` | `integer` | NO | `0` | Times this IP has been blocked |

**Constraints:**
- Primary Key: `id`
- Unique: `(ip_address, action)`

**RLS:** No direct client access (all operations via security definer functions).

---

### `notification_preferences`

User notification settings.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `user_id` | `uuid` | NO | - | Reference to `auth.users.id` |
| `login_alerts_enabled` | `boolean` | NO | `true` | Email on login |
| `new_device_alerts_enabled` | `boolean` | NO | `true` | Email on new device |
| `security_alerts_enabled` | `boolean` | NO | `true` | Security notifications |
| `created_at` | `timestamptz` | NO | `now()` | Creation timestamp |
| `updated_at` | `timestamptz` | NO | `now()` | Last update timestamp |

---

## Content & Assets Tables

### `assets`

Generated and uploaded content assets.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `extensions.uuid_generate_v4()` | Primary key |
| `org_id` | `uuid` | NO | - | FK to `orgs.id` |
| `user_id` | `uuid` | NO | - | Creator user ID |
| `type` | `text` | NO | - | Asset type: `text`, `image`, `video`, `music` |
| `name` | `text` | NO | - | Asset display name |
| `content_url` | `text` | YES | - | Storage URL for binary content |
| `thumbnail_url` | `text` | YES | - | Preview thumbnail URL |
| `content_data` | `jsonb` | YES | - | Structured content (for text) |
| `provenance` | `jsonb` | YES | - | AI generation metadata |
| `metadata` | `jsonb` | YES | `'{}'` | Additional metadata |
| `license` | `text` | YES | `'all-rights-reserved'` | Content license type |
| `quality_tier` | `text` | YES | `'starter'` | Quality level |
| `human_edited` | `boolean` | YES | `false` | Manual edits applied |
| `platform_config` | `jsonb` | YES | `'{}'` | Platform-specific settings |
| `resolution_config` | `jsonb` | YES | `'{}'` | Resolution variants |
| `layers` | `jsonb` | YES | `'[]'` | Layer composition data |
| `created_at` | `timestamptz` | YES | `now()` | Creation timestamp |

**Provenance Schema:**
```json
{
  "model": "string",
  "provider": "string", 
  "prompt_hash": "string",
  "dataset_tag": "string",
  "generated_at": "ISO timestamp"
}
```

**RLS Policies:**
- SELECT: Org members can view
- INSERT: Org members, must match user_id
- UPDATE/DELETE: Asset owner only

---

### `brand_kits`

Organization brand identity configurations.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `extensions.uuid_generate_v4()` | Primary key |
| `org_id` | `uuid` | NO | - | FK to `orgs.id` |
| `name` | `text` | NO | - | Brand kit name |
| `logo_url` | `text` | YES | - | Brand logo URL |
| `colors` | `jsonb` | YES | `'[]'` | Brand color palette |
| `fonts` | `jsonb` | YES | `'[]'` | Typography settings |
| `brand_voice` | `text` | NO | `'Professional'` | Voice/tone guideline |
| `guidelines` | `text` | YES | - | Additional brand guidelines |
| `created_at` | `timestamptz` | YES | `now()` | Creation timestamp |
| `updated_at` | `timestamptz` | YES | `now()` | Last update timestamp |

**Colors Schema:**
```json
[
  {"name": "Primary", "hex": "#FF7B00"},
  {"name": "Secondary", "hex": "#00B4D8"}
]
```

**Fonts Schema:**
```json
[
  {"name": "Heading", "family": "Sora", "weight": 600},
  {"name": "Body", "family": "Inter", "weight": 400}
]
```

---

### `content_layers`

Reusable content layer templates.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `org_id` | `uuid` | NO | - | FK to `orgs.id` |
| `name` | `text` | NO | - | Layer name |
| `layer_type` | `text` | NO | - | Type: `text`, `image`, `shape`, `video` |
| `platform` | `text` | NO | - | Target platform |
| `config` | `jsonb` | NO | `'{}'` | Layer configuration |
| `thumbnail_url` | `text` | YES | - | Preview thumbnail |
| `is_template` | `boolean` | YES | `false` | Available as template |
| `created_at` | `timestamptz` | NO | `now()` | Creation timestamp |
| `updated_at` | `timestamptz` | NO | `now()` | Last update timestamp |

---

### `templates`

Content templates (org-specific or public).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `extensions.uuid_generate_v4()` | Primary key |
| `org_id` | `uuid` | YES | - | FK to `orgs.id` (null = system template) |
| `name` | `text` | NO | - | Template name |
| `type` | `text` | NO | - | Template type |
| `content` | `jsonb` | NO | - | Template definition |
| `thumbnail_url` | `text` | YES | - | Preview image |
| `is_public` | `boolean` | YES | `false` | Publicly available |
| `created_at` | `timestamptz` | YES | `now()` | Creation timestamp |
| `updated_at` | `timestamptz` | YES | `now()` | Last update timestamp |

---

## Campaign & Scheduling Tables

### `campaigns`

Marketing campaign definitions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `extensions.uuid_generate_v4()` | Primary key |
| `org_id` | `uuid` | NO | - | FK to `orgs.id` |
| `user_id` | `uuid` | NO | - | Campaign creator |
| `name` | `text` | NO | - | Campaign name |
| `description` | `text` | YES | - | Campaign description |
| `status` | `text` | NO | `'draft'` | Status: `draft`, `active`, `paused`, `completed` |
| `objective` | `text` | YES | - | Campaign objective |
| `platforms` | `jsonb` | YES | `'[]'` | Target platforms array |
| `assets` | `jsonb` | YES | `'[]'` | Associated asset IDs |
| `segments` | `jsonb` | YES | `'[]'` | Target segment IDs |
| `schedule_config` | `jsonb` | YES | `'{}'` | Scheduling configuration |
| `start_date` | `timestamptz` | YES | - | Campaign start |
| `end_date` | `timestamptz` | YES | - | Campaign end |
| `budget_cents` | `integer` | YES | `0` | Budget in cents |
| `spent_cents` | `integer` | YES | `0` | Spent amount in cents |
| `metrics` | `jsonb` | YES | `'{}'` | Performance metrics |
| `created_at` | `timestamptz` | YES | `now()` | Creation timestamp |
| `updated_at` | `timestamptz` | YES | `now()` | Last update timestamp |

---

### `campaign_goals`

Campaign performance targets.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `campaign_id` | `uuid` | NO | - | FK to `campaigns.id` |
| `goal_type` | `text` | NO | - | Goal type: `impressions`, `clicks`, `conversions` |
| `target_value` | `integer` | NO | - | Target metric value |
| `current_value` | `integer` | YES | `0` | Current progress |
| `deadline` | `timestamptz` | YES | - | Goal deadline |
| `created_at` | `timestamptz` | YES | `now()` | Creation timestamp |

---

### `segments`

Audience segmentation definitions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `org_id` | `uuid` | NO | - | FK to `orgs.id` |
| `name` | `text` | NO | - | Segment name |
| `description` | `text` | YES | - | Segment description |
| `criteria` | `jsonb` | NO | `'{}'` | Targeting criteria |
| `estimated_reach` | `integer` | YES | `0` | Estimated audience size |
| `created_at` | `timestamptz` | YES | `now()` | Creation timestamp |
| `updated_at` | `timestamptz` | YES | `now()` | Last update timestamp |

---

### `schedules`

Scheduled content posts.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `extensions.uuid_generate_v4()` | Primary key |
| `org_id` | `uuid` | NO | - | FK to `orgs.id` |
| `campaign_id` | `uuid` | YES | - | FK to `campaigns.id` |
| `asset_id` | `uuid` | YES | - | FK to `assets.id` |
| `platform` | `text` | NO | - | Target platform |
| `scheduled_at` | `timestamptz` | NO | - | Scheduled publish time |
| `status` | `text` | NO | `'pending'` | Status: `pending`, `posted`, `failed`, `cancelled` |
| `posted_url` | `text` | YES | - | URL of published post |
| `error_message` | `text` | YES | - | Error details if failed |
| `retries` | `integer` | YES | `0` | Retry attempt count |
| `result` | `jsonb` | YES | - | Platform API response |
| `created_at` | `timestamptz` | YES | `now()` | Creation timestamp |

---

### `integrations`

Social platform OAuth connections.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `org_id` | `uuid` | NO | - | FK to `orgs.id` |
| `provider` | `text` | NO | - | Platform: `instagram`, `twitter`, `linkedin`, etc. |
| `access_token` | `text` | NO | `'***ENCRYPTED***'` | Legacy field (placeholder) |
| `access_token_encrypted` | `bytea` | YES | - | PGP-encrypted access token |
| `refresh_token` | `text` | YES | - | Legacy refresh token |
| `refresh_token_encrypted` | `bytea` | YES | - | PGP-encrypted refresh token |
| `encryption_version` | `integer` | YES | `1` | Encryption schema version |
| `expires_at` | `timestamptz` | YES | - | Token expiration |
| `scope` | `text` | YES | - | OAuth scopes granted |
| `status` | `text` | NO | `'connected'` | Connection status |
| `metadata` | `jsonb` | YES | `'{}'` | Platform-specific metadata |
| `last_sync_at` | `timestamptz` | YES | - | Last data sync |
| `created_at` | `timestamptz` | NO | `now()` | Creation timestamp |
| `updated_at` | `timestamptz` | NO | `now()` | Last update timestamp |

**Constraints:**
- Unique: `(org_id, provider)`

**Note:** Token encryption uses PGP symmetric encryption via `pgp_sym_encrypt()`.

---

## Analytics & Monitoring Tables

### `analytics_events`

Raw analytics event stream.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `org_id` | `uuid` | NO | - | FK to `orgs.id` |
| `user_id` | `uuid` | NO | - | Event actor |
| `event_type` | `text` | NO | - | Event identifier |
| `event_category` | `text` | NO | - | Event category |
| `duration_ms` | `integer` | YES | - | Event duration |
| `metadata` | `jsonb` | YES | `'{}'` | Event-specific data |
| `created_at` | `timestamptz` | YES | `now()` | Event timestamp |

**Common Event Types:**
- `content_generated`, `content_edited`, `content_published`
- `campaign_created`, `campaign_launched`
- `asset_uploaded`, `asset_deleted`

---

### `daily_aggregates`

Pre-aggregated daily metrics.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `org_id` | `uuid` | NO | - | FK to `orgs.id` |
| `date` | `date` | NO | - | Aggregation date |
| `event_type` | `text` | NO | - | Aggregated event type |
| `count` | `integer` | YES | `0` | Event count |
| `total_duration_ms` | `bigint` | YES | `0` | Sum of durations |
| `avg_duration_ms` | `integer` | YES | `0` | Average duration |
| `metadata` | `jsonb` | YES | `'{}'` | Additional aggregations |
| `created_at` | `timestamptz` | YES | `now()` | Aggregation timestamp |

**Constraints:**
- Unique: `(org_id, date, event_type)`

**Note:** Populated by `aggregate_daily_events()` function.

---

### `audit_log`

Administrative action audit trail.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `org_id` | `uuid` | NO | - | Organization context |
| `user_id` | `uuid` | NO | - | Actor user ID |
| `action` | `text` | NO | - | Action identifier |
| `resource_type` | `text` | NO | - | Affected resource type |
| `resource_id` | `text` | NO | - | Affected resource ID |
| `metadata` | `jsonb` | YES | `'{}'` | Action details |
| `created_at` | `timestamptz` | NO | `now()` | Action timestamp |

**RLS:** Only org admins/owners can view. No client insert/update/delete.

---

### `incidents`

Operational incident tracking.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `org_id` | `uuid` | NO | - | FK to `orgs.id` |
| `title` | `text` | NO | - | Incident title |
| `description` | `text` | YES | - | Incident description |
| `severity` | `incident_severity` | NO | `'warning'` | Severity level |
| `status` | `incident_status` | NO | `'open'` | Current status |
| `source_type` | `text` | YES | - | Incident source |
| `source_name` | `text` | YES | - | Source identifier |
| `alert_id` | `text` | YES | - | Related alert ID |
| `created_by` | `uuid` | NO | - | Reporter user ID |
| `assigned_to` | `uuid` | YES | - | Assignee user ID |
| `started_at` | `timestamptz` | NO | `now()` | Incident start |
| `acknowledged_at` | `timestamptz` | YES | - | Acknowledgment time |
| `resolved_at` | `timestamptz` | YES | - | Resolution time |
| `resolution_notes` | `text` | YES | - | Resolution details |
| `metadata` | `jsonb` | YES | `'{}'` | Additional data |
| `created_at` | `timestamptz` | NO | `now()` | Creation timestamp |
| `updated_at` | `timestamptz` | NO | `now()` | Last update timestamp |

---

### `incident_updates`

Timeline of incident status changes.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `incident_id` | `uuid` | NO | - | FK to `incidents.id` |
| `user_id` | `uuid` | NO | - | Update author |
| `update_type` | `text` | NO | - | Update type |
| `previous_value` | `text` | YES | - | Previous state |
| `new_value` | `text` | YES | - | New state |
| `message` | `text` | YES | - | Update message |
| `created_at` | `timestamptz` | NO | `now()` | Update timestamp |

---

### `usage_credits`

Organization usage tracking and limits.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `org_id` | `uuid` | NO | - | PK, FK to `orgs.id` |
| `plan` | `text` | NO | `'STARTER'` | Subscription plan |
| `used_tokens` | `bigint` | NO | `0` | AI tokens consumed |
| `hard_limit_tokens` | `bigint` | NO | `1000000` | Token limit |
| `video_minutes_used` | `integer` | YES | `0` | Video generation minutes |
| `video_minutes_limit` | `integer` | YES | `10` | Video minute limit |
| `image_generations_used` | `integer` | YES | `0` | Image generations count |
| `image_generations_limit` | `integer` | YES | `100` | Image generation limit |
| `max_resolution` | `text` | YES | `'1080p'` | Maximum resolution |
| `features` | `jsonb` | YES | `'[]'` | Enabled features |
| `month_start` | `timestamptz` | NO | `date_trunc('month', now())` | Billing period start |
| `updated_at` | `timestamptz` | NO | `now()` | Last update |

**Constraints:**
- Primary Key: `org_id`

---

## Marketplace & Library Tables

### `marketplace_items`

Purchasable content and templates.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `extensions.uuid_generate_v4()` | Primary key |
| `name` | `text` | NO | - | Item name |
| `description` | `text` | YES | - | Item description |
| `type` | `text` | NO | - | Item type |
| `content` | `jsonb` | NO | - | Item payload |
| `thumbnail_url` | `text` | YES | - | Preview image |
| `price_cents` | `integer` | YES | `0` | Price (0 = free) |
| `creator_id` | `uuid` | YES | - | Creator user ID |
| `downloads` | `integer` | YES | `0` | Download count |
| `created_at` | `timestamptz` | YES | `now()` | Creation timestamp |

**RLS:** Anyone can view. Creators can manage their items.

---

### `marketplace_purchases`

Purchase records.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `user_id` | `uuid` | NO | - | Purchaser user ID |
| `org_id` | `uuid` | NO | - | Purchasing organization |
| `item_id` | `uuid` | NO | - | FK to `marketplace_items.id` |
| `amount_cents` | `integer` | NO | - | Purchase amount |
| `payment_status` | `text` | NO | `'completed'` | Payment status |
| `purchase_date` | `timestamptz` | NO | `now()` | Purchase timestamp |
| `downloaded_at` | `timestamptz` | YES | - | First download time |

---

### `library_items`

Internal component library.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `slug` | `text` | NO | - | URL-safe identifier |
| `name` | `text` | NO | - | Item name |
| `version` | `text` | NO | - | Semantic version |
| `kind` | `text` | NO | - | Item type: `component`, `template`, `workflow` |
| `summary` | `text` | YES | - | Brief description |
| `license` | `text` | NO | `'INTERNAL'` | License type |
| `payload` | `jsonb` | NO | - | Item definition |
| `thumbnail_url` | `text` | YES | - | Preview image |
| `author` | `text` | YES | - | Author name |
| `tags` | `text[]` | YES | `ARRAY[]::text[]` | Search tags |
| `publication_status` | `text` | YES | `'public'` | Visibility: `public`, `org`, `private` |
| `created_at` | `timestamptz` | NO | `now()` | Creation timestamp |
| `updated_at` | `timestamptz` | NO | `now()` | Last update timestamp |

**Constraints:**
- Unique: `(slug, version)`

---

### `library_installs`

Library item installation records.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `org_id` | `uuid` | NO | - | FK to `orgs.id` |
| `item_id` | `uuid` | NO | - | FK to `library_items.id` |
| `version` | `text` | NO | - | Installed version |
| `installed_by` | `uuid` | YES | - | Installing user |
| `backup_snapshot` | `jsonb` | YES | - | Pre-install state |
| `installed_at` | `timestamptz` | NO | `now()` | Installation timestamp |

**Constraints:**
- Unique: `(org_id, item_id)`

---

## Database Functions

### Authentication & Authorization

#### `is_member_of_org(user_id, org_id)`
Returns `boolean`. Checks if user is a member of the organization.

```sql
SELECT is_member_of_org(auth.uid(), 'org-uuid');
```

#### `is_member_admin(user_id, org_id)`
Returns `boolean`. Checks if user is owner or admin of the organization.

#### `user_org_ids(user_id)`
Returns `TABLE(org_id uuid)`. Lists all organizations the user belongs to.

### Organization Management

#### `create_org_with_owner(name, slug, timezone?, locale?)`
Creates organization and adds current user as owner. Returns org ID.

```sql
SELECT create_org_with_owner('My Company', 'my-company', 'America/New_York', 'en-US');
```

### Usage Tracking

#### `increment_usage_tokens(org_id, tokens)`
Atomically increments token usage. Returns JSON with usage status.

```json
{"ok": true, "used_tokens": 5000, "remaining_tokens": 995000, "limit": 1000000}
```

#### `increment_video_usage(org_id, minutes)`
Atomically increments video minutes. Returns JSON with usage status.

### Rate Limiting

#### `check_ip_rate_limit(ip_address, action, max_attempts?, window_minutes?, block_minutes?)`
Checks and updates rate limit state. Returns JSON with limit status.

```json
{"allowed": true, "remaining": 8, "blocked_until": null, "attempt_count": 2}
```

#### `reset_ip_rate_limit(ip_address, action)`
Resets rate limit counter for IP/action combination.

### Integration Security

#### `write_encrypted_integration(...)`
Securely stores OAuth tokens with PGP encryption.

#### `decrypt_integration_token(integration_id, encryption_key, token_type)`
Decrypts stored OAuth token. Requires admin role.

### Analytics

#### `aggregate_daily_events()`
Aggregates previous day's events into `daily_aggregates` table.

#### `get_event_summary(org_id, start_date?, end_date?)`
Returns aggregated event statistics for date range.

### Marketplace

#### `get_marketplace_content(item_id)`
Returns marketplace item content. Handles access control and download tracking.

---

## Indexes

### Primary Key Indexes (Automatic)
All tables have B-tree indexes on their primary keys.

### Unique Constraint Indexes

| Table | Columns | Type |
|-------|---------|------|
| `orgs` | `slug` | B-tree |
| `members` | `(org_id, user_id)` | B-tree |
| `user_passkeys` | `credential_id` | B-tree |
| `ip_rate_limits` | `(ip_address, action)` | B-tree |
| `integrations` | `(org_id, provider)` | B-tree |
| `daily_aggregates` | `(org_id, date, event_type)` | B-tree |
| `library_items` | `(slug, version)` | B-tree |
| `library_installs` | `(org_id, item_id)` | B-tree |

### Recommended Additional Indexes

```sql
-- Frequently queried by org_id
CREATE INDEX idx_assets_org_id ON assets(org_id);
CREATE INDEX idx_campaigns_org_id ON campaigns(org_id);
CREATE INDEX idx_schedules_org_id ON schedules(org_id);
CREATE INDEX idx_brand_kits_org_id ON brand_kits(org_id);

-- Time-based queries
CREATE INDEX idx_schedules_scheduled_at ON schedules(scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_analytics_events_created_at ON analytics_events(created_at);

-- Status filtering
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_schedules_status ON schedules(status);
CREATE INDEX idx_invitations_status ON invitations(status) WHERE status = 'pending';
```

---

## Row-Level Security Policies

### Policy Pattern: Org Membership

Most tables use this pattern for org-scoped access:

```sql
-- SELECT policy
CREATE POLICY "Org members can view" ON table_name
FOR SELECT USING (
  org_id IN (
    SELECT org_id FROM members WHERE user_id = auth.uid()
  )
);

-- ALL policy (for full CRUD)
CREATE POLICY "Org members can manage" ON table_name
FOR ALL USING (
  org_id IN (
    SELECT org_id FROM members WHERE user_id = auth.uid()
  )
);
```

### Policy Pattern: Admin-Only

```sql
CREATE POLICY "Org admins only" ON table_name
FOR ALL USING (
  org_id IN (
    SELECT org_id FROM members 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin')
  )
);
```

### Policy Pattern: Owner-Only

```sql
CREATE POLICY "Users manage own records" ON table_name
FOR ALL USING (user_id = auth.uid());
```

### Tables Without Client Access

These tables have RLS policies that block all client operations:
- `ip_rate_limits` - Managed via security definer functions
- `audit_log` - Insert via server-side functions only
- `daily_aggregates` - Populated by scheduled aggregation

---

## Enums

### `incident_severity`
```sql
CREATE TYPE incident_severity AS ENUM (
  'critical',
  'major', 
  'minor',
  'warning'
);
```

### `incident_status`
```sql
CREATE TYPE incident_status AS ENUM (
  'open',
  'investigating',
  'identified',
  'monitoring',
  'resolved'
);
```

---

## Views

### `marketplace_items_preview`

Public view of marketplace items without content payload.

| Column | Source |
|--------|--------|
| `id` | `marketplace_items.id` |
| `name` | `marketplace_items.name` |
| `type` | `marketplace_items.type` |
| `description` | `marketplace_items.description` |
| `thumbnail_url` | `marketplace_items.thumbnail_url` |
| `price_cents` | `marketplace_items.price_cents` |
| `downloads` | `marketplace_items.downloads` |
| `creator_id` | `marketplace_items.creator_id` |
| `created_at` | `marketplace_items.created_at` |

### `integrations_admin_view`

Admin view of integrations with token status (not actual tokens).

| Column | Description |
|--------|-------------|
| `id` | Integration ID |
| `org_id` | Organization ID |
| `provider` | Platform name |
| `status` | Connection status |
| `scope` | OAuth scopes |
| `expires_at` | Token expiration |
| `access_token_status` | `'set'` or `'not_set'` |
| `refresh_token_status` | `'set'` or `'not_set'` |
| `encryption_version` | Encryption schema version |
| `metadata` | Platform metadata |
| `created_at` | Creation timestamp |
| `updated_at` | Last update timestamp |

---

## Storage Buckets

| Bucket | Public | Purpose |
|--------|--------|---------|
| `avatars` | Yes | User profile pictures |
| `brand-logos` | Yes | Organization brand logos |
| `assets` | No | Generated/uploaded content |

---

## Migration History

Migrations are stored in `supabase/migrations/` and applied in timestamp order.

See `supabase/migrations/` directory for full migration history.

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-21 | Initial schema documentation |
