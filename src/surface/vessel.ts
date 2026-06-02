/**
 * Vessel: the CDP surface, the home that meets you.
 *
 * The converged daily compass, threaded. A person brings a line, a question, a
 * need, an intention, and the Oracle replies in the voice they choose. Each
 * reply can be re-heard in another voice in place, and a follow-up continues
 * the same thread, carrying the exchange so far to the server as context. A
 * sidebar holds what is alive and what is held, ordered by the gravity the
 * repository computes. The day's coordinates are shown as one converged view,
 * drawn from the shared coordinate core, never recomputed and never invented.
 *
 * What changed in the re-seat, and why. The surface no longer holds its own
 * state in memory. It reads and writes through the VesselRepository over a
 * Store, the data layer of Strategic Foundation Volume 16. That single change
 * makes what a person holds survive a closed tab and a returning visit, and it
 * means the swap from the on-device store to the server store at scale touches
 * nothing here. The domain types are imported from the model, not redeclared,
 * which heals the fork that had two HeldIntentions with different kinds. The
 * sidebar copy is now true: it persists across visits, so it says so.
 *
 * Discipline held here:
 *   - No coordinate is fabricated. The lunar window reads as not yet available
 *     until USNO is wired; the deep reading is named as the next stage.
 *   - The language is the CDP core: intentions, what is alive, what matters.
 *     Problem-framing vocabulary stays out of anything a person reads.
 *   - All dynamic and person-typed text is written with textContent, never
 *     interpolated into markup, so an apostrophe can never break a string.
 *   - The surface never computes gravity or composes text; it reads the
 *     repository and composes through the Orchestrator interface only.
 *   - House style: no em dashes, no en dashes, no exclamation marks, in code
 *     and in anything a person reads.
 *
 * Two themes are provided, dark by default to match the house aesthetic, and
 * both driven by CSS variables so the repo style tokens can replace them. The
 * dark or light choice is a presentation preference and legitimately lives in
 * localStorage, outside the vessel state, since it is not the substance of a life.
 */

import type { Lens, HeldIntention, Touch } from '../data/model';
import type { Orchestrator, DepthContext } from './compose';
import { VesselRepository } from '../data/repository';
import { trackEvent } from '../data/analytics';
import { dayCoordinates } from '../coordinates-core';
import type { Coordinate } from '../coordinates-core';

export interface VesselOptions {
  root: HTMLElement;
  orchestrator: Orchestrator;
  /** The data layer. The surface reads and writes only through it. */
  repo: VesselRepository;
  /** Optional profile. When a birth date is present, the personal layers show. */
  profile?: { birthDate?: string };
}

type UiTheme = 'dark' | 'light';

/** A thread entry as the surface renders it, derived from a held intention. */
interface EntryVM {
  id: string;
  personText: string;
  oracleText: string;
  oracleSummary: string;
  lens: Lens;
}

/* ---- small DOM helpers, safe with person text ----------------------------- */

type Attrs = Record<string, string>;

function el(tag: string, attrs: Attrs = {}, text?: string): HTMLElement {
  const node = document.createElement(tag);
  for (const k of Object.keys(attrs)) node.setAttribute(k, attrs[k]);
  if (text !== undefined) node.textContent = text;
  return node;
}

function clear(node: HTMLElement): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/* ---- date, formatted in UTC to match the coordinate discipline ------------ */

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function todayUTCDateStr(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

function longDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  return WEEKDAYS[d.getUTCDay()] + ', ' + d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
}

function lensLabel(lens: Lens): string {
  return lens === 'tradition' ? 'Tradition' : lens === 'science' ? 'Science' : 'Everyday';
}

function latestVesselTouch(it: HeldIntention): Touch | null {
  for (let i = it.touches.length - 1; i >= 0; i -= 1) {
    if (it.touches[i].role === 'vessel') return it.touches[i];
  }
  return null;
}

/* ---- the compass mark, static, no person data ----------------------------- */

const COMPASS_SVG = `
<svg viewBox="0 0 200 200" class="cdp-compass-svg" aria-hidden="true">
  <circle cx="100" cy="104" r="74" class="cdp-c-ring"/>
  <circle cx="100" cy="86" r="74" class="cdp-c-ring cdp-c-ring-2"/>
  <circle cx="100" cy="95" r="6" class="cdp-c-ring"/>
  <circle cx="100" cy="95" r="2.2" class="cdp-c-dot"/>
  <g class="cdp-c-letters">
    <text x="86" y="34">E</text><text x="98" y="34">N</text><text x="112" y="34">W</text>
    <text x="100" y="178">S</text>
  </g>
</svg>`;

/* ---- styles, themeable through CSS variables ------------------------------ */

const STYLES = `
.cdp-surface {
  --cdp-gold: #C8A24A;
  --cdp-gold-soft: #B8942A;
  --cdp-rule: #BFA363;
  font-family: Georgia, "Times New Roman", serif;
  line-height: 1.6;
  min-height: 100vh;
  color: var(--cdp-ink);
  background: var(--cdp-bg);
}
.cdp-surface[data-theme="dark"] {
  --cdp-bg: radial-gradient(130% 90% at 50% -20%, #1A2C46 0%, #0E1B2E 55%, #0A1422 100%);
  --cdp-ink: #ECE6D6;
  --cdp-muted: #8FA0B6;
  --cdp-panel: rgba(255,255,255,0.03);
  --cdp-card: rgba(20,36,59,0.7);
  --cdp-card-border: rgba(200,162,74,0.28);
  --cdp-side: rgba(8,16,28,0.55);
  --cdp-side-border: rgba(200,162,74,0.16);
  --cdp-input: rgba(8,16,28,0.6);
}
.cdp-surface[data-theme="light"] {
  --cdp-bg: radial-gradient(120% 80% at 50% -10%, #EAF0F6 0%, #FAF7F0 60%);
  --cdp-ink: #1A1A1A;
  --cdp-muted: #6B6257;
  --cdp-panel: rgba(44,62,90,0.03);
  --cdp-card: #FFFFFF;
  --cdp-card-border: rgba(191,163,99,0.5);
  --cdp-side: rgba(255,255,255,0.6);
  --cdp-side-border: rgba(191,163,99,0.4);
  --cdp-input: #FFFFFF;
}
.cdp-surface * { box-sizing: border-box; }
.cdp-layout { display: grid; grid-template-columns: 17rem 1fr; min-height: 100vh; }
@media (max-width: 56rem) { .cdp-layout { grid-template-columns: 1fr; } .cdp-side { display: none; } }

.cdp-side {
  background: var(--cdp-side); border-right: 1px solid var(--cdp-side-border);
  padding: 1.6rem 1.25rem; display: flex; flex-direction: column; gap: 1.4rem;
}
.cdp-brand { font-family: Cinzel, Georgia, serif; letter-spacing: 0.28em; font-size: 0.85rem; color: var(--cdp-gold); }
.cdp-search {
  width: 100%; font-family: Georgia, serif; font-size: 0.9rem; color: var(--cdp-ink);
  background: var(--cdp-input); border: 1px solid var(--cdp-side-border); border-radius: 8px;
  padding: 0.5rem 0.65rem;
}
.cdp-search:focus { outline: 1px solid var(--cdp-gold); }
.cdp-side-group-head { font-size: 0.66rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--cdp-muted); margin: 0 0 0.55rem; }
.cdp-side-item { padding: 0.5rem 0.6rem; border-radius: 8px; cursor: default; }
.cdp-side-item:hover { background: var(--cdp-panel); }
.cdp-side-item.active { background: var(--cdp-panel); border-left: 2px solid var(--cdp-gold); }
.cdp-side-item .t { font-style: italic; color: var(--cdp-ink); font-size: 0.95rem; }
.cdp-side-item .s { font-size: 0.72rem; color: var(--cdp-muted); letter-spacing: 0.04em; }
.cdp-side-empty { color: var(--cdp-muted); font-style: italic; font-size: 0.9rem; }
.cdp-side-foot { margin-top: auto; color: var(--cdp-muted); font-size: 0.72rem; letter-spacing: 0.04em; }

.cdp-main { padding: clamp(1.25rem, 3vw, 2.5rem) clamp(1rem, 4vw, 3.5rem) 5rem; max-width: 56rem; margin: 0 auto; width: 100%; }
.cdp-topbar { display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; margin: 0 0 2rem; flex-wrap: wrap; }
.cdp-date { color: var(--cdp-gold); font-size: 0.82rem; letter-spacing: 0.14em; text-transform: uppercase; }
.cdp-date em { color: var(--cdp-muted); font-style: italic; text-transform: none; letter-spacing: 0; margin-left: 0.6rem; }
.cdp-menu-btn { background: transparent; border: 1px solid var(--cdp-side-border); color: var(--cdp-muted); border-radius: 999px; padding: 0.3rem 0.95rem; font-family: Georgia, serif; font-size: 0.8rem; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
.cdp-menu-btn:hover { color: var(--cdp-gold); border-color: rgba(200,162,74,0.5); }

.cdp-compass { display: flex; justify-content: center; margin: 0.5rem 0 1.5rem; }
.cdp-compass-svg { width: clamp(8rem, 22vw, 12rem); height: auto; }
.cdp-c-ring { fill: none; stroke: var(--cdp-gold); stroke-width: 0.8; opacity: 0.7; }
.cdp-c-ring-2 { opacity: 0.35; }
.cdp-c-dot { fill: var(--cdp-gold); }
.cdp-c-letters text { fill: var(--cdp-muted); font-family: Cinzel, Georgia, serif; font-size: 9px; letter-spacing: 1px; }

.cdp-hero-h { font-family: Cinzel, Georgia, serif; font-style: italic; color: var(--cdp-gold); text-align: center; font-size: clamp(1.4rem, 3.5vw, 1.9rem); margin: 0 0 0.5rem; }
.cdp-hero-sub { text-align: center; color: var(--cdp-muted); font-size: 0.98rem; margin: 0 0 1.5rem; }

.cdp-coords { margin: 0 0 1.5rem; }
.cdp-coords summary { cursor: pointer; color: var(--cdp-gold); font-size: 0.74rem; letter-spacing: 0.16em; text-transform: uppercase; list-style: none; }
.cdp-coords summary::-webkit-details-marker { display: none; }
.cdp-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr)); gap: 0.75rem; margin: 0.9rem 0 0; }
.cdp-card { background: var(--cdp-card); border: 1px solid var(--cdp-card-border); border-radius: 10px; padding: 0.9rem 1rem; }
.cdp-card-label { font-size: 0.66rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--cdp-muted); margin: 0 0 0.35rem; }
.cdp-card-value { font-family: Cinzel, Georgia, serif; font-size: 1.02rem; color: var(--cdp-ink); margin: 0 0 0.4rem; }
.cdp-tag { display: inline-block; font-size: 0.62rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--cdp-muted); border: 1px solid var(--cdp-side-border); border-radius: 999px; padding: 0.08rem 0.5rem; }
.cdp-tag.gold { color: var(--cdp-gold); border-color: rgba(200,162,74,0.5); }
.cdp-tag.pending { font-style: italic; }
.cdp-coords-note { color: var(--cdp-muted); font-style: italic; font-size: 0.9rem; margin: 0.9rem 0 0; }

.cdp-ask { background: var(--cdp-card); border: 1px solid var(--cdp-card-border); border-radius: 12px; padding: 1rem; }
.cdp-ask textarea {
  width: 100%; min-height: 3rem; resize: vertical; font-family: Georgia, serif; font-size: 1.05rem;
  color: var(--cdp-ink); background: var(--cdp-input); border: 1px solid var(--cdp-side-border);
  border-radius: 9px; padding: 0.7rem 0.85rem; line-height: 1.5;
}
.cdp-ask textarea:focus { outline: 2px solid rgba(200,162,74,0.5); outline-offset: 1px; }
.cdp-ask-row { display: flex; align-items: center; gap: 0.9rem; margin: 0.75rem 0 0; flex-wrap: wrap; }
.cdp-reply-in { color: var(--cdp-muted); font-style: italic; font-size: 0.9rem; }
.cdp-voices { display: flex; gap: 0.4rem; }
.cdp-voice { font-family: Georgia, serif; font-size: 0.85rem; cursor: pointer; background: transparent; color: var(--cdp-ink); border: 1px solid var(--cdp-side-border); border-radius: 999px; padding: 0.3rem 0.8rem; transition: background 0.16s ease, color 0.16s ease; }
.cdp-voice[aria-pressed="true"] { background: var(--cdp-gold); color: #14110A; border-color: var(--cdp-gold); }
.cdp-primary { margin-left: auto; font-family: Cinzel, Georgia, serif; font-size: 0.92rem; letter-spacing: 0.06em; cursor: pointer; background: var(--cdp-gold); color: #14110A; border: 0; border-radius: 999px; padding: 0.55rem 1.5rem; }
.cdp-primary:disabled { opacity: 0.5; cursor: default; }

.cdp-thread { margin: 2rem 0 0; display: flex; flex-direction: column; gap: 1.75rem; }
.cdp-entry { opacity: 0; transform: translateY(6px); animation: cdpRise 0.5s ease forwards; }
@keyframes cdpRise { to { opacity: 1; transform: none; } }
.cdp-person { text-align: center; color: var(--cdp-muted); font-style: italic; font-size: 0.95rem; margin: 0 0 0.85rem; }
.cdp-reply { position: relative; background: var(--cdp-card); border: 1px solid var(--cdp-card-border); border-left: 2px solid var(--cdp-gold); border-radius: 10px; padding: 1.1rem 1.3rem; }
.cdp-reply .cdp-voice-corner { position: absolute; top: 0.6rem; right: 0.9rem; font-size: 0.6rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--cdp-muted); }
.cdp-reply p { margin: 0 0 0.85rem; font-size: 1.06rem; }
.cdp-reply p:last-child { margin-bottom: 0; }
.cdp-reply .cdp-keel { color: var(--cdp-gold); }
.cdp-living { color: var(--cdp-muted); font-style: italic; font-size: 0.9rem; margin: 0.75rem 0 0; }
.cdp-rehear { display: flex; align-items: center; gap: 0.5rem; margin: 0.8rem 0 0; flex-wrap: wrap; }
.cdp-rehear .lbl { color: var(--cdp-muted); font-style: italic; font-size: 0.85rem; }
.cdp-follow { margin: 0.9rem 0 0; }
.cdp-follow .lbl { color: var(--cdp-muted); font-style: italic; font-size: 0.85rem; }
.cdp-chip { display: block; width: 100%; text-align: center; cursor: pointer; background: var(--cdp-panel); border: 1px solid var(--cdp-side-border); border-radius: 8px; color: var(--cdp-ink); font-family: Georgia, serif; font-style: italic; font-size: 0.95rem; padding: 0.6rem 1rem; margin: 0.5rem 0 0; }
.cdp-chip:hover { border-color: var(--cdp-gold); }
.cdp-chip .star { color: var(--cdp-gold); margin-right: 0.4rem; }
.cdp-busy { color: var(--cdp-muted); font-style: italic; }

/* the single consolidated menu */
.cdp-backdrop { position: fixed; inset: 0; background: rgba(6,12,22,0.5); opacity: 0; pointer-events: none; transition: opacity 0.2s ease; z-index: 40; }
.cdp-backdrop.open { opacity: 1; pointer-events: auto; }
.cdp-menu { position: fixed; top: 0; right: 0; height: 100vh; width: min(20rem, 88vw); background: var(--cdp-bg); border-left: 1px solid var(--cdp-side-border); transform: translateX(100%); transition: transform 0.24s ease; z-index: 50; overflow-y: auto; padding: 1.25rem 1.25rem 2rem; }
.cdp-menu.open { transform: none; }
.cdp-menu-head { display: flex; justify-content: space-between; align-items: center; margin: 0 0 1.25rem; }
.cdp-menu-title { font-family: Cinzel, Georgia, serif; letter-spacing: 0.2em; font-size: 0.8rem; color: var(--cdp-gold); text-transform: uppercase; }
.cdp-menu-x { background: transparent; border: 0; color: var(--cdp-muted); font-size: 1.4rem; line-height: 1; cursor: pointer; }
.cdp-menu-sect { margin: 0 0 1.4rem; }
.cdp-menu-sect-head { font-size: 0.64rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--cdp-muted); margin: 0 0 0.5rem; }
.cdp-menu-row { display: flex; width: 100%; justify-content: space-between; align-items: center; gap: 0.75rem; text-align: left; background: transparent; border: 0; border-bottom: 1px solid var(--cdp-side-border); color: var(--cdp-ink); font-family: Georgia, serif; font-size: 0.98rem; padding: 0.6rem 0.1rem; cursor: pointer; }
.cdp-menu-row:hover { color: var(--cdp-gold); }
.cdp-menu-row.static { cursor: default; }
.cdp-menu-row.static:hover { color: var(--cdp-ink); }
.cdp-menu-row.current span:first-child { color: var(--cdp-gold); }
.cdp-menu-val { font-size: 0.78rem; color: var(--cdp-muted); font-style: italic; }
.cdp-menu-val.soon { opacity: 0.7; }
.cdp-menu-note { color: var(--cdp-muted); font-style: italic; font-size: 0.88rem; margin: 0.5rem 0 0; }
.cdp-menu-foot { color: var(--cdp-muted); font-size: 0.78rem; font-style: italic; margin: 1.5rem 0 0; }
`;

/* ---- coordinate rendering ------------------------------------------------- */

function tagFor(c: Coordinate): HTMLElement {
  if (c.unknown) return el('span', { class: 'cdp-tag pending' }, 'not yet available');
  return el('span', { class: 'cdp-tag' }, c.register);
}

function coordinateCard(c: Coordinate): HTMLElement {
  const card = el('div', { class: 'cdp-card' });
  card.appendChild(el('p', { class: 'cdp-card-label' }, c.label));
  card.appendChild(el('p', { class: 'cdp-card-value' }, c.display));
  const isPortal = c.key === 'kin' && c.display.indexOf('Galactic Activation Portal') >= 0;
  if (isPortal) {
    const row = el('div');
    row.appendChild(el('span', { class: 'cdp-tag gold' }, 'portal day'));
    row.appendChild(document.createTextNode(' '));
    row.appendChild(tagFor(c));
    card.appendChild(row);
  } else {
    card.appendChild(tagFor(c));
  }
  return card;
}

/* ---- the mount ------------------------------------------------------------ */

const FOLLOWUPS = [
  'What am I overcomplicating here?',
  'What would I tell a friend about this?',
  'What is the smallest next step?',
];

const SOON_ITEMS = [
  'Calendar', 'Profiles', 'Compatibility', 'My Year', 'History',
  'Tiers', 'Guide', 'Streak', 'Feedback', 'Share and invite', 'Account', 'Sign in',
];

const THEME_KEY = 'cdp-theme';
const ROOM_DEFAULT = 'What I am carrying';

export async function mountVessel(options: VesselOptions): Promise<void> {
  const { root, orchestrator, repo } = options;
  const profile = options.profile;
  const now = Date.now();
  const dateStr = todayUTCDateStr(now);

  // The data layer is the single source of held state. Load it before first paint.
  if (!repo.isLoaded) await repo.init();

  let lens: Lens = repo.getLens();
  let menuOpen = false;

  // A presentation preference only, so it legitimately lives outside vessel state.
  let theme: UiTheme = 'dark';
  try {
    const t = window.localStorage.getItem(THEME_KEY);
    if (t === 'dark' || t === 'light') theme = t;
  } catch (_e) { /* storage unavailable, keep the default */ }

  // pending[intentionId] holds a transient busy line while a reply composes.
  const pending: Record<string, string> = {};

  if (!document.getElementById('cdp-vessel-styles')) {
    const style = el('style', { id: 'cdp-vessel-styles' });
    style.textContent = STYLES;
    document.head.appendChild(style);
  }

  clear(root);
  const surface = el('div', { class: 'cdp-surface', 'data-theme': theme });
  root.appendChild(surface);

  const layout = el('div', { class: 'cdp-layout' });
  surface.appendChild(layout);

  function setTheme(next: UiTheme): void {
    theme = next;
    surface.setAttribute('data-theme', theme);
    try { window.localStorage.setItem(THEME_KEY, theme); } catch (_e) { /* presentation only */ }
  }

  /* ----- derive the thread and context from the repository ----- */

  function entriesFromRepo(): EntryVM[] {
    const snap = repo.snapshot();
    const chrono = [...snap.intentions].sort((a, b) => a.createdAt - b.createdAt);
    return chrono.map((it): EntryVM => {
      const vt = latestVesselTouch(it);
      return {
        id: it.id,
        personText: it.text,
        oracleText: vt ? vt.text : '',
        oracleSummary: it.summary || '',
        lens: vt && vt.lens ? vt.lens : lens,
      };
    });
  }

  function recentTouches(beforeId: string): NonNullable<DepthContext['recentTouches']> {
    const snap = repo.snapshot();
    const target = snap.intentions.find(i => i.id === beforeId);
    const chrono = [...snap.intentions].sort((a, b) => a.createdAt - b.createdAt);
    const out: NonNullable<DepthContext['recentTouches']> = [];
    for (const it of chrono) {
      if (target && it.createdAt >= target.createdAt) break;
      out.push({ role: 'person', text: it.text });
      const vt = latestVesselTouch(it);
      if (vt) out.push({ role: 'oracle', text: vt.text });
    }
    return out;
  }

  /* ----- sidebar ----- */
  const side = el('aside', { class: 'cdp-side' });
  side.appendChild(el('div', { class: 'cdp-brand' }, 'VESSEL'));
  const search = el('input', { class: 'cdp-search', type: 'text', placeholder: 'Search intentions', 'aria-label': 'Search intentions' }) as HTMLInputElement;
  side.appendChild(search);
  const sideLists = el('div');
  side.appendChild(sideLists);
  const sideFoot = el('div', { class: 'cdp-side-foot' });
  side.appendChild(sideFoot);
  layout.appendChild(side);

  function group(headText: string): HTMLElement {
    const wrap = el('div');
    wrap.appendChild(el('p', { class: 'cdp-side-group-head' }, headText));
    return wrap;
  }

  function sideItem(it: HeldIntention, when: string, active: boolean): HTMLElement {
    const item = el('div', { class: active ? 'cdp-side-item active' : 'cdp-side-item' });
    item.appendChild(el('div', { class: 't' }, it.text));
    item.appendChild(el('div', { class: 's' }, when));
    return item;
  }

  function renderSidebar(): void {
    clear(sideLists);
    const q = search.value.trim().toLowerCase();
    const match = (it: HeldIntention) => q.length === 0 || it.text.toLowerCase().indexOf(q) >= 0;

    const live = repo.live().filter(match);
    const resting = repo.resting().filter(match);

    const activeNow = live.slice(0, 1);
    const held = live.slice(1);

    const gActive = group('Active now');
    if (activeNow.length === 0) {
      gActive.appendChild(el('p', { class: 'cdp-side-empty' }, 'Nothing is held yet. What you name here is kept, and it is here when you return.'));
    } else {
      activeNow.forEach((it, i) => gActive.appendChild(sideItem(it, 'Now', i === 0)));
    }
    sideLists.appendChild(gActive);

    if (held.length > 0) {
      const gHeld = group('Held');
      held.forEach((it) => gHeld.appendChild(sideItem(it, 'Held', false)));
      sideLists.appendChild(gHeld);
    }

    if (resting.length > 0) {
      const gRest = group('Resting');
      resting.forEach((it) => gRest.appendChild(sideItem(it, 'Resting, recoverable', false)));
      sideLists.appendChild(gRest);
    }

    const themes = repo.themes();
    const gThemes = group('Themes and patterns');
    if (themes.length > 0) {
      themes.forEach((t) => {
        const item = el('div', { class: 'cdp-side-item' });
        item.appendChild(el('div', { class: 't' }, t.label));
        sideLists.appendChild(item);
      });
    } else {
      gThemes.appendChild(el('p', { class: 'cdp-side-empty' }, 'Themes emerge as you hold more, across your visits.'));
    }
    sideLists.appendChild(gThemes);

    const total = repo.live().length + repo.resting().length;
    sideFoot.textContent = total === 0 ? 'Held: none' : 'Held: ' + total;
  }
  search.addEventListener('input', renderSidebar);

  /* ----- main ----- */
  const main = el('main', { class: 'cdp-main' });
  layout.appendChild(main);

  const topbar = el('div', { class: 'cdp-topbar' });
  const dateEl = el('div', { class: 'cdp-date' }, longDate(dateStr));
  const voiceState = el('em');
  voiceState.textContent = 'in the ' + lensLabel(lens) + ' voice';
  dateEl.appendChild(voiceState);
  topbar.appendChild(dateEl);
  const menuBtn = el('button', { type: 'button', class: 'cdp-menu-btn', 'aria-haspopup': 'dialog', 'aria-expanded': 'false' }, 'Menu') as HTMLButtonElement;
  menuBtn.addEventListener('click', () => openMenu());
  topbar.appendChild(menuBtn);
  main.appendChild(topbar);

  const compass = el('div', { class: 'cdp-compass' });
  compass.innerHTML = COMPASS_SVG; // static, no person data
  main.appendChild(compass);

  main.appendChild(el('h1', { class: 'cdp-hero-h' }, 'What is alive for you right now?'));
  main.appendChild(el('p', { class: 'cdp-hero-sub' }, 'A line, a question, a need, an intention. The Oracle replies in the voice you choose.'));

  /* coordinates, one converged view, foldable */
  const coords = el('details', { class: 'cdp-coords', open: 'open' });
  coords.appendChild(el('summary', {}, 'Today, together'));
  const grid = el('div', { class: 'cdp-grid' });
  const day = dayCoordinates(dateStr, profile && profile.birthDate ? { birthDate: profile.birthDate } : undefined);
  for (const c of day.coordinates) grid.appendChild(coordinateCard(c));
  coords.appendChild(grid);
  coords.appendChild(el('p', { class: 'cdp-coords-note' }, 'Today\u0027s coordinates in one view. Where they point the same way, and where they do not, is drawn out in the reading and in the voice you choose.'));
  main.appendChild(coords);

  /* the ask */
  const ask = el('div', { class: 'cdp-ask' });
  const textarea = el('textarea', { rows: '2', placeholder: 'Type whatever is alive right now.', 'aria-label': 'What is alive for you right now' }) as HTMLTextAreaElement;
  ask.appendChild(textarea);
  const askRow = el('div', { class: 'cdp-ask-row' });
  askRow.appendChild(el('span', { class: 'cdp-reply-in' }, 'Reply in'));
  const voices = el('div', { class: 'cdp-voices' });
  const voiceDefs: Array<{ key: Lens }> = [{ key: 'tradition' }, { key: 'science' }, { key: 'everyday' }];
  const voiceButtons: Record<string, HTMLElement> = {};

  function reflectVoice(): void {
    for (const def of voiceDefs) voiceButtons[def.key].setAttribute('aria-pressed', def.key === lens ? 'true' : 'false');
    voiceState.textContent = 'in the ' + lensLabel(lens) + ' voice';
  }
  function setVoice(next: Lens): void {
    lens = next;
    reflectVoice();
    void repo.setLens(next);
    trackEvent('voice_changed', { lens: next });
  }
  for (const def of voiceDefs) {
    const b = el('button', { type: 'button', class: 'cdp-voice', 'aria-pressed': 'false' }, lensLabel(def.key));
    b.addEventListener('click', () => setVoice(def.key));
    voiceButtons[def.key] = b;
    voices.appendChild(b);
  }
  askRow.appendChild(voices);
  const reply = el('button', { type: 'button', class: 'cdp-primary' }, 'Reply') as HTMLButtonElement;
  askRow.appendChild(reply);
  ask.appendChild(askRow);
  main.appendChild(ask);
  reflectVoice(); // reflect the stored default without re-persisting it

  const thread = el('div', { class: 'cdp-thread', 'aria-live': 'polite' });
  main.appendChild(thread);

  /* ----- thread mechanics ----- */

  function paragraphs(into: HTMLElement, text: string): void {
    const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p.length > 0);
    paras.forEach((p, i) => into.appendChild(el('p', i === paras.length - 1 ? { class: 'cdp-keel' } : {}, p)));
  }

  function renderEntry(entry: EntryVM): HTMLElement {
    const wrap = el('div', { class: 'cdp-entry' });
    wrap.appendChild(el('p', { class: 'cdp-person' }, entry.personText));

    const card = el('div', { class: 'cdp-reply' });
    const busy = pending[entry.id];
    if (busy) {
      card.appendChild(el('p', { class: 'cdp-busy' }, busy));
      wrap.appendChild(card);
      return wrap;
    }

    card.appendChild(el('span', { class: 'cdp-voice-corner' }, lensLabel(entry.lens)));
    const bodyWrap = el('div');
    paragraphs(bodyWrap, entry.oracleText);
    card.appendChild(bodyWrap);
    if (entry.oracleSummary) card.appendChild(el('p', { class: 'cdp-living' }, entry.oracleSummary));

    const rehear = el('div', { class: 'cdp-rehear' });
    rehear.appendChild(el('span', { class: 'lbl' }, 'hear in'));
    for (const def of voiceDefs) {
      const b = el('button', { type: 'button', class: 'cdp-voice', 'aria-pressed': def.key === entry.lens ? 'true' : 'false' }, lensLabel(def.key));
      b.addEventListener('click', () => { void rehearEntry(entry.id, def.key); });
      rehear.appendChild(b);
    }
    card.appendChild(rehear);
    wrap.appendChild(card);

    const follow = el('div', { class: 'cdp-follow' });
    follow.appendChild(el('span', { class: 'lbl' }, 'Ask a follow-up'));
    for (const f of FOLLOWUPS) {
      const chip = el('button', { type: 'button', class: 'cdp-chip' });
      chip.appendChild(el('span', { class: 'star' }, '\u2726'));
      chip.appendChild(document.createTextNode(f));
      chip.addEventListener('click', () => { void compose(f); });
      follow.appendChild(chip);
    }
    wrap.appendChild(follow);
    return wrap;
  }

  function renderThread(): void {
    clear(thread);
    entriesFromRepo().forEach((e) => thread.appendChild(renderEntry(e)));
  }

  function scrollToLast(): void {
    const last = thread.lastElementChild as HTMLElement | null;
    if (last && last.scrollIntoView) last.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function rehearEntry(intentionId: string, newLens: Lens): Promise<void> {
    const it = repo.byId(intentionId);
    if (!it) return;
    const current = latestVesselTouch(it);
    if (current && current.lens === newLens) return;
    trackEvent('voice_reheard', { lens: newLens });
    pending[intentionId] = 'Hearing it again in the ' + lensLabel(newLens) + ' voice.';
    renderThread();
    const composed = await orchestrator.depth(it, newLens, { recentTouches: recentTouches(intentionId) });
    await repo.addTouch(intentionId, { role: 'vessel', text: composed.text, lens: newLens });
    if (composed.summary) await repo.setSummary(intentionId, composed.summary);
    delete pending[intentionId];
    renderThread();
  }

  async function compose(text: string): Promise<void> {
    const line = text.trim();
    if (line.length === 0) { textarea.focus(); return; }

    trackEvent('reply_requested', { lens });
    const room = await repo.ensureRoom(ROOM_DEFAULT);
    const held = await repo.hold({ text: line, roomId: room.id, kind: 'acute' });
    trackEvent('intention_held', {});

    pending[held.id] = 'Composing in the ' + lensLabel(lens) + ' voice.';
    renderSidebar();
    renderThread();
    scrollToLast();

    reply.disabled = true;
    const started = Date.now();
    try {
      const composed = await orchestrator.depth(held, lens, { recentTouches: recentTouches(held.id) });
      await repo.addTouch(held.id, { role: 'vessel', text: composed.text, lens });
      if (composed.summary) await repo.setSummary(held.id, composed.summary);
      trackEvent('reply_delivered', { lens, ms: Date.now() - started });
    } finally {
      delete pending[held.id];
      reply.disabled = false;
      renderSidebar();
      renderThread();
      scrollToLast();
    }
  }

  reply.addEventListener('click', () => { const t = textarea.value; textarea.value = ''; void compose(t); });
  textarea.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); const t = textarea.value; textarea.value = ''; void compose(t); }
  });

  // First paint of the thread and sidebar from whatever the person already holds.
  renderSidebar();
  renderThread();

  /* ----- the one menu ----- */

  const backdrop = el('div', { class: 'cdp-backdrop', 'aria-hidden': 'true' });
  const drawer = el('div', { class: 'cdp-menu', role: 'dialog', 'aria-label': 'Menu', 'aria-modal': 'true' });
  surface.appendChild(backdrop);
  surface.appendChild(drawer);

  function closeMenu(): void {
    menuOpen = false;
    backdrop.classList.remove('open');
    drawer.classList.remove('open');
    menuBtn.setAttribute('aria-expanded', 'false');
  }
  function openMenu(): void {
    menuOpen = true;
    backdrop.classList.add('open');
    drawer.classList.add('open');
    menuBtn.setAttribute('aria-expanded', 'true');
    trackEvent('menu_opened', {});
  }
  backdrop.addEventListener('click', closeMenu);
  document.addEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Escape' && menuOpen) closeMenu(); });

  const mh = el('div', { class: 'cdp-menu-head' });
  mh.appendChild(el('span', { class: 'cdp-menu-title' }, 'Menu'));
  const closeBtn = el('button', { type: 'button', class: 'cdp-menu-x', 'aria-label': 'Close menu' }, '\u00d7') as HTMLButtonElement;
  closeBtn.addEventListener('click', closeMenu);
  mh.appendChild(closeBtn);
  drawer.appendChild(mh);

  // The day: where you are, and the deliberate reading door.
  const daySect = el('div', { class: 'cdp-menu-sect' });
  daySect.appendChild(el('p', { class: 'cdp-menu-sect-head' }, 'The day'));
  const compassRow = el('div', { class: 'cdp-menu-row static current' });
  compassRow.appendChild(el('span', {}, 'Compass'));
  compassRow.appendChild(el('span', { class: 'cdp-menu-val' }, 'here now'));
  daySect.appendChild(compassRow);
  const readingRow = el('button', { type: 'button', class: 'cdp-menu-row' });
  readingRow.appendChild(el('span', {}, 'Reading'));
  readingRow.appendChild(el('span', { class: 'cdp-menu-val' }, 'open'));
  const readingNote = el('p', { class: 'cdp-menu-note' });
  readingRow.addEventListener('click', () => {
    clear(readingNote);
    readingNote.appendChild(el('span', {}, 'The deep reading is the long, cited reading drawn around your chart. It is composed in the next stage of the build, and it opens only from here, when you choose it.'));
    trackEvent('deep_reading_opened', {});
  });
  daySect.appendChild(readingRow);
  daySect.appendChild(readingNote);
  drawer.appendChild(daySect);

  // Settings: the live controls, theme and the default voice.
  const settings = el('div', { class: 'cdp-menu-sect' });
  settings.appendChild(el('p', { class: 'cdp-menu-sect-head' }, 'Settings'));
  const themeRow = el('button', { type: 'button', class: 'cdp-menu-row' });
  themeRow.appendChild(el('span', {}, 'Toggle theme'));
  const themeVal = el('span', { class: 'cdp-menu-val' }, theme === 'dark' ? 'Dark' : 'Light');
  themeRow.appendChild(themeVal);
  themeRow.addEventListener('click', () => { setTheme(theme === 'dark' ? 'light' : 'dark'); themeVal.textContent = theme === 'dark' ? 'Dark' : 'Light'; });
  settings.appendChild(themeRow);

  const pinRow = el('button', { type: 'button', class: 'cdp-menu-row' });
  pinRow.appendChild(el('span', {}, 'Pin current voice as default'));
  const pinVal = el('span', { class: 'cdp-menu-val' }, lensLabel(lens));
  pinRow.appendChild(pinVal);
  pinRow.addEventListener('click', () => {
    void repo.setLens(lens);
    pinVal.textContent = lensLabel(lens);
  });
  settings.appendChild(pinRow);
  drawer.appendChild(settings);

  // Everything the old menus scattered, gathered here and honestly marked.
  const soon = el('div', { class: 'cdp-menu-sect' });
  soon.appendChild(el('p', { class: 'cdp-menu-sect-head' }, 'Arrives as the build grows'));
  for (const label of SOON_ITEMS) {
    const row = el('div', { class: 'cdp-menu-row static' });
    row.appendChild(el('span', {}, label));
    row.appendChild(el('span', { class: 'cdp-menu-val soon' }, 'soon'));
    soon.appendChild(row);
  }
  drawer.appendChild(soon);
  drawer.appendChild(el('p', { class: 'cdp-menu-foot' }, 'One menu, gathering what the old menus scattered. Each item lights up as its stage lands.'));

  // The trial can be read from the first visit: a session has begun and the surface is seen.
  trackEvent('session_start', {});
  trackEvent('surface_view', {});
}
