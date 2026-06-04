/**
 * CDP Vessel, surface layer: About, the Two Telescopes premise.
 *
 * The one place that says plainly what the Vessel is and what it claims. The
 * premise is that spiritual tradition and modern science are not competing
 * explanations; they are written in different languages, built in different
 * centuries, and they point at the same coordinates. The reading is where they
 * meet, daily, in one place, for one person.
 *
 * This surface is built to the charter's fourth principle, truth about what is
 * known. It names the three voices as three distinct registers, not a spectrum.
 * It labels symbolic claims as symbolic and empirical claims as empirical. And
 * it carries the sceptical counterweight in plain sight, by name, because a
 * premise that only shows its supporting evidence is not honest. Carlson 1985
 * found no astrological effect under double blind conditions; Lee, Pittler and
 * Ernst 2008 found the evidence for Reiki insufficient; the Dreamspell count is
 * Arguelles 1987, distinct from the living Maya tzolkin. Saying so is the point.
 *
 * It opens into the bridge: the daily reading is where the same coordinate can
 * be turned from one telescope to the other, and the bridge never collapses to
 * a single view. This surface hands the person there.
 *
 * Self contained. It injects its own scoped style, themed from the surface
 * variables, and depends only on the DOM and the lens accessor.
 *
 * House style holds here, in code, comments, and visible strings alike: no em
 * dashes, no en dashes, no exclamation marks, and no spaced hyphen patterns.
 */

import type { Lens } from '../data/model';

export interface OpenAboutOptions {
  container: HTMLElement;
  getLens: () => Lens;
  /** Opens the daily reading, where the live cross telescope bridge sits. */
  onEnterReading?: () => void;
  reflect?: (note: string) => void;
}
export interface AboutHandle { close(): void; }

type Attrs = Record<string, string>;
function el(tag: string, attrs: Attrs = {}, text?: string): HTMLElement {
  const node = document.createElement(tag);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  if (text !== undefined) node.textContent = text;
  return node;
}

const TELESCOPES_SVG =
  '<svg width="56" height="32" viewBox="0 0 48 27" fill="none" stroke="currentColor" stroke-width="1.1" aria-hidden="true"><circle cx="19" cy="13.5" r="10.5"></circle><circle cx="29" cy="13.5" r="10.5"></circle></svg>';

const PREMISE =
  'Spiritual traditions and modern science are not competing explanations. They are written in different languages, built in different centuries, and they arrive at the same coordinates. Cosmic Daily Planner is where they meet, daily, in one reading drawn around you.';

interface VoiceCard {
  lens: Lens;
  name: string;
  klass: string;
  blurb: string;
  lines: string[];
}
const VOICES: VoiceCard[] = [
  {
    lens: 'tradition',
    name: 'Tradition',
    klass: 'tradition',
    blurb: 'The symbolic and archetypal language. The Kin, the transit, the number, the moon, read as pattern and meaning.',
    lines: ['Ancient and modern', 'Tradition and science', 'Ritual and research', 'Symbol and mechanism', 'Pattern and process'],
  },
  {
    lens: 'science',
    name: 'Science',
    klass: 'science',
    blurb: 'The same day in the language of evidence. Circadian biology, interoception, predictive processing, attachment.',
    lines: ['Circadian rhythm and intuition', 'Predictive processing meets pattern', 'Default mode and reflection', 'Hippocampal consolidation', 'Interoception as compass'],
  },
  {
    lens: 'everyday',
    name: 'Everyday',
    klass: 'everyday',
    blurb: 'Plain language for the person who lives in neither vocabulary. The bridge between the two, in words anyone can use.',
    lines: ['Old wisdom, new evidence', 'Two ways of seeing today', 'Same sky, different telescopes', 'Find the language that fits', 'Whichever helps you most'],
  },
];

interface ClaimRow {
  klass: 'symbolic' | 'empirical';
  tag: string;
  body: string;
}
const CLAIMS: ClaimRow[] = [
  {
    klass: 'symbolic',
    tag: 'Symbolic',
    body: 'Numerology, the Dreamspell count, and astrological archetypes are symbolic frames for reflection, and we label them as symbolic. The Dreamspell calendar is Arguelles 1987, distinct from the living Maya tzolkin recorded by Tedlock 1992. We do not claim these mechanisms act on your day; we offer them as a lens to look through.',
  },
  {
    klass: 'empirical',
    tag: 'Empirical',
    body: 'Circadian biology, interoception, predictive processing, and attachment are evidence grounded, and we label them as empirical, traced to named authorities such as Walker 2017 on sleep, Craig 2002 on interoception, Clark 2016 on predictive processing, and Bowlby and Ainsworth on attachment. Where a claim rests on evidence, we say which evidence.',
  },
];

const COUNTERWEIGHTS: string[] = [
  'Carlson 1985, in Nature, tested astrology under double blind conditions and found no effect beyond chance.',
  'Lee, Pittler and Ernst 2008 reviewed the trials of Reiki and concluded the evidence is insufficient to support it.',
  'Raison and colleagues 1999 examined the claimed effects of the lunar cycle on behaviour and found no reliable association.',
  'Hoopes 2011 sets out clearly that the 2012 and Dreamspell narratives are modern constructions, not ancient Maya doctrine.',
];

const STYLE_ID = 'cdp-about-style';
function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const css = [
    ".cdp-surface .ab-view{position:fixed;top:58px;left:0;right:0;bottom:0;z-index:60;background:var(--bg,#0A1828);overflow-y:auto;padding:30px 18px 80px}",
    ".cdp-surface .ab-shell{max-width:44rem;margin:0 auto}",
    ".cdp-surface .ab-bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}",
    ".cdp-surface .ab-eyebrow{font-family:Cinzel,Georgia,serif;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--gold,#C9A050)}",
    ".cdp-surface .ab-close{background:none;border:none;cursor:pointer;color:var(--text-dim,#D4C8AE);font-size:22px;line-height:1;padding:4px 8px}",
    ".cdp-surface .ab-close:hover{color:var(--gold,#C9A050)}",
    ".cdp-surface .ab-emblem{display:flex;justify-content:center;color:var(--gold,#C9A050);margin:14px 0 10px}",
    ".cdp-surface .ab-title{font-family:'EB Garamond',Georgia,serif;font-size:30px;line-height:1.2;color:var(--gold,#C9A050);text-align:center;margin:0 0 14px}",
    ".cdp-surface .ab-premise{font-family:'EB Garamond',Georgia,serif;font-size:17px;line-height:1.7;color:var(--text-light,#F0E6CC);text-align:center;max-width:36rem;margin:0 auto 26px}",
    ".cdp-surface .ab-h{font-family:Cinzel,Georgia,serif;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold,#C9A050);margin:30px 0 6px;border-top:1px solid var(--gold-line,#3A3320);padding-top:20px}",
    ".cdp-surface .ab-lead{font-family:'EB Garamond',Georgia,serif;font-size:15px;line-height:1.7;color:var(--text-dim,#D4C8AE);margin:0 0 14px}",
    ".cdp-surface .ab-voices{display:flex;gap:12px;flex-wrap:wrap}",
    ".cdp-surface .ab-voice{flex:1;min-width:220px;border:1px solid var(--gold-line,#3A3320);border-radius:5px;background:var(--navy,#0D1E33);padding:15px 16px}",
    ".cdp-surface .ab-voice-name{font-family:Cinzel,Georgia,serif;font-size:12px;letter-spacing:.14em;text-transform:uppercase;margin-bottom:8px}",
    ".cdp-surface .ab-voice.tradition .ab-voice-name{color:var(--gold,#C9A050)}",
    ".cdp-surface .ab-voice.science .ab-voice-name{color:var(--teal,#81CDB6)}",
    ".cdp-surface .ab-voice.everyday .ab-voice-name{color:var(--text-light,#F0E6CC)}",
    ".cdp-surface .ab-voice-blurb{font-family:Georgia,serif;font-size:13px;line-height:1.65;color:var(--text-dim,#D4C8AE);margin-bottom:10px}",
    ".cdp-surface .ab-voice-line{font-family:'EB Garamond',Georgia,serif;font-style:italic;font-size:13px;line-height:1.7;color:var(--text-dim,#D4C8AE)}",
    ".cdp-surface .ab-voice.tradition{border-color:rgba(201,160,80,.4)}",
    ".cdp-surface .ab-voice.science{border-color:rgba(129,205,182,.4)}",
    ".cdp-surface .ab-distinct{font-family:'EB Garamond',Georgia,serif;font-style:italic;font-size:13px;color:var(--text-dim,#D4C8AE);margin-top:12px}",
    ".cdp-surface .ab-claim{border-left:2px solid var(--gold-line,#3A3320);padding:4px 0 4px 14px;margin:14px 0}",
    ".cdp-surface .ab-claim.symbolic{border-left-color:var(--gold,#C9A050)}",
    ".cdp-surface .ab-claim.empirical{border-left-color:var(--teal,#81CDB6)}",
    ".cdp-surface .ab-claim-tag{font-family:Cinzel,Georgia,serif;font-size:10px;letter-spacing:.14em;text-transform:uppercase;margin-bottom:5px}",
    ".cdp-surface .ab-claim.symbolic .ab-claim-tag{color:var(--gold,#C9A050)}",
    ".cdp-surface .ab-claim.empirical .ab-claim-tag{color:var(--teal,#81CDB6)}",
    ".cdp-surface .ab-claim-body{font-family:Georgia,serif;font-size:14px;line-height:1.7;color:var(--text-light,#F0E6CC)}",
    ".cdp-surface .ab-counter{border:1px solid rgba(201,160,80,.45);border-radius:5px;background:rgba(0,0,0,.14);padding:16px 18px;margin:14px 0}",
    ".cdp-surface .ab-counter-h{font-family:Cinzel,Georgia,serif;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold-soft,#E8C878);margin-bottom:4px}",
    ".cdp-surface .ab-counter-lead{font-family:Georgia,serif;font-size:14px;line-height:1.7;color:var(--text-light,#F0E6CC);margin-bottom:10px}",
    ".cdp-surface .ab-counter-item{font-family:Georgia,serif;font-size:13px;line-height:1.65;color:var(--text-dim,#D4C8AE);margin:0 0 8px;padding-left:14px;position:relative}",
    ".cdp-surface .ab-counter-item:before{content:'\\2022';position:absolute;left:0;color:var(--gold,#C9A050)}",
    ".cdp-surface .ab-bridge{display:block;width:100%;box-sizing:border-box;background:none;border:1px solid var(--gold,#C9A050);color:var(--gold,#C9A050);font-family:Cinzel,Georgia,serif;font-size:12px;letter-spacing:.16em;text-transform:uppercase;padding:15px;border-radius:4px;cursor:pointer;margin-top:26px}",
    ".cdp-surface .ab-bridge:hover{background:rgba(201,160,80,.08)}",
    ".cdp-surface .ab-bridge-note{font-family:'EB Garamond',Georgia,serif;font-style:italic;font-size:13px;line-height:1.6;color:var(--text-dim,#D4C8AE);text-align:center;margin-top:10px}",
  ].join('');
  const style = el('style', { id: STYLE_ID });
  style.textContent = css;
  document.head.appendChild(style);
}

export function openAbout(o: OpenAboutOptions): AboutHandle {
  ensureStyle();
  const view = el('div', { class: 'ab-view', role: 'dialog', 'aria-label': 'About Cosmic Daily Planner' });
  const shell = el('div', { class: 'ab-shell' });

  const bar = el('div', { class: 'ab-bar' });
  bar.appendChild(el('div', { class: 'ab-eyebrow' }, 'Two telescopes, one sky'));
  const closeBtn = el('button', { type: 'button', class: 'ab-close', 'aria-label': 'Close' }, '\u00d7');
  bar.appendChild(closeBtn);
  shell.appendChild(bar);

  const emblem = el('div', { class: 'ab-emblem' });
  emblem.innerHTML = TELESCOPES_SVG;
  shell.appendChild(emblem);

  shell.appendChild(el('div', { class: 'ab-title' }, 'What Cosmic Daily Planner is'));
  shell.appendChild(el('div', { class: 'ab-premise' }, PREMISE));

  // Three voices, three distinct registers, not a spectrum
  shell.appendChild(el('div', { class: 'ab-h' }, 'Three voices'));
  shell.appendChild(el('div', { class: 'ab-lead' }, 'Every reading can be heard in three voices. They are three distinct registers, not points on a slider. The same coordinate is true in each; the language is what changes, so you can read in whichever speaks to you.'));
  const voices = el('div', { class: 'ab-voices' });
  for (const v of VOICES) {
    const card = el('div', { class: 'ab-voice ' + v.klass });
    card.appendChild(el('div', { class: 'ab-voice-name' }, v.name));
    card.appendChild(el('div', { class: 'ab-voice-blurb' }, v.blurb));
    for (const line of v.lines) card.appendChild(el('div', { class: 'ab-voice-line' }, line));
    voices.appendChild(card);
  }
  shell.appendChild(voices);
  shell.appendChild(el('div', { class: 'ab-distinct' }, 'The voice you choose on the home carries through every surface, and you can change it at any time.'));

  // What we claim, and how, labelled honestly
  shell.appendChild(el('div', { class: 'ab-h' }, 'What we claim, and how'));
  shell.appendChild(el('div', { class: 'ab-lead' }, 'We separate what is symbolic from what is empirical, and we never blur the two. A symbolic frame is offered as a lens; an empirical claim is traced to the evidence behind it.'));
  for (const c of CLAIMS) {
    const block = el('div', { class: 'ab-claim ' + c.klass });
    block.appendChild(el('div', { class: 'ab-claim-tag' }, c.tag));
    block.appendChild(el('div', { class: 'ab-claim-body' }, c.body));
    shell.appendChild(block);
  }

  // The counterweight, in plain sight
  const counter = el('div', { class: 'ab-counter' });
  counter.appendChild(el('div', { class: 'ab-counter-h' }, 'Where the evidence is contested'));
  counter.appendChild(el('div', { class: 'ab-counter-lead' }, 'A premise that shows only its supporting evidence is not honest. So we keep the strongest sceptical findings in view, by name, alongside everything else.'));
  for (const item of COUNTERWEIGHTS) counter.appendChild(el('div', { class: 'ab-counter-item' }, item));
  shell.appendChild(counter);

  // Open into the bridge
  shell.appendChild(el('div', { class: 'ab-h' }, 'Bring it into today'));
  shell.appendChild(el('div', { class: 'ab-lead' }, 'The place the two telescopes actually meet is your reading. Each section can be turned from one telescope to the other, on the same coordinate, and the bridge holds both at once rather than collapsing to one.'));
  const bridge = el('button', { type: 'button', class: 'ab-bridge' }, 'Read today through both telescopes');
  bridge.addEventListener('click', () => {
    close();
    if (o.onEnterReading) o.onEnterReading();
    else if (o.reflect) o.reflect('Open today\u2019s reading to see both telescopes on the same day.');
  });
  shell.appendChild(bridge);
  shell.appendChild(el('div', { class: 'ab-bridge-note' }, 'You stay the source of what any of it means. The Vessel brings the tools; you do the living.'));

  view.appendChild(shell);
  o.container.appendChild(view);

  function close(): void {
    if (view.parentNode) view.parentNode.removeChild(view);
  }
  closeBtn.addEventListener('click', () => close());

  return { close };
}
