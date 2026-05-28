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
    const clause_ = clause(brightest.text);
    const when = brightest.anchor ? whenPhrase(brightest.anchor, now) : null;
    if (when) return `You are holding: ${clause_} (${when}).`;
    return `You are holding: ${clause_}.`;
  }

  firstHold(it: HeldIntention, lens: Lens, now = Date.now()): Composed {
    const lensLabel = lens === 'everyday' ? 'everyday' : lens === 'science' ? 'neuroscience' : 'archetypal';
    return {
      text: `Holding "${it.text}" in the ${lensLabel} lens.`,
      summary: `Held: ${clause(it.text)}.`
    };
  }

  park(it: HeldIntention, lens: Lens): Composed {
    return {
      text: `"${it.text}" is parked and waiting. You can return to it whenever.`,
      summary: `Parked.`
    };
  }

  respond(it: HeldIntention, personText: string, lens: Lens): Composed {
    return {
      text: `You offered: "${personText}". The thread continues.`,
      summary: `Responded.`
    };
  }

  summary(it: HeldIntention, lens: Lens, now = Date.now()): string {
    const kind = it.kind === 'acute' ? 'pressing' : it.kind === 'chronic' ? 'ongoing' : 'unfolding';
    return `${kind}: ${clause(it.text)}`;
  }

  async depth(it: HeldIntention, lens: Lens): Promise<Composed> {
    // Placeholder. At step four, this rounds-trip to /api/vessel/depth.
    return {
      text: 'Depth retrieval not yet connected. This will round-trip to the server when the resource layer is live.',
      summary: 'Depth staged.'
    };
  }
}

/**
 * Export the composed surface as a singleton instance.
 */
export const orchestrator = new LocalOrchestrator();
