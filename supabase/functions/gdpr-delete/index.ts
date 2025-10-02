import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GDPRDeleteRequest {
  user_id: string;
  org_id: string;
  delete_assets?: boolean;
  delete_analytics?: boolean;
  confirmation_code: string; // User must provide confirmation
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

    const {
      user_id,
      org_id,
      delete_assets = true,
      delete_analytics = true,
      confirmation_code,
    }: GDPRDeleteRequest = await req.json();

    // Security checks
    if (user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden: Can only delete own data' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify confirmation code (should be generated client-side: SHA256(user_id + current_date))
    const expectedCode = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(`${user_id}${new Date().toISOString().split('T')[0]}`)
    );
    const expectedHex = Array.from(new Uint8Array(expectedCode))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    if (confirmation_code.toLowerCase() !== expectedHex.slice(0, 16)) {
      return new Response(JSON.stringify({ error: 'Invalid confirmation code' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user belongs to org
    const { data: member } = await supabaseClient
      .from('org_members')
      .select('id, role')
      .eq('org_id', org_id)
      .eq('user_id', user_id)
      .single();

    if (!member) {
      return new Response(JSON.stringify({ error: 'User not member of organization' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Log deletion request BEFORE deleting
    await supabaseClient.from('audit_log').insert({
      org_id,
      user_id,
      action: 'gdpr_delete_requested',
      resource_type: 'user_data',
      resource_id: user_id,
      metadata: { delete_assets, delete_analytics },
    });

    const deletedResources: Record<string, number> = {};

    // Delete user-specific data (org-scoped)
    if (delete_assets) {
      const { count: assetsCount } = await supabaseClient
        .from('assets')
        .delete({ count: 'exact' })
        .eq('org_id', org_id)
        .eq('created_by', user_id);
      deletedResources.assets = assetsCount || 0;
    }

    // Delete campaigns
    const { count: campaignsCount } = await supabaseClient
      .from('campaigns')
      .delete({ count: 'exact' })
      .eq('org_id', org_id)
      .eq('created_by', user_id);
    deletedResources.campaigns = campaignsCount || 0;

    // Delete schedules
    const { count: schedulesCount } = await supabaseClient
      .from('schedules')
      .delete({ count: 'exact' })
      .eq('org_id', org_id)
      .eq('created_by', user_id);
    deletedResources.schedules = schedulesCount || 0;

    // Delete brand kits
    const { count: brandKitsCount } = await supabaseClient
      .from('brand_kits')
      .delete({ count: 'exact' })
      .eq('org_id', org_id)
      .eq('created_by', user_id);
    deletedResources.brand_kits = brandKitsCount || 0;

    // Delete analytics events
    if (delete_analytics) {
      const { count: analyticsCount } = await supabaseClient
        .from('analytics_events')
        .delete({ count: 'exact' })
        .eq('org_id', org_id)
        .eq('user_id', user_id);
      deletedResources.analytics_events = analyticsCount || 0;
    }

    // Delete profile (keep org membership for audit trail)
    const { count: profileCount } = await supabaseClient
      .from('profiles')
      .delete({ count: 'exact' })
      .eq('user_id', user_id);
    deletedResources.profile = profileCount || 0;

    // DO NOT delete auth.users (Supabase manages this)
    // User should be prompted to delete account via Supabase Auth UI

    // Log completion
    await supabaseClient.from('audit_log').insert({
      org_id,
      user_id,
      action: 'gdpr_delete_completed',
      resource_type: 'user_data',
      resource_id: user_id,
      metadata: { deleted_resources: deletedResources },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'User data deleted successfully',
        deleted_resources: deletedResources,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('GDPR delete error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
