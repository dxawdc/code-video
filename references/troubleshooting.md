# 报错与常见坑

## 环境

| 现象 | 原因 / 修法 |
|---|---|
| `film` 不是命令 | 安装器把 `~/.code-video/bin` 加进了 PATH，需要**新开终端**；或直接 `node ~/.code-video/bin/film.js` |
| `没找到 Chrome/Edge/Chromium` | 装 Chrome，或设置 `CHROME_PATH` 指向浏览器可执行文件 |
| `npm install 失败` | 网络问题：`film setup` 会自动换 npmmirror 重试；仍失败就 `npm config set registry https://registry.npmmirror.com` |
| `manim` / `edge_tts` 导入失败 | `film setup --python`；多个 Python 时用 `PYTHON` 环境变量指定 |
| HyperFrames 报 Node 版本 | 需要 Node ≥ 22 |
| 沙箱里 Chrome 启动失败 | 工具沙箱禁止启动浏览器进程：放开权限或让用户在本机终端运行（见 platforms.md） |
| Linux 下 Chrome 崩溃 | 已自动加 `--no-sandbox`；缺字体装 `fonts-noto-cjk` |

## 渲染

| 现象 | 原因 / 修法 |
|---|---|
| `页面未满足渲染约定` | index.html 没调用 `KIT.mountPlayer`/`KIT.mountStage`，或脚本报错导致没执行到；`film preview` 打开看控制台 |
| 页面错误 `xxx is not defined` | 脚本加载顺序：canvas-kit → vo.js → timeline.js → scene.js |
| 画面全黑 | 第 0 帧本来就黑（淡入）；其他时刻全黑 → drawFrame 报错或 WebGL 没合成（忘了 `ctx.drawImage(gl.canvas)`） |
| WebGL 画面空白 | 没开 `preserveDrawingBuffer: true`；或 draw 之后没有立即合成 |
| 字是方块 □ | 字体没加载：把字体加进 `TL.FONTS`；或该字符在字体里不存在（⠋⏸⚡ 等） |
| 字体跟预览不一样 | 预览时字体还没加载完；渲染会等 `fontsReady`，以渲染为准 |
| DOM 截图里有滚动条/偏移 | `body.render` 样式没生效：确认引用了 `/__kit/lib/player.css`，舞台尺寸与 film.json 一致 |
| 渲染越来越慢 | 每帧在创建新对象（渐变/画布/几何体），挪到 setup 里缓存 |
| `ffmpeg 退出码 1` | 看上面的 ffmpeg 报错；常见是输出路径无写权限或磁盘满 |
| Remotion 找不到模块 | 项目要在运行时能向上找到 node_modules：用 `film new` 生成的项目，别手动移动 `src/` |
| Manim `LaTeX` 报错 | 用了 `MathTex`：改 `Text`，或安装 LaTeX |
| Blender 引擎名报错 | 4.2 用 `BLENDER_EEVEE_NEXT`，5.x 用 `BLENDER_EEVEE`（模板自动尝试） |

## 画面问题

| 现象 | 修法 |
|---|---|
| 浅色背景字幕看不清 | `KIT.drawCaptions(ctx, caps, t, { color: '#2b2622', shadow: false, band: false })` |
| 着色器中心黑点/乱纹 | 1/r² 场的奇点：用有界高度函数 `sqrt(1 - k/v)` |
| 辉光糊住文字 | Bloom 强度 0.4~0.6、阈值 0.3~0.5；文字在 composer 之后画 |
| 水彩每帧剧烈闪烁 | 一拍三 `HOLD_FPS = 10` + `randomSeed(帧号)` |
| 飞行卡片落点没对准 | 用目标的真实坐标（先 measure 宽度）计算落点 |
| 标题被 3D 物体遮挡 | 调镜头或文字放 2D 层 |
| 竖屏内容跑出画面 | 坐标改成 `W*比例 / H*比例`，字号乘 `U` |

## 声音

| 现象 | 修法 |
|---|---|
| 成片没声音 | 没生成 `out/soundtrack.wav`：先 `node audio.js`（`film all` 会自动执行） |
| 改了时间表声音没对上 | 配乐过期：`film lint` 会提示，重新 `node audio.js` |
| 旁白合成失败 | edge-tts 需要联网；离线用 `--engine sapi`（Windows）/ `say`（macOS） |
| 旁白重叠 | `film lint` 指出位置；把后一句 `t` 往后挪或拆短 |
| 响度不达标 | `writeWav` 默认校正 −15 LUFS；外部音乐用 `film bgm`（含 loudnorm） |

## 工作习惯

- PowerShell 5 的 `Set-Content -Encoding utf8` 会写 BOM；JSON 用编辑器/Write 工具写（film 读 film.json 时会去掉 BOM）。
- 不要删除 `out/stills` 旧图，film 会自动建新批次 `bN`。
- 长渲染放后台，完成后再查看，不要轮询。
