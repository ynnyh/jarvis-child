// 海岛场景（首页门面）：一张分层 SVG 矢量海岛，建筑即功能入口。
// 参考洪恩识字首页布局，但走「扁平/半扁平矢量卡通」风（纯代码，无插画素材）。
//
// 结构（从后到前）：
//   1. 天空渐变 + 太阳 + 漂浮云
//   2. 远景海平线 + 海水（多层色带 + 波光）
//   3. 岛屿群（沙滩描边 + 草地 + 棕榈树点缀）
//   4. 建筑入口：中央识字塔（小墨坐塔顶）、绘本馆、游乐园、叫叫学院、商城、字库
//
// 入口用 <Building> 渲染为可点击热区（button），点击回调由父组件传入（导航）。
// 全部相对坐标基于 1000×620 的 viewBox，用 preserveAspectRatio 铺满容器。
import { motion } from 'framer-motion';
import Xiaomo from './mascot/Xiaomo.jsx';

// 单朵云：一组交叠圆 + 底部平边，柔和投影。
function Cloud({ x, y, scale = 1, dur = 14, drift = 30 }) {
  return (
    <motion.g
      animate={{ x: [0, drift, 0] }}
      transition={{ duration: dur, repeat: Infinity, ease: 'easeInOut' }}
      style={{ transformBox: 'fill-box' }}
      transform={`translate(${x} ${y}) scale(${scale})`}
      opacity="0.95"
    >
      <ellipse cx="0" cy="0" rx="46" ry="30" fill="#fff" />
      <ellipse cx="34" cy="8" rx="34" ry="24" fill="#fff" />
      <ellipse cx="-34" cy="8" rx="30" ry="22" fill="#fff" />
      <rect x="-64" y="6" width="128" height="20" rx="10" fill="#fff" />
    </motion.g>
  );
}

// 棕榈树：弯曲树干 + 几片叶子（纯路径）。
function Palm({ x, y, scale = 1, flip = false }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})`}>
      <path d="M0 0 Q -6 -34 4 -60" stroke="#8a5a3c" strokeWidth="7" fill="none" strokeLinecap="round" />
      <g fill="#3fae7a">
        <path d="M4 -60 Q -26 -74 -46 -60 Q -22 -58 4 -60 Z" />
        <path d="M4 -60 Q 30 -78 52 -62 Q 24 -58 4 -60 Z" />
        <path d="M4 -60 Q -14 -86 -34 -84 Q -8 -70 4 -60 Z" />
        <path d="M4 -60 Q 20 -88 40 -88 Q 14 -72 4 -60 Z" />
        <path d="M4 -60 Q 4 -92 4 -96 Q 12 -74 4 -60 Z" fill="#4cc088" />
      </g>
    </g>
  );
}

// 一丛小树（学院/森林点缀）。
function Bush({ x, y, scale = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="0" cy="0" rx="26" ry="22" fill="#57bd86" />
      <ellipse cx="-16" cy="6" rx="18" ry="16" fill="#4bb079" />
      <ellipse cx="16" cy="6" rx="18" ry="16" fill="#4bb079" />
    </g>
  );
}

export default function IslandScene({ onEnter, worlds = [] }) {
  // worlds: [{ theme, done, total, complete }]，用于门牌进度（可选）。
  return (
    <div className="island-scene">
      <svg
        viewBox="0 0 1000 620"
        preserveAspectRatio="xMidYMid slice"
        className="island-svg"
        role="img"
        aria-label="识字乐园"
      >
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9fe0ff" />
            <stop offset="55%" stopColor="#c8f0ff" />
            <stop offset="100%" stopColor="#eafaff" />
          </linearGradient>
          <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5cc6f2" />
            <stop offset="100%" stopColor="#3aa8e0" />
          </linearGradient>
          <radialGradient id="sun" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff6c8" />
            <stop offset="60%" stopColor="#ffe37a" />
            <stop offset="100%" stopColor="#ffd85a" />
          </radialGradient>
          <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8fe0a0" />
            <stop offset="100%" stopColor="#5cc47f" />
          </linearGradient>
          <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#2b6b8a" floodOpacity="0.18" />
          </filter>
        </defs>

        {/* 1) 天空 */}
        <rect x="0" y="0" width="1000" height="440" fill="url(#sky)" />
        {/* 太阳 + 光晕 */}
        <circle cx="120" cy="96" r="90" fill="#fff3b0" opacity="0.5" />
        <circle cx="120" cy="96" r="54" fill="url(#sun)" />
        {/* 云 */}
        <Cloud x={330} y={70} scale={0.9} dur={16} drift={26} />
        <Cloud x={720} y={54} scale={1.15} dur={20} drift={-34} />
        <Cloud x={560} y={130} scale={0.65} dur={13} drift={20} />

        {/* 2) 海水 */}
        <rect x="0" y="400" width="1000" height="220" fill="url(#sea)" />
        {/* 波光：几道横向亮线 */}
        <g stroke="#bfeaff" strokeWidth="4" strokeLinecap="round" opacity="0.6">
          <line x1="80" y1="470" x2="180" y2="470" />
          <line x1="820" y1="500" x2="930" y2="500" />
          <line x1="420" y1="560" x2="540" y2="560" />
          <line x1="220" y1="540" x2="300" y2="540" />
        </g>

        {/* 3) 岛屿群 —— 三块主岛（中央大岛 + 左右两岛） */}
        {/* 左岛（游乐园） */}
        <g filter="url(#soft)">
          <ellipse cx="200" cy="470" rx="180" ry="70" fill="#f6e2a8" />
          <ellipse cx="200" cy="452" rx="158" ry="58" fill="url(#grass)" />
        </g>
        {/* 右岛（学院） */}
        <g filter="url(#soft)">
          <ellipse cx="820" cy="486" rx="170" ry="66" fill="#f6e2a8" />
          <ellipse cx="820" cy="468" rx="148" ry="54" fill="url(#grass)" />
        </g>
        {/* 中央大岛（识字塔 + 绘本馆） */}
        <g filter="url(#soft)">
          <ellipse cx="500" cy="500" rx="300" ry="96" fill="#f6e2a8" />
          <ellipse cx="500" cy="476" rx="270" ry="80" fill="url(#grass)" />
        </g>

        {/* 树木点缀 */}
        <Palm x={92} y={452} scale={0.9} />
        <Palm x={318} y={456} scale={0.8} flip />
        <Palm x={706} y={470} scale={0.85} />
        <Palm x={946} y={476} scale={0.8} flip />
        <Bush x={330} y={500} scale={0.9} />
        <Bush x={690} y={512} scale={0.9} />
      </svg>

      {/* 4) 建筑入口层（HTML 绝对定位覆盖在 SVG 上，便于做交互与文字） */}
      <div className="island-buildings">
        {/* 中央识字塔（主入口，小墨坐塔顶） */}
        <Building
          className="b-tower"
          label="开始识字"
          primary
          onClick={() => onEnter?.('learn')}
        >
          <svg viewBox="0 0 160 200" className="b-svg" aria-hidden="true">
            {/* 塔身 */}
            <rect x="46" y="86" width="68" height="86" rx="14" fill="#ffd08a" stroke="#e08b3c" strokeWidth="4" />
            <rect x="56" y="112" width="20" height="30" rx="6" fill="#8ad4ff" stroke="#4aa6dd" strokeWidth="3" />
            <rect x="84" y="112" width="20" height="30" rx="6" fill="#8ad4ff" stroke="#4aa6dd" strokeWidth="3" />
            {/* 平台 */}
            <ellipse cx="80" cy="86" rx="52" ry="16" fill="#ffe0a8" stroke="#e08b3c" strokeWidth="4" />
            {/* 底座 */}
            <ellipse cx="80" cy="172" rx="58" ry="16" fill="#f2b56a" stroke="#e08b3c" strokeWidth="4" />
          </svg>
          {/* 塔顶小墨 */}
          <div className="b-tower-mascot">
            <Xiaomo size={60} expression="cheer" animate />
          </div>
        </Building>

        {/* 绘本馆（中央岛前方） */}
        <Building className="b-library" label="绘本馆" onClick={() => onEnter?.('story')}>
          <svg viewBox="0 0 120 110" className="b-svg" aria-hidden="true">
            <path d="M12 44 L60 16 L108 44 Z" fill="#8ad4ff" stroke="#4aa6dd" strokeWidth="4" strokeLinejoin="round" />
            <rect x="20" y="44" width="80" height="52" rx="8" fill="#bfe8ff" stroke="#4aa6dd" strokeWidth="4" />
            <rect x="50" y="66" width="20" height="30" rx="4" fill="#fff" stroke="#4aa6dd" strokeWidth="3" />
            <text x="60" y="38" textAnchor="middle" fontSize="20">📖</text>
          </svg>
        </Building>

        {/* 游乐园（左岛，游戏入口） */}
        <Building className="b-park" label="游乐园" onClick={() => onEnter?.('games')}>
          <svg viewBox="0 0 120 120" className="b-svg" aria-hidden="true">
            {/* 摩天轮 */}
            <circle cx="60" cy="52" r="40" fill="none" stroke="#ff9ec4" strokeWidth="5" />
            <circle cx="60" cy="52" r="8" fill="#ff7fb0" />
            <g stroke="#ff9ec4" strokeWidth="4">
              <line x1="60" y1="52" x2="60" y2="12" /><line x1="60" y1="52" x2="60" y2="92" />
              <line x1="60" y1="52" x2="20" y2="52" /><line x1="60" y1="52" x2="100" y2="52" />
              <line x1="60" y1="52" x2="32" y2="24" /><line x1="60" y1="52" x2="88" y2="80" />
              <line x1="60" y1="52" x2="88" y2="24" /><line x1="60" y1="52" x2="32" y2="80" />
            </g>
            <g fill="#ffd166">
              <circle cx="60" cy="12" r="7" /><circle cx="60" cy="92" r="7" />
              <circle cx="20" cy="52" r="7" /><circle cx="100" cy="52" r="7" />
            </g>
            <rect x="52" y="92" width="16" height="24" fill="#c98a5a" />
          </svg>
        </Building>

        {/* 叫叫学院（右岛，复习入口） */}
        <Building className="b-school" label="学院" onClick={() => onEnter?.('review')}>
          <svg viewBox="0 0 120 110" className="b-svg" aria-hidden="true">
            <rect x="24" y="44" width="72" height="52" rx="6" fill="#c9b6ff" stroke="#9a7de0" strokeWidth="4" />
            <path d="M18 44 L60 18 L102 44 Z" fill="#b39cf7" stroke="#9a7de0" strokeWidth="4" strokeLinejoin="round" />
            <rect x="54" y="8" width="6" height="16" fill="#9a7de0" />
            <path d="M60 8 L78 12 L60 18 Z" fill="#ff6b6b" />
            <rect x="52" y="66" width="16" height="30" rx="3" fill="#fff" stroke="#9a7de0" strokeWidth="3" />
          </svg>
        </Building>
      </div>

      {/* 顶部功能小按钮（字库/商城/家长）—— 覆盖在场景四角，由父组件接管点击 */}
    </div>
  );
}

// 单个建筑入口：SVG 图形 + 底部铭牌文字，整体一个大热区按钮。
// 定位与动画分离：外层 div 用 CSS 定位（含 translate 居中），内层 motion.button
// 只做 scale/位移动画——否则 framer-motion 接管 transform 会覆盖掉定位用的
// translate(-50%,-50%)，导致点击/悬停瞬间元素跳位（这是「点击偏移」的根因）。
function Building({ className = '', label, children, onClick, primary = false }) {
  return (
    <div className={`island-building ${className}`}>
      <motion.button
        className={`island-building-btn ${primary ? 'is-primary' : ''}`}
        onClick={onClick}
        whileHover={{ scale: 1.05, y: -4 }}
        whileTap={{ scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 400, damping: 22 }}
      >
        {children}
        <span className={`building-plate ${primary ? 'plate-primary' : ''}`}>{label}</span>
      </motion.button>
    </div>
  );
}
