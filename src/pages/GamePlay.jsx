// 巩固游戏引擎（阶段 2 重构）：3 颗心 + 连击金币 + 星级结算，分发到 5 个舞台化小游戏。
// 题型（type）：
//   mole    打地鼠：听音选字（MoleGame）
//   fish    钓鱼：看图选字（FishGame）
//   bubble  点泡泡：看字选图（BubbleGame）
//   match   连连看：字 ↔ 拼音配对（MatchGame，整屏一题）
//   trace   笔顺描红（TraceGame）
//
// 规则：
//   3 颗心：答错扣 1 心 + heartbreak + 演示正确答案（组件高亮正确项 + 朗读），
//           孩子亲手点对正确项后进入下一题（重试不再扣心）——选「演示后重试」而非自动跳过：
//           幼儿识字的核心是纠正闭环，看一遍答案再亲手点一次是正强化；自动跳过会把错误带过关。
//           心扣完 → 失败页（安慰奖 = 本局金币的一半，向下取整）。
//           连连看配错不扣心（试错配对是玩法本身），但计一次错误，影响连击与星级。
//   连击：首次尝试即对连击 +1，HUD 🔥×N；金币 = 1 币 × min(连击, 8)；答错连击清零。
//   星级：0 错 3 星 / 错 1-2 次 2 星 / 错 3+ 次 1 星；失败后「再试一次」通关最高 1 星
//        （本次会话内有效，从课程页重新进入则重新计算；store 侧仍取历史最高）。
//   复习模式（mode="review"）：每题按「首次尝试是否正确」调 reviewChar 驱动 Leitner
//        （连连看覆盖多字，不单字上报）。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getLesson, getChar, ALL_CHARS } from '../data/content.generated.js';
import { useSpeech } from '../hooks/useSpeech.js';
import { useSound } from '../hooks/useSound.js';
import { useGameStore } from '../store/useGameStore.js';
import Xiaomo from '../components/mascot/Xiaomo.jsx';
import MascotReaction from '../components/MascotReaction.jsx';
import PlayfulBackground from '../components/PlayfulBackground.jsx';
import Confetti from '../components/Confetti.jsx';
import DailyRewardToast from '../components/DailyRewardToast.jsx';
import MoleGame from '../components/games/MoleGame.jsx';
import BubbleGame from '../components/games/BubbleGame.jsx';
import FishGame from '../components/games/FishGame.jsx';
import MatchGame from '../components/games/MatchGame.jsx';
import TraceGame from '../components/games/TraceGame.jsx';
import { syncSoon } from '../api/sync.js';

const MAX_HEARTS = 3;

// Fisher-Yates 洗牌
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 干扰项优先同课（迷惑性更强），不足再从全库补；按展示字段去重
// （bubble 按 emoji，避免两个选项同一个图）。
function pickDistractors(target, lessonChars, n, field) {
  const seen = new Set([target[field] ?? target.char]);
  const acc = [];
  const pickFrom = (pool) => {
    for (const c of shuffle(pool)) {
      if (acc.length >= n) break;
      const key = c[field] ?? c.char;
      if (c.char === target.char || seen.has(key)) continue;
      seen.add(key);
      acc.push(c);
    }
  };
  pickFrom(lessonChars);
  if (acc.length < n) pickFrom(ALL_CHARS);
  return acc;
}

export default function GamePlay({ mode = 'lesson' }) {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const isReview = mode === 'review';
  const lesson = isReview ? null : getLesson(lessonId);
  const { speak } = useSpeech();
  const { play } = useSound();
  const reviewChar = useGameStore((s) => s.reviewChar);
  const addCoins = useGameStore((s) => s.addCoins);
  const completeLesson = useGameStore((s) => s.completeLesson);
  const checkIn = useGameStore((s) => s.checkIn);
  const trackDaily = useGameStore((s) => s.trackDaily);
  const getDueChars = useGameStore((s) => s.getDueChars);

  // 出题字源：复习模式取今日到期的字（映射回完整字数据），课程模式取本课字。
  const chars = useMemo(() => {
    if (isReview) {
      return getDueChars()
        .map((ch) => getChar(ch))
        .filter(Boolean);
    }
    return lesson ? lesson.chars : [];
  }, [isReview, lesson, getDueChars]);

  const [runId, setRunId] = useState(0); // 重玩时重新生成题目

  // 生成题目序列：每字一题随机题型（描红概率压低，避免太累），选项在此一并生成。
  const questions = useMemo(() => {
    if (chars.length === 0) return [];
    const singles = shuffle(chars).map((c) => {
      const roll = Math.random();
      // 30% 打地鼠 / 25% 钓鱼 / 25% 点泡泡 / 20% 描红
      let type;
      if (roll < 0.3) type = 'mole';
      else if (roll < 0.55) type = 'fish';
      else if (roll < 0.8) type = 'bubble';
      else type = 'trace';
      const q = { target: c, type };
      if (type !== 'trace') {
        const field = type === 'bubble' ? 'emoji' : 'char';
        q.options = shuffle([c, ...pickDistractors(c, chars, 3, field)]);
      }
      return q;
    });
    // 字数够时，中间插一道连连看整屏题（字↔拼音）。
    if (chars.length >= 4) {
      const mid = Math.floor(singles.length / 2);
      singles.splice(mid, 0, { type: 'match', target: chars[0] });
    }
    return singles;
  }, [chars, runId]);

  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState('play'); // play | settle | fail
  const [hearts, setHearts] = useState(MAX_HEARTS);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [coins, setCoins] = useState(0); // 本局已得金币（结算时才入库）
  const [reveal, setReveal] = useState(false); // 演示正确答案中
  const [reaction, setReaction] = useState(null); // 小墨反应
  const [stars, setStars] = useState(0); // 结算星级
  const [payout, setPayout] = useState(0); // 实际入账金币（失败减半）
  const [dailyReward, setDailyReward] = useState(null); // 每日任务完成通知

  // 供定时器回调读取的最新值（避免闭包过期）。
  const coinsRef = useRef(0);
  const wrongRef = useRef(0); // 本局错误次数（按首次尝试计）
  const starCapRef = useRef(3); // 失败重玩后封顶 1 星
  const timers = useRef([]);

  const current = questions[idx];

  // 卸载时清掉所有推进定时器，避免离开页面后 setState。
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));

  const pulseReaction = (type) => {
    setReaction(null);
    requestAnimationFrame(() => setReaction(type));
  };

  // 结束本局：落账（金币入库 + 课星级 + 打卡 + 防抖同步），切到结算/失败页。
  const endGame = useCallback(
    (passed) => {
      const earned = coinsRef.current;
      const pay = passed ? earned : Math.floor(earned / 2); // 失败安慰奖减半
      const w = wrongRef.current;
      const finalStars = Math.min(w === 0 ? 3 : w <= 2 ? 2 : 1, starCapRef.current);
      if (pay > 0) addCoins(pay);
      if (passed && !isReview && lesson) completeLesson(lessonId, finalStars);
      checkIn(); // 阶段 3 每日任务的前置：游戏结束即打卡
      // 每日任务「玩游戏」计数 +1（通关/失败都算玩过一局）；达成时弹通知。
      const dr = trackDaily('game');
      if (dr.completed.length) setDailyReward(dr);
      syncSoon();
      setPayout(pay);
      setStars(finalStars);
      setPhase(passed ? 'settle' : 'fail');
    },
    [addCoins, completeLesson, checkIn, trackDaily, isReview, lesson, lessonId]
  );

  const advance = useCallback(() => {
    setReveal(false);
    if (idx + 1 >= questions.length) endGame(true);
    else setIdx((i) => i + 1);
  }, [idx, questions.length, endGame]);

  // 统一答题处理（游戏组件 onResult 回调）。
  const handleResult = useCallback(
    (correct, info = {}) => {
      if (phase !== 'play' || !current) return;
      const firstTry = !!info.firstTry;

      if (correct && firstTry) {
        // 首次尝试即对：连击 +1，金币 = 1 × min(连击, 8)
        const next = combo + 1;
        setCombo(next);
        setMaxCombo((m) => Math.max(m, next));
        const gain = Math.min(next, 8);
        coinsRef.current += gain;
        setCoins(coinsRef.current);
        play('coin');
        play('combo', { pitch: 1 + Math.min(next, 10) * 0.06 });
        pulseReaction(next >= 3 ? 'cheer' : 'correct'); // 连击≥3 小墨欢呼
        // 复习按首次尝试记 Leitner；课程模式沿用旧行为（答对升盒）。连连看不单字上报。
        if (current.type !== 'match') reviewChar(current.target.char, true);
        later(advance, 750);
        return;
      }

      if (!correct) {
        // 首次答错：扣心 + 心碎，演示正确答案（组件负责高亮+朗读），等孩子点对
        setCombo(0);
        wrongRef.current += 1;
        if (isReview && current.type !== 'match') reviewChar(current.target.char, false);
        play('heartbreak');
        pulseReaction('wrong');
        const left = hearts - 1;
        setHearts(left);
        if (left <= 0) {
          later(() => endGame(false), 1100); // 心碎动画放完再进失败页
        } else {
          setReveal(true);
        }
        return;
      }

      // correct && !firstTry：演示后点对（不记分直接推进），
      // 或连连看有错配但全部配完（不扣心，但计一次错误）。
      if (current.type === 'match' && !reveal) {
        setCombo(0);
        wrongRef.current += 1;
      }
      later(advance, 600);
    },
    [phase, current, combo, hearts, reveal, isReview, play, reviewChar, advance, endGame]
  );

  // 结算/失败页入场音效与口播；结算星星逐颗配音。
  useEffect(() => {
    if (phase === 'settle') {
      play('victory');
      speak('太棒啦');
      const ts = [];
      for (let n = 0; n < stars; n++) {
        ts.push(setTimeout(() => play('star'), 500 + n * 450));
      }
      return () => ts.forEach(clearTimeout);
    }
    if (phase === 'fail') {
      play('fail');
      speak('加油');
    }
    return undefined;
  }, [phase, stars, play, speak]);

  // 重开一局：失败重试星级封顶 1，结算再玩恢复满 cap。
  const restart = (cap) => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    coinsRef.current = 0;
    wrongRef.current = 0;
    starCapRef.current = cap;
    setCoins(0);
    setCombo(0);
    setMaxCombo(0);
    setHearts(MAX_HEARTS);
    setIdx(0);
    setReveal(false);
    setDailyReward(null);
    setPhase('play');
    setRunId((r) => r + 1);
  };

  const goHome = () => {
    play('tap');
    navigate(isReview ? '/' : `/lesson/${lessonId}`);
  };

  // 课程模式找不到课，或复习模式没有到期的字，都给出返回入口。
  if (!isReview && !lesson) {
    return (
      <div className="page center-col">
        <p>找不到这一课。</p>
        <button className="ui-btn ui-btn--primary ui-btn--lg" onClick={() => { play('tap'); navigate('/'); }}>🏠 回首页</button>
      </div>
    );
  }
  if (isReview && chars.length === 0) {
    return (
      <div className="page center-col">
        <Xiaomo expression="happy" size={140} />
        <p className="q-tip">今天没有要复习的字，太棒啦！</p>
        <button className="ui-btn ui-btn--primary ui-btn--lg" onClick={() => { play('tap'); navigate('/'); }}>🏠 回首页</button>
      </div>
    );
  }

  // ---- 结算页：星星逐个弹跳落位 + 金币雨 + 最高连击 ----
  if (phase === 'settle') {
    return (
      <div className="page game-play" style={{ '--theme-color': isReview ? 'var(--c-brand)' : lesson.themeColor }}>
        <PlayfulBackground variant="sky" />
        <Confetti preset="coins" />
        <div className="page center-col result-wrap">
          <Xiaomo expression="celebrate" size={140} />
          <div className="reward-title">{isReview ? '复习完成！' : '闯关成功！'}</div>
          <div className="reward-stars">
            {[1, 2, 3].map((n) => (
              <motion.span
                key={n}
                className={`reward-star ${n <= stars ? 'filled' : 'empty'}`}
                initial={{ scale: 0, y: -46, rotate: -30 }}
                animate={{ scale: 1, y: 0, rotate: 0 }}
                transition={{ delay: 0.5 + (n - 1) * 0.45, type: 'spring', stiffness: 400, damping: 12 }}
              >
                {n <= stars ? '⭐' : '☆'}
              </motion.span>
            ))}
          </div>
          <motion.div
            className="result-stats"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 1.6, type: 'spring', stiffness: 300 }}
          >
            🔥 最高连击 ×{maxCombo} · 🪙 +{payout}
          </motion.div>
          <div className="result-btns">
            <button className="ui-btn ui-btn--secondary ui-btn--lg" onClick={() => { play('tap'); restart(3); }}>
              🔁 再玩一次
            </button>
            <button className="ui-btn ui-btn--primary ui-btn--lg" onClick={goHome}>
              🗺️ 回地图
            </button>
          </div>
        </div>
        {dailyReward && <DailyRewardToast reward={dailyReward} onDone={() => setDailyReward(null)} />}
      </div>
    );
  }

  // ---- 失败页：小墨晕了 + 鼓励 + 安慰奖 ----
  if (phase === 'fail') {
    return (
      <div className="page game-play" style={{ '--theme-color': isReview ? 'var(--c-brand)' : lesson.themeColor }}>
        <PlayfulBackground variant="cozy" />
        <div className="page center-col result-wrap">
          <Xiaomo expression="dizzy" size={140} />
          <div className="reward-title">差一点点，加油！</div>
          <p className="q-tip">小墨有点晕，休息一下再挑战吧</p>
          {payout > 0 && <div className="result-stats">安慰奖 🪙 +{payout}</div>}
          <div className="result-btns">
            <button className="ui-btn ui-btn--primary ui-btn--lg" onClick={() => { play('tap'); restart(1); }}>
              💪 再试一次
            </button>
            <button className="ui-btn ui-btn--secondary ui-btn--lg" onClick={goHome}>
              🗺️ 回地图
            </button>
          </div>
        </div>
        <MascotReaction type="dizzy" onHide={() => {}} />
        {dailyReward && <DailyRewardToast reward={dailyReward} onDone={() => setDailyReward(null)} />}
      </div>
    );
  }

  // ---- 游戏进行中：HUD + 舞台 ----
  return (
    <div className="page game-play" style={{ '--theme-color': isReview ? 'var(--c-brand)' : lesson.themeColor }}>
      <PlayfulBackground variant="sky" />
      <header className="sub-header game-hud">
        <button className="btn-icon" onClick={() => { play('tap'); navigate(-1); }} aria-label="返回">←</button>
        <div className="hud-hearts" aria-label={`剩余 ${hearts} 颗心`}>
          {[0, 1, 2].map((i) => (
            <motion.span
              key={`${i}-${i < hearts}`}
              className="hud-heart"
              initial={i < hearts ? false : { scale: 1.9, rotate: -24 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 12 }}
            >
              {i < hearts ? '❤️' : '💔'}
            </motion.span>
          ))}
        </div>
        {combo >= 2 && (
          <motion.span
            key={combo}
            className="hud-combo"
            initial={{ scale: 1.6, y: -6 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 10 }}
          >
            🔥×{combo}
          </motion.span>
        )}
        <motion.span
          key={coins}
          className="hud-coins"
          initial={{ scale: 1.5 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 12 }}
        >
          🪙{coins}
        </motion.span>
      </header>
      <div className="game-hud-sub">
        <div className="game-progress-bar">
          <div className="game-progress-fill" style={{ width: `${((idx + 1) / questions.length) * 100}%` }} />
        </div>
        <span className="game-count">{idx + 1}/{questions.length}</span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${runId}-${idx}`}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.25 }}
        >
          {current && current.type === 'mole' && (
            <MoleGame target={current.target} options={current.options} reveal={reveal} onResult={handleResult} onSpeak={speak} onSound={play} />
          )}
          {current && current.type === 'bubble' && (
            <BubbleGame target={current.target} options={current.options} reveal={reveal} onResult={handleResult} onSpeak={speak} onSound={play} />
          )}
          {current && current.type === 'fish' && (
            <FishGame target={current.target} options={current.options} reveal={reveal} onResult={handleResult} onSpeak={speak} onSound={play} />
          )}
          {current && current.type === 'match' && (
            <MatchGame chars={chars} onResult={handleResult} onSpeak={speak} onSound={play} />
          )}
          {current && current.type === 'trace' && (
            <TraceGame target={current.target} reveal={reveal} onResult={handleResult} onSpeak={speak} onSound={play} />
          )}
        </motion.div>
      </AnimatePresence>
      <MascotReaction type={reaction} onHide={() => setReaction(null)} />
    </div>
  );
}
