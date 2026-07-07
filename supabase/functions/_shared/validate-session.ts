import { corsHeaders } from './cors.ts';

export async function validateSession(req: Request, supabase: any): Promise<Response | null> {
  const token = req.headers.get('x-session-token');
  if (!token) {
    return new Response(
      JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Missing session token' } }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const { data: family } = await supabase
    .from('families')
    .select('current_session_token, session_expires_at')
    .single();

  if (!family || family.current_session_token !== token) {
    return new Response(
      JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Invalid session token' } }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  if (new Date(family.session_expires_at) < new Date()) {
    return new Response(
      JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Session token expired' } }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  return null;
}
