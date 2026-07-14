// 星奖励：展示本次获得的星星（1-3），带弹跳动画，给小朋友即时成就感。
import { useEffect } from 'react';

export default function StarReward({ stars, onDone, autoCloseMs = 2600 }) {
  useEffect(() => {
    if (!onDone) return undefined;
    const t = setTimeout(onDone, autoCloseMs);
    return () => clearTimeout(t);
  }, [onDone, autoCloseMs]);

  return (
    <div className="reward-overlay" role="dialog" aria-label="奖励">
      <div className="reward-card">
        <div className="reward-title">太棒啦！</div>
        <div className="reward-stars">
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className={`reward-star ${n <= stars ? 'filled' : 'empty'}`}
              style={{ animationDelay: `${n * 0.15}s` }}
            >
              {n <= stars ? '⭐' : '☆'}
            </span>
          ))}
        </div>
        <button className="btn-primary" onClick={onDone}>
          继续 →
        </button>
      </div>
    </div>
  );
}
