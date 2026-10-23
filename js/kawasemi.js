/* 案内役のカワセミ — 設計 docs/motion.md §E
   ・止まっている間は止まり木（ページの部品の上の縁）にくっついて一緒にスクロールする
   ・止まり木が画面から外れそうになったら、飛び立って次の止まり木へ弧を描いて飛ぶ
   ・止まれる場所が無い間は、画面の右端を羽ばたきながらついてくる
   ・本文・電話・ボタンに重なる止まり木は使わない（実行時に測る）
   ・絵は Codex が描き分けたコマ（まばたき・尾羽／振り向き／羽ばたき3コマ／着地）
   検証口: window.__kawasemi（state / perches() / settle()） */
(function () {
  'use strict';
  var d = document, W = window;
  var el = d.getElementById('kawasemi');
  if (!el || !W.requestAnimationFrame) return;
  var reduce = W.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var img = {
    idle: el.querySelector('.kw-idle'), look: el.querySelector('.kw-look'),
    fly: el.querySelector('.kw-fly'), land: el.querySelector('.kw-land')
  };
  var flip = el.querySelector('.kw__flip');

  // 止まり木の候補（セレクタ, 上の縁の左から何割の位置, 縦の微調整 = 要素の高さに対する割合）
  var PERCHES = [
    ['.hero [data-kw-perch]', 0.5, 0],
    ['.title-img', 0.97, 0.06],
    ['.viewmore img', 0.96, 0.18],
    ['.svc:nth-child(2) .svc__art', 0.86, 0],
    ['.svc:nth-child(5) .svc__art', 0.86, 0],
    ['.interlude__art .stg__l:first-child', 0.42, 0.16],
    ['.person__art', 0.82, 0],
    ['.access .ill[alt*="八百健"]', 0.2, 0.02],
    ['.pillar__art', 0.8, 0],
    ['.svc-detail__art', 0.84, 0],
    ['.side-card', 0.9, 0],
    ['.box', 0.93, 0],
    ['.qa-list', 0.93, 0],
    ['.foot .rows', 0.94, 0]
  ];
  var TEXT = 'h1,h2,h3,p,li,dt,dd,a,button,input,select,textarea,summary,label,.telbig,.kicker';

  var state = 'hidden', perch = null, pos = { x: 0, y: 0 }, face = 1;
  var flight = null, lastScroll = 0, lastY = scrollY, vy = 0, lookTimer = 0, tick = false;

  function size() {
    var w = innerWidth < 768 ? 72 : innerWidth < 1200 ? 92 : 112;   // 正方形のコマの一辺（鳥の体はその約6割）
    el.style.setProperty('--kw-w', w + 'px');
    return w;
  }
  var BW = size();
  function hdrH() { var h = d.querySelector('.hdr'); return h ? h.getBoundingClientRect().bottom : 0; }
  function bottomLimit() {
    var b = d.querySelector('.spbar');
    var r = b && getComputedStyle(b).display !== 'none' ? b.getBoundingClientRect().top : innerHeight;
    return Math.min(innerHeight, r) - 12;
  }
  var FEET = 0.92;                                  // 足元はコマの高さの92%（build_kawasemi.py）
  function birdH() { return BW * FEET; }
  function bodyTop() { return BW * 0.58; }          // 足元から体のてっぺんまで

  // 止まり木の候補を集める（画面に入っていて、本文を隠さないものだけ ok）
  function candidates() {
    var list = [], top = hdrH() + 10, bottom = bottomLimit();
    PERCHES.forEach(function (p) {
      Array.prototype.forEach.call(d.querySelectorAll(p[0]), function (node) {
        var r = node.getBoundingClientRect();
        if (r.width < 20 || r.height < 10) return;
        var cs = getComputedStyle(node);
        if (cs.display === 'none' || cs.visibility === 'hidden') return;
        var x = r.left + r.width * p[1], y = r.top + r.height * p[2];
        x = Math.max(BW / 2 + 8, Math.min(innerWidth - BW / 2 - 8, x));
        var box = { l: x - BW * 0.4, r: x + BW * 0.4, t: y - bodyTop(), b: y };
        var inView = box.t >= top && box.b <= bottom;   // 「止まる位置そのもの」が気持ちよく画面に入っているときだけ
        list.push({ node: node, fx: p[1], fy: p[2], x: x, y: y, box: box, inView: inView, ok: inView && !covers(box) });
      });
    });
    return list;
  }
  // ★本文と重なるかは「文字そのもの」の位置で測る。要素の枠で測ると、止まっている部品を含むリンク
  //   （VIEW MORE ＋「質問をすべて見る」）を丸ごと対象外にしてしまい、文字に重なった（2026-10-23 実測）
  function covers(box) {
    var root = d.querySelector('main') || d.body;
    var walker = d.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), n, rg = d.createRange();
    while ((n = walker.nextNode())) {
      if (!n.nodeValue.trim()) continue;
      var pe = n.parentElement;
      if (!pe || pe.closest('#kawasemi,.ground,.drawer,[aria-hidden="true"]')) continue;
      var pr = pe.getBoundingClientRect();
      if (pr.bottom < box.t - 2 || pr.top > box.b + 2 || pr.right < box.l || pr.left > box.r) continue;
      rg.selectNodeContents(n);
      var rects = rg.getClientRects();
      for (var i = 0; i < rects.length; i++) {
        var q = rects[i];
        var w = Math.min(q.right, box.r) - Math.max(q.left, box.l), h = Math.min(q.bottom, box.b) - Math.max(q.top, box.t);
        if (w > 3 && h > 3) return true;
      }
    }
    // ヒーローの人物・小物にも重ねない（足元に立って見えた）
    return Array.prototype.some.call(d.querySelectorAll('.hero__l'), function (l) {
      var q = l.getBoundingClientRect();
      var w = Math.min(q.right, box.r) - Math.max(q.left, box.l), h = Math.min(q.bottom, box.b) - Math.max(q.top, box.t);
      return w > 10 && h > 10 && w * h > 0.06 * (box.r - box.l) * (box.b - box.t);
    });
  }
  function pointOf(c) {
    var r = c.node.getBoundingClientRect();
    var x = Math.max(BW / 2 + 8, Math.min(innerWidth - BW / 2 - 8, r.left + r.width * c.fx));
    return { x: x, y: r.top + r.height * c.fy };
  }
  function comfortable(c) {
    var p = pointOf(c);
    return p.y - bodyTop() >= hdrH() + 10 && p.y <= bottomLimit();
  }
  function best(list) {
    var ok = list.filter(function (c) { return c.ok; });
    if (!ok.length) return null;
    var want = innerHeight * 0.48;
    ok.sort(function (a, b) {
      var da = Math.abs(a.y - want) + Math.abs(a.x - pos.x) * 0.25;
      var db = Math.abs(b.y - want) + Math.abs(b.x - pos.x) * 0.25;
      return da - db;
    });
    return ok[0];
  }

  // 表示
  function show(which) {
    Object.keys(img).forEach(function (k) { if (img[k]) img[k].hidden = k !== which; });
    el.dataset.clip = which;
  }
  function place(x, y, anchorBottom) {
    pos.x = x; pos.y = y;
    var h = anchorBottom ? birdH() : birdH() * 0.6;
    el.style.transform = 'translate3d(' + (x - BW / 2).toFixed(1) + 'px,' + (y - h).toFixed(1) + 'px,0)';
    flip.style.transform = face < 0 ? 'scaleX(-1)' : '';
  }

  function land(c) {
    perch = c; state = 'rest';
    var p = pointOf(c);
    show('land'); place(p.x, p.y, true);
    el.classList.add('kw--squash');
    setTimeout(function () { el.classList.remove('kw--squash'); if (state === 'rest') show('idle'); }, reduce ? 0 : 160);
    planLook();
  }
  function planLook() {
    clearTimeout(lookTimer);
    if (reduce) return;
    lookTimer = setTimeout(function () {
      if (state !== 'rest') return;
      show('look');
      setTimeout(function () { if (state === 'rest') show('idle'); planLook(); }, 1200);
    }, 4000 + Math.random() * 4000);
  }

  function flyTo(c) {
    clearTimeout(lookTimer);
    if (reduce) {                                     // 動きを減らす設定: 飛ばずに入れ替わる
      el.style.opacity = '0';
      setTimeout(function () { land(c); el.style.opacity = ''; }, 220);
      return;
    }
    var p = pointOf(c);
    var dist = Math.hypot(p.x - pos.x, p.y - pos.y);
    flight = { c: c, x0: pos.x, y0: pos.y, t0: performance.now(), dur: Math.max(450, Math.min(1100, dist * 1.1)),
               lift: Math.min(140, 40 + dist * 0.3) };
    state = 'fly'; perch = null;
    show('fly');
    loop();
  }
  function follow() {                                 // 止まれる場所が無い: 右端を飛んでついてくる
    if (reduce) { state = 'hidden'; el.style.opacity = '0'; return; }
    clearTimeout(lookTimer);
    state = 'follow'; perch = null; show('fly'); face = -1;
    el.style.opacity = '';                            // ★登場時に止まり木が無いとこの経路で始まる（透明のままだった）
    loop();
  }

  function frame(now) {
    tick = false;
    if (state === 'rest' && perch) {
      if (!comfortable(perch)) { takeoff(); }
      else { var p = pointOf(perch); place(p.x, p.y, true); }
    } else if (state === 'fly' && flight) {
      var k = Math.min(1, (now - flight.t0) / flight.dur);
      var e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      if (!comfortable(flight.c) && now - (flight.re || 0) > 200) {   // 着地点が画面から外れた → 行き先を変える
        flight.re = now;
        var nc = best(candidates());
        if (!nc) { flight = null; follow(); return; }
        if (nc.node !== flight.c.node) { flight = { c: nc, x0: pos.x, y0: pos.y, t0: now, dur: 600, lift: 50, re: now }; }
      }
      var tp = pointOf(flight.c);                     // 着地点は一緒にスクロールしているので毎回取り直す
      var x = flight.x0 + (tp.x - flight.x0) * e;
      var y = flight.y0 + (tp.y - flight.y0) * e - Math.sin(Math.PI * e) * flight.lift;
      face = tp.x >= flight.x0 ? 1 : -1;
      place(x, y, true);
      if (k >= 1) {
        var target = flight.c; flight = null;
        if (!comfortable(target)) { takeoff(); return; }               // 着いた時点で外れていたら止まらない
        land(target); return;
      }
      tick = true; requestAnimationFrame(frame);
      return;
    } else if (state === 'follow') {
      // PC は右の余白を飛ぶ。スマホは余白が無いので、画面の右端から体を半分だけのぞかせて本文に掛からないように
      var gut = (innerWidth - 1180) / 2;
      var lane = gut > BW ? innerWidth - gut / 2 : innerWidth - BW * 0.16;
      var want = innerHeight * 0.42 + Math.max(-80, Math.min(80, -vy * 6)) + Math.sin(now / 420) * 6;
      var nx = pos.x + (lane - pos.x) * 0.12, ny = pos.y + (want - pos.y) * 0.1;
      face = -1;
      place(nx, Math.max(hdrH() + birdH() + 6, Math.min(bottomLimit(), ny)), true);
      vy *= 0.9;
      var idle = performance.now() - lastScroll > 260, slow = Math.abs(vy) < 10;
      if ((idle || slow) && now - (frame.lastPick || 0) > 300) {
        frame.lastPick = now;
        var c = best(candidates());
        if (c) { flyTo(c); return; }
      }
      tick = true; requestAnimationFrame(frame);
    }
  }
  function loop() { if (!tick) { tick = true; requestAnimationFrame(frame); } }

  function takeoff() {
    var c = best(candidates());
    if (c && c.node !== (perch && perch.node)) flyTo(c); else follow();
  }

  addEventListener('scroll', function () {
    var y = scrollY; vy = y - lastY; lastY = y; lastScroll = performance.now();
    if (state === 'rest' || state === 'follow') loop();
  }, { passive: true });
  addEventListener('resize', function () { BW = size(); if (perch) { var p = pointOf(perch); place(p.x, p.y, true); } });

  // タップ: 小さく跳ねて振り向く
  el.addEventListener('click', function () {
    if (state !== 'rest') return;
    el.classList.remove('kw--hop'); void el.offsetWidth; el.classList.add('kw--hop');
    show('look');
    setTimeout(function () { if (state === 'rest') show('idle'); }, 1200);
  });

  // 登場: 人物が帳簿に並んだ後、画面右外から飛来する
  function enter() {
    var c = best(candidates());
    place(innerWidth + BW, Math.max(hdrH() + 80, innerHeight * 0.2), true);
    if (!c) { follow(); return; }
    el.style.opacity = '';
    state = 'enter';
    face = -1;
    flyTo(c);
  }
  el.style.opacity = '0';
  var delay = reduce ? 300 : (scrollY < 40 && d.querySelector('.hero') ? 1700 : 500);
  if (d.readyState === 'complete') setTimeout(enter, delay); else addEventListener('load', function () { setTimeout(enter, delay); });

  // 検証口
  W.__kawasemi = {
    get state() { return state; },
    get perch() { return perch && perch.node; },
    rect: function () { return el.getBoundingClientRect(); },
    perches: function () {
      return candidates().map(function (c) {
        return { sel: c.node.className.toString().split(' ')[0] || c.node.tagName, x: Math.round(c.x), y: Math.round(c.y), inView: c.inView, ok: c.ok };
      });
    },
    settle: function () { var c = best(candidates()); if (c) { flight = null; land(c); } else follow(); return state; }
  };
})();
