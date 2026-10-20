# shader：GLSL 着色器 + Canvas 文字层

适合：极光、墨流/大理石、液态金属、噪声云、光束、抽象质感背景、着色器转场。在无头 Chrome 里有 GPU 加速，很快。

## 结构

```html
<script src="/__kit/lib/canvas-kit.js"></script>
<script src="/__kit/lib/gl-kit.js"></script>      <!-- 全局 GLK -->
```

```js
let G, P;
function setup() {                       // KIT.mountPlayer({ setup }) 会在渲染前调用
  G = GLK.create(W, H);                  // 离屏 WebGL2，preserveDrawingBuffer
  P = { aurora: G.program(GLK.LOOKS.aurora), mine: G.program(MY_FRAG) };
}
function drawFrame(ctx, t) {
  G.draw(P.aurora, { u_time: t, u_energy: 0.8 });  // 自动传 u_res
  ctx.drawImage(G.canvas, 0, 0);                    // 合成到 2D 主画布
  // …然后用 KIT 画文字、字幕
}
```

多个着色器交叉切换：依次 `G.draw` + `ctx.globalAlpha = 权重; ctx.drawImage(G.canvas,0,0)`（每次 draw 会覆盖 G.canvas，所以画一次合成一次）。

## 片元着色器写法

`GLK.LIB` 已自动拼在前面，直接写 `main`：

```glsl
uniform float u_energy;                 // 自定义 uniform
void main(){
  vec2 p = uvAspect();                  // 以中心为原点、按宽高比校正的坐标
  float n = fbm(p * 2.0 + u_time * 0.1);
  vec3 c = palette(n, vec3(.5), vec3(.5), vec3(1.), vec3(0., .15, .35));
  outColor = vec4(grain(vignette(c, .8), .04), 1.);
}
```

`GLK.LIB` 提供：`u_time u_res vUv`、`hash noise fbm`、`palette`（IQ 余弦调色板）、`rot`、`sdCircle sdBox`、`uvAspect`、`grain`、`vignette`、`PI`。
现成质感：`GLK.LOOKS.aurora`（极光）、`ink`（域扭曲墨流）、`metal`（元球液态金属）。

## 配方

| 效果 | 思路 |
|---|---|
| 云/烟 | fbm 叠加 + 时间平移；smoothstep 控边 |
| 大理石/墨流 | 域扭曲：`q = fbm(p)`、`r = fbm(p + 4q)`、`f = fbm(p + 4r)` |
| 极光 | 若干条随 fbm 摆动的中心线，向上指数拖尾，乘竖向细纹噪声 |
| 液态/元球 | Σ r²/d² 场 → **有界**高度 `sqrt(1 - k/v)` → 法线 → 环境反射 |
| 光束/体积光 | 角度方向的 1/距离衰减 + 噪声扰动 |
| 转场擦除 | `smoothstep(edge-0.02, edge, 某个场(p))` 混两张纹理（把上一幕画到纹理） |
| 网格/赛博 | `fract(p*N)` 取线 + 透视变换 `p.y = 1/(y+h)` |

## 坑

- 1/r² 类场在中心是奇点，直接求梯度会出现黑点/乱纹：用有界函数。
- 浅色着色器背景上，文字改深色（`KIT.mixHex` 按场景权重渐变）。
- `u_time` 要用 t 传入，不要在着色器里用系统时间。
- 编译错误会抛出带行号的信息（行号包含 LIB 的长度），在页面控制台看。
- 时间常数让动画慢一点（`u_time * 0.1`），着色器动得太快会显得廉价。
