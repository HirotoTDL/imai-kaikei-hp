/* ===================================================================
   cards.js — サービス6領域（design.md §8-C M2・2026-07-30 全面改訂）

   ★スティッキー＋スナップの「カードが積み上がる」見せ方は撤去した。
     520vh のあいだスクロールを固定する作りは、閲覧者からスクロールを奪う。
     それ自体がストレスで、ページ全体の使い勝手を落とす（ユーザー指摘）。

   採る形: **編集的な行組み**。
     ・6領域を全幅の行として素直に並べる（等間隔の3カラムカードにはしない。§0-3）
     ・番号と英字ラベルを大きく置いて、紙面のリズムを作る
     ・出現は ui.js の共通演出（下から立ち上がる clip）に任せる＝自分の時間で動く
     ・上部の一覧は「飛べる目次」。押した場所へ素直に移動する（固定も逆算も不要）
   これで固定・スナップ・逆算が全部要らなくなり、読み手が主導権を持つ。
   =================================================================== */
(function () {
  'use strict';

  var SERVICES = [
    { no: '01', label: '— MONTHLY',  ja: '税務顧問',               en: 'Tax Advisory',            txt: '毎月の帳簿チェックから決算・申告まで、丸ごとお任せ。「税務署からの連絡が怖い」——そんな不安から解放されます。' },
    { no: '02', label: '— FAMILY',   ja: '相続税・贈与税対策',     en: 'Inheritance &amp; Gift Tax', txt: '「うちにも相続税がかかるの？」その疑問、まず聞かせてください。ご家族の状況に合わせて、早めの対策を<span class="nb">ご一緒に考えます。</span>' },
    { no: '03', label: '— LEGACY',   ja: '事業承継支援',           en: 'Business Succession',     txt: '大切に育ててきた事業を、次の世代へ。「いつから準備すればいい？」<span class="nb">その段階からお手伝いします。</span>' },
    { no: '04', label: '— STARTUP',  ja: '会社設立・創業支援',     en: 'Incorporation',           txt: '「自分で会社を作りたい」その想い、応援します。届出から融資の相談まで、創業の不安を一つずつ解消していきましょう。' },
    { no: '05', label: '— CLOUD',    ja: 'クラウド会計導入支援',   en: 'Cloud Accounting',        txt: '「パソコンは苦手で…」という方もご安心ください。あなたに合ったソフト選びから使い方まで、丁寧にお教えします。' },
    { no: '06', label: '— ADVISORY', ja: '経営相談・資金繰り支援', en: 'Management Consulting',   txt: '資金繰りの不安、一人で抱えていませんか？数字の読み方から融資の相談まで、経営者のそばで一緒に考えます。' }
  ];

  function build() {
    var m = document.querySelector('.stack-mount[data-stack]');
    if (!m) return null;

    var rows = SERVICES.map(function (s, i) {
      return '<article class="svc__row" id="svc-top-' + s.no + '">' +
        '<div class="svc__mark"><span class="svc__no">' + s.no + '</span>' +
          '<span class="svc__label">' + s.label + '</span></div>' +
        '<div class="svc__body">' +
          '<h3 class="svc__h3">' + s.ja + '</h3>' +
          '<span class="svc__en">' + s.en + '</span>' +
          '<p class="svc__txt">' + s.txt + '</p>' +
          '<a class="svc__more" href="services.html#svc-' + s.no + '">' +
            s.ja + 'の詳しい内容を見る</a>' +
        '</div></article>';
    }).join('');

    var nav = SERVICES.map(function (s) {
      return '<li><a class="svc__jump" href="#svc-top-' + s.no + '">' +
        '<span class="svc__jno">' + s.no + '</span>' +
        '<span class="svc__jja">' + s.ja + '</span></a></li>';
    }).join('');

    m.innerHTML = '<section class="svc" data-dark>' +
      '<div class="svc__in">' +
        '<div class="svc__head">' +
          '<span class="svc__eyebrow">' + (m.getAttribute('data-eyebrow') || '') + '</span>' +
          '<h2 class="svc__h2">' + (m.getAttribute('data-heading') || '') + '</h2>' +
          '<p class="svc__lead">' + (m.getAttribute('data-lead') || '') + '</p>' +
          '<ol class="svc__index" aria-label="サービスの一覧">' + nav + '</ol>' +
        '</div>' +
        '<div class="svc__rows">' + rows + '</div>' +
        '<div class="svc__foot">' +
          '<a class="svc__link" href="services.html">サービス一覧を見る</a></div>' +
      '</div></section>';
    return m.querySelector('.svc');
  }

  function boot() { build(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
