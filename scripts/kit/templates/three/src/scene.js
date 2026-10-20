// Three.js 3D 层（离屏 WebGL）+ 文字层（Canvas 2D）。所有运动都由 t 推导，不用 Clock。
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const { prog, E, win, kf, rgba } = KIT;
const W = TL.W, H = TL.H, U = Math.min(W, H) / 1080;
// 竖屏时镜头退远一些，保证主体完整入画
const FAR = H > W ? 1.7 : 1;
let renderer, scene, camera, composer, core, shell, swarm, ring, dummy;
const N = 900;
const seeds = [];

export function setup() {
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  scene = new THREE.Scene();
  scene.background = new THREE.Color('#07070a');
  scene.fog = new THREE.FogExp2('#07070a', 0.045);
  camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 100);

  scene.add(new THREE.HemisphereLight('#8fb7ff', '#1a0f0a', 0.6));
  const key = new THREE.PointLight('#ffb27a', 60, 30); key.position.set(4, 3, 5); scene.add(key);
  const rim = new THREE.PointLight('#5fd3c4', 40, 30); rim.position.set(-5, -1, -3); scene.add(rim);

  // 核心晶体 + 线框外壳
  core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 0), new THREE.MeshStandardMaterial({ color: '#d97757', metalness: 0.35, roughness: 0.25, flatShading: true, emissive: '#3a1508' }));
  scene.add(core);
  shell = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.75, 1)), new THREE.LineBasicMaterial({ color: '#f2b36b', transparent: true, opacity: 0.55 }));
  scene.add(shell);

  // 实例化的粒子方块群（螺旋环带）
  const rnd = KIT.rng(42);
  for (let i = 0; i < N; i++) seeds.push({ a: rnd() * Math.PI * 2, r: 2.6 + rnd() * 2.2, y: (rnd() - 0.5) * 1.6, s: 0.018 + rnd() * 0.045, sp: 0.2 + rnd() * 0.5, hot: rnd() < 0.12 });
  swarm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#f1ebdf', metalness: 0.1, roughness: 0.5 }), N);
  const c = new THREE.Color();
  seeds.forEach((s, i) => swarm.setColorAt(i, c.set(s.hot ? '#ffcf9a' : '#c9c1b6')));
  scene.add(swarm);
  dummy = new THREE.Object3D();

  ring = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.012, 8, 256), new THREE.MeshBasicMaterial({ color: '#f2b36b' }));
  ring.rotation.x = Math.PI / 2.2;
  scene.add(ring);

  const grid = new THREE.GridHelper(40, 60, '#3a2a20', '#1a1512');
  grid.position.y = -2.6;
  scene.add(grid);

  composer = new EffectComposer(renderer);
  composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.55, 0.5, 0.4));
  composer.addPass(new OutputPass());
}

export function drawFrame(ctx, t) {
  // 镜头：推近 + 环绕
  const [r, h, a] = kf([[0, [11, 2.4, -0.6]], [3.0, [8.5, 1.4, 0.3]], [8, [8.2, 0.9, 1.4]]], t, E.inOutSine);
  camera.position.set(Math.sin(a) * r * FAR, h, Math.cos(a) * r * FAR);
  camera.lookAt(0, 0, 0);

  const pulse = 1 + 0.06 * Math.sin(t * 3.0) + 0.25 * KIT.pulse(t, 1.0, 0.25);
  core.scale.setScalar(E.outBack(prog(t, 0.4, 1.4)) * pulse);
  core.rotation.set(t * 0.4, t * 0.6, 0);
  shell.rotation.set(-t * 0.15, t * 0.25, t * 0.1);
  shell.material.opacity = 0.55 * prog(t, 0.8, 1.8);
  ring.rotation.z = t * 0.3;
  ring.scale.setScalar(E.out3(prog(t, 1.2, 2.4)));

  const grow = E.out3(prog(t, 0.6, 3.0));
  seeds.forEach((s, i) => {
    const ang = s.a + t * s.sp;
    const rr = s.r * (0.3 + 0.7 * grow);
    dummy.position.set(Math.cos(ang) * rr, s.y + 0.3 * Math.sin(ang * 3 + t), Math.sin(ang) * rr);
    dummy.rotation.set(ang * 2, ang, t);
    dummy.scale.setScalar(s.s * grow);
    dummy.updateMatrix();
    swarm.setMatrixAt(i, dummy.matrix);
  });
  swarm.instanceMatrix.needsUpdate = true;

  composer.render();

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.drawImage(renderer.domElement, 0, 0);
  const ta = win(t, 2.0, 7.6, 0.1, 0.5);
  if (ta > 0) {
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 24;
    KIT.revealTitle(ctx, '{{TITLE}}', W / 2, H > W ? H * 0.68 : H * 0.815, t, 2.1, { alpha: ta, size: 80 * U });
    ctx.restore();
  }
  KIT.drawCaptions(ctx, TL.CAPS, t);
  const fade = Math.max(1 - prog(t, 0, 0.5), prog(t, TL.DURATION - 0.6, TL.DURATION));
  if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(0, 0, W, H); }
}
