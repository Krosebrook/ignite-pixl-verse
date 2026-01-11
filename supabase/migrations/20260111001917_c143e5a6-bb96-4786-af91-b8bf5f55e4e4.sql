-- Create invitations table for pending team invites
CREATE TABLE public.invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  invited_by UUID NOT NULL,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT valid_role CHECK (role IN ('admin', 'member', 'viewer')),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled'))
);

-- Enable RLS
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Org admins can view all invitations for their org
CREATE POLICY "Org admins can view invitations"
ON public.invitations FOR SELECT
USING (
  org_id IN (
    SELECT members.org_id FROM members 
    WHERE members.user_id = auth.uid() 
    AND members.role IN ('owner', 'admin')
  )
);

-- Org admins can create invitations
CREATE POLICY "Org admins can create invitations"
ON public.invitations FOR INSERT
WITH CHECK (
  org_id IN (
    SELECT members.org_id FROM members 
    WHERE members.user_id = auth.uid() 
    AND members.role IN ('owner', 'admin')
  )
  AND invited_by = auth.uid()
);

-- Org admins can update invitations (cancel)
CREATE POLICY "Org admins can update invitations"
ON public.invitations FOR UPDATE
USING (
  org_id IN (
    SELECT members.org_id FROM members 
    WHERE members.user_id = auth.uid() 
    AND members.role IN ('owner', 'admin')
  )
);

-- Org admins can delete invitations
CREATE POLICY "Org admins can delete invitations"
ON public.invitations FOR DELETE
USING (
  org_id IN (
    SELECT members.org_id FROM members 
    WHERE members.user_id = auth.uid() 
    AND members.role IN ('owner', 'admin')
  )
);

-- Create index for faster lookups
CREATE INDEX idx_invitations_org_id ON public.invitations(org_id);
CREATE INDEX idx_invitations_email ON public.invitations(email);
CREATE INDEX idx_invitations_token ON public.invitations(token);
CREATE INDEX idx_invitations_status ON public.invitations(status);