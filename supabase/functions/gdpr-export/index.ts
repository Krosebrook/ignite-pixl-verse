import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GDPRExportRequest {
  user_id: string;
  org_id: string;
  include_analytics?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify authentication
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { user_id, org_id, include_analytics = true }: GDPRExportRequest = await req.json();

    // Security check: user can only export their own data
    if (user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden: Can only export own data' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user belongs to org
    const { data: member } = await supabaseClient
      .from('org_members')
      .select('id')
      .eq('org_id', org_id)
      .eq('user_id', user_id)
      .single();

    if (!member) {
      return new Response(JSON.stringify({ error: 'User not member of organization' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Collect all user data
    const exportData: Record<string, any> = {
      export_date: new Date().toISOString(),
      user_id,
      org_id,
    };

    // User profile
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('user_id', user_id)
      .single();
    exportData.profile = profile;

    // User's assets
    const { data: assets } = await supabaseClient
      .from('assets')
      .select('*')
      .eq('org_id', org_id)
      .eq('created_by', user_id);
    exportData.assets = assets;

    // User's campaigns
    const { data: campaigns } = await supabaseClient
      .from('campaigns')
      .select('*')
      .eq('org_id', org_id)
      .eq('created_by', user_id);
    exportData.campaigns = campaigns;

    // User's scheduled posts
    const { data: schedules } = await supabaseClient
      .from('schedules')
      .select('*')
      .eq('org_id', org_id)
      .eq('created_by', user_id);
    exportData.schedules = schedules;

    // User's brand kits
    const { data: brandKits } = await supabaseClient
      .from('brand_kits')
      .select('*')
      .eq('org_id', org_id)
      .eq('created_by', user_id);
    exportData.brand_kits = brandKits;

    // Analytics events (if requested)
    if (include_analytics) {
      const { data: analytics } = await supabaseClient
        .from('analytics_events')
        .select('*')
        .eq('org_id', org_id)
        .eq('user_id', user_id)
        .order('created_at', { ascending: false })
        .limit(10000); // Cap at 10k events
      exportData.analytics_events = analytics;
    }

    // Log export request
    await supabaseClient.from('audit_log').insert({
      org_id,
      user_id,
      action: 'gdpr_export',
      resource_type: 'user_data',
      resource_id: user_id,
      metadata: { include_analytics },
    });

    return new Response(JSON.stringify(exportData), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="gdpr-export-${user_id}-${Date.now()}.json"`,
      },
    });
  } catch (error) {
    console.error('GDPR export error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
