import { useEffect, useState} from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Tooltip,
  Marker,
  useMap,
} from "react-leaflet";
import type { LatLngBoundsExpression } from "leaflet";
import polyline from "@mapbox/polyline";
import { format } from "date-fns";

import { supabase } from "../../../api/supabaseClient";

// For running activity
const ACTIVITY_ID = "d3555da1-b932-42e2-9cbb-0908aaf1c73a";

import type { LogRow } from "./types";

function formatDuration(durationSeconds: number): string {
  const totalSeconds = Math.round(durationSeconds);
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

function formatPace(durationSeconds?: number, distance?: number): string {
  if (durationSeconds == null || distance == null || distance === 0)
    return "Pace N/A";
  const totalSecondsPerMile = durationSeconds / distance;
  const minutes = Math.floor(totalSecondsPerMile / 60);
  const seconds = Math.round(totalSecondsPerMile % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")} / mi`;
}

// Helper to auto-fit the map view to the route
function FitBounds({ route }: { route: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (route.length > 1) {
      map.fitBounds(route as LatLngBoundsExpression, { padding: [20, 20] });
    }
  }, [route, map]);
  return null;
}

export default function Running() {
  const [userId, setUserId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(false);

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

  // Fetching logs
  useEffect(() => {
    async function fetchAllLogs() {
      if (!userId) return;
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        console.warn("No session or access token found.");
        return;
      }

      // Strava edge function to update logs
      const syncRes = await fetch(
        "https://rcdkucjsapmykzkiodzu.supabase.co/functions/v1/strava-sync",
        {
          credentials: "include",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!syncRes.ok) {
        console.error("Strava sync failed:", await syncRes.text());
      } else {
        const syncResult = await syncRes.json();
        console.log("Strava sync success:", syncResult);
      }

      const { data, error } = await supabase
        .from("logs")
        .select("*")
        .eq("user_id", userId)
        .eq("activity_id", ACTIVITY_ID)
        .order("datetime", { ascending: true });

      if (error) {
        console.error("Error fetching logs:", error);
        setLogs([]);
      } else if (data) {
        setLogs(data);
      }
      setLoading(false);
    }
    fetchAllLogs();
  }, [userId]);

  // Start coordinates for summary map
  const allStartCoords: [number, number][] = logs
    .map((log) => {
      const encoded = log.data.map?.summary_polyline;
      if (!encoded) return null;

      const coords = polyline.decode(encoded);
      return coords.length > 0 ? coords[0] : null;
    })
    .filter(
      (coord): coord is [number, number] =>
        Array.isArray(coord) && coord.length === 2
    );

  // Data formatting functions
  function metersToMiles(meters: number) {
    return meters / 1609.34;
  }

  // STATISTICS
  const totalRuns = logs.length;
  const totalMiles = metersToMiles(
    logs.reduce((sum, log) => sum + log.data.distance, 0)
  );
  const totalElevation = logs.reduce(
    (sum, log) => sum + log.data.total_elevation_gain,
    0
  );

  const now = new Date();
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(now.getFullYear() - 1);

  const lastYearRuns = logs.filter(
    (log) => new Date(log.datetime) >= oneYearAgo
  );

  const lastYearMiles = metersToMiles(
    lastYearRuns.reduce((sum, log) => sum + log.data.distance, 0)
  );

  const lastYearElevation = lastYearRuns.reduce(
    (sum, log) => sum + log.data.total_elevation_gain,
    0
  );

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Runs</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: Individual Run Cards (Scrollable) */}
        <div className="overflow-y-auto max-h-[calc(100vh-150px)] pr-2 space-y-6 scroll-hide">
          {loading ? (
            <p className="text-gray-400 italic">Loading runs...</p>
          ) : logs.length === 0 ? (
            <p className="text-gray-400 italic">No runs found.</p>
          ) : (
            logs
              .slice() // copy the array
              .sort(
                (a, b) =>
                  new Date(b.datetime).getTime() -
                  new Date(a.datetime).getTime()
              ) // newest first
              .map((log) => (
                <div
                  key={log.id}
                  className="bg-slate-800 rounded-xl p-4 shadow-md flex flex-col"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-xl font-semibold">
                        {log.data.name} —{" "}
                        {format(new Date(log.datetime), "MMMM dd, yyyy")}
                      </h2>
                      <p className="text-sm text-gray-300">
                        {metersToMiles(log.data.distance).toFixed(2)} mi ·{" "}
                        {log.data.total_elevation_gain?.toFixed(0)} ft ·{" "}
                        {formatDuration(log.data.elapsed_time || 0)} ·{" "}
                        {formatPace(
                          log.data.elapsed_time,
                          metersToMiles(log.data.distance)
                        )}
                      </p>
                    </div>
                  </div>

                  {log.data.map.summary_polyline?.length > 1 ? (
                    <div className="w-full aspect-[4/3] relative mt-4 rounded overflow-hidden">
                      <MapContainer
                        center={
                          polyline.decode(log.data.map.summary_polyline)[0]
                        }
                        zoom={15}
                        scrollWheelZoom={false}
                        style={{ height: "100%", width: "100%" }}
                      >
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <Polyline
                          positions={polyline.decode(
                            log.data.map.summary_polyline
                          )}
                          color="#1e293b"
                          weight={8}
                        />
                        <Polyline
                          positions={polyline.decode(
                            log.data.map.summary_polyline
                          )}
                          color="#32CD32"
                          weight={4}
                        >
                          <Tooltip sticky>{log.data.name}</Tooltip>
                        </Polyline>
                        <FitBounds
                          route={polyline.decode(log.data.map.summary_polyline)}
                        />
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
                Total Miles:{" "}
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
                Total Runs: <span className="font-semibold">{totalRuns}</span>
              </p>
              <p>
                Total Miles:{" "}
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
                  {logs.map(
                    (log, i) =>
                      polyline.decode(log.data.map.summary_polyline)[0] && (
                        <Marker
                          key={i}
                          position={
                            polyline.decode(log.data.map.summary_polyline)[0]
                          }
                        >
                          <Tooltip>
                            <div className="text-sm">
                              <p className="font-semibold">{log.data.name}</p>
                              <p>
                                {format(
                                  new Date(log.datetime),
                                  "MMMM dd, yyyy"
                                )}
                              </p>
                              <p>
                                {metersToMiles(log.data.distance)?.toFixed(2)}{" "}
                                mi
                              </p>
                              <p>
                                {log.data.total_elevation_gain?.toFixed(0)} ft
                              </p>
                              <p>
                                {formatDuration(log.data.elapsed_time || 0)}
                              </p>
                              <p>
                                {formatPace(
                                  log.data.elapsed_time,
                                  metersToMiles(log.data.distance)
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
