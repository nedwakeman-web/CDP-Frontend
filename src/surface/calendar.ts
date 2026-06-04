/*
 * The Calendar surface, the month at a glance and any day opened in full.
 *
 * The grid carries the day's coordinates as quiet badges: the Dreamspell Kin,
 * the personal day number with master numbers preserved and marked, a portal
 * dot on Galactic Activation Portal days, and the moon. Tap any day and the
 * detail panel opens it: the day's own energy, the Kin, the personal layers,
 * the moon phase with the Black and Shiva windows named, and the Oracle one tap
 * away in whichever voice fits. The Best Day finder scans the month for a stated
 * intention. Everything reads against the dark ground; nothing is faint where a
 * person is meant to read it.
 */

import type { Lens, VesselProfile, VesselSignal } from '../data/model';
import { shareControls } from './share';
import { NUM_DATA } from '../data/numerology-content';
import { kinForDate, kinDescriptor, personalNumerology, universalDay, lunarWindow, reduceNumber, isGAP } from '../coordinates-core';

export interface OpenCalendarOptions {
  container: HTMLElement;
  getProfile: () => VesselProfile | null;
  getLens: () => Lens;
  reflect?: (note: string) => void;
  /** When present, any day opens into the Compass, held and reflected. */
  composeAsk?: (prompt: string) => Promise<string>;
  /** Record a located 'this landed' tap, the person's own signal. */
  recordSignal?: (s: VesselSignal) => void;
  /** The accumulated signal, for continuity. */
  getSignals?: () => VesselSignal[];
}
export interface CalendarHandle { close(): void; }

type Attrs = Record<string, string>;
function el(tag: string, attrs: Attrs = {}, text?: string): HTMLElement {
  const node = document.createElement(tag);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  if (text !== undefined) node.textContent = text;
  return node;
}
function clear(node: HTMLElement): void { while (node.firstChild) node.removeChild(node.firstChild); }

const MONTHS_L = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS_L = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WD_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function pad2(n: number): string { return (n < 10 ? '0' : '') + String(n); }
function cellDate(y: number, m: number, d: number): string { return String(y) + '-' + pad2(m + 1) + '-' + pad2(d); }

/* The moon glyph for the four principal phases; crescents and gibbous stay quiet. */
function moonGlyph(dateStr: string): string {
  const lw = lunarWindow(dateStr);
  if (lw.isNew) return '\u25CF';
  if (lw.isFull) return '\u25CB';
  if (lw.phase === 'First Quarter') return '\u25D0';
  if (lw.phase === 'Last Quarter') return '\u25D1';
  return '';
}

function numName(n: number): string { const d = NUM_DATA[n]; return d ? d.n : String(n); }

function lifePathOf(birthDate: string): number {
  let sum = 0;
  for (const ch of birthDate) { if (ch >= '0' && ch <= '9') sum += Number(ch); }
  return reduceNumber(sum).value;
}

interface BdDay { dateIso: string; score?: number }

const STYLE_ID = 'cdp-calendar-style';
function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const css = [
    '.cdp-surface .cal-view{position:fixed;top:58px;left:0;right:0;bottom:0;z-index:60;background:var(--bg,#0A1828);overflow-y:auto;padding:22px 16px 64px}',
    '.cdp-surface .cal-shell{max-width:44rem;margin:0 auto}',
    '.cdp-surface .cal-bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}',
    '.cdp-surface .cal-h{font-family:Cinzel,Georgia,serif;font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold,#C9A050)}',
    '.cdp-surface .cal-close{background:none;border:none;cursor:pointer;color:var(--text-dim,#D4C8AE);font-size:22px;line-height:1;padding:4px 8px}',
    '.cdp-surface .cal-close:hover{color:var(--gold,#C9A050)}',
    '.cdp-surface .cal-intro{font-family:Georgia,serif;font-size:14px;line-height:1.6;color:var(--text-light,#F0E6CC);margin:0 0 14px}',
    '.cdp-surface .cal-nav{display:flex;align-items:center;justify-content:space-between;margin:6px 0 12px}',
    '.cdp-surface .cal-navbtn{background:none;border:1px solid var(--gold-line,#3A3320);border-radius:4px;color:var(--text-light,#F0E6CC);font-size:18px;line-height:1;padding:6px 14px;cursor:pointer}',
    '.cdp-surface .cal-navbtn:hover{border-color:var(--gold,#C9A050);color:var(--gold,#C9A050)}',
    '.cdp-surface .cal-month{font-family:\'EB Garamond\',Georgia,serif;font-size:22px;color:var(--gold-soft,#E8C878);text-align:center}',
    '.cdp-surface .cal-bd{border:1px solid var(--gold-line,#3A3320);border-radius:6px;background:var(--navy,#0D1E33);padding:12px 14px;margin-bottom:14px}',
    '.cdp-surface .cal-bd-label{font-family:Cinzel,Georgia,serif;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold-soft,#E8C878);margin-bottom:7px}',
    '.cdp-surface .cal-bd-form{display:flex;gap:8px}',
    '.cdp-surface .cal-bd-input{flex:1;min-width:0;background:var(--bg,#0A1828);border:1px solid var(--gold-line,#3A3320);border-radius:4px;color:var(--text-light,#F0E6CC);font-family:Georgia,serif;font-size:14px;padding:8px 10px}',
    '.cdp-surface .cal-bd-btn{background:var(--raised,#13284A);border:1px solid var(--gold,#C9A050);border-radius:4px;color:var(--gold-soft,#E8C878);font-family:Cinzel,Georgia,serif;font-size:10px;letter-spacing:.12em;text-transform:uppercase;padding:8px 14px;cursor:pointer;white-space:nowrap}',
    '.cdp-surface .cal-bd-status{font-family:\'EB Garamond\',Georgia,serif;font-style:italic;font-size:13px;color:var(--text-dim,#D4C8AE);margin-top:8px}',
    '.cdp-surface .cal-wd{display:grid;grid-template-columns:repeat(7,1fr);gap:5px;margin-bottom:5px}',
    '.cdp-surface .cal-wd span{text-align:center;font-family:Cinzel,Georgia,serif;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--text-dim,#D4C8AE)}',
    '.cdp-surface .cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:5px}',
    '.cdp-surface .cal-cell{position:relative;min-height:58px;border:1px solid var(--gold-line,#3A3320);border-radius:4px;background:var(--navy,#0D1E33);padding:5px 6px;cursor:pointer;text-align:left}',
    '.cdp-surface .cal-cell.blank{border:none;background:none;cursor:default}',
    '.cdp-surface .cal-cell.today{border-color:var(--gold,#C9A050)}',
    '.cdp-surface .cal-cell.sel{background:var(--raised,#13284A);border-color:var(--gold-soft,#E8C878)}',
    '.cdp-surface .cal-cell.best{box-shadow:inset 0 0 0 1px var(--teal,#81CDB6)}',
    '.cdp-surface .cal-d{font-family:\'EB Garamond\',Georgia,serif;font-size:15px;color:var(--text-light,#F0E6CC);line-height:1}',
    '.cdp-surface .cal-moon{position:absolute;top:5px;right:6px;font-size:11px;color:var(--gold-soft,#E8C878)}',
    '.cdp-surface .cal-foot{display:flex;align-items:baseline;gap:5px;margin-top:8px}',
    '.cdp-surface .cal-kin{font-family:\'EB Garamond\',Georgia,serif;font-size:11px;color:var(--text-dim,#D4C8AE)}',
    '.cdp-surface .cal-portal{width:6px;height:6px;border-radius:50%;background:var(--teal,#81CDB6);display:inline-block;align-self:center}',
    '.cdp-surface .cal-pd{font-family:\'EB Garamond\',Georgia,serif;font-size:14px;color:var(--gold,#C9A050);margin-left:auto}',
    '.cdp-surface .cal-pd.master{color:var(--master,#C8A0FF)}',
    '.cdp-surface .cal-legend{font-family:\'EB Garamond\',Georgia,serif;font-size:12px;color:var(--text-dim,#D4C8AE);margin:10px 0 0;line-height:1.6}',
    '.cdp-surface .cal-detail{border:1px solid var(--gold-line,#3A3320);border-radius:6px;background:var(--navy,#0D1E33);padding:16px 18px;margin-top:16px}',
    '.cdp-surface .cal-det-date{font-family:\'EB Garamond\',Georgia,serif;font-size:21px;color:var(--gold-soft,#E8C878);margin-bottom:10px}',
    '.cdp-surface .cal-det-row{display:flex;gap:12px;padding:7px 0;border-top:1px solid var(--gold-line,#3A3320)}',
    '.cdp-surface .cal-det-label{font-family:Cinzel,Georgia,serif;font-size:9px;letter-spacing:.13em;text-transform:uppercase;color:var(--text-dim,#D4C8AE);min-width:96px;align-self:center}',
    '.cdp-surface .cal-det-val{font-family:Georgia,serif;font-size:14px;line-height:1.6;color:var(--text-light,#F0E6CC);flex:1}',
    '.cdp-surface .cal-det-val .m{color:var(--master,#C8A0FF)}',
    '.cdp-surface .cal-det-note{font-family:\'EB Garamond\',Georgia,serif;font-style:italic;font-size:13px;color:var(--text-dim,#D4C8AE);margin-top:8px}',
    '.cdp-surface .cal-cue{display:inline-flex;align-items:center;gap:6px;font-family:\'EB Garamond\',Georgia,serif;font-size:14px;color:var(--teal,#81CDB6);margin-top:12px;cursor:pointer}',
    '.cdp-surface .cal-bridge{display:block;background:none;border:none;text-align:left;cursor:pointer;font-family:Cinzel,Georgia,serif;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--teal,#81CDB6);padding:8px 0 2px}',
    '.cdp-surface .cal-tap{display:inline-flex;align-items:center;gap:8px;cursor:pointer;margin-top:10px}',
    '.cdp-surface .cal-tapdot{width:12px;height:12px;border-radius:50%;border:1.2px solid var(--text-dim,#D4C8AE);display:inline-block}',
    '.cdp-surface .cal-tap.on .cal-tapdot{background:var(--teal,#81CDB6);border-color:var(--teal,#81CDB6)}',
    '.cdp-surface .cal-taplabel{font-family:\'EB Garamond\',Georgia,serif;font-style:italic;font-size:13px;color:var(--text-dim,#D4C8AE)}',
    '.cdp-surface .cal-tap.on .cal-taplabel{color:var(--teal,#81CDB6)}',
    '.cdp-surface .cal-dd-scrim{position:fixed;inset:0;z-index:80;background:rgba(4,12,24,.62);display:flex;align-items:flex-end;justify-content:center}',
    '.cdp-surface .cal-dd{width:100%;max-width:44rem;max-height:80vh;overflow-y:auto;background:var(--navy,#0D1E33);border:1px solid var(--gold-line,#3A3320);border-radius:12px 12px 0 0;padding:18px 18px 28px}',
    '.cdp-surface .cal-dd-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}',
    '.cdp-surface .cal-dd-h{font-family:Cinzel,Georgia,serif;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold,#C9A050)}',
    '.cdp-surface .cal-dd-x{background:none;border:none;color:var(--text-dim,#D4C8AE);font-size:20px;cursor:pointer}',
    '.cdp-surface .cal-dd-q{font-family:\'EB Garamond\',Georgia,serif;font-size:15px;color:var(--gold-soft,#E8C878);margin:0 0 8px}',
    '.cdp-surface .cal-dd-a{font-family:Georgia,serif;font-size:14px;line-height:1.7;color:var(--text-light,#F0E6CC)}',
    '.cdp-surface .cal-dd-a p{margin:0 0 10px}',
    '.cdp-surface .cal-sources{font-family:Georgia,serif;font-size:11px;line-height:1.6;color:var(--text-dim,#D4C8AE);margin-top:18px;text-align:center}',
  ].join('');
  const style = el('style', { id: STYLE_ID });
  style.textContent = css;
  document.head.appendChild(style);
}

export function openCalendar(o: OpenCalendarOptions): CalendarHandle {
  ensureStyle();
  const view = el('div', { class: 'cal-view', role: 'dialog', 'aria-label': 'Calendar' });
  const shell = el('div', { class: 'cal-shell' });
  const bar = el('div', { class: 'cal-bar' });
  bar.appendChild(el('div', { class: 'cal-h' }, 'The calendar'));
  const closeBtn = el('button', { type: 'button', class: 'cal-close', 'aria-label': 'Close' }, '\u00d7');
  bar.appendChild(closeBtn);
  shell.appendChild(bar);
  shell.appendChild(el('div', { class: 'cal-intro' }, 'The month at a glance, each day carrying its Kin, its number, its portals and its moon. Tap any day to open it in full.'));

  const prof = o.getProfile();
  const hasBirth = !!(prof && prof.birthDate);
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayD = new Date();
  let viewYear = todayD.getUTCFullYear();
  let viewMonth = todayD.getUTCMonth();
  let selected = todayStr;
  const bestDays = new Set<string>();

  /* ---- the in place Compass drawer ---------------------------------------- */
  let ddOpen = false;
  function openAsk(prompt: string, landSig?: Partial<VesselSignal>): void {
    if (ddOpen || !o.composeAsk) return;
    ddOpen = true;
    const scrim = el('div', { class: 'cal-dd-scrim' });
    const panel = el('div', { class: 'cal-dd', role: 'dialog', 'aria-label': 'The Oracle' });
    const head = el('div', { class: 'cal-dd-head' });
    head.appendChild(el('div', { class: 'cal-dd-h' }, landSig && landSig.bridge ? 'Through the other telescope' : 'Ask the Oracle'));
    const x = el('button', { type: 'button', class: 'cal-dd-x', 'aria-label': 'Close' }, '\u00d7');
    head.appendChild(x);
    panel.appendChild(head);
    panel.appendChild(el('div', { class: 'cal-dd-q' }, prompt));
    const ans = el('div', { class: 'cal-dd-a' }, 'Composing.');
    panel.appendChild(ans);
    scrim.appendChild(panel);
    view.appendChild(scrim);
    function closeDD(): void { ddOpen = false; if (scrim.parentNode) scrim.parentNode.removeChild(scrim); }
    x.addEventListener('click', closeDD);
    scrim.addEventListener('click', (e: Event) => { if (e.target === scrim) closeDD(); });
    o.composeAsk(prompt).then((text) => {
      clear(ans);
      const ps = String(text || '').split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
      if (ps.length) { for (const p of ps) ans.appendChild(el('p', {}, p)); }
      else ans.textContent = text || 'No reply came back. Please try again in a moment.';
    }).catch(() => { ans.textContent = 'The Oracle could not be reached just now. Please try again in a moment.'; });
  }
  function attachTap(parent: HTMLElement, sig: Partial<VesselSignal>, label: string): void {
    if (!o.recordSignal) return;
    const wrap = el('div', { class: 'cal-tap' });
    wrap.appendChild(el('span', { class: 'cal-tapdot' }));
    const lab = el('span', { class: 'cal-taplabel' }, label);
    wrap.appendChild(lab);
    let done = false;
    wrap.addEventListener('click', () => {
      if (done) return;
      done = true;
      wrap.classList.add('on');
      lab.textContent = 'noted';
      o.recordSignal!({ at: Date.now(), date: selected, kind: 'landed', surface: 'calendar', voice: o.getLens(), ...sig });
      if (o.reflect) o.reflect('You marked what landed.');
    });
    parent.appendChild(wrap);
  }

  /* ---- navigation header -------------------------------------------------- */
  const nav = el('div', { class: 'cal-nav' });
  const prev = el('button', { type: 'button', class: 'cal-navbtn', 'aria-label': 'Previous month' }, '\u2039');
  const monthLabel = el('div', { class: 'cal-month' });
  const next = el('button', { type: 'button', class: 'cal-navbtn', 'aria-label': 'Next month' }, '\u203a');
  nav.appendChild(prev);
  nav.appendChild(monthLabel);
  nav.appendChild(next);

  /* ---- best day finder ---------------------------------------------------- */
  const bd = el('div', { class: 'cal-bd' });
  bd.appendChild(el('div', { class: 'cal-bd-label' }, 'Find the best days this month'));
  const bdForm = el('div', { class: 'cal-bd-form' });
  const bdInput = el('input', { type: 'text', class: 'cal-bd-input', placeholder: 'What is this for, a launch, a conversation, rest' }) as HTMLInputElement;
  const bdBtn = el('button', { type: 'button', class: 'cal-bd-btn' }, 'Find days');
  bdForm.appendChild(bdInput);
  bdForm.appendChild(bdBtn);
  bd.appendChild(bdForm);
  const bdStatus = el('div', { class: 'cal-bd-status' });
  bd.appendChild(bdStatus);

  const wd = el('div', { class: 'cal-wd' });
  for (const d of WD_SHORT) wd.appendChild(el('span', {}, d));

  const grid = el('div', { class: 'cal-grid' });
  const legend = el('div', { class: 'cal-legend' }, 'A teal dot marks a Galactic Activation Portal. A purple number marks a master day. The moon shows new, first quarter, full, and last quarter. A teal outline marks a best day for your stated intention.');
  const detail = el('div', { class: 'cal-detail' });

  function renderDetail(): void {
    clear(detail);
    const d = new Date(selected + 'T12:00:00Z');
    const weekday = WEEKDAYS_L[d.getUTCDay()];
    const dayNum = d.getUTCDate();
    detail.appendChild(el('div', { class: 'cal-det-date' }, weekday + ', ' + dayNum + ' ' + MONTHS_L[d.getUTCMonth()] + ' ' + d.getUTCFullYear()));

    function detRow(label: string, value: HTMLElement | string): void {
      const r = el('div', { class: 'cal-det-row' });
      r.appendChild(el('div', { class: 'cal-det-label' }, label));
      if (typeof value === 'string') r.appendChild(el('div', { class: 'cal-det-val' }, value));
      else { const v = el('div', { class: 'cal-det-val' }); v.appendChild(value); r.appendChild(v); }
      detail.appendChild(r);
    }

    const ud = universalDay(selected);
    const udVal = el('span', {}, (ud.isMaster ? String(ud.value) + ', reducing to ' + ud.reducesTo : String(ud.value)) + ', ' + numName(ud.value));
    if (ud.isMaster) udVal.className = 'm';
    detRow('Day energy', udVal);

    const desc = kinDescriptor(selected);
    detRow('Dreamspell', desc.full + (desc.isGAP ? ', a Galactic Activation Portal' : ''));

    if (hasBirth && prof && prof.birthDate) {
      const pn = personalNumerology(prof.birthDate, selected);
      const pd = pn.personalDay;
      const pdVal = el('span', {}, (pd.isMaster ? String(pd.value) + ', reducing to ' + pd.reducesTo : String(pd.value)) + ', ' + numName(pd.value));
      if (pd.isMaster) pdVal.className = 'm';
      detRow('Your day', pdVal);
      detRow('Your month', String(pn.personalMonth.value) + ', ' + numName(pn.personalMonth.value) + '. Your year, ' + pn.personalYear.value + ', ' + numName(pn.personalYear.value) + '.');
    }

    const lw = lunarWindow(selected);
    let moonLine = lw.phase + '. ' + lw.meaning + '.';
    if (lw.black) moonLine = moonLine + ' A Black Moon window, the two days before the new moon, a tricky time to tread gently.';
    if (lw.shiva) moonLine = moonLine + ' A Shiva Moon window, the two days after the new moon, a blissful, restorative time.';
    detRow('The moon', moonLine);

    if (o.composeAsk) {
      const promptBase = 'On ' + weekday + ' ' + dayNum + ' ' + MONTHS_L[d.getUTCMonth()] + ', the day energy is ' + ud.value + ', ' + numName(ud.value) + ', the Dreamspell Kin is ' + desc.full + ', and the moon is ' + lw.phase + '. What does this day hold for me, and how best to meet it.';
      const cue = el('div', { class: 'cal-cue' }, 'Open this day with the Oracle \u2197');
      cue.addEventListener('click', () => openAsk(promptBase, { framework: 'convergence', section: 'day' }));
      detail.appendChild(cue);

      const otherLens: Lens = o.getLens() === 'science' ? 'tradition' : 'science';
      const otherWord = otherLens === 'science' ? 'science' : 'symbolic';
      const bridge = el('button', { type: 'button', class: 'cal-bridge' }, 'Through the other telescope');
      bridge.addEventListener('click', () => {
        if (o.recordSignal) o.recordSignal({ at: Date.now(), date: selected, kind: 'landed', surface: 'calendar', voice: otherLens, bridge: true, framework: 'convergence', section: 'day' });
        openAsk('Show me this day through the ' + otherWord + ' telescope, the same coordinates seen with the other lens.', { bridge: true, framework: 'convergence', section: 'day' });
      });
      detail.appendChild(bridge);
    }
    attachTap(detail, { framework: 'convergence', section: 'day' }, 'this landed');
  }

  function renderGrid(): void {
    clear(grid);
    monthLabel.textContent = MONTHS_L[viewMonth] + ' ' + String(viewYear);
    const firstWeekday = new Date(Date.UTC(viewYear, viewMonth, 1)).getUTCDay();
    const offset = (firstWeekday + 6) % 7; // Monday start
    const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();
    for (let i = 0; i < offset; i++) grid.appendChild(el('div', { class: 'cal-cell blank' }));
    for (let day = 1; day <= daysInMonth; day++) {
      const ds = cellDate(viewYear, viewMonth, day);
      const kin = kinForDate(ds);
      const ud = universalDay(ds);
      const portal = isGAP(kin);
      const cls = 'cal-cell' + (ds === todayStr ? ' today' : '') + (ds === selected ? ' sel' : '') + (bestDays.has(ds) ? ' best' : '');
      const cell = el('button', { type: 'button', class: cls });
      cell.appendChild(el('div', { class: 'cal-d' }, String(day)));
      const mg = moonGlyph(ds);
      if (mg) cell.appendChild(el('div', { class: 'cal-moon' }, mg));
      const foot = el('div', { class: 'cal-foot' });
      foot.appendChild(el('span', { class: 'cal-kin' }, 'K' + kin));
      if (portal) foot.appendChild(el('span', { class: 'cal-portal' }));
      const pdVal = hasBirth && prof && prof.birthDate ? personalNumerology(prof.birthDate, ds).personalDay : ud;
      foot.appendChild(el('span', { class: 'cal-pd' + (pdVal.isMaster ? ' master' : '') }, String(pdVal.value)));
      cell.appendChild(foot);
      cell.addEventListener('click', () => { selected = ds; renderGrid(); renderDetail(); });
      grid.appendChild(cell);
    }
  }

  async function findBestDays(): Promise<void> {
    const intent = bdInput.value.trim();
    if (!intent) { bdStatus.textContent = 'Name what the days are for, and the month is scanned for you.'; return; }
    if (!hasBirth || !prof || !prof.birthDate) { bdStatus.textContent = 'Add your birth date in your Cosmic Profile, and the best days are drawn around your own numbers.'; return; }
    const monthStart = cellDate(viewYear, viewMonth, 1);
    const lastDay = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();
    const monthEnd = cellDate(viewYear, viewMonth, lastDay);
    const up: Record<string, unknown> = {
      dob: prof.birthDate,
      birthKin: kinForDate(prof.birthDate),
      personalYear: personalNumerology(prof.birthDate, monthStart).personalYear.value,
      lifePath: lifePathOf(prof.birthDate),
    };
    if (prof.name) up.name = prof.name;
    bdStatus.textContent = 'Scanning ' + MONTHS_L[viewMonth] + ' for the best days for ' + intent + '.';
    try {
      const res = await fetch('/api/best-day', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userProfile: up, intent, monthStart, monthEnd, topN: lastDay }) });
      const data = await res.json() as { ranked?: BdDay[]; fullScan?: BdDay[]; error?: string };
      if (data.error) throw new Error(data.error);
      const ranked = (data.ranked || data.fullScan || []);
      bestDays.clear();
      ranked.slice(0, 3).forEach((d) => { if (d && d.dateIso) bestDays.add(d.dateIso); });
      renderGrid();
      if (bestDays.size) {
        bdStatus.textContent = 'The strongest days for ' + intent + ' are outlined on the grid.';
        if (o.reflect) o.reflect('Best days for ' + intent + ' are marked.');
      } else {
        bdStatus.textContent = 'No standout days this month for that. A broader intention may surface more.';
      }
    } catch (_e) {
      bdStatus.textContent = 'The best day engine could not be reached just now. Please try again in a moment.';
    }
  }

  prev.addEventListener('click', () => { viewMonth -= 1; if (viewMonth < 0) { viewMonth = 11; viewYear -= 1; } bestDays.clear(); renderGrid(); });
  next.addEventListener('click', () => { viewMonth += 1; if (viewMonth > 11) { viewMonth = 0; viewYear += 1; } bestDays.clear(); renderGrid(); });
  bdBtn.addEventListener('click', () => { void findBestDays(); });
  bdInput.addEventListener('keydown', (e: Event) => { if ((e as KeyboardEvent).key === 'Enter') { void findBestDays(); } });

  shell.appendChild(nav);
  shell.appendChild(bd);
  shell.appendChild(wd);
  shell.appendChild(grid);
  shell.appendChild(legend);
  shell.appendChild(detail);
  shell.appendChild(el('div', { class: 'cal-sources' }, 'Moon phases from the United States Naval Observatory 2026 table. Dreamspell after Arguelles 1987, held distinct from the living K\u2019iche\u2019 count. Numerology, Pythagorean, master numbers preserved.'));

  shell.appendChild(shareControls({
    title: 'My calendar, ' + MONTHS_L[viewMonth] + ' ' + String(viewYear),
    text: () => 'My calendar, ' + MONTHS_L[viewMonth] + ' ' + String(viewYear) + '\n\n' + detail.innerText,
    node: () => detail,
  }));

  renderGrid();
  renderDetail();

  view.appendChild(shell);
  o.container.appendChild(view);
  function close(): void { if (view.parentNode) view.parentNode.removeChild(view); }
  closeBtn.addEventListener('click', close);
  if (o.reflect) o.reflect('The month is laid out, every day open to a tap.');
  return { close };
}
