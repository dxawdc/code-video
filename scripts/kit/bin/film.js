#!/usr/bin/env node
// film：用代码做视频的命令行。九种技术栈共用的新建、预览、检查、旁白、渲染、校验、交付工具。
// 用法：film <命令> [参数]（或 node <kit>/bin/film.js），不带参数看帮助。
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const { spawn, spawnSync, execFileSync } = require('child_process');

const KIT = path.resolve(__dirname, '..');
const ROOT = path.resolve(process.env.FILM_ROOT || process.cwd()); // 预览服务器的根目录
// JS 依赖可以装在 kit/node_modules（独立安装）或上一级 node_modules（工作区），逐个包查找
const LIBS = [path.join(KIT, 'node_modules'), path.join(KIT, '..', 'node_modules')].filter((d) => fs.existsSync(d));
const libDir = (name) => LIBS.find((d) => fs.existsSync(path.join(d, name, 'package.json'))) || LIBS[0] || path.join(KIT, 'node_modules');
const LIB = libDir('puppeteer-core');
const IS_WIN = process.platform === 'win32', IS_MAC = process.platform === 'darwin';
const VERSION = (() => { try { return require(path.join(KIT, 'package.json')).version || 'dev'; } catch (e) { return 'dev'; } })();

// ───── 外部程序定位（可用环境变量覆盖：CHROME_PATH / BLENDER_PATH / PYTHON） ─────
const which = (cmd) => {
  const r = spawnSync(IS_WIN ? 'where' : 'which', [cmd], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.split(/\r?\n/)[0].trim() : null;
};
const CHROME = (() => {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const L = process.env.LOCALAPPDATA || '';
  const cands = IS_WIN ? [
    'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    path.join(L, 'Google/Chrome/Application/chrome.exe'),
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  ] : IS_MAC ? [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ] : ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge'].map(which).filter(Boolean);
  return cands.find((p) => p && fs.existsSync(p)) || null;
})();
const findBlender = () => {
  if (process.env.BLENDER_PATH && fs.existsSync(process.env.BLENDER_PATH)) return process.env.BLENDER_PATH;
  if (IS_WIN) {
    const base = 'C:/Program Files/Blender Foundation';
    if (fs.existsSync(base)) {
      const dirs = fs.readdirSync(base).filter((d) => fs.existsSync(path.join(base, d, 'blender.exe'))).sort();
      if (dirs.length) return path.join(base, dirs[dirs.length - 1], 'blender.exe');
    }
  }
  if (IS_MAC && fs.existsSync('/Applications/Blender.app/Contents/MacOS/Blender')) return '/Applications/Blender.app/Contents/MacOS/Blender';
  return which('blender');
};
let _py;
const PYTHON = () => {
  if (_py !== undefined) return _py;
  for (const c of [process.env.PYTHON, 'python', 'python3', 'py'].filter(Boolean)) {
    const r = spawnSync(c, ['--version'], { encoding: 'utf8' });
    if (r.status === 0 && /Python 3/.test(r.stdout + r.stderr)) return (_py = c);
  }
  return (_py = null);
};
const pyHas = (mod) => !!PYTHON() && spawnSync(PYTHON(), ['-c', `import ${mod}`]).status === 0;
const hasLib = (name) => LIBS.some((d) => fs.existsSync(path.join(d, name, 'package.json')));

const TYPES = {
  canvas: 'Canvas 2D（默认）：排版、示意图、粒子光效',
  shader: 'GLSL 着色器背景/转场 + Canvas 文字层',
  three: 'Three.js 3D 场景（含辉光后期）',
  p5brush: 'p5.js + p5.brush 手绘水彩/铅笔，逐格“抖动”动画',
  dom: 'HTML/CSS/SVG + GSAP 时间线 + Lottie，截图采集',
  hyperframes: 'HeyGen HyperFrames（HTML + data-* + GSAP），用它自带渲染器',
  remotion: 'Remotion（React + TypeScript）',
  manim: 'Manim（3Blue1Brown 风格数学/算法讲解，Python）',
  blender: 'Blender Python 脚本建模、打光、EEVEE 渲染',
};
const BROWSER_TYPES = new Set(['canvas', 'shader', 'three', 'p5brush', 'dom']);
const DEMO_TITLES = { canvas: '代码做视频', shader: '着色器', three: '三维晶体', p5brush: '手绘小镇', dom: '网页动效', hyperframes: '超帧', remotion: '数据周报', manim: '正弦与变形', blender: '程序化三维' };
const SIZES = { '16:9': [1920, 1080], landscape: [1920, 1080], '9:16': [1080, 1920], portrait: [1080, 1920], '1:1': [1080, 1080], square: [1080, 1080], '4:3': [1440, 1080], '3:4': [1080, 1440], '4k': [3840, 2160] };

const HELP = `
film ${VERSION} —— 用代码做视频（九种技术栈）

开始
  doctor                              体检：Node/ffmpeg/Chrome/各 JS 库/Python/Manim/Blender/字体，列出可用技术栈
  setup [--lite] [--tts] [--python] [--blender]
                                      安装依赖（npm 库；--tts 装 edge-tts；--python 装 manim+edge-tts；--blender）
  demo [目录] [--quick]               一键演示：每种可用技术栈各出 8 秒，拼成合集（--quick 只做 4 种）
  new <目录> [--type 类型] [--title 片名] [--size 1920x1080|9:16|1:1|4:3|4k]
                                      用模板新建项目。类型：
${Object.entries(TYPES).map(([k, v]) => `      ${k.padEnd(12)}${v}`).join('\n')}

制作
  preview <项目> [--port 5178]        起本地服务并打开浏览器实时预览（空格播放，地址加 #秒数 跳转）
  serve [端口]                        只起预览服务器（根目录 = 当前目录）
  lint <项目>                         检查时间表：字幕阅读速度/重叠/越界、旁白、配乐是否过期、尺寸一致
  tts <项目> [--voice 名] [--engine edge|sapi|say] [--force]
                                      把 TL.VO 合成旁白 → out/vo/*.wav + src/vo.js（自动分句字幕）
  stills <项目> <时刻> [--batch 名] [--cols 2]
                                      导出静帧 + 联系表；时刻 "3,12.5,40" 或 "auto:12"
  sheet <项目|mp4> <时刻> [--cols 3]  只出联系表（任何 mp4 都行）

出片
  video <项目> [--from 秒 --to 秒] [--samples N]
                                      渲染母版（按 film.json 的 type 选渲染器，自动混入 out/soundtrack.wav）
  all <项目>                          lint → node audio.js → video → share → verify → poster 一条龙
  mux <视频> <wav> [--out 文件]       换/加音轨并统一编码
  bgm <视频> <音乐文件> [--gain -14] [--duck] [--out 文件]
                                      叠加外部配乐（循环/裁剪/淡出），--duck 人声处自动压低，并做响度标准化
  concat <mp4...> --out 文件 [--xfade 0.6]   交叉淡化拼接（尺寸/帧率/音轨自动统一）

交付
  share <mp4> [--crf 23]              分享版（约母版 1/10 体积）
  verify <mp4> [--duration 秒]        校验：编码/全量解码/帧数/响度/真峰值/全黑 → *.verification.json
  poster <项目|mp4> [--t 秒]          封面：16:9 原图 + 3:4 + 1:1 裁切
  gif <项目|mp4> [--from 0 --to 6 --width 720 --fps 15]   预览动图
  srt <项目> [--embed mp4]            导出 SRT 字幕；--embed 写入 MP4 软字幕轨

环境变量：CHROME_PATH、BLENDER_PATH、PYTHON、FILM_ROOT（预览根目录）
`;

// ───── 通用 ─────
function parseArgs(argv) {
  const pos = [], opt = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) { const k = argv[i].slice(2); opt[k] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true; }
    else pos.push(argv[i]);
  }
  return { pos, opt };
}
function parseTimes(spec, duration) {
  const m = /^auto(?::(\d+))?$/.exec(spec || 'auto');
  if (m) { const n = +(m[1] || 12); return Array.from({ length: n }, (_, i) => +(duration * (0.02 + 0.96 * (i / Math.max(1, n - 1)))).toFixed(2)); }
  return String(spec).split(',').map(Number).filter((x) => !Number.isNaN(x));
}
function parseSize(s) {
  if (!s) return [1920, 1080];
  if (SIZES[s]) return SIZES[s];
  const m = /^(\d+)x(\d+)$/i.exec(s);
  if (!m) throw new Error(`尺寸写法：1920x1080 / 9:16 / 1:1 / 4:3 / 4k，收到 ${s}`);
  return [+m[1] - (+m[1] % 2), +m[2] - (+m[2] % 2)];
}
const sanitize = (s) => String(s).replace(/[\\/:*?"<>|]/g, '').trim() || 'film';
const ff = (args, o = {}) => spawnSync('ffmpeg', ['-hide_banner', '-y', ...args], { encoding: 'utf8', maxBuffer: 1 << 28, ...o });
const readFilm = (dir) => { const f = path.join(dir, 'film.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, '')) : {}; };
const projType = (dir) => readFilm(dir).type || 'canvas';
const under = (child, parent) => { const r = path.relative(parent, child); return r && !r.startsWith('..') && !path.isAbsolute(r); };
const MASTER = ['-c:v', 'libx264', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-tune', 'grain', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709'];
// 外部渲染器统一关掉遥测与联网检查
const QUIET_ENV = { ...process.env, HYPERFRAMES_SKIP_SKILLS: '1', DO_NOT_TRACK: '1', REMOTION_DISABLE_TELEMETRY: '1' };
const run = (cmd, args, cwd) => { const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', env: QUIET_ENV }); if (r.status !== 0) throw new Error(`${path.basename(cmd)} ${args[0] || ''} 失败（退出码 ${r.status}）`); };
const ok = (b) => (b ? '✓' : '✗');
function probe(file) {
  return JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], { encoding: 'utf8' }));
}
const pngSize = (f) => { const b = fs.readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
const sizeTag = (w, h, fps) => (w === 1920 && h === 1080 ? `1080p${fps}` : `${w}x${h}p${fps}`);
const MP4_RE = /_(\d+x)?\d+p\d+\.mp4$/;
function findMaster(projDir) {
  const list = fs.readdirSync(projDir).filter((f) => MP4_RE.test(f) && !/片段/.test(f)).map((f) => path.join(projDir, f));
  if (!list.length) throw new Error('项目里还没有成片，先运行 film video ' + projDir);
  return list.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
}
const resolveVideo = (p) => { const x = path.resolve(p); return fs.statSync(x).isDirectory() ? findMaster(x) : x; };
function loadTL(projDir) {
  const f = path.join(projDir, 'src', 'timeline.js');
  if (!fs.existsSync(f)) return null;
  for (const k of Object.keys(require.cache)) if (k.startsWith(path.join(projDir, 'src'))) delete require.cache[k];
  return require(f);
}
const openUrl = (u) => { try { if (IS_WIN) spawn('cmd', ['/c', 'start', '', u], { detached: true, stdio: 'ignore' }); else spawn(IS_MAC ? 'open' : 'xdg-open', [u], { detached: true, stdio: 'ignore' }); } catch (e) { /* 打不开就算了 */ } };

// ───── 静态服务器（渲染和预览共用） ─────
// /__kit/ → kit，/__lib/ → JS 依赖，/__proj/ → 根目录之外的项目，其余 → 根目录
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.mp4': 'video/mp4', '.webm': 'video/webm', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff2': 'font/woff2', '.glsl': 'text/plain; charset=utf-8', '.frag': 'text/plain; charset=utf-8', '.map': 'application/json' };
function listProjects(dir, depth = 2) {
  const out = [];
  const walk = (d, lv) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (!e.isDirectory() || e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'out') continue;
      const p = path.join(d, e.name);
      if (fs.existsSync(path.join(p, 'index.html'))) out.push(p);
      else if (lv < depth) walk(p, lv + 1);
    }
  };
  walk(dir, 1);
  return out;
}
function startServer(port = 0, projMount = null) {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]);
    let base = ROOT, sub = rel;
    for (const [pre, dir] of [['/__kit/', KIT], ['/__lib/', null], ['/__proj/', projMount]]) {
      if (!rel.startsWith(pre) || (pre !== '/__lib/' && !dir)) continue;
      sub = rel.slice(pre.length - 1);
      base = pre === '/__lib/' ? libDir(sub.split('/')[1].startsWith('@') ? sub.split('/').slice(1, 3).join('/') : sub.split('/')[1]) : dir;
    }
    if (rel === '/') {
      const list = listProjects(ROOT);
      res.writeHead(200, { 'Content-Type': MIME['.html'] });
      return res.end(`<meta charset="utf-8"><title>视频项目</title><body style="background:#111;color:#eee;font:16px sans-serif;padding:24px"><h3>视频项目（${ROOT}）</h3>${list.map((p) => { const r = path.relative(ROOT, p).split(path.sep); return `<p><a style="color:#d97757" href="/${r.map(encodeURIComponent).join('/')}/">${r.join(' / ')}</a> <small style="opacity:.5">${projType(p)}</small></p>`; }).join('') || '<p>当前目录下没有带 index.html 的项目</p>'}`);
    }
    let p = path.join(base, sub);
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
    if (!(p === base || under(p, base)) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise((r, j) => { server.once('error', j); server.listen(port, '127.0.0.1', () => r(server)); });
}
function projectUrl(server, projDir) {
  const port = server.address().port;
  const rel = under(projDir, ROOT) ? '/' + path.relative(ROOT, projDir).split(path.sep).map(encodeURIComponent).join('/') + '/' : '/__proj/';
  return `http://127.0.0.1:${port}${rel}index.html`;
}

// ───── 浏览器 ─────
async function openPage(projDir) {
  if (!CHROME) throw new Error('没找到 Chrome/Edge/Chromium。安装 Chrome，或设置环境变量 CHROME_PATH');
  const puppeteer = require('puppeteer-core');
  if (!fs.existsSync(path.join(projDir, 'index.html'))) throw new Error('找不到 ' + path.join(projDir, 'index.html'));
  const film = readFilm(projDir);
  const vw = film.width || 1920, vh = film.height || 1080;
  const server = await startServer(0, under(projDir, ROOT) ? null : projDir);
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    args: ['--force-device-scale-factor=1', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required', ...(IS_WIN ? ['--use-angle=d3d11'] : []), ...(process.platform === 'linux' ? ['--no-sandbox'] : [])],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: vw, height: vh, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => { errors.push(e.message); console.error('页面错误:', e.message); });
  page.on('console', (m) => {
    const s = m.text();
    if (m.type() !== 'error' || /404|ERR_FILE_NOT_FOUND|soundtrack\.wav/.test(s)) return; // 配乐未生成时的 404 可忽略
    errors.push(s); console.error('控制台:', s);
  });
  await page.goto(projectUrl(server, projDir) + '?render=1', { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.ready, { timeout: 60000 });
  await page.evaluate(() => window.ready);
  const info = await page.evaluate(() => {
    const f = window.FILM || (window.TL && { fps: window.TL.FPS, duration: window.TL.DURATION });
    if (!f) return null;
    const capture = f.capture || 'canvas';
    const okay = capture === 'dom' ? typeof window.seek === 'function' : typeof window.renderFrame === 'function';
    const c = document.querySelector('canvas');
    return okay ? { fps: f.fps, duration: f.duration, title: f.title || document.title, capture, width: f.width || (c && c.width) || 1920, height: f.height || (c && c.height) || 1080 } : null;
  });
  if (!info) throw new Error('页面未满足渲染约定：需要 window.FILM 与 window.renderFrame（DOM 模式为 window.seek），见 KIT.mountPlayer / KIT.mountStage');
  if (info.capture === 'dom' && (info.width !== vw || info.height !== vh)) await page.setViewport({ width: info.width, height: info.height, deviceScaleFactor: 1 });
  const grab = async (i) => {
    if (info.capture === 'dom') {
      await page.evaluate((t) => window.seek(t), i / info.fps);
      return page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: info.width, height: info.height } });
    }
    return decode(await page.evaluate((k) => window.renderFrame(k), i));
  };
  const close = async () => { await browser.close(); server.close(); };
  return { page, info, errors, grab, close };
}
const decode = (u) => Buffer.from(u.slice(u.indexOf(',') + 1), 'base64');

// ───── 联系表 ─────
const LABEL_FONT = IS_WIN ? 'C\\:/Windows/Fonts/consola.ttf' : IS_MAC ? '/System/Library/Fonts/Menlo.ttc' : '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf';
function makeSheets(files, outDir, cols = 2, labels = []) {
  const [iw, ih] = pngSize(files[0]);
  const per = cols * cols, tw = Math.round(iw / cols / 2) * 2, th = Math.round(ih / cols / 2) * 2;
  const fontOk = fs.existsSync(LABEL_FONT.replace('C\\:', 'C:'));
  const out = [];
  for (let k = 0; k < files.length; k += per) {
    const group = files.slice(k, k + per);
    const args = [];
    group.forEach((f) => args.push('-i', f));
    let fc = group.map((_, i) => {
      const lab = labels[k + i] != null && fontOk ? `,drawtext=text='${labels[k + i]}':x=12:y=10:fontsize=${Math.round(Math.min(tw, th) / 14)}:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=6:fontfile='${LABEL_FONT}'` : '';
      return `[${i}:v]scale=${tw}:${th}${lab}[v${i}]`;
    }).join(';');
    const layout = group.map((_, i) => `${(i % cols) * tw}_${Math.floor(i / cols) * th}`).join('|');
    fc += ';' + group.map((_, i) => `[v${i}]`).join('') + (group.length > 1 ? `xstack=inputs=${group.length}:layout=${layout}:fill=gray[o]` : 'null[o]');
    const file = path.join(outDir, `sheet${String(k / per + 1).padStart(2, '0')}.png`);
    const r = ff(['-loglevel', 'error', ...args, '-filter_complex', fc, '-map', '[o]', file]);
    if (r.status !== 0) throw new Error(r.stderr);
    out.push(file);
  }
  return out;
}
function nextBatch(base) {
  fs.mkdirSync(base, { recursive: true });
  for (let i = 1; ; i++) { const d = path.join(base, 'b' + i); if (!fs.existsSync(d)) { fs.mkdirSync(d); return d; } }
}

async function cmdStills(proj, spec, opt, sheetOnly = false) {
  const projDir = path.resolve(proj);
  if (/\.(mp4|mov|mkv|webm)$/i.test(projDir)) return sheetFromVideo(projDir, spec, opt);
  const type = projType(projDir);
  if (!BROWSER_TYPES.has(type)) return sheetFromVideo(findMaster(projDir), spec, opt);
  const { info, grab, close } = await openPage(projDir);
  const times = parseTimes(spec, info.duration);
  const dir = opt.batch ? path.join(projDir, 'out', 'stills', opt.batch) : nextBatch(path.join(projDir, 'out', 'stills'));
  fs.mkdirSync(dir, { recursive: true });
  const files = [];
  for (const t of times) {
    const f = path.join(dir, `t${t.toFixed(2).padStart(7, '0')}.png`);
    fs.writeFileSync(f, await grab(Math.round(t * info.fps)));
    files.push(f);
  }
  await close();
  const sheets = makeSheets(files, dir, +(opt.cols || 2), times.map((t) => t.toFixed(2) + 's'));
  if (!sheetOnly) files.forEach((f) => console.log(f));
  sheets.forEach((s) => console.log(s));
}
function sheetFromVideo(file, spec, opt) {
  const dur = +probe(file).format.duration;
  const times = parseTimes(spec, dur);
  const dir = nextBatch(path.join(path.dirname(file), 'out', 'stills'));
  const files = times.map((t) => {
    const f = path.join(dir, `t${t.toFixed(2).padStart(7, '0')}.png`);
    const r = ff(['-loglevel', 'error', '-ss', String(t), '-i', file, '-frames:v', '1', f]);
    if (r.status !== 0) throw new Error(`抽帧失败 ${t}s：${r.stderr}`);
    return f;
  });
  makeSheets(files, dir, +(opt.cols || 2), times.map((t) => t.toFixed(2) + 's')).forEach((s) => console.log(s));
}

// ───── 出片 ─────
const wavOf = (projDir) => { const w = path.join(projDir, 'out', 'soundtrack.wav'); return fs.existsSync(w) ? w : null; };

async function videoBrowser(projDir, opt) {
  const { info, errors, grab, close } = await openPage(projDir);
  const from = +(opt.from || 0), to = +(opt.to || info.duration);
  const mp4 = path.join(projDir, `${sanitize(info.title)}${opt.from || opt.to ? `_片段${from}-${to}` : ''}_${sizeTag(info.width, info.height, info.fps)}.mp4`);
  const wav = wavOf(projDir);
  if (!wav) console.warn('提示：没有 out/soundtrack.wav，输出无声视频（先运行 node audio.js）');
  const args = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(info.fps), '-c:v', 'png', '-i', '-'];
  if (wav) args.push('-ss', String(from), '-t', String(to - from), '-i', wav);
  args.push(...MASTER, '-crf', String(opt.crf || 16));
  if (wav) args.push('-c:a', 'aac', '-b:a', '192k', '-shortest');
  args.push('-movflags', '+faststart', mp4);
  const proc = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
  const f0 = Math.round(from * info.fps), f1 = Math.round(to * info.fps);
  const t0 = Date.now();
  for (let i = f0; i < f1; i++) {
    if (!proc.stdin.write(await grab(i))) await new Promise((r) => proc.stdin.once('drain', r));
    if ((i - f0) % 150 === 0) {
      const done = i - f0, el = (Date.now() - t0) / 1000;
      console.log(`帧 ${done}/${f1 - f0}  已用 ${el.toFixed(0)}s  预计剩余 ${done ? ((el / done) * (f1 - f0 - done)).toFixed(0) : '?'}s`);
    }
  }
  proc.stdin.end();
  await new Promise((r, j) => proc.on('close', (c) => (c === 0 ? r() : j(new Error('ffmpeg 退出码 ' + c)))));
  await close();
  fs.mkdirSync(path.join(projDir, 'out'), { recursive: true });
  fs.writeFileSync(path.join(projDir, 'out', 'render-log.json'), JSON.stringify({ file: mp4, frames: f1 - f0, seconds: (Date.now() - t0) / 1000, browserErrors: errors }, null, 2));
  return mp4;
}

// 外部渲染器产出的原始视频 → 统一编码 + 混入配乐
function finalize(raw, projDir, film, opt) {
  const m = probe(raw).streams.find((s) => s.codec_type === 'video');
  const mp4 = path.join(projDir, `${sanitize(film.title || path.basename(projDir))}_${sizeTag(m.width, m.height, film.fps || 30)}.mp4`);
  cmdMux(raw, wavOf(projDir), { out: mp4, crf: opt.crf, fps: film.fps || 30, quiet: true });
  return mp4;
}

async function cmdVideo(proj, opt) {
  const projDir = path.resolve(proj);
  const film = readFilm(projDir);
  const type = film.type || 'canvas';
  const W = film.width || 1920, H = film.height || 1080, fps = film.fps || 30;
  const t0 = Date.now();
  let mp4;
  fs.mkdirSync(path.join(projDir, 'out'), { recursive: true });
  if (BROWSER_TYPES.has(type)) mp4 = await videoBrowser(projDir, opt);
  else if (type === 'manim') {
    if (!PYTHON()) throw new Error('没找到 Python 3（film setup --python）');
    const media = path.join(projDir, 'out', 'manim');
    run(PYTHON(), ['-m', 'manim', 'render', '--fps', String(fps), '-r', `${W},${H}`, '--format', 'mp4', '--media_dir', media, '-o', 'raw', '--disable_caching', 'scene.py', film.scene || 'Main'], projDir);
    const find = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? find(path.join(d, e.name)) : e.name === 'raw.mp4' ? [path.join(d, e.name)] : []));
    const raw = find(path.join(media, 'videos')).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
    if (!raw) throw new Error('没找到 Manim 输出');
    mp4 = finalize(raw, projDir, film, opt);
  } else if (type === 'blender') {
    const exe = findBlender();
    if (!exe) throw new Error('没找到 Blender（film setup --blender，或设置 BLENDER_PATH）');
    const frames = nextBatch(path.join(projDir, 'out', 'frames'));
    const extra = opt.samples ? ['--samples', String(opt.samples)] : [];
    run(exe, ['-b', '--factory-startup', '-P', path.join(projDir, 'scene.py'), '--', '--out', frames, ...extra], projDir);
    const raw = path.join(projDir, 'out', 'blender_raw.mp4');
    const r = ff(['-loglevel', 'error', '-framerate', String(fps), '-i', path.join(frames, 'f_%04d.png'), '-c:v', 'libx264', '-crf', '12', '-pix_fmt', 'yuv420p', raw]);
    if (r.status !== 0) throw new Error(r.stderr);
    mp4 = finalize(raw, projDir, film, opt);
  } else if (type === 'remotion') {
    if (!hasLib('@remotion/cli')) throw new Error('缺少 Remotion（film setup）');
    const raw = path.join(projDir, 'out', 'remotion_raw.mp4');
    run(process.execPath, [path.join(libDir('@remotion/cli'), '@remotion', 'cli', 'remotion-cli.js'), 'render', 'src/index.ts', film.composition || 'Main', raw, ...(CHROME ? [`--browser-executable=${CHROME}`] : []), '--crf=14', '--log=error'], projDir);
    mp4 = finalize(raw, projDir, film, opt);
  } else if (type === 'hyperframes') {
    if (!hasLib('hyperframes')) throw new Error('缺少 HyperFrames（film setup）');
    const raw = path.join(projDir, 'out', 'hyperframes_raw.mp4');
    run(process.execPath, [path.join(libDir('hyperframes'), 'hyperframes', 'bin', 'hyperframes.mjs'), 'render', '-o', raw, '--quality', 'looks', '--fps', String(fps)], projDir);
    mp4 = finalize(raw, projDir, film, opt);
  } else throw new Error('未知项目类型 ' + type);
  console.log(`完成: ${mp4}  （${((Date.now() - t0) / 1000).toFixed(0)}s）`);
  return mp4;
}

function cmdMux(video, wav, opt = {}) {
  const src = path.resolve(video);
  const out = opt.out ? path.resolve(opt.out) : src.replace(/\.mp4$/i, '_混音.mp4');
  const args = ['-loglevel', 'error', '-i', src];
  if (wav) args.push('-i', path.resolve(wav));
  args.push('-map', '0:v:0', ...(wav ? ['-map', '1:a:0'] : ['-map', '0:a?']), ...MASTER, '-crf', String(opt.crf || 16));
  if (opt.fps) args.push('-r', String(opt.fps));
  args.push('-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2');
  if (wav) args.push('-shortest');
  args.push('-movflags', '+faststart', out);
  const r = ff(args);
  if (r.status !== 0) throw new Error('mux 失败：' + r.stderr);
  if (!opt.quiet) console.log('完成:', out);
  return out;
}

// 叠加外部配乐：循环/裁剪到视频长度，淡入淡出，可在原声处自动压低，最后做响度标准化
function cmdBgm(video, music, opt) {
  if (!video || !music) throw new Error('用法：film bgm <视频> <音乐文件> [--gain -14] [--duck]');
  const src = resolveVideo(video);
  const meta = probe(src);
  const dur = +meta.format.duration;
  const hasA = meta.streams.some((s) => s.codec_type === 'audio');
  const gain = +(opt.gain ?? -14);
  const out = opt.out ? path.resolve(opt.out) : src.replace(/\.mp4$/i, '_配乐.mp4');
  const mus = `[1:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:${dur.toFixed(3)},afade=t=in:d=0.8,afade=t=out:st=${Math.max(0, dur - 2.5).toFixed(3)}:d=2.5,volume=${gain}dB[m]`;
  let fc;
  if (!hasA) fc = `${mus};[m]loudnorm=I=-15:TP=-1.5:LRA=11[a]`;
  else if (opt.duck) fc = `${mus};[0:a]aresample=48000,aformat=channel_layouts=stereo,asplit=2[v1][v2];[m][v1]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=450[md];[v2][md]amix=inputs=2:normalize=0,loudnorm=I=-15:TP=-1.5:LRA=11[a]`;
  else fc = `${mus};[0:a]aresample=48000,aformat=channel_layouts=stereo[v];[v][m]amix=inputs=2:normalize=0,loudnorm=I=-15:TP=-1.5:LRA=11[a]`;
  const r = ff(['-loglevel', 'error', '-i', src, '-stream_loop', '-1', '-i', path.resolve(music), '-filter_complex', fc, '-map', '0:v:0', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', dur.toFixed(3), '-movflags', '+faststart', out]);
  if (r.status !== 0) throw new Error('配乐混音失败：' + r.stderr);
  console.log('完成:', out);
  return out;
}

function cmdConcat(files, opt) {
  if (!opt.out || files.length < 2) throw new Error('用法：film concat a.mp4 b.mp4 ... --out 合集.mp4 [--xfade 0.6]');
  const xd = +(opt.xfade ?? 0.6), fps = +(opt.fps || 30);
  const metas = files.map((f) => probe(path.resolve(f)));
  const v0 = metas[0].streams.find((s) => s.codec_type === 'video');
  const [TW, TH] = opt.size ? parseSize(opt.size) : [v0.width, v0.height];
  const durs = metas.map((m) => +m.format.duration);
  const args = ['-loglevel', 'error'];
  files.forEach((f) => args.push('-i', path.resolve(f)));
  // 没有音轨的片段补一段静音输入，编号接在所有视频输入之后
  let silent = files.length;
  const aIn = metas.map((m, i) => {
    if (m.streams.some((s) => s.codec_type === 'audio')) return `${i}:a`;
    args.push('-f', 'lavfi', '-t', String(durs[i]), '-i', 'anullsrc=r=48000:cl=stereo');
    return `${silent++}:a`;
  });
  let fc = files.map((_, i) => `[${i}:v]scale=${TW}:${TH}:force_original_aspect_ratio=decrease,pad=${TW}:${TH}:(ow-iw)/2:(oh-ih)/2,fps=${fps},format=yuv420p,settb=AVTB[v${i}];[${aIn[i]}]aresample=48000,aformat=channel_layouts=stereo[a${i}]`).join(';');
  let v = 'v0', a = 'a0', acc = durs[0];
  for (let i = 1; i < files.length; i++) {
    if (xd > 0) fc += `;[${v}][v${i}]xfade=transition=fade:duration=${xd}:offset=${(acc - xd).toFixed(3)}[vx${i}];[${a}][a${i}]acrossfade=d=${xd}[ax${i}]`;
    else fc += `;[${v}][${a}][v${i}][a${i}]concat=n=2:v=1:a=1[vx${i}][ax${i}]`;
    v = `vx${i}`; a = `ax${i}`; acc += durs[i] - xd;
  }
  const out = path.resolve(opt.out);
  const r = ff([...args, '-filter_complex', fc, '-map', `[${v}]`, '-map', `[${a}]`, ...MASTER, '-crf', String(opt.crf || 16), '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out]);
  if (r.status !== 0) throw new Error('拼接失败：' + r.stderr);
  console.log(`完成: ${out}  （${acc.toFixed(1)}s）`);
  return out;
}

// ───── 交付 ─────
function cmdShare(file, opt) {
  const src = resolveVideo(file);
  const out = src.replace(/(_(\d+x)?\d+p\d+)?\.mp4$/i, '_分享版.mp4');
  const r = ff(['-loglevel', 'error', '-i', src, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(opt.crf || 23), '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', out], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('压制失败');
  console.log(`完成: ${out}  (${(fs.statSync(out).size / 1048576).toFixed(1)} MB，母版 ${(fs.statSync(src).size / 1048576).toFixed(1)} MB)`);
  return out;
}

function cmdVerify(file, opt) {
  const src = resolveVideo(file);
  const meta = probe(src);
  const v = meta.streams.find((s) => s.codec_type === 'video'), a = meta.streams.find((s) => s.codec_type === 'audio');
  const dur = +meta.format.duration;
  // 一次全量解码：顺带测响度、真峰值、全黑、帧数。全黑只抓亮度 < 2% 且持续 1 秒以上的段
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', src, '-vf', 'blackdetect=d=1.0:pix_th=0.02', ...(a ? ['-af', 'ebur128=peak=true'] : []), '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 30 });
  const err = r.stderr || '';
  const last = (re) => { let m, x = null; const g = new RegExp(re, 'g'); while ((m = g.exec(err))) x = m; return x; };
  const frames = +(last('frame=\\s*(\\d+)') || [0, 0])[1];
  const lufs = a ? +(last('I:\\s+(-?[\\d.]+) LUFS') || [0, NaN])[1] : null;
  const tpk = a ? +(last('Peak:\\s+(-?[\\d.]+) dBFS') || [0, NaN])[1] : null;
  const blacks = [...err.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)].map((m) => [+m[1], +m[2]]);
  const midBlacks = blacks.filter(([s, e]) => s > 1.5 && e < dur - 1.5);
  const fps = v.r_frame_rate.split('/').reduce((x, y) => x / y);
  const checks = [
    ['可解码', r.status === 0],
    ['H.264 yuv420p', v.codec_name === 'h264' && v.pix_fmt === 'yuv420p'],
    ['帧数与时长一致', Math.abs(frames - dur * fps) <= 2],
    ...(opt.duration ? [[`时长 ${opt.duration}s`, Math.abs(dur - +opt.duration) < 0.05]] : []),
    ...(a ? [['AAC 48k 立体声', a.codec_name === 'aac' && +a.sample_rate === 48000 && a.channels === 2],
      ['响度 -20~-12 LUFS', lufs >= -20 && lufs <= -12], ['真峰值 ≤ -0.5 dBTP', tpk <= -0.5]] : [['有音轨', false]]),
    ['中段无 >1s 全黑', midBlacks.length === 0],
  ];
  const report = {
    file: path.basename(src), bytes: +meta.format.size, mb: +(meta.format.size / 1048576).toFixed(1),
    video: { codec: v.codec_name, pix_fmt: v.pix_fmt, size: `${v.width}x${v.height}`, fps, frames, duration: dur },
    audio: a ? { codec: a.codec_name, sample_rate: +a.sample_rate, channels: a.channels, integrated_lufs: lufs, true_peak_dbtp: tpk } : null,
    black_segments: blacks, checks: Object.fromEntries(checks.map(([k, o]) => [k, o])), passed: checks.every(([, o]) => o),
    note: '机器校验不含人耳试听与逐帧观感，请另行抽帧（sheet）和试听。',
  };
  const outDir = fs.existsSync(path.join(path.dirname(src), 'out')) ? path.join(path.dirname(src), 'out') : path.dirname(src);
  const out = path.join(outDir, path.basename(src, path.extname(src)) + '.verification.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  for (const [k, o] of checks) console.log(`${ok(o)} ${k}`);
  console.log(`  ${report.video.size} ${fps}fps ${frames} 帧 ${dur.toFixed(2)}s ${report.mb}MB` + (a ? `  ${lufs} LUFS / ${tpk} dBTP` : ''));
  console.log('报告:', out);
  if (!report.passed) process.exitCode = 1;
  return report;
}

function cmdPoster(target, opt) {
  const src = resolveVideo(target);
  const dur = +probe(src).format.duration;
  const t = opt.t != null ? +opt.t : dur * 0.35;
  const base = src.replace(/(_(\d+x)?\d+p\d+)?\.mp4$/i, '');
  const outs = [[`${base}_封面.jpg`, 'null'], [`${base}_封面_3x4.jpg`, "crop='min(iw,ih*3/4)':'min(ih,iw*4/3)',scale=1080:1440"], [`${base}_封面_1x1.jpg`, "crop='min(iw,ih)':'min(iw,ih)',scale=1080:1080"]];
  for (const [f, vf] of outs) {
    const r = ff(['-loglevel', 'error', '-ss', t.toFixed(3), '-i', src, '-frames:v', '1', '-vf', vf, '-q:v', '2', f]);
    if (r.status !== 0) throw new Error('封面导出失败：' + r.stderr);
    console.log(f);
  }
}

function cmdGif(target, opt) {
  const src = resolveVideo(target);
  const from = +(opt.from || 0), to = opt.to != null ? +opt.to : Math.min(+probe(src).format.duration, from + 6);
  const w = +(opt.width || 720), fps = +(opt.fps || 15);
  const out = opt.out ? path.resolve(opt.out) : src.replace(/(_(\d+x)?\d+p\d+)?\.mp4$/i, `_预览.gif`);
  const vf = `fps=${fps},scale=${w}:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`;
  const r = ff(['-loglevel', 'error', '-ss', String(from), '-t', String(to - from), '-i', src, '-vf', vf, '-loop', '0', out]);
  if (r.status !== 0) throw new Error('GIF 导出失败：' + r.stderr);
  console.log(`完成: ${out}  (${(fs.statSync(out).size / 1048576).toFixed(1)} MB)`);
}

const plainCap = (s) => String(s).replace(/\*\*/g, '');
const srtTime = (t) => { const ms = Math.round(t * 1000); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
function cmdSrt(proj, opt) {
  const projDir = path.resolve(proj);
  const TL = loadTL(projDir);
  if (!TL || !TL.CAPS) throw new Error('src/timeline.js 里没有 TL.CAPS');
  const film = readFilm(projDir);
  const caps = [...TL.CAPS].sort((a, b) => a[0] - b[0]);
  const txt = caps.map(([a, b, s], i) => `${i + 1}\n${srtTime(a)} --> ${srtTime(b)}\n${plainCap(s)}\n`).join('\n');
  const out = path.join(projDir, `${sanitize(film.title || TL.TITLE || path.basename(projDir))}.srt`);
  fs.writeFileSync(out, '\uFEFF' + txt, 'utf8');
  console.log(`完成: ${out}（${caps.length} 条）`);
  if (opt.embed) {
    const mp4 = resolveVideo(opt.embed === true ? projDir : opt.embed);
    const o = mp4.replace(/\.mp4$/i, '_字幕.mp4');
    const r = ff(['-loglevel', 'error', '-i', mp4, '-i', out, '-map', '0', '-map', '1', '-c', 'copy', '-c:s', 'mov_text', '-metadata:s:s:0', 'language=chi', o]);
    if (r.status !== 0) throw new Error('内嵌字幕失败：' + r.stderr);
    console.log('完成:', o);
  }
  return out;
}

// ───── 检查时间表 ─────
function cmdLint(proj) {
  const projDir = path.resolve(proj);
  const film = readFilm(projDir);
  const type = film.type || 'canvas';
  const warn = [], errs = [];
  if (!fs.existsSync(path.join(projDir, 'film.json'))) warn.push('没有 film.json（按 canvas 处理）');
  if (!TYPES[type]) errs.push(`film.json 的 type「${type}」不认识`);
  const need = BROWSER_TYPES.has(type) ? ['index.html'] : type === 'remotion' ? ['src/index.ts'] : type === 'hyperframes' ? ['index.html'] : ['scene.py'];
  for (const f of need) if (!fs.existsSync(path.join(projDir, f))) errs.push(`缺少 ${f}`);
  const TL = loadTL(projDir);
  if (TL) {
    const D = TL.DURATION;
    if (film.duration && Math.abs(film.duration - D) > 0.01) warn.push(`时长不一致：film.json ${film.duration}s，timeline.js ${D}s（Manim/Blender/校验用 film.json）`);
    if (TL.W && film.width && (TL.W !== film.width || TL.H !== film.height)) warn.push(`尺寸不一致：film.json ${film.width}x${film.height}，timeline.js ${TL.W}x${TL.H}`);
    const portrait = (TL.H || film.height || 1080) > (TL.W || film.width || 1920);
    const maxLen = portrait ? 16 : 28;
    const caps = [...(TL.CAPS || [])].sort((a, b) => a[0] - b[0]);
    caps.forEach(([a, b, s], i) => {
      const txt = plainCap(s), len = [...txt].length, d = b - a;
      const tag = `字幕 ${a.toFixed(1)}s「${txt.slice(0, 14)}${len > 14 ? '…' : ''}」`;
      if (!(b > a)) errs.push(`${tag} 结束早于开始`);
      if (a < 0 || b > D + 0.01) warn.push(`${tag} 超出 0~${D}s`);
      if (d < 0.8) warn.push(`${tag} 只停留 ${d.toFixed(2)}s，太短`);
      if (len / d > 7) warn.push(`${tag} 每秒 ${(len / d).toFixed(1)} 字，读不完（建议 ≤ 6）`);
      if (len > maxLen) warn.push(`${tag} ${len} 字，单行偏长（${portrait ? '竖屏' : '横屏'}建议 ≤ ${maxLen}）`);
      if (i > 0 && a < caps[i - 1][1] - 0.05) warn.push(`${tag} 与上一条重叠 ${(caps[i - 1][1] - a).toFixed(2)}s`);
    });
    let VO = {};
    try { VO = require(path.join(projDir, 'src', 'vo.js')); } catch (e) { /* 无 */ }
    const vo = [...(TL.VO || [])].sort((a, b) => a.t - b.t);
    vo.forEach((v, i) => {
      const info = VO.lines && VO.lines[v.id];
      if (!info) { warn.push(`旁白 ${v.id} 还没合成（film tts）`); return; }
      if (info.text !== v.text) warn.push(`旁白 ${v.id} 文本改过，需重新 film tts`);
      if (v.t + info.dur > D + 0.01) warn.push(`旁白 ${v.id} 结束于 ${(v.t + info.dur).toFixed(1)}s，超出全片 ${D}s`);
      if (vo[i + 1] && v.t + info.dur > vo[i + 1].t - 0.15) warn.push(`旁白 ${v.id} 与 ${vo[i + 1].id} 重叠/贴太紧（${v.id} 到 ${(v.t + info.dur).toFixed(1)}s）`);
    });
    for (const e of TL.SFX || []) if (e.t < 0 || e.t > D) warn.push(`音效 ${e.type}@${e.t}s 超出全片`);
    const wav = wavOf(projDir);
    const newest = ['src/timeline.js', 'src/vo.js', 'audio.js'].map((f) => path.join(projDir, f)).filter(fs.existsSync).map((f) => fs.statSync(f).mtimeMs);
    if (fs.existsSync(path.join(projDir, 'audio.js'))) {
      if (!wav) warn.push('还没生成配乐（node audio.js）');
      else if (Math.max(...newest) > fs.statSync(wav).mtimeMs) warn.push('时间表/旁白/audio.js 比配乐新，需重新 node audio.js');
    }
  } else warn.push('没有 src/timeline.js，跳过时间表检查');
  for (const e of errs) console.log('✗ ' + e);
  for (const w of warn) console.log('! ' + w);
  console.log(errs.length + warn.length ? `\n${errs.length} 个错误，${warn.length} 个提醒` : '✓ 时间表检查通过');
  if (errs.length) process.exitCode = 1;
  return { errs, warn };
}

// ───── 旁白 ─────
function splitChunks(text, dur, maxLen) {
  const pieces = text.split(/(?<=[。！？；!?;…])|(?<=[，、：,:])/).map((s) => s.trim()).filter(Boolean);
  const chunks = [];
  for (const p of pieces) {
    const last = chunks[chunks.length - 1];
    if (last && [...last].length + [...p].length <= maxLen && !/[。！？!?…]$/.test(last)) chunks[chunks.length - 1] = last + p;
    else if ([...p].length > maxLen) { const a = [...p]; for (let i = 0; i < a.length; i += maxLen) chunks.push(a.slice(i, i + maxLen).join('')); }
    else chunks.push(p);
  }
  const total = chunks.reduce((n, c) => n + [...c].length, 0) || 1;
  let acc = 0;
  return chunks.map((c, i) => {
    const a = (acc / total) * dur; acc += [...c].length;
    const b = (acc / total) * dur + (i === chunks.length - 1 ? 0.3 : 0); // 最后一句多停 0.3 秒
    return [+a.toFixed(3), +b.toFixed(3), c.replace(/[，。、；,;]+$/, '')];
  });
}
function synthLine(engine, v, voice, rate, mp3, raw) {
  if (engine === 'edge') {
    const r = spawnSync(PYTHON(), ['-m', 'edge_tts', '--voice', voice, `--rate=${rate}`, '--text', v.text, '--write-media', mp3], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`edge-tts 失败（需要联网）：${r.stderr || r.stdout}`);
    return mp3;
  }
  if (engine === 'sapi') {
    const ps = `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; ` +
      `$v = $s.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -eq 'zh-CN' } | Select-Object -First 1; if ($v) { $s.SelectVoice($v.VoiceInfo.Name) }; ` +
      `$s.Rate = ${Math.round((parseInt(rate, 10) || 0) / 10)}; $s.SetOutputToWaveFile('${raw.replace(/'/g, "''")}'); $s.Speak([IO.File]::ReadAllText('${(raw + '.txt').replace(/'/g, "''")}')); $s.Dispose()`;
    fs.writeFileSync(raw + '.txt', v.text, 'utf8');
    const r = spawnSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error('Windows 语音合成失败：' + r.stderr);
    return raw;
  }
  if (engine === 'say') {
    const aiff = raw.replace(/\.wav$/, '.aiff');
    const r = spawnSync('say', ['-v', voice.includes('Neural') ? 'Tingting' : voice, '-o', aiff, v.text], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error('macOS say 失败：' + r.stderr);
    return aiff;
  }
  throw new Error('未知引擎 ' + engine);
}
function cmdTts(proj, opt) {
  const projDir = path.resolve(proj);
  const TL = loadTL(projDir);
  if (!TL || !(TL.VO || []).length) { console.log('timeline.js 里的 TL.VO 是空的：先写旁白 { id, t, text }'); return; }
  const engine = opt.engine || (pyHas('edge_tts') ? 'edge' : IS_WIN ? 'sapi' : IS_MAC ? 'say' : null);
  if (!engine) throw new Error('没有可用的语音引擎：film setup --python 安装 edge-tts');
  const dir = path.join(projDir, 'out', 'vo');
  fs.mkdirSync(dir, { recursive: true });
  const timingFile = path.join(dir, 'timing.json');
  const old = fs.existsSync(timingFile) ? JSON.parse(fs.readFileSync(timingFile, 'utf8')) : {};
  const portrait = (TL.H || 1080) > (TL.W || 1920);
  const lines = {};
  for (const v of TL.VO) {
    const voice = v.voice || opt.voice || TL.VOICE || 'zh-CN-XiaoxiaoNeural';
    const rate = v.rate || opt.rate || TL.RATE || '+0%';
    const key = `${engine}|${voice}|${rate}|${v.text}`;
    const wav = path.join(dir, `${v.id}.wav`);
    let dur;
    if (!opt.force && old[v.id] && old[v.id].key === key && fs.existsSync(wav)) dur = old[v.id].dur;
    else {
      const src = synthLine(engine, v, voice, rate, path.join(dir, `${v.id}.mp3`), path.join(dir, `${v.id}.raw.wav`));
      // 去掉首尾静音，统一成 48k 单声道
      const trim = 'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,apad=pad_dur=0.08';
      const r = ff(['-loglevel', 'error', '-i', src, '-af', trim, '-ac', '1', '-ar', '48000', '-c:a', 'pcm_s16le', wav]);
      if (r.status !== 0) throw new Error('旁白转码失败：' + r.stderr);
      dur = +(+probe(wav).format.duration).toFixed(3);
      console.log(`  ${v.id}  ${dur.toFixed(2)}s  ${v.text.slice(0, 24)}${v.text.length > 24 ? '…' : ''}`);
    }
    lines[v.id] = { text: v.text, dur, key, chunks: splitChunks(v.text, dur, portrait ? 14 : 24) };
  }
  fs.writeFileSync(timingFile, JSON.stringify(lines, null, 1));
  const pub = Object.fromEntries(Object.entries(lines).map(([k, x]) => [k, { text: x.text, dur: x.dur, chunks: x.chunks }]));
  fs.writeFileSync(path.join(projDir, 'src', 'vo.js'),
    `// 由 \`film tts\` 自动生成：旁白时长与分句时间。手动改无效，会被覆盖。\n(function (root) {\n  const VO = { lines: ${JSON.stringify(pub, null, 2).replace(/\n/g, '\n  ')} };\n  if (typeof module !== 'undefined') module.exports = VO;\n  else root.VO = VO;\n})(typeof window !== 'undefined' ? window : globalThis);\n`);
  console.log(`完成：${Object.keys(lines).length} 句旁白（${engine}）→ out/vo/，时长写入 src/vo.js。下一步：film lint 检查重叠，再 node audio.js`);
  cmdLint(projDir);
}

// ───── 新建 ─────
function cmdNew(dir, opt) {
  if (!dir) throw new Error('用法：film new <目录> [--type 类型] [--title 片名] [--size 9:16]');
  const type = opt.type || 'canvas';
  if (!TYPES[type]) throw new Error(`未知类型 ${type}，可选：${Object.keys(TYPES).join(' / ')}`);
  const projDir = path.resolve(dir);
  if (fs.existsSync(projDir) && fs.readdirSync(projDir).length) throw new Error('目录非空：' + projDir);
  const [W, H] = parseSize(opt.size || (opt.portrait ? '9:16' : opt.square ? '1:1' : null));
  const title = opt.title || path.basename(projDir);
  const sameDrive = path.parse(projDir).root.toLowerCase() === path.parse(KIT).root.toLowerCase();
  const rel = sameDrive ? path.relative(projDir, KIT).replace(/\\/g, '/') : null;
  const vars = { TITLE: title, TYPE: type, TYPE_DESC: TYPES[type], KIT_NODE: rel || KIT.replace(/\\/g, '/'), DATE: new Date().toISOString().slice(0, 10), W, H };
  const walk = (d) => (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)])) : []);
  // 先铺共用文件，再用类型模板覆盖
  for (const tpl of [path.join(KIT, 'templates', '_common'), path.join(KIT, 'templates', type)]) {
    for (const f of walk(tpl)) {
      const dst = path.join(projDir, path.relative(tpl, f));
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.writeFileSync(dst, fs.readFileSync(f, 'utf8').replace(/\{\{(\w+)\}\}/g, (m, k) => (vars[k] ?? m)));
    }
  }
  fs.mkdirSync(path.join(projDir, 'out'), { recursive: true });
  const r = path.relative(process.cwd(), projDir) || '.';
  console.log(`已创建 ${type} 项目 ${projDir}（${W}x${H}）\n下一步：\n  1. 写 STORYBOARD.md，改 src/timeline.js（时长/字幕/旁白/音效）\n  2. 改画面：${BROWSER_TYPES.has(type) ? 'src/scene.js' : type === 'remotion' ? 'src/Main.tsx' : type === 'hyperframes' ? 'index.html' : 'scene.py'}\n  3. film ${BROWSER_TYPES.has(type) ? 'preview' : 'video'} "${r}"   ${BROWSER_TYPES.has(type) ? '实时预览' : '先出草稿'}\n  4. film stills "${r}" auto:12   抽帧检查\n  5. film all "${r}"   出片 + 分享版 + 校验 + 封面`);
  return projDir;
}

async function cmdPreview(proj, opt) {
  const projDir = path.resolve(proj || '.');
  let port = +(opt.port || 5178), server;
  for (let i = 0; i < 20 && !server; i++) { try { server = await startServer(port, under(projDir, ROOT) ? null : projDir); } catch (e) { port++; } }
  const url = projectUrl(server, projDir).replace('127.0.0.1', 'localhost').replace(/index\.html$/, '') + '#1';
  console.log(`预览: ${url}\n（Ctrl+C 结束；地址后的 #秒数 可直接跳转）`);
  if (!opt['no-open']) openUrl(url);
}

async function cmdServe(port = 5178) {
  await startServer(+port);
  console.log(`预览: http://localhost:${port}/  （根目录 ${ROOT}）`);
}

// ───── 环境 ─────
function cmdDoctor(opt = {}) {
  const ver = (cmd, args, re) => { const r = spawnSync(cmd, args, { encoding: 'utf8' }); if (r.status !== 0) return null; const m = re.exec(r.stdout + r.stderr); return m ? m[1] : 'ok'; };
  const node = process.versions.node;
  const ffm = ver('ffmpeg', ['-version'], /ffmpeg version (\S+)/), ffp = ver('ffprobe', ['-version'], /ffprobe version (\S+)/);
  const py = PYTHON();
  const manim = pyHas('manim'), edge = pyHas('edge_tts');
  const blender = findBlender();
  const fontDirs = IS_WIN ? ['C:/Windows/Fonts', path.join(process.env.LOCALAPPDATA || '', 'Microsoft/Windows/Fonts')] : IS_MAC ? ['/Library/Fonts', '/System/Library/Fonts', path.join(os.homedir(), 'Library/Fonts')] : ['/usr/share/fonts', path.join(os.homedir(), '.local/share/fonts')];
  const fontFiles = fontDirs.filter(fs.existsSync).flatMap((d) => { try { return fs.readdirSync(d); } catch (e) { return []; } }).join('|');
  const noto = /NotoSansSC|NotoSerifSC|SourceHan|思源/i.test(fontFiles) || (process.platform === 'linux' && spawnSync('fc-list', [':lang=zh'], { encoding: 'utf8' }).stdout?.length > 0);
  const base = +node.split('.')[0] >= 18 && !!ffm && !!ffp && !!CHROME && hasLib('puppeteer-core');
  const rows = [
    ['Node ≥ 18', +node.split('.')[0] >= 18, node],
    ['ffmpeg / ffprobe', !!ffm && !!ffp, ffm || '未安装'],
    ['Chrome / Edge', !!CHROME, CHROME || '未找到（设置 CHROME_PATH）'],
    ['JS 依赖目录', hasLib('puppeteer-core'), LIBS.join('  +  ') || '未安装（film setup）'],
    ['Python 3', !!py, py || '未安装'],
    ['manim', manim, manim ? '' : 'film setup --python'],
    ['edge-tts（在线旁白）', edge, edge ? '' : (IS_WIN ? '可退回 Windows 语音' : IS_MAC ? '可退回 macOS say' : 'film setup --python')],
    ['Blender', !!blender, blender || 'film setup --blender'],
    ['中文字体（Noto/思源）', noto, noto ? '' : '建议安装 Noto Sans/Serif SC，否则回退系统字体'],
  ];
  const stacks = {
    canvas: base, shader: base, dom: base && hasLib('gsap') && hasLib('lottie-web'),
    three: base && hasLib('three'), p5brush: base && hasLib('p5') && hasLib('p5.brush'),
    hyperframes: !!ffm && hasLib('hyperframes') && +node.split('.')[0] >= 22,
    remotion: !!ffm && hasLib('remotion') && hasLib('@remotion/cli') && hasLib('react'),
    manim: !!ffm && manim, blender: !!ffm && !!blender,
  };
  console.log(`film ${VERSION}  kit: ${KIT}\n`);
  for (const [k, o, d] of rows) console.log(`${ok(o)} ${k.padEnd(18)} ${d}`);
  console.log('\n技术栈可用性：');
  for (const [k, o] of Object.entries(stacks)) console.log(`  ${ok(o)} ${k.padEnd(12)} ${TYPES[k]}`);
  const tts = edge ? 'edge-tts' : IS_WIN ? 'Windows 语音' : IS_MAC ? 'macOS say' : '无';
  console.log(`\n旁白引擎：${tts}`);
  if (!base) { console.log('\n基础环境不完整：先运行安装脚本，或 film setup'); process.exitCode = 1; }
  return { base, stacks };
}

function cmdSetup(opt) {
  const all = ['puppeteer-core@^23.11.1', 'three@0.186.1', 'p5@2.3.4', 'p5.brush@2.2.3', 'gsap@3.15.0', 'lottie-web@5.13.0'];
  const heavy = ['remotion@4.0.536', '@remotion/cli@4.0.536', 'react@19.1.0', 'react-dom@19.1.0', 'hyperframes@0.8.168'];
  const pkgs = opt.lite ? all : all.concat(heavy);
  console.log(`安装 JS 依赖到 ${KIT}${opt.lite ? '（精简：不含 Remotion/HyperFrames）' : ''}…`);
  // 直接用 node 运行 npm-cli.js（Windows 上不经过 shell）
  const npmCli = [path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'), path.join(path.dirname(process.execPath), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js')].find(fs.existsSync);
  const npmRun = (args) => (npmCli ? spawnSync(process.execPath, [npmCli, ...args], { cwd: KIT, stdio: 'inherit' }) : spawnSync(IS_WIN ? 'npm.cmd' : 'npm', args, { cwd: KIT, stdio: 'inherit', shell: IS_WIN }));
  const npmArgs = ['install', '--no-audit', '--no-fund', '--save', ...pkgs];
  let r = npmRun(npmArgs);
  if (r.status !== 0) {
    console.warn('npm 安装失败，改用国内镜像 npmmirror 重试…');
    r = npmRun([...npmArgs, '--registry=https://registry.npmmirror.com']);
  }
  if (r.status !== 0) throw new Error('npm install 失败（检查网络；或手动 npm config set registry https://registry.npmmirror.com 后重试）');
  const pyPkgs = opt.python ? ['manim', 'edge-tts'] : opt.tts ? ['edge-tts'] : [];
  if (pyPkgs.length) {
    if (!PYTHON()) console.warn('没找到 Python 3，跳过 ' + pyPkgs.join(' / '));
    else {
      const pip = (extra) => spawnSync(PYTHON(), ['-m', 'pip', 'install', '--upgrade', ...pyPkgs, ...extra], { stdio: 'inherit' }).status === 0;
      if (!pip([]) && !pip(['-i', 'https://pypi.tuna.tsinghua.edu.cn/simple'])) console.warn('pip 安装失败：' + pyPkgs.join(' / '));
    }
  }
  if (opt.blender && !findBlender()) {
    if (IS_WIN) run('winget', ['install', '--id', 'BlenderFoundation.Blender', '-e', '--silent', '--accept-source-agreements', '--accept-package-agreements'], KIT);
    else if (IS_MAC) run('brew', ['install', '--cask', 'blender'], KIT);
    else console.warn('Linux 请用包管理器安装 Blender（如 sudo snap install blender --classic）');
  }
  // 新装的依赖要在新进程里才能被识别
  spawnSync(process.execPath, [__filename, 'doctor'], { stdio: 'inherit' });
}

// ───── 一键演示 ─────
async function cmdDemo(dir, opt) {
  const outDir = path.resolve(dir || 'film-demo');
  const { stacks } = cmdDoctor();
  let types = opt.types ? String(opt.types).split(',') : opt.quick ? ['canvas', 'shader', 'three', 'dom'] : Object.keys(TYPES);
  types = types.filter((t) => stacks[t]);
  if (!types.length) throw new Error('没有可用的技术栈，先 film setup');
  console.log(`\n演示：${types.join(' / ')} → ${outDir}`);
  fs.mkdirSync(outDir, { recursive: true });
  const clips = [];
  for (const t of types) {
    const p = path.join(outDir, t);
    if (!fs.existsSync(p) || !fs.readdirSync(p).length) cmdNew(p, { type: t, title: t === 'canvas' ? `代码做视频的${types.length}种方式` : DEMO_TITLES[t] });
    run(process.execPath, ['audio.js'], p);
    console.log(`\n── 渲染 ${t} ──`);
    clips.push(await cmdVideo(p, t === 'blender' ? { samples: 16 } : {}));
  }
  // 连续配乐：开头铺底，第二段起加鼓
  const { Track, score, SFX, CHORDS, win, writeWav } = require(path.join(KIT, 'lib', 'synth.js'));
  const CLIP = 8, XF = clips.length > 1 ? 0.6 : 0, DUR = clips.length * CLIP - (clips.length - 1) * XF;
  const music = new Track(DUR + 2);
  score(music, { to: DUR + 1, bpm: 96, barSec: 5, chords: CHORDS.D, gains: { pad: (t) => win(t, 0, DUR, 1.5, 2.5), pluck: (t) => 0.8 * win(t, 0.8, DUR - 1, 0.5, 2), bass: (t) => 0.7 * win(t, 7, DUR - 1, 1, 2), drum: (t) => 0.8 * win(t, 7.4, DUR - 4, 0.3, 1) } });
  music.applyReverb(0.5);
  const mix = new Track(DUR);
  mix.mix(music, 0.85);
  SFX.bloom(mix, 1.0, 0.3);
  for (let i = 1; i < clips.length; i++) SFX.whoosh(mix, i * (CLIP - XF) + XF / 2, 0.14);
  SFX.chime(mix, DUR - 2.4);
  mix.applyReverb(0.5);
  const wav = path.join(outDir, 'out', 'demo.wav');
  writeWav(wav, mix);
  const silent = path.join(outDir, 'out', 'demo_noaudio.mp4');
  if (clips.length > 1) cmdConcat(clips, { out: silent, xfade: XF });
  else fs.copyFileSync(clips[0], silent);
  const final = cmdMux(silent, wav, { out: path.join(outDir, `代码做视频的${types.length}种方式_1080p30.mp4`) });
  cmdVerify(final, { duration: DUR.toFixed(1) });
  cmdShare(final, {});
  console.log(`\n演示完成：${final}`);
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const { pos, opt } = parseArgs(rest);
  switch (cmd) {
    case 'new': return cmdNew(pos[0], opt);
    case 'doctor': return cmdDoctor(opt);
    case 'setup': return cmdSetup(opt);
    case 'demo': return cmdDemo(pos[0], opt);
    case 'preview': return cmdPreview(pos[0], opt);
    case 'serve': return cmdServe(pos[0]);
    case 'lint': return cmdLint(pos[0] || '.');
    case 'tts': return cmdTts(pos[0] || '.', opt);
    case 'stills': return cmdStills(pos[0], pos[1], opt);
    case 'sheet': return cmdStills(pos[0], pos[1], opt, true);
    case 'video': return cmdVideo(pos[0] || '.', opt);
    case 'mux': return cmdMux(pos[0], pos[1], opt);
    case 'bgm': return cmdBgm(pos[0], pos[1], opt);
    case 'concat': return cmdConcat(pos, opt);
    case 'share': return cmdShare(pos[0], opt);
    case 'verify': return cmdVerify(pos[0], opt);
    case 'poster': return cmdPoster(pos[0] || '.', opt);
    case 'gif': return cmdGif(pos[0] || '.', opt);
    case 'srt': return cmdSrt(pos[0] || '.', opt);
    case 'all': {
      const projDir = path.resolve(pos[0] || '.');
      const { errs } = cmdLint(projDir);
      if (errs.length) throw new Error('时间表有错误，先修好再出片');
      if (fs.existsSync(path.join(projDir, 'audio.js'))) run(process.execPath, ['audio.js'], projDir);
      const mp4 = await cmdVideo(projDir, opt);
      cmdShare(mp4, opt);
      cmdVerify(mp4, { ...opt, duration: opt.duration || readFilm(projDir).duration });
      cmdPoster(mp4, {});
      return;
    }
    case '-v': case '--version': case 'version': return console.log(VERSION);
    default: console.log(HELP);
  }
}
main().catch((e) => { console.error('✗ ' + (e.message || e)); process.exit(1); });
