/**
 * CDP Vessel, surface layer: My year, the long view and cosmic context.
 *
 * Built to the Sky Standard, not the floor. The computed long view (the
 * universal year, the personal year and its arc, the fixed signature) renders
 * instantly from the corrected core, with the canonical Life Path that matches
 * the card and the compatibility surface, so no number disagrees across the
 * Vessel. On that base sit the four moves of the measurable impact model:
 *
 *   1. The located 'this landed' tap, attached to the section, voice, and
 *      framework, so attribution is carried by the tap, not asked for.
 *   2. The opportunistic reflection, what gathered since you were last here,
 *      the home telescope and, foregrounded, the cross telescope rate.
 *   3. The live bridge, the personal year turned to the other telescope on the
 *      same coordinate, where the tap is the cross telescope signal.
 *   4. The emergent surface, the felt made legible, patterns named from the
 *      person's own signal, always as observation and never as forecast, and
 *      with the null named as readily as the pattern.
 *
 * The signal is read and written through the options, so the host owns
 * persistence. When the signal is thin the surface says so honestly rather
 * than inventing a pattern. No reading collapses to the home lens; the bridge
 * is always offered, because the breakthrough is the value.
 *
 * House style holds here: no em dashes, no en dashes, no exclamation marks,
 * and no spaced hyphen patterns.
 */

import type { Lens, VesselProfile, HeldIntention, VesselSignal } from '../data/model';
import { kinForDate, kinDescriptor, personalNumerology, reduceNumber } from '../coordinates-core';
import { NUM_DATA, PY_ARC } from '../data/numerology-content';
import { shareControls } from './share';
import { citationsForClaim } from '../data/bibliography';
import { homeTelescope, crossTelescopeRate, intentionRhythm, bothTelescopesProven } from '../data/outcome-signal';

export interface OpenYearOptions {
  container: HTMLElement;
  getProfile: () => VesselProfile | null;
  getLens: () => Lens;
  reflect?: (note: string) => void;
  /** When present, sections tap into the Compass and the bridge composes in place. */
  composeAsk?: (prompt: string) => Promise<string>;
  /** The accumulated located taps and outcomes, the person's own signal. */
  getSignals?: () => VesselSignal[];
  /** Record a located 'this landed' tap. */
  recordSignal?: (s: VesselSignal) => void;
  /** The held intentions, for what is moving. */
  getIntentions?: () => HeldIntention[];
  /** Record the person's own verdict on a held intention. */
  recordOutcome?: (intentionId: string, moved: 'well' | 'waiting' | 'mixed') => void;
}
export interface YearHandle { close(): void; }

type Attrs = Record<string, string>;
function el(tag: string, attrs: Attrs = {}, text?: string): HTMLElement {
  const node = document.createElement(tag);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  if (text !== undefined) node.textContent = text;
  return node;
}

/* ---- numbers, the canonical forms used across every surface ---------------- */

const MASTERS = new Set([11, 22, 33, 44]);
function isMaster(n: number): boolean { return MASTERS.has(n); }
function digitsOf(n: number): number { return String(n).split('').reduce((s, d) => s + Number(d), 0); }
function numName(n: number): string { const d = NUM_DATA[n]; return d ? d.n : ''; }
function lifePath(birthDate: string): { value: number; master: boolean } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!m) return { value: 0, master: false };
  const month = reduceNumber(Number(m[2])).value;
  const day = reduceNumber(Number(m[3])).value;
  const year = reduceNumber(digitsOf(Number(m[1]))).value;
  const v = reduceNumber(month + day + year).value;
  return { value: v, master: isMaster(v) };
}

/* ---- sources, quiet, from the bibliography -------------------------------- */
function sourcesLine(): string {
  const claims = ['numerology_day_quality', 'dreamspell_count', 'pacing_circadian'];
  const seen: Record<string, boolean> = {};
  const out: string[] = [];
  for (const c of claims) {
    for (const cite of citationsForClaim(c)) {
      if (!cite.counterweight && cite.display && !seen[cite.display]) { seen[cite.display] = true; out.push(cite.display); break; }
    }
  }
  return out.length ? 'Grounded in ' + out.slice(0, 4).join(', ') : '';
}

const STYLE_ID = 'cdp-year-style';
function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const css = [
    '.cdp-surface .yr-view{position:fixed;top:58px;left:0;right:0;bottom:0;z-index:60;background:var(--bg,#0A1828);overflow-y:auto;padding:24px 18px 64px}',
    '.cdp-surface .yr-shell{max-width:44rem;margin:0 auto}',
    '.cdp-surface .yr-bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}',
    '.cdp-surface .yr-h{font-family:Cinzel,Georgia,serif;font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold,#C9A050)}',
    '.cdp-surface .yr-close{background:none;border:none;cursor:pointer;color:var(--text-dim,#D4C8AE);font-size:22px;line-height:1;padding:4px 8px}',
    '.cdp-surface .yr-close:hover{color:var(--gold,#C9A050)}',
    '.cdp-surface .yr-section{font-family:Cinzel,Georgia,serif;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--text-faint,#9E9282);margin:24px 0 10px}',
    '.cdp-surface .yr-card{display:flex;gap:14px;border:1px solid var(--gold-line,#3A3320);border-radius:4px;background:var(--navy,#0D1E33);padding:14px 16px;margin-bottom:11px}',
    '.cdp-surface .yr-num{font-family:\'EB Garamond\',Georgia,serif;font-size:34px;line-height:1;color:var(--gold,#C9A050);min-width:46px;text-align:center}',
    '.cdp-surface .yr-num.master{color:var(--master,#C8A0FF)}',
    '.cdp-surface .yr-body{flex:1;min-width:0}',
    '.cdp-surface .yr-label{font-family:Cinzel,Georgia,serif;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-faint,#9E9282)}',
    '.cdp-surface .yr-title{font-family:\'EB Garamond\',Georgia,serif;font-size:19px;color:var(--text-light,#F0E6CC);margin:2px 0 6px}',
    '.cdp-surface .yr-key{font-size:12px;color:var(--gold-soft,#E8C878);margin-bottom:6px}',
    '.cdp-surface .yr-desc{font-family:Georgia,serif;font-size:14px;line-height:1.7;color:var(--text-light,#F0E6CC)}',
    '.cdp-surface .yr-kin{font-family:\'EB Garamond\',Georgia,serif;font-size:17px;color:var(--text-light,#F0E6CC)}',
    '.cdp-surface .yr-symbolic{font-family:\'EB Garamond\',Georgia,serif;font-style:italic;font-size:12px;color:var(--text-faint,#9E9282);margin:2px 0 14px}',
    '.cdp-surface .yr-empty{font-family:\'EB Garamond\',Georgia,serif;font-style:italic;font-size:14px;color:var(--text-faint,#9E9282);border:1px dashed var(--gold-line,#3A3320);border-radius:4px;padding:18px;text-align:center}',
    '.cdp-surface .yr-tap{display:inline-flex;align-items:center;gap:8px;cursor:pointer;margin-top:10px}',
    '.cdp-surface .yr-tapdot{width:12px;height:12px;border-radius:50%;border:1.2px solid var(--text-faint,#9E9282);display:inline-block}',
    '.cdp-surface .yr-tap.on .yr-tapdot{background:var(--teal,#81CDB6);border-color:var(--teal,#81CDB6)}',
    '.cdp-surface .yr-taplabel{font-family:\'EB Garamond\',Georgia,serif;font-style:italic;font-size:13px;color:var(--text-faint,#9E9282)}',
    '.cdp-surface .yr-tap.on .yr-taplabel{color:var(--teal,#81CDB6)}',
    '.cdp-surface .yr-bridge{display:block;background:none;border:none;text-align:left;cursor:pointer;font-family:Cinzel,Georgia,serif;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--teal,#81CDB6);padding:10px 0 2px}',
    '.cdp-surface .yr-emergent{border:1px solid var(--gold-line,#3A3320);border-radius:5px;background:var(--navy,#0D1E33);padding:16px 18px;margin-bottom:11px}',
    '.cdp-surface .yr-em-call{border:1px solid rgba(201,160,80,.5);border-radius:8px;background:var(--raised,#13284A);padding:13px 15px;margin:10px 0}',
    '.cdp-surface .yr-em-p{font-family:Georgia,serif;font-size:14px;line-height:1.7;color:var(--text-light,#F0E6CC);margin:0 0 8px}',
    '.cdp-surface .yr-em-em{font-family:\'EB Garamond\',Georgia,serif;font-style:italic;font-size:15px;color:var(--gold-soft,#E8C878);margin:0}',
    '.cdp-surface .yr-foot{font-family:\'EB Garamond\',Georgia,serif;font-style:italic;font-size:12px;color:var(--text-faint,#9E9282);margin-top:6px}',
    '.cdp-surface .yr-move{display:flex;align-items:flex-start;gap:10px;border:1px solid var(--gold-line,#3A3320);border-radius:4px;background:var(--navy,#0D1E33);padding:12px 14px;margin-bottom:9px}',
    '.cdp-surface .yr-move-t{flex:1;font-family:Georgia,serif;font-size:14px;line-height:1.6;color:var(--text-light,#F0E6CC)}',
    '.cdp-surface .yr-move-b{background:none;border:1px solid var(--gold-line,#3A3320);color:var(--text-dim,#D4C8AE);font-family:\'EB Garamond\',Georgia,serif;font-size:12px;padding:5px 10px;border-radius:3px;cursor:pointer;white-space:nowrap}',
    '.cdp-surface .yr-move-b.on{border-color:var(--teal,#81CDB6);color:var(--teal,#81CDB6)}',
    '.cdp-surface .yr-sources{font-family:Georgia,serif;font-size:11px;line-height:1.6;color:var(--text-faint,#9E9282);margin-top:18px;text-align:center}',
    '.cdp-surface .yr-dd-scrim{position:fixed;inset:0;z-index:80;background:rgba(4,12,24,.62);display:flex;align-items:flex-end;justify-content:center}',
    '.cdp-surface .yr-dd{width:100%;max-width:44rem;max-height:80vh;overflow-y:auto;background:var(--navy,#0D1E33);border:1px solid var(--gold-line,#3A3320);border-radius:12px 12px 0 0;padding:18px 18px 28px}',
    '.cdp-surface .yr-dd-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}',
    '.cdp-surface .yr-dd-h{font-family:Cinzel,Georgia,serif;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold,#C9A050)}',
    '.cdp-surface .yr-dd-x{background:none;border:none;color:var(--text-dim,#D4C8AE);font-size:20px;cursor:pointer}',
    '.cdp-surface .yr-dd-q{font-family:\'EB Garamond\',Georgia,serif;font-size:15px;color:var(--gold-soft,#E8C878);margin:0 0 8px}',
    '.cdp-surface .yr-dd-a{font-family:Georgia,serif;font-size:14px;line-height:1.7;color:var(--text-light,#F0E6CC)}',
  ].join('');
  const style = el('style', { id: STYLE_ID });
  style.textContent = css;
  document.head.appendChild(style);
}

function numCard(label: string, num: number, title: string, body: string): HTMLElement {
  const meaning = NUM_DATA[num];
  const card = el('div', { class: 'yr-card' });
  card.appendChild(el('div', { class: 'yr-num' + (meaning && meaning.master ? ' master' : '') }, String(num)));
  const b = el('div', { class: 'yr-body' });
  b.appendChild(el('div', { class: 'yr-label' }, label));
  b.appendChild(el('div', { class: 'yr-title' }, title));
  if (meaning && meaning.k) b.appendChild(el('div', { class: 'yr-key' }, meaning.k));
  b.appendChild(el('div', { class: 'yr-desc' }, body));
  card.appendChild(b);
  return card;
}

export function openYear(o: OpenYearOptions): YearHandle {
  ensureStyle();
  const view = el('div', { class: 'yr-view', role: 'dialog', 'aria-label': 'My year' });
  const shell = el('div', { class: 'yr-shell' });
  const bar = el('div', { class: 'yr-bar' });
  bar.appendChild(el('div', { class: 'yr-h' }, 'My year, the long view'));
  const closeBtn = el('button', { type: 'button', class: 'yr-close', 'aria-label': 'Close' }, '\u00d7');
  bar.appendChild(closeBtn);
  shell.appendChild(bar);

  const content = el('div', { class: 'yr-content' });
  shell.appendChild(content);

  const prof = o.getProfile();
  const hasBirth = !!(prof && prof.birthDate);
  const today = new Date().toISOString().slice(0, 10);
  const curYear = new Date().getUTCFullYear();
  const universalYear = reduceNumber(digitsOf(curYear)).value;

  /* ---- the in place Compass drawer; the bridge composes here -------------- */
  let ddOpen = false;
  function openAsk(prompt: string, landSig?: Partial<VesselSignal>): void {
    if (ddOpen || !o.composeAsk) return;
    ddOpen = true;
    const scrim = el('div', { class: 'yr-dd-scrim' });
    const panel = el('div', { class: 'yr-dd', role: 'dialog', 'aria-label': 'The Oracle' });
    const head = el('div', { class: 'yr-dd-head' });
    head.appendChild(el('div', { class: 'yr-dd-h' }, landSig && landSig.bridge ? 'Through the other telescope' : 'Ask the Oracle'));
    const x = el('button', { type: 'button', class: 'yr-dd-x', 'aria-label': 'Close' }, '\u00d7');
    head.appendChild(x);
    panel.appendChild(head);
    panel.appendChild(el('div', { class: 'yr-dd-q' }, prompt));
    const ans = el('div', { class: 'yr-dd-a' }, 'Composing.');
    panel.appendChild(ans);
    if (landSig && o.recordSignal) attachTap(panel, landSig, 'this landed');
    scrim.appendChild(panel);
    view.appendChild(scrim);
    function closeDD(): void { ddOpen = false; if (scrim.parentNode) scrim.parentNode.removeChild(scrim); }
    x.addEventListener('click', closeDD);
    scrim.addEventListener('click', (e: Event) => { if (e.target === scrim) closeDD(); });
    o.composeAsk(prompt).then((text) => {
      ans.textContent = '';
      const ps = String(text || '').split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
      if (ps.length) { for (const p of ps) ans.appendChild(el('p', { class: 'yr-em-p' }, p)); }
      else ans.textContent = text || 'No reply came back. Please try again in a moment.';
    }).catch(() => { ans.textContent = 'The Oracle could not be reached just now. Please try again in a moment.'; });
  }

  /* ---- the located 'this landed' tap ------------------------------------- */
  function attachTap(parent: HTMLElement, sig: Partial<VesselSignal>, label: string): void {
    if (!o.recordSignal) return;
    const wrap = el('div', { class: 'yr-tap' });
    wrap.appendChild(el('span', { class: 'yr-tapdot' }));
    const lab = el('span', { class: 'yr-taplabel' }, label);
    wrap.appendChild(lab);
    let done = false;
    wrap.addEventListener('click', () => {
      if (done) return;
      done = true;
      wrap.classList.add('on');
      lab.textContent = 'noted';
      o.recordSignal!({ at: Date.now(), date: today, kind: 'landed', surface: 'year', voice: o.getLens(), ...sig });
      if (o.reflect) o.reflect('You marked what landed.');
    });
    parent.appendChild(wrap);
  }

  /* ============ ZONE ONE: the computed long view ========================== */
  content.appendChild(el('div', { class: 'yr-section' }, 'This year, ' + String(curYear)));
  const uy = NUM_DATA[universalYear];
  content.appendChild(numCard('Universal Year', universalYear, uy ? uy.n : 'Universal Year', uy ? uy.m : ''));
  content.appendChild(el('div', { class: 'yr-symbolic' }, 'Symbolic, Pythagorean numerology. The number everyone shares this year.'));

  if (hasBirth && prof && prof.birthDate) {
    const py = personalNumerology(prof.birthDate, today).personalYear;
    const pyMeaning = NUM_DATA[py.value];
    const pyCard = numCard('Your Personal Year', py.value, pyMeaning ? pyMeaning.n : 'Personal Year', PY_ARC[py.value] || (pyMeaning ? pyMeaning.m : ''));
    // the live bridge: the same coordinate, turned to the other telescope
    if (o.composeAsk) {
      const otherLens: Lens = o.getLens() === 'science' ? 'tradition' : 'science';
      const bridge = el('button', { type: 'button', class: 'yr-bridge' }, 'Through the other telescope');
      bridge.addEventListener('click', () => {
        openAsk('My Personal Year is ' + py.value + ', ' + numName(py.value) + '. Show me this same year through the ' + (otherLens === 'science' ? 'science' : 'symbolic') + ' telescope, the same coordinate seen with the other lens.', { bridge: true, framework: 'numerology', section: 'personal-year' });
      });
      (pyCard.querySelector('.yr-body') as HTMLElement).appendChild(bridge);
    }
    attachTap(pyCard.querySelector('.yr-body') as HTMLElement, { framework: 'numerology', section: 'personal-year' }, 'this landed');
    content.appendChild(pyCard);
    content.appendChild(el('div', { class: 'yr-symbolic' }, 'Symbolic. Your own year within the nine year cycle, drawn from your birth date.'));

    content.appendChild(el('div', { class: 'yr-section' }, 'Your fixed signature, the constants'));
    const lp = lifePath(prof.birthDate);
    const lpMeaning = NUM_DATA[lp.value];
    content.appendChild(numCard('Life Path', lp.value, lpMeaning ? lpMeaning.n : 'Life Path', lpMeaning ? lpMeaning.m : ''));
    const desc = kinDescriptor(prof.birthDate);
    const kinCard = el('div', { class: 'yr-card' });
    kinCard.appendChild(el('div', { class: 'yr-num' }, String(kinForDate(prof.birthDate))));
    const kb = el('div', { class: 'yr-body' });
    kb.appendChild(el('div', { class: 'yr-label' }, 'Birth Kin, your galactic signature'));
    kb.appendChild(el('div', { class: 'yr-kin' }, desc.full + (desc.isGAP ? ' (Galactic Activation Portal)' : '')));
    kb.appendChild(el('div', { class: 'yr-symbolic' }, 'Symbolic, Dreamspell after Arguelles 1987, distinct from the living K\u2019iche\u2019 count.'));
    if (o.composeAsk) attachTap(kb, { framework: 'dreamspell', section: 'birth-kin' }, 'this landed');
    kinCard.appendChild(kb);
    content.appendChild(kinCard);
  } else {
    content.appendChild(el('div', { class: 'yr-empty' }, 'Add your birth date in your Cosmic Profile, and your personal year and fixed signature appear here alongside the universal year.'));
  }

  /* ============ ZONE TWO: the measurable impact engine ==================== */
  const signals = o.getSignals ? o.getSignals() : [];
  const intentions = o.getIntentions ? o.getIntentions() : [];

  // The reflection, what gathered
  content.appendChild(el('div', { class: 'yr-section' }, 'What gathered'));
  const home = homeTelescope(signals);
  const cross = crossTelescopeRate(signals);
  if (!home) {
    content.appendChild(el('div', { class: 'yr-empty' }, 'This fills from your own signal. Each time you mark that something landed, the picture of what speaks to you, and which lens reached you, builds here.'));
  } else {
    const refl = el('div', { class: 'yr-emergent' });
    refl.appendChild(el('div', { class: 'yr-em-p' }, 'Across ' + home.count + ' of your taps, what lands most is ' + home.label + '.'));
    if (cross && cross.count > 0) {
      const cc = el('div', { class: 'yr-em-call' });
      cc.appendChild(el('div', { class: 'yr-em-em' }, 'And ' + cross.count + ' of those were a lens that is not your home, landing on the same sky. That crossing is the bridge, and it is the thing worth returning for.'));
      refl.appendChild(cc);
    } else {
      refl.appendChild(el('div', { class: 'yr-foot' }, 'When a lens that is not your home lands, it will be marked here as the bridge.'));
    }
    content.appendChild(refl);
  }

  // The emergent surface, the felt made legible
  const rhythm = intentionRhythm(intentions, signals);
  const proven = bothTelescopesProven(signals);
  content.appendChild(el('div', { class: 'yr-section' }, 'What you felt, named'));
  const em = el('div', { class: 'yr-emergent' });
  let named = false;
  if (rhythm) {
    named = true;
    const cc = el('div', { class: 'yr-em-call' });
    cc.appendChild(el('div', { class: 'yr-em-p' }, 'Your intentions move when you tend them within about ' + rhythm.days + (rhythm.days === 1 ? ' day' : ' days') + '. The ones left longer wait.'));
    cc.appendChild(el('div', { class: 'yr-em-em' }, 'This is your rhythm, observed from your own outcomes, not a rule.'));
    em.appendChild(cc);
  }
  if (proven === true) {
    named = true;
    const cc = el('div', { class: 'yr-em-call' });
    cc.appendChild(el('div', { class: 'yr-em-em' }, 'The days you let both telescopes speak, your outcomes ran better. The convergence, in your own life.'));
    em.appendChild(cc);
  }
  if (!named) {
    em.appendChild(el('div', { class: 'yr-em-p' }, 'We are still listening. When a pattern in your own signal is clear enough to name, it appears here. When we look and find nothing, we will say that too.'));
  }
  em.appendChild(el('div', { class: 'yr-foot' }, 'Observed from your own signal. Correlation, not a forecast.'));
  content.appendChild(em);

  // What is moving, the held intentions and their outcomes
  if (o.getIntentions) {
    content.appendChild(el('div', { class: 'yr-section' }, 'What is moving'));
    const live = intentions.filter((it) => it.status !== 'resting');
    if (!live.length) {
      content.appendChild(el('div', { class: 'yr-empty' }, 'The intentions you are holding will gather here, so you can mark, in your own time, which have moved and which are still waiting.'));
    } else {
      const verdicts: Record<string, string> = {};
      for (const s of signals) { if (s.kind === 'outcome' && s.intentionId && s.moved) verdicts[s.intentionId] = s.moved; }
      for (const it of live) {
        const row = el('div', { class: 'yr-move' });
        row.appendChild(el('div', { class: 'yr-move-t' }, it.text));
        if (o.recordOutcome) {
          const well = el('button', { type: 'button', class: 'yr-move-b' + (verdicts[it.id] === 'well' ? ' on' : '') }, 'moved well');
          const wait = el('button', { type: 'button', class: 'yr-move-b' + (verdicts[it.id] === 'waiting' ? ' on' : '') }, 'still waiting');
          well.addEventListener('click', () => { o.recordOutcome!(it.id, 'well'); well.classList.add('on'); wait.classList.remove('on'); });
          wait.addEventListener('click', () => { o.recordOutcome!(it.id, 'waiting'); wait.classList.add('on'); well.classList.remove('on'); });
          row.appendChild(well);
          row.appendChild(wait);
        }
        content.appendChild(row);
      }
    }
  }

  const sl = sourcesLine();
  if (sl) content.appendChild(el('div', { class: 'yr-sources' }, sl));

  shell.appendChild(shareControls({
    title: 'My year, ' + String(curYear),
    text: () => 'My year, ' + String(curYear) + '\n\n' + content.innerText,
    node: () => content,
  }));

  view.appendChild(shell);
  o.container.appendChild(view);

  function close(): void { if (view.parentNode) view.parentNode.removeChild(view); }
  closeBtn.addEventListener('click', close);
  if (o.reflect) o.reflect('Your year is laid out, the long view under your hand.');
  return { close };
}
