import { useEffect, useState } from "react";
import type { LatLngExpression, LatLngBoundsExpression } from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  Tooltip,
  useMap,
} from "react-leaflet";
import { supabase } from "../../../api/supabaseClient";
const SURFING_ACTIVITY_ID = "0ddcfe52-2da0-47b6-a44a-e282f54ac21d";

import type { SurfLogData, LocationRow, LogRow } from "./types";

export default function Surf() {
  const [date, setDate] = useState(() => {
    const now = new Date();
    now.setSeconds(0, 0); // Remove seconds and ms

    const pad = (n: number) => n.toString().padStart(2, "0");

    const year = now.getFullYear();
    const month = pad(now.getMonth() + 1); // Months are 0-indexed
    const day = pad(now.getDate());
    const hours = pad(now.getHours());
    const minutes = pad(now.getMinutes());

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  });

  const [logs, setLogs] = useState<LogRow[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);

  const [form, setForm] = useState({
    location: "",
    board: "",
    wave_height: "",
    duration_minutes: 0,
    waves_caught: 0,
    notes: "",
  });

  const [boards, setBoards] = useState<string[]>([]);
  const [newBoard, setNewBoard] = useState("");

  function addNewBoard() {
    if (newBoard && !boards.includes(newBoard)) {
      setBoards([...boards, newBoard]);
      setNewBoard("");
    }
  }

  // Fetches locations
  useEffect(() => {
    async function fetchAllLocations() {
      const { data, error } = await supabase
        .from("locations")
        .select("*")
        .eq("activity_id", SURFING_ACTIVITY_ID);
      if (error) {
        console.error("Error fetching locations:", error);
        setLocations([]);
      } else if (data) {
        setLocations(data);
      }
    }
    fetchAllLocations();
  }, []);

  // Fetches logs
  useEffect(() => {
    async function fetchAllLogs() {
      const { data, error } = await supabase
        .from("logs")
        .select("*")
        .eq("activity_id", SURFING_ACTIVITY_ID)
        .order("datetime", { ascending: true });

      if (error) {
        console.error("Error fetching logs:", error);
        setLogs([]);
      } else if (data) {
        setLogs(data);
      }
    }
    fetchAllLogs();
  }, []);

  // Fetch single log for selected date and populate form
    useEffect(() => {
      async function fetchLogForDate() {
        const selectedDate = new Date(date);
  
        const start = new Date(selectedDate);
        start.setHours(0, 0, 0, 0);
        const startISO = start.toISOString(); // e.g. "2025-07-18T07:00:00.000Z"
  
        const end = new Date(selectedDate);
        end.setHours(23, 59, 59, 999);
        const endISO = end.toISOString();
  
        const { data, error } = await supabase
          .from("logs")
          .select("*")
          .eq("activity_id", SURFING_ACTIVITY_ID)
          .gte("datetime", startISO)
          .lte("datetime", endISO)
          .limit(1)
          .single();
  
        if (error) throw error;
      }
  
      fetchLogForDate();
    }, [date]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) throw authError;
    if (!user) throw new Error("User not authenticated");

    try {
      const payload = {
        user_id: user.id,
        activity_id: SURFING_ACTIVITY_ID,
        datetime: new Date(date).toISOString(),
        location_id: form.location,
        data: {
          board: form.board,
          wave_height: form.wave_height,
          duration_minutes: form.duration_minutes,
          waves_caught: form.waves_caught,
          notes: form.notes,
        },
      };

      // Upsert on conflict (activity_id, datetime)
      const { error } = await supabase
        .from("logs")
        .upsert(payload, { onConflict: "activity_id,datetime" });

      if (error) throw error;

      alert("Lifting session logged!");

      // Refresh logs for charts
      const { data: updatedLogs, error: fetchError } = await supabase
        .from("logs")
        .select("*")
        .eq("activity_id", SURFING_ACTIVITY_ID)
        .order("datetime", { ascending: true });

      if (fetchError) {
        console.error("Error refreshing logs:", fetchError);
      } else if (updatedLogs) {
        setLogs(updatedLogs);
      }
    } catch (error) {
      console.error("❌ Submission error:", error);
      alert("Failed to save log. Please check your inputs.");
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-8 p-6">
      {/* Left Column */}
      <div className="flex-1 space-y-6">
        <h1 className="text-3xl font-bold">Log a Surf Session</h1>
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
            <label className="block mb-1">Board</label>
            <select
              className="w-full p-2 rounded bg-slate-700 text-white"
              value={form.board}
              onChange={(e) => setForm({ ...form, board: e.target.value })}
            >
              {boards.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <div className="mt-2 flex gap-2">
              <input
                className="flex-1 p-2 rounded bg-slate-700 text-white"
                placeholder="Add new board"
                value={newBoard}
                onChange={(e) => setNewBoard(e.target.value)}
              />
              <button
                type="button"
                onClick={addNewBoard}
                className="bg-blue-500 px-3 py-1 rounded text-white"
              >
                Add
              </button>
            </div>
          </div>

          <div>
            <label className="block mb-1">Wave Height (e.g. 3–4 ft)</label>
            <input
              className="w-full p-2 rounded bg-slate-700 text-white"
              value={form.wave_height}
              onChange={(e) =>
                setForm({ ...form, wave_height: e.target.value })
              }
            />
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
            <label className="block mb-1">Waves Caught</label>
            <input
              type="number"
              className="w-full p-2 rounded bg-slate-700 text-white"
              value={form.waves_caught}
              onChange={(e) =>
                setForm({
                  ...form,
                  waves_caught: parseInt(e.target.value || "0"),
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

        <div className="bg-slate-800 rounded-xl p-4 max-h-[400px] overflow-y-auto shadow-md">
          <h2 className="text-xl font-semibold mb-2">Surf Session History</h2>
          {logs.length === 0 ? (
            <p className="italic text-gray-400">No sessions logged yet.</p>
          ) : (
            <ul className="space-y-4">
              {logs
                .slice()
                .sort((a, b) => b.date.localeCompare(a.date)) // Reverse chronological
                .map((log) => (
                  <li key={log.id} className="border-b border-slate-600 pb-2">
                    <div className="font-semibold text-white">
                      {log.date}: {log.location}
                    </div>
                    <div className="text-sm text-gray-300">
                      {log.duration_minutes} minutes · {log.waves_caught} waves
                      caught
                      {log.wave_height && ` · ${log.wave_height}`} · {log.board}
                    </div>
                    {log.notes && (
                      <div className="text-sm text-gray-400 mt-1 italic">
                        {log.notes}
                      </div>
                    )}
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>

      {/* Right Column */}
      <div className="md:w-1/2 space-y-6">
        <h1 className="text-3xl font-bold">Surf Statistics</h1>
        <div className="bg-slate-800 p-6 rounded-xl shadow-md">
          <ul className="space-y-1">
            <li>Total sessions: {totalSessions}</li>
            <li>Total waves caught: {totalWaves}</li>
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
                      <div key={log.id}>
                        {log.date} · {log.waves_caught} waves
                      </div>
                    ))}
                  </div>
                </Tooltip>
              </Marker>
            ))}

            <FitBounds
              points={logs
                .filter((l) => l.coordinates)
                .map((l) => l.coordinates!)}
            />
          </MapContainer>
        </div>
      </div>
    </div>
  );
}

function FitBounds({ points }: { points: LatLngExpression[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) {
      map.fitBounds(points as LatLngBoundsExpression, { padding: [20, 20] });
    }
  }, [points, map]);
  return null;
}
