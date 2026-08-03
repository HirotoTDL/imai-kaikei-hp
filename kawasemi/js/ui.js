/* ===================================================================
   ui.js — ページ全体に効く土台の挙動（design.md §8-F）

   ここが受け持つのは「どのページでも同じように効くこと」だけ。
   場面ごとの演出は scene.js / cards.js / companion.js が持つ。

     ① 読み進めに合わせて中身を立ち上げる（出現演出）
     ② 濃い面に重なっている間、ヘッダーを反転する
     ③ いま読んでいる場所をグローバルナビに返す

   ★①は GSAP に依存させない（スクロール判定 ＋ CSS遷移）。
     下層ページは GSAP を読み込まないため、依存させると効かない。
     IntersectionObserver も使わない（発火しないことがあり、本文が消える）。
   ★隠す指定は **JSが動いたときだけ** CSSに効かせる。
     静的CSSで隠すと、JSが落ちた瞬間に本文が出ないページになる。
   =================================================================== */
(function () {
  'use strict';

  var ST = window.ScrollTrigger;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
             || /[?&]reduced=1/.test(location.search);
  var root = document.documentElement;

  /* ---------------- ① 出現演出 ---------------- */
  /* 対象は「読み物の単位」。見出し・段落の塊・カード・表の行 */
  /* ★実際に使われている class から作る（当て推量にしない）。
     下層ページは .block / .subhead / .office-table .row / .pcta__in が本体で、
     以前の一覧はトップの class ばかりだったため下層ではほぼ効いていなかった */
  var RV = [
    /* トップ */
    '.sect__head', '.qa2__row', '.entry', '.about2__txt', '.about2__fig',
    '.person2', '.access__fig', '.access__map',
    '.sect__in > .h2', '.sect__in > .lead', '.sect__in > .link-under',
    /* 下層 */
    '.block', '.subhead', '.office-table .row', '.pcta__in > *',
    '.ulist > li', '.faq__item', '.form__row', '.card', '.pillar'
  ].join(',');

  /* ★IntersectionObserver は使わない。
     実測で「1件も発火せず、本文14要素が opacity:0 のまま」になった（2026-07-29）。
     本文を隠す仕掛けは、**自分で確実に解除できる方法**でしか作ってはいけない。
     ここではスクロールと rAF で自前に判定する（要素は出したら監視から外すので軽い）。
     さらに保険として、2.5秒経ったら理由を問わず全部出す。 */
  function initReveal() {
    if (reduced) return;
    var nodes = [];
    Array.prototype.forEach.call(document.querySelectorAll(RV), function (el) {
      /* 場面（Scene）の中と、オープニングが面倒を見る要素は触らない */
      if (el.closest('.scene') || el.closest('.op')) return;
      if (['op-h1', 'op-sub', 'op-cta'].indexOf(el.id) !== -1) return;
      if (nodes.indexOf(el) === -1) nodes.push(el);
    });
    if (!nodes.length) return;

    root.classList.add('rv-ready');          // ここで初めてCSSの初期状態が効く
    nodes.forEach(function (el, i) {
      el.setAttribute('data-rv', '');
      /* 同じ塊の中は少しずつ遅らせる。塊をまたぐと遅れが溜まるので、
         親ごとに数え直す */
      var sibs = el.parentNode ? el.parentNode.querySelectorAll('[data-rv]') : null;
      var idx = 0;
      if (sibs) for (var k = 0; k < sibs.length; k++) if (sibs[k] === el) { idx = k; break; }
      el.style.transitionDelay = Math.min(idx, 5) * 0.07 + 's';
    });

    var pending = nodes.slice();
    var queued = false;

    function show(el) {
      el.classList.add('_in');
      setTimeout(function () {          // 出し終えたら初期状態の指定を外す
        el.removeAttribute('data-rv');
        el.style.transitionDelay = '';
        el.style.willChange = '';
      }, 1400);
    }

    function check() {
      queued = false;
      var h = window.innerHeight, rest = [];
      for (var i = 0; i < pending.length; i++) {
        var r = pending[i].getBoundingClientRect();
        /* 画面の下から12%入ったら出す。すでに上に抜けているものも出す */
        if (r.top < h * 0.88 && r.bottom > 0) show(pending[i]);
        else if (r.bottom <= 0) show(pending[i]);
        else rest.push(pending[i]);
      }
      pending = rest;
      if (!pending.length) {
        window.removeEventListener('scroll', queue);
        window.removeEventListener('resize', queue);
      }
    }
    function queue() {
      if (queued || !pending.length) return;
      queued = true;
      window.requestAnimationFrame(check);
    }

    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    window.__revealCheck = queue;       // Lenis からも呼べるようにしておく
    check();

    /* ★保険：どんな理由でも 2.5 秒後には全部出す。
       本文が出ないページになるくらいなら、演出は捨てる */
    setTimeout(function () {
      pending.forEach(show);
      pending = [];
    }, 2500);
  }

  /* ---------------- ①-2 写真に視差を与える ----------------
     紙面が「ただ流れていく」だけにならないよう、写真だけ少し遅れて動かす。
     ★動かすのは transform だけ（レイアウトを触らない）。
       量は控えめに。大きく動かすと、写真の枠と中身がずれて見えて安っぽくなる */
  var PX = ['.about2__fig img', '.access__fig img', '.person2__img',
            '.phead__fig img', '.block figure img'].join(',');

  function initParallax() {
    if (reduced) return;
    if (!window.matchMedia('(min-width:768px)').matches) return;
    var nodes = Array.prototype.slice.call(document.querySelectorAll(PX));
    if (!nodes.length) return;
    nodes.forEach(function (n) { n.style.willChange = 'transform'; });

    var queued = false;
    function apply() {
      queued = false;
      var h = window.innerHeight, mid = h / 2;
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i], r = el.getBoundingClientRect();
        if (r.bottom < -100 || r.top > h + 100) continue;
        var c = r.top + r.height / 2;
        var p = Math.max(-1, Math.min(1, (mid - c) / h));   // -1〜1
        el.style.transform = 'translate3d(0,' + (p * 18).toFixed(1) + 'px,0)';
      }
    }
    function queue() {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(apply);
    }
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    /* ★検証用：rAF を待たず同期で反映できる口（ヘッドレスでは rAF がほぼ発火しない） */
    window.__parallax = apply;
    apply();
  }

  /* ---------------- ② 濃い面の上ではヘッダーを反転 ---------------- */
  function initHeaderTheme() {
    var hdr = document.getElementById('hdr');
    if (!hdr) return;
    var darks = document.querySelectorAll('.sect--ink,.stack,[data-dark]');
    if (!darks.length) return;

    var ticking = false;
    function check() {
      ticking = false;
      var line = hdr.offsetHeight * 0.6;
      var on = false;
      for (var i = 0; i < darks.length; i++) {
        var r = darks[i].getBoundingClientRect();
        if (r.top <= line && r.bottom >= line) { on = true; break; }
      }
      hdr.classList.toggle('_on_dark', on);
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(check);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    check();
    /* Lenis は独自にスクロールを回すので、そちらからも呼ばれるようにする */
    window.__hdrThemeCheck = onScroll;
    /* ★検証用：rAF を待たず同期で判定する口（ヘッドレスでは rAF がほぼ発火せず、
       撮影が遷移の途中を捉えてしまう） */
    window.__hdrTheme = check;
  }

  /* ---------------- ②-2 ドロワーを開いている間、背後を触れなくする ----------------
     ★実測: ドロワーを開いた状態で、背後の35要素にフォーカスが移れた。
       キーボードで送っていくと、覆いの裏にある見えない要素へ飛んでしまう。
     ドロワーの開閉は opening.js（トップ）と page.js（下層）が別々に持っているので、
     ここでは **hidden 属性の変化を見張って** 一箇所で面倒を見る。
     どちらが開けても効くし、実装が増えても追随する。 */
  function initDrawerInert() {
    var drawer = document.getElementById('drawer');
    if (!drawer || !('MutationObserver' in window)) return;
    var others = [document.getElementById('hdr'), document.getElementById('main'),
                  document.querySelector('.ftr'), document.querySelector('.skip-link')]
                 .filter(Boolean);
    var supported = 'inert' in HTMLElement.prototype;

    function apply() {
      var open = !drawer.hidden;
      others.forEach(function (el) {
        if (supported) el.inert = open;
        /* inert が無いブラウザ向けの保険。読み上げからも外す */
        if (open) el.setAttribute('aria-hidden', 'true');
        else el.removeAttribute('aria-hidden');
      });
      /* ★閉じたあとの行き先をここで決める。
         開閉側（opening.js / page.js）は閉じた直後に burger.focus() を呼ぶが、
         **その時点ではヘッダーがまだ inert** なので焦点が入らず、
         焦点が「隠れたドロワーの中の閉じるボタン」に取り残されていた（実測）。
         この見張りは inert を外したあとに走るので、ここで戻すのが正しい順序。
         キーボードで閉じた人が、開く前の場所に戻れるようにする。 */
      if (!open) {
        var ae = document.activeElement;
        if (!ae || ae === document.body || drawer.contains(ae)) {
          var burger = document.getElementById('hamburger');
          if (burger && burger.offsetParent !== null) burger.focus();
        }
      }
    }
    new MutationObserver(apply).observe(drawer, { attributes: true, attributeFilter: ['hidden'] });
    apply();
  }

  /* ---------------- ③ 現在地をナビに返す ---------------- */
  function initNavState() {
    var links = document.querySelectorAll('.gnav a[href]');
    if (!links.length) return;
    var here = location.pathname.split('/').pop() || 'index.html';
    Array.prototype.forEach.call(links, function (a) {
      var href = (a.getAttribute('href') || '').split('#')[0];
      if (href && href === here) {
        a.classList.add('_here');
        a.setAttribute('aria-current', 'page');
      }
    });
  }

  function boot() {
    initReveal();
    initParallax();
    initHeaderTheme();
    initDrawerInert();
    initNavState();
    if (ST) setTimeout(function () { ST.refresh(); }, 350);
  }

  /* ★rAF に依存させない（非描画状態だと初期化ごと止まる） */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
