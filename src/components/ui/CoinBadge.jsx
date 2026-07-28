// 金币徽章：绘制金币（不再用 emoji）+ 数值变化时金币翻面、数字跳动。
import { motion, AnimatePresence } from 'framer-motion';

function CoinIcon() {
  return (
    <svg viewBox="0 0 28 28" className="coin3-ic" aria-hidden="true">
      <circle cx="14" cy="14" r="12" fill="#ffd54a" />
      <circle cx="14" cy="14" r="12" fill="none" stroke="#e0a52e" strokeWidth="2" />
      <circle cx="14" cy="14" r="8" fill="#ffe58a" />
      <path d="M10.5 10.5 L14 16 L17.5 10.5 M11 15 h6 M11 18 h6 M14 15 v5" stroke="#d9931e" strokeWidth="1.9" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <ellipse cx="10" cy="8.5" rx="3.4" ry="1.8" fill="rgba(255,255,255,0.75)" transform="rotate(-28 10 8.5)" />
    </svg>
  );
}

export default function CoinBadge({ count = 0 }) {
  return (
    <div className="coin3" aria-label={`金币 ${count}`}>
      {/* 金币翻面：count 变化 → key 重挂 → rotateY 入场 */}
      <motion.span
        key={`c-${count}`}
        initial={{ rotateY: 180, scale: 1.25 }}
        animate={{ rotateY: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 18 }}
        style={{ display: 'inline-flex' }}
      >
        <CoinIcon />
      </motion.span>
      <AnimatePresence mode="popLayout">
        <motion.span
          key={count}
          initial={{ y: -12, opacity: 0, scale: 1.4 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 12, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 24 }}
        >
          {count}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
