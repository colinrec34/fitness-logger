import { useEffect, useState } from "react";
import type { LatLngExpression, LatLngBoundsExpression } from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  Tooltip,
  useMap,
} from "react-leaflet";

const api = import.meta.env.VITE_API_URL || "http://localhost:8000";

type SnorkelLog = {
  id: number;
  date: string;
  location: string;
  duration_minutes: number;
  notes?: string;
  coordinates?: [number, number];
};

type LocationEntry = {
  name: string;
  coordinates: [number, number];
};

type LocationApiResponse = {
  name: string;
  lat: number;
  lon: number;
};

function FitBounds({ points }: { points: LatLngExpression[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) {
      map.fitBounds(points as LatLngBoundsExpression, { padding: [20, 20] });
    }
  }, [points, map]);
  return null;
}

export default function Snorkelling() {
  const [logs, setLogs] = useState<SnorkelLog[]>([]);
  const [locations, setLocations] = useState<LocationEntry[]>([]);
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    location: "",
    duration_minutes: 0,
    notes: "",
  });

  const [newLocation, setNewLocation] = useState("");
  const [newLat, setNewLat] = useState("");
  const [newLon, setNewLon] = useState("");

  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const groupedLogs = locations.map((loc) => {
    const matchingLogs = logs.filter((log) => log.location === loc.name);
    return {
      name: loc.name,
      coordinates: loc.coordinates,
      logs: matchingLogs,
    };
  });

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [logRes, locRes] = await Promise.all([
          fetch(`${api}/logs/snorkeling`),
          fetch(`${api}/snorkelinglocation`),
        ]);

        const [logsData, locationsData] = await Promise.all([
          logRes.json(),
          locRes.json(),
        ]);

        setLogs(Array.isArray(logsData) ? logsData : []);
        const parsedLocations: LocationEntry[] = locationsData.map((l: any) => ({
          name: l.name,
          coordinates: [l.lat, l.lon],
        }));
        setLocations(parsedLocations);

        if (parsedLocations.length > 0) {
          setForm((prev) => ({
            ...prev,
            location: parsedLocations[0].name,
          }));
        }
      } catch (err) {
        console.error("❌ Failed to fetch snorkelling data:", err);
      }
    };

    fetchAll();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`${api}/logs/snorkeling`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const newLog = await res.json();
      setLogs((prev) => [...prev, newLog]);
      setForm({
        date: new Date().toISOString().split("T")[0],
        location: locations[0]?.name || "",
        duration_minutes: 0,
        notes: "",
      });
    }
  };

  const addNewLocation = async () => {
    if (newLocation && newLat && newLon && !locations.some((l) => l.name === newLocation)) {
      const lat = parseFloat(newLat);
      const lon = parseFloat(newLon);
      try {
        const res = await fetch(`${api}/snorkelinglocation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newLocation, lat, lon }),
        });

        if (!res.ok) throw new Error("Failed to add location");

        const newLoc = await res.json();
        const entry = {
          name: newLoc.name,
          coordinates: [newLoc.lat, newLoc.lon] as [number, number],
        };
        setLocations((prev) => [...prev, entry]);
        setForm((prev) => ({
          ...prev,
          location: entry.name,
        }));
        setNewLocation("");
        setNewLat("");
        setNewLon("");
      } catch (err) {
        console.error("❌ Error adding location:", err);
      }
    }
  };

  useEffect(() => {
    const existing = logs.find((log) => log.date === form.date);
    if (existing) {
      setForm({
        date: existing.date,
        location: existing.location,
        duration_minutes: existing.duration_minutes,
        notes: existing.notes || "",
      });
      setEditMode(true);
      setEditingId(existing.id);
    } else {
      setForm((prev) => ({
        ...prev,
        location: locations[0]?.name || "",
        duration_minutes: 0,
        notes: "",
      }));
      setEditMode(false);
      setEditingId(null);
    }
  }, [form.date, logs, locations]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    const res = await fetch(`${api}/logs/snorkeling/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const updated = await res.json();
      setLogs((prev) => prev.map((log) => (log.id === updated.id ? updated : log)));
      setEditMode(false);
      setEditingId(null);
    }
  };

  useEffect(() => {
    const selected = locations.find((l) => l.name === form.location);
    if (selected) {
      setForm((prev) => ({
        ...prev,
        coordinates: selected.coordinates,
      }));
    }
  }, [form.location, locations]);

  const totalSessions = logs.length;
  const totalDuration = logs.reduce((sum, l) => sum + l.duration_minutes, 0);

  return (
    <div className="flex flex-col md:flex-row gap-8 p-6">
      <div className="flex-1 space-y-6">
        <h1 className="text-3xl font-bold">Log a Snorkelling Session</h1>
        <form
          onSubmit={handleSubmit}
          className="space-y-4 bg-slate-800 p-6 rounded-xl shadow-md"
        >
          <div>
            <label className="block mb-1">Date</label>
            <input
              type="date"
              className="w-full p-2 rounded bg-slate-700 text-white"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>

          <div>
            <label className="block mb-1">Location</label>
            <select
              className="w-full p-2 rounded bg-slate-700 text-white"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            >
              {locations.map((loc) => (
                <option key={loc.name} value={loc.name}>
                  {loc.name}
                </option>
              ))}
            </select>
            <div className="mt-2 space-y-2">
              <input
                className="w-full p-2 rounded bg-slate-700 text-white"
                placeholder="Add new location name"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
              />
              <div className="flex gap-2">
                <input
                  className="w-1/2 p-2 rounded bg-slate-700 text-white"
                  placeholder="Lat"
                  value={newLat}
                  onChange={(e) => setNewLat(e.target.value)}
                />
                <input
                  className="w-1/2 p-2 rounded bg-slate-700 text-white"
                  placeholder="Lon"
                  value={newLon}
                  onChange={(e) => setNewLon(e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={addNewLocation}
                className="bg-blue-500 px-3 py-1 rounded text-white w-full"
              >
                Add New Location
              </button>
            </div>
          </div>

          <div>
            <label className="block mb-1">Duration (minutes)</label>
            <input
              type="number"
              className="w-full p-2 rounded bg-slate-700 text-white"
              value={form.duration_minutes}
              onChange={(e) =>
                setForm({
                  ...form,
                  duration_minutes: parseInt(e.target.value || "0"),
                })
              }
            />
          </div>

          <div>
            <label className="block mb-1">Notes</label>
            <textarea
              className="w-full p-2 rounded bg-slate-700 text-white"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          {editMode ? (
            <button
              type="button"
              onClick={handleUpdate}
              className="bg-yellow-500 hover:bg-yellow-600 px-4 py-2 rounded text-white"
            >
              Update Log
            </button>
          ) : (
            <button
              type="submit"
              className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded text-white"
            >
              Submit
            </button>
          )}
        </form>
      </div>

      <div className="md:w-1/2 space-y-6">
        <h1 className="text-3xl font-bold">Snorkelling Stats</h1>
        <div className="bg-slate-800 p-6 rounded-xl shadow-md">
          <ul className="space-y-1">
            <li>Total sessions: {totalSessions}</li>
            <li>Total hours: {(totalDuration / 60).toFixed(1)}</li>
          </ul>
        </div>

        <div className="bg-slate-800 rounded-xl overflow-hidden shadow-md">
          <MapContainer
            style={{ height: "75vh", width: "100%" }}
            center={[34.0, -118.5]}
            zoom={8}
            scrollWheelZoom={true}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
            />
            {groupedLogs.map(({ name, coordinates, logs }) => (
              <Marker key={name} position={coordinates}>
                <Tooltip direction="top">
                  <div className="text-sm">
                    <div className="font-semibold">{name}</div>
                    {logs.map((log) => (
                      <div key={log.id}>{log.date} · {log.duration_minutes} min</div>
                    ))}
                  </div>
                </Tooltip>
              </Marker>
            ))}
            <FitBounds
              points={logs.filter((l) => l.coordinates).map((l) => l.coordinates!)}
            />
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
