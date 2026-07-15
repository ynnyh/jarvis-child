// 绘本故事库（人工编排，纯文字 + emoji，无插画素材，遵循 VISUAL-v3 原则）。
// 每个主题一册短绘本，句子尽量落在该主题已学的字词范围内，句式短、贴近 3-6 岁。
//
// 结构：
//   id       故事唯一 id
//   themeId  归属主题（决定封面色，与 curriculum 对应）
//   title    书名（会朗读）
//   cover    封面 emoji
//   pages[]  逐页：{ text 朗读句子, emoji 大插画, focus? 本页重点字（高亮） }
//
// 朗读：title + 每页 text 会被 build-content.mjs 收进 AUDIO_TEXTS，
// 由 generate-audio.mjs 预生成 mp3；缺音频时前端自动降级到浏览器 TTS。

export const STORIES = [
  {
    id: 's-first',
    themeId: 'first',
    title: '小鸭子数一数',
    cover: '🦆',
    pages: [
      { text: '一只小鸭子去河边。', emoji: '🦆', focus: '一' },
      { text: '河里有二条小鱼。', emoji: '🐟', focus: '二' },
      { text: '岸上开着三朵花。', emoji: '🌸', focus: '三' },
      { text: '树上挂着四个果子。', emoji: '🍎', focus: '四' },
      { text: '天上飞过五只小鸟。', emoji: '🐦', focus: '五' },
      { text: '小鸭子数得真开心！', emoji: '😄' },
    ],
  },
  {
    id: 's-nature',
    themeId: 'nature',
    title: '小水滴去旅行',
    cover: '💧',
    pages: [
      { text: '我是一颗小水滴，住在大海里。', emoji: '💧', focus: '水' },
      { text: '太阳出来了，我变成一朵白云。', emoji: '☁️', focus: '云' },
      { text: '风一吹，我飘呀飘。', emoji: '🌬️', focus: '风' },
      { text: '下雨啦，我落到山上。', emoji: '🌧️', focus: '雨' },
      { text: '我流进小河，又回到大海。', emoji: '🏞️', focus: '河' },
      { text: '明天，我还要去旅行！', emoji: '🌈' },
    ],
  },
  {
    id: 's-myself',
    themeId: 'myself',
    title: '我的一天',
    cover: '🧒',
    pages: [
      { text: '早上，我睁开眼睛。', emoji: '👀', focus: '眼' },
      { text: '我用小手刷刷牙。', emoji: '🪥', focus: '手' },
      { text: '我张开嘴巴吃早饭。', emoji: '🍚', focus: '口' },
      { text: '我用小脚跑去上学。', emoji: '👟', focus: '足' },
      { text: '晚上，我读一本书。', emoji: '📖', focus: '读' },
      { text: '该睡觉啦，晚安！', emoji: '🌙' },
    ],
  },
  {
    id: 's-things',
    themeId: 'things',
    title: '小猫找朋友',
    cover: '🐱',
    pages: [
      { text: '小猫想找朋友一起玩。', emoji: '🐱', focus: '猫' },
      { text: '它遇见了一只小狗。', emoji: '🐶', focus: '狗' },
      { text: '又遇见了一只小鸟。', emoji: '🐦', focus: '鸟' },
      { text: '小鱼在水里游来游去。', emoji: '🐟', focus: '鱼' },
      { text: '大家一起做游戏。', emoji: '🎈' },
      { text: '有朋友，真开心！', emoji: '🥰' },
    ],
  },
  {
    id: 's-life',
    themeId: 'life',
    title: '全家一起玩',
    cover: '❤️',
    pages: [
      { text: '爸爸妈妈带我出门。', emoji: '👨‍👩‍👦', focus: '爸' },
      { text: '我们一起去公园。', emoji: '🌳', focus: '我' },
      { text: '我看见红花和绿草。', emoji: '🌸', focus: '红' },
      { text: '哥哥买了甜甜的糖。', emoji: '🍬', focus: '甜' },
      { text: '我们一起拍张照片。', emoji: '📸' },
      { text: '一家人，最幸福！', emoji: '❤️' },
    ],
  },
];
