// 全局游戏状态：进度、星星、金币、宠物、复习盒子、打卡。
// 用 zustand + localStorage 持久化（本地优先）。P7 接入后端后，这里作为本地缓存，
// 由同步层负责与服务器对账；现阶段纯本地即可完整运行。
//
// 数据结构说明：
//   chars: { [char]: { stars, box, due, learnedAt, reviewedAt } }
//     - stars: 该字最佳星级 0-3
//     - box:   Leitner 盒子等级 1-5（P5 复习系统用）
//     - due:   下次复习到期时间戳（ms）
//   lessons: { [lessonId]: { stars, completedAt } }  // 每课星级与完成时间
//   coins:   金币总数
//   pet:     { exp, level, fed }  // 宠物经验/等级/今日喂食次数
//   streak:  { count, lastDay }   // 连续打卡

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Leitner 盒子 -> 复习间隔（天）。盒子越高，间隔越长。
export const BOX_INTERVALS_DAYS = { 1: 1, 2: 2, 3: 4, 4: 7, 5: 15 };
const DAY_MS = 24 * 60 * 60 * 1000;

// 今天的 0 点（本地）时间戳，用于打卡判断。
function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export const useGameStore = create(
  persist(
    (set, get) => ({
      chars: {},
      lessons: {},
      coins: 0,
      pet: { exp: 0, level: 1, fed: 0, fedDay: 0 },
      streak: { count: 0, lastDay: 0 },

      // --- 学习：记录某字的学习结果（星级 + 进入复习盒子）---
      recordChar(char, stars) {
        set((state) => {
          const prev = state.chars[char] ?? { stars: 0, box: 0, due: 0 };
          const box = 1; // 新学/重学后进入盒子 1，开始复习循环
          const due = Date.now() + BOX_INTERVALS_DAYS[1] * DAY_MS;
          return {
            chars: {
              ...state.chars,
              [char]: {
                ...prev,
                stars: Math.max(prev.stars, stars),
                box,
                due,
                learnedAt: prev.learnedAt ?? Date.now(),
              },
            },
          };
        });
      },

      // --- 复习：答对升盒子、答错回盒子1，重算 due（P5 用）---
      reviewChar(char, correct) {
        set((state) => {
          const prev = state.chars[char];
          if (!prev) return {};
          const box = correct ? Math.min(5, (prev.box || 1) + 1) : 1;
          const due = Date.now() + BOX_INTERVALS_DAYS[box] * DAY_MS;
          return {
            chars: {
              ...state.chars,
              [char]: { ...prev, box, due, reviewedAt: Date.now() },
            },
          };
        });
      },

      // --- 完成一课：记录课星级 ---
      completeLesson(lessonId, stars) {
        set((state) => {
          const prev = state.lessons[lessonId] ?? { stars: 0 };
          return {
            lessons: {
              ...state.lessons,
              [lessonId]: {
                stars: Math.max(prev.stars, stars),
                completedAt: Date.now(),
              },
            },
          };
        });
      },

      // --- 经济：增减金币 ---
      addCoins(n) {
        set((state) => ({ coins: Math.max(0, state.coins + n) }));
      },

      // --- 宠物：喂食（消耗金币在调用处扣，这里只涨经验/升级）---
      feedPet(expGain = 20) {
        set((state) => {
          const today = startOfToday();
          const fedDay = state.pet.fedDay === today ? state.pet.fed : 0;
          let exp = state.pet.exp + expGain;
          let level = state.pet.level;
          // 每 100 经验升一级。
          while (exp >= 100) {
            exp -= 100;
            level += 1;
          }
          return {
            pet: { exp, level, fed: fedDay + 1, fedDay: today },
          };
        });
      },

      // --- 打卡：每天首次学习时调用，维护连续天数 ---
      checkIn() {
        set((state) => {
          const today = startOfToday();
          if (state.streak.lastDay === today) return {}; // 今天已打卡
          const yesterday = today - DAY_MS;
          const count =
            state.streak.lastDay === yesterday ? state.streak.count + 1 : 1;
          return { streak: { count, lastDay: today } };
        });
      },

      // --- 派生查询 ---
      getCharStars: (char) => get().chars[char]?.stars ?? 0,
      getLessonStars: (lessonId) => get().lessons[lessonId]?.stars ?? 0,
      isCharLearned: (char) => !!get().chars[char],

      // 今日到期复习的字列表。
      getDueChars() {
        const now = Date.now();
        return Object.entries(get().chars)
          .filter(([, v]) => v.due && v.due <= now)
          .map(([char]) => char);
      },

      // 重置全部（家长中心用）。
      resetAll() {
        set({
          chars: {},
          lessons: {},
          coins: 0,
          pet: { exp: 0, level: 1, fed: 0, fedDay: 0 },
          streak: { count: 0, lastDay: 0 },
        });
      },
    }),
    {
      name: 'jarvis-child-game',
      version: 1,
    }
  )
);
