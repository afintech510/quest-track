import { corsHeaders } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabaseAdmin.ts';

const FAMILY_ID = Deno.env.get('FAMILY_ID')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const now = new Date();
    const etHour = parseInt(
      now.toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false })
    );

    if (etHour !== 0) {
      return new Response(
        JSON.stringify({ status: 'not_midnight_et', hour: etHour }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = getServiceClient();
    const todayET = now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

    const { data, error } = await supabase.rpc('perform_daily_reset', {
      p_family_id: FAMILY_ID,
      p_target_date: todayET,
    });

    if (error) {
      return new Response(
        JSON.stringify({ status: 'error', message: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DEFERRED: configure Resend/SendGrid API key in Edge Function env vars
    // Send parent notification: "QuestTrack Daily Reset — [date]. [N] chores pending your review."
    console.log(`Daily reset complete for ${todayET}:`, data);

    return new Response(
      JSON.stringify({ status: 'reset_complete', data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ status: 'error', message: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
