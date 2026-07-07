import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabaseAdmin.ts';
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts';

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const { pin } = await req.json();

    if (!pin || typeof pin !== 'string') {
      return new Response(
        JSON.stringify({ error: 'PIN is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = getServiceClient();
    const { data: family, error: fetchErr } = await supabase
      .from('families')
      .select('id, pin_hash, pin_attempts, pin_locked_until')
      .single();

    if (fetchErr || !family) {
      return new Response(
        JSON.stringify({ error: 'Family not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (family.pin_locked_until && new Date(family.pin_locked_until) > new Date()) {
      const remaining = Math.ceil((new Date(family.pin_locked_until).getTime() - Date.now()) / 1000);
      return new Response(
        JSON.stringify({ error: 'Locked out', seconds_remaining: remaining }),
        { status: 423, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const valid = await bcrypt.compare(pin, family.pin_hash);

    if (!valid) {
      const newAttempts = (family.pin_attempts || 0) + 1;
      const lockout = newAttempts >= 5
        ? new Date(Date.now() + 5 * 60 * 1000).toISOString()
        : null;

      await supabase.from('families').update({
        pin_attempts: newAttempts,
        pin_locked_until: lockout,
      }).eq('id', family.id);

      return new Response(
        JSON.stringify({
          error: 'Incorrect PIN',
          attempts_remaining: Math.max(0, 5 - newAttempts),
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    await supabase.from('families').update({
      pin_attempts: 0,
      pin_locked_until: null,
      current_session_token: token,
      session_expires_at: expiresAt,
    }).eq('id', family.id);

    return new Response(
      JSON.stringify({ session_token: token, expires_at: expiresAt }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
