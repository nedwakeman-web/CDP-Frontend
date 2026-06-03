/**
 * CDP Vessel, surface layer: Profiles.
 *
 * The people the person keeps. The self, drawn from the home birth profile,
 * and any others they save. Each can be read on its own, and any two can be
 * set side by side in Compatibility. Profiles persist through the same store
 * as everything else, so a person saved on one device is there on the next.
 *
 * This surface composes nothing and computes no coordinate. It reads and
 * writes the saved profiles through the repository, and hands a chosen profile
 * back to the home through onRead so the existing reading surface opens for it.
 *
 * House style holds here, in code, comments, and visible strings alike: no em
 * dashes, no en dashes, no exclamation marks, and no spaced hyphen patterns.
 */

import type { VesselRepository } from '../data/repository';
import type { Lens, VesselProfile } from '../data/model';

export interface OpenProfilesOptions {
  /** Where to append the overlay. The Vessel passes its surface element. */
  container: HTMLElement;
  /** The repository, the single source for reading and writing saved people. */
  repo: VesselRepository;
  /** Reads the current voice, for parity with the rest of the surface. */
  getLens: () => Lens;
  /** Opens a reading for the chosen profile, with a label for the heading. */
  onRead: (profile: VesselProfile, label: string) => void;
}

export interface ProfilesHandle { close(): void; }

type Attrs = Record<string, string>;
function el(tag: string, attrs: Attrs = {}, text?: string): HTMLElement {
  const node = document.createElement(tag);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  if (text !== undefined) node.textContent = text;
  return node;
}
function clear(node: HTMLElement): void { while (node.firstChild) node.removeChild(node.firstChild); }

/** A human reading of a birth date, or a gentle absence. */
function birthLabel(p: VesselProfile): string {
  if (!p.birthDate) return 'Birth date not set';
  const dt = new Date(p.birthDate + 'T12:00:00Z');
  if (isNaN(dt.getTime())) return p.birthDate;
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

const STYLE_ID = 'cdp-profiles-style';
function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const css = [
    '.cdp-surface .pf-view{position:fixed;top:58px;left:0;right:0;bottom:0;z-index:60;background:var(--bg,#0A1828);overflow-y:auto;padding:24px 18px 64px}',
    '.cdp-surface .pf-shell{max-width:40rem;margin:0 auto}',
    '.cdp-surface .pf-bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}',
    '.cdp-surface .pf-h{font-family:Cinzel,Georgia,serif;font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold,#C9A050)}',
    '.cdp-surface .pf-close{background:none;border:none;cursor:pointer;color:var(--text-dim,#D4C8AE);font-size:22px;line-height:1;padding:4px 8px}',
    '.cdp-surface .pf-close:hover{color:var(--gold,#C9A050)}',
    '.cdp-surface .pf-sub{font-family:\'EB Garamond\',Georgia,serif;font-style:italic;font-size:13px;color:var(--text-dim,#D4C8AE);margin-bottom:18px;line-height:1.6}',
    '.cdp-surface .pf-section{font-family:Cinzel,Georgia,serif;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--text-faint,#9E9282);margin:18px 0 8px}',
    '.cdp-surface .pf-card{display:flex;align-items:center;gap:12px;border:1px solid var(--gold-line,#3A3320);border-radius:4px;background:var(--navy,#0D1E33);padding:12px 14px;margin-bottom:9px}',
    '.cdp-surface .pf-card .pf-meta{flex:1;min-width:0}',
    '.cdp-surface .pf-name{font-family:\'EB Garamond\',Georgia,serif;font-size:18px;color:var(--text-light,#F0E6CC)}',
    '.cdp-surface .pf-born{font-size:12px;color:var(--text-dim,#D4C8AE);margin-top:1px}',
    '.cdp-surface .pf-read{background:none;border:1px solid var(--gold-line,#3A3320);color:var(--gold,#C9A050);font-family:\'EB Garamond\',Georgia,serif;font-size:12px;letter-spacing:.1em;text-transform:uppercase;padding:7px 13px;border-radius:2px;cursor:pointer;white-space:nowrap}',
    '.cdp-surface .pf-remove{background:none;border:none;color:var(--text-faint,#9E9282);font-size:18px;line-height:1;cursor:pointer;padding:4px 6px}',
    '.cdp-surface .pf-remove:hover{color:rgba(200,120,120,.9)}',
    '.cdp-surface .pf-empty{font-family:\'EB Garamond\',Georgia,serif;font-style:italic;font-size:13px;color:var(--text-faint,#9E9282);padding:6px 2px}',
    '.cdp-surface .pf-add{border:1px dashed var(--gold-line,#3A3320);border-radius:4px;padding:14px;margin-top:8px}',
    '.cdp-surface .pf-add label{display:block;font-size:11px;letter-spacing:.06em;color:var(--text-dim,#D4C8AE);margin:0 0 4px}',
    '.cdp-surface .pf-add input{width:100%;box-sizing:border-box;background:var(--bg,#0A1828);border:1px solid var(--gold-line,#3A3320);border-radius:3px;color:var(--text-light,#F0E6CC);font-family:\'EB Garamond\',Georgia,serif;font-size:15px;padding:9px 11px;margin-bottom:10px}',
    '.cdp-surface .pf-add-btn{background:var(--gold,#C9A050);color:#1A1208;border:none;border-radius:3px;font-family:Cinzel,Georgia,serif;font-size:11px;letter-spacing:.12em;text-transform:uppercase;padding:9px 16px;cursor:pointer}',
    '.cdp-surface .pf-note{font-family:\'EB Garamond\',Georgia,serif;font-style:italic;font-size:12px;color:var(--text-faint,#9E9282);margin-top:6px}',
  ].join('');
  const style = el('style', { id: STYLE_ID });
  style.textContent = css;
  document.head.appendChild(style);
}

export function openProfiles(o: OpenProfilesOptions): ProfilesHandle {
  ensureStyle();
  const view = el('div', { class: 'pf-view', role: 'dialog', 'aria-label': 'Profiles' });
  const shell = el('div', { class: 'pf-shell' });
  const bar = el('div', { class: 'pf-bar' });
  bar.appendChild(el('div', { class: 'pf-h' }, 'Profiles'));
  const closeBtn = el('button', { type: 'button', class: 'pf-close', 'aria-label': 'Close' }, '\u00d7');
  bar.appendChild(closeBtn);
  shell.appendChild(bar);
  shell.appendChild(el('div', { class: 'pf-sub' }, 'The people you keep. Read any of them on their own, or set two side by side in Compatibility. Saved here, they follow you across your devices.'));

  const selfWrap = el('div');
  shell.appendChild(selfWrap);
  const listWrap = el('div');
  shell.appendChild(listWrap);

  /* the add form */
  const add = el('div', { class: 'pf-add' });
  add.appendChild(el('label', { for: 'pfName' }, 'Name'));
  const nameInput = el('input', { type: 'text', id: 'pfName', placeholder: 'A name to recognise them by' }) as HTMLInputElement;
  add.appendChild(nameInput);
  add.appendChild(el('label', { for: 'pfDob' }, 'Birth date'));
  const dobInput = el('input', { type: 'date', id: 'pfDob' }) as HTMLInputElement;
  add.appendChild(dobInput);
  const addBtn = el('button', { type: 'button', class: 'pf-add-btn' }, 'Save this person');
  add.appendChild(addBtn);
  const addNote = el('div', { class: 'pf-note' }, 'Birth time and place, for the full chart, come later with the transits.');
  add.appendChild(addNote);

  function renderSelf(): void {
    clear(selfWrap);
    selfWrap.appendChild(el('div', { class: 'pf-section' }, 'You'));
    const self = o.repo.getProfile();
    if (self && self.birthDate) {
      const card = el('div', { class: 'pf-card' });
      const meta = el('div', { class: 'pf-meta' });
      meta.appendChild(el('div', { class: 'pf-name' }, self.name || 'You'));
      meta.appendChild(el('div', { class: 'pf-born' }, birthLabel(self)));
      card.appendChild(meta);
      const read = el('button', { type: 'button', class: 'pf-read' }, 'Read');
      read.addEventListener('click', () => o.onRead(self, self.name || 'You'));
      card.appendChild(read);
      selfWrap.appendChild(card);
    } else {
      selfWrap.appendChild(el('div', { class: 'pf-empty' }, 'Add your birth date on the home, through Make it yours, to read yourself here.'));
    }
  }

  function renderList(): void {
    clear(listWrap);
    listWrap.appendChild(el('div', { class: 'pf-section' }, 'Saved people'));
    const saved = o.repo.listSavedProfiles();
    if (!saved.length) {
      listWrap.appendChild(el('div', { class: 'pf-empty' }, 'No one saved yet. Add a person below.'));
    } else {
      for (const p of saved) {
        const card = el('div', { class: 'pf-card' });
        const meta = el('div', { class: 'pf-meta' });
        meta.appendChild(el('div', { class: 'pf-name' }, p.name || 'Unnamed'));
        meta.appendChild(el('div', { class: 'pf-born' }, birthLabel(p)));
        card.appendChild(meta);
        const read = el('button', { type: 'button', class: 'pf-read' }, 'Read');
        read.addEventListener('click', () => o.onRead(p, p.name || 'This person'));
        card.appendChild(read);
        const remove = el('button', { type: 'button', class: 'pf-remove', 'aria-label': 'Remove ' + (p.name || 'this person') }, '\u00d7');
        remove.addEventListener('click', () => { void o.repo.removeSavedProfile(p.id).then(renderList); });
        card.appendChild(remove);
        listWrap.appendChild(card);
      }
    }
    listWrap.appendChild(add);
  }

  addBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    const birthDate = dobInput.value;
    if (!name) { nameInput.focus(); return; }
    if (!birthDate) { dobInput.focus(); return; }
    void o.repo.addSavedProfile({ name, birthDate }).then(() => {
      nameInput.value = '';
      dobInput.value = '';
      renderList();
    });
  });

  renderSelf();
  renderList();
  view.appendChild(shell);
  o.container.appendChild(view);

  function close(): void { if (view.parentNode) view.parentNode.removeChild(view); }
  closeBtn.addEventListener('click', close);
  return { close };
}
