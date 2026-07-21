// 海岛大厅（首页门面）· 2.5D 立体舞台版。
// 目标：告别"平面 demo 感"——用纯 SVG/CSS/framer-motion 做出"软 3D 糖果玩具岛"：
//
//   镜头：
//     · 进场"飞入"（scale 1.16 → 1 弹簧落定，像无人机降落到岛前）
//     · 指针/手指拖动 → 整个舞台轻微 3D 倾斜 + 各层按景深错位平移（视差）
//     · 无输入时 .hi-drift 以极慢的呼吸式游移保持画面"活着"
//   层次（后 → 前，各层视差系数递增）：
//     1. hi-sky   天空穹顶：太阳（光芒慢转）+ 三朵绘制云 + 飞鸟掠屏 + 互动云彩蛋
//     2. hi-far   远景：雾化群岛 + 灯塔（灯闪）+ 远帆船横渡 + 两只热气球
//     3. hi-sea   透视海面：rotateX 平面上的波纹贴图向镜头流动 + 波光闪烁
//     4. hi-stage 主岛立体模型：环岛浪花呼吸、糖果小路、码头小船、池塘、
//                 满岛点缀（树/棕榈/花/蘑菇/石/栅栏/路灯/彩旗）、云影扫过、鱼跃
//     5. 建筑层   六个软 3D 地标（HTML 按钮锚定在岛上，百分比坐标）
//     6. hi-fg    前景浪带（最强视差，镜头前的"近水"）
//
//   交互（保持原有产品行为不变）：
//     · 建筑点按：果冻挤压 + 星星迸发 + tap 音效，230ms 后回调导航
//     · 彩蛋：云(下雨)/鸟(飞走)/气球(升空)/青蛙(跳)/蝴蝶(飞)/螃蟹(横爬)
//     · 每日惊喜礼物盒、商店已购装饰上岛（锚点表在下方常量区）
//
//   性能与可及性：环境动画全部 CSS transform/opacity（GPU 合成）；
//   prefers-reduced-motion 时关闭视差/进场过冲，CSS 侧统一停掉循环动画。
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useGameStore } from '../store/useGameStore.js';
import { useSound } from '../hooks/useSound.js';
import { useReducedMotion } from '../hooks/useReducedMotion.js';
import Xiaomo from './mascot/Xiaomo.jsx';

// ============ 锚点常量表（微调位置只改这里）============
// 坐标为 hi-stage（岛屿舞台容器）的百分比；舞台 SVG viewBox = 1200×780。

// 岛上彩蛋（青蛙/蝴蝶/螃蟹）。天上的云/鸟/气球挂在天空层，用视口百分比，见 SKY_EGGS。
const EGG_SPOTS = {
  frog: { left: '35%', top: '81%' }, // 🐸 左前池塘荷叶上
  butterfly: { left: '52%', top: '76%' }, // 🦋 小路弯道花丛边
  crab: { left: '70%', top: '86.5%' }, // 🦀 右前沙滩
};
const SKY_EGGS = {
  cloud: { left: '77%', top: '17%' }, // ☁️ 右上天空（绘制云按钮，点了下雨）
  bird: { left: '36%', top: '20%' }, // 🐦 中天（点了加速飞走再飞回）
  balloon: { left: '86%', top: '30%' }, // 🎈 右侧天空（点了升空飘走再飘回）
};

// 商店装饰锚点（id 与 shop.js 的 decor 商品一致，买了才出现）。
const DECOR_ANCHORS = {
  windmill: { left: '24%', top: '33%' }, // 🌀 左侧草坡高处
  flags: { left: '17%', top: '60%' }, // 🎏 左滩两棵棕榈之间
  boat: { left: '96%', top: '88%' }, // ⛵ 右下近岛海面
  lighthouse: { left: '94%', top: '26%' }, // 🗼 右上小礁石岛（礁石常驻绘制）
};
const DECOR_EMOJI = { windmill: '🌀', flags: '🎏', boat: '⛵', lighthouse: '🗼' };

// 每日惊喜礼物盒候选锚点（避开建筑/小路热区的空草地）。
const GIFT_SPOTS = [
  { left: '46%', top: '55%' },
  { left: '30%', top: '48%' },
  { left: '56%', top: '51%' },
  { left: '14%', top: '70%' },
  { left: '44%', top: '74%' },
];

// ============ 彩蛋通用：一次性动效触发器 ============
function useReplay() {
  const [playing, setPlaying] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const trigger = useCallback(
    (ms) => {
      if (playing) return;
      setPlaying(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setPlaying(false), ms);
    },
    [playing]
  );
  return [playing, trigger];
}

function Egg({ spot, emoji, label, className = '', playing, onTap, children }) {
  return (
    <button
      className={`hi-egg ${className} ${playing ? 'is-playing' : ''}`}
      style={{ left: spot.left, top: spot.top }}
      onClick={onTap}
      aria-label={label}
    >
      <span className="hi-egg-inner">{emoji}</span>
      {children}
    </button>
  );
}

// ============ 天空 ============

// 绘制云：三团交叠圆 + 底部平边 + 顶部高光，比 emoji 云精致得多。
function CloudArt({ tint = '#ffffff', shade = '#dceffb' }) {
  return (
    <svg viewBox="0 0 170 90" className="hi-cloud-svg" aria-hidden="true">
      <ellipse cx="85" cy="62" rx="72" ry="22" fill={shade} />
      <ellipse cx="52" cy="46" rx="34" ry="26" fill={tint} />
      <ellipse cx="92" cy="34" rx="40" ry="30" fill={tint} />
      <ellipse cx="128" cy="50" rx="30" ry="22" fill={tint} />
      <ellipse cx="85" cy="58" rx="66" ry="20" fill={tint} />
      <ellipse cx="80" cy="28" rx="26" ry="12" fill="#ffffff" opacity="0.85" />
    </svg>
  );
}

// 互动云彩蛋：点了洒几滴雨（绘制云替代原 emoji ☁️，气质统一）。
function CloudEgg() {
  const sound = useSound();
  const [on, go] = useReplay();
  return (
    <button
      className={`hi-egg hi-egg--cloud ${on ? 'is-playing' : ''}`}
      style={{ left: SKY_EGGS.cloud.left, top: SKY_EGGS.cloud.top }}
      onClick={() => {
        sound.splash();
        go(1000);
      }}
      aria-label="云朵"
    >
      <span className="hi-egg-inner">
        <CloudArt />
      </span>
      {on && (
        <span className="hi-rain" aria-hidden="true">
          {[-22, -10, 2, 14, 26].map((x, i) => (
            <span key={i} style={{ left: x, animationDelay: `${i * 0.08}s` }} />
          ))}
        </span>
      )}
    </button>
  );
}

// 掠屏飞鸟群（纯装饰，长周期循环，大部分时间在屏外）。
function BirdFlock() {
  return (
    <div className="hi-birds" aria-hidden="true">
      <svg viewBox="0 0 90 40">
        <g stroke="#4f7089" strokeWidth="3" fill="none" strokeLinecap="round">
          <path className="hi-bird-w" d="M8 18 q8 -8 10 -1 q2 -7 10 1" />
          <path className="hi-bird-w w2" d="M42 8 q7 -7 9 -1 q2 -6 9 1" />
          <path className="hi-bird-w w3" d="M60 26 q6 -6 8 -1 q2 -5 8 1" />
        </g>
      </svg>
    </div>
  );
}

// ============ 远景层：雾化群岛 + 灯塔 + 远帆船 + 热气球 ============
function FarScenery() {
  return (
    <div className="hi-far-inner" aria-hidden="true">
      {/* 左右雾化小岛（含微型棕榈剪影） */}
      <svg className="hi-far-isle hi-far-isle--l" viewBox="0 0 220 80">
        <ellipse cx="110" cy="62" rx="105" ry="16" fill="#bfe7dc" />
        <path d="M40 62 Q75 18 120 60 Q160 30 190 62 Z" fill="#a9dcc9" />
        <path d="M96 34 q-2 -16 4 -22 m4 22 q8 -14 16 -16 m-16 16 q-12 -10 -20 -10" stroke="#8fcdb4" strokeWidth="4" fill="none" strokeLinecap="round" />
      </svg>
      <svg className="hi-far-isle hi-far-isle--r" viewBox="0 0 220 90">
        <ellipse cx="110" cy="70" rx="105" ry="16" fill="#bfe7dc" />
        <path d="M30 70 Q80 26 130 68 Q168 44 200 70 Z" fill="#a9dcc9" />
        {/* 远景灯塔（灯常亮呼吸） */}
        <g transform="translate(150 70)">
          <path d="M-9 0 L-5 -34 L5 -34 L9 0 Z" fill="#f4f8fb" />
          <rect x="-6.5" y="-12" width="13" height="6" fill="#ff8d8d" />
          <rect x="-5.5" y="-24" width="11" height="6" fill="#ff8d8d" />
          <rect x="-5" y="-41" width="10" height="8" rx="2.5" fill="#ffd76e" className="hi-lh-lamp" />
          <path d="M-7 -41 L7 -41 L0 -49 Z" fill="#ff8d8d" />
        </g>
      </svg>

      {/* 远景帆船：缓慢横渡海平线 */}
      <svg className="hi-far-boat" viewBox="0 0 90 70">
        <path d="M12 52 q33 12 66 0 l-8 12 q-25 8 -50 0 z" fill="#fff" />
        <rect x="46" y="8" width="3.5" height="44" rx="1.6" fill="#c98a5a" />
        <path d="M49 10 L76 40 L49 44 Z" fill="#ff9fbe" />
        <path d="M46 14 L22 42 L46 44 Z" fill="#8fd6ff" />
        <path d="M49 8 L62 12 L49 16 Z" fill="#ffd166" />
      </svg>

      {/* 两只热气球（条纹球皮 + 吊篮），错峰漂浮 */}
      <svg className="hi-balloon hi-balloon--a" viewBox="0 0 80 110">
        <path d="M40 78 C14 78 6 52 12 34 C18 14 62 14 68 34 C74 52 66 78 40 78 Z" fill="#ff8fb1" />
        <path d="M30 22 C22 40 22 62 32 78 L48 78 C58 62 58 40 50 22 Z" fill="#ffd166" />
        <path d="M38 18 C35 40 35 62 38 78 L42 78 C45 62 45 40 42 18 Z" fill="#6fa8ff" />
        <path d="M16 40 q24 12 48 0" stroke="rgba(255,255,255,0.55)" strokeWidth="3" fill="none" />
        <path d="M28 78 L34 92 M52 78 L46 92" stroke="#b07b45" strokeWidth="2.4" />
        <rect x="32" y="90" width="16" height="12" rx="3.5" fill="#c98a5a" />
      </svg>
      <svg className="hi-balloon hi-balloon--b" viewBox="0 0 80 110">
        <path d="M40 78 C14 78 6 52 12 34 C18 14 62 14 68 34 C74 52 66 78 40 78 Z" fill="#5cc9a7" />
        <path d="M30 22 C22 40 22 62 32 78 L48 78 C58 62 58 40 50 22 Z" fill="#ffffff" />
        <path d="M38 18 C35 40 35 62 38 78 L42 78 C45 62 45 40 42 18 Z" fill="#c08cff" />
        <path d="M28 78 L34 92 M52 78 L46 92" stroke="#b07b45" strokeWidth="2.4" />
        <rect x="32" y="90" width="16" height="12" rx="3.5" fill="#c98a5a" />
      </svg>
    </div>
  );
}

// ============ 主岛 SVG（1200×780，含四周水域边距）============
// 后 → 前：水下沙晕 → 浪花环 → 湿沙 → 沙滩 → 草地 → 后山丘 → 小路/码头/池塘 → 点缀。
function IslandArt() {
  return (
    <svg className="hi-island" viewBox="0 0 1200 780" aria-hidden="true">
      <defs>
        <radialGradient id="hiGrass" cx="46%" cy="20%" r="85%">
          <stop offset="0%" stopColor="#c6f2a4" />
          <stop offset="55%" stopColor="#8bd76e" />
          <stop offset="100%" stopColor="#57c07d" />
        </radialGradient>
        <radialGradient id="hiKnoll" cx="46%" cy="18%" r="90%">
          <stop offset="0%" stopColor="#d2f7b4" />
          <stop offset="65%" stopColor="#94dc76" />
          <stop offset="100%" stopColor="#63c184" />
        </radialGradient>
        <linearGradient id="hiSand" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fbeec4" />
          <stop offset="100%" stopColor="#eccd85" />
        </linearGradient>
        <linearGradient id="hiRoad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff3d6" />
          <stop offset="100%" stopColor="#f2d69c" />
        </linearGradient>
        <radialGradient id="hiPond" cx="50%" cy="38%" r="75%">
          <stop offset="0%" stopColor="#b8ecfb" />
          <stop offset="100%" stopColor="#6cc6ea" />
        </radialGradient>
        <filter id="hiBlur6" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="7" />
        </filter>

        {/* ---- 可复用点缀（画在原点，底部落在 y=0）---- */}
        <g id="hiTree">
          <ellipse cx="0" cy="2" rx="20" ry="5" fill="rgba(35,90,60,0.18)" />
          <rect x="-5" y="-28" width="10" height="30" rx="5" fill="#b07b45" />
          <rect x="-5" y="-28" width="4" height="30" rx="2" fill="#c9955c" />
          <circle cx="0" cy="-44" r="24" fill="#5fc06f" />
          <circle cx="-17" cy="-33" r="17" fill="#4fb063" />
          <circle cx="17" cy="-33" r="17" fill="#54b768" />
          <circle cx="0" cy="-56" r="15" fill="#6ecb7c" />
          <ellipse cx="-8" cy="-53" rx="8" ry="5" fill="rgba(255,255,255,0.4)" />
          <circle cx="10" cy="-44" r="3.2" fill="#ff8fb1" />
          <circle cx="-12" cy="-44" r="3" fill="#ffd166" />
        </g>
        <g id="hiPalm">
          <ellipse cx="4" cy="2" rx="20" ry="5" fill="rgba(35,90,60,0.18)" />
          <path d="M0 0 Q -8 -40 6 -70" stroke="#a06a42" strokeWidth="10" fill="none" strokeLinecap="round" />
          <path d="M0 0 Q -8 -40 6 -70" stroke="#c08a55" strokeWidth="4.5" fill="none" strokeLinecap="round" />
          <g fill="#43b877" >
            <path d="M6 -70 Q -30 -86 -52 -68 Q -24 -66 6 -70 Z" />
            <path d="M6 -70 Q 36 -90 60 -70 Q 28 -66 6 -70 Z" fill="#4cc088" />
            <path d="M6 -70 Q -16 -100 -38 -96 Q -8 -82 6 -70 Z" fill="#4cc088" />
            <path d="M6 -70 Q 24 -102 46 -100 Q 16 -84 6 -70 Z" />
            <path d="M6 -70 Q 6 -106 6 -110 Q 15 -85 6 -70 Z" fill="#5fd096" />
          </g>
          <circle cx="0" cy="-64" r="5" fill="#8a5a34" />
          <circle cx="10" cy="-60" r="4.4" fill="#8a5a34" />
        </g>
        <g id="hiBush">
          <ellipse cx="0" cy="2" rx="24" ry="5" fill="rgba(35,90,60,0.16)" />
          <ellipse cx="0" cy="-12" rx="22" ry="17" fill="#57bd86" />
          <ellipse cx="-16" cy="-6" rx="14" ry="11" fill="#4bb079" />
          <ellipse cx="16" cy="-6" rx="14" ry="11" fill="#4bb079" />
          <ellipse cx="-5" cy="-18" rx="10" ry="7" fill="rgba(255,255,255,0.32)" />
        </g>
        <g id="hiFlowerA">
          <rect x="-1.6" y="-16" width="3.2" height="18" rx="1.6" fill="#4fa63c" />
          <g>
            <circle cx="0" cy="-21" r="4.8" fill="#ff8fb1" />
            <circle cx="-5.5" cy="-17" r="4.8" fill="#ff8fb1" />
            <circle cx="5.5" cy="-17" r="4.8" fill="#ff8fb1" />
            <circle cx="-3.4" cy="-24" r="4.8" fill="#ffa9c4" />
            <circle cx="3.4" cy="-24" r="4.8" fill="#ffa9c4" />
            <circle cx="0" cy="-20" r="3.4" fill="#ffe066" />
          </g>
        </g>
        <g id="hiFlowerB">
          <rect x="-1.6" y="-14" width="3.2" height="16" rx="1.6" fill="#4fa63c" />
          <g>
            <circle cx="0" cy="-19" r="4.4" fill="#c08cff" />
            <circle cx="-5" cy="-15.5" r="4.4" fill="#c08cff" />
            <circle cx="5" cy="-15.5" r="4.4" fill="#c08cff" />
            <circle cx="0" cy="-16" r="3.2" fill="#ffe066" />
          </g>
        </g>
        <g id="hiFlowerC">
          <rect x="-1.4" y="-13" width="2.8" height="15" rx="1.4" fill="#4fa63c" />
          <g fill="#ffd166">
            <circle cx="0" cy="-18" r="3.8" /><circle cx="-4.4" cy="-15" r="3.8" />
            <circle cx="4.4" cy="-15" r="3.8" /><circle cx="-2.8" cy="-20.5" r="3.8" />
            <circle cx="2.8" cy="-20.5" r="3.8" />
          </g>
          <circle cx="0" cy="-17" r="2.8" fill="#f08a3c" />
        </g>
        <g id="hiMushroom">
          <ellipse cx="0" cy="1" rx="10" ry="3.4" fill="rgba(35,90,60,0.16)" />
          <rect x="-3.5" y="-9" width="7" height="11" rx="3.5" fill="#fff3e0" />
          <path d="M-12 -9 a12 9 0 0 1 24 0 z" fill="#ff6b6b" />
          <circle cx="-4.5" cy="-13" r="2" fill="#fff" />
          <circle cx="4.5" cy="-11.5" r="1.7" fill="#fff" />
          <circle cx="0" cy="-15" r="1.7" fill="#fff" />
        </g>
        <g id="hiRock">
          <ellipse cx="0" cy="1" rx="17" ry="4.5" fill="rgba(40,70,80,0.16)" />
          <path d="M-16 0 q-2 -13 9 -15 q13 -3 15 9 q2 6 -7 6 z" fill="#bcc6d0" />
          <path d="M-7 -13 q7 -3 11 2" stroke="rgba(255,255,255,0.55)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        </g>
        <g id="hiTuft" fill="#5cc47f">
          <path d="M0 0 q-2 -13 -6 -15 q5 1 7 13z" />
          <path d="M0 0 q0 -16 0 -18 q2.4 3 2.4 16z" />
          <path d="M0 0 q2.4 -13 7 -14 q-3.4 2 -4.6 14z" />
        </g>
        <g id="hiFence">
          <rect x="-16" y="-16" width="5" height="18" rx="2.5" fill="#e8c08a" />
          <rect x="11" y="-16" width="5" height="18" rx="2.5" fill="#e8c08a" />
          <rect x="-19" y="-13" width="38" height="4" rx="2" fill="#d5a266" />
          <rect x="-19" y="-6" width="38" height="4" rx="2" fill="#d5a266" />
        </g>
        <g id="hiLamp">
          <ellipse cx="0" cy="1" rx="10" ry="3.4" fill="rgba(40,70,80,0.18)" />
          <rect x="-2.6" y="-40" width="5.2" height="41" rx="2.6" fill="#6a7b8c" />
          <rect x="-2.6" y="-40" width="2.3" height="41" rx="1.1" fill="#8ea0b0" />
          <path d="M-9 -40 q9 -9 18 0 z" fill="#ffcf5c" />
          <circle cx="0" cy="-43" r="3.6" fill="#fff0b0" className="hi-lamp-glow" />
        </g>
      </defs>

      {/* 0) 水下沙晕（把岛"托"在水里，立体感的地基） */}
      <path
        d="M600 268 C 830 278 1010 340 1106 470 C 1142 560 1062 650 876 700
           C 720 736 480 736 350 700 C 170 650 92 560 128 470 C 190 340 370 278 600 268 Z"
        fill="#93dcec" opacity="0.55" filter="url(#hiBlur6)"
      />

      {/* 1) 环岛浪花（两圈错峰呼吸，圆点虚线像泡泡） */}
      <g className="hi-foam-wrap">
        <path
          className="hi-foam hi-foam--1"
          d="M600 292 C 812 300 976 356 1070 470 C 1104 552 1030 632 858 678
             C 706 712 494 712 370 678 C 204 632 132 552 166 470 C 224 356 388 300 600 292 Z"
          fill="none" stroke="#ffffff" strokeWidth="9" strokeLinecap="round" strokeDasharray="2 30"
        />
        <path
          className="hi-foam hi-foam--2"
          d="M600 306 C 800 314 954 366 1042 470 C 1074 546 1004 620 844 662
             C 700 694 500 694 382 662 C 228 620 161 546 192 470 C 246 366 400 314 600 306 Z"
          fill="none" stroke="#eafcff" strokeWidth="6" strokeLinecap="round" strokeDasharray="2 22"
        />
      </g>

      {/* 2) 湿沙圈 + 沙滩 */}
      <path
        d="M600 310 C 794 318 942 370 1028 468 C 1058 540 992 610 840 652
           C 698 682 502 682 388 652 C 240 610 176 540 206 468 C 258 370 406 318 600 310 Z"
        fill="#e3c17f"
      />
      <path
        d="M600 318 C 786 326 928 374 1010 466 C 1040 534 976 600 832 640
           C 696 668 504 668 394 640 C 254 600 194 534 222 466 C 272 374 414 326 600 318 Z"
        fill="url(#hiSand)"
      />

      {/* 3) 草地主台地（边缘几个"草舌"盖住沙滩，做柔软轮廓） */}
      <path
        d="M600 336 C 762 342 890 384 976 462 C 1002 520 948 576 812 612
           C 690 638 510 638 414 612 C 288 576 238 520 264 462 C 310 384 438 342 600 336 Z"
        fill="url(#hiGrass)"
      />
      <g fill="#63c17e">
        <ellipse cx="300" cy="520" rx="52" ry="20" />
        <ellipse cx="916" cy="536" rx="56" ry="20" />
        <ellipse cx="940" cy="590" rx="54" ry="18" />
        <ellipse cx="470" cy="622" rx="60" ry="20" />
        <ellipse cx="740" cy="626" rx="56" ry="18" />
      </g>
      {/* 草地顶部环形高光（阳光洒在草皮上） */}
      <path
        d="M330 430 Q 600 348 912 436"
        stroke="#e2fbc4" strokeWidth="10" fill="none" opacity="0.7" strokeLinecap="round"
      />
      {/* 草地前缘投影带（体积） */}
      <path
        d="M400 636 Q 600 668 800 636"
        stroke="rgba(47,120,70,0.28)" strokeWidth="16" fill="none" strokeLinecap="round"
      />

      {/* 4) 后山丘（塔的地基，更亮一档拉开层次） */}
      <path
        d="M600 300 C 700 302 776 328 800 372 C 818 408 780 442 700 458
           C 640 470 560 470 500 458 C 420 442 382 408 400 372 C 424 328 500 302 600 300 Z"
        fill="url(#hiKnoll)"
      />
      <path d="M446 402 Q 600 344 756 404" stroke="#eafcd0" strokeWidth="8" fill="none" opacity="0.75" strokeLinecap="round" />

      {/* 5) 糖果小路：码头 → 塔前广场（三层描边 + 流光虚点） */}
      <g strokeLinecap="round" fill="none">
        <path d="M600 706 C 540 664 462 652 448 608 C 434 566 522 552 580 538 C 650 522 726 522 740 480 C 752 444 690 430 648 416 C 610 404 592 388 602 362"
          stroke="#d9b87a" strokeWidth="46" />
        <path d="M600 706 C 540 664 462 652 448 608 C 434 566 522 552 580 538 C 650 522 726 522 740 480 C 752 444 690 430 648 416 C 610 404 592 388 602 362"
          stroke="url(#hiRoad)" strokeWidth="34" />
        <path className="hi-road-dots" d="M600 706 C 540 664 462 652 448 608 C 434 566 522 552 580 538 C 650 522 726 522 740 480 C 752 444 690 430 648 416 C 610 404 592 388 602 362"
          stroke="#ffffff" strokeWidth="7" strokeDasharray="2 34" opacity="0.9" />
      </g>

      {/* 6) 木码头 + 拴着的小船（船随浪轻摇） */}
      <g>
        <ellipse cx="600" cy="762" rx="70" ry="14" fill="#7fcbe4" opacity="0.7" />
        <rect x="556" y="694" width="88" height="72" rx="10" fill="#d29a5c" />
        <g fill="#c48a4c">
          <rect x="556" y="702" width="88" height="6" rx="3" />
          <rect x="556" y="716" width="88" height="6" rx="3" />
          <rect x="556" y="730" width="88" height="6" rx="3" />
          <rect x="556" y="744" width="88" height="6" rx="3" />
        </g>
        <circle cx="562" cy="700" r="6" fill="#a8713a" />
        <circle cx="638" cy="700" r="6" fill="#a8713a" />
        <circle cx="562" cy="760" r="6" fill="#a8713a" />
        <circle cx="638" cy="760" r="6" fill="#a8713a" />
        <g className="hi-rowboat">
          <path d="M666 740 q42 14 84 0 l-10 16 q-32 10 -64 0 z" fill="#ff9a6b" />
          <path d="M666 740 q42 14 84 0 l-3 5 q-39 12 -78 0 z" fill="#ffb287" />
          <rect x="700" y="746" width="18" height="5" rx="2.5" fill="#c9713e" />
        </g>
        <path d="M648 742 q10 6 18 2" stroke="#8a5a34" strokeWidth="3" fill="none" />
      </g>

      {/* 7) 池塘（左前）+ 荷叶（青蛙彩蛋的站台） */}
      <g>
        <ellipse cx="420" cy="628" rx="76" ry="30" fill="#5fb9dc" />
        <ellipse cx="420" cy="624" rx="70" ry="26" fill="url(#hiPond)" />
        <ellipse cx="400" cy="618" rx="20" ry="6" fill="rgba(255,255,255,0.65)" />
        <ellipse cx="446" cy="630" rx="10" ry="3.4" fill="rgba(255,255,255,0.5)" />
        <ellipse cx="420" cy="632" rx="16" ry="6.5" fill="#4faf58" />
        <ellipse cx="420" cy="631" rx="16" ry="6.5" fill="#5fc06f" />
        <path d="M420 631 L432 628" stroke="#4faf58" strokeWidth="2" />
        <g transform="translate(478 606)">
          <path d="M0 0 q-3 -16 -8 -20 m8 20 q1 -18 6 -24 m-6 24 q5 -14 12 -16" stroke="#3f9e6b" strokeWidth="4" fill="none" strokeLinecap="round" />
        </g>
      </g>

      {/* 8) 满岛点缀 */}
      <use href="#hiPalm" transform="translate(252 500)" />
      <use href="#hiPalm" transform="translate(210 560) scale(-0.82 0.82)" />
      <use href="#hiPalm" transform="translate(1000 526) scale(-0.9 0.9)" />
      <use href="#hiTree" transform="translate(884 434) scale(1.05)" />
      <use href="#hiTree" transform="translate(330 610) scale(0.95)" />
      <use href="#hiTree" transform="translate(508 348) scale(0.8)" />
      <use href="#hiTree" transform="translate(700 344) scale(0.72)" />
      <use href="#hiBush" transform="translate(356 556) scale(0.95)" />
      <use href="#hiBush" transform="translate(770 628) scale(0.9)" />
      <use href="#hiBush" transform="translate(966 476) scale(0.85)" />
      <use href="#hiBush" transform="translate(452 344) scale(0.75)" />
      <use href="#hiFence" transform="translate(520 688)" />
      <use href="#hiFence" transform="translate(684 688)" />
      <use href="#hiFence" transform="translate(926 622) scale(0.95)" />
      <use href="#hiLamp" transform="translate(452 592)" />
      <use href="#hiLamp" transform="translate(760 470) scale(0.92)" />
      <use href="#hiMushroom" transform="translate(392 662)" />
      <use href="#hiMushroom" transform="translate(872 566) scale(0.9)" />
      <use href="#hiMushroom" transform="translate(536 402) scale(0.8)" />
      <use href="#hiRock" transform="translate(306 646) scale(0.9)" />
      <use href="#hiRock" transform="translate(1022 570) scale(0.85)" />
      <use href="#hiRock" transform="translate(694 356) scale(0.7)" />
      {/* 花丛（sway 轻晃，错峰） */}
      <g className="hi-sway s1"><use href="#hiFlowerA" transform="translate(560 620)" /></g>
      <g className="hi-sway s2"><use href="#hiFlowerC" transform="translate(576 628)" /></g>
      <g className="hi-sway s3"><use href="#hiFlowerB" transform="translate(544 630)" /></g>
      <g className="hi-sway s2"><use href="#hiFlowerB" transform="translate(902 596)" /></g>
      <g className="hi-sway s1"><use href="#hiFlowerA" transform="translate(918 604)" /></g>
      <g className="hi-sway s3"><use href="#hiFlowerA" transform="translate(322 528)" /></g>
      <g className="hi-sway s2"><use href="#hiFlowerC" transform="translate(336 536)" /></g>
      <g className="hi-sway s1"><use href="#hiFlowerB" transform="translate(680 610)" /></g>
      <g className="hi-sway s3"><use href="#hiFlowerC" transform="translate(694 618)" /></g>
      <g className="hi-sway s1"><use href="#hiFlowerA" transform="translate(806 452)" /></g>
      <g className="hi-sway s2"><use href="#hiFlowerB" transform="translate(820 460)" /></g>
      <use href="#hiTuft" transform="translate(500 580)" />
      <use href="#hiTuft" transform="translate(662 560) scale(1.1)" />
      <use href="#hiTuft" transform="translate(820 540)" />
      <use href="#hiTuft" transform="translate(380 500) scale(0.9)" />
      <use href="#hiTuft" transform="translate(600 470)" />
      <use href="#hiTuft" transform="translate(934 608)" />
      {/* 塔前彩旗串（两杆之间垂弧挂 6 面小旗） */}
      <g>
        <rect x="497" y="398" width="6" height="52" rx="3" fill="#c99a63" />
        <rect x="697" y="398" width="6" height="52" rx="3" fill="#c99a63" />
        <path d="M500 404 Q 600 444 700 404" stroke="#e6c583" strokeWidth="3" fill="none" />
        <g className="hi-bunting">
          <path d="M522 413 l16 4 -5 14 z" fill="#ff8fb1" />
          <path d="M556 424 l16 3 -4 14 z" fill="#ffd166" />
          <path d="M590 430 l16 1 -3 15 z" fill="#5cc9a7" />
          <path d="M624 430 l16 -2 -1 15 z" fill="#6fa8ff" />
          <path d="M658 423 l15 -4 1 15 z" fill="#c08cff" />
        </g>
      </g>
      {/* 右上小礁石岛（灯塔装饰的footing，常驻） */}
      <g transform="translate(1128 236)">
        <ellipse cx="0" cy="8" rx="46" ry="12" fill="#93dcec" opacity="0.6" />
        <path d="M-34 6 q-4 -18 12 -22 q20 -6 26 8 q14 -2 16 8 q2 8 -10 8 z" fill="#b2bdc9" />
        <path d="M-20 -12 q10 -4 16 2" stroke="rgba(255,255,255,0.5)" strokeWidth="3" fill="none" strokeLinecap="round" />
      </g>

      {/* 9) 云影扫过岛面（两团错峰平移，立体感的点睛） */}
      <g className="hi-cloudshadow" opacity="0.09">
        <ellipse cx="430" cy="470" rx="200" ry="62" fill="#1f5b3f" filter="url(#hiBlur6)" />
      </g>
      <g className="hi-cloudshadow hi-cloudshadow--2" opacity="0.07">
        <ellipse cx="820" cy="540" rx="170" ry="52" fill="#1f5b3f" filter="url(#hiBlur6)" />
      </g>

      {/* 10) 草地星星闪烁 */}
      <g fill="#ffffff">
        <path className="hi-twinkle" d="M348 452 l2.6 6.4 6.4 2.6 -6.4 2.6 -2.6 6.4 -2.6 -6.4 -6.4 -2.6 6.4 -2.6 z" />
        <path className="hi-twinkle t2" d="M876 508 l2.4 5.8 5.8 2.4 -5.8 2.4 -2.4 5.8 -2.4 -5.8 -5.8 -2.4 5.8 -2.4 z" />
        <path className="hi-twinkle t3" d="M622 590 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 z" />
      </g>

      {/* 11) 鱼跃出水（左侧水面，长周期循环） */}
      <g className="hi-fish-wrap" transform="translate(120 656)">
        <g className="hi-fish">
          <path d="M0 0 C 10 -12 30 -12 40 0 C 30 8 10 8 0 0 Z" fill="#ffb054" />
          <path d="M40 0 L54 -8 L54 8 Z" fill="#ff9a3c" />
          <circle cx="12" cy="-3" r="2.4" fill="#3a2a2a" />
          <path d="M14 4 q6 4 12 0" stroke="#e88a2e" strokeWidth="2" fill="none" />
        </g>
        <g className="hi-splash">
          <ellipse cx="20" cy="10" rx="20" ry="5" fill="none" stroke="#eafcff" strokeWidth="4" />
          <circle cx="4" cy="0" r="3" fill="#eafcff" />
          <circle cx="38" cy="-2" r="2.6" fill="#eafcff" />
          <circle cx="22" cy="-8" r="2.2" fill="#eafcff" />
        </g>
      </g>
    </svg>
  );
}

// ============ 建筑（软 3D 地标）============
// 通用包装：果冻挤压 + 星星迸发 + 230ms 后回调导航（音效在此统一 tap）。
function Building({ cls, label, primary = false, onGo, children }) {
  const sound = useSound();
  const [burst, setBurst] = useState(0);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const tap = () => {
    sound.tap();
    setBurst((b) => b + 1);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onGo?.(), 230);
  };
  return (
    <div className={`hi-b ${cls}`}>
      <motion.button
        className={`hi-b-btn ${primary ? 'is-primary' : ''}`}
        onClick={tap}
        whileHover={{ y: -6, scale: 1.05 }}
        whileTap={{ scale: 0.9, rotate: -2 }}
        transition={{ type: 'spring', stiffness: 430, damping: 16 }}
      >
        {children}
        <span className={`hi-plate ${primary ? 'hi-plate--primary' : ''}`}>{label}</span>
        {burst > 0 && (
          <span key={burst} className="hi-burst" aria-hidden="true">
            {[0, 60, 120, 180, 240, 300].map((deg) => (
              <span key={deg} style={{ '--deg': `${deg}deg` }}>⭐</span>
            ))}
          </span>
        )}
      </motion.button>
    </div>
  );
}

// 识字塔：三层糖果高塔 + 珊瑚圆顶 + 旗 + 发光窗，塔顶平台站着小墨。
function TowerArt() {
  return (
    <svg className="hi-b-svg" viewBox="0 0 300 360" aria-hidden="true">
      <defs>
        <linearGradient id="hiTw1" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffedc2" />
          <stop offset="55%" stopColor="#ffd894" />
          <stop offset="100%" stopColor="#efb268" />
        </linearGradient>
        <linearGradient id="hiTw2" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fff3d6" />
          <stop offset="100%" stopColor="#f6c47e" />
        </linearGradient>
        <linearGradient id="hiTwDome" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffb4a0" />
          <stop offset="100%" stopColor="#f57a63" />
        </linearGradient>
      </defs>
      {/* 地面影 */}
      <ellipse cx="150" cy="344" rx="104" ry="20" fill="rgba(40,90,60,0.20)" />
      {/* 底座台阶 */}
      <ellipse cx="150" cy="330" rx="98" ry="22" fill="#e0a35a" />
      <ellipse cx="150" cy="322" rx="98" ry="22" fill="#ffcf8a" />
      {/* 一层（宽） */}
      <rect x="78" y="196" width="144" height="130" rx="30" fill="url(#hiTw1)" />
      <rect x="88" y="208" width="18" height="108" rx="9" fill="rgba(255,255,255,0.55)" />
      {/* 大门 + 门牌「字」 */}
      <path d="M124 326 V270 a26 26 0 0 1 52 0 V326 Z" fill="#e0873c" />
      <path d="M130 326 V272 a20 20 0 0 1 40 0 V326 Z" fill="#fff2dd" />
      <circle cx="150" cy="238" r="21" fill="#fffdf6" />
      <circle cx="150" cy="238" r="21" fill="none" stroke="#efb268" strokeWidth="4" />
      <text x="150" y="248" textAnchor="middle" fontSize="26" fontWeight="900" fill="#e0873c" fontFamily="'Kaiti SC','STKaiti','KaiTi',serif">字</text>
      {/* 一层发光窗 */}
      <rect className="hi-win" x="96" y="252" width="24" height="34" rx="10" fill="#8ad4ff" />
      <rect className="hi-win w2" x="180" y="252" width="24" height="34" rx="10" fill="#8ad4ff" />
      {/* 一层檐口 */}
      <ellipse cx="150" cy="196" rx="86" ry="18" fill="#fff0cc" />
      <ellipse cx="150" cy="191" rx="86" ry="18" fill="#ffe2ac" />
      {/* 二层（窄） */}
      <rect x="102" y="118" width="96" height="76" rx="24" fill="url(#hiTw2)" />
      <rect x="110" y="126" width="14" height="60" rx="7" fill="rgba(255,255,255,0.55)" />
      <rect className="hi-win w3" x="134" y="138" width="32" height="38" rx="12" fill="#8ad4ff" />
      {/* 塔顶平台（小墨站这，HTML 层放） */}
      <ellipse cx="150" cy="118" rx="70" ry="15" fill="#ffe2ac" />
      <ellipse cx="150" cy="112" rx="70" ry="15" fill="#fff5dd" />
      <g fill="#f2c47e">
        <rect x="86" y="100" width="8" height="18" rx="4" />
        <rect x="112" y="96" width="8" height="22" rx="4" />
        <rect x="180" y="96" width="8" height="22" rx="4" />
        <rect x="206" y="100" width="8" height="18" rx="4" />
      </g>
      {/* 圆顶 + 金球 + 飘旗 */}
      <path d="M96 106 Q150 28 204 106 Z" fill="url(#hiTwDome)" />
      <path d="M116 92 Q150 46 150 46" stroke="rgba(255,255,255,0.55)" strokeWidth="7" fill="none" strokeLinecap="round" />
      <circle cx="150" cy="42" r="8" fill="#ffd166" />
      <rect x="147.5" y="10" width="5" height="30" rx="2.5" fill="#9a7de0" />
      <path className="hi-flagwave" d="M152 12 L182 18 L152 27 Z" fill="#ff6b6b" />
    </svg>
  );
}

// 游乐园：转动的摩天轮（吊舱反向自转保持直立）+ 条纹售票亭。
function ParkArt() {
  // 8 个吊舱的轮辐端点（半径 74，中心 (120,96)）。
  const spokes = [
    [120, 22], [120, 170], [46, 96], [194, 96],
    [68, 44], [172, 148], [172, 44], [68, 148],
  ];
  const colors = ['#ffd166', '#5cc9a7', '#6fa8ff', '#c08cff', '#ff8fb1', '#ffd166', '#5cc9a7', '#6fa8ff'];
  return (
    <svg className="hi-b-svg" viewBox="0 0 240 250" aria-hidden="true">
      <defs>
        <linearGradient id="hiPkBooth" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff6ea" />
          <stop offset="100%" stopColor="#ffe3c4" />
        </linearGradient>
      </defs>
      <ellipse cx="120" cy="236" rx="86" ry="16" fill="rgba(120,60,90,0.16)" />
      {/* 支架 */}
      <path d="M96 232 L120 100 L144 232 Z" fill="#f6a8c6" />
      <path d="M104 232 L120 108 L136 232 Z" fill="#ffc3da" />
      {/* 轮盘（整体旋转） */}
      <g className="hi-wheel">
        <circle cx="120" cy="96" r="74" fill="none" stroke="#ff9ec4" strokeWidth="9" />
        <circle cx="120" cy="96" r="74" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="3" />
        <circle cx="120" cy="96" r="52" fill="none" stroke="#ffc3da" strokeWidth="4" />
        <g stroke="#ffb3d3" strokeWidth="5.5">
          {spokes.map(([x, y], i) => (
            <line key={i} x1="120" y1="96" x2={x} y2={y} />
          ))}
        </g>
        {/* 吊舱：挂点小圆 + 舱体，随轮公转、自身反转保持直立 */}
        {spokes.map(([x, y], i) => (
          <g key={i} className="hi-gondola" style={{ transformOrigin: `${x}px ${y}px` }}>
            <circle cx={x} cy={y} r="4" fill="#e56d95" />
            <path d={`M${x - 11} ${y + 4} a11 11 0 0 0 22 0 v-2 h-22 z`} fill={colors[i]} />
            <rect x={x - 11} y={y + 2} width="22" height="5" rx="2.5" fill="rgba(255,255,255,0.5)" />
          </g>
        ))}
      </g>
      {/* 轮轴 */}
      <circle cx="120" cy="96" r="13" fill="#ff7fb0" />
      <circle cx="116" cy="92" r="4.4" fill="#ffd3e3" />
      {/* 条纹售票亭 */}
      <rect x="86" y="196" width="68" height="40" rx="10" fill="url(#hiPkBooth)" />
      <path d="M80 200 L120 178 L160 200 Z" fill="#ff8fb1" />
      <path d="M92 200 L120 184 L148 200 Z" fill="#ffd166" />
      <rect x="110" y="210" width="20" height="26" rx="6" fill="#fff" />
      <rect x="110" y="210" width="20" height="26" rx="6" fill="none" stroke="#f2b8cd" strokeWidth="3" />
    </svg>
  );
}

// 绘本馆：书本屋顶的小屋 + 烟囱冒烟 + 屋顶漂浮的发光绘本。
function LibraryArt() {
  return (
    <svg className="hi-b-svg" viewBox="0 0 220 210" aria-hidden="true">
      <defs>
        <linearGradient id="hiLbWall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d8f1ff" />
          <stop offset="100%" stopColor="#a8ddf6" />
        </linearGradient>
        <linearGradient id="hiLbRoof" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7fd0f5" />
          <stop offset="100%" stopColor="#4aa6dd" />
        </linearGradient>
      </defs>
      <ellipse cx="110" cy="196" rx="82" ry="15" fill="rgba(40,90,120,0.16)" />
      {/* 烟囱 + 烟圈 */}
      <rect x="156" y="58" width="20" height="42" rx="6" fill="#f2a87c" />
      <rect x="152" y="52" width="28" height="12" rx="6" fill="#e08b5c" />
      <g fill="#ffffff">
        <circle className="hi-smoke" cx="166" cy="44" r="7" />
        <circle className="hi-smoke s2" cx="172" cy="44" r="5.4" />
        <circle className="hi-smoke s3" cx="162" cy="44" r="4.6" />
      </g>
      {/* 墙体 + 侧高光 */}
      <rect x="32" y="92" width="156" height="98" rx="22" fill="url(#hiLbWall)" />
      <rect x="42" y="102" width="16" height="78" rx="8" fill="rgba(255,255,255,0.6)" />
      {/* 书本屋顶（摊开的大书盖在屋上） */}
      <path d="M110 40 C 84 26 44 28 20 44 L 34 96 C 56 84 88 84 110 94 C 132 84 164 84 186 96 L 200 44 C 176 28 136 26 110 40 Z" fill="url(#hiLbRoof)" />
      <path d="M110 40 L110 94" stroke="#3a8ec2" strokeWidth="4" />
      <path d="M34 52 C 56 40 88 40 108 48" stroke="rgba(255,255,255,0.6)" strokeWidth="5" fill="none" strokeLinecap="round" />
      {/* 圆窗 + 门 */}
      <circle cx="110" cy="124" r="17" fill="#fffdf6" />
      <circle cx="110" cy="124" r="17" fill="none" stroke="#6fb8dd" strokeWidth="4" />
      <path d="M110 107 V141 M93 124 H127" stroke="#6fb8dd" strokeWidth="3" />
      <path d="M86 190 V160 a24 24 0 0 1 48 0 V190 Z" fill="#4a9fd0" />
      <path d="M92 190 V162 a18 18 0 0 1 36 0 V190 Z" fill="#fff4dd" />
      {/* 漂浮的发光绘本 */}
      <g className="hi-magicbook">
        <ellipse cx="110" cy="30" rx="24" ry="7" fill="#fff7c4" opacity="0.55" />
        <path d="M110 14 C 104 9 92 9 87 12 V28 c5 -3 17 -3 23 2 c6 -5 18 -5 23 -2 V12 c-5 -3 -17 -3 -23 2 z" fill="#fff" />
        <path d="M110 14 V30" stroke="#e0b060" strokeWidth="2.4" />
        <path d="M92 15 q9 -2 15 1 M128 15 q-9 -2 -15 1" stroke="#f2cB88" strokeWidth="2" fill="none" />
      </g>
    </svg>
  );
}

// 学院：紫色学堂 + 钟面 + 小钟楼铃铛摆动。
function SchoolArt() {
  return (
    <svg className="hi-b-svg" viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <linearGradient id="hiScWall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e6dcff" />
          <stop offset="100%" stopColor="#c6b2f7" />
        </linearGradient>
        <linearGradient id="hiScRoof" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c2a8fa" />
          <stop offset="100%" stopColor="#9a7de0" />
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="188" rx="76" ry="14" fill="rgba(80,60,120,0.16)" />
      <rect x="28" y="84" width="144" height="98" rx="20" fill="url(#hiScWall)" />
      <rect x="38" y="94" width="15" height="78" rx="7.5" fill="rgba(255,255,255,0.6)" />
      <path d="M16 88 L100 30 L184 88 Z" fill="url(#hiScRoof)" />
      <path d="M34 76 L100 32 L100 42" stroke="rgba(255,255,255,0.5)" strokeWidth="6" fill="none" strokeLinecap="round" />
      {/* 小钟楼 + 摆动铃铛 */}
      <rect x="88" y="8" width="24" height="26" rx="7" fill="#b39cf7" />
      <path d="M84 10 L100 0 L116 10 Z" fill="#8a6ce0" />
      <g className="hi-bell">
        <path d="M100 14 q-8 0 -8 9 h16 q0 -9 -8 -9" fill="#ffd166" />
        <circle cx="100" cy="25" r="2.6" fill="#e0a52e" />
      </g>
      {/* 钟面 */}
      <circle cx="100" cy="72" r="16" fill="#fffdf6" />
      <circle cx="100" cy="72" r="16" fill="none" stroke="#8a6ce0" strokeWidth="4" />
      <path d="M100 72 L100 62 M100 72 L108 76" stroke="#8a6ce0" strokeWidth="3" strokeLinecap="round" />
      {/* 窗 ×2 + 门 */}
      <rect className="hi-win" x="46" y="108" width="26" height="32" rx="10" fill="#ffe9b8" />
      <rect className="hi-win w2" x="128" y="108" width="26" height="32" rx="10" fill="#ffe9b8" />
      <path d="M82 182 V152 a18 18 0 0 1 36 0 V182 Z" fill="#8a6ce0" />
      <path d="M87 182 V154 a13 13 0 0 1 26 0 V182 Z" fill="#fff4dd" />
    </svg>
  );
}

// 商店：红白波浪雨棚小铺 + 摇晃的金币招牌 + 门口货箱。
function ShopArt() {
  return (
    <svg className="hi-b-svg" viewBox="0 0 200 190" aria-hidden="true">
      <defs>
        <linearGradient id="hiShWall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff2df" />
          <stop offset="100%" stopColor="#ffdcae" />
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="178" rx="78" ry="14" fill="rgba(160,90,30,0.16)" />
      <rect x="26" y="72" width="148" height="100" rx="18" fill="url(#hiShWall)" />
      <rect x="36" y="82" width="14" height="80" rx="7" fill="rgba(255,255,255,0.65)" />
      {/* 波浪条纹雨棚：珊瑚底 + 底边一排半圆帘齿（红白相间） */}
      <path d="M18 78 L100 30 L182 78 Z" fill="#ff8a5c" />
      <g>
        <path d="M18 78 a11.7 12 0 0 0 23.4 0 z" fill="#ff8a5c" />
        <path d="M41.4 78 a11.7 12 0 0 0 23.4 0 z" fill="#fff" />
        <path d="M64.8 78 a11.7 12 0 0 0 23.4 0 z" fill="#ff8a5c" />
        <path d="M88.2 78 a11.7 12 0 0 0 23.4 0 z" fill="#fff" />
        <path d="M111.6 78 a11.7 12 0 0 0 23.4 0 z" fill="#ff8a5c" />
        <path d="M135 78 a11.7 12 0 0 0 23.4 0 z" fill="#fff" />
        <path d="M158.4 78 a11.7 12 0 0 0 23.4 0 z" fill="#ff8a5c" />
      </g>
      <path d="M30 71 L100 32 L170 71" stroke="rgba(255,255,255,0.45)" strokeWidth="6" fill="none" strokeLinecap="round" />
      {/* 摇晃金币招牌 */}
      <g className="hi-shopsign">
        <rect x="96" y="86" width="8" height="12" fill="#c98a5a" />
        <circle cx="100" cy="112" r="17" fill="#ffd54a" />
        <circle cx="100" cy="112" r="12" fill="#ffe58a" />
        <text x="100" y="119" textAnchor="middle" fontSize="15" fontWeight="900" fill="#d99a1e">¥</text>
      </g>
      {/* 橱窗 + 门 + 货箱 */}
      <rect x="42" y="104" width="34" height="28" rx="8" fill="#8ad4ff" />
      <rect x="42" y="104" width="34" height="11" rx="5.5" fill="#b6e8ff" />
      <path d="M124 172 V144 a17 17 0 0 1 34 0 V172 Z" fill="#e0873c" />
      <path d="M129 172 V146 a12 12 0 0 1 24 0 V172 Z" fill="#fff4dd" />
      <g>
        <rect x="44" y="146" width="30" height="26" rx="5" fill="#e8b06c" />
        <rect x="44" y="146" width="30" height="9" rx="4.5" fill="#f6c88a" />
        <circle cx="52" cy="142" r="7" fill="#ff6b6b" />
        <circle cx="64" cy="140" r="6" fill="#ffd166" />
      </g>
    </svg>
  );
}

// 字库：绿色宝塔柜 + 发光「字」印章 + 小抽屉（收集册的家）。
function CollectionArt() {
  return (
    <svg className="hi-b-svg" viewBox="0 0 190 210" aria-hidden="true">
      <defs>
        <linearGradient id="hiClWall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e2f9ec" />
          <stop offset="100%" stopColor="#b4e8cd" />
        </linearGradient>
        <linearGradient id="hiClRoof" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6fd6a2" />
          <stop offset="100%" stopColor="#3aa876" />
        </linearGradient>
      </defs>
      <ellipse cx="95" cy="198" rx="74" ry="14" fill="rgba(30,110,70,0.16)" />
      {/* 两层小宝塔柜 */}
      <rect x="26" y="106" width="138" height="86" rx="18" fill="url(#hiClWall)" />
      <rect x="36" y="116" width="13" height="66" rx="6.5" fill="rgba(255,255,255,0.6)" />
      <path d="M14 110 Q 95 84 176 110 L 164 88 Q 95 66 26 88 Z" fill="url(#hiClRoof)" />
      <rect x="48" y="62" width="94" height="34" rx="12" fill="#d2f2df" />
      <path d="M36 66 Q 95 42 154 66 L 144 50 Q 95 30 46 50 Z" fill="url(#hiClRoof)" />
      <circle cx="95" cy="24" r="7" fill="#ffd166" className="hi-clstar" />
      {/* 发光「字」印章 */}
      <g className="hi-seal">
        <circle cx="95" cy="146" r="24" fill="#fffdf6" />
        <circle cx="95" cy="146" r="24" fill="none" stroke="#4ecb91" strokeWidth="5" />
        <text x="95" y="157" textAnchor="middle" fontSize="30" fontWeight="900" fill="#2f9a6c" fontFamily="'Kaiti SC','STKaiti','KaiTi',serif">字</text>
      </g>
      {/* 小抽屉排 */}
      <g fill="#8fd9b6">
        <rect x="40" y="176" width="24" height="12" rx="5" />
        <rect x="132" y="176" width="24" height="12" rx="5" />
      </g>
      <rect x="66" y="72" width="58" height="16" rx="8" fill="#fffdf6" opacity="0.8" />
      <g fill="#3aa876">
        <circle cx="78" cy="80" r="3" /><circle cx="95" cy="80" r="3" /><circle cx="112" cy="80" r="3" />
      </g>
    </svg>
  );
}

// ============ 岛上彩蛋（emoji 类，站在新场景锚点上）============
function IslandEggs() {
  const sound = useSound();
  const [frogOn, frogGo] = useReplay();
  const [butterflyOn, butterflyGo] = useReplay();
  const [crabOn, crabGo] = useReplay();
  return (
    <>
      <Egg spot={EGG_SPOTS.frog} emoji="🐸" label="青蛙" className="hi-egg--frog" playing={frogOn}
        onTap={() => { sound.pop(); frogGo(700); }} />
      <Egg spot={EGG_SPOTS.butterfly} emoji="🦋" label="蝴蝶" className="hi-egg--butterfly" playing={butterflyOn}
        onTap={() => { sound.pluck(); butterflyGo(1400); }} />
      <Egg spot={EGG_SPOTS.crab} emoji="🦀" label="螃蟹" className="hi-egg--crab" playing={crabOn}
        onTap={() => { sound.tap(); crabGo(900); }} />
    </>
  );
}

// ============ 场景主组件 ============
export default function IslandScene({ onEnter, showGift = false, onGift }) {
  const owned = useGameStore((s) => s.owned) ?? {};
  const reduced = useReducedMotion();
  const sound = useSound();
  const [giftSpot] = useState(() => GIFT_SPOTS[Math.floor(Math.random() * GIFT_SPOTS.length)]);
  const [birdOn, birdGo] = useReplay();
  const [balloonOn, balloonGo] = useReplay();

  // ---- 指针视差：pointer → (-1..1)，弹簧平滑，各层按景深错位 ----
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const spx = useSpring(px, { stiffness: 46, damping: 15 });
  const spy = useSpring(py, { stiffness: 46, damping: 15 });
  const rotY = useTransform(spx, (v) => v * 2.6); // 舞台整体轻倾（度）
  const rotX = useTransform(spy, (v) => v * -1.8);
  const mk = (fx, fy) => ({ x: useTransform(spx, (v) => v * fx), y: useTransform(spy, (v) => v * fy) });
  const laySky = mk(-8, -5);
  const layFar = mk(-15, -9);
  const laySea = mk(-20, -12);
  const layStage = mk(-30, -16);
  const layFg = mk(-44, -22);

  const onPointerMove = (e) => {
    if (reduced) return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set(((e.clientX - r.left) / r.width) * 2 - 1);
    py.set(((e.clientY - r.top) / r.height) * 2 - 1);
  };
  const onPointerLeave = () => { px.set(0); py.set(0); };

  return (
    <div className="hi-scene" onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}>
      {/* 进场镜头：飞入落定（reduced 时直接就位） */}
      <motion.div
        className="hi-entrance"
        initial={reduced ? false : { scale: 1.16, y: 44 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 92, damping: 19, mass: 1.05 }}
      >
        {/* 视差倾斜层 */}
        <motion.div className="hi-tilt" style={reduced ? undefined : { rotateX: rotX, rotateY: rotY }}>
          <div className="hi-drift">
            {/* 1) 天空 */}
            <motion.div className="hi-layer hi-sky" style={laySky}>
              <div className="hi-sun" aria-hidden="true">
                <span className="hi-sun-halo" />
                <svg className="hi-sun-rays" viewBox="0 0 200 200">
                  <g fill="#ffe27a" opacity="0.85">
                    {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
                      <path key={deg} d="M100 6 L112 34 L88 34 Z" transform={`rotate(${deg} 100 100)`} />
                    ))}
                  </g>
                </svg>
                <span className="hi-sun-core" />
              </div>
              <div className="hi-cloud hi-cloud--1"><CloudArt /></div>
              <div className="hi-cloud hi-cloud--2"><CloudArt /></div>
              <div className="hi-cloud hi-cloud--3"><CloudArt tint="#f6fcff" shade="#e2f1fb" /></div>
              <BirdFlock />
              <CloudEgg />
              {/* 🐦 鸟彩蛋：点了加速飞走，几秒后飞回 */}
              <Egg spot={SKY_EGGS.bird} emoji="🐦" label="飞鸟" className="hi-egg--bird" playing={birdOn}
                onTap={() => { sound.swoosh(); birdGo(3500); }} />
              {/* 🎈 气球彩蛋：飘在右侧天空，点了升空飘走再飘回 */}
              <Egg spot={SKY_EGGS.balloon} emoji="🎈" label="气球" className="hi-egg--balloon" playing={balloonOn}
                onTap={() => { sound.pop(); balloonGo(5200); }} />
            </motion.div>

            {/* 2) 远景 */}
            <motion.div className="hi-layer hi-far" style={layFar}>
              <FarScenery />
            </motion.div>

            {/* 3) 透视海面 */}
            <motion.div className="hi-layer hi-sea" style={laySea} aria-hidden="true">
              <div className="hi-sea-persp">
                <div className="hi-sea-plane">
                  <div className="hi-sea-tex" />
                </div>
              </div>
              <div className="hi-sea-haze" />
              <span className="hi-glint g1" /><span className="hi-glint g2" /><span className="hi-glint g3" />
            </motion.div>

            {/* 4) 主岛舞台（浮沉呼吸；建筑/彩蛋/礼物/装饰锚定其上） */}
            <motion.div className="hi-layer hi-stagewrap" style={layStage}>
              <div className="hi-stage">
                <div className="hi-bob">
                  <IslandArt />
                  <div className="hi-anchors">
                    {/* 建筑入口 ×6 */}
                    <Building cls="hi-b--tower" label="开始识字" primary onGo={() => onEnter?.('learn')}>
                      <div className="hi-tower-mascot"><Xiaomo size={72} expression="cheer" animate /></div>
                      <TowerArt />
                    </Building>
                    <Building cls="hi-b--park" label="游乐园" onGo={() => onEnter?.('games')}>
                      <ParkArt />
                    </Building>
                    <Building cls="hi-b--library" label="绘本馆" onGo={() => onEnter?.('story')}>
                      <LibraryArt />
                    </Building>
                    <Building cls="hi-b--school" label="学院" onGo={() => onEnter?.('review')}>
                      <SchoolArt />
                    </Building>
                    <Building cls="hi-b--shop" label="商城" onGo={() => onEnter?.('shop')}>
                      <ShopArt />
                    </Building>
                    <Building cls="hi-b--collection" label="字库" onGo={() => onEnter?.('collection')}>
                      <CollectionArt />
                    </Building>

                    {/* 彩蛋 */}
                    <IslandEggs />

                    {/* 商店已购装饰上岛 */}
                    {Object.entries(DECOR_ANCHORS).map(([id, spot]) =>
                      owned[id] ? (
                        <span key={id} className={`hi-decor hi-decor--${id}`} style={{ left: spot.left, top: spot.top }} aria-hidden="true">
                          <span className="hi-decor-inner">{DECOR_EMOJI[id]}</span>
                        </span>
                      ) : null
                    )}

                    {/* 每日惊喜礼物盒 */}
                    {showGift && (
                      <button className="hi-gift" style={{ left: giftSpot.left, top: giftSpot.top }} onClick={onGift} aria-label="每日惊喜礼物">
                        <span className="hi-gift-glow" aria-hidden="true" />
                        🎁
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* 5) 前景浪带 */}
            <motion.div className="hi-layer hi-fg" style={layFg} aria-hidden="true">
              <svg viewBox="0 0 1440 110" preserveAspectRatio="none" className="hi-fg-svg">
                <path d="M0 62 Q 90 38 180 58 T 360 56 T 540 60 T 720 52 T 900 60 T 1080 54 T 1260 60 T 1440 52 L 1440 110 L 0 110 Z" fill="#54b7e0" opacity="0.85" />
                <path d="M0 78 Q 110 58 220 74 T 440 72 T 660 78 T 880 70 T 1100 78 T 1320 72 T 1440 76 L 1440 110 L 0 110 Z" fill="#3fa3d4" />
                <path d="M0 64 Q 90 42 180 60 T 360 58 T 540 62 T 720 54 T 900 62 T 1080 56 T 1260 62 T 1440 54"
                  stroke="#eafcff" strokeWidth="7" fill="none" opacity="0.8" />
              </svg>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>

      {/* 轻晕影（顶部微暗 + 底部微暗，包住画面） */}
      <div className="hi-vignette" aria-hidden="true" />
    </div>
  );
}
