import { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "leaflet/dist/leaflet.css";

import { supabase } from "./api/supabaseClient"; // adjust import path

import Navbar from "./components/Navbar";
import ParticlesBackground from "./components/ParticlesBackground";
import ProtectedRoute from "./components/ProtectedRoute";

import Login from "./pages/Login";
import Home from "./pages/Home";

import Weight from "./pages/activities/weight/weight";
import Lifts from "./pages/activities/lifting/lifting";
import Hikes from "./pages/activities/hiking/hiking";
import Surf from "./pages/activities/surfing/surfing";
import Run from "./pages/activities/running/running";
import Snorkel from "./pages/activities/snorkeling/snorkeling";

// Map slug values from your DB to components
const activityComponents: Record<string, React.FC> = {
  weight: Weight,
  lifting: Lifts,
  hiking: Hikes,
  surfing: Surf,
  running: Run,
  snorkeling: Snorkel,
};

export default function App() {
  const [slugs, setSlugs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchActivitySlugs() {
      const { data, error } = await supabase.from("activities").select("slug");

      if (error) {
        console.error("Error fetching activity slugs:", error);
        setLoading(false);
        return;
      }

      if (data) {
        const fetchedSlugs = data.map((item) => item.slug);
        setSlugs(fetchedSlugs);
      }
      setLoading(false);
    }

    fetchActivitySlugs();
  }, []);

  if (loading) {
    return <div className="text-white p-4">Loading...</div>;
  }

  return (
    <div className="relative min-h-screen bg-[#0f172a] text-white overflow-hidden">
      <ParticlesBackground />
      <Router>
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
              {slugs.map((slug) => {
                const Component = activityComponents[slug];
                if (!Component) {
                  return null;
                }
                return (
                  <Route
                    key={slug}
                    path={`/${slug}`}
                    element={
                      <ProtectedRoute>
                        <Component />
                      </ProtectedRoute>
                    }
                  />
                );
              })}
            </Routes>
          </main>
        </div>
      </Router>
    </div>
  );
}
