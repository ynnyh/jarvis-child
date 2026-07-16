// 内容管线一致性校验（供 CI 和提交前跑）：
//   #19 漂移：重新生成 content.generated.js，与已提交版本比对，不一致即失败。
//   #20 覆盖：扫描所有 JSX 里的 speak('字面量')，断言都在 AUDIO_TEXTS 里，
//        否则运行时会静音降级到不可靠 TTS。
// 用法：node scripts/verify-content.mjs
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
let failed = 0;

// ---- #19：重新生成并比对（借 git diff 判断有无漂移）----
console.log('[1/2] 检查 content.generated.js 是否与源同步…');
try {
  execSync('node scripts/build-content.mjs', { cwd: ROOT, stdio: 'pipe' });
  const diff = execSync('git diff --name-only -- src/data/content.generated.js', {
    cwd: ROOT, encoding: 'utf8',
  }).trim();
  if (diff) {
    console.error('✗ content.generated.js 与源不同步：重新生成后有 diff。');
    console.error('  请运行 npm run build-content 并提交结果。');
    failed++;
  } else {
    console.log('  ✓ 已同步');
  }
} catch (e) {
  console.error('✗ 运行 build-content 失败：', e.message);
  failed++;
}

// ---- #20：扫描 speak('...') 字面量覆盖 ----
console.log('[2/2] 检查 speak() 字面量都有预生成音频…');

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (/\.(jsx?|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

const genPath = join(ROOT, 'src', 'data', 'content.generated.js');
const genSrc = readFileSync(genPath, 'utf8');
const audioMatch = genSrc.match(/export const AUDIO_TEXTS = (\[[\s\S]*?\]);/);
const audioTexts = audioMatch ? new Set(JSON.parse(audioMatch[1])) : new Set();

// 匹配 speak('字面量') / speak("字面量")，只查纯字符串字面量（变量无法静态检查）。
const speakLiteral = /speak\(\s*(['"])((?:\\.|(?!\1).)*)\1/g;
const srcFiles = walk(join(ROOT, 'src'));
const missing = new Map(); // 文本 -> 文件
for (const f of srcFiles) {
  const src = readFileSync(f, 'utf8');
  let m;
  while ((m = speakLiteral.exec(src)) !== null) {
    const text = m[2];
    if (!text) continue;
    if (!audioTexts.has(text)) {
      missing.set(text, f.replace(ROOT, '').replace(/^[\\/]/, ''));
    }
  }
}
if (missing.size) {
  console.error(`✗ ${missing.size} 条 speak() 文案缺预生成音频（会静音降级 TTS）：`);
  for (const [text, file] of missing) {
    console.error(`  "${text}"  ← ${file}`);
  }
  console.error('  修复：把这些短语加入 scripts/build-content.mjs 的 FEEDBACK 白名单，再 build-content + generate-audio。');
  failed++;
} else {
  console.log('  ✓ 所有 speak() 字面量都有音频');
}

console.log(failed ? `\n✗ 校验未通过（${failed} 项）` : '\n✓ 内容校验通过');
process.exit(failed ? 1 : 0);
