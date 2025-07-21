import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";

import WeightProgress from "./activities/weight/WeightHomeCard";
import LiftProgress from "./activities/lifting/LiftingHomeCard";
import HikeProgress from "./activities/hiking/HikingHomeCard";
import RunProgress from "./activities/running/RunningHomeCard";
import SurfProgress from "./activities/surfing/SurfingHomeCard";
import SnorkelingProgress from "./activities/snorkeling/SnorkelingHomeCard";

import CardGrid from "../components/CardGrid";

type ActivityFlags = {
  [key: string]: boolean;
};

export default function Home() {
  const [userId, setUserId] = useState<string | null>(null);
  const [active, setActive] = useState<ActivityFlags>({});

  // Getting the userId
  useEffect(() => {
    const getUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error("Failed to get user:", error.message);
        return;
      }
      setUserId(data?.user?.id || null);
    };

    getUser();
  }, []);

  // Getting activities
  useEffect(() => {
    async function fetchActiveActivities() {
      if (!userId) return;

      const { data, error } = await supabase
        .from("activities")
        .select("slug, is_active")
        .eq("user_id", userId);

      if (error) {
        console.error("Failed to fetch activities:", error);
        return;
      }

      const activeFlags: ActivityFlags = {};
      data.forEach((activity) => {
        activeFlags[activity.slug] = activity.is_active;
      });
      setActive(activeFlags);
    }

    fetchActiveActivities();
  }, [userId]);

  const hasProgress =
    active.weight || active.lifting;

  const hasOutdoor =
    active.surfing || active.hiking || active.running || active.snorkeling;

  return (
    <div className="px-4 sm:px-6 lg:px-8 max-w-screen-xl mx-auto">
      <section className="mb-12">
        <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-white">
          📈 Your Progress
        </h2>
        {hasProgress ? (
          <CardGrid cols="grid-cols-1 md:grid-cols-2 gap-4">
            {active.weight && <WeightProgress />}
            {active.lifting && <LiftProgress />}
          </CardGrid>
        ) : (
          <p className="text-gray-400">No progress yet.</p>
        )}
      </section>

      <section className="mb-20">
        <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-white">
          🌲 Latest Outdoor Activity
        </h2>
        {hasOutdoor ? (
          <CardGrid cols="grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {active.surfing && <SurfProgress />}
            {active.hiking && <HikeProgress />}
            {active.running && <RunProgress />}
            {active.snorkeling && <SnorkelingProgress />}
          </CardGrid>
        ) : (
          <p className="text-gray-400">No outdoor activities yet.</p>
        )}
      </section>
    </div>
  );
}
