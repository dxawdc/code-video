import React from 'react';
import { Composition } from 'remotion';
import { Main } from './Main';
// 和 audio.js 共用同一份时间表
// @ts-ignore
import TL from './timeline.js';

export const Root: React.FC = () => (
  <Composition id="Main" component={Main} durationInFrames={Math.round(TL.DURATION * TL.FPS)} fps={TL.FPS} width={TL.W} height={TL.H} />
);
