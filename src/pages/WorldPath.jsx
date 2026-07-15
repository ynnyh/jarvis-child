// 世界内关卡路径：某主题的 6 关串成蜿蜒小路，小墨站在当前关。
//   - 关卡顺序解锁（世界内）：第 1 关开，其余需前一关 ≥1 星。
//   - 通关庆祝：6 关全 3 星 → 宝箱奖励（一次性，记 flag 避免重复）。
import { useMemo, useRef, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getTheme } from '../data/content.generated.js';
import { useGameStore } from '../store/useGameStore.js';
import { useSpeech } from '../hooks/useSpeech.js';
import { useSound } from '../hooks/useSound.js';
import Xiaomo from '../components/mascot/Xiaomo.jsx';
import StarRating from '../components/ui/StarRating.jsx';
import Chest from '../components/Chest.jsx';
import PlayfulBackground from '../components/PlayfulBackground.jsx';

export default function WorldPath() {
  const { themeId } = useParams();
  const navigate = useNavigate();
  const theme = getTheme(themeId);
  const { speak } = useSpeech();
  const sound = useSound();
  const lessons = useGameStore((s) => s.lessons);
  const chars = useGameStore((s) => s.chars);
  const addCoins = useGameStore((s) => s.addCoins);
  const currentRef = useRef(null);
  const [showChest, setShowChest] = useState(false);

  // 一课是否"完成"：该课所有字都学过（比只看课程星级更稳，兼容历史数据）。
  const lessonDone = (lesson) =>
    lesson.chars.every((c) => !!chars[c.char]);

  // 每关解锁状态 + 星级。前一课完成即解锁下一课。
  const lessonState = useMemo(() => {
    if (!theme) return [];
    return theme.lessons.map((lesson, i) => {
      const stars = lessons[lesson.id]?.stars ?? 0;
      const prevDone = i === 0 || lessonDone(theme.lessons[i - 1]);
      return { lesson, stars, unlocked: i === 0 || prevDone };
    });
  }, [theme, lessons, chars]);

  const currentIndex = useMemo(() => {
    // 当前关 = 第一个已解锁但还没学完的关。
    const idx = lessonState.findIndex((s) => s.unlocked && !lessonDone(s.lesson));
    return idx < 0 ? lessonState.length - 1 : idx;
  }, [lessonState, chars]);

  // 是否本世界通关（全 3 星）。
  const worldComplete = useMemo(
    () => theme && theme.lessons.every((l) => (lessons[l.id]?.stars ?? 0) === 3),
    [theme, lessons]
  );

  // 通关且未领过宝箱 → 弹宝箱。
  const chestKey = `jarvis-child-worldchest-${themeId}`;
  useEffect(() => {
    if (worldComplete) {
      try {
        if (!localStorage.getItem(chestKey)) {
          setShowChest(true);
        }
      } catch { /* 忽略 */ }
    }
  }, [worldComplete, chestKey]);

  useEffect(() => {
    currentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  if (!theme) {
    return (
      <div className="page center-col">
        <p>找不到这个小世界。</p>
        <button className="ui-btn ui-btn--primary ui-btn--lg" onClick={() => navigate('/')}>回首页</button>
      </div>
    );
  }

  return (
    <div className="map-page" style={{ '--theme-color': theme.color }}>
      <PlayfulBackground variant="grass" />
      <header className="map-topbar">
        <button className="btn-icon" onClick={() => navigate('/')} aria-label="返回世界选择">←</button>
        <span className="map-title">{theme.emoji} {theme.name}</span>
        <span style={{ width: 48 }} />
      </header>

      <div className="map-scroll">
        <div className="map-path">
          {lessonState.map(({ lesson, stars, unlocked }, i) => {
            const isCurrent = i === currentIndex;
            const side = i % 2 === 0 ? 'left' : 'right';
            return (
              <div
                key={lesson.id}
                className={`map-node-row ${side}`}
                ref={isCurrent ? currentRef : null}
              >
                <div className="map-node-wrap">
                  {isCurrent && unlocked && (
                    <motion.div
                      className="map-mascot"
                      animate={{ y: [0, -6, 0] }}
                      transition={{ repeat: Infinity, duration: 1.8 }}
                    >
                      <Xiaomo size={52} expression="cheer" animate={false} />
                    </motion.div>
                  )}
                  <motion.button
                    className={`map-node ${unlocked ? 'unlocked' : 'locked'} ${isCurrent ? 'current' : ''}`}
                    style={{ background: unlocked ? theme.color : '#D8D8E0' }}
                    onClick={() => {
                      if (!unlocked) {
                        sound.error();
                        speak('先完成前面的关卡哦');
                        return;
                      }
                      sound.tap();
                      speak(lesson.name);
                      navigate(`/lesson/${lesson.id}`);
                    }}
                    whileTap={unlocked ? { scale: 0.92 } : {}}
                  >
                    {unlocked ? (
                      <>
                        <span className="node-num">{i + 1}</span>
                        <span className="node-name">{lesson.name}</span>
                        <StarRating value={stars} size={13} />
                      </>
                    ) : (
                      <span className="node-lock">🔒</span>
                    )}
                  </motion.button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showChest && (
        <Chest
          coins={50}
          bonus="🏆 通关奖杯 ×1"
          onOpen={() => {
            addCoins(50);
            try { localStorage.setItem(chestKey, '1'); } catch { /* 忽略 */ }
            setShowChest(false);
          }}
        />
      )}
    </div>
  );
}
