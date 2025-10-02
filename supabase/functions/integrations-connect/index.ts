import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConnectRequest {
  provider: 'shopify' | 'notion' | 'google_drive' | 'zapier';
  redirectUri?: string;
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

    const { provider, redirectUri }: ConnectRequest = await req.json();

    // Generate OAuth URLs based on provider
    const baseUrl = Deno.env.get('SUPABASE_URL')!;
    const callbackUrl = `${baseUrl}/functions/v1/integrations-callback/${provider}`;
    
    let authUrl = '';
    
    switch (provider) {
      case 'shopify':
        const shopifyClientId = Deno.env.get('SHOPIFY_CLIENT_ID');
        const shopName = 'example-shop'; // Would be provided by user
        authUrl = `https://${shopName}.myshopify.com/admin/oauth/authorize?` +
          `client_id=${shopifyClientId}&` +
          `scope=read_products,write_products,read_orders&` +
          `redirect_uri=${encodeURIComponent(callbackUrl)}&` +
          `state=${user.id}`;
        break;
        
      case 'notion':
        const notionClientId = Deno.env.get('NOTION_CLIENT_ID');
        authUrl = `https://api.notion.com/v1/oauth/authorize?` +
          `client_id=${notionClientId}&` +
          `response_type=code&` +
          `owner=user&` +
          `redirect_uri=${encodeURIComponent(callbackUrl)}&` +
          `state=${user.id}`;
        break;
        
      case 'google_drive':
        const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID');
        authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
          `client_id=${googleClientId}&` +
          `response_type=code&` +
          `scope=https://www.googleapis.com/auth/drive.file&` +
          `redirect_uri=${encodeURIComponent(callbackUrl)}&` +
          `state=${user.id}&` +
          `access_type=offline&` +
          `prompt=consent`;
        break;
        
      case 'zapier':
        // Zapier uses webhook URLs, not OAuth
        authUrl = 'https://zapier.com/app/dashboard';
        break;
    }

    console.log(`Generated auth URL for ${provider}:`, authUrl);

    return new Response(
      JSON.stringify({ authUrl, provider }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Connect error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
