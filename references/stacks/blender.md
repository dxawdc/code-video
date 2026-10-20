# blender：Blender Python（bpy）+ EEVEE

适合：真实感材质与灯光、景深、反射、产品/建筑级 3D、程序化场景。速度最慢（EEVEE 16 采样约 0.4 秒/帧），先出低采样草稿。

## 结构

```
scene.py    从空场景用代码建模、材质、灯光、镜头、动画，最后 bpy.ops.render.render(animation=True)
film.json   { type: "blender", fps, duration, width, height, title }
```

出片：`film video <项目> [--samples 16]`（= `blender -b --factory-startup -P scene.py -- --out <帧目录> --samples N`，PNG 序列 → H.264 → 混音）。草稿 `--samples 8`，成片 32~64。

## 写法：update(t) + 逐帧关键帧

```python
def update(t):                       # 把场景摆到 t 时刻（与其他技术栈同一思路）
    cam.location = (...); knot.rotation_euler = (t*.7, t*.45, 0); ...
for f in range(scene.frame_start, scene.frame_end + 1):
    update((f - 1) / FPS)
    for o in animated: o.keyframe_insert('location', frame=f); o.keyframe_insert('rotation_euler', frame=f); o.keyframe_insert('scale', frame=f)
```

## 速查

```python
bpy.ops.wm.read_factory_settings(use_empty=True)              # 空场景
scene.render.engine = 'BLENDER_EEVEE'                          # 5.x；4.2 是 'BLENDER_EEVEE_NEXT'（模板会自动尝试）
scene.eevee.taa_render_samples = 32
scene.view_settings.view_transform = 'AgX'                     # 色彩管理
bpy.ops.mesh.primitive_torus_add(...); bpy.ops.object.shade_smooth()
m = bpy.data.materials.new('x'); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
b.inputs['Base Color'].default_value = (r,g,b,1); b.inputs['Metallic'].default_value = .85; b.inputs['Roughness'].default_value = .22
b.inputs['Emission Color'].default_value = (...); b.inputs['Emission Strength'].default_value = 2.5
light = bpy.data.lights.new('key', 'AREA'); light.energy = 2500; light.size = 4
cam_data.dof.use_dof = True; cam_data.dof.focus_object = 主体; cam_data.dof.aperture_fstop = 2.8
txt = bpy.ops.object.text_add(); txt.data.body = '中文'; txt.data.font = bpy.data.fonts.load('C:/Windows/Fonts/simhei.ttf')
```

颜色要从 sRGB 转线性（模板的 `hexrgb` 已处理 `**2.2`）。

## 构图经验

- 先保证“看得清主体和标题”：镜头距离、高度、焦距（32~50mm）。
- 三点布光：暖主光 + 冷轮廓光 + 顶部柔光；世界背景给一点颜色（纯黑会让物体轮廓消失）。
- 发光材质强度 2~3 足够，太高会过曝成白块。
- 竖屏镜头退远（模板 `FAR = 1.6`）。
- 中文 3D 字：Windows 用 `simhei.ttf`/`msyh.ttc`，macOS 用 `/System/Library/Fonts/PingFang.ttc`。

## 坑

- 不要依赖已有 .blend 文件和用户偏好：`--factory-startup` + 代码建一切，结果才可复现。
- 渲染在后台运行；长片拆段或降采样先看效果。
- 想要 Cycles 真实感：`scene.render.engine = 'CYCLES'`，`scene.cycles.samples = 64`，有 GPU 时设置设备；速度会慢很多。
