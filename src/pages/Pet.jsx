// 宠物养成页：小墨的家。
//   - 按宠物等级映射成长阶段（幼崽/小童/少年），等级越高体型越大、有配饰。
//   - 用金币买食物喂养 → 涨经验 → 满 100 经验升一级（升级触发进化动画）。
//   - 展示经验条、金币余额、今日喂食次数。
// 金币在这里消费（store.feedPet 只涨经验，扣币在调用处做）。
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Xiaomo from '../components/mascot/Xiaomo.jsx';
import Button from '../components/ui/Button.jsx';
import CoinBadge from '../components/ui/CoinBadge.jsx';
import PageTransition from '../components/ui/PageTransition.jsx';
import { useGameStore } from '../store/useGameStore.js';
import { useSound } from '../hooks/useSound.js';
import { useSpeech } from '../hooks/useSpeech.js';

// 食物：价格 + 经验值。价格越高，长得越快。
const FOODS = [
  { id: 'bamboo', emoji: '🎋', name: '竹子', cost: 10, exp: 20 },
  { id: 'apple', emoji: '🍎', name: '苹果', cost: 20, exp: 45 },
  { id: 'cake', emoji: '🎂', name: '蛋糕', cost: 40, exp: 100 },
];

// 宠物等级 → 小墨成长阶段（Xiaomo 有 3 个阶段）。
function stageForLevel(level) {
  if (level >= 5) return 3;
  if (level >= 3) return 2;
  return 1;
}

const STAGE_NAME = { 1: '幼崽', 2: '小童', 3: '少年' };

export default function Pet() {
  const navigate = useNavigate();
  const coins = useGameStore((s) => s.coins);
  const pet = useGameStore((s) => s.pet);
  const feedPet = useGameStore((s) => s.feedPet);
  const addCoins = useGameStore((s) => s.addCoins);
  const sound = useSound();
  const { speak } = useSpeech();

  const [levelUp, setLevelUp] = useState(false);
  const [eating, setEating] = useState(null); // 正在吃的食物 emoji

  const stage = useMemo(() => stageForLevel(pet.level), [pet.level]);

  const feed = useCallback(
    (food) => {
      if (coins < food.cost) {
        sound.error();
        speak('金币不够啦');
        return;
      }
      const prevLevel = pet.level;
      addCoins(-food.cost);
      feedPet(food.exp);
      sound.coin();
      setEating(food.emoji);
      setTimeout(() => setEating(null), 900);

      // 判断是否升级（feedPet 是异步 set，用经验估算）。
      const willLevel = pet.exp + food.exp >= 100;
      if (willLevel) {
        setTimeout(() => {
          sound.levelup();
          speak('小墨升级啦');
          setLevelUp(true);
        }, 500);
      } else {
        speak('真好吃');
      }
    },
    [coins, pet.exp, pet.level, addCoins, feedPet, sound, speak]
  );

  return (
    <PageTransition>
      <div className="page pet-page">
        <header className="sub-header">
          <button className="btn-icon" onClick={() => navigate('/')} aria-label="返回">←</button>
          <h2 className="sub-title">小墨的家</h2>
          <CoinBadge count={coins} />
        </header>

        {/* 宠物舞台 */}
        <div className="pet-stage">
          <div className="pet-level-tag">
            Lv.{pet.level} · {STAGE_NAME[stage]}
          </div>
          <motion.div
            className="pet-avatar"
            animate={eating ? { y: [0, -8, 0] } : {}}
            transition={{ duration: 0.4 }}
          >
            <Xiaomo expression={eating ? 'cheer' : 'happy'} stage={stage} size={220} />
          </motion.div>

          {/* 吃东西动画 */}
          <AnimatePresence>
            {eating && (
              <motion.div
                className="pet-eating"
                initial={{ opacity: 0, y: 20, scale: 0.5 }}
                animate={{ opacity: 1, y: -30, scale: 1.2 }}
                exit={{ opacity: 0, scale: 0 }}
              >
                {eating}
              </motion.div>
            )}
          </AnimatePresence>

          {/* 经验条 */}
          <div className="pet-exp-bar" aria-label={`经验 ${pet.exp}/100`}>
            <div className="pet-exp-fill" style={{ width: `${pet.exp}%` }} />
            <span className="pet-exp-text">{pet.exp} / 100</span>
          </div>
        </div>

        {/* 食物商店 */}
        <p className="pet-shop-tip">用金币喂小墨，它会长大哦！</p>
        <div className="pet-shop">
          {FOODS.map((food) => {
            const affordable = coins >= food.cost;
            return (
              <button
                key={food.id}
                className={`food-card ${affordable ? '' : 'disabled'}`}
                onClick={() => feed(food)}
              >
                <span className="food-emoji">{food.emoji}</span>
                <span className="food-name">{food.name}</span>
                <span className="food-cost">🪙 {food.cost}</span>
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
            onClick={() => setLevelUp(false)}
          >
            <motion.div
              className="reward-card"
              initial={{ scale: 0.6, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 18 }}
            >
              <div className="reward-title">升级啦！</div>
              <Xiaomo expression="cheer" stage={stageForLevel(pet.level)} size={160} />
              <div className="reward-coins">现在是 Lv.{pet.level}</div>
              <Button size="lg" onClick={() => setLevelUp(false)}>好耶 🎉</Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
}
