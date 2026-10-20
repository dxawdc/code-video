// Node 端音频合成：配乐声部、常用音效、混响、时间变形（磁带停/启）、母带与 WAV 写出。
// 用法见 kit/template/audio.js。所有声音都由代码生成，不依赖任何音源文件。
const fs = require('fs');
const path = require('path');

const SR = 48000;
const TAU = Math.PI * 2;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const prog = (t, a, b) => clamp((t - a) / (b - a));
const win = (t, a, b, fi = 0.3, fo = 0.3) => Math.min(prog(t, a, a + fi), 1 - prog(t, b - fo, b));
function rng(seed = 12345) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }

// 一条立体声轨：L/R 干声 + 混响发送
class Track {
  constructor(seconds, seed = 12345) {
    this.n = Math.ceil(seconds * SR);
    this.L = new Float32Array(this.n);
    this.R = new Float32Array(this.n);
    this.send = new Float32Array(this.n);
    this.rnd = rng(seed);
  }
  noise() { return this.rnd() * 2 - 1; }
  // fn(x 秒, 采样序号) → 样本值；pan -1..1；send 为混响发送量
  add(t0, dur, amp, pan, fn, send = 0.25) {
    const s0 = Math.floor(t0 * SR), n = Math.floor(dur * SR);
    const gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4);
    for (let i = 0; i < n; i++) {
      const k = s0 + i;
      if (k < 0 || k >= this.n) continue;
      const v = fn(i / SR, i) * amp;
      this.L[k] += v * gl; this.R[k] += v * gr;
      if (send) this.send[k] += v * send;
    }
    return this;
  }
  // 放入一段现成的单声道采样（旁白、外部音效）
  addBuffer(t0, buf, gain = 1, pan = 0, send = 0) {
    const s0 = Math.floor(t0 * SR);
    const gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4);
    for (let i = 0; i < buf.length; i++) {
      const k = s0 + i;
      if (k < 0 || k >= this.n) continue;
      const v = buf[i] * gain;
      this.L[k] += v * gl * 1.4142; this.R[k] += v * gr * 1.4142;
      if (send) this.send[k] += v * send;
    }
    return this;
  }
  // 把混响加回干声
  applyReverb(wet = 0.55, o = {}) {
    const vl = reverb(this.send, this.n, 0, o), vr = reverb(this.send, this.n, 23, o);
    for (let i = 0; i < this.n; i++) { this.L[i] += vl[i] * wet; this.R[i] += vr[i] * wet; }
    this.send.fill(0);
    return this;
  }
  // 把另一条轨按增益叠加进来；map(t) 可做时间变形，返回 [源时间, 增益]
  mix(other, gain = 1, map = null) {
    for (let i = 0; i < this.n; i++) {
      let p = i / SR, g = gain;
      if (map) { const r = map(p); p = r[0]; g *= r[1]; if (g <= 0) continue; }
      const x = p * SR, k = Math.floor(x), fr = x - k;
      if (k < 0 || k + 1 >= other.n) continue;
      this.L[i] += (other.L[k] * (1 - fr) + other.L[k + 1] * fr) * g;
      this.R[i] += (other.R[k] * (1 - fr) + other.R[k + 1] * fr) * g;
    }
    return this;
  }
}

// Schroeder 混响（6 梳状 + 3 全通）
function reverb(input, len, off = 0, o = {}) {
  const { feedback = 0.86, damp = 0.38, inGain = 0.18 } = o;
  const out = new Float32Array(len);
  const combs = [1557, 1617, 1491, 1422, 1277, 1356].map((d) => ({ d: d + off, buf: new Float32Array(d + off), i: 0, lp: 0 }));
  const aps = [556, 441, 341].map((d) => ({ d: d + off, buf: new Float32Array(d + off), i: 0 }));
  for (let n = 0; n < len; n++) {
    const x = input[n] * inGain;
    let y = 0;
    for (const c of combs) {
      const v = c.buf[c.i];
      c.lp = v * (1 - damp) + c.lp * damp;
      c.buf[c.i] = x + c.lp * feedback;
      c.i = (c.i + 1) % c.d;
      y += v;
    }
    for (const a of aps) {
      const v = a.buf[a.i], w = y + v * 0.5;
      a.buf[a.i] = w; a.i = (a.i + 1) % a.d; y = v - w * 0.5;
    }
    out[n] = y;
  }
  return out;
}

// ───── 乐器声部 ─────
const INST = {
  // 铺底和弦：notes 为 MIDI 数组；gain(t) 可选，返回该绝对时刻的强度
  pad(tr, t0, dur, notes, amp = 0.035, gain = null, send = 0.45) {
    notes.forEach((m, j) => {
      const f = mtof(m);
      tr.add(t0, dur, amp, (j - (notes.length - 1) / 2) * 0.35, (t) => {
        const env = Math.min(1, t / 1.6) * Math.min(1, (dur - t) / 2.2);
        let v = 0;
        for (const d of [0.997, 1.003]) { const p = TAU * f * d * t; v += Math.sin(p) + 0.22 * Math.sin(2 * p) + 0.07 * Math.sin(3 * p); }
        return v * env * (gain ? gain(t0 + t) : 1) * (0.85 + 0.15 * Math.sin(TAU * 0.13 * t + j));
      }, send);
    });
  },
  pluck(tr, t0, m, amp = 0.05, pan = 0, send = 0.5) {
    const f = mtof(m);
    tr.add(t0, 1.6, amp, pan, (t) => {
      const p = TAU * f * t;
      return (Math.sin(p) * Math.exp(-t * 4.2) + 0.45 * Math.sin(2 * p) * Math.exp(-t * 9) + 0.15 * Math.sin(3.01 * p) * Math.exp(-t * 14)) * Math.min(1, t * 400);
    }, send);
  },
  bass(tr, t0, m, dur = 1.45, amp = 0.11) {
    const f = mtof(m);
    tr.add(t0, dur, amp, 0, (t) => Math.sin(TAU * f * t + 0.6 * Math.sin(TAU * f * t)) * Math.exp(-t * 1.6) * Math.min(1, t * 200), 0.05);
  },
  kick(tr, t0, amp = 0.32) {
    tr.add(t0, 0.4, amp, 0, (t) => Math.sin(TAU * (45 * t + (110 / 18) * (1 - Math.exp(-t * 18)))) * Math.exp(-t * 9), 0.05);
  },
  hat(tr, t0, amp = 0.05) {
    let lp = 0;
    tr.add(t0, 0.08, amp, 0.3, (t) => { const n = tr.noise(); const hp = n - lp; lp = n; return hp * Math.exp(-t * 60); }, 0.15);
  },
  bell(tr, t0, m, amp = 0.06, pan = 0, decay = 2.6) {
    const f = mtof(m);
    tr.add(t0, 1.8, amp, pan, (t) => (Math.sin(TAU * f * t) + 0.2 * Math.sin(TAU * f * 3 * t) * Math.exp(-t * 6)) * Math.exp(-t * decay), 0.7);
  },
};

// 按节拍铺一段配乐的便捷函数
// o: { from, to, bpm, chords: [{pad:[...], bass}], barSec, arp:[索引...], gains:{pad,pluck,drum,bass}(t)=>0..1 }
function score(tr, o) {
  const { from = 0, to, bpm = 80, chords, barSec = 6, arp = [1, 3, 2, 4, 3, 1, 4, 2], gains = {} } = o;
  const beat = 60 / bpm;
  const g = (k, t) => (gains[k] ? gains[k](t) : 0);
  const chordAt = o.chordAt || ((t) => chords[Math.floor(t / barSec) % chords.length]);
  for (let t0 = from; t0 < to; t0 += barSec) INST.pad(tr, t0 - 0.5, barSec + 2.5, chordAt(t0 + 0.01).pad, 0.035, (t) => g('pad', t));
  for (let k = 0, t = from; t < to; k++, t = from + k * beat / 2) {
    const v = g('pluck', t);
    if (v > 0.01) {
      const ch = chordAt(t);
      INST.pluck(tr, t, ch.pad[arp[k % arp.length] % ch.pad.length] + 12 + (k % 16 === 15 ? 12 : 0), 0.05 * v * (k % 4 === 0 ? 1 : 0.72), Math.sin(k * 1.7) * 0.5);
    }
  }
  for (let k = 0, t = from; t < to; k++, t = from + k * beat) {
    const b = g('bass', t), d = g('drum', t);
    if (b > 0.01 && k % 2 === 0) INST.bass(tr, t, chordAt(t).bass + 12, 1.45, 0.11 * b);
    if (d > 0.01) { INST.kick(tr, t, 0.32 * d * (k % 4 === 0 ? 1 : 0.75)); INST.hat(tr, t + beat / 2, 0.05 * d); }
  }
}

// ───── 音效 ─────
const SFX = {
  key(tr, t, amp = 0.12) {
    const f = 1800 + tr.rnd() * 900; let lp = 0;
    tr.add(t, 0.05, amp, (tr.rnd() - 0.5) * 0.4, (x) => { const n = tr.noise(); const hp = n - lp; lp = n; return hp * 0.7 * Math.exp(-x * 300) + Math.sin(TAU * f * x) * 0.4 * Math.exp(-x * 120); }, 0.05);
  },
  enter(tr, t, amp = 0.42) {
    tr.add(t, 0.5, amp, 0, (x) => Math.sin(TAU * (90 * x + 90 / 25 * (1 - Math.exp(-x * 25)))) * Math.exp(-x * 9) + tr.noise() * 0.3 * Math.exp(-x * 200), 0.3);
  },
  send(tr, t, amp = 0.18) {
    tr.add(t, 0.35, amp, 0, (x) => Math.sin(TAU * (500 * x + 900 * x * x)) * Math.exp(-x * 14) + tr.noise() * 0.2 * Math.exp(-x * 150), 0.4);
  },
  // 过渡呼啸，t 为最响时刻
  whoosh(tr, t, amp = 0.16, dur = 0.9) {
    let b1 = 0, b2 = 0;
    tr.add(t - dur * 0.28, dur, amp, 0, (x) => {
      const u = x / dur, env = Math.sin(Math.PI * u) ** 2, fc = 0.02 + 0.12 * u;
      b1 += fc * (tr.noise() - b1); b2 += fc * (b1 - b2);
      return (b1 - b2) * 6 * env;
    }, 0.5);
  },
  pop(tr, t, m = 81, amp = 0.07) { const f = mtof(m); tr.add(t, 0.4, amp, 0.2, (x) => Math.sin(TAU * f * x) * Math.exp(-x * 16) * Math.min(1, x * 800), 0.5); },
  tick(tr, t, m = 85, amp = 0.09) { const f = mtof(m); tr.add(t, 0.15, amp, 0.25, (x) => Math.sin(TAU * f * x) * Math.exp(-x * 40) + Math.sin(TAU * f * 2.7 * x) * 0.3 * Math.exp(-x * 80), 0.4); },
  blipDown(tr, t, amp = 0.11) { tr.add(t, 0.3, amp, 0, (x) => Math.sin(TAU * (950 * x - 700 * x * x)) * Math.exp(-x * 10) * Math.min(1, x * 500), 0.4); },
  blipUp(tr, t, amp = 0.1) { tr.add(t, 0.3, amp, 0, (x) => Math.sin(TAU * (500 * x + 700 * x * x)) * Math.exp(-x * 10) * Math.min(1, x * 500), 0.4); },
  thud(tr, t, amp = 0.1) { tr.add(t, 0.15, amp, 0, (x) => Math.sin(TAU * 230 * x) * Math.exp(-x * 30) + tr.noise() * 0.25 * Math.exp(-x * 250), 0.2); },
  click(tr, t, amp = 0.16) { tr.add(t, 0.04, amp, 0.2, (x) => tr.noise() * Math.exp(-x * 500) + Math.sin(TAU * 3200 * x) * 0.5 * Math.exp(-x * 300), 0.1); },
  boom(tr, t, amp = 0.45, f0 = 40) { tr.add(t, 1.2, amp, 0, (x) => Math.sin(TAU * (f0 * x + 80 / 12 * (1 - Math.exp(-x * 12)))) * Math.exp(-x * 4), 0.5); },
  // 点燃/揭幕：低频轰 + 高频闪烁
  bloom(tr, t, amp = 0.4) {
    tr.add(t, 4, amp, 0, (x) => Math.sin(TAU * 55 * x + 2 * Math.exp(-x * 5)) * Math.exp(-x * 1.3), 0.3);
    [1760, 2217, 2637, 3520].forEach((f, i) => tr.add(t + i * 0.05, 3, amp * 0.06, (i - 1.5) * 0.5, (x) => Math.sin(TAU * f * x) * Math.exp(-x * 1.5), 0.8));
  },
  riser(tr, t, dur = 2.1, amp = 0.07) {
    tr.add(t - dur, dur + 0.05, amp, 0, (x) => { const u = x / dur; return tr.noise() * u * u * (x < dur - 0.05 ? 1 : 0) * 0.6 + Math.sin(TAU * (200 + 900 * u * u) * x) * u * u * 0.15; }, 0.6);
  },
  ok(tr, t, amp = 0.07) { [88, 93].forEach((m, i) => tr.add(t + i * 0.09, 1.0, amp, 0.2, (x) => Math.sin(TAU * mtof(m) * x) * Math.exp(-x * 5), 0.6)); },
  fail(tr, t, amp = 0.07) { tr.add(t, 0.45, amp, 0, (x) => (Math.sign(Math.sin(TAU * 155 * x)) * 0.5 + Math.sin(TAU * 148 * x)) * Math.exp(-x * 6) * Math.min(1, x * 300), 0.3); },
  chime(tr, t, notes = [74, 78, 81, 86], amp = 0.06) { notes.forEach((m, i) => INST.bell(tr, t + i * 0.08, m, amp, (i - 1.5) * 0.3)); },
  clock(tr, t, alt = 0, amp = 0.13) { const f = alt ? 1900 : 2400; tr.add(t, 0.08, amp, alt ? 0.25 : -0.25, (x) => tr.noise() * 0.5 * Math.exp(-x * 700) + Math.sin(TAU * f * x) * Math.exp(-x * 90), 0.6); },
  glitch(tr, t, amp = 0.08) { tr.add(t, 0.18, amp, 0, (x) => tr.noise() * (Math.floor(x * 120) % 2) * Math.exp(-x * 14), 0.2); },
};

// 磁带停 / 再启动的时间映射：真实时间 → [音乐时间, 增益]
// 在 [a, b) 区间音乐停住；音乐时间在 a 之后被整体推迟 (b - a)
function tapeStopMap(a, b, stopDur = 0.75, startDur = 0.4) {
  return (t) => {
    if (t < a) return [t, 1];
    if (t < a + stopDur) { const u = t - a; return [a + u - (u * u) / (2 * stopDur), 1 - prog(t, a + stopDur * 0.4, a + stopDur)]; }
    if (t < b) return [a, 0];
    const u = t - b, s = stopDur / 2;
    if (u < startDur) return [a + s + (u * u) / (2 * startDur), prog(u, 0, startDur)];
    return [a + s + startDur / 2 + (u - startDur), 1];
  };
}

// 母带：软限幅 + 首尾淡入淡出 + 归一化到 peak，写 16bit 立体声 WAV
function writeWav(file, tr, o = {}) {
  const { peak = 0.89, drive = 1.1, fadeIn = 0.3, fadeOut = 1.2 } = o;
  const N = tr.n, dur = N / SR;
  let pk = 0;
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const g = Math.min(1, t / fadeIn) * (1 - prog(t, dur - fadeOut, dur));
    tr.L[i] = Math.tanh(tr.L[i] * drive) * g; tr.R[i] = Math.tanh(tr.R[i] * drive) * g;
    pk = Math.max(pk, Math.abs(tr.L[i]), Math.abs(tr.R[i]));
  }
  const norm = pk > 0 ? peak / pk : 1;
  const buf = Buffer.alloc(44 + N * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
  for (let i = 0; i < N; i++) {
    buf.writeInt16LE(Math.round(clamp(tr.L[i] * norm, -1, 1) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(clamp(tr.R[i] * norm, -1, 1) * 32767), 46 + i * 4);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
  // 响度校正：用 ffmpeg 实测整体响度，向 targetLufs（默认 -15）靠拢；变响时用软限幅保住峰值
  const target = o.targetLufs === undefined ? -15 : o.targetLufs;
  if (target !== null) {
    const { spawnSync } = require('child_process');
    const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8' });
    const m = [...(r.stderr || '').matchAll(/I:\s+(-?[\d.]+) LUFS/g)].pop();
    if (m && Number.isFinite(+m[1]) && Math.abs(+m[1] - target) > 0.5) {
      const k = Math.pow(10, (target - +m[1]) / 20);
      for (let i = 0; i < N; i++) {
        const l = Math.tanh(tr.L[i] * norm * k / peak) * peak, rr = Math.tanh(tr.R[i] * norm * k / peak) * peak;
        buf.writeInt16LE(Math.round(clamp(l, -1, 1) * 32767), 44 + i * 4);
        buf.writeInt16LE(Math.round(clamp(rr, -1, 1) * 32767), 46 + i * 4);
      }
      fs.writeFileSync(file, buf);
      return { file, gain: norm * k, lufs: target, measured: +m[1] };
    }
    return { file, gain: norm, lufs: m ? +m[1] : null };
  }
  return { file, gain: norm };
}

// 用 ffmpeg 把任意音频解码成 48k 单声道 Float32Array（旁白 mp3/wav、外部音效都行）
function loadAudio(file) {
  const { spawnSync } = require('child_process');
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error('无法解码音频：' + file);
  const b = r.stdout;
  return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
}

// 旁白压低配乐（ducking）：ranges = [[开始, 结束], ...]，返回 t → 增益
function duck(ranges, depth = 0.3, attack = 0.25, release = 0.6) {
  return (t) => {
    let g = 1;
    for (const [a, b] of ranges) {
      const u = Math.min(clamp((t - (a - attack)) / attack), 1 - clamp((t - b) / release));
      g = Math.min(g, 1 - (1 - depth) * u);
    }
    return g;
  };
}

// 读取 film tts 生成的旁白（src/vo.js + out/vo/*.wav），放进轨道，返回旁白区间（用于 duck）
function placeVoice(tr, projDir, TL, gain = 1) {
  const fs2 = require('fs');
  let VO = {};
  try { VO = require(path.join(projDir, 'src', 'vo.js')); } catch (e) { /* 还没合成旁白 */ }
  const ranges = [];
  for (const v of TL.VO || []) {
    const info = VO.lines && VO.lines[v.id];
    const file = path.join(projDir, 'out', 'vo', v.id + '.wav');
    if (!info || !fs2.existsSync(file)) continue;
    tr.addBuffer(v.t, loadAudio(file), gain * (v.gain || 1));
    ranges.push([v.t, v.t + info.dur]);
  }
  return ranges;
}

// 常用和弦（D 大调，温暖、适合科普/叙事）
const CHORDS = {
  D: [
    { pad: [50, 57, 61, 64, 66], bass: 38 }, // Dmaj9
    { pad: [47, 54, 57, 61, 62], bass: 35 }, // Bm9
    { pad: [43, 50, 54, 57, 59], bass: 31 }, // Gmaj9
    { pad: [45, 52, 54, 59, 62], bass: 33 }, // A6sus
  ],
};

// 更多调式，按情绪选：D 温暖叙事、Am 克制沉思、C 明亮轻快、Fm 悬疑科技
CHORDS.Am = [
  { pad: [45, 52, 57, 60, 64], bass: 33 }, // Am9
  { pad: [41, 48, 53, 57, 60], bass: 29 }, // Fmaj7
  { pad: [43, 50, 55, 59, 62], bass: 31 }, // G6
  { pad: [40, 47, 52, 55, 59], bass: 28 }, // Em7
];
CHORDS.C = [
  { pad: [48, 55, 60, 64, 67], bass: 36 }, // C
  { pad: [45, 52, 57, 60, 64], bass: 33 }, // Am
  { pad: [41, 48, 53, 57, 60], bass: 29 }, // F
  { pad: [43, 50, 55, 59, 62], bass: 31 }, // G
];
CHORDS.Fm = [
  { pad: [41, 48, 53, 56, 60], bass: 29 }, // Fm
  { pad: [37, 44, 49, 53, 56], bass: 25 }, // Db
  { pad: [39, 46, 51, 55, 58], bass: 27 }, // Eb
  { pad: [36, 43, 48, 52, 55], bass: 24 }, // C
];

module.exports = { SR, TAU, mtof, clamp, prog, win, rng, Track, reverb, INST, score, SFX, tapeStopMap, writeWav, CHORDS, loadAudio, duck, placeVoice };
