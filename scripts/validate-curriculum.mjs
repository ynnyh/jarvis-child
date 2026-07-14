// 校验课程骨架：
//   1. 总字数是否 = 300
//   2. 是否有重复字（全局唯一）
//   3. 每个字在 hanzi-writer-data 中是否有笔画数据（没有就无法做描红）
// 用法：node scripts/validate-curriculum.mjs
import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const { CURRICULUM, SKELETON_CHARS } = await import('./curriculum.mjs');

const dataDir = dirname(require.resolve('hanzi-writer-data/package.json'));

async function hasStrokeData(char) {
  try {
    await access(join(dataDir, `${char}.json`));
    return true;
  } catch {
    return false;
  }
}

// 1) 总数
const total = SKELETON_CHARS.length;

// 2) 重复检测
const seen = new Map(); // char -> [位置...]
for (const c of SKELETON_CHARS) {
  const where = `${c.themeId}/${c.lessonId}`;
  if (!seen.has(c.char)) seen.set(c.char, []);
  seen.get(c.char).push(where);
}
const dups = [...seen.entries()].filter(([, arr]) => arr.length > 1);

// 3) 缺笔画数据
const missing = [];
for (const c of SKELETON_CHARS) {
  if (!(await hasStrokeData(c.char))) missing.push(c.char);
}

// 每课字数检查
const badLessons = [];
for (const theme of CURRICULUM) {
  for (const lesson of theme.lessons) {
    if (lesson.chars.length !== 10) {
      badLessons.push(`${theme.id}/${lesson.id}: ${lesson.chars.length} 字`);
    }
  }
}

console.log(`总字数：${total}（目标 300）`);
console.log(`唯一字数：${seen.size}`);
console.log(`主题数：${CURRICULUM.length}，课数：${CURRICULUM.reduce((n, t) => n + t.lessons.length, 0)}`);

let ok = true;
if (total !== 300) { console.error(`✗ 总数不是 300`); ok = false; }
if (badLessons.length) { console.error(`✗ 非 10 字的课：\n  ${badLessons.join('\n  ')}`); ok = false; }
if (dups.length) {
  console.error(`✗ 重复字 ${dups.length} 个：`);
  for (const [char, arr] of dups) console.error(`  ${char} 出现在：${arr.join(', ')}`);
  ok = false;
}
if (missing.length) {
  console.error(`✗ 缺笔画数据 ${missing.length} 个：${missing.join(' ')}`);
  ok = false;
}

if (ok) console.log('\n✓ 校验通过：300 字，无重复，笔画数据齐全。');
else { console.error('\n请修正 curriculum.mjs 后重跑。'); process.exitCode = 1; }
