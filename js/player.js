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

  /* 配置来源优先级：导出文件内嵌 > 链接 hash > 默认演示 */
  var cfg;
  var cfgCode = ''; // 配置编码原文：帖号与签语都由它推导
  (function () {
    var embed = window.__HANABI_EMBED__;
    if (embed && typeof embed.code === 'string' && embed.code) {
      cfgCode = embed.code;
      cfg = C.fromHash('#' + embed.code);
      /* 导出文件里的音乐不受链接体积限制，直接采信 */
      if (typeof embed.music === 'string' && embed.music.indexOf('data:audio/') === 0) {
        cfg.music = embed.music;
      }
    } else {
      cfgCode = location.hash.replace(/^#/, '');
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

  /* 颜色混合：把 a 向 b 拉近 ratio（0~1），用于派生背景层次 */
  function mixHex(a, b, ratio) {
    function ch(h, i) {
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
        function finish(ok) { if (!done) { done = true; resolve(ok); } }
        a.onended = function () { finish(true); };
        a.onerror = function () { finish(false); };
        var p = a.play();
        if (p && p.catch) p.catch(function () { finish(false); });
        /* 编码异常等极端情况：10 秒兜底，不让音乐一直等 */
        setTimeout(function () { finish(false); }, 10000);
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
      reduced: REDUCED
    });
    /* 生日/圣诞用礼盒开场，生日独有蛋糕蜡烛 */
    var isBirthday = cfg.occasion === 'birthday';
    var isGift = isBirthday || cfg.occasion === 'christmas';
    document.body.classList.toggle('has-gift', isGift);
    document.body.classList.toggle('has-cake', isBirthday);
    /* 自定义信笺模式：内置版式让位，展示 TA 自己写的网页 */
    document.body.classList.toggle('letter-mode', cfg.custom !== 'off');
    el.envLetterTo.textContent = cfg.to;
    /* 微信等环境里，标题栏跟随卡片内容 */
    document.title = '有一张给「' + cfg.to + '」的贺卡';
    /* 帖号：由链接本身推导，同一链接永远同号 */
    var editionText = '花火贺卡 · ' + C.editionOf(location.hash.replace(/^#/, ''));
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
    /* 题下金线：标题弹完再描画 */
    el.titleStroke.classList.remove('draw');
    if (!REDUCED) {
      later(function () { el.titleStroke.classList.add('draw'); }, n * step + 220);
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

  el.stage.addEventListener('pointerdown', function (e) {
    if (!opened) return;
    if (e.target && e.target.closest && e.target.closest('button, a, figure')) return;
    /* 多页祝福：翻页优先；末页之后点屏才赠心 */
    if (awaitingPage) { advancePage(); return; }
    spawnHeart(e.clientX, e.clientY);
  });
  /* 照片：轻触放大/还原 */
  el.photoFig.addEventListener('click', function (e) {
    e.stopPropagation();
    el.photoFig.classList.toggle('zoomed');
  });

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
    }
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
   * 生日互动：吹蜡烛 → 火焰熄灭、冒烟、画面变亮 → 署名
   * ============================================================ */
  function blowCandles() {
    if (blown || !document.body.classList.contains('has-cake')) return;
    blown = true;
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

  function revealSignature() {
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
    /* 帖号签语随后浮现：同一链接永远同一句 */
    later(function () {
      var f = C.fortuneOf(cfgCode);
      el.fortune.textContent = '';
      var no = document.createElement('b');
      no.textContent = f.no;
      el.fortune.appendChild(no);
      el.fortune.appendChild(document.createTextNode('第 ' + f.no.slice(3) + ' 签 · ' + f.text));
      el.fortune.classList.add('show');
    }, 800);
    later(hideHint, 2600);
    later(showActions, 900);
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
    showHint('轻触屏幕 · 赠一颗心');
    if (cfg.photo) {
      el.photoImg.src = cfg.photo;
      el.photoWrap.classList.add('show');
    }
    if (document.body.classList.contains('has-cake')) {
      /* 生日：出现蛋糕和蜡烛，等 TA 吹灭 */
      el.cakeWrap.classList.add('show');
      el.blow.classList.add('show');
      if (onAllDone) onAllDone();
    } else {
      later(revealSignature, fast ? 500 : 1100);
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
    var tDur = renderTitle(fast);
    later(function () {
      typePage(fast, null);
    }, fast ? 150 : 300);
  }

  /* ============================================================
   * 开场：信封（通用）/ 礼盒（生日·圣诞），点按开启。
   * 这一次点按同时是用户手势，用来解锁音频播放：
   * 有语音先放语音（对方的声音最要紧），结束后音乐才起。
   * ============================================================ */
  function openCard() {
    if (opened) return;
    opened = true;
    if (cfg.voice !== 'off') {
      playVoice().then(function () { audioStart(); });
      /* 语音被浏览器拦截等极端情况：给音乐一个兜底入口 */
      later(function () { if (cfg.music !== 'off' && !bgAudio) audioStart(); }, 4000);
    } else {
      audioStart();
    }
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
  function hideOverlay() {
    el.overlay.classList.add('gone');
    startContent(false);
    later(function () { el.overlay.style.display = 'none'; }, 700);
  }
  el.overlay.addEventListener('click', openCard);
  el.overlay.addEventListener('touchend', function (e) { e.preventDefault(); openCard(); }, { passive: false });
  el.overlay.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCard(); }
  });

  /* ---------- 跳过：直达结尾（键盘 Esc 同样可用） ---------- */
  el.skip.addEventListener('click', function (e) {
    e.stopPropagation();
    finishAll();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !ended) finishAll();
  });
  function finishAll() {
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
    if (cfg.photo) {
      el.photoImg.src = cfg.photo;
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
    revealSignature();
    audioStart();
  }

  /* ---------- 结尾按钮 ---------- */
  el.replay.addEventListener('click', function () { location.reload(); });
  /* 「回 TA 一张」：收发对调、带去编辑器预填，来往就成了一条线 */
  el.make.href = 'index.html#' + C.toHash(Object.assign({}, cfg, {
    to: cfg.from,
    from: cfg.to,
    custom: 'off'
  }));
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
    later(openCard, 450);
  }

  window.addEventListener('message', function (ev) {
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
  /* 跳过按钮自加载起即可用，随时直达结尾 */
  if (!PREVIEW) el.skip.classList.add('show');
  /* 同一标签页里打开另一条贺卡链接（仅 hash 变化、不重载）时，
     强制整页刷新，确保按新配置完整播放 */
  window.addEventListener('hashchange', function () { location.reload(); });
})();
