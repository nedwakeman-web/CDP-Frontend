/**
 * CDP Vessel, surface layer: My year, the long view.
 *
 * Ported from the monolith renderContext. It shows the year as two layers: the
 * universal year that everyone shares, and the personal year drawn from the
 * person's own birth, set against the fixed signature that does not change,
 * the life path and the birth kin. The numbers are computed from the corrected
 * core. The meanings are the symbolic content tables, labelled symbolic.
 *
 * House style holds here: no em dashes, no en dashes, no exclamation marks,
 * and no spaced hyphen patterns.
 */

import type { Lens, VesselProfile } from '../data/model';
import { kinForDate, kinDescriptor, personalNumerology, reduceNumber } from '../coordinates-core';
import { NUM_DATA, PY_ARC } from '../data/numerology-content';
import { shareControls } from './share';

export interface OpenYearOptions {
  container: HTMLElement;
  getProfile: () => VesselProfile | null;
  getLens: () => Lens;
  reflect?: (note: string) => void;
}
export interface YearHandle { close(): void; }

type Attrs = Record<string, string>;
function el(tag: string, attrs: Attrs = {}, text?: string): HTMLElement {
  const node = document.createElement(tag);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  if (text !== undefined) node.textContent = text;
  return node;
}

function digitSum(s: string): number {
  let n = 0;
  for (const c of s) { if (c >= '0' && c <= '9') n += Number(c); }
  return n;
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
    '.cdp-surface .yr-section{font-family:Cinzel,Georgia,serif;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--text-faint,#9E9282);margin:20px 0 10px}',
    '.cdp-surface .yr-card{display:flex;gap:14px;border:1px solid var(--gold-line,#3A3320);border-radius:4px;background:var(--navy,#0D1E33);padding:14px 16px;margin-bottom:11px}',
    '.cdp-surface .yr-num{font-family:\'EB Garamond\',Georgia,serif;font-size:34px;line-height:1;color:var(--gold,#C9A050);min-width:46px;text-align:center}',
    '.cdp-surface .yr-num.master{color:var(--master,#C8A0FF)}',
    '.cdp-surface .yr-body{flex:1;min-width:0}',
    '.cdp-surface .yr-label{font-family:Cinzel,Georgia,serif;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-faint,#9E9282)}',
    '.cdp-surface .yr-title{font-family:\'EB Garamond\',Georgia,serif;font-size:19px;color:var(--text-light,#F0E6CC);margin:2px 0 6px}',
    '.cdp-surface .yr-key{font-size:12px;color:var(--gold-soft,#E8C878);margin-bottom:6px}',
    '.cdp-surface .yr-desc{font-family:Georgia,serif;font-size:14px;line-height:1.7;color:var(--text-light,#F0E6CC)}',
    '.cdp-surface .yr-kin{font-family:\'EB Garamond\',Georgia,serif;font-size:17px;color:var(--text-light,#F0E6CC)}',
    '.cdp-surface .yr-symbolic{font-family:\'EB Garamond\',Georgia,serif;font-style:italic;font-size:12px;color:var(--text-faint,#9E9282);margin:2px 0 14px}',
    '.cdp-surface .yr-empty{font-family:\'EB Garamond\',Georgia,serif;font-style:italic;font-size:14px;color:var(--text-faint,#9E9282);border:1px dashed var(--gold-line,#3A3320);border-radius:4px;padding:18px;text-align:center}',
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
  bar.appendChild(el('div', { class: 'yr-h' }, 'My year'));
  const closeBtn = el('button', { type: 'button', class: 'yr-close', 'aria-label': 'Close' }, '\u00d7');
  bar.appendChild(closeBtn);
  shell.appendChild(bar);

  const content = el('div', { class: 'yr-content' });
  shell.appendChild(content);

  const prof = o.getProfile();
  const hasBirth = !!(prof && prof.birthDate);
  const today = new Date().toISOString().slice(0, 10);
  const curYear = new Date().getUTCFullYear();
  const universalYear = reduceNumber(digitSum(String(curYear))).value;

  /* this year */
  content.appendChild(el('div', { class: 'yr-section' }, 'This year, ' + String(curYear)));
  const uy = NUM_DATA[universalYear];
  content.appendChild(numCard('Universal Year', universalYear, uy ? uy.n : 'Universal Year', uy ? uy.m : ''));
  content.appendChild(el('div', { class: 'yr-symbolic' }, 'Symbolic, Pythagorean numerology. The number everyone shares this year.'));

  if (hasBirth && prof && prof.birthDate) {
    const py = personalNumerology(prof.birthDate, today).personalYear.value;
    const pyMeaning = NUM_DATA[py];
    content.appendChild(numCard('Your Personal Year', py, pyMeaning ? pyMeaning.n : 'Personal Year', PY_ARC[py] || (pyMeaning ? pyMeaning.m : '')));
    content.appendChild(el('div', { class: 'yr-symbolic' }, 'Symbolic. Your own year within the nine year cycle, drawn from your birth date.'));

    /* fixed signature */
    content.appendChild(el('div', { class: 'yr-section' }, 'Your fixed signature, the constants'));
    const lifePath = reduceNumber(digitSum(prof.birthDate)).value;
    const lp = NUM_DATA[lifePath];
    content.appendChild(numCard('Life Path', lifePath, lp ? lp.n : 'Life Path', lp ? lp.m : ''));
    const desc = kinDescriptor(prof.birthDate);
    const kinCard = el('div', { class: 'yr-card' });
    kinCard.appendChild(el('div', { class: 'yr-num' }, String(kinForDate(prof.birthDate))));
    const kb = el('div', { class: 'yr-body' });
    kb.appendChild(el('div', { class: 'yr-label' }, 'Birth Kin, your galactic signature'));
    kb.appendChild(el('div', { class: 'yr-kin' }, desc.full + (desc.isGAP ? ' (Galactic Activation Portal)' : '')));
    kb.appendChild(el('div', { class: 'yr-symbolic' }, 'Symbolic, Dreamspell after Arguelles 1987, distinct from the ancient Maya count.'));
    kinCard.appendChild(kb);
    content.appendChild(kinCard);
  } else {
    content.appendChild(el('div', { class: 'yr-empty' }, 'Add your birth date on the home, through Make it yours, and your personal year and fixed signature appear here alongside the universal year.'));
  }

  /* save and share */
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
