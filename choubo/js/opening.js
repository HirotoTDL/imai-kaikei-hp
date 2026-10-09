/* オープニング — 渦（Twirl）→ 紙がうねってめくれる（Cloth / Page curl）→ 帳簿と人物のスタッガー
   設計 = docs/motion.md C-1。引用元: goodpatch 15th の渦と布（色は帳簿HPのくすみ色に置換）、NSL の時間差登場。
   守ること:
   - 電話番号・キャッチ・CTA は演出と独立して 3.0 秒までに見える（ヘッダーは最初から）
   - 初回のみ（sessionStorage）／reduced-motion・WebGL不可・読込失敗なら即最終状態
   - 8 秒で必ず幕を外す（どんな失敗でも本文を隠し続けない）
   - ?op=秒 で任意の時刻に止めて撮れる（検収用） */
(function () {
  'use strict';
  var d = document, root = d.documentElement;
  var hero = d.querySelector('.hero');
  var cv = d.getElementById('opening');
  if (!hero) return;

  var qs = location.search;
  var hold = /[?&]op=([\d.]+)/.exec(qs);             // 検収: その秒で止める
  var force = /[?&]op=/.test(qs) || /[?&]opening=1/.test(qs);
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var seen = false;
  try { seen = sessionStorage.getItem('choubo-op') === '1'; } catch (_) {}

  function finish() {
    root.classList.remove('is-opening');
    root.classList.add('is-opened');
    if (cv && cv.parentNode) cv.parentNode.removeChild(cv);
    try { sessionStorage.setItem('choubo-op', '1'); } catch (_) {}
  }
  if (!cv || reduce || (seen && !force)) { stagger(true); finish(); return; }

  // ---------- 人物・小物のスタッガー（NSL 実測: 0.11秒間隔・60pxせり上がり・0.44秒） ----------
  function stagger(instant) {
    var items = Array.prototype.slice.call(hero.querySelectorAll('[data-layer]'));
    items.sort(function (a, b) { return (+a.dataset.order || 0) - (+b.dataset.order || 0); });
    items.forEach(function (el, i) {
      if (instant) { el.classList.add('is-in'); return; }
      el.style.transitionDelay = (i * 0.11).toFixed(2) + 's';
      el.classList.add('is-in');
    });
  }

  // ---------- WebGL ----------
  // 検収で止めて撮るときだけ描画バッファを残す（ヘッドレスの撮影で真っ白になるため）
  var gl = cv.getContext('webgl', { premultipliedAlpha: false, antialias: true, preserveDrawingBuffer: !!hold });
  if (!gl) { stagger(true); finish(); return; }
  var safety = setTimeout(function () { stagger(true); finish(); }, 8000);

  var VS = [
    'attribute vec2 a;',            // 0..1 の格子
    'uniform float peel, wave, aspect;',
    'varying vec2 uv; varying float shade;',
    'void main(){',
    '  uv = a;',
    '  vec2 p = a*2.0-1.0;',
    // 布のうねり: 横に走る波。めくれが進むほど大きく
    '  float w = sin(a.x*6.0 + wave*6.2831)*0.04 + sin(a.y*4.0 - wave*4.0)*0.03;',
    '  w *= (0.3 + peel*1.6);',
    // めくれ: 右下の角から左上へ。角に近い点ほど早く持ち上がる
    '  float lag = clamp(peel*1.8 - (1.0-a.x)*0.55 - a.y*0.45, 0.0, 1.0);',
    '  float lift = lag*lag;',
    '  p.y += lift*2.6 + w;',
    '  p.x -= lift*0.9;',
    '  float z = 1.0 + lift*1.2 - w*2.0;',
    '  shade = clamp(0.92 + w*3.0 - lift*0.25, 0.55, 1.08);',
    '  gl_Position = vec4(p/z, 0.0, 1.0);',
    '}'].join('\n');
  var FS = [
    'precision mediump float;',
    'uniform sampler2D tex; uniform float t, aspect, alpha;',
    'varying vec2 uv; varying float shade;',
    'void main(){',
    '  vec2 c = uv - 0.5; c.x *= aspect;',
    '  float r = length(c), ang = atan(c.y, c.x);',
    // 渦: 中心ほど強くねじれ、時間とともに回りながら吸い込まれる
    '  ang += (1.0 - r) * (0.9 + t*2.6) + t*1.6;',          // 落ち着いた渦: ねじれは控えめに、回転はゆっくり
    '  float rr = r * (1.0 + t*0.25);',
    '  vec2 s = vec2(cos(ang), sin(ang)) * rr; s.x /= max(aspect, 1.0);',
    '  vec4 col = texture2D(tex, s*0.62 + 0.5);',           // 元絵の渦がほぼ全部見える倍率
    '  float vig = smoothstep(0.0, 0.10, r);',                 // 中心は深い色へ
    '  col.rgb = mix(vec3(0.78,0.56,0.16), col.rgb, vig);',
    '  gl_FragColor = vec4(col.rgb*shade, alpha);',
    '}'].join('\n');

  function sh(type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  var prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    gl.useProgram(prog);
  } catch (e) { clearTimeout(safety); stagger(true); finish(); return; }

  // 40×40 の格子（三角形ストリップの代わりに三角形リスト）
  var N = 40, pts = [];
  for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
    var x0 = x / N, x1 = (x + 1) / N, y0 = y / N, y1 = (y + 1) / N;
    pts.push(x0, y0, x1, y0, x0, y1, x1, y0, x1, y1, x0, y1);
  }
  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pts), gl.STATIC_DRAW);
  var aLoc = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(aLoc);
  gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);
  var U = {};
  ['peel', 'wave', 'aspect', 't', 'alpha', 'tex'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  function size() {
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    cv.width = Math.round(cv.clientWidth * dpr);
    cv.height = Math.round(cv.clientHeight * dpr);
    gl.viewport(0, 0, cv.width, cv.height);
  }

  var img = new Image();
  img.onerror = function () { clearTimeout(safety); stagger(true); finish(); };
  img.onload = function () {
    var tx = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tx);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
    size();
    root.classList.add('is-opening');
    run();
  };
  img.src = cv.getAttribute('data-tex');

  // 拍（秒）: 渦 0.2–1.6 / めくれ 1.6–2.3 / 帳簿 2.3 / 人物 2.5〜
  var T_SWIRL0 = 0.2, T_PEEL0 = 1.6, T_PEEL1 = 2.3;
  var easeIO = function (x) { return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  var clamp = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };

  function draw(s) {
    var ts = clamp((s - T_SWIRL0) / (T_PEEL1 - T_SWIRL0));
    var pe = easeIO(clamp((s - T_PEEL0) / (T_PEEL1 - T_PEEL0)));
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(U.t, ts);
    gl.uniform1f(U.peel, pe);
    gl.uniform1f(U.wave, s * 0.8);
    gl.uniform1f(U.aspect, cv.width / cv.height);
    gl.uniform1f(U.alpha, clamp((s - 0.0) / T_SWIRL0 * 1.0));
    gl.drawArrays(gl.TRIANGLES, 0, pts.length / 2);
  }

  var stage = 0;
  function cue(s) {
    if (stage < 1 && s >= T_PEEL0 + 0.1) { stage = 1; root.classList.add('is-book'); } // めくれの下から帳簿がせり上がる
    if (stage < 2 && s >= T_PEEL1) { stage = 2; stagger(false); }                      // 人物が0.11秒ずつ
    if (stage < 3 && s >= T_PEEL1 + 0.1) { stage = 3; cv.style.opacity = '0'; }
  }

  function run() {
    if (hold) {
      var s = +hold[1];
      draw(s); cue(s);
      clearTimeout(safety);
      return;                                                                           // 検収用に止める
    }
    var t0 = performance.now();
    (function loop(now) {
      var s = (now - t0) / 1000;
      draw(s); cue(s);
      if (s < T_PEEL1 + 0.4) requestAnimationFrame(loop);
      else { clearTimeout(safety); finish(); }
    })(t0);
  }
  addEventListener('resize', function () { if (cv.isConnected) size(); });

  // スキップ
  var skip = d.querySelector('.op-skip');
  if (skip) skip.addEventListener('click', function () { clearTimeout(safety); stagger(true); finish(); });
})();
