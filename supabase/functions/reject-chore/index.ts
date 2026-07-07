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


    const { data: event, error: fetchErr } = await supabase
      .from('chore_events')
      .select('*')
      .eq('id', chore_event_id)
      .eq('status', 'pending_approval')
      .single();

    if (fetchErr || !event) {
      return new Response(
        JSON.stringify({ status: 'error', message: 'Event not found or not pending approval' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { error: updateErr } = await supabase
      .from('chore_events')
      .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
      .eq('id', chore_event_id);

    if (updateErr) throw updateErr;

    // Claw back coins and XP
    const coinsBack = event.coins_awarded || 0;
    const xpBack = event.xp_awarded || 0;

    if (coinsBack > 0 || xpBack > 0) {
      const { data: kid } = await supabase
        .from('kids')
        .select('coins, xp, daily_xp_earned')
        .eq('id', event.kid_id)
        .single();

      if (kid) {
        await supabase
          .from('kids')
          .update({
            coins: Math.max(0, kid.coins - coinsBack),
            xp: Math.max(0, kid.xp - xpBack),
            daily_xp_earned: Math.max(0, kid.daily_xp_earned - xpBack),
          })
          .eq('id', event.kid_id);
      }
    }

    return new Response(
      JSON.stringify({ status: 'success', reversed: { coins: coinsBack, xp: xpBack } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ status: 'error', message: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
