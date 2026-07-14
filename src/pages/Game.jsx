// 复习游戏：听音选字。
// 播放某个字的读音，从若干候选里选出正确的字，答对给星、答错抖动提示。
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getTheme } from '../data/characters.js';
import { useSpeech } from '../hooks/useSpeech.js';
import StarReward from '../components/StarReward.jsx';

// 洗牌：Fisher-Yates。
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 每题：目标字 + 3 个干扰项（同主题内随机）。
function buildQuestions(chars) {
  return shuffle(chars).map((target) => {
    const distractors = shuffle(chars.filter((c) => c.char !== target.char)).slice(0, 3);
    const options = shuffle([target, ...distractors]);
    return { target, options };
  });
}

export default function Game() {
  const { themeId } = useParams();
  const navigate = useNavigate();
  const theme = getTheme(themeId);
  const { speak } = useSpeech();

  const questions = useMemo(
    () => (theme ? buildQuestions(theme.chars) : []),
    [theme]
  );

  const [idx, setIdx] = useState(0);
  const [wrongChar, setWrongChar] = useState(null); // 本题答错的选项，用于抖动
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);

  const current = questions[idx];

  // 每进入一题，自动播放目标字读音。
  useEffect(() => {
    if (current) speak(current.target.char);
  }, [current, speak]);

  const handlePick = useCallback(
    (option) => {
      if (!current) return;
      if (option.char === current.target.char) {
        setWrongChar(null);
        setCorrectCount((n) => n + 1);
        speak('对啦');
        // 短暂停顿后进入下一题。
        setTimeout(() => {
          if (idx + 1 >= questions.length) {
            setFinished(true);
          } else {
            setIdx((i) => i + 1);
          }
        }, 700);
      } else {
        setWrongChar(option.char);
        speak('再试试');
      }
    },
    [current, idx, questions.length, speak]
  );

  if (!theme) {
    return (
      <div className="page">
        <p>找不到这个主题。</p>
        <button className="btn-primary" onClick={() => navigate('/')}>
          回首页
        </button>
      </div>
    );
  }

  if (finished) {
    // 按正确率给星：全对 3 星，答错不多 2 星，否则 1 星。
    const total = questions.length;
    const stars = correctCount === total ? 3 : correctCount >= total - 2 ? 2 : 1;
    return (
      <StarReward
        stars={stars}
        onDone={() => navigate(`/theme/${themeId}`)}
      />
    );
  }

  return (
    <div className="page game-page" style={{ '--theme-color': theme.color }}>
      <header className="sub-header">
        <button className="btn-back" onClick={() => navigate(-1)} aria-label="返回">
          ←
        </button>
        <h2 className="sub-title">听音选字 · {theme.emoji}</h2>
        <span className="sub-progress">
          {idx + 1}/{questions.length}
        </span>
      </header>

      <div className="game-prompt">
        <button
          className="speaker-btn"
          onClick={() => current && speak(current.target.char)}
          aria-label="再听一次"
        >
          🔊
        </button>
        <p className="game-tip">听一听，选出对的字</p>
      </div>

      <div className="game-options">
        {current?.options.map((opt) => (
          <button
            key={opt.char}
            className={`game-option ${wrongChar === opt.char ? 'shake wrong' : ''}`}
            onClick={() => handlePick(opt)}
          >
            {opt.char}
          </button>
        ))}
      </div>
    </div>
  );
}
