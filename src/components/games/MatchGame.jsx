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
  // 每对带稳定 id：连线/消除全部按 id 判断，而非按显示值。否则当两个字的
  // 拼音相同（同音字）或 emoji 相同（回退到默认 📖）时，按值匹配会标错/隐藏
  // 错误的 tile，且 React key 撞车。
  const pairs = useMemo(() => {
    const picked = shuffle(chars).slice(0, Math.min(5, chars.length));
    return picked.map((c, i) => ({
      id: `${c.char}-${i}`,
      char: c.char,
      right: pairBy === 'emoji' ? c.emoji : c.pinyin,
    }));
  }, [chars, pairBy]);

  // 左右列各持 pair 的 {id, 显示值}，右列独立打乱。
  const leftItems = useMemo(
    () => shuffle(pairs.map((p) => ({ id: p.id, char: p.char }))),
    [pairs]
  );
  const rightItems = useMemo(
    () => shuffle(pairs.map((p) => ({ id: p.id, right: p.right }))),
    [pairs]
  );

  const [selectedLeft, setSelectedLeft] = useState(null);   // pair id
  const [selectedRight, setSelectedRight] = useState(null); // pair id
  const [matched, setMatched] = useState([]); // 已配对的 pair id 列表
  const [wrongPair, setWrongPair] = useState(false);

  const tryMatch = useCallback(
    (leftId, rightId) => {
      // 同一 pair 的左右两半 id 相同即配对成功。
      if (leftId === rightId) {
        const nextMatched = [...matched, leftId];
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
    [matched, pairs.length, onComplete, onSound]
  );

  const pickLeft = useCallback(
    (item) => {
      if (matched.includes(item.id)) return;
      onSpeak?.(item.char);
      setSelectedLeft(item.id);
      if (selectedRight != null) tryMatch(item.id, selectedRight);
    },
    [matched, selectedRight, tryMatch, onSpeak]
  );

  const pickRight = useCallback(
    (item) => {
      if (matched.includes(item.id)) return;
      setSelectedRight(item.id);
      if (selectedLeft != null) tryMatch(selectedLeft, item.id);
    },
    [matched, selectedLeft, tryMatch]
  );

  return (
    <div className="match-game">
      <p className="q-tip">连一连，找出好朋友</p>
      <div className="match-columns">
        <div className="match-col">
          <AnimatePresence>
            {leftItems.map((item) => {
              if (matched.includes(item.id)) return null;
              return (
                <motion.button
                  key={item.id}
                  layout
                  exit={{ scale: 0, opacity: 0 }}
                  className={`match-item char ${selectedLeft === item.id ? 'sel' : ''} ${
                    wrongPair && selectedLeft === item.id ? 'wrong' : ''
                  }`}
                  onClick={() => pickLeft(item)}
                >
                  {item.char}
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
        <div className="match-col">
          <AnimatePresence>
            {rightItems.map((item) => {
              if (matched.includes(item.id)) return null;
              return (
                <motion.button
                  key={item.id}
                  layout
                  exit={{ scale: 0, opacity: 0 }}
                  className={`match-item right ${selectedRight === item.id ? 'sel' : ''} ${
                    wrongPair && selectedRight === item.id ? 'wrong' : ''
                  }`}
                  onClick={() => pickRight(item)}
                >
                  {item.value}
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
