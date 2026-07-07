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

    const { kid_id, book_id } = await req.json();

    if (!kid_id || !book_id) {
      return new Response(
        JSON.stringify({ error: 'kid_id and book_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }


    const { data: existing } = await supabase
      .from('book_progress')
      .select('id')
      .eq('kid_id', kid_id)
      .eq('book_id', book_id)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ status: 'already_assigned' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { error } = await supabase
      .from('book_progress')
      .insert({
        kid_id,
        book_id,
        status: 'assigned',
        current_chapter: 0,
      });

    if (error) {
      if (error.code === '23505') {
        return new Response(
          JSON.stringify({ status: 'already_assigned' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ status: 'success' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (_err) {
    return new Response(
      JSON.stringify({ error: 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
