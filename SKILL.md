---
name: code-video
description: 用代码制作视频/动画短片的完整工作流与 film 命令行工具。九种技术栈：Canvas、GLSL 着色器、Three.js、p5.brush 手绘水彩、HTML/CSS/SVG/GSAP/Lottie、HyperFrames、Remotion、Manim、Blender；覆盖分镜、时间表、代码合成配乐与音效、AI 旁白与自动字幕、横屏/竖屏/方形、实时预览、抽帧检查、渲染、编码与响度校验、封面/GIF/SRT/分享版交付。当用户要做视频、短片、动画、MV、科普片、宣传片、数据可视化视频、竖屏短视频，要“用代码/技术实现”画面，或提到 Remotion、Manim、Three.js、着色器、p5.js、GSAP、Lottie、HyperFrames、Blender 出片时使用。
---

# code-video：用代码做视频

画面、配乐、音效全部由代码生成；`film` 命令行负责新建、预览、旁白、检查、渲染、校验与交付。你（AI）负责创意、分镜、写代码和逐帧审片。

## 0. 先确认工具（每次开工第一步）

```bash
film doctor
```

- 找不到 `film`：用 `node ~/.code-video/bin/film.js doctor`（Windows：`node "%USERPROFILE%\.code-video\bin\film.js" doctor`；装在别处时看环境变量 `CODE_VIDEO_HOME`）。下文的 `film` 都可以这样替换。
- 运行时不存在：用本技能目录里的安装器——Windows `powershell -ExecutionPolicy Bypass -File <本技能目录>/install.ps1`，macOS/Linux `bash <本技能目录>/install.sh`。装完再 `film doctor`。
- `doctor` 会列出**哪些技术栈可用**。只从可用的里选；缺的可以 `film setup --python`（Manim+edge-tts）、`film setup --blender`。
- 沙箱环境（如 Codex）需要允许运行 Chrome、ffmpeg 并写项目目录；旁白（edge-tts）和 HyperFrames 的 GSAP CDN 需要联网。详见 `references/platforms.md`。

## 1. 定需求：能用默认值就别问

默认：16:9 1920×1080、30fps、30 秒~2 分钟、中文字幕、无旁白、深色暖调。
只有会改变整体结构的事才问用户（**最多一次、合并成一个问题**）：横屏还是竖屏、要不要旁白、时长、有没有必须出现的素材/品牌元素。

开工前写下：一句话主旨、目标观众、看完要记住的 1~3 件事。科普类先把**事实讲对**（不确定的不要编），再谈好看。

## 2. 选技术栈（按想要的效果选）

| 想要的效果 | `--type` | 细节 |
|---|---|---|
| 科普讲解、流程示意、文字排版、粒子光效（默认） | `canvas` | `references/stacks/canvas.md` |
| 极光/墨流/液态金属等质感背景、炫酷转场 | `shader` | `references/stacks/shader.md` |
| 3D 物体、粒子群、产品感运镜、辉光 | `three` | `references/stacks/three.md` |
| 手绘、水彩、铅笔、绘本、歌词 MV | `p5brush` | `references/stacks/p5brush.md` |
| 动态排版、数据图表、UI 动效、Lottie 素材 | `dom` | `references/stacks/dom.md` |
| 复用 HyperFrames 生态 | `hyperframes` | `references/stacks/hyperframes.md` |
| 组件化、批量/模板化、数据驱动 | `remotion` | `references/stacks/remotion.md` |
| 数学推导、函数图像、算法过程 | `manim` | `references/stacks/manim.md` |
| 真实感材质灯光、景深、产品级 3D | `blender` | `references/stacks/blender.md` |

一部片可以**混用**：不同段落用不同技术栈各自出片，再 `film concat` 交叉拼接、`film mux` 换成一条连续配乐。同一画面叠层：canvas 类里着色器、Three.js、p5 都是“先画离屏画布再 drawImage 合成”。

## 3. 新建项目

```bash
film new <目录> --type <类型> --title "片名" [--size 9:16|1:1|4:3|1920x1080]
```

生成：`film.json`（类型/尺寸/时长）、`src/timeline.js`（时间表）、画面文件、`audio.js`（配乐）、`STORYBOARD.md`、`README.md`。模板本身就是一个能直接出片的 8 秒示例，先读懂再改。

## 4. 分镜（STORYBOARD.md）

- 定 1~3 个贯穿全片的**视觉母题**，每一幕让母题发生变化来推进叙事，不要每幕换一套新图形。
- 结构模板、节奏比例、字幕写法见 `references/story.md`。
- 分镜表：时间 | 场景 | 画面 | 字幕/旁白 | 声音。

## 5. 时间表优先（src/timeline.js）

所有时刻集中在这一个文件，画面、配乐、旁白、字幕都读它：`DURATION`、`CAPS`（字幕）、`VO`（旁白）、`SFX`（音效）、各动作的阶段时刻。派生时刻用代码算，不要在画面里散写魔法数字。改了时长要同步 `film.json` 的 `duration`。

## 6. 画面

- **硬规则：每一帧都是时间 t 的纯函数**（`drawFrame(ctx,t)` / `seek(t)` / Remotion `useCurrentFrame()` / Manim 动画时长 / Blender `update(t)`）。可任意跳帧；随机数必须有种子；禁止 Clock、Date.now、setTimeout、CSS animation/transition、Math.random。
- 坐标写成 W/H 的比例，换画幅不会跑出画面。
- 审美基线、配色、字号、动效时长、构图与转场见 `references/design.md`。各技术栈的 API、套路和坑见 `references/stacks/<类型>.md`。

## 7. 声音

- `audio.js` 用 `synth.js` 合成配乐（pad/拨弦/低音/鼓，按幕给强度曲线）+ 音效（SFX 事件），默认自动校正到 −15 LUFS。
- 旁白：在 `TL.VO` 写 `{ id, t, text }` → `film tts <项目>`（edge-tts，离线退回系统语音）→ 时长写入 `src/vo.js`，字幕按句自动生成，配乐在说话时自动压低。
- 已有音乐文件：`film bgm <成片> <音乐> --duck`。
- 声音设计方法见 `references/audio.md`。

## 8. 检查循环（最重要，不可跳过）

1. `film lint <项目>`：字幕读速/重叠/越界、旁白重叠、配乐是否过期、尺寸时长一致。
2. `film preview <项目>`：浏览器实时预览看动势（canvas/shader/three/p5brush/dom）。
3. `film stills <项目> auto:12` → **逐张打开 sheet 图片查看**（2×2，带时间戳）。外部渲染器类型（hyperframes/remotion/manim/blender）先 `film video` 出草稿再 `film sheet <mp4> auto:12`。
4. 按 `references/qa.md` 的清单找问题：文字重叠/越界/缺字方块、对比度、落点没对齐、字幕与画面不同步、空洞或拥挤。
5. 改代码 → 针对问题时刻 `film stills <项目> "12.5,30.2"` 复查，直到干净。

## 9. 出片与交付

```bash
film all <项目>
```

= lint → `node audio.js` → 渲染母版（crf16）→ 分享版（crf23，约 1/10）→ 校验（编码/解码/帧数/响度/真峰值/全黑）→ 三种封面。长片放后台跑。
然后对**成片**再抽一次帧：`film sheet <母版mp4> auto:9 --cols 3`。按需：`film srt <项目> --embed <项目>`（软字幕）、`film gif <项目>`（预览动图）。

## 10. 汇报给用户

- 发分享版文件；说明母版路径、时长、体积、校验结果。
- 如实说明：画面已逐段抽帧检查；声音只测了响度，**你听不到声音，未经人耳试听**。
- 告诉用户改字幕/节奏改 `src/timeline.js`、改画面改哪个文件、改配乐改 `audio.js`，以及重新出片的命令。

## 常见坑速查

完整列表见 `references/troubleshooting.md`。最高频的：浅色背景字幕要换深色；1/r² 场的着色器在中心是奇点；Three.js 辉光太强会糊字；p5.brush 必须 p5 2.x + WEBGL 并调 `scaleBrushes`；GSAP 时间线必须 paused + `seek`；Manim 没有 LaTeX 时只用 `Text`；Canvas 里别用 ⠋⏸⚡ 等易缺字符号；第 0 帧通常全黑，封面别取 0 秒。

## 参考文件索引

- `references/workflow.md`：完整工作流、每步产出与验收标准
- `references/cli.md`：film 全部命令与参数
- `references/story.md`：叙事结构、分镜、字幕与旁白写法
- `references/design.md`：配色、字体、构图、动效、转场、画幅
- `references/audio.md`：配乐、音效、旁白、闪避、外部音乐、响度
- `references/qa.md`：审片与交付检查清单
- `references/stacks/*.md`：九种技术栈 + Python/PIL 路线
- `references/troubleshooting.md`：报错与坑
- `references/platforms.md`：Claude Code / Codex / WorkBuddy 等工具里的用法
