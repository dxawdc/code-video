// p5.js + p5.brush 手绘层（WEBGL 离屏）+ 文字层（Canvas 2D）。
// “一拍三”：每秒只画 HOLD_FPS 张不同的画，同一格内复用，线条逐格轻微抖动（boil），有手绘动画的呼吸感。
(function () {
  const { prog, E, win, rgba, lerp } = KIT;
  const W = TL.W, H = TL.H, HOLD_FPS = 10, U = Math.min(W, H) / 1080;
  // 画面在 1920×1080 的设计坐标里绘制，输出别的画幅时等比放大并居中裁切（cover）
  const DW = 1920, DH = 1080, K = Math.max(W / DW, H / DH);
  const PAPER = '#f2ead9', INK = '#2b2622', CLAY = '#d97757', SAGE = '#7fa48a', SKY = '#86a9cf', SUN = '#f0b35e';
  let P = null, T = 0, lastQ = -1, layer = null;

  function setup() {
    return new Promise((resolve) => {
      new p5((p) => {
        brush.instance(p);
        p.setup = () => {
          p.createCanvas(W, H, p.WEBGL);
          p.pixelDensity(1);
          p.noLoop();
          brush.scaleBrushes(4.5);
          P = p;
          resolve();
        };
        p.draw = () => paint(p, T);
      }, document.getElementById('p5host'));
    });
  }

  // 从 a 到 b 逐笔画出的线：u 0..1
  function drawOn(x1, y1, x2, y2, u) {
    if (u <= 0) return;
    brush.line(x1, y1, lerp(x1, x2, u), lerp(y1, y2, u));
  }

  function paint(p, t) {
    const q = Math.floor(t * HOLD_FPS);
    p.randomSeed(1000 + q); p.noiseSeed(7);
    p.background(PAPER);
    p.push();
    p.translate(-W / 2, -H / 2);
    p.translate((W - DW * K) / 2, (H - DH * K) / 2);
    p.scale(K);
    brush.wiggle(1.2);

    // 太阳：水彩晕染
    const sun = E.out3(prog(t, 0.3, 1.6));
    if (sun > 0) {
      brush.noStroke();
      brush.fill(SUN, 150); brush.fillBleed(0.25, 'out'); brush.fillTexture(0.6, 0.5);
      brush.circle(1420, 300, 150 * sun);
      brush.noFill();
    }
    // 远山、近山：水彩块面
    const hill = E.out3(prog(t, 0.8, 2.4));
    if (hill > 0) {
      brush.noStroke();
      brush.fill(SKY, 110); brush.fillBleed(0.18, 'out');
      brush.polygon([[0, 760], [380, 560 + 200 * (1 - hill)], [760, 700], [1180, 520 + 240 * (1 - hill)], [1620, 690], [1920, 600], [1920, 1080], [0, 1080]]);
      brush.fill(SAGE, 140); brush.fillBleed(0.22, 'out');
      brush.polygon([[0, 900], [520, 760 + 160 * (1 - hill)], [980, 860], [1500, 780 + 160 * (1 - hill)], [1920, 880], [1920, 1080], [0, 1080]]);
      brush.noFill();
    }
    // 小屋：铅笔勾线 + 排线
    const hu = prog(t, 2.0, 4.0);
    if (hu > 0) {
      const x = 520, y = 640, w = 260, h = 170;
      // 先用纸色把墙面“涂白”，再勾线
      brush.noStroke(); brush.wash(PAPER, 255 * prog(hu, 0, 0.3));
      brush.polygon([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
      brush.noWash();
      brush.set('HB', INK, 1.4);
      drawOn(x, y, x + w, y, prog(hu, 0, 0.2));
      drawOn(x + w, y, x + w, y + h, prog(hu, 0.15, 0.35));
      drawOn(x + w, y + h, x, y + h, prog(hu, 0.3, 0.5));
      drawOn(x, y + h, x, y, prog(hu, 0.45, 0.65));
      drawOn(x - 30, y, x + w / 2, y - 130, prog(hu, 0.6, 0.8));
      drawOn(x + w / 2, y - 130, x + w + 30, y, prog(hu, 0.7, 0.9));
      if (hu > 0.85) {
        brush.noStroke();
        brush.set('rotring', CLAY, 1); brush.hatch(9, 40); brush.fill(CLAY, 70);
        brush.polygon([[x - 30, y], [x + w / 2, y - 130], [x + w + 30, y]]);
        brush.noHatch(); brush.noFill();
        brush.set('2B', INK, 1.2);
        brush.rect(x + 100, y + 70, 60, 100);
      }
    }
    // 飞鸟：沿弧线移动的两笔
    const bu = prog(t, 3.5, 7.8);
    if (bu > 0) {
      brush.set('pen', INK, 1.1);
      for (let k = 0; k < 3; k++) {
        const bx = lerp(-100, 2000, bu) - k * 140, by = 260 + k * 50 + 30 * Math.sin(bu * 9 + k);
        const flap = 18 * Math.sin(t * 9 + k * 2);
        brush.spline([[bx - 34, by - flap], [bx - 14, by - 6], [bx, by]], 0.6);
        brush.spline([[bx, by], [bx + 14, by - 6], [bx + 34, by - flap]], 0.6);
      }
    }
    // 云：几团水彩，缓慢漂移
    const cu = E.out3(prog(t, 1.5, 3.0));
    if (cu > 0) {
      brush.noStroke();
      brush.fill('#ffffff', 170 * cu); brush.fillBleed(0.3, 'out');
      const dx = 30 * t;
      for (const [x, y, r] of [[300, 250, 60], [370, 230, 80], [450, 255, 55], [980, 180, 45], [1040, 165, 60]]) brush.circle(x + dx, y, r);
      brush.noFill();
    }
    p.pop();
  }

  async function drawFrame(ctx, t) {
    const q = Math.floor(t * HOLD_FPS);
    if (q !== lastQ) {
      T = q / HOLD_FPS;
      await P.redraw();
      lastQ = q;
      if (!layer) { layer = document.createElement('canvas'); layer.width = W; layer.height = H; }
      layer.getContext('2d').drawImage(P.canvas, 0, 0);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(layer, 0, 0);
    // 手写标题
    const ta = win(t, 4.2, 7.7, 0.1, 0.5);
    if (ta > 0) KIT.revealTitle(ctx, '{{TITLE}}', H > W ? W / 2 : W * 0.7, H > W ? H * 0.2 : H * 0.555, t, 4.3, { alpha: ta, fam: '"STXingkai", "KaiTi", "STKaiti", serif', weight: 400, size: 110 * U, color: INK, stagger: 0.18, track: 12 });
    KIT.drawCaptions(ctx, TL.CAPS, t, { band: false, em: CLAY, color: INK, shadow: false });
    const fade = Math.max(1 - prog(t, 0, 0.4), prog(t, TL.DURATION - 0.6, TL.DURATION));
    if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(0, 0, W, H); }
  }

  window.SCENE = { setup, drawFrame };
})();
