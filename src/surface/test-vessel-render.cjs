'use strict';
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><head></head><body><div id="app"></div></body></html>', { url: 'https://cosmicdailyplanner.com/' });
global.window = dom.window; global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement; global.KeyboardEvent = dom.window.KeyboardEvent;
dom.window.HTMLElement.prototype.scrollIntoView = function(){};

const { mountVessel } = require('./build/surface/vessel.js');
let pass=0, fail=0; const ck=(n,c,e)=>{console.log((c?'PASS ':'FAIL ')+n+(c?'':'  '+(e||'')));c?pass++:fail++;};
const click=(node)=>node.dispatchEvent(new dom.window.Event('click'));

let depthCalls=[];
const orch = {
  meet:()=> 'place', firstHold:()=>({text:'x'}), park:()=>({text:'x'}), respond:()=>({text:'x'}),
  summary:(it)=> 'pressing: '+it.text,
  depth: async (it, lens, ctx)=>{ depthCalls.push({text:it.text, lens, recent:(ctx&&ctx.recentTouches)||[]}); return { text:'Under the words.\n\nThe keel for '+lens+'.', summary:'standing now' }; },
};

(async()=>{
  const realNow=Date.now; Date.now=()=>Date.parse('2026-03-31T09:00:00Z'); // portal day, Kin 112
  await mountVessel({ root: document.getElementById('app'), orchestrator: orch });
  const s = document.querySelector('.cdp-surface');
  const text = () => s.textContent;

  ck('surface mounted dark by default', s.getAttribute('data-theme')==='dark');
  ck('placeholder gone', text().indexOf('surface is being wired')===-1);
  ck('compass mark rendered', !!s.querySelector('.cdp-compass-svg'));
  ck('long UTC date shown', text().indexOf('Tuesday, 31 March 2026')>=0);
  const vals = Array.from(document.querySelectorAll('.cdp-card-value')).map(n=>n.textContent);
  ck('Universal Day 8 rendered', vals.indexOf('8')>=0, JSON.stringify(vals));
  ck('colour-complete portal Kin rendered', vals.some(v=>v.indexOf('Kin 112 Galactic Yellow Human')>=0), JSON.stringify(vals));
  ck('lunar honest unknown', vals.indexOf('not yet available')>=0);
  ck('no problem-framing word in surface', /concern/i.test(text())===false);

  // theme toggle
  click(document.querySelector('.cdp-theme'));
  ck('theme toggles to light', s.getAttribute('data-theme')==='light');
  click(document.querySelector('.cdp-theme'));
  ck('theme toggles back to dark', s.getAttribute('data-theme')==='dark');

  // default voice everyday
  const askVoices = document.querySelector('.cdp-ask').querySelectorAll('.cdp-voice');
  ck('default voice everyday', Array.from(askVoices).find(b=>b.textContent==='Everyday').getAttribute('aria-pressed')==='true');

  // choose Tradition, then send a first line
  click(Array.from(askVoices).find(b=>b.textContent==='Tradition'));
  const ta = document.querySelector('textarea');
  ta.value = "whether to ship Ned's redesign this week";
  click(document.querySelector('.cdp-primary'));
  await new Promise(r=>setTimeout(r,5));
  ck('first reply fired once', depthCalls.length===1);
  ck('first reply in chosen voice (tradition)', depthCalls[0].lens==='tradition');
  ck('first reply carries no prior touches', depthCalls[0].recent.length===0);
  ck('apostrophe preserved through depth', depthCalls[0].text==="whether to ship Ned's redesign this week");
  ck('entry rendered in thread', document.querySelectorAll('.cdp-entry').length===1);
  ck('reply shows voice corner Tradition', document.querySelector('.cdp-voice-corner').textContent==='Tradition');
  ck('sidebar Active now shows the intention', document.querySelector('.cdp-side').textContent.indexOf("whether to ship Ned's redesign this week")>=0);

  // re-hear the first reply in Science (in place, with prior touches before it = none)
  const firstEntry = document.querySelectorAll('.cdp-entry')[0];
  const rehearBtns = firstEntry.querySelector('.cdp-rehear').querySelectorAll('.cdp-voice');
  click(Array.from(rehearBtns).find(b=>b.textContent==='Science'));
  await new Promise(r=>setTimeout(r,5));
  ck('re-hear fired a depth call', depthCalls.length===2);
  ck('re-hear used Science', depthCalls[1].lens==='science');
  ck('re-hear used the same intention text', depthCalls[1].text==="whether to ship Ned's redesign this week");
  ck('re-hear passed no touches before the first entry', depthCalls[1].recent.length===0);
  ck('voice corner updated to Science', document.querySelectorAll('.cdp-entry')[0].querySelector('.cdp-voice-corner').textContent==='Science');

  // follow-up chip continues the thread WITH continuity (prior person+oracle touches)
  const chip = document.querySelectorAll('.cdp-entry')[0].querySelector('.cdp-chip');
  click(chip);
  await new Promise(r=>setTimeout(r,5));
  ck('follow-up created a second entry', document.querySelectorAll('.cdp-entry').length===2);
  ck('follow-up carried prior thread as continuity', depthCalls[2].recent.length===2 && depthCalls[2].recent[0].role==='person' && depthCalls[2].recent[1].role==='oracle');
  ck('follow-up text is the chip prompt', depthCalls[2].text==='What am I overcomplicating here?');

  // free-text follow-up via Enter key
  const ta2 = document.querySelector('textarea');
  ta2.value = 'and if I do nothing this week?';
  ta2.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key:'Enter', bubbles:true }));
  await new Promise(r=>setTimeout(r,5));
  ck('Enter sends a reply', document.querySelectorAll('.cdp-entry').length===3);
  ck('third reply carried two prior exchanges as continuity', depthCalls[3].recent.length===4);

  // deep reading door honest
  ck('deep panel empty until opened', document.querySelector('.cdp-deep-panel').textContent.trim()==='');
  click(document.querySelector('.cdp-link'));
  ck('deep door opens honest next-stage panel', document.querySelector('.cdp-deep-panel').textContent.indexOf('next stage of the build')>=0);

  Date.now=realNow;
  console.log('\n'+pass+' passed, '+fail+' failed'); process.exit(fail?1:0);
})();
