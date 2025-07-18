import WeightProgress from "./activities/weight/WeightProgress";
import LiftProgress from "./activities/lifting/LiftingHomeCard";
import HikeProgress from "./activities/hiking/HikeProgress";
import RunProgress from "./activities/running/RunProgress";
import SurfProgress from "./activities/surfing/SurfProgress";
import SnorkelingProgress from "./activities/snorkeling/SnorkelingProgress";

import CardGrid from "../components/CardGrid";

export default function Home() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 max-w-screen-xl mx-auto">
      <section className="mb-12">
        <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-white">
          📈 Your Progress
        </h2>
        <CardGrid cols="grid-cols-1 md:grid-cols-2 gap-4">
          <WeightProgress />
          <LiftProgress />
        </CardGrid>
      </section>

      <section className="mb-20">
        <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-white">
          🌲 Latest Outdoor Activity
        </h2>
        <CardGrid cols="grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <SurfProgress />
          <HikeProgress />
          <RunProgress />
          <SnorkelingProgress />
        </CardGrid>
      </section>
    </div>
  );
}
