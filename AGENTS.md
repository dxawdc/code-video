# 用代码做视频（code-video，给不支持 Agent Skills 的工具用）

把这个文件放到项目根目录，或贴进 AI 工具的“自定义指令/规则”。前提：本机已运行过 code-video 安装器，终端里 `film doctor` 能用（否则用 `node ~/.code-video/bin/film.js`）。

当用户要做视频/短片/动画/MV/竖屏短视频，或要求用代码实现画面时，按这个流程：

1. `film doctor` 看可用技术栈。
2. `film new <目录> --type canvas|shader|three|p5brush|dom|hyperframes|remotion|manim|blender --title 片名 [--size 9:16]`。
3. 写 `STORYBOARD.md`（一句话主旨、观众、分镜表），再写 `src/timeline.js`（DURATION、CAPS 字幕、VO 旁白、SFX 音效）。
4. 改画面文件（模板就是可运行示例）。硬规则：每一帧是时间 t 的纯函数；不用 Date.now/Math.random/setTimeout/CSS 动画。
5. 有旁白：`film tts <目录>`。然后 `film lint <目录>` 修掉所有问题。
6. 审片：`film stills <目录> auto:12`，打开生成的 sheet 图片逐张检查文字、对比度、对齐、构图；改完对问题时刻复查。
7. 出片：`film all <目录>`（配乐 → 母版 → 分享版 → 校验 → 封面），再 `film sheet <母版mp4> auto:9 --cols 3` 检查成片。
8. 交付分享版；说明声音只测了响度、未经人耳试听；告诉用户改哪个文件、怎么重新出片。

详细文档在技能包的 `references/` 目录：workflow、cli、story、design、audio、qa、stacks/*、troubleshooting、platforms。
