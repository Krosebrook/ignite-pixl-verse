// Edge Function: write_tokens
// Securely encrypts and stores integration tokens using pgcrypto
// Never returns decrypted tokens

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: TokenWriteRequest = await req.json();
    const { org_id, provider, access_token, refresh_token, expires_at, scope, metadata } = body;

    if (!org_id || !provider || !access_token) {
      return new Response(
        JSON.stringify({ 
          error: 'Validation failed',
          cause: 'Missing required fields: org_id, provider, access_token',
          fix: 'Ensure all required fields are provided',
          retry: true
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get encryption key
    const KEYRING_TOKEN = Deno.env.get('KEYRING_TOKEN');
    if (!KEYRING_TOKEN) {
      console.error('KEYRING_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use encryption RPC (verifies membership internally)
    const { data: integrationId, error: rpcError } = await supabase.rpc(
      'write_encrypted_integration',
      {
        p_org_id: org_id,
        p_provider: provider,
        p_access_token: access_token,
        p_refresh_token: refresh_token || null,
        p_expires_at: expires_at || null,
        p_scope: scope || null,
        p_metadata: metadata || {},
        p_encryption_key: KEYRING_TOKEN
      }
    );

    if (rpcError) {
      console.error('Encryption RPC failed:', rpcError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to store integration',
          cause: rpcError.message,
          fix: 'Verify organization membership and try again',
          retry: true
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✓ Token encrypted for provider: ${provider}, org: ${org_id.substring(0, 8)}..., integration_id: ${integrationId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        integration_id: integrationId,
        message: 'Integration tokens securely stored'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
