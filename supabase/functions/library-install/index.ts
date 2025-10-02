import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InstallRequest {
  org_id: string;
  slug: string;
  version?: string;
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

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { org_id, slug, version }: InstallRequest = await req.json();

    // Verify user is member of org
    const { data: member } = await supabaseClient
      .from('members')
      .select('id')
      .eq('org_id', org_id)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return new Response(JSON.stringify({ error: 'Not a member of organization' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get library item
    let query = supabaseClient
      .from('library_items')
      .select('*')
      .eq('slug', slug);

    if (version) {
      query = query.eq('version', version);
    }

    const { data: item, error: itemError } = await query.single();

    if (itemError || !item) {
      return new Response(JSON.stringify({ error: 'Library item not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check for existing installation
    const { data: existingInstall } = await supabaseClient
      .from('library_installs')
      .select('*')
      .eq('org_id', org_id)
      .eq('item_id', item.id)
      .single();

    let backupSnapshot = null;

    if (existingInstall) {
      // Create backup of existing installation
      if (item.kind === 'template') {
        const { data: existingTemplates } = await supabaseClient
          .from('templates')
          .select('*')
          .eq('org_id', org_id)
          .ilike('name', `%${item.name}%`);

        backupSnapshot = existingTemplates;
      }

      // Idempotent: if same version, do nothing
      if (existingInstall.version === item.version) {
        console.log(`Item ${slug} already installed at version ${item.version}`);
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Already installed',
            item_id: item.id,
            version: item.version,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Install based on kind
    if (item.kind === 'template') {
      // Install templates from payload
      const templates = Array.isArray(item.payload.templates) ? item.payload.templates : [item.payload];
      
      for (const template of templates) {
        await supabaseClient
          .from('templates')
          .upsert({
            org_id,
            name: template.name,
            type: template.type,
            content: template.content,
            is_public: false,
            thumbnail_url: template.thumbnail_url || item.thumbnail_url,
          });
      }
    } else if (item.kind === 'assistant') {
      // Install assistant configuration (would integrate with AI settings)
      console.log('Installing assistant:', item.name);
    }

    // Record installation
    const { error: installError } = await supabaseClient
      .from('library_installs')
      .upsert({
        org_id,
        item_id: item.id,
        version: item.version,
        installed_by: user.id,
        backup_snapshot: backupSnapshot,
        installed_at: new Date().toISOString(),
      }, {
        onConflict: 'org_id,item_id',
      });

    if (installError) {
      console.error('Install record error:', installError);
      return new Response(JSON.stringify({ error: 'Failed to record installation' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Audit log
    await supabaseClient.from('audit_log').insert({
      org_id,
      user_id: user.id,
      action: 'library_install',
      resource_type: 'library_item',
      resource_id: item.id,
      metadata: {
        slug: item.slug,
        version: item.version,
        kind: item.kind,
        had_backup: !!backupSnapshot,
      },
    });

    console.log(`Successfully installed ${slug} v${item.version}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Installed ${item.name} v${item.version}`,
        item_id: item.id,
        version: item.version,
        had_previous_version: !!existingInstall,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Library install error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
