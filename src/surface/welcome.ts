/*
 * CDP Vessel, surface layer: the returning welcome.
 *
 * Shown once, to someone who has read here before, the first time they meet the
 * new home. It names what changed in a sentence and offers the tour, then steps
 * out of the way. A brand new visitor does not see it; the calm home greets them
 * with nothing to dismiss. Taking the tour and settling in both mark it seen, so
 * it never returns.
 *
 * House style holds: no em dashes, no en dashes, no exclamation marks.
 */

export interface WelcomeOptions {
  /** True when the person has read here before. A new visitor passes false. */
  hasHistory: boolean;
  /** Opens the guide. Wired by the host to its own guide surface. */
  onTour: () => void;
}

const SEEN_KEY = 'cdp-welcome-seen-v1';

type Attrs = Record<string, string>;
function el(tag: string, attrs: Attrs = {}, text?: string): HTMLElement {
  const node = document.createElement(tag);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  if (text !== undefined) node.textContent = text;
  return node;
}

const STYLE_ID = 'cdp-welcome-style';
function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const css = [
    '.cdp-surface .wc-banner{width:100%;max-width:600px;margin:0 auto 20px;border:1px solid var(--gold-line,#3A3320);border-radius:5px;background:var(--navy,#0D1E33);padding:16px 18px;text-align:left;display:flex;flex-direction:column;gap:12px}',
    '.cdp-surface .wc-h{font-family:Cinzel,Georgia,serif;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold,#C9A050)}',
    '.cdp-surface .wc-p{font-family:\'EB Garamond\',Georgia,serif;font-size:16px;line-height:1.5;color:var(--text-light,#F0E6CC)}',
    '.cdp-surface .wc-actions{display:flex;gap:8px;flex-wrap:wrap}',
    '.cdp-surface .wc-btn{background:none;border:1px solid var(--gold-line,#3A3320);color:var(--gold,#C9A050);font-family:\'EB Garamond\',Georgia,serif;font-size:14px;letter-spacing:.04em;padding:8px 15px;border-radius:3px;cursor:pointer}',
    '.cdp-surface .wc-btn:hover{border-color:var(--gold,#C9A050)}',
    '.cdp-surface .wc-dismiss{color:var(--text-muted,#D4C8AE)}',
  ].join('');
  const tag = el('style', { id: STYLE_ID });
  tag.textContent = css;
  document.head.appendChild(tag);
}

function markSeen(): void {
  try { localStorage.setItem(SEEN_KEY, '1'); } catch (_e) { /* storage unavailable */ }
}

/** Returns the welcome banner, or null when it should not show. */
export function mountWelcome(o: WelcomeOptions): HTMLElement | null {
  if (!o.hasHistory) return null;
  let seen = false;
  try { seen = localStorage.getItem(SEEN_KEY) === '1'; } catch (_e) { seen = false; }
  if (seen) return null;

  ensureStyle();
  const banner = el('div', { class: 'wc-banner', role: 'status' });
  banner.appendChild(el('div', { class: 'wc-h' }, 'Welcome back'));
  banner.appendChild(el('div', { class: 'wc-p' }, 'This is the new home for your daily reading, steadier and clearer than before. The same sky, a refined instrument. A short tour shows what has moved and where things now live.'));

  const actions = el('div', { class: 'wc-actions' });

  function close(): void { if (banner.parentNode) banner.parentNode.removeChild(banner); }

  const tourBtn = el('button', { type: 'button', class: 'wc-btn' }, 'Take the tour');
  tourBtn.addEventListener('click', () => { markSeen(); close(); o.onTour(); });
  actions.appendChild(tourBtn);

  const settleBtn = el('button', { type: 'button', class: 'wc-btn wc-dismiss' }, 'Settle in');
  settleBtn.addEventListener('click', () => { markSeen(); close(); });
  actions.appendChild(settleBtn);

  banner.appendChild(actions);
  return banner;
}
