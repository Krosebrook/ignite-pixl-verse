-- First, update the write_encrypted_integration function to use a placeholder for the required access_token column
-- Then we'll drop the plaintext columns

-- Update the function to insert a placeholder value for the legacy access_token column
CREATE OR REPLACE FUNCTION public.write_encrypted_integration(
  p_org_id UUID,
  p_provider TEXT,
  p_access_token TEXT,
  p_refresh_token TEXT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL,
  p_scope TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB,
  p_encryption_key TEXT DEFAULT NULL
)
RETURNS UUID
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

  -- Upsert with encrypted tokens only (use placeholder for legacy access_token column)
  INSERT INTO integrations (
    org_id, provider, 
    access_token,
    access_token_encrypted, 
    refresh_token_encrypted,
    expires_at, scope, metadata, 
    status, encryption_version,
    created_at, updated_at
  ) VALUES (
    p_org_id, p_provider,
    '***ENCRYPTED***',
    pgp_sym_encrypt(p_access_token, p_encryption_key),
    CASE WHEN p_refresh_token IS NOT NULL 
         THEN pgp_sym_encrypt(p_refresh_token, p_encryption_key) 
         ELSE NULL END,
    p_expires_at, p_scope, p_metadata,
    'connected', 1,
    NOW(), NOW()
  )
  ON CONFLICT (org_id, provider) DO UPDATE SET
    access_token = '***ENCRYPTED***',
    access_token_encrypted = pgp_sym_encrypt(p_access_token, p_encryption_key),
    refresh_token_encrypted = CASE WHEN p_refresh_token IS NOT NULL 
                                   THEN pgp_sym_encrypt(p_refresh_token, p_encryption_key) 
                                   ELSE NULL END,
    refresh_token = NULL,
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

-- Clear any existing plaintext tokens and set placeholder
UPDATE integrations 
SET access_token = '***ENCRYPTED***', 
    refresh_token = NULL 
WHERE access_token != '***ENCRYPTED***' OR refresh_token IS NOT NULL;

-- Now alter the table to allow NULL and set default for legacy column
ALTER TABLE integrations ALTER COLUMN access_token SET DEFAULT '***ENCRYPTED***';

-- Add a comment explaining the security measure
COMMENT ON COLUMN integrations.access_token IS 'DEPRECATED: Legacy column kept for compatibility. Always contains placeholder value. Real tokens stored encrypted in access_token_encrypted.';
COMMENT ON COLUMN integrations.refresh_token IS 'DEPRECATED: Legacy column kept for compatibility. Always NULL. Real tokens stored encrypted in refresh_token_encrypted.';