// 世界内关卡路径：主题小径地图。6 关从山脚（底部）沿蜿蜒糖果路爬向山顶城堡。
//   - SVG 绘制道路：沙色路基 + 奶油路面 + 流光虚点；主题色"进度条"沿路填到当前关。
//   - 关卡 = 软 3D 大圆钮（数字 + 星星 + 名字牌）；锁定灰云色；当前关雷达光圈 + 小墨蹦跳。
//   - 关卡顺序解锁（世界内）：第 1 关开，其余需前一关完成。
//   - 通关庆祝：6 关全 3 星 → 宝箱奖励（一次性，记 flag 避免重复）。
import { useMemo, useRef, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getTheme } from '../data/content.generated.js';
import { useGameStore } from '../store/useGameStore.js';
import { useSpeech } from '../hooks/useSpeech.js';
import { useSound } from '../hooks/useSound.js';
import Xiaomo from '../components/mascot/Xiaomo.jsx';
import Chest from '../components/Chest.jsx';

// ---- 地图坐标（内部坐标系宽 480，节点自下而上交错）----
const MAP_W = 480;
const STEP = 178; // 节点纵向间距
const TOP_PAD = 210; // 顶部：终点城堡的地盘
const BOT_PAD = 110;
const X_LEFT = 150;
const X_RIGHT = 330;

// 路旁点缀（相对节点错开排布，静态表足够）。
const DECO_SET = ['🌳', '🌷', '🍄', '🌼', '🌲', '🪨'];

export default function WorldPath() {
  const { themeId } = useParams();
  const navigate = useNavigate();
  const theme = getTheme(themeId);
  const { speak } = useSpeech();
  const sound = useSound();
  const lessons = useGameStore((s) => s.lessons);
  const chars = useGameStore((s) => s.chars);
  const addCoins = useGameStore((s) => s.addCoins);
  const currentRef = useRef(null);
  const [showChest, setShowChest] = useState(false);

  // 一课是否"完成"：该课所有字都学过（比只看课程星级更稳，兼容历史数据）。
  const lessonDone = (lesson) => lesson.chars.every((c) => !!chars[c.char]);

  // 每关解锁状态 + 星级。前一课完成即解锁下一课。
  const lessonState = useMemo(() => {
    if (!theme) return [];
    return theme.lessons.map((lesson, i) => {
      const stars = lessons[lesson.id]?.stars ?? 0;
      const prevDone = i === 0 || lessonDone(theme.lessons[i - 1]);
      return { lesson, stars, unlocked: i === 0 || prevDone };
    });
  }, [theme, lessons, chars]);

  const currentIndex = useMemo(() => {
    const idx = lessonState.findIndex((s) => s.unlocked && !lessonDone(s.lesson));
    return idx < 0 ? lessonState.length - 1 : idx;
  }, [lessonState, chars]);

  // 是否本世界通关（全 3 星）。
  const worldComplete = useMemo(
    () => theme && theme.lessons.every((l) => (lessons[l.id]?.stars ?? 0) === 3),
    [theme, lessons]
  );

  // 已得星星总数（顶栏展示）。
  const totalStars = useMemo(
    () => (theme ? theme.lessons.reduce((n, l) => n + (lessons[l.id]?.stars ?? 0), 0) : 0),
    [theme, lessons]
  );

  // 通关且未领过宝箱 → 弹宝箱。
  const chestKey = `jarvis-child-worldchest-${themeId}`;
  useEffect(() => {
    if (worldComplete) {
      try {
        if (!localStorage.getItem(chestKey)) setShowChest(true);
      } catch { /* 忽略 */ }
    }
  }, [worldComplete, chestKey]);

  useEffect(() => {
    currentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  // ---- 地图几何：节点自下而上，山顶是城堡终点 ----
  const N = lessonState.length;
  const mapH = TOP_PAD + Math.max(0, N - 1) * STEP + BOT_PAD;
  const nodePos = (i) => ({
    x: i % 2 === 0 ? X_LEFT : X_RIGHT,
    y: mapH - BOT_PAD - i * STEP,
  });
  const goalPos = { x: N % 2 === 0 ? X_LEFT : X_RIGHT, y: mapH - BOT_PAD - N * STEP + 24 };

  // 道路路径：node0 → … → nodeN-1 → 城堡（竖向 S 弯的三次贝塞尔串）。
  const roadD = useMemo(() => {
    if (!N) return '';
    const pts = [...Array.from({ length: N }, (_, i) => nodePos(i)), goalPos];
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i += 1) {
      const a = pts[i - 1];
      const b = pts[i];
      const bend = (a.y - b.y) * 0.52;
      d += ` C ${a.x} ${a.y - bend}, ${b.x} ${b.y + bend}, ${b.x} ${b.y}`;
    }
    return d;
    // eslint 提示依赖 mapH：mapH 由 N 派生，N 变则整个 memo 重算，安全。
  }, [N, mapH]);

  // 进度填色：path 总长归一为 100（pathLength 属性），
  // 填到当前关 = currentIndex / N 段（通关填满到城堡）。
  const progressFrac = worldComplete ? 1 : Math.min(1, currentIndex / N);

  if (!theme) {
    return (
      <div className="page center-col">
        <p>找不到这个小世界。</p>
        <button className="ui-btn ui-btn--primary ui-btn--lg" onClick={() => { sound.tap(); navigate('/'); }}>回首页</button>
      </div>
    );
  }

  return (
    <div
      className="trail-page"
      style={{
        '--theme-color': theme.color,
        '--trail-sky': `color-mix(in srgb, ${theme.color} 22%, #dff2ff)`,
        '--trail-glow': `color-mix(in srgb, ${theme.color} 40%, rgba(255,255,255,0.4))`,
      }}
    >
      <header className="trail-topbar">
        <button className="trail-back" onClick={() => { sound.tap(); navigate('/'); }} aria-label="返回世界选择">←</button>
        <span className="trail-title">{theme.emoji} {theme.name}</span>
        <span className="trail-stars" aria-label={`已得 ${totalStars} 颗星`}>⭐ {totalStars}/{N * 3}</span>
      </header>

      {/* 宽屏两侧风景（窄屏 CSS 隐藏） */}
      <div className="trail-flair" aria-hidden="true">
        <span style={{ left: '7%', bottom: '14%' }}>🌳</span>
        <span style={{ left: '12%', top: '30%', fontSize: 40 }}>🌸</span>
        <span style={{ right: '8%', bottom: '24%' }}>🌲</span>
        <span style={{ right: '13%', top: '26%', fontSize: 42 }}>🍄</span>
        <span style={{ left: '9%', bottom: '42%', fontSize: 38 }}>{theme.emoji}</span>
        <span style={{ right: '9%', bottom: '52%', fontSize: 36 }}>☁️</span>
      </div>

      <div className="trail-scroll">
        <div className="trail-wrap" style={{ height: mapH }}>
          {/* 道路（随容器横向伸缩，节点用同一坐标系的百分比对齐） */}
          <svg
            className="trail-svg"
            viewBox={`0 0 ${MAP_W} ${mapH}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d={roadD} fill="none" stroke="#d9b87a" strokeWidth="42" strokeLinecap="round" />
            <path d={roadD} fill="none" stroke="#fff2d4" strokeWidth="30" strokeLinecap="round" />
            {/* 主题色进度：走过的路亮起来 */}
            <motion.path
              d={roadD}
              fill="none"
              stroke={theme.color}
              strokeWidth="30"
              strokeLinecap="round"
              pathLength="100"
              strokeDasharray="100"
              initial={{ strokeDashoffset: 100 }}
              animate={{ strokeDashoffset: 100 - progressFrac * 100 }}
              transition={{ duration: 1.1, ease: 'easeInOut', delay: 0.3 }}
              opacity="0.9"
            />
            <path
              className="trail-road-dots"
              d={roadD}
              fill="none"
              stroke="#fff"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray="2 30"
              opacity="0.9"
            />
          </svg>

          {/* 路旁点缀：每关对面错开一组 */}
          {lessonState.map((_, i) => {
            const { x, y } = nodePos(i);
            const side = x === X_LEFT ? 1 : -1; // 点缀站对面
            const dx = side * (150 + (i % 2) * 40);
            return (
              <span
                key={`deco-${i}`}
                className={`trail-deco ${i % 2 ? 'sway' : ''}`}
                style={{
                  left: `${((x + dx) / MAP_W) * 100}%`,
                  top: `${((y + 26 - (i % 3) * 30) / mapH) * 100}%`,
                  fontSize: 26 + (i % 3) * 6,
                }}
                aria-hidden="true"
              >
                {DECO_SET[i % DECO_SET.length]}
              </span>
            );
          })}

          {/* 终点城堡 */}
          <div
            className={`trail-goal ${worldComplete ? 'done' : ''}`}
            style={{ left: `${(goalPos.x / MAP_W) * 100}%`, top: `${((goalPos.y - 66) / mapH) * 100}%` }}
          >
            <span className="trail-goal-emoji" aria-hidden="true">{worldComplete ? '🏰' : '⛺'}</span>
            <span className="trail-goal-label">{worldComplete ? '🏆 已通关！' : '终点'}</span>
          </div>

          {/* 关卡节点 */}
          {lessonState.map(({ lesson, stars, unlocked }, i) => {
            const isCurrent = i === currentIndex;
            const { x, y } = nodePos(i);
            const aced = stars === 3;
            return (
              <div
                key={lesson.id}
                className={`trail-node ${unlocked ? '' : 'locked'}`}
                style={{ left: `${(x / MAP_W) * 100}%`, top: `${(y / mapH) * 100}%` }}
                ref={isCurrent ? currentRef : null}
              >
                {isCurrent && unlocked && (
                  <div className="trail-mascot">
                    {/* 外层管定位居中，内层 motion 只管蹦跳（避免 y 动画覆盖居中 transform） */}
                    <motion.div
                      animate={{ y: [0, -9, 0] }}
                      transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
                    >
                      <Xiaomo size={58} expression="cheer" />
                    </motion.div>
                  </div>
                )}
                {/* 星槽只给已解锁的关：锁定关少一层噪音 */}
                {unlocked && (
                  <span className="trail-node-stars" aria-label={`${stars} 星`}>
                    {[1, 2, 3].map((n) => (
                      <span key={n} className={stars >= n ? '' : 'dim'}>⭐</span>
                    ))}
                  </span>
                )}
                <motion.button
                  className={`trail-node-btn ${unlocked ? '' : 'locked'} ${isCurrent ? 'current' : ''} ${aced ? 'aced' : ''}`}
                  onClick={() => {
                    if (!unlocked) {
                      sound.error();
                      speak('先完成前面的关卡哦');
                      return;
                    }
                    sound.tap();
                    speak(lesson.name);
                    navigate(`/lesson/${lesson.id}`);
                  }}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.08 + i * 0.07, type: 'spring', stiffness: 360, damping: 20 }}
                  whileTap={unlocked ? { scale: 0.9 } : {}}
                >
                  {unlocked ? i + 1 : '🔒'}
                </motion.button>
                <span className="trail-node-name">{lesson.name}</span>
              </div>
            );
          })}
        </div>
      </div>

      {showChest && (
        <Chest
          coins={50}
          bonus="🏆 通关奖杯 ×1"
          onOpen={() => {
            addCoins(50);
            try { localStorage.setItem(chestKey, '1'); } catch { /* 忽略 */ }
            setShowChest(false);
          }}
        />
      )}
    </div>
  );
}
