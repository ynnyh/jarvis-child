// 奖励弹层：展示本次获得的星星（1-3），可选标题与金币奖励，带弹跳动画。
// 小墨欢呼助阵，给小朋友即时成就感。
// props:
//   stars: 0-3        本次星级
//   title: string     顶部标题，默认「太棒啦！」
//   coins: number     本次获得金币（>0 才显示）
//   onDone: () => void  点击继续/自动关闭时回调
//   autoCloseMs: number 自动关闭毫秒数，默认 2600；传 0 关闭自动关闭
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import Xiaomo from './mascot/Xiaomo.jsx';
import Confetti from './Confetti.jsx';

export default function StarReward({
  stars = 0,
  title = '太棒啦！',
  coins = 0,
  onDone,
  autoCloseMs = 2600,
}) {
  useEffect(() => {
    if (!onDone || !autoCloseMs) return undefined;
    const t = setTimeout(onDone, autoCloseMs);
    return () => clearTimeout(t);
  }, [onDone, autoCloseMs]);

  return (
    <motion.div
      className="reward-overlay"
      role="dialog"
      aria-label="奖励"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {stars >= 2 && <Confetti />}
      <motion.div
        className="reward-card"
        initial={{ scale: 0.6, y: 40 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 18 }}
      >
        <Xiaomo expression="cheer" size={120} />
        <div className="reward-title">{title}</div>
        <div className="reward-stars">
          {[1, 2, 3].map((n) => (
            <motion.span
              key={n}
              className={`reward-star ${n <= stars ? 'filled' : 'empty'}`}
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2 + n * 0.15, type: 'spring', stiffness: 400, damping: 12 }}
            >
              {n <= stars ? '⭐' : '☆'}
            </motion.span>
          ))}
        </div>
        {coins > 0 && (
          <motion.div
            className="reward-coins"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.7, type: 'spring', stiffness: 300 }}
          >
            🪙 +{coins}
          </motion.div>
        )}
        <button className="ui-btn ui-btn--primary ui-btn--lg" onClick={onDone}>
          继续 →
        </button>
      </motion.div>
    </motion.div>
  );
}
