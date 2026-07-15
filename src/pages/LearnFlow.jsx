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
import PageTransition from '../components/ui/PageTransition.jsx';
import PlayfulBackground from '../components/PlayfulBackground.jsx';
import StarReward from '../components/StarReward.jsx';
import MascotReaction from '../components/MascotReaction.jsx';
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
  const completeLesson = useGameStore((s) => s.completeLesson);
  const getCharStars = useGameStore((s) => s.getCharStars);

  const writerRef = useRef(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [reward, setReward] = useState(null);
  const [checkWrong, setCheckWrong] = useState(null); // 即时检查答错的选项
  const [reaction, setReaction] = useState(null); // 小墨反应

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
      speak('写得好棒');
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
      play('star');
      speak('太棒啦');
      setReward(stars);
      syncSoon();
    },
    [char, mistakes, recordChar, checkIn, addCoins, play, speak]
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
          <button className="btn-back" onClick={() => navigate(-1)} aria-label="返回">
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
              <Xiaomo expression="happy" size={90} animate={false} />
              <div className="speech-bubble" onClick={() => speak(data.hint)}>
                {data.hint} 🔊
              </div>
            </div>
            <Button size="lg" onClick={next}>开始学「{char}」</Button>
          </div>
        )}

        {/* 2. 字理讲解（全字覆盖） */}
        {step === 'etym' && (
          <div className="flow-etym">
            <Etymology data={data} onSpeak={speak} />
            <Button size="lg" onClick={next}>我知道啦 →</Button>
          </div>
        )}

        {/* 3. 认读 */}
        {step === 'read' && (
          <div className="flow-read">
            <button className="read-char" onClick={() => speak(char)} aria-label={`朗读 ${char}`}>
              {char}
            </button>
            <div className="read-pinyin" onClick={() => speak(char)}>
              {data.pinyin} 🔊
            </div>
            <p className="flow-tip">点一点，听小墨怎么读</p>
            <Button size="lg" onClick={next}>会读啦 →</Button>
          </div>
        )}

        {/* 4. 组词 */}
        {step === 'words' && (
          <div className="flow-words">
            <div className="words-head">
              <span className="words-char">{char}</span>
              <span className="words-tip">能组成这些词，点一点听一听</span>
            </div>
            <div className="read-words">
              {data.words.map((w) => (
                <button key={w.word} className="word-chip big" onClick={() => speak(w.word)}>
                  {w.emoji ? <span className="wc-emoji">{w.emoji}</span> : null}
                  {w.word} 🔊
                </button>
              ))}
            </div>
            <Button size="lg" onClick={next}>学会啦 →</Button>
          </div>
        )}

        {/* 5. 例句情境 */}
        {step === 'sentence' && (
          <div className="flow-sentence">
            <Xiaomo expression="happy" size={80} animate={false} />
            <div className="sentence-box" onClick={() => speak(data.sentence)}>
              {renderSentence(data.sentence, char, (c) => speak(c))}
            </div>
            <button className="sent-play" onClick={() => speak(data.sentence)}>
              🔊 听一遍
            </button>
            <Button size="lg" onClick={next}>会读句子啦 →</Button>
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
            <button className="check-speaker" onClick={() => speak(char)}>🔊 再听一次</button>
            <div className="check-options">
              {checkOptions.map((opt) => (
                <motion.button
                  key={opt}
                  className={`check-option ${checkWrong === opt ? 'shake wrong' : ''}`}
                  whileTap={{ scale: 0.92 }}
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
        <MascotReaction type={reaction} onHide={() => setReaction(null)} />
      </div>
    </PageTransition>
  );
}
