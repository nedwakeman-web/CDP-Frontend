/**
 * CDP Vessel, surface layer: the orchestration seam.
 *
 * The surface composes nothing itself. It speaks to an Orchestrator and never
 * to a concrete composer, the same discipline the data layer applies to the
 * Store. Two concrete composers live here. LocalOrchestrator is the browser
 * side placeholder: plain, grounded, honest, and offline. ApiOrchestrator is
 * the real composition over the Railway server, round tripping the ask
 * to /api/compass/reply, and it is the one used by default. Neither the surface
 * controller nor any view changes when the orchestrator is switched, because
 * none of them ever knew where the composing happened.
 *
 * The domain types are imported from the data layer model, not redeclared here.
 * That single rule heals the type fork that opened when an earlier version of
 * this file declared its own HeldIntention inline with a different kind union.
 *
 * The calm, immediate reads (meet, firstHold, park, respond, summary) are local
 * and synchronous on both composers, since they are the glance the surface
 * shows at once. Only summoned depth round trips, because depth is bottomless
 * and is composed on the server against the verified coordinates and the
 * day. When the endpoint is unreachable, the ApiOrchestrator
 * degrades to an honest held state rather than breaking.
 *
 * House style holds in this file: no em dashes, no en dashes, no exclamation
 * marks, in code and in comments alike.
 */

import type { Lens, HeldIntention, VesselState, Anchor } from '../data/model';

export type { Lens, HeldIntention, VesselState, Anchor };

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
   *  An optional context carries the thread so far, so a follow-up continues it. */
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
function whenPhrase(anchor: Anchor, now: number): string {
  if (!anchor.date) return anchor.label;
  const target = new Date(anchor.date + 'T00:00:00Z').getTime();
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
    const c = clause(brightest.text);
    const when = brightest.anchor ? whenPhrase(brightest.anchor, now) : null;
    if (when) return 'You are holding: ' + c + ' (' + when + ').';
    return 'You are holding: ' + c + '.';
  }

  firstHold(it: HeldIntention, lens: Lens, _now = Date.now()): Composed {
    const lensLabel = lens === 'everyday' ? 'everyday' : lens === 'science' ? 'neuroscience' : 'archetypal';
    return {
      text: 'Holding ' + clause(it.text) + ' in the ' + lensLabel + ' lens.',
      summary: 'Held: ' + clause(it.text) + '.',
    };
  }

  park(it: HeldIntention, _lens: Lens): Composed {
    return {
      text: clause(it.text) + ' is parked and waiting. You can return to it whenever.',
      summary: 'Parked.',
    };
  }

  respond(_it: HeldIntention, personText: string, _lens: Lens): Composed {
    return {
      text: 'You offered: ' + clause(personText) + '. The thread continues.',
      summary: 'Responded.',
    };
  }

  summary(it: HeldIntention, _lens: Lens, _now = Date.now()): string {
    const kind = it.kind === 'acute' ? 'pressing' : it.kind === 'standing' ? 'ongoing' : 'enduring';
    return kind + ': ' + clause(it.text);
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

/**
 * One attachment carried with a depth call, in the wire shape the server reads.
 * Images and documents carry base64 data; text files carry their contents. The
 * server turns each into an image, document, or text content block for the
 * model. This mirrors CdpAttachmentWire in the attachments surface module; it is
 * restated here so the compose seam depends on no surface file.
 */
export interface AttachmentInput {
  kind: 'image' | 'document' | 'text';
  name: string;
  mediaType: string;
  data?: string;
  textContent?: string;
}

/** Optional per-call context the server uses to ground the reflection. */
export interface DepthContext {
  dateStr?: string;
  continuity?: Array<{ label: string; summary: string }>;
  recentTouches?: Array<{ role: string; text: string }>;
  /** Files the person brought into the compass for this reflection. */
  attachments?: AttachmentInput[];
  /** Light references to files brought in on earlier threads, names and recency
   *  only, so the reply can ask after them on return. Never the file itself. */
  broughtInHistory?: string[];
  /** Name and the day coordinates the reply uses as scaffold. */
  name?: string;
  kin?: string;
  moon?: string;
  personalDay?: number | string;
  personalYear?: number | string;
  universalYear?: number | string;
  isGAP?: boolean;
  isBlackMoon?: boolean;
  isShivaMoon?: boolean;
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
 * and renders the returned reply. Any failure, a missing endpoint, an
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
    this.base = (base || '').replace(/\/+$/, '');
    this.local = local;
    this.timeoutMs = opts.timeoutMs && opts.timeoutMs > 0 ? opts.timeoutMs : 30000;
    this.contextProvider = opts.contextProvider || (() => ({}));
    this.fetchImpl = opts.fetchImpl || ((...args: Parameters<typeof fetch>) => fetch(...args));
    this.now = opts.now || (() => Date.now());
  }

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

    const context: Record<string, unknown> = { date_str: dateStr };
    if (merged.kin) context.kin = merged.kin;
    if (merged.moon) context.moon = merged.moon;
    if (merged.personalDay != null) context.personal_day = merged.personalDay;
    if (merged.personalYear != null) context.personal_year = merged.personalYear;
    if (merged.universalYear != null) context.universal_year = merged.universalYear;
    if (merged.isGAP) context.is_gap = true;
    if (merged.isBlackMoon) context.is_black_moon = true;
    if (merged.isShivaMoon) context.is_shiva_moon = true;

    const body: Record<string, unknown> = {
      intention: it.text,
      voice: lens,
      name: merged.name || '',
      context,
    };
    if (merged.attachments && merged.attachments.length > 0) {
      body.attachments = merged.attachments;
    }
    if (merged.broughtInHistory && merged.broughtInHistory.length > 0) {
      body.brought_in_history = merged.broughtInHistory;
    }

    const controller = new AbortController();
    const hasFiles = !!(merged.attachments && merged.attachments.length > 0);
    const tmo = hasFiles ? Math.max(this.timeoutMs, 60000) : this.timeoutMs;
    const timer = setTimeout(() => controller.abort(), tmo);

    try {
      const res = await this.fetchImpl(this.base + '/api/compass/reply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) return this.fallback();

      const data = (await res.json()) as { ok?: boolean; reply?: unknown };
      if (data && data.ok && typeof data.reply === 'string' && data.reply.trim().length > 0) {
        return { text: data.reply.trim() };
      }
      return this.fallback();
    } catch (_e) {
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
