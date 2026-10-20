"""Blender 程序化场景：建模、材质、灯光、镜头全部由代码生成，EEVEE 渲染 PNG 序列。
渲染：node kit/bin/film.js video <本项目> [--samples 32]
写法和其他模板一致：update(t) 把场景摆到 t 时刻，脚本逐帧写关键帧，再一次性渲染。"""
import bpy, json, math, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
FILM = json.loads((HERE / 'film.json').read_text(encoding='utf-8'))
FPS, DUR = FILM['fps'], FILM['duration']
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
arg = lambda k, d=None: argv[argv.index(k) + 1] if k in argv else d
OUT = Path(arg('--out', str(HERE / 'out' / 'frames')))
SAMPLES = int(arg('--samples', 32))

def hexrgb(h, a=1.0):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x ** 2.2 for x in c] + [a]   # sRGB → 线性
def clamp(v, a=0.0, b=1.0): return max(a, min(b, v))
def prog(t, a, b): return clamp((t - a) / (b - a))
def ease(u): u = clamp(u); return 1 - (1 - u) ** 3
def smooth(u): u = clamp(u); return u * u * (3 - 2 * u)

# ───── 场景与渲染设置 ─────
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
for eng in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
    try: scene.render.engine = eng; break
    except TypeError: pass
scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = FILM.get('width', 1920), FILM.get('height', 1080), 100
FAR = 1.35 if FILM.get('height', 1080) > FILM.get('width', 1920) else 1.0   # 竖屏镜头退远
scene.render.fps = FPS
scene.frame_start, scene.frame_end = 1, int(round(DUR * FPS))
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = str(OUT / 'f_')
scene.eevee.taa_render_samples = SAMPLES
try: scene.view_settings.view_transform = 'AgX'; scene.view_settings.look = 'AgX - Medium High Contrast'
except Exception: pass

world = bpy.data.worlds.new('World'); scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes['Background']; bg.inputs[0].default_value = hexrgb('#1a1620'); bg.inputs[1].default_value = 1.0

def material(name, color, metal=0.0, rough=0.4, emit=None, strength=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = hexrgb(color)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    if emit:
        b.inputs['Emission Color'].default_value = hexrgb(emit)
        b.inputs['Emission Strength'].default_value = strength
    return m

M_FLOOR = material('floor', '#1c181a', 0.5, 0.25)
M_CLAY = material('clay', '#d97757', 0.85, 0.22)
M_BAR = material('bar', '#2a2522', 0.3, 0.35)
M_HOT = material('hot', '#f2b36b', 0.0, 0.3, emit='#e9894f', strength=2.2)
M_TEXT = material('text', '#f1ebdf', 0.0, 0.5, emit='#f1ebdf', strength=1.5)

# ───── 物体 ─────
bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, 0)); floor = bpy.context.object; floor.data.materials.append(M_FLOOR)

bpy.ops.mesh.primitive_torus_add(major_radius=1.25, minor_radius=0.32, major_segments=96, minor_segments=32, location=(0, 0, 2.2))
knot = bpy.context.object; knot.data.materials.append(M_CLAY)
bpy.ops.object.shade_smooth()

bars = []
N = 13
for i in range(N):
    a = i / N * math.tau
    bpy.ops.mesh.primitive_cube_add(size=1, location=(math.cos(a) * 4.2, math.sin(a) * 4.2, 0.5))
    b = bpy.context.object
    b.data.materials.append(M_HOT if i % 4 == 0 else M_BAR)
    b.rotation_euler[2] = a
    bars.append((b, a, 0.6 + 1.8 * (0.5 + 0.5 * math.sin(i * 1.7))))

font_path = 'C:/Windows/Fonts/simhei.ttf'
bpy.ops.object.text_add(location=(0, -2.6, 0.55))
txt = bpy.context.object
txt.data.body = FILM.get('title', '')
try: txt.data.font = bpy.data.fonts.load(font_path)
except Exception: pass
txt.data.align_x, txt.data.align_y = 'CENTER', 'CENTER'
# 竖屏或长标题时缩小字号，保证完整入画
txt.data.size = min(0.9, 7.0 / max(4, len(txt.data.body))) * (0.75 if FAR > 1 else 1.0)
txt.data.extrude = 0.06
txt.data.materials.append(M_TEXT)
txt.rotation_euler = (math.radians(90), 0, 0)

# 灯光
def area(name, loc, color, power, size):
    l = bpy.data.lights.new(name, 'AREA'); l.color = hexrgb(color)[:3]; l.energy = power; l.size = size
    o = bpy.data.objects.new(name, l); o.location = loc; scene.collection.objects.link(o)
    o.rotation_euler = (0, 0, 0)
    c = o.constraints.new('TRACK_TO'); c.target = knot; c.track_axis = 'TRACK_NEGATIVE_Z'; c.up_axis = 'UP_Y'
    return o
area('key', (5, -5, 7), '#ffd2a8', 2500, 4)
area('rim', (-6, 5, 4), '#7fd0c4', 1800, 3)
area('top', (0, 0, 9), '#ffffff', 600, 6)

cam_data = bpy.data.cameras.new('cam'); cam = bpy.data.objects.new('cam', cam_data); scene.collection.objects.link(cam); scene.camera = cam
cam_data.lens = 32
cam_data.dof.use_dof = True; cam_data.dof.focus_object = knot; cam_data.dof.aperture_fstop = 2.8
tc = cam.constraints.new('TRACK_TO'); tc.target = knot; tc.track_axis = 'TRACK_NEGATIVE_Z'; tc.up_axis = 'UP_Y'

# ───── 动画：update(t) 摆好 t 时刻，然后写关键帧 ─────
def update(t):
    a = -0.35 + 0.3 * smooth(t / DUR) * math.pi
    r = 15 - 3.5 * ease(prog(t, 0, 4))
    r *= FAR
    cam.location = (math.sin(a) * r, -math.cos(a) * r, 4.2 + 2.0 * (1 - ease(prog(t, 0, 5))))
    s = ease(prog(t, 0.2, 1.6))
    knot.scale = (s, s, s)
    knot.rotation_euler = (t * 0.7, t * 0.45, t * 0.3)
    knot.location.z = 2.2 + 0.15 * math.sin(t * 2)
    for i, (b, ang, h) in enumerate(bars):
        g = ease(prog(t, 0.8 + i * 0.08, 2.2 + i * 0.08))
        hh = max(0.02, h * g * (1 + 0.12 * math.sin(t * 3 + i)))
        b.scale = (0.45, 0.45, hh); b.location.z = hh / 2
    ts = ease(prog(t, 3.0, 4.2))
    txt.scale = (ts, ts, ts)

for f in range(scene.frame_start, scene.frame_end + 1):
    update((f - 1) / FPS)
    for o in [cam, knot, txt] + [b for b, _, _ in bars]:
        o.keyframe_insert('location', frame=f); o.keyframe_insert('scale', frame=f); o.keyframe_insert('rotation_euler', frame=f)

OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.render.render(animation=True)
print('Blender 渲染完成:', OUT)
