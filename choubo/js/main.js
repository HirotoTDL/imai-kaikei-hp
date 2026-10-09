/* 帳簿HP 共通スクリプト。JS が動かなくても本文・電話・導線はすべて読めること（飾りだけが止まる） */
(function () {
  'use strict';
  var d = document, root = d.documentElement;
  root.classList.add('js');
  var q = function (s, c) { return (c || d).querySelector(s); };
  var qa = function (s, c) { return Array.prototype.slice.call((c || d).querySelectorAll(s)); };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ヘッダーの影
  var hdr = q('.hdr');
  var onScroll = function () { if (hdr) hdr.classList.toggle('is-scrolled', scrollY > 8); };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // ドロワー（SP）
  var btn = q('.menu-btn'), drawer = q('#drawer');
  if (btn && drawer) {
    var set = function (open) {
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
      drawer.classList.toggle('is-open', open);
      drawer.toggleAttribute('inert', !open);
      d.body.style.overflow = open ? 'hidden' : '';
    };
    drawer.setAttribute('inert', '');
    btn.addEventListener('click', function () { set(btn.getAttribute('aria-expanded') !== 'true'); });
    d.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawer.classList.contains('is-open')) { set(false); btn.focus(); }
    });
    qa('a', drawer).forEach(function (a) { a.addEventListener('click', function () { set(false); }); });
  }

  // 出現（下からふわっと）
  var rv = qa('.rv');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    rv.forEach(function (el) { io.observe(el); });
  } else {
    rv.forEach(function (el) { el.classList.add('is-in'); });
  }

  // ヒーローのボイル: 2・3コマ目は読み込み後に取りに行き、揃ってから送る
  // 保険: opening.js が読めなくても 9 秒後には人物を必ず出す
  setTimeout(function () { qa('.hero__l').forEach(function (el) { el.classList.add('is-in'); }); }, 9000);
  if (!q('#opening')) qa('.hero__l').forEach(function (el) { el.classList.add('is-in'); });

  var hero = q('.hero');
  if (hero && !reduce) {
    var start = function () {
      var lazy = qa('img[data-src]', hero), n = lazy.length;
      if (!n) return;
      lazy.forEach(function (img) {
        img.onload = function () { if (--n === 0) hero.classList.add('is-boil'); };
        img.src = img.getAttribute('data-src');
      });
    };
    if (d.readyState === 'complete') start(); else addEventListener('load', start);
  }

  // 地図は押したら読み込む（初回表示を軽くする）
  qa('.mapbox__btn').forEach(function (b) {
    b.addEventListener('click', function () {
      var f = d.createElement('iframe');
      f.className = 'map'; f.loading = 'lazy'; f.title = '今井会計事務所の所在地';
      f.referrerPolicy = 'no-referrer-when-downgrade';
      f.src = b.getAttribute('data-map');
      b.parentNode.replaceChild(f, b);
    });
  });

  // お問い合わせ: 送信後に完了ページへ（GAS は no-cors で応答が読めないため）
  var form = q('form.form');
  if (form && window.fetch && window.FormData) {
    form.addEventListener('submit', function (e) {
      if (typeof form.reportValidity === 'function' && !form.reportValidity()) return;
      e.preventDefault();
      var sb = q('button[type="submit"]', form);
      if (sb) { sb.disabled = true; sb.textContent = '送信しています…'; }
      fetch(form.action, { method: 'POST', body: new FormData(form), mode: 'no-cors' })
        .then(function () { location.href = form.getAttribute('data-thanks') || 'thanks.html'; })
        .catch(function () { if (sb) { sb.disabled = false; sb.textContent = '送信する'; } form.submit(); });
    });
  }

  // トップの「相談の入口」: 選んだ相談内容をフォームへ引き継ぐ
  var entry = q('#entry-form');
  if (entry) {
    entry.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = q('select', entry).value;
      location.href = 'contact.html' + (v ? '?subject=' + encodeURIComponent(v) : '') + '#form';
    });
  }
  var sel = q('#f-sub');
  if (sel && location.search) {
    var m = /[?&]subject=([^&]+)/.exec(location.search);
    if (m) { try { sel.value = decodeURIComponent(m[1]); } catch (_) {} }
  }
})();
