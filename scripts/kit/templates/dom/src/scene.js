// DOM 模式：一条暂停的 GSAP 主时间线 + Lottie，seek(t) 把整页摆到 t 时刻，渲染器截图。
// 规则：所有动画都挂到 tl 上（不要用 CSS animation/transition、setTimeout、Math.random），否则截图不可复现。
(function () {
  const $ = (s) => document.querySelector(s);
  const tl = gsap.timeline({ paused: true });
  let anim = null;
  const counter = { v: 0 };

  function setup() {
    // 标题逐字
    $('#title').innerHTML = [...'{{TITLE}}'].map((c) => `<span>${c}</span>`).join('');
    tl.from('#title span', { y: 120, opacity: 0, rotateX: -80, duration: 0.9, ease: 'expo.out', stagger: 0.08 }, 0.4)
      .from('#kicker', { opacity: 0, letterSpacing: '1.2em', duration: 1.2, ease: 'power3.out' }, 0.9)
      .from('.glow', { scale: 0.4, opacity: 0, duration: 2, ease: 'power2.out' }, 0);

    // 卡片进场
    tl.from('#chart', { y: 80, opacity: 0, duration: 0.9, ease: 'power3.out' }, 1.6)
      .from('#badge', { y: 80, opacity: 0, duration: 0.9, ease: 'power3.out' }, 1.8);

    // SVG 折线描边动画 + 面积渐显 + 数据点
    const line = $('#line'), len = line.getTotalLength();
    gsap.set(line, { strokeDasharray: len, strokeDashoffset: len });
    tl.to(line, { strokeDashoffset: 0, duration: 2.2, ease: 'power2.inOut' }, 2.3)
      .from('#areaPath', { opacity: 0, duration: 1.2 }, 3.4);
    const pts = line.getAttribute('d').match(/\d+ \d+/g).map((s) => s.split(' ').map(Number));
    $('#dots').innerHTML = pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9"/>`).join('');
    tl.from('#dots circle', { scale: 0, transformOrigin: '50% 50%', duration: 0.4, ease: 'back.out(3)', stagger: 0.25 }, 2.4);
    tl.to(counter, { v: 128400, duration: 2.4, ease: 'power2.out' }, 2.3);

    // 收尾
    tl.to('#stage > *:not(.bg)', { opacity: 0, duration: 0.6 }, TL.DURATION - 0.7);

    anim = lottie.loadAnimation({ container: $('#lottie'), renderer: 'svg', loop: false, autoplay: false, animationData: window.BADGE_LOTTIE });
    return new Promise((r) => (anim.isLoaded ? r() : anim.addEventListener('DOMLoaded', r)));
  }

  function seek(t) {
    tl.seek(t, false);
    // Lottie 用自己的帧号；这里从 1.8s 开始播
    const f = Math.max(0, (t - 1.8) * anim.frameRate);
    anim.goToAndStop(Math.min(f, anim.totalFrames - 1), true);
    $('#count').textContent = Math.round(counter.v).toLocaleString('en-US');
    // 字幕
    const cap = TL.CAPS.find(([a, b]) => t >= a && t <= b);
    const el = $('#cap');
    if (cap) { el.innerHTML = cap[2].replace(/\*\*(.+?)\*\*/g, '<em>$1</em>'); el.style.opacity = KIT.win(t, cap[0], cap[1], 0.25, 0.3); }
    else el.style.opacity = 0;
  }

  KIT.mountStage({ stage: $('#stage'), seek, setup, fps: TL.FPS, duration: TL.DURATION, fonts: TL.FONTS });
})();
