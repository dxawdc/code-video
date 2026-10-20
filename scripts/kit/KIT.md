# kit：film 运行时

code-video 技能的运行时：`film` 命令行 + 九种技术栈模板 + 动画/着色器/音频库 + Python 工具。安装器会把它装到 `~/.code-video/`（或环境变量 `CODE_VIDEO_HOME` 指定的位置）。

## 目录

| 路径 | 内容 |
|---|---|
| `bin/film.js` | 命令行（`film help` 看全部命令） |
| `lib/canvas-kit.js` | 浏览器动画工具（全局 `KIT`）：缓动、关键帧、文字、字幕、浮尘、颗粒暗角、播放器/舞台挂载 |
| `lib/gl-kit.js` | WebGL2 全屏着色器（全局 `GLK`）：公共 GLSL 库 + 极光/墨流/液态金属 |
| `lib/synth.js` | Node 音频合成：声部、20 种音效、混响、旁白放置与闪避、磁带停、响度校正写 WAV |
| `lib/player.css` | 预览播放器与渲染布局（任意画幅） |
| `templates/_common` | 所有类型共用：film.json、timeline.js、vo.js、audio.js、STORYBOARD.md、README.md |
| `templates/<类型>` | canvas shader three p5brush dom hyperframes remotion manim blender |
| `py/vkit.py` | Python/PIL 路线工具 |

## 渲染约定

- 浏览器类（canvas/shader/three/p5brush/dom）：页面经内置 HTTP 服务加载；`/__kit/` → 本目录，`/__lib/` → JS 依赖，`/__proj/` → 根目录外的项目。
  - Canvas 类：`KIT.mountPlayer({ canvas, draw(ctx,t), setup, fps, duration, fonts })`
  - DOM 类：`KIT.mountStage({ stage, seek(t), setup, fps, duration, fonts })`
- 外部渲染器：hyperframes（`hyperframes render`）、remotion（`remotion render`，用本机 Chrome）、manim（`manim render`）、blender（`blender -b -P scene.py`），产物统一重编码并混入 `out/soundtrack.wav`。

## 依赖解析

JS 依赖按包在 `kit/node_modules` 与上一级 `node_modules` 里查找（独立安装与工作区共用两种布局都支持）。`film setup` 安装到 `kit/node_modules`。
