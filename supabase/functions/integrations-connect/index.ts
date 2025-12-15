import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConnectRequest {
  provider: 'instagram' | 'twitter' | 'linkedin' | 'shopify' | 'notion' | 'google_drive' | 'zapier';
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
    
    // Generate HMAC-SHA256 signed state token for CSRF protection
    const timestamp = Date.now();
    const stateData = `${user.id}:${timestamp}`;
    const oauthSecret = Deno.env.get('OAUTH_STATE_SECRET');
    let stateToken = `${user.id}:${timestamp}`;
    
    if (oauthSecret) {
      const encoder = new TextEncoder();
      const keyData = encoder.encode(oauthSecret);
      const key = await crypto.subtle.importKey(
        'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
      );
      const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(stateData));
      const signatureHex = Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      stateToken = `${stateData}:${signatureHex}`;
    }

    switch (provider) {
      case 'instagram':
        const instagramAppId = Deno.env.get('INSTAGRAM_APP_ID');
        authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
          `client_id=${instagramAppId}&` +
          `redirect_uri=${encodeURIComponent(callbackUrl + '?provider=instagram')}&` +
          `scope=instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement&` +
          `state=${encodeURIComponent(stateToken)}`;
        break;

      case 'twitter':
        const twitterClientId = Deno.env.get('TWITTER_CLIENT_ID');
        // Twitter OAuth 2.0 with PKCE
        authUrl = `https://twitter.com/i/oauth2/authorize?` +
          `response_type=code&` +
          `client_id=${twitterClientId}&` +
          `redirect_uri=${encodeURIComponent(callbackUrl + '?provider=twitter')}&` +
          `scope=tweet.read%20tweet.write%20users.read%20offline.access&` +
          `state=${encodeURIComponent(stateToken)}&` +
          `code_challenge=challenge&` +
          `code_challenge_method=plain`;
        break;

      case 'linkedin':
        const linkedinClientId = Deno.env.get('LINKEDIN_CLIENT_ID');
        authUrl = `https://www.linkedin.com/oauth/v2/authorization?` +
          `response_type=code&` +
          `client_id=${linkedinClientId}&` +
          `redirect_uri=${encodeURIComponent(callbackUrl + '?provider=linkedin')}&` +
          `scope=r_liteprofile%20w_member_social&` +
          `state=${encodeURIComponent(stateToken)}`;
        break;

      case 'shopify':
        const shopifyClientId = Deno.env.get('SHOPIFY_CLIENT_ID');
        const shopName = 'example-shop'; // Would be provided by user
        authUrl = `https://${shopName}.myshopify.com/admin/oauth/authorize?` +
          `client_id=${shopifyClientId}&` +
          `scope=read_products,write_products,read_orders&` +
          `redirect_uri=${encodeURIComponent(callbackUrl + '?provider=shopify')}&` +
          `state=${encodeURIComponent(stateToken)}`;
        break;
        
      case 'notion':
        const notionClientId = Deno.env.get('NOTION_CLIENT_ID');
        authUrl = `https://api.notion.com/v1/oauth/authorize?` +
          `client_id=${notionClientId}&` +
          `response_type=code&` +
          `owner=user&` +
          `redirect_uri=${encodeURIComponent(callbackUrl + '?provider=notion')}&` +
          `state=${encodeURIComponent(stateToken)}`;
        break;
        
      case 'google_drive':
        const googleClientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
        authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
          `client_id=${googleClientId}&` +
          `response_type=code&` +
          `scope=https://www.googleapis.com/auth/drive.file&` +
          `redirect_uri=${encodeURIComponent(callbackUrl + '?provider=google_drive')}&` +
          `state=${encodeURIComponent(stateToken)}&` +
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
