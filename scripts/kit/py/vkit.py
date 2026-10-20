"""Python 路线（PIL/numpy/cv2 逐帧绘制）的共用部分：缓动、字体、ffmpeg 管道、WAV、联系表、并行渲染。

用法：
    import sys, os; sys.path.insert(0, os.path.join(os.environ.get('CODE_VIDEO_HOME', os.path.expanduser('~/.code-video')), 'py'))
    from vkit import *

渲染后的校验/抽帧/分享版统一用 film verify|sheet|share <mp4>。
"""
from pathlib import Path
from functools import lru_cache
import math, subprocess, wave, random

import numpy as np
from PIL import Image, ImageFont

W, H, FPS, SR = 1920, 1080, 30, 48000
FONTS = Path('C:/Windows/Fonts')

# ───── 数学与缓动 ─────
def clamp(v, a=0.0, b=1.0): return max(a, min(b, v))
def lerp(a, b, v): return a + (b - a) * v
def prog(t, a, b): return clamp((t - a) / (b - a)) if b != a else float(t >= b)
def ease(v): v = clamp(v); return 1 - (1 - v) ** 3            # out-cubic
def ease5(v): v = clamp(v); return 1 - (1 - v) ** 5
def ease_io(v): v = clamp(v); return v * v * v * (v * (6 * v - 15) + 10)   # smootherstep
def back(v, s=1.7): v = clamp(v) - 1; return 1 + v * v * ((s + 1) * v + s)
def win(t, a, b, fi=0.4, fo=0.4): return min(prog(t, a, a + fi), 1 - prog(t, b - fo, b))
def pulse(t, t0, d): return math.exp(-(t - t0) / d) if t0 <= t < t0 + d * 6 else 0.0
def lerp_c(c1, c2, v): return tuple(round(lerp(c1[k], c2[k], v)) for k in range(3))
def hexc(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
def hsh(i): return (math.sin(i * 127.1 + 311.7) * 43758.5453) % 1.0

def kf(keys, t, e=ease_io):
    """关键帧插值：keys = [(t, 值或元组), ...]"""
    if t <= keys[0][0]: return keys[0][1]
    for (ta, va), (tb, vb) in zip(keys, keys[1:]):
        if t < tb:
            u = e(prog(t, ta, tb))
            return tuple(lerp(x, y, u) for x, y in zip(va, vb)) if isinstance(va, (tuple, list)) else lerp(va, vb, u)
    return keys[-1][1]

# ───── 字体 ─────
# 本机字体（C:/Windows/Fonts）：可变字体用 set_variation_by_name 选字重
FONT_FILES = {
    'serif': 'NotoSerifSC-VF.ttf', 'sans': 'NotoSansSC-VF.ttf',
    'yahei': 'msyh.ttc', 'yahei-l': 'msyhl.ttc', 'yahei-b': 'msyhbd.ttc',
    'bahn': 'bahnschrift.ttf', 'mono': 'consola.ttf', 'cascadia': 'CascadiaCode.ttf',
    'han-heavy': 'Source Han Serif SC Heavy (TrueType).ttf',
}

@lru_cache(maxsize=512)
def font(kind='sans', size=40, weight=None):
    """font('serif', 72, 'Bold')；weight 为可变字体实例名（Thin/Light/Regular/Medium/SemiBold/Bold/Black…）"""
    f = ImageFont.truetype(str(FONTS / FONT_FILES.get(kind, kind)), size)
    if weight:
        try: f.set_variation_by_name(weight)
        except Exception: pass
    return f

def text_width(s, f, track=0): return f.getlength(s) + track * max(0, len(s) - 1)

# ───── 输出 ─────
def ffmpeg_cmd(out, audio=None, w=W, h=H, fps=FPS, crf=16):
    """rawvideo rgb24 从 stdin 读帧 → H.264 母版（可选混入 WAV）"""
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{w}x{h}', '-r', str(fps), '-i', '-']
    if audio: cmd += ['-i', str(audio)]
    cmd += ['-c:v', 'libx264', '-preset', 'slow', '-crf', str(crf), '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-tune', 'grain',
            '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709']
    if audio: cmd += ['-c:a', 'aac', '-b:a', '192k', '-shortest']
    return cmd + ['-movflags', '+faststart', str(out)]

def render_video(frame_fn, n_frames, out, audio=None, workers=12, chunksize=6, **kw):
    """frame_fn(i) -> RGB bytes（W*H*3）。用多进程并行绘制，按顺序写入 ffmpeg。
    注意：Windows 下调用方必须放在 if __name__ == '__main__': 里。"""
    from multiprocessing import Pool
    proc = subprocess.Popen(ffmpeg_cmd(out, audio, **kw), stdin=subprocess.PIPE)
    with Pool(workers) as pool:
        for i, buf in enumerate(pool.imap(frame_fn, range(n_frames), chunksize=chunksize)):
            proc.stdin.write(buf)
            if i % 300 == 0: print(f'帧 {i}/{n_frames}', flush=True)
    proc.stdin.close()
    if proc.wait() != 0: raise RuntimeError('ffmpeg 失败')
    print('完成:', out, flush=True)

def write_wav(path, stereo, peak=0.89, drive=1.1):
    """stereo: float 数组 (n, 2)。软限幅 + 归一化后写 16bit WAV。"""
    x = np.tanh(np.asarray(stereo, np.float32) * drive)
    x *= peak / max(1e-9, np.abs(x).max())
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes())
    return Path(path)

def contact_sheet(frame_fn, times, out, cols=4, tw=480, fps=FPS, w=W, h=H):
    """frame_fn(帧号) -> RGB bytes；按 times（秒）抽帧拼成联系表"""
    th = round(tw * h / w)
    thumbs = [Image.frombytes('RGB', (w, h), frame_fn(int(t * fps))).resize((tw, th), Image.Resampling.LANCZOS) for t in times]
    sheet = Image.new('RGB', (tw * cols, th * ((len(thumbs) + cols - 1) // cols)), (40, 40, 40))
    for i, im in enumerate(thumbs): sheet.paste(im, ((i % cols) * tw, (i // cols) * th))
    sheet.save(out, quality=90)
    return Path(out)

# ───── 音频小工具 ─────
def mtof(m): return 440 * 2 ** ((m - 69) / 12)
def tt(d): return np.arange(int(d * SR)) / SR
