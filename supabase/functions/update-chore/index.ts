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
    const { id, title, description, icon, xp_reward, coin_reward, frequency, auto_approve_hours, is_active, assigned_to } = await req.json();

    if (!id) {
      return new Response(
        JSON.stringify({ status: 'error', message: 'id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (icon !== undefined) updates.icon = icon;
    if (xp_reward !== undefined) updates.xp_reward = xp_reward;
    if (coin_reward !== undefined) updates.coin_reward = coin_reward;
    if (frequency !== undefined) updates.frequency = frequency;
    if (auto_approve_hours !== undefined) updates.auto_approve_hours = auto_approve_hours;
    if (is_active !== undefined) updates.is_active = is_active;
    if (assigned_to !== undefined) updates.assigned_to = assigned_to;

    const { data, error } = await supabase
      .from('chore_definitions')
      .update(updates)
      .eq('id', id)
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
