import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabaseAdmin.ts';
import { validateSession } from '../_shared/validate-session.ts';

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const supabase = getServiceClient();
    const authErr = await validateSession(req, supabase);
    if (authErr) return authErr;

    const { chore_event_id } = await req.json();

    if (!chore_event_id) {
      return new Response(
        JSON.stringify({ status: 'error', message: 'chore_event_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data, error } = await supabase
      .from('chore_events')
      .update({ status: 'approved', reviewed_at: new Date().toISOString() })
      .eq('id', chore_event_id)
      .eq('status', 'pending_approval')
      .select()
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({ status: 'success', event: data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ status: 'error', message: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
