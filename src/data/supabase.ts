/**
 * CDP: the Supabase access point.
 *
 * One narrow, lazily-constructed client, configured entirely from environment
 * variables, so the application runs with or without a backend configured. When
 * the environment is not set, this returns null and every caller degrades to a
 * local, on-device path rather than breaking. This is the same safe-by-default
 * discipline the orchestrator follows: a missing backend is degraded, never fatal.
 *
 * The client SDK is imported dynamically, so a build that never reaches a signed
 * in path does not pay for the dependency up front, and the typecheck of the rest
 * of the system does not depend on the SDK's types.
 *
 * Set in Netlify (and in a local .env for development):
 *   VITE_SUPABASE_URL       the project URL
 *   VITE_SUPABASE_ANON_KEY  the anon public key (safe to ship to the browser)
 *
 * House style holds in this file: no em dashes, no en dashes, no exclamation
 * marks, in code and in comments alike.
 */

/** The minimal surface of the client the vessel uses. Kept narrow on purpose. */
export interface SupabaseLike {
  from(table: string): {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
      };
    };
    upsert: (row: Record<string, unknown>, options?: Record<string, unknown>) => Promise<{ error: unknown }>;
    insert: (rows: Array<Record<string, unknown>>) => Promise<{ error: unknown }>;
  };
  auth: {
    getUser: () => Promise<{ data: { user: { id: string } | null }; error: unknown }>;
    signInWithOAuth: (params: { provider: string; options?: { redirectTo?: string } }) => Promise<{ data: unknown; error: unknown }>;
    signInWithOtp: (params: { email: string; options?: { emailRedirectTo?: string } }) => Promise<{ data: unknown; error: unknown }>;
    signOut: () => Promise<{ error: unknown }>;
  };
}

function env(name: string): string {
  const v = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return (v && v[name]) || '';
}

export function isSupabaseConfigured(): boolean {
  return env('VITE_SUPABASE_URL').length > 0 && env('VITE_SUPABASE_ANON_KEY').length > 0;
}

let clientPromise: Promise<SupabaseLike | null> | null = null;

/**
 * The shared client, created at most once. Returns null when the environment is
 * not configured, so callers can fall back to a local path without a thrown error.
 */
export function getSupabase(): Promise<SupabaseLike | null> {
  if (clientPromise) return clientPromise;
  if (!isSupabaseConfigured()) {
    clientPromise = Promise.resolve(null);
    return clientPromise;
  }
  clientPromise = import('@supabase/supabase-js')
    .then((mod) => {
      const create = (mod as { createClient: (url: string, key: string, opts?: unknown) => unknown }).createClient;
      const client = create(env('VITE_SUPABASE_URL'), env('VITE_SUPABASE_ANON_KEY'), {
        auth: { persistSession: true, autoRefreshToken: true },
      });
      return client as unknown as SupabaseLike;
    })
    .catch(() => null);
  return clientPromise;
}

/** The authenticated user id, or null when there is no backend or no signed in user. */
export async function currentUserId(): Promise<string | null> {
  const client = await getSupabase();
  if (!client) return null;
  try {
    const res = await client.auth.getUser();
    return res.data && res.data.user ? res.data.user.id : null;
  } catch (_e) {
    return null;
  }
}

/** Begin Google sign in. The SDK redirects the browser to the provider and back
 *  to redirectTo, where a fresh load picks up the session. A failure to start
 *  leaves the person on the surface, signed out, never broken. */
export async function signInWithGoogle(redirectTo: string): Promise<void> {
  const client = await getSupabase();
  if (!client) return;
  try {
    await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo } });
  } catch (_e) {
    // Degraded, not fatal.
  }
}

/** Send a one-time sign in link by email. Returns whether the request was
 *  accepted, so the surface can tell the person to check their inbox. */
export async function signInWithMagicLink(email: string, redirectTo: string): Promise<{ ok: boolean }> {
  const client = await getSupabase();
  if (!client) return { ok: false };
  try {
    const res = await client.auth.signInWithOtp({ email: email, options: { emailRedirectTo: redirectTo } });
    return { ok: !res.error };
  } catch (_e) {
    return { ok: false };
  }
}

/** End the session. Callers reload afterwards so the store reverts to on-device. */
export async function signOut(): Promise<void> {
  const client = await getSupabase();
  if (!client) return;
  try {
    await client.auth.signOut();
  } catch (_e) {
    // Already signed out or no backend; nothing to do.
  }
}
