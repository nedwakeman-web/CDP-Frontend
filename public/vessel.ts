/**
 * Vessel: the CDP home, built to the agreed FiveYear May31 design.
 *
 * A quiet centre (the meet-line, the real compass, one ask) with two
 * edge-revealed, pinnable, draggable drawers. Left, "Vault and patterns":
 * What is live now, Patterns emerging, My year in review, Seasonal maps,
 * This is working, the month calendar. Right, "People and reach": Today's
 * reading, The year long view, Profiles, Compatibility, Family oracles,
 * Shared family context, What it knows, The vault.
 *
 * What is wired to real state: the meet-line (your brightest held intention),
 * What is live now (your held and resting intentions), the vault count, today's
 * coordinates in Today's reading, and the ask, which composes a real reflection
 * through the orchestrator and the live /api/compose/depth endpoint. The
 * remaining cards render as the agreed design and open as their stage lands.
 *
 * The data layer underneath (VesselRepository over a Store) is untouched, so
 * what you hold persists across a closed tab. Module order persists per rail.
 *
 * House style: no em dashes, no en dashes, no exclamation marks, in code and in
 * anything a person reads. Palette and layout follow the FiveYear file; fonts
 * follow CDP canon, Georgia body with Cinzel display.
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

/* ---- DOM helpers, safe with person text ----------------------------------- */

type Attrs = Record<string, string>;
function el(tag: string, attrs: Attrs = {}, text?: string): HTMLElement {
  const node = document.createElement(tag);
  for (const k of Object.keys(attrs)) node.setAttribute(k, attrs[k]);
  if (text !== undefined) node.textContent = text;
  return node;
}
function clear(node: HTMLElement): void { while (node.firstChild) node.removeChild(node.firstChild); }
function lineEl(text: string, meta?: string, teal?: boolean): HTMLElement {
  const d = el('div', { class: teal ? 'line teal' : 'line' }, text);
  if (meta) d.appendChild(el('span', { class: 'meta' }, meta));
  return d;
}

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
function latestVesselTouch(it: HeldIntention): Touch | null {
  for (let i = it.touches.length - 1; i >= 0; i -= 1) if (it.touches[i].role === 'vessel') return it.touches[i];
  return null;
}

/* ---- styles, ported from the FiveYear file, scoped under .cdp-surface ------ */

const STYLES = `
.cdp-surface {
  --navy:#031731; --gold:#C9A050; --gold-soft:#E8C878; --gold-line:rgba(201,160,80,0.18);
  --text-light:#F0E6CC; --text-muted:#C8BAA0; --text-dim:rgba(201,186,160,0.55); --teal:#1D9E75;
  background:var(--navy); color:var(--text-light); font-family:Georgia, serif; font-size:14px; line-height:1.6;
  min-height:100vh; overflow:hidden;
}
.cdp-surface * { margin:0; padding:0; box-sizing:border-box; }
.cdp-surface .display { font-family:Cinzel, Georgia, serif; }
.cdp-surface[data-theme="light"] {
  --navy:#F2EDE3; --gold:#9A7B22; --gold-soft:#B8942A; --gold-line:rgba(120,95,40,0.25);
  --text-light:#23303F; --text-muted:#4A5562; --text-dim:rgba(35,48,63,0.5); --teal:#1D7A5E;
}

.cdp-surface .daystrip { display:flex; align-items:center; justify-content:center; gap:10px; margin-bottom:16px; }
.cdp-surface .daystrip .date { font-family:Cinzel, Georgia, serif; font-size:11px; letter-spacing:2px; text-transform:uppercase; color:var(--text-muted); }
.cdp-surface .pill { position:relative; width:13px; height:13px; border-radius:50%; border:1px solid var(--gold-line); background:transparent; cursor:pointer; padding:0; }
.cdp-surface .pill:hover, .cdp-surface .pill.open { border-color:var(--gold); }
.cdp-surface .pill::after { content:''; position:absolute; inset:3.5px; border-radius:50%; background:var(--gold); opacity:.45; }
.cdp-surface .pill.open::after { opacity:1; }
.cdp-surface .coords { position:absolute; top:calc(100% + 8px); left:50%; transform:translateX(-50%); z-index:65; background:var(--navy); border:1px solid var(--gold-line); border-radius:4px; padding:10px 12px; min-width:236px; display:none; box-shadow:0 12px 36px rgba(0,0,0,0.5); text-align:left; }
.cdp-surface .coords.open { display:block; }
.cdp-surface .coords .crow { display:flex; justify-content:space-between; gap:14px; padding:5px 0; border-bottom:1px solid var(--gold-line); }
.cdp-surface .coords .crow:last-child { border-bottom:none; }
.cdp-surface .coords .cl { font-size:10px; letter-spacing:1px; text-transform:uppercase; color:var(--text-dim); }
.cdp-surface .coords .cv { font-family:Cinzel, Georgia, serif; font-size:13px; color:var(--text-light); text-align:right; }
.cdp-surface .coords .cv.pending { font-family:Georgia, serif; font-style:italic; color:var(--text-dim); }

.cdp-surface .header { position:fixed; top:0; left:0; right:0; height:58px; display:flex; align-items:center; justify-content:space-between; padding:0 22px; z-index:60; background:var(--navy); border-bottom:1px solid var(--gold-line); }
.cdp-surface .brand { font-family:Cinzel, Georgia, serif; font-size:16px; font-weight:bold; color:var(--gold); letter-spacing:2px; }
.cdp-surface .voice-wrap { display:flex; flex-direction:column; align-items:center; gap:2px; }
.cdp-surface .voice-toggle { display:flex; gap:2px; background:rgba(13,30,51,0.5); border:1px solid var(--text-dim); border-radius:2px; padding:4px; }
.cdp-surface .voice-btn { padding:6px 13px; background:transparent; color:var(--text-muted); border:none; font-family:Cinzel, Georgia, serif; font-size:11px; letter-spacing:1px; font-weight:500; cursor:pointer; transition:background .2s, color .2s; }
.cdp-surface .voice-btn.active { background:var(--gold); color:var(--navy); }
.cdp-surface .voice-note { font-size:10px; color:var(--text-dim); letter-spacing:.3px; max-width:380px; text-align:center; height:0; overflow:hidden; opacity:0; transition:opacity .2s; }
.cdp-surface .voice-note.show { height:auto; opacity:1; margin-top:1px; }
.cdp-surface .header-right { display:flex; gap:8px; align-items:center; }
.cdp-surface .icon-btn { background:transparent; border:1px solid var(--text-dim); color:var(--text-muted); width:32px; height:32px; border-radius:2px; cursor:pointer; font-size:13px; display:flex; align-items:center; justify-content:center; }
.cdp-surface .icon-btn:hover { border-color:var(--gold); color:var(--gold); }

.cdp-surface .home { position:fixed; inset:58px 0 0 0; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:20px; text-align:center; overflow-y:auto; }
.cdp-surface .meet-line { font-size:19px; font-style:italic; font-weight:300; max-width:560px; margin-bottom:6px; }
.cdp-surface .meet-sub { font-size:13px; color:var(--text-muted); margin-bottom:8px; }
.cdp-surface .compass-svg { width:min(46vmin, 320px); height:auto; display:block; margin:6px auto 16px; }
.cdp-surface .compass-fallback { width:min(46vmin, 320px); height:min(46vmin, 320px); margin:6px auto 16px; }
.cdp-surface .ask { width:min(90vw, 520px); }
.cdp-surface .ask-input { width:100%; padding:14px 16px; min-height:48px; resize:vertical; background:rgba(13,30,51,0.55); border:1px solid var(--gold-line); color:var(--text-light); font-family:Georgia, serif; font-size:14px; border-radius:2px; outline:none; }
.cdp-surface .ask-input:focus { border-color:var(--gold); }
.cdp-surface .ask-input::placeholder { color:var(--text-dim); }
.cdp-surface .ask-row { display:flex; gap:12px; justify-content:center; margin-top:14px; }
.cdp-surface .btn { padding:10px 26px; background:var(--gold); color:var(--navy); border:none; font-family:Cinzel, Georgia, serif; font-size:11px; font-weight:600; letter-spacing:1px; cursor:pointer; border-radius:2px; transition:background .2s; }
.cdp-surface .btn:hover { background:var(--gold-soft); }
.cdp-surface .btn:disabled { opacity:.5; cursor:default; }
.cdp-surface .btn.ghost { background:transparent; color:var(--text-light); border:1px solid var(--gold-line); }
.cdp-surface .meet-context { margin-top:20px; font-size:12px; color:var(--text-dim); letter-spacing:.5px; background:transparent; border:none; cursor:pointer; border-bottom:1px solid var(--gold-line); padding-bottom:2px; }
.cdp-surface .meet-context:hover { color:var(--gold); border-color:var(--gold); }

.cdp-surface .reply { width:min(90vw, 560px); margin:22px auto 0; text-align:left; border:1px solid var(--gold-line); border-left:2px solid var(--gold); border-radius:3px; background:rgba(13,30,51,0.4); padding:16px 18px; position:relative; }
.cdp-surface .reply .corner { position:absolute; top:10px; right:12px; font-family:Cinzel, Georgia, serif; font-size:9px; letter-spacing:1.5px; text-transform:uppercase; color:var(--text-dim); }
.cdp-surface .reply .person { font-style:italic; color:var(--text-muted); margin-bottom:10px; }
.cdp-surface .reply p { font-size:14px; line-height:1.7; margin-bottom:10px; }
.cdp-surface .reply p:last-child { margin-bottom:0; }
.cdp-surface .reply p.keel { color:var(--gold); }
.cdp-surface .reply .living { font-style:italic; font-size:12px; color:var(--text-dim); margin-top:10px; }
.cdp-surface .reply .busy { font-style:italic; color:var(--text-muted); }

.cdp-surface .edge { position:fixed; top:58px; bottom:0; width:26px; z-index:40; }
.cdp-surface .edge-left { left:0; } .cdp-surface .edge-right { right:0; }
.cdp-surface .handle { position:fixed; top:50%; transform:translateY(-50%); z-index:41; width:22px; height:120px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--text-dim); background:var(--navy); border:1px solid var(--gold-line); }
.cdp-surface .handle:hover { color:var(--gold); border-color:var(--gold); }
.cdp-surface .handle-left { left:0; border-left:none; border-radius:0 4px 4px 0; }
.cdp-surface .handle-right { right:0; border-right:none; border-radius:4px 0 0 4px; }
.cdp-surface .handle span { writing-mode:vertical-rl; font-size:10px; letter-spacing:2px; text-transform:uppercase; }
.cdp-surface .handle-left span { transform:rotate(180deg); }

.cdp-surface .drawer { position:fixed; top:58px; bottom:0; width:332px; background:var(--navy); z-index:50; overflow-y:auto; padding:18px 16px 40px; transition:transform .28s ease; box-shadow:0 0 40px rgba(0,0,0,0.45); }
.cdp-surface .drawer-left { left:0; border-right:1px solid var(--gold-line); transform:translateX(-100%); }
.cdp-surface .drawer-right { right:0; border-left:1px solid var(--gold-line); transform:translateX(100%); }
.cdp-surface .drawer.open { transform:translateX(0); }
.cdp-surface .drawer-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
.cdp-surface .drawer-title { font-family:Cinzel, Georgia, serif; font-size:11px; letter-spacing:2px; color:var(--gold); text-transform:uppercase; }
.cdp-surface .pin { background:transparent; border:1px solid var(--text-dim); color:var(--text-dim); font-family:Cinzel, Georgia, serif; font-size:10px; letter-spacing:1px; padding:3px 8px; border-radius:2px; cursor:pointer; }
.cdp-surface .pin.pinned { border-color:var(--gold); color:var(--gold); }

.cdp-surface .module { border:1px solid var(--gold-line); border-radius:3px; margin-bottom:12px; background:rgba(13,30,51,0.32); }
.cdp-surface .module.dragging { opacity:0.45; }
.cdp-surface .module.drop-target { border-color:var(--gold); }
.cdp-surface .module-head { display:flex; align-items:center; gap:8px; padding:9px 10px; border-bottom:1px solid var(--gold-line); cursor:grab; }
.cdp-surface .grip { color:var(--text-dim); font-size:10px; letter-spacing:1px; line-height:1; cursor:grab; text-transform:uppercase; }
.cdp-surface .module-name { flex:1; font-family:Cinzel, Georgia, serif; font-size:11px; letter-spacing:2px; color:var(--gold); text-transform:uppercase; }
.cdp-surface .move { background:transparent; border:none; color:var(--text-dim); cursor:pointer; font-size:11px; padding:0 4px; }
.cdp-surface .move:hover { color:var(--gold); }
.cdp-surface .module-body { padding:11px; }

.cdp-surface .stat { display:flex; align-items:baseline; gap:8px; margin-bottom:4px; }
.cdp-surface .stat-num { font-family:Cinzel, Georgia, serif; font-size:22px; color:var(--gold); font-weight:bold; letter-spacing:.5px; }
.cdp-surface .stat-label { font-size:12px; color:var(--text-muted); }
.cdp-surface .line { font-size:13px; color:var(--text-light); padding:6px 0 6px 10px; border-left:2px solid var(--text-dim); margin-bottom:8px; }
.cdp-surface .line:last-child { margin-bottom:0; }
.cdp-surface .line.teal { border-left-color:var(--teal); }
.cdp-surface .line .meta { display:block; font-size:11px; color:var(--text-dim); margin-top:2px; }
.cdp-surface .soft { font-size:11px; color:var(--text-dim); font-style:italic; margin-top:8px; }
.cdp-surface .opp { font-size:12px; color:var(--text-muted); padding:8px 10px; background:rgba(29,158,117,0.08); border-left:2px solid var(--teal); border-radius:2px; margin-top:8px; }

.cdp-surface .season { display:grid; grid-template-columns:repeat(12,1fr); gap:2px; margin:6px 0 4px; }
.cdp-surface .season span { height:18px; border-radius:1px; }
.cdp-surface .season .g { background:rgba(29,158,117,0.55); }
.cdp-surface .season .c { background:rgba(201,160,80,0.40); }
.cdp-surface .season .n { background:rgba(201,186,160,0.14); }
.cdp-surface .season-key { font-size:10px; color:var(--text-dim); display:flex; gap:12px; }
.cdp-surface .key-dot { display:inline-block; width:8px; height:8px; border-radius:2px; margin-right:4px; }

.cdp-surface .fam { display:flex; align-items:center; justify-content:space-between; padding:7px 0; border-bottom:1px solid var(--gold-line); }
.cdp-surface .fam:last-child { border-bottom:none; }
.cdp-surface .fam-name { font-size:13px; color:var(--text-light); }
.cdp-surface .fam-name span { display:block; font-size:11px; color:var(--text-dim); }
.cdp-surface .fam-count { font-size:11px; color:var(--text-muted); text-align:right; }
.cdp-surface .src { display:flex; align-items:center; gap:8px; padding:6px 0; font-size:13px; color:var(--text-light); }
.cdp-surface .src .dot { width:7px; height:7px; border-radius:50%; background:var(--teal); flex:none; }
.cdp-surface .src .way { margin-left:auto; font-size:10px; color:var(--text-dim); letter-spacing:.5px; text-transform:uppercase; }

.cdp-surface .cal { display:grid; grid-template-columns:repeat(7,1fr); gap:3px; }
.cdp-surface .cal .dow { font-size:9px; color:var(--text-dim); text-align:center; }
.cdp-surface .cal .day { aspect-ratio:1; display:flex; align-items:center; justify-content:center; position:relative; font-size:11px; color:var(--text-muted); border:1px solid transparent; border-radius:2px; cursor:pointer; }
.cdp-surface .cal .day:hover { border-color:var(--gold-line); color:var(--text-light); }
.cdp-surface .cal .day.today { border-color:var(--gold); color:var(--gold); }
.cdp-surface .cal .day .badge { position:absolute; bottom:1px; font-size:7px; line-height:1; color:var(--gold); }

.cdp-surface .scrim { position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:70; opacity:0; pointer-events:none; transition:opacity .25s; }
.cdp-surface .scrim.show { opacity:1; pointer-events:auto; }
.cdp-surface .scrim-drawer { z-index:45; background:rgba(0,0,0,0.45); }
.cdp-surface .world { position:fixed; z-index:80; top:50%; left:50%; transform:translate(-50%,-48%); width:min(92vw, 720px); max-height:84vh; overflow-y:auto; background:var(--navy); border:1px solid var(--gold-line); border-radius:4px; box-shadow:0 18px 70px rgba(0,0,0,0.6); padding:26px 28px 28px; opacity:0; pointer-events:none; transition:opacity .25s, transform .25s; }
.cdp-surface .world.open { opacity:1; pointer-events:auto; transform:translate(-50%,-50%); }
.cdp-surface .world-head { font-size:18px; font-style:italic; font-weight:300; color:var(--text-light); margin-bottom:4px; }
.cdp-surface .world-sub { font-size:12px; color:var(--text-dim); margin-bottom:20px; }
.cdp-surface .world-close { position:absolute; top:16px; right:18px; background:transparent; border:1px solid var(--text-dim); color:var(--text-muted); width:30px; height:30px; border-radius:2px; cursor:pointer; }
.cdp-surface .world-close:hover { border-color:var(--gold); color:var(--gold); }
.cdp-surface .cols { display:grid; grid-template-columns:1fr 1fr; gap:18px; }
.cdp-surface .col-title { font-family:Cinzel, Georgia, serif; font-size:11px; letter-spacing:2px; text-transform:uppercase; color:var(--gold); margin-bottom:10px; }
.cdp-surface .col-item { font-size:13px; color:var(--text-light); padding:8px 0 8px 10px; border-left:2px solid var(--text-dim); margin-bottom:9px; }
.cdp-surface .col-item.held { border-left-color:var(--teal); }

.cdp-surface .menu { position:fixed; top:58px; right:0; width:min(18rem, 86vw); max-height:calc(100vh - 58px); overflow-y:auto; background:var(--navy); border-left:1px solid var(--gold-line); box-shadow:0 0 40px rgba(0,0,0,0.45); z-index:75; transform:translateX(100%); transition:transform .24s; padding:14px 14px 24px; }
.cdp-surface .menu.open { transform:none; }
.cdp-surface .menu-row { display:flex; width:100%; justify-content:space-between; align-items:center; gap:10px; text-align:left; background:transparent; border:none; border-bottom:1px solid var(--gold-line); color:var(--text-light); font-family:Georgia, serif; font-size:14px; padding:11px 2px; cursor:pointer; }
.cdp-surface .menu-row:hover { color:var(--gold); }
.cdp-surface .menu-val { font-size:11px; color:var(--text-dim); font-style:italic; }
.cdp-surface .menu-note { font-size:12px; color:var(--text-dim); font-style:italic; margin-top:8px; }

@media (max-width:820px) {
  .cdp-surface .meet-line { font-size:17px; }
  .cdp-surface .drawer { width:90vw; } .cdp-surface .handle { height:96px; } .cdp-surface .cols { grid-template-columns:1fr; }
  .cdp-surface .voice-note { display:none; }
}
`;

/* ---- the fallback compass, used only if cdp-compass.svg is absent --------- */

const COMPASS_FALLBACK = '<svg class="compass-fallback" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
  + '<circle cx="100" cy="100" r="92" fill="none" stroke="#A58459" stroke-width="1.5"/>'
  + '<circle cx="100" cy="100" r="72" fill="none" stroke="#A58459" stroke-width="0.8"/>'
  + '<circle cx="100" cy="100" r="6" fill="none" stroke="#C9A050" stroke-width="1.2"/>'
  + '<circle cx="100" cy="100" r="2.5" fill="#C9A050"/>'
  + '<line x1="100" y1="14" x2="100" y2="34" stroke="#A58459" stroke-width="0.8"/>'
  + '<line x1="100" y1="166" x2="100" y2="186" stroke="#A58459" stroke-width="0.8"/>'
  + '<line x1="14" y1="100" x2="34" y2="100" stroke="#A58459" stroke-width="0.8"/>'
  + '<line x1="166" y1="100" x2="186" y2="100" stroke="#A58459" stroke-width="0.8"/>'
  + '<text x="100" y="12" text-anchor="middle" font-family="Cinzel, serif" font-size="10" fill="#A58459">N</text>'
  + '<text x="194" y="104" text-anchor="middle" font-family="Cinzel, serif" font-size="10" fill="#A58459">E</text>'
  + '<text x="100" y="198" text-anchor="middle" font-family="Cinzel, serif" font-size="10" fill="#A58459">S</text>'
  + '<text x="6" y="104" text-anchor="middle" font-family="Cinzel, serif" font-size="10" fill="#A58459">W</text>'
  + '</svg>';

/* ---- constants ------------------------------------------------------------ */

const MENU_ITEMS = ['Tiers', 'Guide', 'Streak', 'Feedback', 'Share', 'Toggle theme', 'Account', 'Sign in'];
const SEASON_PATTERN = ['n', 'n', 'c', 'g', 'g', 'g', 'g', 'g', 'c', 'c', 'n', 'n'];
const ROOM_DEFAULT = 'What I am carrying';
const ORDER_KEY = 'cdp-rail-order';

/* ---- mount ---------------------------------------------------------------- */

export async function mountVessel(options: VesselOptions): Promise<void> {
  const { root, orchestrator, repo } = options;
  const profile = options.profile;
  const now = Date.now();
  const dateStr = todayUTCDateStr(now);

  if (!repo.isLoaded) await repo.init();
  let lens: Lens = repo.getLens();

  const pinned: Record<string, boolean> = { left: false, right: false };
  let closeTimer: ReturnType<typeof setTimeout> | null = null;
  let activeReplyId: string | null = null;
  let composing = false;

  if (!document.getElementById('cdp-vessel-styles')) {
    const style = el('style', { id: 'cdp-vessel-styles' });
    style.textContent = STYLES;
    document.head.appendChild(style);
  }

  let theme: 'dark' | 'light' = 'dark';
  try { const t = window.localStorage.getItem('cdp-theme'); if (t === 'dark' || t === 'light') theme = t; } catch (_e) { /* presentation only */ }

  clear(root);
  const surface = el('div', { class: 'cdp-surface', 'data-theme': theme });
  root.appendChild(surface);
  function setTheme(next: 'dark' | 'light'): void {
    theme = next;
    surface.setAttribute('data-theme', theme);
    try { window.localStorage.setItem('cdp-theme', theme); } catch (_e) { /* presentation only */ }
  }

  const day = dayCoordinates(dateStr, profile && profile.birthDate ? { birthDate: profile.birthDate } : undefined);
  function coordValue(key: string): string {
    const c = day.coordinates.find((x: Coordinate) => x.key === key);
    return c && !c.unknown ? c.display : '';
  }

  /* ===== header ===== */
  const header = el('header', { class: 'header' });
  header.appendChild(el('div', { class: 'brand' }, 'COSMIC DAILY PLANNER'));

  const voiceWrap = el('div', { class: 'voice-wrap' });
  const voiceToggle = el('div', { class: 'voice-toggle' });
  const voiceDefs: Lens[] = ['tradition', 'everyday', 'science'];
  const voiceButtons: Record<string, HTMLElement> = {};
  for (const v of voiceDefs) {
    const b = el('button', { type: 'button', class: 'voice-btn', 'data-voice': v }, lensLabel(v).toUpperCase());
    b.addEventListener('click', () => setVoice(v));
    voiceButtons[v] = b;
    voiceToggle.appendChild(b);
  }
  voiceWrap.appendChild(voiceToggle);
  const voiceNote = el('div', { class: 'voice-note' }, 'Everyday is the reading. Turn to Tradition or Science to check it against the register you trust.');
  voiceWrap.appendChild(voiceNote);
  header.appendChild(voiceWrap);

  const headerRight = el('div', { class: 'header-right' });
  const noteBtn = el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'About the voices', title: 'About the voices' }, '?');
  noteBtn.addEventListener('click', () => voiceNote.classList.toggle('show'));
  const calBtn = el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Calendar', title: 'Calendar' }, 'C');
  calBtn.addEventListener('click', () => openDrawer('left'));
  const profBtn = el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Menu', title: 'Menu' }, 'P');
  profBtn.addEventListener('click', () => menu.classList.toggle('open'));
  headerRight.appendChild(noteBtn);
  headerRight.appendChild(calBtn);
  headerRight.appendChild(profBtn);
  header.appendChild(headerRight);
  surface.appendChild(header);

  /* ===== home (centre) ===== */
  const home = el('main', { class: 'home' });

  // a quiet date with a silent coordinate pill, opening on a tap
  const daystrip = el('div', { class: 'daystrip' });
  daystrip.appendChild(el('span', { class: 'date' }, longDate(dateStr)));
  const pill = el('button', { type: 'button', class: 'pill', 'aria-label': 'Today\u2019s coordinates', 'aria-expanded': 'false' });
  const coords = el('div', { class: 'coords', role: 'region', 'aria-label': 'Today\u2019s coordinates' });
  for (const c of day.coordinates) {
    const crow = el('div', { class: 'crow' });
    crow.appendChild(el('span', { class: 'cl' }, c.label));
    crow.appendChild(el('span', { class: c.unknown ? 'cv pending' : 'cv' }, c.display));
    coords.appendChild(crow);
  }
  pill.appendChild(coords);
  let coordsOpen = false;
  pill.addEventListener('click', (e: Event) => {
    e.stopPropagation();
    coordsOpen = !coordsOpen;
    pill.classList.toggle('open', coordsOpen);
    coords.classList.toggle('open', coordsOpen);
    pill.setAttribute('aria-expanded', coordsOpen ? 'true' : 'false');
  });
  document.addEventListener('click', () => { if (coordsOpen) { coordsOpen = false; pill.classList.remove('open'); coords.classList.remove('open'); pill.setAttribute('aria-expanded', 'false'); } });
  daystrip.appendChild(pill);
  home.appendChild(daystrip);

  const brightest = repo.live()[0];
  const meetLine = el('div', { class: 'meet-line' }, brightest ? brightest.text : 'What is alive for you right now.');
  home.appendChild(meetLine);
  home.appendChild(el('div', { class: 'meet-sub' }, 'Ask when you are ready, or sit with the compass.'));

  const compass = el('img', { class: 'compass-svg', src: '/cdp-compass.svg', alt: 'Cosmic Daily Planner compass' }) as HTMLImageElement;
  compass.addEventListener('error', () => {
    const holder = el('div');
    holder.innerHTML = COMPASS_FALLBACK;
    const svg = holder.firstChild;
    if (svg && compass.parentNode) compass.parentNode.replaceChild(svg, compass);
  });
  home.appendChild(compass);

  const ask = el('div', { class: 'ask' });
  const input = el('textarea', { class: 'ask-input', rows: '1', placeholder: 'What is on your mind at the moment', 'aria-label': 'What is on your mind' }) as HTMLTextAreaElement;
  ask.appendChild(input);
  const askRow = el('div', { class: 'ask-row' });
  const continueBtn = el('button', { type: 'button', class: 'btn' }, 'CONTINUE') as HTMLButtonElement;
  const sitBtn = el('button', { type: 'button', class: 'btn ghost' }, 'SIT WITH THE COMPASS');
  askRow.appendChild(continueBtn);
  askRow.appendChild(sitBtn);
  ask.appendChild(askRow);
  home.appendChild(ask);

  const replyArea = el('div', { 'aria-live': 'polite' });
  home.appendChild(replyArea);

  const worldOpenBtn = el('button', { type: 'button', class: 'meet-context' }, 'See how this year is taking shape');
  home.appendChild(worldOpenBtn);
  surface.appendChild(home);

  /* ===== edges, handles, scrims ===== */
  surface.appendChild(el('div', { class: 'edge edge-left', 'data-side': 'left' }));
  surface.appendChild(el('div', { class: 'edge edge-right', 'data-side': 'right' }));
  const handleLeft = el('div', { class: 'handle handle-left', 'data-side': 'left' });
  handleLeft.appendChild(el('span', {}, 'Vault and patterns'));
  const handleRight = el('div', { class: 'handle handle-right', 'data-side': 'right' });
  handleRight.appendChild(el('span', {}, 'People and reach'));
  surface.appendChild(handleLeft);
  surface.appendChild(handleRight);
  const drawerScrim = el('div', { class: 'scrim scrim-drawer' });
  surface.appendChild(drawerScrim);

  /* ===== modules ===== */
  function moduleEl(name: string, body: HTMLElement): HTMLElement {
    const section = el('section', { class: 'module', draggable: 'true', 'data-name': name });
    const head = el('div', { class: 'module-head' });
    head.appendChild(el('span', { class: 'grip' }, 'drag'));
    head.appendChild(el('span', { class: 'module-name' }, name));
    head.appendChild(el('button', { type: 'button', class: 'move up' }, 'up'));
    head.appendChild(el('button', { type: 'button', class: 'move down' }, 'down'));
    section.appendChild(head);
    const bodyWrap = el('div', { class: 'module-body' });
    bodyWrap.appendChild(body);
    section.appendChild(bodyWrap);
    return section;
  }
  function body(...children: HTMLElement[]): HTMLElement {
    const wrap = el('div');
    children.forEach((c) => wrap.appendChild(c));
    return wrap;
  }

  // Left rail, What is live now, wired to the repository.
  const liveBody = el('div');
  function renderLive(): void {
    clear(liveBody);
    const live = repo.live();
    const resting = repo.resting();
    if (live.length === 0 && resting.length === 0) {
      liveBody.appendChild(el('div', { class: 'soft' }, 'Nothing is held yet. What you name in the compass is kept, and it is here when you return.'));
      return;
    }
    live.forEach((it, i) => liveBody.appendChild(lineEl(it.text, i === 0 ? 'Now' : 'Held', i === 0)));
    resting.slice(0, 3).forEach((it) => liveBody.appendChild(lineEl(it.text, 'Resting, recoverable')));
    liveBody.appendChild(el('div', { class: 'soft' }, live.length + ' held now, ' + resting.length + ' resting'));
  }
  renderLive();

  function patternsBody(): HTMLElement {
    return body(
      el('div', { class: 'line' }, 'Patterns surface here as you hold more, drawn from your own readings and outcomes, never a forecast.'),
      el('div', { class: 'soft' }, 'Arrives as its stage lands.')
    );
  }
  function yearBody(): HTMLElement {
    const b = el('div');
    const py = coordValue('personalYear') || coordValue('personal_year');
    const stat = el('div', { class: 'stat' });
    stat.appendChild(el('span', { class: 'stat-num' }, py ? py : 'Year'));
    stat.appendChild(el('span', { class: 'stat-label' }, 'of the current cycle'));
    b.appendChild(stat);
    b.appendChild(el('div', { class: 'line' }, 'A seven year arc, the long pattern beneath the daily one.'));
    b.appendChild(el('div', { class: 'soft' }, 'Trends, review and synthesis. The year as a reading lives on the right. Arrives as its stage lands.'));
    return b;
  }
  function seasonBody(): HTMLElement {
    const b = el('div');
    const grid = el('div', { class: 'season' });
    SEASON_PATTERN.forEach((cls) => grid.appendChild(el('span', { class: cls })));
    b.appendChild(grid);
    const key = el('div', { class: 'season-key' });
    const g = el('span', {}); g.appendChild(el('span', { class: 'key-dot', style: 'background:rgba(29,158,117,0.55)' })); g.appendChild(document.createTextNode('Growth'));
    const c = el('span', {}); c.appendChild(el('span', { class: 'key-dot', style: 'background:rgba(201,160,80,0.40)' })); c.appendChild(document.createTextNode('Consolidation'));
    key.appendChild(g); key.appendChild(c);
    b.appendChild(key);
    b.appendChild(el('div', { class: 'soft' }, 'Summers run as growth, winters as consolidation, drawn from your record. Arrives as its stage lands.'));
    return b;
  }
  function workingBody(): HTMLElement {
    return body(
      el('div', { class: 'line' }, 'What you have resolved, and what is sitting untouched, surface here as your record builds.'),
      el('div', { class: 'soft' }, 'Arrives as its stage lands.')
    );
  }
  function calBody(): HTMLElement {
    const b = el('div');
    const cal = el('div', { class: 'cal' });
    ['M', 'T', 'W', 'T', 'F', 'S', 'S'].forEach((d) => cal.appendChild(el('div', { class: 'dow' }, d)));
    const d0 = new Date(dateStr + 'T00:00:00Z');
    const year = d0.getUTCFullYear();
    const month = d0.getUTCMonth();
    const first = new Date(Date.UTC(year, month, 1));
    const jsDow = first.getUTCDay();           // 0 Sun .. 6 Sat
    const lead = (jsDow + 6) % 7;              // Monday-first offset
    const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    for (let i = 0; i < lead; i += 1) cal.appendChild(el('div', {}));
    for (let dnum = 1; dnum <= days; dnum += 1) {
      const isToday = dnum === d0.getUTCDate();
      const cell = el('div', { class: isToday ? 'day today' : 'day' }, String(dnum));
      cal.appendChild(cell);
    }
    b.appendChild(cal);
    b.appendChild(el('div', { class: 'soft' }, MONTHS[month] + '. Portal, master-number and moon badges arrive with the calendar.'));
    return b;
  }

  // Right rail, Today's reading, with real coordinates.
  function todayBody(): HTMLElement {
    const b = el('div');
    b.appendChild(lineEl('The honest read on today: open it with the compass, and the reading composes around what you are holding.', longDate(dateStr)));
    b.appendChild(el('div', { class: 'soft' }, 'The day\u2019s coordinates sit in the pill by the date. Opens to the full card: the planetary weather and your signature. Arrives as its stage lands.'));
    return b;
  }
  function longViewBody(): HTMLElement {
    return body(
      el('div', { class: 'line' }, 'The backdrop, not the daily forecast: the universal year, your fixed signature, and the slow planetary weather.'),
      el('div', { class: 'soft' }, 'Read once, return when something shifts. Arrives as its stage lands.')
    );
  }
  function profilesBody(): HTMLElement {
    return body(
      lineEl('People in your world', 'Each one a context the oracle can read with you'),
      el('div', { class: 'soft' }, 'Each profile private by default. Arrives as its stage lands.')
    );
  }
  function compatBody(): HTMLElement {
    return body(
      lineEl('Read a relationship through both telescopes.', 'Pick two people and a reading composes around the bond'),
      el('div', { class: 'soft' }, 'Summoned around the relationship, not a fixed page. Arrives as its stage lands.')
    );
  }
  function familyBody(): HTMLElement {
    return body(
      el('div', { class: 'line' }, 'A private oracle for each person you keep on record, shared only when everyone opts in.'),
      el('div', { class: 'soft' }, 'Each oracle private by default. Arrives as its stage lands.')
    );
  }
  function sharedBody(): HTMLElement {
    return body(
      el('div', { class: 'line' }, 'The threads a family holds together surface here, shared only when everyone opts in.'),
      el('div', { class: 'soft' }, 'Arrives as its stage lands.')
    );
  }
  function knowsBody(): HTMLElement {
    const b = el('div');
    b.appendChild(lineEl('The library it draws on', 'The four frameworks and the cited bibliography behind them'));
    [['Calendar', 'in and out'], ['Messages', 'out'], ['Health and wearables', 'in'], ['Documents you add', 'in']].forEach((s) => {
      const row = el('div', { class: 'src' });
      row.appendChild(el('span', { class: 'dot' }));
      row.appendChild(document.createTextNode(s[0]));
      row.appendChild(el('span', { class: 'way' }, s[1]));
      b.appendChild(row);
    });
    b.appendChild(el('div', { class: 'soft' }, 'Nothing is consulted that you have not given it. Arrives as its stage lands.'));
    return b;
  }
  function vaultBody(): HTMLElement {
    const total = repo.live().length + repo.resting().length;
    const b = el('div');
    const stat = el('div', { class: 'stat' });
    stat.appendChild(el('span', { class: 'stat-num' }, String(total)));
    stat.appendChild(el('span', { class: 'stat-label' }, total === 1 ? 'intention on record' : 'intentions on record'));
    b.appendChild(stat);
    b.appendChild(el('div', { class: 'soft' }, 'Everything you have held and tended, kept and searchable.'));
    return b;
  }

  const leftSpec: Array<[string, HTMLElement]> = [
    ['What is live now', liveBody],
    ['Patterns emerging', patternsBody()],
    ['My year in review', yearBody()],
    ['Seasonal maps', seasonBody()],
    ['This is working', workingBody()],
    ['May calendar', calBody()]
  ];
  const rightSpec: Array<[string, HTMLElement]> = [
    ['Today\u2019s reading', todayBody()],
    ['The year, the long view', longViewBody()],
    ['Profiles', profilesBody()],
    ['Compatibility', compatBody()],
    ['Family oracles', familyBody()],
    ['Shared family context', sharedBody()],
    ['What it knows', knowsBody()],
    ['The vault', vaultBody()]
  ];

  function buildDrawer(side: 'left' | 'right', title: string, spec: Array<[string, HTMLElement]>): { drawer: HTMLElement; list: HTMLElement } {
    const drawer = el('aside', { class: 'drawer drawer-' + side, 'data-side': side });
    const top = el('div', { class: 'drawer-top' });
    top.appendChild(el('div', { class: 'drawer-title' }, title));
    const pin = el('button', { type: 'button', class: 'pin', 'data-side': side }, 'PIN');
    top.appendChild(pin);
    drawer.appendChild(top);
    const list = el('div', { class: 'modules' });
    let order = spec.map((s) => s[0]);
    try {
      const saved = window.localStorage.getItem(ORDER_KEY + '-' + side);
      if (saved) {
        const arr = JSON.parse(saved) as string[];
        const known = new Set(order);
        const reordered = arr.filter((n) => known.has(n));
        spec.map((s) => s[0]).forEach((n) => { if (reordered.indexOf(n) < 0) reordered.push(n); });
        order = reordered;
      }
    } catch (_e) { /* presentation only */ }
    const byName: Record<string, HTMLElement> = {};
    spec.forEach((s) => { byName[s[0]] = moduleEl(s[0], s[1]); });
    order.forEach((n) => { if (byName[n]) list.appendChild(byName[n]); });
    drawer.appendChild(list);

    pin.addEventListener('click', () => {
      pinned[side] = !pinned[side];
      pin.classList.toggle('pinned', pinned[side]);
      pin.textContent = pinned[side] ? 'PINNED' : 'PIN';
      if (pinned[side]) openDrawer(side); else closeDrawer(side);
    });
    wireReorder(list, side);
    return { drawer, list };
  }

  function persistOrder(list: HTMLElement, side: string): void {
    const names: string[] = [];
    list.querySelectorAll('.module').forEach((m) => { const n = (m as HTMLElement).getAttribute('data-name'); if (n) names.push(n); });
    try { window.localStorage.setItem(ORDER_KEY + '-' + side, JSON.stringify(names)); } catch (_e) { /* presentation only */ }
  }

  function wireReorder(list: HTMLElement, side: string): void {
    let dragEl: HTMLElement | null = null;
    list.querySelectorAll('.module').forEach((node) => {
      const m = node as HTMLElement;
      m.addEventListener('dragstart', () => { dragEl = m; m.classList.add('dragging'); });
      m.addEventListener('dragend', () => {
        m.classList.remove('dragging');
        list.querySelectorAll('.module').forEach((x) => x.classList.remove('drop-target'));
        dragEl = null;
        persistOrder(list, side);
      });
      m.addEventListener('dragover', (e: Event) => { e.preventDefault(); if (m !== dragEl) m.classList.add('drop-target'); });
      m.addEventListener('dragleave', () => m.classList.remove('drop-target'));
      m.addEventListener('drop', (e: Event) => {
        e.preventDefault();
        m.classList.remove('drop-target');
        if (dragEl && m !== dragEl) {
          const items = Array.from(list.querySelectorAll('.module'));
          if (items.indexOf(dragEl) < items.indexOf(m)) list.insertBefore(dragEl, m.nextSibling);
          else list.insertBefore(dragEl, m);
          persistOrder(list, side);
        }
      });
    });
    list.querySelectorAll('.move.up').forEach((b) => {
      b.addEventListener('click', () => {
        const m = (b as HTMLElement).closest('.module');
        if (m && m.previousElementSibling) { list.insertBefore(m, m.previousElementSibling); persistOrder(list, side); }
      });
    });
    list.querySelectorAll('.move.down').forEach((b) => {
      b.addEventListener('click', () => {
        const m = (b as HTMLElement).closest('.module');
        if (m && m.nextElementSibling) { list.insertBefore(m.nextElementSibling, m); persistOrder(list, side); }
      });
    });
  }

  const leftBuilt = buildDrawer('left', 'Vault and patterns', leftSpec);
  const rightBuilt = buildDrawer('right', 'People and reach', rightSpec);
  surface.appendChild(leftBuilt.drawer);
  surface.appendChild(rightBuilt.drawer);
  const drawers: Record<string, HTMLElement> = { left: leftBuilt.drawer, right: rightBuilt.drawer };

  /* ===== drawer reveal mechanics ===== */
  function refreshDrawerScrim(): void {
    const anyOpen = drawers.left.classList.contains('open') || drawers.right.classList.contains('open');
    drawerScrim.classList.toggle('show', anyOpen && !(pinned.left || pinned.right));
  }
  function openDrawer(side: string): void { drawers[side].classList.add('open'); refreshDrawerScrim(); }
  function closeDrawer(side: string): void { if (!pinned[side]) { drawers[side].classList.remove('open'); refreshDrawerScrim(); } }

  surface.querySelectorAll('.edge').forEach((z) => {
    z.addEventListener('mouseenter', () => { if (closeTimer) clearTimeout(closeTimer); openDrawer((z as HTMLElement).dataset.side as string); });
  });
  (['left', 'right'] as const).forEach((side) => {
    drawers[side].addEventListener('mouseenter', () => { if (closeTimer) clearTimeout(closeTimer); });
    drawers[side].addEventListener('mouseleave', () => { closeTimer = setTimeout(() => closeDrawer(side), 220); });
  });
  handleLeft.addEventListener('click', () => { drawers.left.classList.contains('open') ? closeDrawer('left') : openDrawer('left'); });
  handleRight.addEventListener('click', () => { drawers.right.classList.contains('open') ? closeDrawer('right') : openDrawer('right'); });
  drawerScrim.addEventListener('click', () => { drawers.left.classList.remove('open'); drawers.right.classList.remove('open'); refreshDrawerScrim(); });

  /* ===== world modal ===== */
  const worldScrim = el('div', { class: 'scrim' });
  const world = el('div', { class: 'world', role: 'dialog', 'aria-label': 'This year' });
  const worldClose = el('button', { type: 'button', class: 'world-close', 'aria-label': 'Close' }, '\u00d7');
  world.appendChild(worldClose);
  world.appendChild(el('div', { class: 'world-head' }, 'How this year is taking shape'));
  world.appendChild(el('div', { class: 'world-sub' }, 'The long view, the slow patterns, and what is alive now.'));
  const cols = el('div', { class: 'cols' });
  const col1 = el('div');
  col1.appendChild(el('div', { class: 'col-title' }, 'Held now'));
  const live = repo.live();
  if (live.length === 0) col1.appendChild(el('div', { class: 'col-item' }, 'Nothing held yet.'));
  else live.forEach((it) => col1.appendChild(el('div', { class: 'col-item held' }, it.text)));
  const col2 = el('div');
  col2.appendChild(el('div', { class: 'col-title' }, 'The backdrop'));
  col2.appendChild(el('div', { class: 'col-item' }, 'The universal year, your fixed signature, and the slow planetary weather, as the long view fills in.'));
  cols.appendChild(col1);
  cols.appendChild(col2);
  world.appendChild(cols);
  surface.appendChild(worldScrim);
  surface.appendChild(world);
  function openWorld(): void { world.classList.add('open'); worldScrim.classList.add('show'); }
  function closeWorld(): void { world.classList.remove('open'); worldScrim.classList.remove('show'); }
  worldOpenBtn.addEventListener('click', openWorld);
  worldClose.addEventListener('click', closeWorld);
  worldScrim.addEventListener('click', closeWorld);

  /* ===== lean menu (behind the header menu icon) ===== */
  const menu = el('div', { class: 'menu', role: 'dialog', 'aria-label': 'Menu' });
  const menuNote = el('div', { class: 'menu-note' });
  for (const label of MENU_ITEMS) {
    const row = el('button', { type: 'button', class: 'menu-row' });
    row.appendChild(el('span', {}, label));
    if (label === 'Toggle theme') {
      const val = el('span', { class: 'menu-val' }, theme === 'dark' ? 'Dark' : 'Light');
      row.appendChild(val);
      row.addEventListener('click', () => { setTheme(theme === 'dark' ? 'light' : 'dark'); val.textContent = theme === 'dark' ? 'Dark' : 'Light'; });
    } else {
      row.addEventListener('click', () => { clear(menuNote); menuNote.textContent = label + ' arrives as its stage lands.'; });
    }
    menu.appendChild(row);
  }
  menu.appendChild(menuNote);
  surface.appendChild(menu);

  /* ===== voice ===== */
  function reflectVoice(): void {
    for (const v of voiceDefs) voiceButtons[v].classList.toggle('active', v === lens);
  }
  function setVoice(next: Lens): void {
    if (next === lens) return;
    lens = next;
    reflectVoice();
    void repo.setLens(next);
    trackEvent('voice_changed', { lens: next });
    if (activeReplyId) void revoice(activeReplyId);
  }
  reflectVoice();

  /* ===== the reading ===== */
  function recentTouches(beforeId: string): NonNullable<DepthContext['recentTouches']> {
    const snap = repo.snapshot();
    const target = snap.intentions.find((i) => i.id === beforeId);
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

  function paragraphs(into: HTMLElement, text: string): void {
    const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p.length > 0);
    paras.forEach((p, i) => into.appendChild(el('p', i === paras.length - 1 ? { class: 'keel' } : {}, p)));
  }

  function renderReply(it: HeldIntention, busyText?: string): void {
    clear(replyArea);
    const card = el('div', { class: 'reply' });
    card.appendChild(el('div', { class: 'person' }, it.text));
    if (busyText) {
      card.appendChild(el('p', { class: 'busy' }, busyText));
      replyArea.appendChild(card);
      return;
    }
    card.appendChild(el('span', { class: 'corner' }, lensLabel(lens)));
    const vt = latestVesselTouch(it);
    const bodyWrap = el('div');
    paragraphs(bodyWrap, vt ? vt.text : '');
    card.appendChild(bodyWrap);
    if (it.summary) card.appendChild(el('div', { class: 'living' }, it.summary));
    replyArea.appendChild(card);
  }

  async function revoice(intentionId: string): Promise<void> {
    const it = repo.byId(intentionId);
    if (!it) return;
    const current = latestVesselTouch(it);
    if (current && current.lens === lens) { renderReply(it); return; }
    renderReply(it, 'Hearing it again in the ' + lensLabel(lens) + ' voice.');
    const composed = await orchestrator.depth(it, lens, { recentTouches: recentTouches(intentionId) });
    await repo.addTouch(intentionId, { role: 'vessel', text: composed.text, lens });
    if (composed.summary) await repo.setSummary(intentionId, composed.summary);
    const fresh = repo.byId(intentionId);
    if (fresh) renderReply(fresh);
  }

  async function compose(text: string): Promise<void> {
    const reflectionFor = text.trim();
    if (reflectionFor.length === 0 || composing) { input.focus(); return; }
    composing = true;
    continueBtn.disabled = true;
    trackEvent('reply_requested', { lens });
    const room = await repo.ensureRoom(ROOM_DEFAULT);
    const held = await repo.hold({ text: reflectionFor, roomId: room.id, kind: 'acute' });
    activeReplyId = held.id;
    trackEvent('intention_held', {});
    meetLine.textContent = held.text;
    renderLive();
    renderReply(held, 'Composing in the ' + lensLabel(lens) + ' voice.');
    const started = Date.now();
    try {
      const composed = await orchestrator.depth(held, lens, { recentTouches: recentTouches(held.id) });
      await repo.addTouch(held.id, { role: 'vessel', text: composed.text, lens });
      if (composed.summary) await repo.setSummary(held.id, composed.summary);
      trackEvent('reply_delivered', { lens, ms: Date.now() - started });
      const fresh = repo.byId(held.id);
      if (fresh) renderReply(fresh);
    } finally {
      composing = false;
      continueBtn.disabled = false;
      renderLive();
    }
  }

  continueBtn.addEventListener('click', () => { const t = input.value; input.value = ''; void compose(t); });
  sitBtn.addEventListener('click', () => { clear(replyArea); input.value = ''; input.blur(); });
  input.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); const t = input.value; input.value = ''; void compose(t); }
  });

  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') { closeWorld(); menu.classList.remove('open'); }
  });

  trackEvent('session_start', {});
  trackEvent('surface_view', {});
}
