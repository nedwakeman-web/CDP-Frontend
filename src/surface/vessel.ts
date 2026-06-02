/**
 * Vessel: the CDP home.
 *
 * The compass and everything above it are a faithful port of the app(19)
 * surface in its settled state: the breathing two telescopes cipher, the date
 * set in EB Garamond italic, the voice aware cycling line, the voice toggle,
 * and the large landscape compass in its painted star field. The page sky is
 * the same navy the compass asset is painted on, so the image edges merge.
 *
 * Below the compass sit two things the founder asked for. A left sidebar of
 * running intentions and themes, grouped Active now, Held and exploring, and
 * Themes, read from real state. And directly under the compass, the Naked Eye
 * line: what is alive in this moment, with remind, re-engage and hold on each.
 *
 * The data layer underneath (VesselRepository over a Store) is untouched, so
 * what you hold persists across a closed tab. The ask composes a real
 * reflection through the orchestrator and the live compose endpoint, and
 * degrades to an honest held state when the endpoint cannot be reached.
 *
 * House style: no em dashes, no en dashes, no exclamation marks, and no spaced
 * hyphens, in code and in anything a person reads. Palette and fonts follow the
 * app: EB Garamond and Cormorant for body, Cinzel for display.
 */

import type { Lens, HeldIntention } from '../data/model';
import type { Orchestrator, DepthContext } from './compose';
import { VesselRepository } from '../data/repository';
import { trackEvent } from '../data/analytics';

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
function paragraphs(into: HTMLElement, text: string): void {
  const blocks = String(text || '').split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  if (blocks.length === 0) { into.appendChild(el('p', {}, '')); return; }
  for (const b of blocks) into.appendChild(el('p', {}, b));
}

/* ---- date, lens, greeting ------------------------------------------------- */

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
function greeting(name?: string): string {
  const h = new Date().getHours();
  const part = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return name && name.trim() ? part + ', ' + name.trim() : part;
}
function latestVesselTouch(it: HeldIntention) {
  for (let i = it.touches.length - 1; i >= 0; i -= 1) if (it.touches[i].role === 'vessel') return it.touches[i];
  return null;
}

/* ---- voice aware cycling line (per app(19)) ------------------------------- */

const CYCLES: Record<Lens, string[]> = {
  tradition: ['Ancient and modern', 'Tradition and science', 'Ritual and research', 'Symbol and mechanism', 'Pattern and process'],
  science: ['Circadian rhythm and intuition', 'Predictive processing meets pattern', 'Default mode and reflection', 'Interoception as compass'],
  everyday: ['Old wisdom, new evidence', 'Two ways of seeing today', 'Same sky, different telescopes', 'Find the language that fits'],
};

/* The breathing two telescopes cipher, copied from the app. Constant markup. */
const CIPHER_SVG =
  '<svg class="v6-cipher" viewBox="0 0 60 36" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' +
  '<circle cx="22" cy="18" r="13" fill="none" stroke="#A58459" stroke-width="1.4" stroke-linecap="round"/>' +
  '<circle cx="38" cy="18" r="13" fill="none" stroke="#A58459" stroke-width="1.4" stroke-linecap="round"/>' +
  '</svg>';

const COMPASS_ASSET = '/compass-no-text-telescope-navy.jpg';
const ROOM_DEFAULT = 'What I am carrying';

/* ---- fonts and styles, injected once -------------------------------------- */

function injectFonts(): void {
  if (document.getElementById('cdp-vessel-fonts')) return;
  const pre = el('link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' });
  const css = el('link', {
    id: 'cdp-vessel-fonts',
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&family=EB+Garamond:ital,wght@0,400;0,500;1,400;1,500&display=swap',
  });
  document.head.appendChild(pre);
  document.head.appendChild(css);
}

const STYLES = `
.cdp-vessel, .cdp-vessel * { box-sizing: border-box; }
.cdp-vessel {
  --bg:#031831; --bg2:#122440; --bg3:#192E4A; --bg4:#08131F;
  --gold:#C9A050; --gold-bright:#E8C878; --gold-line:#A58459;
  --teal:#81CDB6; --purple:#C8A0FF;
  --text:#F0E6CC; --text-dim:#D4C8AE; --text-faint:#9E9282;
  background: var(--bg); color: var(--text);
  font-family: 'EB Garamond', Georgia, serif;
  min-height: 100vh;
}
.cdp-shell { display: flex; align-items: stretch; min-height: 100vh; }

/* sidebar, running intentions and themes */
.cdp-sidebar { width: 280px; flex: 0 0 280px; background: rgba(8,26,45,0.55); border-right: 1px solid rgba(201,160,80,0.16); display: flex; flex-direction: column; }
.cdp-sidebar-head { padding: 18px 16px 12px; border-bottom: 1px solid rgba(201,160,80,0.14); }
.cdp-sidebar-title { font-family: 'Cinzel', Georgia, serif; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--gold); }
.cdp-sidebar-sub { margin-top: 4px; font-size: 12px; font-style: italic; color: var(--text-faint); }
.cdp-sidebar-body { flex: 1; overflow-y: auto; padding: 10px 8px 16px; }
.cdp-group { margin-bottom: 18px; }
.cdp-group-title { font-family: 'Cinzel', Georgia, serif; font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--gold-line); padding: 6px 10px; border-bottom: 1px solid rgba(201,160,80,0.12); margin-bottom: 6px; }
.cdp-item { padding: 9px 10px; margin-bottom: 5px; background: rgba(25,46,74,0.35); border-left: 2px solid transparent; border-radius: 3px; cursor: pointer; transition: background .25s ease, border-color .25s ease, color .25s ease; }
.cdp-item:hover { background: rgba(25,46,74,0.6); border-left-color: var(--gold); }
.cdp-item.active { background: rgba(201,160,80,0.14); border-left-color: var(--gold); }
.cdp-item-text { display: block; font-style: italic; font-size: 14px; color: var(--text-dim); line-height: 1.35; }
.cdp-item.active .cdp-item-text { color: var(--gold); }
.cdp-item-meta { display: block; margin-top: 3px; font-size: 11px; color: var(--text-faint); }
.cdp-sidebar-empty { padding: 8px 10px; font-size: 13px; font-style: italic; color: var(--text-faint); line-height: 1.5; }
.cdp-sidebar-foot { padding: 12px 14px; border-top: 1px solid rgba(201,160,80,0.12); font-size: 11.5px; color: var(--text-faint); }

/* main column */
.cdp-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.cdp-topbar { display: flex; align-items: center; justify-content: space-between; padding: 14px 22px; }
.cdp-brand { font-family: 'Cinzel', Georgia, serif; font-size: 12px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--gold); }
.cdp-nav { display: flex; gap: 8px; }
.cdp-nav a { font-family: 'Cinzel', Georgia, serif; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-dim); text-decoration: none; padding: 6px 12px; border: 1px solid rgba(201,160,80,0.22); border-radius: 3px; transition: border-color .2s ease, color .2s ease; }
.cdp-nav a:hover { color: var(--gold); border-color: rgba(201,160,80,0.5); }
.cdp-center { flex: 1; display: flex; flex-direction: column; align-items: center; padding: 6px 22px 60px; }

/* compass and above, ported from app(19) */
.v6-compass-frame { width: 100%; max-width: 720px; margin: 14px auto 24px; padding: 0 22px; text-align: center; }
.v6-cipher-wrap { position: relative; height: 60px; margin: 8px auto 4px; display: flex; align-items: center; justify-content: center; }
.v6-cipher { width: 60px; height: 36px; animation: v6CipherBreathe 6s ease-in-out infinite; }
@keyframes v6CipherBreathe { 0%, 100% { opacity: 0.55; transform: scale(1); } 50% { opacity: 1; transform: scale(1.06); } }
.v6-compass-date { font-family: 'EB Garamond', Georgia, serif; font-size: 13px; font-style: italic; color: rgba(245,228,196,0.7); margin: 6px 0; letter-spacing: 0.06em; }
.v6-cycling-words { font-family: 'Cinzel', Georgia, serif; font-size: 10px; letter-spacing: 0.32em; text-transform: uppercase; color: rgba(201,160,80,0.85); margin: 0 auto 20px; height: 14px; position: relative; overflow: hidden; }
.v6-cycling-word { position: absolute; top: 0; left: 50%; transform: translateX(-50%); white-space: nowrap; opacity: 0; animation: v6CycleWord 18s linear infinite; }
@keyframes v6CycleWord { 0%, 100% { opacity: 0; transform: translateX(-50%) translateY(8px); } 3% { opacity: 1; transform: translateX(-50%) translateY(0); } 20% { opacity: 1; transform: translateX(-50%) translateY(0); } 23% { opacity: 0; transform: translateX(-50%) translateY(-8px); } }
.v11-voice-toggle { display: flex; gap: 0; margin: 12px auto 18px; max-width: 340px; background: rgba(8,26,45,0.6); border: 1px solid rgba(165,132,89,0.30); border-radius: 4px; padding: 3px; }
.v11-voice-btn { flex: 1; padding: 7px 12px; background: transparent; border: none; border-radius: 3px; color: rgba(245,228,196,0.65); font-family: 'Cinzel', Georgia, serif; font-size: 9.5px; letter-spacing: 0.18em; text-transform: uppercase; cursor: pointer; transition: background .2s ease, color .2s ease; }
.v11-voice-btn:hover { color: var(--gold); }
.v11-voice-btn.active { background: rgba(201,160,80,0.18); color: var(--gold); }
.v11-voice-btn[data-voice="science"].active { background: rgba(129,205,198,0.16); color: var(--teal); }
.v11-voice-btn[data-voice="everyday"].active { background: rgba(245,228,196,0.12); color: var(--text); }
.v6-compass-image-wrap { position: relative; margin: 8px auto 14px; width: clamp(320px, 64vw, 720px); max-width: 100%; aspect-ratio: 2048 / 1536; border: 1px solid transparent; border-radius: 2px; transition: border-color .25s ease, transform .25s ease; }
.v6-compass-image-wrap img { display: block; width: 100%; height: 100%; object-fit: cover; border-radius: 2px; }

/* Naked Eye, what is alive in this moment */
.cdp-nakedeye { width: 100%; max-width: 620px; margin: 4px auto 26px; text-align: center; }
.cdp-nakedeye-label { font-family: 'Cinzel', Georgia, serif; font-size: 9.5px; letter-spacing: 0.28em; text-transform: uppercase; color: rgba(201,160,80,0.7); margin-bottom: 10px; }
.cdp-ne-item { padding: 12px 6px; border-top: 1px solid rgba(201,160,80,0.12); }
.cdp-ne-item:first-of-type { border-top: none; }
.cdp-ne-text { font-family: 'EB Garamond', Georgia, serif; font-style: italic; font-size: 18px; color: var(--text); line-height: 1.4; }
.cdp-ne-summary { margin-top: 5px; font-size: 13.5px; color: var(--text-faint); line-height: 1.5; }
.cdp-ne-actions { margin-top: 9px; display: flex; gap: 16px; justify-content: center; }
.cdp-ne-action { background: none; border: none; cursor: pointer; font-family: 'Cinzel', Georgia, serif; font-size: 9px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--text-faint); transition: color .2s ease; padding: 2px 0; }
.cdp-ne-action:hover { color: var(--gold); }
.cdp-ne-empty { font-family: 'EB Garamond', Georgia, serif; font-style: italic; font-size: 16px; color: var(--text-faint); line-height: 1.5; }

/* the ask */
.cdp-ask { width: 100%; max-width: 560px; margin: 0 auto; text-align: center; }
.cdp-greet { font-family: 'EB Garamond', Georgia, serif; font-style: italic; font-size: 20px; color: var(--gold); margin-bottom: 6px; }
.v6-compass-prompt { font-family: 'EB Garamond', Georgia, serif; font-size: 16px; font-style: italic; color: rgba(245,228,196,0.85); margin: 6px auto 14px; max-width: 520px; line-height: 1.5; }
.cdp-ask-hint { font-size: 12.5px; font-style: italic; color: var(--gold); margin: 0 auto 10px; max-width: 520px; display: none; }
.cdp-ask-hint.show { display: block; }
.v6-compass-input-wrap { position: relative; max-width: 520px; margin: 0 auto 14px; }
.v6-compass-input-wrap input { width: 100%; background: rgba(8,26,45,0.5); border: 1px solid rgba(165,132,89,0.35); border-radius: 4px; padding: 14px 18px; font-family: Georgia, serif; font-size: 15px; color: rgba(245,228,196,0.96); outline: none; transition: border-color .2s ease, background .2s ease; }
.v6-compass-input-wrap input:focus { border-color: rgba(201,160,80,0.65); background: rgba(8,26,45,0.7); }
.v6-compass-input-wrap input::placeholder { color: rgba(245,228,196,0.4); font-style: italic; }
.cdp-ask-actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
.v11-cta-primary { display: inline-flex; align-items: center; gap: 10px; padding: 11px 26px; background: rgba(201,160,80,0.16); border: 1.5px solid var(--gold); border-radius: 3px; color: var(--gold); font-family: 'Cinzel', Georgia, serif; font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; cursor: pointer; transition: background .2s ease, transform .15s ease; }
.v11-cta-primary:hover { background: rgba(201,160,80,0.28); transform: translateY(-1px); }
.v11-cta-primary:disabled { opacity: 0.55; cursor: default; transform: none; }
.v11-cta-secondary { background: transparent; border: 1px solid rgba(165,132,89,0.25); border-radius: 3px; padding: 9px 22px; color: rgba(245,228,196,0.75); font-family: 'EB Garamond', Georgia, serif; font-size: 13px; font-style: italic; cursor: pointer; transition: border-color .2s ease, color .2s ease; }
.v11-cta-secondary:hover { border-color: rgba(201,160,80,0.55); color: var(--gold); }

/* reply */
.cdp-reply { width: 100%; max-width: 560px; margin: 20px auto 0; text-align: left; background: rgba(8,26,45,0.4); border: 1px solid rgba(201,160,80,0.18); border-radius: 4px; padding: 18px 20px; }
.cdp-reply-voice { font-family: 'Cinzel', Georgia, serif; font-size: 9px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--gold); margin-bottom: 8px; }
.cdp-reply-text p { font-family: 'EB Garamond', Georgia, serif; font-size: 15.5px; line-height: 1.66; color: rgba(245,228,196,0.94); margin: 0 0 12px; }
.cdp-reply-text p:last-child { margin-bottom: 0; }
.cdp-reply.thinking .cdp-reply-text p { font-style: italic; color: var(--text-faint); }

/* mobile: compass first, intentions below, simple and elegant */
@media (max-width: 860px) {
  .cdp-shell { flex-direction: column; }
  .cdp-main { order: 1; }
  .cdp-sidebar { order: 2; width: 100%; flex: none; border-right: none; border-top: 1px solid rgba(201,160,80,0.16); }
  .cdp-sidebar-body { max-height: none; }
}
@media (max-width: 480px) {
  .cdp-topbar { padding: 12px 14px; }
  .cdp-center { padding: 4px 14px 48px; }
  .v6-compass-frame { padding: 0 12px; margin: 10px auto 16px; }
  .v6-compass-image-wrap { width: clamp(240px, 84vw, 380px); }
  .cdp-ne-text { font-size: 16px; }
  .cdp-greet { font-size: 18px; }
}
`;

function injectStyles(): void {
  if (document.getElementById('cdp-vessel-styles')) return;
  const tag = el('style', { id: 'cdp-vessel-styles' });
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

/* ---- mount ---------------------------------------------------------------- */

export async function mountVessel(opts: VesselOptions): Promise<void> {
  const { root, orchestrator, repo } = opts;
  const profile = opts.profile || {};

  await repo.init();
  let lens: Lens = repo.getLens();
  let composing = false;
  let focusedId: string | null = null;
  let activeReplyId: string | null = null;

  injectFonts();
  injectStyles();

  const now = Date.now();
  const dateStr = todayUTCDateStr(now);

  /* skeleton */
  const vessel = el('div', { class: 'cdp-vessel' });
  const shell = el('div', { class: 'cdp-shell' });
  const sidebar = el('aside', { class: 'cdp-sidebar' });
  const main = el('div', { class: 'cdp-main' });
  shell.appendChild(sidebar);
  shell.appendChild(main);
  vessel.appendChild(shell);
  clear(root);
  root.appendChild(vessel);

  /* topbar */
  const topbar = el('div', { class: 'cdp-topbar' });
  topbar.appendChild(el('div', { class: 'cdp-brand' }, 'Cosmic Daily Planner'));
  const nav = el('div', { class: 'cdp-nav' });
  nav.appendChild(el('a', { href: '/app?mode=quick' }, 'Reading'));
  nav.appendChild(el('a', { href: '/app' }, 'Planner'));
  topbar.appendChild(nav);
  main.appendChild(topbar);

  const center = el('div', { class: 'cdp-center' });
  main.appendChild(center);

  /* compass frame */
  const frame = el('div', { class: 'v6-compass-frame' });

  const cipherWrap = el('div', { class: 'v6-cipher-wrap' });
  cipherWrap.innerHTML = CIPHER_SVG;
  frame.appendChild(cipherWrap);

  frame.appendChild(el('p', { class: 'v6-compass-date' }, longDate(dateStr)));

  const cycling = el('div', { class: 'v6-cycling-words' });
  frame.appendChild(cycling);

  const toggle = el('div', { class: 'v11-voice-toggle', role: 'tablist', 'aria-label': 'Voice' });
  const VOICES: Lens[] = ['tradition', 'science', 'everyday'];
  const voiceBtns: Record<string, HTMLElement> = {};
  for (const v of VOICES) {
    const b = el('button', { type: 'button', 'data-voice': v, class: 'v11-voice-btn' }, lensLabel(v));
    b.addEventListener('click', () => { void setLens(v); });
    voiceBtns[v] = b;
    toggle.appendChild(b);
  }
  frame.appendChild(toggle);

  const imageWrap = el('div', { class: 'v6-compass-image-wrap' });
  const img = el('img', { src: COMPASS_ASSET, alt: '', loading: 'eager' });
  imageWrap.appendChild(img);
  frame.appendChild(imageWrap);

  center.appendChild(frame);

  /* Naked Eye */
  const nakedEye = el('div', { class: 'cdp-nakedeye' });
  center.appendChild(nakedEye);

  /* the ask */
  const ask = el('div', { class: 'cdp-ask' });
  ask.appendChild(el('div', { class: 'cdp-greet' }, greeting(profile.name)));
  ask.appendChild(el('p', { class: 'v6-compass-prompt' }, 'A line, a question, a need, an intention. The Oracle replies in the voice you choose.'));
  const hint = el('div', { class: 'cdp-ask-hint' });
  ask.appendChild(hint);
  const inputWrap = el('div', { class: 'v6-compass-input-wrap' });
  const input = el('input', { type: 'text', maxlength: '240', placeholder: 'What is on your mind at the moment', 'aria-label': 'What is on your mind at the moment' }) as HTMLInputElement;
  inputWrap.appendChild(input);
  ask.appendChild(inputWrap);
  const actions = el('div', { class: 'cdp-ask-actions' });
  const continueBtn = el('button', { type: 'button', class: 'v11-cta-primary' }, 'Continue') as HTMLButtonElement;
  const deeperBtn = el('button', { type: 'button', class: 'v11-cta-secondary' }, 'Go deeper here') as HTMLButtonElement;
  actions.appendChild(continueBtn);
  actions.appendChild(deeperBtn);
  ask.appendChild(actions);
  center.appendChild(ask);

  const replyArea = el('div', {});
  center.appendChild(replyArea);

  /* ---- renders ----------------------------------------------------------- */

  function applyVoice(): void {
    for (const v of VOICES) {
      if (v === lens) voiceBtns[v].classList.add('active');
      else voiceBtns[v].classList.remove('active');
    }
    renderCycling();
  }

  function renderCycling(): void {
    clear(cycling);
    const words = CYCLES[lens];
    const span = 18 / words.length;
    words.forEach((w, i) => {
      const node = el('span', { class: 'v6-cycling-word' }, w);
      node.style.animationDelay = (i * span).toFixed(2) + 's';
      cycling.appendChild(node);
    });
  }

  function itemMeta(it: HeldIntention): string {
    const touches = it.touches.filter((t) => t.role === 'vessel').length;
    const when = new Date(it.lastTendedAt || it.createdAt);
    const day = WEEKDAYS[when.getDay()];
    if (touches === 0) return 'Held, not yet read';
    return touches === 1 ? 'One reading, ' + day : touches + ' readings, ' + day;
  }

  function renderSidebar(): void {
    clear(sidebar);
    const head = el('div', { class: 'cdp-sidebar-head' });
    head.appendChild(el('div', { class: 'cdp-sidebar-title' }, 'Intentions'));
    head.appendChild(el('div', { class: 'cdp-sidebar-sub' }, 'What you are carrying'));
    sidebar.appendChild(head);

    const body = el('div', { class: 'cdp-sidebar-body' });
    const live = repo.live().slice().sort((a, b) => repo.gravity(b) - repo.gravity(a));
    const resting = repo.resting();
    const themes = repo.themes();

    body.appendChild(groupNode('Active now', live, 'Nothing active yet. Add a line below and it begins here.'));
    body.appendChild(groupNode('Held and exploring', resting, 'Nothing set aside.'));

    const themeGroup = el('div', { class: 'cdp-group' });
    themeGroup.appendChild(el('div', { class: 'cdp-group-title' }, 'Themes'));
    if (themes.length === 0) {
      themeGroup.appendChild(el('div', { class: 'cdp-sidebar-empty' }, 'Themes emerge as threads gather.'));
    } else {
      for (const t of themes) {
        const item = el('div', { class: 'cdp-item' });
        item.appendChild(el('span', { class: 'cdp-item-text' }, t.label));
        const n = t.threadIds.length;
        item.appendChild(el('span', { class: 'cdp-item-meta' }, n === 1 ? 'One intention' : n + ' intentions'));
        themeGroup.appendChild(item);
      }
    }
    body.appendChild(themeGroup);
    sidebar.appendChild(body);

    const total = live.length + resting.length;
    const foot = el('div', { class: 'cdp-sidebar-foot' }, total === 0 ? 'Your intentions gather here over time.' : total + ' held, themes auto emerging');
    sidebar.appendChild(foot);
  }

  function groupNode(title: string, items: HeldIntention[], empty: string): HTMLElement {
    const group = el('div', { class: 'cdp-group' });
    group.appendChild(el('div', { class: 'cdp-group-title' }, title));
    if (items.length === 0) {
      group.appendChild(el('div', { class: 'cdp-sidebar-empty' }, empty));
      return group;
    }
    for (const it of items) {
      const item = el('div', { class: focusedId === it.id ? 'cdp-item active' : 'cdp-item' });
      item.appendChild(el('span', { class: 'cdp-item-text' }, it.text));
      item.appendChild(el('span', { class: 'cdp-item-meta' }, itemMeta(it)));
      item.addEventListener('click', () => { reengage(it.id); });
      group.appendChild(item);
    }
    return group;
  }

  function renderNakedEye(): void {
    clear(nakedEye);
    nakedEye.appendChild(el('div', { class: 'cdp-nakedeye-label' }, 'What is alive now'));
    const live = repo.live().slice().sort((a, b) => repo.gravity(b) - repo.gravity(a));
    const present = live.slice(0, 2);
    if (present.length === 0) {
      nakedEye.appendChild(el('div', { class: 'cdp-ne-empty' }, 'Nothing is pressing in this moment. When something is, add a line below.'));
      return;
    }
    for (const it of present) {
      const wrap = el('div', { class: 'cdp-ne-item' });
      wrap.appendChild(el('div', { class: 'cdp-ne-text' }, it.text));
      const summary = it.summary && it.summary.trim() ? it.summary : 'A quiet thread, not yet read. Remind shows where it stands.';
      wrap.appendChild(el('div', { class: 'cdp-ne-summary' }, summary));
      const acts = el('div', { class: 'cdp-ne-actions' });
      const remind = el('button', { type: 'button', class: 'cdp-ne-action' }, 'Remind');
      remind.addEventListener('click', () => { void remindOf(it.id); });
      const re = el('button', { type: 'button', class: 'cdp-ne-action' }, 'Re-engage');
      re.addEventListener('click', () => { reengage(it.id); });
      const hold = el('button', { type: 'button', class: 'cdp-ne-action' }, 'Hold');
      hold.addEventListener('click', () => { void holdAway(it.id); });
      acts.appendChild(remind);
      acts.appendChild(re);
      acts.appendChild(hold);
      wrap.appendChild(acts);
      nakedEye.appendChild(wrap);
    }
  }

  function renderReply(it: HeldIntention | null, thinking?: string): void {
    clear(replyArea);
    if (!it && !thinking) return;
    const card = el('div', { class: thinking ? 'cdp-reply thinking' : 'cdp-reply' });
    card.appendChild(el('div', { class: 'cdp-reply-voice' }, lensLabel(lens)));
    const textWrap = el('div', { class: 'cdp-reply-text' });
    if (thinking) {
      textWrap.appendChild(el('p', {}, thinking));
    } else if (it) {
      const vt = latestVesselTouch(it);
      paragraphs(textWrap, vt ? vt.text : '');
    }
    card.appendChild(textWrap);
    replyArea.appendChild(card);
  }

  /* ---- actions ----------------------------------------------------------- */

  async function setLens(next: Lens): Promise<void> {
    if (next === lens) return;
    lens = next;
    await repo.setLens(next);
    applyVoice();
    trackEvent('voice_changed', { lens: next });
    if (activeReplyId) { void revoice(activeReplyId); }
  }

  function setHint(text: string | null): void {
    if (text) { hint.textContent = text; hint.classList.add('show'); }
    else { hint.textContent = ''; hint.classList.remove('show'); }
  }

  function reengage(intentionId: string): void {
    const it = repo.byId(intentionId);
    if (!it) return;
    focusedId = intentionId;
    setHint('Continuing: ' + it.text);
    renderSidebar();
    input.focus();
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function remindOf(intentionId: string): Promise<void> {
    const it = repo.byId(intentionId);
    if (!it) return;
    const line = orchestrator.summary(it, lens);
    if (line) await repo.setSummary(intentionId, line);
    renderNakedEye();
  }

  async function holdAway(intentionId: string): Promise<void> {
    await repo.rest(intentionId);
    if (focusedId === intentionId) { focusedId = null; setHint(null); }
    renderNakedEye();
    renderSidebar();
  }

  function recentTouches(beforeId: string): NonNullable<DepthContext['recentTouches']> {
    const snap = repo.snapshot();
    const target = snap.intentions.find((i) => i.id === beforeId);
    const chrono = [...snap.intentions].sort((a, b) => a.createdAt - b.createdAt);
    const out: NonNullable<DepthContext['recentTouches']> = [];
    for (const it of chrono) {
      if (target && it.createdAt >= target.createdAt) break;
      out.push({ role: 'person', text: it.text });
      const vt = latestVesselTouch(it);
      if (vt) out.push({ role: 'vessel', text: vt.text });
    }
    return out;
  }

  async function revoice(intentionId: string): Promise<void> {
    const it = repo.byId(intentionId);
    if (!it) return;
    const current = latestVesselTouch(it);
    if (current && current.lens === lens) { renderReply(it); return; }
    renderReply(it, 'Hearing it again in the ' + lensLabel(lens) + ' voice.');
    const composed = await orchestrator.depth(it, lens, { dateStr, recentTouches: recentTouches(intentionId) });
    await repo.addTouch(intentionId, { role: 'vessel', text: composed.text, lens });
    if (composed.summary) await repo.setSummary(intentionId, composed.summary);
    const fresh = repo.byId(intentionId);
    if (fresh) renderReply(fresh);
    renderNakedEye();
  }

  async function compose(): Promise<void> {
    const line = input.value.trim();
    if (composing) return;
    if (line.length === 0 && !focusedId) { input.focus(); return; }
    composing = true;
    continueBtn.disabled = true;
    trackEvent('reply_requested', { lens });

    let it: HeldIntention | null = null;
    if (focusedId && repo.byId(focusedId)) {
      it = repo.byId(focusedId);
      if (it && line.length > 0) await repo.addTouch(it.id, { role: 'person', text: line, lens });
    } else {
      const room = await repo.ensureRoom(ROOM_DEFAULT);
      it = await repo.hold({ text: line, roomId: room.id, kind: 'acute' });
      trackEvent('intention_held', {});
    }
    if (!it) { composing = false; continueBtn.disabled = false; return; }

    activeReplyId = it.id;
    renderSidebar();
    renderNakedEye();
    renderReply(it, 'Composing in the ' + lensLabel(lens) + ' voice.');
    const started = Date.now();
    try {
      const composed = await orchestrator.depth(it, lens, { dateStr, recentTouches: recentTouches(it.id) });
      await repo.addTouch(it.id, { role: 'vessel', text: composed.text, lens });
      if (composed.summary) await repo.setSummary(it.id, composed.summary);
      trackEvent('reply_delivered', { lens, ms: Date.now() - started });
      const fresh = repo.byId(it.id);
      if (fresh) renderReply(fresh);
    } catch (e) {
      trackEvent('reply_degraded', { lens });
      renderReply(it, 'Held for now. The reading could not be reached, so it waits with you.');
    } finally {
      composing = false;
      continueBtn.disabled = false;
      input.value = '';
      focusedId = null;
      setHint(null);
      renderSidebar();
      renderNakedEye();
    }
  }

  function goDeeper(): void {
    const line = input.value.trim();
    const q = line.length > 0 ? '&q=' + encodeURIComponent(line) : '';
    trackEvent('deep_reading_opened', { lens });
    window.location.href = '/app?mode=quick' + q;
  }

  continueBtn.addEventListener('click', () => { void compose(); });
  deeperBtn.addEventListener('click', goDeeper);
  input.addEventListener('keydown', (ev: KeyboardEvent) => { if (ev.key === 'Enter') { ev.preventDefault(); void compose(); } });

  /* ---- first paint ------------------------------------------------------- */

  applyVoice();
  renderSidebar();
  renderNakedEye();
  renderReply(null);
}
