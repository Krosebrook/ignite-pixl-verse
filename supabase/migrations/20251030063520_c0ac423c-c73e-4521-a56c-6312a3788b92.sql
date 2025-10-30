-- Phase 1: Extend assets table for platform-specific configurations
ALTER TABLE public.assets 
  ADD COLUMN IF NOT EXISTS platform_config JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS quality_tier TEXT CHECK (quality_tier IN ('starter', 'pro', 'enterprise')) DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS resolution_config JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS layers JSONB DEFAULT '[]'::jsonb;

-- Create content_layers table for reusable layer templates
CREATE TABLE IF NOT EXISTS public.content_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  layer_type TEXT NOT NULL CHECK (layer_type IN (
    'background', 'foreground', 'overlay', 'text', 'logo', 
    'transition', 'effect', 'audio', 'subtitle', 'watermark',
    'cta_button', 'animation', 'particle_effect', 'color_grade',
    'light_leak', 'lens_flare', 'motion_graphics', 'lower_third',
    'end_screen', 'intro_sequence', 'outro_sequence', 'sticker',
    'green_screen'
  )),
  platform TEXT NOT NULL CHECK (platform IN ('youtube', 'tiktok', 'instagram', 'twitter', 'facebook', 'linkedin')),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  thumbnail_url TEXT,
  is_template BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on content_layers
ALTER TABLE public.content_layers ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Org members can manage their layers
CREATE POLICY "org_members_manage_layers" ON public.content_layers
FOR ALL 
USING (org_id IN (
  SELECT org_id FROM public.members WHERE user_id = auth.uid()
));

-- Extend usage_credits table for video and image generation limits
ALTER TABLE public.usage_credits 
  ADD COLUMN IF NOT EXISTS video_minutes_used INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_minutes_limit INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS image_generations_used INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_generations_limit INTEGER DEFAULT 100,
  ADD COLUMN IF NOT EXISTS max_resolution TEXT DEFAULT '1080p',
  ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]'::jsonb;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_layers_org_platform ON public.content_layers(org_id, platform);
CREATE INDEX IF NOT EXISTS idx_assets_quality ON public.assets(quality_tier, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assets_platform_config ON public.assets USING GIN(platform_config);

-- Add trigger for content_layers updated_at
CREATE TRIGGER update_content_layers_updated_at
  BEFORE UPDATE ON public.content_layers
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Update default usage limits based on plan
UPDATE public.usage_credits 
SET 
  video_minutes_limit = CASE 
    WHEN plan = 'STARTER' THEN 10
    WHEN plan = 'PRO' THEN 60
    WHEN plan = 'ENTERPRISE' THEN 999999
    ELSE 10
  END,
  image_generations_limit = CASE 
    WHEN plan = 'STARTER' THEN 100
    WHEN plan = 'PRO' THEN 500
    WHEN plan = 'ENTERPRISE' THEN 999999
    ELSE 100
  END,
  max_resolution = CASE 
    WHEN plan = 'STARTER' THEN '1080p'
    WHEN plan = 'PRO' THEN '4K'
    WHEN plan = 'ENTERPRISE' THEN '8K'
    ELSE '1080p'
  END,
  features = CASE 
    WHEN plan = 'STARTER' THEN '["basic_transitions", "standard_quality", "watermark"]'::jsonb
    WHEN plan = 'PRO' THEN '["advanced_effects", "4k_export", "no_watermark", "ai_voice_clone", "auto_caption", "color_grading"]'::jsonb
    WHEN plan = 'ENTERPRISE' THEN '["all_pro_features", "custom_branding", "8k_export", "priority_rendering", "api_access", "unlimited_layers"]'::jsonb
    ELSE '["basic_transitions"]'::jsonb
  END
WHERE TRUE;