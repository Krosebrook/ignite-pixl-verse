-- P16: Integrations Hub
-- Table for OAuth integrations
CREATE TABLE IF NOT EXISTS public.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('shopify', 'notion', 'google_drive', 'zapier')),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  scope TEXT,
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'error', 'refreshing')),
  last_sync_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, provider)
);

CREATE INDEX idx_integrations_org_id ON public.integrations(org_id);
CREATE INDEX idx_integrations_expires_at ON public.integrations(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_integrations_status ON public.integrations(status);

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view their integrations"
  ON public.integrations FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM public.members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Org admins can manage integrations"
  ON public.integrations FOR ALL
  USING (org_id IN (
    SELECT org_id FROM public.members 
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

-- Trigger for updated_at
CREATE TRIGGER set_integrations_updated_at
  BEFORE UPDATE ON public.integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- P17: Model Router & Cost Guard
-- Usage credits tracking per org
CREATE TABLE IF NOT EXISTS public.usage_credits (
  org_id UUID PRIMARY KEY REFERENCES public.orgs(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'STARTER' CHECK (plan IN ('STARTER', 'PRO', 'SCALE')),
  used_tokens BIGINT NOT NULL DEFAULT 0,
  month_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', now()),
  hard_limit_tokens BIGINT NOT NULL DEFAULT 1000000,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_usage_credits_org_id ON public.usage_credits(org_id);

ALTER TABLE public.usage_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view their usage"
  ON public.usage_credits FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM public.members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Org admins can update usage"
  ON public.usage_credits FOR UPDATE
  USING (org_id IN (
    SELECT org_id FROM public.members 
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

-- Function to atomically increment usage tokens
CREATE OR REPLACE FUNCTION public.increment_usage_tokens(
  p_org_id UUID,
  p_tokens BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_new_used BIGINT;
  v_limit BIGINT;
BEGIN
  -- Lock and update the row atomically
  UPDATE public.usage_credits
  SET 
    used_tokens = used_tokens + p_tokens,
    updated_at = now()
  WHERE org_id = p_org_id
  RETURNING used_tokens, hard_limit_tokens INTO v_new_used, v_limit;
  
  IF NOT FOUND THEN
    -- Initialize if not exists
    INSERT INTO public.usage_credits (org_id, used_tokens)
    VALUES (p_org_id, p_tokens)
    RETURNING used_tokens, hard_limit_tokens INTO v_new_used, v_limit;
  END IF;
  
  v_result := jsonb_build_object(
    'ok', v_new_used <= v_limit,
    'used_tokens', v_new_used,
    'remaining_tokens', GREATEST(0, v_limit - v_new_used),
    'limit', v_limit
  );
  
  RETURN v_result;
END;
$$;

-- P18: Template & Preset Library
-- Curated library items
CREATE TABLE IF NOT EXISTS public.library_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('template', 'assistant')),
  summary TEXT,
  payload JSONB NOT NULL,
  license TEXT NOT NULL DEFAULT 'INTERNAL',
  thumbnail_url TEXT,
  author TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_library_items_slug ON public.library_items(slug);
CREATE INDEX idx_library_items_kind ON public.library_items(kind);
CREATE INDEX idx_library_items_tags ON public.library_items USING GIN(tags);

ALTER TABLE public.library_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view library items"
  ON public.library_items FOR SELECT
  USING (true);

-- Track installations per org
CREATE TABLE IF NOT EXISTS public.library_installs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.library_items(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  installed_by UUID REFERENCES auth.users(id),
  backup_snapshot JSONB,
  UNIQUE(org_id, item_id)
);

CREATE INDEX idx_library_installs_org_id ON public.library_installs(org_id);
CREATE INDEX idx_library_installs_item_id ON public.library_installs(item_id);

ALTER TABLE public.library_installs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view their installs"
  ON public.library_installs FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM public.members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Org members can install library items"
  ON public.library_installs FOR INSERT
  WITH CHECK (org_id IN (
    SELECT org_id FROM public.members WHERE user_id = auth.uid()
  ));

-- Audit log for important actions
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_org_id ON public.audit_log(org_id);
CREATE INDEX idx_audit_log_user_id ON public.audit_log(user_id);
CREATE INDEX idx_audit_log_action ON public.audit_log(action);
CREATE INDEX idx_audit_log_created_at ON public.audit_log(created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins can view audit logs"
  ON public.audit_log FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM public.members 
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));