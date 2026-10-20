# film 命令参考

`film <命令> [参数]`。`film` 不在 PATH 时用 `node ~/.code-video/bin/film.js`。路径可相对可绝对；项目参数省略时默认当前目录。

## 环境

| 命令 | 说明 |
|---|---|
| `film doctor` | 体检：Node、ffmpeg、Chrome、各 JS 库、Python、manim、edge-tts、Blender、中文字体；列出九种技术栈是否可用、旁白引擎 |
| `film setup [--lite] [--tts] [--python] [--blender]` | 安装 JS 依赖（`--lite` 不装 Remotion/HyperFrames）；`--tts` 装 edge-tts；`--python` 装 manim+edge-tts；`--blender` 装 Blender。npm/pip 失败会自动换国内镜像重试 |
| `film demo [目录] [--quick] [--types a,b]` | 一键演示：每种可用技术栈各新建一个 8 秒项目并出片，拼成带连续配乐的合集 |
| `film version` | 版本号 |

## 新建与预览

| 命令 | 说明 |
|---|---|
| `film new <目录> --type <类型> --title 片名 [--size S]` | 类型：canvas shader three p5brush dom hyperframes remotion manim blender。尺寸：`1920x1080`（默认）、`9:16`、`1:1`、`4:3`、`3:4`、`4k` 或任意 `宽x高` |
| `film preview <项目> [--port 5178] [--no-open]` | 起本地服务并打开浏览器；空格播放/暂停，地址加 `#秒数` 跳转。只适用于浏览器类（canvas/shader/three/p5brush/dom） |
| `film serve [端口]` | 只起服务器，根目录为当前目录（或 `FILM_ROOT`），首页列出所有项目 |

## 检查

| 命令 | 说明 |
|---|---|
| `film lint <项目>` | 时间表检查：字幕结束早于开始（✗）、超出时长、停留 < 0.8 秒、每秒 > 7 字、单行过长（横屏 28 / 竖屏 16 字）、相邻重叠；旁白未合成/文本改过/超时/重叠；音效越界；配乐比时间表旧；film.json 与 timeline.js 尺寸/时长不一致 |
| `film stills <项目> <时刻> [--batch 名] [--cols 2]` | 导出静帧 PNG + 联系表到 `out/stills/bN/`（自动递增，不覆盖）。时刻：`"3,12.5,40"` 或 `auto:12` |
| `film sheet <项目或mp4> <时刻> [--cols 3]` | 只出联系表。外部渲染器类型的项目会自动对最新成片抽帧 |

## 旁白与字幕

| 命令 | 说明 |
|---|---|
| `film tts <项目> [--voice 名] [--rate +10%] [--engine edge\|sapi\|say] [--force]` | 合成 `TL.VO` 里的每句旁白 → `out/vo/<id>.wav`（去首尾静音，48k）；时长和分句写入 `src/vo.js`。文本/音色没变的句子会复用缓存，`--force` 全部重做 |
| `film srt <项目> [--embed <项目或mp4>]` | 从 `TL.CAPS` 导出 SRT（UTF-8 BOM）；`--embed` 生成带软字幕轨的 `_字幕.mp4` |

常用音色：`zh-CN-XiaoxiaoNeural`（女，温暖，默认）、`zh-CN-YunxiNeural`（男，清朗）、`zh-CN-YunjianNeural`（男，浑厚，适合纪录片）、`zh-CN-XiaoyiNeural`（女，活泼）、`zh-CN-YunyangNeural`（男，新闻播报）、`en-US-AriaNeural`（英文）。

## 出片

| 命令 | 说明 |
|---|---|
| `film video <项目> [--from 秒 --to 秒] [--crf 16] [--samples N]` | 按 `film.json` 的 type 选渲染器出母版并混入 `out/soundtrack.wav`。`--from/--to` 只渲染片段（浏览器类）；`--samples` 为 Blender 采样数 |
| `film all <项目>` | lint（有 ✗ 则停）→ `node audio.js` → video → share → verify → poster |
| `film mux <视频> <wav> [--out 文件]` | 换/加音轨，统一编码 |
| `film bgm <视频> <音乐> [--gain -14] [--duck] [--out 文件]` | 叠加外部音乐：循环/裁剪到视频长度、淡入淡出；`--duck` 在原有声音（旁白）处自动压低音乐；最后响度标准化到 −15 LUFS |
| `film concat <a.mp4> <b.mp4> … --out 文件 [--xfade 0.6] [--size S]` | 交叉淡化拼接；尺寸以第一段为准（或 `--size`），帧率/音轨自动统一，无音轨的段补静音；`--xfade 0` 硬切 |

## 交付

| 命令 | 说明 |
|---|---|
| `film share <mp4或项目> [--crf 23]` | 分享版 `_分享版.mp4`，约母版 1/10 |
| `film verify <mp4或项目> [--duration 秒]` | 全量解码校验：H.264 yuv420p、帧数与时长、AAC 48k 立体声、响度 −20~−12 LUFS、真峰值 ≤ −0.5 dBTP、中段无 >1 秒全黑 → `out/<名>.verification.json`；不通过则退出码 1 |
| `film poster <mp4或项目> [--t 秒]` | 封面：原图 + 3:4 + 1:1（默认取 35% 处） |
| `film gif <mp4或项目> [--from 0 --to 6 --width 720 --fps 15]` | 预览动图（颗粒噪点多的画面 GIF 会偏大，可减小 width/fps） |

## 环境变量

`CHROME_PATH`、`BLENDER_PATH`、`PYTHON`（解释器命令）、`FILM_ROOT`（预览根目录）、`CODE_VIDEO_HOME`（运行时目录，安装器写入）。

## 输出文件命名

`<片名>_1080p30.mp4`（16:9 1080p）或 `<片名>_<宽>x<高>p30.mp4`；`_分享版.mp4`；`_封面*.jpg`；`_预览.gif`；`<片名>.srt`；`out/stills/bN/`；`out/vo/`；`out/soundtrack.wav`；`out/render-log.json`。
