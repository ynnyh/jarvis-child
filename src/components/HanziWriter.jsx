// 封装 hanzi-writer：支持“笔顺动画演示”和“描红测评”两种模式。
// 笔画数据从本地 public/char-data/ 加载，完全离线。
import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
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

  // 创建 writer 实例；char 或 size 变化时重建。
  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';
    const writer = HanziWriterLib.create(containerRef.current, char, {
      width: size,
      height: size,
      padding: 8,
      showCharacter: false,
      showOutline: true,
      strokeAnimationSpeed: 1,
      delayBetweenStrokes: 200,
      strokeColor: '#333',
      radicalColor: '#FF8FB1',
      outlineColor: '#DDD',
      drawingWidth: 28,
      charDataLoader,
    });
    writerRef.current = writer;
    return () => {
      writerRef.current = null;
    };
  }, [char, size]);

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
        width: size,
        height: size,
        background: '#fff',
        borderRadius: 24,
        // 田字格背景，帮助小朋友定位笔画。
        backgroundImage:
          'linear-gradient(#f0f0f0 1px, transparent 1px), linear-gradient(90deg, #f0f0f0 1px, transparent 1px), linear-gradient(#ffd9e6 1px, transparent 1px), linear-gradient(90deg, #ffd9e6 1px, transparent 1px)',
        backgroundSize: `${size / 2}px ${size / 2}px, ${size / 2}px ${size / 2}px, 100% 100%, 100% 100%`,
        backgroundPosition: 'center',
        boxShadow: '0 6px 20px rgba(0,0,0,0.08)',
      }}
    />
  );
});

export default HanziWriterView;
