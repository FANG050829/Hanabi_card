/* ============================================================
 * 花火贺卡 · player.js
 * 播放器：解析配置（#hash 或导出文件内嵌），编排整个播放流程——
 *   信封/礼盒开场 → 称呼竖排亮起 → 标题逐字弹出 + 金线描画
 *   → 祝福语打字机 → 互动（生日吹蜡烛；任意场景点屏赠心）
 *   → 署名 + 花火印盖落
 * 音乐：页面不内置任何音频；仅当制作者上传了自己的音乐
 *   （链接内嵌小音频 / 导出文件内嵌完整音频）时播放。
 * 右上角"跳过"随时直达结尾；编辑器预览通过 postMessage 热更新。
 * ============================================================ */
(function () {
  'use strict';
  var C = window.Hanabi.Config;
  var TH = window.Hanabi.Themes;

  var REDUCED = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* 编辑器内嵌预览模式：?preview=1 */
  var PREVIEW = /[?&]preview=1/.test(location.search);

  /* 配置来源优先级：导出文件内嵌 > 链接 hash > 默认演示。
   * 密语卡（k1. 加密代码）先按默认演示呈现，答对密语后才换真配置。 */
  var cfg;
  var cfgCode = ''; // 配置编码原文：帖号与签语都由它推导
  var locked = false;
  var gateOn = false; // 定时门是否盖着
  (function () {
    var embed = window.__HANABI_EMBED__;
    if (embed && typeof embed.code === 'string' && embed.code) {
      cfgCode = embed.code;
      if (!PREVIEW && C.isLockedCode(cfgCode)) { locked = true; cfg = C.defaults(); return; }
      cfg = C.fromHash('#' + cfgCode);
      /* 导出文件里的音乐不受链接体积限制，直接采信 */
      if (typeof embed.music === 'string' && embed.music.indexOf('data:audio/') === 0) {
        cfg.music = embed.music;
      }
    } else {
      cfgCode = location.hash.replace(/^#/, '');
      if (!PREVIEW && C.isLockedCode(cfgCode)) { locked = true; cfg = C.defaults(); return; }
      cfg = C.fromHash(location.hash);
    }
  })();

  function $(id) { return document.getElementById(id); }
  var el = {
    stage: $('stage'),
    to: $('toLine'),
    title: $('cardTitle'),
    titleStroke: $('titleStroke'),
    orn: $('ornDiv'),
    msg: $('cardMsg'),
    msgWrap: $('msgWrap'),
    photoWrap: $('photoWrap'),
    photoImg: $('photoImg'),
    photoFig: $('photoFig'),
    photoCount: $('photoCount'),
    letterWrap: $('letterWrap'),
    letterFrame: $('letterFrame'),
    cakeWrap: $('cakeWrap'),
    cake: $('cake'),
    blow: $('blowBtn'),
    signRow: $('signRow'),
    sig: $('sigEl'),
    signCanvas: $('signCanvas'),
    fortune: $('fortuneEl'),
    seal: $('sealEl'),
    actions: $('endActions'),
    skip: $('skipBtn'),
    mute: $('muteBtn'),
    hint: $('hintEl'),
    overlay: $('openOverlay'),
    env: $('envObj'),
    gift: $('giftObj'),
    envLetterTo: $('envLetterTo'),
    lockPass: $('lockPass'),
    lockGo: $('lockGo'),
    lockBox: $('lockBox'),
    timeGate: $('timeGate'),
    tgWhen: $('tgWhen'),
    tgD: $('tgD'),
    tgH: $('tgH'),
    tgM: $('tgM'),
    tgS: $('tgS'),
    oracle: $('oracle'),
    oracleCup: $('oracleCup'),
    oracleHint: $('oracleHint'),
    blindBox: $('blindBox'),
    doodleSvg: $('doodleSvg'),
    spectrumCv: $('spectrumCv'),
    muyu: $('muyu'),
    muyuCount: $('muyuCount'),
    koiSvg: $('koiSvg'),
    crackSvg: $('crackSvg'),
    scratchCard: $('scratchCard'),
    scratchCv: $('scratchCv'),
    scratchTo: $('scratchTo'),
    scratchTitle: $('scratchTitle'),
    fogCv: $('fogCv'),
    gateSlider: $('gateSlider'),
    gsTrack: $('gsTrack'),
    gsFill: $('gsFill'),
    gsThumb: $('gsThumb'),
    canvas: $('fx'),
    replay: $('replayBtn'),
    make: $('makeBtn'),
    edition: $('editionEl'),
    openEdition: $('openEditionEl')
  };

  /* ---------- 流程定时器集中管理，跳过/热更新时全部撤销 ---------- */
  var flow = { timers: [] };
  var typing = null;          // 打字机 interval
  var opened = false;         // 是否已点开信封/礼盒
  var blown = false;          // 蜡烛是否已吹灭
  var ended = false;          // 是否已到结尾
  var fx = null;              // 粒子引擎实例

  function later(fn, ms) {
    var id = setTimeout(fn, ms);
    flow.timers.push(id);
    return id;
  }
  function clearFlow() {
    flow.timers.forEach(function (t) { clearTimeout(t); });
    flow.timers.length = 0;
    if (typing) { clearInterval(typing); typing = null; }
  }

  /* ---------- 通用小工具（与 effects.js 同名同义） ---------- */
  var TAU = Math.PI * 2;
  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* 颜色混合：把 a 向 b 拉近 ratio（0~1），用于派生背景层次 */
  function mixHex(a, b, ratio) {    function ch(h, i) {
      h = String(h).replace('#', '');
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      return parseInt(h.substr(i * 2, 2), 16);
    }
    var r = Math.round(ch(a, 0) + (ch(b, 0) - ch(a, 0)) * ratio);
    var g = Math.round(ch(a, 1) + (ch(b, 1) - ch(a, 1)) * ratio);
    var bl = Math.round(ch(a, 2) + (ch(b, 2) - ch(a, 2)) * ratio);
    function hx(n) { var s = n.toString(16); return s.length < 2 ? '0' + s : s; }
    return '#' + hx(r) + hx(g) + hx(bl);
  }

  /* ============================================================
   * 自定义音乐与语音：没有内置音频，只播放制作者的准备。
   * 有语音时：点开信封先闻其声，语音结束后音乐才起；
   * 播放须在用户手势之后启动（点按开场即手势，兼容微信/ iOS）。
   * ============================================================ */
  var bgAudio = null;
  function audioStart() {
    if (PREVIEW || cfg.music === 'off') return;
    try {
      if (!bgAudio) {
        bgAudio = new Audio(cfg.music);
        bgAudio.loop = true;
        bgAudio.volume = 0.55;
      }
      var p = bgAudio.play();
      if (p && p.catch) p.catch(function () { /* 自动播放被拦时保持静默 */ });
      el.mute.classList.add('show');
      /* 音频真正就位后，频谱分析才有东西可接（幂等，可反复调） */
      setupSpectrum();
    } catch (e) { /* 忽略 */ }
  }
  /* 播放语音祝福；结束（或失败）后 resolve，由调用方接上音乐 */
  function playVoice() {
    if (PREVIEW || cfg.voice === 'off') return Promise.resolve(false);
    return new Promise(function (resolve) {
      try {
        var a = new Audio(cfg.voice);
        a.volume = 1;
        var done = false;
        var fallback = 0;
        function finish(ok) {
          if (done) return;
          done = true;
          clearTimeout(fallback);
          resolve(ok);
        }
        a.onended = function () { finish(true); };
        a.onerror = function () { finish(false); };
        var p = a.play();
        if (p && p.catch) p.catch(function () { finish(false); });
        /* 10 秒兜底只防"压根没播起来"（解码卡死等极端情况）：
         * 只要声音真正响过就交给 onended，长语音不再被中途掐断混入音乐 */
        fallback = setTimeout(function () {
          if (!a.paused || a.currentTime > 0) return;
          finish(false);
        }, 10000);
      } catch (e) { resolve(false); }
    });
  }
  function audioToggle() {
    if (PREVIEW || cfg.music === 'off') return null;
    if (!bgAudio) { audioStart(); return true; }
    if (bgAudio.paused) {
      var p = bgAudio.play();
      if (p && p.catch) p.catch(function () {});
      return true;
    }
    bgAudio.pause();
    return false;
  }

  /* ============================================================
   * 主题 / 字体 / 粒子：每次配置变化都重建
   * ============================================================ */
  function applyAll() {
    /* 先清掉上一次的自定义覆盖，再铺主题变量，最后按需覆盖；
     * 顺序不能反：否则"自动"档会把主题刚设置的值一并删掉 */
    var rs = document.documentElement.style;
    ['--accent', '--bg-0', '--bg-1', '--bg-2'].forEach(function (p) { rs.removeProperty(p); });
    TH.apply(cfg.theme);
    if (cfg.accent) rs.setProperty('--accent', cfg.accent);
    if (cfg.bg) {
      rs.setProperty('--bg-0', cfg.bg);
      rs.setProperty('--bg-1', mixHex(cfg.bg, '#ffffff', 0.45));
      rs.setProperty('--bg-2', mixHex(cfg.bg, '#43463c', 0.16));
    }
    document.body.setAttribute('data-font', cfg.font);
    if (fx) fx.stop();
    fx = window.Hanabi.Effects.mount(el.canvas, cfg.effect, {
      palette: TH.get(cfg.theme).palette,
      light: TH.get(cfg.theme).light === true,
      density: cfg.density,
      text: cfg.title,
      reduced: REDUCED
    });
    /* 生日/圣诞用礼盒开场，生日独有蛋糕蜡烛 */
    var isBirthday = cfg.occasion === 'birthday';
    var isGift = isBirthday || cfg.occasion === 'christmas';
    document.body.classList.toggle('has-gift', isGift);
    document.body.classList.toggle('has-cake', isBirthday);
    /* 自定义信笺模式：内置版式让位，展示 TA 自己写的网页 */
    document.body.classList.toggle('letter-mode', cfg.custom !== 'off');
    /* 版式大类：portrait 手机竖屏 / scroll 横卷 / folding 屏风（CSS 按属性重排，窄屏自动回退竖屏） */
    document.body.setAttribute('data-layout', cfg.layout === 'scroll' || cfg.layout === 'folding' ? cfg.layout : 'portrait');
    /* ---------- 网红效果大礼包的开关位 ---------- */
    /* 开场方式：刮刮卡/拂晓雾（预览会自动完成，锁卡保持信封，解锁后重算） */
    var opening = (!locked && !PREVIEW && (cfg.opening === 'scratch' || cfg.opening === 'fog')) ? cfg.opening : 'auto';
    document.body.classList.toggle('open-scratch', opening === 'scratch');
    document.body.classList.toggle('open-fog', opening === 'fog');
    if (el.scratchCard) {
      el.scratchCard.hidden = opening !== 'scratch';
      if (opening === 'scratch') {
        el.scratchTo.textContent = cfg.to;
        el.scratchTitle.textContent = cfg.title;
        el.scratchCv.classList.remove('cleared');
        initScratch();
      }
    }
    if (el.fogCv) {
      el.fogCv.hidden = opening !== 'fog';
      if (opening === 'fog') {
        el.fogCv.classList.remove('cleared');
        initFog();
      }
    }
    var openHint = el.overlay.querySelector('.open-hint');
    if (openHint) {
      openHint.textContent = opening === 'scratch' ? '用指尖刮开涂层'
        : opening === 'fog' ? '指尖轻拂 · 拨开晨雾' : '点 按 开 启';
    }
    /* 收尾互动皮肤：求签筒 / 拆盲盒（同一套交互逻辑，不同外观） */
    document.body.classList.toggle('oracle-box', cfg.oracle === 'blindbox');
    if (el.oracle) el.oracle.setAttribute('aria-label', cfg.oracle === 'blindbox' ? '摇一摇盲盒，抽出签语' : '摇一摇签筒，抽出签语');
    /* 标题流光 / 简笔涂鸦 */
    document.body.classList.toggle('title-shine', cfg.shine === 'on');
    if (el.doodleSvg) { if (cfg.doodle === 'on') el.doodleSvg.removeAttribute('hidden'); else el.doodleSvg.setAttribute('hidden', ''); }
    /* 彩蛋·电子木鱼：控件由配置直接显隐 */
    if (el.muyu) el.muyu.hidden = cfg.prank !== 'muyu';
    /* 随音乐律动（频谱条） */
    setupSpectrum();
    refreshPhotos();
    el.envLetterTo.textContent = cfg.to;
    /* 微信等环境里，标题栏跟随卡片内容 */
    document.title = '有一张给「' + cfg.to + '」的贺卡';
    /* 浏览器栏颜色跟随卡面深浅：夜帖主题下手机状态栏不再发白 */
    var metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', cfg.bg || TH.get(cfg.theme).vars['--bg-0'] || '#faf9f4');
    }
    var metaScheme = document.querySelector('meta[name="color-scheme"]');
    if (metaScheme) {
      metaScheme.setAttribute('content', TH.get(cfg.theme).light === false ? 'dark' : 'light');
    }
    /* 帖号：由配置编码本身推导，同一张卡永远同号（导出文件没有 hash 也一致） */
    var editionText = '花火贺卡 · ' + C.editionOf(cfgCode);
    el.edition.textContent = editionText;
    if (el.openEdition) el.openEdition.textContent = editionText;
  }

  /* 展示自定义信笺：占位符替换后放进沙盒 iframe */
  function showLetter() {
    if (cfg.custom === 'off') return;
    el.letterFrame.srcdoc = C.applyPlaceholders(cfg.custom, cfg);
    el.letterWrap.classList.add('show');
  }

  /* ============================================================
   * 标题逐字弹出：每个字一个 span，带弹性缓动和级联延迟。
   * 渐变文字通过"放大背景 + 平铺位移"让整行标题共享一条金箔渐变。
   * ============================================================ */
  function renderTitle(fast) {
    el.title.textContent = '';
    var chars = Array.from(cfg.title);
    var step = (fast || REDUCED) ? 26 : 70;
    var n = chars.length;
    chars.forEach(function (ch, i) {
      var s = document.createElement('span');
      s.className = 'ch' + ((fast || REDUCED) ? ' noanim' : '');
      s.textContent = (ch === ' ') ? '\u00A0' : ch;
      s.style.animationDelay = (i * step) + 'ms';
      if (n > 1) {
        s.style.backgroundSize = (n * 100) + '% 100%';
        s.style.backgroundPositionX = (i / (n - 1) * 100) + '%';
      }
      el.title.appendChild(s);
    });
    /* 题下金线：标题弹完再描画；简笔涂鸦跟着一起画 */
    el.titleStroke.classList.remove('draw');
    if (el.doodleSvg) el.doodleSvg.classList.remove('draw');
    if (!REDUCED) {
      later(function () {
        el.titleStroke.classList.add('draw');
        if (el.doodleSvg && !el.doodleSvg.hidden) el.doodleSvg.classList.add('draw');
      }, n * step + 220);
    }
    return n * step + 650;
  }

  /* ============================================================
   * 祝福语打字机：文本节点逐字追加（textContent，天然防注入），
   * 标点处稍作停顿更有"手写感"。
   * ============================================================ */
  function typeMessage(text, speed, done) {
    var node = document.createTextNode('');
    var caret = document.createElement('span');
    caret.className = 'caret';
    el.msg.textContent = '';
    el.msg.appendChild(node);
    el.msg.appendChild(caret);

    function finish() {
      if (typing) { clearInterval(typing); typing = null; }
      caret.classList.add('off');
      if (done) done();
    }
    if (REDUCED) { node.data = text; finish(); return; }

    var chars = Array.from(text);
    var i = 0, pause = 0;
    typing = setInterval(function () {
      if (pause > 0) { pause--; return; }
      if (i >= chars.length) { finish(); return; }
      var ch = chars[i++];
      node.data += ch;
      if ('，。！？、…—；：'.indexOf(ch) >= 0 || ch === '\n') pause = 2;
    }, speed);
  }

  /* ============================================================
   * 互动：点夜空赠爱心（所有场景可用）
   * ============================================================ */
  var heartCount = 0;
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
  function spawnHeart(x, y) {
    if (REDUCED || heartCount > 24) return;
    var s = document.createElement('span');
    s.className = 'heart';
    /* 手绘感的小心形 SVG，随调色板着色（不用字符字形） */
    var size = (16 + Math.random() * 16).toFixed(0);
    s.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M12 20.6 C 7 16.6 2.6 13 2.6 8.6 C 2.6 5.5 5 3.4 7.7 3.4 C 9.5 3.4 11.1 4.4 12 6 ' +
      'C 12.9 4.4 14.5 3.4 16.3 3.4 C 19 3.4 21.4 5.5 21.4 8.6 C 21.4 13 17 16.6 12 20.6 Z" fill="currentColor"/></svg>';
    var palette = TH.get(cfg.theme).palette;
    s.style.left = x + 'px';
    s.style.top = y + 'px';
    s.style.width = size + 'px';
    s.style.color = pick(palette);
    s.style.setProperty('--dx', (Math.random() * 92 - 46).toFixed(0) + 'px');
    s.style.setProperty('--dur', (1.1 + Math.random() * 0.8).toFixed(2) + 's');
    document.body.appendChild(s);
    heartCount++;
    s.addEventListener('animationend', function () {
      if (s.parentNode) s.parentNode.removeChild(s);
      heartCount--;
    });
  }

  /* 照片：一叠拍立得（新卡 photos 数组，旧链接单张 photo 兼容） */
  var photos = [];
  var photoIdx = 0;
  function refreshPhotos() {
    photos = (cfg.photos && cfg.photos.length) ? cfg.photos : (cfg.photo ? [cfg.photo] : []);
    photoIdx = 0;
    /* 没有照片时整块退场：否则 1×1 占位图会撑出约 300px 的透明空洞，
     * 把蛋糕和署名挤到首屏之外 */
    el.photoWrap.hidden = !photos.length;
  }
  function showPhoto(i) {
    if (!photos.length) return;
    photoIdx = (i + photos.length) % photos.length;
    el.photoImg.src = photos[photoIdx];
    if (el.photoCount) {
      el.photoCount.textContent = (photoIdx + 1) + ' / ' + photos.length;
      el.photoCount.hidden = photos.length < 2;
    }
  }

  el.stage.addEventListener('pointerdown', function (e) {
    if (!opened) return;
    if (e.target && e.target.closest && e.target.closest('button, a, figure')) return;
    /* 多页祝福：翻页优先；末页之后点屏才赠心 */
    if (awaitingPage) { advancePage(); return; }
    spawnHeart(e.clientX, e.clientY);
  });
  /* 照片：多张轻触翻页（长按放大），单张轻触放大/还原 */
  el.photoFig.addEventListener('click', function (e) {
    e.stopPropagation();
    if (pressZoomed) { pressZoomed = false; return; }
    if (photos.length > 1) {
      el.photoFig.classList.remove('swap');
      void el.photoFig.offsetWidth;
      el.photoFig.classList.add('swap');
      showPhoto(photoIdx + 1);
    } else {
      el.photoFig.classList.toggle('zoomed');
    }
  });
  var pressTimer = null, pressZoomed = false;
  el.photoFig.addEventListener('pointerdown', function () {
    if (photos.length < 2) return;
    clearTimeout(pressTimer);
    pressTimer = setTimeout(function () {
      pressZoomed = true;
      el.photoFig.classList.toggle('zoomed');
    }, 450);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) {
    el.photoFig.addEventListener(ev, function () { clearTimeout(pressTimer); });
  });
  el.photoFig.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  el.photoFig.addEventListener('dragstart', function (e) { e.preventDefault(); });

  /* ============================================================
   * 彩蛋效果（网红向）：全部有界、可关、不用原生 alert。
   *   shake 屏幕震动 / pop 弹窗雨（自绘小窗）/ run 跑路红包 / danmaku 祝福弹幕
   * ============================================================ */
  var prankDone = {};
  function runPranks(fast) {
    var p = cfg.prank;
    if (p === 'off' || prankDone[p]) return;
    prankDone[p] = true;
    if (p === 'shake') {
      later(function () {
        document.body.classList.add('do-shake');
        later(function () { document.body.classList.remove('do-shake'); }, 750);
      }, fast ? 700 : 1700);
    } else if (p === 'pop') {
      var lines = popLines();
      var i = 0;
      var spawn = function () {
        if (i >= lines.length) return;
        miniPop(lines[i]);
        i++;
        later(spawn, 300);
      };
      later(spawn, fast ? 900 : 2300);
    } else if (p === 'run') {
      later(showRunBtn, fast ? 1000 : 2600);
    } else if (p === 'danmaku') {
      later(function () { danmaku(fast); }, fast ? 500 : 1400);
    } else if (p === 'koi') {
      later(koiSwim, fast ? 700 : 2000);
    } else if (p === 'gold') {
      later(function () { burst('gold'); }, fast ? 600 : 1700);
    } else if (p === 'crack') {
      later(crackFlash, fast ? 800 : 2100);
    } else if (p === 'emoji') {
      later(emojiRain, fast ? 700 : 1900);
    }
    /* muyu：控件由 applyAll 直接显示，点按计数见下方 bindMuyu */
  }
  function popLines() {
    var pool = [
      '叮咚，有一份心意', '你被偷偷在乎着', '今日限定的温柔', '好运正在派送中',
      '记得微笑呀', '这是只属于你的贺卡', '接收成功：一大波祝福'
    ];
    Array.from(cfg.message.split(/\n|，|。|！|？/)).forEach(function (s) {
      s = s.trim();
      if (s.length >= 2 && s.length <= 14) pool.push(s);
    });
    /* 打乱后限量，宁少勿闹 */
    for (var i = pool.length - 1; i > 0; i--) {
      var j = (Math.random() * (i + 1)) | 0;
      var t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }
    return pool.slice(0, 10);
  }
  var popCount = 0;
  function miniPop(text) {
    if (popCount >= 5) return;
    var w = document.createElement('div');
    w.className = 'mini-pop';
    w.style.left = (6 + Math.random() * 58) + '%';
    w.style.top = (8 + Math.random() * 52) + '%';
    var b = document.createElement('b');
    b.textContent = '提示';
    var s = document.createElement('span');
    s.textContent = text;
    var x = document.createElement('i');
    x.className = 'x';
    x.textContent = '×';
    w.appendChild(b); w.appendChild(s); w.appendChild(x);
    document.body.appendChild(w);
    popCount++;
    function close() {
      if (!w.parentNode) return;
      w.classList.add('bye');
      setTimeout(function () { if (w.parentNode) w.parentNode.removeChild(w); }, 260);
      popCount--;
    }
    x.addEventListener('click', function (e) { e.stopPropagation(); close(); });
    setTimeout(close, 4600);
  }
  function danmaku(fast) {
    var lines = Array.from(cfg.message.split(/\n|，|。|！|？|；/))
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s.length >= 2; })
      .slice(0, 8);
    if (!lines.length) lines = [cfg.title];
    lines.forEach(function (text, i) {
      later(function () {
        var s = document.createElement('span');
        s.className = 'danmaku';
        s.textContent = text;
        s.style.top = (12 + Math.random() * 40) + '%';
        s.style.fontSize = (13 + Math.random() * 5).toFixed(0) + 'px';
        s.style.animationDuration = (6 + Math.random() * 4).toFixed(1) + 's';
        s.style.color = pick(TH.get(cfg.theme).palette);
        document.body.appendChild(s);
        s.addEventListener('animationend', function () {
          if (s.parentNode) s.parentNode.removeChild(s);
        });
      }, i * (fast ? 350 : 950));
    });
  }
  function showRunBtn() {
    if (document.querySelector('.run-btn')) return;
    var b = document.createElement('button');
    b.className = 'run-btn';
    b.type = 'button';
    b.textContent = '🎁 点我领红包';
    b.style.left = '50%';
    b.style.top = '68%';
    document.body.appendChild(b);
    var dodges = 0;
    function dodge() {
      if (dodges >= 4) return;
      dodges++;
      b.style.left = (8 + Math.random() * 66) + '%';
      b.style.top = (14 + Math.random() * 55) + '%';
      if (dodges >= 4) {
        b.textContent = '好吧…真的点我';
        b.classList.add('tired');
      }
    }
    b.addEventListener('pointerenter', dodge);
    /* 触屏：按下即跑 */
    b.addEventListener('pointerdown', function (e) {
      if (dodges < 4) { e.preventDefault(); dodge(); }
    });
    b.addEventListener('click', function () {
      if (dodges < 4) { dodge(); return; }
      var r = b.getBoundingClientRect();
      for (var i = 0; i < 14; i++) {
        spawnHeart(r.left + r.width / 2 + (Math.random() * 80 - 40),
                   r.top + Math.random() * 30);
      }
      window.Hanabi.toast('骗你的啦，祝你天天开心');
      b.classList.add('bye');
      setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 400);
    });
  }

  /* ============================================================
   * 网红效果大礼包（全部纯本地实现）
   *   burst      一次性粒子爆发（金粉喷雾 / 彩带礼炮 / 解锁烟花共用）
   *   koiSwim    锦鲤游屏（SVG 剪影沿正弦轨迹游过，尾迹金光）
   *   crackFlash 屏幕碎裂恶搞（裂开一瞬 + 震动 → 骗你的）
   *   emojiRain  表情包雨
   *   bindMuyu   电子木鱼（敲一下功德 +1）
   *   armShake   摇一摇彩带（iOS 需在用户手势内申请动作权限）
   * ============================================================ */
  function burst(kind) {
    if (REDUCED) return;
    var W = window.innerWidth, H = window.innerHeight;
    var cv = document.createElement('canvas');
    cv.className = 'burst-cv';
    var d = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(W * d);
    cv.height = Math.round(H * d);
    var c = cv.getContext('2d');
    c.setTransform(d, 0, 0, d, 0, 0);
    document.body.appendChild(cv);
    var palette = TH.get(cfg.theme).palette;
    var golds = ['#e8c56a', '#f5df9a', '#caa14f', '#fff3d0'];
    var parts = [];
    var n = kind === 'gold' ? 90 : 120;
    for (var i = 0; i < n; i++) {
      if (kind === 'gold') {
        /* 金粉：从底部两角向上喷雾 */
        var fromLeft = Math.random() < 0.5;
        parts.push({
          x: fromLeft ? rand(0, W * 0.2) : rand(W * 0.8, W),
          y: H + 6,
          vx: (fromLeft ? 1 : -1) * rand(50, 210),
          vy: -rand(260, 600),
          g: 520, life: rand(1.2, 2.1), t: 0,
          r: rand(1.2, 2.8), color: golds[(Math.random() * golds.length) | 0],
          shape: 'dot'
        });
      } else {
        /* 彩带礼炮：整条底边向上抛洒 */
        parts.push({
          x: rand(0, W), y: H + 10,
          vx: rand(-80, 80), vy: -rand(400, 820),
          g: 640, life: rand(1.4, 2.3), t: 0,
          r: rand(2, 3.6), color: pick(palette),
          shape: 'rect', w: rand(4, 8), h: rand(6, 12),
          rot: rand(0, TAU), vr: rand(-7, 7)
        });
      }
    }
    var t0 = performance.now(), last = t0;
    (function step(now) {
      var dt = Math.min((now - last) / 1000, 0.05) || 0.016;
      last = now;
      c.clearRect(0, 0, W, H);
      var alive = 0;
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        p.t += dt;
        if (p.t >= p.life) continue;
        p.vy += p.g * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        var a = clamp(1 - p.t / p.life, 0, 1);
        if (p.y > H + 30 || a <= 0) continue;
        alive++;
        if (p.shape === 'rect') {
          p.rot += p.vr * dt;
          c.save();
          c.translate(p.x, p.y);
          c.rotate(p.rot);
          c.globalAlpha = a;
          c.fillStyle = p.color;
          c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * (0.4 + Math.abs(Math.sin(p.t * 9)) * 0.6));
          c.restore();
        } else {
          drawGlow(c, p.color, p.x, p.y, p.r * 2.2, a * 0.9);
        }
      }
      c.globalAlpha = 1;
      if (alive > 0) requestAnimationFrame(step);
      else if (cv.parentNode) cv.parentNode.removeChild(cv);
    })(t0);
  }

  function koiSwim() {
    if (REDUCED || !el.koiSvg) return;
    var svg = el.koiSvg;
    svg.removeAttribute('hidden');
    var W = window.innerWidth, H = window.innerHeight;
    var x0 = W + 140, x1 = -140;                 /* 头朝左，从右往左游 */
    var yBase = H * rand(0.24, 0.6);
    var dur = 8200, t0 = performance.now();
    var prevY = yBase, prevX = x0, lastSpark = 0;
    (function step(now) {
      var k = (now - t0) / dur;
      if (k >= 1) { svg.setAttribute('hidden', ''); return; }
      var x = x0 + (x1 - x0) * k;
      var y = yBase + Math.sin(k * Math.PI * 2.2) * 46;
      var ang = Math.atan2(y - prevY, x - prevX) * 180 / Math.PI + 180;
      prevY = y; prevX = x;
      svg.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) rotate(' + ang.toFixed(1) + 'deg)';
      /* 尾迹金光 */
      if (now - lastSpark > 90) {
        lastSpark = now;
        var s = document.createElement('span');
        s.className = 'koi-spark';
        s.style.left = (x + 112) + 'px';
        s.style.top = (y + rand(4, 30)) + 'px';
        s.style.background = pick(['#e8c56a', '#f5df9a', '#d96c4f']);
        s.style.setProperty('--sx', rand(6, 26) + 'px');
        s.style.setProperty('--sy', rand(-26, -6) + 'px');
        document.body.appendChild(s);
        s.addEventListener('animationend', function () { if (s.parentNode) s.parentNode.removeChild(s); });
      }
      requestAnimationFrame(step);
    })(t0);
  }

  function crackFlash() {
    if (!el.crackSvg) return;
    var svg = el.crackSvg;
    svg.removeAttribute('hidden');
    svg.classList.remove('bye');
    svg.classList.add('show');
    document.body.classList.add('do-shake');
    later(function () {
      document.body.classList.remove('do-shake');
      svg.classList.add('bye');
      window.Hanabi.toast('骗你的～屏没碎，好运来了');
    }, 1500);
    later(function () {
      svg.setAttribute('hidden', '');
      svg.classList.remove('show', 'bye');
    }, 2150);
  }

  function emojiRain() {
    var pool = ['🎉', '✨', '🎈', '💛', '🌟', '🌸', '🧧', '🫶', '🍀', '🌈'];
    var total = 22;
    for (var i = 0; i < total; i++) {
      later(function () {
        var s = document.createElement('span');
        s.className = 'emoji-fall';
        s.textContent = pick(pool);
        s.style.left = rand(2, 92) + '%';
        s.style.fontSize = rand(18, 34).toFixed(0) + 'px';
        s.style.setProperty('--dur', rand(2.6, 4.2).toFixed(2) + 's');
        s.style.setProperty('--sw', rand(10, 40).toFixed(0) + 'px');
        document.body.appendChild(s);
        s.addEventListener('animationend', function () { if (s.parentNode) s.parentNode.removeChild(s); });
      }, i * 150);
    }
  }

  function bindMuyu() {
    if (!el.muyu) return;
    var count = 0;
    function tap(e) {
      e.stopPropagation();
      count++;
      el.muyuCount.textContent = '功德 ' + count;
      el.muyu.classList.remove('hit');
      void el.muyu.offsetWidth;
      el.muyu.classList.add('hit');
      var plus = document.createElement('span');
      plus.className = 'muyu-plus';
      plus.textContent = '功德 +1';
      el.muyu.appendChild(plus);
      setTimeout(function () { if (plus.parentNode) plus.parentNode.removeChild(plus); }, 1000);
      if (navigator.vibrate) navigator.vibrate(18);
      if (count === 10) window.Hanabi.toast('功德 +10，今天运气拉满');
    }
    el.muyu.addEventListener('pointerdown', tap);
    el.muyu.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(e); }
    });
  }

  var shakeArmed = false, lastShakeAt = 0, lastMag = 0;
  function armShake() {
    if (shakeArmed || PREVIEW || REDUCED || cfg.shake !== 'on') return;
    var DME = window.DeviceMotionEvent;
    if (!DME) return;
    shakeArmed = true;
    function bind() {
      window.addEventListener('devicemotion', function (e) {
        var a = e.accelerationIncludingGravity;
        if (!a) return;
        var mag = Math.sqrt((a.x || 0) * (a.x || 0) + (a.y || 0) * (a.y || 0) + (a.z || 0) * (a.z || 0));
        var delta = Math.abs(mag - lastMag);
        lastMag = mag;
        var now = Date.now();
        if (delta > 16 && now - lastShakeAt > 1800) {
          lastShakeAt = now;
          burst('confetti');
          if (navigator.vibrate) navigator.vibrate(60);
        }
      });
    }
    /* iOS 13+ 必须在用户手势里申请动作传感器权限（此处正处于点按回调内） */
    if (typeof DME.requestPermission === 'function') {
      DME.requestPermission().then(function (s) { if (s === 'granted') bind(); }).catch(function () { /* 拒绝则作罢 */ });
    } else {
      bind();
    }
  }

  /* ============================================================
   * 生日互动升级：真·吹蜡烛（麦克风气流检测）。
   * 授权失败 / 不支持时静默退回点按吹，两条路殊途同归。
   * ============================================================ */
  var blowStream = null, blowAC = null, blowRaf = 0;
  function startBlow() {
    if (blown || PREVIEW || blowStream) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      if (blown) {
        stream.getTracks().forEach(function (t) { t.stop(); });
        return;
      }
      blowStream = stream;
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        blowAC = new AC();
        var src = blowAC.createMediaStreamSource(stream);
        var an = blowAC.createAnalyser();
        an.fftSize = 512;
        src.connect(an);
        var data = new Uint8Array(an.fftSize);
        var sustained = 0, last = performance.now();
        (function loop(now) {
          if (blown || !blowAC) return;
          var dt = Math.min((now - last) / 1000, 0.1) || 0.016;
          last = now;
          an.getByteTimeDomainData(data);
          var sum = 0;
          for (var i = 0; i < data.length; i++) {
            var v = (data[i] - 128) / 128;
            sum += v * v;
          }
          var rms = Math.sqrt(sum / data.length);
          if (rms > 0.09) sustained += dt;
          else sustained = Math.max(0, sustained - dt * 1.6);
          if (sustained > 0.6) { blowCandles(); return; }
          blowRaf = requestAnimationFrame(loop);
        })(last);
      } catch (e) { /* 分析失败就只剩点按 */ }
    }).catch(function () { /* 没给麦克风：点按钮照样吹 */ });
  }
  function stopBlow() {
    if (blowRaf) { cancelAnimationFrame(blowRaf); blowRaf = 0; }
    if (blowStream) {
      blowStream.getTracks().forEach(function (t) { t.stop(); });
      blowStream = null;
    }
    if (blowAC) {
      try { blowAC.close(); } catch (e) { /* 忽略 */ }
      blowAC = null;
    }
  }

  /* ============================================================
   * 开场·刮刮卡：涂层下的致意与标题，刮够四成五自动开卡
   * ============================================================ */
  function paintCoating(c, w, h) {
    var g = c.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#eae4d4');
    g.addColorStop(0.5, '#d9d2c0');
    g.addColorStop(1, '#e6dfcd');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,255,255,.16)';
    for (var i = 0; i < 240; i++) c.fillRect(Math.random() * w, Math.random() * h, 1.4, 1.4);
    c.fillStyle = 'rgba(120,110,90,.12)';
    for (i = 0; i < 150; i++) c.fillRect(Math.random() * w, Math.random() * h, 1.4, 1.4);
    c.fillStyle = 'rgba(110,100,80,.6)';
    c.font = '600 15px "Songti SC", "Noto Serif SC", serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('刮 开 这 张 卡', w / 2, h / 2);
    c.strokeStyle = 'rgba(110,100,80,.32)';
    c.setLineDash([5, 4]);
    c.strokeRect(9.5, 9.5, w - 19, h - 19);
    c.setLineDash([]);
  }
  var scratchDone = false;
  function initScratch() {
    if (PREVIEW || scratchDone || !el.scratchCv) return;
    var cv = el.scratchCv;
    var w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) { setTimeout(initScratch, 60); return; }
    var d = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(w * d);
    cv.height = Math.round(h * d);
    var c = cv.getContext('2d');
    c.setTransform(d, 0, 0, d, 0, 0);
    paintCoating(c, w, h);
    var erasing = false, moves = 0;
    function pos(e) {
      var r = cv.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    function erase(p) {
      c.globalCompositeOperation = 'destination-out';
      var g = c.createRadialGradient(p.x, p.y, 6, p.x, p.y, 26);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(p.x, p.y, 26, 0, TAU);
      c.fill();
      c.globalCompositeOperation = 'source-over';
    }
    /* 粗采样估计已刮开面积（步长约 14 CSS 像素） */
    function progress() {
      var step = Math.max(7, Math.round(14 * d));
      var cleared = 0, total = 0;
      var data;
      try { data = c.getImageData(0, 0, cv.width, cv.height).data; } catch (e) { return 0; }
      for (var y = 0; y < cv.height; y += step) {
        for (var x = 0; x < cv.width; x += step) {
          total++;
          if (data[(y * cv.width + x) * 4 + 3] < 40) cleared++;
        }
      }
      return cleared / Math.max(1, total);
    }
    function check() {
      if (!scratchDone && progress() >= 0.45) finishScratch();
    }
    cv.addEventListener('pointerdown', function (e) {
      if (scratchDone) return;
      erasing = true;
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
      erase(pos(e));
    });
    cv.addEventListener('pointermove', function (e) {
      if (!erasing || scratchDone) return;
      erase(pos(e));
      if (++moves % 12 === 0) check();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
      cv.addEventListener(ev, function () {
        erasing = false;
        if (!scratchDone) check();
      });
    });
  }
  function finishScratch() {
    if (scratchDone) return;
    scratchDone = true;
    el.scratchCv.classList.add('cleared');
    burst('confetti');
    later(completeOpening, 700);
  }

  /* ============================================================
   * 开场·拂晓雾：整屏薄雾，指尖拂开见祝福，拂过五成自动开卡
   * ============================================================ */
  function paintFog(c, w, h) {
    var dark = TH.get(cfg.theme).light === false;
    c.fillStyle = dark ? 'rgba(16,14,26,0.97)' : 'rgba(249,247,240,0.97)';
    c.fillRect(0, 0, w, h);
    for (var i = 0; i < 14; i++) {
      var x = Math.random() * w, y = Math.random() * h;
      var r = rand(60, Math.max(w, h) * 0.35);
      var g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,' + rand(0.05, 0.13).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(x, y, r, 0, TAU);
      c.fill();
    }
  }
  var fogDone = false;
  function initFog() {
    if (PREVIEW || fogDone || !el.fogCv) return;
    var cv = el.fogCv;
    var w = cv.clientWidth || window.innerWidth;
    var h = cv.clientHeight || window.innerHeight;
    var d = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(w * d);
    cv.height = Math.round(h * d);
    var c = cv.getContext('2d');
    c.setTransform(d, 0, 0, d, 0, 0);
    paintFog(c, w, h);
    var wiped = 0;
    var area = Math.PI * 48 * 48 * 0.62; // 每次拂拭按六成计（轨迹大量重叠）
    function pos(e) {
      var r = cv.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    function wipe(p) {
      c.globalCompositeOperation = 'destination-out';
      var g = c.createRadialGradient(p.x, p.y, 8, p.x, p.y, 48);
      g.addColorStop(0, 'rgba(0,0,0,.95)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(p.x, p.y, 48, 0, TAU);
      c.fill();
      c.globalCompositeOperation = 'source-over';
      wiped += area;
      if (wiped / (w * h) >= 0.45) finishFog();
    }
    cv.addEventListener('pointerdown', function (e) {
      if (fogDone) return;
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
      wipe(pos(e));
    });
    cv.addEventListener('pointermove', function (e) {
      if (fogDone) return;
      if (e.buttons === 0 && e.pointerType === 'mouse') return; // 鼠标要按住拂
      wipe(pos(e));
    });
  }
  function finishFog() {
    if (fogDone) return;
    fogDone = true;
    el.fogCv.classList.add('cleared');
    later(completeOpening, 700);
  }

  /* ============================================================
   * 开启门槛·滑动解锁：拖圆钮到最右才见开场浮层
   * ============================================================ */
  var sliderGateActive = false, gateSliderDone = false;
  function maybeShowGate() {
    if (PREVIEW || gateSliderDone || !el.gateSlider) return;
    if (cfg.gate !== 'slider') return;
    sliderGateActive = true;
    el.gateSlider.hidden = false;
  }
  function bindGateSlider() {
    if (!el.gateSlider) return;
    var track = el.gsTrack, thumb = el.gsThumb, fill = el.gsFill;
    var dragging = false, max = 0;
    function setX(px) {
      thumb.style.transform = 'translateX(' + px.toFixed(1) + 'px)';
      fill.style.width = (px + 50).toFixed(1) + 'px';
      track.setAttribute('aria-valuenow', String(Math.round(max ? px / max * 100 : 0)));
    }
    function reset() {
      thumb.style.transition = 'transform .3s var(--settle)';
      setX(0);
      fill.style.width = '0px';
      setTimeout(function () { thumb.style.transition = ''; }, 320);
    }
    function gatePass() {
      if (gateSliderDone) return;
      gateSliderDone = true;
      sliderGateActive = false;
      thumb.style.transition = '';
      setX(max || 200);
      el.gateSlider.classList.add('done');
      burst('confetti');
      later(function () { el.gateSlider.hidden = true; }, 520);
    }
    track.addEventListener('pointerdown', function (e) {
      if (gateSliderDone) return;
      el.gateSlider.classList.add('dragged'); // 动过就不再呼吸提示
      dragging = true;
      max = Math.max(1, track.clientWidth - thumb.offsetWidth - 8);
      try { track.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
    });
    track.addEventListener('pointermove', function (e) {
      if (!dragging || gateSliderDone) return;
      var r = track.getBoundingClientRect();
      var x = clamp(e.clientX - r.left - thumb.offsetWidth / 2 - 4, 0, max);
      thumb.style.transition = '';
      setX(x);
      if (x >= max - 2) {
        dragging = false;
        gatePass();
      }
    });
    ['pointerup', 'pointercancel'].forEach(function (ev) {
      track.addEventListener(ev, function () {
        if (dragging && !gateSliderDone) {
          dragging = false;
          reset();
        }
      });
    });
    track.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); gatePass(); }
    });
  }

  /* ============================================================
   * 随音乐律动：把正在播的 BGM 接进分析器，画一条频谱
   * （MediaElementSource 只能建一次，用标志位防重复）
   * ============================================================ */
  var spectrumAC = null, spectrumSrc = false, spectrumAn = null, specData = null, spectrumOn = false, specRaf = 0;
  function setupSpectrum() {
    var want = !PREVIEW && cfg.music !== 'off' && cfg.spectrum === 'on';
    if (el.spectrumCv) el.spectrumCv.hidden = !want;
    if (!want) { stopSpectrum(); return; }
    if (!bgAudio) return; // 还没开播，audioStart 后会再调一次
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!spectrumAC) spectrumAC = new AC();
      if (spectrumAC.state === 'suspended') spectrumAC.resume();
      if (!spectrumSrc) {
        var src = spectrumAC.createMediaElementSource(bgAudio);
        spectrumAn = spectrumAC.createAnalyser();
        spectrumAn.fftSize = 128;
        src.connect(spectrumAn);
        spectrumAn.connect(spectrumAC.destination);
        specData = new Uint8Array(spectrumAn.frequencyBinCount);
        spectrumSrc = true;
      }
      if (!spectrumOn) { spectrumOn = true; specLoop(); }
    } catch (e) { /* 接不进分析器就当没这个功能 */ }
  }
  function stopSpectrum() {
    spectrumOn = false;
    if (specRaf) { cancelAnimationFrame(specRaf); specRaf = 0; }
  }
  function specLoop() {
    if (!spectrumOn || !el.spectrumCv) { spectrumOn = false; return; }
    var cv = el.spectrumCv;
    var d = Math.min(window.devicePixelRatio || 1, 2);
    var w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) { specRaf = requestAnimationFrame(specLoop); return; }
    if (cv.width !== Math.round(w * d)) {
      cv.width = Math.round(w * d);
      cv.height = Math.round(h * d);
    }
    var c = cv.getContext('2d');
    c.setTransform(d, 0, 0, d, 0, 0);
    c.clearRect(0, 0, w, h);
    if (spectrumAn && specData && bgAudio && !bgAudio.paused) {
      spectrumAn.getByteFrequencyData(specData);
      var bars = 26, gap = 2;
      var bw = (w - gap * (bars - 1)) / bars;
      var accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#5f7d72';
      c.fillStyle = accent;
      for (var i = 0; i < bars; i++) {
        var v = specData[Math.floor(i * specData.length * 0.62 / bars)] / 255;
        var bh = Math.max(2, v * h);
        c.globalAlpha = 0.3 + v * 0.55;
        var x = i * (bw + gap);
        c.beginPath();
        if (c.roundRect) c.roundRect(x, h - bh, bw, bh, 2);
        else c.rect(x, h - bh, bw, bh);
        c.fill();
      }
      c.globalAlpha = 1;
    }
    specRaf = requestAnimationFrame(specLoop);
  }

  /* ---------- 触点粒子拖尾：指针划过拖出主题色微光 ---------- */
  var lastPuff = 0;
  document.addEventListener('pointermove', function (e) {
    if (cfg.trail !== 'on' || REDUCED || !fx || !fx.puff) return;
    var now = performance.now();
    if (now - lastPuff < 26) return;
    lastPuff = now;
    fx.puff(e.clientX, e.clientY);
  }, { passive: true });

  /* ============================================================
   * 生日互动：吹蜡烛 → 火焰熄灭、冒烟、画面变亮 → 署名
   * ============================================================ */
  function blowCandles() {
    if (blown || !document.body.classList.contains('has-cake')) return;
    blown = true;
    stopBlow();
    el.blow.classList.remove('show');
    var candles = el.cake.querySelectorAll('.candle');
    candles.forEach(function (cd, i) {
      setTimeout(function () { cd.classList.add('out'); }, i * 140);
    });
    document.body.classList.add('lit'); // 画面整体变亮
    later(revealSignature, 1500);
  }
  el.blow.addEventListener('click', function (e) {
    e.stopPropagation();
    blowCandles();
  });
  el.cake.addEventListener('click', blowCandles);

  /* ============================================================
   * 阶段编排
   * ============================================================ */
  function showHint(text) {
    if (text) el.hint.textContent = text;
    if (!REDUCED) el.hint.classList.add('show');
  }
  function hideHint() { el.hint.classList.remove('show'); }

  /* ---------- 手写署名：按量化笔迹一笔一划重现 ---------- */
  function drawSignProgress(cv, strokes, ratio) {
    var d = Math.min(window.devicePixelRatio || 1, 2);
    var w = cv.clientWidth || 230, h = Math.round(w * 110 / 340);
    if (cv.width !== Math.round(w * d)) {
      cv.width = Math.round(w * d);
      cv.height = Math.round(h * d);
    }
    var c = cv.getContext('2d');
    c.setTransform(d, 0, 0, d, 0, 0);
    c.clearRect(0, 0, w, h);
    c.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--ink') || '#232520';
    c.lineCap = 'round';
    c.lineJoin = 'round';
    var budget = ratio; // 0~1，可画的长度占比
    for (var i = 0; i < strokes.length && budget > 0; i++) {
      var s = strokes[i];
      c.lineWidth = s.w * (w / 340);
      c.beginPath();
      var x0 = s.p[0] / 4000 * w, y0 = s.p[1] / 4000 * h;
      c.moveTo(x0, y0);
      var segLen = 0, drawn = 0;
      for (var j = 2; j < s.p.length && budget > 0; j += 2) {
        var x1 = s.p[j] / 4000 * w, y1 = s.p[j + 1] / 4000 * h;
        var dx = x1 - x0, dy = y1 - y0;
        segLen = Math.sqrt(dx * dx + dy * dy) / w; // 归一化长度
        if (drawn + segLen <= budget) {
          c.lineTo(x1, y1);
          drawn += segLen;
        } else {
          var k = (budget - drawn) / (segLen || 1);
          c.lineTo(x0 + dx * k, y0 + dy * k);
          drawn = budget;
        }
        x0 = x1; y0 = y1;
      }
      if (s.p.length === 2) { c.lineTo(x0 + .1, y0); drawn += .003; }
      c.stroke();
      budget -= drawn;
    }
  }
  function playSignature(done) {
    var strokes = (cfg.sign && cfg.sign.strokes) || [];
    if (!strokes.length) { if (done) done(); return; }
    el.sig.style.display = 'none';
    el.signCanvas.hidden = false;
    if (REDUCED) {
      drawSignProgress(el.signCanvas, strokes, 1);
      if (done) done();
      return;
    }
    /* 笔迹总长决定节奏：短签名快些，长签名也不超过 2 秒 */
    var total = 0;
    strokes.forEach(function (s) {
      for (var j = 2; j < s.p.length; j += 2) {
        var dx = s.p[j] - s.p[j - 2], dy = s.p[j + 1] - s.p[j - 1];
        total += Math.sqrt(dx * dx + dy * dy);
      }
    });
    var dur = Math.min(2000, 700 + total * .28);
    var t0 = performance.now();
    (function step(now) {
      var t = Math.min(1, (now - t0) / dur);
      drawSignProgress(el.signCanvas, strokes, t);
      if (t < 1) requestAnimationFrame(step);
      else if (done) done();
    })(t0);
  }

  /* ---------- 求签：摇两下签筒，抽出这张卡的签语 ---------- */
  var oracleState = { shakes: 0, drawn: false };
  function showOracle() {
    if (el.oracle) el.oracle.classList.add('show');
  }
  function revealFortune() {
    var f = C.fortuneOf(cfgCode);
    el.fortune.textContent = '';
    var no = document.createElement('b');
    no.textContent = f.no;
    el.fortune.appendChild(no);
    el.fortune.appendChild(document.createTextNode('第 ' + f.no.slice(3) + ' 签 · ' + f.text));
    el.fortune.classList.add('show');
  }
  function drawFortune() {
    if (oracleState.drawn) return;
    oracleState.drawn = true;
    if (el.oracleCup) {
      el.oracleCup.classList.remove('shaking');
      el.oracleCup.classList.add('drawn');
    }
    if (el.blindBox) {
      el.blindBox.classList.remove('shaking');
      el.blindBox.classList.add('drawn');
    }
    if (el.oracleHint) el.oracleHint.textContent = '签到了';
    later(revealFortune, 650);
  }
  if (el.oracle) {
    el.oracle.addEventListener('pointerdown', function (e) {
      e.stopPropagation();
      if (oracleState.drawn) return;
      oracleState.shakes++;
      if (el.oracleCup) {
        el.oracleCup.classList.remove('shaking');
        void el.oracleCup.offsetWidth;
        el.oracleCup.classList.add('shaking');
      }
      if (el.blindBox) {
        el.blindBox.classList.remove('shaking');
        void el.blindBox.offsetWidth;
        el.blindBox.classList.add('shaking');
      }
      if (oracleState.shakes >= 2) drawFortune();
    });
    el.oracle.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); drawFortune(); }
    });
  }

  function revealSignature(fast) {
    el.signRow.classList.add('show');
    el.sig.style.display = '';
    el.signCanvas.hidden = true;
    if (cfg.sign) {
      playSignature(function () { later(function () { el.seal.classList.add('stamped'); }, 260); });
    } else {
      el.sig.textContent = cfg.from;
      /* 印章滞后半拍盖落 */
      later(function () { el.seal.classList.add('stamped'); }, 420);
    }
    /* 帖号签语：先出签筒请 TA 摇两下；不动也会自动出签 */
    later(showOracle, fast ? 200 : 500);
    later(drawFortune, (REDUCED || PREVIEW) ? 800 : (fast ? 650 : 4200));
    /* 生日卡：蜡烛吹灭后按钮退场，此刻把「赠心」提示补上 */
    if (document.body.classList.contains('has-cake')) showHint('轻触屏幕 · 赠一颗心');
    later(hideHint, 2600);
    later(showActions, 900);
    /* 署名/签筒/按钮可能落在首屏之下（内容比视口高）：
     * 揭幕之际缓缓把舞台送上去，别让 TA 错过结尾。
     * 以结尾按钮为锚——它是内容流的最后一项，签筒和签语都在它上方，
     * 送它进视口，前戏就都露出来了（只查署名会漏掉按钮还在折叠线外的情况） */
    later(function () {
      var sr = el.actions.getBoundingClientRect();
      var st = el.stage.getBoundingClientRect();
      if (sr.bottom <= st.bottom - 16) return;
      var top = el.stage.scrollTop + (sr.top - st.top) - Math.max(64, st.height * .26);
      try { el.stage.scrollTo({ top: top, behavior: REDUCED ? 'auto' : 'smooth' }); }
      catch (e) { el.stage.scrollTop = top; }
    }, 450);
    ended = true;
  }
  function showActions() {
    el.actions.classList.add('show');
    el.skip.classList.remove('show');
    document.body.classList.add('ended');
  }

  /* ---------- 多页祝福：单独一行「---」分页，轻触翻页 ---------- */
  var pages = [], pageIdx = 0, awaitingPage = false;
  function typePage(fast, onAllDone) {
    typeMessage(pages[pageIdx], fast ? 14 : 34, function () {
      later(function () {
        if (pageIdx < pages.length - 1) {
          awaitingPage = true;
          showHint('轻触屏幕 · 翻到下一页');
        } else {
          afterMessage(fast, onAllDone);
        }
      }, fast ? 200 : 600);
    });
  }
  function afterMessage(fast, onAllDone) {
    var cake = document.body.classList.contains('has-cake');
    /* 生日卡此阶段的主 CTA 是「吹蜡烛」按钮：提示语与按钮会在窄布局下
     * 贴到同一区域，先让位，吹灭后（revealSignature）再补上赠心提示 */
    if (!cake) showHint('轻触屏幕 · 赠一颗心');
    if (photos.length) {
      showPhoto(0);
      el.photoWrap.classList.add('show');
    }
    if (cake) {
      /* 生日：出现蛋糕和蜡烛，等 TA 吹灭（或对着麦克风吹） */
      el.cakeWrap.classList.add('show');
      el.blow.classList.add('show');
      startBlow();
      if (onAllDone) onAllDone();
    } else {
      later(function () { revealSignature(fast); }, fast ? 500 : 1100);
    }
  }
  function advancePage() {
    awaitingPage = false;
    hideHint();
    el.msgWrap.classList.remove('show');
    later(function () {
      pageIdx++;
      el.msg.textContent = '';
      try { el.stage.scrollTop = 0; } catch (e) { /* 忽略 */ }
      el.msgWrap.classList.add('show');
      typePage(false, null);
    }, 380);
  }

  /* 内容三连：称呼 → 标题 → 祝福语（可多页） → 互动/署名；信笺模式则直接展示 TA 的网页 */
  function startContent(fast) {
    clearFlow();
    blown = false;
    ended = false;
    awaitingPage = false;
    document.body.classList.remove('lit', 'ended');
    el.signRow.classList.remove('show');
    el.seal.classList.remove('stamped');
    el.actions.classList.remove('show');
    el.fortune.classList.remove('show');
    el.photoWrap.classList.remove('show');
    el.photoFig.classList.remove('zoomed');
    hideHint();
    el.cakeWrap.classList.remove('show');
    el.blow.classList.remove('show');
    el.cake.querySelectorAll('.candle').forEach(function (cd) { cd.classList.remove('out'); });
    /* 签筒复位：签收回筒，等下次抽 */
    oracleState.shakes = 0;
    oracleState.drawn = false;
    if (el.oracle) el.oracle.classList.remove('show');
    if (el.oracleCup) el.oracleCup.classList.remove('shaking', 'drawn');
    if (el.blindBox) el.blindBox.classList.remove('shaking', 'drawn');
    if (el.oracleHint) el.oracleHint.textContent = cfg.oracle === 'blindbox' ? '轻触盲盒 · 摇两下开盒' : '轻触签筒 · 摇两下抽一签';
    /* 涂鸦/麦克风/裂屏等一次性状态复位 */
    if (el.doodleSvg) el.doodleSvg.classList.remove('draw');
    stopBlow();
    if (el.crackSvg) { el.crackSvg.setAttribute('hidden', ''); el.crackSvg.classList.remove('show', 'bye'); }

    runPranks(fast); // 彩蛋效果（有界可关）

    if (cfg.custom !== 'off') {
      if (!PREVIEW) el.skip.classList.add('show');
      showLetter();
      later(showActions, fast ? 400 : 1600);
      return;
    }

    el.to.textContent = cfg.to;
    /* 称呼竖排：超过 6 个字自动转为横排细线样式 */
    el.to.classList.toggle('vlong', Array.from(cfg.to).length > 6);
    el.to.classList.add('show');
    el.orn.classList.add('show');
    el.msgWrap.classList.add('show');
    if (!PREVIEW) el.skip.classList.add('show');

    pages = C.splitMessage(cfg.message);
    pageIdx = 0;
    renderTitle(fast);
    later(function () {
      typePage(fast, null);
    }, fast ? 150 : 300);
  }

  /* ============================================================
   * 开场：信封（通用）/ 礼盒（生日·圣诞），点按开启。
   * 这一次点按同时是用户手势，用来解锁音频播放：
   * 有语音先放语音（对方的声音最要紧），结束后音乐才起。
   * 刮刮卡 / 拂晓雾开场不走点按——完成动作后走 completeOpening；
   * 滑动门槛未过时开场浮层根本摸不到。
   * ============================================================ */
  function beginPlayback() {
    if (cfg.voice !== 'off') {
      playVoice().then(function () { audioStart(); });
      /* 语音被浏览器拦截等极端情况：给音乐一个兜底入口 */
      later(function () { if (cfg.music !== 'off' && !bgAudio) audioStart(); }, 4000);
    } else {
      audioStart();
    }
    armShake();      /* 摇一摇：趁用户手势申请动作传感器权限 */
    setupSpectrum(); /* 音频就位后挂频谱分析 */
  }
  function activeOpening() {
    return (!locked && !PREVIEW && (cfg.opening === 'scratch' || cfg.opening === 'fog')) ? cfg.opening : 'auto';
  }
  function openCard() {
    if (opened || locked || gateOn || sliderGateActive) return;
    if (activeOpening() !== 'auto') return;
    opened = true;
    beginPlayback();
    if (document.body.classList.contains('has-gift')) {
      el.gift.classList.add('shake');
      later(function () { el.gift.classList.add('open'); }, 520);
      later(hideOverlay, 1250);
    } else {
      el.env.classList.add('open');
      later(function () { el.env.classList.add('opened'); }, 340);
      later(hideOverlay, 950);
    }
  }
  /* 刮刮卡/拂晓雾完成后的统一入口：同样借这次手势解锁音频 */
  function completeOpening() {
    if (opened || locked || gateOn || sliderGateActive) return;
    opened = true;
    beginPlayback();
    hideOverlay();
  }
  function hideOverlay() {
    el.overlay.classList.add('gone');
    startContent(false);
    later(function () { el.overlay.style.display = 'none'; }, 700);
  }
  el.overlay.addEventListener('click', openCard);
  el.overlay.addEventListener('touchend', function (e) {
    /* 密语框内正常聚焦输入，不当作开场点按 */
    if (e.target && e.target.closest && e.target.closest('.lock-box')) return;
    e.preventDefault();
    openCard();
  }, { passive: false });
  el.overlay.addEventListener('keydown', function (e) {
    /* 密语框里正常打字（含空格），不触发开场 */
    if (e.target && e.target.closest && e.target.closest('.lock-box')) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCard(); }
  });

  /* ============================================================
   * 定时开启：到点前盖一层倒计时门，点门/到点自动揭开。
   * 门在 overlay 之上，没到点连信封都点不到。
   * ============================================================ */
  function fmtGateTime(ms) {
    var d = new Date(ms);
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日 ' +
      p(d.getHours()) + ':' + p(d.getMinutes());
  }
  var gateTimer = 0;
  function tickGate() {
    if (!gateOn) return;
    var left = cfg.unlockAt - Date.now();
    if (left <= 0) { closeTimeGate(); return; }
    var s = Math.floor(left / 1000);
    el.tgD.textContent = Math.floor(s / 86400);
    el.tgH.textContent = Math.floor((s % 86400) / 3600);
    el.tgM.textContent = Math.floor((s % 3600) / 60);
    el.tgS.textContent = s % 60;
  }
  function closeTimeGate() {
    if (!gateOn) return;
    gateOn = false;
    clearInterval(gateTimer);
    el.timeGate.classList.remove('show');
    /* 门开了才把跳过还给收卡人 */
    if (!PREVIEW && !locked) el.skip.classList.add('show');
    window.Hanabi.toast('到点了，点按开启吧');
    /* 解锁瞬间放烟花：等待本身也值得庆祝 */
    burst('confetti');
    /* 若还设了滑动门槛，接着滑 */
    maybeShowGate();
  }
  function checkTimeGate() {
    /* 预览与未定时的卡不设门；编辑器预览永远直接进 */
    if (PREVIEW || !cfg.unlockAt) return;
    if (cfg.unlockAt <= Date.now()) return; // 已过点：静默放行
    gateOn = true;
    el.tgWhen.textContent = fmtGateTime(cfg.unlockAt);
    el.timeGate.classList.add('show');
    if (!PREVIEW) el.skip.classList.remove('show');
    tickGate();
    /* 每秒走字，到点自己开门（不依赖用户交互） */
    clearInterval(gateTimer);
    gateTimer = setInterval(tickGate, 1000);
  }
  el.timeGate.addEventListener('click', function () {
    if (cfg.unlockAt && cfg.unlockAt <= Date.now()) closeTimeGate();
    else tickGate();
  });
  /* 从后台切回/休眠唤醒时补一拍，避免倒计时停在旧值 */
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) tickGate();
  });

  /* ============================================================
   * 密语解锁：k1. 加密链接先按演示卡呈现，答对密语才换真配置。
   * 密语只在本地派生密钥，不回传、不落地。
   * ============================================================ */
  function bindLock() {
    /* 上锁阶段：不露跳过，开场提示换成密语框 */
    el.skip.classList.remove('show');
    var hint = el.overlay.querySelector('.open-hint');
    if (hint) hint.style.display = 'none';
    el.lockBox.hidden = false;
    var busy = false;
    function tryUnlock() {
      if (busy) return;
      var pass = (el.lockPass.value || '').trim();
      if (!pass) { el.lockPass.focus(); return; }
      busy = true;
      el.lockGo.disabled = true;
      el.lockGo.textContent = '试试…';
      C.decryptWithPass(cfgCode, pass).then(function (next) {
        cfg = next;
        locked = false;
        /* 导出文件内嵌的音乐在上锁分支没采信，解锁后补上 */
        var embed = window.__HANABI_EMBED__;
        if (embed && typeof embed.music === 'string' && embed.music.indexOf('data:audio/') === 0) {
          cfg.music = embed.music;
        }
        if (hint) hint.style.display = '';
        el.lockPass.value = '';
        el.lockBox.hidden = true;
        applyAll();
        refreshMakeHref();
        el.skip.classList.add('show');
        checkTimeGate(); // 若同时设了定时，先过门
        if (!gateOn) openCard();
      }).catch(function () {
        busy = false;
        el.lockGo.disabled = false;
        el.lockGo.textContent = '开启';
        el.lockPass.value = '';
        el.lockPass.classList.remove('bad');
        void el.lockPass.offsetWidth;
        el.lockPass.classList.add('bad');
        window.Hanabi.toast('密语不对，再想想');
        el.lockPass.focus();
      });
    }
    el.lockGo.addEventListener('click', function (e) { e.stopPropagation(); tryUnlock(); });
    el.lockPass.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); tryUnlock(); }
    });
    el.lockPass.addEventListener('input', function () { el.lockPass.classList.remove('bad'); });
    /* 点密语框之外的浮层空白不触发开场（openCard 已被 locked 挡住） */
  }
  if (locked && !PREVIEW) bindLock();

  /* ---------- 跳过：直达结尾（键盘 Esc 同样可用） ---------- */
  el.skip.addEventListener('click', function (e) {
    e.stopPropagation();
    finishAll();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !ended) finishAll();
  });
  function finishAll() {
    if (locked) return; // 没答对密语，什么都跳不到
    if (el.timeGate && el.timeGate.classList.contains('show')) return; // 没到点不许跳过
    clearFlow();
    opened = true;
    ended = true;
    awaitingPage = false;
    el.overlay.classList.add('gone');
    el.overlay.style.display = 'none';
    hideHint();
    el.to.classList.add('show');
    el.orn.classList.add('show');
    el.msgWrap.classList.add('show');
    renderTitle(true);
    /* 多页一并铺开：分页符折叠成换行 */
    el.msg.textContent = C.splitMessage(cfg.message).join('\n');
    if (photos.length) {
      showPhoto(0);
      el.photoWrap.classList.add('show');
    }

    runPranks(true); // 跳过的朋友也别错过彩蛋

    if (cfg.custom !== 'off') {
      showLetter();
      showActions();
      audioStart();
      return;
    }

    if (document.body.classList.contains('has-cake')) {
      el.cakeWrap.classList.add('show');
      el.blow.classList.remove('show');
      el.cake.querySelectorAll('.candle').forEach(function (cd) { cd.classList.add('out'); });
      document.body.classList.add('lit');
    }
    blown = true;
    revealSignature(true);
    audioStart();
  }

  /* ---------- 结尾按钮 ---------- */
  el.replay.addEventListener('click', function () { location.reload(); });
  /* 「回 TA 一张」：收发对调、带去编辑器预填，来往就成了一条线 */
  function refreshMakeHref() {
    el.make.href = 'index.html#' + C.toHash(Object.assign({}, cfg, {
      to: cfg.from,
      from: cfg.to,
      custom: 'off'
    }));
  }
  refreshMakeHref();
  el.mute.addEventListener('click', function (e) {
    e.stopPropagation();
    var on = audioToggle();
    if (on !== null) el.mute.classList.toggle('off', !on);
  });

  /* ============================================================
   * 预览模式：隐藏跳过/音乐/结尾按钮，自动开场（预览保持静音）；
   * 接收编辑器的 postMessage 热更新配置（不重载页面）。
   * ============================================================ */
  if (PREVIEW) {
    el.skip.style.display = 'none';
    el.mute.style.display = 'none';
    el.actions.style.display = 'none';
    /* 刮刮卡/拂晓雾开场没法在预览里强制收卡人做手势：直接替 TA 完成动作 */
    later(function () {
      if (!el.scratchCard.hidden || !el.fogCv.hidden) completeOpening();
      else openCard();
    }, 450);
  }

  window.addEventListener('message', function (ev) {
    /* 只接受自家编辑器预览发来的消息：须来自父窗口，
     * https 部署下再校验同源（file:// 双开时 origin 序列化不可靠，放宽） */
    if (ev.source !== window.parent) return;
    if (location.protocol !== 'file:' && ev.origin !== location.origin) return;
    var d = ev.data;
    if (!d) return;
    /* 编辑器预览工具条：重播 */
    if (d.type === 'hanabi-replay') { location.reload(); return; }
    if (d.type !== 'hanabi-config' || !d.config) return;
    var next = {};
    for (var k in d.config) next[k] = d.config[k];
    /* 消息里没带音乐时沿用当前音乐（预览的消息一律静音） */
    if (next.music === undefined && cfg.music !== 'off') next.music = cfg.music;
    cfg = C.sanitize(next);
    opened = true;
    el.overlay.classList.add('gone');
    el.overlay.style.display = 'none';
    applyAll();
    startContent(true); // 快速重播内容段落，跳过开场动画
  });

  /* 通知编辑器"预览就绪"，此后配置走 postMessage 而不是重载 iframe */
  if (window.parent !== window) {
    try { window.parent.postMessage({ type: 'hanabi-ready' }, '*'); } catch (e) { /* 忽略 */ }
  }

  /* ---------- 启动 ---------- */
  applyAll();
  bindMuyu();
  bindGateSlider();
  /* 启动顺序：定时门优先（门在锁之上）；锁卡不露跳过 */
  checkTimeGate();
  /* 定时门之后是滑动门槛（两道门可叠加） */
  if (!gateOn) maybeShowGate();
  if (!PREVIEW && !locked && !gateOn) el.skip.classList.add('show');
  /* 同一标签页里打开另一条贺卡链接（仅 hash 变化、不重载）时，
     强制整页刷新，确保按新配置完整播放 */
  window.addEventListener('hashchange', function () { location.reload(); });
})();
