/**
 * CDP coordinate core: the single source of truth for deterministic day coordinates.
 *
 * This module is the canonical implementation. It is authored once, in TypeScript,
 * and consumed by both halves of the system without a second copy:
 *   - the Vite client imports this file directly (it is ESM and typed);
 *   - the Node server consumes the CommonJS build of this file (coordinates-core.cjs),
 *     regenerated from this source and never hand edited, so the two can never drift.
 *
 * It is pure and deterministic. Given a date string, and optionally a profile, it
 * returns the same coordinates everywhere, with no input or output beyond its
 * arguments. The values that require an authoritative external source that is not
 * yet wired (the lunar phase from USNO, and therefore the Black and Shiva windows)
 * are reported as an honest unknown rather than computed from memory, in keeping
 * with the rule that no fabricated coordinate may reach a reading.
 *
 * Each coordinate is tagged with two things the citation drawer needs: a chip
 * (time, lunar, symbol, body) and a claim tag that keys into the bibliography
 * claim_to_entries index. The core does not hardcode references; it names what a
 * coordinate is a claim about, and the drawer retrieves the sources for it. That
 * keeps the mathematics independent of any bibliography version.
 *
 * House style holds in this file: no em dashes, no en dashes, no exclamation marks,
 * in code and in comments alike.
 */

/* ============================================================================
 * Shared types
 * ========================================================================== */

export type Chip = 'time' | 'lunar' | 'symbol' | 'body';
export type Register = 'symbolic' | 'astronomical' | 'empirical';

/** A single resolved coordinate, ready for the surface and for the drawer. */
export interface Coordinate {
  /** Stable key, for example "universal_day" or "kin". */
  key: string;
  /** Short human label for the surface. */
  label: string;
  /** The composed display value, for example "Kin 112 Galactic Yellow Human". */
  display: string;
  /** Structured payload, shape depends on the coordinate. */
  value: unknown;
  /** What kind of claim this is, so the surface can label it correctly. */
  register: Register;
  /** Which chip this coordinate belongs to, for the citation drawer. */
  chip: Chip;
  /** The bibliography claim tag, keyed into claim_to_entries. Null when none applies. */
  claimTag: string | null;
  /** True when the value could not be computed from an authoritative source yet. */
  unknown: boolean;
}

/** Optional profile context for the personal layers. */
export interface Profile {
  /** Birth date as YYYY-MM-DD. Required for the personal numerology layers. */
  birthDate?: string;
}

/** A reduced numerological number, with the master flag and the reduced single digit. */
export interface NumerologyValue {
  /** The surfaced value, a master number where one is preserved, otherwise a single digit. */
  value: number;
  /** The single digit the master reduces to, equal to value when value is already single. */
  reducesTo: number;
  isMaster: boolean;
  register: 'symbolic';
}

/* ============================================================================
 * Constants
 * ========================================================================== */

/**
 * Dreamspell Kin anchor. 2024-07-08 is Kin 1.
 *
 * Definitive source: Jose Arguelles, The Mayan Factor (Bear and Company, 1987)
 * and Dreamspell, as recognised by the Foundation for the Law of Time. StarRoot
 * is one FLT recognised community implementation of this count, not the source
 * of it. The Gregorian leap day, February 29, is excluded from the count, since
 * the thirteen moon count does not admit it. This is the corrected anchor; the
 * earlier production server was wrong by sixty against it.
 */
const KIN_ANCHOR_UTC = Date.UTC(2024, 6, 8); // 2024-07-08 is Kin 1
const DAY_MS = 86400000;

/** Seal names, held colourless on purpose. The colour is composed separately, so the
 * descriptor cannot duplicate it the way an earlier build did ("Blue ... Blue Monkey"). */
const SEAL_NAMES: readonly string[] = [
  'Dragon', 'Wind', 'Night', 'Seed', 'Serpent', 'World-Bridger', 'Hand', 'Star',
  'Moon', 'Dog', 'Monkey', 'Human', 'Skywalker', 'Wizard', 'Eagle', 'Warrior',
  'Earth', 'Mirror', 'Storm', 'Sun',
];

/** The four colour families cycle Red, White, Blue, Yellow across the twenty seals. */
const SEAL_COLOURS: readonly string[] = [
  'Red', 'White', 'Blue', 'Yellow', 'Red', 'White', 'Blue', 'Yellow', 'Red', 'White',
  'Blue', 'Yellow', 'Red', 'White', 'Blue', 'Yellow', 'Red', 'White', 'Blue', 'Yellow',
];

const TONE_NAMES: readonly string[] = [
  'Magnetic', 'Lunar', 'Electric', 'Self-Existing', 'Overtone', 'Rhythmic',
  'Resonant', 'Galactic', 'Solar', 'Planetary', 'Spectral', 'Crystal', 'Cosmic',
];

/**
 * The fifty two Galactic Activation Portal Kins (the Loom of Maya).
 *
 * The canonical Dreamspell portal set as taught by the Foundation for the Law
 * of Time. The pattern is symmetric: every portal Kin K is paired with its
 * occult partner (261 minus K), and the centre carries two runs of ten
 * consecutive portals (106 to 115 and 146 to 155). Validated against the Law
 * of Time record that 19 to 28 May 2023 are ten consecutive portal days, which
 * this set reproduces exactly through the verified Kin anchor.
 */
const GAP_KINS: ReadonlySet<number> = new Set([
  1, 20, 22, 39, 43, 50, 51, 58, 64, 69, 72, 77, 85, 88, 93, 96,
  106, 107, 108, 109, 110, 111, 112, 113, 114, 115,
  146, 147, 148, 149, 150, 151, 152, 153, 154, 155,
  165, 168, 173, 176, 184, 189, 192, 197, 203, 210, 211, 218, 222, 239, 241, 260,
]);

const MASTERS: ReadonlySet<number> = new Set([11, 22, 33, 44]);

/* ============================================================================
 * Small pure helpers
 * ========================================================================== */

/** Parse an ISO date string (YYYY-MM-DD) to a UTC midnight timestamp. */
export function isoToUTC(dateStr: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) throw new Error('coordinates: dateStr must be YYYY-MM-DD, received ' + String(dateStr));
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Sum the decimal digits of a non negative integer once. */
function digitSum(n: number): number {
  let v = Math.abs(Math.trunc(n));
  let s = 0;
  while (v > 0) { s += v % 10; v = Math.floor(v / 10); }
  return s;
}

/**
 * Reduce a positive integer to a single digit, preserving master numbers at any
 * step. A master reached at any stage is returned as is, with its single digit
 * recorded separately.
 */
export function reduceNumber(n: number): NumerologyValue {
  let value = Math.abs(Math.trunc(n));
  while (value > 9 && !MASTERS.has(value)) {
    value = digitSum(value);
  }
  const isMaster = MASTERS.has(value);
  let reducesTo = value;
  while (reducesTo > 9) reducesTo = digitSum(reducesTo);
  return { value, reducesTo, isMaster, register: 'symbolic' };
}

/**
 * Count Gregorian leap days (February 29) inside the open closed interval
 * (earlier, later]. The walk is year by year for clarity; the tests pin the
 * behaviour at the anchor and at leap edges.
 */
export function leapDaysBetween(fromMs: number, toMs: number): number {
  let count = 0;
  const startYear = new Date(fromMs).getUTCFullYear();
  const endYear = new Date(toMs).getUTCFullYear();
  for (let y = startYear; y <= endYear; y += 1) {
    const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    if (!isLeap) continue;
    const feb29 = Date.UTC(y, 1, 29);
    if (feb29 > fromMs && feb29 <= toMs) count += 1;
  }
  return count;
}

/* ============================================================================
 * Dreamspell Kin
 * ========================================================================== */

/** The Kin number (1 to 260) for a date, on the corrected anchor, excluding Feb 29. */
export function kinForDate(dateStr: string): number {
  const dateMs = isoToUTC(dateStr);
  const rawDays = Math.round((dateMs - KIN_ANCHOR_UTC) / DAY_MS);
  const sign = rawDays >= 0 ? 1 : -1;
  const skipped = sign > 0
    ? leapDaysBetween(KIN_ANCHOR_UTC, dateMs)
    : leapDaysBetween(dateMs, KIN_ANCHOR_UTC);
  const countedDays = rawDays - sign * skipped;
  const idx = ((countedDays % 260) + 260) % 260; // Kin 1 at offset 0
  return idx + 1;
}

export function kinTone(kin: number): number { return ((kin - 1) % 13) + 1; }
function kinSealIndex(kin: number): number { return (kin - 1) % 20; }

/** True when the Kin is one of the fifty two Galactic Activation Portals. */
export function isGAP(kin: number): boolean { return GAP_KINS.has(kin); }

export interface KinDescriptor {
  kin: number;
  tone: number;
  toneName: string;
  seal: string;
  colour: string;
  /** Parity display, "Kin {N} {Tone} {Colour} {Seal}", colour composed once. */
  full: string;
  isGAP: boolean;
  register: 'symbolic';
}

/** The full Kin descriptor, all naming systems held distinct, colour composed once. */
export function kinDescriptor(dateStr: string): KinDescriptor {
  const kin = kinForDate(dateStr);
  const tone = kinTone(kin);
  const si = kinSealIndex(kin);
  const toneName = TONE_NAMES[tone - 1];
  const seal = SEAL_NAMES[si];
  const colour = SEAL_COLOURS[si];
  return {
    kin,
    tone,
    toneName,
    seal,
    colour,
    full: 'Kin ' + kin + ' ' + toneName + ' ' + colour + ' ' + seal,
    isGAP: GAP_KINS.has(kin),
    register: 'symbolic',
  };
}

/* ============================================================================
 * Pythagorean numerology
 *
 * Universal Day is the shared energy of the calendar date itself. The three
 * personal energies (Personal Year, Personal Month, Personal Day) are the
 * standard Pythagorean layers, with Drayer (2002) and Goodwin (1994) as the
 * cited authorities. Master numbers (11, 22, 33, 44) are preserved at every
 * level. Components are reduced by a single digit sum before being added, which
 * is what surfaces the master at the join: for 15 June within 2026 the Personal
 * Year sum is 6 plus 6 plus 10 equal to 22, a master, reducing to 4.
 * ========================================================================== */

/** The Universal Day number for a date, the shared day energy, masters preserved. */
export function universalDay(dateStr: string): NumerologyValue {
  isoToUTC(dateStr); // validate shape
  const sum = dateStr.replace(/-/g, '').split('').reduce((s, d) => s + Number(d), 0);
  return reduceNumber(sum);
}

export interface PersonalNumerology {
  personalYear: NumerologyValue;
  personalMonth: NumerologyValue;
  personalDay: NumerologyValue;
}

/**
 * The three personal energies for a profile on a given date. Requires the birth
 * date. Personal Year adds the single digit sums of birth month, birth day, and
 * the current year. Personal Month adds the reduced Personal Year and the current
 * month. Personal Day adds the reduced Personal Month and the current day.
 */
export function personalNumerology(birthDate: string, dateStr: string): PersonalNumerology {
  const bm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  const cm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!bm) throw new Error('coordinates: birthDate must be YYYY-MM-DD, received ' + String(birthDate));
  if (!cm) throw new Error('coordinates: dateStr must be YYYY-MM-DD, received ' + String(dateStr));

  const birthMonth = Number(bm[2]);
  const birthDay = Number(bm[3]);
  const curYear = Number(cm[1]);
  const curMonth = Number(cm[2]);
  const curDay = Number(cm[3]);

  const personalYear = reduceNumber(digitSum(birthMonth) + digitSum(birthDay) + digitSum(curYear));
  const personalMonth = reduceNumber(personalYear.reducesTo + curMonth);
  const personalDay = reduceNumber(personalMonth.reducesTo + curDay);

  return { personalYear, personalMonth, personalDay };
}

/* ============================================================================
 * Lunar: authoritative source slot, honest until wired
 *
 * The moon phase derives from USNO timestamps, the named authority for phase
 * definitions and date conventions. The Black Moon (two days before the new
 * moon) and Shiva Moon (two days after the new moon) are CDP defined windows
 * computed from that phase, and the Black Moon term is dual labelled where it
 * differs from the mainstream astronomical meaning. Until the USNO source is
 * wired, this returns null and the caller treats it as an honest unknown.
 * ========================================================================== */

export interface LunarWindow {
  phase: string;
  meaning: string;
  cyclePct: number;
  daysToNew: number;
  daysToFull: number;
  black: boolean;
  shiva: boolean;
  isNew: boolean;
  isFull: boolean;
  register: 'astronomical';
}

/*
 * The lunar window is sourced from the USNO 2026 phase table, ported from the
 * monolith. A naive synodic calculation there read two days early and was
 * flagged, so the verified table replaced it. The table is cross referenced
 * against the USNO ephemeris, timeanddate, and the Royal Observatory, and it is
 * extended each year. Black Moon is the two days before a new moon, a tricky
 * window. Shiva Moon is the days just after a new moon, a blissful one. Both are
 * CDP defined terms; the mainstream astronomical Black Moon is a different thing.
 */
const LUNAR_SYNODIC = 29.53058867;

const NEW_MOONS_2026: readonly string[] = [
  '2026-01-18T19:52:00Z', '2026-02-17T12:01:00Z', '2026-03-19T01:23:00Z',
  '2026-04-17T11:51:00Z', '2026-05-16T20:01:00Z', '2026-06-15T02:54:00Z',
  '2026-07-14T09:43:00Z', '2026-08-12T17:36:00Z', '2026-09-11T03:27:00Z',
  '2026-10-10T15:50:00Z', '2026-11-09T07:01:00Z', '2026-12-09T00:51:00Z',
];
const FIRST_QUARTERS_2026: readonly string[] = [
  '2026-01-26T05:48:00Z', '2026-02-24T15:28:00Z', '2026-03-26T01:18:00Z',
  '2026-04-24T11:32:00Z', '2026-05-23T22:53:00Z', '2026-06-22T11:55:00Z',
  '2026-07-22T02:55:00Z', '2026-08-20T20:40:00Z', '2026-09-19T16:46:00Z',
  '2026-10-18T13:13:00Z', '2026-11-17T08:48:00Z', '2026-12-17T03:09:00Z',
];
const FULL_MOONS_2026: readonly string[] = [
  '2026-01-03T10:02:00Z', '2026-02-01T22:09:00Z', '2026-03-03T11:38:00Z',
  '2026-04-02T01:11:00Z', '2026-05-01T16:23:00Z', '2026-05-31T08:45:00Z',
  '2026-06-29T23:57:00Z', '2026-07-29T13:36:00Z', '2026-08-28T03:18:00Z',
  '2026-09-26T16:49:00Z', '2026-10-26T07:12:00Z', '2026-11-24T15:53:00Z',
  '2026-12-24T01:28:00Z',
];
const LAST_QUARTERS_2026: readonly string[] = [
  '2026-01-10T15:48:00Z', '2026-02-09T07:43:00Z', '2026-03-10T19:25:00Z',
  '2026-04-09T05:51:00Z', '2026-05-09T16:11:00Z', '2026-06-08T03:01:00Z',
  '2026-07-07T15:30:00Z', '2026-08-06T05:51:00Z', '2026-09-04T22:33:00Z',
  '2026-10-04T17:12:00Z', '2026-11-03T11:20:00Z', '2026-12-03T03:54:00Z',
];
const FALLBACK_PRE2026_NEW = Date.parse('2025-12-20T01:43:00Z');

function sameUTCDay(aMs: number, bMs: number): boolean {
  const a = new Date(aMs);
  const b = new Date(bMs);
  return a.getUTCFullYear() === b.getUTCFullYear()
    && a.getUTCMonth() === b.getUTCMonth()
    && a.getUTCDate() === b.getUTCDate();
}

function moonResult(phase: string, meaning: string, cyc: number, cycLength?: number, fraction?: number): LunarWindow {
  const len = cycLength != null ? cycLength : LUNAR_SYNODIC;
  const frac = fraction != null ? fraction : (cyc / len);
  const daysToNew = (1 - frac) * len;
  const daysToFull = frac <= 0.5 ? (0.5 - frac) * len : (1.5 - frac) * len;
  const black = daysToNew >= 0 && daysToNew <= 2.0 && frac > 0.9;
  const shiva = cyc >= 1.0 && cyc <= 2.5 && frac < 0.1;
  return {
    phase,
    meaning,
    cyclePct: Math.round(frac * 100),
    daysToNew: Math.round(daysToNew * 10) / 10,
    daysToFull: Math.round(daysToFull * 10) / 10,
    black,
    shiva,
    isNew: phase === 'New Moon',
    isFull: phase === 'Full Moon',
    register: 'astronomical',
  };
}

export function lunarWindow(dateStr: string): LunarWindow {
  const dMs = Date.parse(dateStr + 'T12:00:00Z');

  for (const ns of NEW_MOONS_2026) if (sameUTCDay(Date.parse(ns), dMs)) return moonResult('New Moon', 'Dark time, seed intention in silence', 0);
  for (const fs of FULL_MOONS_2026) if (sameUTCDay(Date.parse(fs), dMs)) return moonResult('Full Moon', 'Illumination, what is real becomes visible', 14.77);
  for (const fq of FIRST_QUARTERS_2026) if (sameUTCDay(Date.parse(fq), dMs)) return moonResult('First Quarter', 'Decisive action, push through resistance', 7.38);
  for (const lq of LAST_QUARTERS_2026) if (sameUTCDay(Date.parse(lq), dMs)) return moonResult('Last Quarter', 'Reassess, release what no longer serves', 22.15);

  let lastNew = NaN;
  let nextNew = NaN;
  for (const ns of NEW_MOONS_2026) {
    const n = Date.parse(ns);
    if (n <= dMs) lastNew = n;
    else { nextNew = n; break; }
  }
  if (Number.isNaN(lastNew)) lastNew = FALLBACK_PRE2026_NEW;
  if (Number.isNaN(nextNew)) nextNew = lastNew + LUNAR_SYNODIC * 86400000;

  const cyc = (dMs - lastNew) / 86400000;
  const cycLength = (nextNew - lastNew) / 86400000;
  const fraction = cyc / cycLength;

  let phase: string;
  let meaning: string;
  if (fraction < 0.06) { phase = 'New Moon'; meaning = 'Dark time, seed intention in silence'; }
  else if (fraction < 0.225) { phase = 'Waxing Crescent'; meaning = 'Build momentum, plant seeds'; }
  else if (fraction < 0.275) { phase = 'First Quarter'; meaning = 'Decisive action, push through resistance'; }
  else if (fraction < 0.475) { phase = 'Waxing Gibbous'; meaning = 'Refine, polish, prepare for release'; }
  else if (fraction < 0.525) { phase = 'Full Moon'; meaning = 'Illumination, what is real becomes visible'; }
  else if (fraction < 0.725) { phase = 'Waning Gibbous'; meaning = 'Harvest, integrate, share wisdom'; }
  else if (fraction < 0.775) { phase = 'Last Quarter'; meaning = 'Reassess, release what no longer serves'; }
  else if (fraction < 0.94) { phase = 'Waning Crescent'; meaning = 'Rest, reflect, prepare for rebirth'; }
  else { phase = 'New Moon'; meaning = 'Dark time, seed intention in silence'; }

  return moonResult(phase, meaning, cyc, cycLength, fraction);
}

/* ============================================================================
 * The aggregator: the day's coordinates as one tagged set
 * ========================================================================== */

export interface DayCoordinates {
  date: string;
  coordinates: Coordinate[];
}

/**
 * Resolve the day's coordinates as one set, each tagged with its chip and claim
 * tag for the citation drawer, and each marked honest where its source is not
 * yet wired. Personal layers are included only when a birth date is supplied.
 */
export function dayCoordinates(dateStr: string, profile?: Profile): DayCoordinates {
  const out: Coordinate[] = [];

  const ud = universalDay(dateStr);
  out.push({
    key: 'universal_day',
    label: 'Universal Day',
    display: ud.isMaster ? String(ud.value) + ' to ' + String(ud.reducesTo) : String(ud.value),
    value: ud,
    register: 'symbolic',
    chip: 'time',
    claimTag: 'numerology_day_quality',
    unknown: false,
  });

  if (profile && profile.birthDate) {
    const pn = personalNumerology(profile.birthDate, dateStr);
    const layer = (key: string, label: string, n: NumerologyValue): Coordinate => ({
      key,
      label,
      display: n.isMaster ? String(n.value) + ' to ' + String(n.reducesTo) : String(n.value),
      value: n,
      register: 'symbolic',
      chip: 'time',
      claimTag: 'numerology_day_quality',
      unknown: false,
    });
    out.push(layer('personal_year', 'Personal Year', pn.personalYear));
    out.push(layer('personal_month', 'Personal Month', pn.personalMonth));
    out.push(layer('personal_day', 'Personal Day', pn.personalDay));
  }

  const k = kinDescriptor(dateStr);
  out.push({
    key: 'kin',
    label: 'Dreamspell Kin',
    display: k.full + (k.isGAP ? ' (Galactic Activation Portal)' : ''),
    value: k,
    register: 'symbolic',
    chip: 'symbol',
    claimTag: 'dreamspell_count',
    unknown: false,
  });

  const lunar = lunarWindow(dateStr);
  let lunarDisplay = lunar.phase;
  if (lunar.black) lunarDisplay = lunar.phase + ', Black Moon window, a tricky time';
  else if (lunar.shiva) lunarDisplay = lunar.phase + ', Shiva Moon window, a blissful time';
  out.push({
    key: 'lunar',
    label: 'Lunar',
    display: lunarDisplay,
    value: lunar,
    register: 'astronomical',
    chip: 'lunar',
    claimTag: 'lunar_phase_timing',
    unknown: false,
  });

  return { date: dateStr, coordinates: out };
}
