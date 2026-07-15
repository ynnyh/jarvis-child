// 家长中心：算术门禁 → 登录/注册 → 档案管理 + 学习报告。
// 后端能力的出口。未登录也能用本地进度看报告（读 store），登录后可多设备同步。
//
// 门禁：简单两位数加法，防止小朋友误入家长区（不是安全措施，只是拦一下）。
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CURRICULUM, ALL_CHARS } from '../data/content.generated.js';
import { useGameStore } from '../store/useGameStore.js';
import { useSettings } from '../hooks/useSettings.js';
import { isBgmEnabled, setBgmEnabled } from '../hooks/useBgm.js';
import { useSound } from '../hooks/useSound.js';
import { api, isLoggedIn } from '../api/client.js';
import {
  syncNow,
  getActiveProfileId,
  setActiveProfileId,
} from '../api/sync.js';
import Button from '../components/ui/Button.jsx';
import PageTransition from '../components/ui/PageTransition.jsx';
import Xiaomo from '../components/mascot/Xiaomo.jsx';

// ---- 算术门禁 ----
function Gate({ onPass }) {
  const [a] = useState(() => 10 + Math.floor(Math.random() * 40));
  const [b] = useState(() => 10 + Math.floor(Math.random() * 40));
  const [val, setVal] = useState('');
  const [err, setErr] = useState(false);
  return (
    <div className="parent-gate">
      <Xiaomo expression="think" size={120} />
      <p className="gate-title">请家长作答</p>
      <p className="gate-q">{a} + {b} = ?</p>
      <input
        className="gate-input"
        inputMode="numeric"
        value={val}
        onChange={(e) => { setVal(e.target.value); setErr(false); }}
        placeholder="输入答案"
      />
      {err && <p className="gate-err">再试试哦</p>}
      <Button
        size="lg"
        onClick={() => (Number(val) === a + b ? onPass() : setErr(true))}
      >
        确定
      </Button>
    </div>
  );
}

// ---- 登录/注册表单 ----
function AuthForm({ onDone }) {
  const [mode, setMode] = useState('login'); // login | register
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = useCallback(async () => {
    setBusy(true);
    setErr('');
    try {
      if (mode === 'register') await api.register(username.trim(), password);
      else await api.login(username.trim(), password);
      onDone();
    } catch (e) {
      setErr(e.message || '出错了');
    } finally {
      setBusy(false);
    }
  }, [mode, username, password, onDone]);

  return (
    <div className="auth-form">
      <div className="auth-tabs">
        <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>登录</button>
        <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>注册</button>
      </div>
      <input
        className="auth-input"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="用户名"
        autoComplete="username"
      />
      <input
        className="auth-input"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="密码"
        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
      />
      {err && <p className="auth-err">{err}</p>}
      <Button size="lg" disabled={busy || !username || !password} onClick={submit}>
        {busy ? '请稍候…' : mode === 'login' ? '登录' : '注册并登录'}
      </Button>
      <p className="auth-hint">自用登录，仅用于多设备同步与学习报告。</p>
    </div>
  );
}

// ---- 学习报告（本地 store 计算，离线也能看）----
function LocalReport() {
  const chars = useGameStore((s) => s.chars);
  const coins = useGameStore((s) => s.coins);
  const streak = useGameStore((s) => s.streak);

  const stats = useMemo(() => {
    const entries = Object.entries(chars);
    const learned = entries.length;
    const totalStars = entries.reduce((n, [, v]) => n + (v.stars ?? 0), 0);
    const mastered = entries.filter(([, v]) => (v.box ?? 0) >= 4).length;
    const now = Date.now();
    const dueToday = entries.filter(([, v]) => v.due && v.due <= now).length;
    // 各主题完成度
    const byTheme = CURRICULUM.map((t) => {
      const themeChars = t.lessons.flatMap((l) => l.chars.map((c) => c.char));
      const done = themeChars.filter((c) => chars[c]).length;
      return { name: t.name, emoji: t.emoji, done, total: themeChars.length, color: t.color };
    });
    return { learned, totalStars, mastered, dueToday, byTheme };
  }, [chars]);

  return (
    <div className="report">
      <div className="report-cards">
        <div className="report-card"><span className="rc-num">{stats.learned}</span><span className="rc-label">已学字</span></div>
        <div className="report-card"><span className="rc-num">{stats.mastered}</span><span className="rc-label">已掌握</span></div>
        <div className="report-card"><span className="rc-num">{stats.totalStars}</span><span className="rc-label">总星星</span></div>
        <div className="report-card"><span className="rc-num">{stats.dueToday}</span><span className="rc-label">待复习</span></div>
        <div className="report-card"><span className="rc-num">🔥{streak.count}</span><span className="rc-label">连续天</span></div>
        <div className="report-card"><span className="rc-num">🪙{coins}</span><span className="rc-label">金币</span></div>
      </div>

      <h3 className="report-subtitle">各主题进度</h3>
      <div className="report-themes">
        {stats.byTheme.map((t) => (
          <div key={t.name} className="report-theme">
            <span className="rt-name">{t.emoji} {t.name}</span>
            <div className="rt-bar">
              <div className="rt-fill" style={{ width: `${(t.done / t.total) * 100}%`, background: t.color }} />
            </div>
            <span className="rt-count">{t.done}/{t.total}</span>
          </div>
        ))}
      </div>
      <p className="report-note">共 {ALL_CHARS.length} 字，继续加油！</p>
    </div>
  );
}

// ---- 个性化设置面板（护眼模式 / 使用时长 / 声音）----
// 对标参考图的「个性定制」四宫格：这里做护眼、使用时长、背景音乐、音效四块。
const TIME_CAP_OPTIONS = [0, 15, 20, 30, 45, 60]; // 每日上限分钟，0=不限

function SettingsPanel() {
  const sound = useSound();
  const { eyecare, setEyecare, timeCap, setTimeCap, usageSeconds, resetUsageToday } =
    useSettings();
  const [bgm, setBgm] = useState(() => isBgmEnabled());
  // 音效开关沿用 useSound 的 localStorage（默认开）。
  const [sfx, setSfx] = useState(() => {
    try {
      return localStorage.getItem('jarvis-child-sound') !== 'off';
    } catch {
      return true;
    }
  });

  const usedMin = Math.floor(usageSeconds / 60);

  return (
    <section className="parent-settings">
      <h3 className="report-subtitle">个性设置</h3>
      <div className="settings-grid">
        {/* 护眼模式 */}
        <div className="setting-tile">
          <span className="setting-icon">🌙</span>
          <span className="setting-name">护眼模式</span>
          <button
            className={`toggle ${eyecare ? 'on' : ''}`}
            role="switch"
            aria-checked={eyecare}
            aria-label="护眼模式"
            onClick={() => { sound.tap(); setEyecare(!eyecare); }}
          >
            <span className="toggle-knob" />
          </button>
        </div>

        {/* 背景音乐 */}
        <div className="setting-tile">
          <span className="setting-icon">🎵</span>
          <span className="setting-name">背景音乐</span>
          <button
            className={`toggle ${bgm ? 'on' : ''}`}
            role="switch"
            aria-checked={bgm}
            aria-label="背景音乐"
            onClick={() => { sound.tap(); const v = !bgm; setBgm(v); setBgmEnabled(v); }}
          >
            <span className="toggle-knob" />
          </button>
        </div>

        {/* 音效 */}
        <div className="setting-tile">
          <span className="setting-icon">🔔</span>
          <span className="setting-name">音效</span>
          <button
            className={`toggle ${sfx ? 'on' : ''}`}
            role="switch"
            aria-checked={sfx}
            aria-label="音效"
            onClick={() => { const v = !sfx; setSfx(v); sound.setEnabled(v); if (v) sound.tap(); }}
          >
            <span className="toggle-knob" />
          </button>
        </div>

        {/* 使用时长 */}
        <div className="setting-tile wide">
          <span className="setting-icon">⏰</span>
          <span className="setting-name">
            每日使用时长
            <span className="setting-sub">今日已用 {usedMin} 分钟</span>
          </span>
          <select
            className="setting-select"
            value={timeCap}
            onChange={(e) => { sound.tap(); setTimeCap(Number(e.target.value)); }}
            aria-label="每日使用时长上限"
          >
            {TIME_CAP_OPTIONS.map((m) => (
              <option key={m} value={m}>{m === 0 ? '不限' : `${m} 分钟`}</option>
            ))}
          </select>
        </div>
      </div>
      {timeCap > 0 && usedMin > 0 && (
        <button className="link-btn" onClick={() => { sound.tap(); resetUsageToday(); }}>
          重置今日用时
        </button>
      )}
    </section>
  );
}

export default function Parent() {
  const navigate = useNavigate();
  const [passed, setPassed] = useState(false);
  const [logged, setLogged] = useState(isLoggedIn());
  const [profiles, setProfiles] = useState([]);
  const [activeId, setActiveId] = useState(getActiveProfileId());
  const [syncMsg, setSyncMsg] = useState('');

  const resetAll = useGameStore((s) => s.resetAll);

  // 登录后拉取档案列表。
  const refreshProfiles = useCallback(async () => {
    if (!isLoggedIn()) return;
    try {
      const list = await api.listProfiles();
      setProfiles(list);
      // 没有激活档案时，默认选第一个（或提示新建）。
      if (list.length && getActiveProfileId() == null) {
        setActiveProfileId(list[0].id);
        setActiveId(list[0].id);
      }
    } catch {
      // 忽略，未登录或网络问题
    }
  }, []);

  useEffect(() => {
    if (logged) refreshProfiles();
  }, [logged, refreshProfiles]);

  const handleCreateProfile = useCallback(async () => {
    const nickname = prompt('孩子昵称？');
    if (!nickname) return;
    try {
      const p = await api.createProfile(nickname.trim());
      setActiveProfileId(p.id);
      setActiveId(p.id);
      await refreshProfiles();
    } catch (e) {
      alert('创建失败：' + e.message);
    }
  }, [refreshProfiles]);

  const handleSync = useCallback(async () => {
    setSyncMsg('同步中…');
    const r = await syncNow();
    setSyncMsg(r.ok ? '已同步 ✓' : `同步失败：${r.reason}`);
    setTimeout(() => setSyncMsg(''), 3000);
  }, []);

  const handleLogout = useCallback(() => {
    api.logout();
    setActiveProfileId(null);
    setActiveId(null);
    setLogged(false);
    setProfiles([]);
  }, []);

  if (!passed) {
    return (
      <PageTransition>
        <div className="page parent-page">
          <header className="sub-header">
            <button className="btn-icon" onClick={() => navigate('/')} aria-label="返回">←</button>
            <h2 className="sub-title">家长中心</h2>
            <span style={{ width: 44 }} />
          </header>
          <Gate onPass={() => setPassed(true)} />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="page parent-page">
        <header className="sub-header">
          <button className="btn-icon" onClick={() => navigate('/')} aria-label="返回">←</button>
          <h2 className="sub-title">家长中心</h2>
          <span style={{ width: 44 }} />
        </header>

        {/* 学习报告：始终展示（基于本地进度）。 */}
        <LocalReport />

        {/* 个性化设置：护眼模式 + 使用时长 */}
        <SettingsPanel />

        {/* 账号区 */}
        <section className="parent-account">
          <h3 className="report-subtitle">账号与同步</h3>
          {!logged ? (
            <AuthForm onDone={() => setLogged(true)} />
          ) : (
            <div className="account-panel">
              <div className="profile-row">
                <span>当前孩子档案：</span>
                <select
                  value={activeId ?? ''}
                  onChange={(e) => { setActiveProfileId(Number(e.target.value)); setActiveId(Number(e.target.value)); }}
                >
                  {profiles.length === 0 && <option value="">（无，请新建）</option>}
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>{p.avatar} {p.nickname}</option>
                  ))}
                </select>
                <button className="link-btn" onClick={handleCreateProfile}>+ 新建</button>
              </div>
              <div className="account-actions">
                <Button variant="secondary" onClick={handleSync}>☁️ 立即同步</Button>
                <Button variant="ghost" onClick={handleLogout}>退出登录</Button>
              </div>
              {syncMsg && <p className="sync-msg">{syncMsg}</p>}
            </div>
          )}
        </section>

        {/* 危险操作 */}
        <section className="parent-danger">
          <button
            className="link-btn danger"
            onClick={() => {
              if (confirm('确定清空本机所有学习进度？此操作不可撤销。')) resetAll();
            }}
          >
            清空本机进度
          </button>
        </section>
      </div>
    </PageTransition>
  );
}
