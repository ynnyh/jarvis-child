// 课程页：进入一课后，展示本课字表（含星级/学习状态），提供「开始学习」和「玩游戏」入口。
// 学习按课推进：逐字走「学习闭环」，学完整课结算金币并解锁下一课。
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getLesson, ALL_LESSONS } from '../data/content.generated.js';
import { useGameStore } from '../store/useGameStore.js';
import { useSpeech } from '../hooks/useSpeech.js';
import { useSound } from '../hooks/useSound.js';
import Button from '../components/ui/Button.jsx';
import StarRating from '../components/ui/StarRating.jsx';
import PageTransition from '../components/ui/PageTransition.jsx';
import PlayfulBackground from '../components/PlayfulBackground.jsx';

export default function Lesson() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const lesson = getLesson(lessonId);
  const { speak } = useSpeech();
  const { play } = useSound();

  // 订阅底层数据而非 getter 函数：函数引用永不变化，组件不会因进度更新而重渲染，
  // 之前靠整页导航 remount 才读到新星级（脆）。直接订阅 chars/lessons 后派生。
  const chars = useGameStore((s) => s.chars);
  const lessons = useGameStore((s) => s.lessons);
  const getCharStars = (char) => chars[char]?.stars ?? 0;
  const isCharLearned = (char) => !!chars[char];
  const getLessonStars = (id) => lessons[id]?.stars ?? 0;

  // 本课在全部课程中的序号，用于“下一课”提示。
  const lessonIndex = useMemo(
    () => ALL_LESSONS.findIndex((l) => l.id === lessonId),
    [lessonId]
  );

  if (!lesson) {
    return (
      <PageTransition>
        <div className="page center-col">
          <p>找不到这一课。</p>
          <Button size="lg" onClick={() => navigate('/')}>🏠 回首页</Button>
        </div>
      </PageTransition>
    );
  }

  const learnedCount = lesson.chars.filter((c) => isCharLearned(c.char)).length;
  const lessonStars = getLessonStars(lessonId);
  const themeColor = lesson.themeColor;

  return (
    <PageTransition>
      <div className="page lesson-page" style={{ '--theme-color': themeColor }}>
        <PlayfulBackground variant="sky" />
        <header className="sub-header">
          <button className="btn-back" onClick={() => { play('tap'); navigate(`/world/${lesson.themeId}`); }} aria-label="返回小世界">
            ←
          </button>
          <h2 className="sub-title">
            {lesson.themeEmoji} {lesson.name}
          </h2>
          <span className="sub-progress">
            {learnedCount}/{lesson.chars.length}
          </span>
        </header>

        {lessonStars > 0 && (
          <div className="lesson-stars-row">
            <StarRating value={lessonStars} size={28} />
          </div>
        )}

        <div className="lesson-char-grid">
          {lesson.chars.map((c, i) => {
            const stars = getCharStars(c.char);
            const learned = isCharLearned(c.char);
            return (
              <motion.button
                key={c.char}
                className={`lesson-char-card ${learned ? 'learned' : ''}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                whileTap={{ scale: 0.94 }}
                onClick={() => {
                  play('tap');
                  speak(c.char);
                  navigate(`/learn/${lessonId}/${encodeURIComponent(c.char)}`);
                }}
              >
                <span className="lcc-emoji">{c.emoji}</span>
                <span className="lcc-char">{c.char}</span>
                <span className="lcc-pinyin">{c.pinyin}</span>
                <span className="lcc-stars">
                  {[1, 2, 3].map((n) => (
                    <span key={n} className={n <= stars ? 'on' : 'off'}>
                      {n <= stars ? '★' : '☆'}
                    </span>
                  ))}
                </span>
              </motion.button>
            );
          })}
        </div>

        <div className="lesson-actions">
          <Button
            size="lg"
            onClick={() => {
              play('tap');
              // 从本课第一个字开始学习闭环。
              const first = lesson.chars[0].char;
              navigate(`/learn/${lessonId}/${encodeURIComponent(first)}`);
            }}
          >
            {learnedCount === 0 ? '开始学习 ▶' : '继续学习 ▶'}
          </Button>
          {learnedCount > 0 && (
            <Button
              variant="secondary"
              size="lg"
              onClick={() => {
                play('tap');
                navigate(`/game/${lessonId}`);
              }}
            >
              🎮 玩游戏
            </Button>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
