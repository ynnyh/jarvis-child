// 学习进度与星星：全部存在 localStorage，首版无需后端。
// 数据结构：{ stars: { '一': 3, ... }, learned: ['一', ...] }
import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'jarvis-child-progress';

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { stars: {}, learned: [] };
    const parsed = JSON.parse(raw);
    return {
      stars: parsed.stars ?? {},
      learned: Array.isArray(parsed.learned) ? parsed.learned : [],
    };
  } catch {
    return { stars: {}, learned: [] };
  }
}

function saveProgress(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage 不可用（隐私模式等）时静默失败，不影响学习。
  }
}

export function useProgress() {
  const [progress, setProgress] = useState(loadProgress);

  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  // 记录某个字获得的星星（取历史最高，鼓励重复练习不掉星）。
  const awardStars = useCallback((char, stars) => {
    setProgress((prev) => {
      const current = prev.stars[char] ?? 0;
      const best = Math.max(current, stars);
      const learned = prev.learned.includes(char)
        ? prev.learned
        : [...prev.learned, char];
      return { stars: { ...prev.stars, [char]: best }, learned };
    });
  }, []);

  const getStars = useCallback((char) => progress.stars[char] ?? 0, [progress]);

  const isLearned = useCallback(
    (char) => progress.learned.includes(char),
    [progress]
  );

  // 某主题的完成度：已学字数 / 总字数。
  const themeProgress = useCallback(
    (chars) => {
      const total = chars.length;
      const done = chars.filter((c) => progress.learned.includes(c.char)).length;
      return { done, total };
    },
    [progress]
  );

  const totalStars = Object.values(progress.stars).reduce((a, b) => a + b, 0);

  const resetProgress = useCallback(() => {
    setProgress({ stars: {}, learned: [] });
  }, []);

  return {
    progress,
    awardStars,
    getStars,
    isLearned,
    themeProgress,
    totalStars,
    resetProgress,
  };
}
