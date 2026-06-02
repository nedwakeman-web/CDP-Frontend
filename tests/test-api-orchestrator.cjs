'use strict';
const { ApiOrchestrator, LocalOrchestrator } = require('./compose-test-build.cjs');
let pass = 0, fail = 0;
function check(name, cond, extra) {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : '  ' + (extra || '')));
  cond ? pass++ : fail++;
}
const intention = { text: 'whether to ship the redesign this week', kind: 'acute', anchor: '2026-06-05' };

(async () => {
  // 1. Success path: correct URL, correct body shape, parsed result
  {
    let seenUrl = null, seenBody = null, seenSignal = null;
    const fakeFetch = async (url, init) => {
      seenUrl = url; seenBody = JSON.parse(init.body); seenSignal = init.signal;
      return { ok: true, json: async () => ({ text: '  A real reflection.\n\nThe keel.  ', summary: '  standing now  ' }) };
    };
    const api = new ApiOrchestrator('https://cdp-server-production.up.railway.app/', new LocalOrchestrator(), { fetchImpl: fakeFetch, now: () => Date.parse('2026-06-01T00:00:00Z') });
    const out = await api.depth(intention, 'tradition');
    check('posts to /api/compose/depth with normalised base (no double slash)', seenUrl === 'https://cdp-server-production.up.railway.app/api/compose/depth', 'got ' + seenUrl);
    check('body carries lens', seenBody.lens === 'tradition');
    check('body carries intention.text', seenBody.intention.text === intention.text);
    check('body maps anchor string to {label}', seenBody.intention.anchor && seenBody.intention.anchor.label === '2026-06-05', JSON.stringify(seenBody.intention.anchor));
    check('body defaults dateStr to today UTC', seenBody.dateStr === '2026-06-01', 'got ' + seenBody.dateStr);
    check('body sends empty continuity and recentTouches arrays', Array.isArray(seenBody.continuity) && Array.isArray(seenBody.recentTouches) && seenBody.continuity.length === 0);
    check('passes an abort signal', !!seenSignal);
    check('trims returned text', out.text === 'A real reflection.\n\nThe keel.');
    check('trims returned summary', out.summary === 'standing now');
  }

  // 2. Non-OK response degrades to honest fallback
  {
    const fakeFetch = async () => ({ ok: false, status: 503, json: async () => ({ error: 'composition is not configured' }) });
    const api = new ApiOrchestrator('', new LocalOrchestrator(), { fetchImpl: fakeFetch });
    const out = await api.depth(intention, 'science');
    check('503 falls back, not thrown', out.text.includes('could not be reached just now'));
    check('fallback gives a held summary', out.summary === 'Held. Reach again in a moment.');
  }

  // 3. Network error degrades to fallback
  {
    const fakeFetch = async () => { throw new Error('network down'); };
    const api = new ApiOrchestrator('', new LocalOrchestrator(), { fetchImpl: fakeFetch });
    const out = await api.depth(intention, 'everyday');
    check('network error falls back, not thrown', out.text.includes('still held'));
  }

  // 4. Timeout / abort degrades to fallback
  {
    const fakeFetch = async (_url, init) => {
      return await new Promise((_resolve, reject) => {
        if (init.signal) init.signal.addEventListener('abort', () => reject(new Error('aborted')));
        // never resolves on its own; relies on the abort
      });
    };
    const api = new ApiOrchestrator('', new LocalOrchestrator(), { fetchImpl: fakeFetch, timeoutMs: 20 });
    const out = await api.depth(intention, 'tradition');
    check('timeout aborts and falls back', out.text.includes('Try again in a moment'));
  }

  // 5. Empty/garbage 200 body degrades to fallback
  {
    const fakeFetch = async () => ({ ok: true, json: async () => ({ text: '   ' }) });
    const api = new ApiOrchestrator('', new LocalOrchestrator(), { fetchImpl: fakeFetch });
    const out = await api.depth(intention, 'science');
    check('blank text body falls back', out.text.includes('could not be reached'));
  }

  // 6. Sync glance delegates to local (no fetch)
  {
    let called = false;
    const fakeFetch = async () => { called = true; return { ok: true, json: async () => ({}) }; };
    const api = new ApiOrchestrator('', new LocalOrchestrator(), { fetchImpl: fakeFetch });
    const meet = api.meet({ intentions: [intention], rooms: {} }, intention, Date.parse('2026-06-01T00:00:00Z'));
    check('meet is synchronous and string', typeof meet === 'string' && meet.length > 0);
    check('meet does not call the server', called === false);
    const s = api.summary(intention, 'tradition');
    check('summary delegates to local', s.startsWith('pressing:'));
  }

  // 7. No anchor -> no anchor field
  {
    let seenBody = null;
    const fakeFetch = async (_url, init) => { seenBody = JSON.parse(init.body); return { ok: true, json: async () => ({ text: 'ok' }) }; };
    const api = new ApiOrchestrator('', new LocalOrchestrator(), { fetchImpl: fakeFetch });
    await api.depth({ text: 'a held thread', kind: 'chronic', anchor: null }, 'everyday');
    check('null anchor omits the anchor field', seenBody.intention.anchor === undefined);
  }


  // 8. Per-call context: a follow-up's thread reaches the body, and overrides the provider.
  {
    let body=null;
    const f=async(_u,init)=>{body=JSON.parse(init.body);return{ok:true,json:async()=>({text:'ok'})};};
    const api=new ApiOrchestrator('',new LocalOrchestrator(),{fetchImpl:f,contextProvider:()=>({dateStr:'2099-01-01'})});
    await api.depth(intention,'tradition',{recentTouches:[{role:'person',text:'first line'},{role:'oracle',text:'a reflection'}],continuity:[{label:'Series A',summary:'raising'}]});
    check('per-call recentTouches reach the body',body.recentTouches.length===2&&body.recentTouches[0].text==='first line');
    check('per-call continuity reaches the body',body.continuity.length===1&&body.continuity[0].label==='Series A');
    await api.depth(intention,'science',{dateStr:'2026-03-31'});
    check('per-call dateStr overrides the provider',body.dateStr==='2026-03-31');
    await api.depth(intention,'everyday');
    check('two-argument depth still works (back-compat)',body.dateStr==='2099-01-01'&&body.lens==='everyday');
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
