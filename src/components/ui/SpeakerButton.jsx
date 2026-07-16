// 卡通喇叭朗读钮（设计 skill §3「视听可供性」的统一实现）：
// 就绪后周期性「招手」抖动，主动吸引小朋友点按；按下果冻压缩；声波轻闪。
// 全站所有「点我听发音」的入口统一用它，禁止再出现静态 🔊 emoji 或各页自造喇叭。
//
// props:
//   onClick: 播放回调（通常 () => speak(text)）
//   size: 'sm' | 'md' | 'lg'   sm=64px 行内 / md=88px 步骤主喇叭 / lg=120px 题干主角
//   label: 无障碍标签，默认「播放读音」
//   wiggle: 是否周期性招手（默认开；同屏多只时可关避免吵）
import { motion } from 'framer-motion';

// 装饰用小喇叭字形（非按钮）：给本身已可点读的元素（词条 pill 等）做「会出声」暗示。
// 跟随 currentColor，尺寸小、不抢戏；不可嵌套按钮时用它替代 SpeakerButton。
export function SpeakerGlyph({ size = 18, className = '' }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      aria-hidden="true"
      className={className}
      style={{ flexShrink: 0 }}
    >
      <rect x="5" y="17.5" width="10" height="13" rx="3" fill="currentColor" />
      <path
        d="M13.5 18.5 L26 9 Q28 7.8 28 10.4 V37.6 Q28 40.2 26 39 L13.5 29.5 Z"
        fill="currentColor"
      />
      <path
        d="M33 17 Q38 24 33 31"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M37.5 12.5 Q45 24 37.5 35.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}

export default function SpeakerButton({
  onClick,
  size = 'md',
  label = '播放读音',
  wiggle = true,
  className = '',
}) {
  return (
    <motion.button
      type="button"
      className={`spk-btn spk-btn--${size} ${className}`}
      aria-label={label}
      onClick={onClick}
      animate={wiggle ? { rotate: [0, -10, 8, -5, 0], scale: [1, 1.08, 1.05, 1.07, 1] } : undefined}
      transition={
        wiggle
          ? { duration: 0.7, repeat: Infinity, repeatDelay: 2, ease: 'easeInOut' }
          : undefined
      }
      whileTap={{ scale: 0.86, rotate: -6 }}
    >
      <svg viewBox="0 0 48 48" aria-hidden="true" className="spk-icon">
        {/* 喇叭箱体 + 号角 */}
        <rect x="5" y="17.5" width="10" height="13" rx="3" fill="#fff" />
        <path
          d="M13.5 18.5 L26 9 Q28 7.8 28 10.4 V37.6 Q28 40.2 26 39 L13.5 29.5 Z"
          fill="#fff"
        />
        {/* 声波（轻闪，CSS 驱动） */}
        <path
          className="spk-wave"
          d="M33 17 Q38 24 33 31"
          fill="none"
          stroke="#fff"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path
          className="spk-wave w2"
          d="M37.5 12.5 Q45 24 37.5 35.5"
          fill="none"
          stroke="#fff"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      </svg>
    </motion.button>
  );
}
