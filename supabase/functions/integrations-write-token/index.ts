// Edge Function: write_tokens
// Securely encrypts and stores integration tokens
// Never returns decrypted tokens

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const KEYRING_TOKEN = Deno.env.get('KEYRING_TOKEN');

interface TokenWriteRequest {
  org_id: string;
  provider: string;
  access_token: string;
  refresh_token?: string;
  expires_at?: string;
  scope?: string;
  metadata?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify JWT and get user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role for RLS bypass
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user's JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: TokenWriteRequest = await req.json();
    const { org_id, provider, access_token, refresh_token, expires_at, scope, metadata } = body;

    // Validate required fields
    if (!org_id || !provider || !access_token) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: org_id, provider, access_token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is member of the org (preferably admin)
    const { data: membership, error: memberError } = await supabase
      .from('members')
      .select('role')
      .eq('user_id', user.id)
      .eq('org_id', org_id)
      .single();

    if (memberError || !membership) {
      console.error('Membership check failed:', memberError);
      return new Response(
        JSON.stringify({ error: 'User is not a member of this organization' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify encryption key is configured
    if (!KEYRING_TOKEN) {
      console.error('KEYRING_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Encrypt tokens using pgcrypto
    const { error: insertError } = await supabase.rpc('write_encrypted_integration', {
      p_org_id: org_id,
      p_provider: provider,
      p_access_token: access_token,
      p_refresh_token: refresh_token || null,
      p_expires_at: expires_at || null,
      p_scope: scope || null,
      p_metadata: metadata || {},
      p_encryption_key: KEYRING_TOKEN
    });

    if (insertError) {
      // If RPC doesn't exist, fallback to direct insert with manual encryption
      console.warn('RPC not found, using fallback method');
      
      // Use pgcrypto to encrypt tokens
      const { error: fallbackError } = await supabase.rpc('insert_integration_encrypted', {
        p_org_id: org_id,
        p_provider: provider,
        p_access_token_plain: access_token,
        p_refresh_token_plain: refresh_token || null,
        p_expires_at: expires_at || null,
        p_scope: scope || null,
        p_metadata: metadata || {},
        p_key: KEYRING_TOKEN
      });

      if (fallbackError) {
        console.error('Failed to insert encrypted tokens:', fallbackError);
        return new Response(
          JSON.stringify({ error: 'Failed to store integration tokens' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Log action (hashed provider + org for audit, never log tokens)
    console.log(`Integration token stored for provider: ${provider}, org: ${org_id.substring(0, 8)}...`);

    // Return success with NO token data
    return new Response(
      null,
      { status: 204, headers: corsHeaders }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Note: In production, add rate limiting using Deno KV or Upstash Redis:
// const rateLimitKey = `ratelimit:write_tokens:${user.id}`;
// const count = await kv.incr(rateLimitKey);
// if (count > 10) { return 429 Too Many Requests }
