// 绘本阅读页：逐页翻阅，进入每页自动朗读，可重听/上一页/下一页。
// 每页大 emoji「插画」+ 朗读句子；本页重点字（focus）高亮，点击单独发声。
// 读到最后一页给「读完啦」结算（撒花 + 金币奖励）。
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { getStory, getTheme } from '../data/content.generated.js';
import { useGameStore } from '../store/useGameStore.js';
import { useSpeech } from '../hooks/useSpeech.js';
import { useSound } from '../hooks/useSound.js';
import Button from '../components/ui/Button.jsx';
import SpeakerButton from '../components/ui/SpeakerButton.jsx';
import PageTransition from '../components/ui/PageTransition.jsx';
import PlayfulBackground from '../components/PlayfulBackground.jsx';
import Confetti from '../components/Confetti.jsx';
import Xiaomo from '../components/mascot/Xiaomo.jsx';

const STORY_REWARD = 10; // 读完一本绘本奖励金币

// 把句子按「重点字」拆成可点击的片段：重点字单独成一个高亮 span。
function renderSentence(text, focus, onCharTap) {
  if (!focus) return text;
  const parts = [];
  let buf = '';
  for (const ch of text) {
    if (ch === focus) {
      if (buf) { parts.push(buf); buf = ''; }
      parts.push(
        <button
          key={parts.length}
          className="story-focus-char"
          onClick={() => onCharTap(ch)}
        >
          {ch}
        </button>
      );
    } else {
      buf += ch;
    }
  }
  if (buf) parts.push(buf);
  return parts;
}

export default function StoryReader() {
  const { storyId } = useParams();
  const navigate = useNavigate();
  const story = getStory(storyId);
  const { speak } = useSpeech();
  const sound = useSound();
  const addCoins = useGameStore((s) => s.addCoins);

  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);
  const rewardedRef = useRef(false);

  const total = story ? story.pages.length : 0;
  const page = story ? story.pages[index] : null;

  // 进入每一页时自动朗读该页句子。
  useEffect(() => {
    if (page) speak(page.text);
  }, [page, speak]);

  // 读完结算：撒花 + 一次性金币奖励。
  useEffect(() => {
    if (done && !rewardedRef.current) {
      rewardedRef.current = true;
      sound.chest();
      addCoins(STORY_REWARD);
    }
  }, [done, sound, addCoins]);

  const goNext = useCallback(() => {
    if (index < total - 1) {
      sound.swoosh();
      setIndex((i) => i + 1);
    } else {
      setDone(true);
    }
  }, [index, total, sound]);

  const goPrev = useCallback(() => {
    if (index > 0) {
      sound.swoosh();
      setIndex((i) => i - 1);
    }
  }, [index, sound]);

  if (!story) {
    return (
      <PageTransition>
        <div className="page">
          <p>找不到这本绘本。</p>
          <Button onClick={() => navigate('/story')}>回绘本屋</Button>
        </div>
      </PageTransition>
    );
  }

  const theme = getTheme(story.themeId);
  const themeColor = theme?.color ?? '#ff8fb1';

  return (
    <PageTransition>
      <div className="page story-reader" style={{ '--theme-color': themeColor }}>
        <PlayfulBackground variant="sky" />
        <header className="sub-header">
          <button className="btn-back" onClick={() => { sound.tap(); navigate('/story'); }} aria-label="返回绘本屋">
            ←
          </button>
          <h2 className="sub-title">{story.title}</h2>
          <span className="sub-progress">
            {done ? total : index + 1}/{total}
          </span>
        </header>

        {!done ? (
          <>
            <AnimatePresence mode="wait">
              <motion.div
                key={index}
                className="story-page"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                <div className="story-illustration" aria-hidden="true">
                  {page.emoji}
                </div>
                <p className="story-text">
                  {renderSentence(page.text, page.focus, (ch) => { sound.tap(); speak(ch); })}
                </p>
              </motion.div>
            </AnimatePresence>

            <div className="story-controls">
              <button
                className="story-nav-btn"
                onClick={goPrev}
                disabled={index === 0}
                aria-label="上一页"
              >
                ‹
              </button>
              <SpeakerButton
                size="sm"
                label="再听一遍"
                onClick={() => { sound.tap(); speak(page.text); }}
              />
              <button
                className="story-nav-btn"
                onClick={goNext}
                aria-label={index === total - 1 ? '读完啦' : '下一页'}
              >
                ›
              </button>
            </div>
          </>
        ) : (
          <motion.div
            className="story-finish"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 18 }}
          >
            <Confetti />
            <Xiaomo expression="cheer" size={110} />
            <div className="story-finish-emoji">{story.cover}</div>
            <h3 className="story-finish-title">读完啦！</h3>
            <p className="story-finish-reward">+{STORY_REWARD} 金币 🪙</p>
            <div className="story-finish-actions">
              <Button
                onClick={() => {
                  sound.tap();
                  rewardedRef.current = false;
                  setDone(false);
                  setIndex(0);
                }}
              >
                🔁 再读一遍
              </Button>
              <Button variant="secondary" onClick={() => { sound.tap(); navigate('/story'); }}>
                📚 回绘本屋
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </PageTransition>
  );
}
