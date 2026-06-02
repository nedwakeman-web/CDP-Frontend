/**
 * CDP: analytics, the observation layer.
 *
 * This is what turns a deployed surface into a trial you can read. It sends a
 * small, fixed set of typed events to Supabase against an anonymous, per-browser
 * client id, so uptake, pace, and scale are observable before any account exists.
 * No personal content is sent: an event carries its name and a few structural
 * properties (a lens, a count, a millisecond duration), never the words a person
 * held. That keeps observation honest and the person's holding private.
 *
 * Every send is non-blocking and swallows its own errors, so a missing backend
 * or a schema mismatch can never break the surface. When Supabase is not
 * configured the events are dropped silently, and the application runs unchanged.
 *
 * Requires this table and a permissive insert policy in Supabase:
 *
 *   create table if not exists analytics (
 *     id bigint generated always as identity primary key,
 *     event text not null,
 *     props jsonb not null default '{}'::jsonb,
 *     client_id text not null,
 *     session_id text not null,
 *     created_at timestamptz not null default now()
 *   );
 *   create index if not exists analytics_event_idx on analytics (event, created_at);
 *   create index if not exists analytics_client_idx on analytics (client_id, created_at);
 *   alter table analytics enable row level security;
 *   create policy "anon insert" on analytics for insert with check (true);
 *
 * House style holds in this file: no em dashes, no en dashes, no exclamation
 * marks, in code and in comments alike.
 */

import { getSupabase } from './supabase';

/** The fixed event vocabulary. Adding an event is a deliberate edit here. */
export type CdpEvent =
  | 'session_start'
  | 'surface_view'
  | 'intention_held'
  | 'reply_requested'
  | 'reply_delivered'
  | 'reply_degraded'
  | 'voice_changed'
  | 'voice_reheard'
  | 'menu_opened'
  | 'deep_reading_opened';

type Props = Record<string, string | number | boolean>;

const CLIENT_KEY = 'cdp_client_id';

function newId(prefix: string): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function clientId(): string {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const existing = window.localStorage.getItem(CLIENT_KEY);
      if (existing) return existing;
      const fresh = newId('c_');
      window.localStorage.setItem(CLIENT_KEY, fresh);
      return fresh;
    }
  } catch (_e) {
    // fall through to an ephemeral id
  }
  return newId('c_');
}

// One session id per page load, so returns and depth-per-visit are countable.
const SESSION_ID = newId('s_');

/**
 * Record an event. Fire and forget: the caller never waits and never sees an
 * error. A failure to record is never allowed to affect what the person sees.
 */
export function trackEvent(event: CdpEvent, props: Props = {}): void {
  void send(event, props);
}

async function send(event: CdpEvent, props: Props): Promise<void> {
  try {
    const client = await getSupabase();
    if (!client) return;
    await client.from('analytics').insert([
      { event, props, client_id: clientId(), session_id: SESSION_ID, created_at: new Date().toISOString() },
    ]);
  } catch (_e) {
    // Observation is best-effort and silent. The surface is never affected.
  }
}
