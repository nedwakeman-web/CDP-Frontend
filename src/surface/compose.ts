/**
 * CDP Vessel, surface layer: the orchestration seam.
 *
 * The surface composes nothing itself. It speaks to an Orchestrator and never
 * to a concrete composer, the same discipline the data layer applies to the
 * Store. Two concrete composers live here. LocalOrchestrator is the browser
 * side placeholder: plain, grounded, honest, and offline. ApiOrchestrator is
 * the real composition over the Railway server, round tripping summoned depth
 * to /api/compose/depth, and it is the one used by default. Neither home.ts,
 * thread.ts, nor vessel.ts changes when the orchestrator is switched, because
 * none of them ever knew where the composing happened.
 *
 * This is the boundary that keeps the surface honest. The surface owns
 * presentation and interaction. Composition of touches, living summaries, and
 * summoned depth is orchestration, and it lives behind this one interface.
 *
 * The calm, immediate reads (meet, firstHold, park, respond, summary) are local
 * and synchronous on both composers, since they are the glance the surface
 * shows at once. Only summoned depth round trips, because depth is bottomless
 * and is composed on the server against the verified coordinates and the
 * person's continuity. When the endpoint is unreachable, the ApiOrchestrator
 * degrades to an honest held state rather than breaking.
 *
 * House style holds in this file: no em dashes, no en dashes, no exclamation
 * marks, in code and in comments alike.
 */

/* ---- types (staged, inline for now) ---------------------------------------- */

export type Lens = 'everyday' | 'science' | 'tradition';

export interface HeldIntention {
  text: string;
  kind: 'acute' | 'chronic' | 'developmental' | 'systemic';
  anchor: string | null;
}

export interface VesselState {
  intentions: HeldIntention[];
  rooms: Record<string, unknown>;
}

/** A composed vessel touch, optionally carrying a refreshed living read. */
export interface Composed {
  text: string;
  summary?: string;
}

/**
 * The composition contract. The surface calls these and renders the result.
 * meet and summary are synchronous reads used for the calm glance, while depth
 * is a Promise because summoned depth is bottomless and round trips to the
 * server.
 */
export interface Orchestrator {
  /** The quiet line the home shows: a plain reflection of what is held now. */
  meet(state: VesselState, brightest: HeldIntention | null, now?: number): string;
  /** The first vessel touch when a thread is held to dwell with. */
  firstHold(it: HeldIntention, lens: Lens, now?: number): Composed;
  /** The single sufficient hold that lets an intruding thread recede. */
  park(it: HeldIntention, lens: Lens): Composed;
  /** A light reflective continuation inside a thread. */
  respond(it: HeldIntention, personText: string, lens: Lens): Composed;
  /** A one-line living read of where the thread stands now. */
  summary(it: HeldIntention, lens: Lens, now?: number): string;
  /** Summoned depth, bottomless on demand. Async because the real one round-trips.
   * An optional context carries the thread so far, so a follow-up continues it. */
  depth(it: HeldIntention, lens: Lens, ctx?: DepthContext): Promise<Composed>;
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

/** Today as YYYY-MM-DD in UTC, the date discipline used everywhere else. */
function todayUTC(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

/* ---- the local placeholder composer ---------------------------------------- */

/**
 * Browser-side placeholder composer. Plain, grounded, lens-shaped, honest.
 *
 * The three lenses are shaped lightly here, by what each foregrounds, not by
 * faked depth. They become genuinely distinct, drawing on the computed
 * coordinates and the cited retrieval, on the server through the ApiOrchestrator.
 * In local mode the depth reflection says plainly that depth is composed on the
 * server, rather than pretending to be it.
 */
export class LocalOrchestrator implements Orchestrator {
  meet(state: VesselState, brightest: HeldIntention | null, now = Date.now()): string {
    if (!brightest) {
      const held = state.intentions.length;
      if (held === 0) return 'This is a place to hold what matters to you.';
      return 'Nothing is pressing right now. What is here is held and waiting when you want it.';
    }
    const clause_ = clause(brightest.text);
    const when = brightest.anchor ? whenPhrase(brightest.anchor, now) : null;
    if (when) return `You are holding: ${clause_} (${when}).`;
    return `You are holding: ${clause_}.`;
  }

  firstHold(it: HeldIntention, lens: Lens, now = Date.now()): Composed {
    const lensLabel = lens === 'everyday' ? 'everyday' : lens === 'science' ? 'neuroscience' : 'archetypal';
    return {
      text: `Holding "${it.text}" in the ${lensLabel} lens.`,
      summary: `Held: ${clause(it.text)}.`,
    };
  }

  park(it: HeldIntention, _lens: Lens): Composed {
    return {
      text: `"${it.text}" is parked and waiting. You can return to it whenever.`,
      summary: 'Parked.',
    };
  }

  respond(_it: HeldIntention, personText: string, _lens: Lens): Composed {
    return {
      text: `You offered: "${personText}". The thread continues.`,
      summary: 'Responded.',
    };
  }

  summary(it: HeldIntention, _lens: Lens, _now = Date.now()): string {
    const kind = it.kind === 'acute' ? 'pressing' : it.kind === 'chronic' ? 'ongoing' : 'unfolding';
    return `${kind}: ${clause(it.text)}`;
  }

  async depth(_it: HeldIntention, _lens: Lens, _ctx?: DepthContext): Promise<Composed> {
    return {
      text: [
        'The deeper reflection is composed on the server.',
        'This is local mode, so it is not reachable here.',
        'What you are holding is still held.',
      ].join('\n\n'),
      summary: 'Held. Depth is composed on the server.',
    };
  }
}

/* ---- the server-backed composer -------------------------------------------- */

/** Optional per-call context the server uses to ground the reflection. */
export interface DepthContext {
  dateStr?: string;
  continuity?: Array<{ label: string; summary: string }>;
  recentTouches?: Array<{ role: string; text: string }>;
}

export interface ApiOrchestratorOptions {
  /** Milliseconds before a depth request is aborted and the fallback is used. */
  timeoutMs?: number;
  /** Supplies date and continuity for a depth call. Defaults to today, no continuity. */
  contextProvider?: (it: HeldIntention, lens: Lens) => DepthContext;
  /** Injectable fetch, for testing. Defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  /** Injectable clock, for testing. Defaults to Date.now. */
  now?: () => number;
}

/**
 * The real composer. The calm reads delegate to a local instance, since they
 * are immediate and need no server. Summoned depth posts to /api/compose/depth
 * and renders the returned reflection. Any failure, a missing endpoint, an
 * upstream error, or a timeout, degrades to an honest held state, so a server
 * problem is degraded and never broken.
 */
export class ApiOrchestrator implements Orchestrator {
  private readonly base: string;
  private readonly local: Orchestrator;
  private readonly timeoutMs: number;
  private readonly contextProvider: (it: HeldIntention, lens: Lens) => DepthContext;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;

  constructor(base: string, local: Orchestrator, opts: ApiOrchestratorOptions = {}) {
    // Normalise the base so a trailing slash never doubles up against the path.
    this.base = (base || '').replace(/\/+$/, '');
    this.local = local;
    this.timeoutMs = opts.timeoutMs && opts.timeoutMs > 0 ? opts.timeoutMs : 30000;
    this.contextProvider = opts.contextProvider || (() => ({}));
    this.fetchImpl = opts.fetchImpl || ((...args: Parameters<typeof fetch>) => fetch(...args));
    this.now = opts.now || (() => Date.now());
  }

  // The calm glance is local on both composers.
  meet(state: VesselState, brightest: HeldIntention | null, now?: number): string {
    return this.local.meet(state, brightest, now);
  }
  firstHold(it: HeldIntention, lens: Lens, now?: number): Composed {
    return this.local.firstHold(it, lens, now);
  }
  park(it: HeldIntention, lens: Lens): Composed {
    return this.local.park(it, lens);
  }
  respond(it: HeldIntention, personText: string, lens: Lens): Composed {
    return this.local.respond(it, personText, lens);
  }
  summary(it: HeldIntention, lens: Lens, now?: number): string {
    return this.local.summary(it, lens, now);
  }

  /** The honest degraded reflection used when the server cannot be reached. */
  private fallback(): Composed {
    return {
      text: [
        'The deeper reflection could not be reached just now.',
        'What you are holding is still held, and nothing is lost.',
        'Try again in a moment.',
      ].join('\n\n'),
      summary: 'Held. Reach again in a moment.',
    };
  }

  async depth(it: HeldIntention, lens: Lens, ctx?: DepthContext): Promise<Composed> {
    const base = this.contextProvider(it, lens) || {};
    const merged: DepthContext = { ...base, ...(ctx || {}) };
    const dateStr = merged.dateStr || todayUTC(this.now());

    const intention: { text: string; anchor?: { label: string } } = { text: it.text };
    if (it.anchor) intention.anchor = { label: it.anchor };

    const body = {
      lens,
      intention,
      dateStr,
      continuity: Array.isArray(merged.continuity) ? merged.continuity : [],
      recentTouches: Array.isArray(merged.recentTouches) ? merged.recentTouches : [],
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await this.fetchImpl(this.base + '/api/compose/depth', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) return this.fallback();

      const data = (await res.json()) as { text?: unknown; summary?: unknown };
      if (data && typeof data.text === 'string' && data.text.trim().length > 0) {
        const composed: Composed = { text: data.text.trim() };
        if (typeof data.summary === 'string' && data.summary.trim().length > 0) {
          composed.summary = data.summary.trim();
        }
        return composed;
      }
      return this.fallback();
    } catch (_e) {
      // Network error or timeout abort. Degrade, do not break.
      return this.fallback();
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * A default local instance, for any caller that wants a composer without
 * choosing one. The boot path in main.ts constructs the ApiOrchestrator.
 */
export const orchestrator: Orchestrator = new LocalOrchestrator();
