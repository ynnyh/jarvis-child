// 全局底部导航坞：悬浮糖果坞，4 tab —— 地图 / 绘本 / 小墨 / 我的。
// 手绘 SVG 图标（不用 emoji），激活 tab 的图标圆座向上弹起 + 主题色点亮。
//
// 按路由显隐（实现：显式列出「显示」规则，其余一律隐藏）：
//   显示：/（首页）、/world/:themeId（关卡路径）、/story（绘本架）、/pet、/collection、/shop
//   隐藏：/lesson、/learn、/game、/review、/parent、/story/:storyId（阅读沉浸页）
// 显示时给 body 加 .has-bottom-nav：滚动页（.page）据此在底部腾出导航高度。
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSound } from '../hooks/useSound.js';

function MapIcon({ active }) {
  const c = active ? '#fff' : '#96a0ae';
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.5 6.2 L9 4 L15 6.2 L20.5 4 V17.8 L15 20 L9 17.8 L3.5 20 Z" fill={active ? '#7ac86e' : 'none'} stroke={c} strokeWidth="1.9" strokeLinejoin="round" />
      <path d="M9 4 V17.8 M15 6.2 V20" stroke={c} strokeWidth="1.9" />
      {active && <circle cx="12" cy="11" r="2.2" fill="#ff6b6b" stroke="#fff" strokeWidth="1.4" />}
    </svg>
  );
}
function BookIcon({ active }) {
  const c = active ? '#fff' : '#96a0ae';
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 6.5 C 10 4.8 6.5 4.6 4 5.8 V18.4 c2.5 -1.2 6 -1 8 0.8 c2 -1.8 5.5 -2 8 -0.8 V5.8 c-2.5 -1.2 -6 -1 -8 0.7 z" fill={active ? '#8ad4ff' : 'none'} stroke={c} strokeWidth="1.9" strokeLinejoin="round" />
      <path d="M12 6.5 V19.2" stroke={c} strokeWidth="1.9" />
      {active && <path d="M6.5 9 q3 -0.8 4 0 M6.5 12 q3 -0.8 4 0" stroke="#fff" strokeWidth="1.4" fill="none" strokeLinecap="round" />}
    </svg>
  );
}
function PandaIcon({ active }) {
  const c = active ? '#fff' : '#96a0ae';
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="6.5" cy="6.5" r="2.6" fill={active ? '#3a4454' : c} />
      <circle cx="17.5" cy="6.5" r="2.6" fill={active ? '#3a4454' : c} />
      <ellipse cx="12" cy="13" rx="8.4" ry="7.6" fill={active ? '#fff' : 'none'} stroke={active ? '#3a4454' : c} strokeWidth="1.9" />
      {active ? (
        <>
          <ellipse cx="9" cy="12.4" rx="2" ry="2.5" fill="#3a4454" transform="rotate(-12 9 12.4)" />
          <ellipse cx="15" cy="12.4" rx="2" ry="2.5" fill="#3a4454" transform="rotate(12 15 12.4)" />
          <circle cx="9.3" cy="12.2" r="0.8" fill="#fff" />
          <circle cx="15.3" cy="12.2" r="0.8" fill="#fff" />
          <path d="M10.5 16.2 q1.5 1.4 3 0" stroke="#3a4454" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="9" cy="12.4" r="1.2" fill={c} />
          <circle cx="15" cy="12.4" r="1.2" fill={c} />
          <path d="M10.5 16 q1.5 1.3 3 0" stroke={c} strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}
function StarIcon({ active }) {
  const c = active ? '#fff' : '#96a0ae';
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3 l2.6 5.4 5.9 0.9 -4.3 4.2 1 5.9 L12 16.6 L6.8 19.4 l1 -5.9 L3.5 9.3 l5.9 -0.9 z"
        fill={active ? '#ffd166' : 'none'}
        stroke={active ? '#fff' : c}
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// tab 配置：match 决定当前路由下哪个 tab 高亮；三色变量喂给 CSS 激活态。
const TABS = [
  {
    to: '/', icon: MapIcon, label: '地图',
    match: (p) => p === '/' || p.startsWith('/world/'),
    vars: { '--dock-c': '#2f8d4e', '--dock-bg1': '#a8e69a', '--dock-bg2': '#6cc25c', '--dock-edge': '#4a9a3e' },
  },
  {
    to: '/story', icon: BookIcon, label: '绘本',
    match: (p) => p === '/story',
    vars: { '--dock-c': '#2c7fb0', '--dock-bg1': '#a5dcff', '--dock-bg2': '#5fb8ec', '--dock-edge': '#3f8fc2' },
  },
  {
    to: '/pet', icon: PandaIcon, label: '小墨',
    match: (p) => p === '/pet',
    vars: { '--dock-c': '#c2571f', '--dock-bg1': '#ffd9a8', '--dock-bg2': '#ffb26b', '--dock-edge': '#e08a3c' },
  },
  {
    to: '/collection', icon: StarIcon, label: '我的',
    match: (p) => p === '/collection',
    vars: { '--dock-c': '#b0810a', '--dock-bg1': '#ffe9a8', '--dock-bg2': '#ffd166', '--dock-edge': '#dfa62e' },
  },
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
    <nav className="dock" aria-label="主导航">
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        const Icon = tab.icon;
        return (
          <button
            key={tab.to}
            className={`dock-item ${active ? 'is-active' : ''}`}
            style={tab.vars}
            onClick={() => { sound.tap(); navigate(tab.to); }}
            aria-label={tab.label}
            aria-current={active ? 'page' : undefined}
          >
            <span className="dock-ic" aria-hidden="true"><Icon active={active} /></span>
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
