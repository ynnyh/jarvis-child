// 连连看（字 ↔ 拼音）：左列汉字、右列拼音，点一个左、点一个右。
// 配对成功：画一条弹性连线 + 消除爆点 + pluck；配错：两边晃红 + wrong。
// 全部配对完成回调 onResult(true, {firstTry: 本局有无错配})。
// 配错不单独上报（试错是连连看玩法本身，由引擎决定是否计错误，不扣心）。
//
// 舞台化小游戏统一接口（由 GamePlay 引擎调度，五个游戏组件同一约定）：
//   chars:    本课字数组（组件内取最多 5 对）
//   onResult: (correct, {firstTry}) => void   只在全部配对完成时上报一次
//   onSpeak(text) / onSound(name)             由引擎注入
// 说明：右列渲染 pair.right（拼音）。旧版误用 item.value 导致右列空白，重写后消除。
import { useCallback, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function MatchGame({ chars, onResult, onSpeak, onSound }) {
  // 取 4-5 对来配（太多屏幕挤）。每对带稳定 id：连线/配对全部按 id 判断，
  // 避免同音字按值匹配标错。
  const pairs = useMemo(() => {
    const picked = shuffle(chars).slice(0, Math.min(5, chars.length));
    return picked.map((c, i) => ({ id: `${c.char}-${i}`, char: c.char, right: c.pinyin }));
  }, [chars]);

  // 左右列各持 pair 的 {id, 显示值}，右列独立打乱。
  const leftItems = useMemo(() => shuffle(pairs.map((p) => ({ id: p.id, char: p.char }))), [pairs]);
  const rightItems = useMemo(() => shuffle(pairs.map((p) => ({ id: p.id, right: p.right }))), [pairs]);

  const [selectedLeft, setSelectedLeft] = useState(null); // pair id
  const [selectedRight, setSelectedRight] = useState(null); // pair id
  const [matched, setMatched] = useState([]); // 已配对的 pair id 列表
  const [wrongIds, setWrongIds] = useState([]); // 配错晃红的一对 id
  const [lines, setLines] = useState([]); // 已画出的连线 {id,x1,y1,x2,y2}
  const everWrongRef = useRef(false); // 本局有无错配（影响 firstTry）
  const boxRef = useRef(null);
  const tileRefs = useRef({}); // `${side}-${pairId}` -> 元素，用于计算连线端点

  const setTileRef = (side, id) => (el) => {
    if (el) tileRefs.current[`${side}-${id}`] = el;
  };

  // 配对成功：按两块牌子的当前位置画一条弹性连线（相对舞台坐标）。
  const drawLine = (pairId) => {
    const box = boxRef.current?.getBoundingClientRect();
    const l = tileRefs.current[`left-${pairId}`]?.getBoundingClientRect();
    const r = tileRefs.current[`right-${pairId}`]?.getBoundingClientRect();
    if (!box || !l || !r) return;
    setLines((ls) => [
      ...ls,
      {
        id: pairId,
        x1: l.right - box.left,
        y1: l.top + l.height / 2 - box.top,
        x2: r.left - box.left,
        y2: r.top + r.height / 2 - box.top,
      },
    ]);
  };

  const tryMatch = useCallback(
    (leftId, rightId) => {
      // 同一 pair 的左右两半 id 相同即配对成功。
      if (leftId === rightId) {
        drawLine(leftId);
        const nextMatched = [...matched, leftId];
        setMatched(nextMatched);
        setSelectedLeft(null);
        setSelectedRight(null);
        onSound?.('pluck');
        if (nextMatched.length === pairs.length) {
          // 全部配完：略停让孩子看清连线，再上报引擎推进。
          setTimeout(() => onResult?.(true, { firstTry: !everWrongRef.current }), 700);
        }
      } else {
        // 配错：两边晃红，短暂提示后清空选择（不扣心，记一次错配）。
        everWrongRef.current = true;
        setWrongIds([leftId, rightId]);
        onSound?.('wrong');
        setTimeout(() => {
          setWrongIds([]);
          setSelectedLeft(null);
          setSelectedRight(null);
        }, 500);
      }
    },
    [matched, pairs.length, onResult, onSound]
  );

  const pickLeft = (item) => {
    if (matched.includes(item.id)) return;
    onSpeak?.(item.char);
    setSelectedLeft(item.id);
    if (selectedRight != null) tryMatch(item.id, selectedRight);
  };

  const pickRight = (item) => {
    if (matched.includes(item.id)) return;
    setSelectedRight(item.id);
    if (selectedLeft != null) tryMatch(selectedLeft, item.id);
  };

  return (
    <div className="game-stage match-stage" ref={boxRef}>
      <p className="q-tip">连一连，找出好朋友</p>
      <div className="match2-cols">
        <div className="match2-col">
          {leftItems.map((item) => (
            <button
              key={item.id}
              ref={setTileRef('left', item.id)}
              type="button"
              className={`match2-item char ${selectedLeft === item.id ? 'sel' : ''} ${
                wrongIds.includes(item.id) ? 'wrong shake' : ''
              } ${matched.includes(item.id) ? 'done' : ''}`}
              onClick={() => pickLeft(item)}
            >
              {item.char}
            </button>
          ))}
        </div>
        <div className="match2-col">
          {rightItems.map((item) => (
            <button
              key={item.id}
              ref={setTileRef('right', item.id)}
              type="button"
              className={`match2-item right ${selectedRight === item.id ? 'sel' : ''} ${
                wrongIds.includes(item.id) ? 'wrong shake' : ''
              } ${matched.includes(item.id) ? 'done' : ''}`}
              onClick={() => pickRight(item)}
            >
              {item.right}
            </button>
          ))}
        </div>
      </div>
      {/* 连线层：弹性画线 + 中点爆点 */}
      <svg className="match2-lines" aria-hidden="true">
        {lines.map((l) => (
          <motion.line
            key={l.id}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ type: 'spring', stiffness: 120, damping: 14 }}
          />
        ))}
      </svg>
      {lines.map((l) => (
        <motion.span
          key={`burst-${l.id}`}
          className="match2-burst"
          style={{ left: (l.x1 + l.x2) / 2, top: (l.y1 + l.y2) / 2 }}
          initial={{ scale: 0, opacity: 1 }}
          animate={{ scale: [0, 1.5, 1.1], opacity: [1, 1, 0] }}
          transition={{ duration: 0.7 }}
        >
          ✨
        </motion.span>
      ))}
    </div>
  );
}
