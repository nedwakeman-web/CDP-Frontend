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
  // persisted default voice
  try { dom.window.localStorage.setItem('cdp-default-voice','science'); } catch(e){}

  await mountVessel({ root: document.getElementById('app'), orchestrator: orch });
  const s = document.querySelector('.cdp-surface'); const text=()=>s.textContent;

  // ----- surface + coordinates -----
  ck('mounted dark by default', s.getAttribute('data-theme')==='dark');
  ck('compass mark rendered', !!s.querySelector('.cdp-compass-svg'));
  ck('long UTC date shown', text().indexOf('Tuesday, 31 March 2026')>=0);
  const vals = Array.from(document.querySelectorAll('.cdp-card-value')).map(n=>n.textContent);
  ck('Universal Day 8', vals.indexOf('8')>=0, JSON.stringify(vals));
  ck('colour-complete portal Kin', vals.some(v=>v.indexOf('Kin 112 Galactic Yellow Human')>=0));
  ck('lunar honest unknown', vals.indexOf('not yet available')>=0);
  ck('no problem-framing word anywhere', /concern/i.test(text())===false);

  // ----- persisted default voice respected -----
  const askVoices = document.querySelector('.cdp-ask').querySelectorAll('.cdp-voice');
  ck('stored default voice (science) is active', Array.from(askVoices).find(b=>b.textContent==='Science').getAttribute('aria-pressed')==='true');

  // ----- single menu: no duplicate controls -----
  ck('exactly one menu button', document.querySelectorAll('.cdp-menu-btn').length===1);
  ck('no standalone theme toggle outside the menu', document.querySelectorAll('.cdp-theme').length===0);
  ck('no standalone deep-reading section', document.querySelectorAll('.cdp-deep').length===0);
  const drawer = document.querySelector('.cdp-menu');
  ck('drawer closed on load', drawer.classList.contains('open')===false);
  click(document.querySelector('.cdp-menu-btn'));
  ck('menu opens', drawer.classList.contains('open')===true);
  ck('menu marked expanded', document.querySelector('.cdp-menu-btn').getAttribute('aria-expanded')==='true');

  // theme folded into the menu
  const menuText = drawer.textContent;
  ck('theme control lives in the menu', menuText.indexOf('Toggle theme')>=0);
  const themeRow = Array.from(drawer.querySelectorAll('.cdp-menu-row')).find(r=>r.textContent.indexOf('Toggle theme')>=0);
  click(themeRow);
  ck('theme toggles from the menu', s.getAttribute('data-theme')==='light');
  click(themeRow); ck('theme toggles back', s.getAttribute('data-theme')==='dark');

  // pin voice writes storage
  const pinRow = Array.from(drawer.querySelectorAll('.cdp-menu-row')).find(r=>r.textContent.indexOf('Pin current voice')>=0);
  click(pinRow);
  ck('pinning voice persists to storage', dom.window.localStorage.getItem('cdp-default-voice')==='science');

  // the items the old menus scattered are gathered here, once each
  const gathered = ['Guide','Tiers','Streak','History','Feedback','Share and invite','Account','Calendar','Profiles','Compatibility','My Year','Sign in'];
  ck('all scattered items consolidated in the one menu', gathered.every(g=>menuText.indexOf(g)>=0), gathered.filter(g=>menuText.indexOf(g)<0).join(','));
  ck('each forthcoming item is honestly marked soon', drawer.querySelectorAll('.cdp-menu-val.soon').length===12);

  // reading is the deliberate door, honest
  const readingRow = Array.from(drawer.querySelectorAll('.cdp-menu-row')).find(r=>r.textContent.indexOf('Reading')>=0);
  click(readingRow);
  ck('reading door opens honest next-stage note', document.querySelector('.cdp-menu-note').textContent.indexOf('next stage of the build')>=0);

  // close via backdrop
  click(document.querySelector('.cdp-backdrop'));
  ck('backdrop closes the menu', drawer.classList.contains('open')===false);

  // ----- threaded conversation + continuity -----
  click(Array.from(askVoices).find(b=>b.textContent==='Tradition'));
  const ta = document.querySelector('textarea');
  ta.value = "whether to ship Ned's redesign this week";
  click(document.querySelector('.cdp-primary'));
  await new Promise(r=>setTimeout(r,5));
  ck('reply fired in chosen voice tradition', depthCalls.length===1 && depthCalls[0].lens==='tradition');
  ck('apostrophe preserved through depth', depthCalls[0].text==="whether to ship Ned's redesign this week");
  ck('sidebar shows the intention', document.querySelector('.cdp-side').textContent.indexOf("whether to ship Ned's redesign this week")>=0);

  // re-hear in science (no prior touches before first entry)
  const firstEntry = document.querySelectorAll('.cdp-entry')[0];
  click(Array.from(firstEntry.querySelector('.cdp-rehear').querySelectorAll('.cdp-voice')).find(b=>b.textContent==='Science'));
  await new Promise(r=>setTimeout(r,5));
  ck('re-hear used science on same intention', depthCalls[1].lens==='science' && depthCalls[1].text===depthCalls[0].text);
  ck('re-hear carried no touches before first entry', depthCalls[1].recent.length===0);

  // follow-up carries prior thread
  click(document.querySelectorAll('.cdp-entry')[0].querySelector('.cdp-chip'));
  await new Promise(r=>setTimeout(r,5));
  ck('follow-up carried prior exchange as continuity', depthCalls[2].recent.length===2 && depthCalls[2].recent[0].role==='person');

  Date.now=realNow;
  console.log('\n'+pass+' passed, '+fail+' failed'); process.exit(fail?1:0);
})();
