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
//   pet:     { exp, level, fed, fedDay, satiety, satietyAt, mood, pettedDay, pettedCount }
//            // 宠物：经验/等级/今日喂食次数 + 饱食度/心情/今日抚摸次数（阶段 4）
//   streak:  { count, lastDay }   // 连续打卡
//   owned:   { [itemId]: true }   // 已购商品（装扮/装饰，阶段 3）
//   equipped: [itemId]            // 已穿戴的装扮（阶段 4 渲染）
//   daily:   { day, learn, game, story, rewarded }  // 每日任务计数与发奖标记（按自然日重置）
//   giftDay: 上次领取「每日惊喜」的自然日（startOfToday 时间戳，0/undefined=从未领过）

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getItem } from '../data/shop.js';

// Leitner 盒子 -> 复习间隔（天）。盒子越高，间隔越长。
export const BOX_INTERVALS_DAYS = { 1: 1, 2: 2, 3: 4, 4: 7, 5: 15 };
const DAY_MS = 24 * 60 * 60 * 1000;

// 每日任务目标与奖励（阶段 3）：单项完成各发 15 币，三项全完成额外 30 币。
export const DAILY_GOALS = { learn: 3, game: 1, story: 1 };
export const DAILY_REWARD = 15;
export const DAILY_ALL_REWARD = 30;

// 每日惊喜（阶段 5）：首页海岛随机出现的礼物盒，每天一次，随机金币区间。
export const GIFT_COIN_MIN = 5;
export const GIFT_COIN_MAX = 20;

// 今天的 0 点（本地）时间戳，用于打卡判断。
function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// 空的每日任务数据（day=0 表示从未记录，首次 trackDaily 会初始化成今天）。
function emptyDaily() {
  return { day: 0, learn: 0, game: 0, story: 0, rewarded: { learn: false, game: false, story: false, all: false } };
}

// 读取「今天」的每日任务进度：旧数据没有 daily 字段、或 daily 不是今天的，都按 0 计。
// 给 UI 展示用（纯读取，不写库）；写库走 trackDaily。
export function dailyForToday(daily) {
  const base = emptyDaily();
  if (!daily || daily.day !== startOfToday()) return base;
  return {
    ...base,
    ...daily,
    learn: daily.learn ?? 0,
    game: daily.game ?? 0,
    story: daily.story ?? 0,
    rewarded: { ...base.rewarded, ...(daily.rewarded ?? {}) },
  };
}

// 「每日惊喜」今天是否还能领（UI 控制礼物盒显隐用，纯读取；写库走 claimGift）。
// giftDay 为 undefined 的旧数据按「未领过」处理。
export function giftAvailable(giftDay) {
  return (giftDay ?? 0) !== startOfToday();
}

// --- 宠物三维状态（阶段 4）：经验/等级 + 饱食度 + 心情 ---
// persist 兼容说明：persist 是浅合并，旧数据的 pet 会整体覆盖这里的初始 pet，
// 新字段（satiety/mood 等）会是 undefined —— 所以所有读取都必须经过 normalizePet
// 补默认值（?? 默认值集中在 PET_DEFAULTS），UI 和 action 统一走它，不直接读原始字段。
export const PET_DEFAULTS = {
  exp: 0,
  level: 1,
  fed: 0, // 今日喂食次数
  fedDay: 0, // 上次喂食的自然日
  satiety: 60, // 饱食度 0-100
  satietyAt: 0, // 饱食度上次结算时间戳（0=旧数据还没记录过，不追溯衰减）
  mood: 60, // 心情 0-100
  pettedDay: 0, // 上次抚摸的自然日
  pettedCount: 0, // 今日抚摸次数
};

const HOUR_MS = 60 * 60 * 1000;
// 衰减规则（读取时懒计算，不起定时器）：
//   饱食度：距 satietyAt 每小时 -5，下限 0；
//   心情：  不随时间自然衰减，只在饱食度 <30 时每小时 -3，下限 0。
export const SATIETY_DECAY_PER_HOUR = 5;
export const MOOD_DECAY_PER_HOUR = 3;
export const MOOD_DECAY_SATIETY_THRESHOLD = 30;
// 抚摸：每次心情 +10，每日上限 5 次（pettedDay/pettedCount 防刷）。
export const PET_MOOD_GAIN = 10;
export const PET_DAILY_LIMIT = 5;
// 喂食饱食度增量：简单起见所有食物统一 +25（心情/经验按食物各自的字段，见 shop.js）。
export const FEED_SATIETY_GAIN = 25;

// 读取宠物状态：补旧数据缺失字段 + 按 satietyAt 懒计算衰减。纯函数，不写库。
export function normalizePet(pet, now = Date.now()) {
  const p = { ...PET_DEFAULTS, ...(pet ?? {}) };
  // satietyAt=0 表示旧数据还没有时间基线：以当前值为起点，不追溯历史衰减。
  if (p.satietyAt > 0 && now > p.satietyAt) {
    const hours = (now - p.satietyAt) / HOUR_MS;
    p.satiety = Math.max(0, Math.round(p.satiety - hours * SATIETY_DECAY_PER_HOUR));
    if (p.satiety < MOOD_DECAY_SATIETY_THRESHOLD) {
      p.mood = Math.max(0, Math.round(p.mood - hours * MOOD_DECAY_PER_HOUR));
    }
  }
  return p;
}

export const useGameStore = create(
  persist(
    (set, get) => ({
      chars: {},
      lessons: {},
      coins: 0,
      pet: { ...PET_DEFAULTS },
      streak: { count: 0, lastDay: 0 },
      owned: {}, // 已购商品：{ [itemId]: true }
      equipped: [], // 已穿戴装扮 id（阶段 4 渲染）
      daily: emptyDaily(), // 每日任务（按自然日重置）
      giftDay: 0, // 每日惊喜：上次领奖的自然日（阶段 5）

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

      // --- 经济：消费金币（余额足够才扣），返回是否扣款成功 ---
      spendCoins(n) {
        if (get().coins < n) return false;
        set((state) => ({ coins: state.coins - n }));
        return true;
      },

      // --- 商店：购买商品（阶段 3）---
      // 返回 { ok, reason?, item? }；reason ∈ 'unknown' | 'owned' | 'level' | 'coins'。
      // 食物是消耗品：扣币即成功，不入 owned 库，食物数据随返回值给调用方喂宠物。
      // 装扮/装饰是拥有制：扣币后 owned 置 true。
      buyItem(id) {
        const item = getItem(id);
        if (!item) return { ok: false, reason: 'unknown' };
        const state = get();
        if (item.type !== 'food' && state.owned?.[id]) return { ok: false, reason: 'owned' };
        if (item.unlockLevel && (state.pet?.level ?? 1) < item.unlockLevel) {
          return { ok: false, reason: 'level' };
        }
        if (!get().spendCoins(item.price)) return { ok: false, reason: 'coins' };
        if (item.type !== 'food') {
          set((s) => ({ owned: { ...(s.owned ?? {}), [id]: true } }));
        }
        return { ok: true, item };
      },

      // --- 装扮：穿戴/卸下（阶段 4 渲染穿戴效果）---
      toggleEquip(id) {
        set((state) => {
          const eq = state.equipped ?? [];
          return {
            equipped: eq.includes(id) ? eq.filter((x) => x !== id) : [...eq, id],
          };
        });
      },

      // --- 每日任务（阶段 3）：kind ∈ 'learn' | 'game' | 'story' ---
      // 按自然日重置（day 不是今天则清零重来）。目标见 DAILY_GOALS。
      // 达成瞬间自动发奖（单项 15 币，三项全完成额外 30 币），rewarded 标记防重复发。
      // 返回 { completed: [...], coins: n }：本次新完成的任务与本次发放的金币，供 UI 弹通知。
      trackDaily(kind) {
        const today = startOfToday();
        const prev = get().daily;
        // 旧数据没有 daily、或跨天了：从空任务重新开始。
        const daily =
          !prev || prev.day !== today
            ? { ...emptyDaily(), day: today }
            : {
                ...prev,
                learn: prev.learn ?? 0,
                game: prev.game ?? 0,
                story: prev.story ?? 0,
                rewarded: { learn: false, game: false, story: false, all: false, ...(prev.rewarded ?? {}) },
              };
        daily[kind] = (daily[kind] ?? 0) + 1;

        const completed = [];
        let coins = 0;
        for (const k of ['learn', 'game', 'story']) {
          if (!daily.rewarded[k] && daily[k] >= DAILY_GOALS[k]) {
            daily.rewarded[k] = true;
            completed.push(k);
            coins += DAILY_REWARD;
          }
        }
        const allDone = ['learn', 'game', 'story'].every((k) => daily[k] >= DAILY_GOALS[k]);
        if (allDone && !daily.rewarded.all) {
          daily.rewarded.all = true;
          completed.push('all');
          coins += DAILY_ALL_REWARD;
        }

        set((state) => ({ daily, coins: state.coins + coins }));
        return { completed, coins };
      },

      // --- 每日惊喜（阶段 5）：领取海岛礼物盒 ---
      // 返回 0 表示今天已领过（giftDay 为 undefined 的旧数据按未领处理）；
      // 否则返回本次发放的金币数（GIFT_COIN_MIN~MAX 随机），并记入金币。
      claimGift() {
        const today = startOfToday();
        if ((get().giftDay ?? 0) === today) return 0;
        const amount =
          GIFT_COIN_MIN + Math.floor(Math.random() * (GIFT_COIN_MAX - GIFT_COIN_MIN + 1));
        set((state) => ({ giftDay: today, coins: state.coins + amount }));
        return amount;
      },

      // --- 宠物：喂食（消耗金币在调用处扣，这里涨经验/心情/饱食度）---
      // 签名：feedPet(expGain, moodGain = 0, satietyGain = 25)。旧调用 feedPet(exp) 兼容。
      // 先 normalize（补旧字段 + 结算衰减），再叠加本次增量。
      feedPet(expGain = 20, moodGain = 0, satietyGain = FEED_SATIETY_GAIN) {
        set((state) => {
          const now = Date.now();
          const today = startOfToday();
          const p = normalizePet(state.pet, now);
          const fed = p.fedDay === today ? p.fed : 0;
          let exp = p.exp + expGain;
          let level = p.level;
          // 每 100 经验升一级。
          while (exp >= 100) {
            exp -= 100;
            level += 1;
          }
          return {
            pet: {
              ...p,
              exp,
              level,
              fed: fed + 1,
              fedDay: today,
              satiety: Math.min(100, p.satiety + satietyGain),
              satietyAt: now, // 喂食即结算一次衰减，时间基线推到当前
              mood: Math.min(100, p.mood + moodGain),
            },
          };
        });
      },

      // --- 宠物：抚摸（阶段 4）。心情 +10，每日上限 5 次（按自然日计数防刷）。
      // 返回 { ok, mood }：ok=false 表示已达今日上限，mood 为当前心情值（未变）。
      petPet() {
        const now = Date.now();
        const today = startOfToday();
        const p = normalizePet(get().pet, now);
        const count = p.pettedDay === today ? p.pettedCount : 0;
        if (count >= PET_DAILY_LIMIT) return { ok: false, mood: p.mood };
        const mood = Math.min(100, p.mood + PET_MOOD_GAIN);
        set(() => ({
          pet: {
            ...p,
            mood,
            pettedDay: today,
            pettedCount: count + 1,
            satietyAt: p.satietyAt || now, // 旧数据借此建立衰减时间基线
          },
        }));
        return { ok: true, mood };
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
          pet: { ...PET_DEFAULTS },
          streak: { count: 0, lastDay: 0 },
          owned: {},
          equipped: [],
          daily: emptyDaily(),
          giftDay: 0,
        });
      },
    }),
    {
      name: 'jarvis-child-game',
      version: 1,
    }
  )
);
