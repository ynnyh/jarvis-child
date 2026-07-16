---
name: kids-edtech-design
description: 本项目(3-6 岁儿童识字 App)专属的儿童导向 UI 设计准则。设计/重构/新增任何面向孩子的页面、组件、样式前必读;也是改动后的验收标准。涵盖色彩、汉字排版、小手交互、游戏化动效、反模式清单与逐屏检查表。
---

# 幼儿识字 App · 儿童导向设计 Skill

> 角色设定:你是幼儿数字教育产品(3-6 岁)的资深设计师,深谙儿童认知负荷、
> 精细动作能力与心理激励机制。设计识字页面、游戏化卡片、教育界面时,
> **严格拒绝"成人化"设计范式**,执行以下面向儿童的具体标准。
>
> 每条准则都绑定到本项目的 token / 组件 / 文件,可量化、可验收。
> "简陋感"的根源从来不是缺功能,而是执行处偷懒 —— 本 skill 的反模式清单(§5)
> 就是历史上真实出现过的偷懒,禁止回潮。

## §0 本项目地基(动手前必须知道)

1. **tokens.css 是唯一数据源**。所有颜色/圆角/间距/字号/阴影/缓动必须引用
   `src/styles/tokens.css` 的变量;需要新值就先加 token 再引用,禁止组件里写裸色值。
2. **字体分工(v3 已定,不许推翻)**:
   - 学习用汉字(认读/字理/例句大字):`--font-kai` 楷体 —— 字形标准,适合识字书写认知;
     **禁止**给汉字用圆体(字形变形会误导书写)。
   - 拉丁/数字/拼音:`--font-ui`(自托管 Baloo 2 圆体)。
3. **⚠️ 音频硬约束**:所有口语文案都是预生成 mp3(edge-tts 流水线,见
   `scripts/`)。**新增任何 `speak()` 文本 = 必须重跑 `npm run build-content` +
   `npm run generate-audio`(仅本机有 edge-tts),否则运行时静音降级**。
   纯视觉重构应做到 **零新增口语文案**。
4. **验证方式(项目无 lint/test runner)**:`npm run build`(语法/引用)、
   `npm run validate-curriculum`(内容完整性)、`npm run preview`(HTTP 冒烟)。
   交互/动效只能 `npm run dev` 真浏览器确认,报告时要诚实区分"代码推断"与"实际观察"。

## §1 色彩与认知负荷

- **暖调、高饱和、有邀请感**。页面底色用 `--c-paper`(暖纸白),卡片用
  `--c-card-warm`(暖奶白)。**禁止纯白 `#fff` 大面积卡面、禁止科技灰**。
  纯白只允许作为高光/浪花等小面积点缀。
- **主题色驱动**:五大世界各有主题色(`--c-first/nature/myself/things/life`),
  页面经由 `--theme-color` 注入,强调元素(进度、高亮、题干)必须吃主题色,
  让每个世界"换一身衣服"。
- **一屏一个主角**:正在学的字/题干是唯一视觉焦点,装饰(云/星/泡)一律
  `pointer-events:none` 且不得与主角争夺对比度。认知负荷 > 花哨。
- 功能色:成功 `--c-success`、错误 `--c-error`(错误反馈要柔和,配鼓励不配惩罚)。

## §2 汉字排版与字形教学(识字核心)

- **大字 C 位**:目标汉字最小 64px,主学习场景用 `--f-huge`(96px = 6rem),
  楷体、居中、独占舞台。拼音紧贴其下,用 `--f-xl` + 主题色。
- **偏旁部首高对比分色**(字理教学的灵魂):
  - 有部首含义的部件 → 珊瑚系强调块:`--radical-bg/--radical-ink/--radical-edge`;
  - 其余部件 → 淡蓝块:`--comp-bg/--comp-ink/--comp-edge`;
  - 让孩子一眼看出"哪块是部首、字由几块组成"。数据源 `src/data/radicals.js`。
- **笔顺清晰**:hanzi-writer 配置须用儿童友好高对比色 —— 部首笔画
  `radicalColor` 珊瑚、普通笔画深墨、轮廓浅灰、田字格底。描红画布保持干净底色。

## §3 小手交互(防挫败)

- **胖热区**:一切可点元素(按钮/选项/喇叭/箭头)`min-height: 64px`
  (`--tap-min`),pill 或大圆角方,内边距慷慨。小文字链接式按钮 = 违规。
- **显式按下态**:禁止只靠 hover(平板没有 hover)。用"厚底边下沉"范式:
  静止时厚彩色底边(`box-shadow: 0 6px 0 <深色>`),按下 `translateY` 下沉 +
  底边变薄 —— 现成参照 `.ui-btn--primary:active`。或 framer-motion
  `whileTap={{ scale: 0.9x }}` 果冻压缩。二选一必须有一,肉眼可见。
- **视听可供性**:凡可发声处必须用共用组件 `src/components/ui/SpeakerButton.jsx`
  (卡通圆喇叭,**就绪后周期性招手抖动**吸引点按,按下果冻压缩)。
  **禁止**再出现静态 `🔊` 文字 emoji 或各页自造喇叭。
- 反馈即时:点击必有音效(`useSound`)+ 视觉响应,120ms 内。

## §4 游戏化与果冻动效

- **成功必须爆炸式庆祝**:答对/写完/通关 → 星星弹跳(错落 stagger)、
  Confetti 撒花、小墨欢呼(`expression="cheer"`)。庆祝组件:`StarReward`、
  `Confetti`、`MascotReaction`,不许静默过关。
- **果冻物理**:交互回弹统一用 `--ease-juicy`
  (`cubic-bezier(0.175, 0.885, 0.32, 1.275)`)或 framer-motion spring
  (`stiffness 300-500, damping 12-24`)。元素被点/拖时要有"橡皮感"。
- **小墨必须活着**:吉祥物 `Xiaomo` 默认 `animate`(呼吸/眨眼),
  `animate={false}` 仅允许用于同屏出现多只(性能)或极小尺寸(<40px)场景。
  关键时刻小墨要在场:引导(happy)、思考(think)、答错鼓励(encourage)、
  庆祝(cheer)。
- **入场有生命**:卡片/选项列表用 stagger 依次弹入(`delay: i * 0.05`),
  大字揭示用 spring 缩放入场,不许生硬突现。

## §5 反模式(历史真实偷懒,禁止回潮)

| # | 反模式 | 替代做法 |
|---|---|---|
| 1 | 卡面 `background:#fff` / `var(--c-card)` 大面积纯白 | `--c-card-warm` 暖奶白 + 暖底边 |
| 2 | `<Xiaomo animate={false}/>` 把吉祥物钉成贴纸 | 默认 animate,例外见 §4 |
| 3 | 文字里塞静态 `🔊` 当播放键 | 共用 `SpeakerButton`(招手抖动) |
| 4 | 字理部件全墨色,部首无分色 | §2 部首珊瑚 / 部件淡蓝 |
| 5 | 小文字按钮(如 `.sent-play`、`.check-speaker`)< 64px | §3 胖 pill |
| 6 | 各处自造缓动/直线 transition | `--ease-juicy` 或 spring |
| 7 | 多种游戏题型共用一套朴素方块视觉 | 每题型有自己的舞台感(题干区配色/布局差异) |

## §6 逐屏检查清单(改完对照打勾)

| 屏 | 必查项 |
|---|---|
| WorldSelect + IslandScene | 建筑热区 ≥64px;小墨活;HUD 果冻;世界卡 stagger 入场 |
| WorldPath | 关卡节点胖、当前关脉冲、小墨站位活;通关庆祝爆炸 |
| Lesson | 字卡暖底、楷体大字、星星亮色;按钮胖 |
| LearnFlow 7 步 | 每步:大字 C 位楷体、SpeakerButton、暖卡面、答对庆祝、答错鼓励 |
| Etymology | 部首/部件分色块;飞入组字动画;结果字主题色 |
| 书写(HanziWriter) | 笔顺分色、田字格、完成庆祝 |
| GamePlay + MatchGame | 题型视觉差异化;选项 ≥64px;答对小墨欢呼 |
| StoryShelf / StoryReader | 封面暖色书本感;翻页动效;朗读用 SpeakerButton |
| Pet | 小墨大且活;喂养反馈爆炸式 |
| Parent | 成人页,豁免"游戏化"要求,但保持暖色调一致;门禁清晰 |

## §7 验证

1. `npm run build` —— 零报错。
2. `npm run validate-curriculum` —— 内容完整性不回归。
3. `git diff` 里搜 `speak(` —— 确认零新增口语文案(否则必须跑音频流水线)。
4. `npm run dev` 真浏览器过一遍 §6 清单,动效逐屏肉眼确认。
