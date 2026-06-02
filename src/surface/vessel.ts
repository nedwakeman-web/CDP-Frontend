/**
 * Vessel: the CDP compass surface, built to the agreed design.
 *
 * This is the May29 integration prototype made real: a left sidebar of held
 * intentions grouped by gravity, a top bar carrying the date, the day's tagline,
 * and the three voices, and a centred compass with a single input. A reply is
 * composed by the orchestrator and shown in a clean card, not a stacked feed.
 * The day's coordinates are kept out of the conversation, one quiet tap away
 * behind Today, so they inform without cluttering.
 *
 * The machinery underneath is unchanged and working: state lives in the
 * VesselRepository over a Store, so what a person holds survives a closed tab,
 * and composition goes through the Orchestrator interface, so the real reading
 * is composed on the server and degrades honestly when it cannot be reached.
 *
 * Design notes:
 *   - Palette and layout follow the agreed prototype. Fonts follow CDP canon,
 *     Georgia body with Cinzel display, not the prototype's EB Garamond.
 *   - All person-typed text is written with textContent, never interpolated
 *     into markup, so an apostrophe can never break a string.
 *   - No coordinate is fabricated. Lunar reads as not yet available until USNO
 *     is wired. The language is the CDP core: intentions, what is alive.
 *   - House style: no em dashes, no en dashes, no exclamation marks, in code
 *     and in anything a person reads.
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
  repo: VesselRepository;
  profile?: { birthDate?: string; name?: string };
}

type UiTheme = 'dark' | 'light';

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
function clear(node: HTMLElement): void { while (node.firstChild) node.removeChild(node.firstChild); }

/* ---- date and labels ------------------------------------------------------ */

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function todayUTCDateStr(now: number): string { return new Date(now).toISOString().slice(0, 10); }
function longDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  return WEEKDAYS[d.getUTCDay()] + ', ' + d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
}
function lensLabel(lens: Lens): string {
  return lens === 'tradition' ? 'Tradition' : lens === 'science' ? 'Science' : 'Everyday';
}
function greeting(now: number): string {
  const h = new Date(now).getHours();
  if (h < 12) return 'Good morning.';
  if (h < 18) return 'Good afternoon.';
  return 'Good evening.';
}
function latestVesselTouch(it: HeldIntention): Touch | null {
  for (let i = it.touches.length - 1; i >= 0; i -= 1) if (it.touches[i].role === 'vessel') return it.touches[i];
  return null;
}

/* ---- styles, the agreed design, themeable via variables ------------------- */

const STYLES = `
.cdp-surface {
  --gold: #C9A050;
  --gold-line: #A58459;
  --gold-deep: #B8942A;
  font-family: Georgia, "Times New Roman", serif;
  color: var(--text);
  background: var(--bg);
  min-height: 100vh;
}
.cdp-surface[data-theme="dark"] {
  --bg: linear-gradient(135deg, #0A1420 0%, #1A2D42 100%);
  --text: #D8CBB8;
  --text-dim: rgba(216,203,184,0.6);
  --text-faint: rgba(216,203,184,0.4);
  --border: rgba(201,160,80,0.2);
  --panel: rgba(44,62,90,0.3);
  --panel-2: rgba(44,62,90,0.2);
  --panel-3: rgba(44,62,90,0.4);
  --sidebar-bg: rgba(26,45,66,0.9);
}
.cdp-surface[data-theme="light"] {
  --bg: linear-gradient(135deg, #F3EEE3 0%, #E7EDF3 100%);
  --text: #2A2A2A;
  --text-dim: rgba(42,42,42,0.6);
  --text-faint: rgba(42,42,42,0.42);
  --border: rgba(165,132,89,0.4);
  --panel: rgba(255,255,255,0.6);
  --panel-2: rgba(255,255,255,0.45);
  --panel-3: rgba(255,255,255,0.75);
  --sidebar-bg: rgba(255,255,255,0.6);
  --gold: #9A7B22;
  --gold-line: #A58459;
}
.cdp-surface * { box-sizing: border-box; margin: 0; padding: 0; }

.cdp-app { display: flex; height: 100vh; width: 100%; overflow: hidden; }

.cdp-sidebar { width: 280px; background: var(--sidebar-bg); border-right: 1px solid var(--border); display: flex; flex-direction: column; overflow: hidden; }
.cdp-sidebar-header { padding: 1rem; border-bottom: 1px solid var(--border); }
.cdp-logo { font-family: Cinzel, Georgia, serif; font-size: 0.9rem; color: var(--gold); text-transform: uppercase; letter-spacing: 0.18em; margin-bottom: 0.6rem; }
.cdp-search { width: 100%; padding: 0.5rem 0.6rem; background: var(--panel); border: 1px solid var(--border); border-radius: 2px; color: var(--text); font-family: Georgia, serif; font-size: 0.85rem; }
.cdp-search::placeholder { color: var(--text-faint); font-style: italic; }
.cdp-search:focus { outline: 1px solid var(--gold); }
.cdp-sidebar-content { flex: 1; overflow-y: auto; padding: 0.5rem; }
.cdp-group { margin-bottom: 1.4rem; }
.cdp-group-title { font-family: Cinzel, Georgia, serif; font-size: 0.7rem; color: var(--gold-line); text-transform: uppercase; letter-spacing: 0.1em; padding: 0.4rem 0.75rem; margin-bottom: 0.4rem; border-bottom: 1px solid var(--border); }
.cdp-intent { padding: 0.6rem 0.75rem; margin-bottom: 0.35rem; background: var(--panel-2); border-left: 2px solid transparent; border-radius: 2px; cursor: default; transition: background 0.2s, border-color 0.2s, color 0.2s; }
.cdp-intent:hover { background: var(--panel); border-left-color: var(--gold); color: var(--text); }
.cdp-intent.active { background: rgba(201,160,80,0.14); border-left-color: var(--gold); }
.cdp-intent .t { display: block; font-style: italic; font-size: 0.85rem; color: var(--text-dim); margin-bottom: 0.18rem; }
.cdp-intent.active .t { color: var(--gold); }
.cdp-intent .m { display: block; font-size: 0.68rem; color: var(--text-faint); letter-spacing: 0.03em; }
.cdp-group-empty { padding: 0.4rem 0.75rem; font-style: italic; font-size: 0.82rem; color: var(--text-faint); }
.cdp-sidebar-footer { padding: 0.9rem 0.75rem; border-top: 1px solid var(--border); font-size: 0.74rem; color: var(--text-faint); }

.cdp-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.cdp-topbar { padding: 0.9rem 1.5rem; background: var(--panel); border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; position: relative; }
.cdp-topbar-left { display: flex; gap: 1rem; align-items: baseline; flex-wrap: wrap; }
.cdp-date { font-family: Cinzel, Georgia, serif; font-size: 0.82rem; color: var(--gold); text-transform: uppercase; letter-spacing: 0.1em; }
.cdp-tagline { font-size: 0.88rem; color: var(--text-dim); font-style: italic; }
.cdp-today-btn { background: transparent; border: 1px solid var(--border); color: var(--text-dim); border-radius: 2px; padding: 0.18rem 0.6rem; font-family: Cinzel, Georgia, serif; font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.1em; cursor: pointer; }
.cdp-today-btn:hover { color: var(--gold); border-color: var(--gold); }
.cdp-topbar-right { display: flex; gap: 0.5rem; align-items: center; }
.cdp-voice { padding: 0.35rem 0.75rem; background: transparent; border: 1px solid var(--border); color: var(--gold); font-family: Cinzel, Georgia, serif; font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.08em; border-radius: 2px; cursor: pointer; transition: background 0.2s, border-color 0.2s, color 0.2s; }
.cdp-voice:hover { border-color: var(--gold); background: rgba(201,160,80,0.1); }
.cdp-voice[aria-pressed="true"] { background: var(--gold); border-color: var(--gold); color: #14110A; }
.cdp-menu-btn { background: transparent; border: 1px solid var(--border); color: var(--text-dim); border-radius: 2px; padding: 0.35rem 0.7rem; font-family: Cinzel, Georgia, serif; font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.08em; cursor: pointer; }
.cdp-menu-btn:hover { color: var(--gold); border-color: var(--gold); }

.cdp-today { position: absolute; top: calc(100% + 0.4rem); left: 1.5rem; z-index: 20; background: var(--panel-3); border: 1px solid var(--border); border-radius: 4px; padding: 0.9rem 1rem; min-width: 17rem; display: none; box-shadow: 0 10px 30px rgba(6,12,22,0.35); }
.cdp-today.open { display: block; }
.cdp-today-h { font-family: Cinzel, Georgia, serif; font-size: 0.64rem; color: var(--gold-line); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.6rem; }
.cdp-coord { display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; padding: 0.4rem 0; border-bottom: 1px solid var(--border); }
.cdp-coord:last-child { border-bottom: 0; }
.cdp-coord .l { font-size: 0.66rem; color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.08em; }
.cdp-coord .v { font-family: Cinzel, Georgia, serif; font-size: 0.86rem; color: var(--text); text-align: right; }
.cdp-coord .v.pending { font-family: Georgia, serif; font-style: italic; color: var(--text-faint); }
.cdp-coord .v .portal { display: block; font-family: Georgia, serif; font-size: 0.64rem; font-style: italic; color: var(--gold); }

.cdp-stage { flex: 1; display: flex; flex-direction: column; align-items: center; padding: 2rem 1.5rem 3rem; overflow-y: auto; }
.cdp-intro { text-align: center; margin-bottom: 0.5rem; }
.cdp-intro-sub { font-family: Cinzel, Georgia, serif; font-size: 0.8rem; color: var(--gold); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.5rem; }
.cdp-question { font-size: clamp(1.3rem, 3vw, 1.6rem); color: var(--gold); font-style: italic; line-height: 1.4; }

.cdp-compass { width: clamp(200px, 34vmin, 250px); height: clamp(200px, 34vmin, 250px); border: 2px solid var(--gold-line); border-radius: 50%; margin: 1.75rem auto; position: relative; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle, rgba(201,160,80,0.1) 0%, transparent 70%); box-shadow: 0 0 60px rgba(201,160,80,0.1); }
.cdp-compass-inner { width: 78%; height: 78%; border: 1px solid var(--gold-line); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: Cinzel, Georgia, serif; font-size: 1.3rem; color: var(--gold); }
.cdp-dir { position: absolute; font-family: Cinzel, Georgia, serif; font-size: 0.82rem; color: var(--gold-line); }
.cdp-dir.n { top: 0.6rem; left: 50%; transform: translateX(-50%); }
.cdp-dir.s { bottom: 0.6rem; left: 50%; transform: translateX(-50%); }
.cdp-dir.e { right: 0.8rem; top: 50%; transform: translateY(-50%); }
.cdp-dir.w { left: 0.8rem; top: 50%; transform: translateY(-50%); }

.cdp-input-area { width: 100%; max-width: 620px; margin: 1.5rem auto 0; }
.cdp-input { width: 100%; min-height: 3rem; resize: vertical; padding: 0.9rem 1rem; background: var(--panel-3); border: 1px solid var(--border); border-radius: 2px; color: var(--text); font-family: Georgia, serif; font-size: 1.02rem; font-style: italic; line-height: 1.5; }
.cdp-input::placeholder { color: var(--text-faint); }
.cdp-input:focus { outline: 1px solid var(--gold); }
.cdp-actions { display: flex; gap: 1rem; justify-content: center; margin-top: 1rem; }
.cdp-btn { padding: 0.65rem 1.6rem; background: var(--gold); border: 0; color: #14110A; font-family: Cinzel, Georgia, serif; font-size: 0.76rem; text-transform: uppercase; letter-spacing: 0.08em; border-radius: 2px; cursor: pointer; transition: background 0.2s; }
.cdp-btn:hover { background: #D4B864; }
.cdp-btn:disabled { opacity: 0.5; cursor: default; }
.cdp-hint { text-align: center; margin-top: 0.9rem; font-size: 0.82rem; color: var(--text-faint); font-style: italic; }

.cdp-thread { width: 100%; max-width: 620px; margin: 2rem auto 0; display: flex; flex-direction: column; gap: 1.5rem; }
.cdp-entry { opacity: 0; transform: translateY(6px); animation: cdpRise 0.5s ease forwards; }
@keyframes cdpRise { to { opacity: 1; transform: none; } }
.cdp-person { text-align: center; font-style: italic; font-size: 0.92rem; color: var(--text-dim); margin-bottom: 0.8rem; }
.cdp-reply { position: relative; background: var(--panel); border: 1px solid var(--border); border-left: 2px solid var(--gold); border-radius: 4px; padding: 1.1rem 1.3rem; }
.cdp-reply .corner { position: absolute; top: 0.55rem; right: 0.85rem; font-family: Cinzel, Georgia, serif; font-size: 0.58rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-faint); }
.cdp-reply p { margin-bottom: 0.85rem; font-size: 1.02rem; line-height: 1.65; }
.cdp-reply p:last-child { margin-bottom: 0; }
.cdp-reply p.keel { color: var(--gold); }
.cdp-busy { font-style: italic; color: var(--text-dim); }
.cdp-living { font-style: italic; font-size: 0.86rem; color: var(--text-faint); margin-top: 0.75rem; }
.cdp-rehear { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.85rem; flex-wrap: wrap; }
.cdp-rehear .lbl { font-style: italic; font-size: 0.8rem; color: var(--text-faint); }
.cdp-follow { margin-top: 0.9rem; }
.cdp-follow .lbl { font-style: italic; font-size: 0.8rem; color: var(--text-faint); }
.cdp-chip { display: block; width: 100%; text-align: left; cursor: pointer; background: var(--panel-2); border: 1px solid var(--border); border-radius: 2px; color: var(--text-dim); font-family: Georgia, serif; font-style: italic; font-size: 0.9rem; padding: 0.55rem 0.9rem; margin-top: 0.45rem; }
.cdp-chip:hover { border-color: var(--gold); color: var(--text); }

.cdp-backdrop { position: fixed; inset: 0; background: rgba(6,12,22,0.5); opacity: 0; pointer-events: none; transition: opacity 0.2s; z-index: 40; }
.cdp-backdrop.open { opacity: 1; pointer-events: auto; }
.cdp-menu { position: fixed; top: 0; right: 0; height: 100vh; width: min(20rem, 88vw); background: linear-gradient(135deg, #0A1420 0%, #1A2D42 100%); border-left: 1px solid var(--border); transform: translateX(100%); transition: transform 0.24s; z-index: 50; overflow-y: auto; padding: 1.25rem; }
.cdp-surface[data-theme="light"] .cdp-menu { background: linear-gradient(135deg, #F3EEE3 0%, #E7EDF3 100%); }
.cdp-menu.open { transform: none; }
.cdp-menu-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; }
.cdp-menu-title { font-family: Cinzel, Georgia, serif; font-size: 0.78rem; color: var(--gold); text-transform: uppercase; letter-spacing: 0.16em; }
.cdp-menu-x { background: transparent; border: 0; color: var(--text-dim); font-size: 1.4rem; line-height: 1; cursor: pointer; }
.cdp-menu-row { display: flex; width: 100%; justify-content: space-between; align-items: center; gap: 0.75rem; text-align: left; background: transparent; border: 0; border-bottom: 1px solid var(--border); color: var(--text); font-family: Georgia, serif; font-size: 0.96rem; padding: 0.7rem 0.1rem; cursor: pointer; }
.cdp-menu-row:hover { color: var(--gold); }
.cdp-menu-val { font-size: 0.76rem; color: var(--text-faint); font-style: italic; }
.cdp-menu-note { font-style: italic; font-size: 0.84rem; color: var(--text-faint); margin-top: 0.5rem; }
`;

function coordRow(c: Coordinate): HTMLElement {
  const row = el('div', { class: 'cdp-coord' });
  row.appendChild(el('span', { class: 'l' }, c.label));
  const v = el('span', { class: c.unknown ? 'v pending' : 'v' });
  const portal = c.key === 'kin' && c.display.indexOf('Galactic Activation Portal') >= 0;
  if (portal) {
    v.appendChild(document.createTextNode(c.display.replace(' (Galactic Activation Portal)', '')));
    v.appendChild(el('span', { class: 'portal' }, 'Galactic Activation Portal'));
  } else {
    v.textContent = c.display;
  }
  row.appendChild(v);
  return row;
}

const FOLLOWUPS = ['What am I overcomplicating here?', 'What would I tell a friend about this?', 'What is the smallest next step?'];
const MENU_ITEMS = ['Tiers', 'Guide', 'Streak', 'Feedback', 'Share', 'Account', 'Sign in'];
const THEME_KEY = 'cdp-theme';
const ROOM_DEFAULT = 'What I am carrying';

export async function mountVessel(options: VesselOptions): Promise<void> {
  const { root, orchestrator, repo } = options;
  const profile = options.profile;
  const now = Date.now();
  const dateStr = todayUTCDateStr(now);

  if (!repo.isLoaded) await repo.init();

  let lens: Lens = repo.getLens();
  let menuOpen = false;
  let todayOpen = false;

  let theme: UiTheme = 'dark';
  try { const t = window.localStorage.getItem(THEME_KEY); if (t === 'dark' || t === 'light') theme = t; } catch (_e) { /* presentation only */ }

  const pending: Record<string, string> = {};

  if (!document.getElementById('cdp-vessel-styles')) {
    const style = el('style', { id: 'cdp-vessel-styles' });
    style.textContent = STYLES;
    document.head.appendChild(style);
  }

  clear(root);
  const surface = el('div', { class: 'cdp-surface', 'data-theme': theme });
  root.appendChild(surface);
  const app = el('div', { class: 'cdp-app' });
  surface.appendChild(app);

  function setTheme(next: UiTheme): void {
    theme = next;
    surface.setAttribute('data-theme', theme);
    try { window.localStorage.setItem(THEME_KEY, theme); } catch (_e) { /* presentation only */ }
  }

  function entriesFromRepo(): EntryVM[] {
    const snap = repo.snapshot();
    const chrono = [...snap.intentions].sort((a, b) => a.createdAt - b.createdAt);
    return chrono.map((it): EntryVM => {
      const vt = latestVesselTouch(it);
      return { id: it.id, personText: it.text, oracleText: vt ? vt.text : '', oracleSummary: it.summary || '', lens: vt && vt.lens ? vt.lens : lens };
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
  const sidebar = el('aside', { class: 'cdp-sidebar' });
  const sHead = el('div', { class: 'cdp-sidebar-header' });
  sHead.appendChild(el('div', { class: 'cdp-logo' }, 'Vessel'));
  const search = el('input', { class: 'cdp-search', type: 'text', placeholder: 'Search intentions', 'aria-label': 'Search intentions' }) as HTMLInputElement;
  sHead.appendChild(search);
  sidebar.appendChild(sHead);
  const sContent = el('div', { class: 'cdp-sidebar-content' });
  sidebar.appendChild(sContent);
  const sFoot = el('div', { class: 'cdp-sidebar-footer' });
  sidebar.appendChild(sFoot);
  app.appendChild(sidebar);

  function group(title: string): HTMLElement {
    const wrap = el('div', { class: 'cdp-group' });
    wrap.appendChild(el('div', { class: 'cdp-group-title' }, title));
    return wrap;
  }
  function intentItem(it: HeldIntention, meta: string, active: boolean): HTMLElement {
    const item = el('div', { class: active ? 'cdp-intent active' : 'cdp-intent' });
    item.appendChild(el('span', { class: 't' }, it.text));
    item.appendChild(el('span', { class: 'm' }, meta));
    return item;
  }

  function renderSidebar(): void {
    clear(sContent);
    const q = search.value.trim().toLowerCase();
    const match = (it: HeldIntention) => q.length === 0 || it.text.toLowerCase().indexOf(q) >= 0;
    const live = repo.live().filter(match);
    const resting = repo.resting().filter(match);

    const gActive = group('Active now');
    if (live.length === 0) {
      gActive.appendChild(el('div', { class: 'cdp-group-empty' }, 'Nothing is held yet. What you name here is kept, and it is here when you return.'));
    } else {
      gActive.appendChild(intentItem(live[0], 'Now', true));
    }
    sContent.appendChild(gActive);

    if (live.length > 1) {
      const gHeld = group('Held');
      live.slice(1).forEach((it) => gHeld.appendChild(intentItem(it, 'Held', false)));
      sContent.appendChild(gHeld);
    }
    if (resting.length > 0) {
      const gRest = group('Resting');
      resting.forEach((it) => gRest.appendChild(intentItem(it, 'Resting, recoverable', false)));
      sContent.appendChild(gRest);
    }

    const themes = repo.themes();
    const gThemes = group('Themes and patterns');
    if (themes.length > 0) {
      themes.forEach((t) => {
        const item = el('div', { class: 'cdp-intent' });
        item.appendChild(el('span', { class: 't' }, t.label));
        item.appendChild(el('span', { class: 'm' }, t.threadIds.length + ' intentions'));
        gThemes.appendChild(item);
      });
    } else {
      gThemes.appendChild(el('div', { class: 'cdp-group-empty' }, 'Themes emerge as you hold more, across your visits.'));
    }
    sContent.appendChild(gThemes);

    const total = repo.live().length + repo.resting().length;
    sFoot.textContent = total === 0 ? 'Held: none yet' : 'Held: ' + total + (themes.length > 0 ? '. Themes emerging' : '');
  }
  search.addEventListener('input', renderSidebar);

  /* ----- main ----- */
  const main = el('main', { class: 'cdp-main' });
  app.appendChild(main);

  const topbar = el('div', { class: 'cdp-topbar' });
  const tbLeft = el('div', { class: 'cdp-topbar-left' });
  tbLeft.appendChild(el('div', { class: 'cdp-date' }, longDate(dateStr)));
  const taglineEl = el('div', { class: 'cdp-tagline' }, lensLabel(lens));
  tbLeft.appendChild(taglineEl);
  const todayBtn = el('button', { type: 'button', class: 'cdp-today-btn', 'aria-expanded': 'false' }, 'Today') as HTMLButtonElement;
  tbLeft.appendChild(todayBtn);
  topbar.appendChild(tbLeft);

  const tbRight = el('div', { class: 'cdp-topbar-right' });
  const voiceDefs: Array<{ key: Lens }> = [{ key: 'tradition' }, { key: 'science' }, { key: 'everyday' }];
  const voiceButtons: Record<string, HTMLElement> = {};
  for (const def of voiceDefs) {
    const b = el('button', { type: 'button', class: 'cdp-voice', 'aria-pressed': 'false' }, lensLabel(def.key));
    b.addEventListener('click', () => setVoice(def.key));
    voiceButtons[def.key] = b;
    tbRight.appendChild(b);
  }
  const menuBtn = el('button', { type: 'button', class: 'cdp-menu-btn', 'aria-haspopup': 'dialog', 'aria-expanded': 'false' }, 'Menu') as HTMLButtonElement;
  menuBtn.addEventListener('click', () => openMenu());
  tbRight.appendChild(menuBtn);
  topbar.appendChild(tbRight);

  const today = el('div', { class: 'cdp-today', role: 'region', 'aria-label': 'Today' });
  today.appendChild(el('div', { class: 'cdp-today-h' }, 'Today, together'));
  const day = dayCoordinates(dateStr, profile && profile.birthDate ? { birthDate: profile.birthDate } : undefined);
  for (const c of day.coordinates) today.appendChild(coordRow(c));
  topbar.appendChild(today);

  function toggleToday(): void {
    todayOpen = !todayOpen;
    today.classList.toggle('open', todayOpen);
    todayBtn.setAttribute('aria-expanded', todayOpen ? 'true' : 'false');
  }
  todayBtn.addEventListener('click', toggleToday);
  main.appendChild(topbar);

  function reflectVoice(): void {
    for (const def of voiceDefs) voiceButtons[def.key].setAttribute('aria-pressed', def.key === lens ? 'true' : 'false');
    taglineEl.textContent = lensLabel(lens);
  }
  function setVoice(next: Lens): void {
    lens = next;
    reflectVoice();
    void repo.setLens(next);
    trackEvent('voice_changed', { lens: next });
  }

  const stage = el('div', { class: 'cdp-stage' });
  main.appendChild(stage);

  const intro = el('div', { class: 'cdp-intro' });
  intro.appendChild(el('div', { class: 'cdp-intro-sub' }, greeting(now)));
  intro.appendChild(el('div', { class: 'cdp-question' }, 'What is alive for you right now?'));
  stage.appendChild(intro);

  const compass = el('div', { class: 'cdp-compass', 'aria-hidden': 'true' });
  compass.appendChild(el('div', { class: 'cdp-compass-inner' }, '\u25CE'));
  compass.appendChild(el('span', { class: 'cdp-dir n' }, 'N'));
  compass.appendChild(el('span', { class: 'cdp-dir e' }, 'E'));
  compass.appendChild(el('span', { class: 'cdp-dir s' }, 'S'));
  compass.appendChild(el('span', { class: 'cdp-dir w' }, 'W'));
  stage.appendChild(compass);

  const inputArea = el('div', { class: 'cdp-input-area' });
  const textarea = el('textarea', { class: 'cdp-input', rows: '2', placeholder: 'Type whatever is alive right now.', 'aria-label': 'What is alive for you right now' }) as HTMLTextAreaElement;
  inputArea.appendChild(textarea);
  const actions = el('div', { class: 'cdp-actions' });
  const reply = el('button', { type: 'button', class: 'cdp-btn' }, 'Reply') as HTMLButtonElement;
  actions.appendChild(reply);
  inputArea.appendChild(actions);
  inputArea.appendChild(el('div', { class: 'cdp-hint' }, 'Press enter to reply, or shift and enter for a new line.'));
  stage.appendChild(inputArea);

  const thread = el('div', { class: 'cdp-thread', 'aria-live': 'polite' });
  stage.appendChild(thread);

  reflectVoice();

  function paragraphs(into: HTMLElement, text: string): void {
    const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p.length > 0);
    paras.forEach((p, i) => into.appendChild(el('p', i === paras.length - 1 ? { class: 'keel' } : {}, p)));
  }

  function renderEntry(entry: EntryVM): HTMLElement {
    const wrap = el('div', { class: 'cdp-entry' });
    wrap.appendChild(el('div', { class: 'cdp-person' }, entry.personText));
    const card = el('div', { class: 'cdp-reply' });
    const busy = pending[entry.id];
    if (busy) {
      card.appendChild(el('p', { class: 'cdp-busy' }, busy));
      wrap.appendChild(card);
      return wrap;
    }
    card.appendChild(el('span', { class: 'corner' }, lensLabel(entry.lens)));
    const body = el('div');
    paragraphs(body, entry.oracleText);
    card.appendChild(body);
    if (entry.oracleSummary) card.appendChild(el('div', { class: 'cdp-living' }, entry.oracleSummary));

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
    follow.appendChild(el('div', { class: 'lbl' }, 'Ask a follow-up'));
    for (const f of FOLLOWUPS) {
      const chip = el('button', { type: 'button', class: 'cdp-chip' }, f);
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

  renderSidebar();
  renderThread();

  /* ----- the lean menu ----- */
  const backdrop = el('div', { class: 'cdp-backdrop', 'aria-hidden': 'true' });
  const drawer = el('div', { class: 'cdp-menu', role: 'dialog', 'aria-label': 'Menu', 'aria-modal': 'true' });
  surface.appendChild(backdrop);
  surface.appendChild(drawer);

  function closeMenu(): void { menuOpen = false; backdrop.classList.remove('open'); drawer.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); }
  function openMenu(): void { menuOpen = true; backdrop.classList.add('open'); drawer.classList.add('open'); menuBtn.setAttribute('aria-expanded', 'true'); trackEvent('menu_opened', {}); }
  backdrop.addEventListener('click', closeMenu);
  document.addEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Escape' && menuOpen) closeMenu(); });

  const mh = el('div', { class: 'cdp-menu-head' });
  mh.appendChild(el('span', { class: 'cdp-menu-title' }, 'Menu'));
  const closeBtn = el('button', { type: 'button', class: 'cdp-menu-x', 'aria-label': 'Close menu' }, '\u00d7') as HTMLButtonElement;
  closeBtn.addEventListener('click', closeMenu);
  mh.appendChild(closeBtn);
  drawer.appendChild(mh);

  const themeRow = el('button', { type: 'button', class: 'cdp-menu-row' });
  themeRow.appendChild(el('span', {}, 'Toggle theme'));
  const themeVal = el('span', { class: 'cdp-menu-val' }, theme === 'dark' ? 'Dark' : 'Light');
  themeRow.appendChild(themeVal);
  themeRow.addEventListener('click', () => { setTheme(theme === 'dark' ? 'light' : 'dark'); themeVal.textContent = theme === 'dark' ? 'Dark' : 'Light'; });
  drawer.appendChild(themeRow);

  const note = el('div', { class: 'cdp-menu-note' });
  for (const label of MENU_ITEMS) {
    const row = el('button', { type: 'button', class: 'cdp-menu-row' });
    row.appendChild(el('span', {}, label));
    row.addEventListener('click', () => {
      clear(note);
      note.textContent = label + ' arrives as its stage lands. It is on the build path, not yet open.';
    });
    drawer.appendChild(row);
  }
  drawer.appendChild(note);

  trackEvent('session_start', {});
  trackEvent('surface_view', {});
}
