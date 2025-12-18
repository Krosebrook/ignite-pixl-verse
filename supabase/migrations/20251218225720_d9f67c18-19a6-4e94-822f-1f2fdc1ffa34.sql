-- Create segments table for audience targeting
CREATE TABLE public.segments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  criteria JSONB NOT NULL DEFAULT '{}',
  estimated_reach INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create campaign_goals table for goal tracking
CREATE TABLE public.campaign_goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  goal_type TEXT NOT NULL,
  target_value INTEGER NOT NULL,
  current_value INTEGER DEFAULT 0,
  deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add new columns to campaigns table
ALTER TABLE public.campaigns 
  ADD COLUMN IF NOT EXISTS budget_cents INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS spent_cents INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS segments JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS schedule_config JSONB DEFAULT '{}';

-- Enable RLS on new tables
ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_goals ENABLE ROW LEVEL SECURITY;

-- RLS policies for segments
CREATE POLICY "Org members can view segments"
  ON public.segments FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.members WHERE user_id = auth.uid()));

CREATE POLICY "Org members can manage segments"
  ON public.segments FOR ALL
  USING (org_id IN (SELECT org_id FROM public.members WHERE user_id = auth.uid()));

-- RLS policies for campaign_goals
CREATE POLICY "Org members can view campaign goals"
  ON public.campaign_goals FOR SELECT
  USING (campaign_id IN (
    SELECT id FROM public.campaigns WHERE org_id IN (
      SELECT org_id FROM public.members WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Org members can manage campaign goals"
  ON public.campaign_goals FOR ALL
  USING (campaign_id IN (
    SELECT id FROM public.campaigns WHERE org_id IN (
      SELECT org_id FROM public.members WHERE user_id = auth.uid()
    )
  ));

-- Add trigger for segments updated_at
CREATE TRIGGER update_segments_updated_at
  BEFORE UPDATE ON public.segments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_segments_org_id ON public.segments(org_id);
CREATE INDEX IF NOT EXISTS idx_campaign_goals_campaign_id ON public.campaign_goals(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_start_date ON public.campaigns(start_date);
CREATE INDEX IF NOT EXISTS idx_campaigns_end_date ON public.campaigns(end_date);