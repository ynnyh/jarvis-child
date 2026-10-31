# 🐣 宝宝识字（网页版）

面向 3-6 岁儿童的识字 Web 应用，参考洪恩识字的「认字 → 学写 → 游戏复习」学习闭环。
React + Vite + [hanzi-writer](https://hanziwriter.org/) 实现，笔顺动画与描红测评离线可用。

## 功能

- **世界选择（首页）**：5 大主题小世界（我的第一课 / 大自然 / 我自己 / 万物 / 我的生活），共 30 课 300 字；海岛彩蛋、装饰与每日惊喜
- **关卡路径**：主题内 6 关蜿蜒小路，显示已得星星，逐关解锁
- **学习闭环**（每字 7 步）：情境导入 → 字理讲解 → 认读 → 组词 → 例句 → 描红测评 → 即时检查，按书写错误数给 1-3 星
- **巩固游戏**：5 种舞台化小游戏（打地鼠·听音选字 / 点泡泡·看字选图 / 钓鱼·看图选字 / 连连看·字配拼音 / 描红），由统一游戏引擎调度
- **商店**：金币消费出口（宠物食物 / 装扮 / 海岛装饰）
- **字卡收集册**：300 字按主题分组，学过的字点亮
- **每日任务**：学字 / 玩游戏等计数，达成弹奖励
- **宠物养成**：喂食 / 装扮 / 互动，三维成长
- **绘本屋**：主题绘本逐页翻阅 + 朗读
- **家长中心**：音量、护眼、使用时长等设置
- 进度存 `localStorage`，登录后经后端云同步（多设备/多孩子档案）

## 本地开发

```bash
npm install
npm run dev             # http://localhost:5173/
```

> `public/char-data/`（笔画数据）是生成产物，不入库，首次开发或加字后需 `npm run extract-chars`；
> `public/audio/`（预生成语音）已入库，新增朗读文案才需重新生成。

常用内容脚本：

```bash
npm run validate-curriculum   # 校验课程骨架：全局无重复 + 笔画数据齐全
npm run build-content         # 合并字库数据 → src/data/content.generated.js
npm run verify-content        # 校验 content.generated.js 无漂移 + speak() 文案都有预生成音频
```

## 构建

```bash
npm run build           # 产物在 dist/
```

## 加字

1. 在 `scripts/curriculum.mjs` 对应主题的课程里加字（选字骨架，人工编排）
2. 在 `src/data/metadata/*.js` 补教学元数据（拼音之外的 emoji / hint / 组词 / 例句 / 象形演变）
3. 拼音与部件由脚本生成：新字需先 `npm run gen-linguistic`（依赖 Python + pypinyin/hanzi_chaizi）
4. `npm run build-content` 重新合并字库，`npm run extract-chars` 抽取新字笔画数据
5. 新增的朗读文案需 `npm run generate-audio` 补 mp3（依赖本机 edge-tts CLI）
6. `npm run validate-curriculum && npm run verify-content` 全部通过后提交

## 部署

前端 Docker + nginx 静态托管（712 端口），`/api/` 由 nginx 反代到后端容器：

```bash
bash deploy.sh          # 前端：打包 → 上传 spark → docker build → 运行容器
bash deploy-backend.sh  # 后端：构建并运行 FastAPI 容器（需先跑过 deploy.sh 上传源码）
```

后端在 `backend/`：FastAPI + SQLite，提供注册登录（JWT）、多孩子档案、进度云同步，
容器端口 713，数据存 docker volume。前后端共用 docker 网络 `jarvis-child-net`。

访问 `http://111.228.10.230:712/`。

## 技术说明

- **发音**：edge-tts 预生成 mp3（`public/audio/`，离线、各设备一致）为主，浏览器 Web Speech API 兜底。
- **描红**：触屏（平板/手机）体验最佳，鼠标亦可；笔画数据来自 hanzi-writer-data，已抽取到本地。
- **路由**：HashRouter，纯静态部署无需服务端路由配置。
- **状态**：zustand + `localStorage` 持久化，登录后增量同步到后端。
