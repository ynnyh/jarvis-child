// 发音封装：优先播放预生成的 mp3（edge-tts 生成，音质好、离线、所有设备一致），
// 找不到对应音频时才降级到浏览器 Web Speech API。
//
// 预生成音频解决了两个问题：
//   1. 很多设备（尤其平板）没有中文语音包，Web Speech 会完全静音；
//   2. 不同设备发音不一致、不可控。
// manifest.json 是「文本 -> 音频路径」的映射，由 scripts/generate-audio.mjs 生成。
import { useCallback, useEffect, useRef, useState } from 'react';

export function useSpeech() {
  const [ready, setReady] = useState(false);
  const manifestRef = useRef({}); // 文本 -> "audio/xxx.mp3"
  const audioRef = useRef(null); // 复用一个 Audio 元素，播新音频前先停旧的
  const ttsSupportedRef = useRef(false);
  const voiceRef = useRef(null);

  // 加载音频清单。
  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}audio/manifest.json`)
      .then((res) => (res.ok ? res.json() : {}))
      .then((data) => {
        if (!cancelled) {
          manifestRef.current = data ?? {};
          setReady(true);
        }
      })
      .catch(() => {
        // 没有 manifest（未生成音频）也不报错，直接走 Web Speech 兜底。
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 准备 Web Speech 兜底：挑一个中文语音。
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return undefined;
    ttsSupportedRef.current = true;
    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      const zh = voices.find((v) => /zh|cmn|Chinese/i.test(v.lang + v.name));
      if (zh) voiceRef.current = zh;
    };
    pickVoice();
    window.speechSynthesis.addEventListener('voiceschanged', pickVoice);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', pickVoice);
  }, []);

  // Web Speech 兜底朗读。
  const speakWithTTS = useCallback((text, rate) => {
    if (!ttsSupportedRef.current || !text) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'zh-CN';
    utter.rate = rate;
    utter.pitch = 1.1;
    if (voiceRef.current) utter.voice = voiceRef.current;
    window.speechSynthesis.speak(utter);
  }, []);

  const speak = useCallback(
    (text, { rate = 0.8 } = {}) => {
      if (!text) return;
      const rel = manifestRef.current[text];
      if (rel) {
        // 有预生成音频：优先播放。
        const src = `${import.meta.env.BASE_URL}${rel}`;
        if (!audioRef.current) audioRef.current = new Audio();
        const audio = audioRef.current;
        audio.pause();
        audio.src = src;
        audio.currentTime = 0;
        // 若音频播放失败（文件缺失/解码错误），降级到 TTS。
        audio.onerror = () => speakWithTTS(text, rate);
        const p = audio.play();
        if (p && typeof p.catch === 'function') {
          p.catch(() => speakWithTTS(text, rate));
        }
        return;
      }
      // 没有预生成音频：走浏览器兜底。
      speakWithTTS(text, rate);
    },
    [speakWithTTS]
  );

  // supported：只要有音频清单或浏览器支持 TTS，就算可用。
  return { speak, supported: ready };
}
