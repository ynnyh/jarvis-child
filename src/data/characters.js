// 字库数据：按主题分组，每个字包含拼音、组词、emoji 联想图与一句趣味释义。
// 面向 3-6 岁儿童，组词与释义尽量简单、贴近生活。

export const THEMES = [
  {
    id: 'numbers',
    name: '数字',
    emoji: '🔢',
    color: '#FF8FB1',
    chars: [
      { char: '一', pinyin: 'yī', emoji: '☝️', words: ['一个', '第一'], hint: '伸出一根手指，就是一。' },
      { char: '二', pinyin: 'èr', emoji: '✌️', words: ['二月', '二十'], hint: '两横叠一起，就是二。' },
      { char: '三', pinyin: 'sān', emoji: '🖐️', words: ['三角', '三天'], hint: '三条横线，数一数是三。' },
      { char: '四', pinyin: 'sì', emoji: '🍀', words: ['四季', '四方'], hint: '一年有四个季节。' },
      { char: '五', pinyin: 'wǔ', emoji: '🖐️', words: ['五个', '五彩'], hint: '一只手有五根手指。' },
      { char: '六', pinyin: 'liù', emoji: '🎲', words: ['六月', '六一'], hint: '骰子最大是六点。' },
      { char: '七', pinyin: 'qī', emoji: '🌈', words: ['七彩', '七天'], hint: '彩虹有七种颜色。' },
      { char: '八', pinyin: 'bā', emoji: '🐙', words: ['八月', '八方'], hint: '章鱼有八条腿。' },
      { char: '九', pinyin: 'jiǔ', emoji: '9️⃣', words: ['九个', '九月'], hint: '八再加一就是九。' },
      { char: '十', pinyin: 'shí', emoji: '🔟', words: ['十个', '十分'], hint: '两只手合起来是十根手指。' },
    ],
  },
  {
    id: 'nature',
    name: '大自然',
    emoji: '🌳',
    color: '#5CC9A7',
    chars: [
      { char: '日', pinyin: 'rì', emoji: '☀️', words: ['日出', '生日'], hint: '太阳圆圆的，就是日。' },
      { char: '月', pinyin: 'yuè', emoji: '🌙', words: ['月亮', '月饼'], hint: '晚上天上弯弯的是月。' },
      { char: '水', pinyin: 'shuǐ', emoji: '💧', words: ['喝水', '水果'], hint: '喝的水，游泳的水。' },
      { char: '火', pinyin: 'huǒ', emoji: '🔥', words: ['火车', '火苗'], hint: '红红的火，热热的。' },
      { char: '山', pinyin: 'shān', emoji: '⛰️', words: ['大山', '爬山'], hint: '高高的山，有三个尖尖。' },
      { char: '天', pinyin: 'tiān', emoji: '🌤️', words: ['天空', '今天'], hint: '抬头看到蓝蓝的天。' },
      { char: '云', pinyin: 'yún', emoji: '☁️', words: ['白云', '云朵'], hint: '天上飘的白云。' },
      { char: '雨', pinyin: 'yǔ', emoji: '🌧️', words: ['下雨', '雨伞'], hint: '下雨啦，滴答滴答。' },
    ],
  },
  {
    id: 'body',
    name: '小身体',
    emoji: '👀',
    color: '#6FA8FF',
    chars: [
      { char: '人', pinyin: 'rén', emoji: '🧍', words: ['大人', '人们'], hint: '一撇一捺，站着的人。' },
      { char: '口', pinyin: 'kǒu', emoji: '👄', words: ['大口', '开口'], hint: '嘴巴张开是一个口。' },
      { char: '手', pinyin: 'shǒu', emoji: '✋', words: ['小手', '拍手'], hint: '拍拍你的两只小手。' },
      { char: '目', pinyin: 'mù', emoji: '👁️', words: ['目光', '题目'], hint: '目就是眼睛哦。' },
      { char: '耳', pinyin: 'ěr', emoji: '👂', words: ['耳朵', '木耳'], hint: '用耳朵听声音。' },
      { char: '足', pinyin: 'zú', emoji: '🦶', words: ['足球', '手足'], hint: '足就是脚，能踢足球。' },
    ],
  },
  {
    id: 'animals',
    name: '小动物',
    emoji: '🐱',
    color: '#FFB454',
    chars: [
      { char: '猫', pinyin: 'māo', emoji: '🐱', words: ['小猫', '猫咪'], hint: '喵喵叫的小猫。' },
      { char: '狗', pinyin: 'gǒu', emoji: '🐶', words: ['小狗', '狗狗'], hint: '汪汪叫的小狗。' },
      { char: '鸟', pinyin: 'niǎo', emoji: '🐦', words: ['小鸟', '鸟窝'], hint: '会飞的小鸟。' },
      { char: '鱼', pinyin: 'yú', emoji: '🐟', words: ['金鱼', '小鱼'], hint: '水里游的小鱼。' },
      { char: '马', pinyin: 'mǎ', emoji: '🐴', words: ['小马', '马路'], hint: '跑得很快的马。' },
      { char: '牛', pinyin: 'niú', emoji: '🐮', words: ['小牛', '牛奶'], hint: '哞哞叫，会产牛奶。' },
      { char: '羊', pinyin: 'yáng', emoji: '🐑', words: ['小羊', '山羊'], hint: '咩咩叫的小羊。' },
    ],
  },
  {
    id: 'family',
    name: '我的家',
    emoji: '❤️',
    color: '#C08CFF',
    chars: [
      { char: '爸', pinyin: 'bà', emoji: '👨', words: ['爸爸', '爸妈'], hint: '爱我的爸爸。' },
      { char: '妈', pinyin: 'mā', emoji: '👩', words: ['妈妈', '妈咪'], hint: '爱我的妈妈。' },
      { char: '哥', pinyin: 'gē', emoji: '👦', words: ['哥哥', '大哥'], hint: '比我大的哥哥。' },
      { char: '姐', pinyin: 'jiě', emoji: '👧', words: ['姐姐', '大姐'], hint: '比我大的姐姐。' },
    ],
  },
];

// 展平所有字，方便按 char 查找与统计。
export const ALL_CHARS = THEMES.flatMap((theme) =>
  theme.chars.map((c) => ({ ...c, themeId: theme.id, themeName: theme.name }))
);

export function getTheme(themeId) {
  return THEMES.find((t) => t.id === themeId);
}

export function getChar(char) {
  return ALL_CHARS.find((c) => c.char === char);
}

// 供抽取脚本使用：所有需要笔画数据的字。
export const CHAR_LIST = ALL_CHARS.map((c) => c.char);
