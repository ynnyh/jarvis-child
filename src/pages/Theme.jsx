// 主题页：展示主题内所有字的卡片（含已得星星），底部有“复习游戏”入口。
import { useNavigate, useParams } from 'react-router-dom';
import { getTheme } from '../data/characters.js';
import { useProgress } from '../hooks/useProgress.js';
import { useSpeech } from '../hooks/useSpeech.js';

export default function Theme() {
  const { themeId } = useParams();
  const navigate = useNavigate();
  const theme = getTheme(themeId);
  const { getStars, isLearned, themeProgress } = useProgress();
  const { speak } = useSpeech();

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

  const { done, total } = themeProgress(theme.chars);

  return (
    <div className="page theme-page" style={{ '--theme-color': theme.color }}>
      <header className="sub-header">
        <button className="btn-back" onClick={() => navigate('/')} aria-label="返回">
          ←
        </button>
        <h2 className="sub-title">
          {theme.emoji} {theme.name}
        </h2>
        <span className="sub-progress">
          {done}/{total}
        </span>
      </header>

      <div className="char-grid">
        {theme.chars.map((c) => {
          const stars = getStars(c.char);
          const learned = isLearned(c.char);
          return (
            <button
              key={c.char}
              className={`char-card ${learned ? 'learned' : ''}`}
              onClick={() => {
                speak(c.char);
                navigate(`/learn/${encodeURIComponent(c.char)}`);
              }}
            >
              <span className="char-emoji">{c.emoji}</span>
              <span className="char-big">{c.char}</span>
              <span className="char-pinyin">{c.pinyin}</span>
              <span className="char-stars">
                {[1, 2, 3].map((n) => (
                  <span key={n}>{n <= stars ? '⭐' : '☆'}</span>
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <button
        className="btn-game"
        onClick={() => navigate(`/game/${theme.id}`)}
      >
        🎮 复习小游戏
      </button>
    </div>
  );
}
