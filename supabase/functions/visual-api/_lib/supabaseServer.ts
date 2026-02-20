// Supabase service role client (server-side only)
// NEVER expose service role key to client

import { createClient } from '@supabase/supabase-js';

let _client: ReturnType<typeof createClient> | null = null;

export function getSupabaseServer() {
  if (_client) return _client;

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  _client = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return _client;
}

// -------------------------------------------------------
// Auth helpers
// -------------------------------------------------------

export class AuthError extends Error {
  readonly status = 401;
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Validate the user JWT from the Authorization header.
 *
 * Uses the service-role client with an explicit jwt argument to auth.getUser(token).
 * This is required because auth.getUser() without an argument uses the client's
 * internal session (null on a fresh client), causing GoTrue to receive Bearer null
 * and return "Invalid JWT". Passing the token explicitly bypasses that.
 *
 * Returns the authenticated user's UUID, which is used as project_id.
 * Throws AuthError (status 401) if the token is missing, malformed, or expired.
 */
export async function getUserFromRequest(req: Request) {
  const authHeader = req.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthError('Missing or invalid Authorization header');
  }

  const token = authHeader.slice(7);

  const { data: { user }, error } =
    await getSupabaseServer().auth.getUser(token);

  if (error || !user) {
    throw new AuthError(error?.message ?? 'Invalid or expired token');
  }

  return user.id;
}
