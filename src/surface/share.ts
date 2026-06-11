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
 * Changes in this version:
 *   1. ShareTarget gains an optional `cardBody` field. Callers supply a curated
 *      excerpt (kicker, synthesis paragraph, chips) for the rendered card.
 *      When absent the card falls back to the first paragraph of bodyTextOf(),
 *      which is better than the previous whole-DOM dump.
 *   2. renderCardSVG is redesigned: gold top rule, kicker label, title headline,
 *      synthesis body capped at a readable number of lines, chips row, footer.
 *      The card is a teaser, not a transcript.
 *   3. The PDF print stylesheet is rewritten to strip flex/grid layout from the
 *      reading node so pages break cleanly without white gaps.
 *   4. Copy now uses bodyTextOf on a cleanClone, which already strips chrome.
 *      For best results callers should supply t.text() returning a curated
 *      plain-text version (same pattern as cardBody for the card).
 *
 * House style holds in code, comments, and visible strings: no em dashes, no en
 * dashes, no exclamation marks, no spaced hyphen patterns.
 */

export type ShareFormat = 'square' | 'portrait' | 'story';

/** Structured content for the rendered share card. Supply this for best results.
 *  All fields are optional; the renderer degrades gracefully when they are absent. */
export interface CardBody {
  /** Short date or context line, e.g. "Thursday, 11 June 2026". */
  kicker?: string;
  /** Primary synthesis paragraph. Keep to 3 to 5 sentences max. */
  synthesis: string;
  /** Short descriptor chips, e.g. ["Universal Day 9", "Waning Crescent", "Kin 184"]. */
  chips?: string[];
  /** Voice label shown as a small pill: "Tradition", "Science", or "Everyday". */
  voice?: string;
}

export interface ShareTarget {
  /** A short title for the share sheet, the image, and the printed page. */
  title: string;
  /** Plain text fallback, used only when no node is available. */
  text: () => string;
  /** The element to share, read at the moment of action so it is current. */
  node: () => HTMLElement | null;
  /** Curated card content. When supplied, the rendered image shows this instead
   *  of a DOM text extraction. Strongly recommended for reading surfaces. */
  cardBody?: CardBody;
  /** Optional. When set, the share path can mint a Track B link of this type so
   *  the post unfurls a per-reading card. One of daily, year, compatibility,
   *  response. */
  type?: 'daily' | 'year' | 'compatibility' | 'response';
  /** Optional one-line description for the Track B unfurl card. */
  description?: string;
  /** Optional voice tag carried on the Track B link record. */
  voice?: string;
}

const HOMEPAGE = 'https://cosmicdailyplanner.com';

const FORMATS: Record<ShareFormat, { w: number; h: number }> = {
  square:   { w: 1080, h: 1080  },
  portrait: { w: 1080, h: 1350  },
  story:    { w: 1080, h: 1920  },
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

/** First paragraph of the full body text. Used as card fallback when cardBody
 *  is not supplied. Stops at the first double newline. */
function firstParagraphOf(t: ShareTarget): string {
  const full = bodyTextOf(t);
  const cut = full.indexOf('\n\n');
  return cut > 0 ? full.slice(0, cut).trim() : full.slice(0, 400).trim();
}

function cleanText(t: ShareTarget): string {
  /* For Copy, prefer the cardBody synthesis if available, falling back to the
   * first paragraph. This gives a focused, shareable excerpt rather than the
   * entire reading transcript. */
  if (t.cardBody) {
    const parts: string[] = [t.title];
    if (t.cardBody.kicker) parts.push(t.cardBody.kicker);
    parts.push(t.cardBody.synthesis);
    if (t.cardBody.chips && t.cardBody.chips.length) {
      parts.push(t.cardBody.chips.join('   .   '));
    }
    parts.push(HOMEPAGE);
    return parts.join('\n\n');
  }
  return t.title + '\n\n' + firstParagraphOf(t) + '\n\n' + HOMEPAGE;
}

/* --------------------------------------------------------------------------
 * PDF print stylesheet.
 * Strips flex/grid from the reading so sections stack vertically without the
 * white-gap problem caused by fixed heights in the app stylesheet. Georgia
 * body, Helvetica headings, neutral palette suitable for printing.
 * -------------------------------------------------------------------------- */
const PRINT_CSS = [
  '*, *::before, *::after { box-sizing: border-box; }',
  'body { font-family: Georgia, "Times New Roman", serif; color: #1A1A1A; margin: 28px 32px; line-height: 1.65; max-width: 680px; }',
  'h1 { font-family: Helvetica, Arial, sans-serif; color: #2C3E5A; font-size: 22px; border-bottom: 2px solid #B8942A; padding-bottom: 8px; margin: 0 0 18px; }',
  'h2, h3 { font-family: Helvetica, Arial, sans-serif; color: #2C3E5A; margin: 20px 0 6px; }',
  /* Strip flex and grid from every container so sections flow normally. */
  'div, section, article, aside, header, footer, main, nav { display: block !important; float: none !important; }',
  /* Remove fixed and absolute heights that cause white gaps. */
  '* { height: auto !important; min-height: 0 !important; max-height: none !important; }',
  /* Remove fixed widths so text reflows. */
  '* { width: auto !important; min-width: 0 !important; max-width: 100% !important; }',
  /* Collapse position. */
  '* { position: static !important; }',
  'p { margin: 0 0 10px; font-size: 12px; }',
  '.rdg-headline, .cv-bd-head, .yr-mv-title, .rdg-title, .yr-section, .pf-section, [class*="-head"], [class*="-title"] { font-family: Helvetica, Arial, sans-serif; font-size: 14px; font-weight: bold; color: #2C3E5A; margin: 18px 0 4px; }',
  '[class*="-label"], [class*="-l "], [class*="label"] { font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: #8A6D2A; }',
  '[class*="cite"], [class*="ref"], [class*="source"] { font-size: 10px; color: #666; font-style: italic; }',
  'a { color: inherit; text-decoration: none; }',
  /* Hide interactive chrome that has no meaning on paper. */
  'button, input, select, textarea, [class*="cue"], [class*="bridge"], [class*="-tap"], [class*="-ask"], [class*="tapdot"], [class*="taplabel"], [class*="share"], [class*="nav"], [class*="toggle"] { display: none !important; }',
  /* Avoid page breaks inside reading sections. */
  '[class*="-section"], [class*="-row"], [class*="-block"] { page-break-inside: avoid; break-inside: avoid; padding: 6px 0; border-top: 1px solid #E2DAC8; }',
].join('\n');

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

function wrapSVG(line: string, max: number): string[] {
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

/* --------------------------------------------------------------------------
 * renderCardSVG
 *
 * Renders a branded share card. When cardBody is provided it uses a structured
 * layout: voice pill, kicker, title headline, synthesis body, chips row, footer.
 * When cardBody is absent it falls back to the first paragraph of body text.
 *
 * Canonical palette: background #031831, gold #C9A050, goldSoft #E8C878,
 * textLight #F0E6CC, textDim #D4C8AE, teal #81CDB6.
 * -------------------------------------------------------------------------- */
function renderCardSVG(title: string, body: string, format: ShareFormat, cb?: CardBody): string {
  const dim = FORMATS[format];
  const W = dim.w;
  const H = dim.h;
  const padX = 80;
  const maxW = W - padX * 2;

  /* Font sizes scaled slightly per format to maximise use of space. */
  const isStory = format === 'story';
  const kickerSize = isStory ? 22 : 20;
  const titleSize  = isStory ? 58 : 52;
  const bodySize   = isStory ? 34 : 31;
  const bodyLead   = Math.round(bodySize * 1.52);
  const charsPerLine = Math.floor(maxW / (bodySize * 0.53));

  const rows: string[] = [];

  /* --- background --- */
  rows.push('<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0A1C38"/><stop offset="100%" stop-color="#06101F"/></linearGradient></defs>');
  rows.push('<rect width="' + W + '" height="' + H + '" fill="url(#bg)"/>');

  /* --- top gold rule --- */
  rows.push('<rect x="' + padX + '" y="56" width="64" height="3" fill="#C9A050"/>');

  let y = 110;

  /* --- voice pill (if cardBody supplies it) --- */
  const voiceLabel = cb ? (cb.voice || '') : '';
  if (voiceLabel) {
    const pillText = voiceLabel.toUpperCase();
    /* Approximate pill width: each char ~8px at size 16 + 24px padding */
    const pillW = pillText.length * 8 + 28;
    rows.push('<rect x="' + padX + '" y="' + y + '" width="' + pillW + '" height="26" rx="13" fill="rgba(201,160,80,0.14)"/>');
    rows.push('<text x="' + (padX + 14) + '" y="' + (y + 18) + '" font-family="Helvetica,Arial,sans-serif" font-size="15" letter-spacing="1.8" fill="#C9A050">' + xmlEscape(pillText) + '</text>');
    y += 52;
  } else {
    y += 16;
  }

  /* --- kicker --- */
  const kickerText = cb ? (cb.kicker || '') : '';
  if (kickerText) {
    rows.push('<text x="' + padX + '" y="' + y + '" font-family="Helvetica,Arial,sans-serif" font-size="' + kickerSize + '" letter-spacing="2.5" fill="rgba(201,160,80,0.75)">' + xmlEscape(kickerText.toUpperCase()) + '</text>');
    y += kickerSize + 22;
  }

  /* --- title --- */
  const titleLines = wrapSVG(title, Math.floor(maxW / (titleSize * 0.52)));
  for (let i = 0; i < Math.min(titleLines.length, 3); i++) {
    rows.push('<text x="' + padX + '" y="' + y + '" font-family="Georgia,serif" font-size="' + titleSize + '" fill="#E8C878">' + xmlEscape(titleLines[i]) + '</text>');
    y += Math.round(titleSize * 1.12);
  }
  y += 28;

  /* --- thin separator rule under title --- */
  rows.push('<rect x="' + padX + '" y="' + y + '" width="' + maxW + '" height="1" fill="rgba(201,160,80,0.22)"/>');
  y += 28;

  /* --- body synthesis --- */
  const synth = cb ? cb.synthesis : body;
  const footerReserve = 120;
  const maxBodyY = H - footerReserve;

  const rawLines: string[] = [];
  for (const raw of synth.split('\n')) {
    const ln = raw.trim();
    if (!ln) continue;
    for (const w of wrapSVG(ln, charsPerLine)) rawLines.push(w);
  }

  for (let i = 0; i < rawLines.length; i++) {
    if (y + bodyLead > maxBodyY) {
      /* Truncate at sentence boundary if possible, then append ellipsis. */
      const prev = rawLines[i - 1] || '';
      const lastStop = Math.max(prev.lastIndexOf('. '), prev.lastIndexOf('? '), prev.lastIndexOf('; '));
      if (lastStop > 0) {
        /* Replace the last row with the truncated version. */
        rows[rows.length - 1] = '<text x="' + padX + '" y="' + (y - bodyLead) + '" font-family="Georgia,serif" font-size="' + bodySize + '" fill="#F0E6CC">' + xmlEscape(prev.slice(0, lastStop + 1)) + '</text>';
      } else {
        rows.push('<text x="' + padX + '" y="' + y + '" font-family="Georgia,serif" font-size="' + bodySize + '" fill="#D4C8AE">' + xmlEscape(rawLines[i].slice(0, charsPerLine - 2) + '\u2026') + '</text>');
      }
      break;
    }
    rows.push('<text x="' + padX + '" y="' + y + '" font-family="Georgia,serif" font-size="' + bodySize + '" fill="#F0E6CC">' + xmlEscape(rawLines[i]) + '</text>');
    y += bodyLead;
  }

  /* --- chips row --- */
  const chips = cb && cb.chips ? cb.chips : [];
  if (chips.length) {
    const chipsY = H - 96;
    const chipText = chips.join('   \u00B7   ');
    rows.push('<text x="' + padX + '" y="' + chipsY + '" font-family="Helvetica,Arial,sans-serif" font-size="19" fill="#D4C8AE">' + xmlEscape(chipText) + '</text>');
  }

  /* --- footer rule --- */
  const ruleY = H - 72;
  rows.push('<rect x="' + padX + '" y="' + ruleY + '" width="64" height="2" fill="rgba(201,160,80,0.55)"/>');

  /* --- wordmark and tagline --- */
  const footerY = H - 46;
  rows.push('<text x="' + padX + '" y="' + footerY + '" font-family="Helvetica,Arial,sans-serif" font-size="20" letter-spacing="2.8" fill="#9E8A55">COSMIC DAILY PLANNER</text>');
  rows.push('<text x="' + padX + '" y="' + (footerY + 28) + '" font-family="Georgia,serif" font-size="18" fill="#81CDB6">Two telescopes, one sky.</text>');

  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">'
    + rows.join('')
    + '</svg>';
}

function svgToPngBlob(svg: string, w: number, h: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
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
  /* Pass cardBody through so the renderer can use the structured layout. */
  const svg = renderCardSVG(t.title, firstParagraphOf(t), format, t.cardBody);
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
  const STYLE_ID = 'cdp-share-style';
  if (!document.getElementById(STYLE_ID)) {
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
