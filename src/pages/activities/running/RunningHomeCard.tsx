import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Tooltip,
  useMap,
} from "react-leaflet";
import polyline from "@mapbox/polyline";
import type { LatLngBoundsExpression } from "leaflet";
import { format, formatDistanceToNow } from "date-fns";
import Card from "../../../components/Card";

import { supabase } from "../../../api/supabaseClient";
const ACTIVITY_ID = "d3555da1-b932-42e2-9cbb-0908aaf1c73a";
import type { LogRow } from "./types";

function metersToMiles(meters: number) {
  return meters / 1609.34;
}

function formatDuration(durationSeconds: number): string {
  const totalSeconds = Math.round(durationSeconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes.toString().padStart(2, "0")}m ${seconds
    .toString()
    .padStart(2, "0")}s`;
}

function formatPace(durationSeconds?: number, distance?: number): string {
  if (durationSeconds == null || distance == null || distance === 0)
    return "Pace N/A";
  const totalSecondsPerMile = durationSeconds / distance;
  const minutes = Math.floor(totalSecondsPerMile / 60);
  const seconds = Math.round(totalSecondsPerMile % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")} / mi`;
}

function FitBounds({ route }: { route: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (route.length > 1) {
      map.fitBounds(route as LatLngBoundsExpression, { padding: [20, 20] });
    }
  }, [route, map]);
  return null;
}

export default function RunningHomeCard() {
  const [userId, setUserId] = useState<string | null>(null);
  const [latest, setLatest] = useState<LogRow>();
  const [loading, setLoading] = useState(true);

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

  // Getting the latest log
  useEffect(() => {
    if (!userId) return;

    const fetchLatestLog = async () => {
      setLoading(true);
      const { data: log, error: logError } = await supabase
        .from("logs")
        .select("*")
        .eq("user_id", userId)
        .eq("activity_id", ACTIVITY_ID)
        .order("datetime", { ascending: false })
        .limit(1)
        .single();

      if (logError) {
        console.error("Error fetching latest log:", logError);
        return;
      }

      setLatest(log);
      setLoading(false);
    };
    fetchLatestLog();
  }, [userId]);

  if (loading) {
    return (
      <Card title="🏃‍♂️ Latest Run">
        <p className="text-gray-400 italic">Loading...</p>
      </Card>
    );
  }

  if (!latest) {
    return (
      <Card title="🏃‍♂️ Latest Run">
        <p className="text-gray-400 italic">No runs recorded yet.</p>
      </Card>
    );
  }

  const formattedDatetime = latest?.datetime
    ? format(new Date(latest.datetime), "MMMM d, yyyy")
    : "";
  console.log(latest.datetime)
  const relativeDate = latest?.datetime
    ? formatDistanceToNow(new Date(latest.datetime), { addSuffix: true })
    : "";

  const startCoords = polyline.decode(latest.data.map.summary_polyline)[0];

  return (
    <Card
      title={`🏃‍♂️ ${latest.data.name}`}
      subtitle={
        <span className="text-gray-400">
          {formattedDatetime} · {relativeDate}
        </span>
      }
    >
      <div className="h-[300px] rounded-lg overflow-hidden mb-4">
        {latest.data.map.summary_polyline ? (
          <MapContainer
            center={startCoords}
            zoom={14}
            scrollWheelZoom={true}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Polyline
              positions={polyline.decode(latest.data.map.summary_polyline)}
              color="#1e293b"
              weight={8}
            />
            <Polyline
              positions={polyline.decode(latest.data.map.summary_polyline)}
              color="#32CD32"
              weight={4}
            >
              <Tooltip sticky>{latest.data.name}</Tooltip>
            </Polyline>
            <FitBounds
              route={polyline.decode(latest.data.map.summary_polyline)}
            />
          </MapContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 italic bg-slate-700">
            Route data not available
          </div>
        )}
      </div>

      <div className="text-sm text-gray-200 space-y-1">
        <p>
          <strong>Distance:</strong>{" "}
          {metersToMiles(latest.data.distance).toFixed(2)} mi
        </p>
        <p>
          <strong>Elevation Gain:</strong>{" "}
          {latest.data.total_elevation_gain.toFixed(0)} ft
        </p>
        <p>
          <strong>Duration:</strong>{" "}
          {latest.data.elapsed_time != null
            ? formatDuration(latest.data.elapsed_time)
            : "Time N/A"}
        </p>
        <p>
          <strong>Pace:</strong>{" "}
          {formatPace(latest.data.elapsed_time, metersToMiles(latest.data.distance))}
        </p>
        {/* {latest.notes && (
          <p className="mt-2 italic text-gray-400 whitespace-pre-line">
            "{latest.notes}"
          </p>
        )} */}
      </div>
    </Card>
  );
}
