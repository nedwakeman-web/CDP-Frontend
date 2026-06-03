/**
 * CDP Vessel, surface layer: the Daily Card.
 *
 * The card is the keepsake, the whisper you hold for the day and the thing you
 * share. Its single reason to exist is that it can be saved and shared as a
 * beautiful image and as a PDF, so the on screen card and the saved artifact
 * are one and the same: it is rendered as a self contained SVG, and the save
 * and share paths serialise that exact SVG. What you see is what you keep.
 *
 * Two zones, like every reading class surface. The computed zone is drawn now
 * from the verified core, so the card is never blank and never waits: the date,
 * the centring line, the time of day reflection, the coordinates, the fixed
 * signature, all from coordinates-core and numerology-content. The composed
 * zone enriches the centring line, the reflection, and the closing message from
 * the prewarmed reading when the host hands one over, without a second job.
 *
 * Legibility is by construction. Body text is parchment, gold is reserved for
 * labels and rules, and there is no long gold italic. The card surface is the
 * canonical layered navy. Every coordinate is tappable into the Compass, which
 * opens in place over the card, so a tap is never a dead end and there is a way
 * back. The voice toggle repaints in place.
 *
 * House style holds here, in code, comments, and visible strings alike: no em
 * dashes, no en dashes, no exclamation marks, and no spaced hyphen patterns.
 */

import type { Lens } from '../data/model';
import {
  kinDescriptor,
  personalNumerology,
  reduceNumber,
  lunarWindow,
} from '../coordinates-core';
import { NUM_DATA } from '../data/numerology-content';

/* ============================================================================
 * Options and handle
 * ========================================================================== */

export interface CardProfile {
  birthDate?: string;
  birthTime?: string;
  birthPlace?: string;
  name?: string;
}

/**
 * The prewarmed reading result the host may hand over, read defensively so the
 * card enriches when fields are present and stands on the computed zone when
 * they are not. The card never starts its own job; it reuses the reading one.
 */
export interface CardReadingResult {
  reading?: {
    for_today?: VoiceText;
    closing?: VoiceText;
    reflections?: { morning?: string; afternoon?: string; evening?: string };
    priorities?: Array<{ title?: string; body?: string }>;
  };
  planets?: Array<{ body?: string; sign?: string; degree?: number }>;
  moon?: { sign?: string };
}
interface VoiceText { tradition?: string; science?: string; everyday?: string; body?: string }

export interface OpenCardOptions {
  container: HTMLElement;
  getLens: () => Lens;
  getProfile: () => CardProfile | null;
  date?: string;
  location?: string;
  title?: string;
  /** A quiet trace back to the home when the card is opened or shared. */
  reflect?: (note: string) => void;
  /** Composes the Compass answer in place and returns it, for the popup. */
  composeAsk?: (prompt: string) => Promise<string>;
  /** The prewarmed reading result, so the card enriches without its own job. */
  getReadingResult?: () => CardReadingResult | null;
  /** Opens the full reading from the card footer. */
  onOpenFullReading?: () => void;
}

export interface CardHandle {
  close(): void;
  repaintVoice(lens: Lens): void;
}

/* ============================================================================
 * Tiny DOM helpers, kept independent of the home module
 * ========================================================================== */

type Attrs = Record<string, string>;
function el(tag: string, attrs: Attrs = {}, text?: string): HTMLElement {
  const node = document.createElement(tag);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  if (text !== undefined) node.textContent = text;
  return node;
}
function clear(node: HTMLElement): void { while (node.firstChild) node.removeChild(node.firstChild); }

/* ============================================================================
 * Pure helpers, node testable
 * ========================================================================== */

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Symbolic Dreamspell tone questions, the resonance each tone asks of the day. */
const TONE_HOOKS: Record<number, string> = {
  1: 'what is your purpose today',
  2: 'what is the challenge to meet',
  3: 'how best to be of service',
  4: 'what form does the work take',
  5: 'what resource do you command',
  6: 'how to extend balance to all',
  7: 'what channel are you receiving',
  8: 'do you live what you believe',
  9: 'how to realise the intention',
  10: 'how to perfect what you do',
  11: 'what is ready to be released',
  12: 'how to dedicate this to all that lives',
  13: 'how to endure and transcend',
};

function isMaster(n: number): boolean { return n === 11 || n === 22 || n === 33 || n === 44; }
function numName(n: number): string { return NUM_DATA[n] ? NUM_DATA[n].n : String(n); }
function numKey(n: number): string { return NUM_DATA[n] ? NUM_DATA[n].k : ''; }
function numMeaning(n: number): string { return NUM_DATA[n] ? NUM_DATA[n].m : ''; }

/** Digit sum of a non negative integer, once. */
function digits(n: number): number { let v = Math.abs(Math.trunc(n)); let s = 0; while (v > 0) { s += v % 10; v = Math.floor(v / 10); } return s; }

/**
 * Life Path by the standard Pythagorean method: reduce month, day, and year to
 * single digits or masters, sum them, then reduce again preserving masters. For
 * 15 June 1958 this is 6 plus 6 plus 5, which is 17, which reduces to 8. The
 * whole string shortcut would also give 8 here, but the component method is the
 * correct one across all dates, so the card uses it.
 */
function lifePath(birthDate: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!m) return 0;
  const month = reduceNumber(Number(m[2])).value;
  const day = reduceNumber(Number(m[3])).value;
  const year = reduceNumber(digits(Number(m[1]))).value;
  return reduceNumber(month + day + year).value;
}

/** The window for the hour: morning, afternoon, or evening. */
function windowForHour(hour: number): 'morning' | 'afternoon' | 'evening' {
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

function pickVoice(v: VoiceText | undefined, lens: Lens): string {
  if (!v) return '';
  const byLens = lens === 'science' ? v.science : lens === 'everyday' ? v.everyday : v.tradition;
  return (byLens || v.body || '').trim();
}

/* ============================================================================
 * The card model, pure
 * ========================================================================== */

export interface CardWindow { key: 'morning' | 'afternoon' | 'evening'; layer: string; value: number; name: string; keywords: string; master: boolean; reflection: string; }
export interface CardModel {
  weekday: string;
  dateLong: string;
  place: string;
  currentWindow: 'morning' | 'afternoon' | 'evening';
  forToday: string;
  windows: CardWindow[];
  personalDay: { value: number; name: string; keywords: string; meaning: string; master: boolean } | null;
  lunar: { phase: string; daysToNew: number; age: number; black: boolean; shiva: boolean; sign: string };
  kin: { kin: number; full: string; toneName: string; seal: string; colour: string; hook: string; isGAP: boolean };
  signature: { name: string; lifePath: { value: number; name: string; master: boolean } | null; personalYear: { value: number; name: string; master: boolean } | null; birthKin: { kin: number; full: string } | null };
  planets: Array<{ body: string; sign: string; degree: number }>;
  finalMessage: string;
}

const SYNODIC = 29.53058867;

export function buildCardModel(dateStr: string, profile: CardProfile | null, lens: Lens, result: CardReadingResult | null, nowHour: number): CardModel {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  const y = d ? Number(d[1]) : 1970;
  const mo = d ? Number(d[2]) : 1;
  const da = d ? Number(d[3]) : 1;
  const dt = new Date(Date.UTC(y, mo - 1, da));
  const weekday = WEEKDAYS[dt.getUTCDay()];
  const dateLong = da + ' ' + MONTHS[mo - 1] + ' ' + y;

  const kd = kinDescriptor(dateStr);
  const lw = lunarWindow(dateStr);
  const moonSign = (result && result.moon && result.moon.sign) ? result.moon.sign : '';
  const age = Math.round((SYNODIC - lw.daysToNew) * 10) / 10;

  const hasBirth = !!(profile && profile.birthDate && /^\d{4}-\d{2}-\d{2}$/.test(profile.birthDate));
  const pn = hasBirth ? personalNumerology(profile!.birthDate as string, dateStr) : null;

  const cw = windowForHour(nowHour);
  const refl = result && result.reading && result.reading.reflections ? result.reading.reflections : null;

  const windows: CardWindow[] = [];
  if (pn) {
    const defs: Array<{ key: 'morning' | 'afternoon' | 'evening'; layer: string; val: number }> = [
      { key: 'morning', layer: 'Personal Day', val: pn.personalDay.value },
      { key: 'afternoon', layer: 'Personal Month', val: pn.personalMonth.value },
      { key: 'evening', layer: 'Personal Year', val: pn.personalYear.value },
    ];
    for (const def of defs) {
      const computed = computedReflection(def.key, def.val);
      const enriched = refl ? (refl[def.key] || '').trim() : '';
      windows.push({ key: def.key, layer: def.layer, value: def.val, name: numName(def.val), keywords: numKey(def.val), master: isMaster(def.val), reflection: enriched || computed });
    }
  }

  const personalDay = pn ? { value: pn.personalDay.value, name: numName(pn.personalDay.value), keywords: numKey(pn.personalDay.value), meaning: numMeaning(pn.personalDay.value), master: isMaster(pn.personalDay.value) } : null;

  // For Today, enriched from the reading when present, computed otherwise.
  const aiForToday = result && result.reading ? pickVoice(result.reading.for_today, lens) : '';
  const aiPriority = result && result.reading && result.reading.priorities && result.reading.priorities[0] ? (result.reading.priorities[0].body || '').trim() : '';
  const forToday = aiForToday || aiPriority || computedForToday(personalDay, kd);

  const aiClosing = result && result.reading ? pickVoice(result.reading.closing, lens) : '';
  const finalMessage = aiClosing || computedClosing(kd, TONE_HOOKS[kd.tone] || '');

  const planets: Array<{ body: string; sign: string; degree: number }> = [];
  if (result && result.planets) {
    for (const p of result.planets) {
      if (p && p.body && p.sign != null) planets.push({ body: p.body, sign: p.sign, degree: typeof p.degree === 'number' ? p.degree : 0 });
      if (planets.length >= 4) break;
    }
  }

  const signature = {
    name: (profile && profile.name) ? profile.name : '',
    lifePath: hasBirth ? (() => { const lp = lifePath(profile!.birthDate as string); return { value: lp, name: numName(lp), master: isMaster(lp) }; })() : null,
    personalYear: pn ? { value: pn.personalYear.value, name: numName(pn.personalYear.value), master: isMaster(pn.personalYear.value) } : null,
    birthKin: hasBirth ? (() => { const bk = kinDescriptor(profile!.birthDate as string); return { kin: bk.kin, full: bk.full }; })() : null,
  };

  return {
    weekday,
    dateLong,
    place: (profile && profile.birthPlace) ? profile.birthPlace : '',
    currentWindow: cw,
    forToday,
    windows,
    personalDay,
    lunar: { phase: lw.phase, daysToNew: lw.daysToNew, age, black: lw.black, shiva: lw.shiva, sign: moonSign },
    kin: { kin: kd.kin, full: kd.full, toneName: kd.toneName, seal: kd.seal, colour: kd.colour, hook: TONE_HOOKS[kd.tone] || '', isGAP: kd.isGAP },
    signature,
    planets,
    finalMessage,
  };
}

function computedReflection(key: 'morning' | 'afternoon' | 'evening', n: number): string {
  const name = numName(n).toLowerCase();
  if (key === 'morning') return 'Morning sets the tone. Meet the day through ' + name + ', and let the first hours carry it.';
  if (key === 'afternoon') return 'Afternoon carries it forward. Hold ' + name + ' as the work of the day deepens.';
  return 'Evening consolidates what was built. Let ' + name + ' settle, and honour the discipline of the day.';
}
function computedForToday(pd: { value: number; name: string; meaning: string } | null, kd: { seal: string; toneName: string }): string {
  if (pd) return numName(pd.value) + '. ' + numMeaning(pd.value) + ' Carry one clear intention, and let it shape what you choose.';
  return 'Hold one clear intention today, and let the ' + kd.toneName + ' ' + kd.seal + ' carry it through.';
}
function computedClosing(kd: { seal: string; toneName: string }, hook: string): string {
  return 'The ' + kd.toneName + ' ' + kd.seal + ' asks ' + hook + '. Hold the question gently, and let the day answer it.';
}

/* ============================================================================
 * The card SVG, pure. The on screen card and the saved image are this string.
 * ========================================================================== */

const W = 760;
const PAD = 44;

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function wrap(text: string, maxChars: number): string[] {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if (line.length === 0) { line = w; continue; }
    if ((line + ' ' + w).length <= maxChars) line = line + ' ' + w;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

class Layout {
  parts: string[] = [];
  y = 0;
  add(svg: string, dh: number): void { this.parts.push(svg); this.y += dh; }
}

function tspans(lines: string[], x: number, lineH: number): string {
  return lines.map((ln, i) => '<tspan x="' + x + '" dy="' + (i === 0 ? 0 : lineH) + '">' + esc(ln) + '</tspan>').join('');
}

function label(text: string, x: number, y: number, colour: string): string {
  return '<text x="' + x + '" y="' + y + '" font-family="Cinzel, Georgia, serif" font-size="12" letter-spacing="3" fill="' + colour + '">' + esc(text.toUpperCase()) + '</text>';
}
function body(lines: string[], x: number, y: number, size: number, colour: string, lineH: number, italic?: boolean): string {
  const style = italic ? ' font-style="italic" font-family="EB Garamond, Georgia, serif"' : ' font-family="Georgia, serif"';
  return '<text x="' + x + '" y="' + y + '"' + style + ' font-size="' + size + '" fill="' + colour + '">' + tspans(lines, x, lineH) + '</text>';
}

/* palette */
const C = {
  page: '#0A1828', panel: '#0D1E33', raised: '#122440', raised2: '#192E4A',
  gold: '#C9A050', goldBright: '#E8C878', rule: '#BFA363', teal: '#81CDB6',
  text: '#F0E6CC', dim: '#D4C8AE', faint: '#9E9282', master: '#C8A0FF',
};

export function buildCardSVG(m: CardModel, _lens: Lens): string {
  const L = new Layout();
  const innerW = W - PAD * 2;
  const maxBody = Math.floor(innerW / 8.4);

  // header band
  L.add('', 30);
  L.add('<text x="' + (W / 2) + '" y="' + L.y + '" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="15" letter-spacing="5" fill="' + C.goldBright + '">' + esc((m.weekday + ' \u00b7 ' + m.dateLong).toUpperCase()) + '</text>', 26);
  if (m.place) L.add('<text x="' + (W / 2) + '" y="' + L.y + '" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="11" letter-spacing="3" fill="' + C.faint + '">' + esc(m.place.toUpperCase()) + '</text>', 22);
  L.add('<line x1="' + PAD + '" y1="' + (L.y + 14) + '" x2="' + (W - PAD) + '" y2="' + (L.y + 14) + '" stroke="' + C.rule + '" stroke-opacity="0.4"/>', 40);

  // current reflection (tappable)
  const reflWindow = m.windows.find((w) => w.key === m.currentWindow);
  const reflText = reflWindow ? reflWindow.reflection : computedReflection(m.currentWindow, m.personalDay ? m.personalDay.value : 1);
  const reflLabel = m.currentWindow.toUpperCase() + ' REFLECTION';
  const reflLines = wrap(reflText, maxBody);
  const reflPrompt = 'It is ' + m.currentWindow + '. Read me my ' + m.currentWindow + ' reflection in depth for today.';
  L.add('<g class="ctap" style="cursor:pointer" data-prompt="' + esc(reflPrompt) + '">', 0);
  L.add(label(reflLabel, PAD, L.y, C.teal), 26);
  L.add(body(reflLines, PAD, L.y, 17, C.text, 24), reflLines.length * 24 + 6);
  L.add('<text x="' + (W - PAD) + '" y="' + L.y + '" text-anchor="end" font-family="Cinzel, Georgia, serif" font-size="11" letter-spacing="2" fill="' + C.gold + '">' + esc('\u2197 ASK THE ORACLE') + '</text>', 18);
  L.add('</g>', 0);
  L.add('<circle cx="' + (W / 2) + '" cy="' + (L.y + 14) + '" r="2.5" fill="' + C.gold + '"/>', 40);

  // FOR TODAY (the hold)
  const maxFt = Math.floor(innerW / 11);
  const ftLines = wrap(m.forToday, maxFt);
  L.add(label('For Today', PAD, L.y, C.teal), 28);
  L.add(body(ftLines, PAD, L.y, 19, C.text, 27, true), ftLines.length * 27 + 22);

  // Personal Day panel (tappable)
  if (m.personalDay) {
    const pd = m.personalDay;
    const meaningLines = wrap(pd.meaning, maxBody - 8);
    const panelH = Math.max(96, 56 + meaningLines.length * 22);
    const top = L.y;
    L.add('<rect x="' + (PAD - 16) + '" y="' + top + '" width="' + (innerW + 32) + '" height="' + panelH + '" rx="10" fill="' + C.raised + '"/>', 0);
    const numColour = pd.master ? C.master : C.gold;
    L.add('<text x="' + PAD + '" y="' + (top + 30) + '" font-family="Cinzel, Georgia, serif" font-size="11" letter-spacing="3" fill="' + C.faint + '">' + esc('PERSONAL DAY ' + pd.value) + (pd.master ? ' \u2605' : '') + '</text>', 0);
    L.add('<text x="' + PAD + '" y="' + (top + 54) + '" font-family="EB Garamond, Georgia, serif" font-size="20" fill="' + numColour + '">' + esc(pd.name) + '</text>', 0);
    L.add('<g class="ctap" style="cursor:pointer" data-prompt="' + esc('My Personal Day is ' + pd.value + ', ' + pd.name + '. What does this energy ask of me today.') + '">', 0);
    L.add('<text x="' + (W - PAD) + '" y="' + (top + 30) + '" text-anchor="end" font-family="Cinzel, Georgia, serif" font-size="11" letter-spacing="2" fill="' + C.gold + '">' + esc('\u2197 ASK') + '</text>', 0);
    L.add('<rect x="' + (PAD - 16) + '" y="' + top + '" width="' + (innerW + 32) + '" height="' + panelH + '" rx="10" fill="transparent"/>', 0);
    L.add('</g>', 0);
    L.add(body(meaningLines, PAD, top + 78, 14, C.dim, 22), 0);
    L.add('', panelH + 22);
  }

  // Lunar | Dreamspell two columns
  {
    const colW = innerW / 2 - 12;
    const top = L.y;
    const colH = 122;
    const x1 = PAD - 16, x2 = PAD - 16 + colW + 24;
    L.add('<rect x="' + x1 + '" y="' + top + '" width="' + (colW + 8) + '" height="' + colH + '" rx="10" fill="' + C.raised + '"/>', 0);
    L.add('<rect x="' + x2 + '" y="' + top + '" width="' + (colW + 8) + '" height="' + colH + '" rx="10" fill="' + C.raised + '"/>', 0);
    // lunar
    const moonGlyph = '<circle cx="' + (x1 + 24) + '" cy="' + (top + 50) + '" r="9" fill="none" stroke="' + C.goldBright + '" stroke-width="1.6"/><path d="M' + (x1 + 24) + ' ' + (top + 41) + ' a9 9 0 0 0 0 18 z" fill="' + C.goldBright + '" opacity="0.8"/>';
    L.add('<text x="' + (x1 + 16) + '" y="' + (top + 26) + '" font-family="Cinzel, Georgia, serif" font-size="11" letter-spacing="2" fill="' + C.teal + '">LUNAR PHASE</text>', 0);
    L.add(moonGlyph, 0);
    L.add('<text x="' + (x1 + 40) + '" y="' + (top + 54) + '" font-family="EB Garamond, Georgia, serif" font-size="16" fill="' + C.text + '">' + esc(m.lunar.phase) + '</text>', 0);
    const moonSub = (m.lunar.sign ? m.lunar.sign + ' \u00b7 ' : '') + 'Day ' + m.lunar.age + ' \u00b7 ' + m.lunar.daysToNew + 'd to New Moon';
    L.add(body(wrap(moonSub, Math.floor(colW / 6.6)), x1 + 16, top + 78, 12, C.dim, 17), 0);
    if (m.lunar.black) L.add('<text x="' + (x1 + 16) + '" y="' + (top + colH - 12) + '" font-family="Georgia, serif" font-size="11" fill="' + C.goldBright + '">Black Moon window</text>', 0);
    else if (m.lunar.shiva) L.add('<text x="' + (x1 + 16) + '" y="' + (top + colH - 12) + '" font-family="Georgia, serif" font-size="11" fill="' + C.goldBright + '">Shiva Moon window</text>', 0);
    // dreamspell (tappable)
    L.add('<text x="' + (x2 + 16) + '" y="' + (top + 26) + '" font-family="Cinzel, Georgia, serif" font-size="11" letter-spacing="2" fill="' + C.teal + '">DREAMSPELL</text>', 0);
    L.add(body(wrap(m.kin.full, Math.floor(colW / 6.4)), x2 + 16, top + 50, 13.5, C.text, 19), 0);
    const hookLines = wrap(m.kin.toneName + ' tone asks: ' + m.kin.hook + '.', Math.floor(colW / 6.6));
    L.add(body(hookLines, x2 + 16, top + 92, 12, C.dim, 16), 0);
    if (m.kin.isGAP) L.add('<text x="' + (x2 + colW - 8) + '" y="' + (top + 26) + '" text-anchor="end" font-family="Cinzel, Georgia, serif" font-size="10" letter-spacing="1" fill="' + C.goldBright + '">PORTAL</text>', 0);
    L.add('<g class="ctap" style="cursor:pointer" data-prompt="' + esc('Today is ' + m.kin.full + '. What does this Kin mean for me today.') + '"><rect x="' + x2 + '" y="' + top + '" width="' + (colW + 8) + '" height="' + colH + '" rx="10" fill="transparent"/></g>', 0);
    L.add('', colH + 20);
  }

  // Three windows row (tappable), the thing that was not tappable before
  if (m.windows.length === 3) {
    const top = L.y;
    L.add(label('The day in three windows', PAD, top, C.faint), 22);
    const rowTop = L.y;
    const colW = innerW / 3 - 10;
    const rowH = 118;
    m.windows.forEach((w, i) => {
      const x = PAD - 8 + i * (colW + 12);
      const numColour = w.master ? C.master : C.gold;
      L.add('<rect x="' + x + '" y="' + rowTop + '" width="' + colW + '" height="' + rowH + '" rx="9" fill="' + C.raised + '"/>', 0);
      L.add('<text x="' + (x + 14) + '" y="' + (rowTop + 24) + '" font-family="Cinzel, Georgia, serif" font-size="10" letter-spacing="2" fill="' + C.faint + '">' + esc(w.key.toUpperCase()) + '</text>', 0);
      L.add('<text x="' + (x + 14) + '" y="' + (rowTop + 40) + '" font-family="Georgia, serif" font-size="10" fill="' + C.faint + '">' + esc(w.layer) + '</text>', 0);
      L.add('<text x="' + (x + 14) + '" y="' + (rowTop + 66) + '" font-family="EB Garamond, Georgia, serif" font-size="22" fill="' + numColour + '">' + esc(String(w.value)) + (w.master ? ' \u2605' : '') + '</text>', 0);
      L.add(body(wrap(w.name, Math.floor(colW / 6.2)), x + 14, rowTop + 88, 13, C.text, 16), 0);
      L.add('<g class="ctap" style="cursor:pointer" data-prompt="' + esc(w.layer + ' is ' + w.value + ', ' + w.name + '. What does this ask of my ' + w.key + ' today.') + '"><rect x="' + x + '" y="' + rowTop + '" width="' + colW + '" height="' + rowH + '" rx="9" fill="transparent"/></g>', 0);
    });
    L.add('', rowH + 22);
  }

  // Planetary weather, when the reading has it
  if (m.planets.length) {
    const top = L.y;
    L.add(label('Planetary weather', PAD, top, C.teal), 26);
    m.planets.forEach((p, i) => {
      const ry = L.y + i * 26;
      L.add('<text x="' + PAD + '" y="' + ry + '" font-family="Cinzel, Georgia, serif" font-size="11" letter-spacing="2" fill="' + C.faint + '">' + esc(p.body.toUpperCase()) + '</text>', 0);
      L.add('<text x="' + (PAD + 130) + '" y="' + ry + '" font-family="EB Garamond, Georgia, serif" font-size="14" fill="' + C.text + '">' + esc((p.degree ? p.degree.toFixed(1) + '\u00b0 ' : '') + p.sign) + '</text>', 0);
    });
    L.add('', m.planets.length * 26 + 14);
  }

  // Fixed signature
  {
    const top = L.y;
    L.add('<line x1="' + PAD + '" y1="' + top + '" x2="' + (W - PAD) + '" y2="' + top + '" stroke="' + C.rule + '" stroke-opacity="0.3"/>', 22);
    if (m.signature.name) L.add('<text x="' + PAD + '" y="' + L.y + '" font-family="EB Garamond, Georgia, serif" font-size="16" fill="' + C.gold + '">' + esc(m.signature.name) + '</text>', 28);
    const half = innerW / 2;
    if (m.signature.lifePath) {
      const lp = m.signature.lifePath; const cc = lp.master ? C.master : C.gold;
      L.add('<text x="' + PAD + '" y="' + L.y + '" font-family="Cinzel, Georgia, serif" font-size="10" letter-spacing="2" fill="' + C.faint + '">LIFE PATH</text>', 0);
      L.add('<text x="' + (PAD + half) + '" y="' + L.y + '" font-family="Cinzel, Georgia, serif" font-size="10" letter-spacing="2" fill="' + C.faint + '">PERSONAL YEAR</text>', 18);
      L.add('<text x="' + PAD + '" y="' + L.y + '" font-family="EB Garamond, Georgia, serif" font-size="22" fill="' + cc + '">' + esc(String(lp.value)) + (lp.master ? ' \u2605' : '') + '</text>', 0);
      if (m.signature.personalYear) { const py = m.signature.personalYear; const pc = py.master ? C.master : C.gold; L.add('<text x="' + (PAD + half) + '" y="' + L.y + '" font-family="EB Garamond, Georgia, serif" font-size="22" fill="' + pc + '">' + esc(String(py.value)) + (py.master ? ' \u2605' : '') + '</text>', 22); }
      else L.add('', 22);
      L.add('<text x="' + PAD + '" y="' + L.y + '" font-family="Georgia, serif" font-size="12" fill="' + C.dim + '">' + esc(lp.name) + '</text>', 0);
      if (m.signature.personalYear) L.add('<text x="' + (PAD + half) + '" y="' + L.y + '" font-family="Georgia, serif" font-size="12" fill="' + C.dim + '">' + esc(m.signature.personalYear.name) + '</text>', 24);
      else L.add('', 24);
    }
    if (m.signature.birthKin) {
      L.add('<text x="' + PAD + '" y="' + L.y + '" font-family="Cinzel, Georgia, serif" font-size="10" letter-spacing="2" fill="' + C.faint + '">BIRTH KIN</text>', 18);
      L.add('<text x="' + PAD + '" y="' + L.y + '" font-family="EB Garamond, Georgia, serif" font-size="14" fill="' + C.text + '">' + esc(m.signature.birthKin.full) + '</text>', 26);
    }
  }

  // Final message
  {
    const fmLines = wrap(m.finalMessage, maxBody - 4);
    L.add('<line x1="' + PAD + '" y1="' + L.y + '" x2="' + (W - PAD) + '" y2="' + L.y + '" stroke="' + C.rule + '" stroke-opacity="0.3"/>', 26);
    L.add('<text x="' + (W / 2) + '" y="' + L.y + '" text-anchor="middle" font-style="italic" font-family="EB Garamond, Georgia, serif" font-size="15" fill="' + C.dim + '">' + fmLines.map((ln, i) => '<tspan x="' + (W / 2) + '" dy="' + (i === 0 ? 0 : 23) + '">' + esc(ln) + '</tspan>').join('') + '</text>', fmLines.length * 23 + 18);
  }

  // footer
  L.add('<circle cx="' + (W / 2 - 12) + '" cy="' + (L.y + 6) + '" r="6" fill="none" stroke="' + C.rule + '" stroke-width="1.2"/><circle cx="' + (W / 2 + 12) + '" cy="' + (L.y + 6) + '" r="6" fill="none" stroke="' + C.rule + '" stroke-width="1.2"/>', 26);
  L.add('<text x="' + (W / 2) + '" y="' + L.y + '" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="10" letter-spacing="3" fill="' + C.faint + '">COSMICDAILYPLANNER.COM</text>', 30);

  const H = Math.round(L.y);
  const defs = '<defs><linearGradient id="cardbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + C.panel + '"/><stop offset="0.16" stop-color="' + C.page + '"/><stop offset="1" stop-color="' + C.page + '"/></linearGradient></defs>';
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" font-family="Georgia, serif">'
    + defs
    + '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="url(#cardbg)"/>'
    + '<rect x="6" y="6" width="' + (W - 12) + '" height="' + (H - 12) + '" rx="14" fill="none" stroke="' + C.rule + '" stroke-opacity="0.25"/>'
    + L.parts.join('')
    + '</svg>';
}

/* ============================================================================
 * Save and share. The card image is the SVG above, rasterised for keeping and
 * sharing, and printed as a vector PDF. This is the headline capability.
 * ========================================================================== */

interface ShareNav { canShare?: (data: { files?: File[]; title?: string }) => boolean; share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>; }

function svgToPngBlob(svg: string, scale: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || W;
      const h = img.naturalHeight || W;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error('no_context')); return; }
      ctx.fillStyle = C.page;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => { if (b) resolve(b); else reject(new Error('no_blob')); }, 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image_failed')); };
    img.src = url;
  });
}
function downloadBlob(b: Blob, name: string): void {
  const url = URL.createObjectURL(b);
  const a = el('a', { href: url, download: name });
  document.body.appendChild(a);
  (a as HTMLAnchorElement).click();
  window.setTimeout(() => { if (a.parentNode) a.parentNode.removeChild(a); URL.revokeObjectURL(url); }, 1200);
}
function printSvgPdf(svg: string, title: string): void {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.position = 'fixed'; frame.style.right = '0'; frame.style.bottom = '0';
  frame.style.width = '0'; frame.style.height = '0'; frame.style.border = '0';
  document.body.appendChild(frame);
  const doc = frame.contentWindow && frame.contentWindow.document;
  if (!doc) { document.body.removeChild(frame); return; }
  const safe = String(title || 'Cosmic Daily Planner').replace(/</g, '').replace(/>/g, '');
  doc.open();
  doc.write('<html><head><title>' + safe + '</title><meta charset="utf-8"><style>@page{margin:14mm}html,body{margin:0;background:' + C.page + '}svg{width:100%;height:auto;display:block}</style></head><body>' + svg + '</body></html>');
  doc.close();
  const w = frame.contentWindow;
  if (!w) { document.body.removeChild(frame); return; }
  window.setTimeout(() => {
    try { w.focus(); w.print(); } catch (_e) { /* user may cancel */ }
    window.setTimeout(() => { if (frame.parentNode) frame.parentNode.removeChild(frame); }, 1000);
  }, 350);
}

/* ============================================================================
 * The surface
 * ========================================================================== */

const STYLE_ID = 'cdp-card-style';
function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const css = `
.cdp-surface .card-view { position:fixed; inset:0; z-index:60; overflow-y:auto; background:rgba(6,14,26,.55); backdrop-filter:blur(2px); display:flex; flex-direction:column; align-items:center; padding:18px 12px 40px; }
.cdp-surface .card-shell { width:100%; max-width:760px; }
.cdp-surface .card-bar { display:flex; align-items:center; justify-content:space-between; margin:0 0 12px; }
.cdp-surface .card-h { font-family:Cinzel, Georgia, serif; font-size:12px; letter-spacing:.18em; text-transform:uppercase; color:var(--gold, #C9A050); }
.cdp-surface .card-close { background:none; border:none; color:var(--text-dim, #D4C8AE); font-size:22px; line-height:1; cursor:pointer; }
.cdp-surface .card-close:hover { color:var(--gold-soft, #E8C878); }
.cdp-surface .card-svg { width:100%; height:auto; display:block; border-radius:14px; overflow:hidden; box-shadow:0 16px 50px rgba(0,0,0,.5); }
.cdp-surface .card-tools { display:flex; flex-wrap:wrap; gap:8px; margin:14px 0 0; align-items:center; }
.cdp-surface .card-voice { display:inline-flex; border:1px solid var(--gold-line, #3A3320); border-radius:4px; overflow:hidden; margin-right:auto; }
.cdp-surface .card-voice button { background:none; border:none; color:var(--text-faint, #9E9282); font-family:Cinzel, Georgia, serif; font-size:11px; letter-spacing:.1em; text-transform:uppercase; padding:7px 12px; cursor:pointer; }
.cdp-surface .card-voice button.on { color:var(--gold, #C9A050); background:rgba(201,160,80,.12); }
.cdp-surface .card-btn { background:none; border:1px solid var(--gold, #C9A050); color:var(--gold, #C9A050); font-family:Cinzel, Georgia, serif; font-size:11px; letter-spacing:.1em; text-transform:uppercase; padding:7px 13px; border-radius:4px; cursor:pointer; }
.cdp-surface .card-btn:hover { background:rgba(201,160,80,.1); }
.cdp-surface .card-dd-scrim { position:fixed; inset:0; background:rgba(3,12,24,.62); z-index:80; display:flex; align-items:flex-end; justify-content:center; }
.cdp-surface .card-dd { width:100%; max-width:40rem; max-height:82vh; background:var(--navy, #0D1E33); border:1px solid var(--gold-line, #BFA363); border-bottom:none; border-radius:10px 10px 0 0; box-shadow:0 -10px 40px rgba(0,0,0,.45); display:flex; flex-direction:column; overflow:hidden; }
.cdp-surface .card-dd-head { display:flex; align-items:center; justify-content:space-between; padding:14px 18px; border-bottom:1px solid rgba(191,163,99,.22); }
.cdp-surface .card-dd-h { font-family:Cinzel, Georgia, serif; font-size:11px; letter-spacing:.18em; text-transform:uppercase; color:var(--gold, #C9A050); }
.cdp-surface .card-dd-x { background:none; border:none; color:var(--text-dim, #D4C8AE); font-size:22px; line-height:1; cursor:pointer; padding:0 4px; }
.cdp-surface .card-dd-thread { overflow-y:auto; padding:16px 18px; flex:1; }
.cdp-surface .card-dd-q { font-family:'EB Garamond', Georgia, serif; font-style:italic; font-size:15px; color:var(--text-dim, #D4C8AE); margin:0 0 8px; }
.cdp-surface .card-dd-a { margin:0 0 18px; padding-left:12px; border-left:2px solid var(--gold-line, #BFA363); }
.cdp-surface .card-dd-wait { color:var(--text-faint, #9E9282); font-style:italic; font-family:'EB Garamond', Georgia, serif; }
.cdp-surface .card-dd-p { font-family:Georgia, serif; font-size:15px; line-height:1.7; color:var(--text-light, #F0E6CC); margin:0 0 11px; }
.cdp-surface .card-dd-foot { display:flex; gap:8px; padding:12px 14px; border-top:1px solid rgba(191,163,99,.22); background:var(--panel-deep, #0A1828); }
.cdp-surface .card-dd-in { flex:1; resize:none; background:var(--card, #122440); border:1px solid rgba(191,163,99,.3); border-radius:6px; color:var(--text-light, #F0E6CC); font-family:Georgia, serif; font-size:14px; padding:9px 11px; line-height:1.5; }
.cdp-surface .card-dd-in:focus { outline:none; border-color:var(--gold, #C9A050); }
.cdp-surface .card-dd-ask { background:none; border:1px solid var(--gold, #C9A050); color:var(--gold, #C9A050); font-family:Cinzel, Georgia, serif; font-size:11px; letter-spacing:.12em; text-transform:uppercase; padding:0 16px; border-radius:6px; cursor:pointer; }
`;
  const style = el('style', { id: STYLE_ID });
  style.textContent = css;
  document.head.appendChild(style);
}

function lensName(l: Lens): string { return l === 'science' ? 'Science' : l === 'everyday' ? 'Everyday' : 'Tradition'; }

export function openCard(o: OpenCardOptions): CardHandle {
  ensureStyle();
  const dateStr = o.date || new Date().toISOString().slice(0, 10);
  const composeAsk = o.composeAsk;

  let lens: Lens = o.getLens();
  const view = el('div', { class: 'card-view', role: 'dialog', 'aria-label': 'Today\u2019s card' });
  const shell = el('div', { class: 'card-shell' });

  const bar = el('div', { class: 'card-bar' });
  bar.appendChild(el('div', { class: 'card-h' }, o.title || 'Today\u2019s card'));
  const closeBtn = el('button', { type: 'button', class: 'card-close', 'aria-label': 'Close' }, '\u00d7');
  bar.appendChild(closeBtn);
  shell.appendChild(bar);

  const svgHost = el('div', { class: 'card-svg' });
  shell.appendChild(svgHost);

  const tools = el('div', { class: 'card-tools' });
  const voice = el('div', { class: 'card-voice' });
  const voiceBtns: Record<Lens, HTMLElement> = {
    tradition: el('button', { type: 'button' }, 'Tradition'),
    science: el('button', { type: 'button' }, 'Science'),
    everyday: el('button', { type: 'button' }, 'Everyday'),
  };
  (['tradition', 'science', 'everyday'] as Lens[]).forEach((l) => {
    voiceBtns[l].addEventListener('click', () => { lens = l; paint(); });
    voice.appendChild(voiceBtns[l]);
  });
  tools.appendChild(voice);

  const saveImg = el('button', { type: 'button', class: 'card-btn' }, 'Save image');
  const savePdf = el('button', { type: 'button', class: 'card-btn' }, 'Save PDF');
  const shareBtn = el('button', { type: 'button', class: 'card-btn' }, 'Share');
  const openFull = el('button', { type: 'button', class: 'card-btn' }, 'Open full reading');
  tools.appendChild(saveImg); tools.appendChild(savePdf); tools.appendChild(shareBtn); tools.appendChild(openFull);
  shell.appendChild(tools);
  view.appendChild(shell);
  o.container.appendChild(view);

  let live = true;
  function close(): void { live = false; if (view.parentNode) view.parentNode.removeChild(view); }
  closeBtn.addEventListener('click', close);
  openFull.addEventListener('click', () => { if (o.onOpenFullReading) o.onOpenFullReading(); });

  let currentSvg = '';
  function currentModel(): CardModel {
    const result = o.getReadingResult ? o.getReadingResult() : null;
    const hour = new Date().getHours();
    return buildCardModel(dateStr, o.getProfile(), lens, result, hour);
  }
  function paint(): void {
    (['tradition', 'science', 'everyday'] as Lens[]).forEach((l) => {
      if (l === lens) voiceBtns[l].classList.add('on'); else voiceBtns[l].classList.remove('on');
    });
    const model = currentModel();
    currentSvg = buildCardSVG(model, lens);
    svgHost.innerHTML = currentSvg;
    const taps = svgHost.querySelectorAll('.ctap');
    taps.forEach((node) => {
      const prompt = (node as Element).getAttribute('data-prompt') || '';
      (node as HTMLElement).addEventListener('click', () => { deepDive(prompt); });
    });
  }

  /* ---- the in place Compass popup, opened over the card ------------------- */
  let ddOpen = false;
  function openDeepDive(firstPrompt: string): void {
    if (ddOpen) return;
    ddOpen = true;
    const scrim = el('div', { class: 'card-dd-scrim' });
    const panel = el('div', { class: 'card-dd', role: 'dialog', 'aria-label': 'Ask the Oracle' });
    const head = el('div', { class: 'card-dd-head' });
    head.appendChild(el('div', { class: 'card-dd-h' }, 'Ask the Oracle'));
    const x = el('button', { type: 'button', class: 'card-dd-x', 'aria-label': 'Close' }, '\u00d7');
    head.appendChild(x);
    panel.appendChild(head);
    const thread = el('div', { class: 'card-dd-thread' });
    panel.appendChild(thread);
    const foot = el('div', { class: 'card-dd-foot' });
    const fin = el('textarea', { class: 'card-dd-in', rows: '1', placeholder: 'Ask a follow up question' }) as HTMLTextAreaElement;
    const fbtn = el('button', { type: 'button', class: 'card-dd-ask' }, 'Ask');
    foot.appendChild(fin); foot.appendChild(fbtn);
    panel.appendChild(foot);
    scrim.appendChild(panel);
    view.appendChild(scrim);

    function closeDD(): void { ddOpen = false; if (scrim.parentNode) scrim.parentNode.removeChild(scrim); }
    x.addEventListener('click', closeDD);
    scrim.addEventListener('click', (e: Event) => { if (e.target === scrim) closeDD(); });

    let busy = false;
    async function run(prompt: string): Promise<void> {
      const q = prompt.trim();
      if (!q || busy) return;
      busy = true; fbtn.setAttribute('disabled', 'disabled');
      thread.appendChild(el('div', { class: 'card-dd-q' }, q));
      const aEl = el('div', { class: 'card-dd-a card-dd-wait' }, 'Composing in the ' + lensName(lens) + ' voice.');
      thread.appendChild(aEl);
      panel.scrollTop = panel.scrollHeight;
      try {
        const reply = composeAsk ? await composeAsk(q) : '';
        aEl.classList.remove('card-dd-wait');
        clear(aEl);
        const paras = reply.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
        if (paras.length === 0) paras.push((reply || '').trim() || 'The Oracle is still composing. Please try again in a moment.');
        for (const p of paras) aEl.appendChild(el('p', { class: 'card-dd-p' }, p));
      } catch (_e) {
        aEl.classList.remove('card-dd-wait');
        aEl.textContent = 'The answer hit a snag on the server. Please try again in a moment.';
      } finally {
        busy = false; fbtn.removeAttribute('disabled');
        panel.scrollTop = panel.scrollHeight; fin.focus();
      }
    }
    fbtn.addEventListener('click', () => { const t = fin.value; fin.value = ''; void run(t); });
    fin.addEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); const t = fin.value; fin.value = ''; void run(t); } });
    void run(firstPrompt);
    fin.focus();
  }
  function deepDive(prompt: string): void { if (composeAsk) openDeepDive(prompt); }

  /* ---- save and share ----------------------------------------------------- */
  function flash(btn: HTMLElement, lbl: string): void { const p = btn.textContent || ''; btn.textContent = lbl; window.setTimeout(() => { btn.textContent = p; }, 1600); }
  const fileBase = 'cosmic-card-' + dateStr;
  saveImg.addEventListener('click', () => {
    svgToPngBlob(currentSvg, 2).then((b) => { downloadBlob(b, fileBase + '.png'); flash(saveImg, 'Saved'); if (o.reflect) o.reflect('Today\u2019s card is saved.'); }).catch(() => flash(saveImg, 'Try again'));
  });
  savePdf.addEventListener('click', () => { printSvgPdf(currentSvg, 'Cosmic Daily Planner, ' + dateStr); });
  shareBtn.addEventListener('click', () => {
    svgToPngBlob(currentSvg, 2).then((b) => {
      const file = new File([b], fileBase + '.png', { type: 'image/png' });
      const nav = navigator as unknown as ShareNav;
      if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
        nav.share({ files: [file], title: 'My Cosmic Daily Planner card' }).then(() => { if (o.reflect) o.reflect('Today\u2019s card is shared.'); }).catch(() => { /* cancelled */ });
      } else {
        downloadBlob(b, fileBase + '.png'); flash(shareBtn, 'Saved to share');
      }
    }).catch(() => flash(shareBtn, 'Try again'));
  });

  paint();
  if (o.reflect && live) { /* opened, the home need not be told */ }

  return {
    close,
    repaintVoice(l: Lens): void { lens = l; paint(); },
  };
}
