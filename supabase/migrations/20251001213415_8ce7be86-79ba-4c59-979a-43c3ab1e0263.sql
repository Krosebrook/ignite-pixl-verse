-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create organizations table
CREATE TABLE public.orgs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create members table for org access
CREATE TABLE public.members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

-- Create brand kits table
CREATE TABLE public.brand_kits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  colors JSONB DEFAULT '[]'::jsonb,
  fonts JSONB DEFAULT '[]'::jsonb,
  logo_url TEXT,
  guidelines TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create templates table
CREATE TABLE public.templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES public.orgs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('text', 'image', 'video', 'music')),
  content JSONB NOT NULL,
  thumbnail_url TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create assets table (generated content)
CREATE TABLE public.assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('text', 'image', 'video', 'music')),
  name TEXT NOT NULL,
  content_url TEXT,
  content_data JSONB,
  thumbnail_url TEXT,
  provenance JSONB,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create campaigns table
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'paused', 'completed')) DEFAULT 'draft',
  platforms JSONB DEFAULT '[]'::jsonb,
  assets JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create schedules table
CREATE TABLE public.schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'posted', 'failed', 'cancelled')) DEFAULT 'pending',
  posted_url TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create marketplace items table
CREATE TABLE public.marketplace_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('pack', 'preset', 'template')),
  content JSONB NOT NULL,
  thumbnail_url TEXT,
  price_cents INTEGER DEFAULT 0,
  creator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  downloads INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for orgs
CREATE POLICY "Users can view orgs they are members of"
  ON public.orgs FOR SELECT
  USING (
    id IN (
      SELECT org_id FROM public.members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create orgs"
  ON public.orgs FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Org owners can update their orgs"
  ON public.orgs FOR UPDATE
  USING (
    id IN (
      SELECT org_id FROM public.members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- RLS Policies for members
CREATE POLICY "Users can view members of their orgs"
  ON public.members FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org admins can manage members"
  ON public.members FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM public.members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- RLS Policies for brand_kits
CREATE POLICY "Users can view brand kits of their orgs"
  ON public.brand_kits FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can manage brand kits"
  ON public.brand_kits FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM public.members WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for templates
CREATE POLICY "Users can view public templates or their org templates"
  ON public.templates FOR SELECT
  USING (
    is_public = true OR
    org_id IN (
      SELECT org_id FROM public.members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can manage their org templates"
  ON public.templates FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM public.members WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for assets
CREATE POLICY "Users can view assets of their orgs"
  ON public.assets FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can create assets"
  ON public.assets FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.members WHERE user_id = auth.uid()
    ) AND user_id = auth.uid()
  );

CREATE POLICY "Users can update their own assets"
  ON public.assets FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own assets"
  ON public.assets FOR DELETE
  USING (user_id = auth.uid());

-- RLS Policies for campaigns
CREATE POLICY "Users can view campaigns of their orgs"
  ON public.campaigns FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can manage campaigns"
  ON public.campaigns FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM public.members WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for schedules
CREATE POLICY "Users can view schedules of their orgs"
  ON public.schedules FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can manage schedules"
  ON public.schedules FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM public.members WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for marketplace_items
CREATE POLICY "Anyone can view marketplace items"
  ON public.marketplace_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Creators can manage their items"
  ON public.marketplace_items FOR ALL
  USING (creator_id = auth.uid());

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER set_updated_at_orgs
  BEFORE UPDATE ON public.orgs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_brand_kits
  BEFORE UPDATE ON public.brand_kits
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_templates
  BEFORE UPDATE ON public.templates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_campaigns
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();