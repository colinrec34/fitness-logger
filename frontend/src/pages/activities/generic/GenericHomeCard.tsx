import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import { format, formatDistanceToNow } from "date-fns";
import Card from "../../../components/Card"

import { supabase } from "../../../api/supabaseClient";
// Put the activity ID from the activites table here
const ACTIVITY_ID = "";

import type { LocationRow, LogRow } from "./types";

function FitToMarker({ coordinates }: { coordinates: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(coordinates, 12, { animate: true });
  }, [coordinates, map]);
  return null;
}

export default function GenericingHomeCard() {
  const [userId, setUserId] = useState<string | null>(null);
  const [latest, setLatest] = useState<LogRow>();
  const [latestLocation, setLatestLocation] = useState<LocationRow>();

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

  useEffect(() => {
    if (!userId) return;

    const fetchLatestLog = async () => {
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

      if (log.location_id) {
        const { data: location, error: locationError } = await supabase
          .from("locations")
          .select("*")
          .eq("id", log.location_id)
          .single();

        if (locationError) {
          console.error("Error fetching location:", locationError);
        } else {
          setLatestLocation(location);
        }
      }
    };

    fetchLatestLog();
  }, [userId]);

  const formattedDatetime = latest?.datetime
    ? format(new Date(latest.datetime), "MMMM d, yyyy")
    : "";
  const relativeDate = latest?.datetime
    ? formatDistanceToNow(new Date(latest.datetime), { addSuffix: true })
    : "";

  return (
    <Card
      title={`🤿 ${latestLocation?.name ?? "Last Genericing Session"}`}
      subtitle={
        <span className="text-gray-400">
          {formattedDatetime} · {relativeDate}
        </span>
      }
      footer={
        latest?.data.notes && (
          <p className="pt-2 text-gray-400 italic">“{latest.data.notes}”</p>
        )
      }
    >
      {latest && latestLocation?.lat != null && latestLocation?.lon != null ? (
        <>
          <div className="h-[300px] rounded-lg overflow-hidden mb-4">
            <MapContainer
              center={
                [latestLocation?.lat, latestLocation?.lon] as LatLngExpression
              }
              zoom={11}
              className="h-full w-full"
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Marker
                position={
                  [latestLocation?.lat, latestLocation?.lon] as LatLngExpression
                }
              >
                <Popup>{latestLocation?.name}</Popup>
              </Marker>
              <FitToMarker
                coordinates={[latestLocation?.lat, latestLocation?.lon]}
              />
            </MapContainer>
          </div>

          <ul className="text-gray-300 text-sm space-y-1">
            <li>
              <strong>Duration:</strong> {latest.data.duration} min
            </li>
          </ul>
        </>
      ) : (
        <p className="text-gray-400 italic">No data available.</p>
      )}
    </Card>
  );
}
