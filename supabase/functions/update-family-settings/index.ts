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

    const { family_id, force_morning_boost, auto_approve_hours } = await req.json();

    if (!family_id) {
      return new Response(
        JSON.stringify({ status: 'error', message: 'family_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const updates: Record<string, unknown> = {};
    if (force_morning_boost !== undefined) updates.force_morning_boost = force_morning_boost;
    if (auto_approve_hours !== undefined) updates.auto_approve_hours = auto_approve_hours;

    const { data, error } = await supabase
      .from('families')
      .update(updates)
      .eq('id', family_id)
      .select('id, force_morning_boost, auto_approve_hours')
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({ status: 'success', family: data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ status: 'error', message: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
