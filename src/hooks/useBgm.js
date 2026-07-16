// 背景音乐（BGM）控制器：循环播放一首柔和欢快的儿歌，跨页面持续，路由切换不打断。
//
// 曲目：Kevin MacLeod《Carefree》(incompetech.com)，CC-BY 4.0 授权。
//   —— 署名义务见家长中心底部的「音乐来源」标注，请勿移除。
//   放在 public/audio/ 下，Vite 构建时原样拷进 dist/，纯静态部署即可访问。
//
// 为什么用真实 mp3 而非合成：
//   长旋律的背景音乐靠振荡器合成音色单薄、不够欢快（实测被否）。
//   真实编曲的儿歌才有陪伴感。短促 UI 提示音仍用 useSound 合成（零延迟）。
//
// 设计要点（沿用换曲前的成熟逻辑，勿回退）：
//   1. 模块级单例 —— BGM 属于「整个 app」，单例 <Audio> 保证换页连续。
//   2. 自动播放限制 —— 现代浏览器禁止未经交互就出声，监听首次交互后才启动。
//   3. 开关/音量存 localStorage，家长中心可控；默认开、音量适中（不盖过朗读）。
//   4. 切后台自动暂停，回前台恢复。
//
// 用法：根组件调用一次 useBgmController()。对外控制见文件底部导出。

import { useEffect } from 'react';

const BGM_ENABLED_KEY = 'jarvis-child-bgm';
const BGM_VOLUME_KEY = 'jarvis-child-bgm-volume';

// mp3 路径：用 BASE_URL 前缀，兼容子路径部署（与 useSpeech 一致）。
const BGM_SRC = `${import.meta.env.BASE_URL}audio/bgm-carefree.mp3`;
const DEFAULT_VOLUME = 0.28; // 默认低音量，不盖过朗读语音

let audio = null; // 单例 <Audio> 元素
let started = false; // 是否已成功开始播放
let interactionBound = false;

function readEnabled() {
  try {
    return localStorage.getItem(BGM_ENABLED_KEY) !== 'off';
  } catch {
    return true;
  }
}

function readVolume() {
  try {
    const raw = localStorage.getItem(BGM_VOLUME_KEY);
    // 关键：未设置时 getItem 返回 null，而 Number(null) === 0 会通过下面的
    // 0<=v<=1 校验、把音量当成 0（静音）。这正是无痕模式（localStorage 恒为空）
    // 下「在播却没声」的元凶。因此 null/空串必须先落回默认音量，不能进 Number()。
    if (raw == null || raw === '') return DEFAULT_VOLUME;
    const v = Number(raw);
    return Number.isFinite(v) && v >= 0 && v <= 1 ? v : DEFAULT_VOLUME;
  } catch {
    return DEFAULT_VOLUME;
  }
}

// 惰性创建单例 <Audio>：循环、预加载、初始音量。
function getAudio() {
  if (audio || typeof window === 'undefined') return audio;
  audio = new Audio(BGM_SRC);
  audio.loop = true;
  audio.preload = 'auto';
  audio.volume = readVolume();
  return audio;
}

// 尝试播放。fromGesture: 是否由真实用户手势触发（手势里 play() 才不会被策略拒绝）。
function startPlayback(fromGesture = false) {
  if (!readEnabled()) return;
  // 非手势且尚未创建：不创建，等首次手势，避免被自动播放策略拒绝后留下暂停态。
  if (!fromGesture && !audio) return;
  const a = getAudio();
  if (!a) return;
  const p = a.play();
  if (p && typeof p.then === 'function') {
    p.then(() => {
      started = true;
    }).catch(() => {
      // 被自动播放策略拒绝：保持未启动，等下一次真实手势重试。
      started = false;
    });
  } else {
    started = true;
  }
}

function stopPlayback() {
  if (audio) audio.pause();
  started = false;
}

// 首次交互后启动（满足自动播放策略）。
// 关键：只有确认「真的在播」（!paused）才解绑监听，否则保留、下次交互继续重试——
// 这与换曲前的解锁逻辑一致，避免首次 play() 未生效就再没第二次机会。
function bindFirstInteraction() {
  if (interactionBound || typeof window === 'undefined') return;
  interactionBound = true;
  const onInteract = () => {
    startPlayback(true);
    if (audio && !audio.paused) {
      window.removeEventListener('pointerdown', onInteract, true);
      window.removeEventListener('touchend', onInteract, true);
      window.removeEventListener('keydown', onInteract, true);
    }
  };
  // 捕获阶段（true）：即使子元素 stopPropagation（浮层遮罩）也拦不住，任何点击都能解锁。
  window.addEventListener('pointerdown', onInteract, true);
  window.addEventListener('touchend', onInteract, true);
  window.addEventListener('keydown', onInteract, true);
}

// ---- 对外控制 API ----
// 开场门在用户手势里显式启动 BGM（比隐形监听器可靠，尤其 StrictMode 下）。
// 内部自查开关：家长关了音乐则不放，但调用本身已解锁 AudioContext/音效。
export function startBgm() {
  startPlayback(true);
}

export function isBgmEnabled() {
  return readEnabled();
}

export function setBgmEnabled(on) {
  try {
    localStorage.setItem(BGM_ENABLED_KEY, on ? 'on' : 'off');
  } catch {
    // 忽略
  }
  if (on) startPlayback(true); // 家长中心手动开启也是用户手势
  else stopPlayback();
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
  if (audio) audio.volume = vol;
}

// 根组件调用一次：绑定首次交互、切后台暂停/恢复。
export function useBgmController() {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onVisibility = () => {
      if (document.hidden) {
        if (audio && !audio.paused) audio.pause();
      } else if (readEnabled() && started && audio) {
        audio.play().catch(() => {});
      }
    };
    // 只绑定首次交互，不在挂载时预播：满足浏览器自动播放策略。
    bindFirstInteraction();
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);
}
