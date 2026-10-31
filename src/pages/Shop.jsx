// 商店页（阶段 3 · 激励闭环）：金币的消费出口。
// 三个分区 tab：食物（消耗品，买来直接喂小墨）/ 装扮（拥有制，可穿戴）/ 装饰（拥有制，阶段 5 上海岛）。
// 购买反馈：成功 → coin 音效 + 卡片弹跳（CoinBadge 余额变化自带跳动）；
//           余额不足/等级不够 → wrong 音效 + 卡片抖动，按钮置灰样式。
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { itemsByType } from '../data/shop.js';
import { useGameStore } from '../store/useGameStore.js';
import { useSound } from '../hooks/useSound.js';
import { useSpeech } from '../hooks/useSpeech.js';
import CoinBadge from '../components/ui/CoinBadge.jsx';
import PageTransition from '../components/ui/PageTransition.jsx';
import PlayfulBackground from '../components/PlayfulBackground.jsx';

// 分区 tab 配置。
const TABS = [
  { id: 'food', label: '🍎 食物', tip: '买来直接喂给小墨，它会长经验哦！' },
  { id: 'accessory', label: '🎀 装扮', tip: '给小墨穿上漂亮的装扮！' },
  { id: 'decor', label: '🏝️ 装饰', tip: '把海岛装扮得漂漂亮亮！' },
];

export default function Shop() {
  const navigate = useNavigate();
  const coins = useGameStore((s) => s.coins);
  const pet = useGameStore((s) => s.pet);
  const owned = useGameStore((s) => s.owned) ?? {};
  const equipped = useGameStore((s) => s.equipped) ?? [];
  const buyItem = useGameStore((s) => s.buyItem);
  const toggleEquip = useGameStore((s) => s.toggleEquip);
  const feedPet = useGameStore((s) => s.feedPet);
  const sound = useSound();
  const { speak } = useSpeech();

  const [tab, setTab] = useState('food');
  const [shakeId, setShakeId] = useState(null); // 购买失败抖动的卡片
  const [bounceId, setBounceId] = useState(null); // 购买成功弹跳的卡片
  const timers = useRef([]);

  // 卡片动效标记（抖动/弹跳），到时自动清除。
  const flash = useCallback((setter, id, ms = 500) => {
    setter(null);
    requestAnimationFrame(() => setter(id));
    timers.current.push(setTimeout(() => setter(null), ms));
  }, []);

  // 卸载时清掉动效定时器，避免离开页面后 setState。
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // 购买：等级门槛 → 扣币（buyItem 内完成）→ 食物直接喂小墨 / 装扮装饰入库。
  const buy = useCallback(
    (item) => {
      if (item.unlockLevel && pet.level < item.unlockLevel) {
        sound.wrong();
        flash(setShakeId, item.id);
        return;
      }
      if (coins < item.price) {
        sound.wrong();
        speak('金币不够啦');
        flash(setShakeId, item.id);
        return;
      }
      const r = buyItem(item.id);
      if (!r.ok) {
        sound.wrong();
        flash(setShakeId, item.id);
        return;
      }
      sound.coin();
      flash(setBounceId, item.id);
      if (item.type === 'food') feedPet(item.exp, item.mood); // 食物是消耗品：买到即投喂（经验+心情，饱食度用默认值）
    },
    [coins, pet.level, buyItem, feedPet, sound, speak, flash]
  );

  const items = itemsByType(tab);
  const tip = TABS.find((t) => t.id === tab)?.tip;

  return (
    <PageTransition>
      <div className="page shop-page">
        <PlayfulBackground variant="sky" />
        <header className="sub-header">
          <button className="btn-icon" onClick={() => { sound.tap(); navigate('/'); }} aria-label="返回">←</button>
          <h2 className="sub-title">商店</h2>
          <CoinBadge count={coins} />
        </header>

        {/* 分区 tab */}
        <div className="shop-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={`shop-tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => { sound.swoosh(); setTab(t.id); }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="shop-tip">{tip}</p>

        {/* 商品网格 */}
        <div className="shop-grid">
          {items.map((item) => {
            const isOwned = item.type !== 'food' && !!owned[item.id];
            const isEquipped = equipped.includes(item.id);
            const locked = !!item.unlockLevel && pet.level < item.unlockLevel;
            const affordable = coins >= item.price;
            const buyable = !isOwned && !locked;
            return (
              <motion.div
                key={item.id}
                className={`shop-card ${shakeId === item.id ? 'shake' : ''} ${
                  !buyable ? '' : affordable ? '' : 'disabled'
                }`}
                animate={bounceId === item.id ? { scale: [1, 1.12, 1], y: [0, -6, 0] } : { scale: 1, y: 0 }}
                transition={{ duration: 0.45 }}
              >
                <span className="shop-card-icon">{item.icon}</span>
                <span className="shop-card-name">{item.name}</span>
                {item.type === 'food' && <span className="shop-card-sub">经验 +{item.exp}</span>}
                {locked ? (
                  <span className="shop-lock-tag">🔒 Lv{item.unlockLevel} 解锁</span>
                ) : isOwned ? (
                  <span className="shop-owned-tag">✓ 已拥有</span>
                ) : (
                  <button
                    className="shop-buy-btn"
                    onClick={() => buy(item)}
                    aria-label={`购买 ${item.name}`}
                  >
                    🪙 {item.price}
                  </button>
                )}
                {/* 装扮已拥有：穿戴/卸下切换（阶段 4 渲染穿戴效果） */}
                {item.type === 'accessory' && isOwned && (
                  <button
                    className={`shop-equip-btn ${isEquipped ? 'equipped' : ''}`}
                    onClick={() => { sound.tap(); toggleEquip(item.id); }}
                  >
                    {isEquipped ? '已穿戴 · 卸下' : '穿戴'}
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </PageTransition>
  );
}
