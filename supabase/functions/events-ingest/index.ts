import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalyticsEvent {
  org_id: string;
  user_id: string;
  event_type: string;
  event_category: string;
  duration_ms?: number;
  metadata?: Record<string, any>;
}

interface BatchEventsRequest {
  events: AnalyticsEvent[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[events-ingest] Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error('[events-ingest] Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    
    // Validate request
    if (req.method === 'POST' && body.events && Array.isArray(body.events)) {
      const { events } = body as BatchEventsRequest;

      console.log(`[events-ingest] Processing ${events.length} events for user ${user.id}`);

      // Validate all events have required fields
      const validEvents = events.filter(event => {
        const isValid = event.org_id && 
                       event.user_id && 
                       event.event_type && 
                       event.event_category;
        
        if (!isValid) {
          console.warn('[events-ingest] Invalid event:', event);
        }
        
        return isValid;
      });

      if (validEvents.length === 0) {
        return new Response(
          JSON.stringify({ error: 'No valid events to process' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify user has access to the org
      const orgIds = [...new Set(validEvents.map(e => e.org_id))];
      const { data: memberCheck, error: memberError } = await supabase
        .from('members')
        .select('org_id')
        .eq('user_id', user.id)
        .in('org_id', orgIds);

      if (memberError || !memberCheck || memberCheck.length !== orgIds.length) {
        console.error('[events-ingest] User not member of all orgs:', memberError);
        return new Response(
          JSON.stringify({ error: 'Unauthorized for one or more organizations' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Batch insert events
      const { data, error } = await supabase
        .from('analytics_events')
        .insert(validEvents.map(event => ({
          org_id: event.org_id,
          user_id: event.user_id,
          event_type: event.event_type,
          event_category: event.event_category,
          duration_ms: event.duration_ms || null,
          metadata: event.metadata || {},
        })));

      if (error) {
        console.error('[events-ingest] Insert error:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to insert events', details: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[events-ingest] Successfully inserted ${validEvents.length} events`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          inserted: validEvents.length,
          skipped: events.length - validEvents.length 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle single event POST
    if (req.method === 'POST') {
      const event = body as AnalyticsEvent;

      // Validate required fields
      if (!event.org_id || !event.user_id || !event.event_type || !event.event_category) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: org_id, user_id, event_type, event_category' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify user has access to org
      const { data: memberCheck, error: memberError } = await supabase
        .from('members')
        .select('org_id')
        .eq('user_id', user.id)
        .eq('org_id', event.org_id)
        .single();

      if (memberError || !memberCheck) {
        console.error('[events-ingest] User not member of org:', memberError);
        return new Response(
          JSON.stringify({ error: 'Unauthorized for organization' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error } = await supabase
        .from('analytics_events')
        .insert({
          org_id: event.org_id,
          user_id: event.user_id,
          event_type: event.event_type,
          event_category: event.event_category,
          duration_ms: event.duration_ms || null,
          metadata: event.metadata || {},
        });

      if (error) {
        console.error('[events-ingest] Insert error:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to insert event', details: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[events-ingest] Successfully inserted event: ${event.event_type}`);

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[events-ingest] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
