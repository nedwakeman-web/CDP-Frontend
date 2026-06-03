/**
 * CDP Vessel, surface layer: the native daily reading.
 *
 * This is the absorption of the monolith reading into the Vessel. It composes
 * nothing of its own. It calls the live, proven reading engine on the server,
 * the same /api/reading/start and /api/reading/status the monolith uses, with
 * the same async tiered contract, and it renders the returned reading in the
 * Vessel shell. The six framework synthesis, the convergence, and the tiering
 * all live on the server and are unchanged. What changes is only where the
 * result is shown: inside the Vessel rather than in a separate page.
 *
 * The reading object carries three voice sections, each an object with
 * tradition, science, and everyday text, mirroring the monolith renderer.
 * A section may also be a plain string, in which case it is shown as written.
 * The voice toggle on the home swaps the visible voice in place through
 * repaintVoice, with no second round trip to the server.
 *
 * House style holds here, in code, comments, and visible strings alike: no em
 * dashes, no en dashes, no exclamation marks, and no spaced hyphen patterns.
 */

import type { Lens } from '../data/model';

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

/** Split prose into paragraphs on blank lines, the unit the reading writes in. */
function paragraphs(text: string): string[] {
  return String(text == null ? '' : text).split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
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
    if (!triple.tradition && !triple.science && !triple.everyday) return null;
    return { voiced: triple };
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

/** Is the reading a raw or empty shell rather than the structured object. */
function isRaw(r: Record<string, unknown> | null): boolean {
  if (!r) return true;
  if (r.raw === true) return true;
  if (!r.synthesis && !r.numerology && !r.moon_section && !r.headline) return true;
  const s = String(r.synthesis || '').trim();
  if (s.startsWith('{"')) return true;
  return false;
}

/* ---- the section list, in the order the monolith presents them ------------ */
const SECTION_ORDER: Array<{ key: string; alt?: string[]; title: string; collapsed: boolean }> = [
  { key: 'synthesis', title: 'Today', collapsed: false },
  { key: 'framework_convergence', title: 'Where the frameworks meet', collapsed: false },
  { key: 'numerology', alt: ['numerology_connection'], title: 'Numerology', collapsed: true },
  { key: 'astrology', title: 'Astrology', collapsed: true },
  { key: 'dreamspell', alt: ['dreamspell_connection'], title: 'Dreamspell', collapsed: true },
  { key: 'moon_section', alt: ['moon', 'lunar', 'moon_phase'], title: 'The moon', collapsed: true },
];

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
.cdp-surface .rdg-closing { font-family:'EB Garamond', Georgia, serif; font-style:italic; font-size:17px; line-height:1.55; color:var(--gold-soft); margin:22px 2px 0; text-align:center; }
`;
  const style = el('style', { id: STYLE_ID });
  style.textContent = css;
  document.head.appendChild(style);
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

  function buildSection(title: string, value: SectionValue, collapsed: boolean): HTMLElement | null {
    const norm = normaliseVoice(value);
    if (!norm) return null;
    const card = el('div', { class: 'rdg-card' + (collapsed ? '' : ' open') });
    const head = el('button', { type: 'button', class: 'rdg-head' });
    head.appendChild(el('span', { class: 'rdg-title' }, title));
    head.appendChild(el('span', { class: 'rdg-caret' }, '\u203a'));
    const body = el('div', { class: 'rdg-body' });
    if (norm.plain != null) { body.dataset.plain = norm.plain; }
    else if (norm.voiced) {
      body.classList.add('rdg-voiced');
      body.dataset.tradition = norm.voiced.tradition;
      body.dataset.science = norm.voiced.science;
      body.dataset.everyday = norm.voiced.everyday;
    }
    paintBody(body, o.getLens());
    head.addEventListener('click', () => card.classList.toggle('open'));
    card.appendChild(head);
    card.appendChild(body);
    return card;
  }

  function render(raw: unknown): void {
    const outer = (raw && typeof raw === 'object') ? (raw as Record<string, unknown>) : {};
    const r = (outer.reading && typeof outer.reading === 'object' ? outer.reading : outer) as Record<string, unknown>;
    clear(content);
    if (isRaw(r)) {
      const s = String(r.synthesis || '').trim();
      const note = el('div', { class: 'rdg-status' }, s && !s.startsWith('{') ? s : 'The reading came back in an unexpected shape. The engine is reachable; please try again in a moment.');
      content.appendChild(note);
      return;
    }
    clearStatus();

    /* headline, the one line at the top */
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

    /* the ordered sections */
    for (const spec of SECTION_ORDER) {
      let value = r[spec.key] as SectionValue;
      if (!normaliseVoice(value) && spec.alt) {
        for (const a of spec.alt) { if (normaliseVoice(r[a] as SectionValue)) { value = r[a] as SectionValue; break; } }
      }
      const card = buildSection(spec.title, value, spec.collapsed);
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
      if (st.status === 'complete') { render(st.result); return; }
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
