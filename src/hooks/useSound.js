// 音效系统：用 Web Audio API 实时合成提示音，零素材、零版权、零网络。
//
// 为什么不用 mp3 音效文件：
//   避免引入外部音效素材（版权/体积/加载），几个简单提示音用振荡器合成即可。
// 音色走「明亮、圆润、友好」路线，适合儿童：正确=上行叮咚，错误=柔和低音（不吓人），
// 开宝箱=琶音上行，升级=欢快三连音。
//
// 用法：const sound = useSound(); sound.play('correct')
// 首次交互后才允许播放（浏览器自动播放策略），本 hook 在第一次 play 时惰性创建 AudioContext。

import { useCallback, useEffect, useRef } from 'react';

// 每种音效的合成配方：一串音符 { f: 频率, t: 开始时间(s), d: 时长(s), type, gain }
const RECIPES = {
  // 点击：短促、清脆的一声。
  tap: [{ f: 660, t: 0, d: 0.08, type: 'sine', gain: 0.18 }],
  // 正确：上行叮咚，愉悦。
  correct: [
    { f: 784, t: 0, d: 0.12, type: 'sine', gain: 0.22 }, // G5
    { f: 1047, t: 0.1, d: 0.18, type: 'sine', gain: 0.22 }, // C6
  ],
  // 错误：柔和的两声低音，提示但不吓人（避免刺耳蜂鸣）。
  wrong: [
    { f: 320, t: 0, d: 0.14, type: 'triangle', gain: 0.16 },
    { f: 247, t: 0.12, d: 0.18, type: 'triangle', gain: 0.16 },
  ],
  // 翻页/切换：轻快一声。
  swoosh: [{ f: 520, t: 0, d: 0.1, type: 'sine', gain: 0.14 }],
  // 得星：三连上行，闪亮。
  star: [
    { f: 880, t: 0, d: 0.1, type: 'sine', gain: 0.2 },
    { f: 1109, t: 0.09, d: 0.1, type: 'sine', gain: 0.2 },
    { f: 1319, t: 0.18, d: 0.16, type: 'sine', gain: 0.2 },
  ],
  // 金币：清脆双击。
  coin: [
    { f: 988, t: 0, d: 0.06, type: 'square', gain: 0.12 },
    { f: 1319, t: 0.06, d: 0.1, type: 'square', gain: 0.12 },
  ],
  // 开宝箱：琶音上行，惊喜感。
  chest: [
    { f: 523, t: 0, d: 0.1, type: 'sine', gain: 0.2 },
    { f: 659, t: 0.1, d: 0.1, type: 'sine', gain: 0.2 },
    { f: 784, t: 0.2, d: 0.1, type: 'sine', gain: 0.2 },
    { f: 1047, t: 0.3, d: 0.22, type: 'sine', gain: 0.22 },
  ],
  // 升级：欢快三连音 + 尾音。
  levelup: [
    { f: 659, t: 0, d: 0.12, type: 'sine', gain: 0.2 },
    { f: 784, t: 0.12, d: 0.12, type: 'sine', gain: 0.2 },
    { f: 1047, t: 0.24, d: 0.28, type: 'sine', gain: 0.24 },
  ],
};

let sharedCtx = null; // 全局共享一个 AudioContext，避免重复创建。

function getCtx() {
  if (typeof window === 'undefined') return null;
  if (!sharedCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    sharedCtx = new AC();
  }
  return sharedCtx;
}

// ---- 音效主音量 ----
// 做成模块级共享（不放进每个组件的 ref）：家长中心一调，全站后续音效立即生效，
// 避免多个 useSound 实例各持一份、互不同步。乘到每个音符的 gain 上。
const SOUND_VOLUME_KEY = 'jarvis-child-sound-volume';
const DEFAULT_SOUND_VOLUME = 0.85; // 音效短促，默认给较高音量
let masterVolume = null; // 惰性读，读到后缓存

function readSoundVolume() {
  if (masterVolume != null) return masterVolume;
  try {
    const raw = localStorage.getItem(SOUND_VOLUME_KEY);
    // 与 useBgm 同一个坑：key 不存在时 getItem 返回 null，Number(null)===0 会通过
    // 0<=v<=1 校验、把音量当成 0（静音）。因此 null/空串必须先落回默认值。
    if (raw == null || raw === '') {
      masterVolume = DEFAULT_SOUND_VOLUME;
    } else {
      const v = Number(raw);
      masterVolume = Number.isFinite(v) && v >= 0 && v <= 1 ? v : DEFAULT_SOUND_VOLUME;
    }
  } catch {
    masterVolume = DEFAULT_SOUND_VOLUME;
  }
  return masterVolume;
}

export function getSoundVolume() {
  return readSoundVolume();
}

export function setSoundVolume(v) {
  const vol = Math.max(0, Math.min(1, v));
  masterVolume = vol;
  try {
    localStorage.setItem(SOUND_VOLUME_KEY, String(vol));
  } catch {
    // 忽略（隐私模式）
  }
}

export function useSound() {
  const enabledRef = useRef(true);

  // 允许静音（家长中心可控），存 localStorage。
  useEffect(() => {
    try {
      const raw = localStorage.getItem('jarvis-child-sound');
      if (raw === 'off') enabledRef.current = false;
    } catch {
      // 忽略
    }
  }, []);

  const play = useCallback((name) => {
    if (!enabledRef.current) return;
    const recipe = RECIPES[name];
    if (!recipe) return;
    const ctx = getCtx();
    if (!ctx) return;
    // 浏览器可能挂起 AudioContext，交互时恢复。
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    const master = readSoundVolume();
    if (master <= 0) return; // 音量为 0 等同静音，省去建节点
    const now = ctx.currentTime;
    for (const note of recipe) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = note.type ?? 'sine';
      osc.frequency.value = note.f;
      // 用 gain 包络做出轻微的淡入淡出，避免爆音。峰值 gain 乘以主音量。
      const start = now + note.t;
      const end = start + note.d;
      const peak = (note.gain ?? 0.2) * master;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(peak, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(end + 0.02);
    }
  }, []);

  const setEnabled = useCallback((on) => {
    enabledRef.current = on;
    try {
      localStorage.setItem('jarvis-child-sound', on ? 'on' : 'off');
    } catch {
      // 忽略
    }
  }, []);

  // 便捷别名：sound.tap() 等价于 sound.play('tap')。error 映射到 wrong。
  const shortcuts = {
    tap: () => play('tap'),
    correct: () => play('correct'),
    wrong: () => play('wrong'),
    error: () => play('wrong'),
    swoosh: () => play('swoosh'),
    star: () => play('star'),
    coin: () => play('coin'),
    chest: () => play('chest'),
    levelup: () => play('levelup'),
  };

  return { play, setEnabled, ...shortcuts };
}
