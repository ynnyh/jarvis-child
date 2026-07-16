// 宝箱：点击开箱，抖动后弹出奖励（金币为主，偶尔额外惊喜）。
// 用于课程完成、连续打卡里程碑等场景，给孩子"开箱"的期待感。
//
// props:
//   coins: number       本次开箱的金币数（必给）
//   bonus?: string       额外奖励文案（如 '🍎 小墨的食物 ×1'），可空
//   onOpen?: () => void  开箱动画结束、点"收下"后回调（在这里发放奖励）
import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSound } from '../hooks/useSound.js';
import Confetti from './Confetti.jsx';

export default function Chest({ coins = 10, bonus = null, onOpen }) {
  const [state, setState] = useState('closed'); // closed | shaking | open
  const { play } = useSound();
  const shakeTimer = useRef(null);

  // 卸载时清掉开箱定时器，避免动画途中关闭浮层后 setState 警告。
  useEffect(() => () => clearTimeout(shakeTimer.current), []);

  const open = useCallback(() => {
    if (state !== 'closed') return;
    setState('shaking');
    play('chest');
    // 抖动一下再打开。
    shakeTimer.current = setTimeout(() => setState('open'), 600);
  }, [state, play]);

  return (
    <div className="chest-overlay" role="dialog" aria-label="宝箱">
      <div className="chest-card">
        <AnimatePresence mode="wait">
          {state !== 'open' ? (
            <motion.button
              key="chest"
              className="chest-box"
              onClick={open}
              aria-label="打开宝箱"
              animate={
                state === 'shaking'
                  ? { rotate: [0, -8, 8, -8, 8, 0], scale: [1, 1.05, 1.05, 1.05, 1.05, 1.1] }
                  : { y: [0, -8, 0] }
              }
              transition={
                state === 'shaking'
                  ? { duration: 0.6 }
                  : { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }
              }
            >
              🎁
            </motion.button>
          ) : (
            <motion.div
              key="reward"
              className="chest-reward"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 16 }}
            >
              <Confetti count={32} />
              <div className="chest-burst">✨🎉✨</div>
              <div className="chest-coins">🪙 +{coins}</div>
              {bonus && <div className="chest-bonus">{bonus}</div>}
              <button
                className="ui-btn ui-btn--primary ui-btn--lg"
                onClick={() => { play('coin'); onOpen?.(); }}
              >
                收下啦 →
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        {state === 'closed' && <p className="chest-tip">点一下打开宝箱！</p>}
      </div>
    </div>
  );
}
