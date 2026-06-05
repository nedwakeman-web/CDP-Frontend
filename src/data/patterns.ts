/*
 * Record analysis for the Emerging patterns rail.
 *
 * Pure functions over the person's own record: the located "landed" signals,
 * the outcome verdicts, and the live and resting intentions. Everything here is
 * read as honest observation of what has happened, never as a forecast, and
 * each view names its own null when the record is too thin to say anything.
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
function topOf(counts: Record<string, number>): { key: string; n: number } | null {
  let key = ''; let n = 0;
  for (const k in counts) { if (counts[k] > n) { n = counts[k]; key = k; } }
  return n > 0 ? { key, n } : null;
}
function monthKey(y: number, m: number): string {
  return y + '-' + String(m + 1).padStart(2, '0');
}

function analysePatterns(signals: VesselSignal[]): PatternsView {
  const landed = signals.filter((s) => s.kind === 'landed');
  if (landed.length < 3) {
    return { hasData: false, lines: ['As you mark what lands in a reading, the patterns you actually live will surface here, as observation, never a forecast.'] };
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
  const tf = topOf(byFramework);
  if (tf) lines.push(frameworkName(tf.key) + ' has landed for you ' + tf.n + (tf.n === 1 ? ' time' : ' times') + ' so far.');
  const tv = topOf(byVoice);
  if (tv) lines.push('Of the voices, ' + voiceName(tv.key as Lens) + ' has reached you most.');
  if (bridges > 0) lines.push('You have crossed telescopes ' + bridges + (bridges === 1 ? ' time' : ' times') + ', where a lens that is not your usual one is the one that landed.');
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
  const STALE = 14 * 24 * 60 * 60 * 1000;
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
  let cur = desc[0];
  for (let i = 1; i < desc.length; i += 1) {
    if (desc[i] === isoMinus(cur, 1)) { run += 1; cur = desc[i]; } else break;
  }
  return { days, run };
}

export function analyseRecord(signals: VesselSignal[], live: HeldIntention[], resting: HeldIntention[], now: number): RecordAnalysis {
  return {
    patterns: analysePatterns(signals || []),
    seasons: analyseSeasons(signals || [], now),
    working: analyseWorking(live || [], resting || [], now),
  };
}
