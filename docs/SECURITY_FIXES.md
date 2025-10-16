# Security Fixes Implementation Guide

This document outlines the comprehensive security fixes implemented to address three critical vulnerabilities identified in the security audit.

## Issues Fixed

### 1. PUBLIC_USER_DATA - Profiles Publicly Exposed
**Severity:** Critical (Error)
**Issue:** The `profiles` table was readable by anyone, including unauthenticated users, exposing display names, avatars, and bios.

**Fix Applied:**
- ✅ Migration: `20251016125000_fix_profiles_rls.sql`
- ✅ Removed public SELECT policy `"Anyone can view profiles"`
- ✅ Created security definer function `user_can_view_profile()` to avoid RLS recursion
- ✅ New policy: Users can only view profiles of:
  - Themselves
  - Members of organizations they belong to
- ✅ Added performance index on `members(user_id, org_id)`

### 2. PUBLIC_SENSITIVE_DATA - API Tokens Exposed
**Severity:** Critical (Error)
**Issue:** Integration access tokens and refresh tokens were visible in plaintext to all organization members.

**Fix Applied:**
- ✅ Migration: `20251016125100_fix_integrations_encryption.sql`
- ✅ Enabled `pgcrypto` extension for token encryption
- ✅ Added encrypted columns: `access_token_enc`, `refresh_token_enc` (bytea)
- ✅ Deprecated plaintext columns (renamed to `*_deprecated`)
- ✅ Restricted SELECT to admins only (owner/admin roles)
- ✅ Created `integrations_admin_view` that shows only masked tokens (`***ENCRYPTED***`)
- ✅ Added `rotate_integration_token()` function for secure token rotation
- ✅ Edge Function: `integrations-write-token` for secure token writing

**Edge Function:** `supabase/functions/integrations-write-token/index.ts`
- Authenticates requests via JWT
- Verifies org membership (admin preferred)
- Encrypts tokens using `KEYRING_TOKEN` environment variable
- Never returns decrypted tokens
- Logs only hashed identifiers

### 3. PUBLIC_BUSINESS_DATA - Library Content Exposed
**Severity:** Critical (Error)
**Issue:** Internal library items were viewable by anyone, including competitors.

**Fix Applied:**
- ✅ Migration: `20251016125200_fix_library_items_rls.sql`
- ✅ Removed public SELECT policy `"Anyone can view library items"`
- ✅ Added `is_published` column (defaults to `false`)
- ✅ New policy: Authenticated users can view:
  - Published items with permissive licenses (PUBLIC, CC-BY, CC0, MIT, Apache-2.0)
  - All items from their own organization
- ✅ Anonymous users: NO ACCESS (optional policy commented out)
- ✅ Set default license to `INTERNAL`
- ✅ Added performance indexes

## Deployment Instructions

### Prerequisites
1. Ensure you have Supabase CLI installed
2. Have admin access to your Supabase project
3. Prepare a secure encryption key for token migration

### Step 1: Set Migration Key (One-Time)
Before running migrations, set a temporary encryption key:

```sql
-- In psql or Supabase SQL editor
SELECT set_config('app.migration_key', 'YOUR_SECURE_RANDOM_KEY_HERE', true);
```

⚠️ **IMPORTANT:** Never commit this key. Use it only for the migration.

### Step 2: Apply Migrations
```bash
# Push all migrations
supabase db push

# Verify migrations applied
supabase db list-migrations
```

### Step 3: Deploy Edge Function
```bash
# Deploy the token writing function
supabase functions deploy integrations-write-token

# Set the encryption key secret
supabase secrets set KEYRING_TOKEN=$(openssl rand -base64 32)
```

### Step 4: Update Application Code

**Before (Insecure):**
```typescript
// ❌ DON'T: Direct client-side token reads
const { data } = await supabase
  .from('integrations')
  .select('*');  // Exposes tokens!
```

**After (Secure):**
```typescript
// ✅ DO: Use admin view for metadata only
const { data } = await supabase
  .from('integrations_admin_view')
  .select('*');  // Returns masked tokens only

// ✅ DO: Write tokens via edge function
await supabase.functions.invoke('integrations-write-token', {
  body: {
    org_id: 'uuid',
    provider: 'twitter',
    access_token: 'secret_token',
    refresh_token: 'secret_refresh',
    expires_at: '2024-12-31T00:00:00Z'
  }
});
```

### Step 5: Smoke Tests

Run the following checks:

```bash
# Test 1: Verify anon cannot read profiles
curl -X GET "https://YOUR_PROJECT.supabase.co/rest/v1/profiles" \
  -H "apikey: YOUR_ANON_KEY"
# Expected: 401 or empty result

# Test 2: Verify member can read org profiles only
curl -X GET "https://YOUR_PROJECT.supabase.co/rest/v1/profiles" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer USER_JWT"
# Expected: Only profiles from user's orgs

# Test 3: Verify integrations are admin-only
curl -X GET "https://YOUR_PROJECT.supabase.co/rest/v1/integrations" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer MEMBER_JWT"
# Expected: 403 or empty (if not admin)

# Test 4: Verify library items are restricted
curl -X GET "https://YOUR_PROJECT.supabase.co/rest/v1/library_items" \
  -H "apikey: YOUR_ANON_KEY"
# Expected: 401 or empty result
```

### Step 6: Verify Data Encryption

```sql
-- Check that tokens are encrypted
SELECT 
  id,
  provider,
  CASE WHEN access_token_enc IS NOT NULL THEN 'ENCRYPTED' ELSE 'MISSING' END as access_token_status,
  CASE WHEN refresh_token_enc IS NOT NULL THEN 'ENCRYPTED' ELSE 'MISSING' END as refresh_token_status
FROM public.integrations;

-- Verify old columns are renamed/dropped
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'integrations' 
  AND column_name LIKE '%token%';
```

## Security Checklist

- [ ] All three migrations applied successfully
- [ ] `KEYRING_TOKEN` secret configured in edge function
- [ ] Temporary `app.migration_key` was NOT committed
- [ ] Plaintext token columns dropped or renamed
- [ ] Edge function `integrations-write-token` deployed
- [ ] Application code updated to use `integrations_admin_view`
- [ ] Application code updated to use edge function for token writes
- [ ] Smoke tests passing (anon blocked, members scoped correctly)
- [ ] Performance indexes created
- [ ] Audit logs reviewed for any suspicious access

## Rollback Plan

If issues arise, rollback each migration:

### Rollback Profiles
```sql
DROP POLICY "profiles_select_same_org_or_self" ON public.profiles;
DROP POLICY "profiles_insert_self" ON public.profiles;
DROP POLICY "profiles_update_self_or_admin" ON public.profiles;
DROP FUNCTION public.user_can_view_profile;
CREATE POLICY "Anyone can view profiles" ON public.profiles FOR SELECT USING (true);
```

### Rollback Integrations
```sql
-- Restore plaintext columns
ALTER TABLE public.integrations ADD COLUMN access_token text;
ALTER TABLE public.integrations ADD COLUMN refresh_token text;

-- Decrypt (requires migration key)
UPDATE public.integrations
SET access_token = pgp_sym_decrypt(access_token_enc, 'MIGRATION_KEY'),
    refresh_token = pgp_sym_decrypt(refresh_token_enc, 'MIGRATION_KEY')
WHERE access_token_enc IS NOT NULL;

-- Drop encrypted columns
ALTER TABLE public.integrations DROP COLUMN access_token_enc;
ALTER TABLE public.integrations DROP COLUMN refresh_token_enc;

-- Restore old policies
DROP POLICY "integrations_select_admins_only" ON public.integrations;
CREATE POLICY "Org members can view their integrations" ON public.integrations FOR SELECT USING (...);
```

### Rollback Library Items
```sql
DROP POLICY "library_items_select_published_or_org" ON public.library_items;
DROP POLICY "library_items_insert_members" ON public.library_items;
DROP POLICY "library_items_update_owner_or_admin" ON public.library_items;
DROP POLICY "library_items_delete_admin" ON public.library_items;
CREATE POLICY "Anyone can view library items" ON public.library_items FOR SELECT USING (true);
```

## Monitoring & Maintenance

### Token Rotation
Rotate the `KEYRING_TOKEN` quarterly:

```bash
# Generate new key
NEW_KEY=$(openssl rand -base64 32)

# Update secret
supabase secrets set KEYRING_TOKEN=$NEW_KEY

# Re-encrypt all tokens (requires custom migration or manual batch process)
```

### Audit Logs
Monitor who accesses sensitive data:

```sql
-- Check integration access (requires audit_log table)
SELECT user_id, action, resource_type, created_at
FROM audit_log
WHERE resource_type = 'integrations'
ORDER BY created_at DESC
LIMIT 100;
```

### Performance Monitoring
```sql
-- Check slow queries on members table
SELECT * FROM pg_stat_statements 
WHERE query LIKE '%members%' 
ORDER BY mean_exec_time DESC;
```

## Additional Security Recommendations

1. **Multi-Factor Authentication:** Enable MFA for all admin accounts
2. **IP Allowlisting:** Restrict admin access to known IPs
3. **Key Rotation:** Implement automated quarterly key rotation
4. **Secrets Management:** Consider migrating to Vault or AWS KMS for token encryption
5. **Rate Limiting:** Implement rate limiting on all edge functions
6. **Audit Trail:** Enable comprehensive audit logging for all data access
7. **Compliance:** Review GDPR/CCPA compliance for user data handling

## Support & Questions

For questions about these security fixes:
1. Review the migration SQL files for detailed comments
2. Check edge function code for implementation details
3. Refer to Supabase RLS documentation: https://supabase.com/docs/guides/auth/row-level-security
4. Consult pgcrypto documentation: https://www.postgresql.org/docs/current/pgcrypto.html
