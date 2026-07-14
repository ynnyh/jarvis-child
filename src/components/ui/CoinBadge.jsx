// 金币徽章：显示当前金币数，数值变化时有跳动动画。
import { motion, AnimatePresence } from 'framer-motion';

export default function CoinBadge({ count = 0 }) {
  return (
    <div className="coin-badge" aria-label={`金币 ${count}`}>
      <span className="coin-badge__icon">🪙</span>
      <AnimatePresence mode="popLayout">
        <motion.span
          key={count}
          className="coin-badge__count"
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
