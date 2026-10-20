# p5brush：p5.js + p5.brush 手绘

适合：手绘动画、水彩插画、铅笔/钢笔线稿、绘本风、歌词 MV、温暖人文题材。

## 结构

```html
<script src="/__lib/p5/lib/p5.min.js"></script>          <!-- p5 2.x -->
<script src="/__lib/p5.brush/dist/p5.brush.js"></script> <!-- 全局 brush -->
```

```js
function setup() {           // 返回 Promise，等 p5 初始化完
  return new Promise((resolve) => new p5((p) => {
    brush.instance(p);        // 实例模式必须先调
    p.setup = () => { p.createCanvas(W, H, p.WEBGL); p.pixelDensity(1); p.noLoop(); brush.scaleBrushes(4.5); P = p; resolve(); };
    p.draw = () => paint(p, T);
  }, host));
}
async function drawFrame(ctx, t) {
  const q = Math.floor(t * HOLD_FPS);       // 一拍三：每秒 10 张不同的画
  if (q !== lastQ) { T = q / HOLD_FPS; await P.redraw(); lastQ = q; layer.getContext('2d').drawImage(P.canvas, 0, 0); }
  ctx.drawImage(layer, 0, 0);               // 再叠文字/字幕
}
function paint(p, t) {
  p.randomSeed(1000 + Math.floor(t * HOLD_FPS)); p.noiseSeed(7);  // 帧号做种子 → 线条“呼吸”
  p.background('#f2ead9');
  p.push(); p.translate(-W / 2, -H / 2);    // WEBGL 原点在中心，移到左上
  // …画
  p.pop();
}
```

## brush 速查

| 函数 | 说明 |
|---|---|
| `brush.set(名, 颜色, 粗细)` | 选笔：`HB` `2B` `cpencil` `pen` `rotring` `spray` `marker` `marker2` `charcoal` `hatch_brush` |
| `brush.line(x1,y1,x2,y2)` / `spline(点组, 曲率)` / `circle` / `rect` / `polygon(点组)` / `arc` | 图元 |
| `brush.fill(颜色, 不透明度 0..255)` + `fillBleed(强度, 'out'\|'in')` + `fillTexture(纹理, 边缘)` | 水彩填充 |
| `brush.wash(颜色, 不透明度)` | 平涂（快，不晕染），也可用来“涂白”遮挡 |
| `brush.hatch(间距, 角度)` + `hatchStyle(笔, 色, 粗)` | 排线 |
| `brush.noStroke / noFill / noHatch / noWash` | 关闭状态 |
| `brush.field(名)` / `wiggle(强度)` | 向量场弯曲笔触（`hand` 手抖、`waves`、`seabed`…） |
| `brush.scaleBrushes(k)` | **必调**，否则笔触太细（1080p 约 4~5） |

## 动画手法

- **逐笔画出**：线段终点 `lerp(起点, 终点, u)`，u 由 `prog(t, a, b)` 控制，多条线错开。
- **一拍三抖动**：`HOLD_FPS = 10` + `randomSeed(帧号)`，水彩边缘和线条每 0.1 秒轻微变化，像手绘动画。想更稳就用 `HOLD_FPS = 6~8`；想完全静止就固定种子。
- **生长/晕开**：圆/多边形尺寸用 `E.out3(prog(...))` 放大。
- **遮挡**：先用 `wash(纸色)` 涂底再勾线（房子墙面挡住后面的山）。
- **手写标题**：用 2D 层画华文行楷/楷体（`fam: '"STXingkai","KaiTi","STKaiti",serif'`），配合 `revealTitle` 慢速逐字（stagger 0.18）。

## 画幅

模板在 1920×1080 设计坐标里画，换画幅时等比放大居中裁切（`K = max(W/1920, H/1080)`）。竖屏想重新构图就直接改坐标。

## 坑

- 必须 p5 2.x + WEBGL 画布；不能用 `createCanvas(W, H)` 的 2D 模式。
- 水彩填充较慢；一拍三能把渲染时间降到 1/3。
- 浅色纸面：字幕 `{ color: '#2b2622', shadow: false, band: false }`。
- `p.redraw()` 在 p5 2.x 是异步的，要 `await`。
