// 象形字演变动画：把「实物 → 过渡形 → 汉字」逐步渐变展示，讲清"字是怎么来的"。
// 仅 28 个象形字有 pictograph 数据（见 metadata），其余字不渲染此组件。
//
// pictograph 是一个步骤数组，如 ['🌞', '⊙', '日']：
//   第一步通常是实物 emoji，最后一步是汉字，中间是过渡形态。
import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Pictograph({ steps, onSpeak, autoPlay = true }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(autoPlay);

  const total = Array.isArray(steps) ? steps.length : 0;

  // 自动逐步推进；到最后一步停住。
  useEffect(() => {
    if (!playing || total === 0) return undefined;
    if (index >= total - 1) {
      setPlaying(false);
      return undefined;
    }
    const t = setTimeout(() => setIndex((i) => i + 1), 1100);
    return () => clearTimeout(t);
  }, [playing, index, total]);

  const replay = useCallback(() => {
    setIndex(0);
    setPlaying(true);
  }, []);

  if (total === 0) return null;

  const isLast = index === total - 1;

  return (
    <div className="pictograph">
      <div className="pictograph-stage">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            className="pictograph-glyph"
            initial={{ opacity: 0, scale: 0.6, rotate: -8 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 1.3 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            {steps[index]}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 步骤小圆点，显示演变进度 */}
      <div className="pictograph-dots">
        {steps.map((s, i) => (
          <span
            key={i}
            className={`pictograph-dot ${i === index ? 'active' : ''} ${i < index ? 'done' : ''}`}
          />
        ))}
      </div>

      <button
        className="pictograph-replay"
        onClick={() => {
          replay();
          onSpeak?.();
        }}
      >
        {isLast ? '再看一次 🔁' : '演变中…'}
      </button>
    </div>
  );
}
