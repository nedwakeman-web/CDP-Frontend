/**
 * CDP Vessel, surface layer: share and save.
 *
 * One small control, used on every surface that produces something worth
 * keeping. Copy puts the plain text on the clipboard. Share hands it to the
 * device's own share sheet where the browser supports it, and falls back to
 * copy where it does not. Save as PDF prints just the content through a hidden
 * frame, so the person uses the browser's own Save as PDF with no extra
 * dependency and no second page. Image capture, which needs a heavier library,
 * is deliberately left for a later pass so one library choice does not hold up
 * the rest.
 *
 * House style holds here, in code, comments, and visible strings alike: no em
 * dashes, no en dashes, no exclamation marks, and no spaced hyphen patterns.
 */

export interface ShareTarget {
  /** A short title for the share sheet and the printed page. */
  title: string;
  /** Plain text rendering of the content, read at the moment of action. */
  text: () => string;
  /** The element to print, read at the moment of action so it is current. */
  node: () => HTMLElement | null;
}

type Attrs = Record<string, string>;
function el(tag: string, attrs: Attrs = {}, text?: string): HTMLElement {
  const node = document.createElement(tag);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  if (text !== undefined) node.textContent = text;
  return node;
}

const STYLE_ID = 'cdp-share-style';
function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const css = [
    '.cdp-surface .share-bar{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0 4px}',
    '.cdp-surface .share-btn{background:none;border:1px solid var(--gold-line,#3A3320);color:var(--gold,#C9A050);font-family:\'EB Garamond\',Georgia,serif;font-size:12px;letter-spacing:.1em;text-transform:uppercase;padding:7px 13px;border-radius:2px;cursor:pointer}',
    '.cdp-surface .share-btn:hover{border-color:var(--gold,#C9A050)}',
  ].join('');
  const style = el('style', { id: STYLE_ID });
  style.textContent = css;
  document.head.appendChild(style);
}

/** Minimal print stylesheet, paper-friendly, with the controls hidden. */
const PRINT_CSS = [
  '*{box-sizing:border-box}',
  'body{font-family:Georgia,\'Times New Roman\',serif;color:#1A1A1A;margin:26px;line-height:1.65}',
  'h1,h2,h3{font-family:Georgia,serif}',
  '.rdg-title,.cv-bd-rank,.cv-bd-also,.pf-section{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#6B5A2A}',
  '.rdg-headline,.cv-bd-head{font-size:20px;margin:0 0 16px}',
  '.rdg-p,.cv-bd-reason,.pf-born{font-size:13px;margin:0 0 10px}',
  '.rdg-closing{font-style:italic;margin-top:16px}',
  '.rdg-card,.cv-bd-card,.pf-card{border:1px solid #DDD;border-radius:4px;padding:10px 12px;margin-bottom:10px}',
  '.cv-bd-caution{font-style:italic;color:#6B5A2A}',
  '.rdg-caret,.cv-bd-open,.cv-bd-more,.pf-read,.pf-remove,.share-bar,button{display:none}',
].join('');

function printNode(node: HTMLElement, title: string): void {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  document.body.appendChild(frame);
  const doc = frame.contentWindow && frame.contentWindow.document;
  if (!doc) { document.body.removeChild(frame); return; }
  const safeTitle = String(title || 'Cosmic Daily Planner').replace(/</g, '').replace(/>/g, '');
  doc.open();
  doc.write('<html><head><title>' + safeTitle + '</title><meta charset="utf-8"><style>' + PRINT_CSS + '</style></head><body><h1>' + safeTitle + '</h1>' + node.innerHTML + '</body></html>');
  doc.close();
  const w = frame.contentWindow;
  if (!w) { document.body.removeChild(frame); return; }
  window.setTimeout(() => {
    try { w.focus(); w.print(); } catch (_e) { /* user may cancel */ }
    window.setTimeout(() => { if (frame.parentNode) frame.parentNode.removeChild(frame); }, 800);
  }, 300);
}

function flash(btn: HTMLElement, label: string): void {
  const prev = btn.textContent || '';
  btn.textContent = label;
  window.setTimeout(() => { btn.textContent = prev; }, 1600);
}

/** Build the share control for a target. Returns a row to drop into a surface. */
export function shareControls(t: ShareTarget): HTMLElement {
  ensureStyle();
  const bar = el('div', { class: 'share-bar' });

  const copyBtn = el('button', { type: 'button', class: 'share-btn' }, 'Copy');
  copyBtn.addEventListener('click', () => {
    const text = t.text();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => flash(copyBtn, 'Copied')).catch(() => flash(copyBtn, 'Press and hold to copy'));
    } else {
      flash(copyBtn, 'Press and hold to copy');
    }
  });
  bar.appendChild(copyBtn);

  const nav = navigator as Navigator & { share?: (data: { title?: string; text?: string }) => Promise<void> };
  if (typeof nav.share === 'function') {
    const shareBtn = el('button', { type: 'button', class: 'share-btn' }, 'Share');
    shareBtn.addEventListener('click', () => {
      nav.share!({ title: t.title, text: t.text() }).catch(() => { /* cancelled or unsupported, no action */ });
    });
    bar.appendChild(shareBtn);
  }

  const pdfBtn = el('button', { type: 'button', class: 'share-btn' }, 'Save as PDF');
  pdfBtn.addEventListener('click', () => {
    const node = t.node();
    if (node) printNode(node, t.title);
  });
  bar.appendChild(pdfBtn);

  return bar;
}
