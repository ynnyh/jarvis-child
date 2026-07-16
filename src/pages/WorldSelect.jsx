// 世界选择首页：海岛乐园门面（IslandScene）+ 世界选择浮层。
// 建筑即入口：识字塔/游乐园 → 打开世界选择浮层 → 进入某世界关卡路径；
//   绘本馆 → 绘本屋；学院 → 今日复习。顶部 HUD（金币/打卡），底部小墨与家长入口。
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CURRICULUM } from '../data/content.generated.js';
import { useGameStore } from '../store/useGameStore.js';
import { useSpeech } from '../hooks/useSpeech.js';
import { useSound } from '../hooks/useSound.js';
import Xiaomo from '../components/mascot/Xiaomo.jsx';
import CoinBadge from '../components/ui/CoinBadge.jsx';
import IslandScene from '../components/IslandScene.jsx';

export default function WorldSelect() {
  const navigate = useNavigate();
  const { speak } = useSpeech();
  const sound = useSound();
  const coins = useGameStore((s) => s.coins);
  const streak = useGameStore((s) => s.streak);
  const lessons = useGameStore((s) => s.lessons);
  const chars = useGameStore((s) => s.chars);
  const getDueChars = useGameStore((s) => s.getDueChars);

  const [pickerOpen, setPickerOpen] = useState(false);

  // 每个世界的进度（世界全部解锁，想学哪个都行）。
  const worlds = useMemo(() => {
    const lessonDone = (l) => l.chars.every((c) => !!chars[c.char]);
    return CURRICULUM.map((theme) => {
      const total = theme.lessons.length;
      const done = theme.lessons.filter(lessonDone).length;
      const complete = done === total;
      return { theme, done, total, complete };
    });
  }, [lessons, chars]);

  const dueCount = getDueChars().length;

  // 海岛建筑点击分发。
  const handleEnter = (intent) => {
    sound.tap();
    if (intent === 'learn' || intent === 'games') {
      setPickerOpen(true);
      speak('选一个小世界');
    } else if (intent === 'story') {
      speak('绘本馆');
      navigate('/story');
    } else if (intent === 'review') {
      speak('今天要复习啦');
      navigate('/review');
    }
  };

  return (
    <div className="home-page">
      {/* 顶部 HUD */}
      <header className="home-hud">
        <div className="home-brand">
          <Xiaomo size={38} expression="happy" animate={false} />
          <span className="home-title">识字乐园</span>
        </div>
        <div className="home-stats">
          {streak.count > 0 && (
            <span className="streak-badge" aria-label={`连续 ${streak.count} 天`}>
              🔥 {streak.count}
            </span>
          )}
          <CoinBadge count={coins} />
          <button
            className="hud-icon-btn"
            onClick={() => { sound.tap(); navigate('/parent'); }}
            aria-label="家长中心"
          >
            👨‍👩‍👧
          </button>
        </div>
      </header>

      {/* 海岛场景（门面） */}
      <IslandScene onEnter={handleEnter} worlds={worlds} />

      {/* 今日复习角标 */}
      {dueCount > 0 && (
        <motion.button
          className="home-review-fab"
          onClick={() => { sound.tap(); speak('今天要复习啦'); navigate('/review'); }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          whileTap={{ scale: 0.95 }}
        >
          📅 复习 {dueCount}
        </motion.button>
      )}

      {/* 底部小墨入口 */}
      <button
        className="home-pet-fab"
        onClick={() => { sound.tap(); navigate('/pet'); }}
        aria-label="小墨的家"
      >
        <Xiaomo size={44} expression="happy" />
      </button>

      {/* 世界选择浮层 */}
      <AnimatePresence>
        {pickerOpen && (
          <motion.div
            className="world-picker-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { sound.tap(); setPickerOpen(false); }}
          >
            <motion.div
              className="world-picker"
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="world-picker-handle" />
              <h2 className="world-picker-title">选一个小世界</h2>
              <div className="world-list">
                {worlds.map(({ theme, done, total, complete }, i) => (
                  <motion.button
                    key={theme.id}
                    className="world-card"
                    style={{ background: theme.color }}
                    onClick={() => {
                      sound.tap();
                      speak(theme.name);
                      navigate(`/world/${theme.id}`);
                    }}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    whileTap={{ scale: 0.96 }}
                  >
                    <span className="world-emoji">{theme.emoji}</span>
                    <span className="world-info">
                      <span className="world-name">{theme.name}</span>
                      <span className="world-progress-text">{done}/{total} 关</span>
                    </span>
                    <span className="world-status">
                      {complete ? '🏆' : (
                        <span className="world-bar">
                          <span className="world-bar-fill" style={{ width: `${(done / total) * 100}%` }} />
                        </span>
                      )}
                    </span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
