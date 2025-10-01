# Secrets Rotation Playbook

**Purpose**: Step-by-step procedures for rotating sensitive credentials without downtime.

---

## 1. Supabase Anon Key Rotation

**Frequency**: Quarterly or on suspected compromise  
**Downtime**: ~5 minutes (graceful handoff)

### Pre-Rotation Checklist
- [ ] Announce maintenance window (2 hours in advance)
- [ ] Backup current key to 1Password
- [ ] Alert monitoring team

### Steps

#### 1.1 Generate New Key
```bash
# In Supabase Dashboard → Settings → API
# Click "Regenerate" next to anon/public key
# Save new key to clipboard
```

#### 1.2 Update Lovable Cloud Secrets
```bash
# Via Lovable Dashboard or CLI
lovable secrets set SUPABASE_ANON_KEY="<new_key>"
```

#### 1.3 Deploy Frontend
```bash
# Lovable auto-deploys on secret change
# Verify in preview: Check Network tab for new key in requests
```

#### 1.4 Verify Old Key Still Works (Grace Period)
```bash
curl -H "Authorization: Bearer <old_key>" \
  https://<project>.supabase.co/rest/v1/assets?select=id&limit=1
# Expected: 200 OK (Supabase keeps old key valid for 24h)
```

#### 1.5 Monitor Error Rates
- Check Sentry for `401 Unauthorized` spikes
- If >1% error rate, rollback immediately

#### 1.6 Invalidate Old Key (After 24h)
```bash
# In Supabase Dashboard → Settings → API
# Click "Revoke Old Keys"
```

### Rollback Procedure
```bash
# If new key causes issues:
lovable secrets set SUPABASE_ANON_KEY="<old_key>"
# Wait 2 minutes for propagation
# Investigate root cause before re-attempting
```

---

## 2. Supabase Service Role Key Rotation

**Frequency**: Quarterly  
**Downtime**: None (server-side only)

### Steps

#### 2.1 Generate New Service Role Key
```bash
# Supabase Dashboard → Settings → API → Service Role
# Click "Regenerate"
```

#### 2.2 Update Edge Function Secrets
```bash
# Via Supabase CLI
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="<new_key>"

# Or manually in Supabase Dashboard → Edge Functions → Environment Variables
```

#### 2.3 Redeploy All Edge Functions
```bash
supabase functions deploy generate-content
# Repeat for all functions
```

#### 2.4 Test Admin Operations
```bash
# Test with new key
curl -X POST \
  -H "Authorization: Bearer <new_service_role_key>" \
  -d '{"email":"test@example.com"}' \
  https://<project>.supabase.co/auth/v1/admin/users
# Expected: 200 OK
```

---

## 3. Lovable AI API Key Rotation

**Frequency**: Monthly  
**Downtime**: None (key is rate-limited, not auth)

### Steps

#### 3.1 Request New Key
```bash
# Contact Lovable support or generate via dashboard
# https://lovable.app/dashboard/api-keys
```

#### 3.2 Update Secret
```bash
lovable secrets set LOVABLE_API_KEY="<new_key>"
```

#### 3.3 Test Content Generation
```bash
# Via app UI: Create test asset in Content Studio
# Or curl:
curl -X POST \
  -H "Authorization: Bearer <user_jwt>" \
  https://<project>.supabase.co/functions/v1/generate-content \
  -d '{"type":"text","prompt":"Hello world","org_id":"<org_id>"}'
# Expected: 200 OK with asset ID
```

#### 3.4 Revoke Old Key
```bash
# In Lovable Dashboard → API Keys → Revoke
```

---

## 4. Stripe Secret Key Rotation

**Frequency**: Quarterly or on breach  
**Downtime**: None (dual-key pattern)

### Steps

#### 4.1 Create Restricted Key (Stripe Dashboard)
```bash
# Stripe Dashboard → Developers → API Keys → Create Restricted Key
# Permissions: Customers (read/write), Charges (read/write)
# Name: "FlashFusion-2025-Q4"
```

#### 4.2 Test Key in Staging
```bash
# Update staging secret
lovable secrets set STRIPE_SECRET_KEY="<new_restricted_key>" --env staging

# Create test charge
curl https://api.stripe.com/v1/charges \
  -u "<new_restricted_key>:" \
  -d amount=1000 \
  -d currency=usd \
  -d source=tok_visa
# Expected: 200 OK
```

#### 4.3 Deploy to Production
```bash
lovable secrets set STRIPE_SECRET_KEY="<new_restricted_key>" --env production
```

#### 4.4 Monitor Stripe Webhooks
- Check webhook delivery in Stripe Dashboard
- Verify billing events flow to database

#### 4.5 Roll Old Key (After 7 Days)
```bash
# In Stripe Dashboard → Developers → API Keys → Delete
```

---

## 5. Emergency Rotation (Suspected Breach)

**Trigger**: Key found in public GitHub repo, Slack message, logs

### Immediate Actions (Within 15 Minutes)

1. **Revoke Compromised Key**
   ```bash
   # Supabase: Dashboard → API → Revoke
   # Stripe: Dashboard → API Keys → Delete
   ```

2. **Generate & Deploy New Key**
   ```bash
   # Follow standard rotation procedure but skip grace period
   lovable secrets set <KEY_NAME>="<new_value>" --env production --force
   ```

3. **Audit Access Logs**
   ```bash
   # Supabase: Logs → Auth Logs → Filter by time range
   # Stripe: Events → Filter "api_key" + compromised key
   ```

4. **Notify Stakeholders**
   - Email security@flashfusion.co
   - Post in Slack #security-incidents
   - Prepare customer communication (if data accessed)

### Post-Incident (Within 24 Hours)

- [ ] Root cause analysis (how was key leaked?)
- [ ] Update secret scanning rules (GitHub Advanced Security)
- [ ] Review RLS logs for unauthorized access
- [ ] Consider forced password reset for all users (worst case)

---

## 6. Rotation Testing Schedule

| Environment | Frequency | Next Due |
|-------------|-----------|----------|
| Development | Every commit (auto) | N/A |
| Staging | Weekly | 2025-10-08 |
| Production | Quarterly | 2026-01-01 |

### Automated Rotation (Future TODO)

```yaml
# .github/workflows/rotate-secrets.yml
name: Quarterly Secret Rotation
on:
  schedule:
    - cron: '0 0 1 */3 *' # Every 3 months

jobs:
  rotate:
    runs-on: ubuntu-latest
    steps:
      - name: Generate New Anon Key
        run: |
          # Call Supabase Management API
          NEW_KEY=$(curl -X POST ...)
          echo "::add-mask::$NEW_KEY"
          gh secret set SUPABASE_ANON_KEY --body "$NEW_KEY"
      
      - name: Deploy & Verify
        run: |
          npm run build
          npm run test:e2e
      
      - name: Notify Team
        run: |
          curl -X POST $SLACK_WEBHOOK \
            -d '{"text":"✅ Quarterly secret rotation complete"}'
```

---

## 7. Secret Escrow (Disaster Recovery)

**Scenario**: CTO hit by bus, secrets lost

### Backup Locations
1. **1Password Vault**: `FlashFusion-Production-Secrets`
   - Owner: CTO + VP Eng
   - Emergency access: 3-day waiting period

2. **Encrypted USB Drive**: In office safe
   - Contents: All secrets as of last rotation
   - Updated: Quarterly

3. **Supabase Backups**: Auto-encrypted
   - Secrets stored in `vault.secrets` table
   - Access: Service role key only

### Recovery Procedure
```bash
# 1. Access 1Password emergency kit
# 2. Retrieve "Production Master Key"
# 3. Decrypt USB backup:
gpg --decrypt secrets-backup.gpg > .env.production

# 4. Re-add to Lovable Cloud:
source .env.production
lovable secrets set SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"
# ... repeat for all secrets

# 5. Verify app functionality
curl https://flashfusion.lovable.app/api/health
```

---

## 8. Compliance Audit Trail

Every rotation must be logged:

```json
{
  "timestamp": "2025-10-01T12:00:00Z",
  "secret_name": "SUPABASE_ANON_KEY",
  "action": "rotated",
  "actor": "eng-team@flashfusion.co",
  "reason": "quarterly_schedule",
  "old_key_hash": "sha256:abc123...",
  "new_key_hash": "sha256:def456...",
  "verification_tests_passed": true
}
```

Store in:
- Supabase `audit_logs` table
- Slack #security-incidents (automated bot)
- PagerDuty incident report

---

## Contact

- **On-Call Engineer**: [pagerduty.com/flashfusion](https://pagerduty.com/flashfusion)
- **Security Lead**: security@flashfusion.co
- **Supabase Support**: support@supabase.io (Enterprise plan)

---

**Last Updated**: 2025-10-01  
**Maintained By**: Security Team
