// 世界选择首页：2.5D 海岛大厅（IslandScene）+ 游戏化 HUD + 航海图选世界浮层。
// 建筑即入口：识字塔/游乐园 → 航海图浮层 → 进入某世界关卡路径；
//   绘本馆 → 绘本屋；学院 → 今日复习；商城 → 商店；字库 → 收集册。
// 顶部 HUD：小墨头像(宠物入口) / 品牌 / 连续打卡 / 每日任务板 / 金币 / 家长入口。
// 每日惊喜礼物盒：每天首次进首页岛上随机出现 🎁，点开得随机金币。
import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CURRICULUM } from '../data/content.generated.js';
import { useGameStore, dailyForToday, giftAvailable, DAILY_GOALS, DAILY_REWARD, DAILY_ALL_REWARD } from '../store/useGameStore.js';
import { useSpeech } from '../hooks/useSpeech.js';
import { useSound } from '../hooks/useSound.js';
import Xiaomo from '../components/mascot/Xiaomo.jsx';
import CoinBadge from '../components/ui/CoinBadge.jsx';
import IslandScene from '../components/IslandScene.jsx';
import Confetti from '../components/Confetti.jsx';

// HUD 绘制小图标（火焰/任务板/家长盾）——统一手绘 SVG，告别 emoji 拼贴感。
function FlameIcon(props) {
  return (
    <svg viewBox="0 0 24 24" className="hud3-ic" aria-hidden="true" {...props}>
      <path d="M12 2.5 C 14 6 18 8 18 13.5 A 6 6 0 0 1 6 13.5 C 6 10.5 7.5 8.6 9 7 C 9 9 10 10 11 10.5 C 10.6 7.6 11 4.6 12 2.5 Z" fill="#ff8a3c" />
      <path d="M12 8.5 C 13.4 10.4 15.2 11.6 15.2 14.2 A 3.2 3.2 0 0 1 8.8 14.2 C 8.8 12.6 9.6 11.4 10.5 10.5 C 10.6 11.7 11.2 12.4 12 12.8 C 11.8 11.3 11.6 10 12 8.5 Z" fill="#ffd166" />
    </svg>
  );
}
function QuestIcon(props) {
  return (
    <svg viewBox="0 0 24 24" className="hud3-ic" aria-hidden="true" {...props}>
      <rect x="4" y="3" width="16" height="18" rx="4" fill="#8ad4ff" />
      <rect x="6.5" y="5.5" width="11" height="13" rx="2.5" fill="#fff" />
      <path d="M8.5 9.5 l1.4 1.4 2.4-2.8" stroke="#2fb377" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="13.5" y="9" width="3.5" height="1.9" rx="0.95" fill="#c9d4e0" />
      <path d="M8.5 14.5 l1.4 1.4 2.4-2.8" stroke="#2fb377" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="13.5" y="14" width="3.5" height="1.9" rx="0.95" fill="#c9d4e0" />
      <rect x="8.5" y="1.5" width="7" height="4" rx="2" fill="#ffb054" />
    </svg>
  );
}
function ParentIcon(props) {
  return (
    <svg viewBox="0 0 24 24" className="hud3-ic" aria-hidden="true" {...props}>
      <path d="M12 2.6 L20 5.4 V11 C 20 16.4 16.6 20.2 12 21.6 C 7.4 20.2 4 16.4 4 11 V 5.4 Z" fill="#b39cf7" />
      <path d="M12 4.8 L18 6.9 V11 C 18 15.3 15.4 18.4 12 19.6 C 8.6 18.4 6 15.3 6 11 V 6.9 Z" fill="#fff" />
      <circle cx="12" cy="10" r="2.6" fill="#8a6ce0" />
      <path d="M7.8 16.2 C 8.6 14 10.2 13.2 12 13.2 C 13.8 13.2 15.4 14 16.2 16.2 C 15.1 17.8 13.7 18.9 12 19.6 C 10.3 18.9 8.9 17.8 7.8 16.2 Z" fill="#8a6ce0" />
    </svg>
  );
}

export default function WorldSelect() {
  const navigate = useNavigate();
  const { speak } = useSpeech();
  const sound = useSound();
  const coins = useGameStore((s) => s.coins);
  const streak = useGameStore((s) => s.streak);
  const lessons = useGameStore((s) => s.lessons);
  const chars = useGameStore((s) => s.chars);
  const getDueChars = useGameStore((s) => s.getDueChars);
  const dailyRaw = useGameStore((s) => s.daily);
  const giftDay = useGameStore((s) => s.giftDay);
  const claimGift = useGameStore((s) => s.claimGift);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [dailyOpen, setDailyOpen] = useState(false);
  const [giftCoins, setGiftCoins] = useState(0);
  const giftTimer = useRef(null);

  // 今日任务进度（旧数据没有 daily / 跨天时按 0 计，dailyForToday 已防御）。
  const daily = dailyForToday(dailyRaw);
  const dailyTasks = [
    { key: 'learn', icon: '📖', label: '学 3 个字', now: daily.learn, goal: DAILY_GOALS.learn },
    { key: 'game', icon: '🎮', label: '玩 1 局游戏', now: daily.game, goal: DAILY_GOALS.game },
    { key: 'story', icon: '📗', label: '读 1 本绘本', now: daily.story, goal: DAILY_GOALS.story },
  ];
  const dailyDoneCount = dailyTasks.filter((t) => t.now >= t.goal).length;
  const dailyAllDone = dailyDoneCount === dailyTasks.length;

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

  // 海岛建筑点击分发（tap 音效由建筑自己出，这里只管语音与导航）。
  const handleEnter = (intent) => {
    if (intent === 'learn' || intent === 'games') {
      setPickerOpen(true);
      speak('选一个小世界');
    } else if (intent === 'story') {
      speak('绘本馆');
      navigate('/story');
    } else if (intent === 'review') {
      speak('今天要复习啦');
      navigate('/review');
    } else if (intent === 'shop') {
      navigate('/shop');
    } else if (intent === 'collection') {
      navigate('/collection');
    }
  };

  // 每日惊喜：今天还没领则岛上出现礼物盒。
  const showGift = giftAvailable(giftDay);
  const handleGift = () => {
    const amount = claimGift();
    if (amount <= 0) return;
    sound.chest();
    setGiftCoins(amount);
    clearTimeout(giftTimer.current);
    giftTimer.current = setTimeout(() => setGiftCoins(0), 2600);
  };

  return (
    <div className="hi-home">
      {/* 2.5D 海岛大厅 */}
      <IslandScene onEnter={handleEnter} showGift={showGift} onGift={handleGift} />

      {/* 顶部 HUD */}
      <header className="hud3">
        <div className="hud3-left">
          <button
            className="hud3-chip hud3-avatar"
            onClick={() => { sound.tap(); navigate('/pet'); }}
            aria-label="小墨的家"
          >
            <Xiaomo size={44} expression="happy" animate={false} />
          </button>
          <span className="hud3-chip hud3-brand">识字乐园</span>
        </div>
        <div className="hud3-right">
          {streak.count > 0 && (
            <span className="hud3-chip hud3-streak" aria-label={`连续 ${streak.count} 天`}>
              <FlameIcon />
              {streak.count}
            </span>
          )}
          <button
            className={`hud3-chip hud3-quest ${dailyAllDone ? 'all-done' : ''}`}
            onClick={() => { sound.tap(); setDailyOpen((v) => !v); }}
            aria-label="每日任务"
            aria-expanded={dailyOpen}
          >
            <QuestIcon />
            <span className="hud3-quest-badge">{dailyDoneCount}/{dailyTasks.length}</span>
          </button>
          <CoinBadge count={coins} />
          <button
            className="hud3-chip hud3-avatar"
            onClick={() => { sound.tap(); navigate('/parent'); }}
            aria-label="家长中心"
          >
            <ParentIcon />
          </button>
        </div>
      </header>

      {/* 每日任务告示板 */}
      <AnimatePresence>
        {dailyOpen && (
          <motion.div
            className="hud3-qpanel"
            initial={{ opacity: 0, y: -16, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 380, damping: 24 }}
          >
            <div className="hud3-qpanel-title">🗓️ 今日任务</div>
            {dailyTasks.map((t) => {
              const done = t.now >= t.goal;
              const pct = Math.min(100, (t.now / t.goal) * 100);
              return (
                <div key={t.key} className={`hud3-qtask ${done ? 'done' : ''}`}>
                  <span className="hud3-qtask-ic">{t.icon}</span>
                  <span className="hud3-qtask-main">
                    <span className="hud3-qtask-label">{t.label}</span>
                    <span className="hud3-qbar">
                      <span className="hud3-qbar-fill" style={{ width: `${pct}%` }} />
                    </span>
                  </span>
                  <span className="hud3-qtask-state">
                    {done ? '✅' : `${Math.min(t.now, t.goal)}/${t.goal}`}
                  </span>
                </div>
              );
            })}
            <div className="hud3-qpanel-tip">
              每项完成 +{DAILY_REWARD} 🪙，全部完成再 +{DAILY_ALL_REWARD} 🪙
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 礼物开奖反馈：星星撒花 + 金币 toast */}
      {giftCoins > 0 && (
        <>
          <Confetti preset="stars" />
          <motion.div
            className="daily-toast"
            role="status"
            onClick={() => setGiftCoins(0)}
            initial={{ y: -80, opacity: 0, scale: 0.7 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 20 }}
          >
            <span className="daily-toast-badge">🎁</span>
            <div className="daily-toast-lines">
              <div className="daily-toast-line">每日惊喜！</div>
              <div className="daily-toast-coins">🪙 +{giftCoins}</div>
            </div>
          </motion.div>
        </>
      )}

      {/* 今日复习浮标 */}
      {dueCount > 0 && (
        <motion.button
          className="hi-review-fab"
          onClick={() => { sound.tap(); speak('今天要复习啦'); navigate('/review'); }}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          whileTap={{ scale: 0.94 }}
        >
          <span className="fab-ic" aria-hidden="true">📅</span>
          复习
          <span className="fab-badge">{dueCount}</span>
        </motion.button>
      )}

      {/* 航海图：选一个小世界 */}
      <AnimatePresence>
        {pickerOpen && (
          <motion.div
            className="wpk-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { sound.tap(); setPickerOpen(false); }}
          >
            {/* 上浮小气泡 */}
            {[8, 26, 48, 70, 88].map((left, i) => (
              <span
                key={i}
                className="wpk-bubble"
                style={{ left: `${left}%`, width: 10 + (i % 3) * 8, height: 10 + (i % 3) * 8, animationDelay: `${i * 1.3}s` }}
              />
            ))}
            <motion.div
              className="wpk-panel"
              initial={{ y: 80, opacity: 0, rotateX: 18, scale: 0.94 }}
              animate={{ y: 0, opacity: 1, rotateX: 0, scale: 1 }}
              exit={{ y: 80, opacity: 0, scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="wpk-head">
                <h2 className="wpk-title">🧭 选一个小世界</h2>
                <button className="wpk-close" onClick={() => { sound.tap(); setPickerOpen(false); }} aria-label="关闭">
                  ✕
                </button>
              </div>
              <div className="wpk-grid">
                {worlds.map(({ theme, done, total, complete }, i) => (
                  <motion.button
                    key={theme.id}
                    className={`wpk-card ${complete ? 'is-complete' : ''}`}
                    style={{ '--wc': theme.color }}
                    onClick={() => {
                      sound.tap();
                      speak(theme.name);
                      navigate(`/world/${theme.id}`);
                    }}
                    initial={{ opacity: 0, y: 26, scale: 0.85 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 0.06 + i * 0.06, type: 'spring', stiffness: 380, damping: 22 }}
                    whileTap={{ scale: 0.94 }}
                  >
                    {complete && <span className="wpk-crown" aria-hidden="true">👑</span>}
                    <span className="wpk-isle">
                      <span className="wpk-emoji" aria-hidden="true">{theme.emoji}</span>
                    </span>
                    <span className="wpk-name">{theme.name}</span>
                    <span className="wpk-progress">
                      {complete ? '🏆 全部通关' : `⭐ ${done}/${total} 关`}
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
