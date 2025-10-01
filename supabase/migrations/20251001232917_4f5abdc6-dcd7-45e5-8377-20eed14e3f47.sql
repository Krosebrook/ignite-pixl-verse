-- Analytics Events Table
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  event_category TEXT NOT NULL,
  duration_ms INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily Aggregates Table
CREATE TABLE IF NOT EXISTS public.daily_aggregates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  date DATE NOT NULL,
  event_type TEXT NOT NULL,
  count INTEGER DEFAULT 0,
  total_duration_ms BIGINT DEFAULT 0,
  avg_duration_ms INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(org_id, date, event_type)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_analytics_events_org_id ON public.analytics_events(org_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON public.analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON public.analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON public.analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_daily_aggregates_org_date ON public.daily_aggregates(org_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_aggregates_event_type ON public.daily_aggregates(event_type);

-- Enable RLS
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_aggregates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for analytics_events
CREATE POLICY "Org members can view their org events"
  ON public.analytics_events
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can insert events"
  ON public.analytics_events
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.members WHERE user_id = auth.uid()
    )
    AND user_id = auth.uid()
  );

-- RLS Policies for daily_aggregates
CREATE POLICY "Org members can view their org aggregates"
  ON public.daily_aggregates
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.members WHERE user_id = auth.uid()
    )
  );

-- Function to aggregate events daily
CREATE OR REPLACE FUNCTION public.aggregate_daily_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Aggregate events from the previous day
  INSERT INTO public.daily_aggregates (org_id, date, event_type, count, total_duration_ms, avg_duration_ms, metadata)
  SELECT 
    org_id,
    DATE(created_at) as date,
    event_type,
    COUNT(*) as count,
    COALESCE(SUM(duration_ms), 0) as total_duration_ms,
    COALESCE(AVG(duration_ms)::INTEGER, 0) as avg_duration_ms,
    jsonb_build_object(
      'event_category', mode() WITHIN GROUP (ORDER BY event_category),
      'unique_users', COUNT(DISTINCT user_id)
    ) as metadata
  FROM public.analytics_events
  WHERE DATE(created_at) = CURRENT_DATE - INTERVAL '1 day'
  GROUP BY org_id, DATE(created_at), event_type
  ON CONFLICT (org_id, date, event_type)
  DO UPDATE SET
    count = EXCLUDED.count,
    total_duration_ms = EXCLUDED.total_duration_ms,
    avg_duration_ms = EXCLUDED.avg_duration_ms,
    metadata = EXCLUDED.metadata;
END;
$$;

-- Function to get event summary for an org
CREATE OR REPLACE FUNCTION public.get_event_summary(
  p_org_id UUID,
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  event_type TEXT,
  total_count BIGINT,
  avg_duration_ms NUMERIC,
  unique_users BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.event_type,
    COUNT(*) as total_count,
    AVG(e.duration_ms) as avg_duration_ms,
    COUNT(DISTINCT e.user_id) as unique_users
  FROM public.analytics_events e
  WHERE e.org_id = p_org_id
    AND DATE(e.created_at) BETWEEN p_start_date AND p_end_date
  GROUP BY e.event_type
  ORDER BY total_count DESC;
END;
$$;