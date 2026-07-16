// 封装 hanzi-writer：支持“笔顺动画演示”和“描红测评”两种模式。
// 笔画数据从本地 public/char-data/ 加载，完全离线。
import { useEffect, useRef, useImperativeHandle, forwardRef, useState, useLayoutEffect } from 'react';
import HanziWriterLib from 'hanzi-writer';

// 从本地抽取的数据加载，避免走网络 CDN。
function charDataLoader(char, onComplete) {
  fetch(`${import.meta.env.BASE_URL}char-data/${char}.json`)
    .then((res) => {
      if (!res.ok) throw new Error(`缺少笔画数据: ${char}`);
      return res.json();
    })
    .then(onComplete)
    .catch((err) => {
      console.error(err);
      onComplete(null);
    });
}

const HanziWriterView = forwardRef(function HanziWriterView(
  { char, size = 300, onQuizComplete, onCorrectStroke, onMistake },
  ref
) {
  const containerRef = useRef(null);
  const writerRef = useRef(null);
  // 实际尺寸：不超过请求尺寸，也不超过可用宽度（窄屏手机上自动缩小，避免溢出）。
  const [actualSize, setActualSize] = useState(size);

  // 挂载/窗口变化时测量可用宽度。用外层包裹元素测量，画布用较小值。
  useLayoutEffect(() => {
    function measure() {
      const parent = containerRef.current?.parentElement;
      if (!parent) return;
      // 可用宽度：父容器宽度（已含页面 padding），再留 8px 余量。
      const avail = Math.max(200, Math.min(size, parent.clientWidth - 8));
      setActualSize(avail);
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [size]);

  // 创建 writer 实例；char 或尺寸变化时重建。
  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';
    const writer = HanziWriterLib.create(containerRef.current, char, {
      width: actualSize,
      height: actualSize,
      padding: 8,
      showCharacter: false,
      showOutline: true,
      strokeAnimationSpeed: 1,
      delayBetweenStrokes: 200,
      // 儿童友好高对比分色（skill §2）：普通笔画深墨、部首珊瑚、孩子笔迹淡蓝。
      strokeColor: '#3a3a4a',
      radicalColor: '#e5527a',
      outlineColor: '#e6dccb',
      drawingColor: '#3d7fd6',
      drawingWidth: 28,
      charDataLoader,
    });
    writerRef.current = writer;
    return () => {
      writerRef.current = null;
    };
  }, [char, actualSize]);

  // 暴露命令式方法给父组件调用。
  useImperativeHandle(ref, () => ({
    animate() {
      writerRef.current?.animateCharacter();
    },
    showOutline() {
      writerRef.current?.showOutline();
      writerRef.current?.hideCharacter();
    },
    startQuiz() {
      if (!writerRef.current) return;
      writerRef.current.hideCharacter();
      writerRef.current.quiz({
        showHintAfterMisses: 2,
        onCorrectStroke: (data) => onCorrectStroke?.(data),
        onMistake: (data) => onMistake?.(data),
        onComplete: (summary) => onQuizComplete?.(summary),
      });
    },
  }));

  return (
    <div
      ref={containerRef}
      style={{
        width: actualSize,
        height: actualSize,
        maxWidth: '100%',
        background: '#fff7ec',
        borderRadius: 24,
        // 田字格背景，帮助小朋友定位笔画（暖底 + 珊瑚虚线中线）。
        backgroundImage:
          'linear-gradient(#f3e8d8 1px, transparent 1px), linear-gradient(90deg, #f3e8d8 1px, transparent 1px), linear-gradient(#ffd9e6 1px, transparent 1px), linear-gradient(90deg, #ffd9e6 1px, transparent 1px)',
        backgroundSize: `${actualSize / 2}px ${actualSize / 2}px, ${actualSize / 2}px ${actualSize / 2}px, 100% 100%, 100% 100%`,
        backgroundPosition: 'center',
        boxShadow: '0 6px 0 #ffe9cf, 0 12px 24px rgba(120, 90, 40, 0.14)',
      }}
    />
  );
});

export default HanziWriterView;
