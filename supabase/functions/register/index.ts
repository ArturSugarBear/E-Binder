import { createClient } from 'npm:@supabase/supabase-js@2.119.0';

// Supabase's runtime supplies these bindings; no server secret enters the SPA.
declare const Deno: {
  env: { get: (name: string) => string | undefined };
  serve: (handler: (request: Request) => Promise<Response>) => void;
};
const project = Deno.env.get('SUPABASE_URL')!;
const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(project, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const allowed = new Set([
  'https://artursugarbear.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
  'http://localhost:4173',
]);
Deno.serve(async (request) => {
  const origin = request.headers.get('origin') ?? '';
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowed.has(origin)
      ? origin
      : 'https://artursugarbear.github.io',
    Vary: 'Origin',
    'Access-Control-Allow-Headers':
      'apikey, authorization, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store',
  };
  const reply = (status: number, message: string) =>
    new Response(JSON.stringify({ message }), { status, headers });
  if (request.method === 'OPTIONS')
    return new Response(null, { status: 204, headers });
  if (request.method !== 'POST' || (origin && !allowed.has(origin)))
    return reply(403, 'Anfrage nicht erlaubt.');
  try {
    const body = await request.text();
    if (body.length > 4096) return reply(400, 'Die Eingabe ist zu lang.');
    const { username, password } = JSON.parse(body);
    if (
      typeof username !== 'string' ||
      !/^[a-z0-9][a-z0-9_-]{2,23}$/.test(username) ||
      typeof password !== 'string' ||
      password.length < 12 ||
      password.length > 128
    )
      return reply(
        400,
        'Nutzername: 3–24 Zeichen (a–z, Zahlen, _ oder -). Passwort: 12–128 Zeichen.',
      );
    const address = (request.headers.get('x-forwarded-for') ?? 'unknown')
      .split(',')[0]!
      .trim();
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const fingerprint = [
      ...new Uint8Array(
        await crypto.subtle.sign(
          'HMAC',
          key,
          new TextEncoder().encode(address),
        ),
      ),
    ]
      .map((x) => x.toString(16).padStart(2, '0'))
      .join('');
    const rate = await admin.rpc('reserve_signup', {
      p_fingerprint: fingerprint,
    });
    if (rate.error || !rate.data)
      return reply(
        429,
        'Zu viele Registrierungsversuche. Bitte warte 15 Minuten.',
      );
    const result = await admin.auth.admin.createUser({
      email: `${username}@users.e-binder.invalid`,
      password,
      email_confirm: true,
      user_metadata: { username },
      app_metadata: { e_binder_account: true },
    });
    if (result.error)
      return reply(
        409,
        'Dieses Konto kann nicht angelegt werden. Der Name ist möglicherweise vergeben oder die kleine Testrunde ist voll.',
      );
    return reply(201, 'Konto angelegt.');
  } catch {
    return reply(
      503,
      'Die Registrierung ist gerade nicht erreichbar. Bitte versuche es erneut.',
    );
  }
});
