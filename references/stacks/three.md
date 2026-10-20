# three：Three.js 3D

适合：3D 物体展示、粒子群、数据立体化、产品感运镜、科技感场景。ES 模块 + importmap，渲染很快。

## 结构

```html
<script type="importmap">
{ "imports": { "three": "/__lib/three/build/three.module.js", "three/addons/": "/__lib/three/examples/jsm/" } }
</script>
<script type="module">
  import { setup, drawFrame } from './src/scene.js';
  KIT.mountPlayer({ canvas, draw: drawFrame, setup, fps: TL.FPS, duration: TL.DURATION, fonts: TL.FONTS });
</script>
```

```js
export function setup() {
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); // 必须 preserveDrawingBuffer
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.55, 0.5, 0.4)); // 强度、半径、阈值
  composer.addPass(new OutputPass());
}
export function drawFrame(ctx, t) {
  // 1. 由 t 设置一切：相机、物体变换、材质参数、实例矩阵
  // 2. composer.render()
  // 3. ctx.drawImage(renderer.domElement, 0, 0)，再画文字/字幕
}
```

## 确定性

- **不要用 `THREE.Clock`、`requestAnimationFrame` 驱动动画**，所有状态都从 t 计算。
- 随机分布用 `KIT.rng(seed)` 在 setup 里生成一次，存起来。
- 物理/模拟需要逐帧积分时：在 drawFrame 里从 0 积分到 t（固定步长），或预计算轨迹表。

## 常用套路

| 需求 | 做法 |
|---|---|
| 大量相同物体 | `InstancedMesh` + `dummy.updateMatrix()` + `setMatrixAt`，每帧 `instanceMatrix.needsUpdate = true` |
| 运镜 | `kf([[0,[r,h,a]],[3,[...]]], t, E.inOutSine)` 得到极坐标 → `camera.position` → `lookAt` |
| 竖屏 | 相机距离 ×1.6~1.8（模板里的 `FAR`） |
| 发光边缘 | `EdgesGeometry` + `LineBasicMaterial`；或 emissive 材质 + Bloom |
| 地面反射感 | 低粗糙度金属地面 + 雾 `FogExp2` |
| 文字 | 2D 层画（最清晰）；需要 3D 文字用 `TextGeometry` + 字体 JSON |
| 点云/星空 | `Points` + `BufferGeometry`，size 随距离衰减 |
| 后期 | Bloom、`FilmPass`（颗粒）、`AfterimagePass`（拖影），都在 `three/addons/postprocessing/` |

## 坑

- Bloom 太强会把文字和白色物体糊成光团：强度 0.4~0.6、阈值 0.3~0.5。
- 2D 文字层要在 `composer.render()` 之后画，否则会被盖住。
- 粒子太大太近会挡住标题：控制尺寸、让相机远一点。
- 模型资源（glTF）放项目 `assets/`，用 `GLTFLoader` 在 setup 里 `await` 加载完。
