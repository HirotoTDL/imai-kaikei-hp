/* ===================================================================
   全編横断ステージ（design.md §8-D）＋ セルアニメーション（§8-E）

   このファイルは「舞台」だけを提供するモジュール。
     window.Stage.create(opts) → { sp, render, start, LEG, posAt, state, START }
   オープニング（js/top.js）から呼ばれる場合は start() を遅らせ、
   着地位置 START を共有することでシームレスに主導権を渡す。

   <body data-stage-auto> があれば単体で自動起動する（stage.html 用）。
   =================================================================== */
window.Stage = (function () {
  'use strict';

  var gsap = window.gsap, ST = window.ScrollTrigger;
  if (!gsap || !ST) return null;
  gsap.registerPlugin(ST, window.MotionPathPlugin);

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
             || /[?&]reduced=1/.test(location.search);

  // 本素材（Codex 生成・水彩）。仮素材に戻すときは '_placeholder/' を足す
  var BASE = 'assets/images/';

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

  /* ★オープニングの着地点＝スクロール旅程の起点（p=0）。
     この1点を共有することで、演出からスクロールへ位置が跳ばずに渡る */
  // 情景（街並み・木）の高さに合わせて着地させる。空中で浮いて見えないように
  var START = { x: 0.80, y: 0.74 };

  /* 旅程（design.md §8-D）
     ★2026-07-29 全面改定: 位置を画面座標ではなく「本文の要素」に紐づける。
       anchor = { sel, ax, ay } … その要素の (ax, ay) の点に“足を置く”
                 axFrom/axTo を書くと、区間内で横に移動する
       front  = true で本文より前面へ（既定は本文の裏。裏⇄前面の切替が「絡み」を作る）
     phase / w = どのセクションで、その中の時間配分をどれだけ取るか */
  var LEG = [
    { phase: 'hero',  w: 1.0, to: .16, x: .84, y: .72, clip: 'idle', mode: 'loop', front: true,
      label: '待機' },

    // 相談箱の上辺にとまり、中を覗き込む
    { phase: 'worry', w: 1.0, to: .20, clip: 'perch_in', mode: 'scrub', front: true,
      anchor: { sel: '#sec-worry .entry--top', ax: .86, ay: 0 }, label: '相談箱にとまる' },
    { phase: 'worry', w: 1.4, to: .22, clip: 'look', mode: 'scrub', front: true,
      anchor: { sel: '#sec-worry .entry--top', ax: .86, ay: 0 }, label: '相談箱を覗き込む' },

    // サービスカードの上辺を、カードの進行に合わせて左へ渡っていく
    { phase: 'service', w: 0.6, to: .30, clip: 'flap', mode: 'loop', front: true,
      anchor: { sel: '.stack__cards', range: '#sec-service', ax: .9, ay: 0 }, label: 'カードの上へ' },
    { phase: 'service', w: 2.4, to: .50, clip: 'idle', mode: 'loop', front: true,
      anchor: { sel: '.stack__cards', range: '#sec-service', axFrom: .9, axTo: .12, ay: 0 }, label: 'カードの上を渡る' },
    { phase: 'service', w: 0.6, to: .52, clip: 'takeoff', mode: 'scrub', front: true,
      anchor: { sel: '.stack__cards', range: '#sec-service', ax: .12, ay: 0 }, label: 'カードから飛び立つ' },

    // 川（舞台の水面）— ここだけは本文の裏に回り、背景の中で漁をする
    { phase: 'river', w: 1.0, to: .545, x: .42, y: .40, clip: 'glide',   mode: 'loop',  label: '川へ向かう' },
    { phase: 'river', w: 1.2, to: .585, x: .60, y: .30, clip: 'hover',   mode: 'loop',  label: '停空飛翔' },
    { phase: 'river', w: 1.0, to: .615, x: .66, y: .66, clip: 'dive',    mode: 'scrub', label: '急降下' },
    { phase: 'river', w: 0.7, to: .635, x: .68, y: .84, clip: 'splash',  mode: 'scrub', label: '着水' },
    { phase: 'river', w: 1.4, to: .675, x: .62, y: .46, clip: 'catch',   mode: 'scrub', front: true, label: '魚を咥えて浮上' },
    { phase: 'river', w: 0.8, to: .700, x: .50, y: .34, clip: 'takeoff', mode: 'scrub', front: true, label: '枝へ戻る' },

    // 本文へ戻り、見出しの上にとまって魚を処理する
    { phase: 'river', w: 0.8, to: .725, clip: 'perch_in', mode: 'scrub', front: true,
      anchor: { sel: '#sec-river .about2__fig', ax: .5, ay: 0 }, label: '写真の上にとまる' },
    { phase: 'river', w: 0.9, to: .755, clip: 'shake',   mode: 'scrub', front: true,
      anchor: { sel: '#sec-river .about2__fig', ax: .5, ay: 0 }, label: '水を振り払う' },
    { phase: 'river', w: 1.0, to: .785, clip: 'beat',    mode: 'scrub', front: true,
      anchor: { sel: '#sec-river .about2__fig', ax: .5, ay: 0 }, label: '魚を叩く' },
    { phase: 'river', w: 1.0, to: .815, clip: 'swallow', mode: 'scrub', front: true,
      anchor: { sel: '#sec-river .about2__fig', ax: .5, ay: 0 }, label: '飲み込む' },

    // 人物カードの上で羽づくろい → こちらを向く
    { phase: 'team', w: 1.2, to: .870, clip: 'preen', mode: 'loop', front: true,
      anchor: { sel: '#sec-team .person2', ax: .5, ay: 0 }, label: '人物カードで羽づくろい' },
    { phase: 'team', w: 1.0, to: .920, clip: 'turn',  mode: 'scrub', front: true,
      anchor: { sel: '#sec-team .person2', ax: .5, ay: 0 }, label: 'こちらを向く' },

    // 電話番号の隣にとまって待つ
    { phase: 'cta', w: 1.0, to: 1.010, clip: 'idle', mode: 'loop', front: true,
      anchor: { sel: '#sec-cta .telblock', ax: 1.0, ay: 1.0, dx: .25 }, label: '電話番号の隣で待機' }
  ];

  /* ★旅程の区間を、実際のセクション位置から算出する。
     ページの高さや文量が変わっても、所作とセクションがずれない */
  function calibrate(bounds) {
    if (!bounds) return;
    Object.keys(bounds).forEach(function (phase) {
      var a = bounds[phase][0], b = bounds[phase][1];
      var legs = LEG.filter(function (l) { return l.phase === phase; });
      var total = legs.reduce(function (s, l) { return s + (l.w || 1); }, 0);
      var acc = 0;
      legs.forEach(function (l, i) {
        acc += (l.w || 1);
        l.to = (i === legs.length - 1) ? b : a + (b - a) * (acc / total);
      });
    });
    var last = LEG[LEG.length - 1];
    if (last.to < 1.005) last.to = 1.01;   // 末端は必ず 1 を超えさせる
  }

  /* ---------------- スプライト・プレイヤー ---------------- */
  function SpritePlayer(el) {
    this.el = el; this.clip = null; this.name = ''; this.t = 0; this.rate = 1; this.frameIdx = 0;
  }
  /* ★先読みは2段階に分ける。
     起動時に15クリップ全部（実測344KB）を取りに行くと、LCPの画像と帯域を奪い合う。
     序盤で使うものだけ先に読み、漁の所作はページ読込後に静かに取る */
  var EAGER = ['idle', 'flap', 'glide', 'perch_in', 'turn', 'hover'];
  SpritePlayer.prototype.preload = function () {
    EAGER.forEach(function (k) { var i = new Image(); i.src = BASE + CLIPS[k].file; });
    var rest = Object.keys(CLIPS).filter(function (k) { return EAGER.indexOf(k) < 0; });
    var later = function () {
      rest.forEach(function (k, n) {
        setTimeout(function () { var i = new Image(); i.src = BASE + CLIPS[k].file; }, n * 120);
      });
    };
    if (document.readyState === 'complete') setTimeout(later, 800);
    else window.addEventListener('load', function () { setTimeout(later, 800); }, { once: true });
  };
  /* once = true のとき、最終コマまで送って止まる（着地・振り向きなど1回きりの所作） */
  SpritePlayer.prototype.play = function (name, restart, once) {
    if (this.name === name && !restart) return;
    var c = CLIPS[name]; if (!c) return;
    this.name = name; this.clip = c; this.t = 0;
    this.once = !!once; this.done = false;
    this.el.style.backgroundImage = 'url(' + BASE + c.file + ')';
    this.el.style.backgroundSize = (c.frames * 100) + '% 100%';
    this.frame(0);
  };
  SpritePlayer.prototype.frame = function (i) {
    var c = this.clip; if (!c) return;
    i = Math.max(0, Math.min(c.frames - 1, i));
    this.frameIdx = i;
    this.el.style.backgroundPositionX = (c.frames > 1 ? (i / (c.frames - 1)) * 100 : 0) + '%';
  };
  SpritePlayer.prototype.frameByProgress = function (t) {
    var c = this.clip; if (!c) return;
    this.frame(Math.floor(Math.max(0, Math.min(0.9999, t)) * c.frames));
  };
  SpritePlayer.prototype.tick = function (dt) {
    var c = this.clip; if (!c || this.done) return;
    this.t += dt * this.rate;
    var i = Math.floor(this.t * c.fps);
    if (this.once) {
      if (i >= c.frames - 1) { i = c.frames - 1; this.done = true; }
    } else {
      i = ((i % c.frames) + c.frames) % c.frames;
    }
    this.frame(i);
  };

  /* ---------------- 旅程 ---------------- */
  function legAt(p) {
    for (var i = 0; i < LEG.length; i++) if (p < LEG[i].to) return i;
    return LEG.length - 1;
  }
  function subProgress(p, i) {
    var a = i === 0 ? 0 : LEG[i - 1].to, b = LEG[i].to;
    return b > a ? Math.max(0, Math.min(1, (p - a) / (b - a))) : 0;
  }
  /* 1区間ぶんの「足を置く点」を画面座標(px)で返す。
     anchor があれば本文の要素に追従する＝スクロールしても要素の上に乗り続ける */
  function pointOf(leg, size, t) {
    var a = leg.anchor;
    if (a) {
      var el = document.querySelector(a.sel);
      if (el) {
        var r = el.getBoundingClientRect();
        var ax = (a.axFrom != null && a.axTo != null)
          ? a.axFrom + (a.axTo - a.axFrom) * (t == null ? 1 : t)
          : (a.ax != null ? a.ax : 0.5);
        var ay = a.ay != null ? a.ay : 0;
        return {
          x: r.left + r.width * ax - size / 2 + (a.dx || 0) * size,
          y: r.top + r.height * ay - size * 0.92 + (a.dy || 0) * size
        };
      }
    }
    var fx = leg.x != null ? leg.x : START.x, fy = leg.y != null ? leg.y : START.y;
    return { x: fx * window.innerWidth - size / 2, y: fy * window.innerHeight - size / 2 };
  }

  function posAt(p, size) {
    var i = legAt(p);
    var t = subProgress(p, i);
    var e = t * t * (3 - 2 * t);
    var to = pointOf(LEG[i], size, t);
    var from = (i === 0)
      ? { x: START.x * window.innerWidth - size / 2, y: START.y * window.innerHeight - size / 2 }
      : pointOf(LEG[i - 1], size, 1);
    var x = from.x + (to.x - from.x) * e;
    var y = from.y + (to.y - from.y) * e;
    // ★安全域に収める。
    //   ・脚の切り替わりでは直前の相手が画面外へ流れていることがある
    //   ・とまる相手の上辺が固定ヘッダーの裏へスクロールすると、鳥もそこへ潜って見切れる
    //     （実機で発生・2026-07-29）
    var hdr = document.getElementById('hdr');
    var top = (hdr ? hdr.offsetHeight : 0) + 12;
    var m = size * 0.22;
    x = Math.max(-m, Math.min(window.innerWidth - size + m, x));
    y = Math.max(top, Math.min(window.innerHeight - size - 8, y));
    return { x: x, y: y, leg: i, t: t };
  }

  /* ---------------- 生成 ---------------- */
  function create(opts) {
    opts = opts || {};
    var comp = document.getElementById('companion');
    var layers = {
      sky:  document.getElementById('stage-sky'),
      far:  document.getElementById('stage-far'),
      mid:  document.getElementById('stage-mid'),
      near: document.getElementById('stage-near')
    };
    if (!comp || !layers.sky) return null;

    var sp = new SpritePlayer(comp);
    sp.preload();
    var hud = document.getElementById('hud');
    var state = { p: 0, vel: 0, leg: -1, mode: 'loop', live: false, face: 1, lastX: null };

    function skyColor(p) {
      var dark = 0;
      if (p > 0.18 && p < 0.52) dark = Math.min(1, (p - 0.18) / 0.06, (0.52 - p) / 0.06);
      var c1 = [246, 247, 248], c2 = [33, 40, 54];
      return 'rgb(' + c1.map(function (v, i) { return Math.round(v + (c2[i] - v) * dark); }).join(',') + ')';
    }

    // 舞台座標（vw/vh 相対）→ 画面座標。オープニングと共有する
    function toPx(rx, ry) {
      var s = comp.offsetWidth || 180;
      return { x: rx * window.innerWidth - s / 2, y: ry * window.innerHeight - s / 2 };
    }

    function render(p, vel) {
      state.p = p; state.vel = vel;
      var H = window.innerHeight;

      gsap.set(layers.far,  { y: -p * H * 0.15 });
      gsap.set(layers.mid,  { y: -p * H * 0.35 });
      gsap.set(layers.near, { y: -p * H * 0.70 });
      layers.sky.style.setProperty('--sky', skyColor(p));

      if (!state.live) return;      // オープニング中はキャラに触らない

      var size = comp.offsetWidth || 180;
      var pos = posAt(p, size), leg = LEG[pos.leg];

      /* ★顔の向きは「実際の進行方向」で決める。
         素材は左向きに描かれているので、右へ進むときだけ scaleX を反転する。
         クラスで transform を当てても GSAP のインライン transform に負けるので、
         向きも gsap.set でまとめて指定すること（実機で効いていなかった） */
      if (state.lastX != null) {
        var dx = pos.x - state.lastX;
        if (Math.abs(dx) > 2) state.face = dx > 0 ? -1 : 1;   // -1 = 右向き（反転）
      }
      state.lastX = pos.x;

      gsap.set(comp, { x: pos.x, y: pos.y, scaleX: state.face || 1 });
      comp.classList.toggle('is-front', !!leg.front);   // 本文の前へ出るか裏に回るか

      if (pos.leg !== state.leg) {
        state.leg = pos.leg; state.mode = leg.mode;
        sp.play(leg.clip, true);
      }
      if (leg.mode === 'scrub') {
        sp.frameByProgress(pos.t); sp.rate = 0;
      } else {
        var speed = Math.min(1, Math.abs(vel) / 1400);
        if (!reduced && leg.clip !== 'hover') {
          if (speed > 0.25 && sp.name !== 'flap') sp.play('flap', true);
          else if (sp.name === 'flap' && speed < 0.08 && leg.clip !== 'flap') sp.play(leg.clip, true);
        }
        sp.rate = 0.55 + speed * 1.9;
      }

      if (hud) {
        hud.innerHTML =
          '<div><b>progress</b>' + p.toFixed(3) + '</div>' +
          '<div><b>velocity</b>' + Math.round(vel) + '</div>' +
          '<div><b>場面</b>' + leg.label + '</div>' +
          '<div><b>clip</b>' + sp.name + ' [' + leg.mode + ']</div>' +
          '<div><b>frame</b>' + (sp.frameIdx + 1) + ' / ' + (sp.clip ? sp.clip.frames : 0) + '</div>';
      }
    }

    var master = null;
    /* スクロール旅程の主導権を受け取る。オープニング完了時に呼ぶ */
    function start() {
      if (master) return;
      state.live = true;
      master = ST.create({
        trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 1,
        onUpdate: function (s) { render(s.progress, s.getVelocity()); },
        onRefresh: function (s) { render(s.progress, 0); }
      });
      ST.refresh();
      render(master.progress || 0, 0);
    }

    /* ---------- 背景の差分ループ（雲・水面・葉／design.md §8-E） ----------
       [data-loop="cloud|water|leaf"] を持つ要素をフレーム送りする。
       キャラより遅く、常時ゆっくり回す（スクロール速度には連動させない） */
    var BG = { cloud: { frames: 4, fps: 1.6 }, water: { frames: 4, fps: 3 }, leaf: { frames: 4, fps: 2.2 } };
    var loops = [];
    Array.prototype.forEach.call(document.querySelectorAll('[data-loop]'), function (el) {
      var key = el.getAttribute('data-loop'), c = BG[key];
      if (!c) return;
      el.style.backgroundImage = 'url(' + BASE + 'bg_' + key + '.webp)';
      el.style.backgroundSize = (c.frames * 100) + '% 100%';
      el.style.backgroundRepeat = 'no-repeat';
      el.style.backgroundPositionX = '0%';
      loops.push({ el: el, c: c, t: Math.random() });   // 位相をずらして同時に動かない
    });
    function tickLoops(dt) {
      for (var i = 0; i < loops.length; i++) {
        var L = loops[i];
        L.t += dt;
        var f = Math.floor(L.t * L.c.fps) % L.c.frames;
        L.el.style.backgroundPositionX = (f / (L.c.frames - 1)) * 100 + '%';
      }
    }

    if (!reduced) {
      var last = 0;
      gsap.ticker.add(function (time) {
        var dt = last ? Math.min(0.1, time - last) : 0;
        last = time;
        if (state.mode !== 'scrub') sp.tick(dt);
        tickLoops(dt);
      });
    }

    window.addEventListener('resize', function () { ST.refresh(); render(state.p, 0); });

    var api = { sp: sp, render: render, start: start, LEG: LEG, posAt: posAt, calibrate: calibrate,
                state: state, START: START, toPx: toPx, CLIPS: CLIPS, reduced: reduced,
                loops: loops, tickLoops: tickLoops };
    window.__stage = api;
    return api;
  }

  /* 単体ページ（stage.html）は自動起動 */
  function autoBoot() {
    if (!document.body.hasAttribute('data-stage-auto')) return;
    var api = create();
    if (!api) return;
    api.sp.play('idle');
    setTimeout(function () { api.start(); }, 0);
    setTimeout(function () { window.ScrollTrigger.refresh(); }, 400);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoBoot);
  else autoBoot();

  return { create: create, CLIPS: CLIPS, LEG: LEG, START: START, posAt: posAt, BASE: BASE };
})();
