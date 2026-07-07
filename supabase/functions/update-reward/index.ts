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
    const { id, title, description, icon, cost, max_per_day, is_active } = await req.json();

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
    if (cost !== undefined) updates.cost = cost;
    if (max_per_day !== undefined) updates.max_per_day = max_per_day;
    if (is_active !== undefined) updates.is_active = is_active;

    const { data, error } = await supabase
      .from('rewards')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({ status: 'success', reward: data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ status: 'error', message: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
