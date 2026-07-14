// 用 edge-tts（微软 Edge 在线 TTS，免费、免 key、中文质量高）为字库里所有
// 需要朗读的文本预生成 mp3，输出到 public/audio/，并写一份 manifest.json 映射表。
//
// 为什么预生成而不是用浏览器 Web Speech API：
//   1. 浏览器语音依赖用户设备的语音包，很多设备（尤其平板）没有中文语音包就完全静音；
//   2. 不同设备发音不一致、质量不可控。
// 预生成音频打包进应用后：发音固定、离线可用、所有设备一致。
//
// 这些 mp3 会提交进 git（构建环境没有 edge-tts，且不应依赖外部服务）。
// 用法：npm run generate-audio      （只补缺失的，已存在的跳过）
//      npm run generate-audio -- --force   （强制全部重生成）
//
// 依赖：本机需安装 edge-tts CLI（pip install edge-tts）。

import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public', 'audio');
const manifestPath = join(outDir, 'manifest.json');

// 活泼女声、卡通风格，适合儿童。可换 zh-CN-YunxiaNeural（男童声，Cute）。
const VOICE = 'zh-CN-XiaoyiNeural';
// 稍慢一点，方便小朋友听清（edge-tts 用百分比，-10% 约等于放慢）。
const RATE = '-10%';

const FORCE = process.argv.includes('--force');

const { THEMES, ALL_CHARS } = await import('../src/data/characters.js');

// 代码里用到的反馈语（Learn/Game 页面）。集中在这里，方便和 UI 保持一致。
const FEEDBACK = ['太棒啦', '对啦', '再试试'];

// 收集所有需要朗读的文本，去重。
const texts = new Set();
for (const t of THEMES) texts.add(t.name);
for (const c of ALL_CHARS) {
  texts.add(c.char);
  for (const w of c.words) texts.add(w);
}
for (const f of FEEDBACK) texts.add(f);

// 文本 -> 稳定短文件名（sha1 前 12 位），避免中文/长词做文件名的跨平台隐患。
function fileIdFor(text) {
  return createHash('sha1').update(text).digest('hex').slice(0, 12);
}

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

// 调 edge-tts CLI 生成单个 mp3。
function synth(text, outPath) {
  return new Promise((resolve, reject) => {
    // --rate 的值以 '-' 开头（如 -10%），必须用 --rate=xxx 等号形式，
    // 否则 argparse 会把 -10% 误当成另一个选项。--text 同理用等号更稳妥。
    const args = [
      '--voice', VOICE,
      `--rate=${RATE}`,
      `--text=${text}`,
      '--write-media', outPath,
    ];
    const proc = spawn('edge-tts', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (d) => (stderr += d));
    proc.on('error', reject); // CLI 不存在等
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`edge-tts 退出码 ${code}: ${stderr.trim()}`));
    });
  });
}

await mkdir(outDir, { recursive: true });

const manifest = {}; // text -> "audio/<id>.mp3"
let generated = 0;
let skipped = 0;
const failed = [];

// 逐个生成（edge-tts 是网络调用，控制节奏，避免被限流）。
for (const text of texts) {
  const id = fileIdFor(text);
  const rel = `audio/${id}.mp3`;
  const abs = join(outDir, `${id}.mp3`);
  manifest[text] = rel;

  if (!FORCE && (await exists(abs))) {
    skipped += 1;
    continue;
  }
  try {
    await synth(text, abs);
    generated += 1;
    process.stdout.write(`  ✓ ${text} → ${rel}\n`);
  } catch (err) {
    failed.push({ text, error: String(err.message || err) });
    process.stderr.write(`  ✗ ${text}: ${err.message || err}\n`);
  }
}

// manifest 用文本原文做 key，前端按文本查音频路径。
await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

console.log(
  `\n完成：新生成 ${generated}，跳过 ${skipped}，失败 ${failed.length}，共 ${texts.size} 条文本。`
);
console.log(`manifest → public/audio/manifest.json（${Object.keys(manifest).length} 条）`);
if (failed.length) {
  console.warn('以下文本生成失败，可重跑补齐：', failed.map((f) => f.text).join(' '));
  process.exitCode = 1;
}
