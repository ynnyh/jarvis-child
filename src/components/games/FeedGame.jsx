// 投喂小墨（拖拽选字）——阶段一重构的标杆游戏，取代旧的打地鼠/钓鱼/点泡泡三套"点选择题"。
//
// 玩法：小墨在中央张嘴等吃，下方漂着几块「字饼干」。朗读目标字（或显示图/提示），
//       孩子把正确的字饼干「拖」进小墨嘴里。
//   拖对：小墨张大嘴接住 → 咀嚼 → 满足表情 + correct 音 + 星星粒子，饼干消失。
//   拖错：小墨皱眉，饼干「弹回」原位 + wrong 音（reveal 前不扣心地演示，等孩子拖对）。
//   汁水：拖拽时饼干跟手放大；小墨眼睛与嘴巴随最近的饼干「张望」；喂对越多越开心。
//
// 为什么用拖拽而非点选：3-6 岁儿童「拖」是更主动、更有掌控感的操作，
//   且投喂这一动作本身自带情感（喂养=照顾小墨），比"点中移动靶"更像玩具、更少挫败。
//
// 舞台化小游戏统一接口（与其它游戏一致，引擎零改动即可挂载）：
//   target:   目标字完整数据 {char, pinyin, emoji, hint, ...}
//   options:  含正确项的选项数组（引擎已洗牌，干扰项优先同课）
//   reveal:   答错扣心后由引擎置 true —— 演示正确答案（高亮正确饼干 + 朗读），等孩子拖对
//   onResult: (correct, {firstTry}) => void   首次作答上报；节奏由 GamePlay 决定
//   onSpeak(text) / onSound(name)             由引擎注入
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import Confetti from '../Confetti.jsx';
import SpeakerButton from '../ui/SpeakerButton.jsx';

export default function FeedGame({ target, options, reveal, onResult, onSpeak, onSound }) {
  const doneRef = useRef(false); // 本题已喂对（锁定输入，等引擎推进）
  const wrongRef = useRef(false); // 已上报过答错（防重复扣心）
  const stageRef = useRef(null); // 舞台容器，用于把指针坐标换算成相对坐标
  const mouthRef = useRef(null); // 嘴部命中热区
  const [eaten, setEaten] = useState(null); // 已吃掉的饼干 char
  const [mouthOpen, setMouthOpen] = useState(false); // 张嘴（拖拽接近或吃到时）
  const [chewing, setChewing] = useState(false); // 咀嚼中
  const [happy, setHappy] = useState(0); // 满足度（喂对累加，控制表情越来越开心）
  const [gaze, setGaze] = useState(0); // 眼睛横向注视偏移 -1..1（随拖拽的饼干）
  const [dragChar, setDragChar] = useState(null); // 正在拖的饼干

  // 进场自动朗读目标字。
  useEffect(() => {
    onSpeak?.(target.char);
  }, [target.char, onSpeak]);

  // reveal：朗读正确答案做演示（高亮由样式负责）。
  useEffect(() => {
    if (reveal) onSpeak?.(target.char);
  }, [reveal, target.char, onSpeak]);

  // 判断某个坐标（视口）是否落在嘴部热区内。
  const isOverMouth = useCallback((clientX, clientY) => {
    const m = mouthRef.current?.getBoundingClientRect();
    if (!m) return false;
    // 热区比可见嘴巴略放大，照顾小手拖拽的落点误差。
    const pad = 28;
    return (
      clientX >= m.left - pad &&
      clientX <= m.right + pad &&
      clientY >= m.top - pad &&
      clientY <= m.bottom + pad
    );
  }, []);

  // 拖拽中：跟随最近的饼干让小墨"张望"，接近嘴巴时张嘴。
  const handleDrag = useCallback(
    (e, info, opt) => {
      const stage = stageRef.current?.getBoundingClientRect();
      if (stage) {
        const cx = info.point.x - (stage.left + stage.width / 2);
        setGaze(Math.max(-1, Math.min(1, cx / (stage.width / 2))));
      }
      setMouthOpen(isOverMouth(info.point.x, info.point.y));
    },
    [isOverMouth]
  );

  const handleDragEnd = useCallback(
    (e, info, opt, controls) => {
      setDragChar(null);
      setGaze(0);
      if (doneRef.current) return;
      const hit = isOverMouth(info.point.x, info.point.y);
      const ok = opt.char === target.char;

      if (hit && ok) {
        // 喂对：吃进去 → 咀嚼 → 满足。
        doneRef.current = true;
        setEaten(opt.char);
        setMouthOpen(true);
        setChewing(true);
        setHappy((h) => h + 1);
        onSound?.('correct');
        setTimeout(() => {
          setChewing(false);
          setMouthOpen(false);
        }, 620);
        onResult?.(true, { firstTry: !wrongRef.current });
        return;
      }

      // 没喂进嘴，或喂错了：饼干弹回原位。
      controls.start({ x: 0, y: 0, transition: { type: 'spring', stiffness: 500, damping: 26 } });
      setMouthOpen(false);

      if (hit && !ok) {
        // 拖到嘴里但是错字：小墨吐出来（皱眉），演示阶段前扣一次心。
        onSound?.('wrong');
        if (!wrongRef.current) {
          wrongRef.current = true;
          onResult?.(false, { firstTry: false });
        }
      }
    },
    [isOverMouth, target.char, onResult, onSound]
  );

  // 小墨表情：吃到东西/满足度高 → 更开心。
  const expression = chewing ? 'chew' : happy > 0 ? 'yum' : 'idle';

  return (
    <div className="game-stage feed-stage" ref={stageRef}>
      <div className="stage-head">
        <SpeakerButton size="md" onClick={() => onSpeak?.(target.char)} />
        <p className="q-tip">
          {target.emoji ? '看一看，把对的字喂给小墨' : '听一听，把对的字喂给小墨'}
        </p>
      </div>

      {/* 小墨（可交互头像：张嘴 + 咀嚼 + 眼睛追物 + 满足度表情） */}
      <div className="feed-panda-wrap">
        <FeedPanda
          expression={expression}
          mouthOpen={mouthOpen}
          gaze={gaze}
          mouthRef={mouthRef}
        />
        {/* 看图题：把目标图挂在小墨头顶的想法气泡里，明确"想吃什么" */}
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
      </div>

      {/* 饼干托盘 */}
      <div className="feed-tray">
        {options.map((opt, i) => (
          <Cookie
            key={opt.char}
            opt={opt}
            index={i}
            eaten={eaten === opt.char}
            reveal={reveal && opt.char === target.char}
            onDrag={handleDrag}
            onDragEnd={handleDragEnd}
            onDragStart={() => setDragChar(opt.char)}
            onSound={onSound}
          />
        ))}
      </div>

      {eaten && <Confetti preset="stars" />}
    </div>
  );
}

// ---- 单块字饼干（可拖拽） ----
function Cookie({ opt, index, eaten, reveal, onDrag, onDragEnd, onDragStart, onSound }) {
  const controls = useAnimationControls();

  // 进场浮起：mount 后用 controls 播一次入场动画。
  // 关键：animate 只绑 controls 一处（不能再传字面量 animate，否则覆盖 controls、
  // 导致 handleDragEnd 里的 controls.start 弹回失效）。
  useEffect(() => {
    controls.start({
      y: 0,
      opacity: 1,
      transition: { delay: 0.15 + index * 0.1, type: 'spring', stiffness: 260, damping: 18 },
    });
  }, [controls, index]);

  if (eaten) return null; // 吃掉后由粒子告别

  return (
    <motion.button
      type="button"
      className={`feed-cookie ${reveal ? 'reveal' : ''}`}
      drag
      dragSnapToOrigin={false}
      dragElastic={0.16}
      animate={controls}
      initial={{ y: 90, opacity: 0 }}
      whileDrag={{ scale: 1.22, zIndex: 20 }}
      onDragStart={() => {
        onSound?.('tap');
        onDragStart?.();
      }}
      onDrag={(e, info) => onDrag(e, info, opt)}
      onDragEnd={(e, info) => onDragEnd(e, info, opt, controls)}
    >
      <span className="feed-cookie-face" aria-hidden="true">🍪</span>
      <span className="feed-cookie-char">{opt.char}</span>
    </motion.button>
  );
}

// ---- 可交互的小墨头（投喂专用，自绘 SVG，不复用通用 Xiaomo：需要张嘴/咀嚼/追物） ----
function FeedPanda({ expression, mouthOpen, gaze, mouthRef }) {
  // 眼珠横向偏移：随拖拽的饼干看（-6..6 px）。
  const ex = Math.max(-6, Math.min(6, gaze * 6));
  const chew = expression === 'chew';
  const yum = expression === 'yum';

  return (
    <motion.svg
      className="feed-panda"
      width="200"
      height="190"
      viewBox="0 0 200 190"
      role="img"
      aria-label="小墨张着嘴等你喂"
      // 咀嚼时头轻微上下点动；平时缓慢呼吸。
      animate={
        chew
          ? { scale: [1, 1.05, 0.98, 1.03, 1], transition: { duration: 0.6 } }
          : { scale: [1, 1.02, 1], transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' } }
      }
      style={{ overflow: 'visible' }}
    >
      <defs>
        <radialGradient id="feedFace" cx="42%" cy="32%" r="74%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e9edf4" />
        </radialGradient>
      </defs>

      {/* 耳朵 */}
      <circle cx="54" cy="52" r="22" fill="#26303f" />
      <circle cx="146" cy="52" r="22" fill="#26303f" />
      {/* 脸 */}
      <ellipse cx="100" cy="96" rx="70" ry="66" fill="url(#feedFace)" stroke="#26303f" strokeWidth="4" />

      {/* 黑眼圈 */}
      <ellipse cx="72" cy="86" rx="22" ry="27" fill="#26303f" transform="rotate(-12 72 86)" />
      <ellipse cx="128" cy="86" rx="22" ry="27" fill="#26303f" transform="rotate(12 128 86)" />
      {/* 眼珠（追物：横向偏移 ex；满足时弯月眼） */}
      {yum || chew ? (
        <>
          <path d={`M ${63 + ex} 88 Q 72 78 ${81 + ex} 88`} stroke="#fff" strokeWidth="4.5" fill="none" strokeLinecap="round" />
          <path d={`M ${119 + ex} 88 Q 128 78 ${137 + ex} 88`} stroke="#fff" strokeWidth="4.5" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx={72 + ex} cy="88" r="8.5" fill="#fff" />
          <circle cx={74 + ex} cy="85" r="2.6" fill="#fff" opacity="0.9" />
          <circle cx={128 + ex} cy="88" r="8.5" fill="#fff" />
          <circle cx={130 + ex} cy="85" r="2.6" fill="#fff" opacity="0.9" />
        </>
      )}

      {/* 腮红 */}
      <ellipse cx="50" cy="112" rx="13" ry="8" fill="#ff9db7" opacity="0.9" />
      <ellipse cx="150" cy="112" rx="13" ry="8" fill="#ff9db7" opacity="0.9" />

      {/* 鼻子 */}
      <ellipse cx="100" cy="112" rx="7" ry="5" fill="#26303f" />

      {/* 嘴巴：命中热区锚在这里。张嘴时是个大圆口（可"接住"饼干），闭嘴时是微笑。 */}
      <g ref={mouthRef}>
        {mouthOpen ? (
          <motion.ellipse
            cx="100"
            cy="134"
            rx="26"
            ry="22"
            fill="#e8617a"
            stroke="#26303f"
            strokeWidth="3"
            initial={{ ry: 6 }}
            animate={{ ry: 22 }}
            transition={{ type: 'spring', stiffness: 400, damping: 18 }}
          />
        ) : (
          <path
            d="M 82 128 Q 100 146 118 128"
            stroke="#26303f"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
        )}
        {/* 张嘴时露出小舌头 */}
        {mouthOpen && <ellipse cx="100" cy="144" rx="12" ry="8" fill="#ff9db7" />}
      </g>
    </motion.svg>
  );
}
