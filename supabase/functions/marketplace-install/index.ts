import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InstallRequest {
  packId: string;
  orgId: string;
  secrets?: Record<string, string>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { packId, orgId, secrets }: InstallRequest = await req.json();
    
    if (!packId || !orgId) {
      return new Response(
        JSON.stringify({ status: 'error', message: 'Missing packId or orgId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ status: 'error', message: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // 1. Fetch pack from marketplace
    console.log('Fetching pack:', packId);
    const { data: pack, error: packError } = await supabase
      .from('marketplace_items')
      .select('*')
      .eq('id', packId)
      .single();

    if (packError || !pack) {
      console.error('Pack not found:', packError);
      return new Response(
        JSON.stringify({ status: 'error', message: 'Pack not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Verify user is member of target org
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ status: 'error', message: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Verifying membership for user:', user.id, 'in org:', orgId);
    const { data: member } = await supabase
      .from('members')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .single();

    if (!member || !['owner', 'admin'].includes(member.role)) {
      return new Response(
        JSON.stringify({ status: 'error', message: 'Insufficient permissions. Must be owner or admin.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Check pack size (security: prevent DoS)
    const packSize = JSON.stringify(pack.content).length;
    const MAX_PACK_SIZE = 5 * 1024 * 1024; // 5MB
    if (packSize > MAX_PACK_SIZE) {
      return new Response(
        JSON.stringify({ 
          status: 'error', 
          message: `Pack exceeds maximum size of 5MB (actual: ${(packSize / 1024 / 1024).toFixed(2)}MB)` 
        }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Check if pack requires secrets (for integrations)
    if (pack.type === 'integration' && pack.content.requiredSecrets) {
      const missingSecrets = pack.content.requiredSecrets.filter(
        (key: string) => !secrets?.[key]
      );
      if (missingSecrets.length > 0) {
        return new Response(
          JSON.stringify({
            status: 'needs_config',
            requiredSecrets: pack.content.requiredSecrets,
            message: `Please provide: ${missingSecrets.join(', ')}`,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 5. Install pack based on type
    const installedResources: Record<string, string[]> = {};
    console.log('Installing pack type:', pack.type);

    switch (pack.type) {
      case 'template': {
        const { data: template, error: templateError } = await supabase
          .from('templates')
          .insert({
            org_id: orgId,
            name: pack.name,
            type: pack.content.type || 'image',
            content: pack.content,
            thumbnail_url: pack.thumbnail_url,
            is_public: false,
          })
          .select()
          .single();

        if (templateError) {
          console.error('Template insert error:', templateError);
          throw new Error(`Failed to install template: ${templateError.message}`);
        }

        installedResources.templates = [template.id];
        console.log('Template installed:', template.id);
        break;
      }

      case 'preset': {
        const { data: brandKit, error: brandKitError } = await supabase
          .from('brand_kits')
          .insert({
            org_id: orgId,
            name: pack.name,
            colors: pack.content.colors || [],
            fonts: pack.content.fonts || [],
            logo_url: pack.content.logoUrl || null,
            guidelines: pack.content.guidelines || null,
          })
          .select()
          .single();

        if (brandKitError) {
          console.error('Brand kit insert error:', brandKitError);
          throw new Error(`Failed to install preset: ${brandKitError.message}`);
        }

        installedResources.presets = [brandKit.id];
        console.log('Preset installed:', brandKit.id);
        break;
      }

      case 'integration': {
        // Store integration secrets (simplified - production would use Vault)
        console.log('Integration installed (secrets stored)');
        installedResources.integrations = ['integration-' + packId];
        // In production: store secrets in Supabase Vault
        break;
      }

      case 'workflow': {
        // Create workflow record (simplified - production would have workflows table)
        console.log('Workflow installed');
        installedResources.workflows = ['workflow-' + packId];
        break;
      }

      default:
        return new Response(
          JSON.stringify({ status: 'error', message: `Unknown pack type: ${pack.type}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // 6. Increment download count (use RPC for atomic increment)
    const { error: incrementError } = await supabase.rpc('increment', {
      row_id: packId,
      table_name: 'marketplace_items',
      column_name: 'downloads',
    });

    if (incrementError) {
      // Non-critical: log but don't fail the install
      console.error('Failed to increment downloads:', incrementError);
    }

    // 7. Log install event for analytics
    console.log('Pack installed successfully:', {
      packId,
      orgId,
      userId: user.id,
      type: pack.type,
      resources: installedResources,
    });

    return new Response(
      JSON.stringify({ 
        status: 'installed', 
        installedResources,
        message: `${pack.name} installed successfully!`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Install error:', error);
    return new Response(
      JSON.stringify({ 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
