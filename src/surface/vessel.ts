/**
 * Vessel: the CDP surface, the home that meets you.
 *
 * This is the converged daily compass. It renders the day's coordinates from the
 * shared coordinate core as one view rather than four lists, holds the three
 * voices (Tradition, Science, Everyday) as distinct and switchable in place,
 * surfaces what is held, and routes the single line a person types through the
 * orchestrator's summoned depth. Wherever a source is not yet wired, the surface
 * shows an honest state rather than a fabricated one.
 *
 * Discipline held here:
 *   - No coordinate is invented. The lunar window reads as not yet available
 *     until USNO is wired; the deep reading is named as the next stage rather
 *     than faked.
 *   - The language is the CDP core: intentions, what is alive, what matters.
 *     Problem-framing vocabulary stays out of anything a person reads.
 *   - User typed text is written to the DOM as textContent, never interpolated
 *     into markup, so an apostrophe in a line can never break a string.
 *   - House style: no em dashes, no en dashes, no exclamation marks, in code and
 *     in anything a person reads.
 *
 * The coordinate core is imported, not recomputed. It is the single source of
 * truth the server also builds against, so the date the surface shows and the
 * date the reading composes against are the same coordinate.
 */

import type { Lens, HeldIntention, VesselState, Orchestrator, Composed } from './compose';
import { dayCoordinates } from '../coordinates-core';
import type { Coordinate } from '../coordinates-core';

export interface VesselOptions {
  root: HTMLElement;
  orchestrator: Orchestrator;
  /** Optional profile. When a birth date is present, the personal layers show. */
  profile?: { birthDate?: string };
}

/* ---- small DOM helpers, safe with user text ------------------------------- */

type Attrs = Record<string, string>;

function el(tag: string, attrs: Attrs = {}, text?: string): HTMLElement {
  const node = document.createElement(tag);
  for (const k of Object.keys(attrs)) node.setAttribute(k, attrs[k]);
  if (text !== undefined) node.textContent = text; // textContent, never innerHTML, for dynamic text
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

/* ---- styles, themeable through CSS variables ------------------------------ */

const STYLES = `
.cdp-surface {
  --cdp-ink: #1A1A1A;
  --cdp-navy-deep: #2C3E5A;
  --cdp-navy-mid: #3E6B8A;
  --cdp-gold: #B8942A;
  --cdp-rule: #BFA363;
  --cdp-ground: #FAF7F0;
  --cdp-card: #FFFFFF;
  --cdp-muted: #6B6257;
  color: var(--cdp-ink);
  background:
    radial-gradient(120% 80% at 50% -10%, rgba(62,107,138,0.10), rgba(250,247,240,0) 60%),
    var(--cdp-ground);
  font-family: Georgia, "Times New Roman", serif;
  line-height: 1.6;
  min-height: 100%;
  padding: clamp(1.5rem, 4vw, 3.5rem) clamp(1rem, 5vw, 4rem) 4rem;
  max-width: 60rem;
  margin: 0 auto;
}
.cdp-surface * { box-sizing: border-box; }
.cdp-rise { opacity: 0; transform: translateY(8px); animation: cdpRise 0.7s ease forwards; }
@keyframes cdpRise { to { opacity: 1; transform: none; } }
.cdp-eyebrow {
  font-family: Georgia, serif; font-style: italic; color: var(--cdp-muted);
  letter-spacing: 0.02em; font-size: 0.95rem; margin: 0 0 0.35rem;
}
.cdp-title {
  font-family: Cinzel, Georgia, serif; font-weight: 600; color: var(--cdp-navy-deep);
  font-size: clamp(1.9rem, 5vw, 2.7rem); margin: 0 0 0.75rem; letter-spacing: 0.01em;
}
.cdp-meet {
  font-size: 1.15rem; color: var(--cdp-ink); margin: 0 0 2rem; max-width: 44rem;
}
.cdp-rule { height: 1px; background: var(--cdp-rule); opacity: 0.6; border: 0; margin: 2rem 0; }
.cdp-section-head {
  font-family: Cinzel, Georgia, serif; color: var(--cdp-navy-deep);
  font-size: 0.82rem; letter-spacing: 0.18em; text-transform: uppercase;
  margin: 0 0 1rem;
}
.cdp-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr)); gap: 1rem; }
.cdp-card {
  background: var(--cdp-card); border: 1px solid rgba(191,163,99,0.45);
  border-radius: 10px; padding: 1.1rem 1.2rem;
  box-shadow: 0 1px 2px rgba(44,62,90,0.05), 0 8px 24px rgba(44,62,90,0.04);
}
.cdp-card-label {
  font-size: 0.72rem; letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--cdp-navy-mid); margin: 0 0 0.4rem;
}
.cdp-card-value { font-family: Cinzel, Georgia, serif; font-size: 1.2rem; color: var(--cdp-ink); margin: 0 0 0.45rem; }
.cdp-tag {
  display: inline-block; font-size: 0.68rem; letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--cdp-muted); border: 1px solid rgba(107,98,87,0.35); border-radius: 999px;
  padding: 0.1rem 0.55rem;
}
.cdp-tag.gold { color: var(--cdp-gold); border-color: rgba(184,148,42,0.5); }
.cdp-tag.pending { font-style: italic; }
.cdp-note { color: var(--cdp-muted); font-style: italic; margin: 1rem 0 0; max-width: 44rem; }
.cdp-voices { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0 0 0.75rem; }
.cdp-voice {
  font-family: Georgia, serif; font-size: 0.95rem; cursor: pointer;
  background: transparent; color: var(--cdp-navy-deep);
  border: 1px solid rgba(62,107,138,0.5); border-radius: 999px; padding: 0.4rem 1rem;
  transition: background 0.18s ease, color 0.18s ease;
}
.cdp-voice[aria-pressed="true"] { background: var(--cdp-navy-deep); color: var(--cdp-ground); border-color: var(--cdp-navy-deep); }
.cdp-disclose { margin: 0 0 1.5rem; }
.cdp-disclose summary { cursor: pointer; color: var(--cdp-navy-mid); font-size: 0.92rem; }
.cdp-disclose p { color: var(--cdp-muted); font-size: 0.95rem; margin: 0.6rem 0 0; max-width: 44rem; }
.cdp-ask { margin: 0.5rem 0 0; }
.cdp-ask label { display: block; font-size: 1.05rem; margin: 0 0 0.5rem; color: var(--cdp-ink); }
.cdp-ask textarea {
  width: 100%; min-height: 4.5rem; resize: vertical; font-family: Georgia, serif; font-size: 1.05rem;
  color: var(--cdp-ink); background: var(--cdp-card); border: 1px solid rgba(62,107,138,0.4);
  border-radius: 10px; padding: 0.8rem 0.9rem; line-height: 1.5;
}
.cdp-ask textarea:focus { outline: 2px solid rgba(184,148,42,0.5); outline-offset: 1px; }
.cdp-actions { display: flex; gap: 0.75rem; align-items: center; margin: 0.75rem 0 0; }
.cdp-primary {
  font-family: Cinzel, Georgia, serif; font-size: 0.95rem; letter-spacing: 0.04em; cursor: pointer;
  background: var(--cdp-gold); color: #1A1206; border: 0; border-radius: 999px; padding: 0.55rem 1.4rem;
}
.cdp-primary:disabled { opacity: 0.5; cursor: default; }
.cdp-link {
  background: transparent; border: 0; cursor: pointer; color: var(--cdp-navy-mid);
  font-family: Georgia, serif; font-size: 0.95rem; text-decoration: underline; text-underline-offset: 3px;
  padding: 0;
}
.cdp-depth { margin: 1.5rem 0 0; min-height: 1rem; }
.cdp-depth p { margin: 0 0 1rem; font-size: 1.08rem; }
.cdp-depth .cdp-keel { color: var(--cdp-navy-deep); }
.cdp-living { color: var(--cdp-muted); font-style: italic; border-left: 2px solid var(--cdp-rule); padding-left: 0.9rem; margin: 1.25rem 0 0; }
.cdp-busy { color: var(--cdp-muted); font-style: italic; }
.cdp-held { list-style: none; padding: 0; margin: 0.5rem 0 0; }
.cdp-held li { padding: 0.45rem 0; border-bottom: 1px solid rgba(191,163,99,0.3); color: var(--cdp-ink); }
.cdp-held li:last-child { border-bottom: 0; }
.cdp-empty { color: var(--cdp-muted); font-style: italic; margin: 0.5rem 0 0; }
.cdp-deep-panel { margin: 1rem 0 0; color: var(--cdp-muted); }
`;

/* ---- coordinate rendering ------------------------------------------------- */

function tagFor(c: Coordinate): HTMLElement {
  if (c.unknown) return el('span', { class: 'cdp-tag pending' }, 'not yet available');
  if (c.register === 'symbolic') return el('span', { class: 'cdp-tag' }, 'symbolic');
  if (c.register === 'astronomical') return el('span', { class: 'cdp-tag' }, 'astronomical');
  return el('span', { class: 'cdp-tag' }, 'empirical');
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

export async function mountVessel(options: VesselOptions): Promise<void> {
  const { root, orchestrator } = options;
  const profile = options.profile;
  const now = Date.now();
  const dateStr = todayUTCDateStr(now);

  const state: VesselState = { intentions: [], rooms: {} };
  let lens: Lens = 'everyday';

  // Inject styles once.
  if (!document.getElementById('cdp-vessel-styles')) {
    const style = el('style', { id: 'cdp-vessel-styles' });
    style.textContent = STYLES;
    document.head.appendChild(style);
  }

  clear(root);
  const surface = el('div', { class: 'cdp-surface' });
  root.appendChild(surface);

  // Header.
  const header = el('header', { class: 'cdp-rise' });
  header.appendChild(el('p', { class: 'cdp-eyebrow' }, longDate(dateStr)));
  header.appendChild(el('h1', { class: 'cdp-title' }, 'Cosmic Daily Planner'));
  const meetLine = el('p', { class: 'cdp-meet' }, orchestrator.meet(state, null, now));
  header.appendChild(meetLine);
  surface.appendChild(header);

  surface.appendChild(el('hr', { class: 'cdp-rule' }));

  // Coordinates, one converged view.
  const coordSection = el('section', { class: 'cdp-rise', style: 'animation-delay:0.06s' });
  coordSection.appendChild(el('h2', { class: 'cdp-section-head' }, 'Today, together'));
  const grid = el('div', { class: 'cdp-grid' });
  const day = dayCoordinates(dateStr, profile && profile.birthDate ? { birthDate: profile.birthDate } : undefined);
  for (const c of day.coordinates) grid.appendChild(coordinateCard(c));
  coordSection.appendChild(grid);
  coordSection.appendChild(el(
    'p',
    { class: 'cdp-note' },
    'These are today\u0027s coordinates in one view. Where they point the same way, and where they do not, is drawn out in the reading and in the voice you choose.',
  ));
  surface.appendChild(coordSection);

  surface.appendChild(el('hr', { class: 'cdp-rule' }));

  // The voices, distinct and switchable in place.
  const voiceSection = el('section', { class: 'cdp-rise', style: 'animation-delay:0.12s' });
  voiceSection.appendChild(el('h2', { class: 'cdp-section-head' }, 'The voice you read in'));
  const voices = el('div', { class: 'cdp-voices' });
  const voiceDefs: Array<{ key: Lens; label: string }> = [
    { key: 'tradition', label: 'Tradition' },
    { key: 'science', label: 'Science' },
    { key: 'everyday', label: 'Everyday' },
  ];
  const voiceButtons: Record<string, HTMLElement> = {};
  function setVoice(next: Lens): void {
    lens = next;
    for (const def of voiceDefs) {
      voiceButtons[def.key].setAttribute('aria-pressed', def.key === lens ? 'true' : 'false');
    }
  }
  for (const def of voiceDefs) {
    const b = el('button', { type: 'button', class: 'cdp-voice', 'aria-pressed': 'false' }, def.label);
    b.addEventListener('click', () => setVoice(def.key));
    voiceButtons[def.key] = b;
    voices.appendChild(b);
  }
  voiceSection.appendChild(voices);

  const disclose = el('details', { class: 'cdp-disclose' });
  disclose.appendChild(el('summary', {}, 'More: two telescopes, three voices'));
  disclose.appendChild(el(
    'p',
    {},
    'The same day can be read through more than one instrument. Tradition speaks in archetype and timing. Science speaks in mechanism. Everyday speaks plainly, in the words a thoughtful friend would use. They are three distinct voices, not three settings on one dial, and you choose the one that is natural to you.',
  ));
  voiceSection.appendChild(disclose);
  surface.appendChild(voiceSection);

  setVoice('everyday');

  // The single line, routed to summoned depth. Never auto-fires.
  const askSection = el('section', { class: 'cdp-rise', style: 'animation-delay:0.18s' });
  const ask = el('div', { class: 'cdp-ask' });
  const inputId = 'cdp-ask-input';
  ask.appendChild(el('label', { for: inputId }, 'What is alive for you right now?'));
  const textarea = el('textarea', { id: inputId, rows: '3', placeholder: 'Name the one thing in front of you.' }) as HTMLTextAreaElement;
  ask.appendChild(textarea);

  const actions = el('div', { class: 'cdp-actions' });
  const reach = el('button', { type: 'button', class: 'cdp-primary' }, 'Reach for depth') as HTMLButtonElement;
  actions.appendChild(reach);
  ask.appendChild(actions);
  askSection.appendChild(ask);

  const depthArea = el('div', { class: 'cdp-depth', 'aria-live': 'polite' });
  askSection.appendChild(depthArea);
  surface.appendChild(askSection);

  function renderComposed(c: Composed): void {
    clear(depthArea);
    const paras = c.text.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p.length > 0);
    paras.forEach((p, i) => {
      const isLast = i === paras.length - 1;
      depthArea.appendChild(el('p', isLast ? { class: 'cdp-keel' } : {}, p));
    });
    if (c.summary) depthArea.appendChild(el('p', { class: 'cdp-living' }, c.summary));
  }

  function renderHeld(): void {
    clear(heldList);
    if (state.intentions.length === 0) {
      const empty = el('p', { class: 'cdp-empty' }, 'Nothing is held yet. What you name here is kept for this visit.');
      heldList.appendChild(empty);
      return;
    }
    for (const it of state.intentions) {
      heldList.appendChild(el('li', {}, orchestrator.summary(it, lens)));
    }
  }

  async function onReach(): Promise<void> {
    const text = textarea.value.trim();
    if (text.length === 0) { textarea.focus(); return; }
    const intention: HeldIntention = { text, kind: 'acute', anchor: null };
    state.intentions.unshift(intention);
    textarea.value = '';
    meetLine.textContent = orchestrator.meet(state, intention, Date.now());
    renderHeld();

    reach.disabled = true;
    clear(depthArea);
    depthArea.appendChild(el('p', { class: 'cdp-busy' }, 'Composing in the ' + lens + ' voice.'));
    try {
      const composed = await orchestrator.depth(intention, lens);
      renderComposed(composed);
    } finally {
      reach.disabled = false;
    }
  }

  reach.addEventListener('click', () => { void onReach(); });
  textarea.addEventListener('keydown', (e: KeyboardEvent) => {
    // Cmd or Ctrl with Enter reaches for depth; a plain Enter keeps a new line.
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); void onReach(); }
  });

  surface.appendChild(el('hr', { class: 'cdp-rule' }));

  // What is held.
  const heldSection = el('section', { class: 'cdp-rise', style: 'animation-delay:0.24s' });
  heldSection.appendChild(el('h2', { class: 'cdp-section-head' }, 'What is held'));
  const heldList = el('ul', { class: 'cdp-held' });
  heldSection.appendChild(heldList);
  surface.appendChild(heldSection);
  renderHeld();

  surface.appendChild(el('hr', { class: 'cdp-rule' }));

  // The deliberate door to the deep reading. Honest about its stage; never auto-fires.
  const deepSection = el('section', { class: 'cdp-rise', style: 'animation-delay:0.30s' });
  deepSection.appendChild(el('h2', { class: 'cdp-section-head' }, 'The deep reading'));
  const deepBtn = el('button', { type: 'button', class: 'cdp-link' }, 'Open the deep reading') as HTMLButtonElement;
  const deepPanel = el('div', { class: 'cdp-deep-panel' });
  deepBtn.addEventListener('click', () => {
    clear(deepPanel);
    deepPanel.appendChild(el(
      'p',
      {},
      'The deep reading is the long, cited reading drawn around your chart. It is composed in the next stage of the build, and it never opens on its own. When it is wired, it will open only from here, when you choose it.',
    ));
  });
  deepSection.appendChild(deepBtn);
  deepSection.appendChild(deepPanel);
  surface.appendChild(deepSection);
}
