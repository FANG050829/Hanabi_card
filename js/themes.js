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
