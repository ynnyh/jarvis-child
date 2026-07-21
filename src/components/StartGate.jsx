// 开场欢迎门（tap-to-start）：解决「浏览器自动播放策略要求先有用户手势才能出声」。
// 与其用隐形监听器去赌首次交互（在 StrictMode 下易失效），不如明摆着放一个会
// 招手抖动的大糖果喇叭，让宝宝主动点一下——这一下同时解锁 BGM + 全站音效，
// 百分百可靠，且契合 3-6 岁「看见会动的就想戳」的天性。
//
// 行为约定（与产品确认）：
//   · 每次打开 app（刷新/冷启）都弹，点「大喇叭」= 开声进入（放音乐 + 解锁音效）。
//   · 角落「安静玩」= 无声进入（音乐、音效都不放），供图书馆/宝睡觉等场景。
//   · 家长若在设置里关了背景音乐：门照弹（它还肩负解锁音效的职责），
//     点大喇叭只解锁音效、不放音乐（startBgm 内部自查开关）。
//   · 纯视觉、零新增语音文案——不触发音频预生成流水线。
//
// 会话内只弹一次：用 sessionStorage 记「本次会话已开场」，路由切换/组件重挂不重复弹。
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { startBgm } from '../hooks/useBgm.js';
import { useSound } from '../hooks/useSound.js';

const GATE_KEY = 'jarvis-child-gate-passed'; // sessionStorage：本次会话是否已开场

function alreadyPassed() {
  try {
    return sessionStorage.getItem(GATE_KEY) === '1';
  } catch {
    return false;
  }
}

function markPassed() {
  try {
    sessionStorage.setItem(GATE_KEY, '1');
  } catch {
    // 忽略（隐私模式等）
  }
}

export default function StartGate() {
  const [open, setOpen] = useState(() => !alreadyPassed());
  const sound = useSound();

  // 开声进入：点一下即用户手势——tap() 给即时反馈并顺带解锁音效 AudioContext，
  // startBgm() 在手势里启动音乐。两者都尊重家长在设置里的开关（关了则各自静默），
  // 这个门只负责「解锁」，不覆盖家长的静音选择。
  const enterWithSound = () => {
    sound.tap(); // 音效开启时响一声（也解锁 AudioContext）；关了则静默
    startBgm(); // 背景音乐开启时启动；家长关了则内部跳过
    markPassed();
    setOpen(false);
  };

  // 安静进入：不放音乐、不出音效（图书馆/宝睡觉）。
  const enterQuiet = () => {
    markPassed();
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="start-gate"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.08 }}
          transition={{ duration: 0.42, ease: [0.4, 0, 0.2, 1] }}
        >
          {/* 漂浮装饰：糖果音符/圆点，柔和不抢戏，不拦点击 */}
          <span className="sg-decor sg-fl a sg-note" style={{ top: '12%', left: '16%', fontSize: 30 }}>♪</span>
          <span className="sg-decor sg-fl b sg-note" style={{ top: '20%', right: '14%', fontSize: 40 }}>♫</span>
          <span className="sg-decor sg-fl c sg-note" style={{ bottom: '22%', left: '12%', fontSize: 26 }}>♪</span>

          <div className="sg-inner">
            {/* 小墨：举手欢迎、呼吸 */}
            <svg className="sg-mo sg-breathe" viewBox="0 0 100 106" aria-label="小墨">
              <defs>
                <radialGradient id="sgMoBody" cx="42%" cy="28%" r="80%">
                  <stop offset="0" stopColor="#8fb9ff" />
                  <stop offset="55%" stopColor="#6fa8ff" />
                  <stop offset="1" stopColor="#4d86e0" />
                </radialGradient>
              </defs>
              <ellipse cx="50" cy="100" rx="28" ry="6" fill="rgba(31,91,120,0.20)" />
              <ellipse cx="12" cy="42" rx="7" ry="9" fill="#5a95ec" stroke="#294a78" strokeWidth="2.5" />
              <ellipse cx="88" cy="38" rx="7" ry="9" fill="#5a95ec" stroke="#294a78" strokeWidth="2.5" />
              <path d="M50 10 C74 10 87 30 87 54 C87 78 71 92 50 92 C29 92 13 78 13 54 C13 30 26 10 50 10 Z" fill="url(#sgMoBody)" stroke="#294a78" strokeWidth="3" />
              <ellipse cx="40" cy="30" rx="16" ry="11" fill="rgba(255,255,255,0.45)" />
              <circle cx="39" cy="52" r="8" fill="#26303f" />
              <circle cx="61" cy="52" r="8" fill="#26303f" />
              <circle cx="42" cy="49" r="2.6" fill="#fff" />
              <circle cx="64" cy="49" r="2.6" fill="#fff" />
              <ellipse cx="28" cy="64" rx="6" ry="4" fill="#ff9db3" opacity="0.9" />
              <ellipse cx="72" cy="64" rx="6" ry="4" fill="#ff9db3" opacity="0.9" />
              <path d="M41 65 Q50 74 59 65 Q50 70 41 65 Z" fill="#3a2a3a" />
            </svg>

            <h1 className="sg-title">点我，一起玩！</h1>

            {/* C 位大糖果喇叭钮：招手抖动 + 声波光环 */}
            <button className="sg-startbtn" onClick={enterWithSound} aria-label="开始，播放音乐和声音">
              <span className="sg-halo" aria-hidden="true" />
              <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <path d="M5 12 H10 L17 6 V26 L10 20 H5 Z" fill="#fff" />
                <path className="sg-wave" d="M21 10 Q25 16 21 22" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" fill="none" />
                <path className="sg-wave w2" d="M25 7 Q31 16 25 25" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" fill="none" />
              </svg>
            </button>

            <span className="sg-hint"><span className="sg-dot" />点一下，音乐和声音就来啦</span>
          </div>

          {/* 角落：安静玩（无声进入） */}
          <button className="sg-quiet" onClick={enterQuiet}>安静玩 🤫</button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
