/*
 * CDP Vessel, surface layer: the tiers panel.
 *
 * A full surface, modelled on the guide, that shows the five tiers, marks the
 * one the person is reading through, and lets them choose any depth and read
 * today through it during the founding beta. Choosing a tier persists it; the
 * next reading, and any reading opened from here, uses it. Pricing is shown so
 * the structure is visible before the gate goes live.
 *
 * House style holds: no em dashes, no en dashes, no exclamation marks.
 */

import { TIERS, getTier, setTier, type TierId } from '../data/tier';

export interface TiersHandle {
  close(): void;
}

export interface OpenTiersOptions {
  /** The surface element to mount into. */
  container: HTMLElement;
  /** The tier currently selected, used to mark the panel on open. */
  current: TierId;
  /** Fired when a tier is chosen as the reading depth. */
  onSelect?: (t: TierId) => void;
  /** Fired when the person asks to read today through a tier. */
  onRead?: (t: TierId) => void;
  onClose?: () => void;
}

type Attrs = Record<string, string>;
function el(tag: string, attrs: Attrs = {}, text?: string): HTMLElement {
  const node = document.createElement(tag);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  if (text !== undefined) node.textContent = text;
  return node;
}

const STYLE_ID = 'cdp-tiers-style';
function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const css = [
    '.cdp-surface .tr-view{position:fixed;inset:0;top:58px;z-index:62;background:var(--page,#031831);overflow-y:auto;padding:22px 18px 64px}',
    '.cdp-surface .tr-shell{max-width:44rem;margin:0 auto}',
    '.cdp-surface .tr-bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}',
    '.cdp-surface .tr-title{font-family:Cinzel,Georgia,serif;font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold,#C9A050)}',
    '.cdp-surface .tr-close{background:none;border:1px solid var(--gold-line,#3A3320);color:var(--text-light,#F0E6CC);font-size:20px;line-height:1;cursor:pointer;width:34px;height:34px;border-radius:50%;flex:0 0 auto}',
    '.cdp-surface .tr-close:hover{border-color:var(--gold,#C9A050);color:var(--gold,#C9A050)}',
    '.cdp-surface .tr-sub{font-family:\'EB Garamond\',Georgia,serif;font-size:16px;line-height:1.5;color:var(--text-muted,#D4C8AE);margin:6px 0 20px}',
    '.cdp-surface .tr-card{border:1px solid var(--gold-line,#3A3320);border-radius:5px;background:var(--navy,#0D1E33);padding:15px 16px;margin-bottom:12px}',
    '.cdp-surface .tr-card.on{border-color:var(--gold,#C9A050);box-shadow:0 0 0 1px var(--gold,#C9A050) inset}',
    '.cdp-surface .tr-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px}',
    '.cdp-surface .tr-name{font-family:Cinzel,Georgia,serif;font-size:14px;letter-spacing:.1em;text-transform:uppercase;color:var(--text-light,#F0E6CC)}',
    '.cdp-surface .tr-price{font-family:\'EB Garamond\',Georgia,serif;font-size:15px;color:var(--gold-soft,#E8C878)}',
    '.cdp-surface .tr-blurb{font-family:\'EB Garamond\',Georgia,serif;font-size:16px;line-height:1.5;color:var(--text-light,#F0E6CC);margin:8px 0 12px}',
    '.cdp-surface .tr-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}',
    '.cdp-surface .tr-btn{background:none;border:1px solid var(--gold-line,#3A3320);color:var(--gold,#C9A050);font-family:\'EB Garamond\',Georgia,serif;font-size:13px;letter-spacing:.06em;padding:7px 13px;border-radius:3px;cursor:pointer}',
    '.cdp-surface .tr-btn:hover{border-color:var(--gold,#C9A050)}',
    '.cdp-surface .tr-current{font-family:\'EB Garamond\',Georgia,serif;font-size:13px;color:var(--teal,#81CDB6)}',
    '.cdp-surface .tr-note{font-family:\'EB Garamond\',Georgia,serif;font-size:14px;line-height:1.55;color:var(--text-muted,#D4C8AE);margin-top:14px;padding-top:14px;border-top:1px solid var(--gold-line,#3A3320)}',
  ].join('');
  const tag = el('style', { id: STYLE_ID });
  tag.textContent = css;
  document.head.appendChild(tag);
}

export function openTiers(o: OpenTiersOptions): TiersHandle {
  ensureStyle();
  let selected: TierId = o.current;

  const view = el('div', { class: 'tr-view', role: 'dialog', 'aria-label': 'Tiers and reading depth' });
  const shell = el('div', { class: 'tr-shell' });

  const bar = el('div', { class: 'tr-bar' });
  bar.appendChild(el('div', { class: 'tr-title' }, 'Tiers'));
  const closeBtn = el('button', { type: 'button', class: 'tr-close', 'aria-label': 'Close' }, '\u00d7');
  closeBtn.addEventListener('click', () => { close(); });
  bar.appendChild(closeBtn);
  shell.appendChild(bar);

  shell.appendChild(el('div', { class: 'tr-sub' }, 'During the founding beta every tier is open. Choose a depth and read today through it. Pricing is shown so you can see the structure, and the gate goes live at launch.'));

  const cards: { id: TierId; card: HTMLElement; mark: HTMLElement }[] = [];

  function refreshMarks(): void {
    for (const c of cards) {
      if (c.id === selected) { c.card.classList.add('on'); c.mark.textContent = 'Your current depth'; }
      else { c.card.classList.remove('on'); c.mark.textContent = ''; }
    }
  }

  for (const t of TIERS) {
    const card = el('div', { class: 'tr-card' });
    const head = el('div', { class: 'tr-head' });
    head.appendChild(el('div', { class: 'tr-name' }, t.label));
    head.appendChild(el('div', { class: 'tr-price' }, t.price));
    card.appendChild(head);
    card.appendChild(el('div', { class: 'tr-blurb' }, t.blurb));

    const actions = el('div', { class: 'tr-actions' });
    const chooseBtn = el('button', { type: 'button', class: 'tr-btn' }, 'Choose this depth');
    chooseBtn.addEventListener('click', () => {
      selected = t.id;
      setTier(t.id);
      refreshMarks();
      if (o.onSelect) o.onSelect(t.id);
    });
    actions.appendChild(chooseBtn);

    const readBtn = el('button', { type: 'button', class: 'tr-btn' }, 'Read today at this depth');
    readBtn.addEventListener('click', () => {
      selected = t.id;
      setTier(t.id);
      if (o.onRead) o.onRead(t.id);
    });
    actions.appendChild(readBtn);

    const mark = el('span', { class: 'tr-current' }, '');
    actions.appendChild(mark);
    card.appendChild(actions);

    shell.appendChild(card);
    cards.push({ id: t.id, card, mark });
  }

  shell.appendChild(el('div', { class: 'tr-note' }, 'Only the daily reading changes with depth today. Card, year, and compatibility deepen with tier in a later pass, so they will follow your chosen depth too.'));

  refreshMarks();
  view.appendChild(shell);
  o.container.appendChild(view);

  let closed = false;
  function close(): void {
    if (closed) return;
    closed = true;
    if (view.parentNode) view.parentNode.removeChild(view);
    if (o.onClose) o.onClose();
  }

  return { close };
}
