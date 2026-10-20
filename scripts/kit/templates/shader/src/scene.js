// 着色器层（WebGL2，离屏）+ 文字层（Canvas 2D）。drawFrame 是 t 的纯函数。
(function () {
  const { prog, E, win, kf, rgba } = KIT;
  const W = TL.W, H = TL.H, U = Math.min(W, H) / 1080;
  let G, P;

  // 场景表：[开始, 结束, 着色器]；相邻场景重叠的部分自动交叉淡化
  const SHOTS = [[0, 3.3, 'aurora'], [2.7, 5.8, 'ink'], [5.2, 8.0, 'metal']];

  function setup() {
    G = GLK.create(W, H);
    P = {};
    for (const k of new Set(SHOTS.map((s) => s[2]))) P[k] = G.program(GLK.LOOKS[k]);
  }

  function drawFrame(ctx, t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    for (const [a, b, look] of SHOTS) {
      const al = win(t, a, b, 0.6, 0.6);
      if (al <= 0) continue;
      G.draw(P[look], { u_time: t + a * 7, u_energy: 0.5 + 0.5 * Math.sin(t * 1.3) });
      ctx.globalAlpha = a === 0 ? Math.min(1, 1 - prog(t, b - 0.6, b)) : al;
      ctx.drawImage(G.canvas, 0, 0);
    }
    ctx.globalAlpha = 1;
    // 文字层
    // 浅色背景（墨流）时文字转为墨色
    const light = win(t, 2.7, 5.8, 0.6, 0.6);
    const tc = KIT.mixHex('#fffaf0', '#1c1714', light);
    const ta = win(t, 1.4, 7.6, 0.1, 0.5);
    if (ta > 0) {
      ctx.save();
      ctx.shadowColor = `rgba(0,0,0,${0.6 * (1 - light)})`; ctx.shadowBlur = 30;
      KIT.revealTitle(ctx, '{{TITLE}}', W / 2, H * 0.52, t, 1.5, { alpha: ta, color: tc, size: 96 * U });
      ctx.restore();
    }
    const names = [[0.3, 3.0, '极光 · fbm 噪声'], [3.1, 5.5, '墨流 · 域扭曲'], [5.6, 7.7, '液态金属 · 元球']];
    for (const [a, b, s] of names) {
      const al = win(t, a, b, 0.3, 0.3);
      if (al > 0) { KIT.spacing(ctx, 6); KIT.text(ctx, s, W / 2, H * 0.52 + 80 * U, KIT.font('sans', Math.round(26 * U), 400), rgba(tc, 0.8 * al), 'center'); KIT.spacing(ctx, 0); }
    }
    KIT.drawCaptions(ctx, TL.CAPS, t);
    const fade = Math.max(1 - prog(t, 0, 0.5), prog(t, TL.DURATION - 0.6, TL.DURATION));
    if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(0, 0, W, H); }
  }

  window.SCENE = { setup, drawFrame };
})();
