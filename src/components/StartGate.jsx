// 开场欢迎门（tap-to-start）：解决「浏览器自动播放策略要求先有用户手势才能出声」。
// 与其用隐形监听器去赌首次交互（在 StrictMode 下易失效），不如明摆着放一个会
// 招手抖动的大糖果喇叭，让宝宝主动点一下——这一下同时解锁 BGM + 全站音效，
// 百分百可靠，且契合 3-6 岁「看见会动的就想戳」的天性。
//
// 视觉：整屏铺一张 AI 渲染的厚涂糖果插画（小墨坐云上 + 大喇叭钮 + 文案都画进图里，
//   public/images/start-gate.png，4:5 竖图）。交互不依赖图里的像素，而是叠透明命中区：
//     · 全屏（除右下「安静玩」外）任意点击 = 开声进入（图里「点我，一起玩！」即引导）
//     · 右下「安静玩」pill 处独立透明按钮 = 无声进入
//   喇叭中心叠一层 CSS 声波光环，让静态图「活」起来（reduced-motion 时静止）。
//
// 行为约定（与产品确认，逻辑不变）：
//   · 每次打开 app（刷新/冷启）都弹，点开声进入（放音乐 + 解锁音效）。
//   · 「安静玩」= 无声进入（音乐、音效都不放），供图书馆/宝睡觉等场景。
//   · 家长若在设置里关了背景音乐：门照弹（它还肩负解锁音效的职责），
//     开声进入只解锁音效、不放音乐（startBgm 内部自查开关）。
//   · 纯视觉、零新增语音文案——不触发音频预生成流水线。
//
// 会话内只弹一次：用 sessionStorage 记「本次会话已开场」，路由切换/组件重挂不重复弹。
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { startBgm } from '../hooks/useBgm.js';
import { useSound } from '../hooks/useSound.js';

const GATE_KEY = 'jarvis-child-gate-passed'; // sessionStorage：本次会话是否已开场
const GATE_IMG = `${import.meta.env.BASE_URL}images/start-gate.png`;

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
    // 忽略(隐私模式等)
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
  const enterQuiet = (e) => {
    e.stopPropagation(); // 别冒泡到全屏「开声」命中区
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
          {/* 虚化背景：同一张图放大 + 高斯模糊铺满整屏，补齐 contain 留下的两侧/上下空白。
              就像竖视频播放器两侧的虚化延展——手机竖屏、平板横屏比例相反，任何单张图都
              没法同时 cover 两者；用它自己的虚化副本兜底，既无生硬色带、又一张图通吃。
              纯装饰、不拦点击。 */}
          <div
            className="sg-bg"
            style={{ backgroundImage: `url(${GATE_IMG})` }}
            aria-hidden="true"
          />

          {/* 全屏开声命中区：任意点击即开声进入（图里「点我，一起玩！」即引导语）。
              铺在最底，「安静玩」按钮盖在其上、靠 stopPropagation 拦冒泡。
              无障碍：这是主操作，给完整 label。 */}
          <button
            className="sg-hit"
            onClick={enterWithSound}
            aria-label="开始，播放音乐和声音"
          />

          {/* 4:5 舞台：整图完整可见（contain）。光环、「安静玩」按钮都锚定其上，
              这样任何屏幕比例下都与图里的喇叭、pill 对齐，不会错位。
              舞台本身不拦点击（pointer-events:none）——点击穿透到底层 sg-hit 开声进入；
              仅「安静玩」按钮单独恢复 pointer-events 接自己的点。 */}
          <div className="sg-stage">
            <img className="sg-art" src={GATE_IMG} alt="" draggable="false" aria-hidden="true" />
            {/* 喇叭中心声波光环：叠在图里蓝色喇叭钮上，让静态图「活」起来。
                reduced-motion 时静止（见 CSS）。 */}
            <span className="sg-halo" aria-hidden="true" />
            {/* 「安静玩」：无声进入，盖在图里那颗「安静玩」pill 上（透明命中区） */}
            <button className="sg-quiet" onClick={enterQuiet} aria-label="安静玩，不播放声音">
              安静玩 🤫
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
