/* ===================================================================
   統合トップ — オープニング（§8-A）→ 全編横断ステージ（§8-D）

   ねらい（2026-07-29 ユーザー指示）
     「ヒーローでリッチな据え付けアニメーションを見せ、
       その主人公がHP全体を飛び回ることで“他とは違う”と思わせる」

   継ぎ目を消すための約束
     ・キャラクターは #companion ただ1つ。演出用と旅程用を分けない
     ・オープニングの着地点 ＝ 旅程の起点 p=0（Stage.START を共有）
     ・受け渡しの瞬間、left/top と transform を入れ替えて視覚位置を完全に一致させる
     ・背景は専用パーツではなく「舞台レイヤーそのもの」を出現させる
   =================================================================== */
(function () {
  'use strict';

  var gsap = window.gsap, ST = window.ScrollTrigger;
  if (!gsap || !window.Stage) return;
  if (window.CustomEase) {
    gsap.registerPlugin(window.CustomEase);
    // 参考① "jump" と同性格（上昇 → 中央で停滞 → 再加速）の自前カーブ
    window.CustomEase.create('settle', 'M0,0 C0.10,0.45 0.35,0.55 0.55,0.55 C0.75,0.55 0.92,0.78 1,1');
  }

  var KEY = 'imai:openingPlayed';
  // 既定10秒（登場シーケンスが約6秒あるため）。検証時のみ ?timeout=60000 で延長
  var TIMEOUT_MS = /[?&]timeout=(\d+)/.test(location.search) ? parseInt(RegExp.$1, 10) : 10000;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
             || /[?&]reduced=1/.test(location.search);

  var q = function (s) { return document.querySelector(s); };
  var op = q('#op'), skipBtn = q('#op-skip'), comp = q('#companion');
  var stage = window.Stage.create();
  if (!stage) return;

  var lenis = null, tl = null, timer = null, finished = false;

  /* ---------- Lenis ---------- */
  function initLenis() {
    if (reduced || lenis || !window.Lenis) return;
    lenis = new window.Lenis({ duration: 0.9, lerp: 0.1, smoothWheel: true, smoothTouch: false });
    lenis.on('scroll', function () { ST.update(); });
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
    window.lenis = lenis;
  }

  function prepareBalloonText() {
    var el = q('#balloon-text');
    if (!el || el.querySelector('span')) return;
    el.innerHTML = Array.from(el.textContent).map(function (ch, i) {
      return '<span style="transition-delay:' + (i * 0.02).toFixed(2) + 's">' + ch + '</span>';
    }).join('');
  }

  /* ---------- 全要素を最終状態へ戻す（タイムアウト・スキップ時の取り残し防止） ---------- */
  function revealAll() {
    gsap.set(document.querySelectorAll(
      '#op-logo,#hero-balloon,#op-h1,#op-sub,#op-cta,#hdr'),
      { clearProps: 'all' });
    // ★舞台のパーツは opacity / transform だけ戻す。
    //   'all' で消すと stage.js が差し込んだ背景ループのスプライト指定まで飛ぶ
    gsap.set(document.querySelectorAll('.stage__part'), { clearProps: 'opacity,transform' });
    // 影はオープニング専用（旅程では使わない）
    var sh = q('#companion-shadow');
    if (sh) { gsap.set(sh, { clearProps: 'all' }); sh.style.opacity = '0'; }
    var bt = q('#balloon-text');
    if (bt) { prepareBalloonText(); bt.classList.add('_show'); }
  }

  /* ---------- 旅程の区間を、実際の要素の見え方に合わせて割り当てる ----------
     ★ここが「絡み」の要。とまる相手が画面に居る間だけ、その脚を割り当てる。
       これをしないと、画面外の要素に追従して鳥が画面の外へ飛んでいく（実機で確認） */
  function calibrateJourney() {
    var LEG = stage.LEG;
    var vh = window.innerHeight;
    var max = document.documentElement.scrollHeight - vh;
    if (max <= 0) return;
    var clamp = function (v) { return Math.max(0, Math.min(1, v)); };

    // 1) アンカー要素が「画面に居る」スクロール区間を求める
    //    sticky な要素は自分の位置が動くので、range に親セクションを指定して測る
    var win = LEG.map(function (l) {
      if (!l.anchor) return null;
      var el = q(l.anchor.range || l.anchor.sel);
      if (!el) return null;
      var top = el.getBoundingClientRect().top + window.scrollY;
      var h = el.offsetHeight;
      return { a: clamp((top - vh * 0.88) / max), b: clamp((top + h - vh * 0.12) / max) };
    });

    // 2) 同じ相手にとまり続ける脚はまとめて、その区間の中へ配分する
    var i = 0;
    while (i < LEG.length) {
      if (!win[i]) { i++; continue; }
      var j = i, sel = LEG[i].anchor.sel;
      while (j + 1 < LEG.length && LEG[j + 1].anchor && LEG[j + 1].anchor.sel === sel) j++;
      var a = win[i].a + (win[i].b - win[i].a) * 0.20;
      var b = win[i].a + (win[i].b - win[i].a) * 0.92;
      var group = LEG.slice(i, j + 1);
      var tot = group.reduce(function (s2, l) { return s2 + (l.w || 1); }, 0), acc = 0;
      group.forEach(function (l) { acc += (l.w || 1); l.to = a + (b - a) * (acc / tot); });
      i = j + 1;
    }

    // 3) 相手を持たない脚（飛翔・漁）は、前後の区間の隙間へ重み配分する
    var prev = 0;
    for (var k = 0; k < LEG.length; k++) {
      if (win[k]) { prev = LEG[k].to; continue; }
      var e = k;
      while (e + 1 < LEG.length && !win[e + 1]) e++;
      var next = (e + 1 < LEG.length) ? LEG[e + 1].to : 1.01;
      var seg = LEG.slice(k, e + 1);
      var tot2 = seg.reduce(function (s2, l) { return s2 + (l.w || 1); }, 0), acc2 = 0;
      seg.forEach(function (l) { acc2 += (l.w || 1); l.to = prev + (next - prev) * (acc2 / tot2); });
      prev = LEG[e].to;
      k = e;
    }

    // 4) 単調増加を保証する
    var last = 0;
    LEG.forEach(function (l) { if (l.to <= last) l.to = last + 0.002; last = l.to; });
    LEG[LEG.length - 1].to = Math.max(LEG[LEG.length - 1].to, 1.01);
  }

  /* ---------- 受け渡し ★ここが継ぎ目 ---------- */
  function handoff() {
    // オープニング中は left/top に着地点、transform は 0
    // 旅程中は left/top が 0、transform が位置を持つ
    // 両者の視覚位置が一致するよう入れ替えてから主導権を渡す
    var px = stage.toPx(stage.START.x, stage.START.y);
    comp.style.left = '0px';
    comp.style.top = '0px';
    gsap.set(comp, { x: px.x, y: px.y });
    stage.sp.play('idle', true);
    calibrateJourney();
    stage.start();
    // 画像の遅延読み込みでページ高さが変わるため、落ち着いてから再校正する
    setTimeout(function () { calibrateJourney(); ST.refresh(); }, 800);
    window.addEventListener('resize', function () { calibrateJourney(); });
  }

  function finish() {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    revealAll();
    document.body.classList.remove('is-opening');
    if (op) op.style.display = 'none';
    if (skipBtn) skipBtn.hidden = true;
    try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
    handoff();
    if (lenis) lenis.start();
    ST.refresh();
  }

  /* ---------- オープニング本編 ----------
     キャラクターの登場は6拍で組む（design.md §8-A-2）
       ①遠方から小さく飛来 ②減速して滑空 ③着地点上空で停空（狙いを定める）
       ④降下して枝を掴む（squash & stretch）⑤一拍おく ⑥こちらを向く（顔見せ）
     ------------------------------------------------------------------ */
  function play() {
    var logo = q('#op-logo'),
        parts = gsap.utils.toArray('[data-part]'),
        shadow = q('#companion-shadow'),
        balloon = q('#hero-balloon'), balloonText = q('#balloon-text'),
        h1 = q('#op-h1'), sub = q('#op-sub'), cta = q('#op-cta'), hdr = q('#hdr');

    if (!(op && logo && comp)) { finish(); return; }
    prepareBalloonText();

    // 着地点に要素を据え、そこからの相対移動を MotionPath で描く
    var px = stage.toPx(stage.START.x, stage.START.y);
    comp.style.left = px.x + 'px';
    comp.style.top = px.y + 'px';
    gsap.set(comp, { x: 0, y: 0, transformOrigin: 'center bottom' });
    if (shadow) {
      var sw = comp.offsetWidth || 180;
      shadow.style.left = px.x + 'px';
      shadow.style.top = (px.y + sw * 0.92) + 'px';
      gsap.set(shadow, { scale: 0.35, opacity: 0 });
    }

    // ★画面幅に追従する動的ベジェ。基準幅 268 に対する比率で制御点を持つ（§8-A）
    var W0 = 268, b = window.innerWidth / W0;
    // 遠方（右上の空）から大きな弧を描いて着地点へ降りてくる
    var P = [{ x: 172, y: -46 }, { x: 150, y: 34 }, { x: 74, y: -14 }];
    var path = 'M' + (P[0].x * b) + ',' + (P[0].y * b) +
               ' C' + (P[1].x * b) + ',' + (P[1].y * b) +
               ' ' + (P[2].x * b) + ',' + (P[2].y * b) + ' 0,0';

    var half = window.innerHeight / 2;
    var dir = function (el) { return el.getBoundingClientRect().top < half ? -20 : 20; };

    timer = setTimeout(finish, TIMEOUT_MS);
    tl = gsap.timeline({ defaults: { ease: 'power2.out' }, onComplete: finish });

    /* --- 舞台が立ち上がる --- */
    tl.fromTo(logo, { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: 0.5 }, 0);
    tl.to(op, { opacity: 0, duration: 0.5 }, 0.9);
    // 情景パーツ（山・街・川・木・雲）が乱数順に、位置に応じた向きから入る
    if (parts.length) {
      tl.fromTo(parts, { opacity: 0, y: function (i, t) { return dir(t); } },
        { opacity: 1, y: 0, duration: 0.5, stagger: { each: 0.05, from: 'random' } }, 1.0);
    }

    /* --- ①遠方から飛来（小さく・速い羽ばたき） --- */
    var FLY = 1.9, FLY_DUR = 1.0;
    tl.add(function () { stage.sp.play('flap', true); stage.sp.rate = 2.6; }, FLY);
    tl.fromTo(comp,
      { x: P[0].x * b, y: P[0].y * b, opacity: 0, scale: 0.26, immediateRender: false },
      { motionPath: { path: path }, scale: 1,
        duration: FLY_DUR, ease: (window.CustomEase ? 'settle' : 'power1.out') }, FLY);
    tl.to(comp, { opacity: 1, duration: 0.28, ease: 'power1.out' }, FLY);
    // 影が「近づくほど小さく濃く」なる＝奥行きの手がかり
    if (shadow) {
      tl.to(shadow, { opacity: 0.5, scale: 0.9, duration: FLY_DUR * 0.7, ease: 'none' }, FLY + 0.2);
      tl.to(shadow, { opacity: 0.9, scale: 0.62, duration: 0.5, ease: 'power2.out' }, FLY + FLY_DUR - 0.1);
    }

    /* --- ②減速して滑空 --- */
    tl.add(function () { stage.sp.play('glide', true); stage.sp.rate = 1.2; }, FLY + FLY_DUR * 0.62);

    /* --- ③着地点の上空で停空（狙いを定める一拍） --- */
    var HOVER = FLY + FLY_DUR - 0.06;
    tl.add(function () { stage.sp.play('hover', true); stage.sp.rate = 1.6; }, HOVER);
    tl.to(comp, { y: '-=26', duration: 0.18, ease: 'power2.out' }, HOVER);
    tl.to(comp, { y: '+=26', duration: 0.30, ease: 'power1.in' }, HOVER + 0.34);

    /* --- ④降下して枝を掴む（着地の潰れ） --- */
    var LAND = HOVER + 0.60;
    tl.add(function () { stage.sp.play('perch_in', true, true); stage.sp.rate = 1; }, LAND);
    tl.to(comp, { scaleX: 1.10, scaleY: 0.90, duration: 0.08, ease: 'power1.out' }, LAND);
    tl.to(comp, { scaleX: 1, scaleY: 1, duration: 0.26, ease: 'back.out(2.2)' }, LAND + 0.08);
    if (shadow) tl.to(shadow, { opacity: 0.55, scale: 0.72, duration: 0.26, ease: 'power2.out' }, LAND);

    /* --- ⑤一拍おく（羽をたたんで落ち着く） --- */
    tl.add(function () { stage.sp.play('idle', true); stage.sp.rate = 1; }, LAND + 0.42);

    /* --- ⑥こちらを向く＝主人公の顔見せ --- */
    var TURN = LAND + 0.78;
    tl.add(function () { stage.sp.play('turn', true, true); stage.sp.rate = 1; }, TURN);
    tl.to(comp, { scale: 1.06, duration: 0.16, ease: 'power2.out' }, TURN);
    tl.to(comp, { scale: 1, duration: 0.34, ease: 'back.out(1.8)' }, TURN + 0.16);

    /* --- 吹き出し・コピー --- */
    var TALK = TURN + 0.52;
    tl.fromTo(balloon, { opacity: 0, scale: 0 },
      { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.7)' }, TALK);
    tl.add(function () { if (balloonText) balloonText.classList.add('_show'); }, TALK + 0.2);

    var COPY = TALK + 0.75;
    tl.fromTo(h1,  { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.5 }, COPY);
    tl.fromTo(sub, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5 }, COPY);
    tl.fromTo(cta, { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.5 }, COPY);
    tl.fromTo(hdr, { opacity: 0, y: -15 }, { opacity: 1, y: 0, duration: 0.5 }, COPY);
    if (shadow) tl.to(shadow, { opacity: 0, duration: 0.4, ease: 'power1.out' }, COPY);

    window.__top = { tl: tl, finish: finish, path: path, handoff: handoff,
                     marks: { FLY: FLY, HOVER: HOVER, LAND: LAND, TURN: TURN, TALK: TALK, COPY: COPY } };
  }

  /* ===================================================================
     サービス6領域 — スティッキー・カードスタック（design.md §8-C M2）
     入ったカードは、後続の残り枚数に応じて奥へ押し下げられ続ける
     =================================================================== */
  var SERVICES = [
    { no: '01', label: '— MONTHLY',  ja: '税務顧問',               en: 'Tax Advisory',            txt: '毎月の帳簿チェックから決算・申告まで、丸ごとお任せ。「税務署からの連絡が怖い」——そんな不安から解放されます。' },
    { no: '02', label: '— FAMILY',   ja: '相続税・贈与税対策',     en: 'Inheritance &amp; Gift Tax', txt: '「うちにも相続税がかかるの？」その疑問、まず聞かせてください。ご家族の状況に合わせて、早めの対策をご一緒に考えます。' },
    { no: '03', label: '— LEGACY',   ja: '事業承継支援',           en: 'Business Succession',     txt: '大切に育ててきた事業を、次の世代へ。「いつから準備すればいい？」その段階からお手伝いします。' },
    { no: '04', label: '— STARTUP',  ja: '会社設立・創業支援',     en: 'Incorporation',           txt: '「自分で会社を作りたい」その想い、応援します。届出から融資の相談まで、創業の不安を一つずつ解消していきましょう。' },
    { no: '05', label: '— CLOUD',    ja: 'クラウド会計導入支援',   en: 'Cloud Accounting',        txt: '「パソコンは苦手で…」という方もご安心ください。あなたに合ったソフト選びから使い方まで、丁寧にお教えします。' },
    { no: '06', label: '— ADVISORY', ja: '経営相談・資金繰り支援', en: 'Management Consulting',   txt: '資金繰りの不安、一人で抱えていませんか？数字の読み方から融資の相談まで、経営者のそばで一緒に考えます。' }
  ];

  function buildStack() {
    var m = q('.stack-mount[data-stack]');
    if (!m) return null;
    var cards = SERVICES.map(function (s) {
      return '<article class="stack__card">' +
        '<div class="stack__cardtop"><span class="stack__no">' + s.no + '</span>' +
        '<span class="stack__label">' + s.label + '</span></div>' +
        '<h3 class="stack__h3">' + s.ja + '</h3>' +
        '<span class="stack__en">' + s.en + '</span>' +
        '<p class="stack__txt">' + s.txt + '</p></article>';
    }).join('');
    m.innerHTML = '<section class="stack">' +
      '<div class="stack__vp"><div class="stack__in">' +
        '<div class="stack__head"><div class="stack__headtxt">' +
          '<span class="stack__eyebrow">' + (m.getAttribute('data-eyebrow') || '') + '</span>' +
          '<h2 class="stack__h2">' + (m.getAttribute('data-heading') || '') + '</h2>' +
          '<p class="stack__lead">' + (m.getAttribute('data-lead') || '') + '</p>' +
        '</div><div class="stack__counter">01 / 06</div></div>' +
        '<div class="stack__cards">' + cards + '</div>' +
        '<div class="stack__foot"><div class="stack__track"><div class="stack__bar"></div></div>' +
        '<a class="stack__link" href="services.html">サービス一覧を見る</a></div>' +
      '</div></div></section>';
    return m.querySelector('.stack');
  }

  function stackMotion(root) {
    if (!root) return;
    var cards = Array.prototype.slice.call(root.querySelectorAll('.stack__card'));
    var counter = root.querySelector('.stack__counter');
    var bar = root.querySelector('.stack__bar');
    cards.forEach(function (c, i) { c.style.zIndex = String(i + 1); });

    if (reduced) {
      root.classList.add('is-static');
      if (counter) counter.textContent = '06 / 06';
      if (bar) bar.style.transform = 'scaleX(1)';
      return;
    }
    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: root, start: 'top top', end: 'bottom bottom', scrub: 1, invalidateOnRefresh: true,
        onUpdate: function (s) {
          if (!counter) return;
          var n = Math.min(cards.length, 1 + Math.floor(s.progress * cards.length * 0.999));
          counter.textContent = String(n).padStart(2, '0') + ' / 06';
        }
      }
    });
    cards.slice(1).forEach(function (c, i) {
      gsap.set(c, { y: '110vh', rotate: 16, scale: 1.08, opacity: 0 });
      tl.to(c, { y: 0, rotate: 0, scale: 1, opacity: 1,
                 ease: (window.CustomEase ? 'settle' : 'power2.out'), duration: 1 }, i);
      // ★入った後も、後続の残り枚数に応じて奥へ押し下げられ続ける（これが無いと積み上がらない）
      var rest = cards.length - 1 - i;
      if (rest > 0) {
        tl.to(cards[i], { yPercent: -3 * rest, scale: 1 - 0.03 * rest, ease: 'none',
                          duration: rest }, i + 1);
      }
    });
    if (bar) tl.to(bar, { scaleX: 1, ease: 'none', duration: cards.length - 1 }, 0);
  }

  /* ---------- ドロワー（SP） ---------- */
  function initDrawer() {
    var drawer = q('#drawer'), burger = q('#hamburger'), close = q('#drawer-close');
    if (!drawer || !burger) return;
    function open() {
      drawer.hidden = false;
      burger.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      if (lenis) lenis.stop();
      var f = drawer.querySelector('button,a'); if (f) f.focus();
    }
    function shut() {
      if (drawer.hidden) return;
      drawer.hidden = true;
      burger.setAttribute('aria-expanded', 'false');
      burger.focus();
      document.body.style.overflow = '';
      if (lenis && finished) lenis.start();
    }
    burger.addEventListener('click', function () { drawer.hidden ? open() : shut(); });
    if (close) close.addEventListener('click', shut);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') shut(); });
  }

  /* ---------- 起動 ---------- */
  function boot() {
    initDrawer();
    var stackRoot = buildStack();
    stackMotion(stackRoot);
    initLenis();
    if (lenis) lenis.stop();

    if (skipBtn) skipBtn.addEventListener('click', function () {
      if (tl) tl.kill();
      finish();
    });
    var dev = q('#dev-replay');
    if (dev) dev.addEventListener('click', function () {
      try { sessionStorage.removeItem(KEY); } catch (e) {}
      location.reload();
    });

    var played = false;
    try { played = sessionStorage.getItem(KEY) === '1'; } catch (e) {}

    // 再生しない場合も、必ず handoff() を通して旅程へ入る
    if (reduced || played) { finish(); return; }

    // ★開始は早めに。'load' を待つと、回線が細いとき舞台の出現が数秒遅れ、
    //   そのまま LCP の悪化になる（Lighthouse で描画待ち93%と計測）
    var started = false;
    var go = function () { if (started) return; started = true; setTimeout(play, 0); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(go).catch(go);
    if (document.readyState === 'complete') go();
    setTimeout(go, 400);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
