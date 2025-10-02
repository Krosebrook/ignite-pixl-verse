import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state'); // user_id
    const provider = url.pathname.split('/').pop();

    if (!code || !state || !provider) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing callback for ${provider}, user: ${state}`);

    // Get org_id for the user
    const { data: membership } = await supabaseClient
      .from('members')
      .select('org_id')
      .eq('user_id', state)
      .single();

    if (!membership) {
      return new Response(JSON.stringify({ error: 'User not member of any organization' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let tokenData: any = {};
    const baseUrl = Deno.env.get('SUPABASE_URL')!;
    const callbackUrl = `${baseUrl}/functions/v1/integrations-callback/${provider}`;

    // Exchange code for tokens based on provider
    switch (provider) {
      case 'shopify':
        const shopifyClientId = Deno.env.get('SHOPIFY_CLIENT_ID');
        const shopifyClientSecret = Deno.env.get('SHOPIFY_CLIENT_SECRET');
        const shopName = 'example-shop'; // Would be extracted from state
        
        const shopifyResponse = await fetch(`https://${shopName}.myshopify.com/admin/oauth/access_token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: shopifyClientId,
            client_secret: shopifyClientSecret,
            code,
          }),
        });
        tokenData = await shopifyResponse.json();
        tokenData.scope = tokenData.scope || 'read_products,write_products';
        break;

      case 'notion':
        const notionClientId = Deno.env.get('NOTION_CLIENT_ID');
        const notionClientSecret = Deno.env.get('NOTION_CLIENT_SECRET');
        
        const notionResponse = await fetch('https://api.notion.com/v1/oauth/token', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(`${notionClientId}:${notionClientSecret}`)}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            grant_type: 'authorization_code',
            code,
            redirect_uri: callbackUrl,
          }),
        });
        const notionData = await notionResponse.json();
        tokenData = {
          access_token: notionData.access_token,
          workspace_name: notionData.workspace_name,
          workspace_id: notionData.workspace_id,
          bot_id: notionData.bot_id,
        };
        break;

      case 'google_drive':
        const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID');
        const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
        
        const googleResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: googleClientId!,
            client_secret: googleClientSecret!,
            redirect_uri: callbackUrl,
            grant_type: 'authorization_code',
          }),
        });
        tokenData = await googleResponse.json();
        break;
    }

    // Calculate expiry
    const expiresAt = tokenData.expires_in 
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

    // Upsert integration
    const { error: upsertError } = await supabaseClient
      .from('integrations')
      .upsert({
        org_id: membership.org_id,
        provider,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        scope: tokenData.scope || '',
        expires_at: expiresAt,
        status: 'connected',
        last_sync_at: new Date().toISOString(),
        metadata: tokenData,
      }, {
        onConflict: 'org_id,provider',
      });

    if (upsertError) {
      console.error('Database error:', upsertError);
      return new Response(JSON.stringify({ error: 'Failed to save integration' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Redirect back to app
    const redirectUrl = `${Deno.env.get('SITE_URL') || 'http://localhost:5173'}/integrations?success=${provider}`;
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': redirectUrl,
      },
    });
  } catch (error) {
    console.error('Callback error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
