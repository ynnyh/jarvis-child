// 连连看：左列汉字、右列拼音（或 emoji），点一个左、点一个右，配对成功则消除。
// 全部配对完成即过关。属于「整屏一题」的题型，和 GamePlay 里的单字题结构不同，
// 因此独立成组件，由 GamePlay 在 type === 'match' 时整屏渲染。
import { useCallback, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// pairBy: 'pinyin' 字↔拼音；'emoji' 字↔图。
export default function MatchGame({ chars, pairBy = 'pinyin', onComplete, onSpeak, onSound }) {
  // 取 4-5 对来配（太多屏幕挤）。
  const pairs = useMemo(() => {
    const picked = shuffle(chars).slice(0, Math.min(5, chars.length));
    return picked.map((c) => ({
      char: c.char,
      right: pairBy === 'emoji' ? c.emoji : c.pinyin,
    }));
  }, [chars, pairBy]);

  const leftItems = useMemo(() => shuffle(pairs.map((p) => p.char)), [pairs]);
  const rightItems = useMemo(() => shuffle(pairs.map((p) => p.right)), [pairs]);

  const [selectedLeft, setSelectedLeft] = useState(null);
  const [selectedRight, setSelectedRight] = useState(null);
  const [matched, setMatched] = useState([]); // 已配对的 char 列表
  const [wrongPair, setWrongPair] = useState(false);

  const rightOf = useCallback(
    (char) => pairs.find((p) => p.char === char)?.right,
    [pairs]
  );

  const tryMatch = useCallback(
    (left, right) => {
      if (rightOf(left) === right) {
        const nextMatched = [...matched, left];
        setMatched(nextMatched);
        setSelectedLeft(null);
        setSelectedRight(null);
        onSound?.('correct');
        if (nextMatched.length === pairs.length) {
          setTimeout(() => onComplete?.(), 500);
        }
      } else {
        // 配错：短暂提示后清空选择。
        setWrongPair(true);
        onSound?.('wrong');
        setTimeout(() => {
          setWrongPair(false);
          setSelectedLeft(null);
          setSelectedRight(null);
        }, 500);
      }
    },
    [matched, pairs.length, rightOf, onComplete, onSound]
  );

  const pickLeft = useCallback(
    (char) => {
      if (matched.includes(char)) return;
      onSpeak?.(char);
      setSelectedLeft(char);
      if (selectedRight != null) tryMatch(char, selectedRight);
    },
    [matched, selectedRight, tryMatch, onSpeak]
  );

  const pickRight = useCallback(
    (right) => {
      if (matched.some((c) => rightOf(c) === right)) return;
      setSelectedRight(right);
      if (selectedLeft != null) tryMatch(selectedLeft, right);
    },
    [matched, selectedLeft, tryMatch, rightOf]
  );

  return (
    <div className="match-game">
      <p className="q-tip">连一连，找出好朋友</p>
      <div className="match-columns">
        <div className="match-col">
          <AnimatePresence>
            {leftItems.map((char) => {
              const done = matched.includes(char);
              if (done) return null;
              return (
                <motion.button
                  key={char}
                  layout
                  exit={{ scale: 0, opacity: 0 }}
                  className={`match-item char ${selectedLeft === char ? 'sel' : ''} ${
                    wrongPair && selectedLeft === char ? 'wrong' : ''
                  }`}
                  onClick={() => pickLeft(char)}
                >
                  {char}
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
        <div className="match-col">
          <AnimatePresence>
            {rightItems.map((right) => {
              const done = matched.some((c) => rightOf(c) === right);
              if (done) return null;
              return (
                <motion.button
                  key={right}
                  layout
                  exit={{ scale: 0, opacity: 0 }}
                  className={`match-item right ${selectedRight === right ? 'sel' : ''} ${
                    wrongPair && selectedRight === right ? 'wrong' : ''
                  }`}
                  onClick={() => pickRight(right)}
                >
                  {right}
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
