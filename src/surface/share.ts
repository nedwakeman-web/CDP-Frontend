/*
 * CDP Vessel, surface layer: share and save.
 *
 * One control, on every surface that produces something worth keeping. Before
 * anything leaves, the content is cleaned of interface chrome, the cues, taps,
 * bridges, buttons, and navigation, so a share never carries labels like "this
 * landed" or "open this day". Copy puts clean text on the clipboard. Share hands
 * a rendered card to the device share sheet as a file where the platform allows
 * it, and falls back to text where it does not. Save as image renders a branded
 * card. Save as PDF prints the cleaned content through a hidden frame.
 *
 * This version brings the vessel to parity with the monolith Track A and adds
 * the Track B hook:
 *   1. File-based native share. navigator.share now receives the rendered PNG as
 *      a file where canShare with files is supported, not text alone.
 *   2. Three formats: square 1080, portrait 1080 by 1350, story 1080 by 1920.
 *   3. Canonical palette throughout the card.
 *   4. Optional Track B link. When a target carries a type, the share path first
 *      asks the server for a per-reading link with its own Open Graph image, so
 *      the post unfurls the card. Until a link exists, the homepage stands.
 *
 * House style holds in code, comments, and visible strings: no em dashes, no en
 * dashes, no exclamation marks, no spaced hyphen patterns.
 */

export type ShareFormat = 'square' | 'portrait' | 'story';

export interface ShareTarget {
  /** A short title for the share sheet, the image, and the printed page. */
  title: string;
  /** Plain text fallback, used only when no node is available. */
  text: () => string;
  /** The element to share, read at the moment of action so it is current. */
  node: () => HTMLElement | null;
  /** Optional. When set, the share path can mint a Track B link of this type so
   *  the post unfurls a per-reading card. One of daily, year, compatibility,
   *  response. */
  type?: 'daily' | 'year' | 'compatibility' | 'response';
  /** Optional one-line description for the unfurl card. */
  description?: string;
  /** Optional voice tag carried on the link. */
  voice?: string;
}

const HOMEPAGE = 'https://cosmicdailyplanner.com';

const FORMATS: Record<ShareFormat, { w: number; h: number }> = {
  square: { w: 1080, h: 1080 },
  portrait: { w: 1080, h: 1350 },
  story: { w: 1080, h: 1920 },
};

type Attrs = Record<string, string>;
function el(tag: string, attrs: Attrs = {}, text?: string): HTMLElement {
  const node = document.createElement(tag);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  if (text !== undefined) node.textContent = text;
  return node;
}

/* Interface chrome that must never appear in a shared or saved artefact. */
const CHROME_SELECTOR = [
  'button', 'input', 'select', 'textarea',
  '.share-bar', '.yr-nav', '.cal-tabs', '.cal-legend', '.cal-wd', '.cal-grid', '.cal-bd', '.cal-nav', '.att-confirm',
  '[class*="cue"]', '[class*="bridge"]', '[class*="-tap"]', '[class*="-ask"]', '[class*="tapdot"]', '[class*="taplabel"]',
].join(',');

function cleanClone(node: HTMLElement | null): HTMLElement | null {
  if (!node) return null;
  const clone = node.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(CHROME_SELECTOR).forEach((n) => { if (n.parentNode) n.parentNode.removeChild(n); });
  return clone;
}

const BLOCK_TAGS = new Set([
  'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DETAILS', 'DIV', 'DL', 'DT', 'DD',
  'FIELDSET', 'FIGCAPTION', 'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'HEADER', 'HR', 'LI', 'MAIN', 'NAV', 'OL', 'P', 'PRE', 'SECTION', 'TABLE', 'TR', 'UL',
]);
function isLabelEl(elx: Element): boolean {
  const c = (elx.getAttribute('class') || '').toLowerCase();
  if (!c) return false;
  if (c.indexOf('label') >= 0) return true;
  return /(^|\s)([a-z0-9-]*-l)(\s|$)/.test(c)
    || /(win-tag|coord-l|energy-layer|seclabel|emergent-l|signal-l|bio-l|cite-tag|bdr-rank)/.test(c);
}
function domToText(node: HTMLElement | null): string {
  if (!node) return '';
  const parts: string[] = [];
  function walk(n: Node): void {
    if (n.nodeType === 3) {
      const t = (n.nodeValue || '').replace(/\s+/g, ' ');
      if (t.trim()) parts.push(t);
      return;
    }
    if (n.nodeType !== 1) return;
    const elx = n as Element;
    const tag = elx.tagName;
    if (tag === 'BR') { parts.push('\n'); return; }
    const block = BLOCK_TAGS.has(tag);
    if (block) parts.push('\n');
    if (isLabelEl(elx)) {
      const lab = (elx.textContent || '').replace(/\s+/g, ' ').trim();
      if (lab) { parts.push(lab + ': '); return; }
    }
    for (let i = 0; i < n.childNodes.length; i++) walk(n.childNodes[i]);
    if (block) parts.push('\n');
  }
  walk(node);
  return parts.join('')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/:\s*\n/g, ': ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function bodyTextOf(t: ShareTarget): string {
  const clone = cleanClone(t.node());
  return clone ? domToText(clone) : t.text();
}

function cleanText(t: ShareTarget): string {
  return t.title + '\n\n' + bodyTextOf(t);
}

const STYLE_ID = 'cdp-share-style';
function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const css = [
    '.cdp-surface .share-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:16px 0 4px}',
    '.cdp-surface .share-btn{background:none;border:1px solid var(--gold-line,#3A3320);color:var(--gold,#C9A050);font-family:\'EB Garamond\',Georgia,serif;font-size:12px;letter-spacing:.1em;text-transform:uppercase;padding:7px 13px;border-radius:2px;cursor:pointer}',
    '.cdp-surface .share-btn:hover{border-color:var(--gold,#C9A050)}',
    '.cdp-surface .share-fmt{display:flex;gap:6px;margin-left:auto}',
    '.cdp-surface .share-fmt button{background:none;border:1px solid var(--gold-line,#3A3320);color:var(--text-dim,#D4C8AE);font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:.06em;padding:6px 10px;border-radius:2px;cursor:pointer}',
    '.cdp-surface .share-fmt button.on{border-color:var(--gold,#C9A050);color:var(--gold,#C9A050)}',
  ].join('');
  const style = el('style', { id: STYLE_ID });
  style.textContent = css;
  document.head.appendChild(style);
}

/* Branded print stylesheet, paper friendly, the cleaned content only. */
const PRINT_CSS = [
  '*{box-sizing:border-box}',
  'body{font-family:Georgia,\'Times New Roman\',serif;color:#1A1A1A;margin:30px;line-height:1.7;max-width:720px}',
  'h1{font-family:Georgia,serif;color:#2C3E5A;font-size:26px;border-bottom:2px solid #B8942A;padding-bottom:10px;margin:0 0 20px}',
  'h2,h3{font-family:Georgia,serif;color:#2C3E5A}',
  '.cal-det-date,.rdg-headline,.cv-bd-head,.yr-mv-title{font-size:19px;color:#2C3E5A;margin:0 0 12px}',
  '.cal-det-label,.rdg-title,.yr-section,.pf-section{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#8A6D2A}',
  '.cal-det-row{padding:6px 0;border-top:1px solid #E2DAC8}',
  'p,.rdg-p,.cal-det-val,.yr-desc{font-size:13px;margin:0 0 10px}',
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

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function wrap(line: string, max: number): string[] {
  if (line.length <= max) return [line];
  const words = line.split(' ');
  const out: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max) { if (cur) out.push(cur); cur = w; }
    else cur = (cur + ' ' + w).trim();
  }
  if (cur) out.push(cur);
  return out;
}

/*
 * The branded card, dark ground and gold, rendered to PNG at one of the three
 * social formats with no library. The body is wrapped and laid out from a top
 * offset; if it overflows the fixed height it is clipped to the lines that fit
 * and the last line gets an ellipsis, since a share card is a teaser, not the
 * whole reading. The palette is canonical.
 */
function renderCardSVG(title: string, body: string, format: ShareFormat): string {
  const dim = FORMATS[format];
  const W = dim.w;
  const H = dim.h;
  const padX = 84;
  const titleSize = 52;
  const bodySize = 32;
  const bodyLead = 46;
  const charsPerLine = Math.floor((W - padX * 2) / (bodySize * 0.5));

  const titleLines = wrap(title, Math.floor((W - padX * 2) / (titleSize * 0.52)));
  const rows: string[] = [];
  let y = 150;
  for (const tl of titleLines) {
    rows.push('<text x="' + padX + '" y="' + y + '" font-family="Georgia, serif" font-size="' + titleSize + '" fill="#E8C878">' + xmlEscape(tl) + '</text>');
    y += titleSize + 10;
  }
  y += 24;

  const footerY = H - 90;
  const maxY = footerY - bodyLead;
  const bodyLines: string[] = [];
  for (const raw of body.split('\n')) {
    const ln = raw.trim();
    if (!ln) { bodyLines.push(''); continue; }
    for (const w of wrap(ln, charsPerLine)) bodyLines.push(w);
  }
  for (let i = 0; i < bodyLines.length; i++) {
    const l = bodyLines[i];
    if (l === '') { y += Math.round(bodyLead * 0.5); continue; }
    if (y > maxY) {
      const last = rows.length ? rows[rows.length - 1] : '';
      void last;
      rows.push('<text x="' + padX + '" y="' + y + '" font-family="Georgia, serif" font-size="' + bodySize + '" fill="#F0E6CC">' + xmlEscape(wrap(l, charsPerLine - 1)[0] + '\u2026') + '</text>');
      break;
    }
    rows.push('<text x="' + padX + '" y="' + y + '" font-family="Georgia, serif" font-size="' + bodySize + '" fill="#F0E6CC">' + xmlEscape(l) + '</text>');
    y += bodyLead;
  }

  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">'
    + '<rect width="' + W + '" height="' + H + '" fill="#031831"/>'
    + '<rect width="' + W + '" height="6" fill="#C9A050"/>'
    + rows.join('')
    + '<text x="' + padX + '" y="' + footerY + '" font-family="Georgia, serif" font-size="22" letter-spacing="3" fill="#9E8A55">COSMIC DAILY PLANNER</text>'
    + '<text x="' + padX + '" y="' + (footerY + 34) + '" font-family="Georgia, serif" font-size="20" fill="#81CDB6">Two telescopes, one sky.</text>'
    + '</svg>';
}

function svgToPngBlob(svg: string, w: number, h: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = 1;
      const canvas = document.createElement('canvas');
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(null); return; }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    };
    img.onerror = () => resolve(null);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

/** Render the branded card to a PNG blob at the chosen format. */
export function renderToBlob(t: ShareTarget, format: ShareFormat = 'portrait'): Promise<Blob | null> {
  const dim = FORMATS[format];
  const svg = renderCardSVG(t.title, bodyTextOf(t), format);
  return svgToPngBlob(svg, dim.w, dim.h);
}

function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function flash(btn: HTMLElement, label: string): void {
  const prev = btn.textContent || '';
  btn.textContent = label;
  window.setTimeout(() => { btn.textContent = prev; }, 1600);
}

function slug(s: string): string {
  return (s || 'cosmic-daily-planner').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'cosmic-daily-planner';
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || '').split(',')[1] || '');
    r.onerror = () => reject(new Error('read_failed'));
    r.readAsDataURL(blob);
  });
}

/*
 * Track B. Ask the server for a per-reading link whose Open Graph image is this
 * card, so a post on X, LinkedIn, Facebook, or WhatsApp unfurls it. Best effort:
 * any failure returns null and the caller shares the homepage instead, which is
 * the prior behaviour. The endpoint is the one cdp-share-server.js mounts.
 */
async function createShareLink(t: ShareTarget, blob: Blob, format: ShareFormat): Promise<string | null> {
  if (!t.type) return null;
  const dim = FORMATS[format];
  try {
    const imageBase64 = await blobToBase64(blob);
    if (!imageBase64) return null;
    const res = await fetch('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: t.type,
        title: t.title,
        description: t.description || 'Spiritual tradition and neuroscience, arriving at the same coordinates.',
        voice: t.voice || '',
        imageBase64: 'data:image/png;base64,' + imageBase64,
        w: dim.w,
        h: dim.h,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { url?: string };
    return data && typeof data.url === 'string' && data.url ? data.url : null;
  } catch (_e) {
    return null;
  }
}

interface NavigatorShare {
  share?: (data: { title?: string; text?: string; url?: string; files?: File[] }) => Promise<void>;
  canShare?: (data: { files?: File[] }) => boolean;
}

/*
 * The main share path. Render the card, mint a Track B link when the target
 * supports it, then hand the share sheet the PNG as a file where the platform
 * allows it. Fall back to a text and link share, then to a download, so the
 * action always does something and never breaks.
 */
async function shareTarget(t: ShareTarget, format: ShareFormat): Promise<void> {
  const blob = await renderToBlob(t, format);
  let url = HOMEPAGE;
  if (blob) {
    const link = await createShareLink(t, blob, format);
    if (link) url = link;
  }
  const nav = navigator as Navigator & NavigatorShare;
  const text = cleanText(t);

  if (blob && typeof nav.share === 'function') {
    const file = new File([blob], slug(t.title) + '.png', { type: 'image/png' });
    if (nav.canShare && nav.canShare({ files: [file] })) {
      try { await nav.share({ title: t.title, text: text, url: url, files: [file] }); return; }
      catch (_e) { /* cancelled or unsupported, fall through */ }
    }
    try { await nav.share({ title: t.title, text: text, url: url }); return; }
    catch (_e) { /* cancelled, fall through to download */ }
  }
  if (blob) { downloadBlob(blob, slug(t.title) + '.png'); return; }
}

/** Build the share control bar for a target. Returns a row to drop into a surface. */
export function shareControls(t: ShareTarget): HTMLElement {
  ensureStyle();
  const bar = el('div', { class: 'share-bar' });
  let format: ShareFormat = 'portrait';

  const copyBtn = el('button', { type: 'button', class: 'share-btn' }, 'Copy');
  copyBtn.addEventListener('click', () => {
    const text = cleanText(t);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => flash(copyBtn, 'Copied')).catch(() => flash(copyBtn, 'Press and hold to copy'));
    } else {
      flash(copyBtn, 'Press and hold to copy');
    }
  });
  bar.appendChild(copyBtn);

  const shareBtn = el('button', { type: 'button', class: 'share-btn' }, 'Share');
  shareBtn.addEventListener('click', () => {
    shareTarget(t, format).then(() => flash(shareBtn, 'Shared')).catch(() => { /* cancelled */ });
  });
  bar.appendChild(shareBtn);

  const imgBtn = el('button', { type: 'button', class: 'share-btn' }, 'Save as image');
  imgBtn.addEventListener('click', () => {
    renderToBlob(t, format)
      .then((blob) => { if (blob) { downloadBlob(blob, slug(t.title) + '.png'); flash(imgBtn, 'Saved'); } else { flash(imgBtn, 'Could not save'); } })
      .catch(() => flash(imgBtn, 'Could not save'));
  });
  bar.appendChild(imgBtn);

  const pdfBtn = el('button', { type: 'button', class: 'share-btn' }, 'Save as PDF');
  pdfBtn.addEventListener('click', () => {
    const clone = cleanClone(t.node());
    if (clone) printNode(clone, t.title);
  });
  bar.appendChild(pdfBtn);

  const fmtWrap = el('div', { class: 'share-fmt' });
  (['square', 'portrait', 'story'] as ShareFormat[]).forEach((f) => {
    const b = el('button', { type: 'button', class: f === format ? 'on' : '' }, f.charAt(0).toUpperCase() + f.slice(1));
    b.addEventListener('click', () => {
      format = f;
      Array.prototype.forEach.call(fmtWrap.children, (c) => (c as HTMLElement).classList.remove('on'));
      b.classList.add('on');
    });
    fmtWrap.appendChild(b);
  });
  bar.appendChild(fmtWrap);

  return bar;
}
