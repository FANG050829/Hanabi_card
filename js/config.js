/* ============================================================
 * 花火贺卡 · config.js
 * 配置的默认值、白名单校验、灵感模板、base64url 编解码。
 * 无后端：整张贺卡的配置 JSON 被编码进 card.html 链接的 #hash，
 * 谁打开链接，谁的浏览器里就地解析播放。
 * 本文件同时被 index.html（编辑器）与 card.html（播放器）加载。
 * ============================================================ */
(function () {
  'use strict';
  window.Hanabi = window.Hanabi || {};

  /* ---------- 默认配置（也是无 hash 直接打开 card.html 时的演示内容） ---------- */
  var DEFAULTS = {
    to: '亲爱的朋友',                       // 收件人
    title: '生日快乐',                      // 卡面标题
    message: '新的一岁，愿你不慌不忙，\n有得偿所愿的运气，\n也有兜住一切的能力。', // 祝福语，支持换行；单独一行「---」表示分页
    from: '惦记你的人',                     // 署名
    occasion: 'birthday',                   // 场景
    layout: 'portrait',                     // 版式：portrait 手机竖屏 / scroll 横卷 / folding 屏风
    theme: 'aurora',                        // 主题
    effect: 'fireworks',                    // 粒子效果
    font: 'song',                           // 卡面字体 kai / song / hei
    music: 'off',                           // 背景音乐：'off' 或 data:audio 音频（用户上传）
    voice: 'off',                           // 语音祝福：'off' 或 data:audio（编辑器现场录制）
    photo: '',                              // 照片：''=无，或压缩后的 data:image（旧链接兼容，新卡走 photos）
    photos: [],                             // 照片（最多 6 张）：data:image 数组
    sign: null,                             // 手写署名：null 或 { strokes:[{w,p:[...] }] }
    custom: 'off',                          // 自定义信笺：'off' 或用户上传的 HTML 原文
    density: 1,                             // 粒子密度 0.2 ~ 2
    accent: '',                             // 强调色：''=跟随主题，或 #rrggbb
    bg: '',                                 // 背景色：''=跟随主题，或 #rrggbb
    prank: 'off',                           // 彩蛋效果：off/shake/pop/run/danmaku/muyu/koi/gold/crack/emoji
    unlockAt: 0,                            // 定时开启：epoch 毫秒，0=不限制
    opening: 'auto',                        // 开场方式：auto 信封/礼盒 / scratch 刮刮卡 / fog 拂晓雾
    gate: 'off',                            // 开启门槛：off 无 / slider 滑动解锁
    oracle: 'cup',                          // 收尾互动：cup 求签筒 / blindbox 拆盲盒
    shake: 'off',                           // 摇一摇彩带（需要动作传感器授权，默认关）
    shine: 'off',                           // 标题流光烫金
    doodle: 'off',                          // 标题上方简笔涂鸦
    spectrum: 'on',                         // 随音乐律动（有音乐时频谱条）
    trail: 'on'                             // 触点粒子拖尾
  };

  /* ---------- 场景预设：切换场景时，未手动编辑过的文案会跟随预设 ---------- */
  var OCCASIONS = {
    birthday: {
      label: '生日',
      preset: {
        title: '生日快乐',
        message: '新的一岁，愿你不慌不忙，\n有得偿所愿的运气，\n也有兜住一切的能力。'
      }
    },
    newyear: {
      label: '新春',
      preset: {
        title: '新春快乐',
        message: '爆竹声里辞旧岁，\n愿你新的一年：\n日日是好日，事事顺心意。'
      }
    },
    midautumn: {
      label: '中秋',
      preset: {
        title: '月圆人安',
        message: '月亮慢慢变圆，事情慢慢变好。\n今晚的月色真美，\n记得抬头看看。'
      }
    },
    graduation: {
      label: '毕业',
      preset: {
        title: '前程似锦',
        message: '夏天结束了，青春没有。\n愿你此去，前程被光照亮，\n回头时，我们都在。'
      }
    },
    love: {
      label: '表白',
      preset: {
        title: '心上是你',
        message: '想了很久，还是决定告诉你：\n遇见你，\n是我所有好运的开始。'
      }
    },
    thanks: {
      label: '感谢',
      preset: {
        title: '谢谢你',
        message: '谢谢你来过我的生活，\n像冬天里的一杯热茶。\n这份心意，记得收好。'
      }
    },
    christmas: {
      label: '圣诞',
      preset: {
        title: '平安喜乐',
        message: '铃儿响，雪落下来的声音很轻。\n愿你平安喜乐，\n所念的人都在身边。'
      }
    },
    teacher: {
      label: '教师节',
      preset: {
        title: '师恩难忘',
        message: '粉笔写下的不止黑板，\n还有我们的一生。\n谢谢您，老师。'
      }
    },
    qixi: {
      label: '七夕',
      preset: {
        title: '今夜星河',
        message: '银河再宽，\n也挡不住想见你的人。\n今晚的星星，都是我。'
      }
    },
    move: {
      label: '乔迁',
      preset: {
        title: '乔迁之喜',
        message: '新居落成，灯火可亲。\n愿新家盛满笑声，\n日子越过越亮堂。'
      }
    },
    universal: {
      label: '通用',
      preset: {
        title: '心想事成',
        message: '把这句祝福放进夜空：\n愿你眼里有星辰，\n心里有暖意，路上有清风。'
      }
    }
  };

  /* ---------- 卡面字体 ---------- */
  var FONTS = {
    kai:  { label: '手写楷' },
    song: { label: '典雅宋' },
    hei:  { label: '现代黑' }
  };

  /* ---------- 版式（屏幕方向大类） ----------
   * portrait 手机竖屏：经典单列，手机上打开最好看；
   * scroll 横卷 / folding 屏风：电脑横屏整屏排版，
   * 在手机或竖向窗口上打开会自动回退为竖屏排版。 */
  var LAYOUTS = {
    portrait: { label: '手机竖屏' },
    scroll:   { label: '横卷', pc: true },
    folding:  { label: '屏风', pc: true }
  };

  /* ---------- 彩蛋效果（网红向，全部有界可关，不做无限弹窗） ---------- */
  var PRANKS = {
    off:      { label: '无' },
    shake:    { label: '屏幕震动' },
    pop:      { label: '弹窗雨' },
    run:      { label: '跑路红包' },
    danmaku:  { label: '祝福弹幕' },
    muyu:     { label: '电子木鱼' },
    koi:      { label: '锦鲤游屏' },
    gold:     { label: '金粉喷雾' },
    crack:    { label: '屏幕碎裂' },
    emoji:    { label: '表情包雨' }
  };

  /* ---------- 开场方式：把"打开这张卡"变成一个动作 ---------- */
  var OPENINGS = {
    auto:    { label: '自动' },
    scratch: { label: '刮刮卡' },
    fog:     { label: '拂晓雾' }
  };

  /* ---------- 收尾互动皮肤 ---------- */
  var ORACLES = {
    cup:      { label: '求签筒' },
    blindbox: { label: '拆盲盒' }
  };

  /* ---------- 开启门槛：正式内容前加一道轻交互 ---------- */
  var GATES = {
    off:    { label: '无' },
    slider: { label: '滑动解锁' }
  };

  /* ---------- 藏头诗：四句藏头现成语，纯本地、可改 ---------- */
  var POEMS = [
    {
      label: '生日快乐',
      text: '生来便是追梦人，\n日常小事皆温柔，\n快意恩仇潇洒过，\n乐享清欢岁岁安。'
    },
    {
      label: '新春快乐',
      text: '新年钟声传万里，\n春风得意花千树，\n快意人生从今始，\n乐享团圆到白头。'
    },
    {
      label: '心想事成',
      text: '心有暖阳照前路，\n想做的都如愿偿，\n事随人愿花常开，\n成全所有小盼望。'
    },
    {
      label: '平安喜乐',
      text: '平淡日子有微光，\n安稳岁月不慌张，\n喜从天降笑开颜，\n乐在身边人相伴。'
    },
    {
      label: '前程似锦',
      text: '前路自有灯火照，\n程途步步皆坦荡，\n似水流年不负卿，\n锦绣未来正年少。'
    },
    {
      label: '万事胜意',
      text: '万里星辰皆可摘，\n事在人为路自宽，\n胜友如云常相伴，\n意气风发向明天。'
    }
  ];

  /* ---------- 灵感模板：一键套用成品组合（保留用户已填的收件人与署名） ---------- */
  var TEMPLATES = [
    {
      name: '生辰烟火',
      desc: '素笺 · 烟花',
      cfg: { occasion: 'birthday', theme: 'aurora', effect: 'fireworks', font: 'kai', title: '生日快乐', message: '新的一岁，愿你不慌不忙，\n有得偿所愿的运气，\n也有兜住一切的能力。' }
    },
    {
      name: '月河星子',
      desc: '雾青 · 星空',
      cfg: { occasion: 'midautumn', theme: 'midnight', effect: 'starfield', font: 'song', title: '月圆人安', message: '月亮慢慢变圆，事情慢慢变好。\n今晚的月色真美，\n记得抬头看看。' }
    },
    {
      name: '平安落雪',
      desc: '雾青 · 飘雪',
      cfg: { occasion: 'christmas', theme: 'midnight', effect: 'snow', font: 'song', title: '平安喜乐', message: '铃儿响，雪落下来的声音很轻。\n愿你平安喜乐，\n所念的人都在身边。' }
    },
    {
      name: '星落是你',
      desc: '暮沙 · 流星雨',
      cfg: { occasion: 'love', theme: 'sunset', effect: 'meteor', font: 'kai', title: '心上是你', message: '想了很久，还是决定告诉你：\n遇见你，\n是我所有好运的开始。' }
    },
    {
      name: '新岁彩带',
      desc: '暮沙 · 彩带',
      cfg: { occasion: 'newyear', theme: 'sunset', effect: 'confetti', font: 'hei', title: '新春快乐', message: '爆竹声里辞旧岁，\n愿你新的一年：\n日日是好日，事事顺心意。' }
    },
    {
      name: '樱雨前程',
      desc: '樱贝 · 樱花',
      cfg: { occasion: 'graduation', theme: 'sakura', effect: 'petals', font: 'song', title: '前程似锦', message: '夏天结束了，青春没有。\n愿你此去，前程被光照亮，\n回头时，我们都在。' }
    },
    {
      name: '灯河祈愿',
      desc: '暮沙 · 天灯',
      cfg: { occasion: 'universal', theme: 'sunset', effect: 'lantern', font: 'kai', title: '所愿皆成', message: '放一盏天灯到河上去，\n替我说给夜空听：\n你所盼望的，都在路上。' }
    },
    {
      name: '横卷星河',
      desc: '夜空 · 星空 · 电脑横屏',
      cfg: { occasion: 'universal', layout: 'scroll', theme: 'night', effect: 'starfield', font: 'song', title: '今夜星河', message: '把这句祝福放进夜空：\n愿你眼里有星辰，\n心里有暖意，路上有清风。' }
    },
    {
      name: '屏风夜帖',
      desc: '墨夜 · 萤火 · 电脑横屏',
      cfg: { occasion: 'thanks', layout: 'folding', theme: 'ink', effect: 'fireflies', font: 'kai', title: '谢谢你', message: '谢谢你来过我的生活，\n像冬天里的一杯热茶。\n这份心意，记得收好。' }
    }
  ];

  /* ---------- 字段长度限制 ---------- */
  var LIMITS = { to: 16, title: 24, from: 16, message: 500 };

  /* 音乐限制：
   * MUSIC_MAX_CHARS  —— 单条音乐 dataURI 的最大字符数（约 6MB 二进制）
   * LINK_MUSIC_CHARS —— 随链接分享时的上限（URL 过长会被浏览器/微信截断），
   *                     超过则链接不含音乐，改走"导出贺卡文件" */
  var MUSIC_MAX_CHARS = 8500000;
  var LINK_MUSIC_CHARS = 400000;

  /* 语音祝福限制（编辑器现场录制，通常远小于上传音乐） */
  var VOICE_MAX_CHARS = 3000000;
  var LINK_VOICE_CHARS = 300000;

  /* 照片限制：上传后本地压缩，仍超限则进不了链接 */
  var PHOTO_MAX_CHARS = 8500000;
  var LINK_PHOTO_CHARS = 300000;
  var PHOTO_MAX_COUNT = 6;

  /* 手写署名：笔画点数上限（坐标量化为 0~4000 整数） */
  var SIGN_MAX_STROKES = 64;
  var SIGN_MAX_POINTS = 4200;

  /* 自定义信笺（用户上传的 HTML）限制：
   * CUSTOM_MAX_CHARS —— 信笺原文上限（导出文件 / 邮件通道可用满额）
   * LINK_CUSTOM_CHARS—— 随链接分享的上限，超过则链接无法携带信笺 */
  var CUSTOM_MAX_CHARS = 4500000;
  var LINK_CUSTOM_CHARS = 260000;

  /* 兜底白名单；若 themes.js / effects.js 已加载，则优先用它们的注册表 */
  var FALLBACK_THEMES = ['aurora', 'midnight', 'sakura', 'sunset', 'night', 'ink', 'neon', 'ticket', 'paper'];
  var FALLBACK_EFFECTS = ['fireworks', 'confetti', 'starfield', 'snow', 'petals', 'meteor', 'lantern', 'fireflies', 'aurora', 'bubbles',
    'textfireworks', 'startrail', 'ocean', 'dandelion', 'rainglass', 'matrix', 'paperplane'];
  var FALLBACK_FONTS = ['kai', 'song', 'hei'];

  function validTheme(name) {
    if (window.Hanabi.Themes) return window.Hanabi.Themes.has(name);
    return FALLBACK_THEMES.indexOf(name) >= 0;
  }
  function validEffect(name) {
    if (window.Hanabi.Effects) return window.Hanabi.Effects.has(name);
    return FALLBACK_EFFECTS.indexOf(name) >= 0;
  }
  function validFont(name) {
    return FALLBACK_FONTS.indexOf(name) >= 0;
  }
  function validOccasion(name) {
    return Object.prototype.hasOwnProperty.call(OCCASIONS, name);
  }

  /* 字符串清洗：只留普通文本，超长截断（祝福语保留换行） */
  function cleanStr(v, max, keepNewline) {
    if (typeof v !== 'string') return '';
    v = keepNewline ? v.replace(/\r/g, '') : v.replace(/[\r\n\t]/g, ' ');
    v = v.trim();
    if (v.length > max) v = v.slice(0, max);
    return v;
  }

  /* 任意输入 -> 一份完整、合法、可安全播放的配置（永不抛错） */
  function sanitize(input) {
    var raw = (input && typeof input === 'object') ? input : {};
    var cfg = {};
    for (var k in DEFAULTS) cfg[k] = DEFAULTS[k];
    cfg.photos = []; // 数组默认值不能共享引用，否则污染 DEFAULTS

    var to = cleanStr(raw.to, LIMITS.to);            if (to) cfg.to = to;
    var title = cleanStr(raw.title, LIMITS.title);   if (title) cfg.title = title;
    var from = cleanStr(raw.from, LIMITS.from);      if (from) cfg.from = from;
    var message = cleanStr(raw.message, LIMITS.message, true); if (message) cfg.message = message;

    if (validOccasion(raw.occasion)) cfg.occasion = raw.occasion;
    if (validTheme(raw.theme)) cfg.theme = raw.theme;
    if (validEffect(raw.effect)) cfg.effect = raw.effect;
    if (validFont(raw.font)) cfg.font = raw.font;
    /* 音乐：'off' 或合法的 data:audio dataURI（旧链接里的 'on' 一律按无音乐处理） */
    if (raw.music === 'off' || raw.music === false || raw.music == null || raw.music === '') {
      cfg.music = 'off';
    } else if (typeof raw.music === 'string' &&
        raw.music.indexOf('data:audio/') === 0 &&
        raw.music.length <= MUSIC_MAX_CHARS) {
      cfg.music = raw.music;
    }
    /* 语音祝福：同音乐通道，体积上限更紧 */
    if (raw.voice === 'off' || raw.voice == null || raw.voice === '') {
      cfg.voice = 'off';
    } else if (typeof raw.voice === 'string' &&
        raw.voice.indexOf('data:audio/') === 0 &&
        raw.voice.length <= VOICE_MAX_CHARS) {
      cfg.voice = raw.voice;
    }
    /* 照片：合法 data:image 且未超限；超限解码必坏，整张丢弃 */
    if (typeof raw.photo === 'string' &&
        /^data:image\/(png|jpe?g|webp);base64,/.test(raw.photo) &&
        raw.photo.length <= PHOTO_MAX_CHARS) {
      cfg.photo = raw.photo;
    }
    /* 照片（多张）：逐张校验，总数封顶；单张超限丢那张，不影响其他 */
    if (Array.isArray(raw.photos)) {
      var phTotal = 0;
      for (var pi = 0; pi < raw.photos.length && cfg.photos.length < PHOTO_MAX_COUNT; pi++) {
        var ph = raw.photos[pi];
        if (typeof ph === 'string' &&
            /^data:image\/(png|jpe?g|webp);base64,/.test(ph) &&
            ph.length + phTotal <= PHOTO_MAX_CHARS) {
          cfg.photos.push(ph);
          phTotal += ph.length;
        }
      }
    }
    /* 手写署名：量化笔划数据，逐条校验（永不抛错，坏了就当没写） */
    if (raw.sign && typeof raw.sign === 'object' && Array.isArray(raw.sign.strokes)) {
      var strokes = [], totalPts = 0;
      for (var si = 0; si < raw.sign.strokes.length && strokes.length < SIGN_MAX_STROKES; si++) {
        var st = raw.sign.strokes[si];
        if (!st || !Array.isArray(st.p) || st.p.length < 4) continue;
        var pts = [], bad = false;
        for (var pj = 0; pj < st.p.length && pj < 2400; pj++) {
          var pv = Math.round(Number(st.p[pj]));
          if (isNaN(pv)) { bad = true; break; }
          pts.push(Math.max(0, Math.min(4000, pv)));
          totalPts++;
        }
        if (bad || pts.length < 4) continue;
        strokes.push({ w: Math.max(1, Math.min(8, Math.round(Number(st.w)) || 3)), p: pts });
        if (totalPts >= SIGN_MAX_POINTS) break;
      }
      if (strokes.length) cfg.sign = { strokes: strokes };
    }
    /* 自定义信笺：'off' 或用户上传的 HTML 原文（截断到上限） */
    if (raw.custom === 'off' || raw.custom == null || raw.custom === '') {
      cfg.custom = 'off';
    } else if (typeof raw.custom === 'string' && raw.custom.length <= CUSTOM_MAX_CHARS) {
      cfg.custom = raw.custom;
    } else if (typeof raw.custom === 'string') {
      cfg.custom = raw.custom.slice(0, CUSTOM_MAX_CHARS);
    }
    /* 粒子密度 / 自定义颜色 / 彩蛋 */
    var dn = parseFloat(raw.density);
    if (!isNaN(dn)) cfg.density = Math.min(2, Math.max(0.2, dn));
    if (typeof raw.accent === 'string' && /^#[0-9a-fA-F]{6}$/.test(raw.accent)) cfg.accent = raw.accent.toLowerCase();
    if (typeof raw.bg === 'string' && /^#[0-9a-fA-F]{6}$/.test(raw.bg)) cfg.bg = raw.bg.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(PRANKS, raw.prank)) cfg.prank = raw.prank;
    /* 版式：不在注册表里的一律回落手机竖屏（旧链接无此字段，行为不变） */
    if (Object.prototype.hasOwnProperty.call(LAYOUTS, raw.layout)) cfg.layout = raw.layout;
    /* 开场方式 / 收尾互动 / 开启门槛 */
    if (Object.prototype.hasOwnProperty.call(OPENINGS, raw.opening)) cfg.opening = raw.opening;
    if (Object.prototype.hasOwnProperty.call(ORACLES, raw.oracle)) cfg.oracle = raw.oracle;
    if (Object.prototype.hasOwnProperty.call(GATES, raw.gate)) cfg.gate = raw.gate;
    /* 布尔型开关：只认 'on' / 'off' 两个值 */
    ['shake', 'shine', 'doodle', 'spectrum', 'trail'].forEach(function (k) {
      if (raw[k] === 'on' || raw[k] === 'off') cfg[k] = raw[k];
    });
    /* 定时开启：0=不限制；否则须为合法的时间戳（毫秒） */
    var ua = Number(raw.unlockAt);
    if (isFinite(ua) && ua > 0) cfg.unlockAt = Math.floor(ua);
    return cfg;
  }

  function defaults() { return sanitize({}); }

  /* ---------- base64url 编解码（UTF-8 安全，可直接放进 URL 的 #hash） ---------- */
  function encode(cfg) {
    var json = JSON.stringify(cfg);
    var bytes = new TextEncoder().encode(json);
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function decode(str) {
    str = String(str).replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    var bin = atob(str);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  /* 从 location.hash 读取配置；坏链接、空链接一律回落到默认演示 */
  function fromHash(hash) {
    try {
      var code = (hash || '').replace(/^#/, '');
      if (!code) return defaults();
      return sanitize(decode(code));
    } catch (e) {
      return defaults();
    }
  }

  function toHash(cfg) { return encode(sanitize(cfg)); }

  /* ---------- 密语解锁：配置整包 AES-GCM 加密进链接 ----------
   * hash 形如 k1.<salt>.<iv>.<密文>（各段均为 base64url）。
   * 密钥由密语经 PBKDF2 派生——链接泄露也打不开，不知道密语不行。 */
  var LOCK_PREFIX = 'k1.';
  var PBKDF2_ITERATIONS = 120000;

  function bytesToB64url(bytes) {
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlToBytes(str) {
    str = String(str).replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    var bin = atob(str);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  function subtle() {
    return (window.crypto && window.crypto.subtle) ? window.crypto.subtle : null;
  }
  function deriveLockKey(pass, salt, usages) {
    var subtleApi = subtle();
    var enc = new TextEncoder();
    return subtleApi.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey'])
      .then(function (material) {
        return subtleApi.deriveKey(
          { name: 'PBKDF2', salt: salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
          material, { name: 'AES-GCM', length: 256 }, false, usages);
      });
  }
  /* 加密一份配置 -> 'k1.salt.iv.ct'；不支持 WebCrypto 的环境 reject */
  function encryptWithPass(cfg, pass) {
    var api = subtle();
    if (!api) return Promise.reject(new Error('WebCrypto 不可用'));
    if (!pass) return Promise.reject(new Error('密语为空'));
    var salt = crypto.getRandomValues(new Uint8Array(16));
    var iv = crypto.getRandomValues(new Uint8Array(12));
    var plain = new TextEncoder().encode(JSON.stringify(sanitize(cfg)));
    return deriveLockKey(pass, salt, ['encrypt']).then(function (key) {
      return api.encrypt({ name: 'AES-GCM', iv: iv }, key, plain);
    }).then(function (ct) {
      return LOCK_PREFIX + bytesToB64url(salt) + '.' + bytesToB64url(iv) + '.' + bytesToB64url(new Uint8Array(ct));
    });
  }
  /* 用密语解开 'k1....' -> 配置；密语错误/数据损坏 reject */
  function decryptWithPass(code, pass) {
    var api = subtle();
    if (!api) return Promise.reject(new Error('WebCrypto 不可用'));
    var parts = String(code).split('.');
    if (parts.length !== 4 || parts[0] !== 'k1') return Promise.reject(new Error('不是加密链接'));
    var salt = b64urlToBytes(parts[1]);
    var iv = b64urlToBytes(parts[2]);
    var ct = b64urlToBytes(parts[3]);
    return deriveLockKey(pass, salt, ['decrypt']).then(function (key) {
      return api.decrypt({ name: 'AES-GCM', iv: iv }, key, ct);
    }).then(function (plain) {
      return sanitize(JSON.parse(new TextDecoder().decode(plain)));
    });
  }
  function isLockedCode(code) {
    return String(code || '').indexOf(LOCK_PREFIX) === 0;
  }

  /* 由一段现成的配置编码（含加密格式）拼出 card.html 完整链接 */
  function buildCardURLCode(code) {
    var base;
    try {
      base = new URL('card.html', location.href);
    } catch (e) {
      base = { href: location.href.replace(/[^\/]*$/, 'card.html') };
    }
    base.search = '';
    base.hash = code;
    return base.href;
  }

  /* 构造 card.html 完整链接；opts.preview=true 时附加 ?preview=1 供编辑器内嵌预览 */
  function buildCardURL(cfg, opts) {
    var base;
    try {
      base = new URL('card.html', location.href);
    } catch (e) {
      base = { href: location.href.replace(/[^\/]*$/, 'card.html') };
    }
    base.search = (opts && opts.preview) ? '?preview=1' : '';
    base.hash = toHash(cfg);
    return base.href;
  }

  /* 由链接本身推导一张卡的四位编号（同一链接永远同号，用作"帖号"装饰） */
  function editionOf(code) {
    var n = 0;
    var s = String(code || '');
    for (var i = 0; i < s.length; i++) {
      n = (n * 31 + s.charCodeAt(i)) % 9973;
    }
    return 'NO.' + String(1000 + (n % 9000));
  }

  /* ---------- 帖号签语：编号确定性映射一句签语，同一链接永远同签 ---------- */
  var FORTUNES = [
    '所念皆星河', '好事正发生', '温柔有回声', '万事都顺遂', '好运在路上',
    '月亮不加班', '烦恼都退散', '心宽路自宽', '日子泛甜光', '春风得意时',
    '所求皆如愿', '山河皆坦途', '笑口常开怀', '灯火可亲处', '平安喜乐安',
    '步步生莲花', '晴天在赶路', '喜事排着队', '星光不问路', '时光很温柔',
    '美好正靠岸', '心里有暖阳', '抬头见喜鹊', '生活有回甘', '念念有回响',
    '岁岁皆欢愉', '来日皆可期', '前程似锦绣', '好事近了', '万事胜意',
    '一切来得及', '慢慢变好', '值得被爱', '被世界温柔', '幸运正爆棚',
    '日日是好日', '所遇皆良善', '心想事就成', '温暖常相伴', '好运正当时'
  ];
  /* 返回 { no: 'NO.xxxx', text: '签语' }；同一链接永远同一句 */
  function fortuneOf(code) {
    var n = 0;
    var s = String(code || '');
    for (var i = 0; i < s.length; i++) {
      n = (n * 31 + s.charCodeAt(i)) % 9973;
    }
    return {
      no: editionOf(code),
      text: FORTUNES[n % FORTUNES.length]
    };
  }

  /* ---------- 分页：祝福语里单独一行「---」为分页符 ---------- */
  function splitMessage(message) {
    var parts = String(message || '').split(/^\s*-{3,}\s*$/m);
    var pages = [];
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].replace(/^\n+|\n+$/g, '');
      if (p) pages.push(p);
    }
    return pages.length ? pages : [''];
  }

  /* ---------- 本地文案灵感库：短语组合生成，离线可用 ---------- */
  var BLESS_BANK = {
    openers: [
      '今晚的风很温柔，', '日子过得真快，', '最近还好吗，', '想到你就想写点什么，',
      '檐下的灯又亮了，', '窗外的天蓝得很干净，', '茶凉了又续上，', '又是一年好时节，'
    ],
    middles: [
      '想起我们一起走过的那段路，', '想起你笑起来的样子，', '有些话一直放着没说，',
      '你总说日子平常，', '世界偶尔薄凉，', '时间走得急，', ''
    ],
    wishes: [
      '愿你被温柔以待，所遇皆良善。', '愿你眼里有光，心里有海。',
      '愿你的努力都不被辜负。', '愿你三冬暖，愿你春不寒。',
      '愿你想要的都拿到，拿不到的都放下。', '愿明天比今天更甜一点。',
      '愿你遍历山河，觉得人间值得。', '愿你夜里好眠，醒来有盼头。',
      '愿所有的等待都值得，所有的坚持都有回答。', '愿你把日子过成自己喜欢的样子。'
    ]
  };
  /* 随机组合一句两行祝福（仅编辑器「帮你起两句」用） */
  function composeBlessing() {
    function pick(arr) {
      var i = (Math.random() * arr.length) | 0;
      var v = arr[i];
      arr.splice(i, 1);
      return v;
    }
    var openers = BLESS_BANK.openers.slice();
    var middles = BLESS_BANK.middles.slice();
    var wishes = BLESS_BANK.wishes.slice();
    var line1 = pick(openers) + pick(middles);
    return (line1 + '\n' + pick(wishes));
  }

  /* ---------- 信笺占位符与邮件 ---------- */

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* 把用户信笺里的 {{收件人}} {{标题}} {{祝福语}} {{署名}}（单双花括号均可）
   * 替换为配置内容；祝福语转义后按换行转 <br>，其余字段原样注入。 */
  function applyPlaceholders(html, cfg) {
    var msg = escapeHtml(cfg.message).replace(/\n/g, '<br>');
    return String(html)
      .replace(/\{\{\s*收件人\s*\}\}|\{\s*收件人\s*\}/g, escapeHtml(cfg.to))
      .replace(/\{\{\s*标题\s*\}\}|\{\s*标题\s*\}/g, escapeHtml(cfg.title))
      .replace(/\{\{\s*祝福语\s*\}\}|\{\s*祝福语\s*\}/g, msg)
      .replace(/\{\{\s*署名\s*\}\}|\{\s*署名\s*\}/g, escapeHtml(cfg.from));
  }

  /* 网页祝福邮件：表格布局 + 全内联样式，纸白极简，兼容 Gmail / QQ 邮箱 / Outlook。 */
  function buildEmailHtml(cfg, cardLink) {
    var pageBg = '#f4f2ec', panelBg = '#ffffff', accent = '#5f7d72';
    var ink = '#232520', body = '#3a3831', soft = '#8a8676', faint = '#a5a196';
    var hairline = '#e8e5da';
    var serif = "'Songti SC','Noto Serif SC','STSong',serif";
    var sans = "-apple-system,'PingFang SC','Microsoft YaHei',sans-serif";
    var mono = "ui-monospace,'SF Mono',Consolas,Menlo,monospace";
    var msg = escapeHtml(cfg.message).replace(/\n/g, '<br>');
    var mailPhoto = (cfg.photos && cfg.photos.length) ? cfg.photos[0] : cfg.photo;
    /* 帖号与签语必须和收卡人点开的链接同源：从卡片链接的 hash 推导，
     * 而不是拿完整配置重新编码——超限媒体降级后两者会算出不同的签 */
    var linkHash = (/#([^#]+)$/).exec(String(cardLink || ''));
    var code = linkHash ? linkHash[1] : toHash(cfg);
    var edition = editionOf(code);
    var btn = cardLink
      ? '<table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr>' +
        '<td bgcolor="' + ink + '" style="background:' + ink + ';border-radius:10px;">' +
        '<a href="' + cardLink + '" target="_blank" style="display:inline-block;padding:14px 34px;' +
        'font-family:' + sans + ';font-size:14px;letter-spacing:3px;color:#fbfaf7;' +
        'text-decoration:none;font-weight:600;">打开会动的贺卡 ›</a>' +
        '</td></tr></table>'
      : '';
    return '' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="' + pageBg + '" style="background:' + pageBg + ';">' +
      '<tr><td align="center" style="padding:40px 12px;">' +
      '<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:' + panelBg + ';border:1px solid rgba(35,37,32,.1);border-radius:14px;">' +
      '<tr><td style="padding:40px 44px 8px;font-family:' + mono + ';font-size:10px;letter-spacing:5px;color:' + faint + ';">HANABI · 花火贺卡</td></tr>' +
      '<tr><td style="padding:10px 44px 0;font-family:' + serif + ';font-size:14px;letter-spacing:6px;color:' + soft + ';">致 ' + escapeHtml(cfg.to) + '</td></tr>' +
      '<tr><td style="padding:16px 44px 6px;font-family:' + serif + ';font-size:29px;font-weight:600;letter-spacing:5px;color:' + ink + ';">' + escapeHtml(cfg.title) + '</td></tr>' +
      '<tr><td style="padding:6px 44px 22px;"><table role="presentation" width="56" cellpadding="0" cellspacing="0"><tr>' +
      '<td height="2" bgcolor="' + accent + '" style="background:' + accent + ';font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>' +
      (mailPhoto
        ? '<tr><td style="padding:0 44px 22px;" align="center"><img src="' + mailPhoto + '" width="380" alt="照片" style="width:100%;max-width:380px;height:auto;border-radius:8px;border:1px solid ' + hairline + ';" /></td></tr>'
        : '') +
      '<tr><td style="padding:2px 44px 10px;font-family:' + sans + ';font-size:15px;line-height:2.15;letter-spacing:.5px;color:' + body + ';">' + msg + '</td></tr>' +
      '<tr><td style="padding:22px 44px 8px;" align="right">' +
      '<table role="presentation" cellpadding="0" cellspacing="0"><tr>' +
      '<td style="font-family:' + serif + ';font-size:14px;letter-spacing:2px;color:' + ink + ';">—— ' + escapeHtml(cfg.from) + '</td>' +
      '<td style="padding-left:12px;"><span style="display:inline-block;width:11px;height:11px;border:2px solid ' + accent + ';border-radius:50%;vertical-align:middle;">&nbsp;</span></td>' +
      '</tr></table></td></tr>' +
      (btn ? '<tr><td align="center" style="padding:30px 44px 8px;">' + btn + '</td></tr>' : '') +
      '<tr><td style="padding:24px 44px 36px;font-family:' + mono + ';font-size:9px;letter-spacing:3px;color:' + faint + ';">' +
      edition + ' · ' + fortuneOf(code).text + ' · 由 <a href="' + cardLink.replace(/#.*$/, '') + '" style="color:' + faint + ';text-decoration:underline;">花火贺卡</a> 制作</td></tr>' +
      '</table></td></tr></table>';
  }

  /* mailto 链接：纯文本祝福 + 互动贺卡链接，唤起系统邮件应用 */
  function buildMailto(addr, cfg, cardLink) {
    var subject = cfg.title + ' —— 来自' + cfg.from;
    var body = cfg.to + '：\n\n' + cfg.message + '\n\n—— ' + cfg.from +
      '\n\n（还有一张会动的贺卡：' + cardLink + '）';
    return 'mailto:' + encodeURIComponent(addr || '') +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(body);
  }


  /* ---------- 共用小工具：toast 提示 与 复制到剪贴板（全站不用 alert/confirm） ---------- */
  var toastTimer = null;
  function toast(msg) {
    var el = document.getElementById('hanabi-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'hanabi-toast';
      el.className = 'toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = msg;
    /* 强制重排后再加类，保证连续调用时动画能重新触发 */
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  function copyText(text, onOk, onFail) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.top = '-999px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      if (ok) { if (onOk) onOk(); } else { if (onFail) onFail(); }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(onOk, fallback);
    } else {
      fallback();
    }
  }

  window.Hanabi.Config = {
    DEFAULTS: DEFAULTS,
    OCCASIONS: OCCASIONS,
    FONTS: FONTS,
    LAYOUTS: LAYOUTS,
    OPENINGS: OPENINGS,
    ORACLES: ORACLES,
    GATES: GATES,
    POEMS: POEMS,
    PRANKS: PRANKS,
    TEMPLATES: TEMPLATES,
    LIMITS: LIMITS,
    MUSIC_MAX_CHARS: MUSIC_MAX_CHARS,
    LINK_MUSIC_CHARS: LINK_MUSIC_CHARS,
    VOICE_MAX_CHARS: VOICE_MAX_CHARS,
    LINK_VOICE_CHARS: LINK_VOICE_CHARS,
    PHOTO_MAX_CHARS: PHOTO_MAX_CHARS,
    LINK_PHOTO_CHARS: LINK_PHOTO_CHARS,
    SIGN_MAX_STROKES: SIGN_MAX_STROKES,
    SIGN_MAX_POINTS: SIGN_MAX_POINTS,
    PHOTO_MAX_COUNT: PHOTO_MAX_COUNT,
    CUSTOM_MAX_CHARS: CUSTOM_MAX_CHARS,
    LINK_CUSTOM_CHARS: LINK_CUSTOM_CHARS,
    defaults: defaults,
    sanitize: sanitize,
    encode: encode,
    decode: decode,
    fromHash: fromHash,
    toHash: toHash,
    buildCardURL: buildCardURL,
    buildCardURLCode: buildCardURLCode,
    encryptWithPass: encryptWithPass,
    decryptWithPass: decryptWithPass,
    isLockedCode: isLockedCode,
    editionOf: editionOf,
    fortuneOf: fortuneOf,
    splitMessage: splitMessage,
    composeBlessing: composeBlessing,
    escapeHtml: escapeHtml,
    applyPlaceholders: applyPlaceholders,
    buildEmailHtml: buildEmailHtml,
    buildMailto: buildMailto
  };
  window.Hanabi.toast = toast;
  window.Hanabi.copyText = copyText;
})();
