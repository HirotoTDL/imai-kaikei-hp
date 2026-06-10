/* ============================================================
   IMAI LAB — Sum Zero Apparatus / motion controller
   GSAP + ScrollTrigger + Lenis（CDN）。不達時は全文表示に退避。
   ============================================================ */
(function(){
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasLibs = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';

  /* ---------- パンチ穴: 行番号を5bitで刻む（暗号意匠） ---------- */
  document.querySelectorAll('.punch').forEach(function(p){
    var n = parseInt(p.dataset.punch, 10) || 0;
    var html = '';
    for (var bit = 4; bit >= 0; bit--) {
      html += '<b' + ((n >> bit) & 1 ? ' class="on"' : '') + '></b>';
    }
    p.innerHTML = html;
  });

  /* ---------- 数字ドラム ---------- */
  function buildDrum(el){
    var value = el.dataset.drum || '0000000';
    var reels = [];
    el.innerHTML = '';
    for (var i = 0; i < value.length; i++) {
      var reel = document.createElement('span');
      reel.className = 'reel';
      var strip = document.createElement('span');
      strip.className = 'strip';
      var digits = '';
      for (var loop = 0; loop < 3; loop++) {
        for (var d = 0; d < 10; d++) digits += '<i>' + d + '</i>';
      }
      digits += '<i>' + value[i] + '</i>';
      strip.innerHTML = digits;
      reel.appendChild(strip);
      el.appendChild(reel);
      reels.push(strip);
    }
    return reels;
  }

  function setDrumFinal(el){
    var strips = buildDrum(el);
    strips.forEach(function(s){
      var h = s.firstChild.offsetHeight;
      s.style.transform = 'translateY(' + (-h * 30) + 'px)';
    });
  }

  var drums = document.querySelectorAll('.drum');
  var proof = document.getElementById('heroProof');

  if (!hasLibs || reduced) {
    /* 退避: 静的に完成形を見せる */
    document.body.classList.add('no-anim');
    drums.forEach(setDrumFinal);
    if (proof) proof.style.opacity = 1;
    if (!hasLibs) return;
  }

  /* ---------- Lenis ---------- */
  var lenis = null;
  if (!reduced && typeof Lenis !== 'undefined') {
    lenis = new Lenis({ lerp: 0.1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function(t){ lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  /* アンカー */
  document.querySelectorAll('a[href^="#"]').forEach(function(a){
    a.addEventListener('click', function(e){
      var target = document.querySelector(a.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { offset: -70, duration: 1.4 });
      else target.scrollIntoView({ behavior: 'smooth' });
    });
  });

  /* ---------- ナビ ---------- */
  var nav = document.getElementById('nav');
  ScrollTrigger.create({
    start: 60,
    onUpdate: function(self){ nav.classList.toggle('scrolled', self.scroll() > 60); }
  });
  document.querySelectorAll('.nav-links a').forEach(function(link){
    var sec = document.querySelector(link.getAttribute('href'));
    if (!sec) return;
    ScrollTrigger.create({
      trigger: sec, start: 'top 45%', end: 'bottom 45%',
      onToggle: function(self){ link.classList.toggle('active', self.isActive); }
    });
  });

  if (reduced) return; /* reduced-motion: ここから先の演出は行わない */

  /* ---------- HERO: タイトル → ドラム収束 → 朱印 ---------- */
  var intro = gsap.timeline({ defaults: { ease: 'power4.out' } });
  intro.from('.hero-over .line',  { yPercent: 120, duration: .9 }, .15)
       .from('.hero-title .line', { yPercent: 110, duration: 1.1 }, .25)
       .from('.hero-meta, .hero-hint', { opacity: 0, duration: .8 }, .8)
       .from('.hero-bg img', { scale: 1.06, duration: 2.2, ease: 'power2.out' }, 0);

  drums.forEach(function(el, di){
    var strips = buildDrum(el);
    strips.forEach(function(s, i){
      var h = s.firstChild.offsetHeight;
      var startIdx = Math.floor(Math.random() * 10);
      gsap.fromTo(s,
        { y: -h * startIdx },
        {
          y: -h * 30,
          duration: 2.1,
          delay: .55 + di * .12 + i * .1,
          ease: 'power3.inOut'
        });
    });
  });
  /* 収束完了と同時に「検算済」を捺す */
  gsap.fromTo('#heroProof',
    { opacity: 0 },
    { opacity: 1, duration: .5, delay: 3.4, ease: 'power2.out' });
  gsap.fromTo('.hero-proof .proof-seal',
    { scale: 1.5, opacity: 0, rotation: -8 },
    { scale: 1, opacity: 1, rotation: -3, duration: .45, delay: 3.45, ease: 'power4.out' });

  /* HEROパララックス（紙送り） */
  gsap.to('.hero-bg img', {
    yPercent: 9, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
  });
  gsap.to('.hero-type', {
    yPercent: -14, opacity: .25, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom 30%', scrub: true }
  });

  /* ---------- 汎用リビール ---------- */
  gsap.utils.toArray('.reveal').forEach(function(el){
    gsap.from(el, {
      y: 28, opacity: 0, duration: 1, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%' }
    });
  });

  /* ---------- 01 CONCEPT: 天秤の罫線 ---------- */
  var rules = gsap.timeline({
    scrollTrigger: { trigger: '.balance-rules', start: 'top 85%' }
  });
  rules.from('.rule-l', { scaleX: 0, duration: 1.2, ease: 'power3.inOut' }, 0)
       .from('.rule-r', { scaleX: 0, duration: 1.2, ease: 'power3.inOut' }, 0)
       .from('.rule-pivot', { opacity: 0, duration: .5 }, .9);
  gsap.from('#conceptEngrave', {
    opacity: 0, duration: 1.6, delay: .4, ease: 'power2.out',
    scrollTrigger: { trigger: '#conceptEngrave', start: 'top 92%' }
  });

  /* ---------- 03 PEOPLE: 真鍮プレート差し込み ---------- */
  gsap.utils.toArray('.plate').forEach(function(plate, i){
    gsap.from(plate, {
      clipPath: 'inset(0 100% 0 0)', x: -24, duration: 1.2, delay: i * .15,
      ease: 'power3.inOut',
      scrollTrigger: { trigger: '.plates', start: 'top 80%' }
    });
  });

  /* ---------- 04 SERVICES: 紙送り式に順次出現 ---------- */
  gsap.from('.svc-card', {
    y: 56, opacity: 0, duration: 1, stagger: .09, ease: 'power3.out',
    scrollTrigger: { trigger: '.svc-grid', start: 'top 82%' }
  });

  /* ---------- INTERLUDE / CONTACT背景: パララックス ---------- */
  gsap.utils.toArray('[data-parallax]').forEach(function(img){
    gsap.fromTo(img, { yPercent: -7 }, {
      yPercent: 7, ease: 'none',
      scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true }
    });
  });

  /* ---------- 05 TOOLS: 検査光（暗い影の帯）が走る ---------- */
  gsap.fromTo('.sweep',
    { backgroundPosition: '120% 0' },
    {
      backgroundPosition: '-20% 0', ease: 'none',
      scrollTrigger: { trigger: '.sec-tools', start: 'top 70%', end: 'bottom 30%', scrub: true }
    });

  /* ---------- 06 CONTACT: 朱印の捺印 ---------- */
  gsap.fromTo('#contactSeal',
    { scale: 1.4, opacity: 0, rotation: -9 },
    {
      scale: 1, opacity: 1, rotation: -3, duration: .5, ease: 'power4.out',
      scrollTrigger: { trigger: '.contact-proof', start: 'top 88%' }
    });
  gsap.from('.contact-proof .engrave', {
    opacity: 0, duration: 1, delay: .35,
    scrollTrigger: { trigger: '.contact-proof', start: 'top 88%' }
  });

})();
