import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import 'leaflet/dist/leaflet.css'

import Navbar from './components/Navbar'
import ParticlesBackground from './components/ParticlesBackground'
import Home from './pages/Home'
import Weight from './pages/Weight'
import Lifts from './pages/Lifts'
import Hikes from './pages/Hike'
import Surf from './pages/Surf'
import Run from './pages/Run'

export default function App() {
  return (
    <div className="relative min-h-screen bg-[#0f172a] text-white overflow-hidden">
      <ParticlesBackground />
      <Router>
        <div className="relative z-10 flex flex-col min-h-screen">
          <Navbar />
          <main className="flex-grow p-4 w-full">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/log/weight" element={<Weight />} />
              <Route path="/log/lifts" element={<Lifts />} />
              <Route path="/log/hikes" element={<Hikes />} />
              <Route path="/log/surf" element={<Surf />} />
              <Route path="/log/run" element={<Run />} />
              {/* Add more routes as needed */}
            </Routes>
          </main>
        </div>
      </Router>
    </div>
  )
}
