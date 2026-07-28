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

// 大头奶团子风：黑眼圈更大更圆、眼珠水汪汪（大高光 + 小高光 + 下缘提亮弧），神态靠 type 切换。
function Eyes({ type }) {
  // 黑眼圈：圆润的桃形斑（不再是生硬椭圆），略微内八朝鼻子。
  const patch = (cx) => {
    const dir = cx < 100 ? -1 : 1;
    return (
      <ellipse
        cx={cx}
        cy={113}
        rx={24}
        ry={28}
        fill="#2b3442"
        transform={`rotate(${dir * 10} ${cx} 113)`}
      />
    );
  };
  const eyeball = (cx) => {
    if (type === 'closed') {
      // 睡觉/满足：下弯的月牙闭眼，睫毛感更软
      return <path d={`M ${cx - 12} 110 Q ${cx} 121 ${cx + 12} 110`} stroke="#fff" strokeWidth="3.5" fill="none" strokeLinecap="round" />;
    }
    if (type === 'happy') {
      // 上弯月牙开心眼（更圆润的笑眼）
      return <path d={`M ${cx - 11} 118 Q ${cx} 103 ${cx + 11} 118`} stroke="#fff" strokeWidth="4.5" fill="none" strokeLinecap="round" />;
    }
    if (type === 'dizzy') {
      // 漩涡眼
      return (
        <path
          d={`M ${cx + 8} 113 a 8 8 0 1 0 -16 0 a 5 5 0 1 0 10 0 a 2.2 2.2 0 1 0 -4.4 0`}
          stroke="#fff"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
      );
    }
    // 睁眼（open/look）：水汪汪大眼珠 —— 大眼白 + 大高光 + 小高光 + 下缘反光弧。
    const dx = type === 'look' ? 4 : 0;
    return (
      <g>
        <circle cx={cx + dx} cy={114} r={10.5} fill="#fff" />
        {/* 主高光（大，左上） */}
        <circle cx={cx + dx - 3} cy={109} r={4} fill="#fff" opacity="0.95" />
        {/* 副高光（小，右下）——两点高光是「水汪汪」的关键 */}
        <circle cx={cx + dx + 4} cy={118} r={2} fill="#fff" opacity="0.8" />
        {/* 下缘反光弧：眼珠底部一抹提亮，显得眼睛湿润有神 */}
        <path d={`M ${cx + dx - 6} 120 Q ${cx + dx} 124 ${cx + dx + 6} 120`} stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.55" />
      </g>
    );
  };
  return (
    <g>
      {patch(74)}
      {patch(126)}
      {eyeball(74)}
      {eyeball(126)}
    </g>
  );
}

// 嘴：小巧圆润，配合大头奶团子。
function Mouth({ type }) {
  switch (type) {
    case 'open':
      // 张嘴：圆润的小口 + 舌头
      return (
        <g>
          <path d="M 88 150 Q 100 168 112 150 Q 100 158 88 150 Z" fill="#e8617a" stroke="#2b3442" strokeWidth="2" />
          <ellipse cx="100" cy="158" rx="6" ry="3.5" fill="#ff9db7" />
        </g>
      );
    case 'smile':
      return <path d="M 89 148 Q 100 160 111 148" stroke="#2b3442" strokeWidth="3.5" fill="none" strokeLinecap="round" />;
    case 'smallSmile':
      return <path d="M 93 149 Q 100 155 107 149" stroke="#2b3442" strokeWidth="3" fill="none" strokeLinecap="round" />;
    case 'wavy':
      return <path d="M 90 151 Q 95 146 100 151 Q 105 156 110 151" stroke="#2b3442" strokeWidth="3" fill="none" strokeLinecap="round" />;
    case 'flat':
    default:
      return <path d="M 93 151 Q 100 154 107 151" stroke="#2b3442" strokeWidth="3" fill="none" strokeLinecap="round" />;
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
      {/* 身体：矮圆奶团子（比头小一圈，头大身小才萌） */}
      <g transform={`translate(100 182) scale(${st.bodyScale}) translate(-100 -182)`}>
        <ellipse cx="100" cy="184" rx="42" ry="32" fill="url(#moBody)" stroke="#2b3442" strokeWidth="3.5" />
        {/* 脚（黑，短圆） */}
        <ellipse cx="76" cy="200" rx="15" ry="11" fill="#2b3442" />
        <ellipse cx="124" cy="200" rx="15" ry="11" fill="#2b3442" />
        {/* 手（黑，短圆；举手时抬起） */}
        <ellipse cx="66" cy="168" rx="13" ry="15" fill="#2b3442" transform={armsUp ? 'rotate(-118 66 168)' : 'rotate(-14 66 168)'} />
        <ellipse cx="134" cy="168" rx="13" ry="15" fill="#2b3442" transform={armsUp ? 'rotate(118 134 168)' : 'rotate(14 134 168)'} />
      </g>

      {/* 围巾（阶段 2、3） */}
      {st.hasScarf && (
        <path d="M 60 148 Q 100 162 140 148 L 136 135 Q 100 148 64 135 Z" fill="#FF7FA6" stroke="#2b3442" strokeWidth="2.5" />
      )}

      {/* 头：大而圆（奶团子的核心——头几乎和身体一样宽，占画面主体） */}
      <g transform={headTilt}>
        {/* 耳朵（黑，大而圆，带内耳浅色让它软一点） */}
        <circle cx="58" cy="62" r={21 * st.earScale} fill="#2b3442" />
        <circle cx="142" cy="62" r={21 * st.earScale} fill="#2b3442" />
        <circle cx="58" cy="64" r={10 * st.earScale} fill="#3d4a5c" />
        <circle cx="142" cy="64" r={10 * st.earScale} fill="#3d4a5c" />
        {/* 脸（白，大圆脸，径向体积） */}
        <ellipse cx="100" cy="108" rx="66" ry="62" fill="url(#moFace)" stroke="#2b3442" strokeWidth="3.5" />
        {/* 腮红（大眼下方，软糖粉） */}
        {face.blush && (
          <>
            <ellipse cx="52" cy="132" rx="13" ry="8" fill="#ffabc4" opacity="0.85" />
            <ellipse cx="148" cy="132" rx="13" ry="8" fill="#ffabc4" opacity="0.85" />
          </>
        )}
        <Eyes type={face.eye} />
        {/* 鼻子：小圆钮 */}
        <ellipse cx="100" cy="138" rx="6.5" ry="5" fill="#2b3442" />
        <Mouth type={face.mouth} />
      </g>
      </motion.g>
    </motion.svg>
  );
}
