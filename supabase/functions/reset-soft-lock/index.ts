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

    const { kid_id } = await req.json();

    if (!kid_id) {
      return new Response(
        JSON.stringify({ status: 'error', message: 'kid_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data, error } = await supabase
      .from('kids')
      .update({
        soft_lock_active: false,
        soft_lock_wrong_attempts: 0,
      })
      .eq('id', kid_id)
      .select('id, name, soft_lock_active')
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({ status: 'success', kid: data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ status: 'error', message: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
