import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import { formatDistanceToNowStrict } from "date-fns";
import Card from "../Card"; // make sure this path is correct

type SurfLog = {
  id: number;
  date: string;
  location: string;
  board: string;
  duration_minutes: number;
  waves_caught: number;
  wave_height?: string;
  notes?: string;
  coordinates?: [number, number];
};

function FitToMarker({ coordinates }: { coordinates: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(coordinates, 12, { animate: true });
  }, [coordinates, map]);
  return null;
}

export default function SurfProgress() {
  const [latest, setLatest] = useState<SurfLog | null>(null);

  useEffect(() => {
    fetch("http://localhost:8000/logs/surf")
      .then((res) => res.json())
      .then((data: SurfLog[]) => {
        const sorted = [...data]
          .filter((log) => log.coordinates)
          .sort((a, b) => b.date.localeCompare(a.date));
        setLatest(sorted[0] ?? null);
      })
      .catch((err) => console.error("Failed to fetch surf logs:", err));
  }, []);

  const subtitle =
    latest?.date &&
    `${latest.date} · ${formatDistanceToNowStrict(new Date(latest.date))} ago`;

  return (
    <Card
      title={`🏄 ${latest?.location ?? "Last Surf Session"}`}
      subtitle={subtitle && <span className="text-gray-400 text-sm">{subtitle}</span>}
      footer={
        latest?.notes && (
          <p className="pt-2 text-gray-400 italic">“{latest.notes}”</p>
        )
      }
    >
      {latest && latest.coordinates ? (
        <>
          <div className="h-[300px] rounded-lg overflow-hidden mb-4">
            <MapContainer
              center={latest.coordinates as LatLngExpression}
              zoom={11}
              className="h-full w-full"
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Marker position={latest.coordinates as LatLngExpression}>
                <Popup>{latest.location}</Popup>
              </Marker>
              <FitToMarker coordinates={latest.coordinates} />
            </MapContainer>
          </div>

          <ul className="text-gray-300 text-sm space-y-1">
            <li><strong>Board:</strong> {latest.board}</li>
            <li><strong>Duration:</strong> {latest.duration_minutes} min</li>
            <li><strong>Waves Caught:</strong> {latest.waves_caught}</li>
            {latest.wave_height && (
              <li><strong>Wave Height:</strong> {latest.wave_height}</li>
            )}
          </ul>
        </>
      ) : (
        <p className="text-gray-400 italic">No surf data available.</p>
      )}
    </Card>
  );
}
