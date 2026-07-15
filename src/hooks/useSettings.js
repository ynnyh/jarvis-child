// 个性化设置：护眼模式 + 使用时长限制。
// 与 useBgm / useSound 一致，用 localStorage 存储，家长中心可控，模块级 helper + hook 订阅。
//
// 护眼模式：全局暖色滤镜叠层（降低蓝光观感），纯 CSS，开/关。
// 使用时长：家长设每日上限（分钟，0=不限）。应用打开时累计今日使用秒数，
//   超过上限弹「休息一下」锁定层；跨天自动清零。累计只在页面可见时进行。
import { useEffect, useRef, useState } from 'react';

const EYECARE_KEY = 'jarvis-child-eyecare'; // 'on' | 'off'（默认 off）
const TIMECAP_KEY = 'jarvis-child-timecap'; // 每日上限分钟数，'0' 表示不限
const USAGE_KEY = 'jarvis-child-usage'; // { day: <今日0点ms>, seconds: N }

// 今天 0 点（本地）时间戳。
function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// ---- 护眼模式 ----
export function isEyecareOn() {
  try {
    return localStorage.getItem(EYECARE_KEY) === 'on';
  } catch {
    return false;
  }
}
export function setEyecare(on) {
  try {
    localStorage.setItem(EYECARE_KEY, on ? 'on' : 'off');
  } catch {
    // 忽略
  }
  notify();
}

// ---- 使用时长上限 ----
export function getTimeCap() {
  try {
    const n = Number(localStorage.getItem(TIMECAP_KEY));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}
export function setTimeCap(minutes) {
  try {
    localStorage.setItem(TIMECAP_KEY, String(Math.max(0, minutes | 0)));
  } catch {
    // 忽略
  }
  notify();
}

// 读取今日已用秒数（跨天自动归零）。
export function readUsage() {
  try {
    const raw = JSON.parse(localStorage.getItem(USAGE_KEY) || '{}');
    if (raw.day === startOfToday()) return raw.seconds || 0;
  } catch {
    // 忽略
  }
  return 0;
}
function writeUsage(seconds) {
  try {
    localStorage.setItem(
      USAGE_KEY,
      JSON.stringify({ day: startOfToday(), seconds })
    );
  } catch {
    // 忽略
  }
}
// 家长「重置今日用时」用。
export function resetUsageToday() {
  writeUsage(0);
  notify();
}

// ---- 变更广播：让多个订阅组件同步刷新 ----
const listeners = new Set();
function notify() {
  listeners.forEach((fn) => fn());
}

// 组件订阅设置变化（护眼开关 / 时长上限）。
export function useSettings() {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);
  return {
    eyecare: isEyecareOn(),
    setEyecare,
    timeCap: getTimeCap(),
    setTimeCap,
    usageSeconds: readUsage(),
    resetUsageToday,
  };
}

// 使用时长守卫：应用打开、页面可见时每秒累计今日用时；
// 返回 { locked, usedMin, capMin }，供顶层渲染锁定层。
export function useTimeGuard() {
  const [used, setUsed] = useState(() => readUsage());
  const [, force] = useState(0);
  const lastTickRef = useRef(Date.now());

  // 订阅设置变化（家长改上限 / 重置用时后立即反映）。
  useEffect(() => {
    const fn = () => {
      setUsed(readUsage());
      force((n) => n + 1);
    };
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);

  useEffect(() => {
    // 每秒累计一次；仅在页面可见时计入（切后台不计）。
    lastTickRef.current = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.round((now - lastTickRef.current) / 1000);
      lastTickRef.current = now;
      if (document.visibilityState !== 'visible') return;
      if (elapsed <= 0) return;
      const next = readUsage() + elapsed;
      writeUsage(next);
      setUsed(next);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const capMin = getTimeCap();
  const usedMin = Math.floor(used / 60);
  const locked = capMin > 0 && used >= capMin * 60;
  return { locked, usedMin, capMin, used };
}
