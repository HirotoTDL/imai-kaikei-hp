/* 案内役のカワセミ — 設計 docs/motion.md §E
   ・止まっている間は止まり木（ページの部品の上の縁）にくっついて一緒にスクロールする
   ・止まり木が画面から外れそうになったら、ちょっとしゃがんで飛び立ち、次の止まり木へ弧を描いて飛ぶ
   ・止まれる場所が無い間は、画面の右端を羽ばたき・滑空しながらついてくる
   ・本文・電話・ボタンに重なる止まり木は使わない（実行時に測る）
   ・止まっている間は、所作（振り向き・首かしげ・羽づくろい・伸び・バンザイ・ぶるぶる・下を覗く・向き直り・お魚）を
     数秒おきに気まぐれに見せる。見出しに着いたらおじぎ、上へ戻られたら見上げる。
     しばらく誰も動かさないと、うとうと居眠りする（スクロール・タップで起きる）。タップするたびにちがう反応
   ・絵は Codex が描き分けたコマ（止まり姿3コマ／羽ばたき3コマ／所作の一枚 kw_pose.webp）
   検証口: window.__kawasemi（state / act / perches() / settle() / play(名前)） */
(function () {
  'use strict';
  var d = document, W = window, FEET = 0.92;         // 足元はコマの高さの92%（build_kawasemi.py）
  var el = d.getElementById('kawasemi');
  if (!el || !W.requestAnimationFrame) return;
  var reduce = W.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var img = { idle: el.querySelector('.kw-idle'), fly: el.querySelector('.kw-fly'), pose: el.querySelector('.kw-pose') };
  var POSES = (el.dataset.poses || '').split(',');    // kw_pose.webp のコマの並び（build_kawasemi.py）
  var CELL = +el.dataset.cell || 1;                   // 鳥の体に対するコマの倍率（所作で翼を広げる分だけコマが大きい）
  var flip = el.querySelector('.kw__flip');
  var hit = el.querySelector('.kw__hit');

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

  var state = 'hidden', perch = null, pos = { x: 0, y: 0 }, face = 1;
  var flight = null, lastScroll = 0, lastY = scrollY, vy = 0, tick = false;
  var actTimer = 0, actId = 0, act = '', lastAct = '', lastPoke = performance.now(), taps = 0, followT0 = 0;

  var BODY, BW;
  function size() {
    BODY = innerWidth < 768 ? 72 : innerWidth < 1200 ? 92 : 112;   // 旧版（4所作）のコマの一辺 = 鳥の体の大きさの目安
    BW = Math.round(BODY * CELL);                                   // 実際のコマの一辺
    el.style.setProperty('--kw-w', BW + 'px');
    if (hit) {                                                      // 触れる所は鳥の体だけ（コマが大きくなっても体の上）
      hit.style.cssText = 'left:' + (BW / 2 - BODY * 0.23) + 'px;top:' + (BW * FEET - BODY * 0.52) + 'px;width:' +
        (BODY * 0.46) + 'px;height:' + (BODY * 0.5) + 'px';
    }
  }
  size();
  function hdrH() { var h = d.querySelector('.hdr'); return h ? h.getBoundingClientRect().bottom : 0; }
  function bottomLimit() {
    var b = d.querySelector('.spbar');
    var r = b && getComputedStyle(b).display !== 'none' ? b.getBoundingClientRect().top : innerHeight;
    return Math.min(innerHeight, r) - 12;
  }
  function birdH() { return BW * FEET; }
  function bodyTop() { return BODY * 0.58; }        // 足元から体のてっぺんまで

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
        x = Math.max(BODY / 2 + 8, Math.min(innerWidth - BODY / 2 - 8, x));
        var box = { l: x - BODY * 0.4, r: x + BODY * 0.4, t: y - bodyTop(), b: y };
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
    var x = Math.max(BODY / 2 + 8, Math.min(innerWidth - BODY / 2 - 8, r.left + r.width * c.fx));
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

  // 表示: 'idle' / 'fly'（CSS で回す3コマ）か、所作の名前（kw_pose.webp の1コマ）
  function show(which) {
    var k = POSES.indexOf(which);
    if (k >= 0) img.pose.style.objectPosition = (POSES.length > 1 ? k / (POSES.length - 1) * 100 : 0) + '% 0';
    img.idle.hidden = which !== 'idle'; img.fly.hidden = which !== 'fly'; img.pose.hidden = k < 0;
    el.dataset.clip = which;
  }
  function setFace(f) { face = f; flip.style.transform = face < 0 ? 'scaleX(-1)' : ''; }
  function place(x, y) {
    pos.x = x; pos.y = y;
    el.style.transform = 'translate3d(' + (x - BW / 2).toFixed(1) + 'px,' + (y - birdH()).toFixed(1) + 'px,0)';
    setFace(face);
  }
  function fx(name) { el.classList.remove('kw--' + name); void el.offsetWidth; el.classList.add('kw--' + name); }

  // ---- 所作（止まっている間だけ）。[絵, ミリ秒, 効果] の列を順に見せ、最後は止まり姿に戻る。w = 気まぐれで選ばれる重み ----
  var ACTS = {
    look:     { w: 3,   seq: [['look', 1200]] },
    tilt:     { w: 3,   seq: [['tilt', 500], ['idle', 220], ['tilt', 700]] },                        // 「ん？」と2回かしげる
    lookdown: { w: 2,   seq: [['lookdown', 1600]] },                                                // 足元の本文を覗き込む
    preen:    { w: 2.2, seq: [['preen1', 420], ['preen2', 360], ['preen1', 340], ['preen3', 420], ['preen2', 360], ['preen1', 320]] },
    stretch:  { w: 1.4, seq: [['stretch1', 1100]] },                                                // 片翼と片足をのびー
    banzai:   { w: 1,   seq: [['crouch', 160], ['stretch2', 950, 'hop'], ['idle', 200, 'squash']] },   // 両翼バンザイ
    fluff:    { w: 1.5, seq: [['fluff1', 160], ['fluff2', 110], ['fluff1', 110], ['fluff2', 110], ['fluff1', 110], ['fluff2', 110],
                              ['fluff1', 420], ['idle', 160, 'squash']] },                          // ぶるぶるっ
    turn:     { w: 2,   seq: [['crouch', 130], ['idle', 380, 'hopturn'], ['tilt', 600]] },           // ちょんと跳ねて向き直る
    fish:     { w: 0.6, seq: [['fish1', 1300], ['fish2', 520, 'hop'], ['idle', 200, 'squash'], ['tilt', 600]] },  // お魚ゲット→ごっくん
    bow:      { w: 0,   seq: [['bow', 1000]] },                                                     // 見出しに着いたとき・タップ
    lookup:   { w: 0,   seq: [['lookup', 650]] },                                                   // 上へスクロールされたとき
    wake:     { w: 0,   seq: [['look', 520, 'hop'], ['tilt', 700]] }                                // 居眠りから起こされた・タップ
  };
  var DOZE = [['doze1', 700], ['doze2', 760], ['doze1', 620], ['doze3', 460]];
  function play(name) {
    var a = ACTS[name]; if (!a || reduce || state !== 'rest') return;
    clearTimeout(actTimer); var id = ++actId, n = 0;
    act = name; lastAct = name;
    (function step() {
      if (id !== actId || state !== 'rest') return;
      if (n >= a.seq.length) { act = ''; show('idle'); plan(); return; }
      var s = a.seq[n++];
      show(s[0]);
      if (s[2] === 'hopturn') { fx('hop'); setTimeout(function () { if (id === actId) setFace(-face); }, 150); }
      else if (s[2]) fx(s[2]);
      actTimer = setTimeout(step, s[1]);
    })();
  }
  function doze() {
    if (reduce || state !== 'rest') return;
    clearTimeout(actTimer); var id = ++actId, n = 0; act = 'doze';
    (function step() {
      if (id !== actId || state !== 'rest') return;
      var s = DOZE[n++ % DOZE.length]; show(s[0]);
      actTimer = setTimeout(step, s[1]);
    })();
  }
  function stopAct() { clearTimeout(actTimer); actId++; act = ''; }
  // 次の所作を予約: 3.5〜7秒後（同じ所作は続けない）。12秒以上だれも動かさなければ居眠り
  function plan(ms) {
    clearTimeout(actTimer);
    if (reduce) return;
    var id = ++actId;
    actTimer = setTimeout(function () {
      if (id !== actId || state !== 'rest') return;
      if (performance.now() - lastPoke > 12000) { doze(); return; }
      var names = Object.keys(ACTS).filter(function (k) { return ACTS[k].w > 0 && k !== lastAct; });
      var sum = names.reduce(function (t, k) { return t + ACTS[k].w; }, 0), r = Math.random() * sum, i = 0;
      for (; i < names.length - 1; i++) { r -= ACTS[names[i]].w; if (r <= 0) break; }
      play(names[i]);
    }, ms != null ? ms : 3500 + Math.random() * 3500);
  }
  function poke() {                                   // だれかが動かした（スクロール・タップ）
    lastPoke = performance.now();
    if (act === 'doze' && state === 'rest') play('wake');
  }

  function land(c) {
    perch = c; state = 'rest'; stopAct();
    var p = pointOf(c);
    show('land'); place(p.x, p.y);
    fx('squash');
    var title = c.node.classList && c.node.classList.contains('title-img');
    setTimeout(function () {
      if (state !== 'rest') return;
      show('idle');
      if (title && !reduce && Math.random() < 0.45) setTimeout(function () { if (state === 'rest' && !act) play('bow'); }, 350);  // 見出しに着いたらおじぎ
      else plan(1800 + Math.random() * 2500);
    }, reduce ? 0 : 160);
  }

  function flyTo(c) {
    var from = state; stopAct();
    if (reduce) {                                     // 動きを減らす設定: 飛ばずに入れ替わる
      el.style.opacity = '0';
      setTimeout(function () { land(c); el.style.opacity = ''; }, 220);
      return;
    }
    var p = pointOf(c);
    var dist = Math.hypot(p.x - pos.x, p.y - pos.y);
    flight = { c: c, x0: pos.x, y0: pos.y, t0: performance.now(), dur: Math.max(450, Math.min(1100, dist * 1.1)),
               lift: Math.min(140, 40 + dist * 0.3) };
    perch = null;
    if (Math.abs(p.x - pos.x) > 4) setFace(p.x > pos.x ? 1 : -1);   // 行き先の方へ向いてから飛ぶ
    if (from === 'rest') {                            // 飛び立つ前にちょっとしゃがむ（予備動作）
      state = 'crouch'; show('crouch');
      setTimeout(function () {
        if (state !== 'crouch' || !flight) return;
        flight.x0 = pos.x; flight.y0 = pos.y; flight.t0 = performance.now();
        state = 'fly'; show('fly'); loop();
      }, 110);
      loop();
      return;
    }
    state = 'fly';
    show('fly');
    loop();
  }
  function follow() {                                 // 止まれる場所が無い: 右端を飛んでついてくる
    if (reduce) { state = 'hidden'; el.style.opacity = '0'; return; }
    stopAct();
    state = 'follow'; perch = null; show('fly'); followT0 = performance.now();
    el.style.opacity = '';                            // ★登場時に止まり木が無いとこの経路で始まる（透明のままだった）
    loop();
  }

  function frame(now) {
    tick = false;
    if (state === 'rest' && perch) {
      if (!comfortable(perch)) { takeoff(); }
      else { var p = pointOf(perch); place(p.x, p.y); }
    } else if (state === 'crouch' && flight) {        // しゃがんでいる間も、元の止まり木と一緒に動く
      place(pos.x, pos.y);                            // pos.y はスクロールのたびに止まり木の分だけずらしてある
      tick = true; requestAnimationFrame(frame);
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
      y = Math.max(y, hdrH() + birdH() * 0.72);       // 弧がヘッダーの裏へ潜らないように
      if (Math.abs(x - pos.x) > 0.6) face = x > pos.x ? 1 : -1;   // いま進んでいる向きへ体を向ける
      place(x, y);
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
      var lane = gut > BODY ? innerWidth - gut / 2 : innerWidth - BODY * 0.16;
      var want = innerHeight * 0.42 + Math.max(-80, Math.min(80, -vy * 6)) + Math.sin(now / 420) * 6;
      var nx = pos.x + (lane - pos.x) * 0.12, ny = pos.y + (want - pos.y) * 0.1;
      ny = Math.max(hdrH() + birdH() + 6, Math.min(bottomLimit(), ny));
      // ★向き: 横へ動いている間は進む向き（右端の通り道へ向かう途中、後ろ向きで進んでいた 2026-10-23 指摘）。
      //   通り道に着いたら本文の方（左）を向いて待つ
      face = Math.abs(lane - nx) > 4 ? (lane > nx ? 1 : -1) : -1;
      // ゆっくりの間は羽ばたき 0.7s と滑空 0.9s を交互に（ずっとパタパタしない）
      var calm = Math.abs(ny - pos.y) < 2 && Math.abs(nx - pos.x) < 2;
      var g = calm && (now - followT0) % 1600 > 700 ? 'glide' : 'fly';
      if (el.dataset.clip !== g) show(g);
      place(nx, ny);
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
    if (state === 'crouch') return;
    var c = best(candidates());
    if (c && c.node !== (perch && perch.node)) flyTo(c); else follow();
  }

  addEventListener('scroll', function () {
    var y = scrollY; vy = y - lastY; lastY = y; lastScroll = performance.now();
    poke();
    if (state === 'rest' && !act && vy < -28 && perch && comfortable(perch)) play('lookup');   // 上へ戻られたら見上げる
    if (state === 'crouch' && flight) pos.y -= vy;                                            // しゃがみ中も止まり木と一緒に
    if (state === 'rest' || state === 'follow' || state === 'crouch') loop();
  }, { passive: true });
  addEventListener('resize', function () { size(); if (perch) { var p = pointOf(perch); place(p.x, p.y); } });
  ['pointermove', 'keydown', 'touchstart'].forEach(function (t) {
    addEventListener(t, function () { lastPoke = performance.now(); }, { passive: true });
  });

  // タップ: 押すたびにちがう反応（跳ねて振り向く → おじぎ → ぶるぶる → お魚 → バンザイ → 向き直り）
  var TAP = ['wake', 'bow', 'fluff', 'fish', 'banzai', 'turn'];
  el.addEventListener('click', function () {
    if (state !== 'rest') return;
    lastPoke = performance.now();
    play(TAP[taps++ % TAP.length]);
  });

  // 登場: 人物が帳簿に並んだ後、画面右外から飛来する
  function enter() {
    var c = best(candidates());
    face = -1;
    place(innerWidth + BW, Math.max(hdrH() + 80, innerHeight * 0.2));
    if (!c) { follow(); return; }
    el.style.opacity = '';
    state = 'enter';
    flyTo(c);
  }
  el.style.opacity = '0';
  var delay = reduce ? 300 : (scrollY < 40 && d.querySelector('.hero') ? 1700 : 500);
  if (d.readyState === 'complete') setTimeout(enter, delay); else addEventListener('load', function () { setTimeout(enter, delay); });

  // 検証口
  W.__kawasemi = {
    get state() { return state; },
    get act() { return act; },
    get face() { return face; },
    get perch() { return perch && perch.node; },
    rect: function () { return el.getBoundingClientRect(); },
    play: function (n) { lastPoke = performance.now(); if (n === 'doze') doze(); else play(n); return act; },
    perches: function () {
      return candidates().map(function (c) {
        return { sel: c.node.className.toString().split(' ')[0] || c.node.tagName, x: Math.round(c.x), y: Math.round(c.y), inView: c.inView, ok: c.ok };
      });
    },
    settle: function () { var c = best(candidates()); if (c) { flight = null; land(c); } else follow(); return state; }
  };
})();
