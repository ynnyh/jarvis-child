// 星级展示：0-3 星，可选逐颗弹入动画。用于关卡节点、字卡、结算。
import { motion } from 'framer-motion';

export default function StarRating({ value = 0, max = 3, size = 24, animate = false }) {
  return (
    <span className="star-rating" aria-label={`${value} 星`} style={{ fontSize: size }}>
      {Array.from({ length: max }, (_, i) => {
        const filled = i < value;
        return (
          <motion.span
            key={i}
            className={`star-rating__star ${filled ? 'filled' : 'empty'}`}
            initial={animate ? { scale: 0, rotate: -30 } : false}
            animate={animate ? { scale: 1, rotate: 0 } : false}
            transition={{ delay: i * 0.15, type: 'spring', stiffness: 400, damping: 12 }}
          >
            {filled ? '⭐' : '☆'}
          </motion.span>
        );
      })}
    </span>
  );
}
