# 声音：配乐、音效、旁白

所有声音默认由代码合成（`<kit>/lib/synth.js`），项目里的 `audio.js` 生成 `out/soundtrack.wav`，渲染时自动混入。不依赖任何音源文件。

## audio.js 骨架

```js
const { Track, score, SFX, CHORDS, win, writeWav, duck, placeVoice, tapeStopMap, loadAudio } = require('<kit>/lib/synth.js');
const TL = require('./src/timeline.js');

const music = new Track(TL.DURATION + 2);
score(music, {
  to: TL.DURATION + 1, bpm: 80, chords: CHORDS.D,          // 调式见下
  gains: {                                                // 各声部强度曲线：t → 0..1
    pad:   (t) => win(t, 0, TL.DURATION, 2, 1.5),
    pluck: (t) => 0.8 * win(t, 6.6, 57.4, 0.5, 0.4),
    bass:  (t) => 0.6 * win(t, 11, 57, 1, 0.5),
    drum:  (t) => win(t, 32, 57.3, 0.1, 0.3),
  },
});
music.applyReverb(0.55);

const mix = new Track(TL.DURATION);
const voice = new Track(TL.DURATION);
const ranges = placeVoice(voice, __dirname, TL);           // 旁白（film tts 之后才有）
mix.mix(music, 0.85, (t) => [t, duck(ranges, 0.3)(t)]);    // 说话时配乐压到 30%
for (const e of TL.SFX) SFX[e.type] && SFX[e.type](mix, e.t);
mix.applyReverb(0.5);
mix.mix(voice, 1.0);
writeWav(__dirname + '/out/soundtrack.wav', mix);          // 默认校正到 −15 LUFS
```

## 配乐设计

1. **选调式**（`CHORDS.*`，每个和弦 `barSec` 秒，默认 6）：
   - `D`：Dmaj9–Bm9–Gmaj9–A6sus，温暖叙事（默认）
   - `Am`：Am9–Fmaj7–G6–Em7，克制、沉思
   - `C`：C–Am–F–G，明亮、轻快
   - `Fm`：Fm–Db–Eb–C，悬疑、科技
   - 自定义：`{ pad: [MIDI…], bass: MIDI }` 数组。
2. **速度**：叙事 72~88 bpm，宣传 96~120，MV 按歌。
3. **强度曲线**跟着情绪曲线：开场只有 pad；进入正文加拨弦；高潮段加低音和鼓；章节卡回落到 pad；结尾全体收在主和弦。
4. **留白**：冻结、反转、金句前 0.5~1 秒让音乐变薄或停住，比一直满铺更有力。
5. 声部：`INST.pad / pluck / bass / kick / hat / bell`，也可以 `tr.add(t0, dur, amp, pan, (x)=>样本)` 自己写。

## 音效（SFX）对照

| 画面动作 | 音效 |
|---|---|
| 打字 / 回车 / 发送 | `key` / `enter` / `send` |
| 元素出现、数据落位 | `pop`（可传音高，按类型分音高更有秩序感） |
| 逐字/逐个输出 | `tick` |
| 转场、镜头大动 | `whoosh`（t 为最响时刻） |
| 点燃、揭幕、片名 | `bloom`；之前 2 秒加 `riser` |
| 下发 / 返回 | `blipDown` / `blipUp` |
| 落地、撞击 | `thud` / `boom` |
| 点击按钮 | `click` |
| 成功 / 失败 | `ok` / `fail`；完成时 `chime` |
| 时钟、倒计时 | `clock`（交替传 alt） |
| 故障、打断 | `glitch` |

规则：音效在**动作发生的那一帧**；同一时刻只突出一个；重复动作（逐字）音量要小（0.05~0.09）。

## 声音讲故事的技巧

- **磁带停**：`mix.mix(music, 0.85, tapeStopMap(暂停开始, 恢复时刻))`——暂停时配乐像磁带降速停下，恢复时再转起来。
- **世界静止**：冻结段只留钟表滴答。
- **主题音**：同一个铃音（`bell` 某个音高）在关键时刻反复出现，观众会记住。

## 旁白

1. 在 `src/timeline.js` 写：
   ```js
   TL.VO = [
     { id: 'v1', t: 1.2, text: '按下回车之后，我会先把整页上下文读一遍。' },
     { id: 'v2', t: 6.0, text: '然后一个 token 接一个 token 地写出回答。', rate: '-5%' },
   ];
   TL.VOICE = 'zh-CN-XiaoxiaoNeural';
   ```
2. `film tts <项目>`：每句合成到 `out/vo/<id>.wav`（自动去首尾静音），时长和分句写进 `src/vo.js`；时间表会自动把分句加进字幕（`cap: false` 可关）。
3. `film lint <项目>`：检查旁白重叠/超时。重叠就把后一句的 `t` 往后挪，或拆短。
4. `node audio.js`（或 `film all`）：旁白混入并自动压低配乐。

引擎：默认 edge-tts（在线、自然，需要联网）；无网时 Windows 退回系统语音（SAPI），macOS 退回 `say`。音色见 `cli.md`。

### 旁白驱动的排片方法

先写全部旁白 → `film tts` → 读 `src/vo.js` 拿到每句时长 → 把每幕的起止对齐到对应旁白：

```js
const VOD = (id) => (VO.lines[id] ? VO.lines[id].dur : 3);   // 在 timeline.js 里可用
TL.SCENES = { intro: [0, 1.2 + VOD('v1') + 0.5], ... };
```

## 外部音乐

已有授权音乐时：`film bgm <成片.mp4> <music.mp3> --gain -14 --duck`（循环/裁剪到片长、淡入淡出、人声处压低、响度标准化）。注意版权。

## 响度标准

- 成片 −16~−14 LUFS（`writeWav` 默认校正到 −15），真峰值 ≤ −1 dBTP。
- 旁白要比配乐高 8~12 dB（`duck` 深度 0.3 约 −10 dB）。
- `film verify` 会报实测值。

## 诚实说明

你听不到声音。交付时必须说明“声音只测了响度，未经人耳试听”，并建议用户先听一遍。
