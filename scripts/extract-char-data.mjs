// 从 hanzi-writer-data 包中抽取“字库用到的字”的笔画 JSON，
// 拷贝到 public/char-data/ 下，供前端离线加载（不走 CDN）。
//
// 用法：npm run extract-chars

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// 从字库数据里读出需要的字列表。characters.js 是 ESM，直接 import。
const { CHAR_LIST } = await import('../src/data/characters.js');

// 定位 hanzi-writer-data 包目录。
const dataPkgJson = require.resolve('hanzi-writer-data/package.json');
const dataDir = dirname(dataPkgJson);

const outDir = join(__dirname, '..', 'public', 'char-data');
await mkdir(outDir, { recursive: true });

const missing = [];
let written = 0;

for (const char of CHAR_LIST) {
  const src = join(dataDir, `${char}.json`);
  try {
    await access(src);
  } catch {
    missing.push(char);
    continue;
  }
  const content = await readFile(src, 'utf8');
  // 校验一下是合法 JSON，避免拷进坏数据。
  JSON.parse(content);
  await writeFile(join(outDir, `${char}.json`), content, 'utf8');
  written += 1;
}

console.log(`✓ 已抽取 ${written} 个字的笔画数据 → public/char-data/`);
if (missing.length) {
  console.warn(`⚠ 以下字在 hanzi-writer-data 中未找到，请检查：${missing.join(' ')}`);
  process.exitCode = 1;
}
