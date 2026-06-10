/* ============================================================
   IMAI LAB — Sum Zero Apparatus / machine controller v2
   GSAP + ScrollTrigger + Lenis（CDN）。不達時は静的表示に退避。
   構成: SFX(WebAudio) / Odometer / Journal / Gears / Console
   ============================================================ */
(function(){
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasLibs = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
  var fine    = window.matchMedia('(pointer: fine)').matches;

  /* ================== SFX — 合成機械音（アセット不要） ================== */
  var SFX = {
    ctx: null, enabled: false, _noise: null, _last: 0,
    ensure: function(){
      if (!this.ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this.ctx = new AC();
      }
      return !!this.ctx;
    },
    noiseBuf: function(){
      if (this._noise) return this._noise;
      var c = this.ctx, buf = c.createBuffer(1, c.sampleRate * .25, c.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return (this._noise = buf);
    },
    tick: function(){ /* ドラム1目盛のラチェット音 */
      if (!this.enabled || !this.ctx) return;
      var now = performance.now();
      if (now - this._last < 26) return;
      this._last = now;
      var c = this.ctx, t = c.currentTime;
      var s = c.createBufferSource(); s.buffer = this.noiseBuf();
      var f = c.createBiquadFilter(); f.type = 'bandpass';
      f.frequency.value = 2400 + Math.random() * 900; f.Q.value = 9;
      var g = c.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(.05, t + .002);
      g.gain.exponentialRampToValueAtTime(.0001, t + .045);
      s.connect(f); f.connect(g); g.connect(c.destination);
      s.start(t); s.stop(t + .06);
    },
    thunk: function(){ /* 捺印・締めの低い打撃 */
      if (!this.enabled || !this.ctx) return;
      var c = this.ctx, t = c.currentTime;
      var o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(130, t);
      o.frequency.exponentialRampToValueAtTime(48, t + .16);
      var g = c.createGain();
      g.gain.setValueAtTime(.32, t);
      g.gain.exponentialRampToValueAtTime(.0001, t + .2);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + .22);
      var s = c.createBufferSource(); s.buffer = this.noiseBuf();
      var f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
      var g2 = c.createGain();
      g2.gain.setValueAtTime(.18, t);
      g2.gain.exponentialRampToValueAtTime(.0001, t + .09);
      s.connect(f); f.connect(g2); g2.connect(c.destination);
      s.start(t); s.stop(t + .1);
    },
    key: function(){ /* キー打鍵 */
      if (!this.enabled || !this.ctx) return;
      var c = this.ctx, t = c.currentTime;
      var s = c.createBufferSource(); s.buffer = this.noiseBuf();
      var f = c.createBiquadFilter(); f.type = 'bandpass';
      f.frequency.value = 1200; f.Q.value = 3;
      var g = c.createGain();
      g.gain.setValueAtTime(.12, t);
      g.gain.exponentialRampToValueAtTime(.0001, t + .06);
      s.connect(f); f.connect(g); g.connect(c.destination);
      s.start(t); s.stop(t + .07);
    }
  };

  /* ================== Journal — 来訪記帳テープ ================== */
  var Journal = {
    entries: [], track: document.getElementById('journalTrack'),
    pad: function(n){ return (n < 10 ? '0' : '') + n; },
    time: function(){
      var d = new Date();
      return this.pad(d.getHours()) + ':' + this.pad(d.getMinutes()) + ':' + this.pad(d.getSeconds());
    },
    log: function(msg){
      if (!this.track) return;
      this.entries.push(this.time() + ' ' + msg);
      if (this.entries.length > 12) this.entries.shift();
      this.render();
    },
    render: function(){
      var s = this.entries.join(' ¦ ') + ' ¦ ';
      this.track.innerHTML = '<span></span><span></span>';
      this.track.children[0].textContent = s;
      this.track.children[1].textContent = s;
      var w = this.track.children[0].offsetWidth || 600;
      this.track.style.setProperty('--tape-w', w + 'px');
      this.track.style.setProperty('--tape-dur', Math.max(14, w / 42) + 's');
      this.track.classList.remove('run');
      void this.track.offsetWidth;
      this.track.classList.add('run');
    }
  };

  /* ================== Odometer — 機械式数字ドラム ================== */
  function Odometer(el, digits){
    this.el = el; this.digits = digits; this.value = 0; this.reels = [];
    el.innerHTML = '';
    for (var i = 0; i < digits; i++) {
      var reel = document.createElement('span'); reel.className = 'reel';
      var strip = document.createElement('span'); strip.className = 'strip';
      strip.innerHTML = '<i>0</i>';
      reel.appendChild(strip); el.appendChild(reel);
      this.reels.push({ strip: strip, digit: 0, tween: null });
    }
  }
  Odometer.prototype.scramble = function(){
    this.reels.forEach(function(r){
      r.digit = Math.floor(Math.random() * 10);
      r.strip.innerHTML = '<i>' + r.digit + '</i>';
    });
  };
  Odometer.prototype.set = function(value, opts){
    opts = opts || {};
    var str = String(Math.max(0, Math.round(value)));
    if (str.length > this.digits) str = str.slice(-this.digits);
    while (str.length < this.digits) str = '0' + str;
    this.value = parseInt(str, 10) || 0;
    var n = this.digits;
    this.reels.forEach(function(r, idx){
      var to = +str[idx];
      if (!hasLibs || reduced) { /* 退避: 即時表示 */
        r.digit = to; r.strip.innerHTML = '<i>' + to + '</i>'; return;
      }
      var extra = idx === n - 1 ? 2 : idx === n - 2 ? 1 : 0;
      var loops = (opts.loops != null ? opts.loops : 0) + extra;
      var wasRolling = r.tween && r.tween.isActive();
      if (r.tween) r.tween.kill(); /* 中断時は onUpdate が更新した r.digit から継ぐ */
      var steps = loops * 10 + ((to - r.digit) % 10 + 10) % 10;
      if (steps === 0) {
        if (!wasRolling) return; /* 静止中で目標一致なら何もしない */
        steps = 10;              /* 回転中断からの収束は1周回して着地 */
      }
      var html = '', d = r.digit, from = r.digit;
      for (var s = 0; s <= steps; s++) { html += '<i>' + d + '</i>'; d = (d + 1) % 10; }
      r.strip.innerHTML = html;
      var h = r.strip.firstElementChild.offsetHeight;
      gsap.set(r.strip, { y: 0 });
      var last = 0;
      r.tween = gsap.to(r.strip, {
        y: -h * steps,
        duration: opts.duration || 1.1,
        delay: (opts.delay || 0) + idx * (opts.stagger != null ? opts.stagger : .05),
        ease: opts.ease || 'power3.inOut',
        onUpdate: function(){
          var cur = Math.floor(this.progress() * steps);
          if (cur !== last) { last = cur; r.digit = (from + cur) % 10; SFX.tick(); }
        },
        onComplete: function(){
          r.digit = to;
          r.strip.innerHTML = '<i>' + to + '</i>';
          gsap.set(r.strip, { y: 0 });
        }
      });
    });
  };

  /* ================== Gears — SVG歯車工房 ================== */
  function gearSVG(teeth, R, opts){
    opts = opts || {};
    var root = R * .86, hub = R * .16, ring = R * .58;
    var pts = [], pitch = Math.PI * 2 / teeth;
    for (var i = 0; i < teeth; i++) {
      var a = i * pitch;
      [[0, root], [.16, R], [.44, R], [.6, root]].forEach(function(seg){
        var ang = a + pitch * seg[0];
        pts.push((Math.cos(ang) * seg[1] + R + 4).toFixed(2) + ',' + (Math.sin(ang) * seg[1] + R + 4).toFixed(2));
      });
    }
    var spokes = '';
    var spokeN = opts.spokes != null ? opts.spokes : 5;
    for (var sI = 0; sI < spokeN; sI++) {
      var sa = sI * Math.PI * 2 / spokeN + (opts.phase || 0);
      spokes += '<line x1="' + (R + 4 + Math.cos(sa) * hub).toFixed(1) + '" y1="' + (R + 4 + Math.sin(sa) * hub).toFixed(1) +
                '" x2="' + (R + 4 + Math.cos(sa) * ring).toFixed(1) + '" y2="' + (R + 4 + Math.sin(sa) * ring).toFixed(1) + '"/>';
    }
    var size = (R + 4) * 2;
    return '<svg class="gear" viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '">' +
      '<g>' +
      '<polygon points="' + pts.join(' ') + '"/>' +
      '<circle cx="' + (R + 4) + '" cy="' + (R + 4) + '" r="' + ring + '"/>' +
      '<circle cx="' + (R + 4) + '" cy="' + (R + 4) + '" r="' + hub + '"/>' +
      spokes +
      '</g></svg>';
  }

  /* ================== パンチ穴: 行番号を5bitで刻む ================== */
  document.querySelectorAll('.punch').forEach(function(p){
    var n = parseInt(p.dataset.punch, 10) || 0;
    var html = '';
    for (var bit = 4; bit >= 0; bit--) html += '<b' + ((n >> bit) & 1 ? ' class="on"' : '') + '></b>';
    p.innerHTML = html;
  });

  /* ================== ドラム実体化 ================== */
  var heroDR = new Odometer(document.getElementById('heroDrumDR'), 7);
  var heroCR = new Odometer(document.getElementById('heroDrumCR'), 7);
  var conDR  = new Odometer(document.getElementById('consoleDrumDR'), 7);
  var conCR  = new Odometer(document.getElementById('consoleDrumCR'), 7);

  /* ================== サウンドトグル ================== */
  var soundBtn = document.getElementById('soundToggle');
  var soundState = document.getElementById('soundState');
  if (soundBtn) soundBtn.addEventListener('click', function(){
    if (!SFX.ensure()) return;
    if (SFX.ctx.state === 'suspended') SFX.ctx.resume();
    SFX.enabled = !SFX.enabled;
    soundBtn.setAttribute('aria-pressed', SFX.enabled);
    soundBtn.classList.toggle('on', SFX.enabled);
    soundState.textContent = SFX.enabled ? 'ON' : 'OFF';
    Journal.log(SFX.enabled ? 'SOUND ENGAGED — 機構音 接続' : 'SOUND CUT — 機構音 切断');
    if (SFX.enabled) SFX.key();
  });

  /* ================== Console — 触れる複式簿記 ================== */
  (function(){
    var val = 0, audits = 0, busy = false;
    var keys = document.getElementById('consoleKeys');
    var stampBtn = document.getElementById('stampBtn');
    var ticket = document.getElementById('ticket');
    var seal = document.getElementById('consoleSeal');
    var beamBar = document.getElementById('beamBar');
    if (!keys) return;
    var fmt = function(n){ return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
    var tilt = function(deg, dur, ease){
      if (!hasLibs || reduced) return;
      gsap.to(beamBar, { rotation: deg, svgOrigin: '160 28', duration: dur, ease: ease || 'power2.out' });
    };
    var entryNo = function(){
      var days = Math.floor((Date.now() - new Date(1971, 0, 1).getTime()) / 86400000);
      return 'E' + days + '-' + (audits + 1);
    };
    keys.addEventListener('click', function(e){
      var b = e.target.closest('button');
      if (!b || busy) return;
      SFX.ensure(); SFX.key();
      var add = b.dataset.add === 'random'
        ? (Math.floor(Math.random() * 899) + 100) * 100
        : parseInt(b.dataset.add, 10);
      val = Math.min(val + add, 9999999);
      conDR.set(val, { duration: .85, loops: 0 });
      tilt(-2.4, .5);                       /* 借方が先に重くなる */
      Journal.log('DR ¥' + fmt(add) + ' POSTED — 借方 受入');
      setTimeout(function(){                 /* 貸方が追随して均衡 */
        conCR.set(val, { duration: .85, loops: 0 });
        tilt(0, 1.1, 'elastic.out(1,.45)');
        Journal.log('CR ¥' + fmt(add) + ' POSTED — 自動平均 / DR=CR');
      }, 420);
    });
    if (stampBtn) stampBtn.addEventListener('click', function(){
      if (busy) return;
      SFX.ensure();
      if (val === 0) {
        SFX.key();
        ticket.textContent = '未記帳 — 既に零です。まず仕訳を打ってください。';
        return;
      }
      busy = true;
      var closed = val;
      stampBtn.classList.add('pressed');
      conDR.set(0, { duration: 1.4, loops: 1 });
      conCR.set(0, { duration: 1.4, loops: 1, delay: .08 });
      tilt(0, .6);
      setTimeout(function(){
        SFX.thunk();
        if (hasLibs && !reduced && seal) {
          gsap.fromTo(seal,
            { scale: 1.7, opacity: 0, rotation: -10 },
            { scale: 1, opacity: 1, rotation: -4, duration: .4, ease: 'power4.out' });
        } else if (seal) { seal.style.opacity = 1; }
        var no = entryNo(); audits++;
        ticket.textContent = no + ' / DR ¥' + fmt(closed) + ' = CR ¥' + fmt(closed) +
          ' / SUM=ZERO — AUDITED ' + Journal.time();
        Journal.log('CLOSING ENTRY ' + no + ' — 締切 / SUM=ZERO');
        stampBtn.classList.remove('pressed');
        busy = false;
      }, 1500);
    });
  })();

  /* ================== ライブラリ退避 ================== */
  var proof = document.getElementById('heroProof');
  if (!hasLibs || reduced) {
    document.body.classList.add('no-anim');
    heroDR.set(0); heroCR.set(0);
    if (proof) proof.style.opacity = 1;
    Journal.log('LEDGER OPENED — 来訪を記帳しました');
    if (!hasLibs) return;
  }

  /* ================== Lenis ================== */
  var lenis = null;
  if (!reduced && typeof Lenis !== 'undefined') {
    lenis = new Lenis({ lerp: 0.1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function(t){ lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }
  document.querySelectorAll('a[href^="#"]').forEach(function(a){
    a.addEventListener('click', function(e){
      var target = document.querySelector(a.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { offset: -64, duration: 1.4 });
      else target.scrollIntoView({ behavior: 'smooth' });
    });
  });

  /* ================== ナビ・ルーラー・記帳トリガー ================== */
  var nav = document.getElementById('nav');
  ScrollTrigger.create({
    start: 60,
    onUpdate: function(self){ nav.classList.toggle('scrolled', self.scroll() > 60); }
  });
  var gaugeNo = document.getElementById('gaugeNo');
  var secNames = { concept:'01 CONCEPT', office:'02 OFFICE', people:'03 PEOPLE',
                   services:'04 SERVICES', tools:'05 TOOLS', console:'06 CONSOLE', contact:'07 CONTACT' };
  document.querySelectorAll('.nav-links a').forEach(function(link){
    var id = link.getAttribute('href').slice(1);
    var sec = document.getElementById(id);
    if (!sec) return;
    ScrollTrigger.create({
      trigger: sec, start: 'top 45%', end: 'bottom 45%',
      onToggle: function(self){
        link.classList.toggle('active', self.isActive);
        if (self.isActive) {
          if (gaugeNo) gaugeNo.textContent = 'No.' + secNames[id].slice(0, 2);
          Journal.log('POSTED — ' + secNames[id] + ' / DR=CR');
        }
      }
    });
  });
  var carriage = document.getElementById('gaugeCarriage');
  if (carriage) {
    gsap.to(carriage, {
      top: '92%', ease: 'none',
      scrollTrigger: { trigger: document.body, start: 'top top', end: 'max', scrub: true }
    });
  }

  if (reduced) { Journal.log('LEDGER OPENED — 来訪を記帳しました'); return; }

  /* ================== 開帳: 記帳開始 ================== */
  var openDays = Math.floor((Date.now() - new Date(1971, 0, 1).getTime()) / 86400000);
  Journal.log('LEDGER OPENED — ENTRY ' + openDays + ' / 来訪を記帳しました');

  /* ================== HERO ================== */
  var intro = gsap.timeline({ defaults: { ease: 'power4.out' } });
  intro.from('.hero-over .line',  { yPercent: 120, duration: .9 }, .15)
       .from('.hero-title .line', { yPercent: 110, duration: 1.1 }, .25)
       .from('.hero-meta, .hero-hint, .sound-toggle', { opacity: 0, duration: .8 }, .8)
       .from('.hero-bg img', { scale: 1.06, duration: 2.2, ease: 'power2.out' }, 0);

  heroDR.scramble(); heroCR.scramble();
  heroDR.set(0, { duration: 2.0, loops: 1, delay: .6,  stagger: .09 });
  heroCR.set(0, { duration: 2.0, loops: 1, delay: .75, stagger: .09 });
  gsap.fromTo('#heroProof', { opacity: 0 }, { opacity: 1, duration: .5, delay: 3.3 });
  gsap.fromTo('.hero-proof .proof-seal',
    { scale: 1.5, opacity: 0, rotation: -8 },
    { scale: 1, opacity: 1, rotation: -3, duration: .45, delay: 3.35, ease: 'power4.out' });

  gsap.to('.hero-bg img', {
    yPercent: 9, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
  });
  gsap.to('.hero-type', {
    yPercent: -14, opacity: .25, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom 30%', scrub: true }
  });

  /* ================== 汎用リビール ================== */
  gsap.utils.toArray('.reveal').forEach(function(el){
    gsap.from(el, {
      y: 28, opacity: 0, duration: 1, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%' }
    });
  });

  /* ================== 01 CONCEPT ================== */
  var rules = gsap.timeline({ scrollTrigger: { trigger: '.balance-rules', start: 'top 85%' } });
  rules.from('.rule-l', { scaleX: 0, duration: 1.2, ease: 'power3.inOut' }, 0)
       .from('.rule-r', { scaleX: 0, duration: 1.2, ease: 'power3.inOut' }, 0)
       .from('.rule-pivot', { opacity: 0, duration: .5 }, .9);

  /* ================== 歯車設置 ================== */
  var slotC = document.querySelector('.gear-slot-concept');
  if (slotC) {
    slotC.innerHTML = gearSVG(26, 290, { spokes: 6 });
    gsap.to(slotC.firstChild, {
      rotation: 80, ease: 'none',
      scrollTrigger: { trigger: '#concept', start: 'top bottom', end: 'bottom top', scrub: 1 }
    });
  }
  var slotT = document.querySelector('.gear-slot-tools');
  if (slotT) {
    slotT.innerHTML = gearSVG(24, 190, { spokes: 5 }) + gearSVG(14, 114, { spokes: 4, phase: .4 });
    var g1 = slotT.children[0], g2 = slotT.children[1];
    g2.classList.add('gear-b');
    var ratio = 24 / 14;
    ScrollTrigger.create({
      trigger: '#tools', start: 'top bottom', end: 'bottom top', scrub: 1,
      onUpdate: function(self){
        var r = self.progress * 140;
        gsap.set(g1, { rotation: r });
        gsap.set(g2, { rotation: -r * ratio + 360 / 14 / 2 });
      }
    });
  }

  /* ================== 04 SERVICES: 真鍮歯車フォト回転 ================== */
  var gearPhoto = document.querySelector('.gear-photo img');
  if (gearPhoto) {
    gsap.to(gearPhoto, {
      rotation: 120, ease: 'none',
      scrollTrigger: { trigger: '#services', start: 'top bottom', end: 'bottom top', scrub: 1 }
    });
  }

  /* ================== 03 PEOPLE ================== */
  gsap.utils.toArray('.plate').forEach(function(plate, i){
    gsap.from(plate, {
      clipPath: 'inset(0 100% 0 0)', x: -24, duration: 1.2, delay: i * .15,
      ease: 'power3.inOut',
      scrollTrigger: { trigger: '.plates', start: 'top 80%' }
    });
  });

  /* ================== 04 SERVICES ================== */
  gsap.from('.svc-card', {
    y: 56, opacity: 0, duration: 1, stagger: .09, ease: 'power3.out',
    scrollTrigger: { trigger: '.svc-grid', start: 'top 82%' }
  });

  /* ================== パララックス ================== */
  gsap.utils.toArray('[data-parallax]').forEach(function(img){
    gsap.fromTo(img, { yPercent: -7 }, {
      yPercent: 7, ease: 'none',
      scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true }
    });
  });

  /* ================== 05 TOOLS: 検査光 ================== */
  gsap.fromTo('.sweep',
    { backgroundPosition: '120% 0' },
    {
      backgroundPosition: '-20% 0', ease: 'none',
      scrollTrigger: { trigger: '.sec-tools', start: 'top 70%', end: 'bottom 30%', scrub: true }
    });

  /* ================== 07 CONTACT ================== */
  gsap.fromTo('#contactSeal',
    { scale: 1.4, opacity: 0, rotation: -9 },
    {
      scale: 1, opacity: 1, rotation: -3, duration: .5, ease: 'power4.out',
      scrollTrigger: {
        trigger: '.contact-proof', start: 'top 88%',
        onEnter: function(){ SFX.thunk(); Journal.log('COUNTER OPEN — TEL 0573-65-5054'); }
      }
    });
  gsap.from('.contact-proof .engrave', {
    opacity: 0, duration: 1, delay: .35,
    scrollTrigger: { trigger: '.contact-proof', start: 'top 88%' }
  });

  /* ================== カーソル ================== */
  if (fine && window.innerWidth > 900) {
    var cur = document.getElementById('cursor');
    cur.classList.add('alive');
    var qx = gsap.quickTo(cur, 'x', { duration: .22, ease: 'power3.out' });
    var qy = gsap.quickTo(cur, 'y', { duration: .22, ease: 'power3.out' });
    window.addEventListener('mousemove', function(e){ qx(e.clientX); qy(e.clientY); });
    document.querySelectorAll('a, button').forEach(function(t){
      t.addEventListener('mouseenter', function(){ cur.classList.add('is-link'); });
      t.addEventListener('mouseleave', function(){ cur.classList.remove('is-link'); });
    });
  }

  /* ================== 暇な帳簿は静かに均衡を告げる ================== */
  setInterval(function(){
    if (document.visibilityState === 'visible') Journal.log('BALANCE HELD — 0.000000');
  }, 50000);

})();
