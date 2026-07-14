// 从 curriculum 导出纯字表（顺序保留），供 Python 脚本 gen-linguistic.py 读取。
// 输出：scripts/generated/charlist.json
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { SKELETON_CHARS } = await import('./curriculum.mjs');

const genDir = join(__dirname, 'generated');
await mkdir(genDir, { recursive: true });

const chars = SKELETON_CHARS.map((c) => c.char);
await writeFile(join(genDir, 'charlist.json'), JSON.stringify(chars, null, 2), 'utf8');

console.log(`✓ 已导出 ${chars.length} 字 -> scripts/generated/charlist.json`);
