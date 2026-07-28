// 单字学习闭环（加深版）：7 步串联，把已有数据全用上。
//   1. intro    情境导入：emoji 场景 + 字揭示动画 + 小墨语音引出
//   2. etym     字理讲解：象形字演变 / 其余字部件拆分（全 300 字覆盖）
//   3. read     认读：大字 + 拼音，点读
//   4. words    组词：每个词点读 + 配图
//   5. sentence 例句情境：整句朗读 + 目标字高亮点读
//   6. write    书写：hanzi-writer 描红测评
//   7. check    即时检查：3 选 1 认字，答对按书写表现给星
// 每字学完记录进度、给金币；一课内逐字推进，学完最后一字回课程页。
import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getLesson, getChar } from '../data/content.generated.js';
import HanziWriter from '../components/HanziWriter.jsx';
import Etymology from '../components/Etymology.jsx';
import Xiaomo from '../components/mascot/Xiaomo.jsx';
import Button from '../components/ui/Button.jsx';
import SpeakerButton, { SpeakerGlyph } from '../components/ui/SpeakerButton.jsx';
import PageTransition from '../components/ui/PageTransition.jsx';
import PlayfulBackground from '../components/PlayfulBackground.jsx';
import StarReward from '../components/StarReward.jsx';
import MascotReaction from '../components/MascotReaction.jsx';
import Confetti from '../components/Confetti.jsx';
import DailyRewardToast from '../components/DailyRewardToast.jsx';
import { useSpeech } from '../hooks/useSpeech.js';
import { useSound } from '../hooks/useSound.js';
import { useGameStore } from '../store/useGameStore.js';
import { syncSoon } from '../api/sync.js';
import { motion } from 'framer-motion';

// 学习步骤顺序。
const STEPS = ['intro', 'etym', 'read', 'words', 'sentence', 'write', 'check'];
const STEP_TITLE = {
  intro: '看一看',
  etym: '字的来历',
  read: '认一认',
  words: '会组词',
  sentence: '读句子',
  write: '写一写',
  check: '考考你',
};

// 按描红错误次数给星：0 错 3 星，1-2 错 2 星，更多 1 星。
function starsForMistakes(m) {
  if (m === 0) return 3;
  if (m <= 2) return 2;
  return 1;
}
const COINS_BY_STARS = { 1: 5, 2: 8, 3: 12 };

// 「下一步」按钮：加大 + 弹簧 scale 入场，减少步骤间的停滞感（样式见 global.css 学习闭环页分区）。
function NextButton({ children, onClick }) {
  return (
    <motion.div
      className="flow-next"
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 0.25, type: 'spring', stiffness: 300, damping: 14 }}
    >
      <Button size="lg" onClick={onClick}>{children}</Button>
    </motion.div>
  );
}

// 洗牌
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 把例句里的目标字高亮成可点读的片段。
function renderSentence(sentence, char, onTapChar) {
  return [...sentence].map((ch, i) =>
    ch === char ? (
      <button key={i} className="sent-char-hl" onClick={() => onTapChar(ch)}>
        {ch}
      </button>
    ) : (
      <span key={i}>{ch}</span>
    )
  );
}

export default function LearnFlow() {
  const { lessonId, char: rawChar } = useParams();
  const char = decodeURIComponent(rawChar ?? '');
  const navigate = useNavigate();

  const lesson = getLesson(lessonId);
  const data = getChar(char);

  const { speak } = useSpeech();
  const { play } = useSound();
  const recordChar = useGameStore((s) => s.recordChar);
  const addCoins = useGameStore((s) => s.addCoins);
  const checkIn = useGameStore((s) => s.checkIn);
  const trackDaily = useGameStore((s) => s.trackDaily);
  const completeLesson = useGameStore((s) => s.completeLesson);
  const getCharStars = useGameStore((s) => s.getCharStars);

  const writerRef = useRef(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [reward, setReward] = useState(null);
  const [checkWrong, setCheckWrong] = useState(null); // 即时检查答错的选项
  const [reaction, setReaction] = useState(null); // 小墨反应
  const [dailyReward, setDailyReward] = useState(null); // 每日任务完成通知
  const [writeBurst, setWriteBurst] = useState(false); // 描红完成的星星爆（页面级，跨步骤存活）

  const step = STEPS[stepIdx];

  // 当前字在本课的位置 + 下一字 + 本课其他字（做检查干扰项）。
  const { indexInLesson, nextChar, siblings } = useMemo(() => {
    if (!lesson) return { indexInLesson: -1, nextChar: null, siblings: [] };
    const chars = lesson.chars.map((c) => c.char);
    const idx = chars.indexOf(char);
    return {
      indexInLesson: idx,
      nextChar: idx >= 0 && idx + 1 < chars.length ? chars[idx + 1] : null,
      siblings: chars.filter((c) => c !== char),
    };
  }, [lesson, char]);

  // 即时检查的 3 个选项（目标 + 2 干扰）。
  const checkOptions = useMemo(
    () => shuffle([char, ...shuffle(siblings).slice(0, 2)]),
    [char, siblings]
  );

  const next = useCallback(() => {
    play('tap');
    setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
  }, [play]);

  // 书写测评完成：不直接给星，进入「即时检查」步骤。
  const handleWriteComplete = useCallback(
    (summary) => {
      const total = summary?.totalMistakes ?? mistakes;
      setMistakes(total);
      play('correct');
      play('levelup');
      speak('写得好棒');
      // 星星爆即时庆祝：页面级渲染（马上切到 check 步，挂在 write 步内会随步骤卸载），
      // 粒子约 1.5s 放完后卸载。
      setWriteBurst(true);
      setTimeout(() => setWriteBurst(false), 1600);
      // 进入 check 步骤。
      setStepIdx(STEPS.indexOf('check'));
    },
    [mistakes, play, speak]
  );

  // 即时检查答题：答对才结算给星并弹奖励。
  const handleCheckPick = useCallback(
    (picked) => {
      if (picked !== char) {
        setCheckWrong(picked);
        play('wrong');
        speak('再看看哦');
        setReaction(null);
        requestAnimationFrame(() => setReaction('wrong'));
        return;
      }
      const stars = starsForMistakes(mistakes);
      recordChar(char, stars);
      checkIn();
      addCoins(COINS_BY_STARS[stars]);
      // 每日任务「学字」计数 +1；达成时弹通知（等星奖励关掉后再显示）。
      const dr = trackDaily('learn');
      if (dr.completed.length) setDailyReward(dr);
      play('correct');
      play('star');
      speak('太棒啦');
      // 即时反馈：小墨从底角弹出欢呼（与星奖励弹层并行，不阻塞流程）。
      setReaction(null);
      requestAnimationFrame(() => setReaction('cheer'));
      setReward(stars);
      syncSoon();
    },
    [char, mistakes, recordChar, checkIn, trackDaily, addCoins, play, speak]
  );

  if (!data || !lesson) {
    return (
      <PageTransition>
        <div className="page center-col">
          <p>找不到这个字。</p>
          <Button size="lg" onClick={() => navigate('/')}>回首页</Button>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="page learnflow" style={{ '--theme-color': lesson.themeColor }}>
        <PlayfulBackground variant="sky" />
        <header className="sub-header">
          <button className="btn-back" onClick={() => { play('tap'); navigate(-1); }} aria-label="返回">
            ←
          </button>
          <h2 className="sub-title">{STEP_TITLE[step]}</h2>
          <span className="sub-progress">
            {indexInLesson + 1}/{lesson.chars.length}
          </span>
        </header>

        {/* 步骤进度条 */}
        <div className="flow-steps">
          {STEPS.map((s, i) => (
            <span key={s} className={`flow-dot ${i === stepIdx ? 'active' : ''} ${i < stepIdx ? 'done' : ''}`} />
          ))}
        </div>

        {/* 1. 情境导入 */}
        {step === 'intro' && (
          <div className="flow-intro">
            <motion.div
              className="intro-emoji"
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 12 }}
            >
              {data.emoji}
            </motion.div>
            <motion.button
              className="intro-char"
              onClick={() => speak(char)}
              initial={{ opacity: 0, y: 30, scale: 0.5 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 260 }}
            >
              {char}
            </motion.button>
            <div className="intro-mascot">
              <Xiaomo expression="happy" size={90} />
              <div className="intro-hint-row">
                <div className="speech-bubble" onClick={() => speak(data.hint)}>
                  {data.hint}
                </div>
                <SpeakerButton
                  size="sm"
                  label="听小墨说"
                  onClick={(e) => {
                    e.stopPropagation();
                    speak(data.hint);
                  }}
                />
              </div>
            </div>
            <NextButton onClick={next}>开始学「{char}」</NextButton>
          </div>
        )}

        {/* 2. 字理讲解（全字覆盖） */}
        {step === 'etym' && (
          <div className="flow-etym">
            <Etymology data={data} onSpeak={speak} />
            <NextButton onClick={next}>我知道啦 →</NextButton>
          </div>
        )}

        {/* 3. 认读 */}
        {step === 'read' && (
          <div className="flow-read">
            <motion.button
              className="read-char"
              onClick={() => speak(char)}
              aria-label={`朗读 ${char}`}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 14 }}
            >
              {char}
            </motion.button>
            <div className="read-pinyin" onClick={() => speak(char)}>
              {data.pinyin}
            </div>
            <SpeakerButton size="md" onClick={() => speak(char)} />
            <p className="flow-tip">点一点，听小墨怎么读</p>
            <NextButton onClick={next}>会读啦 →</NextButton>
          </div>
        )}

        {/* 4. 组词 */}
        {step === 'words' && (
          <div className="flow-words">
            <div className="words-head">
              <button className="words-char" onClick={() => speak(char)} aria-label={`朗读 ${char}`}>
                {char}
              </button>
              <span className="words-tip">能组成这些词，点一点听一听</span>
            </div>
            <div className="read-words">
              {data.words.map((w, i) => (
                <motion.button
                  key={w.word}
                  className="word-chip big"
                  onClick={() => speak(w.word)}
                  initial={{ opacity: 0, y: 24, scale: 0.7 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: i * 0.08, type: 'spring', stiffness: 320, damping: 16 }}
                  whileTap={{ scale: 0.92 }}
                >
                  {w.emoji ? <span className="wc-emoji">{w.emoji}</span> : null}
                  {w.word}
                  <SpeakerGlyph className="wc-spk" />
                </motion.button>
              ))}
            </div>
            <NextButton onClick={next}>学会啦 →</NextButton>
          </div>
        )}

        {/* 5. 例句情境 */}
        {step === 'sentence' && (
          <div className="flow-sentence">
            <Xiaomo expression="happy" size={80} />
            <motion.div
              className="sentence-box"
              onClick={() => speak(data.sentence)}
              initial={{ opacity: 0, y: 24, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 18 }}
            >
              {renderSentence(data.sentence, char, (c) => speak(c))}
            </motion.div>
            <SpeakerButton size="md" label="听句子" onClick={() => speak(data.sentence)} />
            <NextButton onClick={next}>会读句子啦 →</NextButton>
          </div>
        )}

        {/* 6. 书写 */}
        {step === 'write' && (
          <div className="flow-write">
            <HanziWriter
              ref={writerRef}
              char={char}
              size={300}
              onMistake={() => {
                play('wrong');
                setMistakes((m) => m + 1);
              }}
              onCorrectStroke={() => play('tap')}
              onQuizComplete={handleWriteComplete}
            />
            <div className="write-actions">
              <Button variant="secondary" size="lg" onClick={() => { speak(char); writerRef.current?.animate(); }}>
                👀 看笔顺
              </Button>
              <Button size="lg" onClick={() => { setMistakes(0); writerRef.current?.startQuiz(); }}>
                ✍️ 我来写
              </Button>
            </div>
          </div>
        )}

        {/* 7. 即时检查 */}
        {step === 'check' && (
          <div className="flow-check">
            <p className="check-q">哪个是「<span className="check-target" onClick={() => speak(char)}>{char}</span>」？</p>
            <SpeakerButton size="sm" label="再听一次" onClick={() => speak(char)} />
            <div className="check-options">
              {checkOptions.map((opt, i) => (
                <motion.button
                  key={opt}
                  className={`check-option ${checkWrong === opt ? 'shake wrong' : ''}`}
                  initial={{ opacity: 0, y: 28, scale: 0.6 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: i * 0.09, type: 'spring', stiffness: 320, damping: 15 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleCheckPick(opt)}
                >
                  {opt}
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {reward !== null && (
          <StarReward
            stars={reward}
            coins={COINS_BY_STARS[reward]}
            onDone={() => {
              setReward(null);
              if (nextChar) {
                setStepIdx(0);
                setMistakes(0);
                setCheckWrong(null);
                navigate(`/learn/${lessonId}/${encodeURIComponent(nextChar)}`);
              } else {
                // 本课最后一字学完：按全课平均星级记录课程完成，解锁下一关。
                const starsList = lesson.chars.map((c) => getCharStars(c.char));
                const avg = starsList.reduce((a, b) => a + b, 0) / starsList.length;
                const lessonStars = Math.max(1, Math.round(avg));
                completeLesson(lessonId, lessonStars);
                syncSoon();
                navigate(`/lesson/${lessonId}`);
              }
            }}
          />
        )}

        {/* 字卡收入囊中：星级结算出现时，字卡从屏幕中央缩小飞向右下角（暗示飞入收集册）。
            纯动效层不拦点击，出现 + 飞行 1s 内完成，不阻塞流程。 */}
        {reward !== null && (
          <motion.div
            className="char-fly"
            aria-hidden="true"
            initial={{ x: 0, y: 0, scale: 0.9, opacity: 0 }}
            animate={{
              x: (typeof window !== 'undefined' ? window.innerWidth : 400) / 2 - 60,
              y: (typeof window !== 'undefined' ? window.innerHeight : 700) * 0.5,
              scale: 0.22,
              opacity: [0, 1, 1, 0],
            }}
            transition={{ delay: 1.15, duration: 0.75, ease: 'easeInOut' }}
          >
            {char}
          </motion.div>
        )}

        {/* 描红完成的星星爆：页面级渲染，进入 check 步后仍能放完 */}
        {writeBurst && <Confetti preset="stars" />}
        <MascotReaction type={reaction} onHide={() => setReaction(null)} />
        {/* 每日任务完成通知：星奖励关掉后再弹，避免两层奖励叠一起 */}
        {reward === null && dailyReward && (
          <DailyRewardToast reward={dailyReward} onDone={() => setDailyReward(null)} />
        )}
      </div>
    </PageTransition>
  );
}
