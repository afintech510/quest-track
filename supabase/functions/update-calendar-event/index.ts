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

    const { id, kid_id, title, description, category, start_time, end_time, rrule, is_someday } = await req.json();

    if (!id) {
      return new Response(
        JSON.stringify({ status: 'error', message: 'id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const updates: Record<string, unknown> = {};
    if (kid_id !== undefined) updates.kid_id = kid_id;
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (category !== undefined) updates.category = category;
    if (start_time !== undefined) updates.start_time = start_time;
    if (end_time !== undefined) updates.end_time = end_time;
    if (rrule !== undefined) updates.rrule = rrule;
    if (is_someday !== undefined) updates.is_someday = is_someday;

    const { data, error } = await supabase
      .from('calendar_events')
      .update(updates)
      .eq('id', id)
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
