// 世界选择首页：海岛乐园门面（IslandScene）+ 世界选择浮层。
// 建筑即入口：识字塔/游乐园 → 打开世界选择浮层 → 进入某世界关卡路径；
//   绘本馆 → 绘本屋；学院 → 今日复习；商城 → 商店；字库 → 收集册（后两者阶段 5
//   由 HUD 按钮升级为岛上建筑）。顶部 HUD（金币/打卡/每日任务/家长入口），
//   每日惊喜礼物盒（阶段 5）：每天首次进首页岛上随机出现 🎁，点开得随机金币。
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
  const [dailyOpen, setDailyOpen] = useState(false); // 每日任务小面板
  const [giftCoins, setGiftCoins] = useState(0); // 本次礼物开出的金币（>0 时播撒花+toast）
  const giftTimer = useRef(null);

  // 今日任务进度（旧数据没有 daily / 跨天时按 0 计，dailyForToday 已防御）。
  const daily = dailyForToday(dailyRaw);
  const dailyAllDone =
    daily.learn >= DAILY_GOALS.learn &&
    daily.game >= DAILY_GOALS.game &&
    daily.story >= DAILY_GOALS.story;
  const dailyTasks = [
    { key: 'learn', icon: '📖', label: '学 3 个字', now: daily.learn, goal: DAILY_GOALS.learn },
    { key: 'game', icon: '🎮', label: '玩 1 局游戏', now: daily.game, goal: DAILY_GOALS.game },
    { key: 'story', icon: '📗', label: '读 1 本绘本', now: daily.story, goal: DAILY_GOALS.story },
  ];

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
    } else if (intent === 'shop') {
      navigate('/shop');
    } else if (intent === 'collection') {
      navigate('/collection');
    }
  };

  // 每日惊喜：今天还没领则岛上出现礼物盒（giftAvailable 兼容旧数据 undefined）。
  const showGift = giftAvailable(giftDay);

  // 点开礼物盒：chest 音效 + 星星撒花 + 随机金币入帐（CoinBadge 数字变化自带跳动）。
  // claimGift 返回 0 表示今天已领（兜底，正常流程下已领就不会显示盒子）。
  const handleGift = () => {
    const amount = claimGift();
    if (amount <= 0) return;
    sound.chest();
    setGiftCoins(amount);
    clearTimeout(giftTimer.current);
    giftTimer.current = setTimeout(() => setGiftCoins(0), 2600);
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
          {/* 每日任务徽章：3 个小图标显示今日进度，点击展开任务面板；全完成金光闪闪 */}
          <button
            className={`daily-badge ${dailyAllDone ? 'daily-done' : ''}`}
            onClick={() => { sound.tap(); setDailyOpen((v) => !v); }}
            aria-label="每日任务"
          >
            {dailyTasks.map((t) => (
              <span key={t.key} className={t.now >= t.goal ? 'done' : ''}>
                {t.icon}{Math.min(t.now, t.goal)}/{t.goal}
              </span>
            ))}
          </button>
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

      {/* 每日任务面板（点徽章展开） */}
      <AnimatePresence>
        {dailyOpen && (
          <motion.div
            className="daily-panel"
            initial={{ opacity: 0, y: -12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 380, damping: 24 }}
          >
            <div className="daily-panel-title">今日任务</div>
            {dailyTasks.map((t) => (
              <div key={t.key} className={`daily-task ${t.now >= t.goal ? 'done' : ''}`}>
                <span className="daily-task-icon">{t.icon}</span>
                <span className="daily-task-label">{t.label}</span>
                <span className="daily-task-progress">
                  {t.now >= t.goal ? '✅' : `${Math.min(t.now, t.goal)}/${t.goal}`}
                </span>
              </div>
            ))}
            <div className="daily-panel-tip">
              每项完成 +{DAILY_REWARD} 🪙，全部完成再 +{DAILY_ALL_REWARD} 🪙
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 海岛场景（门面）：建筑入口 + 彩蛋 + 每日惊喜礼物盒 */}
      <IslandScene onEnter={handleEnter} worlds={worlds} showGift={showGift} onGift={handleGift} />

      {/* 礼物开奖反馈：星星撒花 + 金币 toast（样式复用每日任务 toast） */}
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
