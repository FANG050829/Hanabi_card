/* ============================================================
 * 花火贺卡 · editor.js
 * 编辑器：灵感模板一键套用、手气随机、左侧落笔表单、
 * 右侧手机壳实时预览（iframe + postMessage）、封笺生成链接。
 * 支持 index.html#<code> 预填样式（"我也要制作"会带样式跳来）。
 * ============================================================ */
(function () {
  'use strict';
  var C = window.Hanabi.Config;
  var TH = window.Hanabi.Themes;
  var EFFECTS = window.Hanabi.Effects.list();

  function $(id) { return document.getElementById(id); }
  var els = {
    to: $('fTo'), title: $('fTitle'), message: $('fMessage'), from: $('fFrom'),
    msgCount: $('msgCount'),
    blessBtn: $('blessBtn'),
    pageBreakBtn: $('pageBreakBtn'),
    occasionGroup: $('occasionGroup'),
    layoutGroup: $('layoutGroup'),
    openingGroup: $('openingGroup'),
    oracleGroup: $('oracleGroup'),
    gateGroup: $('gateGroup'),
    poemBtn: $('poemBtn'),
    poemRow: $('poemRow'),
    swShake: $('swShake'),
    swShine: $('swShine'),
    swDoodle: $('swDoodle'),
    swSpectrum: $('swSpectrum'),
    swTrail: $('swTrail'),
    themeGroup: $('themeGroup'),
    effectGroup: $('effectGroup'),
    fontGroup: $('fontGroup'),
    fDensity: $('fDensity'),
    densityVal: $('densityVal'),
    accentRow: $('accentRow'),
    accentCustom: $('accentCustom'),
    bgRow: $('bgRow'),
    bgCustom: $('bgCustom'),
    prankGroup: $('prankGroup'),
    photoFile: $('photoFile'),
    photoUp: $('photoUp'),
    photoDel: $('photoDel'),
    photoTint: $('photoTint'),
    photoStrip: $('photoStrip'),
    photoMeta: $('photoMeta'),
    recBtn: $('recBtn'),
    voicePrev: $('voicePrev'),
    voiceDel: $('voiceDel'),
    recTime: $('recTime'),
    voiceMeta: $('voiceMeta'),
    signpad: $('signpad'),
    signPadCanvas: $('signPadCanvas'),
    signClear: $('signClear'),
    signMeta: $('signMeta'),
    replayBtn: $('replayPrevBtn'),
    popOutBtn: $('popOutBtn'),
    clearBtn: $('clearBtn'),
    musicFile: $('musicFile'),
    musicUp: $('musicUp'),
    musicPrev: $('musicPrev'),
    musicDel: $('musicDel'),
    musicMeta: $('musicMeta'),
    musicTip: $('musicTip'),
    stripTip: $('stripTip'),
    exportBtn: $('exportBtn'),
    customFile: $('customFile'),
    customUp: $('customUp'),
    customPrev: $('customPrev'),
    customDel: $('customDel'),
    customMeta: $('customMeta'),
    customLinkTip: $('customLinkTip'),
    mailTo: $('mailTo'),
    mailBtn: $('mailBtn'),
    smsTo: $('smsTo'),
    smsBtn: $('smsBtn'),
    printBtn: $('printBtn'),
    shareBtn: $('shareBtn'),
    fPass: $('fPass'),
    fUnlock: $('fUnlock'),
    passState: $('passState'),
    unlockState: $('unlockState'),
    icsBtn: $('icsBtn'),
    fortunePrev: $('fortunePrev'),
    mailCopyBtn: $('mailCopyBtn'),
    mailPreview: $('mailPreview'),
    templates: $('templateStrip'),
    lucky: $('luckyBtn'),
    gen: $('genBtn'),
    linkBox: $('linkBox'),
    linkInput: $('linkInput'),
    copy: $('copyBtn'),
    fileTip: $('fileTip'),
    iframe: $('preview'),
    phone: $('phone'),
    previewCol: $('previewCol'),
    previewBar: document.querySelector('.preview-bar'),
    previewCap: $('previewCap')
  };

  /* ---------- 状态：hash 预填 > 本地草稿 > 默认演示 ---------- */
  var preloaded = location.hash.length > 1;
  var draft = null;
  if (!preloaded) {
    try { draft = JSON.parse(localStorage.getItem('hanabi-draft-v1') || 'null'); } catch (e) { draft = null; }
  }
  var restored = !preloaded && draft && typeof draft === 'object';
  var state = preloaded ? C.fromHash(location.hash)
    : (restored ? C.sanitize(draft) : C.defaults());
  var dirty = (preloaded || restored)
    ? { to: true, title: true, message: true, from: true }
    : { to: false, title: false, message: false, from: false };
  var previewReady = false;
  var syncTimer = null;

  /* ---------- 填充表单 ---------- */
  els.to.value = state.to;
  els.title.value = state.title;
  els.message.value = state.message;
  els.from.value = state.from;
  if (state.music !== 'off') {
    els.musicMeta.textContent = '已随链接携带自定义音乐';
    els.musicPrev.hidden = false;
    els.musicDel.hidden = false;
  }
  /* 旧草稿只有单张 photo：迁移进 photos 数组走新通道 */
  if ((!state.photos || !state.photos.length) && state.photo) {
    state.photos = [state.photo];
  }
  if (!Array.isArray(state.photos)) state.photos = [];
  if (state.photos.length) updatePhotoUI();
  if (state.voice !== 'off') { updateVoiceUI(0); }
  if (state.sign) {
    els.signpad.classList.add('dirty');
    els.signMeta.textContent = '手写签名已就位 · 会一笔一划写出来';
  }
  if (state.custom !== 'off') updateCustomUI();
  updateCount();

  /* ---------- 灵感模板条：每张卡的画布里跑着真实粒子效果 ----------
   * 静止时是引擎预演出的一帧（reduced），悬停时原地转为实况动画。 */
  var tplEngines = []; // { card, canvas, theme, effect, live }
  C.TEMPLATES.forEach(function (tpl) {
    var theme = TH.get(tpl.cfg.theme);
    var card = document.createElement('button');
    card.type = 'button';
    card.className = 'tpl-card';
    card.innerHTML = '<i class="tpl-sw" aria-hidden="true"><canvas></canvas></i><span class="tpl-name"></span><span class="tpl-desc"></span><span class="tpl-badge" hidden>电脑端</span>';
    var sw = card.querySelector('.tpl-sw');
    sw.style.background =
      'radial-gradient(120% 120% at 30% 20%,' + theme.swatch[0] + ' 0%,transparent 55%),' + theme.swatch[1];
    card.querySelector('.tpl-name').textContent = tpl.name;
    card.querySelector('.tpl-desc').textContent = tpl.desc;
    card.querySelector('.tpl-badge').hidden = !tpl.cfg.layout;
    tplEngines.push({
      card: card,
      canvas: card.querySelector('canvas'),
      theme: tpl.cfg.theme,
      effect: tpl.cfg.effect,
      live: null
    });
    card.addEventListener('click', function () {
      /* 套用样式与文案，但保留用户已填的收件人与署名 */
      var keep = { to: state.to, from: state.from };
      state = C.sanitize(Object.assign({}, state, tpl.cfg, keep));
      dirty.title = true; dirty.message = true;
      els.title.value = state.title;
      els.message.value = state.message;
      updateCount();
      markChecks();
      scheduleSync();
      card.classList.remove('tpl-hit');
      void card.offsetWidth;
      card.classList.add('tpl-hit');
      window.Hanabi.toast('已套用「' + tpl.name + '」');
    });
    els.templates.appendChild(card);
  });
  function mountTpl(e, live) {
    if (e.live) { e.live.stop(); e.live = null; }
    e.live = window.Hanabi.Effects.mount(e.canvas, e.effect, {
      palette: TH.get(e.theme).palette,
      light: TH.get(e.theme).light === true,
      density: 0.9,
      reduced: !live
    });
  }
  /* 灵感卡实况：滚出视野就停掉引擎、回到视野再挂上，
   * 不在看不见的画布上白烧帧（引擎自带 resize 处理，无需额外照看）。 */
  if ('IntersectionObserver' in window) {
    var tplIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var e = tplEngines[(en.target.getAttribute('data-tpl') || '0') * 1];
        if (!e) return;
        if (en.isIntersecting) { if (!e.live) mountTpl(e, true); }
        else if (e.live) { e.live.stop(); e.live = null; }
      });
    }, { rootMargin: '80px' });
    tplEngines.forEach(function (e, i) {
      e.card.setAttribute('data-tpl', String(i));
      tplIO.observe(e.card);
    });
  } else {
    tplEngines.forEach(function (e) { mountTpl(e, true); });
  }

  /* ---------- 场景选项 ---------- */
  Object.keys(C.OCCASIONS).forEach(function (key) {
    var item = C.OCCASIONS[key];
    var label = document.createElement('label');
    label.className = 'pill';
    var input = document.createElement('input');
    input.type = 'radio';
    input.name = 'occasion';
    input.value = key;
    input.checked = key === state.occasion;
    var span = document.createElement('span');
    span.textContent = item.label;
    label.appendChild(input);
    label.appendChild(span);
    input.addEventListener('change', function () {
      if (!input.checked) return;
      state.occasion = key;
      /* 未手动编辑过的文案跟随场景预设 */
      var p = item.preset;
      if (!dirty.title) { state.title = p.title; els.title.value = p.title; }
      if (!dirty.message) { state.message = p.message; els.message.value = p.message; updateCount(); }
      scheduleSync();
    });
    els.occasionGroup.appendChild(label);
  });

  /* ---------- 版式选项：手机竖屏 / 电脑横屏（横卷·屏风） ---------- */
  Object.keys(C.LAYOUTS).forEach(function (key) {
    var item = C.LAYOUTS[key];
    var label = document.createElement('label');
    label.className = 'pill';
    var input = document.createElement('input');
    input.type = 'radio';
    input.name = 'layout';
    input.value = key;
    input.checked = key === state.layout;
    var span = document.createElement('span');
    span.textContent = item.label;
    if (item.pc) span.title = '电脑横屏版式 · 手机上打开自动回退竖屏';
    label.appendChild(input);
    label.appendChild(span);
    input.addEventListener('change', function () {
      if (!input.checked) return;
      state.layout = key;
      applyPreviewShell();
      scheduleSync();
    });
    els.layoutGroup.appendChild(label);
  });

  /* ---------- 通用：一组单选胶囊（注册表 -> chips） ---------- */
  function renderChipGroup(container, registry, groupName, getState, setState) {
    if (!container) return;
    Object.keys(registry).forEach(function (key) {
      var item = registry[key];
      var label = document.createElement('label');
      label.className = 'pill';
      var input = document.createElement('input');
      input.type = 'radio';
      input.name = groupName;
      input.value = key;
      input.checked = key === getState();
      var span = document.createElement('span');
      span.textContent = item.label;
      if (item.tip) span.title = item.tip;
      label.appendChild(input);
      label.appendChild(span);
      input.addEventListener('change', function () {
        if (!input.checked) return;
        setState(key);
        scheduleSync();
      });
      container.appendChild(label);
    });
  }

  /* ---------- 开场方式 / 收尾互动 / 开启门槛 ---------- */
  renderChipGroup(els.openingGroup, C.OPENINGS, 'opening',
    function () { return state.opening; },
    function (k) { state.opening = k; });
  renderChipGroup(els.oracleGroup, C.ORACLES, 'oracle',
    function () { return state.oracle; },
    function (k) { state.oracle = k; });
  renderChipGroup(els.gateGroup, C.GATES, 'gate',
    function () { return state.gate; },
    function (k) { state.gate = k; });

  /* ---------- 细节开关（布尔开关，'on'/'off'） ---------- */
  [['swTrail', 'trail', '收卡人手指划过卡面，拖出一串主题色微光'],
   ['swShine', 'shine', '一道金光周期性扫过标题'],
   ['swDoodle', 'doodle', '标题上方一笔笔画出小涂鸦'],
   ['swSpectrum', 'spectrum', '有背景音乐时，卡面底部随旋律跳动'],
   ['swShake', 'shake', '收卡人摇一摇手机，漫天彩带（会请求传感器权限）']
  ].forEach(function (pair) {
    var el = els[pair[0]], key = pair[1];
    if (!el) return;
    el.checked = state[key] === 'on';
    el.addEventListener('change', function () {
      state[key] = el.checked ? 'on' : 'off';
      scheduleSync();
    });
  });

  /* ---------- 藏头诗：四句藏一个吉祥话，点选直接填进祝福语 ---------- */
  if (els.poemBtn && els.poemRow) {
    C.POEMS.forEach(function (poem) {
      var label = document.createElement('label');
      label.className = 'pill';
      var input = document.createElement('input');
      input.type = 'radio';
      input.name = 'poem';
      input.value = poem.label;
      var span = document.createElement('span');
      span.textContent = poem.label;
      span.title = poem.text.replace(/\n/g, ' / ');
      label.appendChild(input);
      label.appendChild(span);
      input.addEventListener('change', function () {
        if (!input.checked) return;
        state.message = poem.text;
        els.message.value = poem.text;
        dirty.message = true;
        updateCount();
        input.checked = false; // 清掉选中态：同一首下次点选仍会触发
        els.poemRow.hidden = true;
        scheduleSync();
        window.Hanabi.toast('已填入藏头诗「' + poem.label + '」，可再润色');
      });
      els.poemRow.appendChild(label);
    });
    els.poemBtn.addEventListener('click', function () {
      els.poemRow.hidden = !els.poemRow.hidden;
    });
  }

  /* ---------- 主题选项（方形色片） ---------- */  TH.list().forEach(function (t) {
    var label = document.createElement('label');
    label.className = 'theme-card';
    var input = document.createElement('input');
    input.type = 'radio';
    input.name = 'theme';
    input.value = t.name;
    input.checked = t.name === state.theme;
    var sw = document.createElement('span');
    sw.className = 'sw';
    sw.style.background = 'radial-gradient(140% 140% at 30% 25%,' + t.swatch[0] + ' 0%,transparent 60%),' + t.swatch[1];
    var name = document.createElement('span');
    name.className = 'sw-name';
    name.textContent = t.label;
    label.appendChild(input);
    label.appendChild(sw);
    label.appendChild(name);
    input.addEventListener('change', function () {
      if (!input.checked) return;
      state.theme = t.name;
      scheduleSync();
    });
    els.themeGroup.appendChild(label);
  });

  /* ---------- 粒子效果选项 ---------- */
  EFFECTS.forEach(function (fx) {
    var label = document.createElement('label');
    label.className = 'pill';
    var input = document.createElement('input');
    input.type = 'radio';
    input.name = 'effect';
    input.value = fx.name;
    input.checked = fx.name === state.effect;
    var span = document.createElement('span');
    span.textContent = fx.label;
    span.title = fx.desc;
    label.appendChild(input);
    label.appendChild(span);
    input.addEventListener('change', function () {
      if (!input.checked) return;
      state.effect = fx.name;
      scheduleSync();
    });
    els.effectGroup.appendChild(label);
  });

  /* ---------- 字体选项 ---------- */
  Object.keys(C.FONTS).forEach(function (key) {
    var label = document.createElement('label');
    label.className = 'pill';
    var input = document.createElement('input');
    input.type = 'radio';
    input.name = 'font';
    input.value = key;
    input.checked = key === state.font;
    var span = document.createElement('span');
    span.textContent = C.FONTS[key].label;
    label.appendChild(input);
    label.appendChild(span);
    input.addEventListener('change', function () {
      if (!input.checked) return;
      state.font = key;
      scheduleSync();
    });
    els.fontGroup.appendChild(label);
  });

  /* ---------- 彩蛋效果选项 ---------- */
  Object.keys(C.PRANKS).forEach(function (key) {
    var label = document.createElement('label');
    label.className = 'pill';
    var input = document.createElement('input');
    input.type = 'radio';
    input.name = 'prank';
    input.value = key;
    input.checked = key === state.prank;
    var span = document.createElement('span');
    span.textContent = C.PRANKS[key].label;
    label.appendChild(input);
    label.appendChild(span);
    input.addEventListener('change', function () {
      if (!input.checked) return;
      state.prank = key;
      scheduleSync();
    });
    els.prankGroup.appendChild(label);
  });

  /* ---------- 强调色 / 背景色自定义（''=跟随主题） ---------- */
  var ACCENT_PRESETS = ['#5f7d72', '#b9777c', '#8a6f45', '#54756c', '#a58455', '#6e7ba3', '#a37a9e', '#c96a4e'];
  var BG_PRESETS = ['#f8f7f3', '#eef3f1', '#fbf3f0', '#f7f0e2', '#eef2f6', '#f3eef4'];
  function buildSwatchRow(rowEl, presets, key, customInput) {
    presets.forEach(function (hex) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'sw-dot';
      b.style.background = hex;
      b.title = hex;
      b.addEventListener('click', function () {
        state[key] = hex;
        markSwatches(rowEl, key, customInput);
        scheduleSync();
      });
      b.setAttribute('data-v', hex);
      rowEl.appendChild(b);
    });
    /* 跟随主题 */
    var auto = document.createElement('button');
    auto.type = 'button';
    auto.className = 'sw-dot sw-auto';
    auto.title = '跟随主题';
    auto.addEventListener('click', function () {
      state[key] = '';
      markSwatches(rowEl, key, customInput);
      scheduleSync();
    });
    rowEl.insertBefore(auto, rowEl.firstChild);
    if (customInput) {
      customInput.addEventListener('input', function () {
        state[key] = customInput.value;
        markSwatches(rowEl, key, customInput);
        scheduleSync();
      });
    }
  }
  function markSwatches(rowEl, key, customInput) {
    var dots = rowEl.querySelectorAll('.sw-dot');
    dots.forEach(function (d) {
      d.classList.toggle('sel', d.getAttribute('data-v') === state[key]);
    });
    if (customInput) {
      var matched = false;
      dots.forEach(function (d) { if (d.getAttribute('data-v') === state[key]) matched = true; });
      customInput.classList.toggle('sel', state[key] !== '' && !matched);
      if (state[key] !== '' && !matched) customInput.value = state[key];
    }
  }
  buildSwatchRow(els.accentRow, ACCENT_PRESETS, 'accent', els.accentCustom);
  buildSwatchRow(els.bgRow, BG_PRESETS, 'bg', els.bgCustom);

  /* ---------- 粒子密度 ---------- */
  function syncDensityFill() {
    var min = parseFloat(els.fDensity.min) || 0;
    var max = parseFloat(els.fDensity.max) || 100;
    var pct = (parseFloat(els.fDensity.value) - min) / (max - min) * 100;
    els.fDensity.style.setProperty('--fill', pct.toFixed(1) + '%');
  }
  els.fDensity.value = Math.round(state.density * 100);
  els.densityVal.textContent = state.density.toFixed(1) + '×';
  syncDensityFill();
  els.fDensity.addEventListener('input', function () {
    state.density = parseInt(els.fDensity.value, 10) / 100;
    els.densityVal.textContent = state.density.toFixed(1) + '×';
    syncDensityFill();
    scheduleSync();
  });

  /* 同步所有单选组的选中态（模板/手气改状态后调用） */
  function markChecks() {
    ['occasion', 'layout', 'opening', 'oracle', 'gate', 'theme', 'effect', 'font', 'prank'].forEach(function (group) {
      var inputs = document.querySelectorAll('input[name="' + group + '"]');
      inputs.forEach(function (inp) {
        inp.checked = inp.value === state[group];
      });
    });
    /* 细节开关跟着状态走（模板/手气可能整体改写配置） */
    [['swTrail', 'trail'], ['swShine', 'shine'], ['swDoodle', 'doodle'], ['swSpectrum', 'spectrum'], ['swShake', 'shake']]
      .forEach(function (pair) {
        var el = els[pair[0]];
        if (el) el.checked = state[pair[1]] === 'on';
      });
    applyPreviewShell();
    markSwatches(els.accentRow, 'accent', els.accentCustom);
    markSwatches(els.bgRow, 'bg', els.bgCustom);
    els.fDensity.value = Math.round(state.density * 100);
    els.densityVal.textContent = state.density.toFixed(1) + '×';
    syncDensityFill();
  }

  /* ---------- 文本字段绑定 ---------- */
  bindText(els.to, 'to', C.LIMITS.to);
  bindText(els.title, 'title', C.LIMITS.title);
  bindText(els.from, 'from', C.LIMITS.from);
  els.message.addEventListener('input', function () {
    state.message = els.message.value.slice(0, C.LIMITS.message);
    dirty.message = true;
    updateCount();
    scheduleSync();
  });

  /* ============================================================
   * 自定义音乐：上传本地 mp3 / m4a / wav 等，编辑器内可试听。
   * 页面本身没有任何内置音频；上传后：
   *   ≤ 300KB -> 直接随链接发给朋友；
   *   更大    -> 链接不含音乐，用「导出贺卡文件」携带完整音频。
   * ============================================================ */
  var prevAudio = null;
  els.musicUp.addEventListener('click', function () { els.musicFile.click(); });
  els.musicFile.addEventListener('change', function () {
    var f = els.musicFile.files && els.musicFile.files[0];
    if (!f) return;
    var okType = (f.type && f.type.indexOf('audio') === 0) ||
      /\.(mp3|m4a|aac|wav|ogg|oga|flac|webm)$/i.test(f.name);
    if (!okType) { window.Hanabi.toast('请选择音频文件（mp3 / m4a / wav 等）'); return; }
    if (f.size > 6 * 1024 * 1024) { window.Hanabi.toast('音乐超过 6MB，换个小一点的吧'); return; }
    var fr = new FileReader();
    fr.onload = function () {
      state.music = String(fr.result); // data:audio/...;base64,...
      musicUI(f.name, f.size);
      scheduleSync();
      window.Hanabi.toast('音乐已就位，可以试听一下');
    };
    fr.onerror = function () { window.Hanabi.toast('读取失败，换一个文件试试'); };
    fr.readAsDataURL(f);
  });
  function musicUI(name, size) {
    var mb = size / 1024 / 1024;
    els.musicMeta.textContent = name + ' · ' + (mb >= 1 ? mb.toFixed(1) + 'MB' : Math.round(size / 1024) + 'KB');
    els.musicPrev.hidden = false;
    els.musicDel.hidden = false;
    els.musicUp.textContent = '换一首';
    var tooBig = state.music.length > C.LINK_MUSIC_CHARS;
    els.musicTip.hidden = !tooBig;
    if (tooBig) {
      els.musicTip.textContent = '这首音乐较大，链接装不下：生成链接时将不含音乐，用「导出贺卡文件」即可带上完整音乐。';
    }
  }
  function stopPrev() {
    if (prevAudio) { prevAudio.pause(); prevAudio.currentTime = 0; }
    els.musicPrev.textContent = '试听';
  }
  els.musicPrev.addEventListener('click', function () {
    if (state.music === 'off') return;
    if (!prevAudio) {
      prevAudio = new Audio(state.music);
      prevAudio.volume = 0.6;
      prevAudio.addEventListener('ended', stopPrev);
    }
    if (prevAudio.paused) {
      var p = prevAudio.play();
      if (p && p.catch) p.catch(function () {});
      els.musicPrev.textContent = '停止';
    } else {
      stopPrev();
    }
  });
  els.musicDel.addEventListener('click', function () {
    stopPrev();
    state.music = 'off';
    els.musicFile.value = '';
    els.musicMeta.textContent = '不选则无声开场';
    els.musicPrev.hidden = true;
    els.musicDel.hidden = true;
    els.musicUp.textContent = '上传音乐';
    els.musicTip.hidden = true;
    scheduleSync();
  });

  /* ============================================================
   * 照片：可多选（最多 6 张）-> 本地压缩（长边逐档、总预算分摊）->
   * 尽量压进链接限额；放不进时提示走「贺卡文件」。
   * ============================================================ */
  function compressPhoto(img, maxSide, quality) {
    var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    var scale = Math.min(1, maxSide / Math.max(w, h));
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * scale));
    c.height = Math.max(1, Math.round(h * scale));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', quality);
  }
  function photoSizes() {
    var kb = 0;
    state.photos.forEach(function (p) { kb += Math.round(p.length * 3 / 4 / 1024); });
    return kb;
  }
  function updatePhotoUI() {
    var n = state.photos.length;
    els.photoStrip.textContent = '';
    state.photos.forEach(function (src, i) {
      var cell = document.createElement('div');
      cell.className = 'photo-cell';
      var img = document.createElement('img');
      img.src = src;
      img.alt = '照片 ' + (i + 1);
      var x = document.createElement('button');
      x.type = 'button';
      x.textContent = '×';
      x.title = '移除这张';
      x.addEventListener('click', function () {
        state.photos.splice(i, 1);
        syncPhotoState();
      });
      cell.appendChild(img);
      cell.appendChild(x);
      els.photoStrip.appendChild(cell);
    });
    els.photoStrip.hidden = !n;
    els.photoDel.hidden = !n;
    els.photoTint.hidden = !n;
    els.photoUp.textContent = n ? ('再加一张（' + n + '/' + C.PHOTO_MAX_COUNT + '）') : '添加照片';
    els.photoUp.disabled = n >= C.PHOTO_MAX_COUNT;
    if (n) {
      var kb = photoSizes();
      var tooBig = false, total = 0;
      state.photos.forEach(function (p) { total += p.length; });
      tooBig = total > C.LINK_PHOTO_CHARS;
      els.photoMeta.textContent = '已选 ' + n + ' 张 · 约' + kb + 'KB' +
        (tooBig ? ' · 超出链接限额，用「贺卡文件」寄' : ' · 随链接送达');
    } else {
      els.photoMeta.textContent = '不放照片，纯净文字';
    }
  }
  function syncPhotoState() {
    /* 单张旧字段同步为首张，兼容邮件模板与旧草稿 */
    state.photo = state.photos[0] || '';
    updatePhotoUI();
    scheduleSync();
  }
  els.photoUp.addEventListener('click', function () { els.photoFile.click(); });
  els.photoFile.addEventListener('change', function () {
    var files = Array.prototype.slice.call((els.photoFile.files || []));
    if (!files.length) return;
    var room = C.PHOTO_MAX_COUNT - state.photos.length;
    if (room <= 0) { window.Hanabi.toast('最多 ' + C.PHOTO_MAX_COUNT + ' 张照片'); return; }
    files = files.slice(0, room);
    var imgs = [], failed = 0;
    files.forEach(function (f) {
      if (!/^image\//.test(f.type || '')) { failed++; return; }
      imgs.push(f);
    });
    if (!imgs.length) { window.Hanabi.toast('请选择图片文件'); return; }
    var loaded = 0, results = [];
    imgs.forEach(function (f, idx) {
      var fr = new FileReader();
      fr.onload = function () {
        var img = new Image();
        img.onload = function () {
          results[idx] = { img: img, ok: true };
          if (++loaded === imgs.length) addPhotos(results, failed);
        };
        img.onerror = function () {
          results[idx] = { ok: false };
          if (++loaded === imgs.length) addPhotos(results, failed);
        };
        img.src = String(fr.result);
      };
      fr.onerror = function () {
        results[idx] = { ok: false };
        if (++loaded === imgs.length) addPhotos(results, failed);
      };
      fr.readAsDataURL(f);
    });
  });
  function addPhotos(results, failed) {
    var added = 0, budget = C.PHOTO_MAX_CHARS;
    state.photos.forEach(function (p) { budget -= p.length; });
    results.forEach(function (r) {
      if (!r || !r.ok || budget <= 0) return;
      /* 由高到低逐档压缩，第一档同时满足单张链接限额与剩余总预算就用它 */
      var perLink = Math.max(40000, Math.floor(C.LINK_PHOTO_CHARS / C.PHOTO_MAX_COUNT));
      var tries = [[1024, 0.82], [900, 0.72], [800, 0.62], [680, 0.52], [560, 0.45]];
      var data = '';
      for (var i = 0; i < tries.length; i++) {
        data = compressPhoto(r.img, tries[i][0], tries[i][1]);
        if (data.length <= perLink) break;
      }
      if (data.length > budget) return;
      state.photos.push(data);
      budget -= data.length;
      added++;
    });
    els.photoFile.value = '';
    if (added) {
      syncPhotoState();
      maybeAutoTint();
      window.Hanabi.toast('照片已就位，会以拍立得出现在贺卡里');
    } else {
      window.Hanabi.toast(failed ? '这些图片读不出来，换一张试试' : '照片太大压不下来，换一张试试');
    }
  }
  els.photoDel.addEventListener('click', function () {
    state.photos = [];
    els.photoFile.value = '';
    syncPhotoState();
  });

  /* ---------- 照片自动取色：从第一张照片提取主色，套给强调色与背景色 ---------- */
  function extractPalette(dataUri, cb) {
    var img = new Image();
    img.onload = function () {
      try {
        var s = 48;
        var c = document.createElement('canvas');
        c.width = s; c.height = s;
        var ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, s, s);
        var d = ctx.getImageData(0, 0, s, s).data;
        /* 量化到 4×4×4 色桶计数，取出现最多的桶再求平均，
         * 并剔除太亮/太暗的桶（不适合当点缀色） */
        var buckets = {};
        for (var i = 0; i < d.length; i += 4) {
          var r = d[i], g = d[i + 1], b = d[i + 2];
          var key = (r >> 6) + ',' + (g >> 6) + ',' + (b >> 6);
          var bk = buckets[key] || (buckets[key] = { n: 0, r: 0, g: 0, b: 0 });
          bk.n++; bk.r += r; bk.g += g; bk.b += b;
        }
        var best = null;
        Object.keys(buckets).forEach(function (k) {
          var bk = buckets[k];
          var ar = bk.r / bk.n, ag = bk.g / bk.n, ab = bk.b / bk.n;
          var lum = 0.2126 * ar + 0.7152 * ag + 0.0722 * ab;
          if (lum < 46 || lum > 236) return;
          /* 频次为主，饱和度轻微加权，让颜色更"有性格" */
          var mx = Math.max(ar, ag, ab), mn = Math.min(ar, ag, ab);
          var sat = mx === 0 ? 0 : (mx - mn) / mx;
          var score = bk.n * (1 + sat * 0.6);
          if (!best || score > best.score) {
            best = { score: score, r: ar, g: ag, b: ab };
          }
        });
        if (!best) { cb(null); return; }
        function hx(n) { var s2 = Math.round(n).toString(16); return s2.length < 2 ? '0' + s2 : s2; }
        var accent = '#' + hx(best.r) + hx(best.g) + hx(best.b);
        /* 背景用同一色相向纸白拉近，保证正文可读 */
        function mix(a, t) { return Math.round(a + (255 - a) * t); }
        var bg = '#' + hx(mix(best.r, 0.86)) + hx(mix(best.g, 0.86)) + hx(mix(best.b, 0.86));
        cb({ accent: accent, bg: bg });
      } catch (e) { cb(null); }
    };
    img.onerror = function () { cb(null); };
    img.src = dataUri;
  }
  function maybeAutoTint() {
    /* 只在用户还没手动挑过颜色时自动套一次，不抢人的选择 */
    if (state.accent || state.bg) return;
    applyTint(true);
  }
  function applyTint(silent) {
    if (!state.photos.length) return;
    extractPalette(state.photos[0], function (pal) {
      if (!pal) {
        if (!silent) window.Hanabi.toast('这张照片提取不出颜色，换一张试试');
        return;
      }
      state.accent = pal.accent;
      state.bg = pal.bg;
      markSwatches(els.accentRow, 'accent', els.accentCustom);
      markSwatches(els.bgRow, 'bg', els.bgCustom);
      scheduleSync();
      if (!silent) window.Hanabi.toast('已按照片配色：强调色与背景色都换了');
    });
  }
  els.photoTint.addEventListener('click', function () { applyTint(false); });

  /* ============================================================
   * 语音祝福：现场录一段（≤60 秒），点开贺卡先闻其声。
   * MediaRecorder 按浏览器能力选编码（webm/opus 或 mp4/aac）。
   * ============================================================ */
  var mediaStream = null, mediaRec = null, recChunks = [], recTimerInt = null, recStartTs = 0;
  var voiceAudio = null;
  var REC_MIME = (function () {
    if (!window.MediaRecorder) return '';
    /* mp4/aac 各端都能播（安卓录、iPhone 收也不翻车），排在 webm/opus 前；
     * 不支持 mp4 录制的浏览器（如 Firefox）再退回 webm/opus */
    var candidates = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
    for (var i = 0; i < candidates.length; i++) {
      try { if (MediaRecorder.isTypeSupported(candidates[i])) return candidates[i]; } catch (e) { /* 忽略 */ }
    }
    return '';
  })();
  function fmtRecTime(s) { return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function updateVoiceUI(secs) {
    var isOn = state.voice !== 'off';
    els.voicePrev.hidden = !isOn;
    els.voiceDel.hidden = !isOn;
    els.recBtn.textContent = isOn ? '重录' : '按下录音';
    if (isOn) {
      var kb = Math.round(state.voice.length * 3 / 4 / 1024);
      var tooBig = state.voice.length > C.LINK_VOICE_CHARS;
      els.voiceMeta.textContent = '已录' + (secs ? ' ' + secs + ' 秒' : '') + ' · 约' + kb + 'KB' +
        (tooBig ? ' · 链接装不下，用「贺卡文件」寄' : ' · 点开即播');
    } else {
      els.voiceMeta.textContent = '不录则无声；最长 60 秒';
      els.recTime.textContent = '';
    }
  }
  function stopVoicePreview() {
    if (voiceAudio) { voiceAudio.pause(); voiceAudio.currentTime = 0; }
    els.voicePrev.textContent = '试听';
  }
  els.recBtn.addEventListener('click', function () {
    if (mediaRec && mediaRec.state === 'recording') { mediaRec.stop(); return; }
    if (!window.MediaRecorder || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      window.Hanabi.toast('这个浏览器不支持录音，可改用「上传音乐」');
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      mediaStream = stream;
      recChunks = [];
      try {
        mediaRec = REC_MIME
          ? new MediaRecorder(stream, { mimeType: REC_MIME, audioBitsPerSecond: 48000 })
          : new MediaRecorder(stream);
      }
      catch (e) { mediaRec = new MediaRecorder(stream); }
      mediaRec.ondataavailable = function (e) { if (e.data && e.data.size) recChunks.push(e.data); };
      mediaRec.onstop = function () {
        clearInterval(recTimerInt);
        els.recBtn.textContent = '重录';
        els.recBtn.classList.remove('rec');
        if (mediaStream) { mediaStream.getTracks().forEach(function (t) { t.stop(); }); mediaStream = null; }
        var secs = Math.max(1, Math.round((Date.now() - recStartTs) / 1000));
        if (!recChunks.length) { els.voiceMeta.textContent = '没录上，再试一次'; return; }
        var type = (mediaRec && mediaRec.mimeType) || REC_MIME || 'audio/webm';
        var blob = new Blob(recChunks, { type: type });
        var fr = new FileReader();
        fr.onload = function () {
          var data = String(fr.result);
          if (data.length > C.VOICE_MAX_CHARS) {
            els.voiceMeta.textContent = '录音太长装不下，录 60 秒以内试试';
            return;
          }
          state.voice = data;
          updateVoiceUI(secs);
          scheduleSync();
          window.Hanabi.toast('语音已录好，点开贺卡就会响起');
        };
        fr.readAsDataURL(blob);
      };
      mediaRec.start();
      recStartTs = Date.now();
      stopVoicePreview();
      els.recBtn.textContent = '停止录音';
      els.recBtn.classList.add('rec');
      els.recTime.textContent = '0:00';
      els.voiceMeta.textContent = '录音中…';
      recTimerInt = setInterval(function () {
        var s = Math.floor((Date.now() - recStartTs) / 1000);
        els.recTime.textContent = fmtRecTime(s);
        if (s >= 60 && mediaRec && mediaRec.state === 'recording') mediaRec.stop();
      }, 250);
    }).catch(function () {
      window.Hanabi.toast('没有拿到麦克风权限，检查一下浏览器设置');
    });
  });
  els.voicePrev.addEventListener('click', function () {
    if (state.voice === 'off') return;
    if (!voiceAudio) voiceAudio = new Audio(state.voice);
    if (voiceAudio.paused) {
      var p = voiceAudio.play();
      if (p && p.catch) p.catch(function () {});
      els.voicePrev.textContent = '停止';
    } else {
      stopVoicePreview();
    }
  });
  els.voiceDel.addEventListener('click', function () {
    stopVoicePreview();
    state.voice = 'off';
    updateVoiceUI(0);
    scheduleSync();
  });

  /* ============================================================
   * 手写署名：手写板笔迹量化成 0~4000 整数坐标（与画布尺寸无关），
   * 播放端按原笔迹一笔一划重演。
   * ============================================================ */
  var spCanvas = els.signPadCanvas, spCtx = spCanvas.getContext('2d');
  var spStrokes = []; // [{ w, p:[x0,y0,x1,y1...] }]，坐标为 0~4000 量化值
  function spSize() {
    var w = spCanvas.clientWidth, h = spCanvas.clientHeight;
    if (!w || !h) return;
    var d = Math.min(window.devicePixelRatio || 1, 2);
    spCanvas.width = Math.round(w * d);
    spCanvas.height = Math.round(h * d);
    spCtx.setTransform(d, 0, 0, d, 0, 0);
    spRedraw();
  }
  function spRedraw() {
    var w = spCanvas.clientWidth, h = spCanvas.clientHeight;
    spCtx.clearRect(0, 0, w, h);
    spCtx.strokeStyle = 'rgba(35, 37, 32, .85)';
    spCtx.lineCap = 'round';
    spCtx.lineJoin = 'round';
    spStrokes.forEach(function (s) {
      spCtx.lineWidth = s.w * (w / 340);
      spCtx.beginPath();
      spCtx.moveTo(s.p[0] / 4000 * w, s.p[1] / 4000 * h);
      for (var i = 2; i < s.p.length; i += 2) {
        spCtx.lineTo(s.p[i] / 4000 * w, s.p[i + 1] / 4000 * h);
      }
      if (s.p.length === 2) spCtx.lineTo(s.p[0] / 4000 * w + .1, s.p[1] / 4000 * h);
      spCtx.stroke();
    });
  }
  function spCommit() {
    if (spStrokes.length) {
      state.sign = { strokes: spStrokes };
      els.signpad.classList.add('dirty');
      els.signMeta.textContent = '写好了 · 播放时会一笔一划重现';
    } else {
      state.sign = null;
      els.signpad.classList.remove('dirty');
      els.signMeta.textContent = '不写则用文字署名';
    }
  }
  (function spBind() {
    var drawing = false, cur = null, lastX = 0, lastY = 0;
    function pos(e) {
      var r = spCanvas.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    }
    spCanvas.addEventListener('pointerdown', function (e) {
      drawing = true;
      try { spCanvas.setPointerCapture(e.pointerId); } catch (err) { /* 合成事件等无活动指针时忽略 */ }
      var xy = pos(e);
      lastX = xy[0]; lastY = xy[1];
      cur = { w: 3, p: [Math.round(xy[0] / spCanvas.clientWidth * 4000), Math.round(xy[1] / spCanvas.clientHeight * 4000)] };
      spStrokes.push(cur);
      spRedraw();
      e.preventDefault();
    });
    spCanvas.addEventListener('pointermove', function (e) {
      if (!drawing || !cur) return;
      var xy = pos(e);
      var dx = xy[0] - lastX, dy = xy[1] - lastY;
      if (dx * dx + dy * dy < 4) return; // 采样太密的点丢掉
      lastX = xy[0]; lastY = xy[1];
      cur.p.push(Math.round(xy[0] / spCanvas.clientWidth * 4000), Math.round(xy[1] / spCanvas.clientHeight * 4000));
      spRedraw();
    });
    function endStroke() {
      if (!drawing) return;
      drawing = false;
      cur = null;
      spCommit();
    }
    spCanvas.addEventListener('pointerup', endStroke);
    spCanvas.addEventListener('pointercancel', endStroke);
  })();
  els.signClear.addEventListener('click', function () {
    spStrokes = [];
    spCommit();
    spRedraw();
  });
  window.addEventListener('resize', spSize);
  /* 从草稿恢复手写签名 */
  if (state.sign && state.sign.strokes) spStrokes = state.sign.strokes.map(function (s) { return { w: s.w, p: s.p.slice() }; });
  setTimeout(spSize, 60); // 等「内容」页布局稳定后量一次；切到该页再量

  /* ---------- 文案工具：帮你起两句 / 插入分页 ---------- */
  els.blessBtn.addEventListener('click', function () {
    var msg = C.composeBlessing();
    state.message = msg.slice(0, C.LIMITS.message);
    els.message.value = state.message;
    dirty.message = true;
    updateCount();
    scheduleSync();
    window.Hanabi.toast('起好了，不满意再点一次');
  });
  els.pageBreakBtn.addEventListener('click', function () {
    var el0 = els.message;
    var at = el0.selectionStart != null ? el0.selectionStart : el0.value.length;
    var before = el0.value.slice(0, at);
    var after = el0.value.slice(at);
    var glue = /(^|\n)$/.test(before) ? '' : '\n';
    var insert = glue + '---\n';
    var next = (before + insert + after).slice(0, C.LIMITS.message);
    state.message = next;
    el0.value = next;
    dirty.message = true;
    updateCount();
    scheduleSync();
    var caret = (before + insert).length;
    try { el0.setSelectionRange(caret, caret); el0.focus(); } catch (e) { /* 忽略 */ }
    window.Hanabi.toast('已插入分页：收卡人读完这页，轻触翻页');
  });

  /* ============================================================
   * 自定义信笺（主要功能）：上传自己的 HTML 当贺卡。
   * 信笺里可写 {{收件人}} {{标题}} {{祝福语}} {{署名}} 占位符，
   * 寄出时自动替换；播放端在沙盒 iframe 里原样展示 TA 的网页。
   * ============================================================ */
  function updateCustomUI() {
    var isOn = state.custom !== 'off';
    els.customMeta.textContent = isOn
      ? '信笺就位 · ' + Math.round(state.custom.length / 1024) + 'KB'
      : '未上传 · 使用内置贺卡版式';
    els.customPrev.hidden = !isOn;
    els.customDel.hidden = !isOn;
    els.customUp.textContent = isOn ? '换一个' : '上传 HTML 信笺';
    var tooBig = isOn && state.custom.length > C.LINK_CUSTOM_CHARS;
    els.customLinkTip.hidden = !tooBig;
  }
  els.customUp.addEventListener('click', function () { els.customFile.click(); });
  els.customFile.addEventListener('change', function () {
    var f = els.customFile.files && els.customFile.files[0];
    if (!f) return;
    if (!/\.(html?|htm)$/i.test(f.name) && f.type !== 'text/html') {
      window.Hanabi.toast('请选择 .html 或 .htm 文件');
      return;
    }
    if (f.size > 4 * 1024 * 1024) {
      window.Hanabi.toast('信笺超过 4MB，精简一下再上传');
      return;
    }
    var fr = new FileReader();
    fr.onload = function () {
      state.custom = String(fr.result);
      updateCustomUI();
      scheduleSync();
      window.Hanabi.toast('信笺已就位，右侧手机里就是它');
    };
    fr.onerror = function () { window.Hanabi.toast('读取失败，换一个文件试试'); };
    fr.readAsText(f, 'utf-8');
  });
  els.customDel.addEventListener('click', function () {
    state.custom = 'off';
    els.customFile.value = '';
    updateCustomUI();
    scheduleSync();
  });
  /* 新窗口预览最终成品（占位符已替换） */
  els.customPrev.addEventListener('click', function () {
    if (state.custom === 'off') return;
    var html = window.Hanabi.Config.applyPlaceholders(state.custom, state);
    var url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    window.open(url, '_blank');
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  });
  if (state.custom !== 'off') updateCustomUI();

  /* 可随链接发送的配置版本：超限的音乐/语音/照片/信笺自动剔除 */
  function linkableState() {
    var s = Object.assign({}, state);
    if (s.music !== 'off' && s.music.length > C.LINK_MUSIC_CHARS) s.music = 'off';
    if (s.voice !== 'off' && s.voice.length > C.LINK_VOICE_CHARS) s.voice = 'off';
    /* 照片按链接总预算从前往后装，装不下的丢掉（导出文件仍全量携带） */
    if (Array.isArray(s.photos) && s.photos.length) {
      var kept = [], total = 0;
      s.photos.forEach(function (p) {
        if (total + p.length <= C.LINK_PHOTO_CHARS) { kept.push(p); total += p.length; }
      });
      s.photos = kept;
      s.photo = kept[0] || '';
    } else if (s.photo && s.photo.length > C.LINK_PHOTO_CHARS) {
      s.photo = '';
    }
    if (s.custom !== 'off' && s.custom.length > C.LINK_CUSTOM_CHARS) s.custom = 'off';
    return s;
  }

  function bindText(input, key, max) {
    input.addEventListener('input', function () {
      state[key] = input.value.slice(0, max);
      dirty[key] = true;
      scheduleSync();
    });
  }
  function updateCount() {
    els.msgCount.textContent = els.message.value.length + '/' + C.LIMITS.message;
  }

  /* ---------- 手气随机：换一套场景/主题/效果/字体（保留收件人署名） ---------- */
  els.lucky.addEventListener('click', function () {
    var occasionKeys = Object.keys(C.OCCASIONS);
    var oc = occasionKeys[(Math.random() * occasionKeys.length) | 0];
    var themeKeys = TH.list().map(function (t) { return t.name; });
    var effectKeys = EFFECTS.map(function (f) { return f.name; });
    var fontKeys = Object.keys(C.FONTS);
    var preset = C.OCCASIONS[oc].preset;
    state.occasion = oc;
    state.title = preset.title;
    state.message = preset.message;
    state.theme = themeKeys[(Math.random() * themeKeys.length) | 0];
    state.effect = effectKeys[(Math.random() * effectKeys.length) | 0];
    state.font = fontKeys[(Math.random() * fontKeys.length) | 0];
    els.title.value = state.title;
    els.message.value = state.message;
    updateCount();
    markChecks();
    scheduleSync();
    window.Hanabi.toast('换了手气：' + C.OCCASIONS[oc].label + ' · ' + TH.get(state.theme).label);
  });

  /* ============================================================
   * 实时预览同步：
   *   iframe 加载完成后发来 hanabi-ready，此后改动用 postMessage
   *   热推送（不重载 iframe）；否则退回"整链重设 src"。
   * ============================================================ */
  function scheduleSync() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(function () {
      syncNow(); // syncNow 末尾已存草稿，不必对 localStorage 重复写一遍
    }, 140);
  }
  var sentCustom = null; // 上次推给预览的信笺原文（体积大，仅变化时发送）
  function saveDraft() {
    try {
      var d = Object.assign({}, state);
      /* 超大媒体不进草稿，避免 localStorage 溢出 */
      if (d.music !== 'off' && d.music.length > 200000) d.music = 'off';
      if (d.voice !== 'off' && d.voice.length > 200000) d.voice = 'off';
      if (d.photo && d.photo.length > 200000) d.photo = '';
      var pTotal = 0;
      d.photos = (Array.isArray(d.photos) ? d.photos : []).filter(function (p) {
        pTotal += p.length;
        return pTotal <= 200000;
      });
      if (d.custom !== 'off' && d.custom.length > 200000) d.custom = 'off';
      localStorage.setItem('hanabi-draft-v1', JSON.stringify(d));
    } catch (e) { /* 空间不足等，静默忽略 */ }
  }
  function syncNow() {
    /* 预览一律静音（音乐/语音都不响）；信笺只在变化时推送 */
    var previewState = Object.assign({}, state);
    previewState.music = 'off';
    previewState.voice = 'off';
    if (previewState.custom !== 'off' && previewState.custom === sentCustom) {
      delete previewState.custom;
    } else {
      sentCustom = previewState.custom;
    }
    if (previewReady && els.iframe.contentWindow) {
      try {
        els.iframe.contentWindow.postMessage({ type: 'hanabi-config', config: previewState }, '*');
      } catch (e) { /* 落入下方重载兜底 */ }
    } else {
      var fallback = Object.assign({}, previewState);
      if (fallback.custom !== 'off' && fallback.custom.length > C.LINK_CUSTOM_CHARS) {
        fallback.custom = 'off'; // URL 装不下时先回内置版式，postMessage 就绪后立刻切回
      }
      els.iframe.src = C.buildCardURL(fallback, { preview: true });
    }
    /* 祝福邮件预览跟着配置走（与"复制邮件"同一构造） */
    try {
      els.mailPreview.srcdoc = buildMailBody();
    } catch (e) { /* 忽略 */ }
    saveDraft();
  }
  window.addEventListener('message', function (ev) {
    /* 只接受自家预览 iframe 的消息；file:// 下 origin 序列化不可靠，认窗口不认源 */
    if (ev.source !== els.iframe.contentWindow) return;
    if (location.protocol !== 'file:' && ev.origin !== location.origin) return;
    var d = ev.data;
    if (d && d.type === 'hanabi-ready') {
      previewReady = true;
      syncNow();
    }
  });

  /* ---------- 首次装载预览 ---------- */
  els.iframe.src = C.buildCardURL(state, { preview: true });
  els.mailPreview.srcdoc = buildMailBody();
  if (preloaded) {
    setTimeout(function () {
      window.Hanabi.toast('已按 TA 的样式为你预填');
    }, 400);
  } else if (restored) {
    setTimeout(function () {
      window.Hanabi.toast('已恢复上次的草稿');
    }, 400);
  }

  /* ============================================================
   * 寄出保护：密语解锁 + 定时开启。
   * 密语只存在编辑器内存（绝不写进配置/草稿/链接明文），
   * 生成链接时现场把配置 AES-GCM 加密成 k1. 代码；
   * 定时是普通字段 unlockAt（epoch 毫秒），播放端到点前盖倒计时门。
   * ============================================================ */
  var passphrase = '';
  function fmtUnlockInput(ms) {
    if (!ms) return '';
    var d = new Date(ms);
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
      'T' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function refreshGuardUI() {
    els.passState.textContent = passphrase ? '已设置 · 寄出时加密' : '未设置';
    els.passState.classList.toggle('sel', !!passphrase);
    if (state.unlockAt) {
      var left = state.unlockAt - Date.now();
      if (left <= 0) {
        els.unlockState.textContent = '已过时 · 卡片现在就能开';
      } else {
        var h = Math.floor(left / 3600000);
        var dText = Math.floor(h / 24);
        els.unlockState.textContent = dText > 0
          ? (dText + ' 天 ' + (h % 24) + ' 小时后开启')
          : (h > 0 ? (h + ' 小时后开启') : Math.max(1, Math.floor(left / 60000)) + ' 分钟后开启');
      }
    } else {
      els.unlockState.textContent = '不限时';
    }
    els.unlockState.classList.toggle('sel', !!state.unlockAt);
  }
  if (state.unlockAt) els.fUnlock.value = fmtUnlockInput(state.unlockAt);
  els.fPass.addEventListener('input', function () {
    passphrase = els.fPass.value.trim().slice(0, 32);
    refreshGuardUI();
  });
  els.fUnlock.addEventListener('change', function () {
    var v = els.fUnlock.value;
    var t = v ? new Date(v).getTime() : 0;
    if (!v || isNaN(t)) { state.unlockAt = 0; }
    else if (t <= Date.now()) {
      state.unlockAt = 0;
      els.fUnlock.value = '';
      window.Hanabi.toast('这个时间已经过去啦，选个将来的时间');
    } else {
      state.unlockAt = Math.floor(t);
      window.Hanabi.toast('到点前，对方打开只会看到倒计时');
    }
    refreshGuardUI();
    scheduleSync();
  });
  refreshGuardUI();

  /* 统一的"寄出代码"：有密语 -> 加密 k1；无密语 -> 明文 base64url。
   * 链接族（链接/邮件/短信/新窗/二维码/长图）走 linkableState，
   * 导出文件走全量 state（文件没有体积限制）。 */
  function sendCode(full) {
    var base = full ? state : linkableState();
    if (!passphrase) return Promise.resolve(C.toHash(base));
    return C.encryptWithPass(base, passphrase);
  }
  function sendLink(full) {
    return sendCode(full).then(function (code) { return C.buildCardURLCode(code); });
  }

  /* ============================================================
   * 寄出：贺卡链接 / 贺卡文件 / 祝福邮件 / 邮件应用
   * ============================================================ */
  els.gen.addEventListener('click', function () {
    /* 信笺超过链接承载上限时拒绝生成（避免寄出缺了正文的贺卡） */
    if (state.custom !== 'off' && state.custom.length > C.LINK_CUSTOM_CHARS) {
      els.customLinkTip.hidden = false;
      window.Hanabi.toast('你的信笺太大，链接装不下：请用「贺卡文件」或「祝福邮件」寄出');
      return;
    }
    /* 音乐/语音/照片超限时自动降级：链接里去掉，文件通道仍完整携带 */
    var stripped = [];
    if (state.music !== 'off' && state.music.length > C.LINK_MUSIC_CHARS) stripped.push('音乐');
    if (state.voice !== 'off' && state.voice.length > C.LINK_VOICE_CHARS) stripped.push('语音');
    var sLink = linkableState();
    if (!sLink.photos.length && state.photos.length) stripped.push('照片');
    else if (sLink.photos.length < state.photos.length) stripped.push('部分照片');
    if (sLink.custom === 'off' && state.custom !== 'off') stripped.push('信笺');
    sendCode(false).then(function (code) {
      var link = C.buildCardURLCode(code);
      els.linkBox.hidden = false;
      els.linkInput.value = link;
      els.stripTip.hidden = !stripped.length;
      if (stripped.length) {
        els.stripTip.textContent = stripped.join('、') + '超过了链接的承载上限，链接里已去掉；用「贺卡文件」寄出即可一分不少。';
      }
      if (location.protocol === 'file:') els.fileTip.hidden = false;
      /* 签语预览：这张卡的帖号与签语（与播放端同一推导） */
      var fortune = C.fortuneOf(code);
      els.fortunePrev.hidden = false;
      els.fortunePrev.textContent = '';
      var noEl = document.createElement('b');
      noEl.textContent = fortune.no;
      els.fortunePrev.appendChild(noEl);
      els.fortunePrev.appendChild(document.createTextNode('第 ' + fortune.no.slice(3) + ' 签 · ' + fortune.text));
      window.Hanabi.copyText(link,
        function () {
          var msg = stripped.length ? '链接已生成（不含' + stripped.join('、') + '）' : '链接已生成，已复制到剪贴板';
          if (passphrase) msg += '；记得把密语也告诉 TA';
          window.Hanabi.toast(msg);
        },
        function () { window.Hanabi.toast('链接已生成，请点击"复制"按钮'); }
      );
    }).catch(function () {
      window.Hanabi.toast('加密失败：这个浏览器不支持，请改用「贺卡文件」寄出');
    });
  });

  /* 导出独立贺卡文件：内嵌全部样式/脚本/配置/音频，离线双击即播。
   * 设了密语时配置同样以 k1 加密内嵌，文件也要答对密语才播。 */
  els.exportBtn.addEventListener('click', function () {
    sendCode(true).then(function (code) {
      var embed = { code: code, music: state.music };
      function fetchText(url) {
        return fetch(url).then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.text();
        });
      }
      return Promise.all([
        fetchText('card.html'),
        fetchText('css/style.css'),
        fetchText('js/config.js'),
        fetchText('js/effects.js'),
        fetchText('js/themes.js'),
        fetchText('js/player.js')
      ]).then(function (res) {
        var html = res[0];
        /* 配置与音频以 JSON 注入，'<' 转义防止破坏 <script> 结构 */
        var boot = '<script>window.__HANABI_EMBED__ = ' +
          JSON.stringify(embed).replace(/</g, '\\u003c') + '</script>\n';
        html = html.replace('<link rel="stylesheet" href="css/style.css">', '<style>\n' + res[1] + '\n</style>');
        html = html.replace('<script src="js/config.js"></script>', '<script>\n' + res[2] + '\n</script>');
        html = html.replace('<script src="js/effects.js"></script>', '<script>\n' + res[3] + '\n</script>');
        html = html.replace('<script src="js/themes.js"></script>', '<script>\n' + res[4] + '\n</script>');
        html = html.replace('<script src="js/player.js"></script>', boot + '<script>\n' + res[5] + '\n</script>');
        if (html.indexOf('__HANABI_EMBED__') < 0) throw new Error('template mismatch');

        var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = '花火贺卡·给' + (state.to || '你') + '.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
        window.Hanabi.toast(passphrase ? '贺卡文件已导出（已加密，记得给 TA 密语）' : '贺卡文件已导出，直接发给 TA 即可');
      });
    }).catch(function () {
      window.Hanabi.toast('导出失败：请在部署后的网站上使用');
    });
  });

  /* ---------- 祝福邮件：富文本复制 + mailto ---------- */
  function copyRich(html, onOk, onFail) {
    var holder = document.createElement('div');
    holder.contentEditable = 'true';
    holder.style.position = 'fixed';
    holder.style.left = '-9999px';
    holder.style.top = '0';
    holder.innerHTML = html;
    document.body.appendChild(holder);
    var range = document.createRange();
    range.selectNodeContents(holder);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    sel.removeAllRanges();
    document.body.removeChild(holder);
    if (ok) { if (onOk) onOk(); } else { if (onFail) onFail(); }
  }

  /* 邮件正文：有信笺用信笺（占位符替换后，附"打开贺卡"按钮），
   * 无信笺用内置「花火夜帖」邮件版式。预览与复制共用同一构造。
   * link 省略时用明文链接（预览用）；复制/写邮件时传加密后的链接。 */
  function buildMailBody(link) {
    if (!link) link = C.buildCardURL(linkableState());
    var btnHtml = '<div style="text-align:center;padding:20px 0 6px;">' +
      '<a href="' + link + '" target="_blank" style="display:inline-block;background:#232520;' +
      'color:#fbfaf7;padding:14px 34px;border-radius:10px;text-decoration:none;' +
      'font-weight:600;font-size:14px;letter-spacing:3px;">打开会动的贺卡 ›</a></div>';
    if (state.custom === 'off') return C.buildEmailHtml(state, link);
    var letter = C.applyPlaceholders(state.custom, state);
    /* 整页文档取 body 内部（含其中的 <style>）；片段则直接使用 */
    var m = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(letter);
    var inner = m ? m[1] : letter;
    return '<div style="margin:0;padding:12px;">' + inner + btnHtml + '</div>';
  }
  els.mailCopyBtn.addEventListener('click', function () {
    sendLink(false).then(function (link) {
      copyRich(buildMailBody(link),
        function () { window.Hanabi.toast('邮件已复制，去邮箱正文里粘贴即可'); },
        function () { window.Hanabi.toast('复制失败，请改用「导出贺卡文件」'); });
    });
  });
  els.mailBtn.addEventListener('click', function () {
    var addr = els.mailTo.value.trim();
    sendLink(false).then(function (link) {
      location.href = C.buildMailto(addr, state, link);
    });
  });
  /* 短信通道：唤起系统短信应用（号码可留空） */
  els.smsBtn.addEventListener('click', function () {
    var phone = els.smsTo.value.replace(/[^\d+]/g, '');
    sendLink(false).then(function (link) {
      var body = '有一张给「' + state.to + '」的贺卡，点开就能看：' + link;
      location.href = 'sms:' + phone + '?&body=' + encodeURIComponent(body);
    });
  });
  /* 实体贺卡：排好版的对折卡面，交给打印机。
   * 链接足够短且没用自定义信笺时，封面上附一枚二维码，扫了直达贺卡。 */
  function qrDataUrl(text) {
    if (!window.qrcode) return '';
    /* 从最小版本往上试，装下为止 */
    for (var t = 1; t <= 40; t++) {
      try {
        var q = window.qrcode(t, 'M');
        q.addData(text);
        q.make();
        return q.createDataURL(4, 12);
      } catch (e) { /* 装不下，换更大的版本 */ }
    }
    return '';
  }
  function qrUsable(link) {
    /* 长图/打印上的码要能被普通相机扫出来：限长 + 不为自定义信笺 */
    return state.custom === 'off' && link.length < 2900;
  }
  els.printBtn.addEventListener('click', function () {
    sendLink(false).then(function (link) {
      var sheet = document.getElementById('printSheet');
      var msgText = C.splitMessage(state.message).join('\n');
      var d = new Date();
      var dateStr = d.getFullYear() + '.' + (d.getMonth() + 1) + '.' + d.getDate();
      var qrImg = '';
      if (qrUsable(link)) {
        var qr = qrDataUrl(link);
        if (qr) qrImg = '<img class="ps-qr" src="' + qr + '" alt="扫码打开贺卡">';
      }
      sheet.innerHTML =
        '<div class="ps-page">' +
          '<div class="ps-mark">HANABI · 花火贺卡</div>' +
          '<div class="ps-title">' + C.escapeHtml(state.title) + '</div>' +
          '<div class="ps-to">致 ' + C.escapeHtml(state.to) + '</div>' +
          qrImg +
          '<div class="ps-cover-foot">' + C.editionOf(C.toHash(linkableState())) + '</div>' +
        '</div>' +
        '<div class="ps-page ps-inner">' +
          '<div class="ps-msg">' + C.escapeHtml(msgText) + '</div>' +
          '<div class="ps-line"></div>' +
          '<div class="ps-from">' + C.escapeHtml(state.from) + '</div>' +
          '<div class="ps-cover-foot">' + dateStr + '</div>' +
        '</div>';
      document.body.classList.add('printing');
      window.print();
      /* 有些浏览器 print() 同步返回，稍后兜底摘掉 printing */
      setTimeout(function () { document.body.classList.remove('printing'); }, 800);
    });
  });
  window.addEventListener('afterprint', function () {
    document.body.classList.remove('printing');
  });

  /* ---------- 分享长图：卡面祝福 + 首张照片 + 二维码，合成一张竖图 ---------- */
  var SONG = "'Songti SC','Noto Serif SC','STSong','STZhongsong','SimSun',serif";
  var KAI = "'Kaiti SC','STKaiti','KaiTi','FZKai-Z03S',serif";
  var MONO = "ui-monospace,'SF Mono','Cascadia Mono',Menlo,Consolas,monospace";
  function mixHex(a, b, t) {
    function rgb(h) {
      var m = /^#?([0-9a-f]{6})$/i.exec(h || '');
      var n = m ? parseInt(m[1], 16) : 0xffffff;
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    var A = rgb(a), B = rgb(b), o = '#';
    for (var i = 0; i < 3; i++) {
      var v = Math.round(A[i] + (B[i] - A[i]) * t).toString(16);
      o += v.length < 2 ? '0' + v : v;
    }
    return o;
  }
  function lumOf(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return 1;
    var n = parseInt(m[1], 16);
    return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  }
  function wrapLines(g, text, maxW) {
    var lines = [], line = '';
    var chars = String(text).split('');
    for (var i = 0; i < chars.length; i++) {
      var ch = chars[i];
      if (ch === '\n') { lines.push(line); line = ''; continue; }
      if (line && g.measureText(line + ch).width > maxW) { lines.push(line); line = ch; }
      else line += ch;
    }
    if (line) lines.push(line);
    return lines;
  }
  function loadImg(src) {
    return new Promise(function (res, rej) {
      var im = new Image();
      im.onload = function () { res(im); };
      im.onerror = function () { rej(new Error('图片载入失败')); };
      im.src = src;
    });
  }
  els.shareBtn.addEventListener('click', function () {
    sendCode(false).then(function (code) {
      var link = C.buildCardURLCode(code);
      var fortune = C.fortuneOf(code);
      var th = TH.get(state.theme);
      var bg = state.bg || th.vars['--bg-0'] || '#faf9f4';
      var accent = state.accent || th.vars['--accent'] || '#5f7d72';
      var dark = state.bg ? lumOf(bg) < 0.5 : th.light === false;
      var ink = dark ? '#f0ead9' : '#26281f';
      var inkSoft = dark ? 'rgba(240,234,217,.74)' : 'rgba(38,40,31,.74)';
      var inkFaint = dark ? 'rgba(240,234,217,.5)' : 'rgba(38,40,31,.5)';
      var hair = dark ? 'rgba(240,234,217,.22)' : 'rgba(38,40,31,.16)';
      var qrSrc = qrUsable(link) ? qrDataUrl(link) : '';
      var jobs = [state.photos.length ? loadImg(state.photos[0]) : Promise.resolve(null)];
      jobs.push(qrSrc ? loadImg(qrSrc) : Promise.resolve(null));
      return Promise.all(jobs).then(function (imgs) {
        var photoImg = imgs[0], qrImg = imgs[1];
        var W = 750, H = 1100, S = 2, M = 64;
        var cv = document.createElement('canvas');
        cv.width = W * S;
        cv.height = H * S;
        var g = cv.getContext('2d');
        g.scale(S, S);
        /* 背景：主题底色 + 纵向微渐变 */
        var grad = g.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, bg);
        grad.addColorStop(1, mixHex(bg, dark ? '#000000' : '#ffffff', 0.28));
        g.fillStyle = grad;
        g.fillRect(0, 0, W, H);
        /* 页眉：标记 + 强调色短杠 */
        g.fillStyle = accent;
        g.font = '600 19px ' + MONO;
        if ('letterSpacing' in g) g.letterSpacing = '6px';
        g.fillText('HANABI · 花火贺卡', M, 92);
        if ('letterSpacing' in g) g.letterSpacing = '0px';
        g.fillRect(M, 112, 50, 4);
        /* 收件人 + 标题 */
        g.fillStyle = inkSoft;
        g.font = '27px ' + KAI;
        g.fillText('致 ' + (state.to || ''), M, 190);
        g.fillStyle = ink;
        g.font = '700 52px ' + SONG;
        var tLines = wrapLines(g, state.title || '', W - M * 2).slice(0, 2);
        var y = 254;
        for (var ti = 0; ti < tLines.length; ti++) {
          g.fillText(tLines[ti], M, y);
          y += 66;
        }
        /* 首张照片：白边拍立得 */
        var bodyTop = y + 18;
        if (photoImg) {
          var fw = W - M * 2;
          var k = Math.min(fw / photoImg.width, 340 / photoImg.height);
          var iw = Math.max(1, Math.round(photoImg.width * k));
          var ih = Math.max(1, Math.round(photoImg.height * k));
          var px = (W - iw) / 2, py = bodyTop + 12;
          g.save();
          g.shadowColor = 'rgba(0,0,0,.3)';
          g.shadowBlur = 24;
          g.shadowOffsetY = 10;
          g.fillStyle = '#fffdf8';
          g.fillRect(px - 12, py - 12, iw + 24, ih + 24);
          g.restore();
          g.drawImage(photoImg, px, py, iw, ih);
          bodyTop = py + ih + 46;
        } else {
          bodyTop += 14;
        }
        /* 祝福正文（分页符视作空行），放不下就截断 */
        var footY = H - 208;
        var msgText = C.splitMessage(state.message).join('\n\n');
        g.fillStyle = ink;
        g.font = '29px ' + KAI;
        var lines = wrapLines(g, msgText, W - M * 2);
        var maxLines = Math.max(2, Math.floor((footY - 36 - bodyTop) / 48));
        if (lines.length > maxLines) {
          lines = lines.slice(0, maxLines);
          lines[maxLines - 1] = lines[maxLines - 1].replace(/.$/, '…');
        }
        y = bodyTop;
        for (var mi = 0; mi < lines.length; mi++) {
          g.fillText(lines[mi], M, y);
          y += 48;
        }
        if (y + 34 < footY) {
          g.fillStyle = inkSoft;
          g.font = '25px ' + SONG;
          g.textAlign = 'right';
          g.fillText('—— ' + (state.from || ''), W - M, y + 30);
          g.textAlign = 'left';
        }
        /* 页脚：二维码 + 签语 + 帖号 */
        g.strokeStyle = hair;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(M, footY);
        g.lineTo(W - M, footY);
        g.stroke();
        var fy = footY + 44;
        if (qrImg) g.drawImage(qrImg, M, fy, 128, 128);
        var tx = qrImg ? M + 128 + 28 : M;
        g.fillStyle = accent;
        g.font = '600 26px ' + SONG;
        g.fillText(fortune.text, tx, fy + 34);
        g.fillStyle = inkFaint;
        g.font = '17px ' + MONO;
        g.fillText('第 ' + fortune.no.slice(3) + ' 签 · ' + fortune.no, tx, fy + 70);
        g.fillStyle = inkFaint;
        g.font = '17px ' + MONO;
        g.fillText(qrImg ? '扫码打开 · 会动的贺卡' : '由花火贺卡制作', tx, fy + 104);
        cv.toBlob(function (blob) {
          if (!blob) { window.Hanabi.toast('长图生成失败，换个浏览器试试'); return; }
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = '花火贺卡·分享长图.png';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
          window.Hanabi.toast(passphrase
            ? '长图已下载（链接已加密，记得一并把密语给 TA）'
            : '长图已下载，发朋友圈、聊天都合适');
        }, 'image/png');
      });
    }).catch(function () {
      window.Hanabi.toast('长图生成失败：请在部署后的网站上打开再试');
    });
  });

  /* 发送提醒：生成 .ics，明天 10:00 提醒寄出 */
  els.icsBtn.addEventListener('click', function () {
    var start = new Date(Date.now() + 86400000);
    start.setHours(10, 0, 0, 0);
    function fmt(x) {
      function p2(n) { return ('0' + n).slice(-2); }
      return x.getFullYear() + p2(x.getMonth() + 1) + p2(x.getDate()) +
        'T' + p2(x.getHours()) + p2(x.getMinutes()) + '00';
    }
    var ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Hanabi//CN', 'BEGIN:VEVENT',
      'UID:hanabi-' + Date.now() + '@hanabi',
      'DTSTAMP:' + fmt(new Date()),
      'DTSTART:' + fmt(start),
      'DTEND:' + fmt(new Date(start.getTime() + 3600000)),
      'SUMMARY:寄出给「' + state.to + '」的花火贺卡',
      'DESCRIPTION:打开 Hanabi 编辑器，复制链接发给 TA',
      'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n');
    var blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '花火贺卡·发送提醒.ics';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    window.Hanabi.toast('已下载提醒，双击加进你的日历');
  });
  els.copy.addEventListener('click', function () {
    window.Hanabi.copyText(els.linkInput.value,
      function () {
        /* 按钮本体的成功反馈，比 toast 更近视线焦点 */
        var old = els.copy.textContent;
        els.copy.textContent = '已复制 ✓';
        els.copy.disabled = true;
        setTimeout(function () {
          els.copy.textContent = old;
          els.copy.disabled = false;
        }, 1800);
        window.Hanabi.toast('已复制，发给 TA 吧');
      },
      function () { window.Hanabi.toast('复制失败，请长按链接手动复制'); }
    );
  });
  els.linkInput.addEventListener('focus', function () { els.linkInput.select(); });

  /* ---------- 预览工具条：重播 / 新窗打开 ---------- */
  els.replayBtn.addEventListener('click', function () {
    try {
      els.iframe.contentWindow.postMessage({ type: 'hanabi-replay' }, '*');
    } catch (e) {
      els.iframe.src = C.buildCardURL(state, { preview: true });
    }
  });
  els.popOutBtn.addEventListener('click', function () {
    sendLink(false).then(function (link) {
      window.open(link, '_blank');
    }).catch(function () {
      window.Hanabi.toast('加密失败：这个浏览器不支持，试试「导出贺卡文件」');
    });
  });

  /* ---------- 清空重填 ---------- */
  els.clearBtn.addEventListener('click', function () {
    try { localStorage.removeItem('hanabi-draft-v1'); } catch (e) { /* 忽略 */ }
    state = C.defaults();
    dirty = { to: false, title: false, message: false, from: false };
    els.to.value = state.to;
    els.title.value = state.title;
    els.message.value = state.message;
    els.from.value = state.from;
    updateCount();
    stopPrev();
    state.music = 'off';
    els.musicFile.value = '';
    els.musicMeta.textContent = '不选则无声开场';
    els.musicPrev.hidden = true;
    els.musicDel.hidden = true;
    els.musicUp.textContent = '上传音乐';
    els.musicTip.hidden = true;
    state.photos = [];
    state.photo = '';
    els.photoFile.value = '';
    updatePhotoUI();
    /* 寄出保护一并复位：密语只在内存里，清掉即忘 */
    passphrase = '';
    els.fPass.value = '';
    els.fUnlock.value = '';
    state.unlockAt = 0;
    refreshGuardUI();
    stopVoicePreview();
    state.voice = 'off';
    updateVoiceUI(0);
    spStrokes = [];
    spCommit();
    spRedraw();
    state.custom = 'off';
    els.customFile.value = '';
    updateCustomUI();
    markChecks();
    scheduleSync();
    window.Hanabi.toast('已清空，从头开始');
  });

  /* ============================================================
   * 预览壳等比缩放：按当前壳（手机 375×740 / 显示器 1024×640）
   * 的外框尺寸，把 iframe 缩放进预览栏可用宽度
   * ============================================================ */
  var PHONE_W = 399;    // 375 + 左右各 12px 边框
  var PHONE_H = 764;    // 740 + 上下各 12px 边框
  var MONITOR_W = 1052; // 1024 + 左右各 14px 边框
  var MONITOR_H = 688;  // 640 + 顶栏 34px + 底部 14px
  function isWideLayout() {
    return state.layout === 'scroll' || state.layout === 'folding';
  }
  /* 版式决定预览壳：电脑横屏版式换显示器壳，标注文字同步切换 */
  function applyPreviewShell() {
    var wide = isWideLayout();
    els.phone.classList.toggle('monitor', wide);
    if (els.previewCap) {
      els.previewCap.textContent = wide ? '1024 × 640 · 电脑横屏 · 即时同步' : '375 × 740 · 即时同步';
    }
    fitPreview();
  }
  function fitPreview() {
    var wide = els.phone.classList.contains('monitor');
    var W = wide ? MONITOR_W : PHONE_W;
    var H = wide ? MONITOR_H : PHONE_H;
    var avail = els.previewCol.clientWidth;
    if (window.matchMedia('(max-width: 920px)').matches) {
      /* 单栏布局：预览列宽被壳自身撑大（自引用），直接量栅格可用宽 */
      avail = els.previewCol.parentElement.clientWidth;
    } else if (wide) {
      /* 双栏布局下预览列是 auto 宽，会沿用手机壳撑出的旧宽度；
       * 直接向栅格要空间：表单至少留 560px，显示器壳最宽 640px。 */
      var colsW = els.previewCol.parentElement.clientWidth;
      avail = Math.min(640, Math.max(300, colsW - 560 - 44));
    }
    if (!avail) return;
    var s = Math.min(1, (avail - 4) / W);
    els.phone.style.width = (W * s).toFixed(1) + 'px';
    els.phone.style.height = (H * s).toFixed(1) + 'px';
    els.iframe.style.transform = 'scale(' + s.toFixed(4) + ')';
    if (els.previewBar) els.previewBar.style.maxWidth = (W * s).toFixed(1) + 'px';
  }
  window.addEventListener('resize', fitPreview);
  fitPreview();
  applyPreviewShell();

  /* ---------- 导航栏页签：每个页签一个功能，预览常驻 ---------- */
  var tabBtns = document.querySelectorAll('#tabs .tab');
  var panes = document.querySelectorAll('.tab-panes .pane');
  tabBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      var name = b.getAttribute('data-tab');
      tabBtns.forEach(function (x) {
        var on = x === b;
        x.classList.toggle('p-active', on);
        x.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      panes.forEach(function (p) {
        p.classList.toggle('p-active', p.getAttribute('data-pane') === name);
      });
      /* 手写板在隐藏页签里量不到尺寸，切回「内容」时重新量 */
      if (name === 'write') setTimeout(spSize, 60);
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); }
    });
  });
})();
