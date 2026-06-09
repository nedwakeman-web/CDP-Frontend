/*
 * Record analysis for the Emerging patterns rail.
 *
 * Pure functions over the person's own record: the located "landed" signals,
 * the outcome verdicts, and the live and resting intentions. Everything here is
 * read as honest observation of what has happened, never as a forecast, and
 * each view names its own null when the record is too thin to say anything.
 *
 * The patterns view is written as synthesis, not a tally. It weaves the way the
 * person actually sees (the lens that lands, the framework they return to) with
 * what they are holding now and what has gone quiet, names the cross telescope
 * moment as the one that matters, and closes with a probe to work with. House
 * style holds: no em dashes, no en dashes, no exclamations, no spaced hyphens.
 */
import type { VesselSignal, HeldIntention, Lens } from './model';

export interface PatternsView { hasData: boolean; lines: string[]; }
export interface SeasonsView { hasData: boolean; cells: Array<'g' | 'c' | 'n'>; note: string; }
export interface WorkingView { hasData: boolean; resolved: string[]; sitting: string[]; resolvedCount: number; sittingCount: number; note: string; }
export interface RecordAnalysis { patterns: PatternsView; seasons: SeasonsView; working: WorkingView; }

const FRAMEWORK_NAMES: Record<string, string> = {
  numerology: 'Numerology',
  dreamspell: 'the Dreamspell sign',
  mayan: 'the Dreamspell sign',
  astrology: 'Western astrology',
  western: 'Western astrology',
  lunar: 'the moon',
  moon: 'the moon',
};

/* What each framework tracks, so the line reads as meaning rather than a label. */
const FRAMEWORK_PULL: Record<string, string> = {
  numerology: 'the number of the day, its timing and its shape',
  dreamspell: 'the Dreamspell sign, the archetype you are moving as',
  mayan: 'the Dreamspell sign, the archetype you are moving as',
  astrology: 'the Western transit, the longer weather you are inside',
  western: 'the Western transit, the longer weather you are inside',
  lunar: 'the moon, the tidal and relational pull of the day',
  moon: 'the moon, the tidal and relational pull of the day',
};

/* What each voice is, characterised so the line observes how the person sees. */
const LENS_CHARACTER: Record<Lens, string> = {
  science: 'the Science telescope, the reading that names the mechanism rather than the symbol',
  tradition: 'the Tradition telescope, the older symbolic reading rather than the mechanism',
  everyday: 'the Everyday voice, the plain reading with the frameworks set aside',
};

function frameworkName(f: string): string {
  const k = f.toLowerCase();
  return FRAMEWORK_NAMES[k] || (f.charAt(0).toUpperCase() + f.slice(1));
}
function voiceName(v: Lens): string {
  if (v === 'science') return 'the Science telescope';
  if (v === 'tradition') return 'the Tradition telescope';
  return 'the Everyday voice';
}
function clip(s: string, n = 44): string {
  const t = (s || '').trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + '\u2026' : t;
}
function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
function topOf(counts: Record<string, number>): { key: string; n: number } | null {
  let key = ''; let n = 0;
  for (const k in counts) { const v = counts[k] || 0; if (v > n) { n = v; key = k; } }
  return n > 0 ? { key, n } : null;
}
function monthKey(y: number, m: number): string {
  return y + '-' + String(m + 1).padStart(2, '0');
}

const STALE = 14 * 24 * 60 * 60 * 1000;

/* The freshest live thread, the one most recently tended or created. */
function freshestLive(live: HeldIntention[], now: number): HeldIntention | null {
  let best: HeldIntention | null = null;
  let bestT = -1;
  for (const t of live) {
    const ts = t.lastTendedAt || t.createdAt || 0;
    if (ts > bestT) { bestT = ts; best = t; }
  }
  return best;
}

/* The live thread that has gone quiet, untended longest beyond the stale window. */
function stalestLive(live: HeldIntention[], now: number): HeldIntention | null {
  let best: HeldIntention | null = null;
  let bestAge = STALE;
  for (const t of live) {
    const age = now - (t.lastTendedAt || t.createdAt || now);
    if (age > bestAge) { bestAge = age; best = t; }
  }
  return best;
}

/*
 * The patterns synthesis. Reads the person back to themselves: how they tend to
 * see, what they keep returning to, the moment a foreign lens reached them, what
 * they are still carrying, and one question to take into the day. Observation
 * only, retrospective only, and it names its null honestly when the record is
 * too thin to say anything true.
 */
function analysePatterns(signals: VesselSignal[], live: HeldIntention[], resting: HeldIntention[], now: number): PatternsView {
  const landed = signals.filter((s) => s.kind === 'landed');
  const held = freshestLive(live, now);
  const stale = stalestLive(live, now);

  if (landed.length < 3) {
    if (held) {
      return {
        hasData: true,
        lines: [
          'You have not yet marked enough of what lands in a reading for a pattern to be honest, so this is not a claim about how you see, not yet.',
          'What is here is what you brought most recently, and it is the thing worth bringing to today. ' + cap(clip(held.text)) + '.',
          'As you mark what reaches you, reading by reading, this turns into a reading of you rather than a count.',
        ],
      };
    }
    return {
      hasData: false,
      lines: ['As you mark what lands in a reading, the way you actually see will surface here, as observation about you, never a forecast and never a tally.'],
    };
  }

  const byFramework: Record<string, number> = {};
  const byVoice: Record<string, number> = {};
  let bridges = 0;
  for (const s of landed) {
    if (s.framework) byFramework[s.framework] = (byFramework[s.framework] || 0) + 1;
    if (s.voice) byVoice[s.voice] = (byVoice[s.voice] || 0) + 1;
    if (s.bridge) bridges += 1;
  }

  const lines: string[] = [];
  const tv = topOf(byVoice);
  const tf = topOf(byFramework);

  if (tv) {
    const character = LENS_CHARACTER[tv.key as Lens] || voiceName(tv.key as Lens);
    lines.push('What lands for you tends to arrive through ' + character + '.');
  }
  if (tf) {
    const pull = FRAMEWORK_PULL[tf.key.toLowerCase()] || frameworkName(tf.key);
    lines.push('And it is ' + pull + ' that you return to most.');
  }
  if (bridges > 0) {
    lines.push('More than once the lens that reached you was not your usual one. Those crossings, where the unfamiliar telescope is the one that lands, are usually where the real movement sits, so they are worth slowing down for.');
  } else if (tv) {
    lines.push('So far you have stayed inside one way of seeing. The first time an unfamiliar lens is the one that lands is the day to slow down and look.');
  }

  if (held) {
    lines.push('Through all of this, the thread you brought most recently is this. ' + cap(clip(held.text)) + '.');
    if (stale) {
      lines.push('And one has gone quiet. ' + cap(clip(stale.text)) + ', untended for a while now.');
    }
  }

  if (held && tv) {
    const reach = tv.key === 'science' ? 'the mechanism' : tv.key === 'tradition' ? 'the symbol' : 'the plain reading';
    lines.push('Worth sitting with today. When you bring that thread to a reading, notice whether you reach for ' + reach + ', or for the telescope you trust less.');
  } else {
    lines.push('Worth watching. The next time a lens you do not usually trust is the one that lands, treat it as a signal rather than a stray.');
  }

  return { hasData: true, lines };
}

function analyseSeasons(signals: VesselSignal[], now: number): SeasonsView {
  const base = new Date(now);
  const months: string[] = [];
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - i, 1));
    months.push(monthKey(d.getUTCFullYear(), d.getUTCMonth()));
  }
  const well: Record<string, number> = {};
  const slow: Record<string, number> = {};
  let any = false;
  for (const s of signals) {
    if (s.kind !== 'outcome' || !s.moved || !s.date) continue;
    const mk = s.date.slice(0, 7);
    if (months.indexOf(mk) === -1) continue;
    any = true;
    if (s.moved === 'well') well[mk] = (well[mk] || 0) + 1;
    else slow[mk] = (slow[mk] || 0) + 1;
  }
  const cells = months.map((mk): 'g' | 'c' | 'n' => {
    const w = well[mk] || 0; const c = slow[mk] || 0;
    if (w === 0 && c === 0) return 'n';
    return w >= c ? 'g' : 'c';
  });
  let note = '';
  if (any) {
    const g = cells.filter((x) => x === 'g').length;
    const c = cells.filter((x) => x === 'c').length;
    note = g > c ? 'Your record has leaned toward growth lately.'
      : c > g ? 'Your record has leaned toward consolidation lately.'
      : 'Growth and consolidation have run about even.';
  }
  return { hasData: any, cells, note };
}

function analyseWorking(live: HeldIntention[], resting: HeldIntention[], now: number): WorkingView {
  const resolved = resting.map((t) => clip(t.text));
  const sittingThreads = live.filter((t) => (now - (t.lastTendedAt || t.createdAt || now)) > STALE);
  const sitting = sittingThreads.map((t) => clip(t.text));
  const hasData = (live.length + resting.length) > 0;
  let note = '';
  if (hasData) {
    const r = resting.length; const s = sittingThreads.length;
    const parts: string[] = [];
    if (r > 0) parts.push('you have set down ' + r);
    if (s > 0) parts.push(s + ' ' + (s === 1 ? 'is' : 'are') + ' still sitting, untended for a while');
    const joined = parts.join(', ');
    note = joined ? joined.charAt(0).toUpperCase() + joined.slice(1) + '.' : 'Everything you are holding is current.';
  }
  return { hasData, resolved: resolved.slice(0, 3), sitting: sitting.slice(0, 3), resolvedCount: resting.length, sittingCount: sittingThreads.length, note };
}

function isoMinus(date: string, n: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/*
 * The gentle streak: the days the person has shown up, and the most recent run
 * of consecutive days. Counted from the reading record, surfaced as quiet
 * acknowledgement, never as pressure.
 */
export function streakOf(dates: string[]): { days: number; run: number } {
  const set: Record<string, true> = {};
  for (const d of dates) { if (d) set[d] = true; }
  const uniq = Object.keys(set).sort();
  const days = uniq.length;
  if (days === 0) return { days: 0, run: 0 };
  const desc = uniq.slice().reverse();
  let run = 1;
  let cur = desc[0] as string;
  for (let i = 1; i < desc.length; i += 1) {
    const d = desc[i] as string;
    if (d === isoMinus(cur, 1)) { run += 1; cur = d; } else break;
  }
  return { days, run };
}

export function analyseRecord(signals: VesselSignal[], live: HeldIntention[], resting: HeldIntention[], now: number): RecordAnalysis {
  return {
    patterns: analysePatterns(signals || [], live || [], resting || [], now),
    seasons: analyseSeasons(signals || [], now),
    working: analyseWorking(live || [], resting || [], now),
  };
}
