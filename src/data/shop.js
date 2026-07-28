// 商店商品配置（阶段 3 · 激励闭环）：金币的消费出口。
// 三类商品（type）：
//   food      食物（消耗品）：买来即喂给小墨，不进入 owned 库。
//             字段：exp 喂给小墨涨的经验；mood 心情值（阶段 4 宠物心情系统用，先配上）。
//   accessory 宠物装扮（拥有制）：买入后进 owned 库，可用 toggleEquip 穿戴/卸下。
//             unlockLevel 为宠物等级门槛（购买时校验 pet.level）；阶段 4 负责渲染穿戴效果。
//   decor     海岛装饰（拥有制）：买入后进 owned 库；阶段 5 负责渲染到海岛场景。
// 原有 3 种食物价格/经验沿用宠物页旧值（竹子 10/20、苹果 20/45、蛋糕 40/100），
// 新增 3 种更贵、经验更高的食物，给金币一个「攒大钱」的出口。
export const SHOP_ITEMS = [
  // ---- 食物（消耗品）----
  { id: 'bamboo', type: 'food', name: '竹子', icon: '🎋', price: 10, exp: 20, mood: 5 },
  { id: 'apple', type: 'food', name: '苹果', icon: '🍎', price: 20, exp: 45, mood: 10 },
  { id: 'cake', type: 'food', name: '蛋糕', icon: '🎂', price: 40, exp: 100, mood: 20 },
  { id: 'milk', type: 'food', name: '牛奶', icon: '🥛', price: 60, exp: 150, mood: 25 },
  { id: 'candy', type: 'food', name: '糖果', icon: '🍬', price: 80, exp: 210, mood: 35 },
  { id: 'feast', type: 'food', name: '豪华大餐', icon: '🍱', price: 120, exp: 320, mood: 50 },

  // ---- 宠物装扮（拥有制）----
  { id: 'straw-hat', type: 'accessory', name: '草帽', icon: '👒', price: 60 },
  { id: 'bow', type: 'accessory', name: '蝴蝶结', icon: '🎀', price: 80 },
  { id: 'glasses', type: 'accessory', name: '圆眼镜', icon: '👓', price: 100, unlockLevel: 3 },
  { id: 'scarf', type: 'accessory', name: '红领巾', icon: '🧣', price: 120, unlockLevel: 3 },
  { id: 'backpack', type: 'accessory', name: '小背包', icon: '🎒', price: 150, unlockLevel: 5 },
  { id: 'crown', type: 'accessory', name: '皇冠', icon: '👑', price: 200, unlockLevel: 5 },

  // ---- 海岛装饰（拥有制，阶段 5 渲染到海岛）----
  { id: 'flags', type: 'decor', name: '彩旗串', icon: '🎏', price: 100 },
  { id: 'windmill', type: 'decor', name: '风车', icon: '🌀', price: 150 },
  { id: 'boat', type: 'decor', name: '小船', icon: '⛵', price: 180 },
  { id: 'lighthouse', type: 'decor', name: '灯塔', icon: '🗼', price: 260 },
];

// 按 id 查商品，找不到返回 null。
export function getItem(id) {
  return SHOP_ITEMS.find((it) => it.id === id) ?? null;
}

// 按类型取商品列表（food / accessory / decor）。
export function itemsByType(type) {
  return SHOP_ITEMS.filter((it) => it.type === type);
}
