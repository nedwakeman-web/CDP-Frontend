'use strict';
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><head></head><body><div id="app"></div></body></html>', { url: 'https://cosmicdailyplanner.com/' });
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.KeyboardEvent = dom.window.KeyboardEvent;

const { mountVessel } = require('./build/surface/vessel.js');

let pass = 0, fail = 0;
function check(name, cond, extra) { console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : '  ' + (extra || ''))); cond ? pass++ : fail++; }

// Fake orchestrator implementing the contract; records the depth call.
let depthCalls = [];
const fakeOrch = {
  meet: (state, brightest) => brightest ? ('You are holding: ' + brightest.text) : 'This is a place to hold what matters to you.',
  firstHold: () => ({ text: 'x' }),
  park: () => ({ text: 'x' }),
  respond: () => ({ text: 'x' }),
  summary: (it) => 'pressing: ' + it.text,
  depth: async (it, lens) => { depthCalls.push({ it, lens }); return { text: 'First the situation under the words.\n\nThen the keel line.', summary: 'standing now' }; },
};

(async () => {
  // Freeze the clock so the date assertions are deterministic.
  const realNow = Date.now;
  Date.now = () => Date.parse('2026-03-31T09:00:00Z'); // a known portal day, Kin 112

  await mountVessel({ root: document.getElementById('app'), orchestrator: fakeOrch });

  const surface = document.querySelector('.cdp-surface');
  check('surface mounted (placeholder replaced)', !!surface && document.body.textContent.indexOf('surface is being wired') === -1);

  const text = surface.textContent;
  check('shows the long UTC date', text.indexOf('Tuesday, 31 March 2026') >= 0, 'date missing');

  // Coordinates from the real core
  const values = Array.from(document.querySelectorAll('.cdp-card-value')).map((n) => n.textContent);
  check('renders Universal Day (2026-03-31 = 8)', values.indexOf('8') >= 0, JSON.stringify(values));
  check('renders colour-complete Kin with portal flag', values.some((v) => v.indexOf('Kin 112 Galactic Yellow Human') >= 0 && v.indexOf('Galactic Activation Portal') >= 0), JSON.stringify(values));
  check('Kin card carries a portal-day tag', text.indexOf('portal day') >= 0);
  check('lunar shown as honest unknown', values.indexOf('not yet available') >= 0 && text.indexOf('not yet available') >= 0, JSON.stringify(values));
  check('no personal layers without a profile', values.filter((v) => v && v.length <= 3).length >= 1 && document.body.textContent.indexOf('Personal Year') === -1);

  // Language core: the word concern must not appear anywhere a person reads
  check('no use of the word concern in the surface text', /concern/i.test(text) === false);

  // Three voices present and switchable
  const voiceBtns = Array.from(document.querySelectorAll('.cdp-voice'));
  check('three voice toggles present', voiceBtns.length === 3);
  check('everyday is the default active voice', voiceBtns.find((b) => b.textContent === 'Everyday').getAttribute('aria-pressed') === 'true');
  voiceBtns.find((b) => b.textContent === 'Tradition').dispatchEvent(new dom.window.Event('click'));
  check('switching sets Tradition active in place', voiceBtns.find((b) => b.textContent === 'Tradition').getAttribute('aria-pressed') === 'true');
  check('and Everyday is no longer active', voiceBtns.find((b) => b.textContent === 'Everyday').getAttribute('aria-pressed') === 'false');

  // Depth never auto-fires
  check('depth has not fired on load', depthCalls.length === 0);

  // Empty input does not fire depth
  const reach = document.querySelector('.cdp-primary');
  reach.dispatchEvent(new dom.window.Event('click'));
  await new Promise((r) => setTimeout(r, 0));
  check('empty input does not fire depth', depthCalls.length === 0);

  // Typed line with an apostrophe routes to depth in the chosen voice
  const ta = document.querySelector('textarea');
  ta.value = "whether to ship Ned's redesign this week";
  reach.dispatchEvent(new dom.window.Event('click'));
  await new Promise((r) => setTimeout(r, 5));
  check('typed line fires depth once', depthCalls.length === 1, JSON.stringify(depthCalls.map(d=>d.lens)));
  check('depth uses the chosen voice (tradition)', depthCalls[0].lens === 'tradition');
  check('apostrophe in the line is preserved intact', depthCalls[0].it.text === "whether to ship Ned's redesign this week");

  // The reflection renders, last paragraph is the keel, summary as living line
  const depthArea = document.querySelector('.cdp-depth');
  check('reflection paragraphs rendered', depthArea.querySelectorAll('p').length >= 2);
  check('last paragraph carries the keel style', !!depthArea.querySelector('p.cdp-keel') && depthArea.querySelector('p.cdp-keel').textContent.indexOf('keel line') >= 0);
  check('living summary rendered', !!depthArea.querySelector('.cdp-living') && depthArea.querySelector('.cdp-living').textContent === 'standing now');

  // What is held now lists the intention, via orchestrator.summary
  check('held list shows the intention', document.querySelector('.cdp-held').textContent.indexOf("whether to ship Ned's redesign this week") >= 0);

  // Deep reading door is deliberate and honest, not auto-fired
  check('deep reading panel empty until opened', document.querySelector('.cdp-deep-panel').textContent.trim() === '');
  document.querySelector('.cdp-link').dispatchEvent(new dom.window.Event('click'));
  check('deep reading door opens an honest next-stage panel', document.querySelector('.cdp-deep-panel').textContent.indexOf('next stage of the build') >= 0);

  Date.now = realNow;
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
