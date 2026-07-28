// 生成「暖音色」试听页：扫描 public/_audition/ 下由 gen-warm-sfx.py 合成的 wav，
// 按用途（文件名 <group>__<variant>.wav 的 group）分组，铺成可点播的 HTML。
//
// 与上一版（Kenney 素材）的区别：音色是自制马林巴/音乐盒/软铃铛/水泡，暖且有机，
// 每类只精选 2-3 个变体，不堆重复。用人耳在浏览器里挑，选中的编号发回来即可。
//
// 用法：node scripts/gen-warm-audition.mjs → 生成 public/_audition/index.html
//       npm run dev，浏览器开 http://localhost:<port>/_audition/index.html

import { readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const audDir = join(__dirname, '..', 'public', '_audition');

// 每组的中文标题 + 用途说明（挑选时对照「想要什么感觉」）。顺序即页面顺序。
const GROUPS = {
  tap: { title: '点击', want: '短促清脆一声，手指点任何按钮都会响，用得最多，要干净不烦。' },
  correct: { title: '答对', want: '愉悦的上行，像「叮咚✓」，小朋友答对时的即时肯定。' },
  wrong: { title: '答错', want: '柔和、不吓人，提示「再想想」而非批评。绝不能刺耳。' },
  swoosh: { title: '翻页 / 切换', want: '轻快的过场，翻卡片、切页面时一带而过。' },
  star: { title: '得星', want: '闪亮上行，得到一颗星星的高光小奖励。' },
  coin: { title: '金币', want: '清脆，捡到金币 / 加金币时。' },
  chest: { title: '开宝箱', want: '琶音上行，有「打开惊喜」的期待感。' },
  levelup: { title: '升级', want: '欢快，宠物 / 等级提升，比得星更「更进一步」。' },
  pop: { title: '气泡破', want: '一声「啵」，点泡泡游戏戳破泡泡。' },
  whack: { title: '敲击', want: '打地鼠敲中时的一下，有分量但不重。' },
  heartbreak: { title: '惋惜', want: '比答错更轻更「可惜」，差一点没答对时。温柔。' },
  victory: { title: '闯关胜利', want: '一小段欢快旋律，闯关成功的大高光。1 秒内最佳。' },
  fail: { title: '失败', want: '温和下行，回合结束但不打击信心。' },
  tick: { title: '滴答', want: '极短一声，倒计时 / 读秒。' },
  splash: { title: '入水', want: '「扑通」下滑，钓鱼游戏鱼入水。' },
  pluck: { title: '摘取 / 弹拨', want: '清脆单音，摘取、选中一个东西。' },
  combo: { title: '连击', want: '连续答对时叠加，会随连击数升调，这里听基准音。' },
  achievement: { title: '成就 / 每日奖励', want: '温暖的提示，完成每日任务 / 解锁成就（新增音效）。' },
};

const files = (await readdir(audDir)).filter((f) => f.endsWith('.wav'));

// 按 group 归拢：<group>__<variant>.wav
const byGroup = {};
for (const f of files) {
  const m = f.match(/^(.+?)__(.+)\.wav$/);
  if (!m) continue;
  const [, g, variant] = m;
  (byGroup[g] ??= []).push({ file: f, variant });
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

let total = 0;
const sections = Object.entries(GROUPS)
  .filter(([g]) => byGroup[g]?.length)
  .map(([g, meta]) => {
    const cands = byGroup[g]
      .sort((a, b) => a.variant.localeCompare(b.variant))
      .map(({ file, variant }) => {
        total++;
        return `      <label class="cand">
        <input type="checkbox" name="${g}" value="${esc(file)}" />
        <button type="button" class="play" data-src="/_audition/${esc(file)}" aria-label="播放">▶</button>
        <span class="nm">${esc(variant)}</span>
      </label>`;
      })
      .join('\n');
    return `  <section class="group">
    <h2>${esc(meta.title)} <code>${g}</code></h2>
    <p class="want">${esc(meta.want)}</p>
    <div class="cands">
${cands}
    </div>
  </section>`;
  })
  .join('\n');

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>暖音色试听 · 挑选</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
    background: #fef6ea; color: #2f3a4a; padding: 16px; padding-bottom: 140px; }
  h1 { font-size: 22px; margin: 4px 0 8px; }
  .intro { background: #fffdf8; border: 2px solid #ecdcc8; border-radius: 14px; padding: 12px 14px; font-size: 14px; line-height: 1.6; margin-bottom: 16px; }
  .intro b { color: #ec6a10; }
  .group { background: #fffdf8; border: 2px solid #ecdcc8; border-radius: 16px; padding: 12px 14px; margin-bottom: 14px; }
  .group h2 { font-size: 17px; margin: 0 0 2px; display: flex; align-items: center; gap: 8px; }
  .group h2 code { font-size: 12px; background: #fff4e2; color: #ec6a10; padding: 2px 8px; border-radius: 999px; font-weight: 600; }
  .want { margin: 0 0 10px; font-size: 13px; color: #667082; line-height: 1.5; }
  .cands { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px; }
  .cand { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 2px solid #ecdcc8; border-radius: 12px;
    cursor: pointer; background: #fff; transition: border-color .15s, background .15s; }
  .cand:hover { border-color: #ffc636; }
  .cand:has(input:checked) { border-color: #2fb377; background: #eafaf2; }
  .cand input { width: 18px; height: 18px; accent-color: #2fb377; flex: none; }
  .play { flex: none; width: 38px; height: 38px; border-radius: 50%; border: none; background: #4b90f5; color: #fff;
    font-size: 14px; cursor: pointer; display: grid; place-items: center; transition: transform .1s, background .15s; }
  .play:hover { background: #3a7fe0; }
  .play:active { transform: scale(0.92); }
  .play.playing { background: #2fb377; }
  .nm { font-size: 14px; font-weight: 600; }
  .bar { position: fixed; left: 0; right: 0; bottom: 0; background: #fffdf8; border-top: 2px solid #ecdcc8;
    padding: 12px 16px; display: flex; gap: 12px; align-items: center; box-shadow: 0 -4px 16px rgba(120,90,40,.1); }
  .bar button { border: none; border-radius: 999px; padding: 12px 20px; font-size: 15px; font-weight: 700; cursor: pointer; }
  #copyBtn { background: #2fb377; color: #fff; }
  #copyBtn:active { transform: scale(0.96); }
  .hint { font-size: 13px; color: #667082; }
  #out { position: fixed; left: 16px; right: 16px; bottom: 76px; background: #2f3a4a; color: #fff; border-radius: 12px;
    padding: 12px 14px; font-size: 13px; font-family: ui-monospace, monospace; white-space: pre-wrap; display: none; }
</style>
</head>
<body>
  <h1>🎧 暖音色试听 · 挑选</h1>
  <div class="intro">
    这版是<b>自制暖音色</b>（马林巴 / 音乐盒 / 软铃铛 / 水泡），每类精选 2-3 个，不堆重复。<br>
    点每个候选左边的 <b>▶</b> 听声；中意的<b>勾选</b>（每类可选 1 个，也可多选让我做随机轮换）。<br>
    选完点底部 <b>「复制我的选择」</b>，把结果发我即可。全部合成、<b>零版权</b>。
  </div>
${sections}
  <div id="out"></div>
  <div class="bar">
    <button id="copyBtn">📋 复制我的选择</button>
    <span class="hint">共 ${total} 个候选 · 选中会变绿</span>
  </div>
<script>
  let cur = null;
  document.querySelectorAll('.play').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (cur) { cur.pause(); cur.currentTime = 0; }
      document.querySelectorAll('.play.playing').forEach((b) => b.classList.remove('playing'));
      const a = new Audio(btn.dataset.src);
      cur = a;
      btn.classList.add('playing');
      a.play();
      a.onended = () => btn.classList.remove('playing');
    });
  });
  document.getElementById('copyBtn').addEventListener('click', () => {
    const picks = [];
    document.querySelectorAll('.group').forEach((sec) => {
      const g = sec.querySelector('h2 code').textContent;
      const sel = [...sec.querySelectorAll('input:checked')].map((i) => i.value.replace(/^.+?__/, '').replace(/\\.wav$/, ''));
      if (sel.length) picks.push(g + ' → ' + sel.join(', '));
    });
    const text = picks.length ? picks.join('\\n') : '(还没选任何音效)';
    const out = document.getElementById('out');
    out.textContent = text;
    out.style.display = 'block';
    navigator.clipboard?.writeText(text).catch(() => {});
  });
</script>
</body>
</html>
`;

await writeFile(join(audDir, 'index.html'), html, 'utf8');
console.log(`OK 暖音色试听页 → public/_audition/index.html （${total} 个候选，${Object.keys(byGroup).length} 组）`);
