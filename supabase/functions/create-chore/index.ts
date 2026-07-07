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
    const { family_id, title, description, icon, xp_reward, coin_reward, frequency, auto_approve_hours, assigned_to } = await req.json();

    if (!family_id || !title) {
      return new Response(
        JSON.stringify({ status: 'error', message: 'family_id and title are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data, error } = await supabase
      .from('chore_definitions')
      .insert({
        family_id,
        title,
        description: description || '',
        icon: icon || '',
        xp_reward: xp_reward ?? 10,
        coin_reward: coin_reward ?? 5,
        frequency: frequency || 'daily',
        auto_approve_hours: auto_approve_hours ?? 24,
        assigned_to: assigned_to || null,
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({ status: 'success', chore: data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ status: 'error', message: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
