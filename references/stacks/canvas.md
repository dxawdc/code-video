# canvas：Canvas 2D（默认）

适合：科普讲解、流程/架构示意、文字排版、粒子光效、界面模拟。最灵活、最稳，渲染约 0.13 秒/帧。

## 项目结构

```
index.html        加载 /__kit/lib/canvas-kit.js、src/vo.js、src/timeline.js、src/scene.js，调用 KIT.mountPlayer
src/timeline.js   时长/尺寸/字幕/旁白/音效
src/scene.js      window.SCENE = { drawFrame(ctx, t), setup? }
audio.js          配乐
film.json         { type: "canvas", width, height, fps, duration }
```

复杂片子拆分：`src/draw.js`（图元：核心、卡片、终端、按钮…）+ `src/scenes/*.js`（每幕一个函数）+ `src/scene.js`（合成）。在 index.html 里按顺序加 `<script>`。

## drawFrame 的标准骨架

```js
function drawFrame(ctx, t) {
  const wt = worldT(t);                       // 世界时间（需要冻结时停住它）
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  background(ctx, wt);                        // 1 背景 + 浮尘
  ctx.save(); camera(ctx, t);                 // 2 世界层（镜头呼吸/推镜）
  sceneA(ctx, t); sceneB(ctx, t);             //   各幕：自己判断时间窗，不在窗内直接 return
  ctx.restore();
  post(ctx, t);                               // 3 后期：去饱和、故障
  ui(ctx, t);                                 // 4 界面层（不受镜头影响）
  chapterCard(ctx, t);                        // 5 章节卡
  KIT.drawCaptions(ctx, TL.CAPS, t);          // 6 字幕
  KIT.drawGrainVignette(ctx, t, { fps: TL.FPS }); // 7 颗粒暗角
  fadeInOut(ctx, t);                          // 8 首尾淡入淡出
}
```

## KIT 速查（`/__kit/lib/canvas-kit.js`）

| 函数 | 用途 |
|---|---|
| `prog(t,a,b)` | t 在 [a,b] 的进度 0..1 |
| `win(t,a,b,fi,fo)` | 在 [a,b] 可见，fi/fo 秒淡入淡出，返回 alpha |
| `kf([[t,值或数组],…], t, ease)` | 关键帧插值（位置、尺寸、颜色分量） |
| `pulse(t,t0,d)` | 事件触发的指数衰减脉冲（闪光、推镜、震屏） |
| `E.out3 / out5 / inOut3 / inOutSine / outBack / smoother / in2` | 缓动 |
| `rng(seed)` | 可复现随机数 |
| `rgba(hex,a)` / `mixHex(a,b,u)` | 颜色 |
| `bez(a,c,b,u)` | 二次贝塞尔（飞行轨迹） |
| `font('serif'\|'sans'\|'mono', size, weight)` | 字体串 |
| `text / measure / rrect / wrapChars` | 绘制辅助（wrapChars 中文按字折行） |
| `drawRich(ctx, '普通**强调**', cx, y, {size, color, em, alpha})` | 富文本居中 |
| `revealTitle(ctx, s, cx, y, t, t0, {size, stagger, track, fam})` | 逐字浮现标题 |
| `drawCaptions(ctx, caps, t, {color, shadow, band, size, y})` | 字幕（自动缩字/折行，竖屏自动上移放大） |
| `makeDust(n, seed, W, H)` / `drawDust(ctx, dust, wt, {W,H})` | 浮尘 |
| `drawGrainVignette(ctx, t, {grain, vignette})` | 颗粒 + 暗角 |
| `desaturate(ctx, amount)` / `glitch(ctx, k, seed)` | 去饱和 / 故障切片 |
| `mountPlayer({canvas, draw, setup, fps, duration, fonts})` | 预览播放器 + 渲染约定 |

## 常用套路

**光晕/发光**
```js
ctx.save(); ctx.globalCompositeOperation = 'lighter';
const g = ctx.createRadialGradient(x, y, 0, x, y, R * 4);
g.addColorStop(0, rgba('#fff4e2', .9)); g.addColorStop(.2, rgba(CLAY, .35)); g.addColorStop(1, rgba(CLAY, 0));
ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R * 4, 0, 6.283); ctx.fill(); ctx.restore();
```

**沿弧线飞行（带拖尾）**：控制点 = 中点 + 垂直偏移；拖尾画 6 个递减透明度的点，取 `u - k*0.035`。

**打字机**：`n = Math.floor(prog(t, t0, t1) * text.length)`；光标 `Math.floor(t*2)%2`。

**伪 3D 粒子球**：斐波那契球面点 → 绕 Y/X 旋转 → 按 z 调大小和透明度，再叠一层放射状光芒，就是一个会呼吸的能量核心（点 i：y = 1 − 2i/(n−1)，绕 Y 轴角度 i·2.39996）。

**冻结世界**：`worldT(t)` 在冻结区间返回常数，浮尘、自转都用 wt；再叠 `desaturate`。

**镜头**：`ctx.translate(cx,cy); ctx.scale(s,s); ctx.translate(-cx,-cy)`，s = 1 + 0.008·sin(wt·0.2) + 0.02·pulse(t, 关键时刻, 0.2)。

**章节卡**：整屏暗色 0.95 + 图标描边动画 + 编号（mono, 字距 12）+ 标题逐字 + 副标题。

## 注意

- 文字坐标用比例（`W/2`、`H*0.59`），字号乘 `U = min(W,H)/1080`。
- `ctx.letterSpacing` 用完要复位（`KIT.spacing(ctx, 0)`）。
- 避免 ⠋ ⏸ ⚡ 等字符（缺字或彩色 emoji）；需要图标就用路径画。
- shadowBlur 很贵，只给少量元素用。
