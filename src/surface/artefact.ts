/*
 * CDP Vessel, surface layer: the shared artefact engine.
 *
 * One place where a keepsake is drawn and one place where it leaves the device,
 * so the daily card and the profile Cosmic Signature can never drift apart. The
 * rule is simple: whatever the person sees is what they save, what they print,
 * and what they share. Every export starts from a styled SVG in the canonical
 * palette, not from re-rendered text, so the dark ground, the gold rule, and the
 * serif body survive the round trip into a PNG, a PDF, and the device share sheet.
 *
 *   svgToPngBlob   rasterise the SVG to a PNG at retina scale, for save and share
 *   printSvgPdf    embed the same SVG in a print frame, colour preserved, for PDF
 *   shareSvg       hand the PNG file to navigator.share, with a download fallback
 *   buildSignatureSVG   the profile Cosmic Signature, in the daily card family
 *   artefactControls    the one share bar both surfaces mount
 *
 * House style holds in code, comments, and visible strings: no em dashes, no en
 * dashes, no exclamation marks, and no spaced hyphen patterns.
 */

type Attrs = Record<string, string>;
function el(tag: string, attrs: Attrs = {}, text?: string): HTMLElement {
  const node = document.createElement(tag);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  if (text !== undefined) node.textContent = text;
  return node;
}

/* ============================================================================
 * Canonical palette and type. Identical values to the daily card, kept here so
 * both surfaces read one source and the colour can never disagree.
 * ========================================================================== */

export const W = 720;
export const PAD = 56;

export const C = {
  page: '#031831', panel: '#0D1E33', raised: '#13284A', raised2: '#192E4A',
  gold: '#C9A050', goldBright: '#E8C878', rule: '#BFA363', teal: '#81CDB6',
  text: '#F2EAD3', dim: '#C9BDA1', faint: '#8C826C', master: '#C8A0FF', glow: '#1A3658',
};

export const FONT = {
  sans: 'Helvetica Neue, Helvetica, Arial, sans-serif',
  serif: 'EB Garamond, Georgia, serif',
  caps: 'Cinzel, Georgia, serif',
};

/* ============================================================================
 * SVG drawing primitives, shared so the two artefacts share a grammar.
 * ========================================================================== */

export function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function wrap(text: string, maxChars: number): string[] {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if (line.length === 0) { line = w; continue; }
    if ((line + ' ' + w).length <= maxChars) line = line + ' ' + w;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

export class Layout {
  parts: string[] = [];
  y = 0;
  add(svg: string, dh: number): void { this.parts.push(svg); this.y += dh; }
}

export function txt(lines: string[], x: number, y: number, size: number, colour: string, lineH: number, font: string, opts?: { italic?: boolean; anchor?: string; spacing?: number; weight?: string }): string {
  const o = opts || {};
  const a = o.anchor ? ' text-anchor="' + o.anchor + '"' : '';
  const it = o.italic ? ' font-style="italic"' : '';
  const ls = o.spacing != null ? ' letter-spacing="' + o.spacing + '"' : '';
  const wt = o.weight ? ' font-weight="' + o.weight + '"' : '';
  const ts = lines.map((ln, i) => '<tspan x="' + x + '" dy="' + (i === 0 ? 0 : lineH) + '">' + esc(ln) + '</tspan>').join('');
  return '<text x="' + x + '" y="' + y + '"' + a + it + ls + wt + ' font-family="' + font + '" font-size="' + size + '" fill="' + colour + '">' + ts + '</text>';
}

export function capLabel(text: string, cx: number, y: number, colour: string): string {
  return txt([text.toUpperCase()], cx, y, 12, colour, 0, FONT.caps, { anchor: 'middle', spacing: 4 });
}

export function ruleLine(y: number, x1: number, x2: number, op: number): string {
  return '<line x1="' + x1 + '" y1="' + y + '" x2="' + x2 + '" y2="' + y + '" stroke="' + C.rule + '" stroke-opacity="' + op + '"/>';
}

export function starGlyph(cx: number, cy: number, r: number, colour: string): string {
  let pts = '';
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const rr = (i % 2 === 0) ? r : r * 0.42; pts += (cx + rr * Math.cos(a)).toFixed(1) + ',' + (cy + rr * Math.sin(a)).toFixed(1) + ' '; }
  return '<polygon points="' + pts.trim() + '" fill="' + colour + '"/>';
}

/* The two telescopes, the brand mark, two rings joined by the naked eye. */
export function telescopeMark(cx: number, cy: number, r: number, colour: string): string {
  return '<circle cx="' + (cx - r - 1) + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + colour + '" stroke-width="1.2"/>'
    + '<circle cx="' + (cx + r + 1) + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + colour + '" stroke-width="1.2"/>'
    + '<circle cx="' + cx + '" cy="' + cy + '" r="1.5" fill="' + colour + '"/>';
}

/* A small sun for the natal solar placement panel. */
export function sunGlyph(cx: number, cy: number, colour: string): string {
  let rays = '';
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; const x1 = cx + 13 * Math.cos(a); const y1 = cy + 13 * Math.sin(a); const x2 = cx + 19 * Math.cos(a); const y2 = cy + 19 * Math.sin(a); rays += '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="' + colour + '" stroke-width="1.3" stroke-linecap="round"/>'; }
  return rays + '<circle cx="' + cx + '" cy="' + cy + '" r="9" fill="none" stroke="' + colour + '" stroke-width="1.4"/>';
}

/* A quiet galactic seal, a diamond within a ring, for the birth Kin panel. */
export function sealGlyph(cx: number, cy: number, colour: string): string {
  return '<circle cx="' + cx + '" cy="' + cy + '" r="18" fill="none" stroke="' + colour + '" stroke-opacity="0.55"/>'
    + '<path d="M' + cx + ',' + (cy - 10) + ' L' + (cx + 10) + ',' + cy + ' L' + cx + ',' + (cy + 10) + ' L' + (cx - 10) + ',' + cy + ' Z" fill="none" stroke="' + colour + '" stroke-width="1.3"/>';
}

/* The framed parchment ground, the gradient, glow, gold rule, faint stars, and
 * hairline border, identical to the daily card so the family reads as one. */
export function envelope(inner: string, H: number): string {
  const cx = W / 2;
  const stars = [[58, 42], [150, 92], [300, 54], [430, 104], [560, 70], [662, 120], [96, 150], [505, 140], [640, 38], [214, 128], [372, 150], [700, 86], [44, 108], [600, 150], [260, 40]]
    .map((p) => '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (0.8 + ((p[0] * p[1]) % 5) / 5) + '" fill="' + C.text + '" opacity="' + (0.1 + ((p[0] + p[1]) % 6) / 60) + '"/>').join('');
  const defs = '<defs>'
    + '<linearGradient id="sigbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + C.panel + '"/><stop offset="0.14" stop-color="' + C.page + '"/><stop offset="1" stop-color="' + C.page + '"/></linearGradient>'
    + '<radialGradient id="sigglow" cx="50%" cy="0%" r="70%"><stop offset="0" stop-color="' + C.glow + '" stop-opacity="0.85"/><stop offset="1" stop-color="' + C.page + '" stop-opacity="0"/></radialGradient>'
    + '</defs>';
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" font-family="' + FONT.serif + '">'
    + defs
    + '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="url(#sigbg)"/>'
    + '<rect x="0" y="0" width="' + W + '" height="240" fill="url(#sigglow)"/>'
    + '<rect x="0" y="0" width="' + W + '" height="2.5" fill="' + C.goldBright + '" opacity="0.5"/>'
    + stars
    + '<rect x="7" y="7" width="' + (W - 14) + '" height="' + (H - 14) + '" rx="16" fill="none" stroke="' + C.rule + '" stroke-opacity="0.22"/>'
    + inner
    + '<circle cx="' + cx + '" cy="0" r="0" fill="none"/>'
    + '</svg>';
}

/* ============================================================================
 * The Cosmic Signature artefact. A keepsake portrait of a person's coordinates,
 * drawn from data, not from the screen text, so save and share carry the beauty.
 * ========================================================================== */

export interface SigPanel {
  /** Small uppercase label, for example "Life Path" or "Personal Year 2026". */
  label: string;
  /** The medallion value when glyph is "number", otherwise unused. */
  value: string;
  /** The named meaning of the number, or the sign name for the Sun panel. */
  name: string;
  /** The plain reading, wrapped into the panel body. */
  meaning: string;
  /** Purple medallion and name for a master number. */
  master: boolean;
  /** Which emblem sits on the left of the panel. */
  glyph: 'number' | 'sun' | 'seal';
}

export interface SignatureData {
  /** The person's name, set large at the head. */
  name: string;
  /** The full galactic signature line, for example "Kin 60 Galactic Yellow Sun". */
  galactic: string;
  /** The compact coordinate line under the name. */
  subline: string;
  /** Place and date of birth, optional, set quiet under the header. */
  birthLine?: string;
  /** The four core panels: Life Path, Personal Year, Birth Kin, Sun Sign. */
  core: SigPanel[];
  /** Name numerology panels, Expression, Soul Urge, Personality, may be empty. */
  nameNumbers: SigPanel[];
  /** Etymological note, optional, one slim line. */
  nameMeaning?: string;
  /** The citation strip at the foot of the meanings. */
  citation: string;
}

function panel(L: Layout, p: SigPanel): void {
  const inner = W - PAD * 2;
  const meaningLines = wrap(p.meaning, Math.floor((inner - 96) / 7.2));
  const nameLines = p.name ? wrap(p.name, Math.floor((inner - 96) / 9.0)) : [];
  const panelH = Math.max(108, 56 + nameLines.length * 24 + meaningLines.length * 21);
  const top = L.y;
  const colour = p.master ? C.master : C.gold;
  const ccx = PAD + 8;
  const ccy = top + panelH / 2;
  const tx = PAD + 60;
  L.add('<rect x="' + (PAD - 22) + '" y="' + top + '" width="' + (inner + 44) + '" height="' + panelH + '" rx="13" fill="' + C.raised + '"/>', 0);
  if (p.glyph === 'sun') {
    L.add(sunGlyph(ccx, ccy, colour), 0);
  } else if (p.glyph === 'seal') {
    L.add(sealGlyph(ccx, ccy, colour), 0);
  } else {
    L.add('<circle cx="' + ccx + '" cy="' + ccy + '" r="25" fill="none" stroke="' + colour + '" stroke-opacity="0.55"/>', 0);
    L.add(txt([p.value], ccx, ccy + 8, 23, colour, 0, FONT.serif, { anchor: 'middle' }), 0);
  }
  L.add(txt([p.label.toUpperCase()], tx, top + 30, 11, C.faint, 0, FONT.caps, { spacing: 3 }), 0);
  let yName = top + 54;
  if (nameLines.length) {
    L.add(txt(nameLines, tx, yName, 18, colour, 23, FONT.serif), 0);
    yName += nameLines.length * 24 - 4;
  } else {
    yName = top + 44;
  }
  L.add(txt(meaningLines, tx, yName + 16, 13.5, C.dim, 21, FONT.sans), 0);
  L.add('', panelH + 16);
}

export function buildSignatureSVG(d: SignatureData): string {
  const L = new Layout();
  const inner = W - PAD * 2;
  const cx = W / 2;

  // header
  L.add('', 74);
  L.add(capLabel('Cosmic Signature', cx, L.y, C.teal), 40);
  const nameLines = wrap(d.name || 'Your Cosmic Signature', Math.floor(inner / 17));
  L.add(txt(nameLines, cx, L.y, 33, C.goldBright, 38, FONT.serif, { anchor: 'middle' }), nameLines.length * 38 + 8);
  if (d.galactic) L.add(txt([d.galactic], cx, L.y, 17, C.gold, 0, FONT.serif, { anchor: 'middle', italic: true }), 26);
  if (d.subline) L.add(txt([d.subline], cx, L.y, 12.5, C.dim, 0, FONT.sans, { anchor: 'middle' }), 22);
  if (d.birthLine) L.add(txt([d.birthLine.toUpperCase()], cx, L.y, 10.5, C.faint, 0, FONT.caps, { anchor: 'middle', spacing: 2 }), 22);
  L.add('', 12);
  L.add(telescopeMark(cx, L.y, 6, C.rule), 26);
  L.add(ruleLine(L.y, PAD, W - PAD, 0.3), 44);

  if (d.core.length) {
    L.add(capLabel('What your numbers mean', cx, L.y, C.teal), 34);
    for (const p of d.core) panel(L, p);
  }

  if (d.nameNumbers.length) {
    L.add('', 6);
    L.add(ruleLine(L.y, cx - 80, cx + 80, 0.22) + '<circle cx="' + cx + '" cy="' + L.y + '" r="2.5" fill="' + C.gold + '"/>', 38);
    L.add(capLabel('What your name carries', cx, L.y, C.teal), 34);
    for (const p of d.nameNumbers) panel(L, p);
  }

  if (d.nameMeaning) {
    const mlines = wrap(d.nameMeaning, Math.floor(inner / 6.4));
    L.add(txt(mlines, cx, L.y + 6, 13, C.dim, 20, FONT.serif, { anchor: 'middle', italic: true }), mlines.length * 20 + 18);
  }

  // citation, quiet
  if (d.citation) {
    const clines = wrap(d.citation, Math.floor(inner / 6.0));
    L.add(txt(clines, cx, L.y, 10.5, C.faint, 15, FONT.sans, { anchor: 'middle' }), clines.length * 15 + 26);
  }

  // footer mark
  L.add(telescopeMark(cx, L.y + 2, 6.5, C.rule), 28);
  L.add(txt(['COSMICDAILYPLANNER.COM'], cx, L.y, 10, C.faint, 0, FONT.caps, { anchor: 'middle', spacing: 3 }), 40);

  const H = Math.round(L.y);
  return envelope(L.parts.join(''), H);
}

/* ============================================================================
 * The prose artefact. A styled portrait of a reading or a reply, drawn from the
 * text itself so that Share, Save image, and Save PDF all carry the writing with
 * the same parchment, frame, and hand as the daily card and the signature.
 * ========================================================================== */

export interface ProseData {
  /** The voice the reply is written in, shown as a small kicker (Tradition, Science, Everyday). */
  voice: string;
  /** A long, readable date line. */
  dateLabel: string;
  /** The question the person asked, set as the title. */
  prompt: string;
  /** The body, one entry per paragraph; the final paragraph is treated as the keel and set in gold. */
  paragraphs: string[];
  /** Footer wordmark. Defaults to Cosmic Daily Planner. */
  footer?: string;
}

export function buildProseSVG(d: ProseData): string {
  const L = new Layout();
  const cx = W / 2;
  const left = PAD;
  const lineH = 25;
  let y = 62;

  // voice kicker, centred caps
  L.add(capLabel(d.voice, cx, y, C.gold), 0);
  y += 21;

  // date, centred, quiet
  L.add(txt([d.dateLabel], cx, y, 13, C.dim, 0, FONT.serif, { anchor: 'middle', spacing: 1 }), 0);
  y += 32;

  // the question, set as a centred italic title that may wrap
  const titleLines = wrap(d.prompt, 50);
  L.add(txt(titleLines, cx, y, 20, C.goldBright, 27, FONT.serif, { anchor: 'middle', italic: true }), 0);
  y += (titleLines.length - 1) * 27 + 24;

  // a short centred rule between title and body
  L.add(ruleLine(y, cx - 70, cx + 70, 0.55), 0);
  y += 30;

  // body paragraphs, the last one set in gold as the keel line
  const lastIdx = d.paragraphs.length - 1;
  d.paragraphs.forEach((para, i) => {
    const colour = i === lastIdx ? C.gold : C.text;
    const lines = wrap(para, 70);
    L.add(txt(lines, left, y, 16, colour, lineH, FONT.serif, {}), 0);
    y += (lines.length - 1) * lineH + lineH + 14;
  });
  y += 6;

  // footer: the two telescopes mark and the wordmark
  L.add(ruleLine(y, PAD, W - PAD, 0.35), 0);
  y += 24;
  L.add(telescopeMark(cx, y, 5, C.gold), 0);
  L.add(txt([d.footer || 'Cosmic Daily Planner'], cx, y + 22, 11, C.dim, 0, FONT.caps, { anchor: 'middle', spacing: 3 }), 0);
  y += 46;

  const H = Math.ceil(y + 18);
  return envelope(L.parts.join(''), H);
}

/* ============================================================================
 * The unified export pipeline. The single road off the device for the daily
 * card, the Cosmic Signature, and the prose reply, so a fix in one place fixes
 * all three.
 * ========================================================================== */

interface ShareNav { canShare?: (data: { files?: File[]; title?: string }) => boolean; share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>; }

export function svgToPngBlob(svg: string, scale: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || W;
      const h = img.naturalHeight || W;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error('no_context')); return; }
      ctx.fillStyle = C.page;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => { if (b) resolve(b); else reject(new Error('no_blob')); }, 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image_failed')); };
    img.src = url;
  });
}

export function downloadBlob(b: Blob, name: string): void {
  const url = URL.createObjectURL(b);
  const a = el('a', { href: url, download: name });
  document.body.appendChild(a);
  (a as HTMLAnchorElement).click();
  window.setTimeout(() => { if (a.parentNode) a.parentNode.removeChild(a); URL.revokeObjectURL(url); }, 1200);
}

/*
 * Print the SVG as a paper artefact with the dark ground intact. print-color-adjust
 * exact is the instruction that keeps a browser from dropping the navy and gold at
 * print time, the cause of the old black on white page. The SVG carries its own
 * filled ground, so the colour is content, not a background the printer may strip.
 */
export function printSvgPdf(svg: string, title: string): void {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.position = 'fixed'; frame.style.right = '0'; frame.style.bottom = '0';
  frame.style.width = '0'; frame.style.height = '0'; frame.style.border = '0';
  document.body.appendChild(frame);
  const doc = frame.contentWindow && frame.contentWindow.document;
  if (!doc) { document.body.removeChild(frame); return; }
  const safe = String(title || 'Cosmic Daily Planner').replace(/</g, '').replace(/>/g, '');
  const css = '@page{margin:14mm}'
    + 'html,body{margin:0;background:' + C.page + ';-webkit-print-color-adjust:exact;print-color-adjust:exact}'
    + '*{-webkit-print-color-adjust:exact;print-color-adjust:exact}'
    + 'svg{width:100%;height:auto;display:block}';
  doc.open();
  doc.write('<html><head><title>' + safe + '</title><meta charset="utf-8"><style>' + css + '</style></head><body>' + svg + '</body></html>');
  doc.close();
  const w = frame.contentWindow;
  if (!w) { document.body.removeChild(frame); return; }
  window.setTimeout(() => {
    try { w.focus(); w.print(); } catch (_e) { /* the person may cancel */ }
    window.setTimeout(() => { if (frame.parentNode) frame.parentNode.removeChild(frame); }, 1000);
  }, 350);
}

/* Share the artefact as a PNG file through the device share sheet, with a quiet
 * download fallback when files cannot be shared. */
export async function shareSvg(svg: string, fileBase: string, title: string, onShared?: () => void): Promise<void> {
  const blob = await svgToPngBlob(svg, 2);
  const file = new File([blob], fileBase + '.png', { type: 'image/png' });
  const nav = navigator as unknown as ShareNav;
  if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
    try { await nav.share({ files: [file], title }); if (onShared) onShared(); return; }
    catch (_e) { /* cancelled, or the sheet declined the file, fall through */ }
  }
  downloadBlob(blob, fileBase + '.png');
}

/* ============================================================================
 * The share bar. One control, mounted by both surfaces, every action routed
 * through the pipeline above so the saved artefact is always the styled SVG.
 * ========================================================================== */

const STYLE_ID = 'cdp-artefact-style';
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

function slug(s: string): string {
  return (s || 'cosmic-daily-planner').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'cosmic-daily-planner';
}

function flash(btn: HTMLElement, label: string): void {
  const prev = btn.textContent || '';
  btn.textContent = label;
  window.setTimeout(() => { btn.textContent = prev; }, 1600);
}

export interface ArtefactControlsOptions {
  /** Title for the share sheet, the image, and the printed page. */
  title: string;
  /** The current styled SVG, read at the moment of action so it is fresh. */
  svg: () => string;
  /** Optional download and file base. Defaults to a slug of the title. */
  fileBase?: string;
  /** Optional plain text for the Copy action. When absent, Copy is omitted. */
  text?: () => string;
  /** What the artefact is called, used in the confirmation notes. Defaults to Cosmic Signature. */
  noun?: string;
  /** Optional note back to the home after a save or share. */
  reflect?: (note: string) => void;
}

/** Build the share control. Returns a row to drop into a surface. */
export function artefactControls(o: ArtefactControlsOptions): HTMLElement {
  ensureStyle();
  const bar = el('div', { class: 'share-bar' });
  const base = (): string => o.fileBase || slug(o.title);
  const noun = o.noun || 'Cosmic Signature';

  if (o.text) {
    const copyBtn = el('button', { type: 'button', class: 'share-btn' }, 'Copy');
    copyBtn.addEventListener('click', () => {
      const text = o.text ? o.text() : '';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => flash(copyBtn, 'Copied')).catch(() => flash(copyBtn, 'Press and hold to copy'));
      } else { flash(copyBtn, 'Press and hold to copy'); }
    });
    bar.appendChild(copyBtn);
  }

  const nav = navigator as unknown as ShareNav;
  if (typeof nav.share === 'function') {
    const shareBtn = el('button', { type: 'button', class: 'share-btn' }, 'Share');
    shareBtn.addEventListener('click', () => {
      shareSvg(o.svg(), base(), o.title, () => { if (o.reflect) o.reflect('Your ' + noun + ' is shared.'); })
        .catch(() => flash(shareBtn, 'Try again'));
    });
    bar.appendChild(shareBtn);
  }

  const imgBtn = el('button', { type: 'button', class: 'share-btn' }, 'Save as image');
  imgBtn.addEventListener('click', () => {
    svgToPngBlob(o.svg(), 2)
      .then((b) => { downloadBlob(b, base() + '.png'); flash(imgBtn, 'Saved'); if (o.reflect) o.reflect('Your ' + noun + ' is saved.'); })
      .catch(() => flash(imgBtn, 'Could not save'));
  });
  bar.appendChild(imgBtn);

  const pdfBtn = el('button', { type: 'button', class: 'share-btn' }, 'Save as PDF');
  pdfBtn.addEventListener('click', () => { printSvgPdf(o.svg(), o.title); });
  bar.appendChild(pdfBtn);

  return bar;
}
