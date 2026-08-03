/* ===================================================================
   下層ページ共通の挙動
   ・ドロワー（SP）
   ・in-view リビール（design.md §8-C M4）
   ★下層は舞台（fixed のキャラクター）を持たない。トップだけの特権にする
   =================================================================== */
(function () {
  'use strict';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var q = function (s) { return document.querySelector(s); };

  /* ---------- ドロワー ---------- */
  var drawer = q('#drawer'), burger = q('#hamburger'), close = q('#drawer-close');
  function open() {
    if (!drawer) return;
    drawer.hidden = false;
    if (burger) burger.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    var f = drawer.querySelector('button,a'); if (f) f.focus();
  }
  function shut() {
    if (!drawer || drawer.hidden) return;
    drawer.hidden = true;
    if (burger) { burger.setAttribute('aria-expanded', 'false'); burger.focus(); }
    document.body.style.overflow = '';
  }
  if (burger) burger.addEventListener('click', function () { drawer && drawer.hidden ? open() : shut(); });
  if (close) close.addEventListener('click', shut);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') shut(); });



  /* ---------- お問い合わせフォーム ----------
     ★実測（2026-07-31）: 送信すると Google Apps Script の素っ気ない応答ページへ飛び、
       用意した送信完了ページ（thanks.html）に**一度もたどり着けなかった**。
     裏側（GAS）は触らず、こちら側で送ってから完了ページへ移す。
     ★JSが動かないときは、そのまま普通の送信になる（送信自体は必ず成立する）。 */
  var form = q('.form');
  if (form && window.fetch && window.FormData) {
    form.addEventListener('submit', function (e) {
      if (typeof form.reportValidity === 'function' && !form.reportValidity()) return;
      e.preventDefault();
      var btn = form.querySelector('button[type="submit"]');
      var label = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.textContent = '送信しています…'; }
      var back = function () {
        if (btn) { btn.disabled = false; btn.textContent = label; }
      };
      fetch(form.action, { method: 'POST', body: new FormData(form), mode: 'no-cors' })
        .then(function () { location.href = form.getAttribute('data-thanks') || 'thanks.html'; })
        .catch(function () {
          /* 通信に失敗したら、普通の送信に切り替える。
             GASの応答ページへ飛ぶが、送信が消えるよりよい */
          back();
          form.removeEventListener('submit', arguments.callee);
          form.submit();
        });
    });
  }

  /* ---------- 地図は近づいてから読む ----------
     ★実測（2026-07-31・全ページ一括計測でようやく気づいた）:
       アクセスのページだけ 1,016KB・性能65 で、他のページ（88〜94）から大きく外れていた。
       原因は埋め込み地図で、**Googleの外部スクリプトを59件・約400KB**
       初回から読んでいた。
     ★`loading="lazy"` は付けてあるが効いていない。しきい値（画面から約1250px）
       の内側に地図があるため、結局最初に読まれる。
     見た目は変えずに、**本当に近づいてから**読み込ませる。
     サイト内の他の重い素材（川の場面）と同じ考え方。 */
  var map = q('.map[data-src], iframe.map');
  if (map) {
    var real = map.getAttribute('data-src') || map.getAttribute('src');
    if (real) {
      map.removeAttribute('src');
      map.setAttribute('data-src', real);
      var loaded = false;
      var near = function () {
        if (loaded) return;
        var r = map.getBoundingClientRect();
        if (r.top < window.innerHeight * 1.4 && r.bottom > -window.innerHeight) {
          loaded = true;
          map.setAttribute('src', real);
          window.removeEventListener('scroll', near);
          window.removeEventListener('resize', near);
        }
      };
      window.addEventListener('scroll', near, { passive: true });
      window.addEventListener('resize', near);
      near();
    }
  }

  /* ★ここにあった独自の出現演出（IntersectionObserver + opacity:0）は撤去した。
     理由は2つ。
       ① ui.js の出現演出と二重に効いていた
       ② IntersectionObserver が発火しないと **本文が opacity:0 のまま残る**。
          保険も「その時点で画面内にあるもの」しか救わないため、
          画面外の本文は永久に出ないままだった（2026-07-29 実測。
          about.html の 4ブロックが opacity:0 で真っ白だった）
     出現演出は ui.js に一本化する（スクロールと rAF で自前に判定し、
     2.5秒の保険で必ず全部出す）。 */
})();
