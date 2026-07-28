// 投喂小墨（拖拽选字）——阶段一标杆游戏 v2「更好玩」重做。
//
// 玩法：饿肚子的小墨在中央流着口水盯着糖果，下方摆着几颗「字糖果」。
//       朗读目标字（或头顶想法气泡显示图），孩子把「对的字糖果」拖进小墨嘴里。
//
// 让它「想玩」的三个设计支点（相较 v1 的静态靶子）：
//   1. 实时情感反应：小墨会盯着你手里拖的糖看——
//        · 拖「对」的糖靠近嘴 → 眼睛发光/张大嘴/身子前倾去够/举手要（'eager'）；
//        · 拖「错」的糖靠近嘴 → 扭头躲开/捂嘴/冒汗珠「唔~」（'reject'）。
//      不用等松手就有对错反馈，既是萌点也是边玩边学。
//   2. 饥饿感：待机流口水 + 肚子咕咕 + 盯着糖，制造「快喂我」的冲动。
//   3. 多汁回报：喂对 → 吞咽鼓腮 → 眯眼「好吃」→ 爱心升起 + 小墨蹦跳 + 肚子鼓起来一点
//      （喂越多越圆），配 correct 音 + 星星粒子。喂错 → 糖 boing 弹回，可爱不挫败。
//
// 舞台化小游戏统一接口（与其它游戏一致，引擎零改动即可挂载）：
//   target:   目标字完整数据 {char, pinyin, emoji, hint, ...}
//   options:  含正确项的选项数组（引擎已洗牌，干扰项优先同课）
//   reveal:   答错扣心后由引擎置 true —— 演示正确答案（高亮正确糖果 + 朗读），等孩子拖对
//   onResult: (correct, {firstTry}) => void   首次作答上报；节奏由 GamePlay 决定
//   onSpeak(text) / onSound(name)             由引擎注入
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion';
import Confetti from '../Confetti.jsx';
import SpeakerButton from '../ui/SpeakerButton.jsx';

// 治愈系糖果配色：每颗糖一个颜色，比四块一样的饼干更有食欲、更好区分。
// 按选项序号取色（够 5 个，选项通常 4 个）。
const TREAT_COLORS = [
  { base: '#ffb0c6', deep: '#ff6f9f', crumb: '#ff8fb0' }, // 草莓
  { base: '#8fd6f5', deep: '#4b90f5', crumb: '#6fc0ef' }, // 蓝莓
  { base: '#a6e6b4', deep: '#2fbd8b', crumb: '#7fd69a' }, // 抹茶
  { base: '#ffd694', deep: '#ff9412', crumb: '#ffc46a' }, // 焦糖
  { base: '#d0b0f7', deep: '#a86bf5', crumb: '#bd94f0' }, // 葡萄
];

// 拖拽落点距嘴心多近算「喂进嘴」/触发张望——给足宽容，照顾小手。
const MOUTH_R = 104; // 命中/张嘴的判定半径（px）

export default function FeedGame({ target, options, reveal, onResult, onSpeak, onSound }) {
  const doneRef = useRef(false); // 本题已喂对（锁定输入，等引擎推进）
  const wrongRef = useRef(false); // 已上报过答错（防重复扣心）
  const pandaRef = useRef(null); // 小墨容器，用于把指针换算成注视方向
  const mouthRef = useRef(null); // 嘴部命中热区（<g>）

  const [carrying, setCarrying] = useState(null); // 正在拖的糖果 {char,...}
  const [overMouth, setOverMouth] = useState(false); // 拖拽点是否已靠近嘴
  const [gaze, setGaze] = useState(0); // 注视方向 -1..1（随拖拽的糖）
  const [eaten, setEaten] = useState(null); // 已吃掉的糖 char
  const [chewing, setChewing] = useState(false); // 吞咽中
  const [celebrate, setCelebrate] = useState(false); // 喂对后的「好吃」庆祝
  const [happy, setHappy] = useState(0); // 吃饱度（喂对累加 → 肚子渐鼓、表情更满足）

  // 进场自动朗读目标字。
  useEffect(() => {
    onSpeak?.(target.char);
  }, [target.char, onSpeak]);

  // reveal：朗读正确答案做演示（高亮由样式负责）。
  useEffect(() => {
    if (reveal) onSpeak?.(target.char);
  }, [reveal, target.char, onSpeak]);

  // 卸载清定时器，避免离开后 setState。
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));

  // 嘴心坐标（视口）。
  const mouthCenter = useCallback(() => {
    const m = mouthRef.current?.getBoundingClientRect();
    if (!m) return null;
    return { x: m.left + m.width / 2, y: m.top + m.height / 2 };
  }, []);

  // 拖拽点到嘴心的距离。
  const distToMouth = useCallback(
    (x, y) => {
      const c = mouthCenter();
      if (!c) return Infinity;
      return Math.hypot(x - c.x, y - c.y);
    },
    [mouthCenter]
  );

  // 拖拽中：更新注视方向 + 是否靠近嘴（触发张望/前倾/躲避）。
  const handleDrag = useCallback(
    (e, info) => {
      const box = pandaRef.current?.getBoundingClientRect();
      if (box) {
        const cx = info.point.x - (box.left + box.width / 2);
        setGaze(Math.max(-1, Math.min(1, cx / (box.width * 0.7))));
      }
      setOverMouth(distToMouth(info.point.x, info.point.y) < MOUTH_R);
    },
    [distToMouth]
  );

  const handleDragEnd = useCallback(
    (e, info, opt, controls) => {
      const near = distToMouth(info.point.x, info.point.y) < MOUTH_R;
      setCarrying(null);
      setOverMouth(false);
      setGaze(0);
      if (doneRef.current) return;
      const ok = opt.char === target.char;

      if (near && ok) {
        // 喂对：吞咽 → 鼓腮 → 眯眼「好吃」→ 爱心 + 蹦跳，肚子鼓一点。
        doneRef.current = true;
        setEaten(opt.char);
        setChewing(true);
        setCelebrate(true);
        setHappy((h) => h + 1);
        onSound?.('correct');
        later(() => setChewing(false), 460);
        later(() => setCelebrate(false), 1300);
        onResult?.(true, { firstTry: !wrongRef.current });
        return;
      }

      // 没喂进嘴 / 喂错：糖 boing 弹回原位。
      controls.start({
        x: 0,
        y: 0,
        rotate: 0,
        transition: { type: 'spring', stiffness: 520, damping: 22 },
      });

      if (near && !ok) {
        // 拖到嘴边但是错字：小墨已实时扭头拒绝，这里补一声 + 记一次错（reveal 前）。
        onSound?.('wrong');
        if (!wrongRef.current) {
          wrongRef.current = true;
          onResult?.(false, { firstTry: false });
        }
      }
    },
    [distToMouth, target.char, onResult, onSound]
  );

  // ---- 小墨心情（优先级由高到低）----
  const carryingRight = carrying && carrying.char === target.char;
  let mood = 'idle';
  if (chewing) mood = 'gulp';
  else if (celebrate) mood = 'yum';
  else if (carrying && overMouth && carryingRight) mood = 'eager';
  else if (carrying && overMouth && !carryingRight) mood = 'reject';
  else if (carrying) mood = 'watch';
  else if (happy > 0) mood = 'content';

  return (
    <div className="game-stage feed-stage">
      <div className="stage-head">
        <SpeakerButton size="md" onClick={() => onSpeak?.(target.char)} />
        <p className="q-tip">
          {target.emoji ? '看一看，把对的字喂给小墨' : '听一听，把对的字喂给小墨'}
        </p>
      </div>

      {/* 小墨（可交互全身：张望/前倾/躲避/吞咽/满足 + 肚子渐鼓） */}
      <div className="feed-panda-wrap" ref={pandaRef}>
        <FeedPanda mood={mood} gaze={gaze} fullness={happy} mouthRef={mouthRef} />

        {/* 看图题：想法气泡显示「想吃什么」 */}
        {target.emoji && (
          <motion.div
            className="feed-thought"
            initial={{ scale: 0, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 16, delay: 0.2 }}
          >
            {target.emoji}
          </motion.div>
        )}

        {/* 喂对庆祝：爱心/星星从小墨身上升起 */}
        <AnimatePresence>
          {celebrate && (
            <div className="feed-yum-layer" aria-hidden="true">
              {['❤️', '⭐', '✨', '💛'].map((em, i) => (
                <motion.span
                  key={em}
                  className="feed-yum-heart"
                  initial={{ opacity: 0, y: 10, scale: 0.5 }}
                  animate={{ opacity: [0, 1, 1, 0], y: -90 - i * 12, scale: 1, x: (i - 1.5) * 34 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.1, delay: i * 0.08, ease: 'easeOut' }}
                >
                  {em}
                </motion.span>
              ))}
              <motion.div
                className="feed-yum-word"
                initial={{ opacity: 0, scale: 0.4, y: 6 }}
                animate={{ opacity: [0, 1, 1, 0], scale: 1, y: -10 }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
              >
                好吃~
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* 糖果托盘 */}
      <div className="feed-tray">
        {options.map((opt, i) => (
          <Treat
            key={opt.char}
            opt={opt}
            index={i}
            eaten={eaten === opt.char}
            reveal={reveal && opt.char === target.char}
            onDrag={handleDrag}
            onDragEnd={handleDragEnd}
            onDragStart={() => {
              setCarrying(opt);
              onSound?.('tap');
            }}
          />
        ))}
      </div>

      {eaten && <Confetti preset="stars" />}
    </div>
  );
}

// ---- 单颗字糖果（可拖拽，抓起来 Q 弹、跟手晃、带影子） ----
function Treat({ opt, index, eaten, reveal, onDrag, onDragEnd, onDragStart }) {
  const controls = useAnimationControls();
  const color = TREAT_COLORS[index % TREAT_COLORS.length];

  // 进场：从托盘下方弹起 + 轻微待机漂浮。
  // animate 只绑 controls（不能再传字面量 animate，否则覆盖 controls、弹回失效）。
  useEffect(() => {
    controls.start({
      y: 0,
      opacity: 1,
      transition: { delay: 0.12 + index * 0.09, type: 'spring', stiffness: 260, damping: 18 },
    });
  }, [controls, index]);

  if (eaten) return null; // 吃掉后由粒子/爱心告别

  return (
    <div className="feed-treat-slot">
      <motion.button
        type="button"
        className={`feed-treat ${reveal ? 'reveal' : ''}`}
        style={{
          '--treat-base': color.base,
          '--treat-deep': color.deep,
          '--treat-crumb': color.crumb,
        }}
        drag
        dragSnapToOrigin={false}
        dragElastic={0.18}
        animate={controls}
        initial={{ y: 96, opacity: 0 }}
        whileDrag={{ scale: 1.24, rotate: [-4, 4], zIndex: 30 }}
        whileTap={{ scale: 1.12 }}
        onDragStart={onDragStart}
        onDrag={(e, info) => onDrag(e, info, opt)}
        onDragEnd={(e, info) => onDragEnd(e, info, opt, controls)}
      >
        {/* 糖果本体：光泽 + 糖屑点，char 压中央 */}
        <span className="feed-treat-shine" aria-hidden="true" />
        <span className="feed-treat-char">{opt.char}</span>
        <span className="feed-treat-crumbs" aria-hidden="true">
          <i /><i /><i />
        </span>
      </motion.button>
      {/* 落地影子（拖起时视觉上有深度） */}
      <span className="feed-treat-shadow" aria-hidden="true" />
    </div>
  );
}

// ---- 可交互的小墨（投喂专用全身 SVG，不复用通用 Xiaomo：需要张望/前倾/躲避/吞咽/鼓肚） ----
function FeedPanda({ mood, gaze, fullness, mouthRef }) {
  // 眼珠横向偏移：追着拖拽的糖看；拒绝时反向「别过脸」。
  let ex = Math.max(-7, Math.min(7, gaze * 7));
  if (mood === 'reject') ex = gaze > 0 ? -6 : 6;

  // 头部：随注视轻转；渴望时上抬前倾；拒绝时扭头躲开。
  let headX = gaze * 6;
  let headY = 0;
  let headRot = gaze * 5;
  if (mood === 'eager') {
    headY = -9;
    headRot = gaze * 3;
  } else if (mood === 'reject') {
    headX = gaze > 0 ? -12 : 12;
    headRot = gaze > 0 ? -15 : 15;
  }

  // 手臂：渴望时举起来「要」；拒绝时张开「不要」；平时垂放。
  const armUp = mood === 'eager';
  const armOut = mood === 'reject';
  const leftArm = armUp ? 'rotate(-118 78 176)' : armOut ? 'rotate(-52 78 176)' : 'rotate(-16 78 176)';
  const rightArm = armUp ? 'rotate(118 162 176)' : armOut ? 'rotate(52 162 176)' : 'rotate(16 162 176)';

  // 肚子鼓度：喂越多越圆（封顶）。
  const bellyScale = 1 + Math.min(fullness, 5) * 0.05;

  // 整体动效：吞咽时上下点头 + 缩放；渴望时前倾放大；满足时开心蹦；平时呼吸。
  const bodyAnim =
    mood === 'gulp'
      ? { scale: [1, 1.06, 0.97, 1.03, 1], y: [0, 2, -2, 0], transition: { duration: 0.5 } }
      : mood === 'yum'
        ? { y: [0, -16, 0, -8, 0], transition: { duration: 0.7, ease: 'easeOut' } }
        : mood === 'eager'
          ? { scale: 1.05, y: -4, transition: { type: 'spring', stiffness: 300, damping: 16 } }
          : { scale: [1, 1.02, 1], transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' } };

  // 嘴形
  const mouthWide = mood === 'eager' || mood === 'watch';
  const mouthTight = mood === 'reject' || mood === 'gulp';

  // 眼形
  const eyeHappy = mood === 'yum' || mood === 'content';
  const eyeStar = mood === 'eager';
  const eyeSquint = mood === 'reject';

  return (
    <motion.svg
      className="feed-panda"
      width="230"
      height="250"
      viewBox="0 0 240 260"
      role="img"
      aria-label="饿肚子的小墨在等你喂"
      animate={bodyAnim}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <radialGradient id="feedFace" cx="42%" cy="30%" r="76%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e9edf4" />
        </radialGradient>
        <radialGradient id="feedBody" cx="44%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#eef1f6" />
        </radialGradient>
      </defs>

      {/* 脚 */}
      <ellipse cx="94" cy="238" rx="18" ry="12" fill="#26303f" />
      <ellipse cx="146" cy="238" rx="18" ry="12" fill="#26303f" />

      {/* 身体（肚子随吃饱度鼓起） */}
      <g transform={`translate(120 186) scale(${bellyScale}) translate(-120 -186)`}>
        <ellipse cx="120" cy="186" rx="60" ry="58" fill="url(#feedBody)" stroke="#26303f" strokeWidth="4" />
        {/* 肚皮浅色块 */}
        <ellipse cx="120" cy="196" rx="34" ry="34" fill="#fff" opacity="0.7" />
      </g>

      {/* 手臂（黑，举/张/垂三态） */}
      <ellipse cx="78" cy="176" rx="15" ry="20" fill="#26303f" transform={leftArm} />
      <ellipse cx="162" cy="176" rx="15" ry="20" fill="#26303f" transform={rightArm} />

      {/* 头（随注视/心情平移旋转） */}
      <g transform={`translate(${headX} ${headY}) rotate(${headRot} 120 96)`}>
        {/* 耳朵 */}
        <circle cx="76" cy="60" r="23" fill="#26303f" />
        <circle cx="164" cy="60" r="23" fill="#26303f" />
        {/* 脸 */}
        <ellipse cx="120" cy="98" rx="72" ry="67" fill="url(#feedFace)" stroke="#26303f" strokeWidth="4" />

        {/* 黑眼圈 */}
        <ellipse cx="92" cy="88" rx="22" ry="27" fill="#26303f" transform="rotate(-12 92 88)" />
        <ellipse cx="148" cy="88" rx="22" ry="27" fill="#26303f" transform="rotate(12 148 88)" />

        {/* 眼珠：普通/追物/星星/开心/眯眼 */}
        {eyeSquint ? (
          <>
            <path d="M 84 90 L 100 90" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" />
            <path d="M 140 90 L 156 90" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" />
          </>
        ) : eyeHappy ? (
          <>
            <path d="M 83 92 Q 92 80 101 92" stroke="#fff" strokeWidth="4.5" fill="none" strokeLinecap="round" />
            <path d="M 139 92 Q 148 80 157 92" stroke="#fff" strokeWidth="4.5" fill="none" strokeLinecap="round" />
          </>
        ) : eyeStar ? (
          <>
            <Sparkle cx={92 + ex} cy={88} />
            <Sparkle cx={148 + ex} cy={88} />
          </>
        ) : (
          <>
            <circle cx={92 + ex} cy="90" r="9" fill="#fff" />
            <circle cx={94 + ex} cy="86" r="2.8" fill="#fff" opacity="0.9" />
            <circle cx={148 + ex} cy="90" r="9" fill="#fff" />
            <circle cx={150 + ex} cy="86" r="2.8" fill="#fff" opacity="0.9" />
          </>
        )}

        {/* 腮红 */}
        <ellipse cx="68" cy="116" rx="13" ry="8" fill="#ff9db7" opacity="0.9" />
        <ellipse cx="172" cy="116" rx="13" ry="8" fill="#ff9db7" opacity="0.9" />

        {/* 鼻子 */}
        <ellipse cx="120" cy="116" rx="7" ry="5" fill="#26303f" />

        {/* 嘴（命中热区锚这里） */}
        <g ref={mouthRef}>
          {mouthWide ? (
            <>
              <motion.ellipse
                cx="120"
                cy="140"
                rx={mood === 'eager' ? 30 : 20}
                fill="#e8617a"
                stroke="#26303f"
                strokeWidth="3"
                initial={{ ry: 6 }}
                animate={{ ry: mood === 'eager' ? 27 : 16 }}
                transition={{ type: 'spring', stiffness: 380, damping: 17 }}
              />
              {/* 舌头 */}
              <ellipse cx="120" cy={mood === 'eager' ? 154 : 148} rx="13" ry="8" fill="#ff9db7" />
            </>
          ) : mouthTight ? (
            <path d="M 104 140 L 136 140" stroke="#26303f" strokeWidth="4.5" fill="none" strokeLinecap="round" />
          ) : (
            <path d="M 100 134 Q 120 152 140 134" stroke="#26303f" strokeWidth="4" fill="none" strokeLinecap="round" />
          )}
        </g>

        {/* 口水（饿肚子待机时挂在嘴角，随呼吸一滴滴渗出） */}
        {(mood === 'idle') && (
          <motion.path
            d="M 137 143 q 3 10 0 17 q -5 4 -7 -2 q -2 -8 2 -15 Z"
            fill="#bfe6ff"
            stroke="#8fc9ee"
            strokeWidth="1.5"
            initial={{ opacity: 0, scaleY: 0.4 }}
            animate={{ opacity: [0.4, 1, 0.4], scaleY: [0.5, 1, 0.5] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            style={{ transformOrigin: '137px 143px' }}
          />
        )}

        {/* 汗珠（拒绝时冒） */}
        {mood === 'reject' && (
          <motion.path
            d="M 176 70 q 4 10 0 16 q -7 3 -8 -3 q -1 -8 8 -13 Z"
            fill="#bfe6ff"
            stroke="#8fc9ee"
            strokeWidth="1.5"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
          />
        )}
      </g>
    </motion.svg>
  );
}

// 星星眼（渴望时）
function Sparkle({ cx, cy }) {
  return (
    <path
      d={`M ${cx} ${cy - 10} L ${cx + 3} ${cy - 3} L ${cx + 10} ${cy} L ${cx + 3} ${cy + 3} L ${cx} ${cy + 10} L ${cx - 3} ${cy + 3} L ${cx - 10} ${cy} L ${cx - 3} ${cy - 3} Z`}
      fill="#fff"
    />
  );
}
