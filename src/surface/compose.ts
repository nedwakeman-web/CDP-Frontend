/**
 * CDP Vessel, surface layer: the orchestration seam.
 *
 * The surface composes nothing itself. It speaks to an Orchestrator and never
 * to a concrete composer, the same discipline the data layer applies to the
 * Store. Today the concrete composer is local and plain (LocalOrchestrator).
 * At step three of the Volume 16 sequence it becomes the real composition
 * engine over the Railway server and the resource layer (ApiOrchestrator),
 * and not one line of home.ts, thread.ts, or vessel.ts changes, because none
 * of them ever knew where the composing happened.
 *
 * This is the boundary that keeps the surface honest. The surface owns
 * presentation and interaction. Composition of touches, living summaries, and
 * summoned depth is orchestration, and it lives behind this one interface.
 *
 * The LocalOrchestrator is a dignified placeholder, not filler. It reflects
 * what a person is holding in plain, grounded language, and where it names a
 * mechanism it names a real one and labels it empirical, per the Charter. It
 * does not fabricate computed coordinates (the numerology, the Kin, the moon,
 * the transits) and it does not pretend to be the cited, lens-distinct depth.
 * Those arrive when the resource layer connects. Where the depth is not yet
 * built, the placeholder says so rather than faking it.
 */

import type { HeldIntention, VesselState, Lens } from '../data/model';

/** A composed vessel touch, optionally carrying a refreshed living read. */
export interface Composed {
  text: string;
  summary?: string;
}

/**
 * The composition contract. The surface calls these and renders the result.
 * Every method is shaped so the API-backed implementation can be asynchronous
 * and resource-drawing without the surface changing: meet and summary are
 * synchronous reads used for the calm glance, while depth is a Promise because
 * summoned depth is bottomless and will round-trip to the server.
 */
export interface Orchestrator {
  /** The quiet line the home shows: a plain reflection of what is held now. */
  meet(state: VesselState, brightest: HeldIntention | null, now?: number): string;
  /** The first vessel touch when a thread is held to dwell with. */
  firstHold(it: HeldIntention, lens: Lens, now?: number): Composed;
  /** The single sufficient hold that lets an intruding concern recede. */
  park(it: HeldIntention, lens: Lens): Composed;
  /** A light reflective continuation inside a thread. */
  respond(it: HeldIntention, personText: string, lens: Lens): Composed;
  /** A one-line living read of where the thread stands now. */
  summary(it: HeldIntention, lens: Lens, now?: number): string;
  /** Summoned depth, bottomless on demand. Async because the real one round-trips. */
  depth(it: HeldIntention, lens: Lens): Promise<Composed>;
}

/* ---- small grounded helpers ------------------------------------------------ */

const DAY_MS = 86400000;

/** Word small counts; numerals read as clutter in this calm register. */
function words(n: number): string {
  const w = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  return n >= 0 && n <= 10 ? w[n] : String(n);
}

/** A plain, non-promising description of when an anchored moment falls. */
function whenPhrase(dateStr: string, now: number): string {
  const target = new Date(dateStr + 'T00:00:00Z').getTime();
  const days = Math.round((target - now) / DAY_MS);
  if (days < 0) return 'a moment now past';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days <= 10) return words(days) + ' days away';
  if (days <= 14) return 'about two weeks away';
  return 'further out';
}

/** Trim a held line to a clause that can sit inside a sentence. */
function clause(text: string): string {
  const t = text.trim().replace(/\s+/g, ' ');
  const cut = t.length > 90 ? t.slice(0, 88).trim() : t;
  return cut.charAt(0).toLowerCase() + cut.slice(1);
}

/**
 * Browser-side placeholder composer. Plain, grounded, lens-shaped, honest.
 *
 * The three lenses are shaped lightly here, by what each foregrounds, not by
 * faked depth: Everyday foregrounds the plain next presence, Science names the
 * real cognitive mechanism and labels it empirical, Tradition speaks in the
 * register of holding and timing and is labelled symbolic. They become
 * genuinely distinct, drawing on the computed coordinates and the cited
 * retrieval, only when the resource layer connects at step four.
 */
export class LocalOrchestrator implements Orchestrator {
  meet(state: VesselState, brightest: HeldIntention | null, now = Date.now()): string {
    if (!brightest) {
      const held = state.intentions.length;
      if (held === 0) return 'This is a place to hold what matters to you.';
      return 'Nothing is pressing right now. What is here is held and waiting when you want it.';
    }
    const subject = clause(brightest.text);
    if (brightest.anchor?.date) {
      return 'You are holding ' + subject + '. It is ' + whenPhrase(brightest.anchor.date, now) + '.';
    }
    return 'You are holding ' + subject + '.';
  }

  firstHold(it: HeldIntention, lens: Lens, now = Date.now()): Composed {
    const moment = it.anchor?.date ? ' The moment it points at is ' + whenPhrase(it.anchor.date, now) + '.' : '';
    let body: string;
    if (lens === 'science') {
      body =
        'Held. Naming a concern and keeping it in view is what lets the mind work on it between now and then, '
        + 'an effect characterised by Zeigarnik in 1927 and sharpened by Gollwitzer on implementation intentions. '
        + 'That work is empirical, and it is yours to do; this is where the thread is kept warm.' + moment;
    } else if (lens === 'tradition') {
      body =
        'Held. What is named and kept in view begins to gather what it needs, in its own time. '
        + 'This reading is symbolic, offered as orientation rather than instruction.' + moment;
    } else {
      body = 'Held. You can come back to this whenever you want, and it will be here as you left it.' + moment;
    }
    return { text: body, summary: this.summary(it, lens, now) };
  }

  park(it: HeldIntention, lens: Lens): Composed {
    // Masicampo and Baumeister 2011: a sufficient, trusted hold releases the
    // grip of an unfulfilled goal without completing it. Empirical, labelled.
    let body: string;
    if (lens === 'science') {
      body =
        'Set down and kept. Forming a sufficient hold on an open loop releases its grip on attention without '
        + 'completing it, shown by Masicampo and Baumeister in 2011. You can return to it when there is room.';
    } else {
      body = 'Set down and kept. You can let this recede now; it is held, and you can pick it up when there is room.';
    }
    return { text: body, summary: this.summary(it, lens) };
  }

  respond(it: HeldIntention, personText: string, lens: Lens): Composed {
    const t = personText.trim();
    if (!t) return { text: 'Noted, and kept with the thread.' };
    // Light reflective continuation. The composed, resource-drawing response
    // arrives when orchestration connects; this keeps the thread tended now.
    const lead =
      lens === 'science'
        ? 'Noted. Each return strengthens what is consolidated around this concern.'
        : lens === 'tradition'
          ? 'Noted, and gathered with the thread.'
          : 'Noted, and kept with the thread.';
    return { text: lead, summary: this.summary(it, lens) };
  }

  summary(it: HeldIntention, _lens: Lens, now = Date.now()): string {
    const tended = Math.round((now - it.lastTendedAt) / DAY_MS);
    const recency = tended <= 0 ? 'just now' : tended === 1 ? 'a day ago' : words(tended) + ' days ago';
    if (it.anchor?.date) {
      return 'Pointing at a moment ' + whenPhrase(it.anchor.date, now) + '. Last tended ' + recency + '.';
    }
    if (it.kind === 'standing') return 'A standing thread, returned to on a rhythm. Last tended ' + recency + '.';
    if (it.kind === 'lifetime') return 'A lifetime thread, held as ground. Last tended ' + recency + '.';
    return 'An open thread. Last tended ' + recency + '.';
  }

  async depth(it: HeldIntention, lens: Lens): Promise<Composed> {
    // The genuinely composed, cited, lens-distinct depth is orchestration over
    // the resource layer, the next step of the Volume 16 sequence. Until that
    // connects, this is honest about what it is rather than faking substance.
    const plain =
      'Here is the plain reflection the vessel can offer now. The full composed depth, the cited research for '
      + 'the Science lens and the computed coordinates of the day for the Tradition lens, is composed by the '
      + 'orchestration and resource layers, which connect next. For the moment, hold this: '
      + clause(it.text) + ' is the open loop, and the work it asks of you happens in your own attention between '
      + 'returns here.';
    return { text: plain, summary: this.summary(it, lens) };
  }
}

/* ===========================================================================
 * ApiOrchestrator: real composition over the resource layer.
 *
 * Swapping LocalOrchestrator for ApiOrchestrator is the entire connection of
 * the surface to real composition, as far as every surface file is concerned.
 * Not one line of home.ts, thread.ts, vessel.ts, or context.ts changes. That
 * is the point of the boundary, and this implementation preserves it exactly.
 *
 * The interface signatures are the contract, and they govern the design. meet,
 * firstHold, park, respond, and summary are synchronous calm-glance reads; a
 * network round-trip on a held touch would break the calm and would force the
 * signatures, and therefore the controller, to change. So those five delegate
 * to an embedded LocalOrchestrator: instant, already validated, and the honest
 * offline behaviour the build brief keeps as the fallback. depth is the single
 * Promise in the interface, which is where the architecture puts substance:
 * summoned depth, bottomless on demand, round-tripping to cdp-server, composed
 * over Claude Sonnet 4.6 in the active lens, drawing on the resource layer
 * (the day coordinates for Tradition, marked symbolic or astronomical; the
 * salience-network framing and cited retrieval for Science) and on the v19
 * continuity of memory. This is Volume 17 step one: the surface does not
 * change; the substance does.
 *
 * Continuity of memory (v19) is gathered without touching the surface, because
 * meet already receives the whole VesselState on every home render. We cache
 * that state and, at depth time, assemble a short read of the other live
 * threads so the composition can open with what the person has been carrying.
 * The injection is capped client-side at about five hundred tokens of summary
 * per reading, per the v19 cost contingency.
 * =========================================================================== */

/** A short read of one other thread, sent so depth can open with continuity. */
export interface ContinuityItem {
  label: string;
  summary: string;
}

/** The request depth posts to cdp-server. Kept explicit so the server contract is legible. */
export interface DepthRequest {
  lens: Lens;
  dateStr: string;
  intention: { text: string; kind: HeldIntention['kind']; anchor: HeldIntention['anchor'] };
  recentTouches: { role: 'person' | 'vessel'; text: string }[];
  continuity: ContinuityItem[];
}

export interface ApiOrchestratorOptions {
  /** Base URL of cdp-server, with no trailing slash. */
  apiBase: string;
  /** Network timeout in milliseconds for the depth round-trip. */
  timeoutMs?: number;
  /** Offline fallback. Defaults to a fresh LocalOrchestrator. */
  fallback?: Orchestrator;
}

/** About five hundred tokens of summary, approximated conservatively in characters. */
const MAX_CONTINUITY_CHARS = 2000;
/** The most recent touches worth sending so the server has the live texture of the thread. */
const RECENT_TOUCH_COUNT = 6;
const DEFAULT_TIMEOUT_MS = 45000;

/** Today as an ISO date string, constructed in UTC to match all date discipline upstream. */
function todayUTC(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

export class ApiOrchestrator implements Orchestrator {
  private readonly apiBase: string;
  private readonly timeoutMs: number;
  private readonly local: Orchestrator;
  /** The last state meet was given, cached so depth can gather continuity without a surface change. */
  private lastState: VesselState | null = null;

  constructor(opts: ApiOrchestratorOptions) {
    this.apiBase = opts.apiBase.replace(/\/+$/, '');
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.local = opts.fallback ?? new LocalOrchestrator();
  }

  /* ---- calm-glance reads: instant, local, and the offline fallback -------- */

  meet(state: VesselState, brightest: HeldIntention | null, now = Date.now()): string {
    // Capture the state for v19 continuity. meet runs on every home render, so
    // this stays current without any view ever knowing the orchestrator did it.
    this.lastState = state;
    return this.local.meet(state, brightest, now);
  }

  firstHold(it: HeldIntention, lens: Lens, now = Date.now()): Composed {
    return this.local.firstHold(it, lens, now);
  }

  park(it: HeldIntention, lens: Lens): Composed {
    return this.local.park(it, lens);
  }

  respond(it: HeldIntention, personText: string, lens: Lens): Composed {
    return this.local.respond(it, personText, lens);
  }

  summary(it: HeldIntention, lens: Lens, now = Date.now()): string {
    return this.local.summary(it, lens, now);
  }

  /* ---- summoned depth: the real composition, with an honest fallback ------ */

  async depth(it: HeldIntention, lens: Lens): Promise<Composed> {
    const body: DepthRequest = {
      lens,
      dateStr: todayUTC(),
      intention: { text: it.text, kind: it.kind, anchor: it.anchor },
      recentTouches: it.touches
        .slice(-RECENT_TOUCH_COUNT)
        .map((t) => ({ role: t.role, text: t.text })),
      continuity: this.gatherContinuity(it.id),
    };

    try {
      const composed = await this.postDepth(body);
      if (composed && typeof composed.text === 'string' && composed.text.trim().length > 0) {
        return composed;
      }
      // A malformed or empty server reply is not depth. Fall back rather than show a blank.
      return this.local.depth(it, lens);
    } catch {
      // Offline, timed out, or the server errored. The local placeholder is the
      // honest thing to show: plain, grounded, and clear about what is not yet here.
      return this.local.depth(it, lens);
    }
  }

  /* ---- internals --------------------------------------------------------- */

  private async postDepth(body: DepthRequest): Promise<Composed | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(this.apiBase + '/api/compose/depth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data || typeof data.text !== 'string') return null;
      return { text: data.text, summary: typeof data.summary === 'string' ? data.summary : undefined };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Gather a short read of the other live threads, brightest first, capped at
   * about five hundred tokens. This is what makes themes compound across days:
   * the composition can open with what the person has been carrying, in their
   * own words, without re-presenting a transcript.
   */
  private gatherContinuity(currentId: string): ContinuityItem[] {
    const state = this.lastState;
    if (!state) return [];

    const roomLabel = new Map<string, string>();
    for (const room of state.rooms) roomLabel.set(room.id, room.label);

    const others = state.intentions
      .filter((i) => i.id !== currentId && i.status === 'live' && i.summary.trim().length > 0)
      .sort((a, b) => b.lastTendedAt - a.lastTendedAt);

    const items: ContinuityItem[] = [];
    let used = 0;
    for (const i of others) {
      const label = roomLabel.get(i.roomId) ?? 'What I am carrying';
      const cost = label.length + i.summary.length;
      if (used + cost > MAX_CONTINUITY_CHARS) break;
      items.push({ label, summary: i.summary });
      used += cost;
    }
    return items;
  }
}
