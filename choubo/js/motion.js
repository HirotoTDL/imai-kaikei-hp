/* スクロール演出 — 設計 docs/motion.md C-2（NSL・goodpatch の実測値）
   パララックス / 3レイヤーのスタッガー / テキストフィル / フッターリビール / 雲の漂い
   ★スクロールは奪わない（transform と opacity だけ。ピン留め・スナップは使わない）
   ★reduced-motion と JS なしでは全部が最終状態で見える */
(function () {
  'use strict';
  var d = document;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var qa = function (s) { return Array.prototype.slice.call(d.querySelectorAll(s)); };

  // ---- 3レイヤーのスタッガー（NSL: 0.3/0.4/0.5s 遅れ・1s・cubic-bezier(.9,0,.1,1)）----
  var stg = qa('.stg');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -12% 0px' });
    stg.forEach(function (el) { io.observe(el); });
  } else {
    stg.forEach(function (el) { el.classList.add('is-in'); });
  }
  if (reduce) return;

  // ---- パララックス（data-speed: 正=手前で速い／負=奥で遅い）----
  // NSL 実測: 浮遊物 1.16〜1.27倍 → speed 0.16〜0.27
  var plx = qa('[data-speed]').map(function (el) {
    return { el: el, sp: +el.getAttribute('data-speed'), ground: !!el.closest('.ground') };
  });
  // ---- テキストフィル（goodpatch: 読み進めると濃くなる）----
  var fills = qa('.fill');
  // ---- フッターリビール（NSL 実測: 締めの中身が 0.1〜0.5倍で遅れて現れる）----
  var foot = d.querySelector('.foot');
  var footIn = foot && foot.querySelector('.wrap');

  var H = innerHeight, ticking = false;
  function frame() {
    ticking = false;
    var sy = scrollY;
    for (var i = 0; i < plx.length; i++) {
      var p = plx[i];
      if (p.ground) { p.el.style.translate = '0 ' + (-sy * p.sp).toFixed(1) + 'px'; continue; }
      var r = p.el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > H + 200) continue;
      // 画面中央を基準に、ずれ量 = 中央からの距離 × 速度
      var c = r.top + r.height / 2 - H / 2;
      p.el.style.translate = '0 ' + (-c * p.sp).toFixed(1) + 'px';
    }
    for (var j = 0; j < fills.length; j++) {
      var f = fills[j], fr = f.getBoundingClientRect();
      var prog = (H * 0.85 - fr.top) / (fr.height + H * 0.35);
      prog = prog < 0 ? 0 : prog > 1 ? 1 : prog;
      f.style.setProperty('--fill', (prog * 100).toFixed(1) + '%');
    }
    if (footIn) {
      var fb = foot.getBoundingClientRect();
      var gap = fb.bottom - H;                        // 締めの下端が画面下端に届くまでの残り
      footIn.style.translate = '0 ' + (gap > 0 && fb.top < H ? -(Math.min(gap, fb.height) * 0.45).toFixed(1) : 0) + 'px';
    }
  }
  function req() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  addEventListener('scroll', req, { passive: true });
  addEventListener('resize', function () { H = innerHeight; req(); });
  frame();
})();
