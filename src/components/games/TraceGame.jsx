// 描红（笔顺测评）：包装 HanziWriter 的 quiz 模式接入游戏引擎。
// 描完按 hanzi-writer 的 mistakes 计数判分：0 错 → onResult(true, {firstTry:true})；
// 有错 → onResult(false, {firstTry:false})，引擎扣心后置 reveal：
// 演示笔顺 + 朗读，然后自动重开一局描红（重试不再扣心），再描完即报完成。
//
// 舞台化小游戏统一接口（由 GamePlay 引擎调度，五个游戏组件同一约定）：
//   target:   目标字完整数据 {char, pinyin, emoji, hint, ...}
//   reveal:   答错扣心后由引擎置 true —— 演示正确答案（笔顺动画 + 朗读）并重开描红
//   onResult: (correct, {firstTry, mistakes}) => void   节奏由 GamePlay 决定
//   onSpeak(text) / onSound(name)                       由引擎注入
import { useEffect, useRef, useState } from 'react';
import HanziWriter from '../HanziWriter.jsx';
import Confetti from '../Confetti.jsx';

export default function TraceGame({ target, reveal, onResult, onSpeak, onSound }) {
  const writerRef = useRef(null);
  const failedOnceRef = useRef(false); // 已上报过一次"有错"（重试不再扣心）
  const doneRef = useRef(false); // 已报完成（锁定）
  const [showStars, setShowStars] = useState(false);

  // 进场稍候自动开描（等画布/笔画数据就绪）。
  useEffect(() => {
    const t = setTimeout(() => writerRef.current?.startQuiz(), 500);
    return () => clearTimeout(t);
  }, []);

  // reveal：演示笔顺 + 朗读，然后自动重开一局描红。
  useEffect(() => {
    if (!reveal) return undefined;
    onSpeak?.(target.char);
    writerRef.current?.animate();
    const t = setTimeout(() => writerRef.current?.startQuiz(), 1800);
    return () => clearTimeout(t);
  }, [reveal, target.char, onSpeak]);

  const handleComplete = (summary) => {
    if (doneRef.current) return;
    const mistakes = summary?.totalMistakes ?? 0;
    if (!failedOnceRef.current && mistakes > 0) {
      // 首次描完但有错：上报答错，等引擎 reveal 后重描。
      failedOnceRef.current = true;
      onResult?.(false, { firstTry: false, mistakes });
      return;
    }
    doneRef.current = true;
    setShowStars(true);
    onSound?.('levelup');
    onResult?.(true, { firstTry: !failedOnceRef.current, mistakes });
  };

  return (
    <div className="game-stage trace-stage">
      <p className="q-tip">照着描一描：{target.char}</p>
      <HanziWriter
        ref={writerRef}
        char={target.char}
        size={260}
        onQuizComplete={handleComplete}
      />
      <div className="q-trace-actions">
        <button
          type="button"
          className="ui-btn ui-btn--secondary ui-btn--lg"
          onClick={() => {
            onSound?.('tap');
            onSpeak?.(target.char);
            writerRef.current?.animate();
          }}
        >
          👀 看笔顺
        </button>
      </div>
      {showStars && <Confetti preset="stars" />}
    </div>
  );
}
