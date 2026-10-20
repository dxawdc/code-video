// 浏览器端 Canvas 动画工具（全局 KIT）。所有函数都是纯函数或只依赖传入的 ctx，
// 保证“任意时刻 t 都能单独画出一帧”，这是逐帧渲染的前提。
(function (root) {
  const KIT = {};

  // ───── 数学与缓动 ─────
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, u) => a + (b - a) * u;
  const prog = (t, a, b) => clamp((t - a) / (b - a));
  const E = {
    linear: (u) => u,
    in2: (u) => u * u,
    out3: (u) => 1 - Math.pow(1 - u, 3),
    out5: (u) => 1 - Math.pow(1 - u, 5),
    outExpo: (u) => (u >= 1 ? 1 : 1 - Math.pow(2, -10 * u)),
    inOut3: (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
    inOutSine: (u) => -(Math.cos(Math.PI * u) - 1) / 2,
    smoother: (u) => u * u * u * (u * (6 * u - 15) + 10),
    outBack: (u) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); },
  };
  // 在 [a,b] 内可见，fi/fo 秒淡入淡出
  const win = (t, a, b, fi = 0.3, fo = 0.3) => Math.min(prog(t, a, a + fi), 1 - prog(t, b - fo, b));
  // t0 时刻触发、按 d 衰减的脉冲（闪光、震屏、推镜）
  const pulse = (t, t0, d) => (t >= t0 && t < t0 + d * 6 ? Math.exp(-(t - t0) / d) : 0);
  // 关键帧：[[t, 数值或数组], ...]，相邻帧之间用 ease 插值，首尾保持
  function kf(keys, t, ease = E.inOut3) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 0; i < keys.length - 1; i++) {
      const [ta, va] = keys[i], [tb, vb] = keys[i + 1];
      if (t < tb) {
        const u = ease(prog(t, ta, tb));
        return Array.isArray(va) ? va.map((x, j) => lerp(x, vb[j], u)) : lerp(va, vb, u);
      }
    }
    return keys[keys.length - 1][1];
  }
  // 可复现的随机数（mulberry32）
  function rng(seed) {
    return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  }
  const bez = (a, c, b, u) => (1 - u) * (1 - u) * a + 2 * (1 - u) * u * c + u * u * b;
  const hexCache = {};
  function rgba(hex, a = 1) {
    let c = hexCache[hex];
    if (!c) { const n = parseInt(hex.slice(1), 16); c = hexCache[hex] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    return `rgba(${c[0]},${c[1]},${c[2]},${clamp(a)})`;
  }
  // 两个 #rrggbb 之间插值，返回 #rrggbb
  function mixHex(a, b, u) {
    rgba(a); rgba(b);
    const ca = hexCache[a], cb = hexCache[b];
    return '#' + ca.map((x, i) => Math.round(lerp(x, cb[i], clamp(u))).toString(16).padStart(2, '0')).join('');
  }
  Object.assign(KIT, { clamp, lerp, prog, E, win, pulse, kf, rng, bez, rgba, mixHex });

  // ───── 字体与文字 ─────
  // 本机已装、在 Chrome 里按字重可用的字体
  KIT.FONT = {
    serif: '"Noto Serif SC", "Source Han Serif SC", "Songti SC", "STSong", serif',
    sans: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", sans-serif',
    mono: '"Cascadia Code", "Cascadia Mono", Consolas, Menlo, monospace',
  };
  KIT.font = (fam, size, w = 400) => `${w} ${size}px ${KIT.FONT[fam] || fam}`;
  // 等字体就绪：list = [['600 40px "Noto Serif SC"', '示例字'], ...]
  KIT.fontsReady = (list) => Promise.all(list.map(([f, s]) => document.fonts.load(f, s || '中文ABC')));

  KIT.spacing = (ctx, px) => { ctx.letterSpacing = px + 'px'; };
  KIT.text = (ctx, s, x, y, f, color, align = 'left', base = 'alphabetic') => {
    ctx.font = f; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base; ctx.fillText(s, x, y);
  };
  KIT.measure = (ctx, s, f) => { ctx.font = f; return ctx.measureText(s).width; };
  KIT.rrect = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
  // 中文按字折行
  KIT.wrapChars = (ctx, s, f, maxW) => {
    ctx.font = f;
    const lines = [];
    let cur = '';
    for (const ch of s) {
      if (ctx.measureText(cur + ch).width > maxW && cur) { lines.push(cur); cur = ch; } else cur += ch;
    }
    if (cur) lines.push(cur);
    return lines;
  };
  // “**强调**”富文本，居中绘制，返回总宽
  KIT.drawRich = (ctx, s, cx, y, o = {}) => {
    const { size = 36, weight = 400, fam = 'sans', color = '#f1ebdf', em = '#f2b36b', alpha = 1, emWeight = Math.min(900, weight + 200) } = o;
    const parts = [];
    s.split('**').forEach((p, i) => { if (p) parts.push({ s: p, em: i % 2 === 1 }); });
    const fN = KIT.font(fam, size, weight), fE = KIT.font(fam, size, emWeight);
    let total = 0;
    for (const p of parts) total += KIT.measure(ctx, p.s, p.em ? fE : fN);
    let x = cx - total / 2;
    for (const p of parts) {
      KIT.text(ctx, p.s, x, y, p.em ? fE : fN, rgba(p.em ? em : color, alpha));
      x += KIT.measure(ctx, p.s, p.em ? fE : fN);
    }
    return total;
  };
  // 逐字浮现的标题
  KIT.revealTitle = (ctx, s, cx, y, t, t0, o = {}) => {
    const { weight = 600, fam = 'serif', color = '#f1ebdf', stagger = 0.075, dur = 0.7, rise = 26, alpha = 1, maxWidth = ctx.canvas.width * 0.88 } = o;
    let { size = 96, track = 10 } = o;
    // 太宽就整体缩小（竖屏、长标题常见）
    KIT.spacing(ctx, track);
    const w0 = KIT.measure(ctx, s, KIT.font(fam, size, weight));
    if (w0 > maxWidth) { const k = maxWidth / w0; size *= k; track *= k; }
    const f = KIT.font(fam, size, weight);
    KIT.spacing(ctx, track);
    const tw = KIT.measure(ctx, s, f);
    let x = cx - tw / 2;
    [...s].forEach((ch, i) => {
      const u = E.out3(prog(t, t0 + i * stagger, t0 + i * stagger + dur));
      KIT.text(ctx, ch, x, y + rise * (1 - u), f, rgba(color, u * alpha));
      x += KIT.measure(ctx, ch, f) + track;
    });
    KIT.spacing(ctx, 0);
  };

  // ───── 字幕 ─────
  // caps = [[开始, 结束, '文本 **强调**'], ...]
  KIT.drawCaptions = (ctx, caps, t, o = {}) => {
    // 竖屏：字号更大、位置抬到 80% 高度，避开短视频平台底部的按钮和文案区
    const PORT = (o.H || ctx.canvas.height) > (o.W || ctx.canvas.width);
    const { W = ctx.canvas.width, H = ctx.canvas.height, size = Math.round(PORT ? W / 22 : Math.min(W, H) / 30), y = PORT ? Math.round(H * 0.8) : H - Math.round(size * 1.4), em = '#f2b36b', band = !PORT, color = '#f1ebdf', shadow = true } = o;
    for (const [a, b, s] of caps) {
      const al = win(t, a, b, 0.25, 0.3);
      if (al <= 0) continue;
      const u = E.out3(prog(t, a, a + 0.45));
      ctx.save();
      if (band) {
        const g = ctx.createLinearGradient(0, H - 140, 0, H);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${0.5 * al})`);
        ctx.fillStyle = g; ctx.fillRect(0, H - 140, W, 140);
      }
      ctx.translate(0, 8 * (1 - u));
      if (shadow) { ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 12; }
      KIT.spacing(ctx, 1.5);
      // 太宽（竖屏常见）就按比例缩小字号，最多缩到 70%，再宽就折成两行
      const plain = s.replace(/\*\*/g, '');
      const w0 = KIT.measure(ctx, plain, KIT.font('sans', size, 500));
      const k = Math.max(0.7, Math.min(1, (W * 0.9) / w0));
      if (w0 * k <= W * 0.9) KIT.drawRich(ctx, s, W / 2, y, { size: Math.floor(size * k), alpha: al, em, color });
      else {
        // 在靠近中点、且不拆开英文单词的位置断行（优先标点/空格之后）
        const chars = [...plain];
        const okAt = (k) => k > 0 && k < chars.length && !(/[A-Za-z0-9.]/.test(chars[k - 1]) && /[A-Za-z0-9.]/.test(chars[k]));
        const good = (k) => /[，。、；：！？,;:!?·）)\s]/.test(chars[k - 1]);
        let half = Math.ceil(chars.length / 2), best = -1;
        for (let d = 0; d < chars.length / 2 && best < 0; d++) for (const k of [half + d, half - d]) if (best < 0 && okAt(k) && good(k)) best = k;
        for (let d = 0; d < chars.length / 2 && best < 0; d++) for (const k of [half + d, half - d]) if (best < 0 && okAt(k)) best = k;
        if (best > 0) half = best;
        const cut = (() => { let n = 0, i = 0; for (; i < s.length && n < half; i++) if (s.slice(i, i + 2) === '**') i++; else n++; return i; })();
        const fix = (x) => ((x.match(/\*\*/g) || []).length % 2 ? x + '**' : x);
        const l1 = fix(s.slice(0, cut)), l2raw = s.slice(cut), l2 = (l1.endsWith('**') && !s.slice(0, cut).endsWith('**') ? '**' : '') + l2raw;
        KIT.drawRich(ctx, l1, W / 2, y - size * 1.3, { size: Math.floor(size * 0.85), alpha: al, em, color });
        KIT.drawRich(ctx, l2, W / 2, y, { size: Math.floor(size * 0.85), alpha: al, em, color });
      }
      KIT.spacing(ctx, 0);
      ctx.restore();
    }
  };

  // ───── 质感：浮尘 / 颗粒 / 暗角 ─────
  KIT.makeDust = (n = 170, seed = 7, W = 1920, H = 1080) => {
    const r = rng(seed);
    return Array.from({ length: n }, () => {
      const z = 0.15 + r() * 0.85;
      return { x: r() * W, y: r() * H, z, vx: (r() - 0.5) * 10 * z, vy: -(3 + r() * 9) * z, f: 0.4 + r() * 1.4, ph: r() * 6.28, warm: r() < 0.35 };
    });
  };
  // wt：世界时间（想让画面“冻结”时停住它即可）
  KIT.drawDust = (ctx, dust, wt, o = {}) => {
    const { W = 1920, H = 1080, color = '#f1ebdf', warm = '#f2b36b', alpha = 0.8 } = o;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const d of dust) {
      const x = ((d.x + d.vx * wt) % W + W) % W;
      const y = ((d.y + d.vy * wt) % (H + 40) + H + 40) % (H + 40) - 20;
      const a = (0.08 + 0.42 * d.z) * (0.55 + 0.45 * Math.sin(wt * d.f + d.ph));
      ctx.fillStyle = rgba(d.warm ? warm : color, a * alpha);
      ctx.beginPath(); ctx.arc(x, y, 0.5 + 1.7 * d.z, 0, 6.283); ctx.fill();
    }
    ctx.restore();
  };
  let GRAIN = null;
  KIT.drawGrainVignette = (ctx, t, o = {}) => {
    const { W = ctx.canvas.width, H = ctx.canvas.height, fps = 30, grain = 0.085, vignette = 0.62 } = o;
    if (!GRAIN) {
      GRAIN = [];
      const r = rng(99);
      for (let k = 0; k < 4; k++) {
        const c = document.createElement('canvas');
        c.width = c.height = 256;
        const g = c.getContext('2d');
        const im = g.createImageData(256, 256);
        for (let i = 0; i < im.data.length; i += 4) { const v = 128 + (r() - 0.5) * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
        g.putImageData(im, 0, 0);
        GRAIN.push(c);
      }
    }
    const f = Math.floor(t * fps);
    ctx.save();
    if (vignette > 0) {
      const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.1);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,0,0,${vignette})`);
      ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    }
    if (grain > 0) {
      ctx.translate((f * 73) % 256, (f * 151) % 256);
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = grain;
      ctx.fillStyle = ctx.createPattern(GRAIN[f % 4], 'repeat');
      ctx.fillRect(-256, -256, W + 512, H + 512);
    }
    ctx.restore();
  };
  // 整屏去饱和（冻结、回忆等）：amount 0..1
  KIT.desaturate = (ctx, amount, W = ctx.canvas.width, H = ctx.canvas.height) => {
    if (amount <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = `rgba(128,128,128,${amount})`; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  };
  // 横向切片错位（故障感），intensity 0..1
  KIT.glitch = (ctx, intensity, seed, W = ctx.canvas.width, H = ctx.canvas.height) => {
    if (intensity <= 0) return;
    const r = rng(seed);
    for (let k = 0; k < 9; k++) {
      const y = r() * H, h = 8 + r() * 60, dx = (r() - 0.5) * 90 * intensity;
      ctx.drawImage(ctx.canvas, 0, y, W, h, dx, y, W, h);
    }
  };

  // ───── 播放器 + 渲染约定 ─────
  // 页面只要调用 KIT.mountPlayer，就同时满足：
  //   1) 浏览器里可播放/拖动/带声音预览（地址后加 #秒数 直接跳转）
  //   2) kit/bin/film.js 的逐帧渲染约定：window.FILM / window.ready / window.renderFrame(i)
  KIT.isRender = () => new URLSearchParams(location.search).has('render');

  // Canvas 模式：draw(ctx, t) 可以是同步或 async（WebGL/p5 等先画到自己的画布，再合成到 ctx）
  KIT.mountPlayer = (o) => {
    const { canvas, draw, fps = 30, duration, title = document.title, fonts = [], audio = 'out/soundtrack.wav', setup = null } = o;
    const ctx = canvas.getContext('2d');
    window.FILM = { fps, duration, title, capture: 'canvas', width: canvas.width, height: canvas.height };
    window.ready = KIT.fontsReady(fonts).then(() => setup && setup()).then(() => draw(ctx, 0)).then(() => true);
    window.renderFrame = async (i) => { await draw(ctx, i / fps); return canvas.toDataURL('image/png'); };
    window.drawAt = (t) => draw(ctx, t);
    if (KIT.isRender()) { document.body.classList.add('render'); return; }
    playerBar(canvas, duration, audio, (t) => draw(ctx, t));
  };

  // DOM 模式（HTML/CSS/SVG/GSAP/Lottie）：seek(t) 把页面摆到 t 时刻，渲染器直接截图 1920×1080 的舞台
  KIT.mountStage = (o) => {
    const { stage, seek, fps = 30, duration, title = document.title, fonts = [], audio = 'out/soundtrack.wav', setup = null } = o;
    const SW = stage.offsetWidth || 1920, SH = stage.offsetHeight || 1080;
    window.FILM = { fps, duration, title, capture: 'dom', width: SW, height: SH };
    window.seek = async (t) => { await seek(t); };
    window.ready = KIT.fontsReady(fonts).then(() => setup && setup()).then(() => seek(0)).then(() => true);
    if (KIT.isRender()) { document.body.classList.add('render'); return; }
    // 预览时按窗口缩放舞台
    const wrap = document.createElement('div');
    wrap.id = 'stage-wrap';
    stage.before(wrap); wrap.appendChild(stage);
    const fit = () => {
      const k = Math.min(window.innerWidth * 0.96 / SW, (window.innerHeight - 80) / SH);
      wrap.style.cssText = `width:${SW * k}px;height:${SH * k}px;overflow:hidden;position:relative;border-radius:8px`;
      stage.style.transform = `scale(${k})`; stage.style.transformOrigin = '0 0';
    };
    fit(); window.addEventListener('resize', fit);
    playerBar(wrap, duration, audio, seek);
  };

  function playerBar(after, duration, audio, show0) {
    const bar = document.createElement('div');
    bar.id = 'bar';
    bar.innerHTML = '<button id="play">播放</button><input id="seek" type="range" min="0" step="0.0333" value="0"><span id="tc">0.00s</span>';
    after.after(bar);
    const au = new Audio(audio);
    const seek = bar.querySelector('#seek'), tc = bar.querySelector('#tc'), btn = bar.querySelector('#play');
    seek.max = duration;
    let playing = false, t0 = 0, start = 0, busy = false;
    const show = (t) => { seek.value = t; tc.textContent = t.toFixed(2) + 's'; if (busy) return; busy = true; Promise.resolve(show0(t)).finally(() => { busy = false; }); };
    const loop = () => {
      if (!playing) return;
      let t = au.readyState >= 2 && !au.paused ? au.currentTime : t0 + (performance.now() - start) / 1000;
      if (t >= duration) { playing = false; btn.textContent = '播放'; t = duration - 1e-3; }
      show(t);
      requestAnimationFrame(loop);
    };
    btn.onclick = () => {
      playing = !playing;
      btn.textContent = playing ? '暂停' : '播放';
      if (playing) {
        t0 = +seek.value >= duration - 0.05 ? 0 : +seek.value;
        start = performance.now();
        au.currentTime = t0; au.play().catch(() => {});
        loop();
      } else au.pause();
    };
    seek.oninput = () => { if (!playing) show(+seek.value); else { au.currentTime = +seek.value; t0 = +seek.value; start = performance.now(); } };
    window.addEventListener('keydown', (e) => { if (e.code === 'Space') { e.preventDefault(); btn.onclick(); } });
    // 第 0 帧通常是黑的（淡入），默认跳到 #秒数 或第 1 秒
    window.ready.then(() => show(+(location.hash.slice(1) || Math.min(1, duration))));
  }

  if (typeof module !== 'undefined') module.exports = KIT;
  else root.KIT = KIT;
})(typeof window !== 'undefined' ? window : globalThis);
