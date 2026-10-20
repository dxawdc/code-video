// 合成配乐与音效，并混入旁白 → out/soundtrack.wav
// 调式：CHORDS.D 温暖叙事 / Am 克制沉思 / C 明亮轻快 / Fm 悬疑科技
const path = require('path');
const { Track, score, SFX, CHORDS, win, writeWav, duck, placeVoice } = require(path.resolve(__dirname, '{{KIT_NODE}}', 'lib/synth.js'));
const TL = require('./src/timeline.js');

const music = new Track(TL.DURATION + 2);
score(music, {
  to: TL.DURATION + 1, bpm: 80, chords: CHORDS.D,
  gains: {
    pad: (t) => win(t, 0, TL.DURATION, 2, 1.5),
    pluck: (t) => 0.8 * win(t, 1.0, TL.DURATION - 0.5, 0.3, 1.0),
    bass: (t) => 0.5 * win(t, 3.0, TL.DURATION, 1, 1),
  },
});
music.applyReverb(0.55);

const mix = new Track(TL.DURATION);
const voice = new Track(TL.DURATION);
const ranges = placeVoice(voice, __dirname, TL, 1.0);   // 没有旁白时为空
mix.mix(music, 0.85, (t) => [t, duck(ranges, 0.3)(t)]); // 旁白期间配乐压到 30%
for (const e of TL.SFX) if (SFX[e.type]) SFX[e.type](mix, e.t);
mix.applyReverb(0.5);
mix.mix(voice, 1.0);

const { file, gain } = writeWav(path.join(__dirname, 'out', 'soundtrack.wav'), mix);
console.log('完成:', file, '归一化增益', gain.toFixed(2), ranges.length ? `，含旁白 ${ranges.length} 句` : '');
