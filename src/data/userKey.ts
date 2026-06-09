/*
 * CDP Vessel, data layer: the per person key for continuity calls.
 *
 * v19_userKey on the server reads body.user_id, query.user_id, or the
 * x-cdp-anon-id header, in that order. We send the signed in id in the body and
 * the anonymous device id in the header, matching that contract exactly. The
 * device id is minted once and kept in localStorage next to the rest of the
 * client device state. This helper lives here, in the data layer, so every
 * surface that keys a continuity call, the home greeting, the patterns fetch,
 * and the reading start, draws on one identity rather than two.
 *
 * House style holds in this file: no em dashes, no en dashes, no exclamation
 * marks, in code and in comments alike.
 */

import { currentUserId } from './supabase';

const CDP_ANON_KEY = 'cdp-anon-id';

/** A stable per device id for the anonymous case, minted once and persisted. */
export function cdpAnonId(): string {
  const mint = (): string =>
    (window.crypto && typeof window.crypto.randomUUID === 'function')
      ? window.crypto.randomUUID()
      : 'anon-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  try {
    const existing = window.localStorage.getItem(CDP_ANON_KEY);
    if (existing) return existing;
    const minted = mint();
    window.localStorage.setItem(CDP_ANON_KEY, minted);
    return minted;
  } catch (_e) {
    /* storage blocked: a per load id still keys the session, just not across loads */
    return mint();
  }
}

export interface UserKeyParts { headers: Record<string, string>; body: Record<string, string>; }

/**
 * Resolve the continuity key. The signed in id goes in the body, otherwise the
 * anonymous device id goes in the header, matching the server v19_userKey
 * contract. Falls back to the anonymous id on any auth error, never throws.
 */
export async function cdpUserKeyParts(): Promise<UserKeyParts> {
  try {
    const uid = await currentUserId();
    if (uid) return { headers: {}, body: { user_id: String(uid) } };
  } catch (_e) { /* fall through to the anonymous device id */ }
  return { headers: { 'x-cdp-anon-id': cdpAnonId() }, body: {} };
}
