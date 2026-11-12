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
  var onScroll = function () { if (hdr) hdr.classList.toggle('is-scrolled', scrollY - (window.__filmPin || 0) > 8); };
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

  // ヒーローの登場（NSL 実測: 人物・小物が 0.11 秒ずつ・60px せり上がり）。キャッチと電話は最初から出ている
  // ★入場フィルムの間は待ち、本編が溶けはじめた所でせり上がる
  var hl = qa('.hero__l').sort(function (a, b) { return (+a.dataset.order || 0) - (+b.dataset.order || 0); });
  var heroDone = false;
  var heroIn = function (base) {
    if (heroDone) return;
    heroDone = true;
    hl.forEach(function (el, i) {
      if (reduce) { el.classList.add('is-in'); return; }
      el.style.transitionDelay = (base + i * 0.11).toFixed(2) + 's';
      requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('is-in'); }); });
    });
  };

  // ---- ヒーローの事務所紹介フィルム ----
  // 背景: 背景用カットを濃さ 56% で流し続ける（最初の表示が済んでから読み込む・画面外では止める・右下のボタンで止められる）
  // 入場: 入った直後は本編をヒーローいっぱいに見せ、スクロールすると本編が薄れて背景用カットとキャッチに入れ替わる
  //       一周したら自動で溶ける。溶けたあとは右上の「紹介動画を見る」でもう一度見られる
  // ★動きを減らす設定・通信量節約・JSなしでは出さない（いつものヒーローのまま）
  var hero = q('.hero'), pin = q('.hero-pin'), film = q('.hero__film'), fbtn = q('.hero__film-btn');
  var ibox = q('.hero__intro'), iv = ibox && q('video', ibox), hint = q('.hero__hint'), rbtn = q('.hero__replay');
  var conn = navigator.connection || {};
  var filmOK = !!film && !reduce && !conn.saveData && !/(^|-)2g$/.test(conn.effectiveType || '');
  var introOK = filmOK && !!pin && !!iv;
  if (!introOK || !root.classList.contains('film-intro')) { root.classList.remove('film-intro'); heroIn(0.35); }

  if (filmOK) {
    var off = false, seen = true, loaded = false, bgGo = false;
    var mode = root.classList.contains('film-intro') ? 'intro' : 'bg';   // intro = 本編を見せている／bg = いつものヒーロー
    var P = 0, S = 0, done = false, anim = 0, live = false, waitT = 0, idleT = 0, syncT = 0;
    try { off = localStorage.getItem('film') === 'off'; } catch (_) {}
    var play = function (v) { var pl = v.play(); if (pl && pl.catch) pl.catch(function () {}); };
    var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };

    // 背景用カット
    var sync = function () {
      if (fbtn) {
        fbtn.hidden = false;
        fbtn.setAttribute('aria-pressed', off ? 'true' : 'false');
        fbtn.setAttribute('aria-label', off ? '背景の動画を再生する' : '背景の動画を止める');
      }
      if (off || !seen) { if (loaded) film.pause(); if (off) film.classList.remove('is-on'); return; }
      if (!loaded) {
        loaded = true;
        var hr = hero.getBoundingClientRect();
        film.src = film.getAttribute(hr.height > hr.width * 0.9 ? 'data-p-src' : 'data-src');   // 縦長の画面には縦のフィルム
        film.addEventListener('playing', function () { if (!off) film.classList.add('is-on'); });
      }
      play(film);
    };
    var startBg = function () { if (!bgGo) { bgGo = true; sync(); } };
    if (fbtn) fbtn.addEventListener('click', function () {
      off = !off;
      try { localStorage.setItem('film', off ? 'off' : 'on'); } catch (_) {}
      sync();
    });

    // 入場（本編）
    var label = function () {
      if (!rbtn) return;
      rbtn.hidden = false;
      q('.hero__replay-t', rbtn).textContent = mode === 'intro' ? '動画を閉じる' : '紹介動画を見る';
    };
    var setP = function (v) {
      P = v;
      hero.style.setProperty('--p', v.toFixed(3));
      if (v > 0.22) heroIn(0.05);
    };
    // 本編と背景用カットは同じ30秒。背景側の速さをわずかに変えて同じ時刻に寄せる（入れ替わる瞬間に絵がずれない）
    var follow = function () {
      if (mode !== 'intro' || !loaded || film.paused || iv.paused || !film.duration) return;
      var dl = iv.currentTime - film.currentTime, L = film.duration;
      if (dl > L / 2) dl -= L; else if (dl < -L / 2) dl += L;
      film.playbackRate = 1 + clamp(dl * 0.5, -0.12, 0.12);
    };
    var unpin = function () {
      var y = scrollY;
      mode = 'bg'; live = false;
      clearInterval(syncT); film.playbackRate = 1;
      root.classList.remove('film-intro');
      window.__filmPin = 0;
      scrollTo(0, Math.max(0, y - S));              // 留めていたぶんを畳む（見えている位置は変わらない）
      hero.style.removeProperty('--p');
      iv.pause(); iv.classList.remove('is-on');
      if (hint) hint.hidden = true;
      heroIn(0.05); label(); startBg();
    };
    // スクロールが止まってから畳む（動いている最中に位置を書き換えると指の勢いが切れる）
    var settle = function () { clearTimeout(idleT); idleT = setTimeout(unpin, 180); };
    var dissolve = function () {                      // スクロールなしで溶かす（一周した・閉じた・始まらなかった）
      if (done || mode !== 'intro') return;
      done = true;
      clearTimeout(waitT);
      var p0 = P, t0 = performance.now(), dur = 1300 * (1 - p0) + 200;
      var step = function (now) {
        var k = clamp((now - t0) / dur, 0, 1), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        setP(p0 + (1 - p0) * e);
        if (k < 1) anim = requestAnimationFrame(step); else { anim = 0; unpin(); }
      };
      anim = requestAnimationFrame(step);
    };
    var enter = function (again) {
      mode = 'intro'; done = false; live = false;
      S = Math.round(innerHeight * 0.7);
      pin.style.setProperty('--pin', S + 'px');
      window.__filmPin = S;
      root.classList.add('film-intro');
      // 見えている範囲の形（幅÷高さ）にいちばん近い本編を選ぶ
      var hr = hero.getBoundingClientRect(), vh = Math.min(hr.height, innerHeight - hr.top - (innerWidth < 1024 ? 60 : 0));
      var want = Math.log(hr.width / Math.max(vh, 1)), src = '', best = 9;
      Array.prototype.forEach.call(iv.attributes, function (at) {
        var m = /^data-r(\d+)-src$/.exec(at.name);
        if (!m) return;
        var df = Math.abs(Math.log(+m[1] / 100) - want);
        if (df < best) { best = df; src = at.value; }
      });
      if (iv.getAttribute('src') !== src) iv.src = src;
      if (again) {
        scrollTo(0, 0);
        try { iv.currentTime = 0; if (loaded) film.currentTime = 0; } catch (_) {}
        var p0 = 1, t0 = performance.now();
        var back = function (now) {                   // いつものヒーロー → 本編へ戻す
          var k = clamp((now - t0) / 700, 0, 1);
          if (!done) setP(p0 * (1 - k) * (1 - k));
          if (k < 1 && !done) anim = requestAnimationFrame(back); else { anim = 0; live = !done; }
        };
        setP(1); anim = requestAnimationFrame(back);
      } else { setP(0); live = true; }
      label();
      play(iv);
      clearTimeout(waitT);
      waitT = setTimeout(function () { if (!iv.classList.contains('is-on')) dissolve(); }, 4500);   // 始まらなければ、いつものヒーローへ
      clearInterval(syncT); syncT = setInterval(follow, 400);
    };
    if (introOK) {
      iv.addEventListener('playing', function () {
        if (mode !== 'intro') { iv.pause(); return; }
        window.__filmGo = true;
        iv.classList.add('is-on');
        if (hint && !done) hint.hidden = false;
        try { sessionStorage.setItem('film-seen', '1'); } catch (_) {}
        if (!off) startBg();
      });
      iv.addEventListener('ended', dissolve);
      addEventListener('scroll', function () {
        if (mode !== 'intro') return;
        if (done) { if (!anim) settle(); return; }
        if (!live) return;
        setP(clamp(scrollY / S, 0, 1));
        if (P >= 1) { done = true; clearTimeout(waitT); settle(); }
      }, { passive: true });
      if (hint) hint.addEventListener('click', dissolve);
      if (rbtn) rbtn.addEventListener('click', function () { if (mode === 'intro') dissolve(); else enter(true); });
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        seen = es[0].isIntersecting;
        if (mode === 'intro' && iv.classList.contains('is-on') && !done) { if (seen) play(iv); else iv.pause(); }
        if (bgGo) sync();
      }, { threshold: 0.05 }).observe(hero);
    }
    if (mode === 'intro') { enter(false); }
    else {
      var go = function () { setTimeout(function () { startBg(); if (introOK) label(); }, 400); };
      if (d.readyState === 'complete') go(); else addEventListener('load', go);
    }
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
