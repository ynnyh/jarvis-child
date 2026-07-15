// 世界选择首页：5 个主题「小世界」大卡片。
// 世界解锁：世界 N 需世界 N-1 的所有课都 ≥1 星才开（第 1 个世界永远开）。
// 顶部状态栏（金币/打卡）、今日复习入口、底部导航（小墨/家长）。
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CURRICULUM } from '../data/content.generated.js';
import { useGameStore } from '../store/useGameStore.js';
import { useSpeech } from '../hooks/useSpeech.js';
import { useSound } from '../hooks/useSound.js';
import Xiaomo from '../components/mascot/Xiaomo.jsx';
import CoinBadge from '../components/ui/CoinBadge.jsx';
import PlayfulBackground from '../components/PlayfulBackground.jsx';

export default function WorldSelect() {
  const navigate = useNavigate();
  const { speak } = useSpeech();
  const sound = useSound();
  const coins = useGameStore((s) => s.coins);
  const streak = useGameStore((s) => s.streak);
  const lessons = useGameStore((s) => s.lessons);
  const chars = useGameStore((s) => s.chars);
  const getDueChars = useGameStore((s) => s.getDueChars);

  // 每个世界的进度 + 解锁状态。
  const worlds = useMemo(() => {
    // 一课完成 = 该课所有字都学过（比课程星级更稳，兼容历史数据）。
    const lessonDone = (l) => l.chars.every((c) => !!chars[c.char]);
    return CURRICULUM.map((theme) => {
      const total = theme.lessons.length;
      const done = theme.lessons.filter(lessonDone).length;
      const stars = theme.lessons.reduce((n, l) => n + (lessons[l.id]?.stars ?? 0), 0);
      // 世界全部解锁：想先学哪个主题都行（不再要求学完数字才能学别的）。
      const complete = done === total;
      return { theme, done, total, stars, unlocked: true, complete };
    });
  }, [lessons, chars]);

  const dueCount = getDueChars().length;

  return (
    <div className="map-page">
      <PlayfulBackground variant="sky" />
      <header className="map-topbar">
        <div className="map-brand">
          <Xiaomo size={40} expression="happy" animate={false} />
          <span className="map-title">宝宝识字</span>
        </div>
        <div className="map-stats">
          {streak.count > 0 && (
            <span className="streak-badge" aria-label={`连续 ${streak.count} 天`}>
              🔥 {streak.count}
            </span>
          )}
          <CoinBadge count={coins} />
        </div>
      </header>

      <div className="map-scroll">
        {dueCount > 0 && (
          <motion.button
            className="review-banner"
            onClick={() => { sound.tap(); speak('今天要复习啦'); navigate('/review'); }}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.97 }}
          >
            📅 今日复习 · {dueCount} 个字 →
          </motion.button>
        )}

        <p className="world-intro">选一个小世界，去认字吧！</p>

        <div className="world-list">
          {worlds.map(({ theme, done, total, unlocked, complete }, i) => (
            <motion.button
              key={theme.id}
              className={`world-card ${unlocked ? '' : 'locked'}`}
              style={unlocked ? { background: theme.color } : undefined}
              onClick={() => {
                if (!unlocked) {
                  sound.error();
                  speak('先学完前面的小世界哦');
                  return;
                }
                sound.tap();
                speak(theme.name);
                navigate(`/world/${theme.id}`);
              }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              whileTap={unlocked ? { scale: 0.96 } : {}}
            >
              <span className="world-emoji">{theme.emoji}</span>
              <span className="world-info">
                <span className="world-name">{theme.name}</span>
                <span className="world-progress-text">
                  {unlocked ? `${done}/${total} 关` : '未解锁'}
                </span>
              </span>
              {unlocked ? (
                <span className="world-status">
                  {complete ? '🏆' : (
                    <span className="world-bar">
                      <span className="world-bar-fill" style={{ width: `${(done / total) * 100}%` }} />
                    </span>
                  )}
                </span>
              ) : (
                <span className="world-lock">🔒</span>
              )}
            </motion.button>
          ))}
        </div>
      </div>

      <nav className="map-bottomnav">
        <button onClick={() => { sound.tap(); navigate('/pet'); }}>
          <Xiaomo size={30} expression="happy" animate={false} /> <span>小墨</span>
        </button>
        <button onClick={() => { sound.tap(); navigate('/story'); }}>
          <span className="nav-emoji">📚</span> <span>绘本</span>
        </button>
        <button onClick={() => { sound.tap(); navigate('/parent'); }}>
          <span className="nav-emoji">👨‍👩‍👧</span> <span>家长</span>
        </button>
      </nav>
    </div>
  );
}
