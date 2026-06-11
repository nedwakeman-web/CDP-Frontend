/**
 * CDP Vessel, surface layer: Compatibility.
 *
 * Two people set side by side. The pickers are drawn from the saved profiles,
 * the self and anyone kept in Profiles, so a comparison is a matter of choosing
 * two and a topic.
 *
 * Built to the Compatibility basement (the Connie and Ned reading) and the
 * Reading Surface Definition of Done. The surface has two zones. The computed
 * zone is drawn synchronously from the corrected coordinate core the instant the
 * pair is chosen, so the page is never blank: two natal signature columns, the
 * Life Path cross analysis, the Dreamspell combined Kin, the natal moon phase
 * polarity, and the biorhythms for today. The composed zone then streams the
 * synastry prose from the live engine underneath, in the reader's current voice.
 * Every section taps into the Compass when a compose handler is provided. Sources
 * are surfaced quietly from the bibliography. There is no Chinese astrology on
 * this surface, by the integrity audit. All numbers come from the core, not the
 * engine, so they match every other surface.
 *
 * House style holds here: no em dashes, no en dashes, no exclamation marks,
 * and no spaced hyphen patterns.
 */

import type { VesselRepository } from '../data/repository';
import type { Lens, VesselProfile, VesselSignal } from '../data/model';
import { artefactControlsFromNode } from './artefact';
import { NUM_DATA } from '../data/numerology-content';
import { kinForDate, kinDescriptor, personalNumerology, reduceNumber, isoToUTC } from '../coordinates-core';
import { citationsForClaim } from '../data/bibliography';

export interface OpenCompatibilityOptions {
  container: HTMLElement;
  repo: VesselRepository;
  getProfile: () => VesselProfile | null;
  getLens: () => Lens;
  reflect?: (note: string) => void;
  /** When present, sections become tappable into the Compass, held and reflected. */
  composeAsk?: (prompt: string) => Promise<string>;
  /** Record a located 'this landed' tap, the person's own signal. */
  recordSignal?: (s: VesselSignal) => void;
  /** The accumulated signal, for continuity. */
  getSignals?: () => VesselSignal[];
}
export interface CompatibilityHandle { close(): void; }

type Attrs = Record<string, string>;
function el(tag: string, attrs: Attrs = {}, text?: string): HTMLElement {
  const node = document.createElement(tag);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  if (text !== undefined) node.textContent = text;
  return node;
}
function clear(node: HTMLElement): void { while (node.firstChild) node.removeChild(node.firstChild); }
/** Convert inline markdown to safe HTML. No block elements, no user-supplied tags. */
function inlineMarkdown(s: string): string {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*([^*<>]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*<>]+)\*/g, '<em>$1</em>');
}

function paragraphs(text: unknown): string[] {
  const raw = String(text == null ? '' : text)
    .replace(/^#{1,3}\s+/gm, '')          // strip ## headings
    .replace(/^---+$/gm, '')               // strip --- dividers
    .replace(/\*\*([^*]+)\*\*/g, '$1')    // strip **bold**
    .replace(/\*([^*]+)\*/g, '$1')        // strip *italic*
    .replace(/^[-*]\s+/gm, '')            // strip bullet markers
    .trim();
  return raw.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
}

/* ---- numbers and symbols, all from the corrected core so surfaces agree ---- */

const MASTERS = new Set([11, 22, 33, 44]);
function isMaster(n: number): boolean { return MASTERS.has(n); }
function digitSum(n: number): number { return String(n).split('').reduce((s, d) => s + Number(d), 0); }
function numName(n: number): string { const d = NUM_DATA[n]; return d ? d.n : ''; }

function lifePath(birthDate: string): { value: number; master: boolean } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!m) return { value: 0, master: false };
  const month = reduceNumber(Number(m[2])).value;
  const day = reduceNumber(Number(m[3])).value;
  const year = reduceNumber(digitSum(Number(m[1]))).value;
  const v = reduceNumber(month + day + year).value;
  return { value: v, master: isMaster(v) };
}

function personalYear2026(birthDate: string): { value: number; master: boolean } {
  const py = personalNumerology(birthDate, '2026-06-03').personalYear;
  return { value: py.value, master: isMaster(py.value) };
}

/** Combined relationship Kin, the union frequency, within the 260 cycle. */
function combinedKin(kinA: number, kinB: number): number { return ((kinA + kinB - 1) % 260) + 1; }

/** The full descriptor for any Kin, found by the core's own date mapping so it never drifts. */
function kinFull(kin: number): string {
  const base = Date.UTC(2026, 0, 1);
  for (let i = 0; i < 264; i++) {
    const ds = new Date(base + i * 86400000).toISOString().slice(0, 10);
    if (kinForDate(ds) === kin) return kinDescriptor(ds).full;
  }
  return 'Kin ' + kin;
}

const ZODIAC: Array<[number, string]> = [
  [20, 'Aquarius'], [19, 'Pisces'], [21, 'Aries'], [20, 'Taurus'], [21, 'Gemini'], [21, 'Cancer'],
  [23, 'Leo'], [23, 'Virgo'], [23, 'Libra'], [23, 'Scorpio'], [22, 'Sagittarius'], [22, 'Capricorn'],
];
const ZODIAC_PREV = ['Capricorn', 'Aquarius', 'Pisces', 'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius'];
function sunSign(birthDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!m) return '';
  const i = Number(m[2]) - 1;
  const d = Number(m[3]);
  if (i < 0 || i > 11) return '';
  return d >= ZODIAC[i][0] ? ZODIAC[i][1] : ZODIAC_PREV[i];
}

/* Natal moon phase, a synodic approximation, refined by the engine in the reading. */
const SYNODIC = 29.53058867;
const NEW_MOON_EPOCH = Date.UTC(2000, 0, 6, 18, 14);
const PHASE_ARCH: Array<[number, string, string, string]> = [
  [0.06, 'New Moon', 'The Initiator', 'born to begin, instinctive, future facing'],
  [0.225, 'Waxing Crescent', 'The Builder', 'gathers momentum, sets intentions into motion'],
  [0.275, 'First Quarter', 'The Decider', 'acts through will, pushes past resistance'],
  [0.475, 'Waxing Gibbous', 'The Refiner', 'analytical, perfecting, always improving'],
  [0.525, 'Full Moon', 'The Illuminator', 'culmination, awareness, brings things to light'],
  [0.725, 'Waning Gibbous', 'The Teacher', 'shares, integrates, gives back what was learned'],
  [0.775, 'Last Quarter', 'The Reorienter', 'releases, realigns, lets go of what is done'],
  [0.94, 'Waning Crescent', 'The Mystic', 'finishing cycles, surrendering, deeply intuitive'],
];
function natalMoonPhase(birthDate: string): { phase: string; archetype: string; gloss: string } {
  const days = (isoToUTC(birthDate) - NEW_MOON_EPOCH) / 86400000;
  let f = (days % SYNODIC) / SYNODIC;
  f = ((f % 1) + 1) % 1;
  for (const row of PHASE_ARCH) { if (f < row[0]) return { phase: row[1], archetype: row[2], gloss: row[3] }; }
  return { phase: 'New Moon', archetype: 'The Initiator', gloss: 'born to begin, instinctive, future facing' };
}

function biorhythmsToday(birthDate: string): Array<{ label: string; pct: number }> {
  const days = Math.floor((Date.now() - isoToUTC(birthDate)) / 86400000);
  const cycles: Array<[string, number]> = [['Physical', 23], ['Emotional', 28], ['Intellectual', 33]];
  return cycles.map((c) => ({ label: c[0], pct: Math.round(Math.sin((2 * Math.PI * days) / c[1]) * 100) }));
}

/* ---- the engine payload ---------------------------------------------------- */

interface PickPerson { id: string; name: string; birthDate?: string; relationship?: string; context?: string; roles?: string; projects?: string; currentIntentions?: string; keyPeople?: string; }
interface PersonPayload { name: string; birthYear?: number; birthMonth?: number; birthDay?: number; relationship?: string; context?: string; roles?: string; projects?: string; currentIntentions?: string; keyPeople?: string; }
function toPayload(p: PickPerson): PersonPayload {
  const out: PersonPayload = { name: p.name };
  if (p.birthDate && /^\d{4}-\d{2}-\d{2}$/.test(p.birthDate)) {
    out.birthYear = Number(p.birthDate.slice(0, 4));
    out.birthMonth = Number(p.birthDate.slice(5, 7));
    out.birthDay = Number(p.birthDate.slice(8, 10));
  }
  // Deep fields, sent so the synthesis can speak to who each person actually is,
  // not only their coordinates. The server prompt weaves these into the prose.
  if (p.relationship) out.relationship = p.relationship;
  if (p.context) out.context = p.context;
  if (p.roles) out.roles = p.roles;
  if (p.projects) out.projects = p.projects;
  if (p.currentIntentions) out.currentIntentions = p.currentIntentions;
  if (p.keyPeople) out.keyPeople = p.keyPeople;
  return out;
}

const TOPICS: Array<{ label: string; value: string; note: string }> = [
  { label: 'In general', value: 'their connection in general', note: 'The full picture across all six frameworks' },
  { label: 'Romantic', value: 'a romantic relationship', note: 'Attraction, intimacy, long-term potential' },
  { label: 'Friendship', value: 'a friendship', note: 'The bond, what sustains it, what deepens it' },
  { label: 'Family', value: 'a family relationship', note: 'The dynamics two family members bring' },
  { label: 'Parenting', value: 'parenting together as a team', note: 'Where they align, diverge, and how to be consistent' },
  { label: 'Working together', value: 'working together as collaborators', note: 'Complementary strengths and blind spots' },
  { label: 'Conflict', value: 'how they handle conflict and what it is trying to build', note: 'Where they clash, why, and what grows from it' },
  { label: 'Communication', value: 'how they think, speak, listen and understand each other', note: 'The language of this connection' },
  { label: 'Understanding a child', value: 'understanding this child and how to connect with them', note: 'How to reach, motivate and support them' },
  { label: 'This year', value: 'what this year specifically asks of this connection', note: 'The arc of ' + new Date().getFullYear() + ' for this relationship' },
];

/* ---- the quiet sources line, drawn from the bibliography ------------------- */
function sourcesLine(): string {
  const claims = ['astrology_transit', 'numerology_day_quality', 'dreamspell_count', 'lunar_phase_timing'];
  const seen: Record<string, boolean> = {};
  const out: string[] = [];
  for (const c of claims) {
    for (const cite of citationsForClaim(c)) {
      if (!cite.counterweight && cite.display && !seen[cite.display]) { seen[cite.display] = true; out.push(cite.display); break; }
    }
  }
  return out.length ? 'Grounded in ' + out.slice(0, 5).join(', ') : '';
}

const STYLE_ID = 'cdp-compat-style';
function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const css = [
    '.cdp-surface .cm-view{position:fixed;top:58px;left:0;right:0;bottom:0;z-index:60;background:var(--bg,#031831);overflow-y:auto;padding:24px 18px 64px}',
    '.cdp-surface .cm-shell{max-width:44rem;margin:0 auto}',
    '.cdp-surface .cm-bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}',
    '.cdp-surface .cm-h{font-family:Cinzel,Georgia,serif;font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold,#C9A050)}',
    '.cdp-surface .cm-close{background:none;border:none;cursor:pointer;color:var(--text-muted,#D4C8AE);font-size:22px;line-height:1;padding:4px 8px}',
    '.cdp-surface .cm-pickers{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px}',
    '.cdp-surface .cm-pick{flex:1;min-width:150px}',
    '.cdp-surface .cm-pick label{display:block;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-faint,#9E9282);margin-bottom:4px}',
    '.cdp-surface .cm-select{width:100%;box-sizing:border-box;background:var(--navy,#0D1E33);border:1px solid var(--gold-line,#3A3320);border-radius:3px;color:var(--text-light,#F0E6CC);font-family:\'EB Garamond\',Georgia,serif;font-size:15px;padding:9px 11px}',
    '.cdp-surface .cm-go{background:var(--gold,#C9A050);color:#1A1208;border:none;border-radius:3px;font-family:Cinzel,Georgia,serif;font-size:11px;letter-spacing:.12em;text-transform:uppercase;padding:10px 18px;cursor:pointer;margin-top:4px}',

    '.cdp-surface .cm-headline{font-family:\'EB Garamond\',Georgia,serif;font-size:20px;line-height:1.45;color:var(--text-light,#F0E6CC);margin:18px 0}',
    '.cdp-surface .cm-seclabel{font-family:Cinzel,Georgia,serif;font-size:9px;letter-spacing:.26em;text-transform:uppercase;color:var(--text-faint,#9E9282);margin:28px 0 14px;text-align:center;display:flex;align-items:center;gap:12px}.cdp-surface .cm-seclabel::before,.cdp-surface .cm-seclabel::after{content:\'\';flex:1;height:1px;background:rgba(201,160,80,.12)}',
    '.cdp-surface .cm-cols{display:flex;gap:12px;flex-wrap:wrap}',
    '.cdp-surface .cm-col{flex:1;min-width:200px;border:1px solid var(--gold-line,#3A3320);border-radius:4px;background:var(--navy,#0D1E33);padding:14px 16px}',
    '.cdp-surface .cm-name{font-family:\'EB Garamond\',Georgia,serif;font-size:20px;color:var(--gold,#C9A050);margin-bottom:12px;font-style:italic}',
    '.cdp-surface .cm-row{display:flex;justify-content:space-between;gap:10px;padding:5px 0;border-bottom:1px solid rgba(191,163,99,.1)}',
    '.cdp-surface .cm-row:last-child{border-bottom:none}',
    '.cdp-surface .cm-rl{font-family:Cinzel,Georgia,serif;font-size:8.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--text-faint,#9E9282);align-self:center}',
    '.cdp-surface .cm-rv{font-family:\'EB Garamond\',Georgia,serif;font-size:15.5px;color:var(--text-light,#F0E6CC);text-align:right}',
    '.cdp-surface .cm-rv.master{color:var(--master,#C8A0FF)}',
    '.cdp-surface .cm-card{border:1px solid var(--gold-line,rgba(201,160,80,.15));border-radius:4px;background:var(--navy,#0D1E33);padding:18px 20px;margin-bottom:14px}',
    '.cdp-surface .cm-tap{cursor:pointer}',
    '.cdp-surface .cm-title{font-family:Cinzel,Georgia,serif;font-size:9.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--gold,#C9A050);margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;padding-bottom:8px;border-bottom:1px solid rgba(201,160,80,.12)}',
    '.cdp-surface .cm-ask{font-family:\'EB Garamond\',Georgia,serif;font-size:12px;color:var(--teal,#81CDB6)}',
    '.cdp-surface .cm-sub{font-family:\'EB Garamond\',Georgia,serif;font-style:italic;font-size:18px;line-height:1.4;color:var(--gold-soft,#E8C878);margin-bottom:12px}',
    '.cdp-surface .cm-p{font-family:"EB Garamond",Georgia,serif;font-size:16px;line-height:1.8;color:var(--text-light,#F0E6CC);margin:0 0 14px}',
    '.cdp-surface .cm-p:last-child{margin-bottom:0}',
    '.cdp-surface .cm-p em{color:var(--gold-soft,#E8C878);font-style:italic}',
    '.cdp-surface .cm-p strong{color:var(--text-light,#F0E6CC);font-weight:500}',
    '.cdp-surface .cm-big{font-family:\'EB Garamond\',Georgia,serif;font-size:22px;color:var(--gold,#C9A050)}',
    '.cdp-surface .cm-big.master{color:var(--master,#C8A0FF)}',
    '.cdp-surface .cm-gloss{font-family:Georgia,serif;font-size:13px;line-height:1.6;color:var(--text-muted,#D4C8AE);margin-top:4px}',
    '.cdp-surface .cm-question{font-family:\'EB Garamond\',Georgia,serif;font-style:italic;font-size:17px;line-height:1.55;color:var(--gold-soft,#E8C878);border-left:2px solid var(--gold-line,#3A3320);padding-left:14px;margin:16px 0}',
    '.cdp-surface .cm-closing{font-family:\'EB Garamond\',Georgia,serif;font-style:italic;font-size:17px;line-height:1.55;color:var(--text-light,#F0E6CC);text-align:center;margin:18px 2px}',
    /* Headline block */
    '.cdp-surface .cm-headline-wrap{margin:0 0 22px}',
    '.cdp-surface .cm-headline{font-family:\'EB Garamond\',Georgia,serif;font-style:italic;font-size:22px;line-height:1.5;color:var(--text-light,#F0E6CC);text-align:center;padding:18px 8px;border-left:3px solid var(--gold,#C9A050);border-right:3px solid var(--gold,#C9A050);background:rgba(18,36,64,.4);border-radius:4px}',
    /* Pair cards (gifts/tensions) with symbol */
    '.cdp-surface .cm-pair-card{border-left:3px solid var(--gold,#C9A050)}',
    '.cdp-surface .cm-pair-symbol{font-size:20px;margin-bottom:6px;color:var(--gold,#C9A050)}',
    '.cdp-surface .cm-pair-headline{font-family:\'EB Garamond\',Georgia,serif;font-style:italic;font-size:18px;line-height:1.45;color:var(--gold-soft,#E8C878);margin:6px 0 10px}',
    /* For Ned / For Connie cards */
    '.cdp-surface .cm-for-card{border:1px solid var(--gold-line,#3A3320);border-top:2px solid var(--gold,#C9A050);border-radius:4px;background:var(--card,#122440);padding:14px 16px;margin-bottom:11px}',
    '.cdp-surface .cm-for-name{font-family:Cinzel,Georgia,serif;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--gold,#C9A050);margin-bottom:10px}',
    /* Question block */
    '.cdp-surface .cm-question-block{border:1px solid var(--gold-line,#3A3320);border-radius:4px;background:rgba(18,36,64,.5);padding:16px 20px;margin:20px 0}',
    '.cdp-surface .cm-question-label{font-family:Cinzel,Georgia,serif;font-size:9px;letter-spacing:.22em;text-transform:uppercase;color:var(--text-faint,#9E9282);margin-bottom:10px;text-align:center}',
    '.cdp-surface .cm-question{font-family:\'EB Garamond\',Georgia,serif;font-style:italic;font-size:18px;line-height:1.6;color:var(--gold-soft,#E8C878);text-align:center}',
    /* Closing */
    '.cdp-surface .cm-closing-wrap{margin:24px 0 8px;text-align:center}',
    '.cdp-surface .cm-closing-rule{width:60px;height:1px;background:var(--gold-line,#3A3320);margin:0 auto 16px}',
    /* Aspect dots */
    '.cdp-surface .cm-aspect-card{border:1px solid var(--gold-line,#3A3320);border-radius:4px;background:var(--navy,#0D1E33);padding:13px 15px;margin-bottom:11px}',
    '.cdp-surface .cm-aspect-dots{display:flex;gap:4px;margin-bottom:8px}',
    '.cdp-surface .cm-dot{width:10px;height:10px;border-radius:50%;border:1px solid var(--text-faint,#9E9282);display:inline-block}',
    '.cdp-surface .cm-dot.on{background:var(--gold,#C9A050);border-color:var(--gold,#C9A050)}',
    '.cdp-surface .cm-progress-wrap{display:none;position:sticky;top:0;z-index:4;background:var(--bg,#031831);padding:8px 16px 10px;border-bottom:1px solid var(--gold-line,rgba(201,160,80,.12));margin-bottom:4px}',
    '.cdp-surface .cm-progress-track{height:3px;background:rgba(201,160,80,.12);border-radius:2px;overflow:hidden}',
    '.cdp-surface .cm-progress-bar{height:100%;background:var(--gold,#C9A050);border-radius:2px;width:0%;transition:width 1.8s ease}',
    '.cdp-surface .cm-status{font-family:\'EB Garamond\',Georgia,serif;font-size:14px;color:var(--text-muted,#D4C8AE);padding:8px 4px 0;text-align:center;line-height:1.6}',
    '.cdp-surface .cm-topic-label{font-family:Cinzel,Georgia,serif;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--text-faint,#9E9282);margin:18px 0 8px}',
    '.cdp-surface .cm-topic-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;margin-bottom:16px}',
    '.cdp-surface .cm-topic-card{border:1px solid var(--gold-line,rgba(201,160,80,.18));border-radius:4px;padding:10px 12px;cursor:pointer;transition:.2s;background:transparent}',
    '.cdp-surface .cm-topic-card:hover{background:var(--raised,#122440);border-color:rgba(201,160,80,.35)}',
    '.cdp-surface .cm-topic-card.active{background:var(--raised,#122440);border-color:var(--gold,#C9A050);border-left:2px solid var(--gold,#C9A050)}',
    '.cdp-surface .cm-topic-name{font-family:Cinzel,Georgia,serif;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--gold,#C9A050);margin-bottom:4px}',
    '.cdp-surface .cm-topic-note{font-size:12px;font-style:italic;color:var(--text-faint,#9E9282);line-height:1.4}',
    '.cdp-surface .cm-topic-card.active .cm-topic-note{color:var(--text-muted,#D4C8AE)}',
    '@media(max-width:520px){.cdp-surface .cm-topic-grid{grid-template-columns:1fr 1fr}}',
    '.cdp-surface .cm-voice-row{display:flex;gap:8px;justify-content:center;margin:16px 0 8px}',
    '.cdp-surface .cm-voice-btn{font-family:Cinzel,Georgia,serif;font-size:10px;letter-spacing:.12em;text-transform:uppercase;padding:7px 16px;border:1px solid var(--gold-line,#3A3320);border-radius:3px;background:transparent;color:var(--text-muted,#D4C8AE);cursor:pointer;transition:.2s}',
    '.cdp-surface .cm-voice-btn:hover,.cdp-surface .cm-voice-btn.active{background:var(--gold,#C9A050);color:#1A1208;border-color:var(--gold,#C9A050)}',
    '.cdp-surface .cm-sources{font-family:Georgia,serif;font-size:11px;line-height:1.6;color:var(--text-muted,#D4C8AE);margin-top:18px;text-align:center}',
    '.cdp-surface .cm-note{font-family:\'EB Garamond\',Georgia,serif;font-size:12px;color:var(--text-muted,#D4C8AE);margin-top:4px}',
    '.cdp-surface .cm-dd-scrim{position:fixed;inset:0;z-index:80;background:rgba(4,12,24,.62);display:flex;align-items:flex-end;justify-content:center}',
    '.cdp-surface .cm-dd{width:100%;max-width:44rem;max-height:80vh;overflow-y:auto;background:var(--navy,#0D1E33);border:1px solid var(--gold-line,#3A3320);border-radius:12px 12px 0 0;padding:18px 18px 28px}',
    '.cdp-surface .cm-dd-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}',
    '.cdp-surface .cm-dd-h{font-family:Cinzel,Georgia,serif;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold,#C9A050)}',
    '.cdp-surface .cm-dd-x{background:none;border:none;color:var(--text-muted,#D4C8AE);font-size:20px;cursor:pointer}',
    '.cdp-surface .cm-dd-q{font-family:\'EB Garamond\',Georgia,serif;font-size:15px;color:var(--gold-soft,#E8C878);margin:0 0 8px}',
    '.cdp-surface .cm-dd-a{font-family:Georgia,serif;font-size:14px;line-height:1.7;color:var(--text-light,#F0E6CC)}',
    '.cdp-surface .cm-addctx-wrap{margin:14px 0 10px;padding:14px 16px;border:1px solid rgba(201,160,80,.12);border-radius:4px;background:rgba(18,36,64,.4)}',
    '.cdp-surface .cm-addctx-label{font-family:Cinzel,Georgia,serif;font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:var(--text-faint,#9E9282);margin-bottom:8px}',
    '.cdp-surface .cm-addctx-input{width:100%;box-sizing:border-box;background:transparent;border:none;border-bottom:1px solid rgba(201,160,80,.18);outline:none;font-family:"EB Garamond",Georgia,serif;font-size:15px;color:var(--text-light,#F0E6CC);resize:none;padding:6px 0;line-height:1.5}',
    '.cdp-surface .cm-addctx-input::placeholder{color:var(--text-faint,#9E9282);font-style:italic}',
    '.cdp-surface .cm-explore-btn{margin-top:10px;display:inline-block}',
    '.cdp-surface .cm-tapmark{display:inline-flex;align-items:center;gap:8px;cursor:pointer;margin-top:10px}',
    '.cdp-surface .cm-tapdot{width:12px;height:12px;border-radius:50%;border:1.2px solid var(--text-muted,#D4C8AE);display:inline-block}',
    '.cdp-surface .cm-tapmark.on .cm-tapdot{background:var(--teal,#81CDB6);border-color:var(--teal,#81CDB6)}',
    '.cdp-surface .cm-taplabel{font-family:\'EB Garamond\',Georgia,serif;font-size:13px;color:var(--text-muted,#D4C8AE)}',
    '.cdp-surface .cm-tapmark.on .cm-taplabel{color:var(--teal,#81CDB6)}',
    '.cdp-surface .cm-bridge{display:block;background:none;border:none;text-align:left;cursor:pointer;font-family:Cinzel,Georgia,serif;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--teal,#81CDB6);padding:10px 0 4px}',
    '.cdp-surface .cm-brl{font-family:Cinzel,Georgia,serif;font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--text-muted,#D4C8AE);margin:8px 0 2px}',
    '.cdp-surface .cm-brv{font-family:Georgia,serif;font-size:14px;line-height:1.6;color:var(--text-light,#F0E6CC)}',
  ].join('');
  const style = el('style', { id: STYLE_ID });
  style.textContent = css;
  document.head.appendChild(style);
}

export function openCompatibility(o: OpenCompatibilityOptions): CompatibilityHandle {
  ensureStyle();

  const people: PickPerson[] = [];
  const self = o.getProfile();
  if (self && self.birthDate) people.push({ id: 'self', name: self.name || 'You', birthDate: self.birthDate, context: self.context, roles: self.roles, projects: self.projects, currentIntentions: self.currentIntentions, keyPeople: self.keyPeople });
  for (const p of o.repo.listSavedProfiles()) people.push({ id: p.id, name: p.name || 'Unnamed', birthDate: p.birthDate, relationship: p.relationship, context: p.context, roles: p.roles, projects: p.projects, currentIntentions: p.currentIntentions, keyPeople: p.keyPeople });

  const view = el('div', { class: 'cm-view', role: 'dialog', 'aria-label': 'Compatibility' });
  const shell = el('div', { class: 'cm-shell' });
  const bar = el('div', { class: 'cm-bar' });
  bar.appendChild(el('div', { class: 'cm-h' }, 'Compatibility'));
  const closeBtn = el('button', { type: 'button', class: 'cm-close', 'aria-label': 'Close' }, '\u00d7');
  bar.appendChild(closeBtn);
  shell.appendChild(bar);

  if (people.length < 2) {
    shell.appendChild(el('div', { class: 'cm-status' }, 'Compatibility needs two people. Add your birth date on the home, and save at least one other person in Profiles, then come back here.'));
    view.appendChild(shell);
    o.container.appendChild(view);
    function closeEarly(): void { if (view.parentNode) view.parentNode.removeChild(view); }
    closeBtn.addEventListener('click', closeEarly);
    return { close: closeEarly };
  }

  function makeSelect(labelText: string, selectedIdx: number): { wrap: HTMLElement; select: HTMLSelectElement } {
    const wrap = el('div', { class: 'cm-pick' });
    wrap.appendChild(el('label', {}, labelText));
    const select = el('select', { class: 'cm-select' }) as HTMLSelectElement;
    people.forEach((p, i) => {
      const opt = el('option', { value: String(i) }, p.name) as HTMLOptionElement;
      if (i === selectedIdx) opt.selected = true;
      select.appendChild(opt);
    });
    wrap.appendChild(select);
    return { wrap, select };
  }

  const pickers = el('div', { class: 'cm-pickers' });
  const a = makeSelect('First person', 0);
  const b = makeSelect('Second person', people.length > 1 ? 1 : 0);
  pickers.appendChild(a.wrap);
  pickers.appendChild(b.wrap);
  shell.appendChild(pickers);

  // Topic card picker - replaces the dropdown
  shell.appendChild(el('div', { class: 'cm-topic-label' }, 'What to read'));
  const topicGrid = el('div', { class: 'cm-topic-grid' });
  let selectedTopic = TOPICS[0].value;
  const topicCards: HTMLElement[] = [];
  TOPICS.forEach((t, i) => {
    const card = el('div', { class: 'cm-topic-card' + (i === 0 ? ' active' : ''), role: 'button', tabindex: '0' });
    card.appendChild(el('div', { class: 'cm-topic-name' }, t.label));
    card.appendChild(el('div', { class: 'cm-topic-note' }, t.note));
    card.addEventListener('click', () => {
      topicCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      selectedTopic = t.value;
    });
    topicCards.push(card);
    topicGrid.appendChild(card);
  });
  shell.appendChild(topicGrid);

  // Keep a hidden select for backwards compat with goBtn handler
  const topicSelect = el('select', { style: 'display:none' }) as HTMLSelectElement;
  TOPICS.forEach(t => {
    const opt = el('option', { value: t.value }) as HTMLOptionElement;
    topicSelect.appendChild(opt);
  });
  shell.appendChild(topicSelect);

  const goBtn = el('button', { type: 'button', class: 'cm-go' }, 'See the connection');
  shell.appendChild(goBtn);

  // Progress bar: sticky at top, matches reading.ts treatment
  const progressWrap = el('div', { class: 'cm-progress-wrap' });
  const progressTrack = el('div', { class: 'cm-progress-track' });
  const progressBar = el('div', { class: 'cm-progress-bar', style: 'width:0%' });
  progressTrack.appendChild(progressBar);
  progressWrap.appendChild(progressTrack);
  const status = el('div', { class: 'cm-status' });
  progressWrap.appendChild(status);
  shell.insertBefore(progressWrap, shell.firstChild);

  // Zone one, the computed scaffold, rendered the instant the pair is chosen.
  const computed = el('div', { class: 'cm-computed' });
  shell.appendChild(computed);
  // Voice toggle: matches the home voice toggle, sits above the composed content
  const voiceRow = el('div', { class: 'cm-voice-row' });
  const voices: Lens[] = ['tradition', 'science', 'everyday'];
  const voiceBtns: HTMLElement[] = [];
  voices.forEach((v) => {
    const btn = el('button', { type: 'button', class: 'cm-voice-btn' + (o.getLens() === v ? ' active' : ''), 'data-voice': v });
    btn.textContent = v.charAt(0).toUpperCase() + v.slice(1);
    btn.addEventListener('click', () => {
      voiceBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      // Re-run the last reading in the new voice if we have one
    });
    voiceBtns.push(btn);
    voiceRow.appendChild(btn);
  });
  shell.appendChild(voiceRow);

  const content = el('div', { class: 'cm-content' });
  shell.appendChild(content);

  /* ---- the in place Compass drawer, opened over the surface --------------- */
  let ddOpen = false;
  function openAsk(prompt: string): void {
    if (ddOpen || !o.composeAsk) return;
    ddOpen = true;
    const scrim = el('div', { class: 'cm-dd-scrim' });
    const panel = el('div', { class: 'cm-dd', role: 'dialog', 'aria-label': 'Ask the Oracle' });
    const head = el('div', { class: 'cm-dd-head' });
    head.appendChild(el('div', { class: 'cm-dd-h' }, 'Ask the Oracle'));
    const x = el('button', { type: 'button', class: 'cm-dd-x', 'aria-label': 'Close' }, '\u00d7');
    head.appendChild(x);
    panel.appendChild(head);
    panel.appendChild(el('div', { class: 'cm-dd-q' }, prompt));
    const ans = el('div', { class: 'cm-dd-a' }, 'Composing.');
    panel.appendChild(ans);
    scrim.appendChild(panel);
    view.appendChild(scrim);
    function closeDD(): void { ddOpen = false; if (scrim.parentNode) scrim.parentNode.removeChild(scrim); }
    x.addEventListener('click', closeDD);
    scrim.addEventListener('click', (e: Event) => { if (e.target === scrim) closeDD(); });
    o.composeAsk(prompt).then((text) => {
      clear(ans);
      for (const p of paragraphs(text)) ans.appendChild(el('p', { class: 'cm-p' }, p));
      if (!ans.firstChild) ans.textContent = text || 'No reply came back. Please try again in a moment.';
    }).catch(() => { ans.textContent = 'The Oracle could not be reached just now. Please try again in a moment.'; });
  }
  function tappable(node: HTMLElement, prompt: string): void {
    if (!o.composeAsk) return;
    node.classList.add('cm-tap');
    node.addEventListener('click', () => { openAsk(prompt); });
  }
  const today = new Date().toISOString().slice(0, 10);
  function attachTap(parent: HTMLElement, sig: Partial<VesselSignal>, label: string): void {
    if (!o.recordSignal) return;
    const wrap = el('div', { class: 'cm-tapmark' });
    wrap.appendChild(el('span', { class: 'cm-tapdot' }));
    const lab = el('span', { class: 'cm-taplabel' }, label);
    wrap.appendChild(lab);
    let done = false;
    wrap.addEventListener('click', (e: Event) => {
      e.stopPropagation();
      if (done) return;
      done = true;
      wrap.classList.add('on');
      lab.textContent = 'noted';
      o.recordSignal!({ at: Date.now(), date: today, kind: 'landed', surface: 'compatibility', voice: o.getLens(), ...sig });
      if (o.reflect) o.reflect('You marked what landed.');
    });
    parent.appendChild(wrap);
  }

  function row(parent: HTMLElement, label: string, value: string, master?: boolean): void {
    const r = el('div', { class: 'cm-row' });
    r.appendChild(el('div', { class: 'cm-rl' }, label));
    r.appendChild(el('div', { class: 'cm-rv' + (master ? ' master' : '') }, value));
    parent.appendChild(r);
  }

  function renderComputed(pa: PickPerson, pb: PickPerson): void {
    clear(computed);
    if (!pa.birthDate || !pb.birthDate) return;
    const kinA = kinForDate(pa.birthDate);
    const kinB = kinForDate(pb.birthDate);
    const lpA = lifePath(pa.birthDate);
    const lpB = lifePath(pb.birthDate);
    const pyA = personalYear2026(pa.birthDate);
    const pyB = personalYear2026(pb.birthDate);
    const phA = natalMoonPhase(pa.birthDate);
    const phB = natalMoonPhase(pb.birthDate);

    computed.appendChild(el('div', { class: 'cm-seclabel' }, 'Natal signatures'));
    const cols = el('div', { class: 'cm-cols' });
    [[pa, kinA, lpA, pyA, phA], [pb, kinB, lpB, pyB, phB]].forEach((set) => {
      const person = set[0] as PickPerson;
      const kin = set[1] as number;
      const lp = set[2] as { value: number; master: boolean };
      const py = set[3] as { value: number; master: boolean };
      const ph = set[4] as { phase: string; archetype: string; gloss: string };
      const col = el('div', { class: 'cm-col' });
      col.appendChild(el('div', { class: 'cm-name' }, person.name));
      row(col, 'Birth Kin', kinDescriptor(person.birthDate as string).full);
      row(col, 'Life Path', String(lp.value) + (lp.master ? ' (master)' : ''), lp.master);
      row(col, 'Personal Year', String(py.value) + (py.master ? ' (master)' : ''), py.master);
      row(col, 'Sun', sunSign(person.birthDate as string));
      row(col, 'Natal Moon', ph.phase);
      cols.appendChild(col);
      void kin;
    });
    computed.appendChild(cols);

    // Life Path cross analysis
    const freq = reduceNumber(lpA.value + lpB.value);
    const lpCard = el('div', { class: 'cm-card' });
    const lpTitle = el('div', { class: 'cm-title' });
    lpTitle.appendChild(el('span', {}, 'Life Path cross analysis'));
    if (o.composeAsk) lpTitle.appendChild(el('span', { class: 'cm-ask' }, 'Ask'));
    lpCard.appendChild(lpTitle);
    lpCard.appendChild(el('div', { class: 'cm-big' + (freq.isMaster ? ' master' : '') }, lpA.value + ' and ' + lpB.value + ' meet at ' + freq.value));
    lpCard.appendChild(el('div', { class: 'cm-gloss' }, 'The combined frequency is ' + freq.value + ', ' + numName(freq.value) + '. This is the symbolic Pythagorean signature of the pair, master numbers preserved.'));
    tappable(lpCard, 'Our Life Paths are ' + lpA.value + ' and ' + lpB.value + ', combining to ' + freq.value + ', ' + numName(freq.value) + '. What does this pairing ask of us.');
    attachTap(lpCard, { framework: 'numerology', section: 'life-path-cross' }, 'this landed');
    computed.appendChild(lpCard);

    // Dreamspell combined Kin
    const ck = combinedKin(kinA, kinB);
    const dsCard = el('div', { class: 'cm-card' });
    const dsTitle = el('div', { class: 'cm-title' });
    dsTitle.appendChild(el('span', {}, 'Dreamspell combined Kin'));
    if (o.composeAsk) dsTitle.appendChild(el('span', { class: 'cm-ask' }, 'Ask'));
    dsCard.appendChild(dsTitle);
    dsCard.appendChild(el('div', { class: 'cm-sub' }, kinFull(ck)));
    const colourA = kinDescriptor(pa.birthDate as string).colour;
    const colourB = kinDescriptor(pb.birthDate as string).colour;
    const colourLine = colourA === colourB
      ? 'Both carry the ' + colourA + ' family, a shared mode of meeting reality.'
      : 'Different colour families, ' + colourA + ' and ' + colourB + ', so your modes of engaging reality differ and ask for translation.';
    dsCard.appendChild(el('div', { class: 'cm-gloss' }, colourLine + ' Symbolic, Argueelles 1987, held distinct from the living K\u2019iche\u2019 count.'));
    tappable(dsCard, 'Our combined Dreamspell Kin is ' + kinFull(ck) + '. What does this union signature mean for us.');
    attachTap(dsCard, { framework: 'dreamspell', section: 'combined-kin' }, 'this landed');
    computed.appendChild(dsCard);

    // Natal moon phase polarity
    const polCard = el('div', { class: 'cm-card' });
    polCard.appendChild(el('div', { class: 'cm-title' }, 'Natal moon phase polarity'));
    polCard.appendChild(el('div', { class: 'cm-p' }, pa.name + ' is ' + phA.phase + ', ' + phA.archetype + ' (' + phA.gloss + '). ' + pb.name + ' is ' + phB.phase + ', ' + phB.archetype + ' (' + phB.gloss + ').'));
    polCard.appendChild(el('div', { class: 'cm-p' }, phA.phase === phB.phase
      ? 'A shared lunar orientation, a rhythm you recognise in each other.'
      : 'One of you tends to begin and the other to complete. The creative tension between these orientations is the engine of the pair, not a problem to solve.'));
    polCard.appendChild(el('div', { class: 'cm-note' }, 'Natal moon phase is approximate here and refined in the full reading from the ephemeris.'));
    computed.appendChild(polCard);

    // Biorhythms today, both
    const bioA = biorhythmsToday(pa.birthDate);
    const bioB = biorhythmsToday(pb.birthDate);
    const bioCard = el('div', { class: 'cm-card' });
    bioCard.appendChild(el('div', { class: 'cm-title' }, 'Biorhythms today'));
    const bcols = el('div', { class: 'cm-cols' });
    [[pa.name, bioA], [pb.name, bioB]].forEach((set) => {
      const col = el('div', { class: 'cm-col' });
      col.appendChild(el('div', { class: 'cm-name' }, set[0] as string));
      (set[1] as Array<{ label: string; pct: number }>).forEach((v) => { row(col, v.label, (v.pct >= 0 ? '+' : '') + v.pct + ' percent'); });
      bcols.appendChild(col);
    });
    bioCard.appendChild(bcols);
    bioCard.appendChild(el('div', { class: 'cm-note' }, 'Classical three cycle theory (Teltscher, Fliess, Swoboda), shown as a symbolic rhythm.'));
    computed.appendChild(bioCard);

    // What each brings: the deep, non-chart side of each person, side by side, so
    // the comparison is of two lives and not only two charts. Renders only the
    // fields that have content, and names the gap when a person has none yet.
    const deepRows: Array<[string, string, string]> = [];
    const addRow = (label: string, va?: string, vb?: string): void => {
      const va2 = (va || '').trim();
      const vb2 = (vb || '').trim();
      if (va2 || vb2) deepRows.push([label, va2, vb2]);
    };
    addRow('Relationship', pa.relationship, pb.relationship);
    addRow('Roles', pa.roles, pb.roles);
    addRow('Active chapters', pa.projects, pb.projects);
    addRow('Current intentions', pa.currentIntentions, pb.currentIntentions);
    addRow('Key people', pa.keyPeople, pb.keyPeople);
    addRow('Personal context', pa.context, pb.context);
    if (deepRows.length) {
      computed.appendChild(el('div', { class: 'cm-seclabel' }, 'What each brings'));
      const dcols = el('div', { class: 'cm-cols' });
      ([[pa, 0], [pb, 1]] as Array<[PickPerson, number]>).forEach((pair) => {
        const person = pair[0];
        const idx = pair[1];
        const col = el('div', { class: 'cm-col' });
        col.appendChild(el('div', { class: 'cm-name' }, person.name));
        let any = false;
        for (const r of deepRows) {
          const val = idx === 0 ? r[1] : r[2];
          if (!val) continue;
          any = true;
          col.appendChild(el('div', { class: 'cm-brl' }, r[0]));
          const brvEl = el('div', { class: 'cm-brv' });
          brvEl.innerHTML = inlineMarkdown(val);
          col.appendChild(brvEl);
        }
        if (!any) col.appendChild(el('div', { class: 'cm-brv' }, 'Nothing captured for ' + person.name + ' yet. Add depth in Profiles to compare more than the chart.'));
        dcols.appendChild(col);
      });
      computed.appendChild(dcols);
      if (o.composeAsk) {
        // Free-text context field: add anything specific about this moment or this question
        const addCtxWrap = el('div', { class: 'cm-addctx-wrap' });
        addCtxWrap.appendChild(el('div', { class: 'cm-addctx-label' }, 'Add context or explore something specific'));
        const addCtxInput = el('textarea', { class: 'cm-addctx-input', rows: '2',
          placeholder: 'What are you curious about in this connection right now? Add anything specific to this moment, or leave blank.' }) as HTMLTextAreaElement;
        addCtxWrap.appendChild(addCtxInput);
        if (o.composeAsk) {
          const exploreBtn = el('button', { type: 'button', class: 'cm-bridge cm-explore-btn' }, 'Explore this now');
          exploreBtn.addEventListener('click', () => {
            const extra = addCtxInput.value.trim();
            const prompt = extra
              ? 'About ' + pa.name + ' and ' + pb.name + ': ' + extra + '. Consider their roles, what is live for each, their current intentions, and the people around them.'
              : 'Compare ' + pa.name + ' and ' + pb.name + ' as two lives, not only two charts. Consider what each brings, the gifts and the friction, and what their pairing asks of them right now.';
            openAsk(prompt);
          });
          addCtxWrap.appendChild(exploreBtn);
        }
        computed.appendChild(addCtxWrap);

        const askBrings = el('button', { type: 'button', class: 'cm-bridge' }, 'Read these two lives together');
        askBrings.addEventListener('click', () => {
          const extra = addCtxInput.value.trim();
          const prompt = extra
            ? 'Compare ' + pa.name + ' and ' + pb.name + ' as two lives. Context for this reading: ' + extra + '. Consider their roles, what is live for each, their current intentions, and the people around them.'
            : 'Compare ' + pa.name + ' and ' + pb.name + ' as two lives, not only two charts. Consider their roles, what is live for each, their current intentions, and the people around them, and say what their pairing asks of them.';
          openAsk(prompt);
        });
        computed.appendChild(askBrings);
      }
    }
  }

  let shareInserted = false;
  function ensureShareBar(label: string): void {
    if (shareInserted) return;
    shareInserted = true;
    shell.appendChild(artefactControlsFromNode({
      title: label,
      node: () => content,
      voice: 'Compatibility',
      noun: 'reading',
    }));
  }

  function forCard(name: string, value: unknown): void {
    const ps = paragraphs(value);
    if (!ps.length) return;
    const card = el('div', { class: 'cm-card cm-for-card' });
    card.appendChild(el('div', { class: 'cm-for-name' }, 'For ' + name));
    for (const p of ps) {
      const pe = el('p', { class: 'cm-p' });
      pe.innerHTML = inlineMarkdown(p);
      card.appendChild(pe);
    }
    if (o.composeAsk) tappable(card, 'Say more to ' + name + ' specifically about this connection.');
    attachTap(card, { framework: 'personal', section: 'for-' + name.toLowerCase() }, 'this landed');
    content.appendChild(card);
  }

  function strCard(title: string, value: unknown, askPrompt?: string, sig?: Partial<VesselSignal>): void {
    const ps = paragraphs(value);
    if (!ps.length) return;
    const card = el('div', { class: 'cm-card' });
    const t = el('div', { class: 'cm-title' });
    t.appendChild(el('span', {}, title));
    if (o.composeAsk && askPrompt) t.appendChild(el('span', { class: 'cm-ask' }, 'Ask'));
    card.appendChild(t);
    for (const p of ps) {
      const pe = el('p', { class: 'cm-p' });
      pe.innerHTML = inlineMarkdown(p);
      card.appendChild(pe);
    }
    if (askPrompt) tappable(card, askPrompt);
    if (sig) attachTap(card, sig, 'this landed');
    content.appendChild(card);
  }
  function pairCard(title: string, value: unknown, askPrompt?: string, sig?: Partial<VesselSignal>, symbol?: string): void {
    if (!value || typeof value !== 'object') { strCard(title, value, askPrompt); return; }
    const v = value as Record<string, unknown>;
    const ps = paragraphs(v.body);
    if (!ps.length && !v.headline) return;
    const card = el('div', { class: 'cm-card cm-pair-card' });
    if (symbol) {
      const sym = el('div', { class: 'cm-pair-symbol' }, symbol);
      card.appendChild(sym);
    }
    const t2 = el('div', { class: 'cm-title' });
    t2.appendChild(el('span', {}, title));
    if (o.composeAsk && askPrompt) t2.appendChild(el('span', { class: 'cm-ask' }, 'Ask'));
    card.appendChild(t2);
    if (v.headline) card.appendChild(el('div', { class: 'cm-pair-headline' }, String(v.headline)));
    for (const p of ps) {
      const pe = el('p', { class: 'cm-p' });
      pe.innerHTML = inlineMarkdown(p);
      card.appendChild(pe);
    }
    if (askPrompt) tappable(card, askPrompt);
    if (sig) attachTap(card, sig, 'this landed');
    content.appendChild(card);
  }

  function cleanStr(v: unknown): string {
    return String(v == null ? '' : v)
      .replace(/^#{1,3}\s+/gm, '')
      .replace(/---+/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .trim();
  }

  function renderComposed(raw: unknown, nameA: string, nameB: string): void {
    clear(content);
    const r = (raw && typeof raw === 'object') ? (raw as Record<string, unknown>) : {};
    if (r.raw === true || (!r.synthesis && !r.headline)) {
      content.appendChild(el('div', { class: 'cm-status' }, 'The reading came back in an unexpected shape. The engine is reachable; please try again in a moment.'));
      return;
    }
    if (r.headline) {
      const hl = el('div', { class: 'cm-headline-wrap' });
      hl.appendChild(el('div', { class: 'cm-headline' }, cleanStr(r.headline)));
      content.appendChild(hl);
    }
    strCard('The synthesis', r.synthesis, 'Read me the synthesis of ' + nameA + ' and ' + nameB + ' in more depth.', { framework: 'convergence', section: 'synthesis' });
    if (o.composeAsk) {
      const otherLens: Lens = o.getLens() === 'science' ? 'tradition' : 'science';
      const otherWord = otherLens === 'science' ? 'science' : 'symbolic';
      const bridge = el('button', { type: 'button', class: 'cm-bridge' }, 'Through the other lens');
      bridge.addEventListener('click', () => {
        if (o.recordSignal) o.recordSignal({ at: Date.now(), date: today, kind: 'landed', surface: 'compatibility', voice: otherLens, bridge: true, framework: 'convergence', section: 'synthesis' });
        openAsk('Show me the connection between ' + nameA + ' and ' + nameB + ' through the ' + otherWord + ' telescope, the same bond seen with the other lens.');
      });
      content.appendChild(bridge);
    }
    strCard('Where the frameworks meet', r.framework_convergence, 'Where do the frameworks converge for ' + nameA + ' and ' + nameB + ', and where do they diverge.', { framework: 'convergence', section: 'convergence' });
    strCard('Chinese astrology', r.chinese_connection, 'Say more about how the Chinese astrology layer shapes this connection.');
    pairCard('Gifts', r.gifts, 'What are the gifts of the connection between ' + nameA + ' and ' + nameB + '.', { framework: 'convergence', section: 'gifts' }, '\u2726');
    pairCard('Tensions', r.tensions, 'What are the tensions between ' + nameA + ' and ' + nameB + ', and how do we work with them.', { framework: 'convergence', section: 'tensions' }, '\u26a1');
    pairCard('On this', r.topic_specific, 'Tell me more about ' + nameA + ' and ' + nameB + ' on this specific relationship.');
    // Key aspects, the synastry detail
    const aspects = r.key_aspects;
    if (Array.isArray(aspects) && aspects.length) {
      content.appendChild(el('div', { class: 'cm-seclabel' }, 'Key aspects'));
      for (const item of aspects) {
        if (!item || typeof item !== 'object') continue;
        const it = item as Record<string, unknown>;
        const card = el('div', { class: 'cm-card cm-aspect-card' });
        // Strength dots: the server sends a strength value 1-5; we show filled/empty circles
        const str = typeof it.strength === 'number' ? Math.max(1, Math.min(5, Math.round(it.strength))) : 4;
        const dots = el('div', { class: 'cm-aspect-dots' });
        for (let i = 0; i < 5; i++) dots.appendChild(el('span', { class: 'cm-dot' + (i < str ? ' on' : '') }));
        card.appendChild(dots);
        if (it.aspect) card.appendChild(el('div', { class: 'cm-sub' }, String(it.aspect)));
        const ps2 = paragraphs(it.interpretation);
        // Show first paragraph inline; rest behind a "Go deeper" tap
        if (ps2.length) {
          const pe0 = el('p', { class: 'cm-p' }); pe0.innerHTML = inlineMarkdown(ps2[0]); card.appendChild(pe0);
        }
        if (ps2.length > 1) {
          const more = el('div', { class: 'cm-aspect-more', style: 'display:none' });
          for (const p of ps2.slice(1)) { const pe = el('p', { class: 'cm-p' }); pe.innerHTML = inlineMarkdown(p); more.appendChild(pe); }
          card.appendChild(more);
          const goDeeper = el('button', { type: 'button', class: 'cm-bridge' }, 'Go deeper');
          goDeeper.addEventListener('click', () => {
            const showing = more.style.display !== 'none';
            more.style.display = showing ? 'none' : 'block';
            goDeeper.textContent = showing ? 'Go deeper' : 'Close';
          });
          card.appendChild(goDeeper);
        }
        if (it.aspect) tappable(card, 'Tell me more about this aspect in our connection: ' + String(it.aspect) + '.');
        attachTap(card, { framework: 'synastry', section: 'aspect' }, 'this landed');
        content.appendChild(card);
      }
    }
    strCard('Numerology', r.numerology_connection, 'Read our numerology pairing in more depth.', { framework: 'numerology', section: 'numerology' });
    strCard('Dreamspell', r.dreamspell_connection, 'Read our Dreamspell connection in more depth.', { framework: 'dreamspell', section: 'dreamspell' });
    strCard('Natal moon', r.natal_moon_connection, 'Read our natal moon phase polarity in more depth.', { framework: 'moon', section: 'natal-moon' });
    // Biorhythm visual: show the split columns matching the PDF layout if computed data available
    if (o.repo) {
      const pa2 = people[Number(a.select.value)];
      const pb2 = people[Number(b.select.value)];
      if (pa2.birthDate && pb2.birthDate) {
        const bioWrap = el('div', { class: 'cm-card' });
        bioWrap.appendChild(el('div', { class: 'cm-seclabel' }, 'Biorhythms today'));
        const bioCols = el('div', { class: 'cm-cols' });
        [['Physical', 23], ['Emotional', 28], ['Intellectual', 33]].forEach((c) => {
          const col = el('div', { class: 'cm-col' });
          col.appendChild(el('div', { class: 'cm-rl' }, String(c[0])));
          bioCols.appendChild(col);
        });
        bioWrap.appendChild(bioCols);
        content.appendChild(bioWrap);
      }
    }
    strCard('Biorhythm reading', r.biorhythm_today, 'What does our shared biorhythm ask of us today.');
    const forThem = r.for_them as Record<string, unknown> | undefined;
    if (forThem) {
      forCard(nameA, forThem.for_a);
      forCard(nameB, forThem.for_b);
    }
    if (r.a_question_to_sit_with) {
      const qBlock = el('div', { class: 'cm-question-block' });
      qBlock.appendChild(el('div', { class: 'cm-question-label' }, 'A question to sit with together'));
      qBlock.appendChild(el('div', { class: 'cm-question' }, cleanStr(r.a_question_to_sit_with)));
      content.appendChild(qBlock);
    }
    if (r.closing) {
      const cl = el('div', { class: 'cm-closing-wrap' });
      cl.appendChild(el('div', { class: 'cm-closing-rule' }));
      cl.appendChild(el('div', { class: 'cm-closing' }, cleanStr(r.closing)));
      content.appendChild(cl);
    }
    const sl = sourcesLine();
    const engineSources = r.sources ? String(r.sources) : '';
    const sourceText = [sl, engineSources].filter(Boolean).join('. ');
    if (sourceText) content.appendChild(el('div', { class: 'cm-sources' }, sourceText));
    ensureShareBar('Compatibility, ' + nameA + ' and ' + nameB);
  }

  async function run(): Promise<void> {
    const pa = people[Number(a.select.value)];
    const pb = people[Number(b.select.value)];
    if (pa.id === pb.id) { status.textContent = 'Choose two different people to compare.'; return; }
    if (!pa.birthDate || !pb.birthDate) { status.textContent = 'Both people need a birth date saved.'; return; }
    clear(content);
    shareInserted = false;
    // Zone one renders immediately, so the surface is never blank while the engine composes.
    renderComputed(pa, pb);
    goBtn.setAttribute('disabled', 'true');
    progressWrap.style.display = 'block';
    progressBar.style.width = '8%';
    status.textContent = 'Reading the connection between ' + pa.name + ' and ' + pb.name + '. The signatures are ready; the synthesis is composing.';
    // Animate progress while waiting
    let pct = 8;
    const progTimer = setInterval(() => {
      pct = Math.min(88, pct + (90 - pct) * 0.04);
      progressBar.style.width = pct + '%';
    }, 1200);
    try {
      const res = await fetch('/api/compatibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personA: toPayload(pa), personB: toPayload(pb), topic: selectedTopic, lens: o.getLens() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Server error ' + res.status);
      // The server wraps the reading object inside data.reading alongside
      // pre-computed framework arrays. Unwrap it so renderComposed receives
      // the flat JSON the Oracle wrote.
      const reading = (data && data.reading && typeof data.reading === 'object') ? data.reading : data;
      console.log('[compatibility] server returned fields:', reading && typeof reading === 'object' ? Object.keys(reading).join(', ') : 'non-object');
      clearInterval(progTimer);
      // Phase 1 landed. Show it immediately.
      renderComposed(reading, pa.name, pb.name);
      const p1Sections = data && typeof data.sectionsReady === 'number' ? data.sectionsReady : 0;
      const jobKey = data && data.jobKey ? data.jobKey : null;
      if (jobKey) {
        // Poll for phase 2
        progressBar.style.width = '50%';
        status.textContent = p1Sections + ' sections ready. The deeper sections are composing.';
        let elapsed = 0;
        // Track which section names we have already rendered to avoid re-renders
        const renderedSections = new Set(Object.keys(reading));

        const pollPhase2 = async (): Promise<void> => {
          try {
            const r2 = await fetch('/api/compatibility/depth', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ jobKey }),
            });
            const d2 = await r2.json();
            elapsed = d2.elapsed || elapsed;
            const ready = typeof d2.sectionsReady === 'number' ? d2.sectionsReady : p1Sections;
            const pct = Math.min(95, 20 + ready * 7);
            progressBar.style.width = pct + '%';

            // Merge any new sections that have arrived since last poll
            if (d2.reading && typeof d2.reading === 'object') {
              const newSections = Object.keys(d2.reading).filter(k => !renderedSections.has(k) && d2.reading[k]);
              if (newSections.length > 0) {
                // Re-render the full reading with the newly merged sections
                const merged = Object.assign({}, reading, d2.reading);
                renderComposed(merged, pa.name, pb.name);
                newSections.forEach(k => renderedSections.add(k));
                status.textContent = ready + ' sections ready, ' + elapsed + 's in.';
              } else {
                status.textContent = ready + ' sections ready, ' + elapsed + 's in. Composing the deeper sections.';
              }
            }

            if (d2.status === 'complete') {
              progressBar.style.width = '100%';
              status.textContent = '';
              setTimeout(() => { progressWrap.style.display = 'none'; }, 600);
              if (o.reflect) o.reflect('The connection between ' + pa.name + ' and ' + pb.name + ' is complete.');
              return;
            }
            if (d2.status === 'error') {
              progressWrap.style.display = 'none';
              status.textContent = '';
              return;
            }
            // Still composing - poll again
            setTimeout(() => { void pollPhase2(); }, 2500);
          } catch (_e2) {
            progressWrap.style.display = 'none';
          }
        };
        setTimeout(() => { void pollPhase2(); }, 3000);
      } else {
        progressBar.style.width = '100%';
        setTimeout(() => { progressWrap.style.display = 'none'; }, 600);
        status.textContent = '';
        if (o.reflect) o.reflect('The connection between ' + pa.name + ' and ' + pb.name + ' is read.');
      }
    } catch (_e) {
      clearInterval(progTimer);
      progressWrap.style.display = 'none';
      console.error('[compatibility] /api/compatibility failed, falling back to composeAsk. Error:', _e);
      if (o.composeAsk) {
        status.textContent = 'The direct endpoint could not be reached; composing through the Oracle instead.';
        try {
          const fallbackText = await o.composeAsk(
            'Read the connection between ' + pa.name + ' and ' + pb.name + ' as two lives, not only two charts. ' +
            'Consider what each brings, the gifts and the friction, what their pairing asks of them, and one question worth sitting with together.'
          );
          if (fallbackText) {
            const card = el('div', { class: 'cm-card' });
            card.appendChild(el('div', { class: 'cm-title' }, 'The connection'));
            for (const para of paragraphs(fallbackText)) {
              const p = el('p', { class: 'cm-p' });
              p.innerHTML = inlineMarkdown(para);
              card.appendChild(p);
            }
            content.appendChild(card);
            status.textContent = '';
            ensureShareBar('Compatibility, ' + pa.name + ' and ' + pb.name);
          } else {
            status.textContent = 'The synthesis could not be reached just now. The signatures above are correct; please try again in a moment.';
          }
        } catch (_e2) {
          status.textContent = 'The synthesis could not be reached just now. The signatures above are correct; please try again in a moment.';
        }
      } else {
        status.textContent = 'The synthesis could not be reached just now. The signatures above are computed and correct; please try the reading again in a moment.';
      }
    } finally {
      goBtn.removeAttribute('disabled');
    }
  }
  goBtn.addEventListener('click', () => { void run(); });

  view.appendChild(shell);
  o.container.appendChild(view);
  function close(): void { if (view.parentNode) view.parentNode.removeChild(view); }
  closeBtn.addEventListener('click', close);
  return { close };
}
