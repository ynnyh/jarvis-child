// 应用路由。用 AnimatePresence + useLocation 让路由切换有转场动效。
// 路由约定：
//   /                       关卡地图（首页）
//   /lesson/:lessonId       课程页（一课的字表 + 学习/游戏入口）
//   /learn/:lessonId/:char  单字学习闭环（情境→象形→认读→书写）
//   /game/:lessonId         巩固游戏
//   /review                 今日复习（P5）
//   /pet                    宠物养成（P6）
//   /parent                 家长中心（P8）
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import MapHome from './pages/MapHome.jsx';
import Lesson from './pages/Lesson.jsx';
import LearnFlow from './pages/LearnFlow.jsx';
import GamePlay from './pages/GamePlay.jsx';
import Pet from './pages/Pet.jsx';
import Parent from './pages/Parent.jsx';

export default function App() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<MapHome />} />
        <Route path="/lesson/:lessonId" element={<Lesson />} />
        <Route path="/learn/:lessonId/:char" element={<LearnFlow />} />
        <Route path="/game/:lessonId" element={<GamePlay />} />
        <Route path="/review" element={<GamePlay mode="review" />} />
        <Route path="/pet" element={<Pet />} />
        <Route path="/parent" element={<Parent />} />
      </Routes>
    </AnimatePresence>
  );
}
