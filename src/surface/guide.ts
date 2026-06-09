/*
 * The Guide surface.
 *
 * Ported from the production monolith's twelve section guide (the cdpV22 guide
 * body), dash cleaned and held to the house legibility rules: body text never
 * uses the faint grey, nothing essential is small and italic, no em or en
 * dashes, no exclamations. One section is lifted above the monolith: "What CDP
 * is and is not" no longer calls CDP a wellness app, language the founding
 * charter rejects, and instead frames it as a companion for self knowledge.
 *
 * The guide is share wired, so it saves as image or PDF and copies through the
 * same share infrastructure every other surface uses, replacing the monolith's
 * standalone guide PDF builder.
 */
import { shareControls } from './share';

export interface OpenGuideOptions {
  container: HTMLElement;
  onClose?: () => void;
}

export interface GuideHandle {
  close(): void;
}

type Attrs = Record<string, string>;

function el(tag: string, attrs: Attrs = {}, text?: string): HTMLElement {
  const node = document.createElement(tag);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  if (text != null) node.textContent = text;
  return node;
}

function clear(node: HTMLElement): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

let styled = false;
function ensureStyle(): void {
  if (styled) return;
  styled = true;
  const css = [
    '.cdp-surface .gd-view{position:fixed;inset:0;top:58px;z-index:60;background:var(--page,#031831);overflow-y:auto;}',
    '.cdp-surface .gd-shell{max-width:760px;margin:0 auto;padding:26px 22px 64px;}',
    '.cdp-surface .gd-bar{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:6px;}',
    '.cdp-surface .gd-title{font-family:\'Cormorant Garamond\',\'EB Garamond\',Georgia,serif;font-weight:400;font-size:30px;color:var(--gold,#C9A050);letter-spacing:.005em;}',
    '.cdp-surface .gd-close{background:none;border:1px solid var(--gold-line,#3A3320);color:var(--text-light,#F0E6CC);font-size:20px;line-height:1;cursor:pointer;width:34px;height:34px;border-radius:50%;flex:0 0 auto;}',
    '.cdp-surface .gd-close:hover{border-color:var(--gold,#C9A050);color:var(--gold,#C9A050);}',
    '.cdp-surface .gd-sub{font-family:Cinzel,Georgia,serif;font-size:11px;letter-spacing:.26em;text-transform:uppercase;color:var(--gold,#C9A050);padding-bottom:14px;margin-bottom:22px;border-bottom:1px solid var(--gold-line,#3A3320);}',
    '.cdp-surface .gd-orient{padding:18px 20px;margin-bottom:28px;border:1px solid var(--gold-line,#3A3320);border-radius:6px;background:rgba(201,160,80,0.07);}',
    '.cdp-surface .gd-orient-h{font-family:\'Cormorant Garamond\',\'EB Garamond\',Georgia,serif;font-weight:400;font-size:23px;color:var(--gold,#C9A050);margin-bottom:8px;}',
    '.cdp-surface .gd-orient-p{font-family:\'EB Garamond\',Georgia,serif;font-weight:400;font-size:16px;line-height:1.65;color:var(--text-light,#F0E6CC);}',
    '.cdp-surface .gd-sec{margin-bottom:26px;}',
    '.cdp-surface .gd-label{font-family:Cinzel,Georgia,serif;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--gold,#C9A050);margin-bottom:10px;}',
    '.cdp-surface .gd-p{font-family:\'EB Garamond\',Georgia,serif;font-weight:400;font-size:16px;line-height:1.7;color:var(--text-light,#F0E6CC);margin-bottom:11px;}',
    '.cdp-surface .gd-p:last-child{margin-bottom:0;}',
    '.cdp-surface .gd-row{font-family:\'EB Garamond\',Georgia,serif;font-weight:400;font-size:15.5px;line-height:1.6;color:var(--text-light,#F0E6CC);margin-bottom:8px;}',
    '.cdp-surface .gd-rlabel{color:var(--gold,#C9A050);font-weight:500;}',
    '.cdp-surface .gd-rdesc{font-weight:400;color:var(--text-muted,#D4C8AE);}',
    '.cdp-surface .gd-voices{display:flex;flex-direction:column;gap:10px;margin:12px 0;}',
    '.cdp-surface .gd-voice{padding:11px 14px;border-radius:4px;border-left:3px solid var(--gold,#C9A050);background:rgba(201,160,80,0.08);}',
    '.cdp-surface .gd-voice.science{border-left-color:var(--teal,#81CDB6);background:rgba(129,205,182,0.08);}',
    '.cdp-surface .gd-voice.everyday{border-left-color:var(--text-light,#F0E6CC);background:rgba(240,230,204,0.06);}',
    '.cdp-surface .gd-vlabel{font-family:Cinzel,Georgia,serif;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--gold,#C9A050);margin-bottom:4px;}',
    '.cdp-surface .gd-voice.science .gd-vlabel{color:var(--teal,#81CDB6);}',
    '.cdp-surface .gd-voice.everyday .gd-vlabel{color:var(--text-light,#F0E6CC);}',
    '.cdp-surface .gd-vbody{font-family:\'EB Garamond\',Georgia,serif;font-weight:400;font-size:15px;line-height:1.6;color:var(--text-light,#F0E6CC);}',
    '.cdp-surface .gd-callout{padding:16px 18px;margin-bottom:26px;border-radius:4px;border-left:3px solid var(--teal,#81CDB6);background:rgba(129,205,182,0.08);}',
    '.cdp-surface .gd-callout.is{border-left-color:var(--gold,#C9A050);background:rgba(201,160,80,0.07);}',
    '.cdp-surface .gd-close-line{text-align:center;padding-top:18px;margin-top:8px;border-top:1px solid var(--gold-line,#3A3320);}',
    '.cdp-surface .gd-close-line span{font-family:\'Cormorant Garamond\',\'EB Garamond\',Georgia,serif;font-style:italic;font-size:17px;color:var(--text-muted,#D4C8AE);}',
    '.cdp-surface .gd-share{margin-top:22px;}',
  ].join('');
  const tag = el('style');
  tag.textContent = css;
  document.head.appendChild(tag);
}

export function openGuide(o: OpenGuideOptions): GuideHandle {
  ensureStyle();
  const view = el('div', { class: 'gd-view', role: 'dialog', 'aria-label': 'Cosmic Daily Planner, the complete guide' });
  const shell = el('div', { class: 'gd-shell' });

  const bar = el('div', { class: 'gd-bar' });
  bar.appendChild(el('div', { class: 'gd-title' }, 'Cosmic Daily Planner'));
  const closeBtn = el('button', { type: 'button', class: 'gd-close', 'aria-label': 'Close the guide' }, '\u00d7');
  closeBtn.addEventListener('click', () => { close(); });
  bar.appendChild(closeBtn);
  shell.appendChild(bar);

  shell.appendChild(el('div', { class: 'gd-sub' }, 'The complete guide'));

  // content holds everything that should travel into a shared or saved guide
  const content = el('div', { class: 'gd-content' });
  shell.appendChild(content);

  // orientation
  const orient = el('div', { class: 'gd-orient' });
  orient.appendChild(el('div', { class: 'gd-orient-h' }, 'Two telescopes. Pointed at the same sky.'));
  orient.appendChild(el('div', { class: 'gd-orient-p' }, 'Cosmic Daily Planner is a place where ancient frameworks and modern neuroscience meet. Pythagorean numerology, Western astrology, Mayan calendrics, and lunar cycles, sitting alongside circadian cognition, predictive processing, attachment, and default mode network research. They arrive at the same coordinates. CDP shows you both, in the language you prefer.'));
  content.appendChild(orient);

  function section(label: string): HTMLElement {
    const s = el('div', { class: 'gd-sec' });
    s.appendChild(el('div', { class: 'gd-label' }, label));
    content.appendChild(s);
    return s;
  }
  function p(parent: HTMLElement, text: string): void {
    parent.appendChild(el('div', { class: 'gd-p' }, text));
  }
  function row(parent: HTMLElement, label: string, desc: string): void {
    const r = el('div', { class: 'gd-row' });
    r.appendChild(el('span', { class: 'gd-rlabel' }, label + '  '));
    r.appendChild(el('span', { class: 'gd-rdesc' }, desc));
    parent.appendChild(r);
  }

  // 1. The morning compass
  let s = section('1. The morning compass');
  p(s, 'Your daily check in, before any full reading. Three tiles open at the top of your day.');
  row(s, 'Kin', 'today\u2019s Dreamspell signature, marked when it is a Galactic Activation Portal');
  row(s, 'Moon', 'today\u2019s lunar phase, with Black Moon and Shiva Moon flags when they apply');
  row(s, 'Your day', 'your own number for today, calculated from your birth date');
  p(s, 'Tap any tile to open a quick Oracle drawer in your current voice, each offering follow up questions including a cross voice nudge so you can see the same insight through another lens. Below the tiles is a single intention input. Type a focus for today, even one phrase, and tomorrow\u2019s reading will reference it.');

  // 2. Three voices
  s = section('2. Three voices');
  p(s, 'Every reading section is written in three voices. Toggle between them at the top of any reading, and open more than one at once.');
  const voices = el('div', { class: 'gd-voices' });
  function voice(cls: string, label: string, body: string): void {
    const v = el('div', { class: 'gd-voice' + (cls ? ' ' + cls : '') });
    v.appendChild(el('div', { class: 'gd-vlabel' }, label));
    v.appendChild(el('div', { class: 'gd-vbody' }, body));
    voices.appendChild(v);
  }
  voice('', 'Tradition', 'Symbolic and archetypal, the language of millennia of human reflection. Numerology, archetypal astrology in the line of Greene and Tarnas, Maya calendrics, and lunar wisdom.');
  voice('science', 'Science', 'Mechanistic and causal. Circadian cognition (Cajochen), the default mode network (Raichle), interoception (Barrett), predictive processing (Clark), attachment (Bowlby), and hippocampal consolidation (Walker).');
  voice('everyday', 'Everyday', 'Plain spoken, with no jargon from either tradition or science. The language of a thoughtful friend who happens to know what your day is asking for.');
  s.appendChild(voices);
  p(s, 'Below each section you will find chips for more Tradition, more Science, and more Everyday. Tap one to reveal that voice for that section inline, without losing your place.');

  // 3. The surfaces
  s = section('3. The surfaces');
  row(s, 'Reading', 'your full daily Oracle across all four frameworks, in three voices');
  row(s, 'Daily card', 'a single shareable card with today\u2019s synthesis');
  row(s, 'Calendar', 'a monthly view with Kin, moon phases, portals, master numbers, and the Black and Shiva Moon windows. Tap any day to preview or open a reading for it. The Best Day finder lives at the top.');
  row(s, 'My energy', 'your personal numerology, Life Path, Personal Year, and Birth Kin');
  row(s, 'Compatibility', 'enter a second person\u2019s birth data for a relationship reading across the frameworks');
  row(s, 'Profile', 'save your birth details, time, location, and personal context. The Oracle becomes more specific the more you tell it.');

  // 4. Reading depths
  s = section('4. Reading depths');
  row(s, 'Free', 'Universal Day, moon phase, and Kin. Instant.');
  row(s, 'Seeker', 'all four frameworks, priorities, shadow work, and the week ahead.');
  row(s, 'Initiate', 'Seeker plus the monthly arc, lunation map, and wavespell sequence.');
  row(s, 'Mystic', 'natal chart integration, the yearly arc, and transit themes.');
  row(s, 'Oracle', 'maximum depth across all frameworks, with Hellenistic lots, biorhythms, and an optional hormonal phase.');

  // 5. Special days
  s = section('5. Special days');
  row(s, 'Portal day', 'a Galactic Activation Portal. The Dreamspell tradition holds these as days when synchronicities amplify, 52 such Kins in each 260 day cycle. Symbolic.');
  row(s, 'Black Moon', 'two days before the new moon, a liminal threshold. Symbolically a time to complete and release rather than initiate, useful for closing loops.');
  row(s, 'Shiva Moon', 'two days after the new moon, generative and fertile. Symbolically auspicious for new actions, new conversations, and fresh starts.');
  row(s, 'Master days', '11, 22, 33, and 44, days of heightened frequency. Open the day in the calendar to read its specific meaning.');
  row(s, 'Nine day', 'completion energy, good for finishing rather than starting.');
  row(s, 'Seven day', 'contemplative and introspective, a day to slow down and reflect.');

  // 6. Memory and continuity (callout)
  const mem = el('div', { class: 'gd-callout' });
  mem.appendChild(el('div', { class: 'gd-label' }, '6. Memory and continuity'));
  mem.appendChild(el('div', { class: 'gd-p' }, 'CDP is built so it remembers. The Oracle is not a daily slot machine. Today\u2019s reading is in conversation with yesterday and the day before.'));
  mem.appendChild(el('div', { class: 'gd-p' }, 'When you write an intention into the Compass, your next reading references it, and a thread panel appears at the top so the Oracle picks up where you left off.'));
  mem.appendChild(el('div', { class: 'gd-p' }, 'When you are signed in, your intentions are saved to a private store scoped only to you and travel across devices. Anonymous use keeps everything to the current session.'));
  content.appendChild(mem);

  // 7. Profiles
  s = section('7. Profiles');
  p(s, 'Save the people who matter to you, family, friends, and colleagues, and switch the active profile before generating a reading to receive it for that person. Use Compatibility to read two profiles together.');
  p(s, 'The more personal context you add, what you are building, who matters to you, what you are navigating, the more specific the Oracle becomes. It speaks to your actual life, not a generic one.');

  // 8. Asking the Oracle
  s = section('8. Asking the Oracle');
  p(s, 'Tap any section heading or card in a reading to open a follow up drawer. Pre built chips suggest common questions, or you can type your own.');
  p(s, 'The Oracle answers in your current voice and references your full reading. Ask about the shadow side of a Kin, how a transit meets your natal chart, or what to do practically with a Personal Day energy.');

  // 9. Pick a day
  s = section('9. Pick a day');
  p(s, 'Open the Calendar. Each day shows badges for Kin, moon phase, portal, and master numbers. Tap any day to see its energy and open a full reading for it.');
  p(s, 'The Best Day finder at the top takes what you are planning, a difficult conversation, a launch, a long flight, a creative session, and returns the most favourable day in the month ahead, with reasons specific to your numerology and the wider sky.');

  // 10. A suggested daily flow
  s = section('10. A suggested daily flow');
  row(s, 'Morning', 'open the Compass, tap a tile if anything calls, and type one line of intention. Then, if you have time, generate a full reading.');
  row(s, 'Midday', 'return to the reading, read the afternoon pacing, and toggle to a different voice if the morning one has gone stale.');
  row(s, 'Evening', 'scroll to the reflection and close the day on purpose. The Oracle remembers what you wrote in the morning.');

  // 11. Sources and integrity
  s = section('11. Sources and integrity');
  p(s, 'Astronomical positions come from the Swiss Ephemeris (Astrodienst) and JPL Horizons (NASA).');
  p(s, 'Maya scholarship draws on Sprajc, Inomata and Aveni (2023, Science Advances) and Aldana (2022). Dreamspell is always labelled as Arguelles 1987, a twentieth century system held distinct from the living K\u2019iche\u2019 Maya count.');
  p(s, 'Western astrology rests on Tarnas (2006), Greene (1976), Hand (2002), and Brennan (2017). Numerology on Drayer (2002) and Kahn (2001). The neuroscience on Cajochen and Schmidt (2024), Raichle (2015), Barrett and Hoemann (2018), Walker (2017), and Clark (2016).');
  p(s, 'Every factual claim traces to a named authority. Every symbolic claim is labelled as symbolic. Where the evidence is contested, the sceptical literature sits alongside the supporting literature.');

  // 12. What CDP is and is not (charter aligned, lifted above the monolith)
  const isnot = el('div', { class: 'gd-callout is' });
  isnot.appendChild(el('div', { class: 'gd-label' }, '12. What CDP is, and is not'));
  isnot.appendChild(el('div', { class: 'gd-p' }, 'It is a companion for self knowledge. It brings the best of ancient frameworks and current evidence to give you the texture of your day in the language you choose, and it leaves the living to you. It names, it offers, and it can say an honest no. You remain the authority on your own life.'));
  isnot.appendChild(el('div', { class: 'gd-p' }, 'It is not a medical product, a therapist, or a doctor, and it is not a substitute for professional advice. If you are in crisis or need clinical support, please reach out to a qualified professional. In the UK you can call Samaritans on 116 123 at any hour, and in the US you can call or text the 988 Suicide and Crisis Lifeline.'));
  content.appendChild(isnot);

  // closing line
  const closing = el('div', { class: 'gd-close-line' });
  closing.appendChild(el('span', {}, 'Two telescopes. Pointed at the same sky.'));
  content.appendChild(closing);

  // share the guide through the shared infrastructure
  const share = shareControls({
    title: 'Cosmic Daily Planner, the complete guide',
    text: () => (content.innerText || content.textContent || 'Cosmic Daily Planner, the complete guide'),
    node: () => content,
  });
  share.classList.add('gd-share');
  shell.appendChild(share);

  view.appendChild(shell);
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
