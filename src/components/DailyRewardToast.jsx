// 每日任务完成通知（阶段 3）：轻量 toast，徽章弹跳 + 得星音效 + 金币+N。
// 在 LearnFlow / GamePlay / StoryReader 的结算处，trackDaily 返回 completed 非空时弹出。
// props:
//   reward: { completed: [...], coins: n }  trackDaily 的返回值
//   onDone: () => void                       关闭回调（点击或 2.6s 自动关闭）
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSound } from '../hooks/useSound.js';

// 任务类型 → 展示文案（不朗读，无需进语音白名单）。
const TASK_LABEL = {
  learn: '📖 学字任务完成！',
  game: '🎮 游戏任务完成！',
  story: '📗 绘本任务完成！',
  all: '🏆 全部任务完成！',
};

export default function DailyRewardToast({ reward, onDone }) {
  const { play } = useSound();

  // 入场配音 + 自动关闭。
  useEffect(() => {
    play('star');
    const t = setTimeout(() => onDone?.(), 2600);
    return () => clearTimeout(t);
  }, [play, onDone]);

  if (!reward) return null;
  return (
    <motion.div
      className="daily-toast"
      role="status"
      onClick={() => onDone?.()}
      initial={{ y: -80, opacity: 0, scale: 0.7 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: -60, opacity: 0, scale: 0.8 }}
      transition={{ type: 'spring', stiffness: 380, damping: 20 }}
    >
      <motion.span
        className="daily-toast-badge"
        initial={{ scale: 0, rotate: -30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ delay: 0.15, type: 'spring', stiffness: 400, damping: 10 }}
      >
        🏅
      </motion.span>
      <div className="daily-toast-lines">
        {reward.completed.map((k) => (
          <div key={k} className="daily-toast-line">{TASK_LABEL[k] ?? k}</div>
        ))}
        {reward.coins > 0 && <div className="daily-toast-coins">🪙 +{reward.coins}</div>}
      </div>
    </motion.div>
  );
}
