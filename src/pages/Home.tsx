import { useAuth } from "../context/AuthContext";

import WeightProgress from "./activities/weight/WeightHomeCard";
import LiftProgress from "./activities/lifting/LiftingHomeCard";
import HikeProgress from "./activities/hiking/HikingHomeCard";
import RunProgress from "./activities/running/RunningHomeCard";
import SurfProgress from "./activities/surfing/SurfingHomeCard";
import SnorkelingProgress from "./activities/snorkeling/SnorkelingHomeCard";
import SkiingProgress from "./activities/skiing/SkiingHomeCard";
import GolfingProgress from "./activities/golfing/GolfingHomeCard";
import BasketballProgress from "./activities/basketball/BasketballHomeCard";
import VolleyballProgress from "./activities/volleyball/VolleyballHomeCard";

import CardGrid from "../components/CardGrid";

const cardComponents: Record<string, React.FC> = {
  weight: WeightProgress,
  lifting: LiftProgress,
  running: RunProgress,
  golfing: GolfingProgress,
  hiking: HikeProgress,
  surfing: SurfProgress,
  skiing: SkiingProgress,
  snorkeling: SnorkelingProgress,
  basketball: BasketballProgress,
  volleyball: VolleyballProgress,
};

const progressSlugs = new Set(["weight", "lifting"]);

export default function Home() {
  const { activities } = useAuth();

  const sorted = activities
    .filter((a) => a.is_active && cardComponents[a.slug])
    .sort((a, b) => {
      if (a.placement_row === b.placement_row) {
        return a.placement_col - b.placement_col;
      }
      return a.placement_row - b.placement_row;
    });

  const progress = sorted.filter((a) => progressSlugs.has(a.slug));
  const outdoor = sorted.filter((a) => !progressSlugs.has(a.slug));

  return (
    <div className="px-4 sm:px-6 lg:px-8 max-w-screen-xl mx-auto">
      <section className="mb-12">
        <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-white">
          📈 Your Progress
        </h2>
        {progress.length > 0 ? (
          <CardGrid cols="grid-cols-1 md:grid-cols-2 gap-4">
            {progress.map((a) => {
              const Card = cardComponents[a.slug];
              return <Card key={a.slug} />;
            })}
          </CardGrid>
        ) : (
          <p className="text-gray-400">No progress activities yet.</p>
        )}
      </section>

      <section className="mb-20">
        <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-white">
          🌲 Latest Outdoor Activity
        </h2>
        {outdoor.length > 0 ? (
          <CardGrid cols="grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {outdoor.map((a) => {
              const Card = cardComponents[a.slug];
              return <Card key={a.slug} />;
            })}
          </CardGrid>
        ) : (
          <p className="text-gray-400">No outdoor activities yet.</p>
        )}
      </section>
    </div>
  );
}
