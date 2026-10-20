// 画面：drawFrame(ctx, t) 必须是 t 的纯函数——任意一帧都能单独画出来。
// 坐标尽量写成 W/H 的比例，这样换成竖屏（--size 1080x1920）也不会跑出画面。
(function () {
  const { clamp, prog, E, win, pulse, kf, rgba } = KIT;
  const W = TL.W, H = TL.H, U = Math.min(W, H) / 1080; // U：随画幅缩放的单位
  const C = { cream: '#f1ebdf', clay: '#d97757', amber: '#f2b36b', ink: '#0c0b0a' };
  const DUST = KIT.makeDust(170, 7, W, H);

  function background(ctx, wt) {
    const g = ctx.createRadialGradient(W / 2, H * 0.39, 0, W / 2, H * 0.39, Math.max(W, H) * 0.7);
    g.addColorStop(0, '#1e1b18'); g.addColorStop(0.55, '#121110'); g.addColorStop(1, '#080707');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    KIT.drawDust(ctx, DUST, wt, { W, H });
  }

  // 示例：一颗会呼吸的光点 + 逐字浮现的标题
  function hero(ctx, t) {
    const cx = W / 2, cy = H * 0.37;
    const r = kf([[0.8, 0], [1.6, 60 * U], [7.6, 60 * U], [8, 0]], t, E.outBack);
    if (r > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const R = r * (1 + 0.05 * Math.sin(t * 2) + 0.4 * pulse(t, 1.0, 0.2));
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 4);
      g.addColorStop(0, rgba('#fff4e2', 0.9)); g.addColorStop(0.15, rgba(C.clay, 0.45)); g.addColorStop(1, rgba(C.clay, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 4, 0, 6.283); ctx.fill();
      ctx.restore();
    }
    const a = win(t, 1.6, 7.8, 0.1, 0.5);
    if (a > 0) {
      const size = Math.min(96 * U, (W * 0.8) / Math.max(4, [...'{{TITLE}}'].length * 1.15));
      KIT.revealTitle(ctx, '{{TITLE}}', W / 2, H * 0.59, t, 1.7, { alpha: a, size });
      const lu = E.out3(prog(t, 2.4, 3.2));
      ctx.fillStyle = rgba(C.clay, 0.8 * a * lu);
      ctx.fillRect(W / 2 - 130 * U * lu, H * 0.59 + 40 * U, 260 * U * lu, 2 * U);
    }
  }

  function drawFrame(ctx, t) {
    t = clamp(t, 0, TL.DURATION - 1e-4);
    const wt = t; // 世界时间：想让画面“冻结”，在这里停住它
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    KIT.spacing(ctx, 0);
    background(ctx, wt);
    hero(ctx, t);
    KIT.drawCaptions(ctx, TL.CAPS, t);
    KIT.drawGrainVignette(ctx, t, { fps: TL.FPS });
    const fade = Math.max(1 - prog(t, 0, 0.6), prog(t, TL.DURATION - 0.7, TL.DURATION));
    if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(0, 0, W, H); }
  }

  window.SCENE = { drawFrame };
})();
