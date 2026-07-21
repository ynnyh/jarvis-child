// 钓鱼（看图选字）：顶部大 emoji 图 + 提示语，下方"水面"4 条字牌小鱼左右游动
// （无限往返、速度各异），点中：鱼被钓线勾起（splash）；点错：鱼甩尾游走。
//
// 舞台化小游戏统一接口（由 GamePlay 引擎调度，五个游戏组件同一约定）：
//   target:   目标字完整数据 {char, pinyin, emoji, hint, ...}
//   options:  含正确项的选项数组（引擎已洗牌，干扰项优先同课）
//   reveal:   答错扣心后由引擎置 true —— 演示正确答案（高亮 + 朗读），等孩子点对；
//             点对后回调 onResult(true, {firstTry:false}) 请求推进。组件不自行推进题目。
//   onResult: (correct, {firstTry}) => void   首次作答上报；节奏由 GamePlay 决定
//   onSpeak(text) / onSound(name)             由引擎注入
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

export default function FishGame({ target, options, reveal, onResult, onSpeak, onSound }) {
  const doneRef = useRef(false); // 本题已点对（锁定输入）
  const wrongRef = useRef(false); // 已上报过答错
  const [caughtId, setCaughtId] = useState(null); // 被钓起的鱼
  const [shakeId, setShakeId] = useState(null); // 点错甩尾的鱼

  // reveal：朗读目标字做演示（高亮由样式负责）。
  useEffect(() => {
    if (reveal) onSpeak?.(target.char);
  }, [reveal, target.char, onSpeak]);

  const pick = (opt) => {
    if (doneRef.current) return;
    const ok = opt.char === target.char;
    if (ok) {
      doneRef.current = true;
      setCaughtId(opt.char);
      onSound?.('splash');
      onResult?.(true, { firstTry: !wrongRef.current });
      return;
    }
    // 点错：甩尾；仅首次答错上报（演示阶段点错只甩尾，不再扣心）。
    setShakeId(opt.char);
    setTimeout(() => setShakeId(null), 450);
    if (!wrongRef.current) {
      wrongRef.current = true;
      onResult?.(false, { firstTry: false });
    }
  };

  return (
    <div className="game-stage fish-stage">
      <div className="stage-head-col">
        <div className="fish-emoji">{target.emoji}</div>
        <p className="q-tip">{target.hint}</p>
      </div>
      <div className="fish-water">
        {options.map((opt, i) => {
          const isTarget = opt.char === target.char;
          const caught = caughtId === opt.char;
          return (
            <motion.button
              key={opt.char}
              type="button"
              className={`fish fish--${i} ${caught ? 'caught' : ''} ${
                reveal && isTarget ? 'reveal' : ''
              } ${shakeId === opt.char ? 'shake' : ''}`}
              style={{ top: `${6 + i * 23}%` }}
              initial={{ x: i % 2 ? 200 : 0, opacity: 0 }}
              animate={
                caught
                  ? { y: -180, rotate: -24, opacity: 0 }
                  : { x: [i % 2 ? 200 : 0, i % 2 ? 0 : 200], opacity: 1 }
              }
              transition={
                caught
                  ? { duration: 0.55, ease: 'easeIn' }
                  : {
                      x: {
                        duration: 7 + i * 1.4,
                        repeat: Infinity,
                        repeatType: 'reverse',
                        ease: 'easeInOut',
                      },
                      opacity: { duration: 0.3 },
                    }
              }
              whileTap={{ scale: 0.92 }}
              onClick={() => pick(opt)}
            >
              <span className="fish-body">{opt.char}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
