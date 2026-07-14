// 发音封装：使用浏览器自带的 Web Speech API 播放中文。
// 零后端、零成本；Windows 中文语音质量较好。后续可替换为预录音频。
import { useCallback, useEffect, useRef, useState } from 'react';

export function useSpeech() {
  const [supported, setSupported] = useState(false);
  const voiceRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setSupported(false);
      return;
    }
    setSupported(true);

    // 挑选一个中文语音；voices 可能异步加载，需监听 voiceschanged。
    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      const zh = voices.find((v) => /zh|cmn|Chinese/i.test(v.lang + v.name));
      if (zh) voiceRef.current = zh;
    };
    pickVoice();
    window.speechSynthesis.addEventListener('voiceschanged', pickVoice);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', pickVoice);
    };
  }, []);

  const speak = useCallback(
    (text, { rate = 0.8 } = {}) => {
      if (!supported || !text) return;
      // 打断上一次朗读，避免排队重叠。
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'zh-CN';
      utter.rate = rate; // 稍慢，方便小朋友听清。
      utter.pitch = 1.1;
      if (voiceRef.current) utter.voice = voiceRef.current;
      window.speechSynthesis.speak(utter);
    },
    [supported]
  );

  return { speak, supported };
}
