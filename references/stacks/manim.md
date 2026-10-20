# manim：Manim Community（Python）

适合：数学推导、函数图像、几何变换、算法/数据结构过程、物理示意——3Blue1Brown 风格。

## 结构

```
scene.py     class Main(Scene): def construct(self): …
film.json    { type: "manim", duration, width, height, fps }（scene 默认 Main，可写 "scene": "其他类名"）
audio.js     配乐（时长读 src/timeline.js，与 film.json 保持一致）
```

出片：`film video <项目>`（= `manim render -r 宽,高 --fps --disable_caching`，再统一编码并混音）。

## 核心 API

```python
self.play(Write(title), run_time=1.0)                 # 播放动画，时长即视频时长
self.play(title.animate.scale(.55).to_edge(UP))       # .animate 链式动画
self.wait(0.5)
axes = Axes(x_range=[0, 6.3, 1], y_range=[-1.3, 1.3, 1], x_length=6.2, y_length=3.4)
curve = axes.plot(lambda x: np.sin(x), color=AMBER)
t = ValueTracker(0); dot = always_redraw(lambda: Dot(axes.c2p(t.get_value(), np.sin(t.get_value()))))
self.play(t.animate.set_value(6.28), run_time=1.5, rate_func=smooth)
self.play(Transform(a, b)), ReplacementTransform, FadeIn(m, shift=UP*.2), GrowFromCenter, Create, Indicate, Circumscribe
VGroup(*items).arrange(DOWN, buff=.3)                 # 排版
```

文字：`Text('中文', font='Noto Sans SC', weight=BOLD)`；多色用 `MarkupText('<span foreground="#d97757">强调</span>…')`。

## 时长控制

视频时长 = 所有 `play` 的 run_time + `wait` 之和。模板在最后补齐：

```python
used = self.renderer.time
self.wait(max(0.01, DUR - 0.6 - used)); self.play(*[FadeOut(m) for m in self.mobjects], run_time=.6)
```

要和配乐、字幕对齐：在 `timeline.js` 里写好各段时刻，`scene.py` 里用 `self.wait(到下一时刻的差)` 对齐。

## 画幅

竖屏时模板设置 `config.frame_width = 8`、`frame_height = 8·H/W`，并把左右布局改成上下（`PORTRAIT` 分支）。

## 坑

- **没有 LaTeX 时不能用 `MathTex`/`Tex`**（会报错）。公式用 `Text('e^(iπ) + 1 = 0', font='Cascadia Code')` 或 Unicode 上下标；要正经公式先装 MiKTeX/TeX Live。
- `MarkupText` 的颜色写在 `<span foreground>` 里，`color=` 对整段不生效。
- 渲染出的原始视频在 `out/manim/videos/…/raw.mp4`；film 会自动找最新的那个。
- 中文字体名要和系统安装的一致（`fc-list` / Windows 字体设置里看）。
