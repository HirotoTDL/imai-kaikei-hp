/* ===================================================================
   companion.js — ページを縦断するカワセミ（design.md §8-D / §8-G）

   ★2026-07-29 再設計。「場面ごとにばらばらに動く」をやめ、
     **1羽が最初から最後まで同じ画面を旅していく** ように組み直した。

   考え方
     ・紙面（Paper）側には「とまり木」＝止まる相手を順番に並べておく
     ・鳥はいまの相手へ向かって飛び、着いたら止まる。相手が変われば飛び立つ
     ・位置は毎フレーム目標へ寄せる（lerp）。相手が変わっても瞬間移動しない
     ・飛ぶ／降りる／止まるでクリップを切り替える
       飛び立つ=takeoff → 移動中=flap → 着地=perch_in（潰れ3段）→ 静止=idle
     ・場面（Scene）に入ったら退場する。あちらにはあちらの鳥がいる

   受け渡し
     ・最初に出るときは、ヒーローの鳥がいた画面位置から始める。
       これで「ヒーローの木から飛び立った同じ鳥」に見える

   素材は枝なし版。枝つきを使うと宙に枝が浮くので、
   未着なら自動で無効化する（豆腐やおかしな絵を出さない）
   =================================================================== */
(function () {
  'use strict';

  var gsap = window.gsap;
  if (!gsap || !window.Scene) return;
  var S = window.Scene;
  var reduced = S.reduced;

  /* 枝なし版クリップ（Codex 第2弾）。未着なら無効化する */
  var NB = {
    perch_in: { file: 'char_kawasemi_perch_in_nb.webp', frames: 5, fps: 16 },
    idle:     { file: 'char_kawasemi_idle_nb.webp',     frames: 8, fps: 6 },
    look:     { file: 'char_kawasemi_look_nb.webp',     frames: 6, fps: 8 },
    turn:     { file: 'char_kawasemi_turn_nb.webp',     frames: 5, fps: 10 },
    takeoff:  { file: 'char_kawasemi_takeoff_nb.webp',  frames: 5, fps: 18 },
    preen:    { file: 'char_kawasemi_preen_nb.webp',    frames: 8, fps: 8 },
    /* 飛翔は元から枝が無いので流用できる */
    flap:     { file: 'char_kawasemi_flap.webp',        frames: 8, fps: 14 }
  };

  /* とまり木。上から順に、画面に入っている最初の1つへ向かう。
     ax/ay = 相手の箱の中での位置（割合）、dx/dy = 鳥の大きさに対する微調整 */
  var PERCHES = [
    { sel: '#sec-worry .entry', ax: .80, ay: 0, rest: 'look',
      label: '相談の入口の角にとまって、こちらを見る' },

    /* ★サービス欄は行組みに変えたので、進捗バー（旧スタック）はもう無い。
       代わりに **いま読んでいる行の上罫に順に降りていく**。
       読み進めるほど鳥が下へ移るので、進捗バーと同じ「動きが読み進みと噛む」感じが残る。
       many:true = 一致する要素のうち、画面に入っている最初のものを相手にする */
    { sel: '#sec-service .svc__row', many: true, ax: .93, ay: 0, rest: 'look',
      label: 'サービスの行を順に渡る' },

    { sel: '#sec-about .about2__fig', ax: .88, ay: 0, rest: 'preen',
      label: '事務所の写真の上で羽づくろい' },
    /* ★カード1枚目の角に置くと、上のリード文（最大34em）に体が重なる
       （実測: 111x62px ぶん文字を隠していた）。
       並びの右端に寄せると、リード文の右端より外側になり重ならない。 */
    { sel: '#sec-team .people2', ax: .97, ay: 0, rest: 'look',
      label: 'スタッフ紹介の右上' },
    { sel: '#sec-access .access__fig', ax: .12, ay: 0, rest: 'idle',
      label: 'アクセスの写真の上' },
    /* ★dx が足りず、**電話番号に体が30px被っていた**（実測）。
       サイトのいちばん大事な導線を隠してはいけない。
       枠の右端に鳥の左端が来る位置（dx=0.5）＋余白でよける。 */
    { sel: '#sec-cta .telblock', ax: 1, ay: 1, dx: .64, rest: 'turn',
      label: '電話番号の隣に降りて、こちらを向く' }
  ];

  var el = document.getElementById('companion');
  if (!el || reduced) { if (el) el.hidden = true; return; }

  /* ★小さい画面では出さない。
     理由は2つ。①画面が狭く、固定で乗る鳥が本文を隠してしまう
     ②枝なし版7クリップで約600KB。実測（Lighthouse・モバイル）で
       キャラのコマ絵だけで946KB あり、表示速度の最大の重しだった。
     大きい画面＝じっくり眺める画面に演出を寄せ、小さい画面は速さを取る。 */
  if (window.innerWidth < 900) { el.hidden = true; return; }

  /* 素材の有無を確認してから起動する */
  var probe = new Image();
  probe.onerror = function () {
    el.hidden = true;
    console.info('[companion] 枝なし版の素材が未着のため、紙面のカワセミは無効。' +
                 ' docs/codex_prompt_v2.md の素材が入ったら自動で有効になります。');
  };
  probe.onload = function () { start(); };
  probe.src = S.BASE + NB.idle.file;

  function start() {
    el.hidden = false;
    var sp = new S.Sprite(el, NB);
    /* ★最初の画面には出ないので、暇になってから読む（合計約600KB） */
    setTimeout(function () {
      sp.preload(['idle', 'perch_in', 'takeoff', 'flap', 'look', 'turn', 'preen']);
    }, 1800);
    sp.play('idle');

    var st = {
      x: null, y: null,          // いまの位置
      face: 1, vis: 0,
      perch: null,               // いま向かっている相手
      mode: 'away',              // away | fly | land | rest
      landT: 0,
      lastX: null
    };
    S.driven.push({ sp: sp, active: function () { return st.vis > 0.04; } });

    function size() { return el.offsetWidth || 150; }
    function safeTop() {
      var h = document.getElementById('hdr');
      return (h ? h.offsetHeight : 0) + 10;
    }

    /* 相手が画面の「読んでいる帯」に入っているか。
       many:true のときは、一致する要素のうち画面に入っている最初のものを返す */
    /* ★とまり木として「使ってよい」条件。
       ★旧: 箱が画面にかすっていれば採用していた。そのため相手が上へ抜けても
         鳥は下の y 制限（ヘッダー直下）に張り付き、**無関係な場所の上に
         留まり続けた**。スクロール中はこの状態が大半で、
         「よく分からない所に浮いている」ように見えていた（ユーザー指摘）。
       ★新: **とまる位置そのものが気持ちよく画面に入っているとき**だけ採用する。
         入っていなければ相手にしない → 鳥は飛び去る（away）。
         「ちゃんと何かにとまっている」か「居ない」かの二択にする。 */
    function perchY(p, r) {
      return r.top + r.height * (p.ay || 0) - size() * 0.94 + (p.dy || 0) * size();
    }
    function fits(r, p) {
      if (!r.width || !r.height) return false;
      if (!p) return !(r.bottom < safeTop() + 40 || r.top > window.innerHeight - 60);
      var y = perchY(p, r);
      /* 上はヘッダーに掛からない位置、下は画面内に収まる位置 */
      return y > safeTop() + 8 && y < window.innerHeight - size() * 0.6;
    }
    function visibleRect(p) {
      if (p.many) {
        var list = document.querySelectorAll(p.sel);
        for (var i = 0; i < list.length; i++) {
          var rr = list[i].getBoundingClientRect();
          if (fits(rr, p)) return rr;
        }
        return null;
      }
      var node = document.querySelector(p.sel);
      if (!node) return null;
      var r = node.getBoundingClientRect();
      return fits(r, p) ? r : null;
    }

    function pick() {
      for (var i = 0; i < PERCHES.length; i++) {
        var r = visibleRect(PERCHES[i]);
        if (r) return { p: PERCHES[i], r: r };
      }
      return null;
    }

    function targetOf(p, r) {
      var s = size();
      var x = r.left + r.width * (p.ax != null ? p.ax : .5) - s / 2 + (p.dx || 0) * s;
      /* ★素材の足は枠の94%の位置にある（build_sprites が足元を94%に揃えている）。
         0.90 だと足が5px下に沈み、罫線から浮いて見えた（実測）。 */
      var y = r.top + r.height * (p.ay || 0) - s * 0.94 + (p.dy || 0) * s;
      /* 横は画面から出さない。★縦は丸めない。
         丸めると「とまっていない位置」に居座ってしまうため、
         そもそも縦が収まらない相手は fits() で弾く方針に変えた。 */
      x = Math.max(6, Math.min(window.innerWidth - s - 6, x));
      return { x: x, y: y };
    }

    /* 着地の潰れ（潰れ→跳ね返り→落ち着く の3段） */
    function squash() {
      gsap.killTweensOf(el, 'scaleY');
      gsap.timeline()
        .to(el, { scaleY: 0.85, duration: 0.08, ease: 'power1.out' })
        .to(el, { scaleY: 1.05, duration: 0.12, ease: 'power1.out' })
        .to(el, { scaleY: 1,    duration: 0.16, ease: 'power1.out' });
    }

    /* 最初に出るとき、ヒーローの鳥が飛び去った場所から始める（受け渡し）。
       ★画面に残っているとは限らない（ヒーローを抜けてから紙面のとまり木まで間がある）。
         opening.js が飛び去った座標を残しておくので、それを使う。
         古すぎる記録は使わない（別の経路で来た人には関係がない） */
    function handoffStart() {
      var h = window.__birdHandoff;
      var now = window.performance ? performance.now() : 0;
      if (h && (!h.at || now - h.at < 20000)) return { x: h.x, y: h.y };
      var hb = document.getElementById('hero-bird');
      if (hb) {
        var r = hb.getBoundingClientRect();
        if (r.width && r.bottom > 0 && r.top < window.innerHeight) return { x: r.left, y: r.top };
      }
      return null;
    }

    function frame() {
      var s = size();
      var got = pick();

      /* --- 相手がいない：飛び去る --- */
      if (!got) {
        if (st.mode !== 'away') {
          st.mode = 'away';
          sp.play('takeoff', true, true);
        }
        st.vis += (0 - st.vis) * 0.14;
        if (st.y != null) st.y -= 6;                 // 上へ抜けていく
        st.perch = null;
        if (st.x != null) gsap.set(el, { x: st.x, y: st.y, opacity: st.vis, scaleX: st.face });
        return;
      }

      var p = got.p, t = targetOf(p, got.r);

      /* --- 初回：受け渡し位置から --- */
      if (st.x == null) {
        var h = handoffStart();
        st.x = h ? h.x : t.x;
        st.y = h ? h.y : (t.y - 120);
        st.mode = 'fly';
        sp.play('flap', true);
      }

      /* --- 相手が変わった：飛び立つ --- */
      if (st.perch !== p) {
        st.perch = p;
        var far = Math.abs(t.x - st.x) + Math.abs(t.y - st.y);
        if (far > 60) { st.mode = 'fly'; sp.play('takeoff', true, true); }
      }

      /* --- 目標へ寄せる --- */
      var dx = t.x - st.x, dy = t.y - st.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var k = dist > 240 ? 0.10 : 0.16;             // 遠いほどゆっくり立ち上がる
      st.x += dx * k;
      st.y += dy * k;

      /* --- 進行方向で顔を向ける（素材は左向き） --- */
      if (st.lastX != null) {
        var mv = st.x - st.lastX;
        if (Math.abs(mv) > 1.2) st.face = mv > 0 ? -1 : 1;
      }
      st.lastX = st.x;

      /* --- 所作の切り替え --- */
      if (st.mode === 'fly') {
        if (sp.name !== 'flap' && (sp.name !== 'takeoff' || sp.done)) sp.play('flap', true);
        if (dist < 14) { st.mode = 'land'; st.landT = 0; sp.play('perch_in', true, true); squash(); }
      } else if (st.mode === 'land') {
        st.landT += 1;
        if (st.landT > 16) { st.mode = 'rest'; sp.play(p.rest || 'idle', true); }
      } else if (st.mode === 'rest') {
        /* 相手の位置が動いた（＝読んでいる行が変わった）なら飛び移る */
        if (dist > 60) { st.mode = 'fly'; sp.play('takeoff', true, true); }
        else if (dist > 18 && sp.name !== 'flap') sp.play('flap', true);
        else if (dist < 6 && sp.name === 'flap') sp.play(p.rest || 'idle', true);
      }

      /* ★とまり木の間を移動している姿が「よく分からない所に浮いている」正体だった
         （ユーザー指摘 2026-07-31）。近くまで来たら現れ、離れたら消える。
         短い移動はそのまま見え、長い移動は消えて次のとまり木で現れる。
         「とまっている姿」しか見せない。 */
      var want = dist < 40 ? 1 : (dist > 240 ? 0 : (240 - dist) / 200);
      st.vis += (want - st.vis) * 0.16;
      gsap.set(el, { x: st.x, y: st.y, opacity: st.vis, scaleX: st.face });
    }

    gsap.ticker.add(frame);
    /* ★検証用の口。
       ヘッドレスのブラウザでは requestAnimationFrame がほとんど発火せず、
       毎フレーム前提のこの状態機械が進まないため、画面を撮っても
       「飛び立った直後」しか写らない（実測で判明）。
       決まった回数だけ手で進められるようにしておく。 */
    window.__companion = {
      st: st, sp: sp, PERCHES: PERCHES,
      step: function (n) {
        for (var i = 0; i < (n || 90); i++) { frame(); sp.tick(1 / 60); }
      }
    };
  }
})();
