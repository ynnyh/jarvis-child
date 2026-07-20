// 宠物养成页：小墨的家（阶段 4 重写）。
//   - 三维状态条：❤️ 饱食度 / 😊 心情 / ⭐ 等级+经验（颜色随值变化，低值变红）。
//   - 宠物舞台：按等级映射 3 成长阶段（幼崽/小童/少年）；穿戴中的装扮以 emoji
//     绝对定位叠加到宠物身上；点击宠物 = 抚摸互动。
//   - 抚摸：爱心粒子 + pluck 音效 + 开心表情 + 心情 +10（每日 5 次上限，store 校验）；
//     达上限再点 → 温和摇头 + 纯文字气泡（不 speak）。
//   - 喂食：底部食物栏（数据走 shop.js）→ 扣币 → 食物飞到嘴边缩小消失 + 宠物弹跳
//     （代替嘴部咀嚼动效）→ feedPet(exp, mood)，饱食度统一 +25（见 store 注释）。
//   - 升级：levelup 音效 + 星星粒子 + 弹层（商店远程投喂的升级不弹层，状态条自然反映）。
//   - 低饱食度（<30）：宠物切 encourage 表情 + 常驻「我饿了」气泡（纯文字，不 speak）。
// 金币在这里消费（store.feedPet 只改宠物状态，扣币走 spendCoins）。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Xiaomo from '../components/mascot/Xiaomo.jsx';
import Button from '../components/ui/Button.jsx';
import CoinBadge from '../components/ui/CoinBadge.jsx';
import PageTransition from '../components/ui/PageTransition.jsx';
import {
  normalizePet,
  useGameStore,
  MOOD_DECAY_SATIETY_THRESHOLD,
} from '../store/useGameStore.js';
import { useSound } from '../hooks/useSound.js';
import { useSpeech } from '../hooks/useSpeech.js';
import { getItem, itemsByType } from '../data/shop.js';
import Confetti from '../components/Confetti.jsx';
import PlayfulBackground from '../components/PlayfulBackground.jsx';

// 食物配置统一走商店数据源（阶段 3）：价格/经验/心情都在 shop.js 里。
const FOODS = itemsByType('food');

// 宠物等级 → 小墨成长阶段（Xiaomo 有 3 个阶段）。
function stageForLevel(level) {
  if (level >= 5) return 3;
  if (level >= 3) return 2;
  return 1;
}

const STAGE_NAME = { 1: '幼崽', 2: '小童', 3: '少年' };

// 装扮渲染映射（阶段 4）：穿戴中的装扮以 emoji 绝对定位叠加到宠物身上。
// 坐标按宠物舞台（.pet-avatar，240px 圆）的百分比估算，对应 Xiaomo SVG 的部位：
//   头顶 ≈ 纵 22%，眼部 ≈ 纵 53%，颈部 ≈ 纵 66%，右耳 ≈ 横 70%/纵 30%，身体右侧 ≈ 横 74%/纵 68%。
// 新增装扮时在 shop.js 配好 id 后，在这里补一行位置即可。
const WEAR_MAP = {
  'straw-hat': { emoji: '👒', style: { top: '20%', left: '50%', fontSize: 58, transform: 'translate(-50%, -50%) rotate(-8deg)' } },
  crown: { emoji: '👑', style: { top: '17%', left: '50%', fontSize: 44, transform: 'translate(-50%, -50%)' } },
  bow: { emoji: '🎀', style: { top: '28%', left: '71%', fontSize: 36, transform: 'translate(-50%, -50%) rotate(12deg)' } },
  glasses: { emoji: '👓', style: { top: '52%', left: '50%', fontSize: 50, transform: 'translate(-50%, -50%)' } },
  scarf: { emoji: '🧣', style: { top: '65%', left: '50%', fontSize: 44, transform: 'translate(-50%, -50%)' } },
  backpack: { emoji: '🎒', style: { top: '66%', left: '75%', fontSize: 42, transform: 'translate(-50%, -50%) rotate(8deg)' } },
};

// 状态条配色：≥60 用健康色，30-59 偏黄提醒，<30 变红（急需照顾）。
function statFill(v, healthy) {
  if (v >= 60) return healthy;
  if (v >= 30) return 'linear-gradient(90deg, #ffc636, #ffe08a)';
  return 'linear-gradient(90deg, #ff5a5a, #ff9d9d)';
}

// 单条状态条：图标 + 进度条 + 数值。
function StatBar({ icon, label, value, max = 100, fill, text }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="pet-stat" aria-label={`${label} ${text}`}>
      <span className="pet-stat-icon" aria-hidden="true">{icon}</span>
      <div className="pet-stat-bar">
        <div className="pet-stat-fill" style={{ width: `${pct}%`, background: fill }} />
      </div>
      <span className="pet-stat-num">{text}</span>
    </div>
  );
}

export default function Pet() {
  const navigate = useNavigate();
  const coins = useGameStore((s) => s.coins);
  const petRaw = useGameStore((s) => s.pet);
  const equipped = useGameStore((s) => s.equipped) ?? [];
  const feedPet = useGameStore((s) => s.feedPet);
  const petPet = useGameStore((s) => s.petPet);
  const spendCoins = useGameStore((s) => s.spendCoins);
  const toggleEquip = useGameStore((s) => s.toggleEquip);
  const sound = useSound();
  const { speak } = useSpeech();

  // 懒计算衰减后的实时视图：补旧数据缺字段 + 按 satietyAt 结算衰减（不起定时器）。
  const pet = useMemo(() => normalizePet(petRaw), [petRaw]);

  const [levelUp, setLevelUp] = useState(false);
  const [eating, setEating] = useState(null); // 正在吃的食物 emoji
  const [petFace, setPetFace] = useState(null); // 抚摸的临时表情，到时回落
  const [noMore, setNoMore] = useState(false); // 抚摸达上限：摇头动画
  const [hearts, setHearts] = useState([]); // 抚摸爱心粒子 [{id, x}]
  const [bubble, setBubble] = useState(null); // 临时提示气泡（纯文字，不 speak）
  const timers = useRef([]);

  // 卸载时清掉所有动效定时器，避免离开页面后 setState。
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const stage = useMemo(() => stageForLevel(pet.level), [pet.level]);
  const hungry = pet.satiety < MOOD_DECAY_SATIETY_THRESHOLD;
  // 表情优先级：抚摸临时脸 > 吃东西欢呼 > 饿了求喂 > 默认开心。
  const expression = petFace ?? (eating ? 'cheer' : hungry ? 'encourage' : 'happy');

  // 临时气泡：到时自动消失。
  const showBubble = useCallback((text, ms = 1600) => {
    setBubble(text);
    timers.current.push(setTimeout(() => setBubble(null), ms));
  }, []);

  // 喂食：扣币 → 飞食物动画 → 涨经验/心情/饱食度；升级走弹层庆祝。
  const feed = useCallback(
    (food) => {
      if (!spendCoins(food.price)) {
        sound.wrong();
        speak('金币不够啦');
        return;
      }
      feedPet(food.exp, food.mood);
      sound.coin();
      setEating(food.icon);
      timers.current.push(setTimeout(() => setEating(null), 900));

      // 判断是否升级（feedPet 是异步 set，用经验估算）。
      const willLevel = pet.exp + food.exp >= 100;
      if (willLevel) {
        timers.current.push(
          setTimeout(() => {
            sound.levelup();
            speak('小墨升级啦');
            setLevelUp(true);
          }, 500)
        );
      } else {
        speak('真好吃');
      }
    },
    [pet.exp, spendCoins, feedPet, sound, speak]
  );

  // 抚摸：成功 → 爱心 + pluck + 开心表情；达每日上限 → 摇头 + 提示气泡（不 speak）。
  const onPet = useCallback(() => {
    const r = petPet();
    if (!r.ok) {
      sound.pop();
      setNoMore(true);
      showBubble('小墨想休息一下啦');
      timers.current.push(setTimeout(() => setNoMore(false), 700));
      return;
    }
    sound.pluck();
    setPetFace('cheer');
    timers.current.push(setTimeout(() => setPetFace(null), 800));
    const id = Date.now() + Math.random();
    setHearts((hs) => [...hs, { id, x: (Math.random() - 0.5) * 90 }]);
    timers.current.push(setTimeout(() => setHearts((hs) => hs.filter((h) => h.id !== id)), 1100));
  }, [petPet, sound, showBubble]);

  return (
    <PageTransition>
      <PlayfulBackground variant="cozy" />
      <div className="page pet-page">
        <header className="sub-header">
          <button className="btn-icon" onClick={() => { sound.tap(); navigate('/'); }} aria-label="返回">←</button>
          <h2 className="sub-title">小墨的家</h2>
          <CoinBadge count={coins} />
        </header>

        {/* 三维状态条 */}
        <div className="pet-stats">
          <StatBar
            icon="❤️" label="饱食度" value={pet.satiety} text={`${pet.satiety}`}
            fill={statFill(pet.satiety, 'linear-gradient(90deg, #ff6f9f, #ffa6c4)')}
          />
          <StatBar
            icon="😊" label="心情" value={pet.mood} text={`${pet.mood}`}
            fill={statFill(pet.mood, 'linear-gradient(90deg, #4b90f5, #8fc0ff)')}
          />
          <StatBar
            icon="⭐" label={`等级 Lv.${pet.level}`} value={pet.exp} text={`${pet.exp}/100`}
            fill="linear-gradient(90deg, var(--c-success), #7fe0b0)"
          />
        </div>

        {/* 宠物舞台 */}
        <div className="pet-stage">
          <div className="pet-level-tag">
            Lv.{pet.level} · {STAGE_NAME[stage]}
          </div>
          <motion.div
            className="pet-avatar"
            onClick={onPet}
            role="button"
            aria-label="摸摸小墨"
            animate={noMore ? { rotate: [0, -6, 6, -4, 4, 0] } : eating ? { y: [0, -8, 0] } : { rotate: 0, y: 0 }}
            transition={{ duration: 0.5 }}
            whileTap={{ scale: 0.96 }}
          >
            <Xiaomo expression={expression} stage={stage} size={220} />

            {/* 穿戴中的装扮：emoji 绝对定位叠加（映射表见文件头 WEAR_MAP） */}
            {equipped.map((id) => {
              const wear = WEAR_MAP[id];
              if (!wear) return null;
              return (
                <span key={id} className="pet-wear" style={wear.style} aria-hidden="true">
                  {wear.emoji}
                </span>
              );
            })}

            {/* 抚摸爱心粒子 */}
            <AnimatePresence>
              {hearts.map((h) => (
                <motion.span
                  key={h.id}
                  className="pet-heart"
                  style={{ left: `calc(50% + ${h.x}px)` }}
                  initial={{ opacity: 0, y: 0, scale: 0.5 }}
                  animate={{ opacity: [0, 1, 0], y: -90, scale: 1.2 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  aria-hidden="true"
                >
                  ❤️
                </motion.span>
              ))}
            </AnimatePresence>

            {/* 气泡：临时提示优先，饿了常驻（均纯文字，不 speak） */}
            <AnimatePresence>
              {(bubble || (hungry && !eating)) && (
                <motion.div
                  className="pet-bubble"
                  initial={{ opacity: 0, y: 6, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  {bubble ?? '我饿了'}
                </motion.div>
              )}
            </AnimatePresence>

            {/* 吃东西：食物从下方飞到嘴边缩小消失，宠物弹跳代替咀嚼 */}
            <AnimatePresence>
              {eating && (
                <motion.div
                  className="pet-eating"
                  initial={{ opacity: 0, y: 70, x: '-50%', scale: 1 }}
                  animate={{ opacity: 1, y: -24, x: '-50%', scale: 0.3 }}
                  exit={{ opacity: 0, scale: 0 }}
                  transition={{ duration: 0.7, ease: 'easeIn' }}
                  aria-hidden="true"
                >
                  {eating}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* 穿戴中的装扮列表：点击卸下 */}
          {equipped.length > 0 && (
            <div className="pet-equipped">
              {equipped.map((id) => {
                const item = getItem(id);
                if (!item) return null;
                return (
                  <button
                    key={id}
                    className="pet-equip-chip"
                    onClick={() => { sound.tap(); toggleEquip(id); }}
                    aria-label={`卸下${item.name}`}
                  >
                    {item.icon} {item.name} ✕
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 食物栏 */}
        <p className="pet-shop-tip">喂小墨吃东西会长经验，点它还能摸摸头哦！</p>
        <div className="pet-shop">
          {FOODS.map((food) => {
            const affordable = coins >= food.price;
            return (
              <button
                key={food.id}
                className={`food-card ${affordable ? '' : 'disabled'}`}
                onClick={() => feed(food)}
              >
                <span className="food-emoji">{food.icon}</span>
                <span className="food-name">{food.name}</span>
                <span className="food-effect">经验+{food.exp} 心情+{food.mood}</span>
                <span className="food-cost">🪙 {food.price}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 升级弹层 */}
      <AnimatePresence>
        {levelUp && (
          <motion.div
            className="reward-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { sound.tap(); setLevelUp(false); }}
          >
            <Confetti preset="stars" count={20} />
            <motion.div
              className="reward-card"
              initial={{ scale: 0.6, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 18 }}
            >
              <div className="reward-title">升到 Lv.{pet.level}！</div>
              <Xiaomo expression="celebrate" stage={stageForLevel(pet.level)} size={160} />
              <div className="reward-coins">{STAGE_NAME[stageForLevel(pet.level)]}小墨更厉害了</div>
              <Button size="lg" onClick={() => setLevelUp(false)}>好耶 🎉</Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
}
