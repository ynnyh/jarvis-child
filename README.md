# 🐣 宝宝识字（网页版）

面向 3-6 岁儿童的识字 Web 应用，参考洪恩识字的「认字 → 学写 → 游戏复习」学习闭环。
React + Vite + [hanzi-writer](https://hanziwriter.org/) 实现，笔顺动画与描红测评离线可用。

## 功能

- **首页**：主题选择（数字 / 大自然 / 小身体 / 小动物 / 我的家），显示累计星星
- **主题页**：主题内字表、已得星星、复习游戏入口
- **学习闭环**：
  - 认字：大字 + emoji 联想 + 拼音 + 组词，点击发音
  - 学写：先看笔顺动画，再描红测评，按错误次数给 1-3 星
- **复习游戏**：听音选字，答对给星、答错抖动提示
- 进度与星星存 `localStorage`，无需后端

## 本地开发

```bash
npm install
npm run extract-chars   # 从 hanzi-writer-data 抽取用到的字的笔画数据到 public/char-data/
npm run dev             # http://localhost:5173/
```

> `public/char-data/` 是生成产物，不入库。首次开发或加字后需重新运行 `npm run extract-chars`。

## 构建

```bash
npm run build           # 产物在 dist/
```

## 加字

1. 在 `src/data/characters.js` 对应主题里加字（含拼音、组词、emoji、hint）
2. 运行 `npm run extract-chars` 重新抽取笔画数据
3. 重新 `npm run dev` / `npm run build`

## 部署

Docker + nginx 静态托管，映射到服务器 712 端口：

```bash
bash deploy.sh          # 打包 → 上传 spark → docker build → 运行容器
```

访问 `http://111.228.10.230:712/`。

## 技术说明

- **发音**：浏览器 Web Speech API，中文语音质量取决于系统；无中文语音时静默降级。
- **描红**：触屏（平板/手机）体验最佳，鼠标亦可。
- **路由**：HashRouter，纯静态部署无需服务端路由配置。
