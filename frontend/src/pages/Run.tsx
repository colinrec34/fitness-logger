import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Tooltip,
  Marker,
  useMap,
} from "react-leaflet";
import type { LatLngExpression, LatLngBoundsExpression } from "leaflet";

type RunApiResponse = {
  id: number;
  date: string;
  name: string;
  distance_miles: number;
  elevation_gain_ft: number;
  duration_minutes?: number;
  route_json: string;
  notes?: string;
  weather?: string;
};

function formatDuration(durationMinutes?: number): string {
  if (durationMinutes == null) return "Time N/A";
  const totalSeconds = Math.round(durationMinutes * 60);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, "0")}m ${seconds
      .toString()
      .padStart(2, "0")}s`;
  } else {
    return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
  }
}

function formatPace(durationMinutes?: number, miles?: number): string {
  if (durationMinutes == null || miles == null || miles === 0)
    return "Pace N/A";
  const totalSecondsPerMile = (durationMinutes / miles) * 60;
  const minutes = Math.floor(totalSecondsPerMile / 60);
  const seconds = Math.round(totalSecondsPerMile % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")} /mi`;
}

// Helper to auto-fit the map view to the route
function FitBounds({ route }: { route: LatLngExpression[] }) {
  const map = useMap();
  useEffect(() => {
    if (route.length > 1) {
      map.fitBounds(route as LatLngBoundsExpression, { padding: [20, 20] });
    }
  }, [route, map]);
  return null;
}

type RunLog = {
  id: number;
  date: string;
  name: string;
  distance_miles: number;
  elevation_gain_ft: number;
  duration_minutes?: number;
  route: [number, number][]; // [lat, lon]
  notes?: string;
  weather?: string;
};

export default function Run() {
  const [runs, setRuns] = useState<RunLog[]>([]);
  const [loading, setLoading] = useState(false);
  

  useEffect(() => {
    const importAndFetch = async () => {
      setLoading(true);
      try {
        // First import from Strava
        await fetch("http://localhost:8000/import/runs", { method: "POST" });

        // Then fetch updated logs
        const res = await fetch("http://localhost:8000/logs/runs");
        const data = await res.json();
        const formatted = data.map(
          (run: RunApiResponse): RunLog => ({
            ...run,
            route: run.route_json ? JSON.parse(run.route_json) : [],
          })
        );

        setRuns(formatted);
      } catch (err) {
        console.error("Failed to import or fetch runs:", err);
      } finally {
        setLoading(false);
      }
    };

    importAndFetch();
  }, []);

  const totalRuns = runs.length;
  const totalDistance = runs.reduce((sum, r) => sum + r.distance_miles, 0);
  const totalElevation = runs.reduce((sum, r) => sum + r.elevation_gain_ft, 0);

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const lastYearRuns = runs.filter((r) => new Date(r.date) > oneYearAgo);
  const lastYearDistance = lastYearRuns.reduce(
    (sum, r) => sum + r.distance_miles,
    0
  );
  const lastYearElevation = lastYearRuns.reduce(
    (sum, r) => sum + r.elevation_gain_ft,
    0
  );

  const allStartCoords = runs
    .map((r) => r.route?.[0])
    .filter((pt): pt is [number, number] => Array.isArray(pt));

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Runs</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: Individual Run Cards (Scrollable) */}
        <div className="overflow-y-auto max-h-[calc(100vh-150px)] pr-2 space-y-6 scroll-hide">
          {loading ? (
            <p className="text-gray-400 italic">Loading runs...</p>
          ) : runs.length === 0 ? (
            <p className="text-gray-400 italic">No runs found.</p>
          ) : (
            runs.map((run) => (
              <div
                key={run.id}
                className="bg-slate-800 rounded-xl p-4 shadow-md flex flex-col"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">
                      {run.name} — {run.date}
                    </h2>
                    <p className="text-sm text-gray-300">
                      {run.distance_miles.toFixed(2)} mi ·{" "}
                      {run.elevation_gain_ft.toFixed(0)} ft ·{" "}
                      {formatDuration(run.duration_minutes)} ·{" "}
                      {formatPace(run.duration_minutes, run.distance_miles)}
                    </p>
                    {run.notes && (
                      <p className="mt-2 italic text-gray-400">{run.notes}</p>
                    )}
                  </div>
                  {run.weather && (
                    <div className="ml-4 text-sm text-gray-300 text-right whitespace-nowrap">
                      <p className="font-semibold">Weather</p>
                      <p>{run.weather}</p>
                    </div>
                  )}
                </div>

                {run.route?.length > 1 ? (
                  <div className="w-full aspect-[4/3] relative mt-4 rounded overflow-hidden">
                    <MapContainer
                      key={run.id}
                      center={run.route[0] as LatLngExpression}
                      zoom={15}
                      scrollWheelZoom={false}
                      style={{ height: "100%", width: "100%" }}
                    >
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      <Polyline
                        positions={run.route}
                        color="#1e293b"
                        weight={8}
                      />
                      <Polyline
                        positions={run.route}
                        color="#32CD32"
                        weight={4}
                      >
                        <Tooltip sticky>Route for {run.name}</Tooltip>
                      </Polyline>
                      <FitBounds route={run.route} />
                    </MapContainer>
                  </div>
                ) : (
                  <div className="w-full aspect-[4/3] mt-4 flex items-center justify-center rounded bg-slate-700 text-gray-400 italic">
                    Route data not available
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* RIGHT: Summary Stats + Start Map */}
        <div className="flex flex-col space-y-6 text-gray-200 h-[calc(100vh-150px)]">
          {totalRuns > 0 && (
            <div className="bg-slate-800 rounded-xl p-4 shadow-md">
              <h2 className="text-xl font-semibold mb-2">Last 12 Months</h2>
              <p>
                Total Runs:{" "}
                <span className="font-semibold">{lastYearRuns.length}</span>
              </p>
              <p>
                Total Distance:{" "}
                <span className="font-semibold">
                  {lastYearDistance.toFixed(2)} mi
                </span>
              </p>
              <p>
                Total Elevation Gain:{" "}
                <span className="font-semibold">
                  {lastYearElevation.toFixed(0)} ft
                </span>
              </p>

              <h2 className="text-xl font-semibold mt-4 mb-2">All Time</h2>
              <p>
                Total Runs: <span className="font-semibold">{totalRuns}</span>
              </p>
              <p>
                Total Distance:{" "}
                <span className="font-semibold">
                  {totalDistance.toFixed(2)} mi
                </span>
              </p>
              <p>
                Total Elevation Gain:{" "}
                <span className="font-semibold">
                  {totalElevation.toFixed(0)} ft
                </span>
              </p>
            </div>
          )}

          {allStartCoords.length > 0 && (
            <div className="flex-1 bg-slate-800 rounded-xl p-4 shadow-md flex flex-col">
              <h2 className="text-lg font-semibold text-white mb-2">
                Run Start Locations
              </h2>
              <div className="flex-1 rounded overflow-hidden">
                <MapContainer
                  bounds={allStartCoords as LatLngBoundsExpression}
                  scrollWheelZoom={false}
                  style={{ height: "100%", width: "100%" }}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  {runs.map((run, i) =>
                    run.route?.[0] ? (
                      <Marker key={i} position={run.route[0]}>
                        <Tooltip>
                          <div className="text-sm">
                            <p className="font-semibold">{run.name}</p>
                            <p>{run.date}</p>
                            <p>{run.distance_miles.toFixed(2)} mi</p>
                            <p>{run.elevation_gain_ft.toFixed(0)} ft</p>
                            <p>{formatDuration(run.duration_minutes)}</p>
                            <p>
                              {formatPace(
                                run.duration_minutes,
                                run.distance_miles
                              )}
                            </p>
                          </div>
                        </Tooltip>
                      </Marker>
                    ) : null
                  )}
                </MapContainer>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
