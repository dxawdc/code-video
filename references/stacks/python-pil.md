# Python / PIL 路线（不在 film new 模板里，但工具通用）

适合：大量图片素材合成（照片、截图、AI 生成插图）、numpy 逐像素特效、数据表直接画图、旁白驱动的长视频。用多进程并行渲染，速度可以很快。

## 用法

```python
import sys, os
sys.path.insert(0, os.path.join(os.path.expanduser('~'), '.code-video', 'py'))   # 或 <kit>/py
from vkit import *          # W H FPS SR、clamp lerp prog ease ease_io back win pulse kf hexc lerp_c hsh、font()、render_video、write_wav、contact_sheet、mtof、tt

def frame(i):               # 帧号 → RGB bytes
    t = i / FPS
    im = Image.new('RGB', (W, H), (12, 11, 10))
    d = ImageDraw.Draw(im)
    f = font('serif', 96, 'Bold')        # Noto Serif SC 可变字体；'sans' 'yahei' 'mono' 'cascadia' 'bahn'…
    d.text((W/2 - text_width('标题', f)/2, 480), '标题', font=f, fill=(241, 235, 223))
    return im.tobytes()

if __name__ == '__main__':              # Windows 多进程必须
    write_wav('a.wav', stereo_array)     # (n, 2) float，自动软限幅+归一化
    contact_sheet(frame, [1, 3, 5, 7], 'sheet.jpg')
    render_video(frame, int(DUR * FPS), '片名_1080p30.mp4', audio='a.wav', workers=8)
```

之后同样用 `film verify / sheet / share / poster / gif / bgm` 处理成片。配乐也可以用 Node 的 `audio.js`（synth.js）生成 wav 再传给 `render_video`。

## 套路

- 文字发光：画到单独的 L 通道图 → 高斯模糊 → 加色合成。
- 照片 Ken Burns：每帧按 t 计算裁切框（缩放 1.0→1.08、平移），`resize` 后贴入。
- 逐像素特效：`np.asarray(im)` 运算后 `Image.fromarray`。
- 字体缓存：`font()` 已 `lru_cache`；文字蒙版也可以缓存。
