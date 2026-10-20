# remotion：Remotion（React + TypeScript）

适合：组件化的视频（同一套组件换数据批量出片）、数据驱动（JSON → 视频）、团队已有 React 习惯、需要 Remotion 生态（`@remotion/*` 包：转场、Lottie、three、字幕等）。

## 结构

```
src/index.ts      registerRoot(Root)
src/Root.tsx      <Composition id="Main" component={Main} durationInFrames fps width height />
src/Main.tsx      画面组件
src/timeline.js   与 audio.js 共用（import TL from './timeline.js'）
tsconfig.json
```

依赖从共享运行时解析，项目里**不需要 npm install**。

## 核心 API

```tsx
import { AbsoluteFill, Sequence, Series, interpolate, spring, useCurrentFrame, useVideoConfig, Easing, Img, staticFile } from 'remotion';

const f = useCurrentFrame();                 // 当前帧（唯一的时间来源）
const { fps, width, height, durationInFrames } = useVideoConfig();
const s = spring({ frame: f - 10, fps, config: { damping: 12, mass: .6 } });   // 弹簧 0→1
const o = interpolate(f, [0, 15, 90, 105], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
<Sequence from={48} durationInFrames={120}><Scene2 /></Sequence>        // 子组件内 frame 从 0 重新计
<Series><Series.Sequence durationInFrames={90}><A/></Series.Sequence>…</Series>  // 顺序拼接
```

## 套路

- 逐字弹出：把标题拆成字，每个字 `spring({ frame: f - i*3 })`。
- 柱状图/条形图生长：高度 × spring；数值 `Math.round(v * s)`。
- 字幕：组件里读 `TL.CAPS` 按 `f / fps` 找当前条，用 interpolate 做淡入淡出。
- 图片/字体资源：放 `public/`，`staticFile('x.png')`。
- 批量出片：Root 里 `defaultProps`，或多个 Composition；也可以写脚本循环调用 `film video`。

## 布局与画幅

用百分比（`top: '40%'`、`left: '12%'`），`width/height` 来自 `TL.W/TL.H`，换画幅自动适配。

## 注意

- 不要用 `useState` + `useEffect` 计时器做动画；一切从 `useCurrentFrame()` 推导。
- 渲染用本机 Chrome（`--browser-executable`），不下载 Chrome Headless Shell。
- 有遥测，film 已设 `REMOTION_DISABLE_TELEMETRY=1`。
- Remotion 的商业使用有许可条款（公司规模超过一定人数需购买），给公司做片前提醒用户确认。
