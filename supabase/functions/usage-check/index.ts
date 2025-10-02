import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UsageCheckRequest {
  org_id: string;
  estimated_tokens: number;
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

    const { org_id, estimated_tokens }: UsageCheckRequest = await req.json();

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

    // Get current usage
    const { data: usage } = await supabaseClient
      .from('usage_credits')
      .select('*')
      .eq('org_id', org_id)
      .single();

    if (!usage) {
      // Initialize usage record
      const { data: newUsage } = await supabaseClient
        .from('usage_credits')
        .insert({
          org_id,
          plan: 'STARTER',
          used_tokens: 0,
          month_start: new Date(new Date().setDate(1)).toISOString(),
          hard_limit_tokens: 1000000,
        })
        .select()
        .single();

      return new Response(
        JSON.stringify({
          ok: true,
          used_tokens: 0,
          remaining_tokens: 1000000,
          limit: 1000000,
          plan: 'STARTER',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const remaining = Math.max(0, usage.hard_limit_tokens - usage.used_tokens);
    const wouldExceed = (usage.used_tokens + estimated_tokens) > usage.hard_limit_tokens;

    return new Response(
      JSON.stringify({
        ok: !wouldExceed,
        used_tokens: usage.used_tokens,
        remaining_tokens: remaining,
        limit: usage.hard_limit_tokens,
        plan: usage.plan,
        estimated_tokens,
      }),
      {
        status: wouldExceed ? 402 : 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Usage check error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
