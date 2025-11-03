-- Enable pgcrypto extension for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add encrypted token columns to integrations table
ALTER TABLE public.integrations 
  ADD COLUMN IF NOT EXISTS access_token_encrypted BYTEA,
  ADD COLUMN IF NOT EXISTS refresh_token_encrypted BYTEA,
  ADD COLUMN IF NOT EXISTS encryption_version INTEGER DEFAULT 1;

-- Create security definer function for encrypted token writes
CREATE OR REPLACE FUNCTION public.write_encrypted_integration(
  p_org_id UUID,
  p_provider TEXT,
  p_access_token TEXT,
  p_refresh_token TEXT,
  p_expires_at TIMESTAMPTZ,
  p_scope TEXT,
  p_metadata JSONB,
  p_encryption_key TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_integration_id UUID;
BEGIN
  -- Verify caller is member of org
  IF NOT EXISTS (
    SELECT 1 FROM members 
    WHERE user_id = auth.uid() AND org_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized: not a member of organization';
  END IF;

  -- Upsert with encrypted tokens
  INSERT INTO integrations (
    org_id, provider, 
    access_token_encrypted, 
    refresh_token_encrypted,
    expires_at, scope, metadata, 
    status, encryption_version,
    created_at, updated_at
  ) VALUES (
    p_org_id, p_provider,
    pgp_sym_encrypt(p_access_token, p_encryption_key),
    CASE WHEN p_refresh_token IS NOT NULL 
         THEN pgp_sym_encrypt(p_refresh_token, p_encryption_key) 
         ELSE NULL END,
    p_expires_at, p_scope, p_metadata,
    'connected', 1,
    NOW(), NOW()
  )
  ON CONFLICT (org_id, provider) DO UPDATE SET
    access_token_encrypted = pgp_sym_encrypt(p_access_token, p_encryption_key),
    refresh_token_encrypted = CASE WHEN p_refresh_token IS NOT NULL 
                                   THEN pgp_sym_encrypt(p_refresh_token, p_encryption_key) 
                                   ELSE NULL END,
    expires_at = p_expires_at,
    scope = p_scope,
    metadata = p_metadata,
    status = 'connected',
    updated_at = NOW()
  RETURNING id INTO v_integration_id;

  -- Audit log
  INSERT INTO audit_log (org_id, user_id, action, resource_type, resource_id)
  VALUES (p_org_id, auth.uid(), 'integration_token_updated', 'integration', v_integration_id::text);

  RETURN v_integration_id;
END;
$$;

-- Create security definer function for token decryption (admin-only)
CREATE OR REPLACE FUNCTION public.decrypt_integration_token(
  p_integration_id UUID,
  p_encryption_key TEXT,
  p_token_type TEXT
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_encrypted_token BYTEA;
  v_decrypted_token TEXT;
BEGIN
  -- Get integration and verify authorization
  SELECT org_id, 
         CASE WHEN p_token_type = 'access' THEN access_token_encrypted
              ELSE refresh_token_encrypted END
  INTO v_org_id, v_encrypted_token
  FROM integrations
  WHERE id = p_integration_id;

  -- Verify caller is admin of the org
  IF NOT EXISTS (
    SELECT 1 FROM members 
    WHERE user_id = auth.uid() 
      AND org_id = v_org_id 
      AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  -- Decrypt
  v_decrypted_token := pgp_sym_decrypt(v_encrypted_token, p_encryption_key);

  -- Audit access
  INSERT INTO audit_log (org_id, user_id, action, resource_type, resource_id, metadata)
  VALUES (v_org_id, auth.uid(), 'integration_token_accessed', 'integration', 
          p_integration_id::text, jsonb_build_object('token_type', p_token_type));

  RETURN v_decrypted_token;
END;
$$;

-- Create admin-only view (never exposes decrypted tokens)
CREATE OR REPLACE VIEW integrations_admin_view AS
SELECT 
  id, org_id, provider, status, scope, expires_at, metadata,
  CASE WHEN access_token_encrypted IS NOT NULL THEN '***ENCRYPTED***' ELSE NULL END as access_token_status,
  CASE WHEN refresh_token_encrypted IS NOT NULL THEN '***ENCRYPTED***' ELSE NULL END as refresh_token_status,
  encryption_version, created_at, updated_at
FROM integrations;

-- Grant view access to authenticated users (RLS still applies)
GRANT SELECT ON integrations_admin_view TO authenticated;

-- Create function for video usage tracking
CREATE OR REPLACE FUNCTION public.increment_video_usage(
  p_org_id UUID,
  p_minutes NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_used INTEGER;
  v_limit INTEGER;
BEGIN
  -- Verify authorization
  IF NOT EXISTS (
    SELECT 1 FROM members
    WHERE user_id = auth.uid() AND org_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'Not authorized for this organization';
  END IF;
  
  -- Lock and update atomically
  UPDATE usage_credits
  SET video_minutes_used = video_minutes_used + p_minutes::INTEGER,
      updated_at = NOW()
  WHERE org_id = p_org_id
  RETURNING video_minutes_used, video_minutes_limit 
  INTO v_new_used, v_limit;
  
  IF NOT FOUND THEN
    INSERT INTO usage_credits (org_id, video_minutes_used)
    VALUES (p_org_id, p_minutes::INTEGER)
    RETURNING video_minutes_used, video_minutes_limit INTO v_new_used, v_limit;
  END IF;
  
  RETURN jsonb_build_object(
    'ok', v_new_used <= v_limit,
    'used', v_new_used,
    'limit', v_limit,
    'remaining', GREATEST(0, v_limit - v_new_used)
  );
END;
$$;