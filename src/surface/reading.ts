/**
 * CDP Vessel, surface layer: the native daily reading.
 *
 * The reading opens full, never blank. Two zones compose it. The computed zone
 * is rendered the instant the reading opens, from the verified core, with no
 * wait on the model: the day coordinates as cards, the today signal, the
 * biorhythms, the universal and personal numerology with the three component
 * energies and the three windows of the day. The composed zone streams in the
 * Oracle prose underneath as the server returns it: the synthesis, the
 * convergence, the lunar and astrology and Dreamspell sections, the pacing kept
 * distinct, and the scholarly sources surfaced quietly. While that composes the
 * computed zone is already there to read, so the page is full from the first
 * moment.
 *
 * The reading can be pre started the instant the app mounts, through the
 * exported prewarmReading, so by the time a person opens it the server job is
 * already composing. Every card and section carries a quiet tap that opens the
 * Compass on that exact coordinate, so the reading is not a static page but the
 * live resource the Compass reasons from. The voice toggle on the home swaps
 * the visible voice in place through repaintVoice with no second round trip.
 *
 * The connectivity seams are unchanged: the start endpoint, the status polling,
 * the voice repaint, the share, the reflect. The endpoint payload and retry are
 * identical to the proven path; pre starting only moves the same start call
 * earlier in time.
 *
 * House style holds here, in code, comments, and visible strings alike: no em
 * dashes, no en dashes, no exclamation marks, and no spaced hyphen patterns.
 */

import type { Lens, VesselSignal } from '../data/model';
import { shareControls } from './share';
import { NUM_DATA } from '../data/numerology-content';
import { NUM_TIME, NUM_NEURO, SEAL_ARCH } from '../data/reading-content';
import {
  kinDescriptor, universalDay, personalNumerology, reduceNumber, lunarWindow,
} from '../coordinates-core';
import {
  citationsForClaim, bibliographyVersion, type ReadingCitation,
} from '../data/bibliography';

/* ---- the minimum birth fields the server reading pipeline reads ----------- */
export interface ReadingProfile {
  birthDate?: string;
  birthTime?: string;
  birthPlace?: string;
  name?: string;
}

export interface OpenReadingOptions {
  /** Where to append the overlay. The Vessel passes its surface element. */
  container: HTMLElement;
  /** Reads the current voice so the first paint matches the home toggle. */
  getLens: () => Lens;
  /** Supplies the birth fields, or null when the person has not set them. */
  getProfile: () => ReadingProfile | null;
  /** The reading tier. Standard maps to oracle, the full depth. */
  tier?: string;
  /** The signed in user id, when known, for server side continuity. */
  userId?: string | null;
  /** The date to read, as YYYY-MM-DD in UTC. Defaults to today. */
  date?: string;
  /** API base. Empty string means relative, which the alpha proxy forwards. */
  base?: string;
  /** Overlay heading. */
  title?: string;
  /** A place name for the date line, when the host knows it. */
  location?: string;
  /** Called when the reading completes, so the home can show a quiet trace. */
  reflect?: (note: string) => void;
  /**
   * Opens the Compass on a coordinate. Wired by the host to the same ask path
   * the home uses, so a tap on any card or section continues in the Compass
   * with that exact context. When absent, the taps are simply not shown.
   */
  ask?: (prompt: string) => void;
  /**
   * Composes the Compass answer in place and returns it, so a tap opens a
   * popup over the reading rather than leaving for the home Compass. Preferred
   * over ask when present. The reading stays underneath, so closing the popup
   * returns here, and it takes follow up questions.
   */
  composeAsk?: (prompt: string) => Promise<string>;
  /** Records a located outcome signal, the spine of the measurable impact model. */
  recordSignal?: (s: VesselSignal) => void;
  /**
   * Reads the person's own located signals, the spine of the measurable impact
   * model. When present it powers two reading class moves: a quiet line of
   * recognition on return, and the emergent surface that names the person's own
   * felt patterns as observation rather than forecast, and names the null when
   * there is one. Optional, so the reading is a safe drop in whether or not the
   * host passes it; both moves stay dormant when it is absent.
   */
  getSignals?: () => VesselSignal[];
}

export interface ReadingHandle {
  close(): void;
  repaintVoice(lens: Lens): void;
}

/* ---- tiny local DOM helpers, kept independent of the home module ---------- */
type Attrs = Record<string, string>;
function el(tag: string, attrs: Attrs = {}, text?: string): HTMLElement {
  const node = document.createElement(tag);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  if (text !== undefined) node.textContent = text;
  return node;
}
function clear(node: HTMLElement): void { while (node.firstChild) node.removeChild(node.firstChild); }
function sleep(ms: number): Promise<void> { return new Promise((r) => window.setTimeout(r, ms)); }

/**
 * Split prose into paragraphs. The server collapses internal whitespace when it
 * strips section HTML, so a body often arrives as one long line. Where blank
 * line breaks survive they are honoured; otherwise the line is re segmented by
 * sentence into readable paragraphs. Presentation only; no word is added or lost.
 */
function paragraphs(text: string): string[] {
  const raw = String(text == null ? '' : text);
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (/\n{2,}/.test(trimmed)) {
    return trimmed.split(/\n{2,}/).map((s) => s.trim().replace(/\s+/g, ' ')).filter(Boolean);
  }
  const flat = trimmed.replace(/\s+/g, ' ');
  const sentences = flat.split(/(?<=[.?])\s+(?=[A-Z("'\u2018\u201c])/);
  if (sentences.length <= 3) return [flat];
  const groups: string[] = [];
  for (let i = 0; i < sentences.length; i += 3) {
    groups.push(sentences.slice(i, i + 3).join(' ').trim());
  }
  return groups.filter(Boolean);
}

/* ---- voice normalisation, mirroring the monolith renderVoicedSection ------- */
interface VoiceTriple { tradition: string; science: string; everyday: string; }
type SectionValue = string | Record<string, unknown> | null | undefined;

function normaliseVoice(value: SectionValue): { plain?: string; voiced?: VoiceTriple } | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    const t = value.trim();
    return t ? { plain: t } : null;
  }
  if (typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const hasVoice = ('tradition' in v) || ('science' in v) || ('everyday' in v);
  if (hasVoice) {
    const triple: VoiceTriple = {
      tradition: String(v.tradition || '').trim(),
      science: String(v.science || '').trim(),
      everyday: String(v.everyday || '').trim(),
    };
    if (triple.tradition || triple.science || triple.everyday) return { voiced: triple };
  }
  const body = (v.body || v.text || v.content) as SectionValue;
  if (body) return normaliseVoice(body);
  return null;
}

function pickVoice(t: VoiceTriple, lens: Lens): string {
  const order = lens === 'science' ? [t.science, t.everyday, t.tradition]
    : lens === 'tradition' ? [t.tradition, t.everyday, t.science]
    : [t.everyday, t.tradition, t.science];
  return order.find((x) => x && x.length) || '';
}

function asString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    for (const k of ['headline', 'body', 'text', 'tradition', 'science', 'everyday']) {
      if (typeof o[k] === 'string') return String(o[k]).trim();
    }
  }
  return '';
}

function isRaw(r: Record<string, unknown> | null): boolean {
  if (!r) return true;
  if (r.raw === true) return true;
  if (!r.synthesis && !r.numerology && !r.moon_section && !r.headline) return true;
  const s = String(r.synthesis || '').trim();
  if (s.startsWith('{"')) return true;
  return false;
}

/* ---- small numeric helpers for the computed zone -------------------------- */
function digitSum(s: string): number {
  let n = 0;
  for (const c of s) { if (c >= '0' && c <= '9') n += Number(c); }
  return n;
}
function isMasterNum(n: number): boolean { return n === 11 || n === 22 || n === 33 || n === 44; }
function numName(n: number): string { const m = NUM_DATA[n]; return m ? m.n : ''; }
function numKey(n: number): string { const m = NUM_DATA[n]; return m ? m.k : ''; }
function numMeaning(n: number): string { const m = NUM_DATA[n]; return m ? m.m : ''; }

const MOON_EMOJI: Record<string, string> = {
  'New Moon': '\u{1F311}',
  'Waxing Crescent': '\u{1F312}',
  'First Quarter': '\u{1F313}',
  'Waxing Gibbous': '\u{1F314}',
  'Full Moon': '\u{1F315}',
  'Waning Gibbous': '\u{1F316}',
  'Last Quarter': '\u{1F317}',
  'Waning Crescent': '\u{1F318}',
};

interface BioVal { label: string; pct: number; phase: string; sign: string }
function biorhythms(birthDate: string, dateStr: string): BioVal[] {
  const birth = Date.parse(birthDate + 'T12:00:00Z');
  const target = Date.parse(dateStr + 'T12:00:00Z');
  if (Number.isNaN(birth) || Number.isNaN(target)) return [];
  const days = Math.round((target - birth) / 86400000);
  const cycles = [
    { label: 'Physical', period: 23 },
    { label: 'Emotional', period: 28 },
    { label: 'Intellectual', period: 33 },
  ];
  return cycles.map((c) => {
    const val = Math.sin((2 * Math.PI * days) / c.period);
    const next = Math.sin((2 * Math.PI * (days + 1)) / c.period);
    const pct = Math.round(val * 100);
    const critical = Math.abs(val) < 0.13 || (val >= 0 && next < 0) || (val < 0 && next >= 0);
    const phase = critical ? 'Critical' : pct > 60 ? 'High' : pct > 10 ? 'Rising' : pct > -10 ? 'Transition' : pct > -60 ? 'Falling' : 'Low';
    return { label: c.label, pct, phase, sign: pct > 0 ? '+' : '' };
  });
}

/* ---- symbolic Dreamspell oracle texture, ported from the monolith --------- */
const TONE_HOOKS: Record<string, string> = {
  Magnetic: 'A day of attraction. What you give attention to gathers. Set the intention clearly this morning.',
  Lunar: 'The friction between what you want and what stands in the way is the intelligence of the day, showing you where to direct energy.',
  Electric: 'Something is ready to be activated, a conversation, a decision, a collaboration. Do not hold back what wants to move.',
  'Self-Existing': 'What needs to be defined, planned, or given structure. The day asks for precision.',
  Overtone: 'A call to take command, not of others but of your own direction. The question is what you are the authority on today.',
  Rhythmic: 'A day to create balance, to equalise where there has been too much of one thing.',
  Resonant: 'The inner tuning fork is active. Whatever feels most true right now is the signal to follow.',
  Galactic: 'An alignment check. Whether your actions match your values is the work of the day, walking your talk.',
  Solar: 'Intention becomes pulse. Be deliberate about the energy you send forward today.',
  Planetary: 'Manifestation is high, one of the stronger days for bringing an idea into physical form.',
  Spectral: 'Something may dissolve today, and that is well. The question is what you are ready to release.',
  Crystal: 'Your energy belongs to the collective today. Worth asking who needs what you have to offer.',
  Cosmic: 'Endurance and transcendence. What you have learned in this cycle is ready to be sat with, the wholeness of it.',
};
const SEAL_HOOKS: Record<string, string> = {
  Dragon: 'Primal, nurturing force. Origins, ancestry, and deep care are in focus.',
  Wind: 'What you say today carries unusual weight. Communication is charged.',
  Night: 'The dreaming mind is available. Abundance and deep intuition.',
  Seed: 'Something is germinating. A day to plant, plan, or prepare.',
  Serpent: 'Instinct over analysis. The body knows before the mind does.',
  'World-Bridger': 'A day of crossing over, transformation, the space between what was and what comes next.',
  Hand: 'Healing and completion. A day to finish what matters most.',
  Star: 'Beauty and elegance open doors that logic cannot.',
  Moon: 'Flow is available. Better not to push, to move like water.',
  Dog: 'Loyalty, heart, and love. Worth asking who and what is truly important to you.',
  Monkey: 'Play and illusion. Better not to take anything too seriously, yourself included.',
  Human: 'Free will is in focus. Your choices are especially consequential today.',
  Skywalker: 'Expansion and exploration. A day to widen the horizon, mentally or physically.',
  Wizard: 'Enchantment and receptivity. You carry unusual influence today.',
  Eagle: 'Rise above the immediate. The larger pattern is visible from altitude.',
  Warrior: 'Ask the hard questions. Intelligence and fearlessness are the guides.',
  Earth: 'Trust the signs. Synchronicity is the language of the day.',
  Mirror: 'What the situation is showing you about yourself is the material. Reflection and order.',
  Storm: 'Better not to resist the disruption, it is the intelligence. Transformation is the point.',
  Sun: 'Life force is high. A day to let yourself shine without apology.',
};
function dreamspellHook(dateStr: string): { text: string; isGAP: boolean } {
  try {
    const d = kinDescriptor(dateStr);
    const sealMsg = SEAL_HOOKS[d.seal] || '';
    const toneMsg = TONE_HOOKS[d.toneName] || '';
    let text = [sealMsg, toneMsg].filter(Boolean).join(' ');
    if (d.isGAP) {
      text = (text ? text + ' ' : '')
        + 'Today is a Galactic Activation Portal, a day of heightened sensitivity and unusual synchronicity, worth close attention.';
    }
    return { text, isGAP: d.isGAP };
  } catch (_e) {
    return { text: '', isGAP: false };
  }
}

/* ---- static within section framing, ported and cleaned to house style ----- */
const NUMEROLOGY_HOOK =
  'The Universal Day number is the collective frequency of the date, the energy everyone moves through together. '
  + 'Your Personal Day is where that frequency meets your own numerological signature. '
  + 'The overlap of the two is where the clearest signal of the day tends to sit.';
const TRANSIT_HOOK =
  'Transits are the conversation between today\u2019s sky and your natal chart. '
  + 'The Moon here means where the Moon is in the sky today, not where it was at your birth. '
  + 'When today\u2019s planets touch your natal positions the weather is personal; when they do not, it is still the collective weather, and worth knowing.';
const PACING_HOOK =
  'Pacing is circadian guidance, how attention and energy rise and ebb across the hours, drawn from chronobiology rather than from numerology. '
  + 'The two are kept separate on purpose. '
  + 'The timing here follows the circadian cognition literature, Cajochen et al. 2025 and Schmidt 2007.';
const NATAL_HOOK =
  'This reads the day against the fixed chart you were born under. '
  + 'It deepens once birth time and place are captured; until then it works from the birth date alone.';
const DREAMSPELL_DISCLAIMER =
  'Dreamspell after Argueelles 1987, The Mayan Factor. A modern twentieth century system, '
  + 'distinct from the living K\u2019iche\u2019 Maya count carried continuously by Guatemalan daykeepers.';

function moonHook(phase: string, isBlack: boolean, isShiva: boolean): string {
  const p = String(phase || '');
  if (isBlack) {
    return 'Black Moon day. You are at the most inward point of the lunar cycle, two days before the New Moon. '
      + 'Energy is veiled and intuition is heightened. A day to rest, observe, and let clarity come to you rather than to launch or force.';
  }
  if (isShiva) {
    return 'Shiva Moon day, two days after the New Moon. The new cycle has begun in earnest and your intentions carry momentum now. '
      + 'What you set in motion over the next two days tends to take root.';
  }
  if (p.includes('Full')) {
    return 'The Full Moon illuminates what has been building since the New Moon. '
      + 'Feeling tends to run high, and that is information rather than noise. Something is ready to be seen clearly.';
  }
  if (p.includes('New')) {
    return 'The New Moon is the reset of the cycle. The slate is as clear as it will be for another month. '
      + 'The question worth holding is what you want this cycle to be about.';
  }
  if (p.includes('Waning') || p.includes('Last Quarter')) {
    return 'The Waning Moon supports release, completion, and reflection. '
      + 'Less a time to begin, more a time to clear space for what comes next.';
  }
  if (p.includes('Waxing') || p.includes('Crescent') || p.includes('First Quarter') || p.includes('Gibbous')) {
    return 'The Waxing Moon builds momentum. Whatever was set in motion at the New Moon is growing, '
      + 'and one tangible action today supports it.';
  }
  return 'The Moon shapes emotional tone and instinctive response today. '
    + 'It is the fastest moving body in the sky, changing sign roughly every two and a half days.';
}

/* ---- styles, injected once ------------------------------------------------- */
const STYLE_ID = 'cdp-reading-style';
function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const css = `
.cdp-surface .rdg-view { position:fixed; top:58px; left:0; right:0; bottom:0; z-index:60; background:var(--bg, #0A1828); overflow-y:auto; padding:24px 18px 64px; }
.cdp-surface .rdg-shell { max-width:46rem; margin:0 auto; }
.cdp-surface .rdg-bar { display:flex; align-items:center; justify-content:space-between; margin-bottom:18px; }
.cdp-surface .rdg-h { font-family:Cinzel, Georgia, serif; font-size:13px; letter-spacing:0.16em; text-transform:uppercase; color:var(--gold); }
.cdp-surface .rdg-close { background:none; border:none; cursor:pointer; color:var(--text-dim); font-size:22px; line-height:1; padding:4px 8px; }
.cdp-surface .rdg-close:hover { color:var(--gold); }
.cdp-surface .rdg-status { font-family:'EB Garamond', Georgia, serif; font-style:italic; font-size:15px; color:var(--text-dim); padding:18px 6px; text-align:center; line-height:1.6; }
.cdp-surface .rdg-note { font-family:Georgia, serif; font-size:13px; color:var(--gold-soft); margin:0 0 18px; }

/* computed zone: telescopes, date, decision tiles, coordinate cards, signal, biorhythms, numerology */
.cdp-surface .rdg-tele { text-align:center; margin:0 0 6px; }
.cdp-surface .rdg-tele-name { font-family:Cinzel, Georgia, serif; font-size:11px; letter-spacing:0.22em; text-transform:uppercase; color:var(--gold-soft, #E8C878); }
.cdp-surface .rdg-tele-sub { font-family:'EB Garamond', Georgia, serif; font-size:13px; color:var(--text-dim, #D4C8AE); margin-top:3px; }
.cdp-surface .rdg-datehead { text-align:center; margin:10px 0 18px; }
.cdp-surface .rdg-eyebrow { font-family:Cinzel, Georgia, serif; font-size:10px; letter-spacing:0.28em; text-transform:uppercase; color:var(--gold, #C9A050); }
.cdp-surface .rdg-date { font-family:'EB Garamond', Georgia, serif; font-size:26px; color:var(--text-light, #F0E6CC); margin:4px 0 2px; }
.cdp-surface .rdg-loc { font-family:Cinzel, Georgia, serif; font-size:10px; letter-spacing:0.18em; text-transform:uppercase; color:var(--text-faint, #9E9282); }
.cdp-surface .rdg-tiles { display:flex; gap:10px; flex-wrap:wrap; margin:0 0 16px; }
.cdp-surface .rdg-tile { flex:1; min-width:200px; text-align:center; background:none; cursor:pointer; border:1px solid var(--gold-line, #3A3320); border-radius:4px; padding:13px 14px; -webkit-appearance:none; appearance:none; }
.cdp-surface .rdg-tile:hover { border-color:var(--gold, #C9A050); }
.cdp-surface .rdg-tile-h { font-family:Cinzel, Georgia, serif; font-size:11px; letter-spacing:0.14em; text-transform:uppercase; color:var(--gold, #C9A050); }
.cdp-surface .rdg-tile-s { font-family:'EB Garamond', Georgia, serif; font-size:12.5px; color:var(--text-dim, #D4C8AE); margin-top:3px; }
.cdp-surface .rdg-coords { display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; margin:0 0 14px; }
.cdp-surface .rdg-coord { text-align:center; border:1px solid var(--gold-line, #3A3320); border-radius:4px; background:rgba(0,0,0,.12); padding:13px 10px; cursor:default; -webkit-appearance:none; appearance:none; }
.cdp-surface .rdg-coord.tap { cursor:pointer; }
.cdp-surface .rdg-coord.tap:hover { border-color:var(--gold, #C9A050); }
.cdp-surface .rdg-coord-l { font-family:Cinzel, Georgia, serif; font-size:9px; letter-spacing:0.16em; text-transform:uppercase; color:var(--text-faint, #9E9282); }
.cdp-surface .rdg-coord-glyph { font-size:22px; line-height:1; margin:8px 0 4px; color:var(--gold, #C9A050); }
.cdp-surface .rdg-coord-glyph.master { color:var(--master, #C8A0FF); }
.cdp-surface .rdg-coord-glyph.teal { color:var(--teal, #81CDB6); }
.cdp-surface .rdg-coord-v { font-family:'EB Garamond', Georgia, serif; font-size:14px; line-height:1.35; color:var(--text-light, #F0E6CC); }
.cdp-surface .rdg-coord-s { font-size:11.5px; color:var(--text-dim, #D4C8AE); margin-top:3px; }
.cdp-surface .rdg-coord-tap { font-size:10px; color:var(--gold, #C9A050); margin-top:7px; letter-spacing:0.04em; }
.cdp-surface .rdg-signal { border-left:2px solid var(--gold, #C9A050); background:rgba(0,0,0,.14); border-radius:0 3px 3px 0; padding:13px 16px; margin:0 0 18px; cursor:default; -webkit-appearance:none; appearance:none; text-align:left; width:100%; box-sizing:border-box; border-top:none; border-right:none; border-bottom:none; }
.cdp-surface .rdg-signal.tap { cursor:pointer; }
.cdp-surface .rdg-signal-l { font-family:Cinzel, Georgia, serif; font-size:9px; letter-spacing:0.2em; text-transform:uppercase; color:var(--text-faint, #9E9282); margin-bottom:6px; }
.cdp-surface .rdg-signal-t { font-family:'EB Garamond', Georgia, serif; font-style:italic; font-size:16px; line-height:1.6; color:var(--text-light, #F0E6CC); }
.cdp-surface .rdg-seclabel { font-family:Cinzel, Georgia, serif; font-size:10px; letter-spacing:0.18em; text-transform:uppercase; color:var(--text-faint, #9E9282); margin:18px 0 10px; }
.cdp-surface .rdg-bio { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin:0 0 8px; }
.cdp-surface .rdg-bio-c { border:1px solid var(--gold-line, #3A3320); border-radius:3px; background:rgba(0,0,0,.12); padding:10px 12px; }
.cdp-surface .rdg-bio-l { font-size:9px; letter-spacing:0.16em; text-transform:uppercase; color:var(--text-faint, #9E9282); margin-bottom:5px; }
.cdp-surface .rdg-bio-v { font-family:'EB Garamond', Georgia, serif; font-size:22px; line-height:1; }
.cdp-surface .rdg-bio-v.pos { color:var(--teal, #81CDB6); }
.cdp-surface .rdg-bio-v.neg { color:#E0A0A0; }
.cdp-surface .rdg-bio-v.crit { color:var(--gold, #C9A050); }
.cdp-surface .rdg-bio-track { height:2px; background:var(--gold-line, #3A3320); border-radius:1px; margin:6px 0; overflow:hidden; }
.cdp-surface .rdg-bio-fill { height:100%; border-radius:1px; }
.cdp-surface .rdg-bio-p { font-size:11px; color:var(--text-dim, #D4C8AE); }
.cdp-surface .rdg-energies { display:flex; gap:10px; flex-wrap:wrap; margin:4px 0 14px; }
.cdp-surface .rdg-energy { flex:1; min-width:150px; border:1px solid var(--gold-line, #3A3320); border-radius:3px; padding:11px 13px; background:rgba(0,0,0,.12); cursor:default; -webkit-appearance:none; appearance:none; text-align:left; box-sizing:border-box; }
.cdp-surface .rdg-energy.tap { cursor:pointer; }
.cdp-surface .rdg-energy.tap:hover { border-color:var(--gold, #C9A050); }
.cdp-surface .rdg-energy-layer { font-family:Cinzel, Georgia, serif; font-size:9px; letter-spacing:0.16em; text-transform:uppercase; color:var(--text-faint, #9E9282); }
.cdp-surface .rdg-energy-sub { font-size:11.5px; color:var(--text-dim, #D4C8AE); margin-top:1px; }
.cdp-surface .rdg-energy-num { font-family:'EB Garamond', Georgia, serif; font-size:30px; line-height:1.05; color:var(--gold, #C9A050); margin:6px 0 2px; }
.cdp-surface .rdg-energy-num.master { color:var(--master, #C8A0FF); }
.cdp-surface .rdg-energy-name { font-family:'EB Garamond', Georgia, serif; font-size:15px; color:var(--text-light, #F0E6CC); }
.cdp-surface .rdg-energy-key { font-size:11px; color:var(--gold-soft, #E8C878); margin:2px 0 5px; }
.cdp-surface .rdg-energy-guide { font-family:Georgia, serif; font-size:12px; line-height:1.6; color:var(--text-dim, #D4C8AE); }
.cdp-surface .rdg-symbolic { font-family:Georgia, serif; font-size:12.5px; line-height:1.6; color:var(--text-dim, #D4C8AE); margin:0 0 10px; }
.cdp-surface .rdg-rule { height:1px; background:var(--gold-line, #3A3320); margin:22px 0 16px; border:none; }

/* composed (streamed) zone */
.cdp-surface .rdg-headline { font-family:'EB Garamond', Georgia, serif; font-size:21px; line-height:1.45; color:var(--text-light); margin:0 0 22px; }
.cdp-surface .rdg-card { border:1px solid var(--gold-line); border-radius:3px; margin-bottom:14px; background:var(--navy, #0D1E33); overflow:hidden; }
.cdp-surface .rdg-card.rdg-lead { border-color:transparent; background:none; }
.cdp-surface .rdg-head { width:100%; display:flex; align-items:center; justify-content:space-between; background:none; border:none; cursor:pointer; padding:14px 16px; text-align:left; }
.cdp-surface .rdg-card.rdg-lead .rdg-head { padding:6px 0; cursor:default; }
.cdp-surface .rdg-title { font-family:Cinzel, Georgia, serif; font-size:11px; letter-spacing:0.14em; text-transform:uppercase; color:var(--gold); }
.cdp-surface .rdg-caret { color:var(--text-faint); font-size:12px; transition:transform .2s; }
.cdp-surface .rdg-card.open .rdg-caret { transform:rotate(90deg); }
.cdp-surface .rdg-card.rdg-lead .rdg-caret { display:none; }
.cdp-surface .rdg-body { padding:0 16px 16px; display:none; }
.cdp-surface .rdg-card.rdg-lead .rdg-body { padding:0; }
.cdp-surface .rdg-card.open .rdg-body { display:block; }
.cdp-surface .rdg-p { font-family:Georgia, serif; font-size:15px; line-height:1.7; color:var(--text-light); margin:0 0 12px; }
.cdp-surface .rdg-p:last-child { margin-bottom:0; }
.cdp-surface .rdg-card.rdg-lead .rdg-body .rdg-p { font-family:'EB Garamond', Georgia, serif; font-style:italic; font-size:18px; line-height:1.6; color:var(--gold-soft); }
.cdp-surface .rdg-closing { font-family:'EB Garamond', Georgia, serif; font-style:italic; font-size:17px; line-height:1.55; color:var(--gold-soft); margin:22px 2px 0; text-align:center; }
.cdp-surface .rdg-subhead { font-family:'EB Garamond', Georgia, serif; font-size:17px; line-height:1.4; color:var(--gold-soft, #E8C878); margin:0 16px 8px; }
.cdp-surface .rdg-card.open .rdg-subhead { margin-top:2px; }
.cdp-surface .rdg-hook { font-family:Georgia, serif; font-size:13.5px; line-height:1.65; color:var(--text-dim, #D4C8AE); margin:0 16px 12px; }
.cdp-surface .rdg-dshook { font-family:'EB Garamond', Georgia, serif; font-size:14px; line-height:1.65; color:var(--text-light, #F0E6CC); margin:0 16px 12px; }
.cdp-surface .rdg-badges { display:flex; flex-wrap:wrap; gap:8px; margin:0 16px 10px; }
.cdp-surface .rdg-badge { font-family:Cinzel, Georgia, serif; font-size:10px; letter-spacing:.1em; text-transform:uppercase; padding:4px 9px; border-radius:2px; border:1px solid var(--gold-line, #3A3320); }
.cdp-surface .rdg-badge.black { color:#C8A0FF; border-color:rgba(200,160,255,.5); }
.cdp-surface .rdg-badge.shiva { color:var(--teal, #81CDB6); border-color:rgba(129,205,182,.5); }
.cdp-surface .rdg-badge.portal { color:var(--gold, #C9A050); border-color:rgba(201,160,80,.5); }
.cdp-surface .rdg-backdrop { border-left:2px solid var(--gold-line, #3A3320); margin:4px 16px 12px; padding:8px 0 8px 14px; }
.cdp-surface .rdg-backdrop .rdg-backdrop-label { font-family:Cinzel, Georgia, serif; font-size:10px; letter-spacing:.12em; text-transform:uppercase; color:var(--text-faint, #9E9282); margin-bottom:5px; }
.cdp-surface .rdg-backdrop p { font-family:Georgia, serif; font-size:14px; line-height:1.7; color:var(--text-dim, #D4C8AE); margin:0; }
.cdp-surface .rdg-disclaimer { font-family:Georgia, serif; font-size:13px; line-height:1.65; color:var(--text-dim, #D4C8AE); margin:8px 16px 0; padding-top:10px; border-top:1px solid var(--gold-line, #3A3320); }
.cdp-surface .rdg-ask { background:none; border:1px solid var(--gold-line, #3A3320); color:var(--gold, #C9A050); font-family:'EB Garamond', Georgia, serif; font-size:12px; letter-spacing:.06em; padding:7px 13px; border-radius:2px; cursor:pointer; margin:2px 16px 14px; -webkit-appearance:none; appearance:none; }
.cdp-surface .rdg-ask:hover { border-color:var(--gold, #C9A050); color:var(--gold-soft, #E8C878); }
.cdp-surface .rdg-cites { display:flex; flex-wrap:wrap; gap:6px; margin:4px 16px 14px; }
.cdp-surface .rdg-cite { background:none; border:1px solid var(--gold-line, #3A3320); color:var(--text-dim, #D4C8AE); font-family:Georgia, serif; font-size:10px; padding:3px 8px; border-radius:10px; cursor:pointer; }
.cdp-surface .rdg-cite:hover { color:var(--gold-soft, #E8C878); border-color:var(--gold, #C9A050); }
.cdp-surface .rdg-cite-detail { font-family:Georgia, serif; font-size:11px; line-height:1.6; color:var(--text-dim, #D4C8AE); margin:0 16px 14px; padding:9px 12px; border:1px solid var(--gold-line, #3A3320); border-radius:3px; background:rgba(0,0,0,.14); display:none; }
.cdp-surface .rdg-cite-detail.open { display:block; }
.cdp-surface .rdg-cite-detail .rdg-cite-title { color:var(--text-light, #F0E6CC); }
.cdp-surface .rdg-sources { margin:22px 0 0; }
.cdp-surface .rdg-sources-toggle { background:none; border:none; cursor:pointer; font-family:Cinzel, Georgia, serif; font-size:11px; letter-spacing:.16em; text-transform:uppercase; color:var(--text-dim, #D4C8AE); padding:6px 0; display:flex; align-items:center; gap:8px; }
.cdp-surface .rdg-sources-toggle:hover { color:var(--gold-soft, #E8C878); }
.cdp-surface .rdg-sources-caret { font-size:11px; transition:transform .2s; }
.cdp-surface .rdg-sources.open .rdg-sources-caret { transform:rotate(90deg); }
.cdp-surface .rdg-sources-body { display:none; margin-top:8px; }
.cdp-surface .rdg-sources.open .rdg-sources-body { display:block; }
.cdp-surface .rdg-source-line { font-family:Georgia, serif; font-size:12px; line-height:1.7; color:var(--text-dim, #D4C8AE); margin:0 0 7px; }
.cdp-surface .rdg-source-line b { color:var(--text-dim, #D4C8AE); font-weight:600; }
.cdp-surface .rdg-source-note { font-family:Georgia, serif; font-size:12px; line-height:1.7; color:var(--text-dim, #D4C8AE); margin:0 0 8px; }
.cdp-surface .rdg-cite.counter { border-style:dashed; }
.cdp-surface .rdg-cite-tags { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:7px; }
.cdp-surface .rdg-cite-tag { font-family:Cinzel, Georgia, serif; font-size:9px; letter-spacing:.12em; text-transform:uppercase; color:var(--text-dim, #D4C8AE); border:1px solid var(--gold-line, #3A3320); border-radius:2px; padding:2px 6px; }
.cdp-surface .rdg-cite-tag.counter { color:var(--gold-soft, #E8C878); border-color:rgba(201,160,80,.5); }
.cdp-surface .rdg-source-line.counter b { color:var(--gold-soft, #E8C878); }
.cdp-surface .rdg-source-reg { font-family:Cinzel, Georgia, serif; font-size:9px; letter-spacing:.1em; text-transform:uppercase; color:var(--text-dim, #D4C8AE); margin-left:6px; white-space:nowrap; }
.cdp-surface .rdg-source-reg.counter { color:var(--gold-soft, #E8C878); }
.cdp-surface .rdg-source-ver { font-family:Georgia, serif; font-size:12px; line-height:1.65; color:var(--text-dim, #D4C8AE); margin-top:13px; padding-top:10px; border-top:1px solid var(--gold-line, #3A3320); }
.cdp-surface .rdg-dd-scrim { position:fixed; inset:0; background:rgba(3,12,24,.62); z-index:80; display:flex; align-items:flex-end; justify-content:center; }
.cdp-surface .rdg-dd { width:100%; max-width:40rem; max-height:82vh; background:var(--navy, #0D1E33); border:1px solid var(--gold-line, #BFA363); border-bottom:none; border-radius:10px 10px 0 0; box-shadow:0 -10px 40px rgba(0,0,0,.45); display:flex; flex-direction:column; overflow:hidden; }
.cdp-surface .rdg-dd-head { display:flex; align-items:center; justify-content:space-between; padding:14px 18px; border-bottom:1px solid rgba(191,163,99,.22); }
.cdp-surface .rdg-dd-h { font-family:Cinzel, Georgia, serif; font-size:11px; letter-spacing:.18em; text-transform:uppercase; color:var(--gold, #C9A050); }
.cdp-surface .rdg-dd-x { background:none; border:none; color:var(--text-dim, #D4C8AE); font-size:22px; line-height:1; cursor:pointer; padding:0 4px; }
.cdp-surface .rdg-dd-x:hover { color:var(--gold-soft, #E8C878); }
.cdp-surface .rdg-dd-thread { overflow-y:auto; padding:16px 18px; flex:1; }
.cdp-surface .rdg-dd-q { font-family:'EB Garamond', Georgia, serif; font-style:italic; font-size:15px; color:var(--text-dim, #D4C8AE); margin:0 0 8px; }
.cdp-surface .rdg-dd-a { margin:0 0 18px; padding-left:12px; border-left:2px solid var(--gold-line, #BFA363); }
.cdp-surface .rdg-dd-wait { color:var(--text-dim, #D4C8AE); font-family:Georgia, serif; }
.cdp-surface .rdg-dd-p { font-family:Georgia, serif; font-size:15px; line-height:1.7; color:var(--text-light, #F0E6CC); margin:0 0 11px; }
.cdp-surface .rdg-dd-foot { display:flex; gap:8px; padding:12px 14px; border-top:1px solid rgba(191,163,99,.22); background:var(--panel-deep, #0A1828); }
.cdp-surface .rdg-dd-in { flex:1; resize:none; background:var(--card, #122440); border:1px solid rgba(191,163,99,.3); border-radius:6px; color:var(--text-light, #F0E6CC); font-family:Georgia, serif; font-size:14px; padding:9px 11px; line-height:1.5; }
.cdp-surface .rdg-dd-in::placeholder { color:var(--text-faint, #9E9282); }
.cdp-surface .rdg-dd-in:focus { outline:none; border-color:var(--gold, #C9A050); }
.cdp-surface .rdg-dd-ask { background:none; border:1px solid var(--gold, #C9A050); color:var(--gold, #C9A050); font-family:Cinzel, Georgia, serif; font-size:11px; letter-spacing:.12em; text-transform:uppercase; padding:0 16px; border-radius:6px; cursor:pointer; }
.cdp-surface .rdg-dd-ask:hover { background:rgba(201,160,80,.1); }
.cdp-surface .rdg-dd-ask[disabled] { opacity:.5; cursor:default; }
@media (max-width: 640px) {
  .cdp-surface .rdg-coords { grid-template-columns:repeat(2,1fr); }
}
.cdp-surface .rdg-landed { display:inline-flex; align-items:center; gap:7px; cursor:pointer; margin:10px 0 2px; font-family:Georgia, serif; font-size:13px; color:var(--text-dim, #D4C8AE); }
.cdp-surface .rdg-landed .rdg-landed-dot { width:11px; height:11px; border-radius:50%; border:1.2px solid var(--text-dim, #D4C8AE); }
.cdp-surface .rdg-landed.on { color:var(--teal, #81CDB6); }
.cdp-surface .rdg-landed.on .rdg-landed-dot { background:var(--teal, #81CDB6); border-color:var(--teal, #81CDB6); }
.cdp-surface .rdg-bridge { display:flex; flex-wrap:wrap; gap:8px; margin:11px 0 2px; }
.cdp-surface .rdg-bridge-btn { background:none; border:1px solid var(--gold-line, #3A3320); font-family:Cinzel, Georgia, serif; font-size:10px; letter-spacing:.12em; text-transform:uppercase; padding:6px 11px; border-radius:2px; cursor:pointer; -webkit-appearance:none; appearance:none; }
.cdp-surface .rdg-bridge-btn.tradition { color:var(--gold, #C9A050); }
.cdp-surface .rdg-bridge-btn.science { color:var(--teal, #81CDB6); }
.cdp-surface .rdg-bridge-btn:hover, .cdp-surface .rdg-bridge-btn.open { border-color:currentColor; }
.cdp-surface .rdg-bridge-block { margin:9px 0 2px; padding:11px 14px; border-left:2px solid var(--gold-line, #3A3320); border-radius:0 3px 3px 0; background:rgba(0,0,0,.12); }
.cdp-surface .rdg-bridge-block.tradition { border-left-color:var(--gold, #C9A050); }
.cdp-surface .rdg-bridge-block.science { border-left-color:var(--teal, #81CDB6); }
.cdp-surface .rdg-bridge-label { font-family:Cinzel, Georgia, serif; font-size:9px; letter-spacing:.16em; text-transform:uppercase; margin-bottom:6px; }
.cdp-surface .rdg-bridge-block.tradition .rdg-bridge-label { color:var(--gold-soft, #E8C878); }
.cdp-surface .rdg-bridge-block.science .rdg-bridge-label { color:var(--teal, #81CDB6); }
.cdp-surface .rdg-bridge-block .rdg-p { color:var(--text-light, #F0E6CC); }
.cdp-surface .rdg-return { font-family:Georgia, serif; font-size:13px; line-height:1.6; color:var(--text-dim, #D4C8AE); text-align:center; margin:0 0 14px; }
.cdp-surface .rdg-emergent { border:1px solid var(--gold-line, #3A3320); border-radius:4px; background:rgba(0,0,0,.12); padding:14px 16px; margin:14px 0 4px; }
.cdp-surface .rdg-emergent-l { font-family:Cinzel, Georgia, serif; font-size:10px; letter-spacing:.18em; text-transform:uppercase; color:var(--gold, #C9A050); margin-bottom:8px; }
.cdp-surface .rdg-emergent-p { font-family:Georgia, serif; font-size:13.5px; line-height:1.7; color:var(--text-light, #F0E6CC); margin:0 0 8px; }
.cdp-surface .rdg-emergent-p:last-child { margin-bottom:0; }
.cdp-surface .rdg-emergent-p.null { color:var(--text-dim, #D4C8AE); }
.cdp-surface .rdg-win-line { font-family:Georgia, serif; font-size:12.5px; line-height:1.6; margin:8px 0 0; color:var(--text-dim, #D4C8AE); }
.cdp-surface .rdg-win-tag { font-family:Cinzel, Georgia, serif; font-size:9px; letter-spacing:.14em; text-transform:uppercase; margin-bottom:2px; display:block; }
.cdp-surface .rdg-win-tag.tradition { color:var(--gold, #C9A050); }
.cdp-surface .rdg-win-tag.science { color:var(--teal, #81CDB6); }
`;
  const style = el('style', { id: STYLE_ID });
  style.textContent = css;
  document.head.appendChild(style);
}

/* ---- pre start cache: start the job the instant the app opens ------------- */
function startJob(
  base: string, tier: string, dateStr: string,
  prof: ReadingProfile | null, lens: Lens, userId: string | null,
): Promise<string> {
  const profile = prof
    ? { dob: prof.birthDate || null, birthTime: prof.birthTime || null, birthPlace: prof.birthPlace || null, name: prof.name || null, readingLang: lens }
    : { readingLang: lens };
  const payload = JSON.stringify({ date: dateStr, profile, tier, user_id: userId });
  const opts: RequestInit = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload };
  return (async () => {
    let res = await fetch(base + '/api/reading/start', opts);
    if (!res.ok && res.status >= 500) { await sleep(3000); res = await fetch(base + '/api/reading/start', opts); }
    if (!res.ok) throw new Error('start_' + res.status);
    const data = await res.json() as { jobId?: string };
    if (!data.jobId) throw new Error('no_job');
    return data.jobId;
  })();
}

function readingKey(base: string, tier: string, date: string): string { return base + '|' + tier + '|' + date; }

let prewarmCache: { key: string; jobId: Promise<string> } | null = null;

export interface PrewarmOptions {
  base?: string;
  tier?: string;
  date?: string;
  getProfile: () => ReadingProfile | null;
  getLens: () => Lens;
  userId?: string | null;
}

/**
 * Start the reading job the instant the app mounts, so the server is already
 * composing before the person opens the reading. Safe to call repeatedly; it
 * only starts once per date and tier, and it swallows its own errors so a
 * failure here never affects the surface. openReading reuses the in flight job.
 */
export function prewarmReading(po: PrewarmOptions): void {
  try {
    const base = (po.base || '').replace(/\/+$/, '');
    const tier = po.tier || 'oracle';
    const date = po.date || new Date().toISOString().slice(0, 10);
    const key = readingKey(base, tier, date);
    if (prewarmCache && prewarmCache.key === key) return;
    const jobId = startJob(base, tier, date, po.getProfile(), po.getLens(), po.userId || null);
    jobId.catch(() => { /* allow openReading to retry from scratch */ });
    prewarmCache = { key, jobId };
  } catch (_e) {
    // pre start is best effort and silent
  }
}

/* ---- the public entry point ------------------------------------------------ */
export function openReading(o: OpenReadingOptions): ReadingHandle {
  ensureStyle();
  const base = (o.base || '').replace(/\/+$/, '');
  const tier = o.tier || 'oracle';
  const dateStr = o.date || new Date().toISOString().slice(0, 10);
  const ask = o.ask;
  const composeAsk = o.composeAsk;
  const canDeepDive = !!(composeAsk || ask);
  const profile = o.getProfile();

  const view = el('div', { class: 'rdg-view', role: 'dialog', 'aria-label': 'Today\u2019s reading' });
  const shell = el('div', { class: 'rdg-shell' });
  const bar = el('div', { class: 'rdg-bar' });
  bar.appendChild(el('div', { class: 'rdg-h' }, o.title || 'Today\u2019s reading'));
  const closeBtn = el('button', { type: 'button', class: 'rdg-close', 'aria-label': 'Close' }, '\u00d7');
  bar.appendChild(closeBtn);
  shell.appendChild(bar);

  // The computed zone, rendered now, from the verified core. Never blank.
  const computed = el('div', { class: 'rdg-computed' });
  shell.appendChild(computed);

  // A rule between the computed reading and the composed depth.
  const rule = el('hr', { class: 'rdg-rule' });
  shell.appendChild(rule);

  // The composed zone, where the Oracle prose streams in.
  const aiZone = el('div', { class: 'rdg-ai' });
  shell.appendChild(aiZone);
  const status = el('div', { class: 'rdg-status' }, 'The Oracle is composing the full depth of your reading.');
  aiZone.appendChild(status);

  let shareInserted = false;
  function ensureShareBar(): void {
    if (shareInserted) return;
    shareInserted = true;
    const bar2 = shareControls({
      title: o.title || 'Today\u2019s reading',
      text: () => (o.title || 'Today\u2019s reading') + '\n\n' + shell.innerText,
      node: () => shell,
    });
    shell.appendChild(bar2);
  }
  view.appendChild(shell);
  o.container.appendChild(view);

  let live = true;
  function close(): void { live = false; if (view.parentNode) view.parentNode.removeChild(view); }
  closeBtn.addEventListener('click', close);

  function setStatus(text: string): void {
    if (!status.parentNode) aiZone.insertBefore(status, aiZone.firstChild);
    status.textContent = text;
  }

  function lensName(l: Lens): string {
    return l === 'science' ? 'Science' : l === 'everyday' ? 'Everyday' : 'Tradition';
  }

  /* ---- the in place Compass popup, opened over the reading ---------------- *
   * A tap opens this panel over the reading rather than leaving for the home.
   * The reading stays mounted underneath, so closing the panel is the way back,
   * and the follow up input lets the person keep interacting with the answer.  */
  let ddOpen = false;
  function openDeepDive(firstPrompt: string): void {
    if (ddOpen) return;
    ddOpen = true;
    const scrim = el('div', { class: 'rdg-dd-scrim' });
    const panel = el('div', { class: 'rdg-dd', role: 'dialog', 'aria-label': 'Ask the Oracle' });
    const head = el('div', { class: 'rdg-dd-head' });
    head.appendChild(el('div', { class: 'rdg-dd-h' }, 'Ask the Oracle'));
    const x = el('button', { type: 'button', class: 'rdg-dd-x', 'aria-label': 'Close' }, '\u00d7');
    head.appendChild(x);
    panel.appendChild(head);
    const thread = el('div', { class: 'rdg-dd-thread' });
    panel.appendChild(thread);
    const foot = el('div', { class: 'rdg-dd-foot' });
    const fin = el('textarea', { class: 'rdg-dd-in', rows: '1', placeholder: 'Ask a follow up question' }) as HTMLTextAreaElement;
    const fbtn = el('button', { type: 'button', class: 'rdg-dd-ask' }, 'Ask');
    foot.appendChild(fin);
    foot.appendChild(fbtn);
    panel.appendChild(foot);
    const bridge = el('button', { type: 'button', class: 'rdg-dd-ask', style: 'margin-top:8px;width:100%;background:transparent;border-color:#81CDB6;color:#81CDB6' }, 'Through the other telescope');
    bridge.addEventListener('click', () => {
      const home = o.getLens();
      const other: Lens = home === 'science' ? 'tradition' : 'science';
      const base = lastPrompt || firstPrompt;
      if (o.recordSignal) o.recordSignal({ at: Date.now(), date: dateStr, kind: 'landed', surface: 'reading', voice: other, bridge: true });
      void run(base + ' Show me this same coordinate through the ' + (other === 'science' ? 'science' : 'symbolic') + ' telescope, the other lens on the same sky.', lensName(other));
    });
    panel.appendChild(bridge);
    scrim.appendChild(panel);
    view.appendChild(scrim);

    function closeDD(): void { ddOpen = false; if (scrim.parentNode) scrim.parentNode.removeChild(scrim); }
    x.addEventListener('click', closeDD);
    scrim.addEventListener('click', (e: Event) => { if (e.target === scrim) closeDD(); });

    let lastPrompt = '';
    let busy = false;
    async function run(prompt: string, voiceLabel?: string): Promise<void> {
      const q = prompt.trim();
      if (!q || busy) return;
      lastPrompt = q;
      busy = true; fbtn.setAttribute('disabled', 'disabled');
      thread.appendChild(el('div', { class: 'rdg-dd-q' }, q));
      const aEl = el('div', { class: 'rdg-dd-a rdg-dd-wait' }, 'Composing in the ' + (voiceLabel || lensName(o.getLens())) + ' voice.');
      thread.appendChild(aEl);
      panel.scrollTop = panel.scrollHeight;
      try {
        const reply = composeAsk ? await composeAsk(q) : '';
        aEl.classList.remove('rdg-dd-wait');
        clear(aEl);
        const paras = reply.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
        if (paras.length === 0) paras.push((reply || '').trim() || 'The Oracle is still composing. Please try again in a moment.');
        for (const p of paras) aEl.appendChild(el('p', { class: 'rdg-dd-p' }, p));
      } catch (_e) {
        aEl.classList.remove('rdg-dd-wait');
        aEl.textContent = 'The answer hit a snag on the server. Please try again in a moment.';
      } finally {
        busy = false; fbtn.removeAttribute('disabled');
        panel.scrollTop = panel.scrollHeight;
        fin.focus();
      }
    }
    fbtn.addEventListener('click', () => { const t = fin.value; fin.value = ''; void run(t); });
    fin.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); const t = fin.value; fin.value = ''; void run(t); }
    });
    void run(firstPrompt);
    fin.focus();
  }

  /* The tap path. Prefers the in place popup, falls back to the home Compass. */
  function deepDive(prompt: string): void {
    if (composeAsk) { openDeepDive(prompt); return; }
    if (ask) { try { ask(prompt); } catch (_e) { /* host handles */ } }
  }

  /* ---- a quiet tap that opens the Compass on a coordinate ----------------- */
  function askCue(label: string, prompt: string): HTMLElement | null {
    if (!canDeepDive) return null;
    const b = el('button', { type: 'button', class: 'rdg-ask' }, label);
    b.addEventListener('click', () => { deepDive(prompt); });
    return b;
  }

  /* ---- the emergent surface: the person's own marks, read as observation ----
   * Sky Standard move four. From the located signals the person has tapped, the
   * reading names what has been landing most, and through which telescope, as an
   * observation about what reaches them and never as a forecast. When the marks
   * are too few or too evenly spread to carry a pattern, it names that null
   * honestly rather than inventing one. Sky Standard move two, recognition on
   * return, is the quiet line that recalls what last landed. Both stay dormant
   * unless the host supplies getSignals, so the file is a safe drop in either way.
   */
  interface SigAgg {
    total: number;
    byFramework: Record<string, number>;
    byVoice: Record<string, number>;
    bridges: number;
    lastPrior: VesselSignal | null;
  }
  function aggregateSignals(sigs: VesselSignal[]): SigAgg {
    const agg: SigAgg = { total: 0, byFramework: {}, byVoice: {}, bridges: 0, lastPrior: null };
    for (const s of sigs) {
      if (!s || s.kind !== 'landed') continue;
      agg.total += 1;
      if (s.bridge) agg.bridges += 1;
      if (s.framework) agg.byFramework[s.framework] = (agg.byFramework[s.framework] || 0) + 1;
      if (s.voice) agg.byVoice[s.voice] = (agg.byVoice[s.voice] || 0) + 1;
      if (s.date && s.date < dateStr) {
        if (!agg.lastPrior || (s.at || 0) > (agg.lastPrior.at || 0)) agg.lastPrior = s;
      }
    }
    return agg;
  }
  function topOf(rec: Record<string, number>): { key: string; count: number; tied: boolean } {
    let key = ''; let count = 0; let second = 0;
    for (const k in rec) {
      const v = rec[k];
      if (v > count) { second = count; count = v; key = k; }
      else if (v > second) second = v;
    }
    return { key, count, tied: count > 0 && count === second };
  }
  const FRAMEWORK_LABEL: Record<string, string> = {
    numerology: 'numerology', lunar: 'lunar', dreamspell: 'Dreamspell',
    astrology: 'astrology', convergence: 'convergence', pacing: 'pacing',
  };
  function frameworkLabel(k: string): string { return FRAMEWORK_LABEL[k] || k.replace(/_/g, ' '); }
  function voiceLabel(v: string): string { return v === 'science' ? 'science' : v === 'tradition' ? 'tradition' : 'everyday'; }

  function returnLine(agg: SigAgg): HTMLElement | null {
    const p = agg.lastPrior;
    if (!p) return null;
    const where = p.section || (p.framework ? frameworkLabel(p.framework) : 'your reading');
    const via = p.voice ? (' through the ' + voiceLabel(p.voice) + ' telescope') : '';
    return el('div', { class: 'rdg-return' }, 'When you were last here, what landed for you was ' + where + via + '.');
  }
  function emergentPanel(agg: SigAgg): HTMLElement {
    const wrap = el('div', { class: 'rdg-emergent' });
    wrap.appendChild(el('div', { class: 'rdg-emergent-l' }, 'Your own patterns'));
    if (agg.total < 3) {
      wrap.appendChild(el('p', { class: 'rdg-emergent-p null' },
        'Not enough marked yet for a pattern to show. As you tap what lands in a reading, this begins to notice, as an observation about what reaches you and never as a forecast.'));
      return wrap;
    }
    const fw = topOf(agg.byFramework);
    const vc = topOf(agg.byVoice);
    if (!fw.key || fw.tied) {
      wrap.appendChild(el('p', { class: 'rdg-emergent-p null' },
        'What you have marked so far is spread evenly across the frameworks, with no single thread standing out. That even spread is itself honest information, an observation rather than a forecast.'));
    } else {
      let line = 'Across the readings you have marked, what has been landing most is the ' + frameworkLabel(fw.key) + ' thread';
      if (vc.key && !vc.tied) line += ', most often through the ' + voiceLabel(vc.key) + ' telescope';
      line += '. That is an observation about what reaches you, not a forecast.';
      wrap.appendChild(el('p', { class: 'rdg-emergent-p' }, line));
    }
    if (agg.bridges > 0) {
      const n = agg.bridges;
      wrap.appendChild(el('p', { class: 'rdg-emergent-p' },
        'You have crossed to the other telescope ' + n + (n === 1 ? ' time' : ' times') + ', which is where the two readings meet on one coordinate.'));
    }
    return wrap;
  }

  /* ======================================================================== *
   * THE COMPUTED ZONE, rendered immediately from the core
   * ======================================================================== */
  function renderComputed(): void {
    clear(computed);
    const signalsFn = o.getSignals;
    const agg = signalsFn ? aggregateSignals(signalsFn()) : null;

    // Two Telescopes
    const tele = el('div', { class: 'rdg-tele' });
    tele.appendChild(el('div', { class: 'rdg-tele-name' }, 'Two Telescopes'));
    tele.appendChild(el('div', { class: 'rdg-tele-sub' }, 'The oldest traditions and the newest science, the same coordinates'));
    computed.appendChild(tele);

    // date and place
    const dh = el('div', { class: 'rdg-datehead' });
    dh.appendChild(el('div', { class: 'rdg-eyebrow' }, 'Your daily reading'));
    let dateLabel = dateStr;
    try {
      dateLabel = new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    } catch (_e) { /* keep iso */ }
    dh.appendChild(el('div', { class: 'rdg-date' }, dateLabel));
    if (o.location) dh.appendChild(el('div', { class: 'rdg-loc' }, o.location));
    computed.appendChild(dh);

    // recognition on return, the quiet line that recalls what last landed
    if (agg) { const rl = returnLine(agg); if (rl) computed.appendChild(rl); }

    // decision tiles, into the Compass
    if (canDeepDive) {
      const tiles = el('div', { class: 'rdg-tiles' });
      const t1 = el('button', { type: 'button', class: 'rdg-tile' });
      t1.appendChild(el('div', { class: 'rdg-tile-h' }, 'Time a decision'));
      t1.appendChild(el('div', { class: 'rdg-tile-s' }, 'Should I act today, or wait'));
      t1.addEventListener('click', () => { deepDive('I am weighing a decision. Given today\u2019s coordinates, is today a day to act, or to wait, and why.'); });
      const t2 = el('button', { type: 'button', class: 'rdg-tile' });
      t2.appendChild(el('div', { class: 'rdg-tile-h' }, 'Find a best day'));
      t2.appendChild(el('div', { class: 'rdg-tile-s' }, 'When is best this month'));
      t2.addEventListener('click', () => { deepDive('Looking at the month ahead, which days are best for an important undertaking, and which to avoid, and why.'); });
      tiles.appendChild(t1);
      tiles.appendChild(t2);
      computed.appendChild(tiles);
    }

    // compute the day coordinates from the core
    const ud = universalDay(dateStr);
    const kin = kinDescriptor(dateStr);
    const moon = lunarWindow(dateStr);
    const hasBirth = !!(profile && profile.birthDate);
    const pn = hasBirth ? personalNumerology(profile!.birthDate as string, dateStr) : null;
    const lifePath = hasBirth ? reduceNumber(digitSum(profile!.birthDate as string)).value : null;
    const moonEmoji = MOON_EMOJI[moon.phase] || '\u263D';

    // coordinate cards: Personal Day (or Universal Day), Moon, Kin, Life Path
    const coords = el('div', { class: 'rdg-coords' });

    const pdValue = pn ? pn.personalDay.value : ud.value;
    const pdLabel = pn ? 'Personal Day' : 'Universal Day';
    coords.appendChild(coordCard(
      pdLabel,
      isMasterNum(pdValue) ? '\u2605' : String(pdValue),
      isMasterNum(pdValue) ? 'master' : '',
      String(pdValue),
      numName(pdValue),
      ask ? { label: 'Tap for insight', prompt: pdLabel + ' ' + pdValue + ', ' + numName(pdValue) + '. What does this number ask of me today.' } : null,
    ));

    coords.appendChild(coordCard(
      'Moon',
      moonEmoji, 'teal',
      moon.phase,
      moon.black ? 'Black Moon window' : moon.shiva ? 'Shiva Moon window' : (moon.daysToNew + ' days to New'),
      ask ? { label: 'Tap for insight', prompt: 'The Moon is ' + moon.phase + ', ' + moon.daysToNew + ' days to the New Moon. What does this phase mean for me today.' } : null,
    ));

    coords.appendChild(coordCard(
      'Kin',
      '\u25C8', 'teal',
      kin.full.replace(/^Kin \d+ /, ''),
      kin.isGAP ? 'Portal day, synchronicities amplified' : ('Tone ' + kin.tone),
      ask ? { label: 'Tap for insight', prompt: kin.full + (kin.isGAP ? ', a Galactic Activation Portal' : '') + '. What does my Kin mean for me today.' } : null,
    ));

    if (lifePath != null) {
      coords.appendChild(coordCard(
        'Life Path',
        isMasterNum(lifePath) ? '\u2605' : String(lifePath),
        isMasterNum(lifePath) ? 'master' : '',
        String(lifePath),
        numName(lifePath),
        ask ? { label: 'Tap for insight', prompt: 'My Life Path is ' + lifePath + ', ' + numName(lifePath) + '. How does it shape today.' } : null,
      ));
    } else {
      coords.appendChild(coordCard('Universal Day', String(ud.value), isMasterNum(ud.value) ? 'master' : '', String(ud.value), numName(ud.value), null));
    }
    computed.appendChild(coords);

    // today's signal, deterministic
    const signalText = buildSignal(ud, kin, moon, pn);
    const sig = canDeepDive ? el('button', { type: 'button', class: 'rdg-signal tap' }) : el('div', { class: 'rdg-signal' });
    sig.appendChild(el('div', { class: 'rdg-signal-l' }, 'Today\u2019s signal'));
    sig.appendChild(el('div', { class: 'rdg-signal-t' }, signalText));
    if (canDeepDive) sig.addEventListener('click', () => { deepDive('Here is today\u2019s signal: ' + signalText + ' Read it for me in depth.'); });
    computed.appendChild(sig);

    // biorhythms
    if (hasBirth) {
      const bio = biorhythms(profile!.birthDate as string, dateStr);
      if (bio.length) {
        computed.appendChild(el('div', { class: 'rdg-seclabel' }, 'Biorhythms today'));
        const grid = el('div', { class: 'rdg-bio' });
        for (const b of bio) {
          const card = el('div', { class: 'rdg-bio-c' });
          card.appendChild(el('div', { class: 'rdg-bio-l' }, b.label));
          const crit = b.phase === 'Critical';
          const vcls = crit ? 'crit' : b.pct >= 0 ? 'pos' : 'neg';
          card.appendChild(el('div', { class: 'rdg-bio-v ' + vcls }, b.sign + b.pct + '%'));
          const track = el('div', { class: 'rdg-bio-track' });
          const fill = el('div', { class: 'rdg-bio-fill' });
          const w = Math.min(100, Math.abs(b.pct));
          fill.setAttribute('style', 'width:' + w + '%;background:' + (crit ? 'var(--gold,#C9A050)' : b.pct >= 0 ? 'var(--teal,#81CDB6)' : '#E0A0A0') + ';' + (b.pct < 0 ? 'margin-left:' + (100 - w) + '%;' : ''));
          track.appendChild(fill);
          card.appendChild(track);
          card.appendChild(el('div', { class: 'rdg-bio-p' }, b.phase));
          grid.appendChild(card);
        }
        computed.appendChild(grid);
      }
    }

    // numerology of the day: universal day + three component energies
    computed.appendChild(el('div', { class: 'rdg-seclabel' }, 'Numerology of the day'));
    const parts = dateStr.split('-').map(Number);
    const dayN = reduceNumber(parts[2] || 1).value;
    const monthN = reduceNumber(parts[1] || 1).value;
    const yearN = reduceNumber(digitSum(String(parts[0] || new Date().getUTCFullYear()))).value;
    const comp = el('div', { class: 'rdg-energies' });
    comp.appendChild(energyCard('The day', 'Day ' + (parts[2] || ''), dayN, canDeepDive ? deepDive : undefined));
    comp.appendChild(energyCard('The month', 'Month ' + (parts[1] || ''), monthN, canDeepDive ? deepDive : undefined));
    comp.appendChild(energyCard('The year', 'Year ' + (parts[0] || ''), yearN, canDeepDive ? deepDive : undefined));
    computed.appendChild(comp);
    computed.appendChild(el('div', { class: 'rdg-symbolic' }, 'Symbolic, Pythagorean numerology, master numbers preserved. The shared component energies of the date.'));

    // personal numerology, if birth date known
    if (pn) {
      computed.appendChild(el('div', { class: 'rdg-seclabel' }, 'Your personal numerology'));
      const per = el('div', { class: 'rdg-energies' });
      per.appendChild(energyCard('Personal Day', '', pn.personalDay.value, canDeepDive ? deepDive : undefined));
      per.appendChild(energyCard('Personal Month', '', pn.personalMonth.value, canDeepDive ? deepDive : undefined));
      per.appendChild(energyCard('Personal Year', '', pn.personalYear.value, canDeepDive ? deepDive : undefined));
      computed.appendChild(per);
      computed.appendChild(el('div', { class: 'rdg-symbolic' }, 'Symbolic. Your own numbers, drawn from your birth date set against today.'));

      // three windows of the day, from the personal layers
      computed.appendChild(el('div', { class: 'rdg-seclabel' }, 'The day in three windows'));
      const win = el('div', { class: 'rdg-energies' });
      win.appendChild(windowCard('Morning', 'Personal Day', pn.personalDay.value, 'morning'));
      win.appendChild(windowCard('Afternoon', 'Personal Month', pn.personalMonth.value, 'afternoon'));
      win.appendChild(windowCard('Evening', 'Personal Year', pn.personalYear.value, 'evening'));
      computed.appendChild(win);
    }

    // the emergent surface, the person's own marks read as observation, never forecast
    if (agg) computed.appendChild(emergentPanel(agg));
  }

  function frameworkForTitle(s: string): string | undefined {
    const t = s.toLowerCase();
    if (t.indexOf('numerolog') >= 0 || t.indexOf('personal day') >= 0) return 'numerology';
    if (t.indexOf('moon') >= 0 || t.indexOf('lunar') >= 0) return 'lunar';
    if (t.indexOf('dreamspell') >= 0 || t.indexOf('kin') >= 0) return 'dreamspell';
    if (t.indexOf('astrolog') >= 0 || t.indexOf('transit') >= 0 || t.indexOf('planet') >= 0) return 'astrology';
    if (t.indexOf('converg') >= 0 || t.indexOf('frameworks meet') >= 0) return 'convergence';
    if (t.indexOf('pacing') >= 0) return 'pacing';
    return undefined;
  }
  function landedTap(section: string, framework?: string): HTMLElement | null {
    if (!o.recordSignal) return null;
    const wrap = el('div', { class: 'rdg-landed' });
    wrap.appendChild(el('span', { class: 'rdg-landed-dot' }));
    const lab = el('span', {}, 'this landed');
    wrap.appendChild(lab);
    let done = false;
    wrap.addEventListener('click', () => {
      if (done) return;
      done = true;
      wrap.classList.add('on');
      lab.textContent = 'noted';
      o.recordSignal!({ at: Date.now(), date: dateStr, kind: 'landed', surface: 'reading', section: section, framework: framework, voice: o.getLens() });
      if (o.reflect) o.reflect('You marked what landed in your reading.');
    });
    return wrap;
  }
  function coordCard(
    label: string, glyph: string, glyphCls: string, value: string, sub: string,
    tap: { label: string; prompt: string } | null,
  ): HTMLElement {
    const card = el(tap ? 'button' : 'div', { type: 'button', class: 'rdg-coord' + (tap ? ' tap' : '') });
    card.appendChild(el('div', { class: 'rdg-coord-l' }, label));
    card.appendChild(el('div', { class: 'rdg-coord-glyph ' + glyphCls }, glyph));
    card.appendChild(el('div', { class: 'rdg-coord-v' }, value));
    if (sub) card.appendChild(el('div', { class: 'rdg-coord-s' }, sub));
    if (tap && canDeepDive) {
      card.appendChild(el('div', { class: 'rdg-coord-tap' }, tap.label));
      card.addEventListener('click', () => { deepDive(tap.prompt); });
    }
    return card;
  }

  function energyCard(layer: string, sub: string, n: number, canAsk: ((p: string) => void) | undefined): HTMLElement {
    const master = isMasterNum(n);
    const card = el(canAsk ? 'button' : 'div', { type: 'button', class: 'rdg-energy' + (canAsk ? ' tap' : '') });
    card.appendChild(el('div', { class: 'rdg-energy-layer' }, layer));
    if (sub) card.appendChild(el('div', { class: 'rdg-energy-sub' }, sub));
    card.appendChild(el('div', { class: 'rdg-energy-num' + (master ? ' master' : '') }, String(n) + (master ? ' \u2605' : '')));
    const name = numName(n);
    if (name) card.appendChild(el('div', { class: 'rdg-energy-name' }, name));
    const key = numKey(n);
    if (key) card.appendChild(el('div', { class: 'rdg-energy-key' }, key));
    const meaning = numMeaning(n);
    if (meaning) card.appendChild(el('div', { class: 'rdg-energy-guide' }, meaning));
    if (canAsk) card.addEventListener('click', () => { try { canAsk(layer + (sub ? ' ' + sub : '') + ', the number ' + n + ' (' + name + '). What does this energy ask of me.'); } catch (_e) { /* host */ } });
    return card;
  }

  type Slot = 'morning' | 'afternoon' | 'evening';
  function windowCard(part: string, layer: string, n: number, slot: Slot): HTMLElement {
    const master = isMasterNum(n);
    const card = el('div', { class: 'rdg-energy' });
    card.appendChild(el('div', { class: 'rdg-energy-layer' }, part));
    card.appendChild(el('div', { class: 'rdg-energy-sub' }, layer));
    card.appendChild(el('div', { class: 'rdg-energy-num' + (master ? ' master' : '') }, String(n) + (master ? ' \u2605' : '')));
    const name = numName(n);
    if (name) card.appendChild(el('div', { class: 'rdg-energy-name' }, name));
    // the two telescopes for this window, authored content from the monolith
    const trad = NUM_TIME[n] ? NUM_TIME[n][slot] : '';
    if (trad) {
      const t = el('div', { class: 'rdg-win-line' });
      t.appendChild(el('span', { class: 'rdg-win-tag tradition' }, 'Tradition'));
      t.appendChild(document.createTextNode(trad));
      card.appendChild(t);
    }
    const sci = NUM_NEURO[n] ? NUM_NEURO[n][slot] : '';
    if (sci) {
      const s = el('div', { class: 'rdg-win-line' });
      s.appendChild(el('span', { class: 'rdg-win-tag science' }, 'Science'));
      s.appendChild(document.createTextNode(sci));
      card.appendChild(s);
    }
    return card;
  }

  function buildSignal(
    ud: { value: number }, kin: { full: string; isGAP: boolean; toneName: string },
    moon: { phase: string; black: boolean; shiva: boolean }, pn: { personalDay: { value: number } } | null,
  ): string {
    const n = pn ? pn.personalDay.value : ud.value;
    const lead = isMasterNum(n) ? ('Master Number ' + n + ' day, ' + numName(n)) : (numName(n) + ', the day reduces to ' + n);
    const parts: string[] = [lead + '.'];
    parts.push(numMeaning(n));
    parts.push(kin.full.replace(/^Kin \d+ /, '') + (kin.isGAP ? ', a Galactic Activation Portal, synchronicities amplified' : '') + '.');
    parts.push(moon.phase + (moon.black ? ', Black Moon window, a tricky time' : moon.shiva ? ', Shiva Moon window, a blissful time' : '') + '.');
    return parts.filter(Boolean).join(' ');
  }

  /* ======================================================================== *
   * THE COMPOSED ZONE, streamed from the server
   * ======================================================================== */
  function makeBody(value: SectionValue): HTMLElement | null {
    const norm = normaliseVoice(value);
    if (!norm) return null;
    const body = el('div', { class: 'rdg-body' });
    if (norm.plain != null) { body.dataset.plain = norm.plain; }
    else if (norm.voiced) {
      body.classList.add('rdg-voiced');
      body.dataset.tradition = norm.voiced.tradition;
      body.dataset.science = norm.voiced.science;
      body.dataset.everyday = norm.voiced.everyday;
    }
    paintBody(body, o.getLens());
    return body;
  }

  function voiceMeta(l: Lens): { label: string; cls: string } {
    return l === 'science' ? { label: 'Science', cls: 'science' }
      : l === 'tradition' ? { label: 'Tradition', cls: 'tradition' }
      : { label: 'Everyday', cls: 'everyday' };
  }
  function otherTelescopes(l: Lens): Lens[] {
    if (l === 'science') return ['tradition'];
    if (l === 'tradition') return ['science'];
    return ['tradition', 'science'];
  }
  function sectionTitleOf(node: HTMLElement): string {
    const card = node.closest('.rdg-card') as HTMLElement | null;
    const t = card ? card.querySelector('.rdg-title') : null;
    return t ? (t.textContent || '').trim() : '';
  }
  /*
   * The inline cross telescope bridge. On a voiced section it offers the other
   * telescope, or both telescopes from the everyday voice, revealed in place
   * beneath the current voice and in that voice's colour, so both registers are
   * held on one coordinate at once. It never navigates and never collapses the
   * reading to a single view, which is the whole of the value. Opening a bridge
   * records a located bridge signal, the higher value cross telescope move.
   */
  function buildBridge(body: HTMLElement, lens: Lens): HTMLElement | null {
    const triple: Record<Lens, string> = {
      tradition: body.dataset.tradition || '',
      science: body.dataset.science || '',
      everyday: body.dataset.everyday || '',
    };
    const others = otherTelescopes(lens).filter((t) => triple[t] && triple[t].trim().length > 0);
    if (others.length === 0) return null;
    const row = el('div', { class: 'rdg-bridge' });
    for (const tele of others) {
      const meta = voiceMeta(tele);
      const btn = el('button', { type: 'button', class: 'rdg-bridge-btn ' + meta.cls }, 'Through the ' + meta.label.toLowerCase() + ' telescope');
      let block: HTMLElement | null = null;
      btn.addEventListener('click', () => {
        if (block) { if (block.parentNode) block.parentNode.removeChild(block); block = null; btn.classList.remove('open'); return; }
        block = el('div', { class: 'rdg-bridge-block ' + meta.cls });
        block.appendChild(el('div', { class: 'rdg-bridge-label' }, meta.label + ' telescope, the same coordinate'));
        for (const p of paragraphs(triple[tele])) block.appendChild(el('p', { class: 'rdg-p' }, p));
        body.insertBefore(block, row);
        btn.classList.add('open');
        if (o.recordSignal) {
          const title = sectionTitleOf(body);
          o.recordSignal({ at: Date.now(), date: dateStr, kind: 'landed', surface: 'reading', section: title, framework: frameworkForTitle(title), voice: tele, bridge: true });
        }
      });
      row.appendChild(btn);
    }
    return row;
  }

  function paintBody(body: HTMLElement, lens: Lens): void {
    clear(body);
    const voiced = body.classList.contains('rdg-voiced');
    let text = '';
    if (voiced) {
      text = pickVoice({ tradition: body.dataset.tradition || '', science: body.dataset.science || '', everyday: body.dataset.everyday || '' }, lens);
    } else {
      text = body.dataset.plain || '';
    }
    for (const p of paragraphs(text)) body.appendChild(el('p', { class: 'rdg-p' }, p));
    if (voiced) {
      const bridge = buildBridge(body, lens);
      if (bridge) body.appendChild(bridge);
    }
  }

  function repaintVoice(lens: Lens): void {
    const bodies = view.querySelectorAll('.rdg-body');
    bodies.forEach((b) => paintBody(b as HTMLElement, lens));
    const headline = view.querySelector('.rdg-headline') as HTMLElement | null;
    if (headline && headline.classList.contains('rdg-voiced')) {
      headline.textContent = pickVoice({ tradition: headline.dataset.tradition || '', science: headline.dataset.science || '', everyday: headline.dataset.everyday || '' }, lens);
    }
    const closing = view.querySelector('.rdg-closing') as HTMLElement | null;
    if (closing && closing.classList.contains('rdg-voiced')) {
      closing.textContent = pickVoice({ tradition: closing.dataset.tradition || '', science: closing.dataset.science || '', everyday: closing.dataset.everyday || '' }, lens);
    }
  }

  /* ---- the curated bibliography spine, wired as the floor for every claim ---
   * Each framework section names what it is a claim about; the spine returns the
   * named authorities for that claim, counterweights ordered last, so a
   * contested claim shows its sceptical literature beside its support. The
   * server may add citations of its own; they merge over the curated floor,
   * never under it, so a framework section is never left unsourced. The
   * register of each source is carried through and shown, so a symbolic source
   * reads as symbolic and an empirical one as empirical.
   */
  interface NormCite {
    ref: string; display: string; authors: string; year: string; title: string;
    journal: string; publisher: string; doi: string; lineage: string;
    register: string; counterweight: boolean;
  }
  const REGISTER_LABEL: Record<string, string> = {
    symbolic: 'symbolic', astronomical: 'astronomical', empirical: 'empirical',
    depth_psychology: 'depth psychology', anthropology: 'anthropology',
    contemplative: 'contemplative', strategic: 'strategic', synthesis: 'synthesis',
  };
  function normCite(raw: unknown): NormCite | null {
    if (!raw || typeof raw !== 'object') return null;
    const c = raw as Record<string, unknown>;
    const ref = String(c.ref || c.display || '').trim();
    const display = String(c.display || '').trim();
    if (!ref && !display) return null;
    return {
      ref: ref || display,
      display,
      authors: String(c.authors || '').trim(),
      year: String(c.year || '').trim(),
      title: String(c.title || '').trim(),
      journal: String(c.journal || c.venue || '').trim(),
      publisher: String(c.publisher || '').trim(),
      doi: String(c.doi || '').trim().replace(/^https?:\/\/doi\.org\//, ''),
      lineage: String(c.lineage || '').trim(),
      register: String(c.register || '').trim(),
      counterweight: c.counterweight === true,
    };
  }
  function curatedFor(claimTag?: string): NormCite[] {
    if (!claimTag) return [];
    return citationsForClaim(claimTag).map((e: ReadingCitation): NormCite => ({
      ref: e.ref, display: e.display, authors: e.authors, year: e.year, title: e.title,
      journal: e.journal, publisher: e.publisher, doi: e.doi, lineage: e.lineage,
      register: e.register, counterweight: e.counterweight,
    }));
  }
  function uniqueSorted(parts: NormCite[][]): NormCite[] {
    const out: NormCite[] = [];
    const seen = new Set<string>();
    for (const list of parts) {
      for (const n of list) {
        if (!n) continue;
        const k = (n.ref || n.display).toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k); out.push(n);
      }
    }
    out.sort((a, b) => Number(a.counterweight) - Number(b.counterweight));
    return out;
  }
  function mergeCites(serverCites: unknown, claimTag?: string): NormCite[] {
    const server = Array.isArray(serverCites)
      ? (serverCites.map(normCite).filter(Boolean) as NormCite[]) : [];
    return uniqueSorted([curatedFor(claimTag), server]);
  }
  const DAY_CLAIM_TAGS = [
    'convergence', 'numerology_day_quality', 'lunar_phase_timing', 'pacing_circadian',
    'astrology_transit', 'dreamspell_count', 'body_somatic', 'shadow_depth',
  ];
  function dayCites(serverUnion: unknown): NormCite[] {
    const curated = DAY_CLAIM_TAGS.map((t) => curatedFor(t));
    const server = Array.isArray(serverUnion)
      ? (serverUnion.map(normCite).filter(Boolean) as NormCite[]) : [];
    return uniqueSorted(curated.concat([server]));
  }

  function citationRow(cites: NormCite[]): HTMLElement | null {
    if (!Array.isArray(cites) || cites.length === 0) return null;
    const wrap = el('div');
    const row = el('div', { class: 'rdg-cites' });
    const detail = el('div', { class: 'rdg-cite-detail' });
    let openRef = '';
    for (const c of cites) {
      const label = c.display
        || [c.authors, c.year].filter(Boolean).join(' ')
        || 'Source';
      const chip = el('button', { type: 'button', class: 'rdg-cite' + (c.counterweight ? ' counter' : '') }, label);
      if (c.counterweight) chip.setAttribute('title', 'Sceptical counterweight');
      chip.addEventListener('click', () => {
        if (openRef === c.ref && detail.classList.contains('open')) { detail.classList.remove('open'); openRef = ''; return; }
        openRef = c.ref;
        clear(detail);
        const tags = el('div', { class: 'rdg-cite-tags' });
        const reg = REGISTER_LABEL[c.register] || c.register;
        if (reg) tags.appendChild(el('span', { class: 'rdg-cite-tag' }, reg));
        if (c.counterweight) tags.appendChild(el('span', { class: 'rdg-cite-tag counter' }, 'sceptical counterweight'));
        if (tags.firstChild) detail.appendChild(tags);
        if (c.authors || c.year) detail.appendChild(el('div', {}, [c.authors, c.year].filter(Boolean).join(', ')));
        if (c.title) detail.appendChild(el('div', { class: 'rdg-cite-title' }, c.title));
        const venue = c.journal || c.publisher;
        if (venue) detail.appendChild(el('div', {}, venue));
        if (c.lineage) detail.appendChild(el('div', {}, 'Lineage, ' + c.lineage));
        if (c.doi) detail.appendChild(el('div', {}, 'doi ' + c.doi));
        detail.classList.add('open');
      });
      row.appendChild(chip);
    }
    if (!row.firstChild) return null;
    wrap.appendChild(row);
    wrap.appendChild(detail);
    return wrap;
  }

  function sourcesBlock(union: unknown, sourcesText: string): HTMLElement | null {
    const cites = dayCites(union);
    const note = String(sourcesText || '').trim();
    if (cites.length === 0 && !note) return null;
    const wrap = el('div', { class: 'rdg-sources' });
    const toggle = el('button', { type: 'button', class: 'rdg-sources-toggle' });
    toggle.appendChild(el('span', { class: 'rdg-sources-caret' }, '\u203a'));
    toggle.appendChild(el('span', {}, 'Sources, ' + cites.length + ' references'));
    const body = el('div', { class: 'rdg-sources-body' });
    if (note) body.appendChild(el('div', { class: 'rdg-source-note' }, note));
    for (const c of cites) {
      const line = el('div', { class: 'rdg-source-line' + (c.counterweight ? ' counter' : '') });
      const lead = [c.authors, c.year].filter(Boolean).join(', ');
      if (lead) { line.appendChild(el('b', {}, lead)); line.appendChild(document.createTextNode('. ')); }
      if (c.title) line.appendChild(document.createTextNode(c.title + '. '));
      const venue = c.journal || c.publisher;
      if (venue) line.appendChild(document.createTextNode(venue + '. '));
      if (c.doi) line.appendChild(document.createTextNode('doi ' + c.doi + '. '));
      const reg = REGISTER_LABEL[c.register] || c.register;
      if (reg || c.counterweight) {
        const t = (c.counterweight ? 'sceptical counterweight' : reg);
        line.appendChild(el('span', { class: 'rdg-source-reg' + (c.counterweight ? ' counter' : '') }, t));
      }
      if (line.firstChild) body.appendChild(line);
    }
    const ver = bibliographyVersion();
    if (ver) body.appendChild(el('div', { class: 'rdg-source-ver' }, 'CDP consolidated bibliography, version ' + ver + '. Symbolic sources are labelled symbolic, empirical sources empirical, and contested claims carry their sceptical counterweight.'));
    if (!body.firstChild) return null;
    toggle.addEventListener('click', () => wrap.classList.toggle('open'));
    wrap.appendChild(toggle);
    wrap.appendChild(body);
    return wrap;
  }

  interface RichSpec {
    title: string;
    subhead?: string;
    hook?: HTMLElement | null;
    body: SectionValue;
    preBody?: HTMLElement[];
    postBody?: HTMLElement[];
    citations?: unknown;
    claim?: string;
    askPrompt?: string;
    collapsed: boolean;
    lead?: boolean;
  }
  function buildRichSection(spec: RichSpec): HTMLElement | null {
    const body = makeBody(spec.body);
    const hasExtras = (spec.preBody && spec.preBody.length) || (spec.postBody && spec.postBody.length);
    if (!body && !hasExtras && !spec.subhead) return null;
    const card = el('div', { class: 'rdg-card' + (spec.lead ? ' rdg-lead' : '') + (spec.collapsed && !spec.lead ? '' : ' open') });
    const head = el('button', { type: 'button', class: 'rdg-head' });
    head.appendChild(el('span', { class: 'rdg-title' }, spec.title));
    head.appendChild(el('span', { class: 'rdg-caret' }, '\u203a'));
    card.appendChild(head);
    if (spec.subhead) card.appendChild(el('div', { class: 'rdg-subhead' }, spec.subhead));
    if (spec.hook) card.appendChild(spec.hook);
    if (spec.preBody) for (const n of spec.preBody) card.appendChild(n);
    if (body) card.appendChild(body);
    if (spec.postBody) for (const n of spec.postBody) card.appendChild(n);
    const cue = spec.askPrompt ? askCue('Ask the Oracle about this', spec.askPrompt) : null;
    if (cue) card.appendChild(cue);
    const cites = citationRow(mergeCites(spec.citations, spec.claim));
    if (cites) card.appendChild(cites);
    const lt = landedTap(spec.title, frameworkForTitle(spec.title));
    if (lt) card.appendChild(lt);
    if (!spec.lead) head.addEventListener('click', () => card.classList.toggle('open'));
    return card;
  }

  function renderAI(raw: unknown): void {
    const outer = (raw && typeof raw === 'object') ? (raw as Record<string, unknown>) : {};
    const r = (outer.reading && typeof outer.reading === 'object' ? outer.reading : outer) as Record<string, unknown>;
    const moon = (outer.moon && typeof outer.moon === 'object' ? outer.moon : null) as Record<string, unknown> | null;
    clear(aiZone);
    if (isRaw(r)) {
      const s = String(r.synthesis || '').trim();
      aiZone.appendChild(el('div', { class: 'rdg-status' }, s && !s.startsWith('{') ? s : 'The reading is composing on the server; the page above is your day in full while it arrives.'));
      return;
    }

    const hv = normaliseVoice(r.headline as SectionValue);
    if (hv) {
      const h = el('div', { class: 'rdg-headline' });
      if (hv.plain != null) { h.textContent = hv.plain; }
      else if (hv.voiced) {
        h.classList.add('rdg-voiced');
        h.dataset.tradition = hv.voiced.tradition;
        h.dataset.science = hv.voiced.science;
        h.dataset.everyday = hv.voiced.everyday;
        h.textContent = pickVoice(hv.voiced, o.getLens());
      }
      aiZone.appendChild(h);
    }

    const lead = buildRichSection({ title: 'Today', body: r.synthesis as SectionValue, collapsed: false, lead: true });
    if (lead) aiZone.appendChild(lead);

    const conv = (normaliseVoice(r.depth_synthesis as SectionValue) ? r.depth_synthesis : r.framework_convergence) as SectionValue;
    const convCites = (r.depth_synthesis && typeof r.depth_synthesis === 'object') ? (r.depth_synthesis as Record<string, unknown>).citations : undefined;
    const convCard = buildRichSection({ title: 'Where the frameworks meet', body: conv, citations: convCites, claim: 'convergence', askPrompt: 'Go deeper on where the frameworks converge today.', collapsed: false });
    if (convCard) aiZone.appendChild(convCard);

    const numObj = (r.numerology && typeof r.numerology === 'object') ? r.numerology as Record<string, unknown> : null;
    if (numObj || normaliseVoice(r.numerology as SectionValue)) {
      const card = buildRichSection({
        title: 'Numerology, read in depth',
        subhead: numObj ? asString(numObj.headline) : '',
        hook: el('div', { class: 'rdg-hook' }, NUMEROLOGY_HOOK),
        body: r.numerology as SectionValue,
        citations: numObj ? numObj.citations : undefined,
        claim: 'numerology_day_quality',
        askPrompt: 'How does today\u2019s number energy work for me.',
        collapsed: true,
      });
      if (card) aiZone.appendChild(card);
    }

    const moonObj = (r.moon_section && typeof r.moon_section === 'object') ? r.moon_section as Record<string, unknown> : null;
    if (moonObj || normaliseVoice(r.moon_section as SectionValue)) {
      const phase = moon ? String(moon.phase || '') : '';
      const isBlack = !!(moon && (moon.isBlack || moon.isBlackMoon));
      const isShiva = !!(moon && (moon.isShiva || moon.isShivaMoon));
      const pre: HTMLElement[] = [el('div', { class: 'rdg-hook' }, moonHook(phase, isBlack, isShiva))];
      if (isBlack || isShiva) {
        const badges = el('div', { class: 'rdg-badges' });
        if (isBlack) badges.appendChild(el('span', { class: 'rdg-badge black' }, 'Black Moon, two days before New'));
        if (isShiva) badges.appendChild(el('span', { class: 'rdg-badge shiva' }, 'Shiva Moon, two days after New'));
        pre.push(badges);
      }
      const card = buildRichSection({
        title: 'Lunar landscape',
        subhead: moonObj ? asString(moonObj.headline) : '',
        preBody: pre,
        body: r.moon_section as SectionValue,
        citations: moonObj ? moonObj.citations : undefined,
        claim: 'lunar_phase_timing',
        askPrompt: 'What does this Moon mean for me today.',
        collapsed: true,
      });
      if (card) aiZone.appendChild(card);
    }

    const pacingObj = (r.pacing_section && typeof r.pacing_section === 'object') ? r.pacing_section as Record<string, unknown> : null;
    if (pacingObj && normaliseVoice(r.pacing_section as SectionValue)) {
      const card = buildRichSection({
        title: 'Pacing across the day',
        subhead: asString(pacingObj.headline),
        hook: el('div', { class: 'rdg-hook' }, PACING_HOOK),
        body: r.pacing_section as SectionValue,
        citations: pacingObj.citations,
        claim: 'pacing_circadian',
        collapsed: true,
      });
      if (card) aiZone.appendChild(card);
    }

    const astroObj = (r.astrology && typeof r.astrology === 'object') ? r.astrology as Record<string, unknown> : null;
    if (astroObj) {
      const transitBody: SectionValue = (astroObj.tradition || astroObj.science || astroObj.everyday)
        ? astroObj
        : (asString(astroObj.main_transit_body) || asString(astroObj.main_transit));
      const post: HTMLElement[] = [];
      const sn = asString(astroObj.saturn_neptune);
      if (sn) {
        const bd = el('div', { class: 'rdg-backdrop' });
        bd.appendChild(el('div', { class: 'rdg-backdrop-label' }, 'Saturn and Neptune backdrop'));
        bd.appendChild(el('p', {}, paragraphs(sn)[0] || sn));
        post.push(bd);
      }
      const card = buildRichSection({
        title: 'Western astrology, today\u2019s transits',
        subhead: asString(astroObj.main_transit_headline),
        hook: el('div', { class: 'rdg-hook' }, TRANSIT_HOOK),
        body: transitBody,
        postBody: post,
        citations: astroObj.citations,
        claim: 'astrology_transit',
        askPrompt: 'What do today\u2019s transits mean for me.',
        collapsed: true,
      });
      if (card) aiZone.appendChild(card);
    }

    const natalObj = (r.natal_integration && typeof r.natal_integration === 'object') ? r.natal_integration as Record<string, unknown> : null;
    if (natalObj && normaliseVoice(r.natal_integration as SectionValue)) {
      const card = buildRichSection({
        title: 'Today against your natal chart',
        subhead: asString(natalObj.headline),
        hook: el('div', { class: 'rdg-hook' }, NATAL_HOOK),
        body: r.natal_integration as SectionValue,
        citations: natalObj.citations,
        claim: 'astrology_transit',
        collapsed: true,
      });
      if (card) aiZone.appendChild(card);
    }

    const dsObj = (r.dreamspell && typeof r.dreamspell === 'object') ? r.dreamspell as Record<string, unknown> : null;
    if (dsObj || normaliseVoice(r.dreamspell as SectionValue)) {
      const hook = dreamspellHook(dateStr);
      const pre: HTMLElement[] = [];
      let kseal = '';
      try { kseal = kinDescriptor(dateStr).seal; } catch (_e) { kseal = ''; }
      const arch = kseal && SEAL_ARCH[kseal] ? SEAL_ARCH[kseal] : '';
      if (arch) pre.push(el('div', { class: 'rdg-dshook' }, 'Your seal archetype is ' + arch + '.'));
      if (hook.text) pre.push(el('div', { class: 'rdg-dshook' }, hook.text));
      const post: HTMLElement[] = [];
      const disclaimer = (dsObj && asString(dsObj.disclaimer)) || DREAMSPELL_DISCLAIMER;
      post.push(el('div', { class: 'rdg-disclaimer' }, disclaimer));
      let subhead = dsObj ? asString(dsObj.headline) : '';
      subhead = subhead.replace(/\s*\u2605?\s*GALACTIC ACTIVATION PORTAL/i, '').trim();
      const card = buildRichSection({
        title: 'Dreamspell, Law of Time',
        subhead,
        preBody: pre,
        body: r.dreamspell as SectionValue,
        postBody: post,
        citations: dsObj ? dsObj.citations : undefined,
        claim: 'dreamspell_count',
        askPrompt: 'What does my Kin mean for me today.',
        collapsed: true,
      });
      if (card) {
        if (hook.isGAP) {
          const head = card.querySelector('.rdg-head');
          if (head) {
            const badge = el('span', { class: 'rdg-badge portal' }, 'Portal');
            badge.setAttribute('style', 'margin-left:8px');
            const titleSpan = head.querySelector('.rdg-title');
            if (titleSpan && titleSpan.parentNode) titleSpan.parentNode.insertBefore(badge, titleSpan.nextSibling);
          }
        }
        aiZone.appendChild(card);
      }
    }

    const bodyObj = (r.body_section && typeof r.body_section === 'object') ? r.body_section as Record<string, unknown> : null;
    if (bodyObj && normaliseVoice(r.body_section as SectionValue)) {
      const card = buildRichSection({ title: 'Body, today', subhead: asString(bodyObj.headline), body: r.body_section as SectionValue, citations: bodyObj.citations, claim: 'body_somatic', collapsed: true });
      if (card) aiZone.appendChild(card);
    }
    const shadowObj = (r.shadow_section && typeof r.shadow_section === 'object') ? r.shadow_section as Record<string, unknown> : null;
    if (shadowObj && normaliseVoice(r.shadow_section as SectionValue)) {
      const card = buildRichSection({ title: 'Where today might catch you', subhead: asString(shadowObj.headline), body: r.shadow_section as SectionValue, citations: shadowObj.citations, claim: 'shadow_depth', askPrompt: 'Help me work with this shadow today.', collapsed: true });
      if (card) aiZone.appendChild(card);
    }

    const cv = normaliseVoice((r.closing || r.closing_line) as SectionValue);
    if (cv) {
      const c = el('div', { class: 'rdg-closing' });
      if (cv.plain != null) { c.textContent = cv.plain; }
      else if (cv.voiced) {
        c.classList.add('rdg-voiced');
        c.dataset.tradition = cv.voiced.tradition;
        c.dataset.science = cv.voiced.science;
        c.dataset.everyday = cv.voiced.everyday;
        c.textContent = pickVoice(cv.voiced, o.getLens());
      }
      aiZone.appendChild(c);
    }

    const sources = sourcesBlock(r.citationUnion, asString(r.sources));
    if (sources) aiZone.appendChild(sources);
  }

  /* ---- the endpoint and polling seams, unchanged in contract -------------- */
  async function start(): Promise<string> {
    const key = readingKey(base, tier, dateStr);
    if (prewarmCache && prewarmCache.key === key) {
      const cached = prewarmCache;
      prewarmCache = null;
      try { return await cached.jobId; } catch (_e) { /* fall through to a fresh start */ }
    }
    return startJob(base, tier, dateStr, o.getProfile(), o.getLens(), o.userId || null);
  }

  async function run(): Promise<void> {
    let jobId: string;
    try { jobId = await start(); }
    catch (_e) {
      setStatus('The reading could not be started just now. The engine may be waking; please try again in a moment.');
      return;
    }
    const t0 = Date.now();
    const deadline = ({ free: 70000, seeker: 100000, initiate: 160000, mystic: 220000, oracle: 310000 } as Record<string, number>)[tier] || 200000;
    let shownPhase1 = false;
    while (live && Date.now() - t0 < deadline) {
      await sleep(2200);
      if (!live) return;
      let st: { status: string; result?: unknown; phase1?: unknown; elapsed?: number; sectionsReady?: number };
      try { st = await (await fetch(base + '/api/reading/status/' + jobId)).json(); }
      catch (_e) { continue; }
      // A render or handling fault must never freeze the loop. Wrap the body so
      // a single bad payload is logged precisely and polling continues, giving
      // completion every chance to land.
      try {
        if (st.status === 'complete') { renderAI(st.result); ensureShareBar(); if (o.reflect) o.reflect((o.title || 'Your reading') + ' is ready, here under your hand.'); return; }
        if (st.status === 'error') { setStatus('The reading hit a snag on the server. The day above is yours in full; please try the depth again shortly.'); return; }
        if (st.status === 'phase1_complete' && st.phase1 && !shownPhase1) {
          shownPhase1 = true;
          renderAI(st.phase1);
        }
        // The progress line updates on every poll, so it never freezes. When the
        // server reports sections ready, it reads as genuine progress, the
        // tracker, rather than a clock against nothing.
        if (st.status === 'pending' || st.status === 'phase1_complete') {
          const secs = Math.round((Date.now() - t0) / 1000);
          const ready = typeof st.sectionsReady === 'number' ? st.sectionsReady : 0;
          if (shownPhase1) {
            setStatus(ready > 0
              ? 'The core is here. The fuller sections are composing, ' + ready + ' ready, ' + secs + ' seconds in.'
              : 'The core is here. The fuller sections are composing, ' + secs + ' seconds in.');
          } else {
            setStatus(ready > 0
              ? 'The Oracle is composing your reading, ' + ready + ' sections ready, ' + secs + ' seconds in.'
              : 'The Oracle is composing the full depth of your reading, ' + secs + ' seconds in.');
          }
        }
      } catch (e) {
        try { console.error('[reading] render or status handling failed:', e && (e as Error).message ? (e as Error).message : e); } catch (_e2) { /* ignore */ }
      }
    }
    if (live) setStatus('The depth is taking longer than usual on the server. The day above is complete; please try the depth again shortly.');
  }

  renderComputed();
  void run();
  return { close, repaintVoice };
}
