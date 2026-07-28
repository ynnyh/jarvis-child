// 音效系统：播放预渲染的「暖音色」真实音频文件（马林巴/音乐盒/卡林巴/软铃铛/水泡等），
// 由 scripts/gen-warm-sfx.py 用 numpy 加法合成生成，落地在 public/audio/sfx/*.wav。
//
// 为什么从「实时振荡器合成」换成真实文件：
//   裸振荡器音色单薄、发「电子哔」，与暖色 3D 软萌画风不契合（实测被否）。
//   预渲染的暖音色有木质泛音、敲击瞬态与尾部混响，温润适合儿童。
//   WAV 44.1k/16bit 是浏览器/iPad 原生格式，免转码、离线可用。
//
// 设计要点：
//   1. Web Audio 加载 → decodeAudioData 缓存 AudioBuffer → createBufferSource 播放（零延迟复用）。
//   2. 多候选音效（tap/heartbreak/splash）随机轮换，避免重复听腻。
//   3. 保留旧的振荡器合成配方作为「兜底」：文件尚未加载完/加载失败时不至于静音。
//   4. 对外接口与音量/静音开关完全不变——全站调用点（sound.play('correct')、sound.correct()、
//      sound.combo(n)）零改动即自动切到暖音色。
//
// 音效清单（play('名字') 或同名快捷别名）：
//   tap 点击 / correct 正确 / wrong 错误(别名 error) / swoosh 翻页 / star 得星 /
//   coin 金币 / chest 开宝箱 / levelup 升级 / pop 气泡 / whack 敲击 /
//   heartbreak 惋惜 / victory 胜利 / fail 失败 / tick 滴答 / splash 入水 /
//   pluck 摘取/弹拨 / combo 连击(combo(n) 按连击数升调) / achievement 成就/每日奖励
//
// play 支持第二参数 opts：{ pitch } 为整体变调倍率（默认 1）。真实文件用 playbackRate 近似变调。

import { useCallback, useEffect, useRef } from 'react';

// ---- 真实音频文件映射 ----
// 名字 -> 文件候选数组（多个则随机轮换）。路径带 BASE_URL 前缀，兼容子路径部署。
const SFX_DIR = `${import.meta.env.BASE_URL}audio/sfx/`;
const FILES = {
  tap: ['tap_1.wav', 'tap_2.wav'],
  correct: ['correct.wav'],
  wrong: ['wrong.wav'],
  swoosh: ['swoosh.wav'],
  star: ['star.wav'],
  coin: ['coin.wav'],
  chest: ['chest.wav'],
  levelup: ['levelup.wav'],
  pop: ['pop.wav'],
  whack: ['whack.wav'],
  heartbreak: ['heartbreak_1.wav', 'heartbreak_2.wav'],
  victory: ['victory.wav'],
  fail: ['fail.wav'],
  tick: ['tick.wav'],
  splash: ['splash_1.wav', 'splash_2.wav'],
  pluck: ['pluck.wav'],
  combo: ['combo.wav'],
  achievement: ['achievement.wav'],
};

// ---- 兜底合成配方 ----
// 真实文件尚未 decode 完成或加载失败时用它顶上，保证不静音。
// 一串音符 { f: 频率, t: 开始(s), d: 时长(s), type, gain }，可选 f2 做指数滑音。
const RECIPES = {
  tap: [{ f: 660, t: 0, d: 0.08, type: 'sine', gain: 0.18 }],
  correct: [
    { f: 784, t: 0, d: 0.12, type: 'sine', gain: 0.22 },
    { f: 1047, t: 0.1, d: 0.18, type: 'sine', gain: 0.22 },
  ],
  wrong: [
    { f: 320, t: 0, d: 0.14, type: 'triangle', gain: 0.16 },
    { f: 247, t: 0.12, d: 0.18, type: 'triangle', gain: 0.16 },
  ],
  swoosh: [{ f: 520, t: 0, d: 0.1, type: 'sine', gain: 0.14 }],
  star: [
    { f: 880, t: 0, d: 0.1, type: 'sine', gain: 0.2 },
    { f: 1109, t: 0.09, d: 0.1, type: 'sine', gain: 0.2 },
    { f: 1319, t: 0.18, d: 0.16, type: 'sine', gain: 0.2 },
  ],
  coin: [
    { f: 988, t: 0, d: 0.06, type: 'square', gain: 0.12 },
    { f: 1319, t: 0.06, d: 0.1, type: 'square', gain: 0.12 },
  ],
  chest: [
    { f: 523, t: 0, d: 0.1, type: 'sine', gain: 0.2 },
    { f: 659, t: 0.1, d: 0.1, type: 'sine', gain: 0.2 },
    { f: 784, t: 0.2, d: 0.1, type: 'sine', gain: 0.2 },
    { f: 1047, t: 0.3, d: 0.22, type: 'sine', gain: 0.22 },
  ],
  levelup: [
    { f: 659, t: 0, d: 0.12, type: 'sine', gain: 0.2 },
    { f: 784, t: 0.12, d: 0.12, type: 'sine', gain: 0.2 },
    { f: 1047, t: 0.24, d: 0.28, type: 'sine', gain: 0.24 },
  ],
  pop: [{ f: 880, f2: 220, t: 0, d: 0.09, type: 'sine', gain: 0.2 }],
  whack: [
    { f: 160, f2: 90, t: 0, d: 0.1, type: 'square', gain: 0.14 },
    { f: 1400, f2: 700, t: 0, d: 0.03, type: 'square', gain: 0.06 },
  ],
  heartbreak: [
    { f: 392, t: 0, d: 0.16, type: 'sine', gain: 0.14 },
    { f: 330, t: 0.16, d: 0.24, type: 'sine', gain: 0.12 },
  ],
  victory: [
    { f: 523, t: 0, d: 0.1, type: 'sine', gain: 0.2 },
    { f: 659, t: 0.1, d: 0.1, type: 'sine', gain: 0.2 },
    { f: 784, t: 0.2, d: 0.1, type: 'sine', gain: 0.2 },
    { f: 1047, t: 0.3, d: 0.14, type: 'sine', gain: 0.22 },
    { f: 784, t: 0.44, d: 0.1, type: 'sine', gain: 0.18 },
    { f: 1047, t: 0.54, d: 0.3, type: 'sine', gain: 0.24 },
  ],
  fail: [
    { f: 440, t: 0, d: 0.14, type: 'triangle', gain: 0.14 },
    { f: 370, t: 0.14, d: 0.14, type: 'triangle', gain: 0.14 },
    { f: 311, t: 0.28, d: 0.22, type: 'triangle', gain: 0.13 },
  ],
  tick: [{ f: 1200, t: 0, d: 0.03, type: 'square', gain: 0.1 }],
  splash: [{ f: 600, f2: 120, t: 0, d: 0.18, type: 'sine', gain: 0.2 }],
  pluck: [{ f: 1175, t: 0, d: 0.08, type: 'triangle', gain: 0.2 }],
  combo: [
    { f: 660, t: 0, d: 0.07, type: 'sine', gain: 0.2 },
    { f: 880, t: 0.06, d: 0.1, type: 'sine', gain: 0.2 },
  ],
  // achievement 无合成兜底配方，缺文件时回落到 star 的配方（近似闪亮感）。
  achievement: [
    { f: 880, t: 0, d: 0.1, type: 'sine', gain: 0.2 },
    { f: 1109, t: 0.09, d: 0.1, type: 'sine', gain: 0.2 },
    { f: 1319, t: 0.18, d: 0.16, type: 'sine', gain: 0.2 },
  ],
};

let sharedCtx = null; // 全局共享一个 AudioContext
// 文件路径 -> AudioBuffer | 'loading' | 'error'。模块级缓存，跨组件复用。
const buffers = new Map();
let preloaded = false;

function getCtx() {
  if (typeof window === 'undefined') return null;
  if (!sharedCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    sharedCtx = new AC();
  }
  return sharedCtx;
}

// 异步加载并 decode 一个文件到 buffers 缓存。
function loadFile(file) {
  const ctx = getCtx();
  if (!ctx) return;
  if (buffers.has(file)) return; // 已加载/加载中
  buffers.set(file, 'loading');
  fetch(SFX_DIR + file)
    .then((res) => {
      if (!res.ok) throw new Error(`缺少音效文件: ${file}`);
      return res.arrayBuffer();
    })
    .then((data) => ctx.decodeAudioData(data))
    .then((buf) => buffers.set(file, buf))
    .catch(() => buffers.set(file, 'error'));
}

// 预加载所有音效（首次拿到 AudioContext 后调用一次）。
function preloadAll() {
  if (preloaded) return;
  if (!getCtx()) return;
  preloaded = true;
  for (const variants of Object.values(FILES)) {
    for (const file of variants) loadFile(file);
  }
}

// ---- 音效主音量 ----
// 模块级共享：家长中心一调全站生效。乘到播放增益上。
const SOUND_VOLUME_KEY = 'jarvis-child-sound-volume';
const DEFAULT_SOUND_VOLUME = 0.85;
let masterVolume = null;

function readSoundVolume() {
  if (masterVolume != null) return masterVolume;
  try {
    const raw = localStorage.getItem(SOUND_VOLUME_KEY);
    // key 不存在时 getItem 返回 null，Number(null)===0 会误判为静音，故先落回默认。
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

// 用振荡器合成兜底播放（真实文件缺失时）。沿用旧配方。
function playSynth(name, master, pitch) {
  const recipe = RECIPES[name];
  const ctx = getCtx();
  if (!recipe || !ctx) return;
  const now = ctx.currentTime;
  for (const note of recipe) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = note.type ?? 'sine';
    const start = now + note.t;
    const end = start + note.d;
    osc.frequency.setValueAtTime(note.f * pitch, start);
    if (note.f2) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, note.f2 * pitch), end);
    }
    const peak = (note.gain ?? 0.2) * master;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(end + 0.02);
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

  const play = useCallback((name, opts) => {
    if (!enabledRef.current) return;
    const ctx = getCtx();
    if (!ctx) return;
    // 浏览器可能挂起 AudioContext，交互时恢复。
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    // 首次播放触发全量预加载（此时已在用户手势内，AudioContext 可用）。
    preloadAll();

    const master = readSoundVolume();
    if (master <= 0) return; // 音量为 0 等同静音
    const pitch = Number.isFinite(opts?.pitch) && opts.pitch > 0 ? opts.pitch : 1;

    // 选文件：多候选随机轮换。
    const variants = FILES[name];
    if (variants && variants.length) {
      const file = variants[(Math.random() * variants.length) | 0];
      const buf = buffers.get(file);
      if (buf && buf !== 'loading' && buf !== 'error') {
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.playbackRate.value = pitch; // 变调（连击升调用）
        const gain = ctx.createGain();
        gain.gain.value = master;
        src.connect(gain);
        gain.connect(ctx.destination);
        src.start();
        return;
      }
      // 文件还没好：确保在加载，本次用合成兜底。
      loadFile(file);
    }
    // 无文件映射或文件未就绪：合成兜底。
    playSynth(name, master, pitch);
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
    pop: () => play('pop'),
    whack: () => play('whack'),
    heartbreak: () => play('heartbreak'),
    victory: () => play('victory'),
    fail: () => play('fail'),
    tick: () => play('tick'),
    splash: () => play('splash'),
    pluck: () => play('pluck'),
    achievement: () => play('achievement'),
    // 连击：按连击数升调，封顶 10 连避免刺耳。
    combo: (n = 1) => play('combo', { pitch: 1 + Math.min(Math.max(0, n), 10) * 0.06 }),
  };

  return { play, setEnabled, ...shortcuts };
}
