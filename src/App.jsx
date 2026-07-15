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
import SettingsOverlay from './components/SettingsOverlay.jsx';
import { useBgmController } from './hooks/useBgm.js';

export default function App() {
  useBgmController(); // 背景音乐：首次交互后循环播放，跨页面不打断
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
        </Routes>
      </AnimatePresence>
      {/* 全局叠层：护眼滤镜 + 使用时长锁定，跨页面常驻 */}
      <SettingsOverlay />
    </>
  );
}
