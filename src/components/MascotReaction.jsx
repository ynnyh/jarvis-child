// 小墨情绪反应：答对/答错时从屏幕底角弹出小墨 + 一句气泡话，短暂停留后自动消失。
// 用于游戏、即时检查等即时反馈场景。
// props:
//   type: 'correct' | 'wrong' | null   反应类型（null 不显示）
//   onHide: () => void                 自动消失回调
import { useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Xiaomo from './mascot/Xiaomo.jsx';

const MSG = {
  correct: ['答对啦！', '真棒！', '好厉害！', '就是它！'],
  wrong: ['再想想～', '不是这个哦', '换一个试试', '加油！'],
};

export default function MascotReaction({ type, onHide, duration = 1400 }) {
  useEffect(() => {
    if (!type || !onHide) return undefined;
    const t = setTimeout(onHide, duration);
    return () => clearTimeout(t);
  }, [type, onHide, duration]);

  const msg =
    type && MSG[type]
      ? MSG[type][Math.floor(Math.random() * MSG[type].length)]
      : '';

  return (
    <AnimatePresence>
      {type && (
        <motion.div
          className="mascot-reaction"
          aria-hidden="true"
          initial={{ x: -120, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -120, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 22 }}
        >
          <Xiaomo
            expression={type === 'correct' ? 'cheer' : 'encourage'}
            size={72}
          />
          <span className={`mascot-bubble ${type}`}>{msg}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
