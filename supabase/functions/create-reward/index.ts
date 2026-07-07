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
    const { family_id, title, description, icon, cost, max_per_day } = await req.json();

    if (!family_id || !title) {
      return new Response(
        JSON.stringify({ status: 'error', message: 'family_id and title are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data, error } = await supabase
      .from('rewards')
      .insert({
        family_id,
        title,
        description: description || '',
        icon: icon || '',
        cost: cost ?? 0,
        max_per_day: max_per_day ?? 1,
      })
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
