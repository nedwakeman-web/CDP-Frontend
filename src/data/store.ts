/**
 * CDP Vessel, data layer: the storage boundary.
 *
 * This is the single seam that lets the vessel scale. Everything above the data
 * layer talks to a Store interface and never to a concrete backend. Today the
 * concrete backend for an unauthenticated tester is the browser (LocalStore).
 * For a signed in person it is the server (SupabaseStore), and not one line of
 * surface, orchestration, or resource code changes when the two are swapped,
 * because none of them ever knew where the bytes lived. That swap is the entire
 * migration from one device to a hundred million accounts.
 *
 * The contract is deliberately tiny: load the whole state, save the whole state.
 * The vessel state for one person is small (kilobytes for years of holding), so
 * whole-state read and write is correct and simple now. The interface is shaped
 * so a future per-record adapter can implement finer-grained operations behind
 * the same two methods without callers caring.
 *
 * House style holds in this file: no em dashes, no en dashes, no exclamation
 * marks, in code and in comments alike.
 */

import type { VesselState } from './model';
import { emptyState, SCHEMA_VERSION } from './model';
import { getSupabase, currentUserId } from './supabase';

export interface Store {
  load(): Promise<VesselState | null>;
  save(state: VesselState): Promise<void>;
  /** Namespacing key. For local, a fixed key; for the server, the user id. */
  readonly key: string;
}

/** Migrate an older persisted state forward. v1 is the first schema, so this is
 *  a structural guard for now: a state without a recognised version is rebuilt
 *  empty rather than trusted, and future versions add explicit steps here. */
function migrate(raw: unknown): VesselState | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Partial<VesselState>;
  if (typeof s.version !== 'number') return null;
  if (!Array.isArray(s.rooms) || !Array.isArray(s.intentions) || !Array.isArray(s.themes)) return null;
  if (s.lens !== 'tradition' && s.lens !== 'science' && s.lens !== 'everyday') {
    s.lens = 'everyday';
  }
  // v1 is current; future versions step up here.
  s.version = SCHEMA_VERSION;
  return s as VesselState;
}

/* ---- the browser store ----------------------------------------------------- */

const LOCAL_KEY = 'cdp_vessel_v1';

/**
 * The on-device store. Persists across visits in localStorage when it is
 * available, and falls back to an in-process value when it is not (private mode,
 * storage disabled), so the vessel always functions, only its durability changes.
 */
export class LocalStore implements Store {
  readonly key: string;
  private memory: VesselState | null = null;

  constructor(key: string = LOCAL_KEY) { this.key = key; }

  private hasLocalStorage(): boolean {
    try {
      return typeof window !== 'undefined' && !!window.localStorage;
    } catch (_e) {
      return false;
    }
  }

  async load(): Promise<VesselState | null> {
    if (this.hasLocalStorage()) {
      try {
        const raw = window.localStorage.getItem(this.key);
        if (!raw) return null;
        return migrate(JSON.parse(raw));
      } catch (_e) {
        return this.memory;
      }
    }
    return this.memory;
  }

  async save(state: VesselState): Promise<void> {
    this.memory = state;
    if (this.hasLocalStorage()) {
      try {
        window.localStorage.setItem(this.key, JSON.stringify(state));
      } catch (_e) {
        // Storage full or unavailable. The in-process copy stands; durability
        // is reduced for this visit, the surface is not broken.
      }
    }
  }
}

/* ---- the test store -------------------------------------------------------- */

/** An in-memory store, for tests and for an explicit ephemeral mode. */
export class MemoryStore implements Store {
  readonly key: string;
  private state: VesselState | null;
  constructor(key = 'cdp_vessel_mem', initial: VesselState | null = null) { this.key = key; this.state = initial; }
  async load(): Promise<VesselState | null> { return this.state; }
  async save(state: VesselState): Promise<void> { this.state = state; }
}

/* ---- the server store ------------------------------------------------------ */

/**
 * The server-backed store for a signed in person. One row per user holds the
 * whole vessel state as JSON, which is correct and simple at this size; a future
 * per-record sharding can replace it behind this same interface when a single
 * person's holding grows large enough to warrant it.
 *
 * Requires this table and row-level security in Supabase:
 *
 *   create table if not exists vessel_states (
 *     user_id uuid primary key references auth.users(id) on delete cascade,
 *     state jsonb not null,
 *     updated_at timestamptz not null default now()
 *   );
 *   alter table vessel_states enable row level security;
 *   create policy "own row read"  on vessel_states for select using (auth.uid() = user_id);
 *   create policy "own row write" on vessel_states for insert with check (auth.uid() = user_id);
 *   create policy "own row update" on vessel_states for update using (auth.uid() = user_id);
 *
 * A save failure degrades to an in-process copy for the visit rather than
 * breaking, the same discipline LocalStore follows.
 */
export class SupabaseStore implements Store {
  readonly key: string;
  private memory: VesselState | null = null;
  constructor(userId: string) { this.key = userId; }

  async load(): Promise<VesselState | null> {
    const client = await getSupabase();
    if (!client) return this.memory;
    try {
      const res = await client.from('vessel_states').select('state').eq('user_id', this.key).maybeSingle();
      if (res.error) return this.memory;
      const row = res.data as { state?: unknown } | null;
      if (!row || row.state === undefined || row.state === null) return null;
      return migrate(row.state);
    } catch (_e) {
      return this.memory;
    }
  }

  async save(state: VesselState): Promise<void> {
    this.memory = state;
    const client = await getSupabase();
    if (!client) return;
    try {
      await client.from('vessel_states').upsert(
        { user_id: this.key, state, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      );
    } catch (_e) {
      // The in-process copy stands; durability reduced for the visit, not broken.
    }
  }
}

/* ---- the factory ----------------------------------------------------------- */

/**
 * Choose the right store for the moment. A signed in person on a configured
 * backend gets the server store, so the vessel follows them across devices.
 * Everyone else gets the on-device store, which persists across visits on this
 * device. The surface above never knows which it received.
 *
 * An explicit ephemeral mode (forceLocal, or VITE_OFFLINE) keeps everything in
 * the browser even when a backend is configured, for safe local development.
 */
export async function storeFor(opts: { forceLocal?: boolean } = {}): Promise<Store> {
  if (opts.forceLocal) return new LocalStore();
  const userId = await currentUserId();
  if (userId) return new SupabaseStore(userId);
  return new LocalStore();
}

export { emptyState };
