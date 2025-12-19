-- Create incident severity enum
CREATE TYPE public.incident_severity AS ENUM ('critical', 'major', 'minor', 'warning');

-- Create incident status enum  
CREATE TYPE public.incident_status AS ENUM ('open', 'investigating', 'identified', 'monitoring', 'resolved');

-- Create incidents table
CREATE TABLE public.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  assigned_to UUID,
  title TEXT NOT NULL,
  description TEXT,
  severity incident_severity NOT NULL DEFAULT 'warning',
  status incident_status NOT NULL DEFAULT 'open',
  source_type TEXT, -- 'circuit_breaker', 'service', 'manual'
  source_name TEXT,
  alert_id TEXT, -- Reference to the original alert
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create incident timeline/updates table
CREATE TABLE public.incident_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  update_type TEXT NOT NULL, -- 'status_change', 'comment', 'assignment', 'severity_change'
  previous_value TEXT,
  new_value TEXT,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_updates ENABLE ROW LEVEL SECURITY;

-- RLS policies for incidents
CREATE POLICY "Org members can view incidents"
ON public.incidents
FOR SELECT
USING (org_id IN (SELECT org_id FROM members WHERE user_id = auth.uid()));

CREATE POLICY "Org members can create incidents"
ON public.incidents
FOR INSERT
WITH CHECK (
  org_id IN (SELECT org_id FROM members WHERE user_id = auth.uid())
  AND created_by = auth.uid()
);

CREATE POLICY "Org members can update incidents"
ON public.incidents
FOR UPDATE
USING (org_id IN (SELECT org_id FROM members WHERE user_id = auth.uid()));

-- RLS policies for incident updates
CREATE POLICY "Org members can view incident updates"
ON public.incident_updates
FOR SELECT
USING (incident_id IN (
  SELECT id FROM incidents 
  WHERE org_id IN (SELECT org_id FROM members WHERE user_id = auth.uid())
));

CREATE POLICY "Org members can create incident updates"
ON public.incident_updates
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND incident_id IN (
    SELECT id FROM incidents 
    WHERE org_id IN (SELECT org_id FROM members WHERE user_id = auth.uid())
  )
);

-- Create indexes
CREATE INDEX idx_incidents_org_id ON public.incidents(org_id);
CREATE INDEX idx_incidents_status ON public.incidents(status);
CREATE INDEX idx_incidents_severity ON public.incidents(severity);
CREATE INDEX idx_incidents_created_at ON public.incidents(created_at DESC);
CREATE INDEX idx_incident_updates_incident_id ON public.incident_updates(incident_id);

-- Add updated_at trigger
CREATE TRIGGER update_incidents_updated_at
BEFORE UPDATE ON public.incidents
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();