// 打地鼠（听音选字）：自动朗读目标字，4 个地洞里的地鼠举着字牌错位冒头，
// 点中目标字：木槌落下 + whack + 地鼠晕圈 + 星星粒子；点错：地鼠缩回摇头。
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
import Confetti from '../Confetti.jsx';
import SpeakerButton from '../ui/SpeakerButton.jsx';

export default function MoleGame({ target, options, reveal, onResult, onSpeak, onSound }) {
  const doneRef = useRef(false); // 本题已点对（锁定输入，等引擎推进）
  const wrongRef = useRef(false); // 已上报过答错（防重复扣心）
  const [hitId, setHitId] = useState(null); // 被敲中的地鼠（晕圈表情）
  const [shakeId, setShakeId] = useState(null); // 点错摇头的地鼠
  const [burst, setBurst] = useState(false); // 星星粒子

  // 进场自动朗读目标字。
  useEffect(() => {
    onSpeak?.(target.char);
  }, [target.char, onSpeak]);

  // reveal：朗读正确答案做演示（高亮由样式负责）。
  useEffect(() => {
    if (reveal) onSpeak?.(target.char);
  }, [reveal, target.char, onSpeak]);

  const pick = (opt) => {
    if (doneRef.current) return;
    const ok = opt.char === target.char;
    if (ok) {
      doneRef.current = true;
      setHitId(opt.char);
      setBurst(true);
      onSound?.('whack');
      // wrongRef 标记本题是否首次即对（reveal 前必有 wrong 上报，故无需再看 reveal）。
      onResult?.(true, { firstTry: !wrongRef.current });
      return;
    }
    // 点错：摇头缩回；仅首次答错上报（演示阶段点错只摇头，不再扣心）。
    setShakeId(opt.char);
    setTimeout(() => setShakeId(null), 450);
    if (!wrongRef.current) {
      wrongRef.current = true;
      onResult?.(false, { firstTry: false });
    }
  };

  return (
    <div className="game-stage mole-stage">
      <div className="stage-head">
        <SpeakerButton size="md" onClick={() => onSpeak?.(target.char)} />
        <p className="q-tip">听一听，敲出对的字</p>
      </div>
      <div className="mole-field">
        {options.map((opt, i) => {
          const isTarget = opt.char === target.char;
          const hit = hitId === opt.char;
          return (
            <div key={opt.char} className="mole-hole">
              <motion.button
                type="button"
                className={`mole ${hit ? 'hit' : ''} ${reveal && isTarget ? 'reveal' : ''} ${
                  shakeId === opt.char ? 'shake' : ''
                }`}
                initial={{ y: 96, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.15 + i * 0.12, type: 'spring', stiffness: 280, damping: 15 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => pick(opt)}
              >
                <span className="mole-face">{hit ? '😵' : '🐹'}</span>
                <span className="mole-sign">{opt.char}</span>
              </motion.button>
              {hit && (
                <motion.span
                  className="mole-hammer"
                  initial={{ rotate: -70, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  transition={{ duration: 0.16 }}
                >
                  🔨
                </motion.span>
              )}
            </div>
          );
        })}
      </div>
      {burst && <Confetti preset="stars" />}
    </div>
  );
}
