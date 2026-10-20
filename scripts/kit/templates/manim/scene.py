"""Manim（Community 版）场景。渲染：node kit/bin/film.js video <本项目>
本机没有 LaTeX：用 Text / MarkupText（Pango 渲染，支持中文），不要用 MathTex / Tex。
总时长要和 film.json 的 duration 一致（配乐按它生成）。"""
import json
from pathlib import Path
from manim import *

FILM = json.loads((Path(__file__).parent / 'film.json').read_text(encoding='utf-8'))
DUR = FILM['duration']
CN_SERIF, CN_SANS, MONO = 'Noto Serif SC', 'Noto Sans SC', 'Cascadia Code'
CREAM, CLAY, AMBER, TEAL, INK = '#f1ebdf', '#d97757', '#f2b36b', '#7fd0c4', '#0c0b0a'

config.background_color = INK
# 竖屏（如 1080x1920）：画面宽固定 8 个单位，高度按比例变高，布局改成上下排列
PORTRAIT = FILM.get('height', 1080) > FILM.get('width', 1920)
if PORTRAIT:
    config.frame_width = 8.0
    config.frame_height = 8.0 * FILM['height'] / FILM['width']
PLOT_AT = UP * 1.6 if PORTRAIT else LEFT * 3.2 + DOWN * 0.3
SHAPE_AT = DOWN * 3.0 if PORTRAIT else RIGHT * 3.6 + DOWN * 0.3


class Main(Scene):
    def construct(self):
        self.wait(0.3)
        title = Text('{{TITLE}}', font=CN_SERIF, weight=SEMIBOLD, color=CREAM).scale(1.4)
        self.play(Write(title), run_time=1.0)
        self.play(title.animate.scale(0.55).to_edge(UP, buff=0.5), run_time=0.5)

        # 左：坐标系 + 正弦曲线 + 沿曲线移动的点
        axes = Axes(x_range=[0, 6.3, 1], y_range=[-1.3, 1.3, 1], x_length=6.2, y_length=3.4,
                    axis_config={'color': GREY_B, 'stroke_width': 2, 'include_ticks': False}).move_to(PLOT_AT)
        curve = axes.plot(lambda x: np.sin(x), x_range=[0, 6.28], color=AMBER, stroke_width=5)
        t = ValueTracker(0)
        dot = always_redraw(lambda: Dot(axes.c2p(t.get_value(), np.sin(t.get_value())), radius=0.1, color=CLAY))
        label = always_redraw(lambda: Text(f'sin({t.get_value():.2f}) = {np.sin(t.get_value()):+.2f}', font=MONO, color=CREAM)
                              .scale(0.42).next_to(axes, DOWN, buff=0.35))
        self.play(Create(axes), run_time=1.0)
        self.play(Create(curve), FadeIn(dot), FadeIn(label), run_time=1.0)

        # 右：形状变换
        shape = Circle(radius=1.1, color=TEAL, fill_opacity=0.25, stroke_width=5).move_to(SHAPE_AT)
        square = Square(side_length=2.0, color=AMBER, fill_opacity=0.25, stroke_width=5).move_to(shape)
        star = Star(n=6, outer_radius=1.25, color=CLAY, fill_opacity=0.35, stroke_width=5).move_to(shape)
        # MarkupText 的颜色要写在 span 里，color= 参数对整段不生效
        cap = MarkupText(f'<span foreground="{AMBER}" weight="bold">manim</span><span foreground="{CREAM}"> · {{TYPE_DESC}}</span>', font=CN_SANS).scale(0.42)
        cap.scale_to_fit_width(min(cap.width, config.frame_width * 0.92)).to_edge(DOWN, buff=0.35)
        self.play(t.animate.set_value(6.28), GrowFromCenter(shape), FadeIn(cap, shift=UP * 0.2), run_time=1.5, rate_func=smooth)
        self.play(Transform(shape, square), run_time=0.7)
        self.play(Transform(shape, star), Rotate(shape, PI / 3), run_time=0.7)
        # 补足到总时长，留 0.6 秒淡出
        used = self.renderer.time
        self.wait(max(0.01, DUR - 0.6 - used))
        self.play(*[FadeOut(m) for m in self.mobjects], run_time=0.6)
