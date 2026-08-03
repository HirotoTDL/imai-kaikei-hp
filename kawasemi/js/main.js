/* ===================================================================
   今井会計事務所 リニューアル — トップページ 3案
   Claude Design プロトタイプの DCLogic を素の JS に移植したもの

   モーション実装（design.md §8-1）
     M1 Lenis 慣性スクロール（duration .9 / lerp .1 / smoothTouch なし）
     M2 スティッキー・カードスタック（y70vh → rotate8 → scale1.04 をスクラブ）
     M3 見出しの文字分割リビール（stagger .035）
     M4 in-view リビール（once / 初期表示域は即可視）
     M8 ヒーロー画像 scale(1.08) → 1.0 スクラブ
   prefers-reduced-motion: reduce のときは Lenis を初期化せず、
   カードスタックを通常の縦積みへ切り替える（§8-3）
   =================================================================== */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var gsap = window.gsap;
  var ST = window.ScrollTrigger;
  var hasGsap = !!(gsap && ST);
  if (hasGsap) gsap.registerPlugin(ST);

  var triggers = [];   // このターンで作った ScrollTrigger
  var lenis = null;

  /* ---------------------------------------------------------------
     ServiceStack（dc-import の実体）
     --------------------------------------------------------------- */
  var SERVICES = [
    { no: '01', label: '— MONTHLY',  ja: '税務顧問',              en: 'Tax Advisory',            txt: '毎月の帳簿チェックから決算・申告まで、丸ごとお任せ。「税務署からの連絡が怖い」——そんな不安から解放されます。' },
    { no: '02', label: '— FAMILY',   ja: '相続税・贈与税対策',    en: 'Inheritance &amp; Gift Tax', txt: '「うちにも相続税がかかるの？」その疑問、まず聞かせてください。ご家族の状況に合わせて、早めの対策をご一緒に考えます。' },
    { no: '03', label: '— LEGACY',   ja: '事業承継支援',          en: 'Business Succession',     txt: '大切に育ててきた事業を、次の世代へ。「いつから準備すればいい？」その段階からお手伝いします。' },
    { no: '04', label: '— STARTUP',  ja: '会社設立・創業支援',    en: 'Incorporation',           txt: '「自分で会社を作りたい」その想い、応援します。届出から融資の相談まで、創業の不安を一つずつ解消していきましょう。' },
    { no: '05', label: '— CLOUD',    ja: 'クラウド会計導入支援',  en: 'Cloud Accounting',        txt: '「パソコンは苦手で…」という方もご安心ください。あなたに合ったソフト選びから使い方まで、丁寧にお教えします。' },
    { no: '06', label: '— ADVISORY', ja: '経営相談・資金繰り支援', en: 'Management Consulting',   txt: '資金繰りの不安、一人で抱えていませんか？数字の読み方から融資の相談まで、経営者のそばで一緒に考えます。' }
  ];

  function esc(s) { return String(s).replace(/&(?!amp;)/g, '&amp;').replace(/</g, '&lt;'); }

  function stackMarkup(d) {
    var cards = SERVICES.map(function (s) {
      return '' +
        '<article class="stack__card">' +
          '<div class="stack__cardtop">' +
            '<span class="stack__no">' + s.no + '</span>' +
            '<span class="stack__label">' + s.label + '</span>' +
          '</div>' +
          '<h3 class="stack__h3">' + s.ja + '</h3>' +
          '<span class="stack__en">' + s.en + '</span>' +
          '<p class="stack__txt">' + s.txt + '</p>' +
        '</article>';
    }).join('');

    return '' +
      '<section class="stack">' +
        '<div class="stack__vp">' +
          '<div class="stack__in">' +
            '<div class="stack__head">' +
              '<div class="stack__headtxt">' +
                '<span class="stack__eyebrow">' + esc(d.eyebrow) + '</span>' +
                '<h2 class="stack__h2" data-split>' + esc(d.heading) + '</h2>' +
                '<p class="stack__lead">' + esc(d.lead) + '</p>' +
              '</div>' +
              '<div class="stack__counter">01 / 0' + SERVICES.length + '</div>' +
            '</div>' +
            '<div class="stack__cards">' + cards + '</div>' +
            '<div class="stack__foot">' +
              '<div class="stack__track"><div class="stack__bar"></div></div>' +
              '<a class="stack__link" href="services.html">サービス一覧を見る</a>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</section>';
  }

  function buildStacks() {
    var mounts = document.querySelectorAll('.stack-mount[data-stack]');
    Array.prototype.forEach.call(mounts, function (m) {
      m.innerHTML = stackMarkup({
        eyebrow: m.getAttribute('data-eyebrow') || '— WHAT WE DO',
        heading: m.getAttribute('data-heading') || '六つの領域で、経営の「困った」に応えます。',
        lead: m.getAttribute('data-lead') || ''
      });
    });
  }

  /* ---------------------------------------------------------------
     M1 — Lenis
     --------------------------------------------------------------- */
  function initLenis() {
    if (reduced || lenis || !window.Lenis || !hasGsap) return;
    lenis = new window.Lenis({ duration: 0.9, lerp: 0.1, smoothWheel: true, smoothTouch: false });
    lenis.on('scroll', ST.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  /* ---------------------------------------------------------------
     M3 — 見出しの文字分割リビール
     --------------------------------------------------------------- */
  function splitReveal(scope) {
    var els = scope.querySelectorAll('[data-split]:not([data-split-done])');
    Array.prototype.forEach.call(els, function (el) {
      el.setAttribute('data-split-done', '1');
      if (!el.hasAttribute('data-split-src')) el.setAttribute('data-split-src', el.textContent);
      var src = el.getAttribute('data-split-src');
      var frag = document.createDocumentFragment();
      var chars = [];
      Array.prototype.forEach.call(Array.from(src), function (ch) {
        var s = document.createElement('span');
        s.className = 'split-char';
        s.textContent = ch;
        frag.appendChild(s);
        chars.push(s);
      });
      el.textContent = '';
      el.appendChild(frag);
      if (!hasGsap) return;
      var tw = gsap.fromTo(chars,
        { opacity: 0, y: '0.4em' },
        {
          opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.035,
          scrollTrigger: { trigger: el, start: 'top 98%', once: true }
        });
      if (tw.scrollTrigger) triggers.push(tw.scrollTrigger);
    });
  }

  /* ---------------------------------------------------------------
     M4 — in-view リビール
     --------------------------------------------------------------- */
  function inViewReveal(scope) {
    var els = scope.querySelectorAll('[data-anime]:not([data-anime-done])');
    Array.prototype.forEach.call(els, function (el) {
      el.setAttribute('data-anime-done', '1');
      if (!hasGsap) return;
      // 初期表示域にあるものはアニメーションさせず、そのまま見せる
      if (el.getBoundingClientRect().top < window.innerHeight * 0.95) {
        gsap.set(el, { clearProps: 'opacity,transform' });
        return;
      }
      var tw = gsap.fromTo(el, { opacity: 0, y: 32 },
        {
          opacity: 1, y: 0, duration: 0.7, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 95%', once: true }
        });
      if (tw.scrollTrigger) triggers.push(tw.scrollTrigger);
    });

    // 保険: 1.2秒後、画面内なのに opacity:0 のまま残っている要素を可視へ戻す
    clearTimeout(inViewReveal._t);
    inViewReveal._t = setTimeout(function () {
      if (!hasGsap) return;
      Array.prototype.forEach.call(document.querySelectorAll('[data-anime]'), function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0 && getComputedStyle(el).opacity === '0') {
          gsap.set(el, { clearProps: 'opacity,transform' });
        }
      });
    }, 1200);
  }

  /* ---------------------------------------------------------------
     M8 — ヒーロー画像のスケール
     --------------------------------------------------------------- */
  function heroScale(scope) {
    var els = scope.querySelectorAll('[data-hero-img]');
    if (!hasGsap || reduced) return;
    Array.prototype.forEach.call(els, function (el) {
      var tw = gsap.fromTo(el, { scale: 1.08 }, {
        scale: 1, ease: 'none',
        scrollTrigger: {
          trigger: el.closest('.hero-b, .hero-c-band') || el.parentElement || el,
          start: 'top top', end: 'bottom top', scrub: true
        }
      });
      if (tw.scrollTrigger) triggers.push(tw.scrollTrigger);
    });
  }

  /* ---------------------------------------------------------------
     M2 — スティッキー・カードスタック
     --------------------------------------------------------------- */
  function stackMotion(scope) {
    var root = scope.querySelector('.stack');
    if (!root) return;
    var cards = Array.prototype.slice.call(root.querySelectorAll('.stack__card'));
    var counter = root.querySelector('.stack__counter');
    var bar = root.querySelector('.stack__bar');
    cards.forEach(function (c, i) { c.style.zIndex = String(i + 1); });

    if (reduced || !hasGsap) {
      root.classList.add('is-static');
      if (counter) counter.textContent = '0' + cards.length + ' / 0' + cards.length;
      return;
    }
    root.classList.remove('is-static');

    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: root, start: 'top top', end: 'bottom bottom', scrub: 1,
        onUpdate: function (s) {
          if (!counter) return;
          var n = Math.min(cards.length, 1 + Math.floor(s.progress * cards.length * 0.999));
          counter.textContent = String(n).padStart(2, '0') + ' / 0' + cards.length;
        }
      }
    });
    cards.slice(1).forEach(function (c, i) {
      gsap.set(c, { yPercent: 0, y: '70vh', rotate: 8, scale: 1.04, opacity: 0 });
      tl.to(c, { y: 0, rotate: 0, scale: 1, opacity: 1, ease: 'none', duration: 1 }, i);
    });
    if (bar) tl.to(bar, { scaleX: 1, ease: 'none', duration: cards.length - 1 }, 0);
    if (tl.scrollTrigger) triggers.push(tl.scrollTrigger);
  }

  /* ---------------------------------------------------------------
     組み立て / 破棄
     --------------------------------------------------------------- */
  function activate(section) {
    splitReveal(section);
    inViewReveal(section);
    heroScale(section);
    stackMotion(section);
    // ★ScrollTrigger は「レイアウトが確定してから」計測させる。
    //   フォント読込前に計測すると start/end がずれ、スクラブが動かなくなる（実測で確認）
    if (hasGsap) {
      setTimeout(function () { ST.refresh(); }, 0);
      setTimeout(function () { ST.refresh(); }, 400);
    }
  }

  // フォント読込・load 完了を待ってから初期化するためのヘルパー
  // ★rAF は使わない。バックグラウンドタブや非表示状態では発火せず、初期化が止まるため
  function whenLayoutReady(fn) {
    var done = false;
    var go = function () { if (done) return; done = true; setTimeout(fn, 0); };
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(go).catch(go);
    } else if (document.readyState === 'complete') {
      go();
    } else {
      window.addEventListener('load', go, { once: true });
    }
    setTimeout(go, 1500); // 保険（フォント取得が失敗しても必ず起動させる）
  }

  function teardown() {
    triggers.forEach(function (t) { try { t.kill(); } catch (e) {} });
    triggers = [];
    Array.prototype.forEach.call(document.querySelectorAll('[data-split-done]'), function (el) {
      el.removeAttribute('data-split-done');
      el.textContent = el.getAttribute('data-split-src') || el.textContent;
      if (hasGsap) gsap.set(el, { clearProps: 'opacity,transform' });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-anime-done]'), function (el) {
      el.removeAttribute('data-anime-done');
      if (hasGsap) gsap.set(el, { clearProps: 'opacity,transform' });
    });
    if (hasGsap) {
      gsap.set(document.querySelectorAll('[data-hero-img]'), { clearProps: 'transform' });
      gsap.set(document.querySelectorAll('.stack__card,.stack__bar'), { clearProps: 'all' });
    }
    Array.prototype.forEach.call(document.querySelectorAll('.stack__counter'), function (c) {
      c.textContent = '01 / 0' + SERVICES.length;
    });
  }

  /* ---------------------------------------------------------------
     案の切替（プロトタイプ専用UI）
     --------------------------------------------------------------- */
  function currentSection() { return document.querySelector('.opt:not([hidden])'); }

  function pick(opt) {
    teardown();
    Array.prototype.forEach.call(document.querySelectorAll('.opt'), function (s) {
      s.hidden = s.getAttribute('data-opt') !== opt;
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-opt-btn]'), function (b) {
      b.classList.toggle('is-on', b.getAttribute('data-opt-btn') === opt);
    });
    closeDrawer();
    if (lenis) lenis.scrollTo(0, { immediate: true });
    window.scrollTo(0, 0);
    if (history.replaceState) history.replaceState(null, '', '#1' + opt);
    var s = currentSection();
    if (s) activate(s);
  }

  /* ---------------------------------------------------------------
     ドロワー
     --------------------------------------------------------------- */
  var drawer = document.getElementById('drawer');
  var hamburger = document.getElementById('hamburger');

  function openDrawer() {
    if (!drawer) return;
    drawer.hidden = false;
    if (hamburger) hamburger.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    if (lenis) lenis.stop();
    var first = drawer.querySelector('button,a');
    if (first) first.focus();
  }
  function closeDrawer() {
    if (!drawer || drawer.hidden) return;
    drawer.hidden = true;
    if (hamburger) { hamburger.setAttribute('aria-expanded', 'false'); hamburger.focus(); }
    document.body.style.overflow = '';
    if (lenis) lenis.start();
  }

  /* ---------------------------------------------------------------
     起動
     --------------------------------------------------------------- */
  function boot() {
    buildStacks();
    initLenis();

    if (hamburger) hamburger.addEventListener('click', function () {
      if (drawer && drawer.hidden) openDrawer(); else closeDrawer();
    });
    var closeBtn = document.getElementById('drawer-close');
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });

    Array.prototype.forEach.call(document.querySelectorAll('[data-opt-btn]'), function (b) {
      b.addEventListener('click', function () { pick(b.getAttribute('data-opt-btn')); });
    });

    // #1a / #1b / #1c で直接開けるようにする
    var h = (location.hash || '').replace('#1', '');
    var target = (h === 'b' || h === 'c') ? h : 'a';
    Array.prototype.forEach.call(document.querySelectorAll('.opt'), function (s) {
      s.hidden = s.getAttribute('data-opt') !== target;
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-opt-btn]'), function (b) {
      b.classList.toggle('is-on', b.getAttribute('data-opt-btn') === target);
    });

    whenLayoutReady(function () {
      var s = currentSection();
      if (s) activate(s);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.addEventListener('load', function () { if (hasGsap) ST.refresh(); });
})();
