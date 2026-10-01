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
    theme: 'aurora',                        // 主题
    effect: 'fireworks',                    // 粒子效果
    font: 'song',                           // 卡面字体 kai / song / hei
    music: 'off',                           // 背景音乐：'off' 或 data:audio 音频（用户上传）
    voice: 'off',                           // 语音祝福：'off' 或 data:audio（编辑器现场录制）
    photo: '',                              // 照片：''=无，或压缩后的 data:image
    sign: null,                             // 手写署名：null 或 { strokes:[{w,p:[...] }] }
    custom: 'off',                          // 自定义信笺：'off' 或用户上传的 HTML 原文
    density: 1,                             // 粒子密度 0.2 ~ 2
    accent: '',                             // 强调色：''=跟随主题，或 #rrggbb
    bg: '',                                 // 背景色：''=跟随主题，或 #rrggbb
    prank: 'off'                            // 彩蛋效果：off / shake / pop / run / danmaku
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

  /* ---------- 彩蛋效果（网红向，全部有界可关，不做无限弹窗） ---------- */
  var PRANKS = {
    off:      { label: '无' },
    shake:    { label: '屏幕震动' },
    pop:      { label: '弹窗雨' },
    run:      { label: '跑路红包' },
    danmaku:  { label: '祝福弹幕' }
  };

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

  /* 手写署名：笔画点数上限（坐标量化为 0~4000 整数） */
  var SIGN_MAX_STROKES = 64;
  var SIGN_MAX_POINTS = 4200;

  /* 自定义信笺（用户上传的 HTML）限制：
   * CUSTOM_MAX_CHARS —— 信笺原文上限（导出文件 / 邮件通道可用满额）
   * LINK_CUSTOM_CHARS—— 随链接分享的上限，超过则链接无法携带信笺 */
  var CUSTOM_MAX_CHARS = 4500000;
  var LINK_CUSTOM_CHARS = 260000;

  /* 兜底白名单；若 themes.js / effects.js 已加载，则优先用它们的注册表 */
  var FALLBACK_THEMES = ['aurora', 'midnight', 'sakura', 'sunset'];
  var FALLBACK_EFFECTS = ['fireworks', 'confetti', 'starfield', 'snow', 'petals', 'meteor', 'lantern'];
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
    var edition = editionOf(toHash(cfg));
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
      (cfg.photo
        ? '<tr><td style="padding:0 44px 22px;" align="center"><img src="' + cfg.photo + '" width="380" alt="照片" style="width:100%;max-width:380px;height:auto;border-radius:8px;border:1px solid ' + hairline + ';" /></td></tr>'
        : '') +
      '<tr><td style="padding:2px 44px 10px;font-family:' + sans + ';font-size:15px;line-height:2.15;letter-spacing:.5px;color:' + body + ';">' + msg + '</td></tr>' +
      '<tr><td style="padding:22px 44px 8px;" align="right">' +
      '<table role="presentation" cellpadding="0" cellspacing="0"><tr>' +
      '<td style="font-family:' + serif + ';font-size:14px;letter-spacing:2px;color:' + ink + ';">—— ' + escapeHtml(cfg.from) + '</td>' +
      '<td style="padding-left:12px;"><span style="display:inline-block;width:11px;height:11px;border:2px solid ' + accent + ';border-radius:50%;vertical-align:middle;">&nbsp;</span></td>' +
      '</tr></table></td></tr>' +
      (btn ? '<tr><td align="center" style="padding:30px 44px 8px;">' + btn + '</td></tr>' : '') +
      '<tr><td style="padding:24px 44px 36px;font-family:' + mono + ';font-size:9px;letter-spacing:3px;color:' + faint + ';">' +
      edition + ' · ' + fortuneOf(toHash(cfg)).text + ' · 由 <a href="' + cardLink.replace(/#.*$/, '') + '" style="color:' + faint + ';text-decoration:underline;">花火贺卡</a> 制作</td></tr>' +
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
    CUSTOM_MAX_CHARS: CUSTOM_MAX_CHARS,
    LINK_CUSTOM_CHARS: LINK_CUSTOM_CHARS,
    defaults: defaults,
    sanitize: sanitize,
    encode: encode,
    decode: decode,
    fromHash: fromHash,
    toHash: toHash,
    buildCardURL: buildCardURL,
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
