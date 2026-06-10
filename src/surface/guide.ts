/*
 * The Guide surface.
 *
 * Rebuilt to today's production guide (the twelve section tour), rendered inside
 * the vessel overlay scaffold and held to the house rules: body text never uses
 * the faint grey, nothing essential is small and italic, no em or en dashes, no
 * exclamations. The two canonical engravings travel with the guide: the two
 * telescopes sighting one star on the cover, and the compass beneath the North
 * star on the home section.
 *
 * The guide is share wired, so it saves as image or PDF and copies through the
 * same share infrastructure every other surface uses.
 */
import { artefactControlsFromNode } from './artefact';
import { GUIDE_COVER, GUIDE_HERO } from './guide-images';

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

type Seg = { t: string; b?: boolean };

function rich(cls: string, segs: Seg[]): HTMLElement {
  const node = el('p', { class: cls });
  for (const s of segs) {
    if (s.b) node.appendChild(el('b', {}, s.t));
    else node.appendChild(document.createTextNode(s.t));
  }
  return node;
}

let styled = false;
function ensureStyle(): void {
  if (styled) return;
  styled = true;
  const css = [
    // chrome
    '.cdp-surface .gd-view{position:fixed;inset:0;top:58px;z-index:60;background:var(--bg,#031831);overflow-y:auto;}',
    '.cdp-surface .gd-shell{max-width:760px;margin:0 auto;padding:26px 22px 64px;}',
    '.cdp-surface .gd-bar{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:6px;}',
    '.cdp-surface .gd-title{font-family:\'Cormorant Garamond\',\'EB Garamond\',Georgia,serif;font-weight:400;font-size:30px;color:var(--gold,#C9A050);letter-spacing:.005em;}',
    '.cdp-surface .gd-close{background:none;border:1px solid var(--gold-line,#3A3320);color:var(--text-light,#F0E6CC);font-size:20px;line-height:1;cursor:pointer;width:34px;height:34px;border-radius:50%;flex:0 0 auto;}',
    '.cdp-surface .gd-close:hover{border-color:var(--gold,#C9A050);color:var(--gold,#C9A050);}',
    '.cdp-surface .gd-sub{font-family:Cinzel,Georgia,serif;font-size:11px;letter-spacing:.26em;text-transform:uppercase;color:var(--gold,#C9A050);padding-bottom:14px;margin-bottom:8px;border-bottom:1px solid var(--gold-line,#3A3320);}',
    '.cdp-surface .gd-share{margin-top:22px;}',
    // cover
    '.cdp-surface .gd-cover{text-align:center;padding:12px 0 30px;}',
    '.cdp-surface .gd-cover img{width:300px;max-width:78%;display:block;margin:0 auto 18px;border-radius:10px;}',
    '.cdp-surface .gd-ks{font-family:Cinzel,Georgia,serif;font-size:12px;letter-spacing:.3em;text-transform:uppercase;color:var(--gold,#C9A050);}',
    '.cdp-surface .gd-cover-h1{font-family:Cinzel,Georgia,serif;font-weight:600;font-size:34px;margin:10px 0 6px;color:var(--text-light,#F0E6CC);letter-spacing:.02em;}',
    '.cdp-surface .gd-tag{font-family:\'Cormorant Garamond\',\'EB Garamond\',Georgia,serif;font-size:23px;color:var(--gold-soft,#E8C878);}',
    '.cdp-surface .gd-frame{font-family:\'Cormorant Garamond\',\'EB Garamond\',Georgia,serif;font-size:20px;color:var(--text-muted,#D4C8AE);max-width:600px;margin:16px auto 0;line-height:1.6;}',
    '.cdp-surface .gd-fn{font-family:\'EB Garamond\',Georgia,serif;font-size:15px;color:var(--text-muted,#D4C8AE);margin-top:16px;}',
    // sections
    '.cdp-surface .gd-sec{padding:34px 0;border-top:1px solid var(--gold-line,#3A3320);}',
    '.cdp-surface .gd-sechead{display:flex;gap:16px;align-items:flex-start;margin-bottom:14px;}',
    '.cdp-surface .gd-num{font-family:Cinzel,Georgia,serif;font-size:15px;color:var(--gold,#C9A050);border:1px solid var(--gold-line,#3A3320);border-radius:50%;width:40px;height:40px;min-width:40px;display:flex;align-items:center;justify-content:center;}',
    '.cdp-surface .gd-eyebrow{font-family:Cinzel,Georgia,serif;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--gold,#C9A050);}',
    '.cdp-surface .gd-h2{font-family:Cinzel,Georgia,serif;font-weight:600;font-size:24px;margin:3px 0 0;line-height:1.2;color:var(--text-light,#F0E6CC);}',
    '.cdp-surface .gd-h3{font-family:Cinzel,Georgia,serif;font-size:16px;color:var(--gold-soft,#E8C878);margin:20px 0 4px;}',
    '.cdp-surface .gd-p{font-family:\'EB Garamond\',Georgia,serif;font-size:16px;line-height:1.7;color:var(--text-muted,#D4C8AE);margin:0 0 11px;}',
    '.cdp-surface .gd-p:last-child{margin-bottom:0;}',
    '.cdp-surface .gd-p b{color:var(--text-light,#F0E6CC);font-weight:600;}',
    '.cdp-surface .gd-lead{font-family:\'EB Garamond\',Georgia,serif;font-size:19px;line-height:1.6;color:var(--text-light,#F0E6CC);margin:0 0 11px;}',
    // quick start
    '.cdp-surface .gd-qs{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:6px;}',
    '.cdp-surface .gd-step{background:var(--navy,#0D1E33);border:1px solid var(--gold-line,#3A3320);border-radius:10px;padding:16px 18px;}',
    '.cdp-surface .gd-stepn{font-family:Cinzel,Georgia,serif;color:var(--gold,#C9A050);letter-spacing:.16em;font-size:12px;text-transform:uppercase;}',
    '.cdp-surface .gd-step .gd-p{margin:6px 0 0;}',
    // tip
    '.cdp-surface .gd-tip{background:rgba(129,205,182,.08);border-left:3px solid var(--teal,#81CDB6);border-radius:8px;padding:13px 16px;margin:16px 0 0;color:var(--text-light,#F0E6CC);font-family:\'EB Garamond\',Georgia,serif;font-size:15.5px;line-height:1.6;}',
    '.cdp-surface .gd-tipk{font-family:Cinzel,Georgia,serif;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--teal,#81CDB6);margin-right:10px;}',
    // hero
    '.cdp-surface .gd-hero{display:block;width:260px;max-width:68%;margin:6px auto 6px;border-radius:10px;}',
    '.cdp-surface .gd-cap{text-align:center;font-family:\'Cormorant Garamond\',\'EB Garamond\',Georgia,serif;font-style:italic;font-size:18px;color:var(--text-muted,#D4C8AE);margin:0 0 10px;}',
    // surfaces
    '.cdp-surface .gd-surf{display:flex;gap:16px;align-items:flex-start;background:var(--navy,#0D1E33);border:1px solid var(--gold-line,#3A3320);border-radius:10px;padding:16px 18px;margin-top:12px;}',
    '.cdp-surface .gd-surfbadge{font-size:24px;color:var(--gold-soft,#E8C878);min-width:38px;text-align:center;line-height:1.4;}',
    '.cdp-surface .gd-surfname{font-family:Cinzel,Georgia,serif;font-size:15px;color:var(--text-light,#F0E6CC);letter-spacing:.04em;}',
    '.cdp-surface .gd-surf .gd-p{margin:6px 0 0;}',
    '.cdp-surface .gd-surfdo{font-family:\'EB Garamond\',Georgia,serif;font-size:15.5px;line-height:1.6;color:var(--text-light,#F0E6CC);margin:8px 0 0;}',
    '.cdp-surface .gd-surfdo b{color:var(--gold-soft,#E8C878);font-weight:600;}',
    '.cdp-surface .gd-soon{font-family:Cinzel,Georgia,serif;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--bg,#031831);background:var(--gold-soft,#E8C878);border-radius:20px;padding:3px 9px;margin-left:10px;vertical-align:middle;}',
    // voices
    '.cdp-surface .gd-voices{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:14px;}',
    '.cdp-surface .gd-voice{background:var(--navy,#0D1E33);border:1px solid var(--gold-line,#3A3320);border-radius:10px;padding:15px 16px;border-top:3px solid var(--gold-line,#3A3320);}',
    '.cdp-surface .gd-voice.t{border-top-color:var(--gold,#C9A050);}',
    '.cdp-surface .gd-voice.s{border-top-color:var(--teal,#81CDB6);}',
    '.cdp-surface .gd-voice.e{border-top-color:var(--text-light,#F0E6CC);}',
    '.cdp-surface .gd-vn{font-family:Cinzel,Georgia,serif;letter-spacing:.12em;font-size:14px;}',
    '.cdp-surface .gd-voice.t .gd-vn{color:var(--gold,#C9A050);}',
    '.cdp-surface .gd-voice.s .gd-vn{color:var(--teal,#81CDB6);}',
    '.cdp-surface .gd-voice.e .gd-vn{color:var(--text-light,#F0E6CC);}',
    '.cdp-surface .gd-voice .gd-p{margin:6px 0 0;font-size:15px;}',
    // wells
    '.cdp-surface .gd-wells{margin-top:12px;border:1px solid var(--gold-line,#3A3320);border-radius:10px;overflow:hidden;}',
    '.cdp-surface .gd-well{display:grid;grid-template-columns:230px 1fr;border-top:1px solid var(--gold-line,#3A3320);}',
    '.cdp-surface .gd-well:first-child{border-top:none;}',
    '.cdp-surface .gd-wk{background:var(--navy,#0D1E33);padding:12px 16px;font-family:Cinzel,Georgia,serif;font-size:13px;color:var(--gold-soft,#E8C878);letter-spacing:.04em;}',
    '.cdp-surface .gd-wv{padding:12px 16px;color:var(--text-muted,#D4C8AE);font-family:\'EB Garamond\',Georgia,serif;font-size:15px;line-height:1.6;}',
    // glyph key
    '.cdp-surface .gd-gk{border:1px solid var(--gold-line,#3A3320);border-radius:10px;overflow:hidden;margin-top:14px;}',
    '.cdp-surface .gd-gkrow{display:grid;grid-template-columns:64px 190px 1fr;align-items:center;border-top:1px solid var(--gold-line,#3A3320);}',
    '.cdp-surface .gd-gkrow:first-child{border-top:none;}',
    '.cdp-surface .gd-gkglyph{font-size:22px;text-align:center;color:var(--gold-soft,#E8C878);padding:12px 0;background:var(--navy,#0D1E33);}',
    '.cdp-surface .gd-gkglyph.teal{color:var(--teal,#81CDB6);}',
    '.cdp-surface .gd-gkglyph.gold{color:var(--gold,#C9A050);}',
    '.cdp-surface .gd-gkglyph.txt{color:var(--text-light,#F0E6CC);font-family:\'EB Garamond\',Georgia,serif;font-size:15px;}',
    '.cdp-surface .gd-gkname{font-family:Cinzel,Georgia,serif;font-size:13px;color:var(--text-light,#F0E6CC);padding:0 16px;letter-spacing:.03em;}',
    '.cdp-surface .gd-gkmean{color:var(--text-muted,#D4C8AE);padding:12px 16px;font-family:\'EB Garamond\',Georgia,serif;font-size:15px;line-height:1.55;}',
    // special days
    '.cdp-surface .gd-days{margin-top:12px;}',
    '.cdp-surface .gd-day{display:flex;gap:14px;border-top:1px solid var(--gold-line,#3A3320);padding:12px 0;}',
    '.cdp-surface .gd-day:first-child{border-top:none;}',
    '.cdp-surface .gd-dg{font-size:22px;min-width:34px;text-align:center;color:var(--gold-soft,#E8C878);}',
    '.cdp-surface .gd-dayname{font-family:Cinzel,Georgia,serif;font-size:14px;letter-spacing:.04em;color:var(--text-light,#F0E6CC);}',
    '.cdp-surface .gd-day .gd-p{margin:3px 0 0;font-size:15.5px;}',
    // callout
    '.cdp-surface .gd-callout{background:var(--raised,#192E4A);border:1px solid var(--gold-line,#3A3320);border-left:3px solid var(--gold,#C9A050);border-radius:10px;padding:16px 20px;margin-top:14px;}',
    '.cdp-surface .gd-callout-h{font-family:Cinzel,Georgia,serif;font-size:14px;color:var(--gold-soft,#E8C878);margin-bottom:8px;display:flex;align-items:center;flex-wrap:wrap;}',
    // foot
    '.cdp-surface .gd-foot{text-align:center;color:var(--text-muted,#D4C8AE);font-family:\'Cormorant Garamond\',\'EB Garamond\',Georgia,serif;font-style:italic;font-size:19px;margin-top:38px;padding-top:24px;border-top:1px solid var(--gold-line,#3A3320);}',
    // responsive
    '@media(max-width:680px){.cdp-surface .gd-qs,.cdp-surface .gd-voices{grid-template-columns:1fr;}.cdp-surface .gd-well,.cdp-surface .gd-gkrow{grid-template-columns:1fr;}.cdp-surface .gd-gkglyph{padding:8px 0;}}',
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

  // content holds everything that travels into a shared or saved guide
  const content = el('div', { class: 'gd-content' });
  shell.appendChild(content);

  // local builders bound to this content node
  function p(parent: HTMLElement, text: string): void {
    parent.appendChild(el('p', { class: 'gd-p' }, text));
  }
  function lead(parent: HTMLElement, text: string): void {
    parent.appendChild(el('p', { class: 'gd-lead' }, text));
  }
  function h3(parent: HTMLElement, text: string): void {
    parent.appendChild(el('div', { class: 'gd-h3' }, text));
  }
  function tip(parent: HTMLElement, text: string): void {
    const t = el('div', { class: 'gd-tip' });
    t.appendChild(el('span', { class: 'gd-tipk' }, 'Tip'));
    t.appendChild(document.createTextNode(text));
    parent.appendChild(t);
  }
  function section(num: string, eyebrow: string, h2: string): HTMLElement {
    const s = el('section', { class: 'gd-sec' });
    const head = el('div', { class: 'gd-sechead' });
    head.appendChild(el('span', { class: 'gd-num' }, num));
    const titles = el('div');
    titles.appendChild(el('div', { class: 'gd-eyebrow' }, eyebrow));
    titles.appendChild(el('div', { class: 'gd-h2' }, h2));
    head.appendChild(titles);
    s.appendChild(head);
    content.appendChild(s);
    return s;
  }
  function surf(parent: HTMLElement, glyph: string, name: string, body: string, doText?: string): void {
    const card = el('div', { class: 'gd-surf' });
    card.appendChild(el('span', { class: 'gd-surfbadge' }, glyph));
    const b = el('div', { class: 'gd-surfbody' });
    b.appendChild(el('div', { class: 'gd-surfname' }, name));
    b.appendChild(el('p', { class: 'gd-p' }, body));
    if (doText) {
      const d = el('p', { class: 'gd-surfdo' });
      d.appendChild(el('b', {}, 'What to do'));
      d.appendChild(document.createTextNode('  ' + doText));
      b.appendChild(d);
    }
    card.appendChild(b);
    parent.appendChild(card);
  }
  function voiceCard(parent: HTMLElement, cls: string, name: string, body: string): void {
    const v = el('div', { class: 'gd-voice ' + cls });
    v.appendChild(el('div', { class: 'gd-vn' }, name));
    v.appendChild(el('p', { class: 'gd-p' }, body));
    parent.appendChild(v);
  }
  function wellRow(parent: HTMLElement, k: string, v: string): void {
    const w = el('div', { class: 'gd-well' });
    w.appendChild(el('div', { class: 'gd-wk' }, k));
    w.appendChild(el('div', { class: 'gd-wv' }, v));
    parent.appendChild(w);
  }
  function gkRow(parent: HTMLElement, glyph: string, glyphCls: string, name: string, mean: string): void {
    const r = el('div', { class: 'gd-gkrow' });
    r.appendChild(el('span', { class: 'gd-gkglyph ' + glyphCls }, glyph));
    r.appendChild(el('span', { class: 'gd-gkname' }, name));
    r.appendChild(el('span', { class: 'gd-gkmean' }, mean));
    parent.appendChild(r);
  }
  function dayRow(parent: HTMLElement, glyph: string, name: string, text: string): void {
    const d = el('div', { class: 'gd-day' });
    d.appendChild(el('span', { class: 'gd-dg' }, glyph));
    const box = el('div');
    box.appendChild(el('div', { class: 'gd-dayname' }, name));
    box.appendChild(el('p', { class: 'gd-p' }, text));
    d.appendChild(box);
    parent.appendChild(d);
  }

  // cover
  const cover = el('header', { class: 'gd-cover' });
  const coverImg = el('img', { src: GUIDE_COVER, alt: 'Two engraved brass telescopes on tripods, both pointed at a single bright star.' });
  cover.appendChild(coverImg);
  cover.appendChild(el('div', { class: 'gd-tag' }, 'Two telescopes, pointed at the same sky.'));
  cover.appendChild(el('p', { class: 'gd-frame' }, 'A keel for your days, and a bridge to your own higher intelligence. One line in, a clearer frame out. The reading orients; the living stays yours.'));
  cover.appendChild(el('p', { class: 'gd-fn' }, 'A short tour of how it works, what to tap, and how to get more from it. Print it, save it as a PDF, or pass it to someone.'));
  content.appendChild(cover);

  // 1. Start here
  let s = section('1', 'Start here', 'Thirty seconds is enough to begin.');
  lead(s, 'You do not need to learn the whole system to use it. This is the short version. Everything after it is there when you want more.');
  const qs = el('div', { class: 'gd-qs' });
  const steps: Array<[string, string]> = [
    ['Open', 'Open the Compass. Three tiles show the shape of today, and a single line waits for you.'],
    ['Read', 'Read the one composed line. That is the whole day in plain language, before any depth.'],
    ['Set a line', 'Type one intention, even a phrase. Tomorrow the reading will pick it up.'],
    ['Return', 'Come back tonight. Close the day, and let the next one carry what mattered.'],
  ];
  for (const [n, body] of steps) {
    const step = el('div', { class: 'gd-step' });
    step.appendChild(el('div', { class: 'gd-stepn' }, n));
    step.appendChild(el('p', { class: 'gd-p' }, body));
    qs.appendChild(step);
  }
  s.appendChild(qs);
  tip(s, 'If you only ever use the Compass and one intention a day, you are using CDP well. Depth is an invitation, never a requirement.');

  // 2. The idea
  s = section('2', 'The idea', 'Two telescopes, and a wider bridge behind them.');
  p(s, 'Ancient traditions and modern science are not rivals. Built in different centuries, written in different languages, they often arrive at the same coordinates. CDP holds both and shows you the day through whichever lens lands for you.');
  h3(s, 'The compass and the telescopes');
  s.appendChild(rich('gd-p', [
    { t: 'The ' }, { t: 'Compass', b: true }, { t: ' is the naked eye. It is the plain synthesis everyone receives, the day in a single clear read, with no framework at the door. The ' }, { t: 'telescopes', b: true }, { t: ' are the two deeper lenses, Tradition and Science, that you raise on demand when you want to see further. The Compass is for orientation in a moment. The telescopes are for when you want the why beneath it.' },
  ]));
  h3(s, 'It does not run everything through astrology');
  p(s, 'This is the part most people miss. The four symbolic frameworks are one set of instruments, not the whole observatory. Where a day is better served by the science of rest, the stance of a Stoic, a plain question about attention, or the practice behind a therapeutic exercise, that is what CDP reaches for instead. The two telescopes are the emblem. The bridge behind them is wider, and the reading draws on whatever genuinely serves the translation.');
  const wells = el('div', { class: 'gd-wells' });
  wellRow(wells, 'Cognitive and affective neuroscience', 'Constructed emotion, the default mode network and self-narrative, interoception, predictive processing, sleep and memory, and circadian timing.');
  wellRow(wells, 'Psychoneuroimmunology', 'How stress, rest, and connection reach the body, drawn from current reviews rather than single studies.');
  wellRow(wells, 'Depth psychology and attachment', 'The work of Jung, Bowlby, and Siegel on pattern, security, and the stories we hold.');
  wellRow(wells, 'Applied therapeutic practice', 'Cognitive behavioural therapy and Gestalt, used as practice and stance, never as treatment.');
  wellRow(wells, 'Contemplative science', 'Mindfulness and attention research, with the sceptical literature kept beside the supportive, so the ground is honest.');
  wellRow(wells, 'Philosophy and wisdom traditions', 'Stoicism among them. The reading that closes a hard day may answer in the voice of Marcus Aurelius rather than a chart.');
  wellRow(wells, 'The four symbolic frameworks', 'Pythagorean numerology, Western astrology, Mayan and Dreamspell calendrics, and lunar cycles, each computed live.');
  s.appendChild(wells);
  tip(s, 'Every factual claim traces to a named authority. Every symbolic claim is labelled symbolic. Where the evidence is contested, the doubting voice sits beside the supporting one.');

  // 3. Why it works
  s = section('3', 'Why it works', 'It remembers you.');
  lead(s, 'This is the heart of it, so it sits near the front. CDP is not a daily slot machine. Today is in conversation with yesterday and the day before.');
  p(s, 'When you write an intention into the Compass, your next reading references it, and a thread appears at the top so the Oracle picks up where you left off. The board call you named on Monday is recognised on Thursday. Over weeks and months that thread becomes a quiet record of what you have been carrying, working on, and resolving. A reading composed around something you are actually holding is not a horoscope. It is orientation for your real life.');
  p(s, 'When you are signed in, your intentions are saved to a private store scoped only to you, and they travel across your devices. Anonymous use keeps everything to the current session and saves nothing.');
  tip(s, 'The single most valuable habit is the one line of intention. It is what turns a daily reading into a relationship that knows you.');

  // 4. Made to be shared
  s = section('4', 'Made to be shared', 'A line worth passing on.');
  lead(s, 'Some days a single line lands so squarely that you want to send it to someone. CDP is built for that.');
  p(s, 'Your people know you. Sharing is the chance to pass on what touched you, what helped, or what you simply want them to see: a resonant line from a reading, an insight, today\u2019s Daily Card, a compatibility read between the two of you, or the shape of your year. Share and Invite sits in the main navigation, alongside the Compass and the Reading, because this is a first class part of the product, not a footnote.');
  p(s, 'You can save a reading or card as an image or a PDF, copy a line to send in a message, take a screenshot of anything that moved you, or invite someone in directly. A compatibility reading is the natural way to bring a partner, a friend, or a colleague into it with you.');
  tip(s, 'A shared card carries its own invitation. The best growth of a quiet product is one person showing another something true.');

  // 5. The home
  s = section('5', 'The home', 'The morning Compass.');
  s.appendChild(el('img', { class: 'gd-hero', src: GUIDE_HERO, alt: 'An engraved brass compass beneath a North star, encircled by a faint orbit ring, on a deep blue field.' }));
  s.appendChild(el('p', { class: 'gd-cap' }, 'The Compass is the one surface that does not change. What changes is the day inside it.'));
  p(s, 'The Compass opens your day. Three tiles show its shape at a glance.');
  surf(s, '\u2662', 'Kin', 'Today\u2019s Mayan and Dreamspell signature, marked with a star when it is a Galactic Activation Portal.');
  surf(s, '\u263D', 'Moon', 'Today\u2019s lunar phase, flagged when it falls in a Black Moon or Shiva Moon window.');
  surf(s, '\u272A', 'Your day', 'Your own number for today, drawn from your birth date and the day\u2019s energy.');
  p(s, 'Tap any tile to open a quick drawer in your current voice, each with a few follow up questions and a nudge to see the same thing through another lens. Below the tiles is a single intention line.');
  tip(s, 'The small help mark by the title opens a short explainer of the Compass and the two telescopes, any time you want it.');

  // 6. The three voices
  s = section('6', 'The three voices', 'Choose the language you think in.');
  p(s, 'Every reading is written in three voices. The toggle sits at the top of any reading. Everyday is the synthesis you receive by default. Tradition and Science are there on demand, to validate and cross reference, in whichever language feels natural to you.');
  const voices = el('div', { class: 'gd-voices' });
  voiceCard(voices, 't', 'Tradition', 'Symbolic and archetypal. The language of millennia of reflection. Numerology, archetypal astrology, Maya calendrics, lunar wisdom.');
  voiceCard(voices, 's', 'Science', 'Mechanistic and causal. Circadian cognition, the default mode network, interoception, predictive processing, attachment, sleep and memory.');
  voiceCard(voices, 'e', 'Everyday', 'Plain spoken, with no jargon from either side. A thoughtful friend who happens to know what your day is asking for.');
  s.appendChild(voices);
  p(s, 'Under each section you will find chips for more Tradition, more Science, and more Everyday. Tap one to reveal that voice for that section inline, without losing your place. More than one can be open at once, so you can read the same insight through two lenses side by side.');
  tip(s, 'If the morning voice has gone stale by the afternoon, switch it. Same day, same data, a different language.');

  // 7. A full reading
  s = section('7', 'A full reading', 'The room you enter for depth.');
  p(s, 'When you want more than the Compass, open the Reading. The same day is read in full across the frameworks and the wider bridge, each claim traced to its source, the sceptical voice kept beside the supportive one. Tap any section heading or card to open a follow up drawer, where you can take a suggested question or type your own, and the Oracle answers in your current voice with your whole reading in view.');
  h3(s, 'Reading depths');
  p(s, 'Depth tracks how much you want. During the beta, every depth is open to you. Paid subscription arrives later.');
  surf(s, '\u2726', 'Free', 'Universal day, moon phase, and Kin. Instant.');
  surf(s, '\u26A1', 'Seeker', 'All four frameworks, priorities, shadow work, and the week ahead.');
  surf(s, '\u263E', 'Initiate', 'Seeker plus the monthly arc, the lunation map, and the wavespell sequence.');
  surf(s, '\u25C9', 'Mystic', 'Natal chart integration, the yearly arc, and transit themes.');
  surf(s, '\u25C8', 'Oracle', 'Maximum depth across everything, with Hellenistic lots, biorhythms, and an optional cycle phase.');
  const priceCallout = el('div', { class: 'gd-callout' });
  const ph = el('div', { class: 'gd-callout-h' });
  ph.appendChild(el('b', {}, 'On pricing.'));
  ph.appendChild(el('span', { class: 'gd-soon' }, 'coming soon'));
  priceCallout.appendChild(ph);
  priceCallout.appendChild(el('p', { class: 'gd-p' }, 'All depths are open during the beta as our thanks for being early. Subscription pricing launches later, with Seeker at nine pounds a month, Initiate at twenty nine, Mystic at seventy nine, and Oracle by enquiry. Nothing is charged in the beta.'));
  s.appendChild(priceCallout);

  // 8. The surfaces
  s = section('8', 'The surfaces', 'Everything else, by where it lives.');
  p(s, 'The main navigation carries the Compass, the Reading, the Calendar, and Share and Invite. The menu holds the rest. Here is each one and the single thing to do with it.');
  surf(s, '\u25EB', 'Calendar', 'A month at a glance, each day badged with Kin, moon phase, portals, master numbers, and the Black and Shiva Moon windows. The Best Day finder sits at the top.', 'Tell the Best Day finder what you are planning, a hard conversation, a launch, a long flight, a creative session, and it returns the most favourable day ahead, with reasons specific to you.');
  surf(s, '\u25A1', 'Daily Card', 'A single shareable card with today\u2019s synthesis, made to be sent or saved.', 'Open it, then save it as an image or send it to someone who would want today\u2019s line.');
  surf(s, '\u2764', 'Compatibility', 'A relationship reading across the frameworks for you and one other person.', 'Enter a second person\u2019s birth details, then read the two of you together.');
  surf(s, '\u263F', 'Profiles', 'Save the people who matter, family, friends, colleagues, and read for any of them.', 'Switch the active profile before you generate a reading to receive it for that person.');
  surf(s, '\u2609', 'My Year', 'Your personal numerology, Life Path, Personal Year, and Birth Kin, with the longer arc.', 'Open it when you want the shape of the season rather than the day.');
  surf(s, '\u2600', 'Streak', 'A gentle, honest record of your returns, motivation without pressure.', 'Glance at it. Let it encourage the habit, not police it.');
  surf(s, '\u21BB', 'History', 'Your past readings, kept so nothing is lost.', 'Tap any past reading to reopen it and pick up a thread.');

  // 9. The glyph key
  s = section('9', 'The glyph key', 'Every mark, and what it means.');
  p(s, 'A quick legend for the symbols you will meet. This page prints well on its own as a reference.');
  const gk = el('div', { class: 'gd-gk' });
  gkRow(gk, '\u2662', 'gold', 'Kin', 'Today\u2019s Mayan and Dreamspell signature');
  gkRow(gk, '\u2605', 'gold', 'Galactic Activation Portal', 'A portal day, when the tradition holds synchronicities amplify. Symbolic.');
  gkRow(gk, '\u263D', 'gold', 'Moon', 'Today\u2019s lunar phase');
  gkRow(gk, '\u263E', 'gold', 'Black Moon', 'The two days before the new moon. A time to complete and release.');
  gkRow(gk, '\u2728', 'gold', 'Shiva Moon', 'The two days after the new moon. Generative, good for fresh starts.');
  gkRow(gk, '\u272A', 'gold', 'Your day', 'Your personal number for today');
  gkRow(gk, '11 22 33 44', 'txt', 'Master numbers', 'Days of heightened frequency, kept whole rather than reduced');
  gkRow(gk, '7', 'txt', 'A seven day', 'Contemplative and introspective. Slow down and reflect.');
  gkRow(gk, '9', 'txt', 'A nine day', 'Completion energy. Good for finishing rather than starting.');
  gkRow(gk, '\u263F', 'gold', 'Profiles', 'Switch the person a reading is for');
  gkRow(gk, 'T', 'gold', 'Tradition voice', 'The symbolic and archetypal lens');
  gkRow(gk, 'S', 'teal', 'Science voice', 'The mechanistic and causal lens');
  gkRow(gk, 'E', 'txt', 'Everyday voice', 'Plain language, the default synthesis');
  s.appendChild(gk);

  // 10. Special days
  s = section('10', 'Special days', 'Days worth noticing.');
  const days = el('div', { class: 'gd-days' });
  dayRow(days, '\u2605', 'Portal day', 'A Galactic Activation Portal. The Dreamspell tradition holds these as days when synchronicities amplify. Fifty two such Kins fall in each cycle of two hundred and sixty days. Symbolic.');
  dayRow(days, '\u263E', 'Black Moon', 'The two days before the new moon, a liminal threshold. Symbolically a time to complete and release rather than to begin, useful for closing loops.');
  dayRow(days, '\u2728', 'Shiva Moon', 'The two days after the new moon, generative and fertile. Symbolically auspicious for new actions, new conversations, and fresh starts.');
  dayRow(days, '\u272A', 'Master days', 'Eleven, twenty two, thirty three, and forty four. Heightened frequency. Open the day in the Calendar to read its specific meaning.');
  s.appendChild(days);
  tip(s, 'Open the Calendar at the start of a month and you can see the master days, portals, and moon windows ahead, and plan around them.');

  // 11. Get more from it
  s = section('11', 'Get more from it', 'A few ways to go deeper.');
  h3(s, 'A daily rhythm that works');
  s.appendChild(rich('gd-p', [{ t: 'Morning.', b: true }, { t: ' Open the Compass, tap a tile if something calls, and type one line of intention. Then, if you have time, generate a full reading.' }]));
  s.appendChild(rich('gd-p', [{ t: 'Midday.', b: true }, { t: ' Return to the reading, read the pacing for the afternoon, and switch voice if the morning one has gone stale.' }]));
  s.appendChild(rich('gd-p', [{ t: 'Evening.', b: true }, { t: ' Scroll to the reflection and close the day on purpose. The Oracle remembers what you wrote in the morning.' }]));
  h3(s, 'Power moves');
  p(s, 'Hold one true intention rather than five. The mind works on what it is holding, and one held well goes further than a list.');
  p(s, 'Add real context to your Profile, what you are building, who matters, what you are navigating. The more it knows, the more the reading speaks to your actual life rather than a generic one.');
  p(s, 'Run Best Day before you schedule anything that matters, then put the date in your calendar with its reason.');
  p(s, 'When a line lands, share it. The act of passing it on is often where the meaning settles.');

  // 12. Sources and care
  s = section('12', 'Sources and care', 'What it stands on, and what it is not.');
  h3(s, 'Sources and integrity');
  p(s, 'Astronomical positions come from the Swiss Ephemeris and from JPL Horizons at NASA, computed live and never interpolated. Maya scholarship draws on the peer reviewed work of Sprajc, Inomata, and Aveni and on Aldana, with Dreamspell always labelled as the Arguelles 1987 system, held distinct from the living Maya count. Western astrology rests on Tarnas, Greene, Hand, and Brennan, numerology on Drayer and Kahn, the neuroscience on Cajochen, Raichle, Barrett, Walker, and Clark, among more than two hundred references across thirty six sections. Every factual claim traces to a named authority. Every symbolic claim is labelled symbolic. Where the evidence is contested, the sceptical literature sits beside the supportive.');
  h3(s, 'What CDP is, and is not');
  p(s, 'It brings the best of ancient frameworks and current evidence to give you the texture of your day in the language you choose, and it leaves the living to you. It names, it offers, and it can say an honest no. You remain the authority on your own life.');
  p(s, 'It is not a medical product, a therapist, or a doctor, and it is not a substitute for professional advice. If you are in crisis or need clinical support, please reach out to a qualified professional. In the United Kingdom you can call the Samaritans on 116 123 at any hour, or NHS 111. In the United States you can call or text the 988 Suicide and Crisis Lifeline.');

  // closing line
  content.appendChild(el('div', { class: 'gd-foot' }, 'Two telescopes, pointed at the same sky.'));

  // share through the shared infrastructure
  const share = artefactControlsFromNode({
    title: 'Cosmic Daily Planner, the complete guide',
    node: () => content,
    voice: 'The guide',
    noun: 'guide',
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
