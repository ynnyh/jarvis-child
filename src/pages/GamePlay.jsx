// 巩固游戏引擎：统一出题、判分、星级结算，承载 6 种题型。
// 6 种题型（type）：
//   listen-pick  听音选字：播读音，从候选选字
//   pic-pick     看图选字：看 emoji，从候选选字
//   char-pick    看字选图：看字，从候选 emoji
//   match        连连看：字 ↔ 拼音 配对
//   trace        笔顺描红：hanzi-writer 测评
//   find-friend  找朋友：从一堆字里找出目标字
//
// 出题来源：某一课的字（lessonId）或复习队列（传入 chars）。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getLesson, getChar, ALL_CHARS } from '../data/content.generated.js';
import { useSpeech } from '../hooks/useSpeech.js';
import { useSound } from '../hooks/useSound.js';
import { useGameStore } from '../store/useGameStore.js';
import HanziWriter from '../components/HanziWriter.jsx';
import StarReward from '../components/StarReward.jsx';
import Xiaomo from '../components/mascot/Xiaomo.jsx';
import MatchGame from '../components/games/MatchGame.jsx';
import MascotReaction from '../components/MascotReaction.jsx';
import PlayfulBackground from '../components/PlayfulBackground.jsx';
import SpeakerButton from '../components/ui/SpeakerButton.jsx';
import { syncSoon } from '../api/sync.js';

// Fisher-Yates 洗牌
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 从全库取干扰项（排除目标字），优先同课/同主题以增加迷惑性。
function pickDistractors(target, pool, n) {
  const others = pool.filter((c) => c.char !== target.char);
  return shuffle(others).slice(0, n);
}

// 题型池：除 match 外都是「单字题」。这里按字生成题目序列。
const SINGLE_TYPES = ['listen-pick', 'pic-pick', 'char-pick', 'trace', 'find-friend'];

export default function GamePlay({ mode = 'lesson' }) {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const isReview = mode === 'review';
  const lesson = isReview ? null : getLesson(lessonId);
  const { speak } = useSpeech();
  const { play } = useSound();
  const reviewChar = useGameStore((s) => s.reviewChar);
  const addCoins = useGameStore((s) => s.addCoins);
  const getDueChars = useGameStore((s) => s.getDueChars);

  // 出题字源：复习模式取今日到期的字（映射回完整字数据），课程模式取本课字。
  const chars = useMemo(() => {
    if (isReview) {
      return getDueChars()
        .map((ch) => getChar(ch))
        .filter(Boolean);
    }
    return lesson ? lesson.chars : [];
  }, [isReview, lesson, getDueChars]);

  // 生成题目序列：每个字一题，随机题型（trace 概率降低，避免太累）。
  const questions = useMemo(() => {
    if (chars.length === 0) return [];
    const singles = shuffle(chars).map((c) => {
      const roll = Math.random();
      // 60% 认读类、20% 找朋友、20% 描红
      let type;
      if (roll < 0.35) type = 'listen-pick';
      else if (roll < 0.55) type = 'pic-pick';
      else if (roll < 0.7) type = 'char-pick';
      else if (roll < 0.85) type = 'find-friend';
      else type = 'trace';
      return { target: c, type };
    });
    // 字数够时，中间插一道连连看整屏题（字↔拼音）。
    if (chars.length >= 4) {
      const mid = Math.floor(singles.length / 2);
      singles.splice(mid, 0, { type: 'match', target: chars[0] });
    }
    return singles;
  }, [chars]);

  const [idx, setIdx] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(null); // 本题答错标记
  const [finished, setFinished] = useState(false);
  const [reaction, setReaction] = useState(null); // 小墨反应 'correct'|'wrong'|null
  const answeredRef = useRef(false);

  const current = questions[idx];

  // 进入听音题自动播音。
  useEffect(() => {
    answeredRef.current = false;
    setWrong(null);
    if (current && (current.type === 'listen-pick')) {
      speak(current.target.char);
    }
  }, [current, speak]);

  const goNext = useCallback(() => {
    if (idx + 1 >= questions.length) {
      setFinished(true);
    } else {
      setIdx((i) => i + 1);
    }
  }, [idx, questions.length]);

  // 统一答题处理。
  const answer = useCallback(
    (ok, charForReview) => {
      if (answeredRef.current) return;
      if (!ok) {
        setWrong(charForReview ?? true);
        play('wrong');
        speak('再试试');
        setReaction(null);
        requestAnimationFrame(() => setReaction('wrong'));
        return; // 答错不推进，允许重试
      }
      answeredRef.current = true;
      setCorrect((n) => n + 1);
      play('correct');
      setReaction(null);
      requestAnimationFrame(() => setReaction('correct'));
      reviewChar(current.target.char, true);
      setTimeout(goNext, 650);
    },
    [current, goNext, play, speak, reviewChar]
  );

  // 课程模式找不到课，或复习模式没有到期的字，都给出返回入口。
  if (!isReview && !lesson) {
    return (
      <div className="page center-col">
        <p>找不到这一课。</p>
        <button className="ui-btn ui-btn--primary ui-btn--lg" onClick={() => { play('tap'); navigate('/'); }}>🏠 回首页</button>
      </div>
    );
  }
  if (isReview && chars.length === 0) {
    return (
      <div className="page center-col">
        <Xiaomo expression="happy" size={140} />
        <p className="q-tip">今天没有要复习的字，太棒啦！</p>
        <button className="ui-btn ui-btn--primary ui-btn--lg" onClick={() => { play('tap'); navigate('/'); }}>🏠 回首页</button>
      </div>
    );
  }

  if (finished) {
    const total = questions.length;
    const stars = correct === total ? 3 : correct >= Math.ceil(total * 0.7) ? 2 : 1;
    const reward = 5 + stars * 5; // 游戏金币奖励
    return (
      <StarReward
        stars={stars}
        title={isReview ? '复习完成！' : '闯关成功！'}
        coins={reward}
        onDone={() => {
          addCoins(reward);
          syncSoon();
          navigate(isReview ? '/' : `/lesson/${lessonId}`);
        }}
      />
    );
  }

  return (
    <div className="page game-play" style={{ '--theme-color': isReview ? 'var(--c-brand)' : lesson.themeColor }}>
      <PlayfulBackground variant="sky" />
      <header className="sub-header">
        <button className="btn-icon" onClick={() => { play('tap'); navigate(-1); }} aria-label="返回">←</button>
        <div className="game-progress-bar">
          <div className="game-progress-fill" style={{ width: `${(idx / questions.length) * 100}%` }} />
        </div>
        <span className="game-count">{idx + 1}/{questions.length}</span>
      </header>

      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.25 }}
        >
          {current && (
            <Question
              q={current}
              pool={ALL_CHARS}
              lessonChars={chars}
              wrong={wrong}
              onAnswer={answer}
              onSpeak={speak}
              onSound={play}
            />
          )}
        </motion.div>
      </AnimatePresence>
      <MascotReaction type={reaction} onHide={() => setReaction(null)} />
    </div>
  );
}

// 单题渲染，按题型分发。
function Question({ q, pool, lessonChars, wrong, onAnswer, onSpeak, onSound }) {
  const { target, type } = q;

  // 为选择类题目准备候选项（目标 + 3 干扰）。
  const options = useMemo(() => {
    if (type === 'trace') return [];
    const distractors = pickDistractors(target, pool, type === 'find-friend' ? 5 : 3);
    return shuffle([target, ...distractors]);
  }, [target, type, pool]);

  if (type === 'trace') {
    return <TraceQuestion target={target} onSpeak={onSpeak} onAnswer={onAnswer} onSound={onSound} />;
  }

  if (type === 'match') {
    // 连连看整屏题：全部配对完成即算这一题过关。
    return (
      <MatchGame
        chars={lessonChars}
        pairBy="pinyin"
        onSpeak={onSpeak}
        onSound={onSound}
        onComplete={() => onAnswer(true)}
      />
    );
  }

  // 题干与选项内容随题型变化。
  const prompt = {
    'listen-pick': { tip: '听一听，选出对的字', head: <SpeakerButton size="lg" onClick={() => onSpeak(target.char)} /> },
    'pic-pick': { tip: '看图片，选出对的字', head: <div className="q-emoji">{target.emoji}</div> },
    'char-pick': { tip: '看这个字，选出对的图', head: <div className="q-char">{target.char}</div> },
    'find-friend': { tip: `找出「${target.char}」`, head: <div className="q-char small">{target.char}</div> },
  }[type];

  const renderOption = (opt, i) => {
    const isWrong = wrong === opt.char;
    // char-pick 选 emoji，其余选字
    const content = type === 'char-pick' ? opt.emoji : opt.char;
    const ok = opt.char === target.char;
    return (
      <motion.button
        key={opt.char}
        className={`q-option ${isWrong ? 'shake wrong' : ''}`}
        initial={{ opacity: 0, y: 26, scale: 0.7 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: i * 0.06, type: 'spring', stiffness: 320, damping: 16 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => onAnswer(ok, opt.char)}
      >
        {content}
      </motion.button>
    );
  };

  const gridClass = type === 'find-friend' ? 'q-options six' : 'q-options';

  return (
    <div className="q-wrap">
      <div className="q-head">{prompt.head}</div>
      <p className="q-tip">{prompt.tip}</p>
      <div className={gridClass}>{options.map(renderOption)}</div>
    </div>
  );
}

// 描红题：用 hanzi-writer 测评，完成即算对。
function TraceQuestion({ target, onSpeak, onAnswer, onSound }) {
  const writerRef = useRef(null);
  const [started, setStarted] = useState(false);

  return (
    <div className="q-wrap center-col">
      <p className="q-tip">照着描一描：{target.char}</p>
      <HanziWriter
        ref={writerRef}
        char={target.char}
        size={280}
        onQuizComplete={() => onAnswer(true, target.char)}
      />
      <div className="q-trace-actions">
        <button className="ui-btn ui-btn--secondary ui-btn--lg" onClick={() => { onSound?.('tap'); onSpeak(target.char); writerRef.current?.animate(); }}>
          👀 看笔顺
        </button>
        {!started && (
          <button className="ui-btn ui-btn--primary ui-btn--lg" onClick={() => { onSound?.('tap'); setStarted(true); writerRef.current?.startQuiz(); }}>
            ✍️ 我来描
          </button>
        )}
      </div>
    </div>
  );
}
