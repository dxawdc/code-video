// 一个用代码生成的 Lottie 动画（也可以换成 AE/LottieFiles 导出的 JSON）：旋转的光环 + 呼吸的核心
(function () {
  const FR = 30, OP = 240;
  const st = (v) => ({ a: 0, k: v });
  const kf = (pairs) => ({ a: 1, k: pairs.map(([t, s], i) => (i < pairs.length - 1 ? { t, s, i: { x: [0.4], y: [1] }, o: { x: [0.6], y: [0] } } : { t, s })) });
  const tr = { ty: 'tr', p: st([0, 0]), a: st([0, 0]), s: st([100, 100]), r: st(0), o: st(100), sk: st(0), sa: st(0) };
  const layer = (name, shapes, ks) => ({ ddd: 0, ind: 1, ty: 4, nm: name, sr: 1, ip: 0, op: OP, st: 0, bm: 0, ao: 0,
    ks: { o: st(100), r: st(0), p: st([150, 150, 0]), a: st([0, 0, 0]), s: st([100, 100, 100]), ...ks }, shapes });
  const ring = layer('ring', [{ ty: 'gr', it: [
    { ty: 'el', p: st([0, 0]), s: st([230, 230]) },
    { ty: 'st', c: st([0.95, 0.70, 0.42, 1]), o: st(100), w: st(10), lc: 2, lj: 2, d: [{ n: 'd', nm: 'dash', v: st(60) }, { n: 'g', nm: 'gap', v: st(30) }] },
    tr] }], { r: kf([[0, [0]], [OP, [360]]]), s: kf([[0, [0, 0, 100]], [24, [100, 100, 100]]]) });
  const core = layer('core', [{ ty: 'gr', it: [
    { ty: 'sr', sy: 1, pt: st(6), p: st([0, 0]), r: st(0), ir: st(38), is: st(0), or: st(86), os: st(0) },
    { ty: 'fl', c: st([0.85, 0.47, 0.34, 1]), o: st(100) },
    tr] }], { r: kf([[0, [0]], [OP, [-120]]]), s: kf([[10, [0, 0, 100]], [36, [110, 110, 100]], [60, [95, 95, 100]], [90, [105, 105, 100]], [120, [100, 100, 100]]]) });
  core.ind = 2;
  window.BADGE_LOTTIE = { v: '5.7.4', fr: FR, ip: 0, op: OP, w: 300, h: 300, nm: 'badge', ddd: 0, assets: [], layers: [core, ring] };
})();
