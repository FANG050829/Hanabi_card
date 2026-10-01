/* ============================================================
 * 花火贺卡 · effects.js
 * Canvas 粒子引擎 + 六种内置粒子效果。
 *
 * 效果注册规范（贡献新效果照此写）：
 *   registerEffect('名字', {
 *     label: '中文名', desc: '一句话描述',
 *     init: function (ctx, w, h, opts) { ... return { tick, stop? } }
 *   })
 * 引擎约定：
 *   - init 创建粒子世界，返回 { tick(ctx, dt, time), stop()? }；
 *     dt 为秒，time 为自启动起的秒数。
 *   - 画布已按 devicePixelRatio 缩放，效果代码一律按 CSS 像素工作。
 *   - opts = { palette: [颜色...], reduced: 是否减少动态 }。
 *   - 每帧引擎负责 clearRect，效果只管画；窗口 resize 会重新 init。
 * ============================================================ */
(function () {
  'use strict';
  window.Hanabi = window.Hanabi || {};

  var defs = {};   // name -> 定义
  var ORDER = [];  // 保持注册顺序，编辑器选项按此排列

  /* ---------- 通用工具 ---------- */
  var TAU = Math.PI * 2;
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  /* #rrggbb -> rgba(...)，供渐变端点带透明度使用 */
  function hexA(hex, a) {
    var h = String(hex).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    if (isNaN(n)) return hex;
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a.toFixed(2) + ')';
  }
  /* 预渲染辉光粒子精灵：一次性画好径向渐变，运行时只做 drawImage。
   * 比每帧 shadowBlur 便宜一个数量级，也是"纸上水彩"质感的来源。 */
  var spriteCache = {};
  function glowSprite(color) {
    if (spriteCache[color]) return spriteCache[color];
    var s = document.createElement('canvas');
    s.width = s.height = 64;
    var g = s.getContext('2d');
    var grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, hexA(color, 0.85));
    grad.addColorStop(0.28, hexA(color, 0.42));
    grad.addColorStop(1, hexA(color, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    spriteCache[color] = s;
    return s;
  }
  function drawGlow(c, color, x, y, r, alpha) {
    c.globalAlpha = alpha;
    c.drawImage(glowSprite(color), x - r, y - r, r * 2, r * 2);
  }

  function registerEffect(name, def) {
    if (!defs[name]) ORDER.push(name);
    defs[name] = def;
  }

  /* ---------- 粒子引擎 ---------- */
  function Engine(canvas, name, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.def = defs[name] || defs[ORDER[0]] || null;
    this.opts = opts || {};
    this.w = 0; this.h = 0; this.dpr = 1;
    this.state = null;
    this.raf = 0; this.last = 0; this.running = false;
    var self = this;
    this._onResize = function () { self.resize(); };
    this._frame = function (t) { self.frame(t); };
  }

  Engine.prototype = {
    /* 重建画布尺寸并适配高分屏；尺寸变化即重建粒子世界 */
    resize: function () {
      var c = this.canvas;
      var w = c.clientWidth, h = c.clientHeight;
      if (!w || !h) return;
      this.w = w; this.h = h;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = Math.round(w * this.dpr);
      c.height = Math.round(h * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      if (this.state && this.state.stop) this.state.stop();
      this.state = this.def ? this.def.init(this.ctx, w, h, this.opts) : null;
    },

    frame: function (t) {
      if (!this.running) return;
      var dt = Math.min((t - this.last) / 1000, 0.05) || 0.016; // 切后台回来 dt 限幅
      this.last = t;
      var ctx = this.ctx;
      ctx.clearRect(0, 0, this.w, this.h);
      if (this.state && this.state.tick) this.state.tick(ctx, dt, t / 1000);
      this.raf = requestAnimationFrame(this._frame);
    },

    start: function () {
      if (!this.def) return;
      this.resize();
      if (!this.state) return;

      /* 尊重 prefers-reduced-motion：不跑动画，只预演若干帧得到一张静态画面 */
      if (this.opts.reduced) {
        for (var i = 0; i < 90; i++) {
          this.ctx.clearRect(0, 0, this.w, this.h);
          this.state.tick(this.ctx, 1 / 30, i / 30);
        }
        return;
      }

      this.running = true;
      this.last = performance.now();
      this.raf = requestAnimationFrame(this._frame);
      window.addEventListener('resize', this._onResize);
    },

    stop: function () {
      this.running = false;
      cancelAnimationFrame(this.raf);
      window.removeEventListener('resize', this._onResize);
      if (this.state && this.state.stop) this.state.stop();
      this.state = null;
    }
  };

  window.Hanabi.Effects = {
    registerEffect: registerEffect,
    /* 挂载一个效果到画布，返回引擎实例（调用 stop() 卸载） */
    mount: function (canvas, name, opts) {
      var e = new Engine(canvas, name, opts);
      e.start();
      return e;
    },
    has: function (n) { return !!defs[n]; },
    list: function () {
      return ORDER.map(function (n) {
        return { name: n, label: defs[n].label || n, desc: defs[n].desc || '' };
      });
    }
  };
  /* 对外规范入口：Hanabi.registerEffect(...) */
  window.Hanabi.registerEffect = registerEffect;

  /* ============================================================
   * 效果一：烟花 fireworks —— 火箭升空、爆裂成带拖尾的辉光火花。
   * 辉光用预渲染精灵绘制：深底是夜空盛放，纸白底上则是
   * 一层层晕开的水彩墨点（multiply 混合），两种底都成立。
   * ============================================================ */
  registerEffect('fireworks', {
    label: '烟花', desc: '夜空盛放',
    init: function (ctx, w, h, opts) {
      var colors = (opts.palette && opts.palette.length) ? opts.palette : ['#7ce7ff', '#ffd479', '#ff9de2'];
      var light = !!opts.light; // 浅色主题：multiply 混合 = 水彩在纸上晕开
      var dens = clamp(opts.density || 1, 0.2, 2);
      var RG = 420;  // 火箭重力
      var SG = 250;  // 火花重力
      var rockets = [], sparks = [];
      var nextLaunch = 0.35;

      function launch() {
        rockets.push({
          x: rand(w * 0.18, w * 0.82), y: h + 8,
          px: 0, py: 0,
          vx: rand(-26, 26),
          /* 由目标爆裂高度反推初速，保证每枚都在半空炸开 */
          vy: -Math.sqrt(2 * RG * rand(0.5, 0.8) * h),
          color: pick(colors)
        });
      }

      function explode(r) {
        var n = 48 + ((Math.random() * 30) | 0);
        var ring = rand(0.75, 1); // 同一枚烟花内的速度环，让球形更立体
        for (var i = 0; i < n; i++) {
          var a = Math.random() * TAU;
          var band = 0.35 + 0.65 * Math.random();
          var sp = rand(60, 300) * ring * band;
          var life = rand(1.2, 2.2);
          sparks.push({
            x: r.x, y: r.y,
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
            life: life, max: life,
            size: rand(2.2, 4.6) * (0.7 + 0.6 * band),
            color: Math.random() < 0.75 ? r.color : pick(colors),
            trail: []
          });
        }
      }

      launch(); launch();
      /* 开场先来一发即爆炸花，第一眼就有氛围 */
      explode({ x: rand(w * 0.3, w * 0.7), y: rand(h * 0.2, h * 0.45), color: pick(colors) });

      return {
        tick: function (c, dt) {
          nextLaunch -= dt;
          if (nextLaunch <= 0 && rockets.length < Math.ceil(5 * dens)) {
            launch();
            if (Math.random() < 0.35) launch();
            nextLaunch = rand(0.55, 1.5) / dens;
          }

          c.globalCompositeOperation = light ? 'source-over' : 'lighter';

          /* 火箭：亮线上升，临近顶点即爆 */
          for (var i = rockets.length - 1; i >= 0; i--) {
            var r = rockets[i];
            r.px = r.x; r.py = r.y;
            r.x += r.vx * dt; r.y += r.vy * dt; r.vy += RG * dt;
            c.strokeStyle = light
              ? 'rgba(110,107,94,.9)'
              : 'rgba(255,235,200,.8)';
            c.lineWidth = 2; c.lineCap = 'round';
            c.beginPath(); c.moveTo(r.px, r.py); c.lineTo(r.x, r.y); c.stroke();
            drawGlow(c, r.color, r.x, r.y, light ? 11 : 9, light ? 0.6 : 0.9);
            if (r.vy > -60) { explode(r); rockets.splice(i, 1); }
          }

          /* 火花：辉光晕 + 短拖尾，末端缓缓熄灭 */
          for (var j = sparks.length - 1; j >= 0; j--) {
            var s = sparks[j];
            s.trail.push([s.x, s.y]);
            if (s.trail.length > 4) s.trail.shift();
            var drag = Math.pow(0.985, dt * 60);
            s.vx *= drag; s.vy = s.vy * drag + SG * dt;
            s.x += s.vx * dt; s.y += s.vy * dt;
            s.life -= dt;
            if (s.life <= 0 || s.y > h + 30) { sparks.splice(j, 1); continue; }

            var k = Math.max(s.life / s.max, 0);
            /* 亮度随生命单调衰减，带一点水波式微闪 */
            var a = Math.min(1, k * 1.15) *
              (0.8 + 0.2 * Math.sin(s.x * 0.05 + s.y * 0.05));
            var rad = s.size * (light ? 3.1 : 2.6) * (0.5 + 0.5 * k);
            drawGlow(c, s.color, s.x, s.y, rad, (light ? 0.5 : 0.95) * a);
            /* 年轻火花带一根细拖尾，方向感更强 */
            var tr = s.trail;
            if (tr.length > 1 && k > 0.45) {
              c.globalAlpha = a * (light ? 0.22 : 0.5);
              c.strokeStyle = s.color;
              c.lineWidth = 1.4; c.lineCap = 'round';
              c.beginPath();
              c.moveTo(tr[0][0], tr[0][1]);
              for (var m = 1; m < tr.length; m++) c.lineTo(tr[m][0], tr[m][1]);
              c.lineTo(s.x, s.y);
              c.stroke();
            }
          }

          c.globalAlpha = 1;
          c.globalCompositeOperation = 'source-over';
        }
      };
    }
  });

  /* ============================================================
   * 效果二：彩带 confetti —— 顶部持续飘落的翻转纸片
   * ============================================================ */
  registerEffect('confetti', {
    label: '彩带', desc: '庆祝落彩',
    init: function (ctx, w, h, opts) {
      var colors = (opts.palette && opts.palette.length) ? opts.palette : ['#ffd479', '#7ce7ff', '#ff9de2'];
      var d = clamp(opts.density || 1, 0.2, 2);
      var n = clamp(Math.round(w * h / 9000 * d), 12, 320);
      var pieces = [];
      for (var i = 0; i < n; i++) {
        pieces.push({
          x: rand(0, w), y: rand(-h * 0.3, h),
          w: rand(6, 11), h: rand(9, 16),
          vy: rand(55, 115),
          ph: rand(0, TAU), fq: rand(0.8, 2.2),
          sway: rand(24, 60),
          rot: rand(0, TAU), vr: rand(-2.6, 2.6),
          color: pick(colors)
        });
      }
      return {
        tick: function (c, dt, t) {
          for (var i = 0; i < pieces.length; i++) {
            var p = pieces[i];
            p.y += p.vy * dt;
            p.x += Math.sin(t * p.fq + p.ph) * p.sway * dt + 12 * dt;
            p.rot += p.vr * dt;
            if (p.y > h + 24) { p.y = rand(-60, -20); p.x = rand(0, w); }
            if (p.x > w + 20) p.x = -18;

            /* 用 scaleY 模拟纸片翻转时的透视 */
            c.save();
            c.translate(p.x, p.y);
            c.rotate(p.rot);
            c.scale(1, 0.35 + 0.65 * Math.abs(Math.sin(t * p.fq * 1.6 + p.ph)));
            c.globalAlpha = 0.92;
            c.fillStyle = p.color;
            c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            c.restore();
          }
          c.globalAlpha = 1;
        }
      };
    }
  });

  /* ============================================================
   * 效果三：星空 starfield —— 三层视差星海 + 偶发划过的星子
   * ============================================================ */
  registerEffect('starfield', {
    label: '星空', desc: '静谧星河',
    init: function (ctx, w, h, opts) {
      var palette = (opts.palette && opts.palette.length) ? opts.palette : ['#7ce7ff'];
      /* 浅色主题下白色星点不可见，全部改用主题深色调 */
      var tints = opts.light ? palette.slice() : palette.concat(['#ffffff', '#ffffff']);
      var stars = [];
      var d = clamp(opts.density || 1, 0.2, 2);
      var n = clamp(Math.round(w * h / 6500 * d), 14, 340);
      for (var i = 0; i < n; i++) {
        var z = rand(0.25, 1); // 深度：越大越近、越亮、越快
        stars.push({
          x: rand(0, w), y: rand(0, h), z: z,
          r: 0.4 + z * 1.5,
          tw: rand(0.6, 2.4), ph: rand(0, TAU),
          color: pick(tints)
        });
      }
      var shoot = null;
      var nextShoot = rand(1.5, 4);

      return {
        tick: function (c, dt, t) {
          for (var i = 0; i < stars.length; i++) {
            var p = stars[i];
            p.y += (4 + p.z * 10) * dt;
            p.x += (1.5 + p.z * 4) * dt;
            if (p.y > h + 4) { p.y = -4; p.x = rand(0, w); }
            if (p.x > w + 4) p.x = -4;

            var a = (0.25 + 0.75 * p.z) * (0.55 + 0.45 * Math.sin(t * p.tw + p.ph));
            c.globalAlpha = Math.max(a, 0.05) * (opts.light ? 0.8 : 1);
            c.fillStyle = p.color;
            if (p.z > 0.75) { c.shadowColor = p.color; c.shadowBlur = opts.light ? 3 : 6; } else { c.shadowBlur = 0; }
            c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fill();
          }
          c.shadowBlur = 0;

          /* 偶发流星：短促划过 */
          nextShoot -= dt;
          if (nextShoot <= 0 && !shoot) {
            shoot = {
              x: rand(w * 0.2, w * 1.05), y: rand(-20, h * 0.3),
              vx: -rand(380, 560), vy: rand(150, 260),
              life: rand(0.5, 0.8), max: 0,
              color: pick(palette)
            };
            shoot.max = shoot.life;
            nextShoot = rand(2.5, 6);
          }
          if (shoot) {
            shoot.x += shoot.vx * dt; shoot.y += shoot.vy * dt;
            shoot.life -= dt;
            var k = Math.max(shoot.life / shoot.max, 0);
            var tx = shoot.x - shoot.vx * 0.12, ty = shoot.y - shoot.vy * 0.12;
            var head = opts.light ? shoot.color : '#ffffff';
            var g = c.createLinearGradient(shoot.x, shoot.y, tx, ty);
            g.addColorStop(0, hexA(head, 0.9 * k));
            g.addColorStop(1, hexA(head, 0));
            c.strokeStyle = g; c.lineWidth = 1.6; c.lineCap = 'round';
            c.shadowColor = head; c.shadowBlur = opts.light ? 4 : 8;
            c.beginPath(); c.moveTo(shoot.x, shoot.y); c.lineTo(tx, ty); c.stroke();
            c.shadowBlur = 0;
            if (shoot.life <= 0 || shoot.y > h + 40) shoot = null;
          }
          c.globalAlpha = 1;
        }
      };
    }
  });

  /* ============================================================
   * 效果四：飘雪 snow —— 大小两层雪片，随风缓摆
   * ============================================================ */
  registerEffect('snow', {
    label: '飘雪', desc: '冬日落雪',
    init: function (ctx, w, h, opts) {
      var d = clamp(opts.density || 1, 0.2, 2);
      var n = clamp(Math.round(w * h / 7000 * d), 10, 300);
      var colors = (opts.palette && opts.palette.length) ? opts.palette : ['#ffffff'];
      var flakes = [];
      for (var i = 0; i < n; i++) {
        var r = rand(1, 3.4);
        flakes.push({
          x: rand(0, w), y: rand(-10, h),
          r: r,
          vy: 14 + r * 11,          // 大雪片落得更快
          ph: rand(0, TAU),
          sw: rand(12, 34),
          a: rand(0.35, 0.95),
          color: opts.light ? pick(colors) : '#ffffff'
        });
      }
      return {
        tick: function (c, dt, t) {
          var wind = Math.sin(t * 0.22) * 18; // 缓慢的整阵风
          for (var i = 0; i < flakes.length; i++) {
            var f = flakes[i];
            f.y += f.vy * dt;
            f.x += (Math.sin(t * 0.9 + f.ph) * f.sw + wind) * dt;
            if (f.y > h + 6) { f.y = -8; f.x = rand(0, w); }
            if (f.x > w + 8) f.x = -8;
            if (f.x < -8) f.x = w + 8;

            c.globalAlpha = opts.light ? f.a * 0.55 : f.a;
            c.fillStyle = f.color;
            if (f.r > 2.4) {
              c.shadowColor = opts.light ? 'rgba(90,100,95,.5)' : 'rgba(255,255,255,.8)';
              c.shadowBlur = 4;
            } else { c.shadowBlur = 0; }
            c.beginPath(); c.arc(f.x, f.y, f.r, 0, TAU); c.fill();
          }
          c.globalAlpha = 1; c.shadowBlur = 0;
        }
      };
    }
  });

  /* ============================================================
   * 效果五：樱花 petals —— 粉色花瓣带 3D 翻面地飘落
   * ============================================================ */
  registerEffect('petals', {
    label: '樱花', desc: '落樱缤纷',
    init: function (ctx, w, h, opts) {
      /* 花瓣固定使用粉色系，任何主题下都成立 */
      var colors = ['#ffd9e8', '#ffc2dd', '#ff9ecb', '#fff1f6'];
      var d = clamp(opts.density || 1, 0.2, 2);
      var n = clamp(Math.round(w * h / 10000 * d), 6, 150);
      var petals = [];
      for (var i = 0; i < n; i++) {
        petals.push({
          x: rand(0, w), y: rand(-h * 0.5, h),
          s: rand(5, 10),
          vy: rand(26, 62),
          rot: rand(0, TAU), vr: rand(-1.6, 1.6),
          ph: rand(0, TAU), fq: rand(0.7, 1.6),
          sw: rand(26, 64),
          fl: rand(1.5, 3.2),       // 翻面速度
          a: rand(0.65, 0.95),
          color: pick(colors)
        });
      }
      return {
        tick: function (c, dt, t) {
          for (var i = 0; i < petals.length; i++) {
            var p = petals[i];
            p.y += p.vy * dt;
            p.x += Math.sin(t * p.fq + p.ph) * p.sw * dt;
            p.rot += p.vr * dt;
            if (p.y > h + 16) { p.y = rand(-80, -16); p.x = rand(0, w); }
            if (p.x > w + 16) p.x = -14;
            if (p.x < -16) p.x = w + 14;

            /* scaleX 过零 => 花瓣侧身，制造 3D 翻转感 */
            var sx = Math.sin(t * p.fl + p.ph);
            if (Math.abs(sx) < 0.15) sx = sx < 0 ? -0.15 : 0.15;

            c.save();
            c.translate(p.x, p.y);
            c.rotate(p.rot);
            c.scale(sx, 1);
            c.globalAlpha = p.a;
            c.fillStyle = p.color;
            c.beginPath();
            c.moveTo(0, -p.s);
            c.bezierCurveTo(p.s * 0.85, -p.s * 0.55, p.s * 0.8, p.s * 0.7, 0, p.s);
            c.bezierCurveTo(-p.s * 0.8, p.s * 0.7, -p.s * 0.85, -p.s * 0.55, 0, -p.s);
            c.fill();
            c.restore();
          }
          c.globalAlpha = 1;
        }
      };
    }
  });

  /* ============================================================
   * 效果六：流星雨 meteor —— 长尾辉光流星成阵划过
   * ============================================================ */
  registerEffect('meteor', {
    label: '流星雨', desc: '星陨如雨',
    init: function (ctx, w, h, opts) {
      var colors = (opts.palette && opts.palette.length) ? opts.palette : ['#7ce7ff', '#ffffff'];
      /* 底层缀少量微星增加纵深 */
      var stars = [];
      var sn = clamp(Math.round(w * h / 26000), 24, 70);
      for (var i = 0; i < sn; i++) {
        stars.push({ x: rand(0, w), y: rand(0, h), r: rand(0.4, 1.2), tw: rand(0.5, 2), ph: rand(0, TAU) });
      }
      var meteors = [];
      var next = rand(0.3, 1.2);

      function spawn() {
        var speed = rand(420, 680);
        var ang = rand(0.35, 0.6); // 与水平线的夹角（向左下）
        meteors.push({
          x: rand(w * 0.15, w * 1.1), y: rand(-30, h * 0.22),
          vx: -Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
          len: speed * rand(0.16, 0.26),
          color: pick(colors)
        });
      }
      spawn();

      return {
        tick: function (c, dt, t) {
          for (var i = 0; i < stars.length; i++) {
            var st = stars[i];
            c.globalAlpha = (0.3 + 0.3 * Math.sin(t * st.tw + st.ph)) * (opts.light ? 0.7 : 1);
            c.fillStyle = opts.light ? '#8a8577' : '#ffffff';
            c.beginPath(); c.arc(st.x, st.y, st.r, 0, TAU); c.fill();
          }
          c.globalAlpha = 1;

          next -= dt;
          if (next <= 0) {
            spawn();
            if (Math.random() < 0.4) spawn();
            next = rand(0.35, 1.4) / clamp(opts.density || 1, 0.2, 2);
          }

          c.globalCompositeOperation = opts.light ? 'source-over' : 'lighter';
          for (var j = meteors.length - 1; j >= 0; j--) {
            var m = meteors[j];
            m.x += m.vx * dt; m.y += m.vy * dt;
            if (m.y > h + 80 || m.x < -m.len - 80) { meteors.splice(j, 1); continue; }

            /* 拖尾：沿速度反方向的渐变光线 */
            var vlen = Math.sqrt(m.vx * m.vx + m.vy * m.vy);
            var nx = m.vx / vlen, ny = m.vy / vlen;
            var tx = m.x - nx * m.len, ty = m.y - ny * m.len;
            var headCol = opts.light ? m.color : '#ffffff';
            var g = c.createLinearGradient(m.x, m.y, tx, ty);
            g.addColorStop(0, hexA(headCol, 0.95));
            g.addColorStop(0.3, hexA(m.color, 0.75));
            g.addColorStop(1, hexA(m.color, 0));
            c.strokeStyle = g;
            c.lineWidth = 2.2; c.lineCap = 'round';
            c.shadowColor = m.color; c.shadowBlur = opts.light ? 4 : 10;
            c.beginPath(); c.moveTo(m.x, m.y); c.lineTo(tx, ty); c.stroke();

            /* 亮头 */
            c.fillStyle = headCol;
            c.shadowColor = headCol; c.shadowBlur = opts.light ? 5 : 12;
            c.beginPath(); c.arc(m.x, m.y, 2.2, 0, TAU); c.fill();
          }
          c.shadowBlur = 0;
          c.globalCompositeOperation = 'source-over';
        }
      };
    }
  });

  /* ============================================================
   * 效果七：天灯 lantern —— 孔明灯载着心愿缓缓升空，
   * 灯焰明灭、灯身微晃；纸白底上是暖赭灯影，夜空底上是暖光。
   * ============================================================ */
  registerEffect('lantern', {
    label: '天灯', desc: '心愿升空',
    init: function (ctx, w, h, opts) {
      var colors = (opts.palette && opts.palette.length) ? opts.palette : ['#a58455', '#c4a26c'];
      var light = !!opts.light;
      var d = clamp(opts.density || 1, 0.2, 2);
      var n = clamp(Math.round(w * h / 24000 * d), 5, 46);
      var lamps = [];
      for (var i = 0; i < n; i++) {
        var s = rand(7, 15) * (w < 480 ? 0.85 : 1);
        lamps.push({
          x: rand(w * 0.06, w * 0.94),
          y: rand(h * 0.2, h + 60),
          s: s,
          vy: rand(16, 30) * (12 / s + 0.6), // 小灯升得慢些，形成层次
          ph: rand(0, TAU),
          fq: rand(0.4, 0.9),
          sway: rand(10, 26),
          fk: rand(1.6, 3.4),
          depth: rand(0.35, 1),
          color: pick(colors)
        });
      }
      return {
        tick: function (c, dt, t) {
          for (var i = 0; i < lamps.length; i++) {
            var L = lamps[i];
            L.y -= L.vy * dt * L.depth;
            var x = L.x + Math.sin(t * L.fq + L.ph) * L.sway;
            /* 升出顶部后从底部重新放一盏 */
            if (L.y < -40) { L.y = h + rand(30, 90); L.x = rand(w * 0.06, w * 0.94); }

            var flicker = 0.82 + 0.18 * Math.sin(t * L.fk + L.ph * 2);
            var fade = L.y < h * 0.18 ? Math.max(L.y / (h * 0.18), 0) : 1;
            var bodyCol = light ? L.color : '#ffd9a0';
            var glowCol = light ? L.color : '#ffb35c';

            /* 灯周的光晕 */
            drawGlow(c, glowCol, x, L.y - L.s * 0.1,
              L.s * (light ? 2.6 : 3.4) * flicker,
              (light ? 0.4 : 0.65) * fade * flicker);

            /* 灯身：上宽下窄的梯形，暖色渐变 */
            c.globalAlpha = (light ? 0.9 : 0.95) * fade;
            var bw = L.s, bh = L.s * 1.32;
            var grad = c.createLinearGradient(x, L.y - bh / 2, x, L.y + bh / 2);
            grad.addColorStop(0, light ? bodyCol : '#ffe7bd');
            grad.addColorStop(1, light ? hexA('#6e5a3a', 0.85) : '#c97b3d');
            c.fillStyle = grad;
            c.beginPath();
            c.moveTo(x - bw * 0.5, L.y - bh * 0.5);
            c.quadraticCurveTo(x, L.y - bh * 0.68, x + bw * 0.5, L.y - bh * 0.5);
            c.lineTo(x + bw * 0.34, L.y + bh * 0.5);
            c.quadraticCurveTo(x, L.y + bh * 0.62, x - bw * 0.34, L.y + bh * 0.5);
            c.closePath();
            c.fill();

            /* 灯口火焰：小小的亮核，随 flicker 明灭 */
            c.globalAlpha = fade * flicker;
            c.fillStyle = light ? '#fff3d6' : '#fff6df';
            c.beginPath();
            c.arc(x, L.y + bh * 0.36, Math.max(1.1, L.s * 0.14) * flicker, 0, TAU);
            c.fill();
          }
          c.globalAlpha = 1;
        }
      };
    }
  });
})();
