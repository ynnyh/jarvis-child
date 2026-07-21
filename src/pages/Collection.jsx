// 字卡收集册（阶段 3 · 激励闭环）：300 字按 5 主题分组展示。
// 未学 = 灰底「?」剪影；已学 = 主题色字卡 + 该字星级（store.getCharStars）。
// 点击已学字卡 → 大字卡弹层（大字 + 拼音 + emoji + 点读）。
// 顶部总进度条「已收集 X/300」；一个字都没学时给空状态引导。
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CURRICULUM, ALL_CHARS } from '../data/content.generated.js';
import { useGameStore } from '../store/useGameStore.js';
import { useSound } from '../hooks/useSound.js';
import { useSpeech } from '../hooks/useSpeech.js';
import Xiaomo from '../components/mascot/Xiaomo.jsx';
import PageTransition from '../components/ui/PageTransition.jsx';
import PlayfulBackground from '../components/PlayfulBackground.jsx';

const TOTAL = ALL_CHARS.length; // 300

export default function Collection() {
  const navigate = useNavigate();
  const chars = useGameStore((s) => s.chars);
  const getCharStars = useGameStore((s) => s.getCharStars);
  const sound = useSound();
  const { speak } = useSpeech();

  const [picked, setPicked] = useState(null); // 弹层中的字数据

  // 按主题分组：主题 + 该主题已学字数（读旧数据时 chars 可能是空对象，?? 防御）。
  const groups = useMemo(() => {
    const learned = chars ?? {};
    return CURRICULUM.map((theme) => {
      const list = theme.lessons.flatMap((l) => l.chars);
      const done = list.filter((c) => !!learned[c.char]).length;
      return { theme, list, done };
    });
  }, [chars]);

  const collected = useMemo(
    () => groups.reduce((acc, g) => acc + g.done, 0),
    [groups]
  );

  const openCard = (c) => {
    sound.pop();
    speak(c.char);
    setPicked(c);
  };

  return (
    <PageTransition>
      <div className="page collection-page">
        <PlayfulBackground variant="sky" />
        <header className="sub-header">
          <button className="btn-icon" onClick={() => { sound.tap(); navigate('/'); }} aria-label="返回">←</button>
          <h2 className="sub-title">字卡收集册</h2>
          <span className="sub-progress">{collected}/{TOTAL}</span>
        </header>

        {/* 总进度条 */}
        <div className="coll-progress" aria-label={`已收集 ${collected}/${TOTAL}`}>
          <div className="coll-progress-fill" style={{ width: `${(collected / TOTAL) * 100}%` }} />
          <span className="coll-progress-text">已收集 {collected}/{TOTAL}</span>
        </div>

        {/* 空状态：一个字都没学 */}
        {collected === 0 && (
          <div className="coll-empty">
            <Xiaomo expression="happy" size={110} />
            <p>还没有收集到字卡哦。</p>
            <p>去识字塔学第一个字，它就会出现在这里！</p>
            <button
              className="ui-btn ui-btn--primary ui-btn--lg"
              onClick={() => { sound.tap(); navigate('/'); }}
            >
              🚀 去学字
            </button>
          </div>
        )}

        {/* 主题分组 */}
        {groups.map(({ theme, list, done }) => (
          <section key={theme.id} className="coll-theme">
            <header className="coll-theme-head" style={{ '--theme-color': theme.color }}>
              <span className="coll-theme-emoji">{theme.emoji}</span>
              <span className="coll-theme-name">{theme.name}</span>
              <span className="coll-theme-count">{done}/{list.length}</span>
            </header>
            <div className="coll-grid">
              {list.map((c) => {
                const stars = getCharStars(c.char);
                const learned = stars > 0 || !!chars?.[c.char];
                return learned ? (
                  <motion.button
                    key={c.char}
                    className="coll-card learned"
                    style={{ '--theme-color': theme.color }}
                    onClick={() => openCard(c)}
                    whileTap={{ scale: 0.9 }}
                    aria-label={`字卡 ${c.char}，${stars} 星`}
                  >
                    <span className="coll-card-char">{c.char}</span>
                    <span className="coll-card-stars">
                      {[1, 2, 3].map((n) => (
                        <i key={n} className={n <= stars ? 'on' : ''}>★</i>
                      ))}
                    </span>
                  </motion.button>
                ) : (
                  <div key={c.char} className="coll-card locked" aria-label="未收集">
                    <span className="coll-card-q">?</span>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {/* 大字卡弹层 */}
        <AnimatePresence>
          {picked && (
            <motion.div
              className="reward-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { sound.tap(); setPicked(null); }}
            >
              <motion.div
                className="reward-card coll-modal"
                initial={{ scale: 0.6, y: 40 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.7, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 18 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="coll-modal-emoji">{picked.emoji}</div>
                <button
                  className="coll-modal-char"
                  onClick={() => speak(picked.char)}
                  aria-label={`朗读 ${picked.char}`}
                >
                  {picked.char}
                </button>
                <div className="coll-modal-pinyin">{picked.pinyin}</div>
                <button
                  className="ui-btn ui-btn--primary ui-btn--lg"
                  onClick={() => { sound.tap(); setPicked(null); }}
                >
                  关上啦 →
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}
