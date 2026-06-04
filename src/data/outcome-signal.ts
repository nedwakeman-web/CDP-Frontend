/**
 * CDP Vessel, data layer: the outcome signal and its emergent detectors.
 *
 * This is the shared engine of the measurable impact model. It is pure, with
 * no DOM dependency, so every reading-class surface imports the same logic:
 * the year, the card, the reading, the compatibility surface. The detectors
 * read the person's own located taps and their own verdicts on held
 * intentions, and they return a pattern only when the signal is thick enough
 * to be honest. Below the thresholds they return null, and the surface says
 * so plainly rather than inventing a pattern. Nothing here forecasts; it
 * observes, as correlation drawn from the person's own life.
 *
 * House style holds: no em dashes, no en dashes, no exclamation marks, and no
 * spaced hyphen patterns.
 */

import type { HeldIntention, VesselSignal } from './model';

/** Below these counts the detectors stay silent. Honesty before eagerness. */
export const MIN_TAPS = 6;
export const MIN_OUTCOMES = 3;
export const MIN_MULTI_DAYS = 3;

/** The reader-facing name for each framework, used when a pattern is named. */
export const FRAMEWORK_LABEL: Record<string, string> = {
  dreamspell: 'the Dreamspell',
  numerology: 'the Numerology',
  lunar: 'the Moon',
  astrology: 'the Astrology',
  science: 'the Science telescope',
  everyday: 'the Everyday voice',
};

export function landedOnly(sigs: VesselSignal[]): VesselSignal[] {
  return sigs.filter((s) => s.kind === 'landed');
}

export function median(xs: number[]): number {
  const a = xs.slice().sort((p, q) => p - q);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

/** The lens that most often lands. The home telescope, the on-ramp, not the goal. */
export function homeTelescope(sigs: VesselSignal[]): { framework: string; label: string; count: number; share: number } | null {
  const landed = landedOnly(sigs).filter((s) => s.framework);
  if (landed.length < MIN_TAPS) return null;
  const tally: Record<string, number> = {};
  for (const s of landed) { const f = s.framework as string; tally[f] = (tally[f] || 0) + 1; }
  let best = ''; let bestN = 0;
  for (const f in tally) { if (tally[f] > bestN) { best = f; bestN = tally[f]; } }
  return { framework: best, label: FRAMEWORK_LABEL[best] || best, count: bestN, share: bestN / landed.length };
}

/** How often a lens that is not the home telescope lands. The bridge, the breakthrough, the higher value signal. */
export function crossTelescopeRate(sigs: VesselSignal[]): { count: number; total: number } | null {
  const landed = landedOnly(sigs);
  if (landed.length < MIN_TAPS) return null;
  const bridges = landed.filter((s) => s.bridge === true).length;
  return { count: bridges, total: landed.length };
}

/** The person's own rhythm: do intentions move when tended close, and wait when left long. */
export function intentionRhythm(intentions: HeldIntention[], sigs: VesselSignal[]): { days: number } | null {
  const outcomes = sigs.filter((s) => s.kind === 'outcome' && s.intentionId && s.moved);
  if (outcomes.length < MIN_OUTCOMES) return null;
  const verdict: Record<string, 'well' | 'waiting' | 'mixed'> = {};
  for (const o of outcomes) { verdict[o.intentionId as string] = o.moved as 'well' | 'waiting' | 'mixed'; }
  const wellGaps: number[] = [];
  const waitGaps: number[] = [];
  for (const it of intentions) {
    const v = verdict[it.id];
    if (!v) continue;
    const times = (it.touches || []).map((t) => t.createdAt).filter((n) => typeof n === 'number').sort((a, b) => a - b);
    if (times.length < 1) continue;
    let maxGap = 0;
    for (let i = 1; i < times.length; i++) { maxGap = Math.max(maxGap, (times[i] - times[i - 1]) / 86400000); }
    if (times.length === 1) maxGap = (Date.now() - times[0]) / 86400000;
    if (v === 'well') wellGaps.push(maxGap); else if (v === 'waiting') waitGaps.push(maxGap);
  }
  if (wellGaps.length < 2 || waitGaps.length < 1) return null;
  const w = median(wellGaps); const x = median(waitGaps);
  if (x <= w * 1.8) return null; // no clear separation, no honest claim
  return { days: Math.max(1, Math.round(w)) };
}

/** The thesis, proven from the person's own life: do the days both telescopes speak run better. */
export function bothTelescopesProven(sigs: VesselSignal[]): boolean | null {
  const landed = landedOnly(sigs);
  if (landed.length < MIN_TAPS) return null;
  const byDate: Record<string, Set<string>> = {};
  for (const s of landed) { if (!s.date || !s.framework) continue; (byDate[s.date] = byDate[s.date] || new Set()).add(s.framework); }
  const multiDays = Object.keys(byDate).filter((d) => byDate[d].size >= 2);
  if (multiDays.length < MIN_MULTI_DAYS) return null;
  const wellDates = sigs.filter((s) => s.kind === 'outcome' && s.moved === 'well' && s.date).map((s) => s.date as string);
  if (wellDates.length < MIN_OUTCOMES) return null;
  const onMulti = wellDates.filter((d) => multiDays.indexOf(d) >= 0).length;
  return onMulti / wellDates.length > 0.5;
}
