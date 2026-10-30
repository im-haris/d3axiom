/* D3 Axiom free Amazon PPC calculators.
   All maths runs in the browser. Nothing is sent anywhere except the optional email form. */
(function () {
  'use strict';

  var KEY = 'd3_calc_state', FREE = 3;
  var $ = function (id) { return document.getElementById(id); };

  // ---------- usage state (lead capture, not access control) ----------
  function load() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (v && typeof v.uses === 'number') return { uses: Math.max(0, v.uses), unlocked: !!v.unlocked };
    } catch (e) {}
    return { uses: 0, unlocked: false };
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  var state = load();
  // the gate only runs when the lead form is configured, so a missing endpoint never locks visitors out
  var gateOn = !!(window.D3Lead && window.D3Lead.configured());
  window.__d3suppress = false;

  // ---------- helpers ----------
  function val(id, min, max) {
    var el = $(id); if (!el) return null;
    var t = String(el.value).trim(); if (t === '') return null;
    var n = Number(t);
    if (!isFinite(n)) return null;
    if (min != null && n < min) return null;
    if (max != null && n > max) return null;
    return n;
  }
  function money(n) { return '$' + n.toFixed(2); }
  function pct(n, d) { return n.toFixed(d == null ? 1 : d) + '%'; }
  function set(id, text, cls) { var el = $(id); if (!el) return; el.textContent = text; el.className = 'v' + (cls ? ' ' + cls : ''); }
  function verdict(tool, cls, title, body) {
    var v = $(tool + '-verdict'); if (!v) return;
    v.className = 'verdict' + (cls ? ' ' + cls : '');
    v.querySelector('b').textContent = title;
    v.querySelector('p').textContent = body;
  }
  function neutral(tool, outIds, msg) {
    outIds.forEach(function (i) { set(i, '—'); });
    verdict(tool, '', 'Enter your numbers', msg);
    return false;
  }

  // ---------- Tool 1: Placement Optimizer ----------
  function placement() {
    var cur = val('p-cur', 0.1), tgt = val('p-tgt', 0.1), adj = val('p-adj', 0, 900), base = val('p-base', 0.02);
    var outs = ['p-rec', 'p-now', 'p-after', 'p-chg'];
    if ([cur, tgt, adj, base].some(function (x) { return x === null; }))
      return neutral('p', outs, 'Fill in all four fields. ACoS values must be above 0, the adjustment between 0% and 900%, and the base bid at least $0.02.');

    var factor = tgt / cur;
    var curEff = base * (1 + adj / 100);
    var newAdj = (1 + adj / 100) * factor - 1;
    var rec, after, cls, title, body;

    if (newAdj > 9) {
      rec = 900; after = base * 10; cls = 'good';
      title = 'Take the maximum: 900%';
      body = 'The maths asks for ' + pct(newAdj * 100, 0) + ', more than Amazon allows. This placement beats your target comfortably, so set it to 900% and consider raising the base bid too.';
    } else if (newAdj < 0) {
      var suggestedBase = curEff * factor;
      rec = 0; after = Math.max(suggestedBase, 0.02); cls = 'bad';
      title = 'Cut the base bid, not the adjustment';
      body = 'Placement adjustments cannot go below 0%, so this lever is used up. Leave the adjustment at 0% and cut the base bid from ' + money(base) + ' to ' + money(after) + '.' +
        (suggestedBase < 0.02 ? ' That is below Amazon’s $0.02 minimum bid, so consider pausing this keyword instead.' : '') +
        ' The base bid applies to every placement, so check how the other placements perform first.';
    } else {
      rec = newAdj * 100; after = base * (1 + newAdj);
      if (cur > tgt * 1.6) {
        cls = 'bad'; title = 'Cut back hard';
        body = 'ACoS here is ' + pct(cur) + ' against a ' + pct(tgt) + ' target. Lower the adjustment to ' + pct(rec, 0) + '. Check the search term report first: a few bad terms can distort a single placement.';
      } else if (cur > tgt) {
        cls = 'warn'; title = 'Trim the adjustment';
        body = 'ACoS here is a little over target. Lower the adjustment to ' + pct(rec, 0) + ', then wait 7–14 days before judging the result.';
      } else {
        cls = 'good'; title = 'Room to bid up';
        body = 'This placement is at or under target. You can raise the adjustment towards ' + pct(rec, 0) + '. Go up in steps of about 25% and watch impression share as you go.';
      }
    }
    set('p-rec', pct(rec, 0));
    set('p-now', money(curEff));
    set('p-after', money(after));
    var ch = after - curEff;
    set('p-chg', (ch >= 0 ? '+' : '−') + money(Math.abs(ch)), ch > 0.004 ? 'good' : (ch < -0.004 ? 'warn' : ''));
    verdict('p', cls, title, body);
    return true;
  }

  // ---------- Tool 2: Bid Optimizer ----------
  function bid() {
    var price = val('b-price', 0.01), cogs = val('b-cogs', 0), ref = val('b-ref', 0, 100), fba = val('b-fba', 0),
        cvr = val('b-cvr', 0.1, 100), margin = val('b-margin', 0, 100);
    var outs = ['b-profit', 'b-be', 'b-target', 'b-max', 'b-tcpc'];
    if ([price, cogs, ref, fba, cvr, margin].some(function (x) { return x === null; }))
      return neutral('b', outs, 'Fill in all six fields. Price must be above $0 and conversion rate above 0%.');

    var referralFee = price * ref / 100;
    var profit = price - cogs - referralFee - fba;
    var be = profit / price * 100;
    var target = be - margin;
    var maxCpc = (be / 100) * price * (cvr / 100);
    var targetCpc = (target / 100) * price * (cvr / 100);

    set('b-profit', (profit < 0 ? '−' : '') + money(Math.abs(profit)), profit > 0 ? 'good' : 'bad');
    if (profit <= 0) {
      ['b-be', 'b-target', 'b-max', 'b-tcpc'].forEach(function (i) { set(i, '—'); });
      verdict('b', 'bad', 'Loses money before advertising',
        'Each sale ' + (profit < 0 ? 'loses ' + money(-profit) : 'makes $0.00') + ' before a single click is paid for. No bid is safe. The fix is price, cost of goods or fulfilment, not PPC.');
      return true;
    }
    set('b-be', pct(be));
    set('b-max', money(maxCpc));
    if (target <= 0) {
      set('b-target', '—'); set('b-tcpc', '—');
      verdict('b', 'bad', 'Your margin target leaves nothing for ads',
        'Breakeven ACoS is ' + pct(be) + ', but you want to keep ' + pct(margin) + ' margin on ad sales. Keeping that margin leaves no room for ad spend. Lower the margin you keep on ad-driven sales, or improve price and costs.');
      return true;
    }
    set('b-target', pct(target), 'good');
    set('b-tcpc', money(targetCpc), 'good');
    if (be < 12) {
      verdict('b', 'warn', 'Very tight margins',
        'Breakeven ACoS is only ' + pct(be) + '. Treat ' + money(targetCpc) + ' per click as a hard ceiling. Advertising can only be a supporting channel for this product.');
    } else {
      verdict('b', 'good', 'Workable',
        'Breakeven ACoS is ' + pct(be) + ' and your target is ' + pct(target) + '. Bid up to ' + money(targetCpc) + ' per click to keep your margin. ' + money(maxCpc) + ' is the absolute ceiling: any click above it loses money on every sale it generates.');
    }
    return true;
  }

  // ---------- Tool 3: Bleeder Finder ----------
  function bleeder() {
    var clicks = val('k-clicks', 0), spend = val('k-spend', 0), orders = val('k-orders', 0), sales = val('k-sales', 0),
        tgt = val('k-tgt', 0.1), cvr = val('k-cvr', 0.1, 100);
    var outs = ['k-acos', 'k-cvr2', 'k-cpc', 'k-cpo', 'k-need'];
    if ([clicks, spend, orders, sales, tgt, cvr].some(function (x) { return x === null; }))
      return neutral('k', outs, 'Fill in all six fields from your search term report.');
    if (clicks % 1 !== 0 || orders % 1 !== 0)
      return neutral('k', outs, 'Clicks and orders must be whole numbers.');
    if (orders > clicks)
      return neutral('k', outs, 'Orders cannot be higher than clicks. Check the numbers in your search term report.');

    var clicksNeeded = Math.ceil((100 / cvr) * 2);
    var acos = sales > 0 ? spend / sales * 100 : null;
    var actualCvr = clicks > 0 ? orders / clicks * 100 : 0;
    var cpc = clicks > 0 ? spend / clicks : 0;
    var cpo = orders > 0 ? spend / orders : null;

    set('k-acos', acos === null ? '—' : pct(acos), acos === null ? '' : (acos <= tgt ? 'good' : 'bad'));
    set('k-cvr2', pct(actualCvr));
    set('k-cpc', money(cpc));
    set('k-cpo', cpo === null ? '—' : money(cpo));
    set('k-need', clicksNeeded + ' clicks');

    if (orders > 0 && sales === 0) {
      verdict('k', 'warn', 'Check the sales figure', 'There ' + (orders === 1 ? 'is 1 order' : 'are ' + orders + ' orders') + ' but $0 in sales, so ACoS cannot be calculated. Check the sales column in your report.');
      return true;
    }
    if (orders === 0) {
      if (clicks < clicksNeeded) {
        verdict('k', '', 'Not enough data — leave it alone',
          clicks + ' clicks so far, but at ' + pct(cvr) + ' conversion you need about ' + clicksNeeded + ' clicks before zero orders means anything. Cutting now may kill a term that has not had its chance. Revisit after about ' + (clicksNeeded - clicks) + ' more clicks.');
      } else {
        verdict('k', 'bad', 'Pause it or negative it',
          money(spend) + ' spent over ' + clicks + ' clicks with no orders, where you would expect about ' + (clicks * cvr / 100).toFixed(1) + ' orders. Add it as a negative exact match, and check whether the term is relevant to your product.');
      }
      return true;
    }
    var ratio = tgt / acos;
    if (acos <= tgt * 0.7) {
      verdict('k', 'good', 'Scale it', 'ACoS of ' + pct(acos) + ' is well under your ' + pct(tgt) + ' target. Raise the bid 15–25%. If it came from an auto or broad campaign, harvest it into exact match.');
    } else if (acos <= tgt) {
      verdict('k', 'good', 'Keep it, nudge up', 'ACoS of ' + pct(acos) + ' is within your ' + pct(tgt) + ' target. A 10–15% bid increase is safe.');
    } else if (acos <= tgt * 1.3) {
      verdict('k', 'warn', 'Trim the bid, do not cut it', 'ACoS of ' + pct(acos) + ' is a little over target. Lower the bid by ' + pct((1 - ratio) * 100, 0) + ', to about ' + money(cpc * ratio) + ' per click.');
    } else {
      verdict('k', 'bad', 'Cut hard or pause', 'ACoS of ' + pct(acos) + ' is far over your ' + pct(tgt) + ' target. Drop the bid to about ' + money(cpc * ratio) + ' per click, or pause it. If this term matters for your ranking, budget for it deliberately rather than letting it bleed.');
    }
    return true;
  }

  var tools = {
    p: { fn: placement, ids: ['p-cur', 'p-tgt', 'p-adj', 'p-base'] },
    b: { fn: bid, ids: ['b-price', 'b-cogs', 'b-ref', 'b-fba', 'b-cvr', 'b-margin'] },
    k: { fn: bleeder, ids: ['k-clicks', 'k-spend', 'k-orders', 'k-sales', 'k-tgt', 'k-cvr'] }
  };

  // ---------- counter + gate ----------
  function locked() { return gateOn && !state.unlocked && state.uses >= FREE; }
  function renderCounter() {
    var c = $('calc-counter'), note = $('calc-note');
    if (!c) return;
    if (!gateOn) { c.hidden = true; if (note) note.hidden = true; return; }
    c.hidden = false; if (note) note.hidden = state.unlocked;
    if (state.unlocked) { c.textContent = 'Unlocked · unlimited use'; c.className = 'counter on'; return; }
    var left = Math.max(0, FREE - state.uses);
    c.textContent = left + ' free calculation' + (left === 1 ? '' : 's') + ' left';
    c.className = 'counter' + (left === 0 ? ' out' : '');
  }
  function renderGate() {
    var on = locked();
    document.querySelectorAll('.calc-out').forEach(function (o) {
      o.classList.toggle('is-locked', on);
      var g = o.querySelector('.gate'); if (g) g.hidden = !on;
    });
  }
  function hideExample(k) { var bar = $(k + '-ex'); if (bar) bar.hidden = true; }

  var timer = null, lastCount = 0;
  document.querySelectorAll('.calc-tool').forEach(function (sec) {
    var k = sec.dataset.tool;
    sec.querySelectorAll('input').forEach(function (inp) {
      inp.addEventListener('input', function () {
        tools[k].fn();
        hideExample(k);
        if (window.__d3suppress || !gateOn || state.unlocked) return;
        if (state.uses >= FREE) { renderGate(); return; }
        clearTimeout(timer);
        timer = setTimeout(function () {
          if (window.__d3suppress) return;
          var now = Date.now();
          if (now - lastCount < 4000) return;   // one count per 4 seconds at most
          if (!tools[k].fn()) return;           // only complete, valid calculations count
          lastCount = now;
          state.uses += 1; save(); renderCounter();
        }, 1200);
      });
    });
  });

  document.querySelectorAll('[data-clear]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var k = btn.dataset.clear;
      window.__d3suppress = true;
      clearTimeout(timer);
      tools[k].ids.forEach(function (id) { $(id).value = ''; });
      tools[k].fn();
      hideExample(k);
      $(tools[k].ids[0]).focus();
      setTimeout(function () { window.__d3suppress = false; }, 50);
    });
  });

  document.querySelectorAll('[data-unlock]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      window.D3Lead.open({
        type: 'calculator_unlock',
        title: 'Keep using the calculators',
        text: 'Enter your email to unlock unlimited use of all three calculators on this device.',
        message: false,
        onSuccess: function () { state.unlocked = true; save(); renderGate(); renderCounter(); }
      });
    });
  });

  Object.keys(tools).forEach(function (k) { tools[k].fn(); });
  renderCounter();
  renderGate();
})();
