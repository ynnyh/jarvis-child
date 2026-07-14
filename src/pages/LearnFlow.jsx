// 单字学习闭环（深化版）：四步串联。
//   1. 情境引入 intro   —— emoji 大图 + 小墨引导语（语音）
//   2. 象形演变 evolve   —— 仅象形字有 pictograph 时展示；否则跳过
//   3. 认读     read     —— 大字 + 拼音 + 部件 + 组词（配图），点读
//   4. 书写     write    —— hanzi-writer 笔顺动画 + 描红测评，按错误给星
// 每字学完记录进度、给金币；一课内逐字推进，学完最后一字回到课程页。
import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getLesson, getChar } from '../data/content.generated.js';
import HanziWriter from '../components/HanziWriter.jsx';
import Pictograph from '../components/Pictograph.jsx';
import Xiaomo from '../components/mascot/Xiaomo.jsx';
import Button from '../components/ui/Button.jsx';
import PageTransition from '../components/ui/PageTransition.jsx';
import StarReward from '../components/StarReward.jsx';
import { useSpeech } from '../hooks/useSpeech.js';
import { useSound } from '../hooks/useSound.js';
import { useGameStore } from '../store/useGameStore.js';
import { syncSoon } from '../api/sync.js';

// 按描红错误次数给星：0 错 3 星，1-2 错 2 星，更多 1 星。
function starsForMistakes(m) {
  if (m === 0) return 3;
  if (m <= 2) return 2;
  return 1;
}

// 每学一字的金币奖励（按星级）。
const COINS_BY_STARS = { 1: 5, 2: 8, 3: 12 };

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

  const writerRef = useRef(null);
  // 步骤：intro -> (evolve) -> read -> write
  const hasEvolve = Array.isArray(data?.pictograph) && data.pictograph.length > 0;
  const [step, setStep] = useState('intro');
  const [mistakes, setMistakes] = useState(0);
  const [reward, setReward] = useState(null);

  // 当前字在本课的位置，用于「下一字」。
  const { indexInLesson, nextChar } = useMemo(() => {
    if (!lesson) return { indexInLesson: -1, nextChar: null };
    const chars = lesson.chars.map((c) => c.char);
    const idx = chars.indexOf(char);
    return {
      indexInLesson: idx,
      nextChar: idx >= 0 && idx + 1 < chars.length ? chars[idx + 1] : null,
    };
  }, [lesson, char]);

  const goStep = useCallback(
    (next) => {
      play('tap');
      setStep(next);
    },
    [play]
  );

  const handleQuizComplete = useCallback(
    (summary) => {
      const total = summary?.totalMistakes ?? mistakes;
      const stars = starsForMistakes(total);
      recordChar(char, stars);
      checkIn();
      addCoins(COINS_BY_STARS[stars]);
      play('correct');
      speak('太棒啦');
      setReward(stars);
      syncSoon(); // 已登录时后台同步进度，未登录静默跳过
    },
    [mistakes, recordChar, checkIn, addCoins, char, play, speak]
  );

  if (!data || !lesson) {
    return (
      <PageTransition>
        <div className="page">
          <p>找不到这个字。</p>
          <Button onClick={() => navigate('/')}>回首页</Button>
        </div>
      </PageTransition>
    );
  }

  const stepTitle = {
    intro: '看一看',
    evolve: '字的来历',
    read: '认一认',
    write: '写一写',
  }[step];

  return (
    <PageTransition>
      <div className="page learnflow" style={{ '--theme-color': lesson.themeColor }}>
        <header className="sub-header">
          <button className="btn-back" onClick={() => navigate(-1)} aria-label="返回">
            ←
          </button>
          <h2 className="sub-title">{stepTitle}</h2>
          <span className="sub-progress">
            {indexInLesson + 1}/{lesson.chars.length}
          </span>
        </header>

        {/* 1. 情境引入 */}
        {step === 'intro' && (
          <div className="flow-intro">
            <div className="intro-emoji">{data.emoji}</div>
            <div className="intro-mascot">
              <Xiaomo expression="happy" size={110} />
              <div className="speech-bubble" onClick={() => speak(data.hint)}>
                {data.hint} 🔊
              </div>
            </div>
            <Button size="lg" onClick={() => goStep(hasEvolve ? 'evolve' : 'read')}>
              开始学「{char}」
            </Button>
          </div>
        )}

        {/* 2. 象形演变（仅象形字） */}
        {step === 'evolve' && (
          <div className="flow-evolve">
            <Pictograph steps={data.pictograph} onSpeak={() => speak(char)} />
            <p className="evolve-caption">
              看，「{char}」就是这样一点点变来的！
            </p>
            <Button size="lg" onClick={() => goStep('read')}>
              我知道啦 →
            </Button>
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
            {data.components?.length > 1 && (
              <div className="read-components">
                部件：{data.components.join(' + ')}
              </div>
            )}
            <div className="read-words">
              {data.words.map((w) => (
                <button key={w.word} className="word-chip" onClick={() => speak(w.word)}>
                  {w.emoji ? `${w.emoji} ` : ''}
                  {w.word}
                </button>
              ))}
            </div>
            <Button size="lg" onClick={() => goStep('write')}>
              学写字 ✍️
            </Button>
          </div>
        )}

        {/* 4. 书写 */}
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
              onCorrectStroke={() => play('stroke')}
              onQuizComplete={handleQuizComplete}
            />
            <div className="write-actions">
              <Button
                variant="secondary"
                onClick={() => {
                  speak(char);
                  writerRef.current?.animate();
                }}
              >
                👀 看笔顺
              </Button>
              <Button
                onClick={() => {
                  setMistakes(0);
                  writerRef.current?.startQuiz();
                }}
              >
                ✍️ 我来写
              </Button>
            </div>
          </div>
        )}

        {reward !== null && (
          <StarReward
            stars={reward}
            onDone={() => {
              setReward(null);
              if (nextChar) {
                setStep('intro');
                setMistakes(0);
                navigate(`/learn/${lessonId}/${encodeURIComponent(nextChar)}`);
              } else {
                // 本课学完，回课程页（结算在课程页处理）。
                navigate(`/lesson/${lessonId}`);
              }
            }}
          />
        )}
      </div>
    </PageTransition>
  );
}
