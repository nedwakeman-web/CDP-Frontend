/**
 * CDP Vessel, surface layer: the attachment zone for the open ask.
 *
 * The Naked Eye is the one place a person says what is on their mind. Sometimes
 * what is on their mind is a photograph, a chart, a letter, a page of a report,
 * a screenshot of a conversation. This module lets them bring those into the
 * Compass so the reflection can consider them, the same way a thoughtful reader
 * would glance at what you put in front of them before speaking.
 *
 * It attaches to any text field: a paperclip button, drag and drop onto the
 * field, and paste from the clipboard all add files. Images carry a thumbnail.
 * Documents and text files carry a labelled chip. Each can be removed before
 * sending. On send the host reads getAttachments and forwards the wire shape to
 * the orchestrator, which carries it to the server, which presents it to the
 * model as image, document, and text content blocks.
 *
 * The module is self contained. It injects its own scoped style once, themed
 * from the surface variables, so it drops into any surface without a host CSS
 * edit. It depends on nothing but the DOM.
 *
 * House style holds here: no em dashes, no en dashes, no exclamation marks, in
 * code and in comments alike. Faint grey is never used for anything a person is
 * meant to read; chip labels are text light.
 */

/** The kind of content a single attachment carries. */
export type AttachmentKind = 'image' | 'document' | 'text';

/**
 * One attachment, in the shape the surface holds it. The wire shape sent to the
 * server is a subset of this (kind, name, mediaType, data, textContent), built
 * by toWire.
 */
export interface CdpAttachment {
  id: string;
  kind: AttachmentKind;
  name: string;
  /** The MIME type, for example image/png or application/pdf or text/plain. */
  mediaType: string;
  /** Base64 with no data URI prefix, present for image and document kinds. */
  data?: string;
  /** UTF-8 text, present for the text kind, truncated to a sane ceiling. */
  textContent?: string;
  sizeBytes: number;
  /** An object URL used only for the on screen thumbnail, never sent. */
  previewUrl?: string;
}

/** The minimal shape the server receives. */
export interface CdpAttachmentWire {
  kind: AttachmentKind;
  name: string;
  mediaType: string;
  data?: string;
  textContent?: string;
}

export interface AttachmentZoneOptions {
  /** The text field the person types into. Used as paste and drop target. */
  input: HTMLTextAreaElement | HTMLInputElement;
  /** Where the control row and the chips strip are mounted. */
  mount: HTMLElement;
  /** A gentle status line, shared with the rest of the home surface. */
  reflect?: (note: string) => void;
  /** Maximum number of attachments held at once. Defaults to four. */
  maxFiles?: number;
  /** Called whenever the held count changes. */
  onChange?: (count: number) => void;
}

export interface AttachmentZone {
  /** The current attachments, in the order they were added. */
  getAttachments(): CdpAttachment[];
  /** The wire shape for the current attachments, ready to post. */
  toWire(): CdpAttachmentWire[];
  /** Remove every attachment and revoke any preview URLs. */
  clear(): void;
  /** How many attachments are held now. */
  count(): number;
  /** Detach listeners and release resources. */
  destroy(): void;
}

/* ---- limits and accepted types -------------------------------------------- */

const DEFAULT_MAX_FILES = 4;
const MAX_IMAGE_BYTES = 4_500_000;
const MAX_DOC_BYTES = 4_500_000;
const MAX_TEXT_CHARS = 20_000;

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const DOC_TYPES = ['application/pdf'];
const TEXT_TYPES = [
  'text/plain', 'text/markdown', 'text/csv', 'text/html', 'text/xml',
  'application/json', 'application/xml', 'application/x-yaml', 'text/yaml',
];

/** Extensions read as plain text when the browser gives no usable MIME type. */
const TEXT_EXTENSIONS = [
  'txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'yaml', 'yml', 'xml', 'html',
  'htm', 'log', 'rtf', 'js', 'ts', 'py', 'css', 'sql', 'sh',
];

/* ---- scoped style, injected once ------------------------------------------ */

const STYLE_ID = 'cdp-attach-style';

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = [
    '.cdp-surface .attach-row { display:flex; align-items:center; gap:10px; justify-content:center; margin-top:10px; flex-wrap:wrap; }',
    '.cdp-surface .attach-btn { display:inline-flex; align-items:center; gap:7px; padding:7px 13px; background:transparent; border:1px solid var(--gold-line); color:var(--text-light); font-family:Cinzel, Georgia, serif; font-size:9.5px; letter-spacing:0.16em; text-transform:uppercase; border-radius:2px; cursor:pointer; transition:border-color .2s, color .2s; }',
    '.cdp-surface .attach-btn:hover { border-color:var(--gold); color:var(--gold); }',
    '.cdp-surface .attach-btn svg { width:14px; height:14px; display:block; }',
    '.cdp-surface .attach-hint { font-family:Georgia, serif; font-size:11.5px; color:var(--text-dim); font-style:italic; }',
    '.cdp-surface .attach-strip { display:flex; flex-wrap:wrap; gap:9px; justify-content:center; margin-top:12px; }',
    '.cdp-surface .attach-chip { position:relative; display:flex; align-items:center; gap:9px; max-width:230px; padding:7px 10px 7px 8px; background:var(--raised); border:1px solid var(--gold-line); border-radius:3px; }',
    '.cdp-surface .attach-chip .thumb { width:38px; height:38px; flex-shrink:0; border-radius:2px; object-fit:cover; border:1px solid var(--gold-line); background:var(--navy); }',
    '.cdp-surface .attach-chip .glyph { width:34px; height:38px; flex-shrink:0; display:flex; align-items:center; justify-content:center; color:var(--gold); }',
    '.cdp-surface .attach-chip .glyph svg { width:20px; height:20px; display:block; }',
    '.cdp-surface .attach-chip .meta { display:flex; flex-direction:column; min-width:0; }',
    '.cdp-surface .attach-chip .nm { font-family:Georgia, serif; font-size:12px; color:var(--text-light); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:150px; }',
    '.cdp-surface .attach-chip .sz { font-family:Georgia, serif; font-size:10.5px; color:var(--text-dim); letter-spacing:0.02em; }',
    '.cdp-surface .attach-chip .rm { flex-shrink:0; width:20px; height:20px; border:none; background:transparent; color:var(--text-dim); cursor:pointer; font-size:15px; line-height:1; border-radius:2px; transition:color .2s, background .2s; }',
    '.cdp-surface .attach-chip .rm:hover { color:var(--gold); background:rgba(201,160,80,0.12); }',
    '.cdp-surface .ask.drag-over .ask-input { border-color:var(--gold); background:rgba(201,160,80,0.06); }',
    '.cdp-surface .ask.drag-over::after { content:"Drop to bring this into the compass"; display:block; text-align:center; font-family:Georgia, serif; font-style:italic; font-size:12px; color:var(--gold); margin-top:8px; }',
  ].join('\n');
  document.head.appendChild(style);
}

/* ---- small SVG marks ------------------------------------------------------ */

const PAPERCLIP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5l-8.6 8.6a5 5 0 0 1-7-7l8.5-8.6a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.9-7.8"/></svg>';
const DOC_GLYPH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/></svg>';
const TEXT_GLYPH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7V5h16v2"/><path d="M9 5v14M9 19h6"/></svg>';

/* ---- helpers -------------------------------------------------------------- */

function uid(): string {
  return 'att_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

function classify(file: File): AttachmentKind | null {
  const type = (file.type || '').toLowerCase();
  if (IMAGE_TYPES.includes(type)) return 'image';
  if (DOC_TYPES.includes(type)) return 'document';
  if (TEXT_TYPES.some((t) => type === t || type.startsWith('text/'))) return 'text';
  // Browser gave no usable type. Fall back to the extension.
  const ext = extOf(file.name);
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'document';
  if (TEXT_EXTENSIONS.includes(ext)) return 'text';
  return null;
}

function mediaTypeFor(file: File, kind: AttachmentKind): string {
  const type = (file.type || '').toLowerCase();
  if (kind === 'image') {
    if (IMAGE_TYPES.includes(type)) return type;
    const ext = extOf(file.name);
    if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
    if (ext === 'png') return 'image/png';
    if (ext === 'gif') return 'image/gif';
    if (ext === 'webp') return 'image/webp';
    return 'image/png';
  }
  if (kind === 'document') return 'application/pdf';
  return type && type.startsWith('text/') ? type : 'text/plain';
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('read_failed'));
    reader.readAsDataURL(file);
  });
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('read_failed'));
    reader.readAsText(file);
  });
}

/* ---- the zone ------------------------------------------------------------- */

export function createAttachmentZone(opts: AttachmentZoneOptions): AttachmentZone {
  ensureStyle();
  const maxFiles = opts.maxFiles && opts.maxFiles > 0 ? opts.maxFiles : DEFAULT_MAX_FILES;
  const items: CdpAttachment[] = [];
  // Slots reserved by reads that passed the cap check but have not pushed yet.
  // Counting these keeps the cap honest when several files arrive at once.
  let pending = 0;

  const acceptList = IMAGE_TYPES.concat(DOC_TYPES, TEXT_TYPES, ['.txt', '.md', '.csv', '.json', '.log']).join(',');

  const row = document.createElement('div');
  row.className = 'attach-row';

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.multiple = true;
  fileInput.accept = acceptList;
  fileInput.style.display = 'none';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'attach-btn';
  button.setAttribute('aria-label', 'Attach an image or a document');
  button.innerHTML = PAPERCLIP + '<span>Attach</span>';

  const hint = document.createElement('span');
  hint.className = 'attach-hint';
  hint.textContent = 'image, PDF, or text';

  row.appendChild(button);
  row.appendChild(hint);
  row.appendChild(fileInput);

  const strip = document.createElement('div');
  strip.className = 'attach-strip';

  opts.mount.appendChild(row);
  opts.mount.appendChild(strip);

  function notify(note: string): void {
    if (opts.reflect) opts.reflect(note);
  }

  function changed(): void {
    if (opts.onChange) opts.onChange(items.length);
  }

  function renderStrip(): void {
    while (strip.firstChild) strip.removeChild(strip.firstChild);
    items.forEach((att) => {
      const chip = document.createElement('div');
      chip.className = 'attach-chip';

      if (att.kind === 'image' && att.previewUrl) {
        const img = document.createElement('img');
        img.className = 'thumb';
        img.src = att.previewUrl;
        img.alt = att.name;
        chip.appendChild(img);
      } else {
        const glyph = document.createElement('div');
        glyph.className = 'glyph';
        glyph.innerHTML = att.kind === 'document' ? DOC_GLYPH : TEXT_GLYPH;
        chip.appendChild(glyph);
      }

      const meta = document.createElement('div');
      meta.className = 'meta';
      const nm = document.createElement('span');
      nm.className = 'nm';
      nm.textContent = att.name;
      nm.title = att.name;
      const sz = document.createElement('span');
      sz.className = 'sz';
      sz.textContent = att.kind === 'text'
        ? (att.textContent ? humanSize(att.textContent.length) + ' of text' : 'text')
        : humanSize(att.sizeBytes);
      meta.appendChild(nm);
      meta.appendChild(sz);
      chip.appendChild(meta);

      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'rm';
      rm.setAttribute('aria-label', 'Remove ' + att.name);
      rm.textContent = '\u00D7';
      rm.addEventListener('click', () => remove(att.id));
      chip.appendChild(rm);

      strip.appendChild(chip);
    });
  }

  function remove(id: string): void {
    const idx = items.findIndex((x) => x.id === id);
    if (idx < 0) return;
    const att = items[idx];
    if (att.previewUrl) URL.revokeObjectURL(att.previewUrl);
    items.splice(idx, 1);
    renderStrip();
    changed();
  }

  async function add(file: File): Promise<void> {
    if (items.length + pending >= maxFiles) {
      notify('Up to ' + maxFiles + ' at a time. Remove one to add another.');
      return;
    }
    const kind = classify(file);
    if (!kind) {
      notify('That file type is not supported. Try an image, a PDF, or a text file.');
      return;
    }
    if (kind === 'image' && file.size > MAX_IMAGE_BYTES) {
      notify('That image is large. Please use one under ' + humanSize(MAX_IMAGE_BYTES) + '.');
      return;
    }
    if (kind === 'document' && file.size > MAX_DOC_BYTES) {
      notify('That document is large. Please use one under ' + humanSize(MAX_DOC_BYTES) + '.');
      return;
    }

    pending += 1;
    try {
      const att: CdpAttachment = {
        id: uid(),
        kind,
        name: file.name || (kind === 'image' ? 'pasted image' : 'attachment'),
        mediaType: mediaTypeFor(file, kind),
        sizeBytes: file.size,
      };
      if (kind === 'text') {
        const text = await readAsText(file);
        att.textContent = text.length > MAX_TEXT_CHARS ? text.slice(0, MAX_TEXT_CHARS) : text;
        if (text.length > MAX_TEXT_CHARS) notify('That file is long, so the first part was taken.');
      } else {
        att.data = await readAsBase64(file);
        if (kind === 'image') att.previewUrl = URL.createObjectURL(file);
      }
      items.push(att);
      renderStrip();
      changed();
    } catch (_e) {
      notify('That file could not be read. Please try another.');
    } finally {
      pending -= 1;
    }
  }

  async function addMany(files: FileList | File[]): Promise<void> {
    const list = Array.from(files);
    for (const f of list) {
      await add(f);
    }
  }

  /* ---- wiring ---- */

  function onButton(): void { fileInput.click(); }
  button.addEventListener('click', onButton);

  function onPick(): void {
    if (fileInput.files && fileInput.files.length) {
      void addMany(fileInput.files);
      fileInput.value = '';
    }
  }
  fileInput.addEventListener('change', onPick);

  const askWrap = opts.input.closest('.ask') as HTMLElement | null;
  const dropTarget = askWrap || opts.input;

  function onDragOver(e: Event): void {
    e.preventDefault();
    if (askWrap) askWrap.classList.add('drag-over');
  }
  function onDragLeave(): void {
    if (askWrap) askWrap.classList.remove('drag-over');
  }
  function onDrop(e: Event): void {
    e.preventDefault();
    if (askWrap) askWrap.classList.remove('drag-over');
    const dt = (e as DragEvent).dataTransfer;
    if (dt && dt.files && dt.files.length) void addMany(dt.files);
  }
  dropTarget.addEventListener('dragover', onDragOver);
  dropTarget.addEventListener('dragleave', onDragLeave);
  dropTarget.addEventListener('drop', onDrop);

  function onPaste(e: Event): void {
    const cd = (e as ClipboardEvent).clipboardData;
    if (!cd) return;
    const files: File[] = [];
    if (cd.files && cd.files.length) {
      for (let i = 0; i < cd.files.length; i += 1) files.push(cd.files[i]);
    } else if (cd.items && cd.items.length) {
      for (let i = 0; i < cd.items.length; i += 1) {
        const it = cd.items[i];
        if (it.kind === 'file') {
          const f = it.getAsFile();
          if (f) files.push(f);
        }
      }
    }
    if (files.length) void addMany(files);
  }
  opts.input.addEventListener('paste', onPaste);

  /* ---- public surface ---- */

  function clearAll(): void {
    items.forEach((att) => { if (att.previewUrl) URL.revokeObjectURL(att.previewUrl); });
    items.length = 0;
    renderStrip();
    changed();
  }

  return {
    getAttachments(): CdpAttachment[] { return items.slice(); },
    toWire(): CdpAttachmentWire[] {
      return items.map((a) => {
        const w: CdpAttachmentWire = { kind: a.kind, name: a.name, mediaType: a.mediaType };
        if (a.data) w.data = a.data;
        if (a.textContent) w.textContent = a.textContent;
        return w;
      });
    },
    clear(): void { clearAll(); },
    count(): number { return items.length; },
    destroy(): void {
      clearAll();
      button.removeEventListener('click', onButton);
      fileInput.removeEventListener('change', onPick);
      dropTarget.removeEventListener('dragover', onDragOver);
      dropTarget.removeEventListener('dragleave', onDragLeave);
      dropTarget.removeEventListener('drop', onDrop);
      opts.input.removeEventListener('paste', onPaste);
      if (row.parentNode) row.parentNode.removeChild(row);
      if (strip.parentNode) strip.parentNode.removeChild(strip);
    },
  };
}
