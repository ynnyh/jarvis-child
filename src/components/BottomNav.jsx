// 全局底部导航（阶段 5）：4 tab —— 🗺️ 地图 / 📚 绘本 / 🐼 小墨 / ⭐ 我的。
// 当前路由高亮（useLocation），点击 tap 音效。
//
// 按路由显隐（实现：显式列出「显示」规则，其余一律隐藏）：
//   显示：/（首页）、/world/:themeId（关卡路径）、/story（绘本架）、/pet、/collection、/shop
//   隐藏：/lesson、/learn、/game、/review、/parent、/story/:storyId（阅读沉浸页）
// /story/:storyId 不是精确 '/story'，自然落在隐藏侧；今后新增路由默认隐藏，
// 保守不打扰学习/游戏等沉浸页。
//
// 显示时给 body 加 .has-bottom-nav：滚动页（.page）据此在底部腾出导航高度，
// 首页的复习浮标也用 --bottom-nav-h 抬升避让（见 global.css）。
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSound } from '../hooks/useSound.js';

// tab 配置：match 决定当前路由下哪个 tab 高亮。
const TABS = [
  { to: '/', icon: '🗺️', label: '地图', match: (p) => p === '/' || p.startsWith('/world/') },
  { to: '/story', icon: '📚', label: '绘本', match: (p) => p === '/story' },
  { to: '/pet', icon: '🐼', label: '小墨', match: (p) => p === '/pet' },
  { to: '/collection', icon: '⭐', label: '我的', match: (p) => p === '/collection' },
];

// 显示规则：精确匹配 / /story /pet /collection /shop，或以 /world/ 开头。
function navVisible(pathname) {
  return (
    pathname === '/' ||
    pathname.startsWith('/world/') ||
    pathname === '/story' ||
    pathname === '/pet' ||
    pathname === '/collection' ||
    pathname === '/shop'
  );
}

export default function BottomNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const sound = useSound();
  const visible = navVisible(pathname);

  // 同步 body 类：滚动页据此在底部留出导航高度（CSS 见 global.css）。
  useEffect(() => {
    document.body.classList.toggle('has-bottom-nav', visible);
    return () => document.body.classList.remove('has-bottom-nav');
  }, [visible]);

  if (!visible) return null;

  return (
    <nav className="bottom-nav" aria-label="主导航">
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        return (
          <button
            key={tab.to}
            className={`bottom-nav-item ${active ? 'is-active' : ''}`}
            onClick={() => { sound.tap(); navigate(tab.to); }}
            aria-label={tab.label}
            aria-current={active ? 'page' : undefined}
          >
            <span className="bottom-nav-ic" aria-hidden="true">{tab.icon}</span>
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
