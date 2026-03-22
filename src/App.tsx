import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "leaflet/dist/leaflet.css";

import { useAuth } from "./context/AuthContext";

import Navbar from "./components/Navbar";
import ParticlesBackground from "./components/ParticlesBackground";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";

import Login from "./pages/Login";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";

import Weight from "./pages/activities/weight/Weight";
import Lifting from "./pages/activities/lifting/Lifting";
import Hiking from "./pages/activities/hiking/Hiking";
import Surfing from "./pages/activities/surfing/Surfing.tsx";
import Running from "./pages/activities/running/Running";
import Snorkeling from "./pages/activities/snorkeling/Snorkeling";
import Skiing from "./pages/activities/skiing/Skiing";

const activityComponents: Record<string, React.FC> = {
  weight: Weight,
  lifting: Lifting,
  hiking: Hiking,
  surfing: Surfing,
  running: Running,
  snorkeling: Snorkeling,
  skiing: Skiing,
};

export default function App() {
  const { activities, loading } = useAuth();

  if (loading) {
    return <div className="text-white p-4">Loading...</div>;
  }

  return (
    <div className="relative min-h-screen bg-[#0f172a] text-white overflow-hidden">
      <ParticlesBackground />
      <Router>
        <ErrorBoundary>
          <div className="relative z-10 flex flex-col min-h-screen">
            <Navbar />
            <main className="flex-grow p-4 w-full">
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <Home />
                    </ProtectedRoute>
                  }
                />
                {activities.map((activity) => {
                  const Component = activityComponents[activity.slug];
                  if (!Component) return null;
                  return (
                    <Route
                      key={activity.slug}
                      path={`/${activity.slug}`}
                      element={
                        <ProtectedRoute>
                          <Component />
                        </ProtectedRoute>
                      }
                    />
                  );
                })}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
          </div>
        </ErrorBoundary>
      </Router>
    </div>
  );
}
