/*
 * CDP Vessel, surface: About, "Arriving at the same coordinates."
 *
 * Ported directly from the index.html coordinates section and science rows
 * built today. The surface renders: the You/star emblem, the V-lines, the
 * two-panel Compass/Reading layout, the coda and keel paragraphs, and the
 * six expandable framework rows with tradition and science voices and named
 * authorities.
 *
 * House style holds: no em dashes, no en dashes, no exclamation marks,
 * no spaced hyphen patterns. Legibility first: nothing essential small and
 * italic. Canonical palette via CSS variables.
 */

import type { Lens } from '../data/model';

export interface OpenAboutOptions {
  container: HTMLElement;
  getLens?: () => Lens;
  setLens?: (lens: Lens) => void;
  reflect?: (note: string) => void;
  onEnterReading?: () => void;
  onMakeMine?: () => void;
  onClose?: () => void;
}

export interface AboutHandle { close(): void; }

type Attrs = Record<string, string>;
function el(tag: string, attrs: Attrs = {}, text?: string): HTMLElement {
  const node = document.createElement(tag);
  for (const k in attrs) node.setAttribute(k, attrs[k]!);
  if (text !== undefined) node.textContent = text;
  return node;
}
function clear(node: HTMLElement): void { while (node.firstChild) node.removeChild(node.firstChild); }

const STYLE_ID = 'cdp-about-v2-style';
function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const css = [
    '.cdp-surface .ab2-view{position:fixed;inset:0;top:58px;z-index:62;background:var(--page,#031831);overflow-y:auto;padding:0 0 64px}',
    '.cdp-surface .ab2-bar{display:flex;align-items:center;justify-content:space-between;padding:14px 18px 10px;position:sticky;top:0;background:var(--page,#031831);z-index:2}',
    '.cdp-surface .ab2-bar-title{font-family:Cinzel,Georgia,serif;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold,#C9A050)}',
    '.cdp-surface .ab2-close{background:none;border:1px solid var(--gold-line,#3A3320);color:var(--text-light,#F0E6CC);font-size:20px;line-height:1;cursor:pointer;width:34px;height:34px;border-radius:50%;flex:0 0 auto}',
    '.cdp-surface .ab2-wrap{max-width:52rem;margin:0 auto;padding:0 18px}',
    /* eyebrow + title */
    '.cdp-surface .ab2-eyebrow{font-family:Cinzel,Georgia,serif;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--gold,#C9A050);text-align:center;margin-bottom:8px}',
    '.cdp-surface .ab2-title{font-family:Cinzel,Georgia,serif;font-size:clamp(20px,4vw,30px);font-weight:500;letter-spacing:.06em;color:var(--text-light,#F0E6CC);text-align:center;margin:0 0 12px;line-height:1.2}',
    '.cdp-surface .ab2-sub{font-family:"EB Garamond",Georgia,serif;font-size:17px;line-height:1.65;color:var(--text-dim,#D4C8AE);text-align:center;margin:0 0 28px}',
    /* apex: star + You */
    '.cdp-surface .ab2-apex{display:flex;flex-direction:column;align-items:center;gap:6px;margin-bottom:4px}',
    '.cdp-surface .ab2-you{font-family:Cinzel,Georgia,serif;font-size:14px;letter-spacing:.18em;text-transform:uppercase;color:var(--gold2,#E8C878)}',
    /* vee lines */
    '.cdp-surface .ab2-vee{display:block;width:100%;max-width:560px;margin:0 auto 16px;height:72px}',
    /* two-panel grid */
    '.cdp-surface .ab2-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:28px}',
    '@media(max-width:600px){.cdp-surface .ab2-grid{grid-template-columns:1fr}}',
    '.cdp-surface .ab2-card{background:var(--navy,#0D1E33);border:1px solid var(--gold-line,#3A3320);border-radius:8px;padding:18px 16px}',
    '.cdp-surface .ab2-ce{font-family:Cinzel,Georgia,serif;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold,#C9A050);margin-bottom:3px}',
    '.cdp-surface .ab2-cs{font-family:"EB Garamond",Georgia,serif;font-style:italic;font-size:15px;color:var(--text-dim,#D4C8AE);margin-bottom:12px}',
    '.cdp-surface .ab2-card img{width:100%;border-radius:4px;margin-bottom:12px;display:block}',
    '.cdp-surface .ab2-card p{font-family:"EB Garamond",Georgia,serif;font-size:15px;line-height:1.6;color:var(--text-light,#F0E6CC);margin:0 0 10px}',
    '.cdp-surface .ab2-eg{font-family:"EB Garamond",Georgia,serif;font-size:14px;line-height:1.55;color:var(--text-dim,#D4C8AE);margin-top:8px}',
    '.cdp-surface .ab2-eg b{color:var(--gold,#C9A050);margin-right:4px}',
    /* voices strip */
    '.cdp-surface .ab2-voices{display:flex;gap:8px;margin:10px 0}',
    '.cdp-surface .ab2-voice{font-family:Cinzel,Georgia,serif;font-size:11px;letter-spacing:.12em;padding:5px 10px;border-radius:3px;border:1px solid}',
    '.cdp-surface .ab2-voice.t{color:var(--gold,#C9A050);border-color:var(--gold,#C9A050)}',
    '.cdp-surface .ab2-voice.e{color:var(--text-dim,#D4C8AE);border-color:var(--gold-line,#3A3320)}',
    '.cdp-surface .ab2-voice.s{color:var(--teal,#81CDB6);border-color:var(--teal,#81CDB6)}',
    '.cdp-surface .ab2-voice{cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background .15s}',
    '.cdp-surface .ab2-voice.active-t{background:var(--gold,#C9A050);border-color:var(--gold,#C9A050);color:var(--page,#031831)}',
    '.cdp-surface .ab2-voice.active-e{background:var(--text-muted,#D4C8AE);border-color:var(--text-muted,#D4C8AE);color:var(--page,#031831)}',
    '.cdp-surface .ab2-voice.active-s{background:var(--teal,#81CDB6);border-color:var(--teal,#81CDB6);color:var(--page,#031831)}',
    /* coda paragraphs */
    '.cdp-surface .ab2-coda{font-family:"EB Garamond",Georgia,serif;font-size:16px;line-height:1.7;color:var(--text-dim,#D4C8AE);margin:0 0 14px}',
    '.cdp-surface .ab2-belief{font-family:Cinzel,Georgia,serif;font-size:13px;letter-spacing:.1em;color:var(--gold,#C9A050);margin:0 0 14px}',
    '.cdp-surface .ab2-keel{font-family:"EB Garamond",Georgia,serif;font-size:16px;line-height:1.7;color:var(--text-dim,#D4C8AE);margin:0 0 28px}',
    /* science rows section */
    '.cdp-surface .ab2-sci-eyebrow{font-family:Cinzel,Georgia,serif;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--gold,#C9A050);text-align:center;margin-bottom:8px}',
    '.cdp-surface .ab2-sci-title{font-family:Cinzel,Georgia,serif;font-size:clamp(18px,3.5vw,26px);font-weight:500;color:var(--text-light,#F0E6CC);text-align:center;margin:0 0 6px;line-height:1.25}',
    '.cdp-surface .ab2-sci-title em{font-family:"EB Garamond",Georgia,serif;font-style:italic;font-weight:400}',
    '.cdp-surface .ab2-col-heads{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:18px 0 4px;padding:0 4px}',
    '@media(max-width:600px){.cdp-surface .ab2-col-heads{display:none}}',
    '.cdp-surface .ab2-ch{font-family:Cinzel,Georgia,serif;font-size:11px;letter-spacing:.12em;text-transform:uppercase;padding:6px 0}',
    '.cdp-surface .ab2-ch.spirit{color:var(--gold,#C9A050);border-bottom:1px solid rgba(201,160,80,.3)}',
    '.cdp-surface .ab2-ch.science{color:var(--teal,#81CDB6);border-bottom:1px solid rgba(129,205,182,.3)}',
    /* fw rows */
    '.cdp-surface .ab2-fw-row{border:1px solid var(--gold-line,#3A3320);border-radius:8px;margin-bottom:10px;overflow:hidden}',
    '.cdp-surface .ab2-fw-main{display:grid;grid-template-columns:1fr 1fr auto;gap:14px;padding:14px 16px;cursor:pointer}',
    '@media(max-width:600px){.cdp-surface .ab2-fw-main{grid-template-columns:1fr;gap:8px}}',
    '.cdp-surface .ab2-fw-name{font-family:Cinzel,Georgia,serif;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--gold,#C9A050);margin-bottom:4px}',
    '.cdp-surface .ab2-fw-spirit{font-family:"EB Garamond",Georgia,serif;font-size:15px;line-height:1.55;color:var(--text-light,#F0E6CC)}',
    '.cdp-surface .ab2-fw-sci-name{font-family:Cinzel,Georgia,serif;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--teal,#81CDB6);margin-bottom:4px}',
    '.cdp-surface .ab2-fw-sci-body{font-family:"EB Garamond",Georgia,serif;font-size:15px;line-height:1.55;color:var(--text-light,#F0E6CC)}',
    '.cdp-surface .ab2-fw-ref{font-family:"EB Garamond",Georgia,serif;font-size:13px;color:var(--text-dim,#D4C8AE);margin-top:4px}',
    '.cdp-surface .ab2-fw-toggle{font-family:Cinzel,Georgia,serif;font-size:11px;color:var(--text-dim,#D4C8AE);white-space:nowrap;align-self:center;padding:0 4px}',
    '.cdp-surface .ab2-fw-expand{display:none;padding:0 16px 16px;border-top:1px solid var(--gold-line,#3A3320)}',
    '.cdp-surface .ab2-fw-row.open .ab2-fw-expand{display:block}',
    '.cdp-surface .ab2-exp-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;padding-top:14px}',
    '@media(max-width:600px){.cdp-surface .ab2-exp-grid{grid-template-columns:1fr}}',
    '.cdp-surface .ab2-exp-head{font-family:Cinzel,Georgia,serif;font-size:11px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid}',
    '.cdp-surface .ab2-exp-head.spirit{color:var(--gold,#C9A050);border-color:rgba(201,160,80,.3)}',
    '.cdp-surface .ab2-exp-head.science{color:var(--teal,#81CDB6);border-color:rgba(129,205,182,.3)}',
    '.cdp-surface .ab2-exp-body{font-family:"EB Garamond",Georgia,serif;font-size:15px;line-height:1.65;color:var(--text-light,#F0E6CC);margin-bottom:12px}',
    '.cdp-surface .ab2-exp-ref{font-family:"EB Garamond",Georgia,serif;font-size:13px;line-height:1.5;color:var(--text-dim,#D4C8AE);margin-bottom:4px}',
    '.cdp-surface .ab2-exp-ref em{font-style:italic}',
    /* epigraph */
    '.cdp-surface .ab2-epi{margin:28px 0 20px;padding:22px 20px;text-align:center}',
    '.cdp-surface .ab2-epi-q{font-family:"EB Garamond",Georgia,serif;font-style:italic;font-size:20px;line-height:1.5;color:var(--text-light,#F0E6CC);margin-bottom:8px;text-align:center}',
    '.cdp-surface .ab2-epi-a{font-family:Cinzel,Georgia,serif;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-dim,#D4C8AE);text-align:center}',
    /* cta */
    '.cdp-surface .ab2-cta{font-family:Cinzel,Georgia,serif;font-size:12px;letter-spacing:.16em;background:transparent;color:var(--gold,#C9A050);border:1px solid var(--gold,#C9A050);padding:15px 16px;border-radius:8px;cursor:pointer;width:100%;margin-top:20px;-webkit-tap-highlight-color:rgba(201,160,80,.18);transition:background .15s,transform .1s}',
    '.cdp-surface .ab2-cta:hover{background:rgba(201,160,80,.1)}',
    '.cdp-surface .ab2-cta:active{background:rgba(201,160,80,.2);transform:scale(.98)}',
    '.cdp-surface .ab2-cta-note{font-family:"EB Garamond",Georgia,serif;font-size:14px;color:var(--text-dim,#D4C8AE);text-align:center;margin-top:8px}',
  ].join('');
  const tag = el('style', { id: STYLE_ID });
  tag.textContent = css;
  document.head.appendChild(tag);
}

const STAR_SVG = `<svg width="52" height="52" viewBox="0 0 60 60" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
  <g fill="#C9A050" stroke="none">
    <polygon points="30,4 32.2,27.8 30,30 27.8,27.8" opacity="0.95"/>
    <polygon points="30,56 32.2,32.2 30,30 27.8,32.2" opacity="0.95"/>
    <polygon points="4,30 27.8,32.2 30,30 27.8,27.8" opacity="0.95"/>
    <polygon points="56,30 32.2,27.8 30,30 32.2,32.2" opacity="0.95"/>
    <polygon points="11.5,11.5 28.8,28.8 30,30 31.2,28.8" opacity="0.7" transform="scale(0.85) translate(5.3,5.3)"/>
    <polygon points="48.5,11.5 31.2,28.8 30,30 28.8,28.8" opacity="0.7" transform="scale(0.85) translate(5.3,5.3)"/>
    <polygon points="11.5,48.5 28.8,31.2 30,30 31.2,31.2" opacity="0.7" transform="scale(0.85) translate(5.3,5.3)"/>
    <polygon points="48.5,48.5 31.2,31.2 30,30 28.8,31.2" opacity="0.7" transform="scale(0.85) translate(5.3,5.3)"/>
  </g>
  <circle cx="30" cy="30" r="1.8" fill="#E8C878"/>
</svg>`;

const VEE_SVG = `<svg class="ab2-vee" viewBox="0 0 560 72" preserveAspectRatio="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="M280 2 Q220 28 80 72" fill="none" stroke="#6f5d34" stroke-width="1" stroke-linecap="round" opacity="0.85"/><path d="M280 2 Q340 28 480 72" fill="none" stroke="#6f5d34" stroke-width="1" stroke-linecap="round" opacity="0.85"/></svg>`;

// Compass image: canonical compass from guide-images (North star + orbit ring, confirmed present on alpha)
import { GUIDE_HERO as COMPASS_IMG } from './guide-images';

const FRAMEWORKS = [
  {
    name: 'Numerology',
    spirit: 'The day carries a frequency. Attend to it before the world sets your agenda for you.',
    sciName: 'Cognitive priming',
    sciBody: 'A held morning frame shifts the brain\'s salience filter for the whole day.',
    sciRef: 'Oettingen and Sevincer, 2023',
    tradExpand: 'Pythagorean numerology assigns each day a numerical signature derived from the date\'s digits, reduced to a single resonance. Each number carries an archetypal quality: 1 initiation, 7 introspection, 9 completion, master numbers 11 22 33 44 amplified. The day\'s number is read as a frequency to attune to, not a fortune to receive. Practitioners have used this structure for daily orientation since Pythagoras at Croton in the sixth century BCE.',
    sciExpand: 'A conceptual frame held at the start of a day biases the brain\'s salience network toward stimuli that confirm the frame. Mental contrasting (Oettingen) and goal priming (Dijksterhuis and Aarts) show measurable effects on attention, motivation and decision-making for hours after the priming event. The mechanism is not magical; it is selective attention plus predictive processing.',
    refs: ['Broadbent (1958) Perception and Communication. Oxford.', 'Dijksterhuis and Aarts (2010) Goals, attention, consciousness. Annual Review of Psychology.', 'Oettingen and Sevincer (2023) Mental contrasting, fMRI RCT. Journal of Personality and Social Psychology.'],
  },
  {
    name: 'Lunar astronomy',
    spirit: 'The moon governs energetic tides. The two days before the new moon ask for stillness, not initiation.',
    sciName: 'Circadian rhythms',
    sciBody: 'Biological phase modulates decision quality, effort and self-belief formation measurably.',
    sciRef: 'Mehrhof and Nord, eLife 2025',
    tradExpand: 'Lunar phase is the oldest calendar humans have kept. The waxing moon supports building, the waning moon supports release. The two days before a new moon (the Black Moon window) are read across many traditions as a time of stripping back, not of initiation. The two days after (the Shiva Moon window) are read as the most fertile point for new commitment. CDP marks both on every reading.',
    sciExpand: 'Cortisol, melatonin, and prefrontal cognition follow circadian and ultradian rhythms that shape decision quality across the day. Mehrhof and Nord (2025) demonstrate measurable circadian modulation of self-belief formation. Walker (2017) on hippocampal consolidation in late-lunar phase. Circadian timing affects which kinds of cognitive work land cleanly when.',
    refs: ['Mehrhof and Nord (2025) Circadian modulation of self-belief. eLife.', 'Walker (2017) Why We Sleep. Scribner.', 'Cajochen et al. (2013) Lunar cycle influences human sleep. Current Biology.'],
  },
  {
    name: 'Western astrology',
    spirit: 'Saturn returns ask you to grow up. Jupiter transits open doors. Transits name what is asking of you, now.',
    sciName: 'Predictive frameworks',
    sciBody: 'The brain is a prediction machine. A frame that names what is coming changes how it lands.',
    sciRef: 'Friston, Nature Reviews Neuroscience',
    tradExpand: 'Western psychological astrology (Greene, Tarnas, Hand) reads planetary transits as developmental archetypes. Saturn returns at 28-30 and 56-60 are read as periods of structural reckoning. Jupiter transits as periods of expansion and meaning-making. The natal chart is not a prediction; it is a map of recurring developmental themes calibrated to your birth moment via Swiss Ephemeris (NASA JPL DE431).',
    sciExpand: 'Predictive processing (Clark, Friston) frames the brain as actively constructing experience from prior models. A frame that names what is coming, however arrived at, alters perception, attention and emotional response. The mechanism is not whether stars cause events; it is that named developmental themes durably shape how the brain organises lived experience.',
    refs: ['Friston (2010) The free-energy principle. Nature Reviews Neuroscience.', 'Clark (2016) Surfing Uncertainty. Oxford.', 'Tarnas (2006) Cosmos and Psyche. Viking.', 'Greene (1976) Saturn: A New Look at an Old Devil. Samuel Weiser.'],
  },
  {
    name: 'Dreamspell',
    spirit: 'A 260-day cycle of 20 solar seals and 13 galactic tones. Each day a Kin, each Kin a quality.',
    sciName: 'Neuroplasticity',
    sciBody: 'Repeated daily attention to a stable identity anchor strengthens its representation in the default mode network.',
    sciRef: 'Raichle, Annual Review of Neuroscience',
    tradExpand: 'Dreamspell is a modern 20th-century framework articulated by Jose Arguelles in 1987, building on the ancient Maya tzolkin (260-day count) but using a different correlation. CDP labels Dreamspell explicitly as Arguelles 1987, distinct from the living K\'iche\' count maintained by Maya daykeepers. Each day carries one of 260 Kin, with 52 of them flagged as Galactic Activation Portal days where synchronicities are read as amplified.',
    sciExpand: 'Hebbian plasticity and Raichle\'s work on the default mode network show that repeated daily attention to a stable identity anchor measurably strengthens its representation in self-referential brain networks. The Kin is not magical; it is a stable focal point that becomes meaningful through repeated attention.',
    refs: ['Raichle (2015) The brain\'s default mode network. Annual Review of Neuroscience.', 'Hebb (1949) The Organization of Behavior. Wiley.', 'Arguelles (1987) The Mayan Factor. Bear and Company.'],
  },
  {
    name: 'Relationships',
    spirit: 'Compatibility readings name the dynamics two people bring to each other, the gifts and the friction.',
    sciName: 'Interpersonal neurobiology',
    sciBody: 'Co-regulation between two nervous systems is real, measurable, and shapes both partners over time.',
    sciRef: 'Siegel, Interpersonal Neurobiology',
    tradExpand: 'Synastry and composite chart traditions in Western astrology read two natal charts together to surface recurring dynamics: where one person\'s Saturn meets another\'s Sun, where Venus meets Mars. CDP\'s compatibility layer brings this forward, naming both gifts and friction without flattening them into compatibility scores.',
    sciExpand: 'Interpersonal neurobiology (Siegel) and polyvagal theory (Porges) describe co-regulation between two nervous systems as a measurable process. Attachment theory (Bowlby, Ainsworth) demonstrates how recurring relational patterns durably shape both partners. The frame a couple holds about their dynamic shapes how the dynamic plays out.',
    refs: ['Siegel (2020) The Developing Mind. Guilford, 3rd ed.', 'Porges (2011) The Polyvagal Theory. Norton.', 'Bowlby (1969) Attachment and Loss, Vol 1. Basic.'],
  },
  {
    name: 'Hormonal cycle',
    spirit: 'For women, the inner moon. Follicular, ovulatory, luteal, menstrual. Each phase asks for different work, different rest, different attention.',
    sciName: 'Endocrine rhythms',
    sciBody: 'Estrogen and progesterone shape cognition, mood, sleep and energy across roughly 28 days. The reading reads with that, not against it.',
    sciRef: 'Sundstrom-Poromaa et al., Neuropsychopharmacology 2023',
    tradExpand: 'The menstrual cycle has been read across traditions as an inner lunar rhythm: a small moon nested inside the larger one. Many lineages map the four phases to seasons (inner spring, summer, autumn, winter). The luteal phase is read as the phase of discernment and editing; the follicular as the phase of new building; ovulation as outward expression; menstruation as release and reset. The point is not prescription; it is recognition that the body is already keeping a rhythm the calendar cannot see.',
    sciExpand: 'Estrogen and progesterone modulate hippocampal plasticity, prefrontal connectivity, dopaminergic tone and sleep architecture across the cycle (Sundstrom-Poromaa et al. 2023; Pletzer 2017). Cognitive strengths shift with phase rather than degrade. Reading the day with phase as one input means a reading that knows why a Tuesday in the luteal phase will not feel like a Tuesday in the follicular phase, even when transits are identical.',
    refs: ['Sundstrom-Poromaa et al. (2023) Sex steroid hormones and the brain. Neuropsychopharmacology.', 'Pletzer (2017) Sex hormones and the brain. Frontiers in Neuroscience.', 'Pope and Wurlitzer (2017) Wild Power. Hay House.'],
  },
];

export function openAbout(o: OpenAboutOptions): AboutHandle {
  ensureStyle();

  const view = el('div', { class: 'ab2-view', role: 'dialog', 'aria-label': 'About Cosmic Daily Planner' });

  // Bar
  const bar = el('div', { class: 'ab2-bar' });
  bar.appendChild(el('div', { class: 'ab2-bar-title' }, 'About'));
  const closeBtn = el('button', { type: 'button', class: 'ab2-close', 'aria-label': 'Close' }, '\u00d7');
  closeBtn.addEventListener('click', () => close());
  bar.appendChild(closeBtn);
  view.appendChild(bar);

  const wrap = el('div', { class: 'ab2-wrap' });

  // Eyebrow + title
  wrap.appendChild(el('div', { class: 'ab2-eyebrow' }, 'How your day is read'));
  wrap.appendChild(el('h2', { class: 'ab2-title' }, 'Arriving at the same coordinates.'));
  wrap.appendChild(el('p', { class: 'ab2-sub' }, 'Different lenses on the same moment in time, drawn from different sources, gathered together and translated in different languages, for you, for where you are, as you navigate your world.'));

  // Apex: star + You
  const apex = el('div', { class: 'ab2-apex' });
  const starEl = el('div', {});
  starEl.innerHTML = STAR_SVG;
  apex.appendChild(starEl);
  apex.appendChild(el('div', { class: 'ab2-you' }, 'You'));
  wrap.appendChild(apex);

  // Vee lines
  const veeEl = el('div', {});
  veeEl.innerHTML = VEE_SVG;
  wrap.appendChild(veeEl);

  // Two-panel grid
  const grid = el('div', { class: 'ab2-grid' });

  // Compass card
  const compassCard = el('div', { class: 'ab2-card' });
  compassCard.appendChild(el('div', { class: 'ab2-ce' }, 'The compass'));
  compassCard.appendChild(el('div', { class: 'ab2-cs' }, 'the naked eye, where they meet'));
  const compassImg = el('img', { src: COMPASS_IMG, alt: 'An engraved brass compass beneath a North star, encircled by a faint orbit ring, on a deep blue field.' });
  compassCard.appendChild(compassImg);
  compassCard.appendChild(el('p', {}, 'The day in plain language, the synthesis everyone receives. What today is good for, what to hold lightly, what to orient toward, and one next step. No framework at the door, no jargon from either side.'));
  const eg1 = el('div', { class: 'ab2-eg' });
  eg1.innerHTML = '<b>For example</b>A reflective day. Good for naming the one thing you have been carrying, less good for forcing a fresh start.';
  compassCard.appendChild(eg1);
  const eg2 = el('div', { class: 'ab2-eg' });
  eg2.innerHTML = '<b>Or</b>A day that favours beginnings, the bold move, the first conversation, the change you have been circling, with the wind behind you.';
  compassCard.appendChild(eg2);
  grid.appendChild(compassCard);

  // Reading card
  const readingCard = el('div', { class: 'ab2-card' });
  readingCard.appendChild(el('div', { class: 'ab2-ce' }, 'The reading'));
  readingCard.appendChild(el('div', { class: 'ab2-cs' }, 'the room you enter for depth'));
  readingCard.appendChild(el('p', {}, 'The same day read in full, through tradition and through science, each claim traced to its source and the sceptical voice kept beside the supportive one. Summoned when you want it, never pushed.'));

  // three interactive voice pills with live example swap
  const voiceExamples: Record<string, { note: string; example: string }> = {
    tradition: {
      note: 'The archetypal voice. Ancient symbols read as living patterns.',
      example: 'Kin 207, Blue Crystal Hand. A day of accomplishment and healing, the crystal tone asks what you are clarifying in relationship. The waning moon invites release rather than push. Set one clear intention and let the rest breathe.'
    },
    everyday: {
      note: 'Plain synthesis. The two telescopes in plain language.',
      example: 'A reflective Wednesday. The numbers say 7 of introspection; the moon is waning. Good for naming the one thing you have been carrying, less good for forcing a new beginning. One honest conversation today is worth three planned ones next week.'
    },
    science: {
      note: 'Neuroscience-grounded. Every claim cited.',
      example: 'Late-cycle lunar phase correlates with elevated melatonin onset and reduced prefrontal drive (Walker 2017). Day-number 7 primes introspective salience networks (Oettingen 2023). Conditions favour consolidation over initiation. Protect sleep onset tonight.'
    }
  };
  let activeVoice = 'everyday';

  const voices = el('div', { class: 'ab2-voices' });
  const pillT = el('button', { type: 'button', class: 'ab2-voice t', 'aria-label': 'Tradition voice example' }, 'Tradition');
  const pillE = el('button', { type: 'button', class: 'ab2-voice e active-e', 'aria-label': 'Everyday voice example (default)' }, 'Everyday');
  const pillS = el('button', { type: 'button', class: 'ab2-voice s', 'aria-label': 'Science voice example' }, 'Science');
  voices.appendChild(pillT); voices.appendChild(pillE); voices.appendChild(pillS);
  readingCard.appendChild(voices);

  const voiceNote = el('p', {}, voiceExamples['everyday'].note);
  readingCard.appendChild(voiceNote);

  const eg3 = el('div', { class: 'ab2-eg' });
  const eg3label = el('b', {}, 'For example');
  const eg3text = document.createTextNode(voiceExamples['everyday'].example);
  eg3.appendChild(eg3label);
  eg3.appendChild(eg3text);
  readingCard.appendChild(eg3);

  function activatePill(v: string): void {
    activeVoice = v;
    pillT.className = 'ab2-voice t' + (v === 'tradition' ? ' active-t' : '');
    pillE.className = 'ab2-voice e' + (v === 'everyday' ? ' active-e' : '');
    pillS.className = 'ab2-voice s' + (v === 'science' ? ' active-s' : '');
    voiceNote.textContent = voiceExamples[v].note;
    // replace text node
    while (eg3.firstChild) eg3.removeChild(eg3.firstChild);
    eg3.appendChild(el('b', {}, 'For example'));
    eg3.appendChild(document.createTextNode(voiceExamples[v].example));
  }
  pillT.addEventListener('click', () => activatePill('tradition'));
  pillE.addEventListener('click', () => activatePill('everyday'));
  pillS.addEventListener('click', () => activatePill('science'));
  grid.appendChild(readingCard);
  wrap.appendChild(grid);

  // Coda paragraphs
  wrap.appendChild(el('p', { class: 'ab2-coda' }, 'For thousands of years our minds have searched for the lens that lands, the one that resonates for a given person in a given age, to interpret and translate what they already know. Your senses take in millions of signals each second, and only a handful reach awareness. What passes the filter is set by what you hold as important. A different framework changes what passes, which is why some things land and others do not, and that is trainable. Begin the day with a clear orienting frame and the brain\'s salience network calibrates to it, noticing the relevant and quieting the noise.'));
  wrap.appendChild(el('p', { class: 'ab2-belief' }, 'No belief required. Just the architecture of your own mind.'));
  wrap.appendChild(el('p', { class: 'ab2-keel' }, 'CDP is the keel, the part of a boat that holds steady against the weather, not the wind and not the destination, the steadiness underneath that lets you take a bearing and make the small, kind adjustments, in your body, your mind, your relationships, your work. It orients, it does not instruct. Quiet by default, bottomless on demand. You remain the authority on your own life.'));

  // Science section
  wrap.appendChild(el('div', { class: 'ab2-sci-eyebrow' }, 'The science'));
  const sciTitle = el('h3', { class: 'ab2-sci-title' });
  sciTitle.innerHTML = 'What spiritual practice has always known,<br><em>neuroscience is now describing.</em>';
  wrap.appendChild(sciTitle);

  const colHeads = el('div', { class: 'ab2-col-heads' });
  const chS = el('div', { class: 'ab2-ch spirit' }, 'What the tradition says');
  const chN = el('div', { class: 'ab2-ch science' }, 'What the science says');
  colHeads.appendChild(chS); colHeads.appendChild(chN);
  wrap.appendChild(colHeads);

  // Framework rows
  for (const fw of FRAMEWORKS) {
    const row = el('div', { class: 'ab2-fw-row' });

    const main = el('div', { class: 'ab2-fw-main' });
    main.addEventListener('click', () => {
      row.classList.toggle('open');
    });

    const spiritSide = el('div', {});
    spiritSide.appendChild(el('div', { class: 'ab2-fw-name' }, fw.name));
    spiritSide.appendChild(el('div', { class: 'ab2-fw-spirit' }, fw.spirit));
    main.appendChild(spiritSide);

    const sciSide = el('div', {});
    sciSide.appendChild(el('div', { class: 'ab2-fw-sci-name' }, fw.sciName));
    sciSide.appendChild(el('div', { class: 'ab2-fw-sci-body' }, fw.sciBody));
    sciSide.appendChild(el('div', { class: 'ab2-fw-ref' }, fw.sciRef));
    main.appendChild(sciSide);

    main.appendChild(el('div', { class: 'ab2-fw-toggle' }, 'More'));
    row.appendChild(main);

    const expand = el('div', { class: 'ab2-fw-expand' });
    const expGrid = el('div', { class: 'ab2-exp-grid' });

    const tradCol = el('div', {});
    tradCol.appendChild(el('div', { class: 'ab2-exp-head spirit' }, 'The tradition'));
    tradCol.appendChild(el('div', { class: 'ab2-exp-body' }, fw.tradExpand));
    expGrid.appendChild(tradCol);

    const sciCol = el('div', {});
    sciCol.appendChild(el('div', { class: 'ab2-exp-head science' }, 'The neuroscience'));
    sciCol.appendChild(el('div', { class: 'ab2-exp-body' }, fw.sciExpand));
    for (const ref of fw.refs) {
      sciCol.appendChild(el('div', { class: 'ab2-exp-ref' }, ref));
    }
    expGrid.appendChild(sciCol);

    expand.appendChild(expGrid);
    row.appendChild(expand);
    wrap.appendChild(row);
  }

  // Epigraph
  const epi = el('div', { class: 'ab2-epi' });
  epi.appendChild(el('div', { class: 'ab2-epi-q' }, 'Our life is what our thoughts make it.'));
  epi.appendChild(el('div', { class: 'ab2-epi-a' }, 'Marcus Aurelius, Meditations'));
  wrap.appendChild(epi);

  // CTA: open reading
  if (o.onEnterReading) {
    const cta = el('button', { type: 'button', class: 'ab2-cta' }, 'Open today\u2019s reading');
    cta.addEventListener('click', () => { if (o.onEnterReading) o.onEnterReading(); });
    wrap.appendChild(cta);
    wrap.appendChild(el('div', { class: 'ab2-cta-note' }, 'where the two telescopes meet on one screen'));
  }

  view.appendChild(wrap);
  o.container.appendChild(view);

  let closed = false;
  function close(): void {
    if (closed) return;
    closed = true;
    if (view.parentNode) view.parentNode.removeChild(view);
    if (o.onClose) o.onClose();
  }

  return { close };
}
