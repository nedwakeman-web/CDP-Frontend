/**
 * CDP Vessel, surface layer: My year, the long view and cosmic context.
 *
 * Built to the Sky Standard, not the floor. The computed long view (the
 * universal year, the personal year and its arc, the fixed signature) renders
 * instantly from the corrected core, with the canonical Life Path that matches
 * the card and the compatibility surface, so no number disagrees across the
 * Vessel. On that base sit the four moves of the measurable impact model:
 *
 *   1. The located 'this landed' tap, attached to the section, voice, and
 *      framework, so attribution is carried by the tap, not asked for.
 *   2. The opportunistic reflection, what gathered since you were last here,
 *      the home telescope and, foregrounded, the cross telescope rate.
 *   3. The live bridge, the personal year turned to the other telescope on the
 *      same coordinate, where the tap is the cross telescope signal.
 *   4. The emergent surface, the felt made legible, patterns named from the
 *      person's own signal, always as observation and never as forecast, and
 *      with the null named as readily as the pattern.
 *
 * The signal is read and written through the options, so the host owns
 * persistence. When the signal is thin the surface says so honestly rather
 * than inventing a pattern. No reading collapses to the home lens; the bridge
 * is always offered, because the breakthrough is the value.
 *
 * House style holds here: no em dashes, no en dashes, no exclamation marks,
 * and no spaced hyphen patterns.
 */

import type { Lens, VesselProfile, HeldIntention, VesselSignal } from '../data/model';
import { kinForDate, kinDescriptor, descriptorForKin, personalNumerology, reduceNumber } from '../coordinates-core';
import { NUM_DATA, PY_ARC } from '../data/numerology-content';
import { shareControls } from './share';
import { citationsForClaim } from '../data/bibliography';
import { homeTelescope, crossTelescopeRate, intentionRhythm, bothTelescopesProven } from '../data/outcome-signal';

export interface OpenYearOptions {
  container: HTMLElement;
  getProfile: () => VesselProfile | null;
  getLens: () => Lens;
  reflect?: (note: string) => void;
  /** When present, sections tap into the Compass and the bridge composes in place. */
  composeAsk?: (prompt: string) => Promise<string>;
  /** The accumulated located taps and outcomes, the person's own signal. */
  getSignals?: () => VesselSignal[];
  /** Record a located 'this landed' tap. */
  recordSignal?: (s: VesselSignal) => void;
  /** The held intentions, for what is moving. */
  getIntentions?: () => HeldIntention[];
  /** Record the person's own verdict on a held intention. */
  recordOutcome?: (intentionId: string, moved: 'well' | 'waiting' | 'mixed') => void;
}
export interface YearHandle { close(): void; }

type Attrs = Record<string, string>;
function el(tag: string, attrs: Attrs = {}, text?: string): HTMLElement {
  const node = document.createElement(tag);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  if (text !== undefined) node.textContent = text;
  return node;
}

/* ---- numbers, the canonical forms used across every surface ---------------- */

const MASTERS = new Set([11, 22, 33, 44]);
function isMaster(n: number): boolean { return MASTERS.has(n); }
function digitsOf(n: number): number { return String(n).split('').reduce((s, d) => s + Number(d), 0); }
function numName(n: number): string { const d = NUM_DATA[n]; return d ? d.n : ''; }
function lifePath(birthDate: string): { value: number; master: boolean } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!m) return { value: 0, master: false };
  const month = reduceNumber(Number(m[2])).value;
  const day = reduceNumber(Number(m[3])).value;
  const year = reduceNumber(digitsOf(Number(m[1]))).value;
  const v = reduceNumber(month + day + year).value;
  return { value: v, master: isMaster(v) };
}


/* ---- Chinese zodiac, ported from the monolith with the lunar new year correction ---- */
const CHINESE_ANIMALS = ['Rat', 'Ox', 'Tiger', 'Rabbit', 'Dragon', 'Snake', 'Horse', 'Goat', 'Monkey', 'Rooster', 'Dog', 'Pig'];
const CHINESE_ELEMENTS = ['Metal', 'Metal', 'Water', 'Water', 'Wood', 'Wood', 'Fire', 'Fire', 'Earth', 'Earth'];
const CNY_DATES: Record<number, [number, number]> = { 1950:[1,27],1951:[2,6],1952:[1,27],1953:[2,14],1954:[2,3],1955:[1,24],1956:[2,12],1957:[1,31],1958:[2,18],1959:[2,8],1960:[1,28],1961:[2,15],1962:[2,5],1963:[1,25],1964:[2,13],1965:[2,2],1966:[1,21],1967:[2,9],1968:[1,30],1969:[2,17],1970:[2,6],1971:[1,27],1972:[2,15],1973:[2,3],1974:[1,23],1975:[2,11],1976:[1,31],1977:[2,18],1978:[2,7],1979:[1,28],1980:[2,16],1981:[2,5],1982:[1,25],1983:[2,13],1984:[2,2],1985:[2,20],1986:[2,9],1987:[1,29],1988:[2,17],1989:[2,6],1990:[1,27],1991:[2,15],1992:[2,4],1993:[1,23],1994:[2,10],1995:[1,31],1996:[2,19],1997:[2,7],1998:[1,28],1999:[2,16],2000:[2,5],2001:[1,24],2002:[2,12],2003:[2,1],2004:[1,22],2005:[2,9],2006:[1,29],2007:[2,18],2008:[2,7],2009:[1,26],2010:[2,14],2011:[2,3],2012:[1,23],2013:[2,10],2014:[1,31],2015:[2,19],2016:[2,8],2017:[1,28],2018:[2,16],2019:[2,5],2020:[1,25],2021:[2,12],2022:[2,1],2023:[1,22],2024:[2,10],2025:[1,29],2026:[2,17] };
function chineseYear(y: number, birthMonth?: number, birthDay?: number): { animal: string; element: string } {
  let eff = y;
  if (birthMonth && birthDay && CNY_DATES[y]) {
    const cny = CNY_DATES[y];
    if (birthMonth < cny[0] || (birthMonth === cny[0] && birthDay < cny[1])) eff = y - 1;
  }
  const base = 1900;
  const idx = (((eff - base) % 12) + 12) % 12;
  const eidx = (((eff - base) % 10) + 10) % 10;
  return { animal: CHINESE_ANIMALS[idx], element: CHINESE_ELEMENTS[eidx] };
}

/* ---- the slow transits of this era, ported from the monolith, rewritten to house style ---- */
const SLOW_TRANSITS: Array<{ glyph: string; name: string; duration: string; desc: string }> = [
  { glyph: '\u2644', name: 'Saturn in Aries', duration: 'May 2025 to Apr 2028',
    desc: 'Saturn in Aries is a passage that comes once in twenty nine years. The archetype of structure, discipline, and karma moves through the sign of the self, of initiative and new beginnings. The personal challenge is to build with courage rather than to retreat into what is already known. Structures that no longer serve collapse, and new ones built with integrity last a generation. This transit rewards those who act from conviction rather than convention.' },
  { glyph: '\u2646', name: 'Neptune in Aries', duration: 'Mar 2025 to Jan 2039',
    desc: 'Neptune enters Aries for the first time since the years 1861 to 1875, the era of the national unification movements across Europe. The planet of dissolution, spirituality, and collective dreams moves into the sign of individual will and fresh beginnings. The invitation is to act from vision rather than ego, to pioneer something larger than personal ambition. The risk is idealism mistaken for action, or martyrdom mistaken for sacrifice.' },
  { glyph: '\u2644\u2229\u2646', name: 'Saturn conjunct Neptune, first degree of Aries', duration: 'Exact Feb to Jul 2026',
    desc: 'This is the civilisational hinge of our era. Saturn, the planet of structure, karma, and material reality, meets Neptune, the planet of dissolution, vision, and the collective dream, at the very first degree of the zodiac, the point of absolute beginning. The last Saturn and Neptune conjunction was in 1989, the year the Berlin Wall fell. Before that came 1952 and the post war rebuilding, and 1917 and the Russian Revolution. These conjunctions mark the moments when an old order dissolves and a new architecture of collective life must be consciously chosen. The window runs across 2025 to 2027.' },
  { glyph: '\u2645', name: 'Jupiter in Cancer', duration: 'Jun 2025 to Jun 2026',
    desc: 'Jupiter in Cancer is held to be one of its most fortunate placements, the planet of expansion in the sign of home, nourishment, memory, and belonging. This year favours emotional intelligence, the deepening of roots, and growth that comes through care rather than conquest. Family matters, ancestral healing, and investment in place and community are all strongly supported.' },
  { glyph: '\u26e2', name: 'Uranus in Gemini', duration: 'Jul 2025 to Aug 2033',
    desc: 'Uranus moves into Gemini for the first time since the years 1941 to 1949, the era of radio, radar, and the first computers. The planet of disruption and revolution enters the sign of communication, information, and the mind. Expect rapid and unpredictable transformation in how humanity thinks, communicates, and connects. Artificial intelligence, language, transport networks, and the very structure of knowledge are all in flux.' },
];


/* ---- sources, quiet, from the bibliography -------------------------------- */
function sourcesLine(): string {
  const claims = ['numerology_day_quality', 'dreamspell_count', 'pacing_circadian'];
  const seen: Record<string, boolean> = {};
  const out: string[] = [];
  for (const c of claims) {
    for (const cite of citationsForClaim(c)) {
      if (!cite.counterweight && cite.display && !seen[cite.display]) { seen[cite.display] = true; out.push(cite.display); break; }
    }
  }
  return out.length ? 'Grounded in ' + out.slice(0, 4).join(', ') : '';
}

const STYLE_ID = 'cdp-year-style';
function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const css = [
    '.cdp-surface .yr-view{position:fixed;top:58px;left:0;right:0;bottom:0;z-index:60;background:var(--bg,#0A1828);overflow-y:auto;padding:24px 18px 64px}',
    '.cdp-surface .yr-shell{max-width:44rem;margin:0 auto}',
    '.cdp-surface .yr-bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}',
    '.cdp-surface .yr-h{font-family:Cinzel,Georgia,serif;font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold,#C9A050)}',
    '.cdp-surface .yr-close{background:none;border:none;cursor:pointer;color:var(--text-dim,#D4C8AE);font-size:22px;line-height:1;padding:4px 8px}',
    '.cdp-surface .yr-close:hover{color:var(--gold,#C9A050)}',
    '.cdp-surface .yr-section{font-family:Cinzel,Georgia,serif;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--text-faint,#9E9282);margin:24px 0 10px}',
    '.cdp-surface .yr-card{display:flex;gap:14px;border:1px solid var(--gold-line,#3A3320);border-radius:4px;background:var(--navy,#0D1E33);padding:14px 16px;margin-bottom:11px}',
    '.cdp-surface .yr-num{font-family:\'EB Garamond\',Georgia,serif;font-size:34px;line-height:1;color:var(--gold,#C9A050);min-width:46px;text-align:center}',
    '.cdp-surface .yr-num.master{color:var(--master,#C8A0FF)}',
    '.cdp-surface .yr-body{flex:1;min-width:0}',
    '.cdp-surface .yr-label{font-family:Cinzel,Georgia,serif;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-faint,#9E9282)}',
    '.cdp-surface .yr-title{font-family:\'EB Garamond\',Georgia,serif;font-size:19px;color:var(--text-light,#F0E6CC);margin:2px 0 6px}',
    '.cdp-surface .yr-key{font-size:12px;color:var(--gold-soft,#E8C878);margin-bottom:6px}',
    '.cdp-surface .yr-desc{font-family:Georgia,serif;font-size:14px;line-height:1.7;color:var(--text-light,#F0E6CC)}',
    '.cdp-surface .yr-kin{font-family:\'EB Garamond\',Georgia,serif;font-size:17px;color:var(--text-light,#F0E6CC)}',
    '.cdp-surface .yr-symbolic{font-family:\'EB Garamond\',Georgia,serif;font-style:italic;font-size:12px;color:var(--text-dim,#D4C8AE);margin:2px 0 14px}',
    '.cdp-surface .yr-cycle{display:grid;grid-template-columns:repeat(9,1fr);gap:5px;margin:4px 0 10px}',
    '.cdp-surface .yr-cycle-cell{text-align:center;padding:8px 0;border:1px solid var(--gold-line,#3A3320);border-radius:3px;font-family:\'EB Garamond\',Georgia,serif;font-size:14px;color:var(--text-dim,#D4C8AE)}',
    '.cdp-surface .yr-cycle-cell.on{border-color:var(--gold,#C9A050);color:var(--gold,#C9A050);background:var(--raised,#13284A)}',
    '.cdp-surface .yr-arc{font-family:Georgia,serif;font-size:14px;line-height:1.7;color:var(--text-light,#F0E6CC);margin:0 0 6px}',
    '.cdp-surface .yr-months{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:4px 0 10px}',
    '.cdp-surface .yr-month-cell{text-align:center;padding:9px 0;border:1px solid var(--gold-line,#3A3320);border-radius:3px;background:var(--navy,#0D1E33);cursor:pointer}',
    '.cdp-surface .yr-month-m{font-family:Cinzel,Georgia,serif;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-faint,#9E9282)}',
    '.cdp-surface .yr-month-n{font-family:\'EB Garamond\',Georgia,serif;font-size:18px;color:var(--gold,#C9A050);margin-top:2px}',
    '.cdp-surface .yr-month-cell.master .yr-month-n{color:var(--master,#C8A0FF)}',
    '.cdp-surface .yr-empty{font-family:\'EB Garamond\',Georgia,serif;font-style:italic;font-size:14px;color:var(--text-dim,#D4C8AE);border:1px dashed var(--gold-line,#3A3320);border-radius:4px;padding:18px;text-align:center}',
    '.cdp-surface .yr-tap{display:inline-flex;align-items:center;gap:8px;cursor:pointer;margin-top:10px}',
    '.cdp-surface .yr-tapdot{width:12px;height:12px;border-radius:50%;border:1.2px solid var(--text-faint,#9E9282);display:inline-block}',
    '.cdp-surface .yr-tap.on .yr-tapdot{background:var(--teal,#81CDB6);border-color:var(--teal,#81CDB6)}',
    '.cdp-surface .yr-taplabel{font-family:\'EB Garamond\',Georgia,serif;font-style:italic;font-size:13px;color:var(--text-dim,#D4C8AE)}',
    '.cdp-surface .yr-tap.on .yr-taplabel{color:var(--teal,#81CDB6)}',
    '.cdp-surface .yr-bridge{display:block;background:none;border:none;text-align:left;cursor:pointer;font-family:Cinzel,Georgia,serif;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--teal,#81CDB6);padding:10px 0 2px}',
    '.cdp-surface .yr-emergent{border:1px solid var(--gold-line,#3A3320);border-radius:5px;background:var(--navy,#0D1E33);padding:16px 18px;margin-bottom:11px}',
    '.cdp-surface .yr-em-call{border:1px solid rgba(201,160,80,.5);border-radius:8px;background:var(--raised,#13284A);padding:13px 15px;margin:10px 0}',
    '.cdp-surface .yr-em-p{font-family:Georgia,serif;font-size:14px;line-height:1.7;color:var(--text-light,#F0E6CC);margin:0 0 8px}',
    '.cdp-surface .yr-em-em{font-family:\'EB Garamond\',Georgia,serif;font-style:italic;font-size:15px;color:var(--gold-soft,#E8C878);margin:0}',
    '.cdp-surface .yr-foot{font-family:\'EB Garamond\',Georgia,serif;font-style:italic;font-size:12px;color:var(--text-dim,#D4C8AE);margin-top:6px}',
    '.cdp-surface .yr-move{display:flex;align-items:flex-start;gap:10px;border:1px solid var(--gold-line,#3A3320);border-radius:4px;background:var(--navy,#0D1E33);padding:12px 14px;margin-bottom:9px}',
    '.cdp-surface .yr-move-t{flex:1;font-family:Georgia,serif;font-size:14px;line-height:1.6;color:var(--text-light,#F0E6CC)}',
    '.cdp-surface .yr-move-b{background:none;border:1px solid var(--gold-line,#3A3320);color:var(--text-dim,#D4C8AE);font-family:\'EB Garamond\',Georgia,serif;font-size:12px;padding:5px 10px;border-radius:3px;cursor:pointer;white-space:nowrap}',
    '.cdp-surface .yr-move-b.on{border-color:var(--teal,#81CDB6);color:var(--teal,#81CDB6)}',
    '.cdp-surface .yr-sources{font-family:Georgia,serif;font-size:11px;line-height:1.6;color:var(--text-dim,#D4C8AE);margin-top:18px;text-align:center}',
    '.cdp-surface .yr-dd-scrim{position:fixed;inset:0;z-index:80;background:rgba(4,12,24,.62);display:flex;align-items:flex-end;justify-content:center}',
    '.cdp-surface .yr-dd{width:100%;max-width:44rem;max-height:80vh;overflow-y:auto;background:var(--navy,#0D1E33);border:1px solid var(--gold-line,#3A3320);border-radius:12px 12px 0 0;padding:18px 18px 28px}',
    '.cdp-surface .yr-dd-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}',
    '.cdp-surface .yr-dd-h{font-family:Cinzel,Georgia,serif;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold,#C9A050)}',
    '.cdp-surface .yr-dd-x{background:none;border:none;color:var(--text-dim,#D4C8AE);font-size:20px;cursor:pointer}',
    '.cdp-surface .yr-dd-q{font-family:\'EB Garamond\',Georgia,serif;font-size:15px;color:var(--gold-soft,#E8C878);margin:0 0 8px}',
    '.cdp-surface .yr-dd-a{font-family:Georgia,serif;font-size:14px;line-height:1.7;color:var(--text-light,#F0E6CC)}',
    '.cdp-surface .yr-ctx{border:1px solid var(--gold-line,#3A3320);border-radius:5px;background:var(--navy,#0D1E33);padding:14px 16px;margin-bottom:11px}',
    '.cdp-surface .yr-ctx-h{font-family:Cinzel,Georgia,serif;font-size:13px;color:var(--gold,#C9A050);display:flex;align-items:baseline;gap:9px}',
    '.cdp-surface .yr-ctx-glyph{font-size:16px;color:var(--gold-soft,#E8C878)}',
    '.cdp-surface .yr-ctx-meta{font-family:Cinzel,Georgia,serif;font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--text-faint,#9E9282);margin:4px 0 9px}',
    '.cdp-surface .yr-ctx-desc{font-family:Georgia,serif;font-size:14px;line-height:1.7;color:var(--text-light,#F0E6CC)}',
    '.cdp-surface .yr-ctx-ask{display:inline-block;background:none;border:none;cursor:pointer;font-family:\'EB Garamond\',Georgia,serif;font-style:italic;font-size:13px;color:var(--teal,#81CDB6);padding:9px 0 0}',
    '.cdp-surface .yr-nav{position:sticky;top:0;z-index:5;display:flex;flex-wrap:wrap;gap:7px;padding:8px 0 14px;background:var(--bg,#0A1828)}',
    '.cdp-surface .yr-nav-chip{font-family:Cinzel,Georgia,serif;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-dim,#D4C8AE);border:1px solid var(--gold-line,#3A3320);border-radius:999px;background:var(--navy,#0D1E33);padding:6px 13px;cursor:pointer}',
    '.cdp-surface .yr-nav-chip:hover{color:var(--gold,#C9A050);border-color:var(--gold,#C9A050)}',
    '.cdp-surface .yr-mv-title{font-family:\'EB Garamond\',Georgia,serif;font-size:25px;color:var(--gold-soft,#E8C878);margin:16px 0 4px}',
    '.cdp-surface .yr-mv-intro{font-family:Georgia,serif;font-size:14px;line-height:1.7;color:var(--text-light,#F0E6CC);margin:0 0 14px}',
    '.cdp-surface .yr-cue{display:inline-flex;align-items:center;gap:6px;font-family:\'EB Garamond\',Georgia,serif;font-size:13px;color:var(--teal,#81CDB6);margin-top:9px;cursor:pointer}',
    '.cdp-surface .yr-now{border:1px solid rgba(201,160,80,.45);border-radius:8px;background:var(--raised,#13284A);padding:16px 18px;margin-bottom:11px;cursor:pointer}',
    '.cdp-surface .yr-now-label{font-family:Cinzel,Georgia,serif;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold-soft,#E8C878)}',
    '.cdp-surface .yr-now-big{font-family:\'EB Garamond\',Georgia,serif;font-size:22px;color:var(--text-light,#F0E6CC);margin:3px 0 5px}',
    '.cdp-surface .yr-ws{display:grid;grid-template-columns:repeat(13,1fr);gap:3px;margin:8px 0 6px}',
    '.cdp-surface .yr-ws-cell{text-align:center;padding:6px 0;border:1px solid var(--gold-line,#3A3320);border-radius:3px;font-family:\'EB Garamond\',Georgia,serif;font-size:12px;color:var(--text-dim,#D4C8AE)}',
    '.cdp-surface .yr-ws-cell.on{border-color:var(--gold,#C9A050);color:var(--gold,#C9A050);background:var(--navy,#0D1E33)}',
    '.cdp-surface .yr-note{font-family:Georgia,serif;font-size:13.5px;line-height:1.65;color:var(--text-dim,#D4C8AE);margin:2px 0 10px}',
  ].join('');
  const style = el('style', { id: STYLE_ID });
  style.textContent = css;
  document.head.appendChild(style);
}

function numCard(label: string, num: number, title: string, body: string): HTMLElement {
  const meaning = NUM_DATA[num];
  const card = el('div', { class: 'yr-card' });
  card.appendChild(el('div', { class: 'yr-num' + (meaning && meaning.master ? ' master' : '') }, String(num)));
  const b = el('div', { class: 'yr-body' });
  b.appendChild(el('div', { class: 'yr-label' }, label));
  b.appendChild(el('div', { class: 'yr-title' }, title));
  if (meaning && meaning.k) b.appendChild(el('div', { class: 'yr-key' }, meaning.k));
  b.appendChild(el('div', { class: 'yr-desc' }, body));
  card.appendChild(b);
  return card;
}

export function openYear(o: OpenYearOptions): YearHandle {
  ensureStyle();
  const view = el('div', { class: 'yr-view', role: 'dialog', 'aria-label': 'My year' });
  const shell = el('div', { class: 'yr-shell' });
  const bar = el('div', { class: 'yr-bar' });
  bar.appendChild(el('div', { class: 'yr-h' }, 'My year, the long view'));
  const closeBtn = el('button', { type: 'button', class: 'yr-close', 'aria-label': 'Close' }, '\u00d7');
  bar.appendChild(closeBtn);
  shell.appendChild(bar);

  const content = el('div', { class: 'yr-content' });
  shell.appendChild(content);

  const prof = o.getProfile();
  const hasBirth = !!(prof && prof.birthDate);
  const today = new Date().toISOString().slice(0, 10);
  const curYear = new Date().getUTCFullYear();
  const universalYear = reduceNumber(digitsOf(curYear)).value;

  /* ---- the in place Compass drawer; the bridge composes here -------------- */
  let ddOpen = false;
  function openAsk(prompt: string, landSig?: Partial<VesselSignal>): void {
    if (ddOpen || !o.composeAsk) return;
    ddOpen = true;
    const scrim = el('div', { class: 'yr-dd-scrim' });
    const panel = el('div', { class: 'yr-dd', role: 'dialog', 'aria-label': 'The Oracle' });
    const head = el('div', { class: 'yr-dd-head' });
    head.appendChild(el('div', { class: 'yr-dd-h' }, landSig && landSig.bridge ? 'Through the other telescope' : 'Ask the Oracle'));
    const x = el('button', { type: 'button', class: 'yr-dd-x', 'aria-label': 'Close' }, '\u00d7');
    head.appendChild(x);
    panel.appendChild(head);
    panel.appendChild(el('div', { class: 'yr-dd-q' }, prompt));
    const ans = el('div', { class: 'yr-dd-a' }, 'Composing.');
    panel.appendChild(ans);
    if (landSig && o.recordSignal) attachTap(panel, landSig, 'this landed');
    scrim.appendChild(panel);
    view.appendChild(scrim);
    function closeDD(): void { ddOpen = false; if (scrim.parentNode) scrim.parentNode.removeChild(scrim); }
    x.addEventListener('click', closeDD);
    scrim.addEventListener('click', (e: Event) => { if (e.target === scrim) closeDD(); });
    o.composeAsk(prompt).then((text) => {
      ans.textContent = '';
      const ps = String(text || '').split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
      if (ps.length) { for (const p of ps) ans.appendChild(el('p', { class: 'yr-em-p' }, p)); }
      else ans.textContent = text || 'No reply came back. Please try again in a moment.';
    }).catch(() => { ans.textContent = 'The Oracle could not be reached just now. Please try again in a moment.'; });
  }

  /* ---- the located 'this landed' tap ------------------------------------- */
  function attachTap(parent: HTMLElement, sig: Partial<VesselSignal>, label: string): void {
    if (!o.recordSignal) return;
    const wrap = el('div', { class: 'yr-tap' });
    wrap.appendChild(el('span', { class: 'yr-tapdot' }));
    const lab = el('span', { class: 'yr-taplabel' }, label);
    wrap.appendChild(lab);
    let done = false;
    wrap.addEventListener('click', () => {
      if (done) return;
      done = true;
      wrap.classList.add('on');
      lab.textContent = 'noted';
      o.recordSignal!({ at: Date.now(), date: today, kind: 'landed', surface: 'year', voice: o.getLens(), ...sig });
      if (o.reflect) o.reflect('You marked what landed.');
    });
    parent.appendChild(wrap);
  }

  const signals = o.getSignals ? o.getSignals() : [];
  const intentions = o.getIntentions ? o.getIntentions() : [];
  const MONTHS_S = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTHS_L = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  /* ---- a visible tap cue, so every card reads as openable ----------------- */
  function cueCard(card: HTMLElement, target: HTMLElement, prompt: string, sig: Partial<VesselSignal>, label: string): void {
    if (!o.composeAsk) return;
    const cue = el('div', { class: 'yr-cue' }, label + ' \u2197');
    target.appendChild(cue);
    cue.addEventListener('click', (e: Event) => { e.stopPropagation(); openAsk(prompt, sig); });
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => openAsk(prompt, sig));
  }
  function movementHead(id: string, kicker: string, title: string, intro: string): void {
    content.appendChild(el('div', { id: id }));
    content.appendChild(el('div', { class: 'yr-section' }, kicker));
    content.appendChild(el('div', { class: 'yr-mv-title' }, title));
    content.appendChild(el('div', { class: 'yr-mv-intro' }, intro));
  }

  /* ---- angle navigation, the four ways to view the year ------------------- */
  const nav = el('div', { class: 'yr-nav' });
  const ANGLES: Array<[string, string]> = [['mv-unfolding', 'Unfolding'], ['mv-guiding', 'Guiding'], ['mv-holding', 'Holding'], ['mv-arc', 'The arc']];
  for (const a of ANGLES) {
    const chip = el('button', { type: 'button', class: 'yr-nav-chip' }, a[1]);
    chip.addEventListener('click', () => { const t = document.getElementById(a[0]); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    nav.appendChild(chip);
  }
  content.appendChild(nav);

  /* ============ MOVEMENT ONE: what is unfolding =========================== */
  movementHead('mv-unfolding', 'Right now', 'What is unfolding', 'Begin with where you are today. The month you are in, the wave beneath it, and what your own signal has started to show.');
  if (hasBirth && prof && prof.birthDate) {
    const cmIdx = new Date().getUTCMonth();
    const cmm = (cmIdx + 1 < 10 ? '0' : '') + String(cmIdx + 1);
    const pm = personalNumerology(prof.birthDate, curYear + '-' + cmm + '-01').personalMonth;
    const nowCard = el('div', { class: 'yr-now' });
    nowCard.appendChild(el('div', { class: 'yr-now-label' }, 'This month, ' + MONTHS_L[cmIdx]));
    nowCard.appendChild(el('div', { class: 'yr-now-big' }, 'Personal month ' + pm.value + ', ' + numName(pm.value)));
    if (NUM_DATA[pm.value]) nowCard.appendChild(el('div', { class: 'yr-note' }, NUM_DATA[pm.value].m));
    cueCard(nowCard, nowCard, 'My personal month this month is ' + pm.value + ', ' + numName(pm.value) + '. What does this month ask of me, and how best to use it.', { framework: 'numerology', section: 'this-month' }, 'Open this month');
    content.appendChild(nowCard);
    let nextMaster = '';
    for (let k = 1; k <= 12; k++) {
      const d = new Date(Date.UTC(curYear, cmIdx + k, 1));
      const mm2 = (d.getUTCMonth() + 1 < 10 ? '0' : '') + String(d.getUTCMonth() + 1);
      const pmn = personalNumerology(prof.birthDate, d.getUTCFullYear() + '-' + mm2 + '-01').personalMonth;
      if (pmn.isMaster) { nextMaster = MONTHS_L[d.getUTCMonth()] + ', a master ' + pmn.value + ' month'; break; }
    }
    if (nextMaster) content.appendChild(el('div', { class: 'yr-note' }, 'Coming up, your next master month falls in ' + nextMaster + '.'));
  }
  {
    const wsKin = kinForDate(today);
    const wsStart = Math.floor((wsKin - 1) / 13) * 13 + 1;
    const wsD = descriptorForKin(wsStart);
    const wsDay = ((wsKin - 1) % 13) + 1;
    const wsCard = el('div', { class: 'yr-ctx' });
    wsCard.appendChild(el('div', { class: 'yr-ctx-h' }, wsD.colour + ' ' + wsD.seal + ' Wavespell'));
    wsCard.appendChild(el('div', { class: 'yr-ctx-meta' }, 'Day ' + wsDay + ' of 13'));
    const strip = el('div', { class: 'yr-ws' });
    for (let i = 1; i <= 13; i++) strip.appendChild(el('div', { class: 'yr-ws-cell' + (i === wsDay ? ' on' : '') }, String(i)));
    wsCard.appendChild(strip);
    wsCard.appendChild(el('div', { class: 'yr-ctx-desc' }, 'A thirteen day arc of energy, opened by the Magnetic tone and completed by the Cosmic. The seal that opens the wave, ' + wsD.seal + ', sets the theme for all thirteen days.'));
    wsCard.appendChild(el('div', { class: 'yr-symbolic' }, 'Symbolic, Dreamspell after Arguelles 1987.'));
    cueCard(wsCard, wsCard, 'I am on day ' + wsDay + ' of the ' + wsD.colour + ' ' + wsD.seal + ' Wavespell. What does this thirteen day wave ask of me.', { framework: 'dreamspell', section: 'wavespell' }, 'Open this wave');
    attachTap(wsCard, { framework: 'dreamspell', section: 'wavespell' }, 'this landed');
    content.appendChild(wsCard);
  }
  {
    const home = homeTelescope(signals);
    const rhythm = intentionRhythm(intentions, signals);
    const proven = bothTelescopesProven(signals);
    let line = '';
    if (proven === true) line = 'The days you let both telescopes speak, your outcomes ran better. The convergence, in your own life.';
    else if (rhythm) line = 'Your intentions move when you tend them within about ' + rhythm.days + (rhythm.days === 1 ? ' day' : ' days') + '. That rhythm is yours, drawn from your own outcomes.';
    else if (home) line = 'Across your taps so far, what lands most is ' + home.label + ', and the picture is still building.';
    if (line) {
      const cc = el('div', { class: 'yr-em-call' });
      cc.appendChild(el('div', { class: 'yr-em-em' }, line));
      content.appendChild(cc);
      content.appendChild(el('div', { class: 'yr-foot' }, 'From your own signal. The fuller picture sits in The arc, below.'));
    }
  }

  /* ============ MOVEMENT TWO: what is guiding ============================= */
  movementHead('mv-guiding', 'The sky that guides', 'What is guiding', 'The slower frequencies the year sits within. The number everyone shares, your own year inside it, and the long transits moving overhead.');
  {
    const uy = NUM_DATA[universalYear];
    const uyCard = numCard('Universal Year', universalYear, uy ? uy.n : 'Universal Year', uy ? uy.m : '');
    cueCard(uyCard, uyCard.querySelector('.yr-body') as HTMLElement, 'The universal year is ' + universalYear + ', ' + (uy ? uy.n : '') + '. What does this collective year mean, and how does it set the tone for everyone.', { framework: 'numerology', section: 'universal-year' }, 'Open the universal year');
    content.appendChild(uyCard);
    content.appendChild(el('div', { class: 'yr-symbolic' }, 'Symbolic, Pythagorean numerology. The number everyone shares this year.'));
  }
  if (hasBirth && prof && prof.birthDate) {
    const py = personalNumerology(prof.birthDate, today).personalYear;
    const pyMeaning = NUM_DATA[py.value];
    const pyCard = numCard('Your Personal Year', py.value, pyMeaning ? pyMeaning.n : 'Personal Year', PY_ARC[py.value] || (pyMeaning ? pyMeaning.m : ''));
    const pyBody = pyCard.querySelector('.yr-body') as HTMLElement;
    if (o.composeAsk) {
      const otherLens: Lens = o.getLens() === 'science' ? 'tradition' : 'science';
      const bridge = el('button', { type: 'button', class: 'yr-bridge' }, 'Through the other telescope');
      bridge.addEventListener('click', (e: Event) => { e.stopPropagation(); openAsk('My Personal Year is ' + py.value + ', ' + numName(py.value) + '. Show me this same year through the ' + (otherLens === 'science' ? 'science' : 'symbolic') + ' telescope, the same coordinate seen with the other lens.', { bridge: true, framework: 'numerology', section: 'personal-year' }); });
      pyBody.appendChild(bridge);
    }
    cueCard(pyCard, pyBody, 'My Personal Year is ' + py.value + ', ' + numName(py.value) + '. What does this year ask of me, and how best to move through it.', { framework: 'numerology', section: 'personal-year' }, 'Open your year');
    attachTap(pyBody, { framework: 'numerology', section: 'personal-year' }, 'this landed');
    content.appendChild(pyCard);
    content.appendChild(el('div', { class: 'yr-symbolic' }, 'Symbolic. Your own year within the nine year cycle, drawn from your birth date.'));
  }
  content.appendChild(el('div', { class: 'yr-section' }, 'The slow sky, the transits of this era'));
  content.appendChild(el('div', { class: 'yr-note' }, 'These move across months and years. Read once, and let them settle as backdrop. They surface in a daily reading only when the day touches them directly.'));
  for (const tr of SLOW_TRANSITS) {
    const card = el('div', { class: 'yr-ctx' });
    const h = el('div', { class: 'yr-ctx-h' });
    h.appendChild(el('span', { class: 'yr-ctx-glyph' }, tr.glyph));
    h.appendChild(el('span', {}, tr.name));
    card.appendChild(h);
    card.appendChild(el('div', { class: 'yr-ctx-meta' }, tr.duration));
    card.appendChild(el('div', { class: 'yr-ctx-desc' }, tr.desc));
    card.appendChild(el('div', { class: 'yr-symbolic' }, 'Symbolic interpretation of a real transit. Positions from Swiss Ephemeris.'));
    cueCard(card, card, 'The transit ' + tr.name + ' is in effect now. How is this transit relevant to my situation and my life arc right now.', { framework: 'astrology', section: 'transit' }, 'How this touches your life');
    attachTap(card, { framework: 'astrology', section: 'transit' }, 'this landed');
    content.appendChild(card);
  }

  /* ============ MOVEMENT THREE: what is holding ========================== */
  movementHead('mv-holding', 'What you carry', 'What is holding', 'The constants you were born with, and the intentions you are holding now. What you carry, what you mean to keep close, and what you are moving toward.');
  if (hasBirth && prof && prof.birthDate) {
    const lp = lifePath(prof.birthDate);
    const lpMeaning = NUM_DATA[lp.value];
    const lpCard = numCard('Life Path', lp.value, lpMeaning ? lpMeaning.n : 'Life Path', lpMeaning ? lpMeaning.m : '');
    cueCard(lpCard, lpCard.querySelector('.yr-body') as HTMLElement, 'My Life Path is ' + lp.value + ', ' + numName(lp.value) + '. What does it say about my natural direction, my strengths, and the shadow to know.', { framework: 'numerology', section: 'life-path' }, 'Open your Life Path');
    content.appendChild(lpCard);

    const desc = kinDescriptor(prof.birthDate);
    const kinCard = el('div', { class: 'yr-card' });
    kinCard.appendChild(el('div', { class: 'yr-num' }, String(kinForDate(prof.birthDate))));
    const kb = el('div', { class: 'yr-body' });
    kb.appendChild(el('div', { class: 'yr-label' }, 'Birth Kin, your galactic signature'));
    kb.appendChild(el('div', { class: 'yr-kin' }, desc.full + (desc.isGAP ? ' (Galactic Activation Portal)' : '')));
    kb.appendChild(el('div', { class: 'yr-symbolic' }, 'Symbolic, Dreamspell after Arguelles 1987, distinct from the living K\u2019iche\u2019 count.'));
    cueCard(kinCard, kb, 'My Birth Kin is ' + desc.full + '. What does this galactic signature say about who I am and what I carry.', { framework: 'dreamspell', section: 'birth-kin' }, 'Open your Birth Kin');
    attachTap(kb, { framework: 'dreamspell', section: 'birth-kin' }, 'this landed');
    kinCard.appendChild(kb);
    content.appendChild(kinCard);

    const _by = Number(prof.birthDate.slice(0, 4));
    const _bm = Number(prof.birthDate.slice(5, 7));
    const _bd = Number(prof.birthDate.slice(8, 10));
    const bc = chineseYear(_by, _bm, _bd);
    const ccz = chineseYear(curYear);
    const chCard = el('div', { class: 'yr-ctx' });
    chCard.appendChild(el('div', { class: 'yr-ctx-h' }, 'Chinese zodiac'));
    chCard.appendChild(el('div', { class: 'yr-ctx-desc' }, 'Born in the year of the ' + bc.element + ' ' + bc.animal + '. This year carries the ' + ccz.element + ' ' + ccz.animal + '.'));
    chCard.appendChild(el('div', { class: 'yr-symbolic' }, 'Symbolic, the sexagenary cycle, animal and heavenly stem element.'));
    cueCard(chCard, chCard, 'I was born in the year of the ' + bc.element + ' ' + bc.animal + '. What does this sign say about my instincts and the rhythm of my ambition.', { framework: 'astrology', section: 'chinese' }, 'Open your sign');
    content.appendChild(chCard);

    if (o.composeAsk) {
      const ndCard = el('div', { class: 'yr-ctx' });
      ndCard.appendChild(el('div', { class: 'yr-ctx-h' }, 'Your natural direction'));
      ndCard.appendChild(el('div', { class: 'yr-ctx-desc' }, 'Read across your Life Path ' + lp.value + ', your Birth Kin, and your Chinese sign, the direction your work and life lean toward. Not a prescription, a mirror. The aim is recognition, not instruction.'));
      const ndAsk = el('button', { type: 'button', class: 'yr-ctx-ask' }, 'Read my natural direction \u2197');
      ndAsk.addEventListener('click', (e: Event) => { e.stopPropagation(); openAsk('Drawing together my Life Path ' + lp.value + ', my Birth Kin, and my Chinese sign, what is the natural direction for my work and my life right now. Speak to what drives me, my strengths, where I thrive, the shadow to watch, and the domains that suit me.', { framework: 'convergence', section: 'natural-direction' }); });
      ndCard.appendChild(ndAsk);
      content.appendChild(ndCard);
    }
  } else {
    content.appendChild(el('div', { class: 'yr-empty' }, 'Add your birth date in your Cosmic Profile, and your fixed signature and the year that belongs to you appear here.'));
  }
  if (o.getIntentions) {
    content.appendChild(el('div', { class: 'yr-section' }, 'What you are holding now'));
    const live = intentions.filter((it) => it.status !== 'resting');
    if (!live.length) {
      content.appendChild(el('div', { class: 'yr-empty' }, 'The intentions you are holding will gather here, so you can mark, in your own time, which have moved and which are still waiting.'));
    } else {
      const verdicts: Record<string, string> = {};
      for (const sg of signals) { if (sg.kind === 'outcome' && sg.intentionId && sg.moved) verdicts[sg.intentionId] = sg.moved; }
      for (const it of live) {
        const row = el('div', { class: 'yr-move' });
        row.appendChild(el('div', { class: 'yr-move-t' }, it.text));
        if (o.recordOutcome) {
          const well = el('button', { type: 'button', class: 'yr-move-b' + (verdicts[it.id] === 'well' ? ' on' : '') }, 'moved well');
          const wait = el('button', { type: 'button', class: 'yr-move-b' + (verdicts[it.id] === 'waiting' ? ' on' : '') }, 'still waiting');
          well.addEventListener('click', () => { o.recordOutcome!(it.id, 'well'); well.classList.add('on'); wait.classList.remove('on'); });
          wait.addEventListener('click', () => { o.recordOutcome!(it.id, 'waiting'); wait.classList.add('on'); well.classList.remove('on'); });
          row.appendChild(well);
          row.appendChild(wait);
        }
        content.appendChild(row);
      }
    }
  }
  {
    content.appendChild(el('div', { class: 'yr-section' }, 'What gathered'));
    const home = homeTelescope(signals);
    const cross = crossTelescopeRate(signals);
    if (!home) {
      content.appendChild(el('div', { class: 'yr-empty' }, 'This fills from your own signal. Each time you mark that something landed, the picture of what speaks to you, and which lens reached you, builds here.'));
    } else {
      const refl = el('div', { class: 'yr-emergent' });
      refl.appendChild(el('div', { class: 'yr-em-p' }, 'Across ' + home.count + ' of your taps, what lands most is ' + home.label + '.'));
      if (cross && cross.count > 0) {
        const cc = el('div', { class: 'yr-em-call' });
        cc.appendChild(el('div', { class: 'yr-em-em' }, 'And ' + cross.count + ' of those were a lens that is not your home, landing on the same sky. That crossing is the bridge, and it is the thing worth returning for.'));
        refl.appendChild(cc);
      } else {
        refl.appendChild(el('div', { class: 'yr-foot' }, 'When a lens that is not your home lands, it will be marked here as the bridge.'));
      }
      content.appendChild(refl);
    }
  }

  /* ============ MOVEMENT FOUR: the arc =================================== */
  movementHead('mv-arc', 'The long view', 'The arc', 'Where this year sits in the longer cycle, the texture month by month, and the patterns your own signal has named over time.');
  if (hasBirth && prof && prof.birthDate) {
    const py = personalNumerology(prof.birthDate, today).personalYear;
    const pos = py.reducesTo;
    content.appendChild(el('div', { class: 'yr-section' }, 'Where this year sits in the cycle'));
    const strip = el('div', { class: 'yr-cycle' });
    for (let i = 1; i <= 9; i++) strip.appendChild(el('div', { class: 'yr-cycle-cell' + (i === pos ? ' on' : '') }, String(i)));
    content.appendChild(strip);
    const prev = ((pos + 7) % 9) + 1;
    const next = (pos % 9) + 1;
    const arcLine = 'A nine year cycle. You are in year ' + pos + (py.isMaster ? ', carried this year as the master ' + py.value : '') + ', ' + (NUM_DATA[py.value] ? NUM_DATA[py.value].n : '') + '. Behind you, year ' + prev + ', ' + (NUM_DATA[prev] ? NUM_DATA[prev].n : '') + '. Ahead, year ' + next + ', ' + (NUM_DATA[next] ? NUM_DATA[next].n : '') + '.';
    content.appendChild(el('div', { class: 'yr-arc' }, arcLine));
    content.appendChild(el('div', { class: 'yr-symbolic' }, 'Symbolic. The arc beneath the year, where you have come from and where the cycle turns next.'));

    content.appendChild(el('div', { class: 'yr-section' }, 'The year, month by month'));
    content.appendChild(el('div', { class: 'yr-note' }, 'Your personal month for every month of the year, master months marked. Tap any month to open it.'));
    const grid = el('div', { class: 'yr-months' });
    for (let mi = 0; mi < 12; mi++) {
      const mm = (mi + 1 < 10 ? '0' : '') + String(mi + 1);
      const pmn = personalNumerology(prof.birthDate, curYear + '-' + mm + '-01').personalMonth;
      const cell = el(o.composeAsk ? 'button' : 'div', { type: 'button', class: 'yr-month-cell' + (pmn.isMaster ? ' master' : '') });
      cell.appendChild(el('div', { class: 'yr-month-m' }, MONTHS_S[mi]));
      cell.appendChild(el('div', { class: 'yr-month-n' }, String(pmn.value)));
      if (o.composeAsk) {
        cell.addEventListener('click', () => { openAsk('In ' + MONTHS_L[mi] + ' ' + curYear + ' my personal month is ' + pmn.value + ', ' + numName(pmn.value) + '. What does this month ask of me, and how best to use it.', { framework: 'numerology', section: 'month-' + mm }); });
      }
      grid.appendChild(cell);
    }
    content.appendChild(grid);
  }
  {
    const rhythm = intentionRhythm(intentions, signals);
    const proven = bothTelescopesProven(signals);
    content.appendChild(el('div', { class: 'yr-section' }, 'What you felt, named'));
    const em = el('div', { class: 'yr-emergent' });
    let named = false;
    if (rhythm) {
      named = true;
      const cc = el('div', { class: 'yr-em-call' });
      cc.appendChild(el('div', { class: 'yr-em-p' }, 'Your intentions move when you tend them within about ' + rhythm.days + (rhythm.days === 1 ? ' day' : ' days') + '. The ones left longer wait.'));
      cc.appendChild(el('div', { class: 'yr-em-em' }, 'This is your rhythm, observed from your own outcomes, not a rule.'));
      em.appendChild(cc);
    }
    if (proven === true) {
      named = true;
      const cc = el('div', { class: 'yr-em-call' });
      cc.appendChild(el('div', { class: 'yr-em-em' }, 'The days you let both telescopes speak, your outcomes ran better. The convergence, in your own life.'));
      em.appendChild(cc);
    }
    if (!named) {
      em.appendChild(el('div', { class: 'yr-em-p' }, 'We are still listening. When a pattern in your own signal is clear enough to name, it appears here. When we look and find nothing, we will say that too.'));
    }
    em.appendChild(el('div', { class: 'yr-foot' }, 'Observed from your own signal. Correlation, not a forecast.'));
    content.appendChild(em);
  }
  content.appendChild(el('div', { class: 'yr-mv-intro' }, 'This is the keel, not the captain. The frameworks lay out the weather and the constants you carry, and the choosing stays yours. When you want a hand on the tiller, the Oracle is one tap away, in whichever voice fits the moment.'));
  const sl = sourcesLine();
  if (sl) content.appendChild(el('div', { class: 'yr-sources' }, sl));

  shell.appendChild(shareControls({
    title: 'My year, ' + String(curYear),
    text: () => 'My year, ' + String(curYear) + '\n\n' + content.innerText,
    node: () => content,
  }));

  view.appendChild(shell);
  o.container.appendChild(view);

  function close(): void { if (view.parentNode) view.parentNode.removeChild(view); }
  closeBtn.addEventListener('click', close);
  if (o.reflect) o.reflect('Your year is laid out, the long view under your hand.');
  return { close };
}
