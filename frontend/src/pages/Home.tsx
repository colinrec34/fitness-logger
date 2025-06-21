import WeightProgress from "../components/HomeCards/WeightProgress";
import LiftProgress from "../components/HomeCards/LiftProgress";
import HikeProgress from "../components/HomeCards/HikeProgress";
import RunProgress from "../components/HomeCards/RunProgress";
import SurfProgress from "../components/HomeCards/SurfProgress";

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
        </CardGrid>
      </section>
    </div>
  );
}
