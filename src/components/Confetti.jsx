// 通用粒子庆祝组件：彩带 / 金币雨 / 星星爆 / 泡泡碎 四种预设。
// 纯 framer-motion + CSS 元素，无素材。挂载即播放一次。
// 覆盖在奖励弹层等场景之上（pointer-events: none，不拦点击）。
//
// props:
//   preset: 'confetti' | 'coins' | 'stars' | 'bubbles'
//           粒子预设。默认 confetti（保持旧行为：彩色纸片 + 星星从中心迸发）。
//   count:  number   粒子数量（各预设默认值均 ≤30，照顾低端设备）
//   x, y:   number   爆发中心（视口坐标，仅 bubbles 使用，默认屏幕中心）
import { useMemo } from 'react';
import { motion } from 'framer-motion';

// 撒花配色：与新饱和海岛调色板一致（五主题 + 明黄点缀）。
const COLORS = ['#ff6f9f', '#ffc636', '#2fbd8b', '#4b90f5', '#a86bf5', '#ff9e2c'];
const SHAPES = ['🎉', '⭐', '✨', '🌟', '💖', '🎊'];
const STAR_SHAPES = ['⭐', '🌟', '✨'];

// 各预设默认粒子数：均控制在 30 个以内，避免低端设备掉帧。
const DEFAULT_COUNT = { confetti: 28, coins: 22, stars: 14, bubbles: 12 };

// ---- 各预设的粒子参数生成 ----

// 彩带（现状）：从中心随机飞散的纸片/emoji。
function makeConfetti(n) {
  return Array.from({ length: n }, (_, i) => {
    const angle = (Math.PI * 2 * i) / n + Math.random() * 0.5;
    const dist = 120 + Math.random() * 160;
    return {
      id: i,
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist - 40, // 略向上偏
      rot: (Math.random() - 0.5) * 720,
      delay: Math.random() * 0.15,
      dur: 1.1 + Math.random() * 0.7,
      useEmoji: Math.random() > 0.5,
      color: COLORS[i % COLORS.length],
      emoji: SHAPES[i % SHAPES.length],
      size: 14 + Math.random() * 16,
    };
  });
}

// 金币雨：从屏幕顶部不同水平位置落下的金币（CSS 圆形金币）。
function makeCoins(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: i,
    left: 4 + Math.random() * 92, // 水平位置（视口百分比）
    drift: (Math.random() - 0.5) * 80, // 下落过程的水平漂移
    rot: (Math.random() - 0.5) * 540,
    delay: Math.random() * 0.5,
    dur: 1.6 + Math.random() * 1.0,
    size: 18 + Math.random() * 14,
  }));
}

// 星星爆：⭐ 从中心向外弹射。
function makeStars(n) {
  return Array.from({ length: n }, (_, i) => {
    const angle = (Math.PI * 2 * i) / n + Math.random() * 0.4;
    const dist = 90 + Math.random() * 140;
    return {
      id: i,
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist - 30,
      rot: (Math.random() - 0.5) * 360,
      delay: Math.random() * 0.1,
      dur: 0.9 + Math.random() * 0.5,
      emoji: STAR_SHAPES[i % STAR_SHAPES.length],
      size: 18 + Math.random() * 18,
    };
  });
}

// 泡泡碎：小圆圈从点击点向外扩散淡出。
function makeBubbles(n) {
  return Array.from({ length: n }, (_, i) => {
    const angle = (Math.PI * 2 * i) / n + Math.random() * 0.5;
    const dist = 36 + Math.random() * 64;
    return {
      id: i,
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      delay: Math.random() * 0.06,
      dur: 0.5 + Math.random() * 0.35,
      size: 8 + Math.random() * 12,
    };
  });
}

const MAKERS = { confetti: makeConfetti, coins: makeCoins, stars: makeStars, bubbles: makeBubbles };

// 金币粒子的样式（CSS 圆形金币，避免 🪙 emoji 在部分平台缺字形）。
const coinStyle = (size) => ({
  width: size,
  height: size,
  borderRadius: '50%',
  background: 'radial-gradient(circle at 35% 30%, #ffe9a3, #ffc636 60%, #e8a012)',
  border: '2px solid #d18f00',
  boxShadow: 'inset 0 0 0 3px rgba(255,255,255,0.35)',
});

// 泡泡粒子的样式（空心小圆圈）。
const bubbleStyle = (size) => ({
  width: size,
  height: size,
  borderRadius: '50%',
  border: '2px solid rgba(255,255,255,0.9)',
  background: 'rgba(170,220,255,0.35)',
});

export default function Confetti({ preset = 'confetti', count, x, y }) {
  const n = count ?? DEFAULT_COUNT[preset] ?? DEFAULT_COUNT.confetti;
  const particles = useMemo(() => (MAKERS[preset] ?? makeConfetti)(n), [preset, n]);

  // 粒子层定位：coins 铺满视口（从顶部落）；bubbles 定位在点击点；其余沿用屏幕中心。
  const layerStyle =
    preset === 'coins'
      ? { top: 0, left: 0, width: '100%', height: '100%' }
      : preset === 'bubbles'
        ? {
            top: y ?? (typeof window !== 'undefined' ? window.innerHeight / 2 : 300),
            left: x ?? (typeof window !== 'undefined' ? window.innerWidth / 2 : 200),
          }
        : undefined;

  const fallHeight = typeof window !== 'undefined' ? window.innerHeight + 80 : 800;

  return (
    <div className="confetti-layer" style={layerStyle} aria-hidden="true">
      {preset === 'confetti' &&
        particles.map((p) => (
          <motion.span
            key={p.id}
            className="confetti-piece"
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.6 }}
            animate={{ x: p.x, y: p.y, opacity: 0, rotate: p.rot, scale: 1 }}
            transition={{ duration: p.dur, delay: p.delay, ease: 'easeOut' }}
            style={
              p.useEmoji
                ? { fontSize: p.size }
                : {
                    width: p.size,
                    height: p.size * 0.6,
                    background: p.color,
                    borderRadius: 3,
                  }
            }
          >
            {p.useEmoji ? p.emoji : ''}
          </motion.span>
        ))}

      {preset === 'coins' &&
        particles.map((p) => (
          <motion.span
            key={p.id}
            className="confetti-piece"
            initial={{ x: 0, y: -60, opacity: 1, rotate: 0 }}
            animate={{ x: p.drift, y: fallHeight, opacity: [1, 1, 0], rotate: p.rot }}
            transition={{ duration: p.dur, delay: p.delay, ease: 'easeIn' }}
            style={{ left: `${p.left}%`, ...coinStyle(p.size) }}
          />
        ))}

      {preset === 'stars' &&
        particles.map((p) => (
          <motion.span
            key={p.id}
            className="confetti-piece"
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.3 }}
            animate={{ x: p.x, y: p.y, opacity: 0, rotate: p.rot, scale: 1.2 }}
            transition={{ duration: p.dur, delay: p.delay, ease: 'easeOut' }}
            style={{ fontSize: p.size }}
          >
            {p.emoji}
          </motion.span>
        ))}

      {preset === 'bubbles' &&
        particles.map((p) => (
          <motion.span
            key={p.id}
            className="confetti-piece"
            initial={{ x: 0, y: 0, opacity: 0.9, scale: 0.4 }}
            animate={{ x: p.x, y: p.y, opacity: 0, scale: 1 }}
            transition={{ duration: p.dur, delay: p.delay, ease: 'easeOut' }}
            style={bubbleStyle(p.size)}
          />
        ))}
    </div>
  );
}
