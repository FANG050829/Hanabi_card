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
    photoThumb: $('photoThumb'),
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
    previewCol: $('previewCol')
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
  if (state.photo) updatePhotoUI();
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
    card.innerHTML = '<i class="tpl-sw" aria-hidden="true"><canvas></canvas></i><span class="tpl-name"></span><span class="tpl-desc"></span>';
    var sw = card.querySelector('.tpl-sw');
    sw.style.background =
      'radial-gradient(120% 120% at 30% 20%,' + theme.swatch[0] + ' 0%,transparent 55%),' + theme.swatch[1];
    card.querySelector('.tpl-name').textContent = tpl.name;
    card.querySelector('.tpl-desc').textContent = tpl.desc;
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
  /* 灵感卡常驻实况：画布小、粒子少，整排开销可忽略；
   * 引擎自带 resize 处理，无需额外照看。 */
  tplEngines.forEach(function (e) { mountTpl(e, true); });

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

  /* ---------- 主题选项（方形色片） ---------- */
  TH.list().forEach(function (t) {
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
    ['occasion', 'theme', 'effect', 'font', 'prank'].forEach(function (group) {
      var inputs = document.querySelectorAll('input[name="' + group + '"]');
      inputs.forEach(function (inp) {
        inp.checked = inp.value === state[group];
      });
    });
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
   * 照片：选一张 -> 本地压缩（长边 ≤1024，质量逐档尝试） ->
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
  function updatePhotoUI() {
    var isOn = !!state.photo;
    els.photoThumb.hidden = !isOn;
    els.photoDel.hidden = !isOn;
    els.photoUp.textContent = isOn ? '换一张' : '选一张照片';
    if (isOn) {
      els.photoThumb.src = state.photo;
      var kb = Math.round(state.photo.length * 3 / 4 / 1024);
      var tooBig = state.photo.length > C.LINK_PHOTO_CHARS;
      els.photoMeta.textContent = '已就位 · 约' + kb + 'KB' +
        (tooBig ? ' · 链接装不下，用「贺卡文件」寄' : ' · 随链接送达');
    } else {
      els.photoMeta.textContent = '不放照片，纯净文字';
    }
  }
  els.photoUp.addEventListener('click', function () { els.photoFile.click(); });
  els.photoFile.addEventListener('change', function () {
    var f = els.photoFile.files && els.photoFile.files[0];
    if (!f) return;
    if (!/^image\//.test(f.type || '')) { window.Hanabi.toast('请选择图片文件'); return; }
    var fr = new FileReader();
    fr.onload = function () {
      var img = new Image();
      img.onload = function () {
        /* 由高到低逐档压缩，第一档装进链接限额就用它 */
        var tries = [[1024, 0.82], [900, 0.72], [800, 0.62], [680, 0.52], [560, 0.45]];
        var data = '';
        for (var i = 0; i < tries.length; i++) {
          data = compressPhoto(img, tries[i][0], tries[i][1]);
          if (data.length <= C.LINK_PHOTO_CHARS) break;
        }
        if (data.length > C.PHOTO_MAX_CHARS) {
          window.Hanabi.toast('照片太大压不下来，换一张试试');
          return;
        }
        state.photo = data;
        updatePhotoUI();
        scheduleSync();
        window.Hanabi.toast('照片已就位，会以拍立得出现在贺卡里');
      };
      img.onerror = function () { window.Hanabi.toast('这张图片读不出来，换一张试试'); };
      img.src = String(fr.result);
    };
    fr.readAsDataURL(f);
  });
  els.photoDel.addEventListener('click', function () {
    state.photo = '';
    els.photoFile.value = '';
    updatePhotoUI();
    scheduleSync();
  });

  /* ============================================================
   * 语音祝福：现场录一段（≤60 秒），点开贺卡先闻其声。
   * MediaRecorder 按浏览器能力选编码（webm/opus 或 mp4/aac）。
   * ============================================================ */
  var mediaStream = null, mediaRec = null, recChunks = [], recTimerInt = null, recStartTs = 0;
  var voiceAudio = null;
  var REC_MIME = (function () {
    if (!window.MediaRecorder) return '';
    var candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
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
      try { mediaRec = REC_MIME ? new MediaRecorder(stream, { mimeType: REC_MIME }) : new MediaRecorder(stream); }
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
    if (s.photo && s.photo.length > C.LINK_PHOTO_CHARS) s.photo = '';
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
      syncNow();
      saveDraft(); // 只在用户改动后存草稿，首次装载不存
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
    var share = Object.assign({}, state);
    var stripped = [];
    if (share.music !== 'off' && share.music.length > C.LINK_MUSIC_CHARS) {
      share.music = 'off';
      stripped.push('音乐');
    }
    if (share.voice !== 'off' && share.voice.length > C.LINK_VOICE_CHARS) {
      share.voice = 'off';
      stripped.push('语音');
    }
    if (share.photo && share.photo.length > C.LINK_PHOTO_CHARS) {
      share.photo = '';
      stripped.push('照片');
    }
    var link = C.buildCardURL(share);
    els.linkBox.hidden = false;
    els.linkInput.value = link;
    els.stripTip.hidden = !stripped.length;
    if (stripped.length) {
      els.stripTip.textContent = stripped.join('、') + '超过了链接的承载上限，链接里已去掉；用「贺卡文件」寄出即可一分不少。';
    }
    if (location.protocol === 'file:') els.fileTip.hidden = false;
    /* 签语预览：这张卡的帖号与签语 */
    var fortune = C.fortuneOf(C.toHash(share));
    els.fortunePrev.hidden = false;
    els.fortunePrev.textContent = '';
    var noEl = document.createElement('b');
    noEl.textContent = fortune.no;
    els.fortunePrev.appendChild(noEl);
    els.fortunePrev.appendChild(document.createTextNode('第 ' + fortune.no.slice(3) + ' 签 · ' + fortune.text));
    window.Hanabi.copyText(link,
      function () {
        window.Hanabi.toast(stripped.length ? '链接已生成（不含' + stripped.join('、') + '）' : '链接已生成，已复制到剪贴板');
      },
      function () { window.Hanabi.toast('链接已生成，请点击"复制"按钮'); }
    );
  });

  /* 导出独立贺卡文件：内嵌全部样式/脚本/配置/音频，离线双击即播 */
  els.exportBtn.addEventListener('click', function () {
    var embed = { code: C.toHash(state), music: state.music };
    function fetchText(url) {
      return fetch(url).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      });
    }
    Promise.all([
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
      window.Hanabi.toast('贺卡文件已导出，直接发给 TA 即可');
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
   * 无信笺用内置「花火夜帖」邮件版式。预览与复制共用同一构造。 */
  function buildMailBody() {
    var cardLink = C.buildCardURL(linkableState());
    var btnHtml = '<div style="text-align:center;padding:20px 0 6px;">' +
      '<a href="' + cardLink + '" target="_blank" style="display:inline-block;background:#232520;' +
      'color:#fbfaf7;padding:14px 34px;border-radius:10px;text-decoration:none;' +
      'font-weight:600;font-size:14px;letter-spacing:3px;">打开会动的贺卡 ›</a></div>';
    if (state.custom === 'off') return C.buildEmailHtml(state, cardLink);
    var letter = C.applyPlaceholders(state.custom, state);
    /* 整页文档取 body 内部（含其中的 <style>）；片段则直接使用 */
    var m = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(letter);
    var inner = m ? m[1] : letter;
    return '<div style="margin:0;padding:12px;">' + inner + btnHtml + '</div>';
  }
  els.mailCopyBtn.addEventListener('click', function () {
    copyRich(buildMailBody(),
      function () { window.Hanabi.toast('邮件已复制，去邮箱正文里粘贴即可'); },
      function () { window.Hanabi.toast('复制失败，请改用「导出贺卡文件」'); });
  });
  els.mailBtn.addEventListener('click', function () {
    var link = C.buildCardURL(linkableState());
    var addr = els.mailTo.value.trim();
    location.href = C.buildMailto(addr, state, link);
  });
  /* 短信通道：唤起系统短信应用（号码可留空） */
  els.smsBtn.addEventListener('click', function () {
    var link = C.buildCardURL(linkableState());
    var phone = els.smsTo.value.replace(/[^\d+]/g, '');
    var body = '有一张给「' + state.to + '」的贺卡，点开就能看：' + link;
    location.href = 'sms:' + phone + '?&body=' + encodeURIComponent(body);
  });
  /* 实体贺卡：排好版的对折卡面，交给打印机 */
  els.printBtn.addEventListener('click', function () {
    var sheet = document.getElementById('printSheet');
    var msgText = C.splitMessage(state.message).join('\n');
    var d = new Date();
    var dateStr = d.getFullYear() + '.' + (d.getMonth() + 1) + '.' + d.getDate();
    sheet.innerHTML =
      '<div class="ps-page">' +
        '<div class="ps-mark">HANABI · 花火贺卡</div>' +
        '<div class="ps-title">' + C.escapeHtml(state.title) + '</div>' +
        '<div class="ps-to">致 ' + C.escapeHtml(state.to) + '</div>' +
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
  window.addEventListener('afterprint', function () {
    document.body.classList.remove('printing');
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
    window.open(C.buildCardURL(linkableState()), '_blank');
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
    state.photo = '';
    els.photoFile.value = '';
    updatePhotoUI();
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
   * 手机壳等比缩放：iframe 逻辑尺寸 375×740，按可用宽度缩放
   * ============================================================ */
  var PHONE_W = 399; // 375 + 左右各 12px 边框
  var PHONE_H = 764; // 740 + 上下各 12px 边框
  function fitPhone() {
    var avail = els.previewCol.clientWidth;
    if (!avail) return;
    var s = Math.min(1, (avail - 4) / PHONE_W);
    els.phone.style.width = (PHONE_W * s).toFixed(1) + 'px';
    els.phone.style.height = (PHONE_H * s).toFixed(1) + 'px';
    els.iframe.style.transform = 'scale(' + s.toFixed(4) + ')';
  }
  window.addEventListener('resize', fitPhone);
  fitPhone();

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
