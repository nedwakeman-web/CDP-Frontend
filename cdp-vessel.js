/* ============================================================================
   CDP Vessel: the intentions-and-compass surface
   ----------------------------------------------------------------------------
   Self contained and self mounting. Opened by window.openVessel().

   Mount: drop this file into the alpha frontend at public/cdp-vessel.js and add
   one line before the closing body tag of app.html (after cdp-home.js):

       <script src="/cdp-vessel.js"></script>

   A nav entry calling openVessel() opens it.

   What it is, matched to the Vessel mockup:
     A left rail of your real intentions, grouped Active now and Held/Exploring,
     with a Themes section that is honest about emerging only from accumulated
     data. A centre with the day, your current voice, a quiet compass ring, and
     a single line, "Type whatever is alive right now", with Continue and Tell
     me about you first. A reflection card for a selected intention.

   Honest by construction:
     The rail and the reflection card read your real stored intentions
       (label, when set, when last touched) through window.cdpThreadsAPI.
     Continue routes what you type into the app's existing short reply path
       (the compass reply), so the exchange is the real one, not a copy.
     The pattern analytics (clustering into themes, clarity trajectories) do
       not exist yet, so they render as honest "builds as you return" states.
       The mockup numbers are year-five illustrations and are never hardcoded.

   Namespaced cdpv, literal colours matched to the app body (#0A1828).
   House style: no em or en dashes, no user visible exclamations.
   ========================================================================== */
(function () {
  'use strict';

  if (window.__cdpVesselMounted) return;
  window.__cdpVesselMounted = true;

  var NAVY = '#0A1828';
  var PANEL = '#0e1f38';
  var CARD = '#0d1d36';
  var GOLD = '#C9A050';
  var GOLD_SOFT = '#E8C878';
  var GOLD_LINE = 'rgba(201,160,80,0.18)';
  var GOLD_EDGE = 'rgba(201,160,80,0.40)';
  var TEXT_LIGHT = '#F0E6CC';
  var TEXT_MUTED = '#C8BAA0';
  var TEXT_DIM = 'rgba(201,186,160,0.55)';

  function injectStyle() {
    if (document.getElementById('cdpv-style')) return;
    var css = [
      '#cdpv-root{position:fixed;inset:0;z-index:470;background:' + NAVY + ';color:' + TEXT_LIGHT + ';font-family:\'EB Garamond\',Georgia,serif;display:none;}',
      '#cdpv-root.cdpv-on{display:flex;}',
      '.cdpv-rail{width:300px;flex:0 0 300px;border-right:1px solid ' + GOLD_LINE + ';padding:24px 18px;overflow-y:auto;box-sizing:border-box;}',
      '.cdpv-rail-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;}',
      '.cdpv-brand{font-size:13px;letter-spacing:3px;color:' + GOLD + ';text-transform:uppercase;}',
      '.cdpv-search{width:100%;box-sizing:border-box;background:' + PANEL + ';border:1px solid ' + GOLD_LINE + ';border-radius:3px;color:' + TEXT_LIGHT + ';padding:8px 10px;font-family:inherit;font-size:13px;margin-bottom:20px;}',
      '.cdpv-search::placeholder{color:' + TEXT_DIM + ';}',
      '.cdpv-group{margin-bottom:20px;}',
      '.cdpv-group-label{font-size:10px;letter-spacing:2px;color:' + TEXT_DIM + ';text-transform:uppercase;margin-bottom:9px;}',
      '.cdpv-item{padding:9px 11px;border-radius:3px;cursor:pointer;margin-bottom:4px;border:1px solid transparent;}',
      '.cdpv-item:hover{background:' + PANEL + ';}',
      '.cdpv-item.cdpv-sel{background:' + PANEL + ';border-color:' + GOLD_EDGE + ';}',
      '.cdpv-item-label{font-size:13.5px;color:' + TEXT_LIGHT + ';font-style:italic;}',
      '.cdpv-item-meta{font-size:11px;color:' + TEXT_DIM + ';margin-top:2px;}',
      '.cdpv-empty{font-size:12.5px;color:' + TEXT_DIM + ';font-style:italic;line-height:1.5;}',
      '.cdpv-rail-foot{margin-top:26px;padding-top:14px;border-top:1px solid rgba(201,160,80,0.10);font-size:11px;color:rgba(201,186,160,0.45);line-height:1.5;}',
      '.cdpv-main{flex:1;overflow-y:auto;padding:30px 32px 64px;display:flex;flex-direction:column;align-items:center;position:relative;}',
      '.cdpv-close{position:absolute;top:18px;right:22px;background:transparent;border:1px solid ' + GOLD_EDGE + ';color:' + TEXT_MUTED + ';width:30px;height:30px;border-radius:2px;cursor:pointer;font-family:inherit;line-height:1;font-size:16px;}',
      '.cdpv-close:hover{color:' + GOLD + ';border-color:' + GOLD + ';}',
      '.cdpv-main-top{margin-top:8px;text-align:center;}',
      '.cdpv-date{font-size:13px;letter-spacing:2px;color:' + TEXT_MUTED + ';text-transform:uppercase;}',
      '.cdpv-voice{font-size:12px;color:' + TEXT_DIM + ';font-style:italic;margin-top:4px;}',
      '.cdpv-ring{margin:28px 0 24px;}',
      '.cdpv-input{width:min(560px,90vw);box-sizing:border-box;background:' + PANEL + ';border:1px solid ' + GOLD_LINE + ';border-radius:4px;color:' + TEXT_LIGHT + ';padding:14px 16px;font-family:inherit;font-size:15px;resize:none;line-height:1.5;}',
      '.cdpv-input::placeholder{color:' + TEXT_DIM + ';font-style:italic;}',
      '.cdpv-actions{display:flex;gap:12px;margin-top:16px;flex-wrap:wrap;justify-content:center;}',
      '.cdpv-btn{padding:10px 20px;background:' + GOLD + ';color:' + NAVY + ';border:none;font-size:12px;font-weight:600;letter-spacing:1px;cursor:pointer;border-radius:2px;font-family:inherit;text-transform:uppercase;}',
      '.cdpv-btn:hover{background:' + GOLD_SOFT + ';}',
      '.cdpv-btn-ghost{background:transparent;color:' + TEXT_LIGHT + ';border:1px solid ' + GOLD_EDGE + ';}',
      '.cdpv-hint{font-size:12px;color:rgba(201,186,160,0.45);font-style:italic;margin-top:14px;}',
      '.cdpv-card{width:min(620px,92vw);margin-top:34px;border:1px solid ' + GOLD_LINE + ';border-radius:4px;padding:20px 22px;background:' + CARD + ';display:none;}',
      '.cdpv-card-title{font-size:13px;letter-spacing:2px;color:' + GOLD + ';text-transform:uppercase;margin-bottom:14px;}',
      '.cdpv-card-row{border-left:2px solid ' + GOLD_EDGE + ';padding:9px 0 9px 13px;margin-bottom:10px;}',
      '.cdpv-card-row:last-child{margin-bottom:0;}',
      '.cdpv-card-row-label{font-size:10px;letter-spacing:1px;color:' + TEXT_DIM + ';text-transform:uppercase;margin-bottom:3px;}',
      '.cdpv-card-row-body{font-size:13.5px;color:' + TEXT_LIGHT + ';line-height:1.55;}',
      '@media(max-width:880px){.cdpv-rail{display:none;}}'
    ].join('\n');
    var s = document.createElement('style');
    s.id = 'cdpv-style';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function escapeHtml(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function relDate(v) {
    try {
      if (!v) return '';
      var then = new Date(String(v).slice(0, 10) + 'T00:00:00Z');
      var now = new Date();
      var d0 = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
      var diff = Math.round((d0 - then.getTime()) / 86400000);
      if (isNaN(diff)) return '';
      if (diff <= 0) return 'today';
      if (diff === 1) return 'yesterday';
      if (diff < 7) return diff + ' days ago';
      if (diff < 14) return 'last week';
      return then.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    } catch (e) { return ''; }
  }
  function dateLabel() {
    try {
      return new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) { return ''; }
  }
  function voiceLabel() {
    var v = 'everyday';
    try {
      if (typeof window.cdpGetVoice === 'function') v = window.cdpGetVoice() || v;
      else { var s = localStorage.getItem('cdp_compass_voice'); if (s) v = s; }
    } catch (e) {}
    v = String(v).toLowerCase();
    return v === 'science' ? 'Science' : v === 'tradition' ? 'Tradition' : 'Everyday';
  }

  function activeThreads() {
    try {
      if (window.cdpThreadsAPI && typeof window.cdpThreadsAPI.active === 'function') {
        return (window.cdpThreadsAPI.active() || []).filter(function (t) { return t && t.label; });
      }
    } catch (e) {}
    return [];
  }
  function totalKept() {
    try {
      if (window.cdpThreadsAPI) {
        if (typeof window.cdpThreadsAPI.list === 'function') return (window.cdpThreadsAPI.list() || []).length;
        if (typeof window.cdpThreadsAPI.active === 'function') return (window.cdpThreadsAPI.active() || []).length;
      }
    } catch (e) {}
    return 0;
  }
  function classify() {
    var threads = activeThreads();
    var todayStr = new Date().toISOString().slice(0, 10);
    var active = [], held = [];
    threads.forEach(function (t) {
      if (t.date && t.date === todayStr) active.push(t);
      else held.push(t);
    });
    return { active: active, held: held };
  }
  function itemMeta(t) {
    var todayStr = new Date().toISOString().slice(0, 10);
    if (t.date && t.date === todayStr) return 'Today';
    if (t.lastReferenced) return 'Last touched ' + relDate(t.lastReferenced);
    if (t.date) return 'Set ' + relDate(t.date);
    return 'Kept';
  }

  /* ----- routing into the real app ----- */
  function continueWith(text) {
    text = (text || '').trim();
    closeVessel();
    try { if (typeof window.showScreen === 'function') window.showScreen('scompass', null); } catch (e) {}
    if (!text) {
      setTimeout(function () { var i = document.getElementById('v19Intention'); if (i) i.focus(); }, 140);
      return;
    }
    setTimeout(function () {
      var input = document.getElementById('v19Intention');
      if (!input) return;
      input.value = text;
      try { input.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
      var send = document.getElementById('cdpCrSendBtn');
      if (send) { send.click(); return; }
      try { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); } catch (e) {}
      input.focus();
    }, 160);
  }
  function tellAboutYou() {
    closeVessel();
    try { if (typeof window.showScreen === 'function') { window.showScreen('sp', null); return; } } catch (e) {}
    var nodes = document.querySelectorAll('.quiet-menu-item, .npill, button, a');
    for (var i = 0; i < nodes.length; i++) {
      if ((nodes[i].textContent || '').trim().toLowerCase() === 'profiles') { try { nodes[i].click(); return; } catch (e) {} }
    }
  }

  /* ----- build the surface ----- */
  var root = null, railEl = null, cardEl = null, inputEl = null, selectedId = null, searchTerm = '';

  function ringSvg() {
    return '<svg viewBox="0 0 200 200" width="180" height="180" xmlns="http://www.w3.org/2000/svg">' +
      '<circle cx="100" cy="100" r="86" fill="none" stroke="' + GOLD + '" stroke-opacity="0.45"/>' +
      '<circle cx="100" cy="100" r="64" fill="none" stroke="' + GOLD + '" stroke-opacity="0.20"/>' +
      '<text x="100" y="26" text-anchor="middle" font-family="Georgia,serif" font-size="11" letter-spacing="3" fill="' + TEXT_DIM + '">E N W</text>' +
      '<text x="100" y="182" text-anchor="middle" font-family="Georgia,serif" font-size="11" fill="' + TEXT_DIM + '">S</text>' +
      '<circle cx="100" cy="100" r="9" fill="none" stroke="' + GOLD + '" stroke-opacity="0.7"/>' +
      '<circle cx="100" cy="100" r="2.6" fill="' + GOLD + '"/>' +
      '</svg>';
  }

  function railItemNode(t) {
    var node = el('div', 'cdpv-item');
    node.setAttribute('data-id', t.id || t.label);
    if ((t.id || t.label) === selectedId) node.className += ' cdpv-sel';
    node.appendChild(el('div', 'cdpv-item-label', escapeHtml(t.label)));
    node.appendChild(el('div', 'cdpv-item-meta', escapeHtml(itemMeta(t))));
    node.addEventListener('click', function () {
      selectedId = t.id || t.label;
      renderRail();
      renderCard(t);
    });
    return node;
  }

  function groupNode(label, items) {
    var g = el('div', 'cdpv-group');
    g.appendChild(el('div', 'cdpv-group-label', escapeHtml(label)));
    if (items.length === 0) {
      g.appendChild(el('div', 'cdpv-empty', 'Nothing here yet.'));
    } else {
      items.forEach(function (t) { g.appendChild(railItemNode(t)); });
    }
    return g;
  }

  function renderRail() {
    if (!railEl) return;
    var c = classify();
    var filt = function (arr) {
      if (!searchTerm) return arr;
      var q = searchTerm.toLowerCase();
      return arr.filter(function (t) { return String(t.label).toLowerCase().indexOf(q) !== -1; });
    };
    railEl.innerHTML = '';
    railEl.appendChild(groupNode('Active now', filt(c.active)));
    railEl.appendChild(groupNode('Held / exploring', filt(c.held)));
    var themes = el('div', 'cdpv-group');
    themes.appendChild(el('div', 'cdpv-group-label', 'Themes / patterns'));
    themes.appendChild(el('div', 'cdpv-empty', 'Themes emerge here as your intentions accumulate, drawn from your own readings. Nothing is invented.'));
    railEl.appendChild(themes);
    var n = totalKept();
    railEl.appendChild(el('div', 'cdpv-rail-foot', n + ' intention' + (n === 1 ? '' : 's') + ' kept. The record is yours, and grows only as you use it.'));
  }

  function renderCard(t) {
    if (!cardEl) return;
    if (!t) { cardEl.style.display = 'none'; return; }
    var set = t.date ? ('Set ' + relDate(t.date)) : 'Kept';
    var touched = t.lastReferenced ? ('last touched ' + relDate(t.lastReferenced)) : 'not yet returned to';
    cardEl.innerHTML =
      '<div class="cdpv-card-title">' + escapeHtml(t.label) + '</div>' +
      '<div class="cdpv-card-row"><div class="cdpv-card-row-label">Kept</div>' +
      '<div class="cdpv-card-row-body">' + escapeHtml(set) + ', ' + escapeHtml(touched) + '.</div></div>' +
      '<div class="cdpv-card-row"><div class="cdpv-card-row-label">Patterns</div>' +
      '<div class="cdpv-card-row-body">Patterns build here as you return to this, from your own readings and the outcomes you record. Nothing is invented.</div></div>';
    cardEl.style.display = 'block';
  }

  function build() {
    injectStyle();
    root = el('div', null);
    root.id = 'cdpv-root';

    // rail
    var rail = el('aside', 'cdpv-rail');
    var head = el('div', 'cdpv-rail-head');
    head.appendChild(el('div', 'cdpv-brand', 'Vessel'));
    rail.appendChild(head);
    var search = el('input', 'cdpv-search');
    search.type = 'text';
    search.setAttribute('placeholder', 'Search intentions');
    search.addEventListener('input', function () { searchTerm = search.value || ''; renderRail(); });
    rail.appendChild(search);
    railEl = el('div', null);
    rail.appendChild(railEl);
    root.appendChild(rail);

    // main
    var main = el('div', 'cdpv-main');
    var close = el('button', 'cdpv-close', '&times;');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close');
    close.addEventListener('click', closeVessel);
    main.appendChild(close);

    var top = el('div', 'cdpv-main-top');
    top.appendChild(el('div', 'cdpv-date', escapeHtml(dateLabel())));
    top.appendChild(el('div', 'cdpv-voice', 'Speaking in ' + escapeHtml(voiceLabel())));
    main.appendChild(top);

    main.appendChild(el('div', 'cdpv-ring', ringSvg()));

    inputEl = el('textarea', 'cdpv-input');
    inputEl.setAttribute('rows', '2');
    inputEl.setAttribute('placeholder', 'Type whatever is alive right now');
    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); continueWith(inputEl.value); }
    });
    main.appendChild(inputEl);

    var actions = el('div', 'cdpv-actions');
    var cont = el('button', 'cdpv-btn', 'Continue');
    cont.type = 'button';
    cont.addEventListener('click', function () { continueWith(inputEl.value); });
    var tell = el('button', 'cdpv-btn cdpv-btn-ghost', 'Tell me about you first');
    tell.type = 'button';
    tell.addEventListener('click', tellAboutYou);
    actions.appendChild(cont);
    actions.appendChild(tell);
    main.appendChild(actions);

    main.appendChild(el('div', 'cdpv-hint', 'Press Enter to see what happens.'));

    cardEl = el('div', 'cdpv-card');
    main.appendChild(cardEl);

    root.appendChild(main);
    document.body.appendChild(root);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && root && root.classList.contains('cdpv-on')) closeVessel();
    });
  }

  function openVessel() {
    if (!root) build();
    selectedId = null;
    searchTerm = '';
    renderRail();
    renderCard(null);
    if (inputEl) inputEl.value = '';
    root.classList.add('cdpv-on');
    setTimeout(function () { if (inputEl) inputEl.focus(); }, 60);
  }
  function closeVessel() {
    if (root) root.classList.remove('cdpv-on');
  }

  window.openVessel = openVessel;
  window.closeVessel = closeVessel;
})();
