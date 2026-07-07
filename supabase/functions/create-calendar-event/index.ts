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

    const { family_id, kid_id, title, description, category, start_time, end_time, rrule, is_someday } = await req.json();

    if (!family_id || !title) {
      return new Response(
        JSON.stringify({ status: 'error', message: 'family_id and title are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data, error } = await supabase
      .from('calendar_events')
      .insert({
        family_id,
        kid_id: kid_id || null,
        title,
        description: description || '',
        category: category || 'general',
        start_time: start_time || new Date().toISOString(),
        end_time: end_time || null,
        rrule: rrule || null,
        is_someday: is_someday || false,
      })
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
