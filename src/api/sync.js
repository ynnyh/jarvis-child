// 同步层：把本地 zustand store 的进度与后端对账。
// 策略「本地优先」：离线照常玩，登录后把本地状态上传，服务端合并后回传权威值写回本地。
//
// 触发时机：登录后、进入家长中心、以及学习/复习产生变更后的防抖同步（由调用方触发 syncNow）。
// 未登录或网络失败时静默跳过，绝不阻塞学习。

import { useGameStore } from '../store/useGameStore.js';
import { api, isLoggedIn } from './client.js';

const ACTIVE_PROFILE_KEY = 'jarvis-child-active-profile';

export function getActiveProfileId() {
  try {
    const v = localStorage.getItem(ACTIVE_PROFILE_KEY);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

export function setActiveProfileId(id) {
  try {
    if (id != null) localStorage.setItem(ACTIVE_PROFILE_KEY, String(id));
    else localStorage.removeItem(ACTIVE_PROFILE_KEY);
  } catch {
    // 忽略
  }
}

// store 状态 -> 后端 SyncIn 载荷。
function buildPayload(profileId) {
  const s = useGameStore.getState();
  const chars = Object.entries(s.chars).map(([char, v]) => ({
    char,
    stars: v.stars ?? 0,
    box: v.box ?? 0,
    due: v.due ?? 0,
    learned_at: v.learnedAt ?? null,
    reviewed_at: v.reviewedAt ?? null,
  }));
  const lessons = Object.entries(s.lessons).map(([lesson_id, v]) => ({
    lesson_id,
    stars: v.stars ?? 0,
    completed_at: v.completedAt ?? null,
  }));
  return {
    profile_id: profileId,
    chars,
    lessons,
    economy: {
      coins: s.coins ?? 0,
      pet_exp: s.pet?.exp ?? 0,
      pet_level: s.pet?.level ?? 1,
      streak_count: s.streak?.count ?? 0,
      streak_last_day: s.streak?.lastDay ?? 0,
    },
    client_time: Date.now(),
  };
}

// 每字进度的「新旧」度量：取复习/学习时间的较大者，和后端合并策略一致。
function charTime(v) {
  return Math.max(v?.reviewedAt ?? 0, v?.learnedAt ?? 0);
}

// 合并服务端状态与本地状态，产出新的 store 切片（纯函数，便于单测）。
// 关键：不整体覆盖。同步的网络往返期间孩子可能又学了字/赚了币，这些只在本地、
// 不在已上传的 payload 里；若直接用服务端结果整体替换会把它们清掉（本地优先原则被破坏）。
// 因此逐 key 合并：服务端为基准，本地更新（时间戳更新或本地独有）则保留。
export function mergeServerState(prev, out) {
  // ---- chars：服务端为基准，叠加本地更新的/独有的字 ----
  const chars = {};
  for (const c of out.chars ?? []) {
    chars[c.char] = {
      stars: c.stars,
      box: c.box,
      due: c.due,
      learnedAt: c.learned_at ?? undefined,
      reviewedAt: c.reviewed_at ?? undefined,
    };
  }
  for (const [char, local] of Object.entries(prev.chars)) {
    const server = chars[char];
    // 本地独有（await 期间新学），或本地时间戳更新 -> 保留本地，星级取两者较高。
    if (!server || charTime(local) > charTime(server)) {
      chars[char] = {
        ...local,
        stars: Math.max(local.stars ?? 0, server?.stars ?? 0),
      };
    } else {
      // 服务端更新，但星级仍取历史最高（鼓励不掉星）。
      chars[char] = { ...server, stars: Math.max(server.stars, local.stars ?? 0) };
    }
  }

  // ---- lessons：星级取较高，完成时间取较新；保留本地独有 ----
  const lessons = {};
  for (const l of out.lessons ?? []) {
    lessons[l.lesson_id] = {
      stars: l.stars,
      completedAt: l.completed_at ?? undefined,
    };
  }
  for (const [id, local] of Object.entries(prev.lessons)) {
    const server = lessons[id];
    lessons[id] = {
      stars: Math.max(local.stars ?? 0, server?.stars ?? 0),
      completedAt: local.completedAt ?? server?.completedAt,
    };
  }

  // ---- economy：与后端一致，取较优值，绝不回退 ----
  const eco = out.economy ?? {};
  // 宠物按 (等级, 经验) 元组整体比较，取较高的一整份，避免拼出不一致状态
  // （如本地 lv2/exp10 与服务端 lv1/exp90 混成 lv2/exp90）。
  const localLevel = prev.pet.level ?? 1;
  const localExp = prev.pet.exp ?? 0;
  const serverLevel = eco.pet_level ?? 1;
  const serverExp = eco.pet_exp ?? 0;
  // 数值比较（先比等级、再比经验），不要用数组的字符串比较——两位数等级会比错。
  const serverPetBetter =
    serverLevel > localLevel ||
    (serverLevel === localLevel && serverExp > localExp);
  const petLevel = serverPetBetter ? serverLevel : localLevel;
  const petExp = serverPetBetter ? serverExp : localExp;
  // 打卡取较新的一天，连续天数随之取那一天对应的值。
  const localDay = prev.streak.lastDay ?? 0;
  const serverDay = eco.streak_last_day ?? 0;
  const streak =
    serverDay > localDay
      ? { count: eco.streak_count ?? 0, lastDay: serverDay }
      : { count: prev.streak.count ?? 0, lastDay: localDay };
  return {
    chars,
    lessons,
    coins: Math.max(prev.coins ?? 0, eco.coins ?? 0),
    pet: { ...prev.pet, level: petLevel, exp: petExp },
    streak: { ...prev.streak, ...streak },
  };
}

// 后端 SyncOut -> 写回 store（用上面的纯合并函数）。
function applyServerState(out) {
  useGameStore.setState((prev) => mergeServerState(prev, out));
}

let syncing = false;
let pending = false;

// 立即同步一次（带简单去重：同步进行中则标记 pending，结束后补一次）。
export async function syncNow() {
  if (!isLoggedIn()) return { ok: false, reason: 'not-logged-in' };
  const profileId = getActiveProfileId();
  if (profileId == null) return { ok: false, reason: 'no-profile' };
  if (syncing) {
    pending = true;
    return { ok: false, reason: 'busy' };
  }
  syncing = true;
  try {
    const out = await api.sync(buildPayload(profileId));
    applyServerState(out);
    return { ok: true };
  } catch (err) {
    // 网络/鉴权失败：静默降级，纯本地继续。
    return { ok: false, reason: err.message };
  } finally {
    syncing = false;
    if (pending) {
      pending = false;
      // 补一次，捕获同步期间新增的变更。
      setTimeout(syncNow, 300);
    }
  }
}

// 防抖同步：学习/复习频繁产生变更时用，避免每次都打服务器。
let debounceTimer = null;
export function syncSoon(delay = 2500) {
  if (!isLoggedIn() || getActiveProfileId() == null) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(syncNow, delay);
}
