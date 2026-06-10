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
function paragraphs(text: unknown): string[] {
  return String(text == null ? '' : text).split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
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

const TOPICS: Array<{ label: string; value: string }> = [
  { label: 'In general', value: 'their connection in general' },
  { label: 'Romantic', value: 'a romantic relationship' },
  { label: 'Friendship', value: 'a friendship' },
  { label: 'Family', value: 'a family relationship' },
  { label: 'Working together', value: 'working together' },
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
    '.cdp-surface .cm-status{font-family:\'EB Garamond\',Georgia,serif;font-size:15px;color:var(--text-muted,#D4C8AE);padding:18px 4px;text-align:center;line-height:1.6}',
    '.cdp-surface .cm-headline{font-family:\'EB Garamond\',Georgia,serif;font-size:20px;line-height:1.45;color:var(--text-light,#F0E6CC);margin:18px 0}',
    '.cdp-surface .cm-seclabel{font-family:Cinzel,Georgia,serif;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--text-faint,#9E9282);margin:22px 0 10px;text-align:center}',
    '.cdp-surface .cm-cols{display:flex;gap:12px;flex-wrap:wrap}',
    '.cdp-surface .cm-col{flex:1;min-width:200px;border:1px solid var(--gold-line,#3A3320);border-radius:4px;background:var(--navy,#0D1E33);padding:14px 16px}',
    '.cdp-surface .cm-name{font-family:\'EB Garamond\',Georgia,serif;font-size:18px;color:var(--gold,#C9A050);margin-bottom:8px}',
    '.cdp-surface .cm-row{display:flex;justify-content:space-between;gap:10px;padding:5px 0;border-bottom:1px solid rgba(191,163,99,.1)}',
    '.cdp-surface .cm-row:last-child{border-bottom:none}',
    '.cdp-surface .cm-rl{font-family:Cinzel,Georgia,serif;font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--text-faint,#9E9282);align-self:center}',
    '.cdp-surface .cm-rv{font-family:\'EB Garamond\',Georgia,serif;font-size:15px;color:var(--text-light,#F0E6CC);text-align:right}',
    '.cdp-surface .cm-rv.master{color:var(--master,#C8A0FF)}',
    '.cdp-surface .cm-card{border:1px solid var(--gold-line,#3A3320);border-radius:4px;background:var(--navy,#0D1E33);padding:13px 15px;margin-bottom:11px}',
    '.cdp-surface .cm-tap{cursor:pointer}',
    '.cdp-surface .cm-title{font-family:Cinzel,Georgia,serif;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold,#C9A050);margin-bottom:6px;display:flex;justify-content:space-between;align-items:center}',
    '.cdp-surface .cm-ask{font-family:\'EB Garamond\',Georgia,serif;font-size:12px;color:var(--teal,#81CDB6)}',
    '.cdp-surface .cm-sub{font-family:\'EB Garamond\',Georgia,serif;font-size:15px;color:var(--gold-soft,#E8C878);margin-bottom:6px}',
    '.cdp-surface .cm-p{font-family:Georgia,serif;font-size:14px;line-height:1.7;color:var(--text-light,#F0E6CC);margin:0 0 10px}',
    '.cdp-surface .cm-p:last-child{margin-bottom:0}',
    '.cdp-surface .cm-big{font-family:\'EB Garamond\',Georgia,serif;font-size:22px;color:var(--gold,#C9A050)}',
    '.cdp-surface .cm-big.master{color:var(--master,#C8A0FF)}',
    '.cdp-surface .cm-gloss{font-family:Georgia,serif;font-size:13px;line-height:1.6;color:var(--text-muted,#D4C8AE);margin-top:4px}',
    '.cdp-surface .cm-question{font-family:\'EB Garamond\',Georgia,serif;font-style:italic;font-size:17px;line-height:1.55;color:var(--gold-soft,#E8C878);border-left:2px solid var(--gold-line,#3A3320);padding-left:14px;margin:16px 0}',
    '.cdp-surface .cm-closing{font-family:\'EB Garamond\',Georgia,serif;font-style:italic;font-size:17px;line-height:1.55;color:var(--text-light,#F0E6CC);text-align:center;margin:18px 2px}',
    '.cdp-surface .cm-sources{font-family:Georgia,serif;font-size:11px;line-height:1.6;color:var(--text-muted,#D4C8AE);margin-top:18px;text-align:center}',
    '.cdp-surface .cm-note{font-family:\'EB Garamond\',Georgia,serif;font-size:12px;color:var(--text-muted,#D4C8AE);margin-top:4px}',
    '.cdp-surface .cm-dd-scrim{position:fixed;inset:0;z-index:80;background:rgba(4,12,24,.62);display:flex;align-items:flex-end;justify-content:center}',
    '.cdp-surface .cm-dd{width:100%;max-width:44rem;max-height:80vh;overflow-y:auto;background:var(--navy,#0D1E33);border:1px solid var(--gold-line,#3A3320);border-radius:12px 12px 0 0;padding:18px 18px 28px}',
    '.cdp-surface .cm-dd-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}',
    '.cdp-surface .cm-dd-h{font-family:Cinzel,Georgia,serif;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold,#C9A050)}',
    '.cdp-surface .cm-dd-x{background:none;border:none;color:var(--text-muted,#D4C8AE);font-size:20px;cursor:pointer}',
    '.cdp-surface .cm-dd-q{font-family:\'EB Garamond\',Georgia,serif;font-size:15px;color:var(--gold-soft,#E8C878);margin:0 0 8px}',
    '.cdp-surface .cm-dd-a{font-family:Georgia,serif;font-size:14px;line-height:1.7;color:var(--text-light,#F0E6CC)}',
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
  const topicWrap = el('div', { class: 'cm-pick' });
  topicWrap.appendChild(el('label', {}, 'The relationship'));
  const topicSelect = el('select', { class: 'cm-select' }) as HTMLSelectElement;
  TOPICS.forEach((t, i) => {
    const opt = el('option', { value: t.value }, t.label) as HTMLOptionElement;
    if (i === 0) opt.selected = true;
    topicSelect.appendChild(opt);
  });
  topicWrap.appendChild(topicSelect);
  pickers.appendChild(a.wrap);
  pickers.appendChild(b.wrap);
  pickers.appendChild(topicWrap);
  shell.appendChild(pickers);

  const goBtn = el('button', { type: 'button', class: 'cm-go' }, 'See the connection');
  shell.appendChild(goBtn);

  // Zone one, the computed scaffold, rendered the instant the pair is chosen.
  const computed = el('div', { class: 'cm-computed' });
  shell.appendChild(computed);
  // Zone two, the composed synastry prose, streamed from the engine.
  const status = el('div', { class: 'cm-status' });
  shell.appendChild(status);
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
          col.appendChild(el('div', { class: 'cm-brv' }, val));
        }
        if (!any) col.appendChild(el('div', { class: 'cm-brv' }, 'Nothing captured for ' + person.name + ' yet. Add depth in Profiles to compare more than the chart.'));
        dcols.appendChild(col);
      });
      computed.appendChild(dcols);
      if (o.composeAsk) {
        const askBrings = el('button', { type: 'button', class: 'cm-bridge' }, 'Read these two lives together');
        askBrings.addEventListener('click', () => { openAsk('Compare ' + pa.name + ' and ' + pb.name + ' as two lives, not only two charts. Consider their roles, what is live for each, their current intentions, and the people around them, and say what their pairing asks of them.'); });
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

  function strCard(title: string, value: unknown, askPrompt?: string, sig?: Partial<VesselSignal>): void {
    const ps = paragraphs(value);
    if (!ps.length) return;
    const card = el('div', { class: 'cm-card' });
    const t = el('div', { class: 'cm-title' });
    t.appendChild(el('span', {}, title));
    if (o.composeAsk && askPrompt) t.appendChild(el('span', { class: 'cm-ask' }, 'Ask'));
    card.appendChild(t);
    for (const p of ps) card.appendChild(el('p', { class: 'cm-p' }, p));
    if (askPrompt) tappable(card, askPrompt);
    if (sig) attachTap(card, sig, 'this landed');
    content.appendChild(card);
  }
  function pairCard(title: string, value: unknown, askPrompt?: string, sig?: Partial<VesselSignal>): void {
    if (!value || typeof value !== 'object') { strCard(title, value, askPrompt); return; }
    const v = value as Record<string, unknown>;
    const ps = paragraphs(v.body);
    if (!ps.length && !v.headline) return;
    const card = el('div', { class: 'cm-card' });
    const t = el('div', { class: 'cm-title' });
    t.appendChild(el('span', {}, title));
    if (o.composeAsk && askPrompt) t.appendChild(el('span', { class: 'cm-ask' }, 'Ask'));
    card.appendChild(t);
    if (v.headline) card.appendChild(el('div', { class: 'cm-sub' }, String(v.headline)));
    for (const p of ps) card.appendChild(el('p', { class: 'cm-p' }, p));
    if (askPrompt) tappable(card, askPrompt);
    if (sig) attachTap(card, sig, 'this landed');
    content.appendChild(card);
  }

  function renderComposed(raw: unknown, nameA: string, nameB: string): void {
    clear(content);
    const r = (raw && typeof raw === 'object') ? (raw as Record<string, unknown>) : {};
    if (r.raw === true || (!r.synthesis && !r.headline)) {
      content.appendChild(el('div', { class: 'cm-status' }, 'The reading came back in an unexpected shape. The engine is reachable; please try again in a moment.'));
      return;
    }
    if (r.headline) content.appendChild(el('div', { class: 'cm-headline' }, String(r.headline)));
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
    pairCard('Gifts', r.gifts, 'What are the gifts of the connection between ' + nameA + ' and ' + nameB + '.');
    pairCard('Tensions', r.tensions, 'What are the tensions between ' + nameA + ' and ' + nameB + ', and how do we work with them.');
    pairCard('On this', r.topic_specific, 'Tell me more about ' + nameA + ' and ' + nameB + ' on this specific relationship.');
    // Key aspects, the synastry detail
    const aspects = r.key_aspects;
    if (Array.isArray(aspects) && aspects.length) {
      content.appendChild(el('div', { class: 'cm-seclabel' }, 'Key aspects'));
      for (const item of aspects) {
        if (!item || typeof item !== 'object') continue;
        const it = item as Record<string, unknown>;
        const card = el('div', { class: 'cm-card' });
        if (it.aspect) card.appendChild(el('div', { class: 'cm-sub' }, String(it.aspect)));
        for (const p of paragraphs(it.interpretation)) card.appendChild(el('p', { class: 'cm-p' }, p));
        if (it.aspect) tappable(card, 'Tell me more about this aspect in our connection: ' + String(it.aspect) + '.');
        content.appendChild(card);
      }
    }
    strCard('Numerology', r.numerology_connection, 'Read our numerology pairing in more depth.', { framework: 'numerology', section: 'numerology' });
    strCard('Dreamspell', r.dreamspell_connection, 'Read our Dreamspell connection in more depth.', { framework: 'dreamspell', section: 'dreamspell' });
    strCard('Natal moon', r.natal_moon_connection, 'Read our natal moon phase polarity in more depth.', { framework: 'moon', section: 'natal-moon' });
    strCard('Biorhythm today', r.biorhythm_today, 'What does our shared biorhythm ask of us today.');
    const forThem = r.for_them as Record<string, unknown> | undefined;
    if (forThem) {
      strCard('For ' + nameA, forThem.for_a, 'Say more to ' + nameA + ' specifically.');
      strCard('For ' + nameB, forThem.for_b, 'Say more to ' + nameB + ' specifically.');
    }
    if (r.a_question_to_sit_with) content.appendChild(el('div', { class: 'cm-question' }, String(r.a_question_to_sit_with)));
    if (r.closing) content.appendChild(el('div', { class: 'cm-closing' }, String(r.closing)));
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
    status.textContent = 'Reading the connection between ' + pa.name + ' and ' + pb.name + '. The signatures above are ready; the synthesis is composing.';
    try {
      const res = await fetch('/api/compatibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personA: toPayload(pa), personB: toPayload(pb), topic: topicSelect.value, lens: o.getLens() }),
      });
      const data = await res.json();
      status.textContent = '';
      renderComposed(data, pa.name, pb.name);
      if (o.reflect) o.reflect('The connection between ' + pa.name + ' and ' + pb.name + ' is read.');
    } catch (_e) {
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
            for (const para of fallbackText.split(/\n+/).filter((s: string) => s.trim())) {
              card.appendChild(el('p', { class: 'cm-p' }, para.trim()));
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
