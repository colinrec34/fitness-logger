import { useEffect, useState, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Tooltip,
  Marker,
  useMap,
} from "react-leaflet";
import type { LatLngExpression, LatLngBoundsExpression } from "leaflet";
import type { Map as LeafletMap } from "leaflet";

const api = import.meta.env.VITE_API_URL || "http://localhost:8000";

type HikeApiResponse = {
  id: number;
  date: string;
  name: string;
  distance_miles: number;
  elevation_gain_ft: number;
  duration_minutes?: number;
  route_json: string;
  notes?: string;
};

function formatDuration(durationMinutes: number): string {
  const totalSeconds = Math.round(durationMinutes * 60);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes.toString().padStart(2, "0")}m ${seconds
    .toString()
    .padStart(2, "0")}s`;
}

function formatPace(durationMinutes?: number, mileage?: number): string {
  if (durationMinutes == null || mileage == null || mileage === 0)
    return "Pace N/A";
  const totalSecondsPerMile = (durationMinutes / mileage) * 60;
  const minutes = Math.floor(totalSecondsPerMile / 60);
  const seconds = Math.round(totalSecondsPerMile % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")} / mi`;
}

function FitBounds({ route }: { route: LatLngExpression[] }) {
  const map = useMap();
  useEffect(() => {
    if (route.length > 1) {
      map.fitBounds(route as LatLngBoundsExpression, { padding: [20, 20] });
    }
  }, [route, map]);
  return null;
}

function SetBigMapRef({ setRef }: { setRef: (map: LeafletMap) => void }) {
    const map = useMap();
    useEffect(() => {
      setRef(map);
    }, [map, setRef]);
    return null;
  }

type HikeLog = {
  id: number;
  date: string;
  name: string;
  mileage: number;
  elevation_gain_ft: number;
  duration_minutes?: number;
  route: [number, number][];
  notes?: string;
};

export default function Hike() {
  const [hikes, setHikes] = useState<HikeLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"logs" | "stats">("logs");

  const bigMapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    const fetchAndImport = async () => {
      setLoading(true);
      try {
        await fetch(`${api}/import/hikes`, { method: "POST" });
        const res = await fetch(`${api}/logs/hikes`);
        const data = await res.json();

        setHikes(
          data.map((hike: HikeApiResponse) => ({
            ...hike,
            mileage: hike.distance_miles,
            route: hike.route_json ? JSON.parse(hike.route_json) : [],
          }))
        );
      } catch (err) {
        console.error("Failed to import or fetch hikes:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAndImport();
  }, []);

  useEffect(() => {
    if (activeTab === "stats" && bigMapRef.current) {
      setTimeout(() => {
        bigMapRef.current?.invalidateSize();
      }, 100); // slight delay ensures DOM is ready
    }
  }, [activeTab]);

  const totalHikes = hikes.length;
  const totalMiles = hikes.reduce((sum, h) => sum + h.mileage, 0);
  const totalElevation = hikes.reduce((sum, h) => sum + h.elevation_gain_ft, 0);

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const lastYearHikes = hikes.filter((h) => new Date(h.date) > oneYearAgo);
  const lastYearMiles = lastYearHikes.reduce((sum, h) => sum + h.mileage, 0);
  const lastYearElevation = lastYearHikes.reduce(
    (sum, h) => sum + h.elevation_gain_ft,
    0
  );

  const allStartCoords = hikes
    .map((h) => h.route?.[0])
    .filter((pt): pt is [number, number] => Array.isArray(pt));

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Hikes</h1>

      {/* Toggle buttons (mobile only) */}
      <div className="lg:hidden flex justify-center gap-4 mb-4">
        <button
          className={`px-4 py-2 rounded ${
            activeTab === "logs"
              ? "bg-slate-700 text-white"
              : "bg-slate-600 text-gray-300"
          }`}
          onClick={() => setActiveTab("logs")}
        >
          Logs
        </button>
        <button
          className={`px-4 py-2 rounded ${
            activeTab === "stats"
              ? "bg-slate-700 text-white"
              : "bg-slate-600 text-gray-300"
          }`}
          onClick={() => setActiveTab("stats")}
        >
          Stats & Map
        </button>
      </div>

      {/* Two-column layout (stacked on mobile) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Logs column */}
        <div
          className={`${
            activeTab !== "logs" ? "hidden" : ""
          } lg:block overflow-y-auto max-h-[calc(100vh-150px)] pr-2 space-y-6 scroll-hide`}
        >
          {loading ? (
            <p className="text-gray-400 italic">Loading hikes...</p>
          ) : hikes.length === 0 ? (
            <p className="text-gray-400 italic">No hikes found.</p>
          ) : (
            hikes.map((hike) => (
              <div
                key={hike.id}
                className="bg-slate-800 rounded-xl p-4 shadow-md flex flex-col"
              >
                <h2 className="text-xl font-semibold">
                  {hike.name} — {hike.date}
                </h2>
                <p className="text-sm text-gray-300">
                  {hike.mileage.toFixed(2)} mi ·{" "}
                  {hike.elevation_gain_ft.toFixed(0)} ft ·{" "}
                  {formatDuration(hike.duration_minutes || 0)} ·{" "}
                  {formatPace(hike.duration_minutes, hike.mileage)}
                </p>
                {hike.notes && (
                  <p className="mt-2 italic text-gray-400">{hike.notes}</p>
                )}
                {hike.route?.length > 1 ? (
                  <div className="w-full aspect-[4/3] relative mt-4 rounded overflow-hidden">
                    <MapContainer
                      center={hike.route[0] as LatLngExpression}
                      zoom={15}
                      scrollWheelZoom={false}
                      style={{ height: "100%", width: "100%" }}
                    >
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      <Polyline
                        positions={hike.route}
                        color="#1e293b"
                        weight={8}
                      />
                      <Polyline
                        positions={hike.route}
                        color="#32CD32"
                        weight={4}
                      >
                        <Tooltip sticky>{hike.name}</Tooltip>
                      </Polyline>
                      <FitBounds route={hike.route} />
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

        {/* Stats + map column */}
        <div
          className={`${
            activeTab !== "stats" ? "hidden" : ""
          } lg:block space-y-6 text-gray-200`}
        >
          {totalHikes > 0 && (
            <div className="bg-slate-800 rounded-xl p-4 shadow-md">
              <h2 className="text-xl font-semibold mb-2">Last 12 Months</h2>
              <p>
                Total Hikes:{" "}
                <span className="font-semibold">{lastYearHikes.length}</span>
              </p>
              <p>
                Total Distance:{" "}
                <span className="font-semibold">
                  {lastYearMiles.toFixed(2)} mi
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
                Total Hikes: <span className="font-semibold">{totalHikes}</span>
              </p>
              <p>
                Total Distance:{" "}
                <span className="font-semibold">
                  {totalMiles.toFixed(2)} mi
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
            <div className="bg-slate-800 p-4 rounded-xl shadow-md">
              <h2 className="text-lg font-semibold text-white mb-2">
                Trail Locations
              </h2>
              <div className="h-[40vh] sm:h-[50vh] lg:h-[60vh] w-full rounded overflow-hidden">
                <MapContainer
                  bounds={allStartCoords as LatLngBoundsExpression}
                  scrollWheelZoom={true}
                  style={{ height: "100%", width: "100%" }}
                >
                  <SetBigMapRef setRef={(map) => (bigMapRef.current = map)} />
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  {hikes.map(
                    (hike, i) =>
                      hike.route?.[0] && (
                        <Marker key={i} position={hike.route[0]}>
                          <Tooltip>
                            <div className="text-sm">
                              <p className="font-semibold">{hike.name}</p>
                              <p>{hike.date}</p>
                              <p>{hike.mileage.toFixed(2)} mi</p>
                              <p>{hike.elevation_gain_ft.toFixed(0)} ft</p>
                              <p>
                                {formatDuration(hike.duration_minutes || 0)}
                              </p>
                              <p>
                                {formatPace(
                                  hike.duration_minutes,
                                  hike.mileage
                                )}
                              </p>
                            </div>
                          </Tooltip>
                        </Marker>
                      )
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
