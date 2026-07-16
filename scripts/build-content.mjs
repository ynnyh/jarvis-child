// 内容合并管线：把多个来源合并成前端使用的最终字库数据。
//
// 数据来源：
//   1. scripts/curriculum.mjs           —— 课程骨架（主题/课/选字，人工编排）
//   2. scripts/generated/linguistic.json —— 拼音 + 部件（pypinyin + hanzi_chaizi 自动生成）
//   3. hanzi-writer-data                 —— 笔画数（strokes 数组长度）
//   4. src/data/metadata/*.js            —— 手工教学元数据（emoji/hint/组词/例句/象形/多音字覆盖）
//
// 产出：src/data/content.generated.js  —— 导出 CURRICULUM / ALL_CHARS / 查询函数 / CHAR_LIST / AUDIO_TEXTS
//
// 设计原则：元数据缺失也能跑（给兜底），并报告缺失清单，支持增量填充。
// 用法：npm run build-content

import { readFile, writeFile, readdir, access } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const { CURRICULUM } = await import('./curriculum.mjs');
const { STORIES } = await import('./stories.mjs');

// --- 1) 读语言学数据（拼音 + 部件）---
const linguisticPath = join(__dirname, 'generated', 'linguistic.json');
let linguistic = {};
try {
  linguistic = JSON.parse(await readFile(linguisticPath, 'utf8'));
} catch {
  console.error(`✗ 缺少 ${linguisticPath}，请先运行：node scripts/export-charlist.mjs && python scripts/gen-linguistic.py`);
  process.exit(1);
}

// --- 2) 定位 hanzi-writer-data，用于读笔画数 ---
const dataPkgJson = require.resolve('hanzi-writer-data/package.json');
const dataDir = dirname(dataPkgJson);

async function strokeCount(char) {
  try {
    const raw = await readFile(join(dataDir, `${char}.json`), 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data.strokes) ? data.strokes.length : null;
  } catch {
    return null;
  }
}

// --- 3) 加载所有手工元数据文件 src/data/metadata/*.js ---
const metaDir = join(__dirname, '..', 'src', 'data', 'metadata');
let metadata = {};
try {
  const files = (await readdir(metaDir)).filter((f) => f.endsWith('.js'));
  for (const f of files) {
    const mod = await import(pathToFileURL(join(metaDir, f)).href);
    Object.assign(metadata, mod.default ?? {});
  }
} catch {
  // 元数据目录还不存在也没关系，全部走兜底。
}

// --- 4) 合并 ---
const missingMeta = [];
const audioTexts = new Set(); // 需要生成音频的文本：主题名 + 字 + 组词 + 例句 + 反馈语
// 反馈/界面口播语：所有 JSX 里 speak('字面量') 的短语都必须列在这里，
// 否则运行时静音降级到不可靠的浏览器 TTS。新增口播文案后同步维护。
const FEEDBACK = [
  '太棒啦', '真厉害', '对啦', '再试试', '加油',
  '选一个小世界', '绘本馆', '今天要复习啦', '先完成前面的关卡哦',
  '写得好棒', '再看看哦', '金币不够啦', '小墨升级啦', '真好吃',
];
FEEDBACK.forEach((t) => audioTexts.add(t));

const curriculumOut = [];

for (const theme of CURRICULUM) {
  audioTexts.add(theme.name);
  const lessonsOut = [];
  for (const lesson of theme.lessons) {
    const charsOut = [];
    for (const char of lesson.chars) {
      const ling = linguistic[char] ?? {};
      const meta = metadata[char] ?? {};
      if (!metadata[char]) missingMeta.push(char);

      const strokes = await strokeCount(char);
      // 多音字：元数据 pinyinOverride 优先。
      const pinyin = meta.pinyinOverride ?? ling.pinyin ?? '';
      const components = ling.components ?? [char];

      // 组词标准化为 { word, emoji? }
      const words = (meta.words ?? []).map((w) =>
        typeof w === 'string' ? { word: w } : { word: w.w ?? w.word, emoji: w.e ?? w.emoji }
      );

      // 收集音频文本
      audioTexts.add(char);
      words.forEach((w) => audioTexts.add(w.word));
      if (meta.sentence) audioTexts.add(meta.sentence);
      if (meta.hint) audioTexts.add(meta.hint); // hint 也要发声（情境导入时朗读）

      charsOut.push({
        char,
        pinyin,
        strokes,
        components,
        emoji: meta.emoji ?? '📖',
        hint: meta.hint ?? '',
        words,
        sentence: meta.sentence ?? '',
        pictograph: meta.pictograph ?? null, // 象形演变步骤，仅象形字有
        themeId: theme.id,
        themeName: theme.name,
        lessonId: lesson.id,
        lessonName: lesson.name,
      });
    }
    lessonsOut.push({ id: lesson.id, name: lesson.name, chars: charsOut });
  }
  curriculumOut.push({
    id: theme.id,
    name: theme.name,
    emoji: theme.emoji,
    color: theme.color,
    lessons: lessonsOut,
  });
}

// --- 4.5) 收集绘本朗读文本（书名 + 每页句子）---
for (const story of STORIES) {
  audioTexts.add(story.title);
  for (const page of story.pages) {
    if (page.text) audioTexts.add(page.text);
  }
}

// --- 5) 生成前端数据文件 ---
const header = `// ⚠️ 本文件由 scripts/build-content.mjs 自动生成，请勿手动编辑。
// 数据来源：curriculum.mjs（骨架）+ pypinyin/hanzi_chaizi（拼音/部件）+ hanzi-writer-data（笔画）+ src/data/metadata/*（教学元数据）。
// 重新生成：npm run build-content
`;

const body = `${header}
export const CURRICULUM = ${JSON.stringify(curriculumOut, null, 2)};

// 展平所有字（含主题/课信息），便于查找与统计。
export const ALL_CHARS = CURRICULUM.flatMap((theme) =>
  theme.lessons.flatMap((lesson) => lesson.chars)
);

// 所有课（含主题信息），供关卡地图使用。
export const ALL_LESSONS = CURRICULUM.flatMap((theme) =>
  theme.lessons.map((lesson) => ({
    ...lesson,
    themeId: theme.id,
    themeName: theme.name,
    themeColor: theme.color,
    themeEmoji: theme.emoji,
  }))
);

export function getTheme(themeId) {
  return CURRICULUM.find((t) => t.id === themeId);
}

export function getLesson(lessonId) {
  return ALL_LESSONS.find((l) => l.id === lessonId);
}

export function getChar(char) {
  return ALL_CHARS.find((c) => c.char === char);
}

// 绘本故事库（原样透传，供绘本阅读页使用）。
export const STORIES = ${JSON.stringify(STORIES, null, 2)};

export function getStory(storyId) {
  return STORIES.find((s) => s.id === storyId);
}

export function getStoryByTheme(themeId) {
  return STORIES.find((s) => s.themeId === themeId);
}

// 供 extract-chars 使用：所有需要笔画数据的字。
export const CHAR_LIST = ALL_CHARS.map((c) => c.char);

// 供 generate-audio 使用：所有需要朗读的文本。
export const AUDIO_TEXTS = ${JSON.stringify([...audioTexts], null, 2)};
`;

const outPath = join(__dirname, '..', 'src', 'data', 'content.generated.js');
await writeFile(outPath, body, 'utf8');

console.log(`✓ 已生成 src/data/content.generated.js`);
console.log(`  ${curriculumOut.length} 主题 · ${CURRICULUM.reduce((n, t) => n + t.lessons.length, 0)} 课 · ${[...audioTexts].length} 条待朗读文本`);
if (missingMeta.length) {
  console.warn(`⚠ ${missingMeta.length}/300 字缺教学元数据（走兜底），待填充：`);
  console.warn('  ' + missingMeta.join(' '));
}
