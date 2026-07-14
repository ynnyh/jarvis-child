// 首页：主题选择。大卡片网格，点一下播放主题名发音，再进入主题。
import { useNavigate } from 'react-router-dom';
import { THEMES } from '../data/characters.js';
import { useProgress } from '../hooks/useProgress.js';
import { useSpeech } from '../hooks/useSpeech.js';

export default function Home() {
  const navigate = useNavigate();
  const { themeProgress, totalStars } = useProgress();
  const { speak } = useSpeech();

  return (
    <div className="page home-page">
      <header className="home-header">
        <h1 className="app-title">🐣 宝宝识字</h1>
        <div className="star-count" aria-label={`一共 ${totalStars} 颗星`}>
          ⭐ {totalStars}
        </div>
      </header>

      <p className="home-subtitle">选一个喜欢的主题，开始学字吧！</p>

      <div className="theme-grid">
        {THEMES.map((theme) => {
          const { done, total } = themeProgress(theme.chars);
          return (
            <button
              key={theme.id}
              className="theme-card"
              style={{ background: theme.color }}
              onClick={() => {
                speak(theme.name);
                navigate(`/theme/${theme.id}`);
              }}
            >
              <span className="theme-emoji">{theme.emoji}</span>
              <span className="theme-name">{theme.name}</span>
              <span className="theme-progress">
                {done}/{total} 字
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
