import { useEffect, useState } from 'react';

// 读取系统「减弱动态效果」偏好（无障碍 / 省电）。
// 用于关掉无限循环装饰动画（喇叭招手、云朵漂浮等），尊重用户的减少动画设置。
// 注意：hooks 必须无条件调用，SSR/不支持 matchMedia 时在初始化里兜底为 false。
export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}
