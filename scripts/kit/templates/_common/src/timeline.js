// 共享时间表：画面、配乐、旁白、字幕都从这里读时刻，保证音画同步。改节奏只改这里。
(function (root) {
  // vo.js 由 `film tts` 生成（旁白时长与分句时间）；还没合成时是空的
  let VO = {};
  if (typeof module !== 'undefined') { try { VO = require('./vo.js'); } catch (e) { VO = {}; } }
  else VO = root.VO || {};

  const TL = { FPS: 30, DURATION: 8, W: {{W}}, H: {{H}} };

  // 需要预加载的字体：[CSS 字体串, 示例字]
  const SAMPLE = '{{TITLE}}这是一部用代码画出来的短片';
  TL.FONTS = [
    ['600 40px "Noto Serif SC"', SAMPLE], ['300 40px "Noto Serif SC"', SAMPLE],
    ['300 40px "Noto Sans SC"', SAMPLE], ['400 40px "Noto Sans SC"', SAMPLE], ['600 40px "Noto Sans SC"', SAMPLE],
    ['400 20px "Cascadia Code"', 'abc123'],
  ];

  // 字幕：[开始, 结束, 文本]，**包起来**的是强调色。中文阅读速度按每秒 4~6 字安排。
  TL.CAPS = [
    [3.2, 7.4, '这是 **{{TYPE}}** 模板示例'],  // 换成你的字幕
  ];

  // 旁白（可选）：{ id, t: 开始秒, text, voice?, rate?, cap?: false 不出字幕 }
  // 写好后运行 `film tts <项目>` 合成语音，时长会写进 src/vo.js，字幕自动按分句生成。
  TL.VO = [
    // { id: 'v1', t: 1.0, text: '这是一段示例旁白。' },
  ];
  TL.VOICE = 'zh-CN-XiaoxiaoNeural'; // 其他：zh-CN-YunxiNeural（男声）、zh-CN-YunjianNeural（浑厚）、zh-CN-XiaoyiNeural（活泼）

  // 把旁白分句变成字幕
  for (const v of TL.VO) {
    const info = VO.lines && VO.lines[v.id];
    if (!info || v.cap === false) continue;
    for (const [a, b, s] of info.chunks) TL.CAPS.push([v.t + a, v.t + b, s]);
  }
  TL.CAPS.sort((x, y) => x[0] - y[0]);

  // 音效事件（audio.js 使用）：type 见 kit/lib/synth.js 的 SFX
  TL.SFX = [
    { t: 1.0, type: 'bloom' },
    { t: 3.2, type: 'pop' },
  ];

  if (typeof module !== 'undefined') module.exports = TL;
  else root.TL = TL;
})(typeof window !== 'undefined' ? window : globalThis);
