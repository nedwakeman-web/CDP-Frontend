/**
 * CDP Vessel, surface layer: Compatibility.
 *
 * Two people set side by side. The pickers are drawn from the saved profiles,
 * the self and anyone kept in Profiles, so a comparison is a matter of choosing
 * two and a topic. It calls the live /api/compatibility engine, which weighs
 * the six frameworks and returns the synastry as prose. This surface composes
 * nothing of its own; it gathers the two people, asks the engine, and renders.
 *
 * House style holds here: no em dashes, no en dashes, no exclamation marks,
 * and no spaced hyphen patterns.
 */

import type { VesselRepository } from '../data/repository';
import type { Lens, VesselProfile } from '../data/model';
import { shareControls } from './share';

export interface OpenCompatibilityOptions {
  container: HTMLElement;
  repo: VesselRepository;
  getProfile: () => VesselProfile | null;
  getLens: () => Lens;
  reflect?: (note: string) => void;
}
export interface CompatibilityHandle { close(): void; }

type Attrs = Record<string, string>;
function el(tag: string, attrs: Attrs = {}, text?: string): HTMLElement {
  const node = document.createElement(tag);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  if (text !== undefined) node.textContent = text;
  return node;
}
function clear(node: HTMLElement): void { while (node.firstChild) node.removeChild(node.firstChild); }
function paragraphs(text: unknown): string[] {
  return String(text == null ? '' : text).split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
}

interface PickPerson { id: string; name: string; birthDate?: string; }
interface PersonPayload { name: string; birthYear?: number; birthMonth?: number; birthDay?: number; }
function toPayload(p: PickPerson): PersonPayload {
  const out: PersonPayload = { name: p.name };
  if (p.birthDate && /^\d{4}-\d{2}-\d{2}$/.test(p.birthDate)) {
    out.birthYear = Number(p.birthDate.slice(0, 4));
    out.birthMonth = Number(p.birthDate.slice(5, 7));
    out.birthDay = Number(p.birthDate.slice(8, 10));
  }
  return out;
}

const TOPICS: Array<{ label: string; value: string }> = [
  { label: 'In general', value: 'their connection in general' },
  { label: 'Romantic', value: 'a romantic relationship' },
  { label: 'Friendship', value: 'a friendship' },
  { label: 'Family', value: 'a family relationship' },
  { label: 'Working together', value: 'working together' },
];

const STYLE_ID = 'cdp-compat-style';
function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const css = [
    '.cdp-surface .cm-view{position:fixed;top:58px;left:0;right:0;bottom:0;z-index:60;background:var(--bg,#0A1828);overflow-y:auto;padding:24px 18px 64px}',
    '.cdp-surface .cm-shell{max-width:44rem;margin:0 auto}',
    '.cdp-surface .cm-bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}',
    '.cdp-surface .cm-h{font-family:Cinzel,Georgia,serif;font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold,#C9A050)}',
    '.cdp-surface .cm-close{background:none;border:none;cursor:pointer;color:var(--text-dim,#D4C8AE);font-size:22px;line-height:1;padding:4px 8px}',
    '.cdp-surface .cm-pickers{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px}',
    '.cdp-surface .cm-pick{flex:1;min-width:150px}',
    '.cdp-surface .cm-pick label{display:block;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-faint,#9E9282);margin-bottom:4px}',
    '.cdp-surface .cm-select{width:100%;box-sizing:border-box;background:var(--navy,#0D1E33);border:1px solid var(--gold-line,#3A3320);border-radius:3px;color:var(--text-light,#F0E6CC);font-family:\'EB Garamond\',Georgia,serif;font-size:15px;padding:9px 11px}',
    '.cdp-surface .cm-go{background:var(--gold,#C9A050);color:#1A1208;border:none;border-radius:3px;font-family:Cinzel,Georgia,serif;font-size:11px;letter-spacing:.12em;text-transform:uppercase;padding:10px 18px;cursor:pointer;margin-top:4px}',
    '.cdp-surface .cm-status{font-family:\'EB Garamond\',Georgia,serif;font-style:italic;font-size:14px;color:var(--text-dim,#D4C8AE);padding:24px 4px;text-align:center;line-height:1.6}',
    '.cdp-surface .cm-headline{font-family:\'EB Garamond\',Georgia,serif;font-size:20px;line-height:1.45;color:var(--text-light,#F0E6CC);margin:18px 0}',
    '.cdp-surface .cm-card{border:1px solid var(--gold-line,#3A3320);border-radius:4px;background:var(--navy,#0D1E33);padding:13px 15px;margin-bottom:11px}',
    '.cdp-surface .cm-title{font-family:Cinzel,Georgia,serif;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold,#C9A050);margin-bottom:6px}',
    '.cdp-surface .cm-sub{font-family:\'EB Garamond\',Georgia,serif;font-size:15px;color:var(--gold-soft,#E8C878);margin-bottom:6px}',
    '.cdp-surface .cm-p{font-family:Georgia,serif;font-size:14px;line-height:1.7;color:var(--text-light,#F0E6CC);margin:0 0 10px}',
    '.cdp-surface .cm-p:last-child{margin-bottom:0}',
    '.cdp-surface .cm-question{font-family:\'EB Garamond\',Georgia,serif;font-style:italic;font-size:17px;line-height:1.55;color:var(--gold-soft,#E8C878);border-left:2px solid var(--gold-line,#3A3320);padding-left:14px;margin:16px 0}',
    '.cdp-surface .cm-closing{font-family:\'EB Garamond\',Georgia,serif;font-style:italic;font-size:17px;line-height:1.55;color:var(--text-light,#F0E6CC);text-align:center;margin:18px 2px}',
    '.cdp-surface .cm-sources{font-family:Georgia,serif;font-size:11px;line-height:1.6;color:var(--text-faint,#9E9282);margin-top:18px}',
  ].join('');
  const style = el('style', { id: STYLE_ID });
  style.textContent = css;
  document.head.appendChild(style);
}

export function openCompatibility(o: OpenCompatibilityOptions): CompatibilityHandle {
  ensureStyle();

  const people: PickPerson[] = [];
  const self = o.getProfile();
  if (self && self.birthDate) people.push({ id: 'self', name: self.name || 'You', birthDate: self.birthDate });
  for (const p of o.repo.listSavedProfiles()) people.push({ id: p.id, name: p.name || 'Unnamed', birthDate: p.birthDate });

  const view = el('div', { class: 'cm-view', role: 'dialog', 'aria-label': 'Compatibility' });
  const shell = el('div', { class: 'cm-shell' });
  const bar = el('div', { class: 'cm-bar' });
  bar.appendChild(el('div', { class: 'cm-h' }, 'Compatibility'));
  const closeBtn = el('button', { type: 'button', class: 'cm-close', 'aria-label': 'Close' }, '\u00d7');
  bar.appendChild(closeBtn);
  shell.appendChild(bar);

  if (people.length < 2) {
    shell.appendChild(el('div', { class: 'cm-status' }, 'Compatibility needs two people. Add your birth date on the home, and save at least one other person in Profiles, then come back here.'));
    view.appendChild(shell);
    o.container.appendChild(view);
    function closeEarly(): void { if (view.parentNode) view.parentNode.removeChild(view); }
    closeBtn.addEventListener('click', closeEarly);
    return { close: closeEarly };
  }

  function makeSelect(labelText: string, selectedIdx: number): { wrap: HTMLElement; select: HTMLSelectElement } {
    const wrap = el('div', { class: 'cm-pick' });
    wrap.appendChild(el('label', {}, labelText));
    const select = el('select', { class: 'cm-select' }) as HTMLSelectElement;
    people.forEach((p, i) => {
      const opt = el('option', { value: String(i) }, p.name) as HTMLOptionElement;
      if (i === selectedIdx) opt.selected = true;
      select.appendChild(opt);
    });
    wrap.appendChild(select);
    return { wrap, select };
  }

  const pickers = el('div', { class: 'cm-pickers' });
  const a = makeSelect('First person', 0);
  const b = makeSelect('Second person', people.length > 1 ? 1 : 0);
  const topicWrap = el('div', { class: 'cm-pick' });
  topicWrap.appendChild(el('label', {}, 'The relationship'));
  const topicSelect = el('select', { class: 'cm-select' }) as HTMLSelectElement;
  TOPICS.forEach((t, i) => {
    const opt = el('option', { value: t.value }, t.label) as HTMLOptionElement;
    if (i === 0) opt.selected = true;
    topicSelect.appendChild(opt);
  });
  topicWrap.appendChild(topicSelect);
  pickers.appendChild(a.wrap);
  pickers.appendChild(b.wrap);
  pickers.appendChild(topicWrap);
  shell.appendChild(pickers);

  const goBtn = el('button', { type: 'button', class: 'cm-go' }, 'See the connection');
  shell.appendChild(goBtn);
  const status = el('div', { class: 'cm-status' });
  shell.appendChild(status);
  const content = el('div', { class: 'cm-content' });
  shell.appendChild(content);

  let shareInserted = false;
  function ensureShareBar(label: string): void {
    if (shareInserted) return;
    shareInserted = true;
    shell.appendChild(shareControls({
      title: label,
      text: () => label + '\n\n' + content.innerText,
      node: () => content,
    }));
  }

  function strCard(title: string, value: unknown): void {
    const ps = paragraphs(value);
    if (!ps.length) return;
    const card = el('div', { class: 'cm-card' });
    card.appendChild(el('div', { class: 'cm-title' }, title));
    for (const p of ps) card.appendChild(el('p', { class: 'cm-p' }, p));
    content.appendChild(card);
  }
  function pairCard(title: string, value: unknown): void {
    if (!value || typeof value !== 'object') { strCard(title, value); return; }
    const v = value as Record<string, unknown>;
    const ps = paragraphs(v.body);
    if (!ps.length && !v.headline) return;
    const card = el('div', { class: 'cm-card' });
    card.appendChild(el('div', { class: 'cm-title' }, title));
    if (v.headline) card.appendChild(el('div', { class: 'cm-sub' }, String(v.headline)));
    for (const p of ps) card.appendChild(el('p', { class: 'cm-p' }, p));
    content.appendChild(card);
  }

  function render(raw: unknown, nameA: string, nameB: string): void {
    clear(content);
    const r = (raw && typeof raw === 'object') ? (raw as Record<string, unknown>) : {};
    if (r.raw === true || (!r.synthesis && !r.headline)) {
      content.appendChild(el('div', { class: 'cm-status' }, 'The reading came back in an unexpected shape. The engine is reachable; please try again in a moment.'));
      return;
    }
    if (r.headline) content.appendChild(el('div', { class: 'cm-headline' }, String(r.headline)));
    strCard('The synthesis', r.synthesis);
    strCard('Where the frameworks meet', r.framework_convergence);
    pairCard('Gifts', r.gifts);
    pairCard('Tensions', r.tensions);
    pairCard('On this', r.topic_specific);
    strCard('Numerology', r.numerology_connection);
    strCard('Dreamspell', r.dreamspell_connection);
    strCard('Natal moon', r.natal_moon_connection);
    strCard('Chinese zodiac', r.chinese_connection);
    strCard('Biorhythm today', r.biorhythm_today);
    const forThem = r.for_them as Record<string, unknown> | undefined;
    if (forThem) {
      strCard('For ' + nameA, forThem.for_a);
      strCard('For ' + nameB, forThem.for_b);
    }
    if (r.a_question_to_sit_with) {
      const q = el('div', { class: 'cm-question' }, String(r.a_question_to_sit_with));
      content.appendChild(q);
    }
    if (r.closing) content.appendChild(el('div', { class: 'cm-closing' }, String(r.closing)));
    if (r.sources) content.appendChild(el('div', { class: 'cm-sources' }, String(r.sources)));
    ensureShareBar('Compatibility, ' + nameA + ' and ' + nameB);
  }

  async function run(): Promise<void> {
    const pa = people[Number(a.select.value)];
    const pb = people[Number(b.select.value)];
    if (pa.id === pb.id) { status.textContent = 'Choose two different people to compare.'; return; }
    if (!pa.birthDate || !pb.birthDate) { status.textContent = 'Both people need a birth date saved.'; return; }
    clear(content);
    shareInserted = false;
    goBtn.setAttribute('disabled', 'true');
    status.textContent = 'Reading the connection between ' + pa.name + ' and ' + pb.name + '. This takes a short moment.';
    try {
      const res = await fetch('/api/compatibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personA: toPayload(pa), personB: toPayload(pb), topic: topicSelect.value }),
      });
      const data = await res.json();
      status.textContent = '';
      render(data, pa.name, pb.name);
      if (o.reflect) o.reflect('The connection between ' + pa.name + ' and ' + pb.name + ' is read.');
    } catch (_e) {
      status.textContent = 'The compatibility engine could not be reached just now. Please try again in a moment.';
    } finally {
      goBtn.removeAttribute('disabled');
    }
  }
  goBtn.addEventListener('click', () => { void run(); });

  view.appendChild(shell);
  o.container.appendChild(view);
  function close(): void { if (view.parentNode) view.parentNode.removeChild(view); }
  closeBtn.addEventListener('click', close);
  return { close };
}
