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

    const { family_id } = await req.json();

    if (!family_id) {
      return new Response(
        JSON.stringify({ status: 'error', message: 'family_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: kidsData, error: kidsError } = await supabase
      .from('kids')
      .select('id')
      .eq('family_id', family_id);

    if (kidsError) throw kidsError;

    for (const kid of kidsData || []) {
      await supabase
        .from('kids')
        .update({ level: 1, xp: 0, coins: 0, daily_xp_earned: 0, streak_days: 0 })
        .eq('id', kid.id);

      await supabase.from('chore_events').delete().eq('kid_id', kid.id);
      await supabase.from('quiz_attempts').delete().eq('kid_id', kid.id);
    }

    return new Response(
      JSON.stringify({ status: 'success' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ status: 'error', message: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
