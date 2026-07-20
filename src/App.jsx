// 应用路由。用 AnimatePresence + useLocation 让路由切换有转场动效。
// 路由约定：
//   /                       世界选择（首页，5 个主题小世界）
//   /world/:themeId         世界内关卡路径（6 关蜿蜒小路）
//   /lesson/:lessonId       课程页（一课的字表 + 学习/游戏入口）
//   /learn/:lessonId/:char  单字学习闭环（7 步）
//   /game/:lessonId         巩固游戏
//   /review                 今日复习
//   /pet                    宠物养成
//   /parent                 家长中心
//   /story                  绘本屋（书架）
//   /story/:storyId         绘本阅读页（逐页翻阅 + 朗读）
//   /shop                   商店（食物/装扮/装饰，金币消费出口）
//   /collection             字卡收集册（300 字按主题分组）
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import WorldSelect from './pages/WorldSelect.jsx';
import WorldPath from './pages/WorldPath.jsx';
import Lesson from './pages/Lesson.jsx';
import LearnFlow from './pages/LearnFlow.jsx';
import GamePlay from './pages/GamePlay.jsx';
import Pet from './pages/Pet.jsx';
import Parent from './pages/Parent.jsx';
import StoryShelf from './pages/StoryShelf.jsx';
import StoryReader from './pages/StoryReader.jsx';
import Shop from './pages/Shop.jsx';
import Collection from './pages/Collection.jsx';
import SettingsOverlay from './components/SettingsOverlay.jsx';
import StartGate from './components/StartGate.jsx';
import BottomNav from './components/BottomNav.jsx';
import { useBgmController } from './hooks/useBgm.js';

export default function App() {
  useBgmController(); // 背景音乐：由开场门 StartGate 启动，此 hook 负责跨页连续 + 切后台暂停/恢复
  const location = useLocation();
  return (
    <>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<WorldSelect />} />
          <Route path="/world/:themeId" element={<WorldPath />} />
          <Route path="/lesson/:lessonId" element={<Lesson />} />
          <Route path="/learn/:lessonId/:char" element={<LearnFlow />} />
          <Route path="/game/:lessonId" element={<GamePlay />} />
          <Route path="/review" element={<GamePlay mode="review" />} />
          <Route path="/pet" element={<Pet />} />
          <Route path="/parent" element={<Parent />} />
          <Route path="/story" element={<StoryShelf />} />
          <Route path="/story/:storyId" element={<StoryReader />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/collection" element={<Collection />} />
        </Routes>
      </AnimatePresence>
      {/* 全局底部导航（阶段 5）：按路由显隐，规则见 BottomNav.jsx 头注释 */}
      <BottomNav />
      {/* 全局叠层：护眼滤镜 + 使用时长锁定，跨页面常驻 */}
      <SettingsOverlay />
      {/* 开场欢迎门：会话首次进入时铺满全屏，点大喇叭解锁音乐+音效（满足自动播放策略） */}
      <StartGate />
    </>
  );
}
