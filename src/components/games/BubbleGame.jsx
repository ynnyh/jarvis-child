// 点泡泡（看字选图）：顶部舞台大字，下方气泡裹着 emoji 缓缓上浮漂移，
// 点对：气泡在点击坐标爆开（bubbles 粒子 + pop）；点错：气泡晃一晃。
//
// 舞台化小游戏统一接口（由 GamePlay 引擎调度，五个游戏组件同一约定）：
//   target:   目标字完整数据 {char, pinyin, emoji, hint, ...}
//   options:  含正确项的选项数组（引擎已洗牌，干扰项优先同课；emoji 已去重）
//   reveal:   答错扣心后由引擎置 true —— 演示正确答案（高亮 + 朗读），等孩子点对；
//             点对后回调 onResult(true, {firstTry:false}) 请求推进。组件不自行推进题目。
//   onResult: (correct, {firstTry}) => void   首次作答上报；节奏由 GamePlay 决定
//   onSpeak(text) / onSound(name)             由引擎注入
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import Confetti from '../Confetti.jsx';

export default function BubbleGame({ target, options, reveal, onResult, onSpeak, onSound }) {
  const doneRef = useRef(false); // 本题已点对（锁定输入）
  const wrongRef = useRef(false); // 已上报过答错
  const [poppedId, setPoppedId] = useState(null); // 已戳破的泡泡
  const [wobbleId, setWobbleId] = useState(null); // 点错晃动的泡泡
  const [popAt, setPopAt] = useState(null); // 爆点坐标（视口）

  // reveal：朗读目标字做演示（高亮由样式负责）。
  useEffect(() => {
    if (reveal) onSpeak?.(target.char);
  }, [reveal, target.char, onSpeak]);

  const pick = (opt, e) => {
    if (doneRef.current) return;
    const ok = opt.char === target.char;
    if (ok) {
      doneRef.current = true;
      setPoppedId(opt.char);
      setPopAt({ x: e.clientX, y: e.clientY });
      onSound?.('pop');
      onResult?.(true, { firstTry: !wrongRef.current });
      return;
    }
    // 点错：晃一晃；仅首次答错上报（演示阶段点错只晃，不再扣心）。
    setWobbleId(opt.char);
    setTimeout(() => setWobbleId(null), 450);
    if (!wrongRef.current) {
      wrongRef.current = true;
      onResult?.(false, { firstTry: false });
    }
  };

  return (
    <div className="game-stage bubble-stage">
      <div className="stage-head-col">
        <div className="q-char bubble-target">{target.char}</div>
        <p className="q-tip">戳破装着正确图画的泡泡</p>
      </div>
      <div className="bubble-sea">
        {options.map((opt, i) => {
          if (poppedId === opt.char) return null; // 已戳破：粒子负责告别
          const isTarget = opt.char === target.char;
          return (
            <motion.button
              key={opt.char}
              type="button"
              className={`bubble ${reveal && isTarget ? 'reveal' : ''} ${
                wobbleId === opt.char ? 'shake' : ''
              }`}
              style={{ left: `${6 + i * 24}%` }}
              initial={{ y: 120, opacity: 0 }}
              animate={{
                opacity: 1,
                y: [0, -16, 0, -9, 0],
                x: [0, 7, 0, -7, 0],
              }}
              transition={{
                opacity: { duration: 0.3, delay: i * 0.08 },
                y: { duration: 4 + i * 0.7, repeat: Infinity, ease: 'easeInOut' },
                x: { duration: 5 + i * 0.6, repeat: Infinity, ease: 'easeInOut' },
              }}
              whileTap={{ scale: 0.9 }}
              onClick={(e) => pick(opt, e)}
            >
              {opt.emoji}
            </motion.button>
          );
        })}
      </div>
      {popAt && <Confetti preset="bubbles" x={popAt.x} y={popAt.y} />}
    </div>
  );
}
