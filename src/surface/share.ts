/*
 * CDP Vessel, surface layer: share and save.
 *
 * One control, on every surface that produces something worth keeping. Before
 * anything leaves, the content is cleaned of interface chrome, the cues, taps,
 * bridges, buttons, and navigation, so a share never carries labels like "this
 * landed" or "open this day". Copy puts clean text on the clipboard. Share hands
 * clean text to the device share sheet. Save as image renders a branded card and
 * downloads it. Save as PDF prints the cleaned content through a hidden frame.
 *
 * House style holds in code, comments, and visible strings: no em dashes, no en
 * dashes, no exclamation marks, no spaced hyphen patterns.
 */

export interface ShareTarget {
  /** A short title for the share sheet, the image, and the printed page. */
  title: string;
  /** Plain text fallback, used only when no node is available. */
  text: () => string;
  /** The element to share, read at the moment of action so it is current. */
  node: () => HTMLElement | null;
}

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
  '.share-bar', '.yr-nav', '.cal-tabs', '.cal-legend', '.cal-wd', '.cal-grid', '.cal-bd', '.cal-nav',
  '[class*="cue"]', '[class*="bridge"]', '[class*="-tap"]', '[class*="-ask"]', '[class*="tapdot"]', '[class*="taplabel"]',
].join(',');

function cleanClone(node: HTMLElement | null): HTMLElement | null {
  if (!node) return null;
  const clone = node.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(CHROME_SELECTOR).forEach((n) => { if (n.parentNode) n.parentNode.removeChild(n); });
  return clone;
}

/*
 * Structural text extraction. innerText needs layout, so on a detached clone it
 * returns empty and the old path fell back to textContent, which concatenated
 * every field with no separator (the "Day energy7 ... Yellow SunYour day1" jam).
 * This walks the tree instead: block elements break onto their own line, and a
 * label element is joined to the value beside it as "Label: value", so a shared
 * or saved artefact reads as clean prose without depending on layout.
 */
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

function cleanText(t: ShareTarget): string {
  const clone = cleanClone(t.node());
  const body = clone ? domToText(clone) : t.text();
  return t.title + '\n\n' + body;
}

const STYLE_ID = 'cdp-share-style';
function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const css = [
    '.cdp-surface .share-bar{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0 4px}',
    '.cdp-surface .share-btn{background:none;border:1px solid var(--gold-line,#3A3320);color:var(--gold,#C9A050);font-family:\'EB Garamond\',Georgia,serif;font-size:12px;letter-spacing:.1em;text-transform:uppercase;padding:7px 13px;border-radius:2px;cursor:pointer}',
    '.cdp-surface .share-btn:hover{border-color:var(--gold,#C9A050)}',
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

/* A branded share card, dark ground and gold, rendered to PNG with no library. */
function saveAsImage(title: string, body: string, filename: string): void {
  const W = 760;
  const padX = 48;
  const lines: Array<{ text: string; kind: 'h' | 'b' }> = [];
  lines.push({ text: title, kind: 'h' });
  for (const raw of body.split('\n')) {
    const ln = raw.trim();
    if (!ln) { lines.push({ text: '', kind: 'b' }); continue; }
    for (const w of wrap(ln, 56)) lines.push({ text: w, kind: 'b' });
  }
  let y = 96;
  const rows: string[] = [];
  for (const l of lines) {
    if (l.kind === 'h') {
      rows.push('<text x="' + padX + '" y="' + y + '" font-family="Georgia, serif" font-size="30" fill="#E8C878">' + xmlEscape(l.text) + '</text>');
      y += 26;
    } else if (l.text === '') {
      y += 12;
    } else {
      rows.push('<text x="' + padX + '" y="' + y + '" font-family="Georgia, serif" font-size="16" fill="#F0E6CC">' + xmlEscape(l.text) + '</text>');
      y += 27;
    }
  }
  const H = y + 56;
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">'
    + '<rect width="' + W + '" height="' + H + '" fill="#0A1828"/>'
    + '<rect width="' + W + '" height="4" fill="#C9A050"/>'
    + rows.join('')
    + '<text x="' + padX + '" y="' + (H-26) + '" font-family="Georgia, serif" font-size="12" letter-spacing="2" fill="#9E8A55">COSMIC DAILY PLANNER</text>'
    + '</svg>';
  const scale = 2;
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = W * scale;
    canvas.height = H * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename + '.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.setTimeout(() => URL.revokeObjectURL(url), 1200);
    }, 'image/png');
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function flash(btn: HTMLElement, label: string): void {
  const prev = btn.textContent || '';
  btn.textContent = label;
  window.setTimeout(() => { btn.textContent = prev; }, 1600);
}

function slug(s: string): string {
  return (s || 'cosmic-daily-planner').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'cosmic-daily-planner';
}

/** Build the share control for a target. Returns a row to drop into a surface. */
const CHROME_IMG = ['button', '.share-bar', '[class*="cue"]', '[class*="bridge"]', '[class*="-tap"]'];
function isChromeEl(elm: Element): boolean {
  for (const sel of CHROME_IMG) { try { if (elm.matches(sel)) return true; } catch (_e) { /* ignore bad selector */ } }
  return false;
}
function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}
/*
 * Save a designed image. When html2canvas is present on the page, snapshot the
 * real styled card so the image looks like the product, skipping the chrome
 * (buttons, cues, bridges, landed taps). When it is absent, fall back to the
 * self-contained text card so the action always works.
 */
async function saveNodeImage(node: HTMLElement | null, title: string, body: string, filename: string): Promise<void> {
  const h2c = (window as unknown as { html2canvas?: (el: HTMLElement, opts?: Record<string, unknown>) => Promise<HTMLCanvasElement> }).html2canvas;
  if (h2c && node) {
    try {
      const canvas = await h2c(node, { backgroundColor: '#0D1E33', scale: 2, useCORS: true, logging: false, ignoreElements: (elm: Element) => isChromeEl(elm) });
      const blob: Blob | null = await new Promise((resolve) => { canvas.toBlob((b) => resolve(b), 'image/png'); });
      if (!blob) { saveAsImage(title, body, filename); return; }
      const w = window as unknown as { ClipboardItem?: new (items: Record<string, Blob>) => unknown };
      const nav2 = navigator as Navigator & { clipboard?: { write?: (items: unknown[]) => Promise<void> } };
      if (w.ClipboardItem && nav2.clipboard && nav2.clipboard.write) {
        try { await nav2.clipboard.write([new w.ClipboardItem({ 'image/png': blob })]); return; }
        catch (_e) { downloadBlob(blob, filename + '.png'); return; }
      }
      downloadBlob(blob, filename + '.png');
      return;
    } catch (_e) { /* fall through to the text card */ }
  }
  saveAsImage(title, body, filename);
}

export function shareControls(t: ShareTarget): HTMLElement {
  ensureStyle();
  const bar = el('div', { class: 'share-bar' });

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

  const nav = navigator as Navigator & { share?: (data: { title?: string; text?: string }) => Promise<void> };
  if (typeof nav.share === 'function') {
    const shareBtn = el('button', { type: 'button', class: 'share-btn' }, 'Share');
    shareBtn.addEventListener('click', () => {
      nav.share!({ title: t.title, text: cleanText(t) }).catch(() => { /* cancelled or unsupported, no action */ });
    });
    bar.appendChild(shareBtn);
  }

  const imgBtn = el('button', { type: 'button', class: 'share-btn' }, 'Save as image');
  imgBtn.addEventListener('click', () => {
    const node = t.node();
    const clone = cleanClone(node);
    const body = clone ? domToText(clone) : t.text();
    saveNodeImage(node, t.title, body, slug(t.title))
      .then(() => flash(imgBtn, 'Saved'))
      .catch(() => flash(imgBtn, 'Could not save'));
  });
  bar.appendChild(imgBtn);

  const pdfBtn = el('button', { type: 'button', class: 'share-btn' }, 'Save as PDF');
  pdfBtn.addEventListener('click', () => {
    const clone = cleanClone(t.node());
    if (clone) printNode(clone, t.title);
  });
  bar.appendChild(pdfBtn);

  return bar;
}
