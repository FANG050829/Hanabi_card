/* ============================================================
 * 花火贺卡 · effects.js
 * Canvas 粒子引擎 + 七种内置粒子效果。
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
    this.puffs = [];   // 触点拖尾的临时粒子（player 的指针事件喂进来）
    this.raf = 0; this.last = 0; this.running = false;
    var self = this;
    this._onResize = function () { self.resize(); };
    this._frame = function (t) { self.frame(t); };
  }

  Engine.prototype = {
    /* 重建画布尺寸并适配高分屏；尺寸大变才重建粒子世界。
     * 移动端地址栏收起/展开会带来 60~120px 的高度抖动，
     * 每次都重建会让烟花飞到一半凭空消失重来——小幅抖动只重设画布。 */
    resize: function () {
      var c = this.canvas;
      var w = c.clientWidth, h = c.clientHeight;
      if (!w || !h) return;
      var keep = this.state && this.w && this.h &&
        Math.abs(w - this.w) < 2 && Math.abs(h - this.h) <= 120;
      this.w = w; this.h = h;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = Math.round(w * this.dpr);
      c.height = Math.round(h * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      if (keep) {
        /* 静态预演模式没有动画循环，画布重设后要补画一帧 */
        if (this.opts.reduced && this.state.tick) this.state.tick(this.ctx, 0, 0);
        return;
      }
      if (this.state && this.state.stop) this.state.stop();
      this.state = this.def ? this.def.init(this.ctx, w, h, this.opts) : null;
      /* 重新 init 后同样补画一帧，静态模式下画布不再是空白 */
      if (this.opts.reduced && this.state && this.state.tick) {
        this.state.tick(this.ctx, 0, 0);
      }
    },

    frame: function (t) {
      if (!this.running) return;
      var dt = Math.min((t - this.last) / 1000, 0.05) || 0.016; // 切后台回来 dt 限幅
      this.last = t;
      var ctx = this.ctx;
      ctx.clearRect(0, 0, this.w, this.h);
      if (this.state && this.state.tick) this.state.tick(ctx, dt, t / 1000);
      /* 触点拖尾：短命小粒子，任何效果之上都可以叠 */
      if (this.puffs.length) {
        for (var i = this.puffs.length - 1; i >= 0; i--) {
          var p = this.puffs[i];
          p.t += dt;
          if (p.t >= p.life) { this.puffs.splice(i, 1); continue; }
          p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 30 * dt;
          drawGlow(ctx, p.color, p.x, p.y, p.r * (1 + p.t * 2.2), (1 - p.t / p.life) * 0.7);
        }
      }
      this.raf = requestAnimationFrame(this._frame);
    },

    /* 触点粒子拖尾：播放页把指针坐标喂进来（x/y 为 CSS 像素） */
    puff: function (x, y) {
      if (!this.running || this.opts.reduced) return;
      var colors = (this.opts.palette && this.opts.palette.length) ? this.opts.palette : ['#7ce7ff'];
      for (var i = 0; i < 2; i++) {
        this.puffs.push({
          x: x + rand(-4, 4), y: y + rand(-4, 4),
          vx: rand(-20, 20), vy: rand(-38, -6),
          life: rand(0.4, 0.75), t: 0,
          r: rand(1.4, 3.2), color: pick(colors)
        });
      }
      if (this.puffs.length > 96) this.puffs.splice(0, this.puffs.length - 96);
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

  /* ============================================================
   * 效果八：萤火虫 fireflies —— 缓慢游走的明灭光点，
   * 夜底是暖黄流萤，纸白底上是淡青草色的水彩光斑。
   * ============================================================ */
  registerEffect('fireflies', {
    label: '萤火虫', desc: '仲夏夜之光',
    init: function (ctx, w, h, opts) {
      var colors = (opts.palette && opts.palette.length) ? opts.palette : ['#d8e86a', '#ffe97a'];
      var light = !!opts.light;
      var d = clamp(opts.density || 1, 0.2, 2);
      var n = clamp(Math.round(w * h / 26000 * d), 6, 44);
      var bugs = [];
      for (var i = 0; i < n; i++) {
        bugs.push({
          x: rand(0, w), y: rand(0, h),
          ph: rand(0, TAU), fq: rand(0.5, 1.3),
          sp: rand(14, 34), dir: rand(0, TAU),
          glowFq: rand(1.1, 2.6),
          r: rand(1.6, 2.8), color: pick(colors)
        });
      }
      return {
        tick: function (c, dt, t) {
          c.globalCompositeOperation = light ? 'source-over' : 'lighter';
          for (var i = 0; i < bugs.length; i++) {
            var b = bugs[i];
            /* 随机游走：方向缓漂 + 微弱摆动，像真的在飞 */
            b.dir += rand(-1.4, 1.4) * dt;
            b.x += Math.cos(b.dir) * b.sp * dt + Math.sin(t * b.fq + b.ph) * 8 * dt;
            b.y += Math.sin(b.dir) * b.sp * dt + Math.cos(t * b.fq * 0.8 + b.ph) * 6 * dt;
            if (b.x < -20) b.x = w + 20; if (b.x > w + 20) b.x = -20;
            if (b.y < -20) b.y = h + 20; if (b.y > h + 20) b.y = -20;
            var glow = Math.max(0, Math.sin(t * b.glowFq + b.ph * 2));
            var a = (light ? 0.5 : 0.9) * (0.12 + 0.88 * glow);
            drawGlow(c, b.color, b.x, b.y, b.r * (light ? 4.2 : 5.5) * (0.6 + 0.6 * glow), a);
            if (glow > 0.35) {
              c.globalAlpha = a;
              c.fillStyle = light ? '#6d6a4a' : '#fffbe0';
              c.beginPath(); c.arc(b.x, b.y, b.r * 0.55, 0, TAU); c.fill();
            }
          }
          c.globalAlpha = 1;
          c.globalCompositeOperation = 'source-over';
        }
      };
    }
  });

  /* ============================================================
   * 效果九：极光 aurora —— 夜幕顶端垂下的流动光帘，
   * 两三层缓波叠加，纸白底上是淡淡的水彩色带。
   * ============================================================ */
  registerEffect('aurora', {
    label: '极光', desc: '夜幕光帘',
    init: function (ctx, w, h, opts) {
      var colors = (opts.palette && opts.palette.length) ? opts.palette : ['#7ce7ff', '#9be8b8', '#c3a6ff'];
      var light = !!opts.light;
      var d = clamp(opts.density || 1, 0.2, 2);
      var n = clamp(Math.round(3 * d), 2, 5);
      var bands = [];
      for (var i = 0; i < n; i++) {
        bands.push({
          yBase: h * (0.14 + 0.11 * i),
          amp: rand(16, 40),
          fq: rand(0.25, 0.5),
          ph: rand(0, TAU),
          depth: rand(0.55, 1),
          color: colors[i % colors.length]
        });
      }
      return {
        tick: function (c, dt, t) {
          c.globalCompositeOperation = light ? 'source-over' : 'lighter';
          for (var i = 0; i < bands.length; i++) {
            var b = bands[i];
            var top = h * 0.06, bot = b.yBase + h * 0.34;
            var g = c.createLinearGradient(0, top, 0, bot);
            g.addColorStop(0, hexA(b.color, 0));
            g.addColorStop(0.35, hexA(b.color, (light ? 0.14 : 0.28) * b.depth));
            g.addColorStop(1, hexA(b.color, 0));
            c.fillStyle = g;
            c.beginPath();
            c.moveTo(-20, bot);
            var steps = 14;
            for (var s = 0; s <= steps; s++) {
              var px = -20 + (w + 40) * s / steps;
              var py = top + Math.sin(t * b.fq + b.ph + px / w * 4.2) * b.amp
                     + Math.sin(t * b.fq * 0.6 + px / w * 2.1) * b.amp * 0.5;
              c.lineTo(px, py);
            }
            c.lineTo(w + 20, bot);
            c.closePath();
            c.fill();
          }
          c.globalCompositeOperation = 'source-over';
        }
      };
    }
  });

  /* ============================================================
   * 效果十：泡泡 bubbles —— 带高光的透亮泡泡缓缓上浮，
   * 摇摇摆摆，顶上轻轻消散。
   * ============================================================ */
  registerEffect('bubbles', {
    label: '泡泡', desc: '轻盈上浮',
    init: function (ctx, w, h, opts) {
      var colors = (opts.palette && opts.palette.length) ? opts.palette : ['#8fd0e8', '#a9c4bb', '#c3a6ff'];
      var light = !!opts.light;
      var d = clamp(opts.density || 1, 0.2, 2);
      var n = clamp(Math.round(w * h / 22000 * d), 6, 52);
      function spawn(anyY) {
        var r = rand(3, 13) * (w < 480 ? 0.82 : 1);
        return {
          x: rand(0, w),
          y: anyY ? rand(0, h) : h + r * 2 + rand(0, 80),
          r: r,
          vy: rand(22, 48) * (10 / r + 0.5), // 小泡泡升得慢些
          ph: rand(0, TAU), fq: rand(0.6, 1.6), sw: rand(8, 26),
          color: pick(colors)
        };
      }
      var ps = [];
      for (var i = 0; i < n; i++) ps.push(spawn(true));
      return {
        tick: function (c, dt, t) {
          for (var i = 0; i < ps.length; i++) {
            var p = ps[i];
            p.y -= p.vy * dt;
            if (p.y < -p.r * 2) { ps[i] = spawn(false); continue; }
            var x0 = p.x + Math.sin(t * p.fq + p.ph) * p.sw;
            var a = (light ? 0.55 : 0.8) * clamp(p.y / (h * 0.18), 0.25, 1);
            /* 泡泡 = 淡填充 + 亮圈 + 一点高光 */
            c.globalAlpha = a * 0.26;
            c.fillStyle = p.color;
            c.beginPath(); c.arc(x0, p.y, p.r, 0, TAU); c.fill();
            c.globalAlpha = a;
            c.lineWidth = 1.1;
            c.strokeStyle = light ? p.color : hexA(p.color, 0.9);
            c.beginPath(); c.arc(x0, p.y, p.r, 0, TAU); c.stroke();
            c.globalAlpha = a * 0.85;
            c.fillStyle = '#ffffff';
            c.beginPath(); c.arc(x0 - p.r * 0.35, p.y - p.r * 0.4, Math.max(1, p.r * 0.16), 0, TAU); c.fill();
          }
          c.globalAlpha = 1;
        }
      };
    }
  });

  /* ============================================================
   * 效果十一：文字烟花 textfireworks —— 火箭升空炸开，
   * 火花飞向文字采样点，拼出标题后辉光驻留、散落、再来一轮。
   * 文字来自 opts.text（播放端传卡面标题），无文字回落「花火」。
   * ============================================================ */
  registerEffect('textfireworks', {
    label: '文字烟花', desc: '祝福炸成星火',
    init: function (ctx, w, h, opts) {
      var colors = (opts.palette && opts.palette.length) ? opts.palette : ['#ffd479', '#ff9de2', '#7ce7ff'];
      var light = !!opts.light;
      var dens = clamp(opts.density || 1, 0.2, 2);
      var text = String(opts.text || '花火').slice(0, 12);
      var targets = sampleText(text, w, h, dens); // 归一化采样点 [{x,y}]
      var sparks = [];   // {x,y,vx,vy,phase:seek|set|fall, tx,ty,t,color,r}
      var rockets = [];  // {x,y,vx,vy,fuse,t,color}
      var nextLaunch = 0.5;
      var hadShow = false; // 本轮是否真的放过烟花：防止空闲重置把倒计时永远摁在起点
      var RG = 430, SG = 260;

      /* 把文字画到离屏画布，按步长采样不透明像素 → 归一化坐标点 */
      function sampleText(s, W, H, dn) {
        var chars = Array.from(s);
        var fs = Math.min(170, Math.max(46, W * 0.84 / Math.max(1, chars.length)));
        var c = document.createElement('canvas');
        c.width = Math.ceil(fs * chars.length * 1.12);
        c.height = Math.ceil(fs * 1.4);
        var g = c.getContext('2d');
        g.font = '600 ' + fs + 'px "Songti SC", "Noto Serif SC", "STSong", serif';
        g.textBaseline = 'middle';
        g.fillStyle = '#fff';
        g.fillText(s, 0, c.height * 0.54);
        var data;
        try { data = g.getImageData(0, 0, c.width, c.height).data; } catch (e) { return []; }
        var stride = Math.max(3, Math.round(fs / 15 / Math.max(0.55, dn)));
        var pts = [];
        for (var y = 0; y < c.height; y += stride) {
          for (var x = 0; x < c.width; x += stride) {
            if (data[(y * c.width + x) * 4 + 3] > 120) {
              pts.push({ x: x / c.width, y: y / c.height });
            }
          }
        }
        /* 控制点数上限：点太多既费性能又看不清字 */
        while (pts.length > 260) {
          pts.splice((Math.random() * pts.length) | 0, 1);
        }
        return pts;
      }

      function launch() {
        if (!targets.length) return;
        hadShow = true;
        var n = 2 + ((Math.random() * 2) | 0);
        for (var i = 0; i < n; i++) {
          rockets.push({
            x: rand(w * 0.25, w * 0.75), y: h + 10,
            vx: rand(-14, 14),
            vy: -rand(h * 0.55, h * 0.78) * 1.35,
            fuse: rand(0.55, 0.95), t: 0,
            color: pick(colors)
          });
        }
      }
      /* 一枚火箭炸开：这一组火花各自认领一段文字目标点 */
      function burst(rk, round) {
        var per = Math.max(1, Math.round(targets.length / 3));
        var start = (round * per) % targets.length;
        for (var i = 0; i < per; i++) {
          var tp = targets[(start + i) % targets.length];
          var ang = rand(0, TAU), sp = rand(30, 130);
          sparks.push({
            x: rk.x, y: rk.y,
            vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 40,
            phase: 'seek',
            tx: tp.x * w * 0.9 + w * 0.05,       /* 文字定位：水平居中、贴住上缘（避开正文区） */
            ty: tp.y * Math.min(h * 0.16, 130) + h * 0.05,
            t: 0, color: rk.color, r: rand(1.6, 2.8)
          });
        }
      }

      return {
        tick: function (c, dt, t) {
          if (light) c.globalCompositeOperation = 'multiply';
          nextLaunch -= dt;
          if (nextLaunch <= 0 && !rockets.length && !sparks.length) launch();
          /* 火箭 */
          for (var i = rockets.length - 1; i >= 0; i--) {
            var rk = rockets[i];
            rk.t += dt;
            rk.vy += RG * dt;
            rk.x += rk.vx * dt; rk.y += rk.vy * dt;
            drawGlow(c, rk.color, rk.x, rk.y, 4.5, 0.85);
            if (rk.t >= rk.fuse || rk.vy > -20) {
              burst(rk, (t * 7) | 0);
              rockets.splice(i, 1);
            }
          }
          /* 火花：seek 追字 → set 驻留闪烁 → fall 散落退场 */
          var alive = 0;
          for (var j = sparks.length - 1; j >= 0; j--) {
            var p = sparks[j];
            p.t += dt;
            if (p.phase === 'seek') {
              var dx = p.tx - p.x, dy = p.ty - p.y;
              var d = Math.sqrt(dx * dx + dy * dy);
              if (d < 5 || p.t > 1.6) { p.phase = 'set'; p.t = 0; }
              else {
                p.vx += dx * 5.2 * dt; p.vy += dy * 5.2 * dt;
                p.vx *= (1 - 1.4 * dt); p.vy *= (1 - 1.4 * dt);
                p.x += p.vx * dt; p.y += p.vy * dt;
              }
            } else if (p.phase === 'set') {
              p.x += Math.sin(t * 2.2 + p.ty) * 0.16;
              p.y += Math.cos(t * 1.9 + p.tx) * 0.16;
              if (p.t > 2.1) { p.phase = 'fall'; p.t = 0; p.vx = rand(-26, 26); p.vy = rand(-12, 8); }
            } else {
              p.vy += SG * 0.55 * dt;
              p.x += p.vx * dt; p.y += p.vy * dt;
            }
            if (p.phase !== 'fall' || p.y < h + 24) alive++;
            var fade = p.phase === 'fall' ? clamp(1 - p.t / 1.1, 0, 1) : 1;
            var tw = p.phase === 'set' ? (0.72 + Math.sin(t * 7 + p.tx * 3) * 0.28) : 1;
            if (fade > 0.02) drawGlow(c, p.color, p.x, p.y, p.r * 2.4, 0.9 * fade * tw);
            if (p.phase === 'fall' && (p.t > 1.1 || p.y > h + 24)) sparks.splice(j, 1);
          }
          if (hadShow && !rockets.length && !alive) { nextLaunch = 1.15; hadShow = false; }
          c.globalCompositeOperation = 'source-over';
        }
      };
    }
  });

  /* ============================================================
   * 效果十二：星轨 startrail —— 长曝光摄影感：群星绕极点
   * 缓缓画弧，轨迹长度随半径变化，中心一颗亮极星带星芒。
   * ============================================================ */
  registerEffect('startrail', {
    label: '星轨', desc: '长曝夜空',
    init: function (ctx, w, h, opts) {
      var colors = (opts.palette && opts.palette.length) ? opts.palette : ['#9db5a8'];
      var light = !!opts.light;
      var dens = clamp(opts.density || 1, 0.2, 2);
      var cx = w * 0.5, cy = h * 0.3;
      var maxR = Math.hypot(w, h) * 0.62;
      var n = Math.round(90 * dens);
      var stars = [];
      for (var i = 0; i < n; i++) {
        var r = 26 + Math.pow(Math.random(), 0.7) * (maxR - 26);
        stars.push({
          r: r,
          a: rand(0, TAU),
          sp: rand(9, 15) / r,          /* 角速度 ∝ 1/r，外圈走得慢 */
          size: rand(0.7, 1.9),
          color: pick(colors),
          tw: rand(2, 6), ph: rand(0, TAU)
        });
      }
      return {
        tick: function (c, dt, t) {
          var base = light ? 0.4 : 0.55;
          for (var i = 0; i < stars.length; i++) {
            var s = stars[i];
            s.a += s.sp * dt;
            var trail = Math.min(1.15, 16 / s.r); /* 轨迹角长：内圈长外圈短 */
            c.beginPath();
            c.arc(cx, cy, s.r, s.a - trail, s.a);
            c.strokeStyle = hexA(s.color, base * 0.45);
            c.lineWidth = s.size;
            c.stroke();
            /* 星头亮一点，随时间微微闪烁 */
            var hx = cx + Math.cos(s.a) * s.r, hy = cy + Math.sin(s.a) * s.r;
            var twk = 0.75 + Math.sin(t * s.tw + s.ph) * 0.25;
            drawGlow(c, s.color, hx, hy, s.size * 2.6, base * twk);
          }
          /* 极星：定点亮星 + 十字星芒 */
          drawGlow(c, colors[0], cx, cy, 6.5, light ? 0.85 : 1);
          c.strokeStyle = hexA(colors[0], light ? 0.5 : 0.6);
          c.lineWidth = 1;
          var flare = 10 + Math.sin(t * 1.6) * 2;
          c.beginPath();
          c.moveTo(cx - flare, cy); c.lineTo(cx + flare, cy);
          c.moveTo(cx, cy - flare); c.lineTo(cx, cy + flare);
          c.stroke();
        }
      };
    }
  });

  /* ============================================================
   * 效果十三：深海 ocean —— 鲸鱼剪影缓游、水母脉动上浮、
   * 浮游微光点点。浅色底是墨色剪影，深底是发光生物。
   * ============================================================ */
  registerEffect('ocean', {
    label: '深海', desc: '鲸与水母',
    init: function (ctx, w, h, opts) {
      var colors = (opts.palette && opts.palette.length) ? opts.palette : ['#54756c'];
      var light = !!opts.light;
      var dens = clamp(opts.density || 1, 0.2, 2);
      var base = light ? hexA(colors[0], 0.2) : hexA(colors[0], 0.34);

      function Whale(dir, yBase, scale) {
        var wk = { dir: dir, x: dir > 0 ? -w * 0.28 : w * 1.28, y: yBase, s: scale, ph: rand(0, TAU) };
        wk.tick = function (c, dt, t) {
          wk.x += wk.dir * (w * 0.038) * dt;
          wk.y = yBase + Math.sin(t * 0.32 + wk.ph) * h * 0.03;
          if (wk.dir > 0 && wk.x > w * 1.3) wk.x = -w * 0.3;
          if (wk.dir < 0 && wk.x < -w * 0.3) wk.x = w * 1.3;
          var s = wk.s, x = wk.x, y = wk.y;
          var sway = Math.sin(t * 1.5 + wk.ph) * 0.06;
          c.save();
          c.translate(x, y);
          c.scale(wk.dir * s, s);
          c.rotate(sway * wk.dir);
          c.fillStyle = base;
          c.beginPath();
          /* 鲸身：吻端 → 背脊 → 尾柄，一条贝塞尔剪影 */
          c.moveTo(-95, 0);
          c.bezierCurveTo(-78, -26, -20, -34, 26, -22);
          c.bezierCurveTo(52, -15, 68, -8, 86, -2);
          c.lineTo(104, -14 + sway * 40);
          c.lineTo(100, 2 + sway * 20);
          c.lineTo(104, 16 + sway * 40);
          c.lineTo(84, 6);
          c.bezierCurveTo(48, 20, -20, 26, -60, 14);
          c.bezierCurveTo(-80, 10, -90, 6, -95, 0);
          c.fill();
          /* 胸鳍 */
          c.beginPath();
          c.moveTo(-18, 12);
          c.quadraticCurveTo(-6, 34, 10, 38);
          c.quadraticCurveTo(2, 22, -8, 14);
          c.fill();
          c.restore();
        };
        return wk;
      }
      var whales = [
        Whale(1, h * 0.3, Math.min(1.1, w / 900) * 1.05),
        Whale(-1, h * 0.66, Math.min(1.1, w / 900) * 0.7)
      ];
      /* 水母：伞盖 + 飘带触手，缓慢上浮脉动 */
      var jellies = [];
      var jn = Math.round(4 * dens);
      for (var i = 0; i < jn; i++) {
        jellies.push({
          x: rand(w * 0.1, w * 0.9), y: rand(h * 0.2, h * 1.05),
          s: rand(9, 17), ph: rand(0, TAU),
          vy: rand(9, 16), color: pick(colors),
          tent: 3 + ((Math.random() * 2) | 0)
        });
      }
      /* 浮游微光 */
      var motes = [];
      var mn = Math.round(42 * dens);
      for (var m = 0; m < mn; m++) {
        motes.push({ x: rand(0, w), y: rand(0, h), r: rand(0.7, 1.8), vy: rand(3, 9), ph: rand(0, TAU), color: pick(colors) });
      }
      return {
        tick: function (c, dt, t) {
          var i, k;
          for (i = 0; i < motes.length; i++) {
            var mo = motes[i];
            mo.y -= mo.vy * dt;
            if (mo.y < -6) { mo.y = h + 6; mo.x = rand(0, w); }
            var a = (light ? 0.3 : 0.5) * (0.55 + Math.sin(t * 1.8 + mo.ph) * 0.45);
            c.globalAlpha = a;
            c.fillStyle = mo.color;
            c.beginPath(); c.arc(mo.x + Math.sin(t + mo.ph) * 4, mo.y, mo.r, 0, TAU); c.fill();
          }
          c.globalAlpha = 1;
          for (i = 0; i < jellies.length; i++) {
            var jl = jellies[i];
            jl.y -= jl.vy * dt;
            if (jl.y < -40) { jl.y = h + 40; jl.x = rand(w * 0.1, w * 0.9); }
            var pulse = 1 + Math.sin(t * 1.5 + jl.ph) * 0.09;
            var jx = jl.x + Math.sin(t * 0.5 + jl.ph) * 14;
            if (!light) drawGlow(c, jl.color, jx, jl.y, jl.s * 2.6, 0.22);
            c.fillStyle = light ? hexA(jl.color, 0.26) : hexA(jl.color, 0.4);
            c.beginPath();
            c.arc(jx, jl.y, jl.s * pulse, Math.PI, 0);
            c.quadraticCurveTo(jx + jl.s * pulse, jl.y + jl.s * 0.34, jx, jl.y + jl.s * 0.3);
            c.quadraticCurveTo(jx - jl.s * pulse, jl.y + jl.s * 0.34, jx - jl.s * pulse, jl.y);
            c.fill();
            c.strokeStyle = light ? hexA(jl.color, 0.3) : hexA(jl.color, 0.38);
            c.lineWidth = 1.1;
            for (k = 0; k < jl.tent; k++) {
              var tx = jx - jl.s * 0.6 + (k + 0.5) * (jl.s * 1.2 / jl.tent);
              c.beginPath();
              c.moveTo(tx, jl.y + jl.s * 0.3);
              for (var seg = 1; seg <= 3; seg++) {
                var ty = jl.y + jl.s * 0.3 + seg * jl.s * 0.62;
                c.lineTo(tx + Math.sin(t * 2 + jl.ph + seg + k) * 3.4, ty);
              }
              c.stroke();
            }
          }
          whales.forEach(function (wk) { wk.tick(c, dt, t); });
        }
      };
    }
  });

  /* ============================================================
   * 效果十四：蒲公英 dandelion —— 两株绒球停在角落，
   * 种子乘风飘散，风时强时弱（阵风周期）。
   * ============================================================ */
  registerEffect('dandelion', {
    label: '蒲公英', desc: '乘风而散',
    init: function (ctx, w, h, opts) {
      var colors = (opts.palette && opts.palette.length) ? opts.palette : ['#8a9b8f'];
      var light = !!opts.light;
      var dens = clamp(opts.density || 1, 0.2, 2);
      var heads = [
        { x: w * 0.12, y: h * 0.8, r: Math.min(30, w * 0.06), ph: 0 },
        { x: w * 0.86, y: h * 0.26, r: Math.min(24, w * 0.05), ph: 2.4 }
      ];
      var seeds = [];
      var seedColor = colors[0];
      var nextGust = rand(2, 5), gust = 0;

      function spawnSeed(head) {
        var ang = rand(0, TAU), rr = Math.sqrt(Math.random()) * head.r;
        seeds.push({
          x: head.x + Math.cos(ang) * rr,
          y: head.y + Math.sin(ang) * rr * 0.7,
          vx: rand(4, 14), vy: rand(-6, -2),
          rot: rand(0, TAU), vr: rand(-0.7, 0.7),
          s: rand(0.8, 1.25), t: 0, ph: rand(0, TAU)
        });
        if (seeds.length > Math.round(56 * dens)) seeds.shift();
      }
      heads.forEach(function (hd) {
        for (var i = 0; i < 6; i++) spawnSeed(hd);
      });

      function drawSeed(c, p, t) {
        var sway = Math.sin(t * 2.2 + p.ph) * 0.25;
        c.save();
        c.translate(p.x, p.y);
        c.rotate(p.rot + sway);
        c.scale(p.s, p.s);
        c.strokeStyle = hexA(seedColor, light ? 0.5 : 0.66);
        c.lineWidth = 0.8;
        for (var k = -2; k <= 2; k++) {
          c.beginPath();
          c.moveTo(0, 2);
          c.quadraticCurveTo(k * 2.6, -3, k * 4.2, -7);
          c.stroke();
        }
        c.fillStyle = hexA(seedColor, light ? 0.55 : 0.7);
        c.beginPath(); c.arc(0, 2.4, 1.5, 0, TAU); c.fill();
        c.strokeStyle = hexA(seedColor, 0.35);
        c.beginPath(); c.moveTo(0, 3.4); c.lineTo(0, 7.5); c.stroke();
        c.restore();
      }
      return {
        tick: function (c, dt, t) {
          nextGust -= dt;
          if (nextGust <= 0) { gust = rand(1.2, 2); nextGust = rand(3.5, 7); }
          var wind = Math.sin(t * 0.4) * 9 + (gust > 0 ? 46 : 0);
          if (gust > 0) gust -= dt;
          heads.forEach(function (hd) {
            /* 绒球：一圈随风轻颤的绒毛 */
            c.strokeStyle = hexA(seedColor, light ? 0.4 : 0.55);
            c.lineWidth = 0.9;
            for (var k = 0; k < 14; k++) {
              var a = TAU * k / 14 + Math.sin(t * 0.8 + hd.ph) * 0.06;
              c.beginPath();
              c.moveTo(hd.x, hd.y);
              c.quadraticCurveTo(
                hd.x + Math.cos(a) * hd.r * 0.6, hd.y + Math.sin(a) * hd.r * 0.6 - 2,
                hd.x + Math.cos(a) * hd.r, hd.y + Math.sin(a) * hd.r);
              c.stroke();
            }
            c.fillStyle = hexA(seedColor, light ? 0.5 : 0.6);
            c.beginPath(); c.arc(hd.x, hd.y, 2.6, 0, TAU); c.fill();
            if (Math.random() < dt * (gust > 0 ? 9 : 2.2) * dens) spawnSeed(hd);
          });
          for (var i = seeds.length - 1; i >= 0; i--) {
            var p = seeds[i];
            p.t += dt;
            p.vx += (wind - p.vx) * 0.5 * dt;
            p.vy += (16 - p.vy) * 0.4 * dt;
            p.x += p.vx * dt + Math.sin(t * 3 + p.ph) * 8 * dt;
            p.y += p.vy * dt;
            p.rot += p.vr * dt;
            if (p.x > w + 30 || p.y > h + 30 || p.t > 26) { seeds.splice(i, 1); continue; }
            drawSeed(c, p, t);
          }
        }
      };
    }
  });

  /* ============================================================
   * 效果十五：雨窗 rainglass —— 玻璃上的雨滴挂着、滑落、
   * 留下渐干的水痕；少量微滴钉在原地轻颤。
   * 轨迹写进离屏缓冲累积，每帧以 destination-out 淡出晾干。
   * ============================================================ */
  registerEffect('rainglass', {
    label: '雨窗', desc: '雨挂玻璃',
    init: function (ctx, w, h, opts) {
      var colors = (opts.palette && opts.palette.length) ? opts.palette : ['#54756c'];
      var light = !!opts.light;
      var dens = clamp(opts.density || 1, 0.2, 2);
      var ink = light ? 'rgba(46,64,58,' : 'rgba(220,236,230,';
      var buf = document.createElement('canvas');
      var bctx = buf.getContext('2d');
      buf.width = Math.max(1, Math.round(w));
      buf.height = Math.max(1, Math.round(h));
      var drops = [];
      var stuck = [];
      var sn = Math.round(26 * dens);
      for (var i = 0; i < sn; i++) {
        stuck.push({ x: rand(0, w), y: rand(0, h), r: rand(0.8, 2.2), ph: rand(0, TAU) });
      }
      function spawnDrop(y0) {
        var r = rand(1.6, 4.2);
        drops.push({
          x: rand(0, w), y: y0 !== undefined ? y0 : rand(-40, -4),
          r: r, vy: 14 + r * rand(9, 16), ph: rand(0, TAU), px: 0, py: 0
        });
        if (drops.length > Math.round(26 * dens)) drops.shift();
      }
      for (i = 0; i < Math.round(9 * dens); i++) spawnDrop(rand(0, h));
      return {
        tick: function (c, dt, t) {
          bctx.globalCompositeOperation = 'destination-out';
          bctx.fillStyle = 'rgba(0,0,0,0.045)';
          bctx.fillRect(0, 0, w, h);
          bctx.globalCompositeOperation = 'source-over';
          for (var i = 0; i < stuck.length; i++) {
            var st = stuck[i];
            var wob = Math.sin(t * 2 + st.ph) * 0.4;
            c.fillStyle = ink + '0.3)';
            c.beginPath(); c.arc(st.x + wob, st.y, st.r, 0, TAU); c.fill();
            c.fillStyle = light ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.28)';
            c.beginPath(); c.arc(st.x - st.r * 0.3 + wob, st.y - st.r * 0.35, st.r * 0.32, 0, TAU); c.fill();
          }
          if (Math.random() < dt * 3.4 * dens) spawnDrop();
          for (i = drops.length - 1; i >= 0; i--) {
            var p = drops[i];
            p.px = p.x; p.py = p.y;
            p.y += p.vy * dt;
            p.x += Math.sin(t * 3.1 + p.ph) * 7 * dt;
            p.vy += 8 * dt;
            if (p.y > h + 12) { drops.splice(i, 1); continue; }
            bctx.strokeStyle = ink + '0.14)';
            bctx.lineWidth = p.r * 0.8;
            bctx.lineCap = 'round';
            bctx.beginPath(); bctx.moveTo(p.px, p.py); bctx.lineTo(p.x, p.y); bctx.stroke();
            c.fillStyle = ink + '0.4)';
            c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fill();
            c.fillStyle = light ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.3)';
            c.beginPath(); c.arc(p.x - p.r * 0.32, p.y - p.r * 0.36, p.r * 0.3, 0, TAU); c.fill();
          }
          c.drawImage(buf, 0, 0);
        }
      };
    }
  });

  /* ============================================================
   * 效果十六：数字雨 matrix —— 赛博祝福：字符雨倾泻而下，
   * 头字符亮、尾迹渐隐；浅色主题是"纸上代码"的墨绿。
   * ============================================================ */
  registerEffect('matrix', {
    label: '数字雨', desc: '赛博字雨',
    init: function (ctx, w, h, opts) {
      var colors = (opts.palette && opts.palette.length) ? opts.palette : ['#4a6b5d'];
      var light = !!opts.light;
      var dens = clamp(opts.density || 1, 0.2, 2);
      var CHARS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿ0123456789ABCDEF<>*+=-';
      var FS = 15;
      var cols = Math.max(6, Math.ceil(w / FS));
      var drops = [];
      for (var i = 0; i < cols; i++) {
        drops.push({ y: rand(-h * 0.5, h), sp: rand(55, 170), bias: Math.random() });
      }
      function ch() { return CHARS[(Math.random() * CHARS.length) | 0]; }
      return {
        tick: function (c, dt) {
          c.font = FS + 'px ui-monospace, Menlo, Consolas, monospace';
          c.textBaseline = 'top';
          for (var i = 0; i < cols; i++) {
            var d = drops[i];
            d.y += d.sp * dt;
            if (d.y - 10 * FS > h) { d.y = rand(-h * 0.3, -20); d.sp = rand(55, 170); }
            var x = i * FS + 1;
            for (var k = 8; k >= 1; k--) {
              var a = (light ? 0.4 : 0.5) * (1 - k / 9);
              c.fillStyle = hexA(colors[0], a);
              c.fillText(ch(), x, d.y - k * FS);
            }
            c.fillStyle = d.bias > 0.86 ? hexA(colors[colors.length - 1], 0.95) : hexA(colors[0], light ? 0.95 : 1);
            c.fillText(ch(), x, d.y);
            if (d.bias > 0.86) {
              drawGlow(c, colors[colors.length - 1], x + FS * 0.5, d.y + FS * 0.5, FS * 0.8, light ? 0.2 : 0.5);
            }
          }
        }
      };
    }
  });

  /* ============================================================
   * 效果十七：纸飞机 paperplane —— 贺卡本就是信：一架折纸飞机
   * 载着祝福掠过卡面，身后拖着一条虚线航迹。
   * 纸白主题是墨线勾勒的素描飞机，夜帖主题是提着微光的夜航。
   * ============================================================ */
  registerEffect('paperplane', {
    label: '纸飞机', desc: '载祝福远行',
    init: function (ctx, w, h, opts) {
      var colors = (opts.palette && opts.palette.length) ? opts.palette : ['#5f7d72'];
      var light = !!opts.light;
      var dens = clamp(opts.density || 1, 0.2, 2);
      var PAPER = '#fffdf6';                    // 折纸的本色，两种底色上都成立
      var ink = light ? colors[0] : colors[colors.length - 1];

      function Plane(delay) {
        var pl = {
          k: 0,
          wait: delay,                          // 候场秒数（真实时间）
          baseY: rand(h * 0.18, h * 0.6),
          amp: rand(18, 44),                    // 上下飘的幅度
          fq: rand(1.1, 1.9),                   // 全程飘几个来回
          ph: rand(0, TAU),
          s: rand(1.7, 2.2),
          sp: rand(0.8, 1.15),                  // 速度系数：慢一点更从容
          trail: [],
          px: 0, py: 0, ang: 0
        };
        pl.reset = function () {
          pl.k = 0;
          pl.wait = rand(0.5, 2);
          pl.baseY = rand(h * 0.18, h * 0.6);
          pl.amp = rand(18, 44);
          pl.fq = rand(1.1, 1.9);
          pl.ph = rand(0, TAU);
          pl.s = rand(0.85, 1.25);
          pl.sp = rand(0.8, 1.15);
          pl.trail.length = 0;
        };
        return pl;
      }
      var planes = [];
      var n = Math.round(2 + dens);
      for (var i = 0; i < n; i++) planes.push(Plane(i * rand(2.5, 4)));

      /* 折纸飞机：两片机翼 + 中缝折线，机头朝行进方向 */
      function drawPlane(c, x, y, ang, s) {
        c.save();
        c.translate(x, y);
        c.rotate(ang);
        c.scale(s, s);
        c.globalAlpha = 0.96;
        /* 上翼（受光面） */
        c.fillStyle = PAPER;
        c.beginPath();
        c.moveTo(17, 0);
        c.lineTo(-13, -9);
        c.lineTo(-7, -0.5);
        c.closePath();
        c.fill();
        /* 下翼（折面，稍暗一点制造立体） */
        c.fillStyle = light ? '#e9e2d0' : '#d9d2c0';
        c.beginPath();
        c.moveTo(17, 0);
        c.lineTo(-7, -0.5);
        c.lineTo(-13, 9);
        c.closePath();
        c.fill();
        /* 龙骨：机身下探的小三角，折纸的立体感来自它 */
        c.fillStyle = light ? '#ddd5c1' : '#cfc7b2';
        c.beginPath();
        c.moveTo(17, 0);
        c.lineTo(-7, -0.5);
        c.lineTo(-11.5, 7.5);
        c.closePath();
        c.fill();
        /* 中缝折线 + 轮廓 */
        c.strokeStyle = hexA(ink, 0.92);
        c.lineWidth = 1.5;
        c.lineJoin = 'round';
        c.beginPath();
        c.moveTo(17, 0);
        c.lineTo(-11.5, 7.5);
        c.moveTo(17, 0);
        c.lineTo(-13, -9);
        c.moveTo(17, 0);
        c.lineTo(-13, 9);
        c.moveTo(-13, -9);
        c.lineTo(-7, -0.5);
        c.lineTo(-13, 9);
        c.stroke();
        c.restore();
      }

      return {
        tick: function (c, dt, t) {
          var i, j;
          for (i = 0; i < planes.length; i++) {
            var pl = planes[i];
            if (pl.wait > 0) { pl.wait -= dt; continue; }
            pl.k += (dt / 15) * pl.sp;          // 一次横穿约 15 秒，从容
            var x = pl.k * (w + 180) - 90;
            var y = pl.baseY + Math.sin(pl.k * Math.PI * pl.fq + pl.ph) * pl.amp
                  + Math.sin(t * 2.1 + pl.ph) * 2.2;
            if (pl.k > 1) { pl.reset(); continue; }
            /* 航迹：虚线，尾端渐淡 */
            pl.trail.push({ x: x, y: y });
            if (pl.trail.length > 46) pl.trail.shift();
            if (pl.trail.length > 2) {
              c.setLineDash([4, 7]);
              c.strokeStyle = hexA(ink, light ? 0.45 : 0.5);
              c.lineWidth = 1.1;
              c.beginPath();
              c.moveTo(pl.trail[0].x, pl.trail[0].y);
              for (j = 1; j < pl.trail.length; j++) c.lineTo(pl.trail[j].x, pl.trail[j].y);
              c.stroke();
              c.setLineDash([]);
            }
            /* 机身朝向：由航迹差分平滑而来，避免抖动 */
            var target = Math.atan2(y - pl.py, Math.max(0.5, x - pl.px));
            pl.ang += (target - pl.ang) * Math.min(1, dt * 6);
            if (!light) drawGlow(c, ink, x, y, 26, 0.2);   // 夜航提灯
            drawPlane(c, x, y, pl.ang, pl.s);
            pl.px = x; pl.py = y;
          }
        }
      };
    }
  });
})();
