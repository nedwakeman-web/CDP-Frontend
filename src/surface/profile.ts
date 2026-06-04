/**
 * CDP Vessel, surface layer: Profile capture.
 *
 * The person's own coordinates and the context that lets the Oracle speak to a
 * life rather than a generic one. Built to the profile capture basement:
 * Identity, Birth Details with Place of Birth, the live Cosmic Signature with
 * what the numbers mean, Life Context, and the optional hormonal cycle that is
 * stored on device only. Details save automatically as they are typed, through
 * the repository, so a person captured on one device is recognised on the next.
 *
 * The signature is computed here from the corrected coordinate core, the same
 * Life Path, Personal Year, Birth Kin, and Sun sign every other surface reads,
 * so the numbers never disagree across the Vessel. The natal chart itself, the
 * rising sign and house cusps, arrives at the Mystic and Oracle tiers from the
 * ephemeris; this surface is honest that birth time and place are held for that.
 *
 * House style holds here, in code, comments, and visible strings alike: no em
 * dashes, no en dashes, no exclamation marks, and no spaced hyphen patterns.
 */

import type { VesselRepository } from '../data/repository';
import type { Lens, VesselProfile } from '../data/model';
import { kinDescriptor, personalNumerology, reduceNumber } from '../coordinates-core';
import { NUM_DATA, PY_ARC } from '../data/numerology-content';
import { searchPlaces, type PlaceResult } from '../data/geocode';

export interface OpenProfileOptions {
  container: HTMLElement;
  repo: VesselRepository;
  getLens: () => Lens;
  /** Called after a save so the home can refresh its signature. */
  onSaved?: (p: VesselProfile) => void;
  reflect?: (note: string) => void;
}
export interface ProfileHandle { close(): void; }

type Attrs = Record<string, string>;
function el(tag: string, attrs: Attrs = {}, text?: string): HTMLElement {
  const node = document.createElement(tag);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  if (text !== undefined) node.textContent = text;
  return node;
}
function clear(node: HTMLElement): void { while (node.firstChild) node.removeChild(node.firstChild); }

/* ---- numbers and symbols, all from the corrected core --------------------- */

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

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const STYLE_ID = 'cdp-profile-style';
function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const css = [
    '.cdp-surface .pc-view{position:fixed;top:58px;left:0;right:0;bottom:0;z-index:60;background:var(--bg,#0A1828);overflow-y:auto;padding:24px 18px 72px}',
    '.cdp-surface .pc-shell{max-width:42rem;margin:0 auto}',
    '.cdp-surface .pc-bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}',
    '.cdp-surface .pc-h{font-family:Cinzel,Georgia,serif;font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold,#C9A050)}',
    '.cdp-surface .pc-close{background:none;border:none;cursor:pointer;color:var(--text-dim,#D4C8AE);font-size:22px;line-height:1;padding:4px 8px}',
    '.cdp-surface .pc-close:hover{color:var(--gold,#C9A050)}',
    '.cdp-surface .pc-title{font-family:\'EB Garamond\',Georgia,serif;font-size:26px;color:var(--gold,#C9A050);text-align:center;margin:8px 0 6px}',
    '.cdp-surface .pc-intro{font-family:\'EB Garamond\',Georgia,serif;font-size:14px;color:var(--text-dim,#D4C8AE);text-align:center;line-height:1.6;margin:0 auto 6px;max-width:32rem}',
    '.cdp-surface .pc-save-note{font-family:\'EB Garamond\',Georgia,serif;font-style:italic;font-size:12px;color:var(--text-dim,#D4C8AE);text-align:center;margin-bottom:18px}',
    '.cdp-surface .pc-saved{color:var(--teal,#81CDB6)}',
    '.cdp-surface .pc-section{font-family:Cinzel,Georgia,serif;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--text-dim,#D4C8AE);margin:24px 0 4px;border-top:1px solid rgba(191,163,99,.12);padding-top:18px}',
    '.cdp-surface .pc-field{margin:12px 0}',
    '.cdp-surface .pc-label{display:block;font-family:Cinzel,Georgia,serif;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-dim,#D4C8AE);margin-bottom:5px}',
    '.cdp-surface .pc-label .pc-hint{font-family:\'EB Garamond\',Georgia,serif;font-style:italic;font-size:11px;letter-spacing:0;text-transform:none;color:var(--text-dim,#D4C8AE);margin-left:8px}',
    '.cdp-surface .pc-in,.cdp-surface .pc-sel,.cdp-surface .pc-ta{width:100%;box-sizing:border-box;background:var(--navy,#0D1E33);border:1px solid var(--gold-line,#3A3320);border-radius:3px;color:var(--text-light,#F0E6CC);font-family:\'EB Garamond\',Georgia,serif;font-size:16px;padding:11px 13px}',
    '.cdp-surface .pc-ta{min-height:84px;resize:vertical;line-height:1.5}',
    '.cdp-surface .pc-hintline{font-family:\'EB Garamond\',Georgia,serif;font-style:italic;font-size:11px;color:var(--text-dim,#D4C8AE);margin-top:4px}',
    '.cdp-surface .pc-dob{display:flex;gap:8px}',
    '.cdp-surface .pc-dob .pc-sel{flex:1}',
    '.cdp-surface .pc-ac{position:relative}',
    '.cdp-surface .pc-ac-list{display:none;position:absolute;left:0;right:0;top:100%;z-index:30;margin-top:4px;background:var(--raised,#13284A);border:1px solid var(--gold-line,#3A3320);border-radius:4px;box-shadow:0 12px 30px rgba(0,0,0,.45);overflow:hidden;max-height:280px;overflow-y:auto}',
    '.cdp-surface .pc-ac-list.open{display:block}',
    '.cdp-surface .pc-ac-item{display:flex;flex-direction:column;gap:2px;width:100%;text-align:left;background:none;border:none;border-bottom:1px solid rgba(191,163,99,.1);cursor:pointer;padding:10px 13px}',
    '.cdp-surface .pc-ac-item:last-child{border-bottom:none}',
    '.cdp-surface .pc-ac-item.active,.cdp-surface .pc-ac-item:hover{background:rgba(201,160,80,.1)}',
    '.cdp-surface .pc-ac-name{font-family:\'EB Garamond\',Georgia,serif;font-size:16px;color:var(--text-light,#F0E6CC)}',
    '.cdp-surface .pc-ac-sub{font-family:Georgia,serif;font-size:12px;color:var(--text-dim,#D4C8AE)}',
    '.cdp-surface .pc-ac-tz{font-family:Cinzel,Georgia,serif;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--gold-soft,#E8C878)}',
    '.cdp-surface .pc-resolved{font-family:\'EB Garamond\',Georgia,serif;font-style:italic;font-size:12px;line-height:1.5;color:var(--text-dim,#D4C8AE);margin-top:6px}',
    '.cdp-surface .pc-resolved.ok{color:var(--teal,#81CDB6)}',
    '.cdp-surface .pc-sig{border:1px solid var(--gold-line,#3A3320);border-radius:5px;background:var(--navy,#0D1E33);padding:18px 18px;margin:18px 0}',
    '.cdp-surface .pc-sig-head{font-family:\'EB Garamond\',Georgia,serif;font-size:20px;color:var(--gold,#C9A050);margin-bottom:3px}',
    '.cdp-surface .pc-sig-sub{font-family:Georgia,serif;font-size:13px;color:var(--text-dim,#D4C8AE);margin-bottom:14px}',
    '.cdp-surface .pc-sig-empty{font-family:\'EB Garamond\',Georgia,serif;font-style:italic;font-size:14px;color:var(--text-dim,#D4C8AE);text-align:center;padding:8px 0}',
    '.cdp-surface .pc-meanlabel{font-family:Cinzel,Georgia,serif;font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:var(--text-dim,#D4C8AE);margin:14px 0 8px}',
    '.cdp-surface .pc-cards{display:flex;gap:10px;flex-wrap:wrap}',
    '.cdp-surface .pc-mcard{flex:1;min-width:200px;border:1px solid rgba(191,163,99,.18);border-radius:4px;background:rgba(0,0,0,.12);padding:12px 13px}',
    '.cdp-surface .pc-mlabel{font-family:Cinzel,Georgia,serif;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-dim,#D4C8AE);margin-bottom:5px}',
    '.cdp-surface .pc-mbig{font-family:\'EB Garamond\',Georgia,serif;font-size:26px;color:var(--gold,#C9A050);line-height:1.1}',
    '.cdp-surface .pc-mbig.master{color:var(--master,#C8A0FF)}',
    '.cdp-surface .pc-mname{font-family:\'EB Garamond\',Georgia,serif;font-style:italic;font-size:14px;color:var(--gold-soft,#E8C878);margin:2px 0 6px}',
    '.cdp-surface .pc-mkin{font-family:\'EB Garamond\',Georgia,serif;font-size:16px;color:var(--teal,#81CDB6);margin-bottom:6px}',
    '.cdp-surface .pc-mtext{font-family:Georgia,serif;font-size:13px;line-height:1.6;color:var(--text-dim,#D4C8AE)}',
    '.cdp-surface .pc-cycle-row{display:flex;align-items:flex-start;gap:10px;margin:8px 0}',
    '.cdp-surface .pc-cycle-row input[type=checkbox]{margin-top:4px;width:16px;height:16px}',
    '.cdp-surface .pc-cyclelink{background:none;border:none;color:var(--gold,#C9A050);font-family:\'EB Garamond\',Georgia,serif;font-size:13px;cursor:pointer;padding:6px 0;text-decoration:underline}',
    '.cdp-surface .pc-go{display:block;width:100%;box-sizing:border-box;background:none;border:1px solid var(--gold,#C9A050);color:var(--gold,#C9A050);font-family:Cinzel,Georgia,serif;font-size:12px;letter-spacing:.16em;text-transform:uppercase;padding:15px;border-radius:4px;cursor:pointer;margin-top:24px}',
    '.cdp-surface .pc-go:hover{background:rgba(201,160,80,.08)}',
  ].join('');
  const style = el('style', { id: STYLE_ID });
  style.textContent = css;
  document.head.appendChild(style);
}

export function openProfile(o: OpenProfileOptions): ProfileHandle {
  ensureStyle();
  const current: VesselProfile = { ...(o.repo.getProfile() || {}) };

  const view = el('div', { class: 'pc-view', role: 'dialog', 'aria-label': 'Your Cosmic Profile' });
  const shell = el('div', { class: 'pc-shell' });

  const bar = el('div', { class: 'pc-bar' });
  bar.appendChild(el('div', { class: 'pc-h' }, 'Your Cosmic Profile'));
  const closeBtn = el('button', { type: 'button', class: 'pc-close', 'aria-label': 'Close' }, '\u00d7');
  bar.appendChild(closeBtn);
  shell.appendChild(bar);

  shell.appendChild(el('div', { class: 'pc-title' }, 'Your Cosmic Profile'));
  shell.appendChild(el('div', { class: 'pc-intro' }, 'Your birth details unlock your Galactic Signature, Life Path, and fully personalised Oracle readings.'));
  const saveNote = el('div', { class: 'pc-save-note' }, 'Your details are saved automatically as you type and stored on this device.');
  shell.appendChild(saveNote);

  function sectionLabel(text: string): void { shell.appendChild(el('div', { class: 'pc-section' }, text)); }

  function textField(label: string, hint: string, value: string, onInput: (v: string) => void, textarea?: boolean): HTMLElement {
    const wrap = el('div', { class: 'pc-field' });
    const lab = el('label', { class: 'pc-label' }, label);
    if (hint) lab.appendChild(el('span', { class: 'pc-hint' }, hint));
    wrap.appendChild(lab);
    const input = el(textarea ? 'textarea' : 'input', { class: textarea ? 'pc-ta' : 'pc-in' }) as HTMLInputElement | HTMLTextAreaElement;
    if (!textarea) (input as HTMLInputElement).type = 'text';
    input.value = value || '';
    input.addEventListener('input', () => { onInput(input.value); });
    wrap.appendChild(input);
    shell.appendChild(wrap);
    return wrap;
  }

  /* ---- Identity ---------------------------------------------------------- */
  sectionLabel('Identity');
  textField('Preferred name or nickname', 'This is how the Oracle will address you in readings', current.name || '', (v) => { current.name = v; queueSave(); });
  textField('Full name', '', current.fullName || '', (v) => { current.fullName = v; queueSave(); });
  textField('Location', '', current.location || '', (v) => { current.location = v; queueSave(); });
  textField('Personal context', 'deepens Oracle readings', current.context || '', (v) => { current.context = v; queueSave(); }, true);

  /* ---- Birth details ----------------------------------------------------- */
  sectionLabel('Birth details');
  const dobWrap = el('div', { class: 'pc-field' });
  dobWrap.appendChild(el('label', { class: 'pc-label' }, 'Date of birth'));
  const dobRow = el('div', { class: 'pc-dob' });
  const daySel = el('select', { class: 'pc-sel', 'aria-label': 'Day' }) as HTMLSelectElement;
  const monthSel = el('select', { class: 'pc-sel', 'aria-label': 'Month' }) as HTMLSelectElement;
  const yearSel = el('select', { class: 'pc-sel', 'aria-label': 'Year' }) as HTMLSelectElement;
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(current.birthDate || '');
  daySel.appendChild(el('option', { value: '' }, 'Day'));
  for (let d = 1; d <= 31; d++) { const opt = el('option', { value: String(d) }, String(d)) as HTMLOptionElement; if (parts && Number(parts[3]) === d) opt.selected = true; daySel.appendChild(opt); }
  monthSel.appendChild(el('option', { value: '' }, 'Month'));
  MONTHS.forEach((monthName, i) => { const opt = el('option', { value: String(i + 1) }, monthName) as HTMLOptionElement; if (parts && Number(parts[2]) === i + 1) opt.selected = true; monthSel.appendChild(opt); });
  yearSel.appendChild(el('option', { value: '' }, 'Year'));
  const thisYear = new Date().getFullYear();
  for (let y = thisYear; y >= 1900; y--) { const opt = el('option', { value: String(y) }, String(y)) as HTMLOptionElement; if (parts && Number(parts[1]) === y) opt.selected = true; yearSel.appendChild(opt); }
  function assembleDob(): void {
    const d = daySel.value, m = monthSel.value, y = yearSel.value;
    if (d && m && y) {
      const dd = String(Number(d)).padStart(2, '0');
      const mm = String(Number(m)).padStart(2, '0');
      current.birthDate = y + '-' + mm + '-' + dd;
    } else {
      current.birthDate = undefined;
    }
    renderSignature();
    queueSave();
  }
  [daySel, monthSel, yearSel].forEach((s) => s.addEventListener('change', assembleDob));
  dobRow.appendChild(daySel); dobRow.appendChild(monthSel); dobRow.appendChild(yearSel);
  dobWrap.appendChild(dobRow);
  shell.appendChild(dobWrap);

  // Birth time as a real time field, so the value is always a clean HH:MM the
  // ephemeris can read for the Ascendant, never a free hand typed string.
  {
    const wrap = el('div', { class: 'pc-field' });
    const lab = el('label', { class: 'pc-label' }, 'Birth time');
    lab.appendChild(el('span', { class: 'pc-hint' }, 'for rising sign'));
    wrap.appendChild(lab);
    const t = el('input', { class: 'pc-in' }) as HTMLInputElement;
    t.type = 'time';
    t.value = current.birthTime || '';
    t.addEventListener('input', () => { current.birthTime = t.value; queueSave(); });
    wrap.appendChild(t);
    wrap.appendChild(el('div', { class: 'pc-hintline' }, 'Used for Ascendant calculation at Mystic and Oracle tiers. Leave blank if unknown.'));
    shell.appendChild(wrap);
  }

  // Place of birth as a coordinate, not a string. Typing searches a keyless
  // geocoder; choosing a result captures latitude, longitude, and timezone, the
  // three things the natal chart needs. Typing without choosing keeps the words
  // as a plain place name and clears any stale coordinates, and the line below
  // is honest about whether the chart can be cast.
  {
    const wrap = el('div', { class: 'pc-field pc-ac' });
    const lab = el('label', { class: 'pc-label' }, 'Place of birth');
    lab.appendChild(el('span', { class: 'pc-hint' }, 'city and country'));
    wrap.appendChild(lab);
    const input = el('input', { class: 'pc-in', autocomplete: 'off', 'aria-autocomplete': 'list' }) as HTMLInputElement;
    input.type = 'text';
    input.value = current.birthPlace || '';
    wrap.appendChild(input);
    const list = el('div', { class: 'pc-ac-list' });
    wrap.appendChild(list);
    const resolved = el('div', { class: 'pc-resolved' });
    wrap.appendChild(resolved);
    const hint = el('div', { class: 'pc-hintline' }, 'Essential for natal chart precision. Rising sign, house cusps, and transit timing all require birth coordinates.');
    wrap.appendChild(hint);

    function renderResolved(): void {
      clear(resolved);
      if (typeof current.birthLat === 'number' && typeof current.birthLon === 'number') {
        const lat = current.birthLat.toFixed(3);
        const lon = current.birthLon.toFixed(3);
        const tz = current.birthTimezone ? (', ' + current.birthTimezone) : '';
        resolved.classList.add('ok');
        resolved.textContent = 'Coordinates captured, ' + lat + ', ' + lon + tz + '. The natal chart can be cast.';
      } else if ((current.birthPlace || '').trim()) {
        resolved.classList.remove('ok');
        resolved.textContent = 'Choose a place from the list to capture coordinates for the natal chart.';
      }
    }
    renderResolved();

    let items: PlaceResult[] = [];
    let active = -1;
    let controller: AbortController | null = null;
    let debounce: ReturnType<typeof setTimeout> | null = null;

    function closeList(): void { clear(list); list.classList.remove('open'); items = []; active = -1; }

    function paintActive(): void {
      const rows = list.querySelectorAll('.pc-ac-item');
      rows.forEach((r, i) => {
        if (i === active) r.classList.add('active'); else r.classList.remove('active');
      });
    }

    function choose(p: PlaceResult): void {
      current.birthPlace = p.display;
      current.birthLat = p.latitude;
      current.birthLon = p.longitude;
      current.birthTimezone = p.timezone;
      current.birthCountry = p.country;
      input.value = p.display;
      closeList();
      renderResolved();
      queueSave();
    }

    function renderList(): void {
      clear(list);
      if (items.length === 0) { list.classList.remove('open'); return; }
      items.forEach((p, i) => {
        const row = el('button', { type: 'button', class: 'pc-ac-item', role: 'option' });
        row.appendChild(el('span', { class: 'pc-ac-name' }, p.name));
        const sub = [p.admin1, p.country].filter(Boolean).join(', ');
        if (sub) row.appendChild(el('span', { class: 'pc-ac-sub' }, sub));
        if (p.timezone) row.appendChild(el('span', { class: 'pc-ac-tz' }, p.timezone));
        row.addEventListener('mousedown', (e: Event) => { e.preventDefault(); choose(p); });
        row.addEventListener('mouseenter', () => { active = i; paintActive(); });
        list.appendChild(row);
        void i;
      });
      list.classList.add('open');
      active = -1;
    }

    async function run(q: string): Promise<void> {
      if (controller) controller.abort();
      controller = new AbortController();
      const found = await searchPlaces(q, 6, controller.signal);
      // ignore a stale resolve whose query no longer matches the field
      if (input.value.trim() !== q.trim()) return;
      items = found;
      renderList();
    }

    input.addEventListener('input', () => {
      const q = input.value;
      // typing changes the place, so any previously captured coordinates no
      // longer describe what is in the field; clear them until a new choice
      current.birthPlace = q;
      current.birthLat = undefined;
      current.birthLon = undefined;
      current.birthTimezone = undefined;
      current.birthCountry = undefined;
      renderResolved();
      queueSave();
      if (debounce) clearTimeout(debounce);
      if (q.trim().length < 2) { closeList(); return; }
      debounce = setTimeout(() => { void run(q); }, 280);
    });
    input.addEventListener('keydown', (e: KeyboardEvent) => {
      if (!list.classList.contains('open') || items.length === 0) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % items.length; paintActive(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + items.length) % items.length; paintActive(); }
      else if (e.key === 'Enter') { if (active >= 0 && active < items.length) { e.preventDefault(); choose(items[active]); } }
      else if (e.key === 'Escape') { closeList(); }
    });
    input.addEventListener('blur', () => { setTimeout(closeList, 140); });
    shell.appendChild(wrap);
  }

  /* ---- The live Cosmic Signature ---------------------------------------- */
  const sig = el('div', { class: 'pc-sig' });
  shell.appendChild(sig);
  function meaningCard(label: string, big: string, master: boolean, name: string, text: string, kinLine?: string): HTMLElement {
    const card = el('div', { class: 'pc-mcard' });
    card.appendChild(el('div', { class: 'pc-mlabel' }, label));
    if (kinLine) card.appendChild(el('div', { class: 'pc-mkin' }, kinLine));
    else card.appendChild(el('div', { class: 'pc-mbig' + (master ? ' master' : '') }, big));
    if (name) card.appendChild(el('div', { class: 'pc-mname' }, name));
    if (text) card.appendChild(el('div', { class: 'pc-mtext' }, text));
    return card;
  }
  function renderSignature(): void {
    clear(sig);
    const bd = current.birthDate;
    if (!bd || !/^\d{4}-\d{2}-\d{2}$/.test(bd)) {
      sig.appendChild(el('div', { class: 'pc-sig-empty' }, 'Enter your date of birth to reveal your Galactic Signature, Life Path, and Personal Year.'));
      return;
    }
    const kd = kinDescriptor(bd);
    const lp = lifePath(bd);
    const py = personalNumerology(bd, '2026-06-03').personalYear;
    const pyMaster = isMaster(py.value);
    const sun = sunSign(bd);
    sig.appendChild(el('div', { class: 'pc-sig-head' }, kd.full));
    sig.appendChild(el('div', { class: 'pc-sig-sub' }, 'Life Path ' + lp.value + '  \u00b7  Personal Year 2026: ' + py.value + '  \u00b7  Sun: ' + sun));
    sig.appendChild(el('div', { class: 'pc-meanlabel' }, 'What your numbers mean'));

    const cards = el('div', { class: 'pc-cards' });
    cards.appendChild(meaningCard(
      'Life Path' + (lp.master ? '  \u00b7  Master Number' : ''),
      String(lp.value), lp.master, numName(lp.value),
      (NUM_DATA[lp.value] ? NUM_DATA[lp.value].m : '') + ' Symbolic, Pythagorean.',
    ));
    const pyText = pyMaster
      ? (NUM_DATA[py.value] ? NUM_DATA[py.value].m : '')
      : (PY_ARC[py.value] || (NUM_DATA[py.value] ? NUM_DATA[py.value].m : ''));
    cards.appendChild(meaningCard(
      'Personal Year 2026' + (pyMaster ? '  \u00b7  Master Number' : ''),
      String(py.value), pyMaster, numName(py.value),
      pyText + ' Symbolic, Pythagorean.',
    ));
    cards.appendChild(meaningCard(
      'Birth Kin  \u00b7  Galactic Signature', '', false, '',
      'Your Dreamspell birth signature, Argueelles 1987, a modern system held distinct from the living K\u2019iche\u2019 count. The ' + kd.seal + ' carries the energy of ' + kd.seal.toLowerCase() + ' as your foundational gift. Tone ' + kd.tone + ', ' + kd.toneName + ', is your power frequency.',
      kd.full,
    ));
    cards.appendChild(meaningCard(
      'Sun Sign', sun, false, '',
      'Your natal solar placement, the zodiac sign the Sun occupied on your birthday. At Mystic and Oracle tiers your full natal chart is integrated from the ephemeris (Swiss Ephemeris and Astrodienst).',
    ));
    sig.appendChild(cards);
  }
  renderSignature();

  /* ---- Life context ------------------------------------------------------ */
  sectionLabel('Life context');
  shell.appendChild(el('div', { class: 'pc-hintline' }, 'The Oracle speaks most precisely when it knows this.'));
  textField('Your roles', 'comma separated', current.roles || '', (v) => { current.roles = v; queueSave(); });
  textField('Active chapters or projects', 'what is live and in motion right now', current.projects || '', (v) => { current.projects = v; queueSave(); }, true);
  textField('Current intentions', 'what you are building or moving toward in the next six months', current.currentIntentions || '', (v) => { current.currentIntentions = v; queueSave(); }, true);
  textField('Key people', 'the people who might naturally come up in a reading about your life', current.keyPeople || '', (v) => { current.keyPeople = v; queueSave(); }, true);

  /* ---- Hormonal cycle, optional, on device only -------------------------- */
  sectionLabel('Hormonal cycle');
  shell.appendChild(el('div', { class: 'pc-hintline' }, 'Optional, stored on this device only. When the Oracle knows where you are in your cycle, it can speak more precisely to energy, mood, and decision making capacity.'));
  current.cycle = current.cycle || {};
  const toggleRow = el('div', { class: 'pc-cycle-row' });
  const toggle = el('input', { type: 'checkbox', 'aria-label': 'Use cycle awareness in my reading' }) as HTMLInputElement;
  toggle.checked = !!current.cycle.enabled;
  toggle.addEventListener('change', () => { current.cycle = { ...current.cycle, enabled: toggle.checked }; queueSave(); });
  toggleRow.appendChild(toggle);
  toggleRow.appendChild(el('div', { class: 'pc-mtext' }, 'Use cycle awareness in my Reading. When on, the Oracle factors your current phase into voice and pacing. When off, the Reading proceeds without it.'));
  shell.appendChild(toggleRow);
  textField('First day of last period', 'leave blank if not applicable or preferred not to share', current.cycle.lastPeriod || '', (v) => { current.cycle = { ...current.cycle, lastPeriod: v }; queueSave(); });
  textField('Average cycle length in days', '', current.cycle.cycleLength ? String(current.cycle.cycleLength) : '', (v) => { const n = Number(v); current.cycle = { ...current.cycle, cycleLength: Number.isFinite(n) && n > 0 ? Math.round(n) : undefined }; queueSave(); });
  const clearCycle = el('button', { type: 'button', class: 'pc-cyclelink' }, 'Clear cycle data from this device');
  clearCycle.addEventListener('click', () => { current.cycle = {}; void o.repo.setProfile({ cycle: {} }); renderSignature(); flashSaved(); });
  shell.appendChild(clearCycle);

  /* ---- Save and calculate ------------------------------------------------ */
  const go = el('button', { type: 'button', class: 'pc-go' }, 'Save and calculate my Cosmic Signature');
  go.addEventListener('click', () => { void saveNow(true); renderSignature(); sig.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  shell.appendChild(go);

  /* ---- Persistence: autosave as you type, debounced ---------------------- */
  let timer: ReturnType<typeof setTimeout> | null = null;
  function queueSave(): void {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { void saveNow(false); }, 600);
  }
  async function saveNow(announce: boolean): Promise<void> {
    if (timer) { clearTimeout(timer); timer = null; }
    try {
      await o.repo.setProfile({ ...current });
      flashSaved();
      if (o.onSaved) o.onSaved({ ...current });
      if (announce && o.reflect) o.reflect('Your cosmic profile is saved.');
    } catch (_e) {
      saveNote.textContent = 'Your details could not be saved just now. They are held in this session and will save when storage is available again.';
    }
  }
  let flashTimer: ReturnType<typeof setTimeout> | null = null;
  function flashSaved(): void {
    saveNote.textContent = 'Saved on this device.';
    saveNote.classList.add('pc-saved');
    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(() => {
      saveNote.classList.remove('pc-saved');
      saveNote.textContent = 'Your details are saved automatically as you type and stored on this device.';
    }, 1800);
  }

  view.appendChild(shell);
  o.container.appendChild(view);
  function close(): void {
    if (timer) { clearTimeout(timer); void saveNow(false); }
    if (view.parentNode) view.parentNode.removeChild(view);
  }
  closeBtn.addEventListener('click', close);
  return { close };
}
