// WebGL2 全屏着色器工具（全局 GLK）。用法：
//   const gl = GLK.create(1920, 1080);            // 离屏 WebGL2 画布
//   const prog = gl.program(GLK.LOOKS.aurora);    // 片元着色器源码（自动拼上 GLK.LIB 公共函数）
//   gl.draw(prog, { u_time: t, u_mix: 0.5 });     // 画一帧
//   ctx.drawImage(gl.canvas, 0, 0);               // 合成到 2D 主画布，再叠文字
// 片元着色器里可直接用：u_time u_res、hash/noise/fbm/palette/rot/sdCircle/sdBox 等。
(function (root) {
  const VERT = `#version 300 es
in vec2 p; out vec2 vUv;
void main(){ vUv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

  // 公共 GLSL 函数库
  const LIB = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 outColor;
uniform float u_time; uniform vec2 u_res;
#define PI 3.14159265
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; mat2 m = mat2(1.6,1.2,-1.2,1.6); for(int i=0;i<6;i++){ v += a*noise(p); p = m*p; a *= 0.5; } return v; }
vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d){ return a + b*cos(6.28318*(c*t+d)); }
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c,-s,s,c); }
float sdCircle(vec2 p, float r){ return length(p) - r; }
float sdBox(vec2 p, vec2 b){ vec2 d = abs(p) - b; return length(max(d,0.0)) + min(max(d.x,d.y),0.0); }
vec2 uvAspect(){ return (vUv - 0.5) * vec2(u_res.x / u_res.y, 1.0); }
vec3 grain(vec3 c, float amt){ return c + (hash(vUv * u_res + fract(u_time) * 100.0) - 0.5) * amt; }
vec3 vignette(vec3 c, float k){ vec2 q = vUv - 0.5; return c * (1.0 - k * dot(q, q) * 2.2); }
`;

  // 三种现成质感，可直接用或当作起点改
  const LOOKS = {
    // 极光：多层 fbm 流动的光幕
    aurora: `
uniform float u_energy;
void main(){
  vec2 p = uvAspect();
  float t = u_time * 0.1;
  vec3 c = mix(vec3(0.01, 0.015, 0.04), vec3(0.03, 0.05, 0.10), vUv.y);
  // 三层光幕：中心线随 fbm 摆动，竖向细纹 + 向上拖尾
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float wave = 0.22 * (fbm(vec2(p.x * 0.9 + t + fk * 3.1, fk)) - 0.5) + 0.12 * sin(p.x * 1.7 + t * 2.0 + fk);
    float y = p.y - (0.05 + fk * 0.09) - wave;
    float curtain = exp(-max(y, 0.0) * (5.0 + fk * 2.0)) * smoothstep(-0.03, 0.01, y);
    float streak = 0.55 + 0.45 * noise(vec2(p.x * 38.0 + fk * 17.0, t * 3.0));
    vec3 col = mix(vec3(0.15, 0.95, 0.65), vec3(0.55, 0.35, 1.0), smoothstep(0.0, 0.35, y + fk * 0.05));
    col = mix(col, vec3(0.95, 0.55, 0.40), 0.25 * fk);
    c += col * curtain * streak * (0.55 + 0.35 * u_energy) / (1.0 + fk * 0.6);
  }
  // 星点
  vec2 sp = vUv * u_res / 3.0;
  float star = step(0.9975, hash(floor(sp))) * (0.5 + 0.5 * sin(u_time * 3.0 + hash(floor(sp)) * 40.0));
  c += vec3(star) * smoothstep(0.0, 0.5, vUv.y) * 0.7;
  outColor = vec4(grain(vignette(c, 0.8), 0.04), 1.0);
}`,
    // 墨流：域扭曲（domain warping）的水墨/大理石纹
    ink: `
void main(){
  vec2 p = uvAspect() * 2.2;
  float t = u_time * 0.08;
  vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p + 4.0 * q + vec2(1.7, 9.2) + t * 1.5), fbm(p + 4.0 * q + vec2(8.3, 2.8)));
  float f = fbm(p + 4.0 * r);
  vec3 paper = vec3(0.93, 0.90, 0.84), ink = vec3(0.09, 0.08, 0.08), clay = vec3(0.85, 0.47, 0.34);
  vec3 c = mix(paper, ink, smoothstep(0.35, 0.85, f));
  c = mix(c, clay, smoothstep(0.55, 0.95, length(q)) * 0.55);
  outColor = vec4(grain(vignette(c, 0.5), 0.05), 1.0);
}`,
    // 液态金属：元球高度场 + 镀铬环境反射
    metal: `
float field(vec2 p){
  float v = 0.0;
  for(int i = 0; i < 7; i++){
    float fi = float(i);
    vec2 c = vec2(0.62, 0.34) * vec2(sin(u_time * (0.31 + fi * 0.06) + fi * 2.1), cos(u_time * (0.23 + fi * 0.05) + fi * 1.3));
    float r = 0.075 + 0.025 * sin(fi * 1.7);
    v += r * r / (dot(p - c, p - c) + 0.002);
  }
  return v;
}
// 有界高度：只在等值面附近隆起，避免中心奇点
float height(vec2 p){ float v = field(p); return sqrt(max(0.0, 1.0 - 0.6 / max(v, 1e-3))); }
vec3 envmap(vec3 r){
  float y = r.y * 0.5 + 0.5;
  vec3 sky = mix(vec3(0.05, 0.05, 0.07), vec3(0.98, 0.72, 0.52), smoothstep(0.45, 0.95, y));
  float stripe = smoothstep(0.06, 0.0, abs(r.y - 0.35 - 0.05 * sin(r.x * 3.0 + 0.3 * u_time)));
  return sky + stripe * vec3(1.0, 0.95, 0.9) * 0.8 + vec3(0.25, 0.12, 0.08) * smoothstep(0.4, 0.0, y);
}
void main(){
  vec2 p = uvAspect();
  float h = height(p);
  vec2 e = vec2(0.004, 0.0);
  vec2 g = vec2(height(p + e.xy) - height(p - e.xy), height(p + e.yx) - height(p - e.yx)) / (2.0 * e.x);
  vec3 n = normalize(vec3(-g * 0.12, 1.0));
  vec3 r = reflect(vec3(0.0, 0.0, -1.0), n);
  vec3 l = normalize(vec3(-0.5, 0.7, 0.6));
  float spec = pow(max(dot(reflect(-l, n), vec3(0, 0, 1)), 0.0), 60.0);
  vec3 metal = envmap(r) * (0.55 + 0.45 * max(dot(n, l), 0.0)) + spec * 1.2;
  vec3 bg = mix(vec3(0.02, 0.02, 0.025), vec3(0.06, 0.045, 0.04), vUv.y);
  float edge = smoothstep(0.02, 0.12, h);
  vec3 c = mix(bg, metal, edge);
  c += vec3(0.85, 0.47, 0.34) * 0.12 * smoothstep(0.0, 0.05, h) * (1.0 - edge);
  outColor = vec4(grain(vignette(c, 0.9), 0.03), 1.0);
}`,
  };

  function create(w = 1920, h = 1080) {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false });
    if (!gl) throw new Error('WebGL2 不可用');
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('着色器编译失败：\n' + gl.getShaderInfoLog(s));
      return s;
    };
    const api = {
      canvas, gl,
      program(frag) {
        const p = gl.createProgram();
        gl.attachShader(p, compile(gl.VERTEX_SHADER, VERT));
        gl.attachShader(p, compile(gl.FRAGMENT_SHADER, LIB + frag));
        gl.bindAttribLocation(p, 0, 'p');
        gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
        p._loc = {};
        return p;
      },
      draw(p, uniforms = {}) {
        gl.viewport(0, 0, w, h);
        gl.useProgram(p);
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        const all = { u_res: [w, h], ...uniforms };
        for (const [k, v] of Object.entries(all)) {
          const loc = p._loc[k] !== undefined ? p._loc[k] : (p._loc[k] = gl.getUniformLocation(p, k));
          if (loc === null) continue;
          if (typeof v === 'number') gl.uniform1f(loc, v);
          else if (v.length === 2) gl.uniform2fv(loc, v);
          else if (v.length === 3) gl.uniform3fv(loc, v);
          else if (v.length === 4) gl.uniform4fv(loc, v);
        }
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.finish();
      },
    };
    return api;
  }

  root.GLK = { create, LIB, LOOKS, VERT };
})(typeof window !== 'undefined' ? window : globalThis);
