/**
 * CDP Vessel, surface layer: Profiles, the people you keep.
 *
 * The library of saved people, the self and anyone kept, each callable on their
 * own or set side by side in Compatibility. Built to the monolith profile
 * library floor (cards, save, recall, delete, the self pinned first) and then
 * above it: a saved person is captured at the same depth as the user, through
 * the one deep form, so Compatibility can compare two lives and not only two
 * charts. There is no second-rate capture for other people.
 *
 * The data layer already holds the depth. StoredProfile extends VesselProfile,
 * and the repository lists, adds, recalls, updates, and removes saved people.
 * This surface is the missing window onto that, nothing more, nothing thinner.
 *
 * Quick add captures the basics so a person exists at once and can enter a
 * comparison. Edit opens the full deep form (identity, birth details with
 * place to coordinate capture, life context) for everything else. The hormonal
 * cycle is on device and personal, so it is shown for the self only, never for
 * a saved person.
 *
 * House style holds here, in code, comments, and visible strings alike: no em
 * dashes, no en dashes, no exclamation marks, and no spaced hyphen patterns.
 */

import type { VesselRepository } from '../data/repository';
import type { Lens, VesselProfile, StoredProfile } from '../data/model';
import { kinDescriptor, reduceNumber } from '../coordinates-core';
import { openProfile, type ProfileHandle, type ProfileSubject } from './profile';

export interface OpenProfilesOptions {
  container: HTMLElement;
  repo: VesselRepository;
  getLens: () => Lens;
  reflect?: (note: string) => void;
  /** Open a reading for one person. The label is the person's name. */
  onRead: (profile: VesselProfile, label: string) => void;
  /** Fired whenever a profile in the library is saved, added, or removed, so a
   *  host surface can refresh anything that reads from the profile (the home
   *  signature, the compass scaffold, the active reading). */
  onChanged?: () => void;
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

/* ---- numbers and dates, from the corrected core so surfaces agree ---------- */

const MASTERS = new Set([11, 22, 33, 44]);
function isMaster(n: number): boolean { return MASTERS.has(n); }
function digitSum(n: number): number { return String(n).split('').reduce((s, d) => s + Number(d), 0); }
function lifePath(birthDate: string): { value: number; master: boolean } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!m) return { value: 0, master: false };
  const month = reduceNumber(Number(m[2])).value;
  const day = reduceNumber(Number(m[3])).value;
  const year = reduceNumber(digitSum(Number(m[1]))).value;
  const v = reduceNumber(month + day + year).value;
  return { value: v, master: isMaster(v) };
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function formatDob(iso?: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return 'No birth date yet';
  return Number(m[3]) + ' ' + MONTHS[Number(m[2]) - 1] + ' ' + m[1];
}
function safeStr(v: unknown): string {
  return (v === null || v === undefined || typeof v === 'object') ? '' : String(v);
}

const STYLE_ID = 'cdp-profiles-style';
function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const css = [
    '.cdp-surface .pl-view{position:fixed;top:58px;left:0;right:0;bottom:0;z-index:60;background:var(--bg,#0A1828);overflow-y:auto;padding:24px 18px 72px}',
    '.cdp-surface .pl-shell{max-width:42rem;margin:0 auto}',
    '.cdp-surface .pl-bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}',
    '.cdp-surface .pl-h{font-family:Cinzel,Georgia,serif;font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold,#C9A050)}',
    '.cdp-surface .pl-close{background:none;border:none;cursor:pointer;color:var(--text-dim,#D4C8AE);font-size:22px;line-height:1;padding:4px 8px}',
    '.cdp-surface .pl-close:hover{color:var(--gold,#C9A050)}',
    '.cdp-surface .pl-title{font-family:\'EB Garamond\',Georgia,serif;font-size:26px;color:var(--gold,#C9A050);text-align:center;margin:8px 0 6px}',
    '.cdp-surface .pl-intro{font-family:\'EB Garamond\',Georgia,serif;font-size:14px;color:var(--text-dim,#D4C8AE);text-align:center;line-height:1.6;margin:0 auto 18px;max-width:34rem}',
    '.cdp-surface .pl-section{font-family:Cinzel,Georgia,serif;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--text-dim,#D4C8AE);margin:24px 0 8px;border-top:1px solid rgba(191,163,99,.12);padding-top:18px}',
    '.cdp-surface .pl-card{display:flex;align-items:center;gap:12px;border:1px solid var(--gold-line,#3A3320);border-radius:5px;background:var(--navy,#0D1E33);padding:13px 15px;margin-bottom:10px}',
    '.cdp-surface .pl-card.active{border-color:var(--gold,#C9A050);background:rgba(201,160,80,.06)}',
    '.cdp-surface .pl-avatar{width:40px;height:40px;flex:0 0 40px;border-radius:50%;background:var(--raised,#13284A);border:1px solid var(--gold-line,#3A3320);display:flex;align-items:center;justify-content:center;font-family:\'EB Garamond\',Georgia,serif;font-size:20px;color:var(--gold,#C9A050)}',
    '.cdp-surface .pl-info{flex:1;min-width:0}',
    '.cdp-surface .pl-name{font-family:\'EB Garamond\',Georgia,serif;font-size:20px;color:var(--gold,#C9A050);line-height:1.2}',
    '.cdp-surface .pl-rel{font-family:Georgia,serif;font-size:13px;color:var(--gold-soft,#E8C878)}',
    '.cdp-surface .pl-meta{font-family:Georgia,serif;font-size:13px;line-height:1.5;color:var(--text-dim,#D4C8AE);margin-top:2px}',
    '.cdp-surface .pl-kin{font-family:Georgia,serif;font-size:13px;line-height:1.5;color:var(--teal,#81CDB6)}',
    '.cdp-surface .pl-actions{display:flex;align-items:center;gap:6px;flex:0 0 auto}',
    '.cdp-surface .pl-btn{background:none;border:1px solid var(--gold,#C9A050);color:var(--gold,#C9A050);font-family:Cinzel,Georgia,serif;font-size:10px;letter-spacing:.12em;text-transform:uppercase;padding:8px 12px;border-radius:3px;cursor:pointer}',
    '.cdp-surface .pl-btn:hover{background:rgba(201,160,80,.1)}',
    '.cdp-surface .pl-btn.ghost{border-color:var(--gold-line,#3A3320);color:var(--text-dim,#D4C8AE)}',
    '.cdp-surface .pl-del{background:none;border:none;color:var(--text-dim,#D4C8AE);font-size:18px;line-height:1;cursor:pointer;padding:4px 8px}',
    '.cdp-surface .pl-del:hover{color:var(--gold,#C9A050)}',
    '.cdp-surface .pl-empty{font-family:\'EB Garamond\',Georgia,serif;font-size:14px;line-height:1.6;color:var(--text-dim,#D4C8AE);padding:6px 2px 12px}',
    '.cdp-surface .pl-add{display:block;width:100%;box-sizing:border-box;background:none;border:1px dashed var(--gold-line,#3A3320);color:var(--gold,#C9A050);font-family:Cinzel,Georgia,serif;font-size:11px;letter-spacing:.14em;text-transform:uppercase;padding:13px;border-radius:4px;cursor:pointer;margin-top:6px}',
    '.cdp-surface .pl-add:hover{background:rgba(201,160,80,.06)}',
    '.cdp-surface .pl-form{border:1px solid var(--gold-line,#3A3320);border-radius:5px;background:var(--navy,#0D1E33);padding:14px 15px;margin-top:8px}',
    '.cdp-surface .pl-field{margin:0 0 12px}',
    '.cdp-surface .pl-label{display:block;font-family:Cinzel,Georgia,serif;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-dim,#D4C8AE);margin-bottom:5px}',
    '.cdp-surface .pl-in,.cdp-surface .pl-sel{width:100%;box-sizing:border-box;background:var(--bg,#0A1828);border:1px solid var(--gold-line,#3A3320);border-radius:3px;color:var(--text-light,#F0E6CC);font-family:\'EB Garamond\',Georgia,serif;font-size:16px;padding:10px 12px}',
    '.cdp-surface .pl-dob{display:flex;gap:8px}',
    '.cdp-surface .pl-dob .pl-sel{flex:1}',
    '.cdp-surface .pl-save{background:var(--gold,#C9A050);color:#1A1208;border:none;border-radius:3px;font-family:Cinzel,Georgia,serif;font-size:11px;letter-spacing:.12em;text-transform:uppercase;padding:11px 18px;cursor:pointer;margin-top:2px}',
    '.cdp-surface .pl-formnote{font-family:Georgia,serif;font-size:13px;line-height:1.5;color:var(--text-dim,#D4C8AE);margin-top:10px}',
  ].join('');
  const style = el('style', { id: STYLE_ID });
  style.textContent = css;
  document.head.appendChild(style);
}

export function openProfiles(o: OpenProfilesOptions): ProfilesHandle {
  ensureStyle();

  const view = el('div', { class: 'pl-view', role: 'dialog', 'aria-label': 'Profiles' });
  const shell = el('div', { class: 'pl-shell' });

  const bar = el('div', { class: 'pl-bar' });
  bar.appendChild(el('div', { class: 'pl-h' }, 'Profiles'));
  const closeBtn = el('button', { type: 'button', class: 'pl-close', 'aria-label': 'Close' }, '\u00d7');
  bar.appendChild(closeBtn);
  shell.appendChild(bar);

  shell.appendChild(el('div', { class: 'pl-title' }, 'Profiles'));
  shell.appendChild(el('div', { class: 'pl-intro' }, 'The people you keep. Read any of them on their own, or set two side by side in Compatibility. Saved here, they follow you across your devices.'));

  const body = el('div', {});
  shell.appendChild(body);

  // The deep editor is opened over this surface. We keep one handle so a second
  // open closes the first, and we refresh the list when it closes.
  let editorHandle: ProfileHandle | null = null;
  function openEditor(subject?: ProfileSubject): void {
    if (editorHandle) { editorHandle.close(); editorHandle = null; }
    editorHandle = openProfile({
      container: o.container,
      repo: o.repo,
      getLens: o.getLens,
      reflect: o.reflect,
      subject,
      // Every autosave refreshes the library beneath, so cards stay current.
      onSaved: () => { renderAll(); if (o.onChanged) o.onChanged(); },
    });
  }

  function card(p: { id: string; name?: string; relationship?: string; birthDate?: string }, isSelf: boolean): HTMLElement {
    const wrap = el('div', { class: 'pl-card' });
    const initial = (safeStr(p.name).trim() || (isSelf ? 'You' : '?')).slice(0, 1).toUpperCase();
    wrap.appendChild(el('div', { class: 'pl-avatar' }, initial));

    const info = el('div', { class: 'pl-info' });
    const nameLine = el('div', { class: 'pl-name' }, safeStr(p.name).trim() || (isSelf ? 'You' : 'Unnamed'));
    if (p.relationship && safeStr(p.relationship).trim()) {
      nameLine.appendChild(el('span', { class: 'pl-rel' }, '  \u00b7  ' + safeStr(p.relationship).trim()));
    }
    info.appendChild(nameLine);
    info.appendChild(el('div', { class: 'pl-meta' }, formatDob(p.birthDate)));
    if (p.birthDate && /^\d{4}-\d{2}-\d{2}$/.test(p.birthDate)) {
      const lp = lifePath(p.birthDate);
      const kd = kinDescriptor(p.birthDate);
      info.appendChild(el('div', { class: 'pl-meta' }, 'Life Path ' + lp.value + (lp.master ? ' (master)' : '')));
      info.appendChild(el('div', { class: 'pl-kin' }, kd.full));
    }
    wrap.appendChild(info);

    const actions = el('div', { class: 'pl-actions' });
    const readBtn = el('button', { type: 'button', class: 'pl-btn' }, 'Read');
    readBtn.addEventListener('click', () => {
      if (isSelf) {
        const self = o.repo.getProfile();
        o.onRead(self || {}, (self && self.name) ? self.name : 'You');
      } else {
        const full = o.repo.getSavedProfile(p.id);
        o.onRead(full || p, safeStr(p.name).trim() || 'this person');
      }
    });
    actions.appendChild(readBtn);

    const editBtn = el('button', { type: 'button', class: 'pl-btn ghost' }, 'Edit');
    editBtn.addEventListener('click', () => {
      if (isSelf) { openEditor(undefined); return; }
      const subject: ProfileSubject = {
        title: (safeStr(p.name).trim() || 'This person') + ' profile',
        saveLabel: 'Save profile',
        showCycle: false,
        get: () => o.repo.getSavedProfile(p.id) || {},
        persist: (vals: VesselProfile) => o.repo.updateSavedProfile(p.id, vals),
      };
      openEditor(subject);
    });
    actions.appendChild(editBtn);

    if (!isSelf) {
      const del = el('button', { type: 'button', class: 'pl-del', 'aria-label': 'Remove ' + (safeStr(p.name).trim() || 'this person') }, '\u00d7');
      del.addEventListener('click', () => {
        const who = safeStr(p.name).trim() || 'this person';
        if (!window.confirm('Remove ' + who + ' from your saved people. This does not affect their own data, only your library.')) return;
        void o.repo.removeSavedProfile(p.id).then(() => { if (o.reflect) o.reflect(who + ' was removed from your people.'); renderAll(); if (o.onChanged) o.onChanged(); });
      });
      actions.appendChild(del);
    }
    wrap.appendChild(actions);
    return wrap;
  }

  /* ---- quick add: name, relationship, date, so a person exists at once ----- */
  function quickAddPanel(onClose: () => void): HTMLElement {
    const form = el('div', { class: 'pl-form' });

    const nameField = el('div', { class: 'pl-field' });
    nameField.appendChild(el('label', { class: 'pl-label' }, 'Name'));
    const nameIn = el('input', { class: 'pl-in', type: 'text', placeholder: 'A name to recognise them by' }) as HTMLInputElement;
    nameField.appendChild(nameIn);
    form.appendChild(nameField);

    const relField = el('div', { class: 'pl-field' });
    relField.appendChild(el('label', { class: 'pl-label' }, 'Relationship'));
    const relIn = el('input', { class: 'pl-in', type: 'text', placeholder: 'partner, child, co-founder, friend' }) as HTMLInputElement;
    relField.appendChild(relIn);
    form.appendChild(relField);

    const dobField = el('div', { class: 'pl-field' });
    dobField.appendChild(el('label', { class: 'pl-label' }, 'Birth date'));
    const dobRow = el('div', { class: 'pl-dob' });
    const daySel = el('select', { class: 'pl-sel', 'aria-label': 'Day' }) as HTMLSelectElement;
    const monthSel = el('select', { class: 'pl-sel', 'aria-label': 'Month' }) as HTMLSelectElement;
    const yearSel = el('select', { class: 'pl-sel', 'aria-label': 'Year' }) as HTMLSelectElement;
    daySel.appendChild(el('option', { value: '' }, 'Day'));
    for (let d = 1; d <= 31; d++) daySel.appendChild(el('option', { value: String(d) }, String(d)));
    monthSel.appendChild(el('option', { value: '' }, 'Month'));
    MONTHS.forEach((m, i) => monthSel.appendChild(el('option', { value: String(i + 1) }, m)));
    yearSel.appendChild(el('option', { value: '' }, 'Year'));
    const thisYear = new Date().getFullYear();
    for (let y = thisYear; y >= 1900; y--) yearSel.appendChild(el('option', { value: String(y) }, String(y)));
    dobRow.appendChild(daySel); dobRow.appendChild(monthSel); dobRow.appendChild(yearSel);
    dobField.appendChild(dobRow);
    form.appendChild(dobField);

    const save = el('button', { type: 'button', class: 'pl-save' }, 'Save this person');
    save.addEventListener('click', () => {
      const name = nameIn.value.trim();
      if (!name) { nameIn.focus(); return; }
      const entry: VesselProfile & { relationship?: string } = { name };
      const rel = relIn.value.trim();
      if (rel) entry.relationship = rel;
      const d = daySel.value, m = monthSel.value, y = yearSel.value;
      if (d && m && y) {
        entry.birthDate = y + '-' + String(Number(m)).padStart(2, '0') + '-' + String(Number(d)).padStart(2, '0');
      }
      void o.repo.addSavedProfile(entry).then(() => {
        if (o.reflect) o.reflect(name + ' is saved to your people.');
        onClose();
        renderAll();
        if (o.onChanged) o.onChanged();
      });
    });
    form.appendChild(save);
    form.appendChild(el('div', { class: 'pl-formnote' }, 'Name is enough to begin. Add birth time and place, and the deeper context, with Edit once they are saved. The depth is what lets a comparison read two lives, not only two charts.'));
    return form;
  }

  /* ---- render the whole library from the repository ----------------------- */
  function renderAll(): void {
    clear(body);

    // You, pinned first.
    body.appendChild(el('div', { class: 'pl-section' }, 'You'));
    const self = o.repo.getProfile();
    if (self && (self.name || self.birthDate)) {
      body.appendChild(card({ id: 'me', name: self.name, birthDate: self.birthDate }, true));
    } else {
      const prompt = el('div', { class: 'pl-empty' }, 'Your own profile is not set yet. Add your details so the Oracle can read for you and so you can be one side of a comparison.');
      body.appendChild(prompt);
      const makeMine = el('button', { type: 'button', class: 'pl-add' }, 'Make my profile mine');
      makeMine.addEventListener('click', () => openEditor(undefined));
      body.appendChild(makeMine);
    }

    // Saved people.
    body.appendChild(el('div', { class: 'pl-section' }, 'Saved people'));
    const saved: StoredProfile[] = o.repo.listSavedProfiles();
    if (saved.length === 0) {
      body.appendChild(el('div', { class: 'pl-empty' }, 'No one saved yet. Add the people who matter, a partner, a child, a co-founder, and you can read for any of them or set two side by side.'));
    } else {
      for (const p of saved) body.appendChild(card(p, false));
    }

    // Add a person, revealing the quick add panel.
    const addBtn = el('button', { type: 'button', class: 'pl-add' }, 'Add a person');
    let panel: HTMLElement | null = null;
    addBtn.addEventListener('click', () => {
      if (panel) { if (panel.parentNode) panel.parentNode.removeChild(panel); panel = null; return; }
      panel = quickAddPanel(() => { if (panel && panel.parentNode) panel.parentNode.removeChild(panel); panel = null; });
      body.appendChild(panel);
      panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    body.appendChild(addBtn);
  }
  renderAll();

  view.appendChild(shell);
  o.container.appendChild(view);

  function close(): void {
    if (editorHandle) { editorHandle.close(); editorHandle = null; }
    if (view.parentNode) view.parentNode.removeChild(view);
  }
  closeBtn.addEventListener('click', close);
  return { close };
}
