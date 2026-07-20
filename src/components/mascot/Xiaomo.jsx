// 吉祥物「小墨」——一只熊猫幼崽，纯 SVG 绘制，无需外部素材。
// 一物两用：既是学习中的情感陪伴（表情反馈），也是养成系统里的宠物（成长阶段）。
//
// props:
//   expression: 'happy' | 'cheer' | 'think' | 'encourage' | 'sleep' | 'dizzy' | 'celebrate'  表情/状态
//               cheer=欢呼（弯月眼 + 举手 + 上跳）；dizzy=晕（漩涡眼 + 歪头）；celebrate=庆祝（跳跃循环）
//   stage: 1 | 2 | 3   成长阶段（幼崽 / 小童 / 少年），影响体型与配饰
//   size: number       像素尺寸（正方形）
//   animate: boolean   是否启用待机呼吸/眨眼动效（也控制 cheer/celebrate 的跳动）
//
// 设计说明：所有形态共用同一套基础几何，靠参数微调，保证风格统一、体积小。
import { motion } from 'framer-motion';

// 各表情对应的眼睛/嘴巴形态参数。
const FACES = {
  happy: { eye: 'open', mouth: 'smile', blush: true },
  cheer: { eye: 'happy', mouth: 'open', blush: true },
  think: { eye: 'look', mouth: 'flat', blush: false },
  encourage: { eye: 'open', mouth: 'smallSmile', blush: true },
  sleep: { eye: 'closed', mouth: 'flat', blush: true },
  dizzy: { eye: 'dizzy', mouth: 'wavy', blush: false }, // 晕：漩涡眼 + 波浪嘴
  celebrate: { eye: 'happy', mouth: 'open', blush: true }, // 庆祝：欢呼脸 + 跳跃循环
};

// 成长阶段：体型比例与是否有配饰。
const STAGES = {
  1: { bodyScale: 0.82, hasScarf: false, earScale: 1.15 }, // 幼崽：头大身小、耳朵大
  2: { bodyScale: 0.95, hasScarf: true, earScale: 1.0 }, // 小童：戴围巾
  3: { bodyScale: 1.08, hasScarf: true, earScale: 0.9 }, // 少年：更修长
};

function Eyes({ type }) {
  // 熊猫的黑眼圈 + 眼珠。type 控制眼睛神态。
  const patch = (cx) => (
    <ellipse cx={cx} cy={112} rx={19} ry={24} fill="#26303f" transform={`rotate(${cx < 100 ? -12 : 12} ${cx} 112)`} />
  );
  const eyeball = (cx) => {
    if (type === 'closed') {
      return <path d={`M ${cx - 10} 112 Q ${cx} 120 ${cx + 10} 112`} stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />;
    }
    if (type === 'happy') {
      // 弯月开心眼
      return <path d={`M ${cx - 9} 116 Q ${cx} 104 ${cx + 9} 116`} stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" />;
    }
    if (type === 'dizzy') {
      // 漩涡眼：三层嵌套圆弧近似螺旋
      return (
        <path
          d={`M ${cx + 7} 112 a 7 7 0 1 0 -14 0 a 4.5 4.5 0 1 0 9 0 a 2 2 0 1 0 -4 0`}
          stroke="#fff"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
      );
    }
    const dx = type === 'look' ? 4 : 0;
    return (
      <>
        <circle cx={cx + dx} cy={112} r={7} fill="#fff" />
        <circle cx={cx + dx + 2} cy={110} r={2.2} fill="#fff" opacity="0.9" />
      </>
    );
  };
  return (
    <g>
      {patch(78)}
      {patch(122)}
      {eyeball(78)}
      {eyeball(122)}
    </g>
  );
}

function Mouth({ type }) {
  switch (type) {
    case 'open':
      return <path d="M 90 145 Q 100 162 110 145 Q 100 152 90 145 Z" fill="#e8617a" stroke="#26303f" strokeWidth="2" />;
    case 'smile':
      return <path d="M 88 143 Q 100 156 112 143" stroke="#26303f" strokeWidth="3.5" fill="none" strokeLinecap="round" />;
    case 'smallSmile':
      return <path d="M 92 144 Q 100 151 108 144" stroke="#26303f" strokeWidth="3" fill="none" strokeLinecap="round" />;
    case 'wavy':
      // 波浪嘴：晕乎乎的感觉
      return <path d="M 90 146 Q 95 141 100 146 Q 105 151 110 146" stroke="#26303f" strokeWidth="3" fill="none" strokeLinecap="round" />;
    case 'flat':
    default:
      return <line x1="92" y1="146" x2="108" y2="146" stroke="#26303f" strokeWidth="3" strokeLinecap="round" />;
  }
}

export default function Xiaomo({
  expression = 'happy',
  stage = 1,
  size = 160,
  animate = true,
}) {
  const face = FACES[expression] ?? FACES.happy;
  const st = STAGES[stage] ?? STAGES[1];

  // 待机呼吸：整体轻微缩放。眨眼由 CSS 动画在眼睛层做（open 类表情才眨）。
  const breathe = animate
    ? { scale: [1, 1.03, 1], transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' } }
    : {};

  // 欢呼/庆祝的跳动：cheer 跳一下，celebrate 循环跳。叠加在呼吸层内层，互不冲突。
  const hop =
    animate && expression === 'cheer'
      ? { y: [0, -14, 0], transition: { duration: 0.5, repeat: 1, ease: 'easeOut' } }
      : animate && expression === 'celebrate'
        ? { y: [0, -18, 0], transition: { duration: 0.6, repeat: Infinity, ease: 'easeOut' } }
        : {};

  // 欢呼/庆祝时把手举起来（平时垂在身体两侧）。
  const armsUp = expression === 'cheer' || expression === 'celebrate';
  // 晕：头微微歪向一边。
  const headTilt = expression === 'dizzy' ? 'rotate(-10 100 118)' : undefined;

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 200 210"
      role="img"
      aria-label="小墨"
      animate={breathe}
      style={{ overflow: 'visible' }}
    >
      {/* 厚涂：脸/身体轻微径向明暗做体积，配色不变但更有立体感 */}
      <defs>
        <radialGradient id="moBody" cx="42%" cy="34%" r="72%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#eef1f6" />
        </radialGradient>
        <radialGradient id="moFace" cx="42%" cy="32%" r="74%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e9edf4" />
        </radialGradient>
      </defs>

      {/* 跳动层：cheer/celebrate 时整体上跳 */}
      <motion.g animate={hop}>
      {/* 身体 */}
      <g transform={`translate(100 175) scale(${st.bodyScale}) translate(-100 -175)`}>
        <ellipse cx="100" cy="180" rx="46" ry="34" fill="url(#moBody)" stroke="#26303f" strokeWidth="3.5" />
        {/* 手脚（黑） */}
        <ellipse cx="66" cy="192" rx="14" ry="11" fill="#26303f" />
        <ellipse cx="134" cy="192" rx="14" ry="11" fill="#26303f" />
        <ellipse cx="78" cy="150" rx="12" ry="16" fill="#26303f" transform={armsUp ? 'rotate(-115 78 150)' : 'rotate(-20 78 150)'} />
        <ellipse cx="122" cy="150" rx="12" ry="16" fill="#26303f" transform={armsUp ? 'rotate(115 122 150)' : 'rotate(20 122 150)'} />
      </g>

      {/* 围巾（阶段 2、3） */}
      {st.hasScarf && (
        <path d="M 62 138 Q 100 152 138 138 L 134 126 Q 100 138 66 126 Z" fill="#FF7FA6" stroke="#26303f" strokeWidth="2.5" />
      )}

      {/* 头 */}
      <g transform={headTilt}>
        {/* 耳朵（黑） */}
        <circle cx="62" cy="70" r={18 * st.earScale} fill="#26303f" />
        <circle cx="138" cy="70" r={18 * st.earScale} fill="#26303f" />
        {/* 脸（白，径向体积） */}
        <ellipse cx="100" cy="110" rx="58" ry="54" fill="url(#moFace)" stroke="#26303f" strokeWidth="3.5" />
        {/* 腮红（对比拉高） */}
        {face.blush && (
          <>
            <ellipse cx="58" cy="130" rx="11" ry="7" fill="#ff9db7" opacity="0.9" />
            <ellipse cx="142" cy="130" rx="11" ry="7" fill="#ff9db7" opacity="0.9" />
          </>
        )}
        <Eyes type={face.eye} />
        {/* 鼻子 */}
        <ellipse cx="100" cy="132" rx="6" ry="4.5" fill="#26303f" />
        <Mouth type={face.mouth} />
      </g>
      </motion.g>
    </motion.svg>
  );
}
