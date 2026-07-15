// 撒花粒子庆祝：彩色纸片 + 星星从中心迸发飞散。
// 纯 framer-motion + CSS 元素，无素材。挂载即播放一次。
// 覆盖在奖励弹层等场景之上（pointer-events: none，不拦点击）。
import { useMemo } from 'react';
import { motion } from 'framer-motion';

const COLORS = ['#FF8FB1', '#FFD166', '#5CC9A7', '#6FA8FF', '#C08CFF', '#FFB454'];
const SHAPES = ['🎉', '⭐', '✨', '🌟', '💖', '🎊'];

// 生成 N 个粒子的随机飞散参数。
function makeParticles(n) {
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

export default function Confetti({ count = 28 }) {
  const particles = useMemo(() => makeParticles(count), [count]);
  return (
    <div className="confetti-layer" aria-hidden="true">
      {particles.map((p) => (
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
    </div>
  );
}
