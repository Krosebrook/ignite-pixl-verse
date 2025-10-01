-- Add missing fields to assets table for P4 data contracts
ALTER TABLE public.assets 
  ADD COLUMN IF NOT EXISTS license TEXT DEFAULT 'all-rights-reserved',
  ADD COLUMN IF NOT EXISTS human_edited BOOLEAN DEFAULT false;

-- Add missing fields to campaigns table for P4 data contracts
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS objective TEXT,
  ADD COLUMN IF NOT EXISTS metrics JSONB DEFAULT '{}'::jsonb;

-- Add missing fields to schedules table for P4 data contracts
ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS retries INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS result JSONB;

-- Create index on schedules for efficient retry queries
CREATE INDEX IF NOT EXISTS idx_schedules_status_retries 
  ON public.schedules(status, retries) 
  WHERE status IN ('pending', 'failed');

-- Create index on assets for license queries
CREATE INDEX IF NOT EXISTS idx_assets_license 
  ON public.assets(license);

-- Add check constraint for retry limit
ALTER TABLE public.schedules 
  ADD CONSTRAINT check_retry_limit 
  CHECK (retries >= 0 AND retries <= 5);

COMMENT ON COLUMN public.assets.license IS 'License type: all-rights-reserved, cc-by, cc-by-sa, cc0, commercial';
COMMENT ON COLUMN public.assets.human_edited IS 'Flag indicating if asset was edited by a human after AI generation';
COMMENT ON COLUMN public.campaigns.objective IS 'Campaign objective and success criteria';
COMMENT ON COLUMN public.campaigns.metrics IS 'Aggregated campaign performance metrics';
COMMENT ON COLUMN public.schedules.retries IS 'Number of retry attempts for failed posts (max 5)';
COMMENT ON COLUMN public.schedules.result IS 'Posting result details including platform response';