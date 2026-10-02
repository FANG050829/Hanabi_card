/* ============================================================
 * 花火贺卡 · themes.js
 * 主题注册表：一套主题 = 一组 CSS 变量 + 一份粒子配色。
 * 「纸白」色系：暖纸底、墨色文字、青瓷/樱贝/暮沙点缀——极简清新；
 * 「夜帖」色系：夜空/墨夜，深底月白字，粒子恢复辉光叠加。
 * light 标记告诉粒子引擎用深色调还是亮色调绘制。
 * 新增主题只需在 DEFS 里加一项，编辑器会自动出现对应选项。
 * ============================================================ */
(function () {
  'use strict';
  window.Hanabi = window.Hanabi || {};

  var DEFS = {
    /* 素笺（默认）：暖纸白 + 青瓷绿 */
    aurora: {
      label: '素笺',
      swatch: ['#5f7d72', '#f4f2ec'],
      light: true,
      vars: {
        '--bg-0': '#faf9f4',
        '--bg-1': '#f4f2ea',
        '--bg-2': '#e9e6d8',
        '--wash': 'rgba(122,150,140,.14)',
        '--accent': '#5f7d72',
        '--accent-2': '#b98f6e',
        '--grad-title': 'linear-gradient(180deg,#3a3d34 0%,#22241f 100%)'
      },
      palette: ['#6f8d80', '#9db5a8', '#c98d84', '#4a6b5d', '#c9b99a']
    },
    /* 雾青：淡青灰纸 + 深松绿 */
    midnight: {
      label: '雾青',
      swatch: ['#54756c', '#eef2ef'],
      light: true,
      vars: {
        '--bg-0': '#f0f4f2',
        '--bg-1': '#e6eeea',
        '--bg-2': '#d5e3dc',
        '--wash': 'rgba(84,117,108,.16)',
        '--accent': '#54756c',
        '--accent-2': '#8a9b8f',
        '--grad-title': 'linear-gradient(180deg,#3d5650 0%,#2c423c 100%)'
      },
      palette: ['#54756c', '#7fa39a', '#a9c4bb', '#41584f', '#8fae9f']
    },
    /* 樱贝：暖白纸 + 干玫瑰 */
    sakura: {
      label: '樱贝',
      swatch: ['#c08489', '#f8f1ee'],
      light: true,
      vars: {
        '--bg-0': '#fbf4f0',
        '--bg-1': '#f7ebe5',
        '--bg-2': '#f0dcd4',
        '--wash': 'rgba(201,138,146,.16)',
        '--accent': '#b9777c',
        '--accent-2': '#a58a6e',
        '--grad-title': 'linear-gradient(180deg,#8a545c 0%,#6e3f47 100%)'
      },
      palette: ['#c98a92', '#e0aab1', '#a96a72', '#8d5f66', '#d9b8a5']
    },
    /* 暮沙：米白纸 + 暖赭 */
    sunset: {
      label: '暮沙',
      swatch: ['#a58455', '#f7f2e7'],
      light: true,
      vars: {
        '--bg-0': '#faf5e7',
        '--bg-1': '#f4edd8',
        '--bg-2': '#eadfc4',
        '--wash': 'rgba(165,132,85,.16)',
        '--accent': '#8a6f45',
        '--accent-2': '#7f8b7a',
        '--grad-title': 'linear-gradient(180deg,#6e5936 0%,#544326 100%)'
      },
      palette: ['#a58455', '#c4a26c', '#8a6f45', '#6e5a3a', '#b5a288']
    },
    /* 夜空：蓝黑夜幕 + 星光金（深色主题：文字翻成月白，粒子恢复辉光叠加） */
    night: {
      label: '夜空',
      swatch: ['#d8b46a', '#0d1322'],
      light: false,
      vars: {
        '--bg-0': '#0d1322',
        '--bg-1': '#0a0f1c',
        '--bg-2': '#070b15',
        '--wash': 'rgba(216,180,106,.10)',
        '--accent': '#d8b46a',
        '--accent-2': '#7fa39a',
        '--grad-title': 'linear-gradient(180deg,#f4ecd8 0%,#d8c9a2 100%)',
        '--ink': '#e9e6da',
        '--ink-soft': 'rgba(233,230,218,.76)',
        '--ink-faint': 'rgba(233,230,218,.56)',
        '--hairline': 'rgba(233,230,218,.14)',
        '--hairline-strong': 'rgba(233,230,218,.3)',
        '--surface': '#161d2e'
      },
      palette: ['#d8b46a', '#f0e2bd', '#8fb0d8', '#e8e6dc', '#a9c4bb']
    },
    /* 墨夜：暖黑 + 烛火橙（深色主题） */
    ink: {
      label: '墨夜',
      swatch: ['#e0a458', '#131009'],
      light: false,
      vars: {
        '--bg-0': '#14110c',
        '--bg-1': '#100d09',
        '--bg-2': '#0a0806',
        '--wash': 'rgba(224,164,88,.10)',
        '--accent': '#e0a458',
        '--accent-2': '#a3766e',
        '--grad-title': 'linear-gradient(180deg,#f5e9d2 0%,#dcc39a 100%)',
        '--ink': '#ece4d4',
        '--ink-soft': 'rgba(236,228,212,.76)',
        '--ink-faint': 'rgba(236,228,212,.56)',
        '--hairline': 'rgba(236,228,212,.14)',
        '--hairline-strong': 'rgba(236,228,212,.3)',
        '--surface': '#1c1812'
      },
      palette: ['#e0a458', '#f2d9a0', '#c98d84', '#b58a4e', '#e8dcc2']
    },
    /* 霓虹：暗夜紫黑 + 荧光粉青（深色主题；专属样式见 style.css 的灯牌辉光） */
    neon: {
      label: '霓虹',
      swatch: ['#ff6ea9', '#14121f'],
      light: false,
      vars: {
        '--bg-0': '#14121f',
        '--bg-1': '#100e1a',
        '--bg-2': '#0b0913',
        '--wash': 'rgba(255,110,169,.10)',
        '--accent': '#ff6ea9',
        '--accent-2': '#46e3ff',
        '--grad-title': 'linear-gradient(180deg,#ffd9ec 0%,#ff9ccb 100%)',
        '--ink': '#f0eaf6',
        '--ink-soft': 'rgba(240,234,246,.76)',
        '--ink-faint': 'rgba(240,234,246,.55)',
        '--hairline': 'rgba(240,234,246,.14)',
        '--hairline-strong': 'rgba(240,234,246,.3)',
        '--surface': '#1c1930'
      },
      palette: ['#ff6ea9', '#46e3ff', '#ffd166', '#b388ff', '#f0eaf6']
    },
    /* 车票：牛皮纸暖黄 + 铁锈红（浅色主题；专属样式是票面打孔与虚线） */
    ticket: {
      label: '车票',
      swatch: ['#b4632f', '#f5efe2'],
      light: true,
      vars: {
        '--bg-0': '#f5efe2',
        '--bg-1': '#efe7d5',
        '--bg-2': '#e4d8bf',
        '--wash': 'rgba(180,99,47,.12)',
        '--accent': '#b4632f',
        '--accent-2': '#54756c',
        '--grad-title': 'linear-gradient(180deg,#4a3524 0%,#31220f 100%)',
        '--ink': '#31281c',
        '--ink-soft': 'rgba(49,40,28,.76)',
        '--ink-faint': 'rgba(49,40,28,.55)',
        '--hairline': 'rgba(49,40,28,.16)',
        '--hairline-strong': 'rgba(49,40,28,.34)',
        '--surface': '#fbf6ea'
      },
      palette: ['#b4632f', '#d29a6b', '#54756c', '#8a6f45', '#c9b99a']
    },
    /* 特刊：新闻纸白 + 印章红（浅色主题；专属样式是头版双线框与报头） */
    paper: {
      label: '特刊',
      swatch: ['#b03a2e', '#f7f5ef'],
      light: true,
      vars: {
        '--bg-0': '#f7f5ef',
        '--bg-1': '#f1eee5',
        '--bg-2': '#e6e2d4',
        '--wash': 'rgba(176,58,46,.08)',
        '--accent': '#b03a2e',
        '--accent-2': '#232520',
        '--grad-title': 'linear-gradient(180deg,#232520 0%,#111310 100%)',
        '--ink': '#1d1f1a',
        '--ink-soft': 'rgba(29,31,26,.78)',
        '--ink-faint': 'rgba(29,31,26,.55)',
        '--hairline': 'rgba(29,31,26,.18)',
        '--hairline-strong': 'rgba(29,31,26,.4)',
        '--surface': '#fffdf6'
      },
      palette: ['#b03a2e', '#232520', '#8a8676', '#c9a227', '#6a675c']
    }
  };

  function get(name) {
    return DEFS[name] || DEFS.aurora;
  }
  function has(name) {
    return Object.prototype.hasOwnProperty.call(DEFS, name);
  }
  function list() {
    var arr = [];
    for (var k in DEFS) {
      arr.push({ name: k, label: DEFS[k].label, swatch: DEFS[k].swatch });
    }
    return arr;
  }

  /* 把主题变量写到指定根元素（默认 :root），并留下 data-theme 标记 */
  function apply(name, root) {
    var t = get(name);
    var el = root || document.documentElement;
    var realName = null;
    for (var k in DEFS) { if (DEFS[k] === t) realName = k; }
    if (realName) el.setAttribute('data-theme', realName);
    for (var v in t.vars) {
      el.style.setProperty(v, t.vars[v]);
    }
  }

  window.Hanabi.Themes = {
    get: get,
    has: has,
    list: list,
    apply: apply
  };
})();
