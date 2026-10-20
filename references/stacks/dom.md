# dom：HTML / CSS / SVG + GSAP + Lottie

适合：动态排版（kinetic typography）、数据图表、UI/产品界面动效、玻璃拟态卡片、Lottie 动画素材、需要 CSS 能力（滤镜、混合模式、backdrop-filter）的画面。渲染方式是对 1920×1080（或 film.json 尺寸）的舞台逐帧截图。

## 结构

```html
<div id="stage"> …所有画面元素… <div id="cap"></div> </div>
<script src="/__lib/gsap/dist/gsap.min.js"></script>
<script src="/__lib/lottie-web/build/player/lottie.min.js"></script>
<script src="/__kit/lib/canvas-kit.js"></script>
```

```js
const tl = gsap.timeline({ paused: true });   // 必须 paused
function setup() { /* 建 DOM、往 tl 上加动画、加载 Lottie；返回 Promise 等资源就绪 */ }
function seek(t) {                            // 渲染器每帧调用
  tl.seek(t, false);
  anim.goToAndStop(帧号, true);               // Lottie 按自己的帧号
  // 依赖插值结果的文字（计数器）在这里写 DOM
}
KIT.mountStage({ stage: document.querySelector('#stage'), seek, setup, fps: TL.FPS, duration: TL.DURATION, fonts: TL.FONTS });
```

## 确定性规则

- 所有动画都挂在 **一条暂停的 GSAP 时间线** 上（可嵌套子时间线，但子时间线不能 paused）。
- 禁止 CSS `animation` / `transition`、`setTimeout`、`setInterval`、`Math.random`（用 `KIT.rng`）。
- 数字滚动：tween 一个代理对象 `{v:0}`，在 `seek` 里读 `counter.v` 写进 DOM。
- 字幕：在 `seek` 里根据 `TL.CAPS` 写 `#cap` 的 innerHTML 和 opacity（`**x**` 换成 `<em>`）。

## GSAP 速查

```js
tl.from('#title span', { y: 120, opacity: 0, rotateX: -80, duration: .9, ease: 'expo.out', stagger: .08 }, 0.4)
  .to(line, { strokeDashoffset: 0, duration: 2.2, ease: 'power2.inOut' }, 2.3)     // SVG 描边
  .from('#dots circle', { scale: 0, transformOrigin: '50% 50%', ease: 'back.out(3)', stagger: .25 }, 2.4)
  .to(counter, { v: 128400, duration: 2.4, ease: 'power2.out' }, 2.3);
```

缓动：`expo.out`（进场）、`power2.in`（出场）、`power3.inOut`（移动）、`back.out(2)`（弹出）、`elastic.out(1,.4)`（俏皮）。

## SVG 套路

- 描边动画：`len = path.getTotalLength()`，`strokeDasharray = len`，tween `strokeDashoffset` 从 len 到 0。
- 面积图：描边后再淡入填充路径。
- viewBox 留边距（`-14 -14 668 328`），防止端点圆被裁掉。
- 形变（morph）：GSAP 的 MorphSVG 是付费插件；简单形变用两条点数相同的 path 手动插值 `d`。

## Lottie

```js
anim = lottie.loadAnimation({ container, renderer: 'svg', loop: false, autoplay: false, animationData: JSON数据 });
// 或 path: 'assets/xxx.json'（放项目目录）
anim.goToAndStop(帧号, true);   // true = 按帧号
```

可以用 AE/LottieFiles 导出的 JSON，也可以像模板里那样用代码生成（形状层 + 关键帧）。

## CSS 能力

`backdrop-filter: blur()`（玻璃拟态）、`mix-blend-mode`、`filter: blur/drop-shadow`、渐变、`clip-path`（揭示动画）、3D `transform` + `perspective`。都能被截图正确捕获。

## 布局

用百分比和 flex（模板的 `.row` 会在竖屏自动换行堆叠）；舞台尺寸在 `src/style.css` 的 `#stage` 上。
