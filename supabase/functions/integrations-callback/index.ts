import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// State token verification (HMAC-SHA256)
async function verifyStateToken(stateToken: string, expectedUserId: string): Promise<boolean> {
  try {
    const [userId, timestampStr, signature] = stateToken.split(':');

    if (userId !== expectedUserId) {
      console.error('State user_id mismatch');
      return false;
    }

    const timestamp = parseInt(timestampStr);
    const now = Date.now();
    if (now - timestamp > 10 * 60 * 1000) {
      console.error('State token expired (>10 min)');
      return false;
    }

    const secret = Deno.env.get('OAUTH_STATE_SECRET');
    if (!secret) {
      console.warn('OAUTH_STATE_SECRET not configured - skipping signature verification');
      return true; // Fallback for initial deployment
    }

    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );

    const data = encoder.encode(`${userId}:${timestampStr}`);
    const signatureBytes = new Uint8Array(
      signature.match(/.{2}/g)!.map(byte => parseInt(byte, 16))
    );

    return await crypto.subtle.verify('HMAC', key, signatureBytes, data);
  } catch (error) {
    console.error('State token verification error:', error);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // JWT verification enforced by config (verify_jwt = true)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response('Forbidden', { status: 403, headers: corsHeaders });
    }

    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const provider = url.searchParams.get('provider');

    if (!code || !state || !provider) {
      return new Response('Missing OAuth parameters', { status: 400, headers: corsHeaders });
    }

    // CRITICAL: Verify state token matches authenticated user
    const isValidState = await verifyStateToken(state, user.id);
    if (!isValidState) {
      console.error('State verification failed for user', user.id);

      // Log security event
      await supabaseClient.from('audit_log').insert({
        user_id: user.id,
        action: 'oauth_state_mismatch',
        resource_type: 'integration',
        metadata: { provider, state_partial: state.substring(0, 8) }
      });

      return new Response('Invalid state token - possible CSRF attack', {
        status: 403,
        headers: corsHeaders
      });
    }

    // Get user's org_id (verified user only)
    const { data: memberData, error: memberError } = await supabaseClient
      .from('members')
      .select('org_id')
      .eq('user_id', user.id)
      .single();

    if (memberError || !memberData) {
      console.error('Error fetching member data:', memberError);
      return new Response('User must belong to an organization', { status: 400, headers: corsHeaders });
    }

    const org_id = memberData.org_id;

    // Exchange code for tokens (provider-specific)
    let accessToken: string;
    let refreshToken: string | null = null;
    let expiresAt: string | null = null;
    let scope: string | null = null;

    const baseUrl = Deno.env.get('SUPABASE_URL')!;
    const callbackUrl = `${baseUrl}/functions/v1/integrations-callback`;

    switch (provider) {
      case 'instagram': {
        const instagramAppId = Deno.env.get('INSTAGRAM_APP_ID');
        const instagramAppSecret = Deno.env.get('INSTAGRAM_APP_SECRET');

        // Exchange code for short-lived token via Facebook Graph API
        const fbResponse = await fetch('https://graph.facebook.com/v18.0/oauth/access_token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: instagramAppId!,
            client_secret: instagramAppSecret!,
            redirect_uri: `${callbackUrl}?provider=instagram`,
            code,
          }),
        });

        const fbData = await fbResponse.json();
        if (fbData.error) {
          console.error('Instagram OAuth error:', fbData.error);
          throw new Error(fbData.error.message);
        }

        // Exchange short-lived token for long-lived token
        const longLivedResponse = await fetch(
          `https://graph.facebook.com/v18.0/oauth/access_token?` +
          `grant_type=fb_exchange_token&` +
          `client_id=${instagramAppId}&` +
          `client_secret=${instagramAppSecret}&` +
          `fb_exchange_token=${fbData.access_token}`
        );

        const longLivedData = await longLivedResponse.json();
        accessToken = longLivedData.access_token || fbData.access_token;
        expiresAt = longLivedData.expires_in
          ? new Date(Date.now() + longLivedData.expires_in * 1000).toISOString()
          : null;
        scope = 'instagram_basic,instagram_content_publish';
        break;
      }

      case 'twitter': {
        const twitterClientId = Deno.env.get('TWITTER_CLIENT_ID');
        const twitterClientSecret = Deno.env.get('TWITTER_CLIENT_SECRET');

        const twitterResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${btoa(`${twitterClientId}:${twitterClientSecret}`)}`,
          },
          body: new URLSearchParams({
            code,
            grant_type: 'authorization_code',
            redirect_uri: `${callbackUrl}?provider=twitter`,
            code_verifier: 'challenge',
          }),
        });

        const twitterData = await twitterResponse.json();
        if (twitterData.error) {
          console.error('Twitter OAuth error:', twitterData.error);
          throw new Error(twitterData.error_description || twitterData.error);
        }

        accessToken = twitterData.access_token;
        refreshToken = twitterData.refresh_token;
        expiresAt = twitterData.expires_in
          ? new Date(Date.now() + twitterData.expires_in * 1000).toISOString()
          : null;
        scope = twitterData.scope;
        break;
      }

      case 'linkedin': {
        const linkedinClientId = Deno.env.get('LINKEDIN_CLIENT_ID');
        const linkedinClientSecret = Deno.env.get('LINKEDIN_CLIENT_SECRET');

        const linkedinResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: `${callbackUrl}?provider=linkedin`,
            client_id: linkedinClientId!,
            client_secret: linkedinClientSecret!,
          }),
        });

        const linkedinData = await linkedinResponse.json();
        if (linkedinData.error) {
          console.error('LinkedIn OAuth error:', linkedinData.error);
          throw new Error(linkedinData.error_description || linkedinData.error);
        }

        accessToken = linkedinData.access_token;
        refreshToken = linkedinData.refresh_token;
        expiresAt = linkedinData.expires_in
          ? new Date(Date.now() + linkedinData.expires_in * 1000).toISOString()
          : null;
        scope = 'r_liteprofile,w_member_social';
        break;
      }

      case 'google_drive': {
        const googleClientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
        const googleClientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET');

        const googleResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: googleClientId!,
            client_secret: googleClientSecret!,
            redirect_uri: `${callbackUrl}?provider=google_drive`,
            grant_type: 'authorization_code',
          }),
        });

        const googleData = await googleResponse.json();
        accessToken = googleData.access_token;
        refreshToken = googleData.refresh_token;
        expiresAt = new Date(Date.now() + googleData.expires_in * 1000).toISOString();
        scope = googleData.scope;
        break;
      }

      case 'shopify': {
        const shopifyClientId = Deno.env.get('SHOPIFY_CLIENT_ID');
        const shopifyClientSecret = Deno.env.get('SHOPIFY_CLIENT_SECRET');
        const shopName = url.searchParams.get('shop');

        const shopifyResponse = await fetch(`https://${shopName}/admin/oauth/access_token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: shopifyClientId,
            client_secret: shopifyClientSecret,
            code,
          }),
        });

        const shopifyData = await shopifyResponse.json();
        accessToken = shopifyData.access_token;
        scope = shopifyData.scope;
        break;
      }

      case 'notion': {
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
            redirect_uri: `${callbackUrl}?provider=notion`,
          }),
        });

        const notionData = await notionResponse.json();
        accessToken = notionData.access_token;
        break;
      }

      default:
        return new Response(`Unsupported provider: ${provider}`, { status: 400, headers: corsHeaders });
    }

    // Store encrypted tokens via secure edge function
    const writeTokenResponse = await fetch(
      `${baseUrl}/functions/v1/integrations-write-token`,
      {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          org_id,
          provider,
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: expiresAt,
          scope,
          metadata: { connected_at: new Date().toISOString() }
        })
      }
    );

    if (!writeTokenResponse.ok) {
      const errorData = await writeTokenResponse.json();
      console.error('Failed to write tokens:', errorData);
      throw new Error('Token storage failed');
    }

    // Redirect back to app with success
    const redirectUrl = new URL('/integrations', Deno.env.get('SITE_URL') ?? 'http://localhost:5173');
    redirectUrl.searchParams.set('success', 'true');
    redirectUrl.searchParams.set('provider', provider);

    return Response.redirect(redirectUrl.toString(), 302);

  } catch (error) {
    console.error('OAuth callback error:', error);

    const redirectUrl = new URL('/integrations', Deno.env.get('SITE_URL') ?? 'http://localhost:5173');
    redirectUrl.searchParams.set('error', 'oauth_failed');

    return Response.redirect(redirectUrl.toString(), 302);
  }
});
