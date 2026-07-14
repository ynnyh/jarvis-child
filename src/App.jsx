import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Theme from './pages/Theme.jsx';
import Learn from './pages/Learn.jsx';
import Game from './pages/Game.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/theme/:themeId" element={<Theme />} />
      <Route path="/learn/:char" element={<Learn />} />
      <Route path="/game/:themeId" element={<Game />} />
    </Routes>
  );
}
