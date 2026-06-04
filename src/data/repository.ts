/**
 * CDP Vessel, data layer: the repository.
 *
 * The only place that mutates vessel state. Every operation is a pure
 * transition from one VesselState to the next, then persisted through the
 * Store. Keeping mutation in one place is what lets the doctrine be enforced
 * rather than hoped for:
 *   - Nothing is ever destroyed. resting is the furthest a thread goes.
 *   - Rooms are capped and never configured; they emerge here.
 *   - Gravity is computed here, so the surface never invents its own.
 *   - Themes emerge here, fractally, from related threads.
 *
 * The repository holds the state in memory and writes through on every change.
 * It is storage-agnostic: it is handed a Store and never knows what is behind it.
 *
 * House style holds in this file: no em dashes, no en dashes, no exclamation
 * marks, in code and in comments alike.
 */

import type { VesselState, Room, Theme, HeldIntention, Touch, Anchor, ThreadKind, ThreadStatus, Lens, VesselSignal } from './model';
import { emptyState, LIMITS, SCHEMA_VERSION } from './model';
import type { Store } from './store';
import type { VesselProfile, StoredProfile } from './model';

function id(prefix: string): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
function clone<T>(v: T): T { return JSON.parse(JSON.stringify(v)) as T; }

const DAY_MS = 86400000;

export class VesselRepository {
  private state: VesselState;
  private store: Store;
  private loaded = false;

  constructor(store: Store) { this.store = store; this.state = emptyState(); }

  async init(): Promise<void> {
    const loaded = await this.store.load();
    this.state = loaded || emptyState();
    this.loaded = true;
  }

  get isLoaded(): boolean { return this.loaded; }

  private async commit(): Promise<void> {
    this.state.version = SCHEMA_VERSION;
    await this.store.save(this.state);
  }

  /** A read-only snapshot. Callers never mutate state directly. */
  snapshot(): VesselState { return clone(this.state); }

  getLens(): Lens { return this.state.lens; }
  async setLens(lens: Lens): Promise<void> { this.state.lens = lens; await this.commit(); }

  getProfile(): VesselProfile | undefined { return this.state.profile; }
  async setProfile(p: VesselProfile): Promise<void> {
    this.state.profile = { ...this.state.profile, ...p };
    await this.commit();
  }

  // ---- outcome signals, the person's own located taps and verdicts ----------
  listSignals(): VesselSignal[] { return (this.state.signals || []).map((x) => ({ ...x })); }
  async recordSignal(s: VesselSignal): Promise<void> {
    if (!this.state.signals) this.state.signals = [];
    this.state.signals.push({ ...s });
    await this.commit();
  }
  async recordOutcome(intentionId: string, moved: 'well' | 'waiting' | 'mixed'): Promise<void> {
    if (!this.state.signals) this.state.signals = [];
    const now = new Date();
    this.state.signals.push({ at: now.getTime(), date: now.toISOString().slice(0, 10), kind: 'outcome', intentionId, moved });
    await this.commit();
  }

  // ---- saved profiles (the self plus other people) --------------------------
  listSavedProfiles(): StoredProfile[] { return (this.state.savedProfiles || []).map((p) => ({ ...p })); }
  async addSavedProfile(p: VesselProfile): Promise<StoredProfile> {
    const id = 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const entry: StoredProfile = { ...p, id };
    if (!this.state.savedProfiles) this.state.savedProfiles = [];
    this.state.savedProfiles.push(entry);
    await this.commit();
    return { ...entry };
  }
  async removeSavedProfile(id: string): Promise<void> {
    if (!this.state.savedProfiles) return;
    this.state.savedProfiles = this.state.savedProfiles.filter((p) => p.id !== id);
    await this.commit();
  }

  // ---- rooms ----------------------------------------------------------------

  /**
   * Resolve a room by label, creating it only if under the cap. Rooms emerge
   * from use; they are never configured. When at the cap, the nearest existing
   * room is returned rather than spawning a new one, which is the discipline
   * that keeps the home a glance rather than a list.
   */
  async ensureRoom(label: string): Promise<Room> {
    const existing = this.state.rooms.find(r => r.label.toLowerCase() === label.toLowerCase());
    if (existing) return clone(existing);
    if (this.state.rooms.length >= LIMITS.maxRooms) {
      const fallback = this.mostPopulatedRoom() || this.state.rooms[0];
      return clone(fallback);
    }
    const room: Room = { id: id('r'), label: label.trim().slice(0, 40), createdAt: Date.now() };
    this.state.rooms.push(room);
    await this.commit();
    return clone(room);
  }

  private mostPopulatedRoom(): Room | null {
    if (this.state.rooms.length === 0) return null;
    const counts: Record<string, number> = {};
    for (const it of this.state.intentions) counts[it.roomId] = (counts[it.roomId] || 0) + 1;
    return [...this.state.rooms].sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0))[0];
  }

  rooms(): Room[] { return clone(this.state.rooms); }

  // ---- held intentions ------------------------------------------------------

  async hold(opts: { text: string; roomId: string; kind?: ThreadKind; anchor?: Anchor | null; firstTouch?: { text: string; lens: Lens } }): Promise<HeldIntention> {
    const now = Date.now();
    const touches: Touch[] = [{ id: id('t'), role: 'person', text: opts.text, createdAt: now }];
    if (opts.firstTouch) touches.push({ id: id('t'), role: 'vessel', text: opts.firstTouch.text, lens: opts.firstTouch.lens, createdAt: now + 1 });
    const it: HeldIntention = {
      id: id('i'), text: opts.text, roomId: opts.roomId, themeId: null,
      kind: opts.kind || 'acute', status: 'live', anchor: opts.anchor || null,
      touches, summary: opts.firstTouch ? opts.firstTouch.text : '', summaryAt: opts.firstTouch ? now : 0,
      createdAt: now, lastTendedAt: now, statusChangedAt: now,
    };
    this.state.intentions.unshift(it);
    await this.commit();
    return clone(it);
  }

  async addTouch(intentionId: string, touch: Omit<Touch, 'id' | 'createdAt'>): Promise<void> {
    const it = this.state.intentions.find(i => i.id === intentionId);
    if (!it) return;
    it.touches.push({ id: id('t'), createdAt: Date.now(), ...touch });
    it.lastTendedAt = Date.now();
    await this.commit();
  }

  async setSummary(intentionId: string, summary: string): Promise<void> {
    const it = this.state.intentions.find(i => i.id === intentionId);
    if (!it) return;
    it.summary = summary; it.summaryAt = Date.now();
    await this.commit();
  }

  /** Let a thread rest. Fully recoverable. This is the furthest a thread ever goes. */
  async rest(intentionId: string): Promise<void> { await this.setStatus(intentionId, 'resting'); }
  /** Bring a resting thread back to live. */
  async pickBackUp(intentionId: string): Promise<void> { await this.setStatus(intentionId, 'live'); }

  private async setStatus(intentionId: string, status: ThreadStatus): Promise<void> {
    const it = this.state.intentions.find(i => i.id === intentionId);
    if (!it) return;
    it.status = status; it.statusChangedAt = Date.now();
    if (status === 'live') it.lastTendedAt = Date.now();
    await this.commit();
  }

  /**
   * There is intentionally no delete method. The model has no destructive
   * state. The furthest a thread goes is resting, and resting is recoverable.
   * This is enforced by absence, which is the strongest enforcement there is.
   */

  // ---- gravity --------------------------------------------------------------

  /**
   * Gravity orders a room: live and recently tended rises, resting sinks, and
   * deep rest settles into near-silent sediment. Standing and lifetime threads
   * resist sinking, because they are not meant to resolve and recede. An
   * approaching anchor lifts. The surface reads gravity; it never computes its own.
   */
  gravity(it: HeldIntention, now = Date.now()): number {
    let g = 0;
    g += it.status === 'live' ? 100 : 0;

    const daysSinceTended = (now - it.lastTendedAt) / DAY_MS;
    g += Math.max(0, 40 - daysSinceTended);

    if (it.status === 'resting') {
      const daysResting = (now - it.statusChangedAt) / DAY_MS;
      g -= Math.min(60, daysResting);
      if (daysResting >= LIMITS.deepRestDays) g -= 40; // sediment
    }

    if (it.kind === 'standing') g += 25;
    if (it.kind === 'lifetime') g += 35;

    if (it.anchor && it.anchor.date) {
      const target = new Date(it.anchor.date + 'T00:00:00Z').getTime();
      const daysAway = (target - now) / DAY_MS;
      if (daysAway >= 0 && daysAway <= 14) g += (15 - daysAway) * 4; // the nearer, the higher
    }

    return g;
  }

  private byGravity = (now: number) => (a: HeldIntention, b: HeldIntention): number => this.gravity(b, now) - this.gravity(a, now);

  /** All live threads, ordered by gravity. */
  live(now = Date.now()): HeldIntention[] {
    return this.state.intentions.filter(i => i.status === 'live').sort(this.byGravity(now)).map(clone);
  }

  /** All resting threads, ordered by gravity (least sunk first). */
  resting(now = Date.now()): HeldIntention[] {
    return this.state.intentions.filter(i => i.status === 'resting').sort(this.byGravity(now)).map(clone);
  }

  /** Live threads in one room, ordered by gravity. */
  liveInRoom(roomId: string, now = Date.now()): HeldIntention[] {
    return this.state.intentions.filter(i => i.status === 'live' && i.roomId === roomId).sort(this.byGravity(now)).map(clone);
  }

  /** The single brightest live thread, the figure the home meets the person with. */
  brightest(now = Date.now()): HeldIntention | null {
    const live = this.live(now);
    return live.length > 0 ? live[0] : null;
  }

  byId(intentionId: string): HeldIntention | null {
    const it = this.state.intentions.find(i => i.id === intentionId);
    return it ? clone(it) : null;
  }

  // ---- themes (fractal emergence) -------------------------------------------

  themes(): Theme[] { return clone(this.state.themes); }

  /**
   * Gather threads into a theme. The data layer records the gathering; it does
   * not decide it. The decision is orchestration's, which keeps the emergence
   * in one place and reversible.
   */
  async gatherTheme(roomId: string, label: string, threadIds: string[]): Promise<Theme> {
    const now = Date.now();
    const theme: Theme = { id: id('h'), roomId, label: label.trim().slice(0, 60), threadIds: [...threadIds], createdAt: now, lastActiveAt: now };
    this.state.themes.push(theme);
    for (const tid of threadIds) {
      const it = this.state.intentions.find(i => i.id === tid);
      if (it) it.themeId = theme.id;
    }
    await this.commit();
    return clone(theme);
  }

  /**
   * Threads resting longer than the deep-rest horizon. These, and only these,
   * the vessel may gently offer back with a single honest question, so the pile
   * turns over without anything being deleted behind the person's back.
   */
  deepRest(now = Date.now()): HeldIntention[] {
    const cutoff = now - LIMITS.deepRestDays * DAY_MS;
    return this.state.intentions
      .filter(i => i.status === 'resting' && i.statusChangedAt < cutoff)
      .map(clone);
  }
}
