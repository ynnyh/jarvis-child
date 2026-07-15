// 字理讲解：讲清"这个字是怎么来的"，覆盖全部 300 字。
//   - 象形字（有 pictograph）：走演变动画（实物→汉字），用 Pictograph 组件。
//   - 其余字（有部件拆分）：部件逐个飞入组成字，有含义的部件显示部首含义。
// 数据来自字库的 pictograph / components + 部首词典 radicals.js。
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import Pictograph from './Pictograph.jsx';
import { getRadical } from '../data/radicals.js';

// 纯笔画类部件（无教学意义），组字讲解时过滤掉。
const STROKE_ONLY = new Set([
  '一', '丿', '丶', '丨', '乛', '亅', '乀', '㇆', '乚', '𠄌', '丷', '勹',
  '冂', '凵', '厶', '卜', '丁', '亠', '冖', '厂', '广', '尸', '弔',
]);

export default function Etymology({ data, onSpeak }) {
  const { char, pictograph, components = [] } = data;

  // 有意义的部件（过滤纯笔画）。
  const meaningfulComps = useMemo(
    () => components.filter((c) => c !== char && !STROKE_ONLY.has(c)),
    [components, char]
  );

  // 象形字：演变动画。
  if (Array.isArray(pictograph) && pictograph.length > 0) {
    return (
      <div className="etymology">
        <Pictograph steps={pictograph} onSpeak={() => onSpeak?.(char)} />
        <p className="etym-caption">
          看，「{char}」就是这样一点点变来的！
        </p>
      </div>
    );
  }

  // 组合字：部件飞入组成字。
  if (meaningfulComps.length >= 1) {
    return (
      <div className="etymology">
        <div className="etym-compose">
          {/* 部件们 */}
          <div className="etym-parts">
            {meaningfulComps.map((comp, i) => {
              const r = getRadical(comp);
              return (
                <motion.div
                  key={comp + i}
                  className="etym-part"
                  initial={{ opacity: 0, y: 20, scale: 0.6 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: i * 0.4, type: 'spring', stiffness: 300 }}
                >
                  <span className="etym-part-char">{comp}</span>
                  {r && (
                    <span className="etym-part-hint">
                      {r.emoji} {r.meaning}
                    </span>
                  )}
                </motion.div>
              );
            })}
          </div>
          {/* 等号 + 结果 */}
          <motion.div
            className="etym-result"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: meaningfulComps.length * 0.4 + 0.2, type: 'spring', stiffness: 260 }}
          >
            <span className="etym-equals">=</span>
            <button className="etym-big-char" onClick={() => onSpeak?.(char)}>
              {char}
            </button>
          </motion.div>
        </div>
        <p className="etym-caption">
          「{char}」是由 {meaningfulComps.map((c) => `「${c}」`).join('、')} 组成的！
        </p>
      </div>
    );
  }

  // 独体字/无可讲部件：简单展示。
  return (
    <div className="etymology">
      <button className="etym-big-char solo" onClick={() => onSpeak?.(char)}>
        {char}
      </button>
      <p className="etym-caption">「{char}」是个简单的字，跟着小墨一起念一念吧！</p>
    </div>
  );
}
