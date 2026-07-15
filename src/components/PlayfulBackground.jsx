// 童趣动态背景：主题渐变天空 + 缓慢漂浮的云/星/泡/太阳。
// 纯 CSS/emoji，绝对定位，不拦截点击（pointer-events: none）。
// props:
//   variant: 'sky' | 'grass' | 'cozy'  背景基调
//   tint: 主题色（可选），叠加一层淡色光晕
import { motion } from 'framer-motion';

// 漂浮装饰配置：emoji + 位置 + 大小 + 动画参数。
const DECOR = {
  sky: [
    { e: '☁️', top: '8%', left: '10%', size: 44, dur: 9, dx: 18 },
    { e: '☁️', top: '18%', left: '70%', size: 60, dur: 12, dx: -22 },
    { e: '⭐', top: '30%', left: '22%', size: 26, dur: 5, dy: -14 },
    { e: '🌟', top: '12%', left: '48%', size: 22, dur: 6, dy: -10 },
    { e: '🎈', top: '55%', left: '82%', size: 40, dur: 10, dy: -20 },
    { e: '✨', top: '42%', left: '60%', size: 20, dur: 4, dy: -8 },
  ],
  grass: [
    { e: '☁️', top: '10%', left: '14%', size: 48, dur: 10, dx: 20 },
    { e: '🦋', top: '38%', left: '75%', size: 30, dur: 7, dy: -18 },
    { e: '🌸', top: '60%', left: '10%', size: 26, dur: 6, dy: -10 },
    { e: '🌿', top: '72%', left: '85%', size: 30, dur: 8, dx: -12 },
    { e: '☀️', top: '8%', left: '78%', size: 44, dur: 14, dy: -6 },
  ],
  cozy: [
    { e: '⭐', top: '14%', left: '16%', size: 24, dur: 5, dy: -12 },
    { e: '💤', top: '26%', left: '72%', size: 28, dur: 7, dy: -16 },
    { e: '🌙', top: '10%', left: '82%', size: 40, dur: 12, dy: -6 },
    { e: '✨', top: '48%', left: '20%', size: 20, dur: 4, dy: -8 },
  ],
};

const BG = {
  sky: 'radial-gradient(circle at 20% 8%, #fff3d9 0, transparent 42%), radial-gradient(circle at 88% 22%, #e6f3ff 0, transparent 44%), linear-gradient(180deg, #eaf6ff 0%, var(--c-paper) 60%)',
  grass: 'radial-gradient(circle at 15% 10%, #eaffe6 0, transparent 40%), linear-gradient(180deg, #eaf7ff 0%, #f2fbe8 70%, var(--c-paper) 100%)',
  cozy: 'radial-gradient(circle at 80% 12%, #efe6ff 0, transparent 45%), linear-gradient(180deg, #f3ecff 0%, var(--c-paper) 65%)',
};

export default function PlayfulBackground({ variant = 'sky' }) {
  const items = DECOR[variant] ?? DECOR.sky;
  return (
    <div
      className="playful-bg"
      aria-hidden="true"
      style={{ background: BG[variant] ?? BG.sky }}
    >
      {items.map((it, i) => (
        <motion.span
          key={i}
          className="playful-decor"
          style={{ top: it.top, left: it.left, fontSize: it.size }}
          animate={{
            x: it.dx ? [0, it.dx, 0] : 0,
            y: it.dy ? [0, it.dy, 0] : [0, -8, 0],
          }}
          transition={{ duration: it.dur, repeat: Infinity, ease: 'easeInOut' }}
        >
          {it.e}
        </motion.span>
      ))}
    </div>
  );
}
