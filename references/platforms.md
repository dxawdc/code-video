# 在不同 AI 工具里使用

code-video 遵循开放的 Agent Skills 标准（一个文件夹：`SKILL.md` + `references/` + `scripts/`），凡是支持该标准的工具都能直接用。安装器会同时做两件事：

1. 运行时装到 `~/.code-video/`（film 命令行、模板、库、JS 依赖），并把 `~/.code-video/bin` 加入 PATH、写入环境变量 `CODE_VIDEO_HOME`。
2. 把技能文件夹复制到各工具的技能目录。

## Claude Code

- 技能目录：`~/.claude/skills/code-video/`（个人，所有项目可用）；也可以放项目里 `.claude/skills/code-video/`。
- 触发：说“用代码做一个关于 X 的视频”，或输入 `/code-video`。
- 权限：允许运行 `film`、`node`、`ffmpeg`；可在设置里把 `Bash(film:*)`、`Bash(node:*)`、`Bash(ffmpeg:*)` 加到允许列表，减少确认。
- 桌面版有内置浏览器时：`film preview` 打开的地址可以在内置浏览器里看；审片仍以 `film stills` 的图片为准。

## Codex（CLI / IDE / App）

- 技能目录：`~/.codex/skills/code-video/`（Windows：`%USERPROFILE%\.codex\skills\code-video\`）。Codex 启动时只读技能的名称和描述，用到时才读完整 SKILL.md。
- 触发：直接描述需求，或 `$code-video` / 在技能列表里选择。
- **沙箱**：默认 `workspace-write` 沙箱可能不允许启动 Chrome、写 `~/.code-video` 以外的目录或联网（edge-tts、HyperFrames 的 CDN）。做视频时建议：
  - 在项目目录里运行（输出都写在项目里）；
  - 用 `codex --sandbox danger-full-access`，或在审批时允许这些命令；
  - 或让 Codex 只写代码，由你在本机终端运行 `film all <项目>`。
- 非交互：`codex exec "用 code-video 技能做一个 30 秒的竖屏视频，讲……"`。

## WorkBuddy（腾讯）

- 技能目录：`~/.workbuddy/skills/code-video/`；部分版本在 `%APPDATA%\WorkBuddy\skills\`（安装器两个都会放，存在哪个放哪个）。
- 也可以在界面：Skills → 添加技能 → 上传 `code-video-v*.zip`。上传方式只放了技能文档，**还需要运行一次安装器**（zip 里的 `一键安装.cmd` / `install.sh`）装好 film 运行时；技能被调用时如果发现 `film doctor` 失败，也会提示运行安装器。
- 装完重启 WorkBuddy，在技能列表里确认已启用。

## 其他支持 Agent Skills 的工具（CodeBuddy、Trae、Qoder、Cursor 新版等）

把整个 `code-video` 文件夹放进该工具的技能目录（各家路径不同，看它的文档；常见形如 `~/.<工具名>/skills/`），或在界面上传 zip。安装器支持 `-Targets` / `--targets` 指定自定义目录：

```powershell
powershell -ExecutionPolicy Bypass -File install.ps1 -Targets "D:\某工具\skills"
```
```bash
bash install.sh --targets "$HOME/.某工具/skills"
```

## 不支持技能的工具

把 `AGENTS.md`（技能包根目录里有一份精简版）复制到项目根目录，或把 SKILL.md 的内容贴进它的“规则/自定义指令”。前提是本机已运行安装器，`film` 可用。

## 通用提示词

> 用 code-video 技能，做一个 60 秒的横屏科普短片，主题是“为什么天空是蓝色的”，要有旁白和字幕，风格温暖。

> 用 code-video 的 three 技术栈做一个 15 秒的竖屏产品展示，主体是一个旋转的金属戒指，结尾出现品牌名“ARC”。

> 用 code-video 把这份数据（附 CSV）做成 45 秒的数据故事视频，用 dom 技术栈，图表逐段生长。

> 用 code-video 的 manim 技术栈讲清楚冒泡排序，40 秒，配男声旁白。
