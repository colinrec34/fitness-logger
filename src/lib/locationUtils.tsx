import { useEffect } from "react";
import type { LatLngExpression, LatLngBoundsExpression } from "leaflet";
import { useMap } from "react-leaflet";

interface MinimalLocation {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

interface MinimalLog {
  id: string;
  datetime: string;
  location_id?: string;
}

export function groupLogsByLocation<T extends MinimalLog>(
  logs: T[],
  locations: MinimalLocation[],
  getMetric: (log: T) => number
): Array<{
  name: string;
  coordinates: [number, number];
  logs: { id: string; date: string; metric: number }[];
}> {
  const locationMap = new Map(locations.map((loc) => [loc.id, loc]));
  const grouped = new Map<
    string,
    {
      name: string;
      coordinates: [number, number];
      logs: { id: string; date: string; metric: number }[];
    }
  >();

  for (const log of logs) {
    if (!log.location_id) continue;
    const location = locationMap.get(log.location_id);
    if (!location) continue;

    if (!grouped.has(location.id)) {
      grouped.set(location.id, {
        name: location.name,
        coordinates: [location.lat, location.lon],
        logs: [],
      });
    }

    grouped.get(location.id)!.logs.push({
      id: log.id,
      date: new Date(log.datetime).toLocaleDateString(),
      metric: getMetric(log),
    });
  }

  return Array.from(grouped.values());
}

export function FitBoundsPoints({ points }: { points: LatLngExpression[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) {
      map.fitBounds(points as LatLngBoundsExpression, { padding: [20, 20] });
    }
  }, [points, map]);
  return null;
}
