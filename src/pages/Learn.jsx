// 学习页：单字学习闭环。
// 阶段 1「认字」：大字 + 拼音 + emoji 联想 + 组词，点击可发音。
// 阶段 2「学写」：先看笔顺动画，再进入描红测评，写完按错误次数给 1-3 星。
import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ALL_CHARS, getChar } from '../data/characters.js';
import HanziWriter from '../components/HanziWriter.jsx';
import StarReward from '../components/StarReward.jsx';
import { useProgress } from '../hooks/useProgress.js';
import { useSpeech } from '../hooks/useSpeech.js';

// 根据本次描红的总错误次数给星：0 错 3 星，1-2 错 2 星，更多 1 星。
function starsForMistakes(totalMistakes) {
  if (totalMistakes === 0) return 3;
  if (totalMistakes <= 2) return 2;
  return 1;
}

export default function Learn() {
  const { char: rawChar } = useParams();
  const char = decodeURIComponent(rawChar ?? '');
  const navigate = useNavigate();
  const data = getChar(char);

  const { speak } = useSpeech();
  const { awardStars } = useProgress();

  const writerRef = useRef(null);
  const [stage, setStage] = useState('learn'); // 'learn' | 'write'
  const [mistakes, setMistakes] = useState(0);
  const [reward, setReward] = useState(null); // 本次获得的星数

  // 下一个字（用于“学下一个”），同一顺序取 ALL_CHARS。
  const nextChar = useMemo(() => {
    const idx = ALL_CHARS.findIndex((c) => c.char === char);
    if (idx < 0 || idx + 1 >= ALL_CHARS.length) return null;
    return ALL_CHARS[idx + 1].char;
  }, [char]);

  const handleQuizComplete = useCallback(
    (summary) => {
      // summary.totalMistakes 由 hanzi-writer 提供。
      const total = summary?.totalMistakes ?? mistakes;
      const stars = starsForMistakes(total);
      awardStars(char, stars);
      speak('太棒啦');
      setReward(stars);
    },
    [awardStars, char, mistakes, speak]
  );

  if (!data) {
    return (
      <div className="page">
        <p>找不到这个字。</p>
        <button className="btn-primary" onClick={() => navigate('/')}>
          回首页
        </button>
      </div>
    );
  }

  return (
    <div className="page learn-page">
      <header className="sub-header">
        <button className="btn-back" onClick={() => navigate(-1)} aria-label="返回">
          ←
        </button>
        <h2 className="sub-title">
          {stage === 'learn' ? '认一认' : '写一写'}
        </h2>
        <span className="sub-progress" />
      </header>

      {stage === 'learn' && (
        <div className="learn-card">
          <div className="learn-emoji">{data.emoji}</div>
          <button
            className="learn-char"
            onClick={() => speak(char)}
            aria-label={`朗读 ${char}`}
          >
            {char}
          </button>
          <div className="learn-pinyin" onClick={() => speak(char)}>
            {data.pinyin} 🔊
          </div>
          <div className="learn-hint">{data.hint}</div>
          <div className="learn-words">
            {data.words.map((w) => (
              <button key={w} className="word-chip" onClick={() => speak(w)}>
                {w}
              </button>
            ))}
          </div>
          <button className="btn-primary big" onClick={() => setStage('write')}>
            学写字 ✍️
          </button>
        </div>
      )}

      {stage === 'write' && (
        <div className="write-card">
          <HanziWriter
            ref={writerRef}
            char={char}
            size={300}
            onMistake={() => setMistakes((m) => m + 1)}
            onQuizComplete={handleQuizComplete}
          />
          <div className="write-actions">
            <button
              className="btn-secondary"
              onClick={() => {
                speak(char);
                writerRef.current?.animate();
              }}
            >
              👀 看笔顺
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                setMistakes(0);
                writerRef.current?.startQuiz();
              }}
            >
              ✍️ 我来写
            </button>
          </div>
        </div>
      )}

      {reward !== null && (
        <StarReward
          stars={reward}
          onDone={() => {
            setReward(null);
            if (nextChar) {
              // 进入下一个字并回到“认字”阶段。
              setStage('learn');
              setMistakes(0);
              navigate(`/learn/${encodeURIComponent(nextChar)}`);
            } else {
              navigate(-1);
            }
          }}
        />
      )}
    </div>
  );
}
