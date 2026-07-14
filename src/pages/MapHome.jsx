// 关卡地图首页：一条蜿蜒学习路径串起 30 课节点，逐课解锁。
// 每个节点显示课名、星级(0-3)、锁定状态；小墨站在当前进度处。
// 顶部状态栏：金币、连续打卡、宠物入口；底部：今日复习入口。
import { useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ALL_LESSONS } from '../data/content.generated.js';
import { useGameStore } from '../store/useGameStore.js';
import { useSpeech } from '../hooks/useSpeech.js';
import { useSound } from '../hooks/useSound.js';
import Xiaomo from '../components/mascot/Xiaomo.jsx';
import CoinBadge from '../components/ui/CoinBadge.jsx';
import StarRating from '../components/ui/StarRating.jsx';

// 蜿蜒路径：节点在左右之间摆动，形成"爬山"式的地图观感。
// 返回每个节点的水平偏移百分比（相对容器宽度）。
function nodeOffset(index) {
  // 用正弦波让路径左右摆动，振幅 ~30%。
  const amp = 30;
  return 50 + amp * Math.sin(index * 0.9);
}

export default function MapHome() {
  const navigate = useNavigate();
  const { speak } = useSpeech();
  const sound = useSound();
  const coins = useGameStore((s) => s.coins);
  const streak = useGameStore((s) => s.streak);
  const lessons = useGameStore((s) => s.lessons);
  const getDueChars = useGameStore((s) => s.getDueChars);
  const currentRef = useRef(null);

  // 计算每课解锁状态：第 1 课永远解锁；其余需前一课已完成(有星)。
  const lessonState = useMemo(() => {
    return ALL_LESSONS.map((lesson, i) => {
      const stars = lessons[lesson.id]?.stars ?? 0;
      const done = stars > 0;
      const prevDone = i === 0 || (lessons[ALL_LESSONS[i - 1].id]?.stars ?? 0) > 0;
      return { lesson, stars, done, unlocked: i === 0 || prevDone };
    });
  }, [lessons]);

  // 当前进度：第一个未完成且已解锁的课。
  const currentIndex = useMemo(() => {
    const idx = lessonState.findIndex((s) => s.unlocked && !s.done);
    return idx < 0 ? lessonState.length - 1 : idx;
  }, [lessonState]);

  // 进入时滚动到当前关卡。
  useEffect(() => {
    currentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const dueCount = getDueChars().length;

  return (
    <div className="map-page">
      {/* 顶部状态栏 */}
      <header className="map-topbar">
        <div className="map-brand">
          <Xiaomo size={44} expression="happy" />
          <span className="map-title">宝宝识字</span>
        </div>
        <div className="map-stats">
          {streak.count > 0 && (
            <span className="streak-badge" aria-label={`连续 ${streak.count} 天`}>
              🔥 {streak.count}
            </span>
          )}
          <CoinBadge coins={coins} />
        </div>
      </header>

      {/* 今日复习入口（有到期字才显示） */}
      {dueCount > 0 && (
        <motion.button
          className="review-banner"
          onClick={() => {
            sound.tap();
            speak('今天要复习啦');
            navigate('/review');
          }}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          whileTap={{ scale: 0.97 }}
        >
          📅 今日复习 · {dueCount} 个字 →
        </motion.button>
      )}

      {/* 关卡路径 */}
      <div className="map-path">
        {lessonState.map(({ lesson, stars, unlocked }, i) => {
          const left = nodeOffset(i);
          const isCurrent = i === currentIndex;
          return (
            <div
              key={lesson.id}
              className="map-node-row"
              ref={isCurrent ? currentRef : null}
            >
              <motion.button
                className={`map-node ${unlocked ? '' : 'locked'} ${isCurrent ? 'current' : ''}`}
                style={{ left: `${left}%`, background: unlocked ? lesson.themeColor : '#D8D8E0' }}
                onClick={() => {
                  if (!unlocked) {
                    sound.error();
                    speak('先完成前面的课哦');
                    return;
                  }
                  sound.tap();
                  speak(lesson.name);
                  navigate(`/lesson/${lesson.id}`);
                }}
                whileTap={unlocked ? { scale: 0.92 } : {}}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(i * 0.02, 0.3) }}
              >
                {unlocked ? (
                  <>
                    <span className="node-emoji">{lesson.themeEmoji}</span>
                    <span className="node-name">{lesson.name}</span>
                    <StarRating value={stars} size={14} />
                  </>
                ) : (
                  <span className="node-lock">🔒</span>
                )}
              </motion.button>

              {/* 小墨站在当前关卡旁 */}
              {isCurrent && unlocked && (
                <motion.div
                  className="map-mascot"
                  style={{ left: `${left}%` }}
                  animate={{ y: [0, -6, 0] }}
                  transition={{ repeat: Infinity, duration: 1.8 }}
                >
                  <Xiaomo size={56} expression="cheer" />
                </motion.div>
              )}
            </div>
          );
        })}
      </div>

      {/* 底部导航 */}
      <nav className="map-bottomnav">
        <button onClick={() => { sound.tap(); navigate('/pet'); }}>
          <Xiaomo size={32} expression="happy" /> <span>小墨</span>
        </button>
        <button onClick={() => { sound.tap(); navigate('/parent'); }}>
          👨‍👩‍👧 <span>家长</span>
        </button>
      </nav>
    </div>
  );
}
