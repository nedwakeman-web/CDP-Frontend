/**
 * CDP Vessel, surface layer: the native daily reading.
 *
 * This is the absorption of the monolith reading into the Vessel. It composes
 * nothing of its own. It calls the live, proven reading engine on the server,
 * the same /api/reading/start and /api/reading/status the monolith uses, with
 * the same async tiered contract, and it renders the returned reading in the
 * Vessel shell. The six framework synthesis, the convergence, and the tiering
 * all live on the server and are unchanged. What changes is only where the
 * result is shown, inside the Vessel rather than in a separate page, and how
 * fully it is shown.
 *
 * This render carries every element the monolith renderReading carries that the
 * skeleton dropped: the scholarly sources, surfaced quietly and tappable but
 * never announced; the three numerology energies as their own clear layer, each
 * labelled symbolic and given its meaning; the circadian pacing kept as its own
 * distinct discipline, separate from numerology and cited to Cajochen and
 * Schmidt 2024; the Dreamspell tone and seal oracle texture with the portal note
 * and the Argueelles disclaimer; the astrology transit depth with the
 * Saturn and Neptune backdrop; and the within section framing the monolith uses
 * so a first read needs no instruction. The full per voice prose is presented
 * rather than the lead paragraphs.
 *
 * The reading object carries section objects, each with tradition, science, and
 * everyday text, plus a headline and a citations array, mirroring the server
 * projection. A section may also be a plain string, in which case it is shown
 * as written. The voice toggle on the home swaps the visible voice in place
 * through repaintVoice, with no second round trip to the server. The connectivity
 * seams (the endpoint, the polling, the voice repaint, the share, the reflect)
 * are untouched.
 *
 * House style holds here, in code, comments, and visible strings alike: no em
 * dashes, no en dashes, no exclamation marks, and no spaced hyphen patterns.
 */

import type { Lens } from '../data/model';
import { shareControls } from './share';
import { NUM_DATA } from '../data/numerology-content';
import { kinDescriptor } from '../coordinates-core';

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
  /** Called when the reading completes, so the home can show a quiet trace. */
  reflect?: (note: string) => void;
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
 * strips section HTML, so a body often arrives as one long line with the
 * paragraph breaks gone. Where blank line breaks survive they are honoured.
 * Otherwise the line is re segmented by sentence into readable paragraphs. This
 * touches presentation only; not a single word is added or dropped.
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
    // The voices are all empty; fall back to the picked default body if present.
  }
  const body = (v.body || v.text || v.content) as SectionValue;
  if (body) return normaliseVoice(body);
  return null;
}

/** Resolve the text to show for a voice, falling back so nothing goes blank. */
function pickVoice(t: VoiceTriple, lens: Lens): string {
  const order = lens === 'science' ? [t.science, t.everyday, t.tradition]
    : lens === 'tradition' ? [t.tradition, t.everyday, t.science]
    : [t.everyday, t.tradition, t.science];
  return order.find((x) => x && x.length) || '';
}

/** A clean string from a section field that may be a string or a voiced object. */
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

/** Is the reading a raw or empty shell rather than the structured object. */
function isRaw(r: Record<string, unknown> | null): boolean {
  if (!r) return true;
  if (r.raw === true) return true;
  if (!r.synthesis && !r.numerology && !r.moon_section && !r.headline) return true;
  const s = String(r.synthesis || '').trim();
  if (s.startsWith('{"')) return true;
  return false;
}

/* ---- symbolic Dreamspell oracle texture, ported from the monolith ---------
 * The tone and seal hooks are the in reading oracle texture the monolith shows,
 * keyed by the bare seal and tone names the verified core produces. Symbolic,
 * after Argueelles 1987; the em dashes the monolith carried are replaced by
 * house style punctuation. Numbers and Kin identity come from the engine; these
 * tables carry only the symbolic reading of that identity. */
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

/** The symbolic Dreamspell hook for a date, seal first then tone, plus a portal note. */
function dreamspellHook(dateStr: string): { text: string; isGAP: boolean } {
  try {
    const d = kinDescriptor(dateStr);
    const sealKey = d.seal;
    const sealMsg = SEAL_HOOKS[sealKey] || '';
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
  + 'The timing here follows the circadian cognition literature, Cajochen and Schmidt 2024.';

const NATAL_HOOK =
  'This reads the day against the fixed chart you were born under. '
  + 'It deepens once birth time and place are captured; until then it works from the birth date alone.';

const DREAMSPELL_DISCLAIMER =
  'Dreamspell after Argueelles 1987, The Mayan Factor. A modern twentieth century system, '
  + 'distinct from the living K\u2019iche\u2019 Maya count carried continuously by Guatemalan daykeepers.';

/** The dynamic lunar framing, ported from the monolith, cleaned to house style. */
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
.cdp-surface .rdg-status { font-family:'EB Garamond', Georgia, serif; font-style:italic; font-size:15px; color:var(--text-dim); padding:40px 6px; text-align:center; line-height:1.6; }
.cdp-surface .rdg-note { font-family:'EB Garamond', Georgia, serif; font-style:italic; font-size:12px; color:var(--gold-soft); margin:0 0 18px; }
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

/* enrichment: within section framing, the layers, the quiet sources */
.cdp-surface .rdg-subhead { font-family:'EB Garamond', Georgia, serif; font-size:17px; line-height:1.4; color:var(--gold-soft, #E8C878); margin:0 16px 8px; }
.cdp-surface .rdg-card.open .rdg-subhead { margin-top:2px; }
.cdp-surface .rdg-hook { font-family:'EB Garamond', Georgia, serif; font-style:italic; font-size:13px; line-height:1.6; color:var(--text-dim, #D4C8AE); margin:0 16px 12px; }
.cdp-surface .rdg-symbolic { font-family:Georgia, serif; font-size:11px; line-height:1.5; color:var(--text-faint, #9E9282); margin:0 16px 12px; }
.cdp-surface .rdg-dshook { font-family:'EB Garamond', Georgia, serif; font-size:14px; line-height:1.65; color:var(--text-light, #F0E6CC); margin:0 16px 12px; }
.cdp-surface .rdg-badges { display:flex; flex-wrap:wrap; gap:8px; margin:0 16px 10px; }
.cdp-surface .rdg-badge { font-family:Cinzel, Georgia, serif; font-size:10px; letter-spacing:.1em; text-transform:uppercase; padding:4px 9px; border-radius:2px; border:1px solid var(--gold-line, #3A3320); }
.cdp-surface .rdg-badge.black { color:#C8A0FF; border-color:rgba(200,160,255,.5); }
.cdp-surface .rdg-badge.shiva { color:var(--teal, #81CDB6); border-color:rgba(129,205,182,.5); }
.cdp-surface .rdg-badge.portal { color:var(--gold, #C9A050); border-color:rgba(201,160,80,.5); }
.cdp-surface .rdg-backdrop { border-left:2px solid var(--gold-line, #3A3320); margin:4px 16px 12px; padding:8px 0 8px 14px; }
.cdp-surface .rdg-backdrop .rdg-backdrop-label { font-family:Cinzel, Georgia, serif; font-size:10px; letter-spacing:.12em; text-transform:uppercase; color:var(--text-faint, #9E9282); margin-bottom:5px; }
.cdp-surface .rdg-backdrop p { font-family:Georgia, serif; font-size:14px; line-height:1.7; color:var(--text-dim, #D4C8AE); margin:0; }
.cdp-surface .rdg-disclaimer { font-family:'EB Garamond', Georgia, serif; font-style:italic; font-size:12px; line-height:1.6; color:var(--text-faint, #9E9282); margin:8px 16px 0; padding-top:10px; border-top:1px solid var(--gold-line, #3A3320); }
.cdp-surface .rdg-energies { display:flex; gap:10px; flex-wrap:wrap; margin:4px 16px 14px; }
.cdp-surface .rdg-energy { flex:1; min-width:150px; border:1px solid var(--gold-line, #3A3320); border-radius:3px; padding:11px 13px; background:rgba(0,0,0,.12); }
.cdp-surface .rdg-energy-layer { font-family:Cinzel, Georgia, serif; font-size:9px; letter-spacing:.16em; text-transform:uppercase; color:var(--text-faint, #9E9282); }
.cdp-surface .rdg-energy-sub { font-size:11px; color:var(--text-faint, #9E9282); margin-top:1px; }
.cdp-surface .rdg-energy-num { font-family:'EB Garamond', Georgia, serif; font-size:30px; line-height:1.05; color:var(--gold, #C9A050); margin:6px 0 2px; }
.cdp-surface .rdg-energy-num.master { color:var(--master, #C8A0FF); }
.cdp-surface .rdg-energy-name { font-family:'EB Garamond', Georgia, serif; font-size:15px; color:var(--text-light, #F0E6CC); }
.cdp-surface .rdg-energy-key { font-size:11px; color:var(--gold-soft, #E8C878); margin:2px 0 5px; }
.cdp-surface .rdg-energy-guide { font-family:Georgia, serif; font-size:12px; line-height:1.6; color:var(--text-dim, #D4C8AE); }
.cdp-surface .rdg-cites { display:flex; flex-wrap:wrap; gap:6px; margin:4px 16px 14px; }
.cdp-surface .rdg-cite { background:none; border:1px solid var(--gold-line, #3A3320); color:var(--text-faint, #9E9282); font-family:Georgia, serif; font-size:10px; letter-spacing:.02em; padding:3px 8px; border-radius:10px; cursor:pointer; }
.cdp-surface .rdg-cite:hover { color:var(--gold-soft, #E8C878); border-color:var(--gold, #C9A050); }
.cdp-surface .rdg-cite-detail { font-family:Georgia, serif; font-size:11px; line-height:1.6; color:var(--text-dim, #D4C8AE); margin:0 16px 14px; padding:9px 12px; border:1px solid var(--gold-line, #3A3320); border-radius:3px; background:rgba(0,0,0,.14); display:none; }
.cdp-surface .rdg-cite-detail.open { display:block; }
.cdp-surface .rdg-cite-detail .rdg-cite-title { color:var(--text-light, #F0E6CC); }
.cdp-surface .rdg-sources { margin:22px 0 0; }
.cdp-surface .rdg-sources-toggle { background:none; border:none; cursor:pointer; font-family:Cinzel, Georgia, serif; font-size:10px; letter-spacing:.16em; text-transform:uppercase; color:var(--text-faint, #9E9282); padding:6px 0; display:flex; align-items:center; gap:8px; }
.cdp-surface .rdg-sources-toggle:hover { color:var(--gold-soft, #E8C878); }
.cdp-surface .rdg-sources-caret { font-size:11px; transition:transform .2s; }
.cdp-surface .rdg-sources.open .rdg-sources-caret { transform:rotate(90deg); }
.cdp-surface .rdg-sources-body { display:none; margin-top:8px; }
.cdp-surface .rdg-sources.open .rdg-sources-body { display:block; }
.cdp-surface .rdg-source-line { font-family:Georgia, serif; font-size:11px; line-height:1.65; color:var(--text-faint, #9E9282); margin:0 0 7px; }
.cdp-surface .rdg-source-line b { color:var(--text-dim, #D4C8AE); font-weight:600; }
.cdp-surface .rdg-source-note { font-family:Georgia, serif; font-size:11px; line-height:1.65; color:var(--text-faint, #9E9282); margin:0 0 8px; }
`;
  const style = el('style', { id: STYLE_ID });
  style.textContent = css;
  document.head.appendChild(style);
}

/* ---- pure builders for the enriched elements ------------------------------ */

/** A citation row, quiet and tappable, drawn from a section citations array. */
function citationRow(cites: unknown): HTMLElement | null {
  if (!Array.isArray(cites) || cites.length === 0) return null;
  const wrap = el('div');
  const row = el('div', { class: 'rdg-cites' });
  const detail = el('div', { class: 'rdg-cite-detail' });
  let openRef = '';
  const seen = new Set<string>();
  for (const raw of cites) {
    if (!raw || typeof raw !== 'object') continue;
    const c = raw as Record<string, unknown>;
    const ref = String(c.ref || c.display || '');
    if (!ref || seen.has(ref)) continue;
    seen.add(ref);
    const label = String(c.display || '').trim()
      || [String(c.authors || '').trim(), String(c.year || '').trim()].filter(Boolean).join(' ')
      || 'Source';
    const chip = el('button', { type: 'button', class: 'rdg-cite' }, label);
    chip.addEventListener('click', () => {
      if (openRef === ref && detail.classList.contains('open')) {
        detail.classList.remove('open');
        openRef = '';
        return;
      }
      openRef = ref;
      clear(detail);
      const title = String(c.title || '').trim();
      const venue = String(c.journal || c.publisher || '').trim();
      const year = String(c.year || '').trim();
      const authors = String(c.authors || '').trim();
      const doi = String(c.doi || '').trim();
      if (authors || year) detail.appendChild(el('div', {}, [authors, year].filter(Boolean).join(', ')));
      if (title) { const t = el('div', { class: 'rdg-cite-title' }, title); detail.appendChild(t); }
      if (venue) detail.appendChild(el('div', {}, venue));
      if (doi) detail.appendChild(el('div', {}, 'doi ' + doi));
      detail.classList.add('open');
    });
    row.appendChild(chip);
  }
  if (!row.firstChild) return null;
  wrap.appendChild(row);
  wrap.appendChild(detail);
  return wrap;
}

/** The three numerology energies as their own clear layer, each labelled symbolic. */
function energiesLayer(te: unknown): HTMLElement | null {
  if (!te || typeof te !== 'object') return null;
  const t = te as Record<string, unknown>;
  type Spec = { key: string; layer: string };
  let specs: Spec[];
  if ('day' in t || 'day_month' in t || 'full_date' in t) {
    specs = [
      { key: 'day', layer: 'The day' },
      { key: 'day_month', layer: 'Day and month' },
      { key: 'full_date', layer: 'Full date, your year' },
    ];
  } else if ('morning' in t || 'afternoon' in t || 'evening' in t) {
    specs = [
      { key: 'morning', layer: 'Morning, the day' },
      { key: 'afternoon', layer: 'Afternoon, the month' },
      { key: 'evening', layer: 'Evening, the year' },
    ];
  } else {
    return null;
  }

  const present = specs.filter((s) => t[s.key] && typeof t[s.key] === 'object');
  if (present.length === 0) return null;

  const row = el('div', { class: 'rdg-energies' });
  for (const s of present) {
    const e = t[s.key] as Record<string, unknown>;
    const n = Number(e.n != null ? e.n : e.num);
    const meaning = Number.isFinite(n) ? NUM_DATA[n] : undefined;
    const isMaster = !!(meaning && meaning.master);
    const sub = String(e.label || '').trim();
    const name = String(e.name || (meaning ? meaning.n : '')).trim();
    const key = meaning && meaning.k ? meaning.k : '';
    const guide = String(e.guidance || (meaning ? meaning.m : '')).trim();

    const card = el('div', { class: 'rdg-energy' });
    card.appendChild(el('div', { class: 'rdg-energy-layer' }, s.layer));
    if (sub) card.appendChild(el('div', { class: 'rdg-energy-sub' }, sub));
    card.appendChild(el('div', { class: 'rdg-energy-num' + (isMaster ? ' master' : '') }, Number.isFinite(n) ? String(n) + (isMaster ? ' \u2605' : '') : ''));
    if (name) card.appendChild(el('div', { class: 'rdg-energy-name' }, name));
    if (key) card.appendChild(el('div', { class: 'rdg-energy-key' }, key));
    if (guide) card.appendChild(el('div', { class: 'rdg-energy-guide' }, guide));
    row.appendChild(card);
  }
  return row;
}

/** The quiet foot block of scholarly sources, collapsed and never announced. */
function sourcesBlock(union: unknown, sourcesText: string): HTMLElement | null {
  const entries: Record<string, unknown>[] = Array.isArray(union)
    ? (union as unknown[]).filter((x) => x && typeof x === 'object') as Record<string, unknown>[]
    : [];
  const note = String(sourcesText || '').trim();
  if (entries.length === 0 && !note) return null;

  const wrap = el('div', { class: 'rdg-sources' });
  const toggle = el('button', { type: 'button', class: 'rdg-sources-toggle' });
  toggle.appendChild(el('span', { class: 'rdg-sources-caret' }, '\u203a'));
  toggle.appendChild(el('span', {}, 'Sources'));
  const body = el('div', { class: 'rdg-sources-body' });

  if (note) body.appendChild(el('div', { class: 'rdg-source-note' }, note));

  const seen = new Set<string>();
  for (const c of entries) {
    const ref = String(c.ref || c.display || '');
    if (ref && seen.has(ref)) continue;
    if (ref) seen.add(ref);
    const authors = String(c.authors || '').trim();
    const year = String(c.year || '').trim();
    const title = String(c.title || '').trim();
    const venue = String(c.journal || c.publisher || '').trim();
    const doi = String(c.doi || '').trim();
    const line = el('div', { class: 'rdg-source-line' });
    const lead = [authors, year].filter(Boolean).join(', ');
    if (lead) { line.appendChild(el('b', {}, lead)); line.appendChild(document.createTextNode('. ')); }
    if (title) line.appendChild(document.createTextNode(title + '. '));
    if (venue) line.appendChild(document.createTextNode(venue + '. '));
    if (doi) line.appendChild(document.createTextNode('doi ' + doi));
    if (line.firstChild) body.appendChild(line);
  }

  if (!body.firstChild) return null;
  toggle.addEventListener('click', () => wrap.classList.toggle('open'));
  wrap.appendChild(toggle);
  wrap.appendChild(body);
  return wrap;
}

/* ---- the public entry point ------------------------------------------------ */
export function openReading(o: OpenReadingOptions): ReadingHandle {
  ensureStyle();
  const base = (o.base || '').replace(/\/+$/, '');
  const tier = o.tier || 'oracle';
  const dateStr = o.date || new Date().toISOString().slice(0, 10);

  const view = el('div', { class: 'rdg-view', role: 'dialog', 'aria-label': 'Today\u2019s reading' });
  const shell = el('div', { class: 'rdg-shell' });
  const bar = el('div', { class: 'rdg-bar' });
  bar.appendChild(el('div', { class: 'rdg-h' }, o.title || 'Today\u2019s reading'));
  const closeBtn = el('button', { type: 'button', class: 'rdg-close', 'aria-label': 'Close' }, '\u00d7');
  bar.appendChild(closeBtn);
  shell.appendChild(bar);
  const status = el('div', { class: 'rdg-status' }, 'Reading the day for you. This takes a short moment.');
  shell.appendChild(status);
  const content = el('div', { class: 'rdg-content' });
  shell.appendChild(content);
  let shareInserted = false;
  function ensureShareBar(): void {
    if (shareInserted) return;
    shareInserted = true;
    const bar2 = shareControls({
      title: o.title || 'Today\u2019s reading',
      text: () => (o.title || 'Today\u2019s reading') + '\n\n' + content.innerText,
      node: () => content,
    });
    shell.appendChild(bar2);
  }
  view.appendChild(shell);
  o.container.appendChild(view);

  let live = true;
  function close(): void { live = false; if (view.parentNode) view.parentNode.removeChild(view); }
  closeBtn.addEventListener('click', close);

  function setStatus(text: string): void {
    if (!status.parentNode) shell.insertBefore(status, content);
    status.textContent = text;
  }
  function clearStatus(): void { if (status.parentNode) status.parentNode.removeChild(status); }

  /* paint a single body element for the current voice */
  function paintBody(body: HTMLElement, lens: Lens): void {
    clear(body);
    let text = '';
    if (body.classList.contains('rdg-voiced')) {
      text = pickVoice({ tradition: body.dataset.tradition || '', science: body.dataset.science || '', everyday: body.dataset.everyday || '' }, lens);
    } else {
      text = body.dataset.plain || '';
    }
    for (const p of paragraphs(text)) body.appendChild(el('p', { class: 'rdg-p' }, p));
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

  /** Build a voiced (or plain) body element that repaintVoice will keep in sync. */
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

  /**
   * A rich section card: a titled, collapsible panel that can carry a server
   * headline as a subhead, a framing hook, the voiced body, any extra elements
   * (the energies layer, the lunar badges, the Dreamspell texture, the
   * Saturn and Neptune backdrop, the disclaimer), and a quiet citation row.
   */
  interface RichSpec {
    title: string;
    subhead?: string;
    hook?: HTMLElement | null;
    body: SectionValue;
    preBody?: HTMLElement[];
    postBody?: HTMLElement[];
    citations?: unknown;
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

    const cites = citationRow(spec.citations);
    if (cites) card.appendChild(cites);

    if (!spec.lead) head.addEventListener('click', () => card.classList.toggle('open'));
    return card;
  }

  function render(raw: unknown): void {
    const outer = (raw && typeof raw === 'object') ? (raw as Record<string, unknown>) : {};
    const r = (outer.reading && typeof outer.reading === 'object' ? outer.reading : outer) as Record<string, unknown>;
    const moon = (outer.moon && typeof outer.moon === 'object' ? outer.moon : null) as Record<string, unknown> | null;
    clear(content);
    if (isRaw(r)) {
      const s = String(r.synthesis || '').trim();
      const note = el('div', { class: 'rdg-status' }, s && !s.startsWith('{') ? s : 'The reading came back in an unexpected shape. The engine is reachable; please try again in a moment.');
      content.appendChild(note);
      return;
    }
    clearStatus();

    /* headline, the one line at the top, when the engine supplies one */
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
      content.appendChild(h);
    }

    /* the synthesis, as the italic lead */
    const lead = buildRichSection({ title: 'Today', body: r.synthesis as SectionValue, collapsed: false, lead: true });
    if (lead) content.appendChild(lead);

    /* where the frameworks meet, open */
    const conv = (normaliseVoice(r.depth_synthesis as SectionValue) ? r.depth_synthesis : r.framework_convergence) as SectionValue;
    const convCites = (r.depth_synthesis && typeof r.depth_synthesis === 'object')
      ? (r.depth_synthesis as Record<string, unknown>).citations : undefined;
    const convCard = buildRichSection({ title: 'Where the frameworks meet', body: conv, citations: convCites, collapsed: false });
    if (convCard) content.appendChild(convCard);

    /* numerology, with the three energies as their own clear layer */
    const numObj = (r.numerology && typeof r.numerology === 'object') ? r.numerology as Record<string, unknown> : null;
    if (numObj || normaliseVoice(r.numerology as SectionValue)) {
      const energies = numObj ? energiesLayer(numObj.three_energies) : null;
      const pre: HTMLElement[] = [];
      pre.push(el('div', { class: 'rdg-hook' }, NUMEROLOGY_HOOK));
      const post: HTMLElement[] = [];
      if (energies) {
        post.push(el('div', { class: 'rdg-symbolic' }, 'The three energies of the day. Symbolic, Pythagorean numerology, master numbers preserved.'));
        post.push(energies);
      }
      const card = buildRichSection({
        title: 'Numerology of the day',
        subhead: numObj ? asString(numObj.headline) : '',
        preBody: pre,
        body: r.numerology as SectionValue,
        postBody: post,
        citations: numObj ? numObj.citations : undefined,
        collapsed: true,
      });
      if (card) content.appendChild(card);
    }

    /* lunar landscape, with the Black and Shiva windows */
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
        collapsed: true,
      });
      if (card) content.appendChild(card);
    }

    /* pacing across the day, kept distinct from numerology */
    const pacingObj = (r.pacing_section && typeof r.pacing_section === 'object') ? r.pacing_section as Record<string, unknown> : null;
    if (pacingObj && normaliseVoice(r.pacing_section as SectionValue)) {
      const card = buildRichSection({
        title: 'Pacing across the day',
        subhead: asString(pacingObj.headline),
        hook: el('div', { class: 'rdg-hook' }, PACING_HOOK),
        body: r.pacing_section as SectionValue,
        citations: pacingObj.citations,
        collapsed: true,
      });
      if (card) content.appendChild(card);
    }

    /* western astrology, the transits, with the Saturn and Neptune backdrop */
    const astroObj = (r.astrology && typeof r.astrology === 'object') ? r.astrology as Record<string, unknown> : null;
    if (astroObj) {
      const transitBody: SectionValue =
        (astroObj.tradition || astroObj.science || astroObj.everyday)
          ? astroObj
          : (asString(astroObj.main_transit_body) || asString(astroObj.main_transit));
      const post: HTMLElement[] = [];
      const sn = asString(astroObj.saturn_neptune);
      if (sn) {
        const bd = el('div', { class: 'rdg-backdrop' });
        bd.appendChild(el('div', { class: 'rdg-backdrop-label' }, 'Saturn and Neptune backdrop'));
        const firstPara = paragraphs(sn)[0] || sn;
        bd.appendChild(el('p', {}, firstPara));
        post.push(bd);
      }
      const card = buildRichSection({
        title: 'Western astrology, today\u2019s transits',
        subhead: asString(astroObj.main_transit_headline),
        hook: el('div', { class: 'rdg-hook' }, TRANSIT_HOOK),
        body: transitBody,
        postBody: post,
        citations: astroObj.citations,
        collapsed: true,
      });
      if (card) content.appendChild(card);
    }

    /* the day against the natal chart, oracle depth, partial until time and place */
    const natalObj = (r.natal_integration && typeof r.natal_integration === 'object') ? r.natal_integration as Record<string, unknown> : null;
    if (natalObj && normaliseVoice(r.natal_integration as SectionValue)) {
      const card = buildRichSection({
        title: 'Today against your natal chart',
        subhead: asString(natalObj.headline),
        hook: el('div', { class: 'rdg-hook' }, NATAL_HOOK),
        body: r.natal_integration as SectionValue,
        citations: natalObj.citations,
        collapsed: true,
      });
      if (card) content.appendChild(card);
    }

    /* dreamspell, with the tone and seal oracle texture, portal note, disclaimer */
    const dsObj = (r.dreamspell && typeof r.dreamspell === 'object') ? r.dreamspell as Record<string, unknown> : null;
    if (dsObj || normaliseVoice(r.dreamspell as SectionValue)) {
      const hook = dreamspellHook(dateStr);
      const pre: HTMLElement[] = [];
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
        content.appendChild(card);
      }
    }

    /* the body and shadow sections, when the engine supplies them, above the floor */
    const bodyObj = (r.body_section && typeof r.body_section === 'object') ? r.body_section as Record<string, unknown> : null;
    if (bodyObj && normaliseVoice(r.body_section as SectionValue)) {
      const card = buildRichSection({
        title: 'Body, today',
        subhead: asString(bodyObj.headline),
        body: r.body_section as SectionValue,
        citations: bodyObj.citations,
        collapsed: true,
      });
      if (card) content.appendChild(card);
    }
    const shadowObj = (r.shadow_section && typeof r.shadow_section === 'object') ? r.shadow_section as Record<string, unknown> : null;
    if (shadowObj && normaliseVoice(r.shadow_section as SectionValue)) {
      const card = buildRichSection({
        title: 'Where today might catch you',
        subhead: asString(shadowObj.headline),
        body: r.shadow_section as SectionValue,
        citations: shadowObj.citations,
        collapsed: true,
      });
      if (card) content.appendChild(card);
    }

    /* closing line */
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
      content.appendChild(c);
    }

    /* the scholarly sources, surfaced quietly at the foot */
    const sources = sourcesBlock(r.citationUnion, asString(r.sources));
    if (sources) content.appendChild(sources);

    ensureShareBar();
  }

  async function start(): Promise<string> {
    const prof = o.getProfile();
    const profile = prof
      ? { dob: prof.birthDate || null, birthTime: prof.birthTime || null, birthPlace: prof.birthPlace || null, name: prof.name || null, readingLang: o.getLens() }
      : { readingLang: o.getLens() };
    const payload = JSON.stringify({ date: dateStr, profile, tier, user_id: o.userId || null });
    const opts: RequestInit = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload };
    let res = await fetch(base + '/api/reading/start', opts);
    if (!res.ok && res.status >= 500) { await sleep(3000); res = await fetch(base + '/api/reading/start', opts); }
    if (!res.ok) throw new Error('start_' + res.status);
    const data = await res.json() as { jobId?: string };
    if (!data.jobId) throw new Error('no_job');
    return data.jobId;
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
      let st: { status: string; result?: unknown; phase1?: unknown; elapsed?: number };
      try { st = await (await fetch(base + '/api/reading/status/' + jobId)).json(); }
      catch (_e) { continue; }
      if (st.status === 'complete') { render(st.result); if (o.reflect) o.reflect((o.title || 'Your reading') + ' is ready, here under your hand.'); return; }
      if (st.status === 'error') { setStatus('The reading hit a snag on the server. Please try again shortly.'); return; }
      if (st.status === 'phase1_complete' && st.phase1 && !shownPhase1) {
        shownPhase1 = true;
        render(st.phase1);
        const composing = el('div', { class: 'rdg-note' }, 'The core is here. The fuller sections are still composing.');
        content.insertBefore(composing, content.firstChild);
      } else if (st.status === 'pending') {
        const secs = Math.round((Date.now() - t0) / 1000);
        setStatus('Reading the day for you. ' + secs + ' seconds in.');
      }
    }
    if (live) setStatus('This is taking longer than usual. Your reading is still composing on the server; please try again shortly.');
  }

  void run();
  return { close, repaintVoice };
}
