/* ===================================================================
   scene.js — 場面（Scene）セクションのエンジン
   正本 = docs/design.md §8-D（2026-07-29 再設計）

   設計の要点
     ・固定の全画面舞台は持たない。**各 Scene セクションが自分の中に
       背景とカワセミを閉じ込める**（position:relative + overflow:hidden）
     ・そのため、はみ出し・ヘッダーへの潜り込み・本文との z-index 争いが
       構造的に起こらない
     ・鳥が出るのは Scene と、別途 companion.js が扱う一部の紙面だけ
   =================================================================== */
window.Scene = (function () {
  'use strict';

  var gsap = window.gsap, ST = window.ScrollTrigger;
  if (!gsap || !ST) return null;
  gsap.registerPlugin(ST, window.MotionPathPlugin);

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
             || /[?&]reduced=1/.test(location.search);

  var BASE = 'assets/images/';
  /* ★小さい画面には縮小版を配る。
     実測（Lighthouse・モバイル）で、町は表示249pxに対し900px、雲は112pxに対し448pxを
     配っており、合わせて約250KBが無駄だった。見た目は変わらない。 */
  var SUF = (window.innerWidth < 900) ? '_sp' : '';
  function fileOf(name) { return name.replace(/\.webp$/, SUF + '.webp'); }

  /* 枝つき素材（自然の中＝Scene で使う） */
  var CLIPS = {
    flap:     { file: 'char_kawasemi_flap.webp',     frames: 8,  fps: 14 },
    glide:    { file: 'char_kawasemi_glide.webp',    frames: 4,  fps: 6 },
    hover:    { file: 'char_kawasemi_hover.webp',    frames: 6,  fps: 18 },
    perch_in: { file: 'char_kawasemi_perch_in.webp', frames: 5,  fps: 16 },
    idle:     { file: 'char_kawasemi_idle.webp',     frames: 8,  fps: 6 },
    look:     { file: 'char_kawasemi_look.webp',     frames: 6,  fps: 8 },
    preen:    { file: 'char_kawasemi_preen.webp',    frames: 8,  fps: 8 },
    turn:     { file: 'char_kawasemi_turn.webp',     frames: 5,  fps: 10 },
    takeoff:  { file: 'char_kawasemi_takeoff.webp',  frames: 5,  fps: 18 },
    dive:     { file: 'char_kawasemi_dive.webp',     frames: 8,  fps: 20 },
    splash:   { file: 'char_kawasemi_splash.webp',   frames: 6,  fps: 20 },
    catch:    { file: 'char_kawasemi_catch.webp',    frames: 10, fps: 16 },
    shake:    { file: 'char_kawasemi_shake.webp',    frames: 6,  fps: 18 },
    beat:     { file: 'char_kawasemi_beat.webp',     frames: 6,  fps: 14 },
    swallow:  { file: 'char_kawasemi_swallow.webp',  frames: 6,  fps: 10 }
  };

  /* ---------------- スプライト・プレイヤー ---------------- */
  function Sprite(el, clips) {
    this.el = el; this.clips = clips || CLIPS;
    this.clip = null; this.name = ''; this.t = 0; this.rate = 1; this.frameIdx = 0;
    this.once = false; this.done = false;
  }
  /* keys を読む。done を渡すと「全部が使える状態」になってから呼ぶ。
     ★実測（2026-07-30）: 川の漁は画面に入った瞬間から時計が進むのに、
       絵はそこから読み始めるので、まだ届いていない所作の間だけ
       鳥が1羽も写らなかった（撮影で確認。滑空・急降下・着地で発生）。
     ★「1枚目だけ待つ」では足りない。所作ごとに別ファイルなので、
       後の所作が抜ける。ひと続きの漁は途中で欠けたら意味がないので全部待つ。 */
  Sprite.prototype.preload = function (keys, done) {
    var self = this;
    var list = keys || Object.keys(this.clips);
    if (!list.length) { if (done) done(); return; }
    var left = list.length;
    function one() { if (--left <= 0 && done) done(); }
    list.forEach(function (k) {
      var i = new Image();
      if (done) { i.onload = one; i.onerror = one; }   // 読めなくても止めない
      i.src = BASE + fileOf(self.clips[k].file);
    });
  };
  Sprite.prototype.play = function (name, restart, once) {
    if (this.name === name && !restart) return;
    var c = this.clips[name]; if (!c) return;
    this.name = name; this.clip = c; this.t = 0; this.once = !!once; this.done = false;
    this.el.style.backgroundImage = 'url(' + BASE + fileOf(c.file) + ')';
    this.el.style.backgroundSize = (c.frames * 100) + '% 100%';
    this.frame(0);
  };
  Sprite.prototype.frame = function (i) {
    var c = this.clip; if (!c) return;
    i = Math.max(0, Math.min(c.frames - 1, i));
    this.frameIdx = i;
    this.el.style.backgroundPositionX = (c.frames > 1 ? (i / (c.frames - 1)) * 100 : 0) + '%';
  };
  Sprite.prototype.tick = function (dt) {
    var c = this.clip; if (!c || this.done) return;
    this.t += dt * this.rate;
    var i = Math.floor(this.t * c.fps);
    if (this.once) { if (i >= c.frames - 1) { i = c.frames - 1; this.done = true; } }
    else { i = ((i % c.frames) + c.frames) % c.frames; }
    this.frame(i);
  };

  /* ★重い素材は「近づいてから」読む。
     実測（モバイル）: 川の場面の10クリップと背景ループを最初に読んでいたため、
     LCP が 8.0 秒まで悪化していた。見えていないものを先に読む理由はない */
  function whenNear(el, cb, mult) {
    if (!el) { cb(); return; }
    var done = false;
    mult = (mult == null) ? 1.2 : mult;
    function chk() {
      if (done) return;
      var r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * (1 + mult) && r.bottom > -window.innerHeight) {
        done = true;
        window.removeEventListener('scroll', chk);
        window.removeEventListener('resize', chk);
        cb();
      }
    }
    window.addEventListener('scroll', chk, { passive: true });
    window.addEventListener('resize', chk);
    chk();
    /* ★「放置されても読んでおく」保険は入れない。
       スクロールしていない人にまで川の素材（約300KB）を読ませることになり、
       それだけで初回読み込みが重くなる。見に行った人にだけ読ませる。 */
  }

  /* 時間で回すクリップをまとめて駆動する（GSAP ticker） */
  var driven = [];
  if (!reduced) {
    var last = 0;
    gsap.ticker.add(function (time) {
      var dt = last ? Math.min(0.1, time - last) : 0;
      last = time;
      for (var i = 0; i < driven.length; i++) {
        var d = driven[i];
        if (d.active()) d.sp.tick(dt);
      }
    });
  }

  /* ---------------- 川の場面：漁の連鎖 ----------------
     位置は「その場面の箱」に対する割合。画面座標を使わないので、
     セクションの大きさが変わっても崩れない */
  /* ★2026-07-30 見直し。実機の画面で確かめて2点直した。
     ①「枝へ戻る（takeoff）」を外した。takeoff の絵には枝が写っており、
        川の真ん中の空中に枝が浮いて見えていた（撮影で確認）。
        そもそも takeoff は「枝から飛び立つ」絵なので、
        水から上がった鳥がこれから枝へ向かう場面には合わない。
        代わりに枝のない flap で枝の近くまで飛ぶ。
     ②とまる場所は最後の4所作で同じ座標にする。枝はコマ絵の中にあるので、
        座標が動くと枝ごと動いてしまう。 */
  var PERCH = { x: .20, y: .52 };
  var HUNT = [
    { to: .10, x: .66, y: .20, clip: 'glide',    mode: 'loop', label: '川へ滑空' },
    { to: .24, x: .50, y: .17, clip: 'hover',    mode: 'loop', label: '停空飛翔' },
    { to: .36, x: .52, y: .62, clip: 'dive',     mode: 'once', label: '急降下' },
    { to: .45, x: .52, y: .80, clip: 'splash',   mode: 'once', label: '着水' },
    { to: .58, x: .46, y: .40, clip: 'catch',    mode: 'once', label: '魚を咥えて浮上' },
    { to: .68, x: .30, y: .46, clip: 'flap',     mode: 'loop', label: '枝へ向かう' },
    { to: .76, x: PERCH.x, y: PERCH.y, clip: 'perch_in', mode: 'once', label: '枝にとまる' },
    { to: .84, x: PERCH.x, y: PERCH.y, clip: 'shake',    mode: 'once', label: '水を振り払う' },
    { to: .92, x: PERCH.x, y: PERCH.y, clip: 'beat',     mode: 'once', label: '魚を叩く' },
    { to: 1.01, x: PERCH.x, y: PERCH.y, clip: 'swallow', mode: 'once', label: '飲み込む' }
  ];

  /* ★小さい画面では所作を5つに絞る。
     10クリップで約900KB あり、モバイルの表示速度を大きく損ねていた（実測）。
     「見つける→飛び込む→捕らえる→枝へ→飲み込む」の骨格は残す */
  var HUNT_SP = [
    { to: .18, x: .60, y: .18, clip: 'glide',    mode: 'loop', label: '川へ滑空' },
    { to: .40, x: .52, y: .62, clip: 'dive',     mode: 'once', label: '急降下' },
    { to: .62, x: .44, y: .38, clip: 'catch',    mode: 'once', label: '魚を咥えて浮上' },
    { to: .82, x: .22, y: .52, clip: 'perch_in', mode: 'once', label: '枝にとまる' },
    { to: 1.01, x: .22, y: .52, clip: 'swallow', mode: 'once', label: '飲み込む' }
  ];

  function legAt(list, p) {
    for (var i = 0; i < list.length; i++) if (p < list[i].to) return i;
    return list.length - 1;
  }

  /* ---------------- 川の場面を組む ----------------
     ★スクロールに一切ぶら下げない。画面に入ったら**自分の時間で**漁を演じ、
       少し間を置いて繰り返す。スクロールを固定して見せる作りは撤去した
       （閲覧者からスクロールを奪うのはそれ自体がストレス・ユーザー指摘）。
     各所作の長さは素材本来のコマ数÷fps。移動はそれに重ねる。 */
  function buildRiver(root) {
    var vp = root.querySelector('.scene__vp');
    var bird = root.querySelector('.scene__bird');
    if (!vp || !bird) return null;

    var sp = new Sprite(bird);
    var legs = (window.innerWidth < 900) ? HUNT_SP : HUNT;
    var ready = false;                 // 絵が使えるか
    whenNear(root, function () {
      /* ★1コマ目を出すのも「近づいてから」。
         起動時に sp.play() を呼ぶと、その場で background-image が入り、
         画面より4000px下の絵を最初の読み込みで取ってしまう
         （実測: モバイルで char_kawasemi_glide_sp.webp 20KB、PCでは 52KB）。 */
      sp.play(reduced ? legs[legs.length - 1].clip : legs[0].clip);
      if (reduced) sp.frame(0);
      var keys = [], seen = {};
      legs.forEach(function (l) { if (!seen[l.clip]) { seen[l.clip] = 1; keys.push(l.clip); } });
      sp.preload(keys, function () { ready = true; go(); });
      /* 通信が詰まっても永遠に始まらないことがないように上限を置く */
      setTimeout(function () { if (!ready) { ready = true; go(); } }, 6000);
    }, 1.0);

    var state = { face: 1, lastX: null, inView: false, leg: -1, legs: legs };
    /* 所作はすべて自分の時間で回すので、画面内なら常に進める */
    driven.push({ sp: sp, active: function () { return state.inView; } });

    var pos = { x: 1.14, y: 0.12 };
    function applyPos() {
      var W = vp.clientWidth, H = vp.clientHeight, size = bird.offsetWidth || 170;
      var x = pos.x * W - size / 2, y = pos.y * H - size / 2;
      if (state.lastX != null) {
        var dx = x - state.lastX;
        if (Math.abs(dx) > 1.5) state.face = dx > 0 ? -1 : 1;
      }
      state.lastX = x;
      gsap.set(bird, { x: x, y: y, scaleX: state.face });
    }

    function clipLen(name) {
      var c = CLIPS[name];
      return c ? Math.max(0.32, c.frames / c.fps) : 0.5;
    }

    pos.x = 1.14; pos.y = 0.12; applyPos();

    if (reduced) {
      /* 動かさない。魚を咥えて枝で落ち着いた形で見せる（絵は whenNear で入る） */
      var last = legs[legs.length - 1];
      pos.x = last.x; pos.y = last.y; applyPos();
      return { state: state, sp: sp };
    }

    /* 漁のひと続きを組む。終わったら間を置いて、また右手から入ってくる */
    var tl = gsap.timeline({ repeat: -1, repeatDelay: 1.6, paused: true,
      onRepeat: function () { pos.x = 1.14; pos.y = 0.12; state.lastX = null; applyPos(); } });

    legs.forEach(function (leg, i) {
      var len = clipLen(leg.clip);
      var move = Math.max(len, i === 0 ? 1.1 : 0.7);
      tl.add(function () {
        state.leg = i;
        sp.rate = 1;
        sp.play(leg.clip, true, leg.mode !== 'loop');
      });
      tl.to(pos, { x: leg.x, y: leg.y, duration: move,
                   ease: i === 0 ? 'power1.out' : 'power2.inOut', onUpdate: applyPos });
      /* 所作を見せ切るための一拍 */
      if (len > move) tl.to({}, { duration: len - move });
      tl.to({}, { duration: leg.hold != null ? leg.hold : 0.18 });
    });

    /* 画面に入ったら回す。出たら止める（見えていないものを動かさない）。
       ★絵が届くまでは回さない。届いてから最初の1拍で始める */
    function go() { if (ready && state.inView) tl.resume(); }
    ST.create({
      trigger: root, start: 'top 85%', end: 'bottom 15%',
      onToggle: function (self) {
        state.inView = self.isActive;
        if (self.isActive) go(); else tl.pause();
      }
    });

    window.__river = { tl: tl, state: state, sp: sp, pos: pos, legs: legs, applyPos: applyPos };
    return { state: state, sp: sp, tl: tl };
  }

  /* ---------------- ヒーローの場面（オープニングは opening.js が駆動） ---------------- */
  function buildHero(root) {
    var bird = root.querySelector('.scene__bird');
    if (!bird) return null;
    var sp = new Sprite(bird);
    /* ★登場演出を再生しない画面（小さい画面）では、飛来の所作は一切使わない。
       それでも6クリップ全部を読んでいて、実測で約490KB を無駄に転送していた。
       止まっている絵だけ読めばよい。 */
    if (window.innerWidth < 900) sp.preload(['idle']);
    else sp.preload(['flap', 'glide', 'hover', 'perch_in', 'idle', 'turn']);
    var state = { inView: true, face: 1 };
    driven.push({ sp: sp, active: function () { return state.inView; } });
    return { sp: sp, bird: bird, root: root, state: state };
  }

  /* ---------------- 背景の差分ループ（雲・水面・葉） ---------------- */
  function initLoops() {
    var BG = { cloud: { frames: 4, fps: 1.6 }, water: { frames: 4, fps: 3 }, leaf: { frames: 4, fps: 2.2 } };
    var loops = [];
    Array.prototype.forEach.call(document.querySelectorAll('[data-loop]'), function (el) {
      var key = el.getAttribute('data-loop'), c = BG[key];
      if (!c) return;
      /* ★小さい画面では揺らさない。1コマの静止版を使う（軽さと電池のため） */
      var still = (SUF === '_sp');
      var rec = { el: el, c: c, t: Math.random() * 3, ready: false, still: still };
      loops.push(rec);
      /* ★背景ループも近づいてから読む（葉202KB・水面118KB）。
         最初の画面に映っているものだけ即座に読む */
      whenNear(el, function () {
        /* ★静止版が無い場合は動く版に落とす。
           取りこぼすと 404 で絵ごと消える（実測: 水面の静止版を作り忘れ、
           モバイルの川が真っさらになった） */
        function put(useStill) {
          el.style.backgroundImage = 'url(' + BASE +
            (useStill ? 'bg_' + key + '_sp1.webp' : fileOf('bg_' + key + '.webp')) + ')';
          el.style.backgroundSize = (useStill ? 100 : c.frames * 100) + '% 100%';
        }
        if (still) {
          var probe = new Image();
          probe.onerror = function () { still = false; rec.still = false; put(false); };
          probe.src = BASE + 'bg_' + key + '_sp1.webp';
        }
        put(still);
        el.style.backgroundRepeat = 'no-repeat';
        el.style.backgroundPositionX = '0%';
        rec.ready = true;
      }, 0.6);
    });
    if (reduced || !loops.length) return loops;
    var last = 0;
    gsap.ticker.add(function (time) {
      var dt = last ? Math.min(0.1, time - last) : 0;
      last = time;
      for (var i = 0; i < loops.length; i++) {
        var L = loops[i];
        if (!L.ready || L.still) continue;       // 未読と静止版は回さない
        L.t += dt;
        var f = Math.floor(L.t * L.c.fps) % L.c.frames;
        L.el.style.backgroundPositionX = (f / (L.c.frames - 1)) * 100 + '%';
      }
    });
    return loops;
  }

  function init() {
    var api = { river: null, hero: null, loops: initLoops(), CLIPS: CLIPS, Sprite: Sprite, driven: driven, reduced: reduced, BASE: BASE };
    var hero = document.querySelector('[data-scene="hero"]');
    var river = document.querySelector('[data-scene="river"]');
    if (hero) api.hero = buildHero(hero);
    if (river) api.river = buildRiver(river);
    window.__scene = api;
    return api;
  }

  return { init: init, CLIPS: CLIPS, Sprite: Sprite, BASE: BASE, driven: driven, reduced: reduced };
})();
