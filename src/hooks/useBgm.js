// 背景音乐（BGM）控制器：跨页面持续循环播放，路由切换不打断。
//
// 设计要点：
//   1. 模块级单例 Audio —— BGM 属于「整个 app」而非某个页面/组件，
//      用单例保证换页时音乐连续，不会每次挂载都重头播。
//   2. 浏览器自动播放限制 —— 现代浏览器禁止未经用户交互就播声音。
//      因此监听首次交互（点一下/触屏）后才真正 play()。
//   3. 开关与音量存 localStorage，家长中心可控；默认开、音量适中。
//   4. 素材未就位也不报错：文件加载失败静默跳过，不影响学习。
//
// 用法：在 App 顶层挂一次 <BgmMount />（见下方），或在根组件调用 useBgmController()。
// 素材放 public/bgm/bgm-home.mp3，替换 BGM_SRC 即可。

import { useEffect } from 'react';

const BGM_ENABLED_KEY = 'jarvis-child-bgm';
const BGM_VOLUME_KEY = 'jarvis-child-bgm-volume';
// 素材就位后把文件放到 public/bgm/ 下并确认此路径。空字符串表示暂未接入。
const BGM_SRC = `${import.meta.env.BASE_URL}bgm/bgm-home.mp3`;

let audioEl = null; // 单例 Audio
let started = false; // 是否已成功开始播放（避免重复 play）
let interactionBound = false;

function readEnabled() {
  try {
    return localStorage.getItem(BGM_ENABLED_KEY) !== 'off'; // 默认开
  } catch {
    return true;
  }
}

function readVolume() {
  try {
    const v = Number(localStorage.getItem(BGM_VOLUME_KEY));
    return Number.isFinite(v) && v >= 0 && v <= 1 ? v : 0.35; // 默认音量适中，不盖过语音
  } catch {
    return 0.35;
  }
}

function ensureAudio() {
  if (audioEl || typeof window === 'undefined') return audioEl;
  const el = new Audio(BGM_SRC);
  el.loop = true;
  el.volume = readVolume();
  el.preload = 'auto';
  // 加载失败（素材未就位）静默处理。
  el.addEventListener('error', () => {
    // 不抛错、不打断，控制台留一条便于调试。
    console.info('[bgm] 背景音乐素材未就位或加载失败，已跳过。');
  });
  audioEl = el;
  return el;
}

function tryPlay() {
  if (!readEnabled()) return;
  const el = ensureAudio();
  if (!el) return;
  const p = el.play();
  if (p && typeof p.catch === 'function') {
    p.then(() => {
      started = true;
    }).catch(() => {
      // 仍被自动播放策略拦截：等下一次交互再试（监听已绑定）。
    });
  }
}

// 首次用户交互后启动 BGM（满足浏览器自动播放策略）。
function bindFirstInteraction() {
  if (interactionBound || typeof window === 'undefined') return;
  interactionBound = true;
  const onInteract = () => {
    tryPlay();
    if (started) {
      window.removeEventListener('pointerdown', onInteract);
      window.removeEventListener('keydown', onInteract);
    }
  };
  window.addEventListener('pointerdown', onInteract);
  window.addEventListener('keydown', onInteract);
}

// ---- 对外控制 API（家长中心用）----
export function isBgmEnabled() {
  return readEnabled();
}

export function setBgmEnabled(on) {
  try {
    localStorage.setItem(BGM_ENABLED_KEY, on ? 'on' : 'off');
  } catch {
    // 忽略
  }
  if (on) {
    tryPlay();
  } else if (audioEl) {
    audioEl.pause();
    started = false;
  }
}

export function getBgmVolume() {
  return readVolume();
}

export function setBgmVolume(v) {
  const vol = Math.max(0, Math.min(1, v));
  try {
    localStorage.setItem(BGM_VOLUME_KEY, String(vol));
  } catch {
    // 忽略
  }
  if (audioEl) audioEl.volume = vol;
}

// 在根组件调用一次：绑定首次交互、按需启动。
export function useBgmController() {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    // 页面切到后台时暂停，回前台恢复，省电又不突兀。
    const onVisibility = () => {
      if (!audioEl) return;
      if (document.hidden) {
        audioEl.pause();
      } else if (readEnabled() && started) {
        audioEl.play().catch(() => {});
      }
    };
    bindFirstInteraction();
    // 首帧也尝试一次（多数情况会被拦，靠交互兜底）。
    tryPlay();
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);
}
