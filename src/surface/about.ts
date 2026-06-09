/*
 * CDP Vessel, surface: About, "Two telescopes".
 *
 * The monolith assets are the floor and are carried forward verbatim: the two
 * telescope cipher, the premise, the three voices. On that floor sits the value
 * that is the reason CDP exists, the bridge between registers: the same day read
 * in two grammars, the science told beside the tradition with its named
 * authorities, and the door into the reading where the two telescopes meet.
 *
 * The frameworks are not put on trial here. They are lenses. The honesty is in
 * precision of claim, what is symbol is named as symbol, what is shown is traced
 * to source, which is what lets one reading speak to the believer and the
 * sceptic at once.
 *
 * House style holds in code and copy alike: no em dashes, no en dashes, no
 * exclamation marks, no spaced hyphen patterns. Legibility first: nothing a
 * person must read is set in small italic or in faint grey.
 */

import type { Lens } from '../data/model';
import { ABOUT_HERO } from './about-hero';

export interface OpenAboutOptions {
  container: HTMLElement;
  getLens: () => Lens;
  /** Lets the About voice toggle move the whole vessel's lens, when provided. */
  setLens?: (lens: Lens) => void;
  /** Opens the daily reading, the room where the two telescopes meet. */
  onEnterReading?: () => void;
  /** Opens the make it yours flow, birth date then the full profile. */
  onMakeMine?: () => void;
  /** Surfaces a brief confirmation note in the vessel, when provided. */
  reflect?: (note: string) => void;
}

export interface AboutHandle { close(): void; }

type Attrs = Record<string, string>;

function el(tag: string, attrs: Attrs = {}, text?: string): HTMLElement {
  const node = document.createElement(tag);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  if (text != null) node.textContent = text;
  return node;
}

const CIPHER =
  '<svg width="60" height="36" viewBox="0 0 60 36" fill="none" stroke="#C9A050" stroke-width="1.4" stroke-linecap="round" aria-hidden="true">'
  + '<circle cx="22" cy="18" r="13"></circle><circle cx="38" cy="18" r="13"></circle></svg>';

const CYCLING: Record<Lens, string[]> = {
  tradition: ['Ancient and modern', 'Tradition and science', 'Ritual and research', 'Symbol and mechanism', 'Pattern and process'],
  science: ['Circadian rhythm and intuition', 'Predictive processing meets pattern', 'Default mode and reflection', 'Hippocampal consolidation', 'Interoception as compass'],
  everyday: ['Old wisdom, new evidence', 'Two ways of seeing today', 'Same sky, different telescopes', 'Find the language that fits', 'Whichever helps you most'],
};

interface Reach { label: string; body: string; colour: string; }
const REACHES: Record<Lens, Reach> = {
  everyday: {
    label: 'Everyday, the view you receive',
    body: 'The plain spoken synthesis, the naked eye view of the day. No jargon from either side. What today is good for, what to be careful about, and what to do next. This is the reading everyone receives.',
    colour: '#F0E6CC',
  },
  tradition: {
    label: 'Tradition, the ancient telescope',
    body: 'The same day through the symbolic reach: Pythagorean numerology, Mayan calendrics, Western archetypes, lunar wisdom. There for when you want depth, image, and resonance.',
    colour: '#C9A050',
  },
  science: {
    label: 'Science, the modern telescope',
    body: 'The same day through the mechanistic reach: circadian cognition, attachment, predictive processing, contemplative neuroscience. There for when you want what is happening in the brain and body.',
    colour: '#81CDB6',
  },
};

interface Framework {
  tradName: string; tradLine: string;
  sciName: string; sciLine: string;
  authority: string;
}
const FRAMEWORKS: Framework[] = [
  {
    tradName: 'Numerology',
    tradLine: 'Pythagorean numerology gives the day a numerical signature, an archetypal quality to attune to rather than a fortune to receive.',
    sciName: 'Cognitive priming',
    sciLine: 'A frame held at the start of the day biases the salience network toward what it names, a measurable effect on attention and choice for hours after.',
    authority: 'Broadbent 1958, Perception and Communication; Dijksterhuis and Aarts 2010, Annual Review of Psychology; Oettingen and Sevincer 2023, Journal of Personality and Social Psychology.',
  },
  {
    tradName: 'Lunar astronomy',
    tradLine: 'Lunar phase is the oldest calendar we keep. The two days before the new moon ask for stripping back, the two days after for new commitment.',
    sciName: 'Circadian rhythms',
    sciLine: 'Cortisol, melatonin, and prefrontal cognition follow circadian rhythms that shape which work lands cleanly when.',
    authority: 'Mehrhof and Nord 2025, eLife; Walker 2017, Why We Sleep; Cajochen et al 2013, Current Biology.',
  },
  {
    tradName: 'Western astrology',
    tradLine: 'Psychological astrology reads transits as developmental archetypes. The natal chart is a map of recurring themes, not a prediction.',
    sciName: 'Predictive frameworks',
    sciLine: 'The brain constructs experience from prior models, so a frame that names what is coming durably shapes how it lands.',
    authority: 'Clark 2016, Surfing Uncertainty; Tarnas 2006, Cosmos and Psyche; Greene 1976, Saturn.',
  },
  {
    tradName: 'Dreamspell',
    tradLine: 'A 260-day cycle of 20 seals and 13 tones. Each day a Kin, with 52 Galactic Activation Portal days when synchronicity is read as amplified. Arguelles 1987, distinct from the daykeeper count.',
    sciName: 'Neuroplasticity',
    sciLine: 'Repeated daily attention to a stable anchor strengthens its representation in self-referential networks. Neurons that fire together wire together.',
    authority: 'Raichle 2015, Annual Review of Neuroscience; Hebb 1949, The Organization of Behavior; Arguelles 1987, The Mayan Factor.',
  },
  {
    tradName: 'Relationships',
    tradLine: 'Synastry reads two charts together to surface recurring dynamics, naming both the gifts and the friction without flattening them to a score.',
    sciName: 'Interpersonal neurobiology',
    sciLine: 'Co-regulation between two nervous systems is measurable, and recurring relational patterns durably shape both partners.',
    authority: 'Siegel 2020, The Developing Mind; Porges 2011, The Polyvagal Theory; Bowlby 1969, Attachment and Loss.',
  },
  {
    tradName: 'Hormonal cycle',
    tradLine: 'The menstrual cycle read as an inner moon. Follicular for building, ovulation for expression, luteal for discernment, menstruation for release. Recognition, not prescription.',
    sciName: 'Endocrine rhythms',
    sciLine: 'Estrogen and progesterone modulate hippocampal plasticity, prefrontal connectivity, and sleep across the cycle, so cognitive strengths shift with phase rather than degrade.',
    authority: 'Sundstrom-Poromaa et al 2023, Neuropsychopharmacology; Pletzer 2017, Frontiers in Neuroscience; Pope and Wurlitzer 2017, Wild Power.',
  },
];
function ensureAboutStyle(): void {
  if (document.getElementById('cdp-about-styles')) return;
  const css = [
    '.ab-view{position:absolute;inset:0;z-index:60;overflow-y:auto;background:var(--bg,#031831);color:var(--text-light,#F0E6CC);font-family:\'EB Garamond\',Georgia,serif}',
    '.ab-bar{position:sticky;top:0;display:flex;justify-content:flex-end;padding:12px 16px;background:linear-gradient(180deg,var(--bg,#031831),rgba(3,24,49,0))}',
    '.ab-close{background:transparent;border:0;color:var(--text-muted,#D4C8AE);font-size:24px;line-height:1;cursor:pointer;padding:4px 8px}',
    '.ab-wrap{max-width:560px;margin:0 auto;padding:0 22px 40px}',
    '.ab-hero{position:relative;width:100%;aspect-ratio:1288/952;background-size:contain;background-repeat:no-repeat;background-position:center;border-radius:12px;overflow:hidden}',
    '.ab-hero::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(3,24,49,0) 40%,rgba(3,24,49,0.82) 86%,var(--bg,#031831) 100%)}',
    '.ab-herotext{position:absolute;left:0;right:0;bottom:14px;text-align:center;z-index:1}',
    '.ab-title{font-family:\'Cinzel\',Georgia,serif;font-weight:500;font-size:26px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold-soft,#E8C878);margin:6px 0 0;line-height:1.2}',
    '.ab-sub{font-family:\'EB Garamond\',Georgia,serif;font-style:italic;font-size:22px;color:var(--gold-soft,#E8C878);line-height:1.2;margin-top:2px}',
    '.ab-premise{font-size:16.5px;line-height:1.7;color:var(--text-light,#F0E6CC);text-align:center;margin:18px 4px 6px}',
    '.ab-cycle{text-align:center;margin:16px 0 4px;font-family:\'Cinzel\',Georgia,serif;font-size:13px;letter-spacing:.1em;color:var(--gold,#C9A050);transition:opacity .4s}',
    '.ab-toggle{display:flex;gap:8px;justify-content:center;margin:16px 0}',
    '.ab-vbtn{font-family:\'Cinzel\',Georgia,serif;font-size:12px;letter-spacing:.18em;background:transparent;border:.5px solid #3A3320;color:var(--text-dim,#9E9282);padding:9px 13px;border-radius:8px;cursor:pointer}',
    '.ab-vbtn.on{border-color:currentColor}',
    '.ab-reach{border-left:3px solid #3A3320;padding:13px 16px;border-radius:0 6px 6px 0;margin-bottom:11px;transition:background .2s,border-color .2s}',
    '.ab-reach .eyebrow{font-size:12px;letter-spacing:.14em;text-transform:uppercase;margin:0 0 6px}',
    '.ab-reach p{margin:0;font-size:14.5px;line-height:1.6;color:var(--text-light,#F0E6CC)}',
    '.ab-meet{margin:18px 0 6px;padding:15px 18px;background:rgba(201,160,80,.04);border:1px dashed rgba(201,160,80,.3);border-radius:6px}',
    '.ab-meet .eyebrow{margin:0 0 6px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--text-muted,#D4C8AE)}',
    '.ab-meet p{margin:0;font-size:14.5px;line-height:1.65;color:var(--text-light,#F0E6CC)}',
    '.ab-precision{font-size:14.5px;line-height:1.65;color:var(--text-muted,#D4C8AE);margin:16px 4px 0}',
    '.ab-sec{margin-top:26px;padding-top:18px;border-top:.5px solid #3A3320}',
    '.ab-sci-eyebrow{font-family:\'Cinzel\',Georgia,serif;font-size:13px;letter-spacing:.14em;color:var(--gold,#C9A050);margin-bottom:8px}',
    '.ab-lead{font-size:17px;line-height:1.6;color:var(--text-light,#F0E6CC);margin:0 0 12px}',
    '.ab-bits{font-size:15px;line-height:1.65;color:var(--text-light,#F0E6CC);margin:0 0 10px}',
    '.ab-bits.dim{color:var(--text-muted,#D4C8AE)}',
    '.ab-sci-note{font-size:14px;line-height:1.6;color:var(--text-muted,#D4C8AE);margin:6px 0 14px}',
    '.ab-fw{background:var(--navy,#0D1E33);border:.5px solid #3A3320;border-radius:10px;padding:14px 16px;margin-bottom:10px}',
    '.ab-fw .pair{display:flex;gap:12px;flex-wrap:wrap}',
    '.ab-fw .col{flex:1;min-width:200px}',
    '.ab-fw .nm{font-family:\'Cinzel\',Georgia,serif;font-size:11px;letter-spacing:.1em;margin-bottom:4px}',
    '.ab-fw .ln{font-size:14px;line-height:1.55;color:var(--text-light,#F0E6CC);margin:0}',
    '.ab-fw .auth-btn{margin-top:10px;background:transparent;border:.5px solid #3A3320;color:var(--text-muted,#D4C8AE);font-family:\'EB Garamond\',Georgia,serif;font-size:13.5px;padding:7px 12px;border-radius:8px;cursor:pointer}',
    '.ab-fw .auth{margin-top:8px;font-size:14px;line-height:1.55;color:var(--teal,#81CDB6)}',
    '.ab-mine{margin-top:26px;padding-top:18px;border-top:.5px solid #3A3320}',
    '.ab-mine .k{font-family:\'Cinzel\',Georgia,serif;font-size:12px;letter-spacing:.14em;color:var(--gold,#C9A050);margin-bottom:8px}',
    '.ab-mine p{margin:0 0 8px;font-size:16px;line-height:1.6;color:var(--text-light,#F0E6CC)}',
    '.ab-mine .small{font-size:14px;color:var(--text-muted,#D4C8AE)}',
    '.ab-ghost{font-family:\'Cinzel\',Georgia,serif;font-size:12px;letter-spacing:.14em;background:transparent;color:var(--text-muted,#D4C8AE);border:.5px solid #3A3320;padding:11px 15px;border-radius:8px;cursor:pointer;width:100%;margin-top:6px}',
    '.ab-cta{font-family:\'Cinzel\',Georgia,serif;font-size:12px;letter-spacing:.16em;background:transparent;color:var(--gold,#C9A050);border:.5px solid var(--gold,#C9A050);padding:13px 16px;border-radius:8px;cursor:pointer;width:100%;margin-top:18px}',
    '.ab-cta-note{margin:8px 2px 0;text-align:center;font-size:13.5px;color:var(--text-muted,#D4C8AE)}',
  ].join('');
  const style = el('style', { id: 'cdp-about-styles' });
  style.textContent = css;
  document.head.appendChild(style);
}

export function openAbout(o: OpenAboutOptions): AboutHandle {
  ensureAboutStyle();
  let lens: Lens = o.getLens ? o.getLens() : 'everyday';

  const view = el('div', { class: 'ab-view', role: 'dialog', 'aria-label': 'About Cosmic Daily Planner' });

  const bar = el('div', { class: 'ab-bar' });
  const closeBtn = el('button', { type: 'button', class: 'ab-close', 'aria-label': 'Close' }, '\u00d7');
  bar.appendChild(closeBtn);
  view.appendChild(bar);

  const wrap = el('div', { class: 'ab-wrap' });

  /* Hero, the painted two telescopes atmosphere, with the cipher and the titles. */
  const hero = el('div', { class: 'ab-hero' });
  hero.style.backgroundImage = 'url(' + ABOUT_HERO + ')';
  const heroText = el('div', { class: 'ab-herotext' });
  const cipher = el('div', { 'aria-hidden': 'true' });
  cipher.innerHTML = CIPHER;
  heroText.appendChild(cipher);
  heroText.appendChild(el('div', { class: 'ab-title' }, 'Two telescopes.'));
  heroText.appendChild(el('div', { class: 'ab-sub' }, 'Pointed at the same sky.'));
  hero.appendChild(heroText);
  wrap.appendChild(hero);

  wrap.appendChild(el('p', { class: 'ab-premise' }, 'Spiritual traditions and modern neuroscience are not competing explanations. They are written in different languages, built in different centuries, and arrive at the same coordinates. Cosmic Daily Planner is where they meet, daily, in one reading for you.'));

  /* The cycling line, rotating through the current voice framings of the two telescopes. */
  const cycle = el('div', { class: 'ab-cycle', 'aria-hidden': 'true' });
  wrap.appendChild(cycle);
  let cycleIdx = 0;
  function paintCycle(): void {
    const set = CYCLING[lens] || CYCLING.everyday;
    if (cycleIdx >= set.length) cycleIdx = 0;
    cycle.textContent = set[cycleIdx];
    cycle.style.color = REACHES[lens].colour;
  }
  paintCycle();
  const cycleTimer = window.setInterval(() => {
    cycle.style.opacity = '0';
    window.setTimeout(() => {
      const set = CYCLING[lens] || CYCLING.everyday;
      cycleIdx = (cycleIdx + 1) % set.length;
      paintCycle();
      cycle.style.opacity = '1';
    }, 420);
  }, 4800);

  /* The voice toggle, which lights the reach it belongs to and, when wired, moves the vessel lens. */
  const toggle = el('div', { class: 'ab-toggle' });
  const order: Lens[] = ['everyday', 'tradition', 'science'];
  const btns: Record<string, HTMLElement> = {};
  for (const v of order) {
    const b = el('button', { type: 'button', class: 'ab-vbtn', 'data-voice': v }, v.toUpperCase());
    b.style.color = REACHES[v].colour;
    b.addEventListener('click', () => setVoice(v));
    btns[v] = b;
    toggle.appendChild(b);
  }
  wrap.appendChild(toggle);

  const reachEls: Record<string, HTMLElement> = {};
  for (const v of order) {
    const card = el('div', { class: 'ab-reach', 'data-reach': v });
    card.style.borderLeftColor = REACHES[v].colour;
    const eyebrow = el('div', { class: 'eyebrow' }, REACHES[v].label);
    eyebrow.style.color = REACHES[v].colour;
    card.appendChild(eyebrow);
    card.appendChild(el('p', {}, REACHES[v].body));
    reachEls[v] = card;
    wrap.appendChild(card);
  }

  function setVoice(v: Lens): void {
    lens = v;
    for (const k of order) {
      btns[k].classList.toggle('on', k === v);
      const on = k === v;
      reachEls[k].style.background = on ? 'rgba(201,160,80,.05)' : 'transparent';
      reachEls[k].style.borderLeftColor = on ? REACHES[k].colour : '#3A3320';
    }
    cycleIdx = 0;
    paintCycle();
    if (o.setLens) o.setLens(v);
  }
  setVoice(lens);

  /* Where they meet. */
  const meet = el('div', { class: 'ab-meet' });
  meet.appendChild(el('div', { class: 'eyebrow' }, 'Where they meet'));
  meet.appendChild(el('p', {}, 'Lunar phase and memory consolidation. Numerology of completion and the predictive processing account of closure. Saturn transits and developmental individuation. The same observed patterns of human experience, named in two grammars.'));
  wrap.appendChild(meet);

  /* The precision line, the honesty, in the positive register. */
  wrap.appendChild(el('p', { class: 'ab-precision' }, 'We are precise about what each claim is. What the tradition holds, we name as symbol. What the science shows, we trace to its source. We do not say the planets steer your day, we offer the lens that helps you read it. That precision is what lets one reading speak to the believer and the sceptic at once.'));

  /* The science, told beside the tradition, with named authorities. */
  const sci = el('div', { class: 'ab-sec' });
  sci.appendChild(el('div', { class: 'ab-sci-eyebrow' }, 'The science'));
  sci.appendChild(el('div', { class: 'ab-lead' }, 'What spiritual practice has always known, neuroscience is now describing.'));
  sci.appendChild(el('p', { class: 'ab-bits' }, 'Your brain processes 11 million bits of information every second. Your conscious mind handles around 50. What makes it through that filter is determined by what you hold as important, and that is trainable.'));
  sci.appendChild(el('p', { class: 'ab-bits' }, 'When you begin your day with a clear orienting frame, your brain salience network calibrates accordingly, noticing the relevant and suppressing the noise. The cosmic framework is the instruction to the filter.'));
  sci.appendChild(el('p', { class: 'ab-bits dim' }, 'No belief required. Just the architecture of your own mind.'));
  sci.appendChild(el('div', { class: 'ab-sci-note' }, 'Every reading at every tier draws on six frameworks, refined across millennia and centuries respectively. Each row below is one framework, told in its tradition voice and its science voice. Open any row to see the named authorities behind the claims.'));

  for (const fw of FRAMEWORKS) {
    const card = el('div', { class: 'ab-fw' });
    const pair = el('div', { class: 'pair' });
    const tcol = el('div', { class: 'col' });
    const tnm = el('div', { class: 'nm' }, fw.tradName); tnm.style.color = '#C9A050';
    tcol.appendChild(tnm);
    tcol.appendChild(el('p', { class: 'ln' }, fw.tradLine));
    const scol = el('div', { class: 'col' });
    const snm = el('div', { class: 'nm' }, fw.sciName); snm.style.color = '#81CDB6';
    scol.appendChild(snm);
    scol.appendChild(el('p', { class: 'ln' }, fw.sciLine));
    pair.appendChild(tcol);
    pair.appendChild(scol);
    card.appendChild(pair);
    const authBtn = el('button', { type: 'button', class: 'auth-btn' }, 'Show the authority');
    const auth = el('div', { class: 'auth' }, fw.authority);
    auth.style.display = 'none';
    authBtn.addEventListener('click', () => {
      const open = auth.style.display === 'none';
      auth.style.display = open ? 'block' : 'none';
      authBtn.textContent = open ? 'Hide the authority' : 'Show the authority';
    });
    card.appendChild(authBtn);
    card.appendChild(auth);
    sci.appendChild(card);
  }
  wrap.appendChild(sci);

  /* Make it yours, the beta invitation, carried from the monolith. */
  const mine = el('div', { class: 'ab-mine' });
  mine.appendChild(el('div', { class: 'k' }, 'MAKE IT YOURS'));
  mine.appendChild(el('p', {}, 'It becomes yours the moment you tell it about you. Add your birth date, and today is drawn around your own numerology rather than the world\u2019s alone.'));
  mine.appendChild(el('p', { class: 'small' }, 'Two minutes, and every minute of every day thereafter is personal.'));
  mine.appendChild(el('p', { class: 'small' }, 'Your birth time and place, for the full natal chart, arrive with the transits.'));
  const mineBtn = el('button', { type: 'button', class: 'ab-ghost' }, 'Make it mine');
  mineBtn.addEventListener('click', () => { if (o.onMakeMine) o.onMakeMine(); });
  mine.appendChild(mineBtn);
  wrap.appendChild(mine);

  /* The door into the reading, where the two telescopes meet on one screen. */
  const cta = el('button', { type: 'button', class: 'ab-cta' }, 'Open today\u2019s reading');
  cta.addEventListener('click', () => { if (o.onEnterReading) o.onEnterReading(); });
  wrap.appendChild(cta);
  wrap.appendChild(el('div', { class: 'ab-cta-note' }, 'where the two telescopes meet on one screen'));

  view.appendChild(wrap);
  o.container.appendChild(view);

  function close(): void {
    window.clearInterval(cycleTimer);
    if (view.parentNode) view.parentNode.removeChild(view);
  }
  closeBtn.addEventListener('click', close);
  return { close: close };
}
