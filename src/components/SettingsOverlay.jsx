// 全局设置叠层：护眼滤镜 + 使用时长锁定层。挂在 App 顶层，覆盖所有页面。
//   护眼模式开：铺一层暖色半透明滤镜（pointer-events:none，不挡操作）。
//   到达每日用时上限：弹「休息一下」锁定层，挡住全部交互，直到跨天或家长调整。
import { useSettings, useTimeGuard } from '../hooks/useSettings.js';
import Xiaomo from './mascot/Xiaomo.jsx';

export default function SettingsOverlay() {
  const { eyecare } = useSettings();
  const { locked, capMin } = useTimeGuard();

  return (
    <>
      {eyecare && <div className="eyecare-overlay" aria-hidden="true" />}
      {locked && (
        <div className="timelock-overlay" role="alertdialog" aria-label="休息一下">
          <div className="timelock-card">
            <Xiaomo expression="sleep" size={120} />
            <h2 className="timelock-title">休息一下吧</h2>
            <p className="timelock-desc">
              今天已经学了 {capMin} 分钟啦，眼睛要休息休息。
              <br />
              明天再来找小墨玩吧！
            </p>
            <p className="timelock-hint">（家长可在「家长中心 → 使用时长」调整）</p>
          </div>
        </div>
      )}
    </>
  );
}
