# {{TITLE}}

{{W}}×{{H}} / 30fps / H.264 + AAC 立体声。技术栈：{{TYPE}}（{{TYPE_DESC}}）。画面由代码绘制，配乐和音效由代码合成。

| 文件 | 作用 |
|---|---|
| `STORYBOARD.md` | 分镜表 |
| `film.json` | 类型、尺寸、帧率、时长 |
| `src/timeline.js` | 共享时间表：时长、字幕、旁白、音效事件 |
| `src/vo.js` | 旁白时长与分句（`film tts` 自动生成） |
| 画面文件 | canvas 类为 `src/scene.js`；remotion 为 `src/Main.tsx`；hyperframes 为 `index.html`；manim/blender 为 `scene.py` |
| `audio.js` | 配乐、音效、旁白混音 → `out/soundtrack.wav` |

运行时目录：`{{KIT_NODE}}`。常用命令（在本项目目录里运行）：

```bash
film preview .       # 浏览器实时预览（canvas/shader/three/p5brush/dom）
film tts .           # 合成旁白（先在 src/timeline.js 写 TL.VO）
film lint .          # 检查时间表
film stills . auto:12  # 抽帧检查
film all .           # 配乐 → 母版 → 分享版 → 校验 → 封面
```
