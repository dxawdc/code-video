# hyperframes：HeyGen HyperFrames

适合：想用 HyperFrames 的生态（它的技能、积木 registry、Studio 预览、发布）时；本质是 HTML + `data-*` 时间属性 + GSAP。出片用它自带的多进程渲染器，速度快（240 帧约 20 秒）。

## 格式

```html
<div id="root" data-composition-id="main" data-start="0" data-duration="8" data-width="1920" data-height="1080">
  <div class="clip bg" data-start="0" data-duration="8" data-track-index="0"></div>
  <div id="s1" class="clip" data-start="0.3" data-duration="2.4" data-track-index="1"> … </div>
</div>
<script>
  window.__timelines = window.__timelines || {};
  const tl = gsap.timeline({ paused: true });      // 根时间线必须 paused
  tl.fromTo('#s1 .word', { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: .7, ease: 'expo.out' }, 0.3);
  window.__timelines['main'] = tl;                 // 按 composition-id 注册
  tl.seek(0);
</script>
```

规则（来自 HyperFrames 官方说明）：
1. 每个计时元素要有 `data-start` 和时长（`data-duration`），并加 `class="clip"`。
2. 每个 composition 注册一条**暂停**的根时间线到 `window.__timelines`；加进根时间线的子时间线**不能**暂停。
3. 子 composition 用 `data-composition-src="compositions/x.html"` 引用。
4. 只写确定性逻辑：不用 `Date.now()`、`Math.random()`、网络请求。
5. 带声音的视频保留在 `<video>` 上；音乐/旁白用单独 `<audio>`（我们的流程里配乐由 `audio.js` 生成后再混入，可以不用 `<audio>`）。

## 命令

- 出片：`film video <项目>`（内部调用 `hyperframes render --quality looks`，再统一编码并混入 `out/soundtrack.wav`）。
- 它自己的工具（可选）：在项目目录 `npx hyperframes preview --background`（Studio 预览）、`npx hyperframes check`（lint+布局+对比度检查）、`npx hyperframes docs <topic>`。

## 注意

- 模板里 GSAP 走 CDN（它的渲染器只服务项目目录），渲染时需要联网；离线时把 `gsap.min.js` 复制到项目里改成相对路径。
- 它有匿名遥测，`film` 调用时已设 `DO_NOT_TRACK=1`、`HYPERFRAMES_SKIP_SKILLS=1`。
- 需要 Node ≥ 22。
- 预览不走 `film preview`（那是给 canvas/dom 的），用它的 Studio 或直接 `film video` 出草稿 + `film sheet`。
