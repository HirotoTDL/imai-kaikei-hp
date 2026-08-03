/* ===================================================================
   opening.js — ヒーロー場面のオープニング（design.md §8-A / §8-A-2）

   ★2026-07-29 再設計版。
     カワセミはヒーロー「セクションの中」に閉じている（position:absolute）。
     固定レイヤーを使わないので、ヘッダーへの潜り込みも画面外への飛び出しも起きない。

   登場は6拍で組む
     ①遠方から飛来 ②減速して滑空 ③着地点の上で停空 ④枝を掴む ⑤一拍おく ⑥こちらを向く
   安全策: 初回のみ再生 / 8秒タイムアウト / reduced-motion スキップ / スキップボタン
   =================================================================== */
(function () {
  'use strict';

  var gsap = window.gsap;
  /* ★ライブラリが届かないときは、その場で幕の状態を解いてから抜ける。
     解かずに抜けると body.is-opening が残り、
     **ヘッダーとキーコピーとリード文が opacity:0 のまま**になる。
     HTML側の安全網（3秒）が外すまで、いちばん見せたいものが3秒間見えなかった
     （実測 2026-07-30・CDN不通の検証ページ）。 */
  if (!gsap || !window.Scene) {
    document.body.classList.remove('is-opening');
    var op0 = document.getElementById('op');
    if (op0) op0.style.display = 'none';
    var sk0 = document.getElementById('op-skip');
    if (sk0) sk0.hidden = true;
    return;
  }
  if (window.CustomEase) {
    gsap.registerPlugin(window.CustomEase);
    window.CustomEase.create('settle', 'M0,0 C0.10,0.45 0.35,0.55 0.55,0.55 C0.75,0.55 0.92,0.78 1,1');
  }

  var KEY = 'imai:openingPlayed';
  var TIMEOUT_MS = /[?&]timeout=(\d+)/.test(location.search) ? parseInt(RegExp.$1, 10) : 9000;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
             || /[?&]reduced=1/.test(location.search);
  var q = function (s) { return document.querySelector(s); };

  var scene = window.Scene.init();
  var hero = scene.hero;
  if (!hero) return;

  var op = q('#op'), skipBtn = q('#op-skip');
  var bird = hero.bird, root = hero.root, sp = hero.sp;
  var tl = null, timer = null, finished = false, lenis = null;

  /* とまり位置。
     ★宙に浮かせない。**ヒーローの木（.p--tree）の樹冠に足を置く**。
       素材に枝が入っているので、木の枝にとまった絵として成立する。
       木が無いときだけ割合で置く（保険） */
  var PERCH = { x: 0.78, y: 0.60 };

  function perchPx() {
    var size = bird.offsetWidth || 170;
    var tree = root.querySelector('.p--tree');
    if (tree && tree.offsetWidth) {
      var r = tree.getBoundingClientRect(), rr = root.getBoundingClientRect();
      return {
        x: (r.left - rr.left) + r.width * 0.54 - size / 2,
        y: (r.top - rr.top) + r.height * 0.30 - size * 0.34,
        size: size
      };
    }
    return { x: PERCH.x * root.clientWidth - size / 2,
             y: PERCH.y * root.clientHeight - size / 2, size: size };
  }

  /* ★慣性スクロールは「指で触らない大きな画面」だけに入れる。
     触って動かす端末では、指の動きとずれて操作感が悪くなる。
     参考サイトも PC 判定＋reduced 判定で切っている（実装を確認済み） */
  function initLenis() {
    var pointerFine = window.matchMedia('(hover:hover) and (pointer:fine)').matches;
    var wide = window.innerWidth >= 1024;
    if (reduced || lenis || !window.Lenis || !pointerFine || !wide) return;
    lenis = new window.Lenis({ duration: 0.9, lerp: 0.1, smoothWheel: true, smoothTouch: false });
    lenis.on('scroll', function () {
      window.ScrollTrigger.update();
      if (window.__hdrThemeCheck) window.__hdrThemeCheck();   // ヘッダー反転も追従させる
      if (window.__revealCheck) window.__revealCheck();       // 出現演出も追従させる
    });
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
    window.lenis = lenis;
  }

  /* hold=true のときだけ「隠した状態」で用意する。
     アニメを再生しない経路（スキップ・2回目・reduced）では隠さない＝空カプセル防止 */
  function prepareBalloon(hold) {
    var el = q('#balloon-text');
    if (!el) return;
    if (hold) el.classList.add('_hold');
    if (el.querySelector('span')) return;
    el.innerHTML = Array.from(el.textContent).map(function (ch, i) {
      return '<span style="transition-delay:' + (i * 0.02).toFixed(2) + 's">' + ch + '</span>';
    }).join('');
  }

  /* 取り残し防止：どの経路で終わっても必ず最終状態にする */
  function revealAll() {
    /* ★CSS が隠していない画面幅（＝登場演出をやらない小さい画面）では、何も戻さない。
       戻す必要が無いのに JS で触ると、**ヒーローの絵が描き直しになり
       LCP がその時刻（＝スクリプトが届いた時刻）まで後ろへずれる**。
       実測: 画面自体は 375ms に描き終わっているのに、LCP が 5.3 秒と記録されていた。 */
    if (window.innerWidth >= 900) {
      gsap.set(document.querySelectorAll('#op-logo,#hero-balloon,#op-h1,#op-sub,#op-cta,#hdr'),
        { clearProps: 'all' });
      /* ★場面のパーツ（雲・葉）は背景画像を JS で入れている。
         ここで clearProps:'all' をかけると**その背景ごと消え、情景が真っ白になる**。
         2回目以降の訪問は即 finish() なので、雲と木が毎回消えていた（2026-07-29 実測）。
         消してよいのは登場アニメが触った分だけ */
      gsap.set(document.querySelectorAll('.scene__part'), { clearProps: 'opacity,transform' });
    }
    var p = perchPx();
    gsap.set(bird, { clearProps: 'all' });
    bird.style.left = p.x + 'px';
    bird.style.top = p.y + 'px';
    gsap.set(bird, { x: 0, y: 0, opacity: 1 });
    sp.play('idle', true);
    var bt = q('#balloon-text');
    if (bt) { prepareBalloon(false); bt.classList.add('_show'); }
  }

  function finish() {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    /* ★登場のタイムラインを必ず止める。
       止めないと、スキップやタイムアウトで finish() に入ったあとも登場アニメが
       走り続け、**離陸したはずの鳥をヒーローへ描き戻してしまう**（実測）。
       スキップボタンの経路だけ kill していたのが穴だった。 */
    if (tl) { tl.kill(); tl = null; }
    gsap.killTweensOf(bird);
    revealAll();
    document.body.classList.remove('is-opening');
    if (op) op.style.display = 'none';
    if (skipBtn) skipBtn.hidden = true;
    try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
    if (lenis) lenis.start();
    window.ScrollTrigger.refresh();
    initHeroExit();
  }

  /* ★ヒーローを出るとき、鳥は「消える」のではなく「飛び立つ」。
     この位置を companion.js が引き継ぐので、1羽がページを旅していくように見える。

     ★真偽値＋トゥイーンで組んではいけない。ScrollTrigger が再計算（refresh）すると
       進捗が一瞬 0 に戻り、飛び立ったはずの鳥がヒーローへ戻ってしまう（実測）。
       進捗から位置を直接決める（状態を持たない）と、巻き戻しても常に正しい。 */
  var EXIT_FROM = 0.34, EXIT_TO = 0.72;
  function initHeroExit() {
    if (reduced || !window.ScrollTrigger) return;
    var flying = false, handoffDone = false;
    window.ScrollTrigger.create({
      trigger: root, start: 'top top', end: 'bottom top',
      invalidateOnRefresh: true,
      onUpdate: function (s) {
        var t = (s.progress - EXIT_FROM) / (EXIT_TO - EXIT_FROM);
        t = Math.max(0, Math.min(1, t));
        var e = t * t;                       // 加速して抜けていく
        gsap.set(bird, {
          x: 190 * e, y: -240 * e, scale: 1 - 0.2 * e, opacity: 1 - e
        });
        if (t > 0.02 && !flying) { flying = true; sp.play('takeoff', true, true); }
        if (t <= 0.02 && flying) { flying = false; sp.play('idle', true); }
        /* 飛び去った位置を残す。次に紙面のカワセミが出るとき、ここから始める。
           ★更新し続けてはいけない。スクロールするほど記録が画面外へ遠ざかり、
             紙面のカワセミが遥か上空から延々と降りてくることになる（実測）。
             「見えなくなった時点」の位置を1回だけ残し、画面のすぐ上に丸める */
        if (t > 0.3 && !handoffDone) {
          handoffDone = true;
          var r = bird.getBoundingClientRect();
          window.__birdHandoff = {
            x: Math.max(8, Math.min(window.innerWidth - 8, r.left)),
            y: Math.max(-140, r.top),
            at: (window.performance ? performance.now() : 0)
          };
        }
        if (t < 0.05) handoffDone = false;
      }
    });
  }

  function play() {
    var logo = q('#op-logo'),
        parts = gsap.utils.toArray('[data-scene="hero"] .scene__part'),
        balloon = q('#hero-balloon'), balloonText = q('#balloon-text'),
        h1 = q('#op-h1'), sub = q('#op-sub'), cta = q('#op-cta'), hdr = q('#hdr');

    if (!(op && logo && bird)) { finish(); return; }
    prepareBalloon(true);

    /* ★とまり位置は left/top に置き、そこからの相対移動を transform で描く。
       motionPath の relative は再生位置を触ると当てにならない（実測で確認） */
    var p0 = perchPx();
    bird.style.left = p0.x + 'px';
    bird.style.top = p0.y + 'px';
    gsap.set(bird, { x: 0, y: 0, transformOrigin: 'center bottom' });

    // 画面幅に追従する動的ベジェ。右上の空から弧を描いて降りてくる
    var b = root.clientWidth / 268;
    var P = [{ x: 172, y: -46 }, { x: 150, y: 34 }, { x: 74, y: -14 }];
    var path = 'M' + (P[0].x * b) + ',' + (P[0].y * b) +
               ' C' + (P[1].x * b) + ',' + (P[1].y * b) +
               ' ' + (P[2].x * b) + ',' + (P[2].y * b) + ' 0,0';

    var half = root.clientHeight / 2;
    var dir = function (el) {
      var r = el.getBoundingClientRect(), rr = root.getBoundingClientRect();
      return (r.top - rr.top) < half ? -18 : 18;
    };

    /* ★opat（検証用の停止再生）のときは保険のタイマーを張らない。
       ヘッドレスは仮想時間で早送りするので9秒があっという間に来てしまい、
       止めて組んだタイムラインごと finish() に片付けられて、
       結局どの秒を指定しても完了後の絵しか撮れなかった（実測）。 */
    if (AT == null) timer = setTimeout(finish, TIMEOUT_MS);
    /* ★検証用の口: ?opat=秒 を付けると、**止めた状態で組んで**その時刻で待つ。
       これが無いと登場の途中を撮れない。ヘッドレスは仮想時間で早送りするため、
       撮る準備ができた頃には走り終わっており、finish() がタイムラインを捨てたあとになる
       （実測: どの秒を指定しても完了後の絵しか撮れなかった）。 */
    var AT = /[?&]opat=([\d.]+)/.test(location.search) ? parseFloat(RegExp.$1) : null;
    tl = gsap.timeline({ defaults: { ease: 'power2.out' },
                         paused: AT != null,
                         onComplete: (AT != null ? null : finish) });

    tl.fromTo(logo, { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: 0.5 }, 0);
    tl.to(op, { opacity: 0, duration: 0.5 }, 0.9);
    if (parts.length) {
      tl.fromTo(parts, { opacity: 0, y: function (i, t) { return dir(t); } },
        { opacity: 1, y: 0, duration: 0.5, stagger: { each: 0.05, from: 'random' } }, 1.0);
    }

    // ① 遠方から飛来
    var FLY = 1.9, DUR = 1.0;
    tl.add(function () { sp.play('flap', true); sp.rate = 2.6; }, FLY);
    tl.fromTo(bird, { x: P[0].x * b, y: P[0].y * b, opacity: 0, scale: 0.26, immediateRender: false },
      { motionPath: { path: path }, scale: 1, duration: DUR,
        ease: (window.CustomEase ? 'settle' : 'power1.out') }, FLY);
    tl.to(bird, { opacity: 1, duration: 0.28, ease: 'power1.out' }, FLY);

    // ② 減速して滑空
    tl.add(function () { sp.play('glide', true); sp.rate = 1.2; }, FLY + DUR * 0.62);

    // ③ とまる位置の上で停空（狙いを定める一拍）
    var HOVER = FLY + DUR - 0.06;
    tl.add(function () { sp.play('hover', true); sp.rate = 1.6; }, HOVER);
    tl.to(bird, { y: '-=24', duration: 0.18, ease: 'power2.out' }, HOVER);
    tl.to(bird, { y: '+=24', duration: 0.30, ease: 'power1.in' }, HOVER + 0.34);

    /* ④ 枝を掴む（着地の潰れ）
       ★潰れ→戻しの2段では固い。**潰れ→跳ね返り→落ち着く の3段**にすると
         重さのある生き物に見える（参考サイトの着地も同じ3段構成だった） */
    var LAND = HOVER + 0.60;
    tl.add(function () { sp.play('perch_in', true, true); sp.rate = 1; }, LAND);
    tl.to(bird, { scaleX: 1.15, scaleY: 0.85, duration: 0.08, ease: 'power1.out' }, LAND);
    tl.to(bird, { scaleX: 0.95, scaleY: 1.05, duration: 0.12, ease: 'power1.out' }, LAND + 0.08);
    tl.to(bird, { scaleX: 1, scaleY: 1, duration: 0.16, ease: 'power1.out' }, LAND + 0.20);

    // ⑤ 一拍おく
    tl.add(function () { sp.play('idle', true); sp.rate = 1; }, LAND + 0.42);

    // ⑥ こちらを向く
    var TURN = LAND + 0.78;
    tl.add(function () { sp.play('turn', true, true); sp.rate = 1; }, TURN);
    tl.to(bird, { scale: 1.06, duration: 0.16, ease: 'power2.out' }, TURN);
    tl.to(bird, { scale: 1, duration: 0.34, ease: 'back.out(1.8)' }, TURN + 0.16);

    // 吹き出し・コピー
    var TALK = TURN + 0.52;
    tl.fromTo(balloon, { opacity: 0, scale: 0 },
      { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.7)' }, TALK);
    tl.add(function () { if (balloonText) balloonText.classList.add('_show'); }, TALK + 0.2);

    /* ★本文は演出の完了を待たない。
       全長5.94秒のうち最初の5.4秒はヘッダーも電話番号もキーコピーも
       画面に無く、電話が主な入口の事務所サイトとしては長すぎた（ユーザー判断）。
       カワセミの飛来はそのまま見せつつ、本文は3秒で先に差し込む。 */
    var COPY = 3.0;
    tl.fromTo(h1,  { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.5 }, COPY);
    tl.fromTo(sub, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5 }, COPY);
    tl.fromTo(cta, { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.5 }, COPY);
    tl.fromTo(hdr, { opacity: 0, y: -15 }, { opacity: 1, y: 0, duration: 0.5 }, COPY);
    /* ★本文が出たらスキップは引っ込める。
       役目は「待たされる人の逃げ道」なので、本文が読める時点で終わり。
       出したままだとヘッダーの「お問い合わせ」と重なるので、ヘッダーが現れる直前に消す（実測）。 */
    tl.add(function () { if (skipBtn) skipBtn.hidden = true; }, Math.max(0, COPY - 0.05));

    if (AT != null) { tl.time(AT); }          // 止めたまま、その時刻の絵にしておく

    window.__opening = { tl: tl, finish: finish, path: path, perchPx: perchPx };
  }

  /* ★幕（.op）は画面全体を覆う。つまり **幕が消えるまで何も描画されない**。
     実測（Lighthouse・モバイル）で LCP が 7.4 秒まで悪化していた原因はこれ。
     小さい画面や細い回線では登場演出をやらず、すぐ本文を出す。
     もともと6拍の飛来は「大きな画面で見る第一印象」として設計したもので、
     スマホでは間が持たない。演出を捨てるのではなく、置き場所を選ぶ。 */
  function skipIntro() {
    if (/[?&]intro=1/.test(location.search)) return false;   // 検証用に強制再生
    if (window.innerWidth < 900) return true;
    var c = navigator.connection;
    if (c) {
      if (c.saveData) return true;
      if (/(^|-)2g$/.test(c.effectiveType || '')) return true;
      if (c.effectiveType === '3g') return true;
    }
    return false;
  }

  /* ---------------- ドロワー（SP） ---------------- */
  function initDrawer() {
    var drawer = q('#drawer'), burger = q('#hamburger'), close = q('#drawer-close');
    if (!drawer || !burger) return;
    function open() {
      drawer.hidden = false; burger.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden'; if (lenis) lenis.stop();
      var f = drawer.querySelector('button,a'); if (f) f.focus();
    }
    function shut() {
      if (drawer.hidden) return;
      drawer.hidden = true; burger.setAttribute('aria-expanded', 'false'); burger.focus();
      document.body.style.overflow = ''; if (lenis && finished) lenis.start();
    }
    burger.addEventListener('click', function () { drawer.hidden ? open() : shut(); });
    if (close) close.addEventListener('click', shut);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') shut(); });
  }

  function boot() {
    initDrawer();
    initLenis();
    if (lenis) lenis.stop();

    if (skipBtn) skipBtn.addEventListener('click', function () { if (tl) tl.kill(); finish(); });

    var played = false;
    try { played = sessionStorage.getItem(KEY) === '1'; } catch (e) {}
    if (reduced || played || skipIntro()) { finish(); return; }

    var started = false;
    var go = function () { if (started) return; started = true; setTimeout(play, 0); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(go).catch(go);
    if (document.readyState === 'complete') go();
    setTimeout(go, 400);

    window.addEventListener('resize', function () {
      if (!finished) return;
      var p = perchPx();
      bird.style.left = p.x + 'px';
      bird.style.top = p.y + 'px';
      gsap.set(bird, { x: 0, y: 0 });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
