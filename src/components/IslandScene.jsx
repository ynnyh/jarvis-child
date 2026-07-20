// 海岛场景（首页门面）：一张分层 SVG 矢量海岛，建筑即功能入口。
// 参考洪恩识字首页布局，但走「扁平/半扁平矢量卡通」风（纯代码，无插画素材）。
//
// 结构（从后到前）：
//   1. 天空渐变 + 太阳 + 漂浮云
//   2. 远景海平线 + 海水（多层色带 + 波光）
//   3. 岛屿群（沙滩描边 + 草地 + 棕榈树点缀）
//   4. 彩蛋与装饰层（HTML）：6 处纯趣味彩蛋 + 商店已购装饰 + 每日惊喜礼物盒
//   5. 建筑入口：中央识字塔（小墨坐塔顶）、绘本馆、游乐园、叫叫学院、商城、字库
//
// 入口用 <Building> 渲染为可点击热区（button），点击回调由父组件传入（导航）。
// 全部相对坐标基于 1000×620 的 viewBox，用 preserveAspectRatio 铺满容器。
//
// 阶段 5 焕活：
//   - 彩蛋/装饰/礼物全部走 HTML 绝对定位层（.island-decor），锚点都是百分比常量表，
//     微调位置只改下面的 EGG_SPOTS / DECOR_ANCHORS / GIFT_SPOTS；
//   - 动画全部 CSS transform/opacity，不用 JS 逐帧，可反复触发（播完复位）。
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store/useGameStore.js';
import { useSound } from '../hooks/useSound.js';
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
      <g stroke="#cfe8f5" strokeWidth="2.5">
        <ellipse cx="0" cy="0" rx="46" ry="30" fill="#fff" />
        <ellipse cx="34" cy="8" rx="34" ry="24" fill="#fff" />
        <ellipse cx="-34" cy="8" rx="30" ry="22" fill="#fff" />
      </g>
      <rect x="-64" y="6" width="128" height="20" rx="10" fill="#fff" />
    </motion.g>
  );
}

// 棕榈树：弯曲树干 + 几片叶子（纯路径）。厚涂：深青墨轮廓 + 深浅叶片。
function Palm({ x, y, scale = 1, flip = false }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})`}>
      <path d="M0 0 Q -6 -34 4 -60" stroke="#7a4a2c" strokeWidth="8" fill="none" strokeLinecap="round" />
      <path d="M0 0 Q -6 -34 4 -60" stroke="#a06a42" strokeWidth="4" fill="none" strokeLinecap="round" />
      <g fill="#39a06f" stroke="#217a52" strokeWidth="2.5" strokeLinejoin="round">
        <path d="M4 -60 Q -26 -74 -46 -60 Q -22 -58 4 -60 Z" />
        <path d="M4 -60 Q 30 -78 52 -62 Q 24 -58 4 -60 Z" />
        <path d="M4 -60 Q -14 -86 -34 -84 Q -8 -70 4 -60 Z" />
        <path d="M4 -60 Q 20 -88 40 -88 Q 14 -72 4 -60 Z" />
        <path d="M4 -60 Q 4 -92 4 -96 Q 12 -74 4 -60 Z" fill="#4cc088" />
      </g>
    </g>
  );
}

// 一丛小树（学院/森林点缀）。厚涂：深青墨轮廓。
function Bush({ x, y, scale = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} stroke="#2f8a5c" strokeWidth="2.5" strokeLinejoin="round">
      <ellipse cx="-16" cy="6" rx="18" ry="16" fill="#43a870" />
      <ellipse cx="16" cy="6" rx="18" ry="16" fill="#43a870" />
      <ellipse cx="0" cy="0" rx="26" ry="22" fill="#57bd86" />
    </g>
  );
}

// ============ 阶段 5：彩蛋 / 装饰 / 礼物锚点表 ============
// 坐标均为场景容器百分比（left/top），与建筑定位同坐标系；微调位置只改这里。

// 彩蛋锚点：6 处纯趣味小元素（无奖励）。
const EGG_SPOTS = {
  cloud: { left: '78%', top: '12%' }, // ☁️ 云：右上角天空
  bird: { left: '40%', top: '15%' }, // 🐦 飞鸟：中天
  balloon: { left: '60%', top: '33%' }, // 🎈 气球：塔右上方半空
  frog: { left: '11%', top: '76%' }, // 🐸 青蛙：左岛滩边荷叶上
  butterfly: { left: '31%', top: '70%' }, // 🦋 蝴蝶：字库旁树丛前
  crab: { left: '74%', top: '80%' }, // 🦀 螃蟹：中央岛右侧沙滩
};

// 商店装饰锚点：买了才出现（id 与 shop.js 的 decor 商品一致）。
const DECOR_ANCHORS = {
  windmill: { left: '41%', top: '48%' }, // 🌀 风车：中央岛高处（塔左后方"山顶"）
  flags: { left: '21%', top: '54%' }, // 🎏 彩旗串：左岛两棵棕榈之间
  boat: { left: '63%', top: '89%' }, // ⛵ 小船：前景海面
  lighthouse: { left: '90%', top: '53%' }, // 🗼 灯塔：右岛边缘
};

// 每日惊喜礼物盒候选锚点：每天随机挑一处出现（避开建筑热区）。
const GIFT_SPOTS = [
  { left: '58%', top: '72%' }, // 中央岛右侧草地
  { left: '40%', top: '76%' }, // 中央岛左前沙滩
  { left: '26%', top: '77%' }, // 左岛前滩
  { left: '87%', top: '82%' }, // 右岛前滩
  { left: '8%', top: '82%' }, // 左岛最左滩角
];

// 装饰 id -> emoji（与 shop.js 对齐，icon 以 shop.js 为准这里只做渲染映射）。
const DECOR_EMOJI = { windmill: '🌀', flags: '🎏', boat: '⛵', lighthouse: '🗼' };

// 彩蛋通用状态：trigger 播一次性动效，ms 后复位（动画中不重复触发，可反复玩）。
function useReplay() {
  const [playing, setPlaying] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const trigger = useCallback(
    (ms) => {
      if (playing) return; // 动画还没播完，忽略连点
      setPlaying(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setPlaying(false), ms);
    },
    [playing]
  );
  return [playing, trigger];
}

// 彩蛋底座：外层 button 负责定位 + 一次性大动效（transition/keyframes 都行），
// 内层 .egg-inner 负责常驻 idle 小动作——两层分离，transform 互不覆盖。
function Egg({ spot, emoji, label, className = '', playing, onTap, children }) {
  return (
    <button
      className={`island-egg ${className} ${playing ? 'is-playing' : ''}`}
      style={{ left: spot.left, top: spot.top }}
      onClick={onTap}
      aria-label={label}
    >
      <span className="egg-inner">{emoji}</span>
      {children}
    </button>
  );
}

// 6 处彩蛋：云/飞鸟/气球/青蛙/蝴蝶/螃蟹。纯趣味无奖励，各自配音效。
function EasterEggs() {
  const sound = useSound();
  const [cloudOn, cloudGo] = useReplay();
  const [birdOn, birdGo] = useReplay();
  const [balloonOn, balloonGo] = useReplay();
  const [frogOn, frogGo] = useReplay();
  const [butterflyOn, butterflyGo] = useReplay();
  const [crabOn, crabGo] = useReplay();

  return (
    <>
      {/* ☁️ 云：点了下几滴雨（CSS 粒子 1s 消散） */}
      <Egg
        spot={EGG_SPOTS.cloud}
        emoji="☁️"
        label="云朵"
        className="egg-cloud"
        playing={cloudOn}
        onTap={() => { sound.splash(); cloudGo(1000); }}
      >
        {cloudOn && (
          <span className="egg-rain" aria-hidden="true">
            {[-16, -7, 2, 11, 20].map((x, i) => (
              <span key={i} style={{ left: x, animationDelay: `${i * 0.08}s` }} />
            ))}
          </span>
        )}
      </Egg>

      {/* 🐦 飞鸟：点了加速飞走，过几秒飞回 */}
      <Egg
        spot={EGG_SPOTS.bird}
        emoji="🐦"
        label="飞鸟"
        className="egg-bird"
        playing={birdOn}
        onTap={() => { sound.swoosh(); birdGo(3500); }}
      />

      {/* 🎈 气球：点了升空飘走，之后慢慢飘回 */}
      <Egg
        spot={EGG_SPOTS.balloon}
        emoji="🎈"
        label="气球"
        className="egg-balloon"
        playing={balloonOn}
        onTap={() => { sound.pop(); balloonGo(5200); }}
      />

      {/* 🪷 荷叶（纯装饰，青蛙的站台） */}
      <span className="egg-lily" style={{ left: EGG_SPOTS.frog.left, top: EGG_SPOTS.frog.top }} aria-hidden="true">
        🪷
      </span>
      {/* 🐸 青蛙：点了跳一下 */}
      <Egg
        spot={EGG_SPOTS.frog}
        emoji="🐸"
        label="青蛙"
        className="egg-frog"
        playing={frogOn}
        onTap={() => { sound.pop(); frogGo(700); }}
      />

      {/* 🦋 蝴蝶：点了扑腾飞一小段再落回 */}
      <Egg
        spot={EGG_SPOTS.butterfly}
        emoji="🦋"
        label="蝴蝶"
        className="egg-butterfly"
        playing={butterflyOn}
        onTap={() => { sound.pluck(); butterflyGo(1400); }}
      />

      {/* 🦀 螃蟹：点了横爬一小段 */}
      <Egg
        spot={EGG_SPOTS.crab}
        emoji="🦀"
        label="螃蟹"
        className="egg-crab"
        playing={crabOn}
        onTap={() => { sound.tap(); crabGo(900); }}
      />
    </>
  );
}

export default function IslandScene({ onEnter, worlds = [], showGift = false, onGift }) {
  // worlds: [{ theme, done, total, complete }]，用于门牌进度（可选）。
  // 已购海岛装饰（owned 旧数据可能 undefined，?? 防御）。
  const owned = useGameStore((s) => s.owned) ?? {};
  // 礼物盒锚点：本天内随机一处（组件挂载时定一次即可，一天只出现一次）。
  const [giftSpot] = useState(() => GIFT_SPOTS[Math.floor(Math.random() * GIFT_SPOTS.length)]);

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
            <stop offset="0%" stopColor="#5fb8ee" />
            <stop offset="45%" stopColor="#8fd4f5" />
            <stop offset="100%" stopColor="#d8f2fc" />
          </linearGradient>
          <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3fa9d6" />
            <stop offset="55%" stopColor="#2f97c8" />
            <stop offset="100%" stopColor="#217eb0" />
          </linearGradient>
          <radialGradient id="sun" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff6c8" />
            <stop offset="60%" stopColor="#ffe37a" />
            <stop offset="100%" stopColor="#ffcf4a" />
          </radialGradient>
          <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8fe07a" />
            <stop offset="100%" stopColor="#4fae55" />
          </linearGradient>
          <linearGradient id="sand" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f8e6ad" />
            <stop offset="100%" stopColor="#e7c877" />
          </linearGradient>
          <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="7" stdDeviation="9" floodColor="#1f5b78" floodOpacity="0.26" />
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

        {/* 3) 岛屿群 —— 三块主岛（中央大岛 + 左右两岛）。
             厚涂：沙滩渐变 + 深青墨轮廓，草地压深底色描边，做体积。 */}
        {/* 左岛（游乐园） */}
        <g filter="url(#soft)">
          <ellipse cx="200" cy="470" rx="180" ry="70" fill="url(#sand)" stroke="#c69a4e" strokeWidth="4" />
          <ellipse cx="200" cy="452" rx="158" ry="58" fill="url(#grass)" stroke="#3f9147" strokeWidth="4" />
        </g>
        {/* 右岛（学院） */}
        <g filter="url(#soft)">
          <ellipse cx="820" cy="486" rx="170" ry="66" fill="url(#sand)" stroke="#c69a4e" strokeWidth="4" />
          <ellipse cx="820" cy="468" rx="148" ry="54" fill="url(#grass)" stroke="#3f9147" strokeWidth="4" />
        </g>
        {/* 中央大岛（识字塔 + 绘本馆） */}
        <g filter="url(#soft)">
          <ellipse cx="500" cy="500" rx="300" ry="96" fill="url(#sand)" stroke="#c69a4e" strokeWidth="4" />
          <ellipse cx="500" cy="476" rx="270" ry="80" fill="url(#grass)" stroke="#3f9147" strokeWidth="4" />
        </g>

        {/* 树木点缀 */}
        <Palm x={92} y={452} scale={0.9} />
        <Palm x={318} y={456} scale={0.8} flip />
        <Palm x={706} y={470} scale={0.85} />
        <Palm x={946} y={476} scale={0.8} flip />
        <Bush x={330} y={500} scale={0.9} />
        <Bush x={690} y={512} scale={0.9} />
      </svg>

      {/* 4) 彩蛋与装饰层（HTML 绝对定位覆盖在 SVG 上）。
           层本身 pointer-events:none，彩蛋/礼物按钮各自开启，不与建筑热区冲突。 */}
      <div className="island-decor">
        <EasterEggs />

        {/* 商店已购装饰上岛（锚点见 DECOR_ANCHORS 常量表） */}
        {Object.entries(DECOR_ANCHORS).map(([id, spot]) =>
          owned[id] ? (
            <span
              key={id}
              className={`island-decor-item decor-${id}`}
              style={{ left: spot.left, top: spot.top }}
              aria-hidden="true"
            >
              <span className="decor-inner">{DECOR_EMOJI[id]}</span>
            </span>
          ) : null
        )}

        {/* 每日惊喜礼物盒：呼吸发光，点击由父组件发奖（每天一次） */}
        {showGift && (
          <button
            className="island-gift"
            style={{ left: giftSpot.left, top: giftSpot.top }}
            onClick={onGift}
            aria-label="每日惊喜礼物"
          >
            🎁
          </button>
        )}
      </div>

      {/* 5) 建筑入口层（HTML 绝对定位覆盖在 SVG 上，便于做交互与文字） */}
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
            <text className="lib-book" x="60" y="38" textAnchor="middle" fontSize="20">📖</text>
          </svg>
        </Building>

        {/* 游乐园（左岛，游戏入口）。摩天轮缓慢转动（idle 微动效） */}
        <Building className="b-park" label="游乐园" onClick={() => onEnter?.('games')}>
          <svg viewBox="0 0 120 120" className="b-svg" aria-hidden="true">
            {/* 摩天轮转动部分（轮缘 + 辐条 + 座舱），轴心不动 */}
            <g className="wheel-rotor">
              <circle cx="60" cy="52" r="40" fill="none" stroke="#ff9ec4" strokeWidth="5" />
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
            </g>
            <circle cx="60" cy="52" r="8" fill="#ff7fb0" />
            <rect x="52" y="92" width="16" height="24" fill="#c98a5a" />
          </svg>
        </Building>

        {/* 叫叫学院（右岛，复习入口）。屋顶小旗飘动（idle 微动效） */}
        <Building className="b-school" label="学院" onClick={() => onEnter?.('review')}>
          <svg viewBox="0 0 120 110" className="b-svg" aria-hidden="true">
            <rect x="24" y="44" width="72" height="52" rx="6" fill="#c9b6ff" stroke="#9a7de0" strokeWidth="4" />
            <path d="M18 44 L60 18 L102 44 Z" fill="#b39cf7" stroke="#9a7de0" strokeWidth="4" strokeLinejoin="round" />
            <rect x="54" y="8" width="6" height="16" fill="#9a7de0" />
            <path className="flag-wave" d="M60 8 L78 12 L60 18 Z" fill="#ff6b6b" />
            <rect x="52" y="66" width="16" height="30" rx="3" fill="#fff" stroke="#9a7de0" strokeWidth="3" />
          </svg>
        </Building>

        {/* 商城（中央岛右坡，商店入口）。门口挂牌轻轻摇晃（idle 微动效） */}
        <Building className="b-shop" label="商城" onClick={() => onEnter?.('shop')}>
          <svg viewBox="0 0 120 110" className="b-svg" aria-hidden="true">
            <rect x="22" y="46" width="76" height="50" rx="8" fill="#ffe9d6" stroke="#e0803c" strokeWidth="4" />
            {/* 条纹雨棚 */}
            <path d="M14 46 L60 20 L106 46 Z" fill="#ff8a5c" stroke="#e0803c" strokeWidth="4" strokeLinejoin="round" />
            <path d="M34 46 L60 20 L86 46 Z" fill="#ffd166" stroke="#e0803c" strokeWidth="3" strokeLinejoin="round" />
            <rect x="50" y="68" width="20" height="28" rx="4" fill="#fff" stroke="#e0803c" strokeWidth="3" />
            {/* 挂牌 */}
            <text className="shop-sign" x="60" y="62" textAnchor="middle" fontSize="18">🛍️</text>
          </svg>
        </Building>

        {/* 字库（中央岛左坡，收集册入口） */}
        <Building className="b-collection" label="字库" onClick={() => onEnter?.('collection')}>
          <svg viewBox="0 0 120 110" className="b-svg" aria-hidden="true">
            <rect x="24" y="46" width="72" height="50" rx="8" fill="#d8f5e6" stroke="#2f9a6c" strokeWidth="4" />
            <path d="M16 46 L60 20 L104 46 Z" fill="#4ecb91" stroke="#2f9a6c" strokeWidth="4" strokeLinejoin="round" />
            <rect x="50" y="68" width="20" height="28" rx="4" fill="#fff" stroke="#2f9a6c" strokeWidth="3" />
            {/* 圆形字牌 */}
            <circle cx="60" cy="44" r="14" fill="#fffdf8" stroke="#2f9a6c" strokeWidth="3" />
            <text x="60" y="50" textAnchor="middle" fontSize="17" fill="#1f8a5a" fontWeight="bold">字</text>
          </svg>
        </Building>
      </div>
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
