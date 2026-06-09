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

import type { Lens, VesselSignal } from '../data/model';
import {
  kinDescriptor,
  personalNumerology,
  reduceNumber,
  lunarWindow,
} from '../coordinates-core';
import { NUM_DATA } from '../data/numerology-content';
import { citationsForClaim } from '../data/bibliography';
import { svgToPngBlob, printSvgPdf, downloadBlob, shareSvg } from './artefact';

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
  /** Records a located outcome signal, the spine of the measurable impact model. */
  recordSignal?: (s: VesselSignal) => void;
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
  sources: string[];
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

  const srcSet: string[] = [];
  const seen = new Set<string>();
  for (const claim of ['numerology_day_quality', 'dreamspell_count', 'lunar_phase_timing', 'pacing_circadian']) {
    for (const c of citationsForClaim(claim)) { if (!c.counterweight && c.display && !seen.has(c.display)) { seen.add(c.display); srcSet.push(c.display); break; } }
  }
  const sources = srcSet.slice(0, 5);

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
    sources,
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

const W = 720;
const PAD = 56;

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

function txt(lines: string[], x: number, y: number, size: number, colour: string, lineH: number, font: string, opts?: { italic?: boolean; anchor?: string; spacing?: number; weight?: string }): string {
  const o = opts || {};
  const a = o.anchor ? ' text-anchor="' + o.anchor + '"' : '';
  const it = o.italic ? ' font-style="italic"' : '';
  const ls = o.spacing != null ? ' letter-spacing="' + o.spacing + '"' : '';
  const wt = o.weight ? ' font-weight="' + o.weight + '"' : '';
  const ts = lines.map((ln, i) => '<tspan x="' + x + '" dy="' + (i === 0 ? 0 : lineH) + '">' + esc(ln) + '</tspan>').join('');
  return '<text x="' + x + '" y="' + y + '"' + a + it + ls + wt + ' font-family="' + font + '" font-size="' + size + '" fill="' + colour + '">' + ts + '</text>';
}

const FONT = { sans: 'Helvetica Neue, Helvetica, Arial, sans-serif', serif: 'EB Garamond, Georgia, serif', caps: 'Cinzel, Georgia, serif' };

/* canonical palette, with a touch more contrast for the parchment body */
const C = {
  page: '#031831', panel: '#0D1E33', raised: '#13284A', raised2: '#192E4A',
  gold: '#C9A050', goldBright: '#E8C878', rule: '#BFA363', teal: '#81CDB6',
  text: '#F2EAD3', dim: '#C9BDA1', faint: '#8C826C', master: '#C8A0FF', glow: '#1A3658',
};

function capLabel(text: string, cx: number, y: number, colour: string): string {
  return txt([text.toUpperCase()], cx, y, 12, colour, 0, FONT.caps, { anchor: 'middle', spacing: 4 });
}
function moonGlyph(cx: number, cy: number): string {
  return '<circle cx="' + cx + '" cy="' + cy + '" r="9" fill="' + C.goldBright + '" opacity="0.92"/>'
    + '<ellipse cx="' + (cx + 5) + '" cy="' + cy + '" rx="4.2" ry="9" fill="' + C.page + '" opacity="0.5"/>';
}
function arrowNE(x: number, y: number, colour: string): string {
  return '<path d="M' + x + ',' + y + ' L' + (x + 9) + ',' + (y - 9) + '" stroke="' + colour + '" stroke-width="1.3" stroke-linecap="round"/>'
    + '<path d="M' + (x + 3.5) + ',' + (y - 9) + ' L' + (x + 9) + ',' + (y - 9) + ' L' + (x + 9) + ',' + (y - 3.5) + '" stroke="' + colour + '" stroke-width="1.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
}
function starGlyph(cx: number, cy: number, r: number, colour: string): string {
  let pts = '';
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const rr = (i % 2 === 0) ? r : r * 0.42; pts += (cx + rr * Math.cos(a)).toFixed(1) + ',' + (cy + rr * Math.sin(a)).toFixed(1) + ' '; }
  return '<polygon points="' + pts.trim() + '" fill="' + colour + '"/>';
}
function ruleLine(y: number, x1: number, x2: number, op: number): string {
  return '<line x1="' + x1 + '" y1="' + y + '" x2="' + x2 + '" y2="' + y + '" stroke="' + C.rule + '" stroke-opacity="' + op + '"/>';
}

export function buildCardSVG(m: CardModel, _lens: Lens, sel: 'morning' | 'afternoon' | 'evening'): string {
  const L = new Layout();
  const inner = W - PAD * 2;
  const cx = W / 2;
  const wSans = Math.floor(inner / 10.2);
  const wSerif = Math.floor(inner / 11.4);

  // header, set in the glow
  L.add('', 68);
  L.add(txt([(m.weekday + '  \u00b7  ' + m.dateLong).toUpperCase()], cx, L.y, 17, C.goldBright, 0, FONT.caps, { anchor: 'middle', spacing: 5 }), 30);
  if (m.place) L.add(txt([m.place.toUpperCase()], cx, L.y, 11, C.faint, 0, FONT.caps, { anchor: 'middle', spacing: 3 }), 0);
  L.add('', 40);
  L.add(ruleLine(L.y, PAD, W - PAD, 0.35), 54);

  // reflection (tappable)
  const reflWindow = m.windows.find((w) => w.key === sel);
  const reflText = reflWindow ? reflWindow.reflection : computedReflection(sel, m.personalDay ? m.personalDay.value : 1);
  const reflLines = wrap(reflText, wSans);
  const reflPrompt = 'It is ' + sel + '. Read me my ' + sel + ' reflection in depth for today.';
  const rlHalf = (sel + ' reflection').length * 5.7;
  L.add('<g class="ctap" style="cursor:pointer" data-prompt="' + esc(reflPrompt) + '">', 0);
  L.add(moonGlyph(cx - rlHalf - 14, L.y - 4), 0);
  L.add(capLabel(sel + ' Reflection', cx, L.y, C.teal), 40);
  L.add(txt(reflLines, PAD, L.y, 19, C.text, 31, FONT.sans), reflLines.length * 31 + 14);
  const cueW = 'Ask the Oracle'.length * 6.7;
  L.add(arrowNE(W - PAD - cueW - 14, L.y, C.teal) + txt(['Ask the Oracle'], W - PAD, L.y, 14, C.teal, 0, FONT.serif, { anchor: 'end', italic: true }), 36);
  L.add('</g>', 0);
  L.add(ruleLine(L.y, cx - 80, cx + 80, 0.22) + '<circle cx="' + cx + '" cy="' + L.y + '" r="2.5" fill="' + C.gold + '"/>', 50);

  // For Today, the hold
  const ftLines = wrap(m.forToday, wSerif);
  L.add(capLabel('For Today', cx, L.y, C.teal), 42);
  L.add(txt(ftLines, cx, L.y, 22, C.text, 35, FONT.serif, { anchor: 'middle' }), ftLines.length * 35 + 46);

  // Personal Day panel (tappable)
  if (m.personalDay) {
    const pd = m.personalDay;
    const meaningLines = wrap(pd.meaning, Math.floor((inner - 96) / 7.4));
    const panelH = Math.max(122, 74 + meaningLines.length * 22);
    const top = L.y;
    const numColour = pd.master ? C.master : C.gold;
    const ccx = PAD + 10, ccy = top + panelH / 2;
    const tx = PAD + 62;
    L.add('<rect x="' + (PAD - 22) + '" y="' + top + '" width="' + (inner + 44) + '" height="' + panelH + '" rx="13" fill="' + C.raised + '"/>', 0);
    L.add('<circle cx="' + ccx + '" cy="' + ccy + '" r="27" fill="none" stroke="' + numColour + '" stroke-opacity="0.55"/>', 0);
    L.add(txt([String(pd.value)], ccx, ccy + 9, 24, numColour, 0, FONT.serif, { anchor: 'middle' }), 0);
    L.add(txt(['PERSONAL DAY ' + pd.value], tx, top + 34, 11, C.faint, 0, FONT.caps, { spacing: 3 }), 0);
    L.add(txt([pd.name], tx, top + 60, 19, numColour, 0, FONT.serif), 0);
    L.add(txt(meaningLines, tx, top + 84, 14, C.dim, 21, FONT.sans), 0);
    L.add('<g class="ctap" style="cursor:pointer" data-prompt="' + esc('My Personal Day is ' + pd.value + ', ' + pd.name + '. What does this energy ask of me today.') + '"><rect x="' + (PAD - 22) + '" y="' + top + '" width="' + (inner + 44) + '" height="' + panelH + '" rx="13" fill="transparent"/>' + arrowNE(W - PAD - 32, top + 34, C.teal) + '<text x="' + (W - PAD) + '" y="' + (top + 34) + '" text-anchor="end" font-family="' + FONT.serif + '" font-style="italic" font-size="13" fill="' + C.teal + '">' + esc('Ask') + '</text></g>', 0);
    L.add('', panelH + 28);
  }

  // Lunar | Dreamspell, two columns
  {
    const gap = 22;
    const panelW = (inner + 44 - gap) / 2;
    const top = L.y;
    const colH = 134;
    const xL = PAD - 22;
    const xR = xL + panelW + gap;
    const px = 20;
    L.add('<rect x="' + xL + '" y="' + top + '" width="' + panelW + '" height="' + colH + '" rx="13" fill="' + C.raised + '"/>', 0);
    L.add('<rect x="' + xR + '" y="' + top + '" width="' + panelW + '" height="' + colH + '" rx="13" fill="' + C.raised + '"/>', 0);
    // lunar
    L.add(txt(['LUNAR PHASE'], xL + px, top + 28, 11, C.teal, 0, FONT.caps, { spacing: 2 }), 0);
    L.add(moonGlyph(xL + px + 8, top + 56), 0);
    L.add(txt([m.lunar.phase], xL + px + 26, top + 61, 17, C.text, 0, FONT.serif), 0);
    const moonSub = (m.lunar.sign ? m.lunar.sign + ' \u00b7 ' : '') + 'Day ' + m.lunar.age + ' \u00b7 ' + m.lunar.daysToNew + 'd to New Moon';
    L.add(txt(wrap(moonSub, Math.floor((panelW - px * 2) / 6.4)), xL + px, top + 86, 12.5, C.dim, 18, FONT.sans), 0);
    if (m.lunar.black) L.add(txt(['Black Moon window'], xL + px, top + colH - 14, 12, C.goldBright, 0, FONT.serif, { italic: true }), 0);
    else if (m.lunar.shiva) L.add(txt(['Shiva Moon window'], xL + px, top + colH - 14, 12, C.goldBright, 0, FONT.serif, { italic: true }), 0);
    // dreamspell (tappable)
    L.add(txt(['DREAMSPELL'], xR + px, top + 28, 11, C.teal, 0, FONT.caps, { spacing: 2 }), 0);
    if (m.kin.isGAP) L.add(txt(['PORTAL'], xR + panelW - px, top + 28, 10, C.goldBright, 0, FONT.caps, { anchor: 'end', spacing: 1 }), 0);
    L.add(txt(wrap(m.kin.full, Math.floor((panelW - px * 2) / 6.2)), xR + px, top + 56, 14, C.text, 19, FONT.serif), 0);
    L.add(txt(wrap(m.kin.toneName + ' tone asks: ' + m.kin.hook + '.', Math.floor((panelW - px * 2) / 6.4)), xR + px, top + 98, 12.5, C.dim, 17, FONT.sans), 0);
    L.add('<g class="ctap" style="cursor:pointer" data-prompt="' + esc('Today is ' + m.kin.full + '. What does this Kin mean for me today.') + '"><rect x="' + xR + '" y="' + top + '" width="' + panelW + '" height="' + colH + '" rx="13" fill="transparent"/></g>', 0);
    L.add('', colH + 30);
  }

  // Three windows row (tappable)
  if (m.windows.length === 3) {
    L.add(capLabel('The day in three windows', cx, L.y, C.faint), 30);
    const rowTop = L.y;
    const gap = 16;
    const colW = (inner + 44 - gap * 2) / 3;
    const rowH = 120;
    m.windows.forEach((w, i) => {
      const x = (PAD - 22) + i * (colW + gap);
      const numColour = w.master ? C.master : C.gold;
      L.add('<rect x="' + x + '" y="' + rowTop + '" width="' + colW + '" height="' + rowH + '" rx="11" fill="' + C.raised + '"/>', 0);
      L.add(txt([w.key.toUpperCase()], x + 16, rowTop + 26, 10, C.faint, 0, FONT.caps, { spacing: 2 }), 0);
      L.add(txt([w.layer], x + 16, rowTop + 44, 10.5, C.faint, 0, FONT.sans), 0);
      L.add(txt([String(w.value)], x + 16, rowTop + 76, 24, numColour, 0, FONT.serif), 0);
      if (w.master) L.add(starGlyph(x + 16 + String(w.value).length * 14 + 9, rowTop + 68, 6, numColour), 0);
      L.add(txt(wrap(w.name, Math.floor((colW - 32) / 6.4)), x + 16, rowTop + 100, 13, C.text, 16, FONT.sans), 0);
      L.add('<g class="ctap" style="cursor:pointer" data-prompt="' + esc(w.layer + ' is ' + w.value + ', ' + w.name + '. What does this ask of my ' + w.key + ' today.') + '"><rect x="' + x + '" y="' + rowTop + '" width="' + colW + '" height="' + rowH + '" rx="11" fill="transparent"/></g>', 0);
    });
    L.add('', rowH + 32);
  }

  // Planetary weather
  if (m.planets.length) {
    L.add(capLabel('Planetary weather', cx, L.y, C.teal), 36);
    m.planets.forEach((p, i) => {
      const ry = L.y + i * 30;
      L.add(txt([p.body.toUpperCase()], PAD, ry, 11, C.faint, 0, FONT.caps, { spacing: 2 }), 0);
      L.add(txt([(p.degree ? p.degree.toFixed(1) + '\u00b0 ' : '') + p.sign], PAD + 150, ry, 15, C.text, 0, FONT.serif), 0);
      if (i < m.planets.length - 1) L.add(ruleLine(ry + 12, PAD, W - PAD, 0.12), 0);
    });
    L.add('', m.planets.length * 30 + 18);
  }

  // Fixed signature
  {
    L.add(ruleLine(L.y, PAD, W - PAD, 0.3), 30);
    if (m.signature.name) L.add(txt([m.signature.name], cx, L.y, 18, C.gold, 0, FONT.serif, { anchor: 'middle' }), 36);
    const half = inner / 2;
    if (m.signature.lifePath) {
      const lp = m.signature.lifePath; const cc = lp.master ? C.master : C.gold;
      L.add(txt(['LIFE PATH'], PAD, L.y, 10, C.faint, 0, FONT.caps, { spacing: 2 }), 0);
      L.add(txt(['PERSONAL YEAR'], PAD + half, L.y, 10, C.faint, 0, FONT.caps, { spacing: 2 }), 22);
      const y0 = L.y;
      L.add(txt([String(lp.value)], PAD, y0, 24, cc, 0, FONT.serif), 0);
      if (lp.master) L.add(starGlyph(PAD + String(lp.value).length * 14 + 10, y0 - 8, 6, cc), 0);
      if (m.signature.personalYear) {
        const py = m.signature.personalYear; const pc = py.master ? C.master : C.gold;
        L.add(txt([String(py.value)], PAD + half, y0, 24, pc, 0, FONT.serif), 0);
        if (py.master) L.add(starGlyph(PAD + half + String(py.value).length * 14 + 10, y0 - 8, 6, pc), 0);
      }
      L.add('', 26);
      L.add(txt([lp.name], PAD, L.y, 13, C.dim, 0, FONT.sans), 0);
      if (m.signature.personalYear) L.add(txt([m.signature.personalYear.name], PAD + half, L.y, 13, C.dim, 0, FONT.sans), 28); else L.add('', 28);
    }
    if (m.signature.birthKin) {
      L.add(txt(['BIRTH KIN'], cx, L.y, 10, C.faint, 0, FONT.caps, { anchor: 'middle', spacing: 2 }), 22);
      L.add(txt([m.signature.birthKin.full], cx, L.y, 14, C.text, 0, FONT.serif, { anchor: 'middle' }), 30);
    }
  }

  // Final message
  {
    const fmLines = wrap(m.finalMessage, Math.floor(inner / 9.8));
    L.add(ruleLine(L.y, cx - 110, cx + 110, 0.28), 34);
    L.add(txt(fmLines, cx, L.y, 15.5, C.dim, 24, FONT.serif, { anchor: 'middle', italic: true }), fmLines.length * 24 + 30);
  }

  // closing epigraph, a maxim on the keel
  {
    L.add('<circle cx="' + cx + '" cy="' + (L.y - 6) + '" r="1.6" fill="' + C.gold + '"/>', 18);
    L.add(txt(['Your life is what your thoughts make it.'], cx, L.y, 14.5, C.dim, 0, FONT.serif, { anchor: 'middle', italic: true }), 22);
    L.add(txt(['MARCUS AURELIUS'], cx, L.y, 9.5, C.faint, 0, FONT.caps, { anchor: 'middle', spacing: 3 }), 30);
  }

  // sources, quiet, tied to the bibliography
  if (m.sources.length) {
    const src = 'Grounded in ' + m.sources.slice(0, 5).join(', ');
    const srcLines = wrap(src, Math.floor(inner / 6.2));
    L.add(txt(srcLines, cx, L.y, 10.5, C.faint, 15, FONT.sans, { anchor: 'middle' }), srcLines.length * 15 + 24);
  }

  // footer mark
  L.add('<circle cx="' + (cx - 12) + '" cy="' + (L.y + 4) + '" r="6.5" fill="none" stroke="' + C.rule + '" stroke-width="1.2"/><circle cx="' + (cx + 12) + '" cy="' + (L.y + 4) + '" r="6.5" fill="none" stroke="' + C.rule + '" stroke-width="1.2"/>', 28);
  L.add(txt(['COSMICDAILYPLANNER.COM'], cx, L.y, 10, C.faint, 0, FONT.caps, { anchor: 'middle', spacing: 3 }), 36);

  const stars = [[58,42],[150,92],[300,54],[430,104],[560,70],[662,120],[96,150],[505,140],[640,38],[214,128],[372,150],[700,86],[44,108],[600,150],[260,40]]
    .map((p) => '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (0.8 + ((p[0] * p[1]) % 5) / 5) + '" fill="' + C.text + '" opacity="' + (0.1 + ((p[0] + p[1]) % 6) / 60) + '"/>').join('');
  const horizon = '';
  const H = Math.round(L.y);
  const defs = '<defs>'
    + '<linearGradient id="cardbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + C.panel + '"/><stop offset="0.14" stop-color="' + C.page + '"/><stop offset="1" stop-color="' + C.page + '"/></linearGradient>'
    + '<radialGradient id="cardglow" cx="50%" cy="0%" r="70%"><stop offset="0" stop-color="' + C.glow + '" stop-opacity="0.85"/><stop offset="1" stop-color="' + C.page + '" stop-opacity="0"/></radialGradient>'
    + '</defs>';
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" font-family="' + FONT.serif + '">'
    + defs
    + '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="url(#cardbg)"/>'
    + '<rect x="0" y="0" width="' + W + '" height="240" fill="url(#cardglow)"/>'
    + '<rect x="0" y="0" width="' + W + '" height="2.5" fill="' + C.goldBright + '" opacity="0.5"/>'
    + stars + horizon
    + '<rect x="7" y="7" width="' + (W - 14) + '" height="' + (H - 14) + '" rx="16" fill="none" stroke="' + C.rule + '" stroke-opacity="0.22"/>'
    + L.parts.join('')
    + '</svg>';
}


/* ============================================================================
 * Save and share. The card image is the SVG above, rasterised for keeping and
 * sharing, and printed as a vector PDF. This is the headline capability. The
 * pipeline (svgToPngBlob, printSvgPdf, downloadBlob, shareSvg) is the shared
 * one in artefact.ts, so the card, the Cosmic Signature, and the prose surfaces
 * leave the device by one road and a fix in one place fixes all of them.
 * ========================================================================== */


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
.cdp-surface .card-voice button { background:none; border:none; color:var(--text-muted, #D4C8AE); font-family:Cinzel, Georgia, serif; font-size:11px; letter-spacing:.1em; text-transform:uppercase; padding:7px 12px; cursor:pointer; }
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
.cdp-surface .card-dd-foot { display:flex; gap:8px; padding:12px 14px; border-top:1px solid rgba(191,163,99,.22); background:var(--panel-deep, #031831); }
.cdp-surface .card-dd-in { flex:1; resize:none; background:var(--card, #122440); border:1px solid rgba(191,163,99,.3); border-radius:6px; color:var(--text-light, #F0E6CC); font-family:Georgia, serif; font-size:14px; padding:9px 11px; line-height:1.5; }
.cdp-surface .card-dd-in:focus { outline:none; border-color:var(--gold, #C9A050); }
.cdp-surface .card-dd-ask { background:none; border:1px solid var(--gold, #C9A050); color:var(--gold, #C9A050); font-family:Cinzel, Georgia, serif; font-size:11px; letter-spacing:.12em; text-transform:uppercase; padding:0 16px; border-radius:6px; cursor:pointer; }
.cdp-surface .card-src-h { font-family:Cinzel, Georgia, serif; font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:var(--gold, #C9A050); margin:16px 0 2px; }
.cdp-surface .card-src-note { font-family:'EB Garamond', Georgia, serif; font-style:italic; font-size:12px; color:var(--text-faint, #9E9282); margin:0 0 8px; }
.cdp-surface .card-src-line { font-family:Georgia, serif; font-size:12.5px; line-height:1.55; color:var(--text-dim, #D4C8AE); margin:0 0 6px; }
.cdp-surface .card-src-line b { color:var(--text-light, #F0E6CC); font-weight:600; }
.cdp-surface .card-tabs { display:flex; gap:8px; margin:0 0 14px; flex-wrap:wrap; }
.cdp-surface .card-tab { display:flex; align-items:center; gap:8px; background:none; border:1px solid rgba(191,163,99,0.28); border-radius:7px; color:var(--text-faint, #9E9282); font-family:Cinzel, Georgia, serif; font-size:11px; letter-spacing:.14em; text-transform:uppercase; padding:9px 18px; cursor:pointer; transition:color .15s, border-color .15s, background .15s; }
.cdp-surface .card-tab:hover { color:var(--text-dim, #D4C8AE); border-color:rgba(191,163,99,0.5); }
.cdp-surface .card-tab.on { color:var(--gold, #C9A050); border-color:var(--gold, #C9A050); background:rgba(201,160,80,0.08); }
.cdp-surface .card-tab-g { font-size:13px; opacity:.85; }
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
  let selectedWindow: 'morning' | 'afternoon' | 'evening' | null = null;
  const view = el('div', { class: 'card-view', role: 'dialog', 'aria-label': 'Today\u2019s card' });
  const shell = el('div', { class: 'card-shell' });

  const bar = el('div', { class: 'card-bar' });
  bar.appendChild(el('div', { class: 'card-h' }, o.title || 'Today\u2019s card'));
  const closeBtn = el('button', { type: 'button', class: 'card-close', 'aria-label': 'Close' }, '\u00d7');
  bar.appendChild(closeBtn);
  shell.appendChild(bar);

  const tabs = el('div', { class: 'card-tabs' });
  shell.appendChild(tabs);

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

  const landed = el('button', { type: 'button', class: 'card-btn' }, 'This landed');
  if (o.recordSignal) {
    let landedDone = false;
    landed.addEventListener('click', () => {
      if (landedDone) return;
      landedDone = true;
      landed.classList.add('on');
      landed.textContent = 'Noted';
      o.recordSignal!({ at: Date.now(), date: dateStr, kind: 'landed', surface: 'card', voice: lens });
      if (o.reflect) o.reflect('You marked that today landed.');
    });
    tools.appendChild(landed);
  }

  const saveImg = el('button', { type: 'button', class: 'card-btn' }, 'Save image');
  const savePdf = el('button', { type: 'button', class: 'card-btn' }, 'Save PDF');
  const shareBtn = el('button', { type: 'button', class: 'card-btn' }, 'Share');
  const openFull = el('button', { type: 'button', class: 'card-btn' }, 'Open full reading');
  const sourcesBtn = el('button', { type: 'button', class: 'card-btn' }, 'Sources');
  tools.appendChild(saveImg); tools.appendChild(savePdf); tools.appendChild(shareBtn); tools.appendChild(sourcesBtn); tools.appendChild(openFull);
  shell.appendChild(tools);
  view.appendChild(shell);
  o.container.appendChild(view);

  let live = true;
  function close(): void { live = false; if (view.parentNode) view.parentNode.removeChild(view); }
  closeBtn.addEventListener('click', close);
  openFull.addEventListener('click', () => { if (o.onOpenFullReading) o.onOpenFullReading(); });
  sourcesBtn.addEventListener('click', () => { openSources(); });

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
    const order: Array<'morning' | 'afternoon' | 'evening'> = ['morning', 'afternoon', 'evening'];
    const curIdx = order.indexOf(model.currentWindow);
    const available = order.slice(0, curIdx + 1);
    const sel: 'morning' | 'afternoon' | 'evening' = (selectedWindow && available.indexOf(selectedWindow) >= 0) ? selectedWindow : model.currentWindow;
    while (tabs.firstChild) tabs.removeChild(tabs.firstChild);
    const glyph: Record<string, string> = { morning: '\u2600', afternoon: '\u25D0', evening: '\u263E' };
    for (const w of available) {
      const t = el('button', { type: 'button', class: 'card-tab' + (w === sel ? ' on' : '') });
      t.appendChild(el('span', { class: 'card-tab-g' }, glyph[w]));
      t.appendChild(el('span', {}, w.charAt(0).toUpperCase() + w.slice(1)));
      t.addEventListener('click', () => { selectedWindow = w; paint(); });
      tabs.appendChild(t);
    }
    currentSvg = buildCardSVG(model, lens, sel);
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
    const bridge = el('button', { type: 'button', class: 'card-dd-ask', style: 'margin-top:8px;width:100%;background:transparent;border-color:#81CDB6;color:#81CDB6' }, 'Through the other lens');
    bridge.addEventListener('click', () => {
      const other: Lens = lens === 'science' ? 'tradition' : 'science';
      const base = lastPrompt || firstPrompt;
      if (o.recordSignal) o.recordSignal({ at: Date.now(), date: dateStr, kind: 'landed', surface: 'card', voice: other, bridge: true });
      void run(base + ' Show me this same coordinate through the ' + (other === 'science' ? 'science' : 'symbolic') + ' telescope, the other lens on the same sky.', lensName(other));
    });
    panel.appendChild(bridge);
    scrim.appendChild(panel);
    view.appendChild(scrim);

    function closeDD(): void { ddOpen = false; if (scrim.parentNode) scrim.parentNode.removeChild(scrim); }
    x.addEventListener('click', closeDD);
    scrim.addEventListener('click', (e: Event) => { if (e.target === scrim) closeDD(); });

    let busy = false;
    let lastPrompt = '';
    async function run(prompt: string, voiceLabel?: string): Promise<void> {
      const q = prompt.trim();
      if (!q || busy) return;
      lastPrompt = q;
      busy = true; fbtn.setAttribute('disabled', 'disabled');
      thread.appendChild(el('div', { class: 'card-dd-q' }, q));
      const aEl = el('div', { class: 'card-dd-a card-dd-wait' }, 'Composing in the ' + (voiceLabel || lensName(lens)) + ' voice.');
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

  /* ---- the sources panel, the bibliography made reachable from the card --- */
  function openSources(): void {
    if (ddOpen) return;
    ddOpen = true;
    const scrim = el('div', { class: 'card-dd-scrim' });
    const panel = el('div', { class: 'card-dd', role: 'dialog', 'aria-label': 'Sources' });
    const head = el('div', { class: 'card-dd-head' });
    head.appendChild(el('div', { class: 'card-dd-h' }, 'Sources'));
    const x = el('button', { type: 'button', class: 'card-dd-x', 'aria-label': 'Close' }, '\u00d7');
    head.appendChild(x);
    panel.appendChild(head);
    const thread = el('div', { class: 'card-dd-thread' });
    const groups: Array<[string, string, string]> = [
      ['numerology_day_quality', 'Numerology', 'Symbolic, Pythagorean. Master numbers preserved.'],
      ['dreamspell_count', 'Dreamspell and Maya', 'Symbolic. Argueelles 1987, held distinct from the living K\u2019iche\u2019 count.'],
      ['lunar_phase_timing', 'Lunar', 'Astronomical. USNO timestamps authoritative.'],
      ['pacing_circadian', 'Pacing', 'Empirical, circadian. A separate discipline from numerology.'],
    ];
    for (const g of groups) {
      const cites = citationsForClaim(g[0]);
      if (!cites.length) continue;
      thread.appendChild(el('div', { class: 'card-src-h' }, g[1]));
      thread.appendChild(el('div', { class: 'card-src-note' }, g[2]));
      for (const c of cites.slice(0, 6)) {
        const line = el('div', { class: 'card-src-line' });
        line.appendChild(el('b', {}, c.display));
        const tail = (c.title ? ' ' + c.title : '') + (c.journal ? ', ' + c.journal : (c.publisher ? ', ' + c.publisher : '')) + (c.counterweight ? ' (sceptical counterweight)' : '');
        line.appendChild(document.createTextNode(tail));
        thread.appendChild(line);
      }
    }
    panel.appendChild(thread);
    scrim.appendChild(panel);
    view.appendChild(scrim);
    function closeS(): void { ddOpen = false; if (scrim.parentNode) scrim.parentNode.removeChild(scrim); }
    x.addEventListener('click', closeS);
    scrim.addEventListener('click', (e: Event) => { if (e.target === scrim) closeS(); });
  }

  /* ---- save and share ----------------------------------------------------- */
  function flash(btn: HTMLElement, lbl: string): void { const p = btn.textContent || ''; btn.textContent = lbl; window.setTimeout(() => { btn.textContent = p; }, 1600); }
  const fileBase = 'cosmic-card-' + dateStr;
  saveImg.addEventListener('click', () => {
    svgToPngBlob(currentSvg, 2).then((b) => { downloadBlob(b, fileBase + '.png'); flash(saveImg, 'Saved'); if (o.reflect) o.reflect('Today\u2019s card is saved.'); }).catch(() => flash(saveImg, 'Try again'));
  });
  savePdf.addEventListener('click', () => { printSvgPdf(currentSvg, 'Cosmic Daily Planner, ' + dateStr); });
  shareBtn.addEventListener('click', () => {
    shareSvg(currentSvg, fileBase, 'My Cosmic Daily Planner card', () => { if (o.reflect) o.reflect('Today\u2019s card is shared.'); })
      .catch(() => flash(shareBtn, 'Try again'));
  });

  paint();
  if (o.reflect && live) { /* opened, the home need not be told */ }

  return {
    close,
    repaintVoice(l: Lens): void { lens = l; paint(); },
  };
}
