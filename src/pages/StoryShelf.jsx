// 绘本架：列出所有主题绘本，点封面进入阅读。
// 纯文字 + emoji 绘本（遵循 VISUAL-v3：无插画素材），封面色跟随主题。
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { STORIES, getTheme } from '../data/content.generated.js';
import { useSpeech } from '../hooks/useSpeech.js';
import { useSound } from '../hooks/useSound.js';
import PageTransition from '../components/ui/PageTransition.jsx';
import PlayfulBackground from '../components/PlayfulBackground.jsx';

export default function StoryShelf() {
  const navigate = useNavigate();
  const { speak } = useSpeech();
  const sound = useSound();

  return (
    <PageTransition>
      <div className="page story-shelf">
        <PlayfulBackground variant="sky" />
        <header className="sub-header">
          <button className="btn-back" onClick={() => { sound.tap(); navigate('/'); }} aria-label="返回首页">
            ←
          </button>
          <h2 className="sub-title">📚 绘本屋</h2>
          <span className="sub-progress" />
        </header>

        <p className="world-intro">选一本绘本，听故事、认字吧！</p>

        <div className="story-shelf-grid">
          {STORIES.map((story, i) => {
            const theme = getTheme(story.themeId);
            const color = theme?.color ?? '#ff8fb1';
            return (
              <motion.button
                key={story.id}
                className="story-cover-card"
                style={{ '--cover-color': color }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  sound.tap();
                  speak(story.title);
                  navigate(`/story/${story.id}`);
                }}
              >
                <span className="story-cover-emoji">{story.cover}</span>
                <span className="story-cover-title">{story.title}</span>
                <span className="story-cover-pages">{story.pages.length} 页</span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </PageTransition>
  );
}
