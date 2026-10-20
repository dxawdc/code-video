import React from 'react';
import { AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from 'remotion';
// @ts-ignore
import TL from './timeline.js';

const C = { bg: '#0c0b0a', cream: '#f1ebdf', clay: '#d97757', amber: '#f2b36b', teal: '#7fd0c4' };
const DATA = [32, 48, 41, 66, 58, 84, 97];
const LABELS = ['一', '二', '三', '四', '五', '六', '日'];

const Title: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const chars = [...'{{TITLE}}'];
  return (
    <AbsoluteFill style={{ alignItems: 'center', top: '14%', flexDirection: 'row', justifyContent: 'center', height: 200 }}>
      {chars.map((ch, i) => {
        const s = spring({ frame: f - i * 3, fps, config: { damping: 12, mass: 0.6 } });
        return (
          <span key={i} style={{ display: 'inline-block', font: '600 120px "Noto Serif SC"', color: C.cream, letterSpacing: '0.1em',
            transform: `translateY(${(1 - s) * 80}px) scale(${0.6 + 0.4 * s})`, opacity: s }}>{ch}</span>
        );
      })}
    </AbsoluteFill>
  );
};

const Bars: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const max = Math.max(...DATA);
  return (
    <AbsoluteFill style={{ top: '40%', left: '12%', width: '76%', height: 420, flexDirection: 'row', alignItems: 'flex-end', gap: 40 }}>
      {DATA.map((v, i) => {
        const s = spring({ frame: f - i * 4, fps, config: { damping: 14 } });
        const hot = i === DATA.length - 1;
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div style={{ font: '600 30px "Cascadia Code"', color: hot ? C.amber : 'rgba(241,235,223,.7)', opacity: s }}>{Math.round(v * s)}</div>
            <div style={{ width: '100%', height: (v / max) * 300 * s, borderRadius: 14,
              background: hot ? `linear-gradient(${C.amber}, ${C.clay})` : 'rgba(241,235,223,.16)', boxShadow: hot ? `0 0 40px ${C.clay}88` : 'none' }} />
            <div style={{ font: '400 24px "Noto Sans SC"', color: 'rgba(241,235,223,.5)' }}>周{LABELS[i]}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const Caption: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  const cap = TL.CAPS.find(([a, b]: number[]) => t >= a && t <= b);
  if (!cap) return null;
  const o = Math.min(interpolate(t, [cap[0], cap[0] + 0.25], [0, 1], { extrapolateRight: 'clamp' }), interpolate(t, [cap[1] - 0.3, cap[1]], [1, 0], { extrapolateLeft: 'clamp' }));
  const parts = String(cap[2]).split('**');
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 40 }}>
      <div style={{ font: '400 36px "Noto Sans SC"', color: C.cream, opacity: o, textShadow: '0 2px 12px rgba(0,0,0,.8)', letterSpacing: 1.5 }}>
        {parts.map((p, i) => (i % 2 ? <b key={i} style={{ color: C.amber }}>{p}</b> : <span key={i}>{p}</span>))}
      </div>
    </AbsoluteFill>
  );
};

export const Main: React.FC = () => {
  const f = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const glow = interpolate(f, [0, 2 * fps], [0, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const fade = interpolate(f, [0, 15, durationInFrames - 18, durationInFrames], [0, 1, 1, 0]);
  return (
    <AbsoluteFill style={{ background: C.bg, opacity: fade }}>
      <AbsoluteFill style={{ background: `radial-gradient(1100px 700px at 50% 30%, rgba(217,119,87,${0.28 * glow}), transparent 65%)` }} />
      <Sequence from={Math.round(0.4 * fps)}><Title /></Sequence>
      <Sequence from={Math.round(1.6 * fps)}><Bars /></Sequence>
      <Caption />
    </AbsoluteFill>
  );
};
