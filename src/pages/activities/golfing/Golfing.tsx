import { useEffect, useState } from "react";
import type { LatLngExpression } from "leaflet";
import { format } from "date-fns";
import { MapContainer, TileLayer, Marker, Tooltip } from "react-leaflet";
import { supabase } from "../../../api/supabaseClient";
import { useAuth } from "../../../context/AuthContext";
import { currentDatetimeLocal } from "../../../lib/datetimeLocal";
import {
  groupLogsByLocation,
  FitBoundsPoints,
} from "../../../lib/locationUtils";
import StatisticsSection from "../../../components/StatisticsSection";
import {
  filterLogsByRange,
  type TimeRange,
} from "../../../components/TimeRangeFilter";

const ACTIVITY_ID = "8b6b6cf4-9cec-43db-926a-cce49dab38ff";

import type { LocationRow, LogRow } from "./types";

export default function Golfing() {
  const { user } = useAuth();
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [range, setRange] = useState<TimeRange>("Max");
  const [datetime, setDatetime] = useState(currentDatetimeLocal);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newLocationName, setNewLocationName] = useState("");
  const [newLat, setNewLat] = useState("");
  const [newLon, setNewLon] = useState("");

  const [form, setForm] = useState({
    location: "",
    holes: 9,
    score: 0,
    players: 2,
    notes: "",
  });

  async function addNewLocation() {
    if (!user || !newLocationName || !newLat || !newLon) {
      alert("Please provide name, lat, and lon.");
      return;
    }

    try {
      const { error } = await supabase.from("locations").insert({
        user_id: user.id,
        activity_id: ACTIVITY_ID,
        name: newLocationName,
        lat: parseFloat(newLat),
        lon: parseFloat(newLon),
      });

      if (error) throw error;

      setNewLocationName("");
      setNewLat("");
      setNewLon("");
      const { data } = await supabase
        .from("locations")
        .select("*")
        .eq("user_id", user.id)
        .eq("activity_id", ACTIVITY_ID);
      if (data) setLocations(data);
    } catch (err) {
      console.error("Failed to add location:", err);
      alert("Error adding location.");
    }
  }

  useEffect(() => {
    async function fetchAllLocations() {
      if (!user) return;
      const { data, error } = await supabase
        .from("locations")
        .select("*")
        .eq("user_id", user.id)
        .eq("activity_id", ACTIVITY_ID);
      if (error) {
        console.error("Error fetching locations:", error);
        setLocations([]);
      } else if (data) {
        setLocations(data);
      }
    }
    fetchAllLocations();
  }, [user]);

  useEffect(() => {
    async function fetchAllLogs() {
      if (!user) return;
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from("logs")
        .select("*")
        .eq("user_id", user.id)
        .eq("activity_id", ACTIVITY_ID)
        .order("datetime", { ascending: true });

      if (error) {
        console.error("Error fetching logs:", error);
        setError("Failed to load Golf sessions. Please refresh.");
        setLogs([]);
      } else if (data) {
        setLogs(data);
      }
      setLoading(false);
    }
    fetchAllLogs();
  }, [user]);

  useEffect(() => {
    async function fetchLogForDate() {
      const selectedDate = new Date(datetime);
      if (isNaN(selectedDate.getTime())) return;

      const start = new Date(selectedDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(selectedDate);
      end.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from("logs")
        .select("*")
        .eq("user_id", user?.id)
        .eq("activity_id", ACTIVITY_ID)
        .gte("datetime", start.toISOString())
        .lte("datetime", end.toISOString())
        .limit(1)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching log:", error);
        return;
      }

      if (data) {
        setForm({
          location: data.location || "",
          holes: data.data?.holes || 0,
          score: data.data?.score || 0,
          players: data.data?.players || 0,
          notes: data.data?.notes || "",
        });
      } else {
        setForm({ location: "", holes: 0, score: 0, players: 0, notes: "" });
      }
    }
    fetchLogForDate();
  }, [datetime, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const { data: locMatch, error: locError } = await supabase
        .from("locations")
        .select("id")
        .eq("user_id", user.id)
        .eq("activity_id", ACTIVITY_ID)
        .eq("name", form.location)
        .single();

      if (locError) throw locError;

      const payload = {
        user_id: user.id,
        activity_id: ACTIVITY_ID,
        datetime: new Date(datetime).toISOString(),
        location_id: locMatch.id,
        data: {
          holes: form.holes,
          score: form.score,
          players: form.players,
          notes: form.notes,
        },
      };

      const { error } = await supabase
        .from("logs")
        .upsert(payload, { onConflict: "activity_id,datetime" });

      if (error) throw error;

      alert("Golf session logged!");

      const { data: updatedLogs, error: fetchError } = await supabase
        .from("logs")
        .select("*")
        .eq("user_id", user.id)
        .eq("activity_id", ACTIVITY_ID)
        .order("datetime", { ascending: true });

      if (!fetchError && updatedLogs) setLogs(updatedLogs);
    } catch (err) {
      console.error("Submission error:", err);
      alert("Failed to save log. Please check your inputs.");
    }
  };

  const filteredLogs = filterLogsByRange(logs, range, (log) => log.datetime);
  const groupedLogsByLocation = groupLogsByLocation(
    filteredLogs,
    locations,
    (log) => (log.data.holes as number) ?? 0,
  );

  return (
    <div className="flex flex-col md:flex-row gap-8 p-6">
      {/* Left Column */}
      <div className="flex-1 space-y-6">
        <h1 className="text-3xl font-bold">Log a Golf Session</h1>
        <form
          onSubmit={handleSubmit}
          className="space-y-4 bg-slate-800 p-6 rounded-xl shadow-md"
        >
          <div>
            <label className="block mb-1">Date</label>
            <input
              type="datetime-local"
              className="w-full p-2 rounded bg-slate-700 text-white"
              value={datetime}
              onChange={(e) => setDatetime(e.target.value)}
            />
          </div>

          <div>
            <label className="block mb-1">Location</label>
            <select
              className="w-full p-2 rounded bg-slate-700 text-white"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            >
              <option value="">Select location...</option>
              {locations.map((loc) => (
                <option key={loc.name} value={loc.name}>
                  {loc.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="mt-2 text-blue-400"
              onClick={() => setShowAddLocation((prev) => !prev)}
            >
              {showAddLocation ? "Cancel" : "+ Add new location"}
            </button>

            {showAddLocation && (
              <div className="mt-2 space-y-2">
                <input
                  className="w-full p-2 rounded bg-slate-700 text-white"
                  placeholder="Add new location name"
                  value={newLocationName}
                  onChange={(e) => setNewLocationName(e.target.value)}
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
            )}
          </div>

          <div>
            <label className="block mb-1">Holes</label>
            <input
              type="number"
              className="w-full p-2 rounded bg-slate-700 text-white"
              value={form.holes}
              onChange={(e) =>
                setForm({ ...form, holes: parseInt(e.target.value || "0") })
              }
            />
          </div>

          <div>
            <label className="block mb-1">Score</label>
            <input
              type="number"
              className="w-full p-2 rounded bg-slate-700 text-white"
              value={form.score}
              onChange={(e) =>
                setForm({ ...form, score: parseInt(e.target.value || "0") })
              }
            />
          </div>

          <div>
            <label className="block mb-1">Players</label>
            <input
              type="number"
              className="w-full p-2 rounded bg-slate-700 text-white"
              value={form.players}
              onChange={(e) =>
                setForm({ ...form, players: parseInt(e.target.value || "0") })
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
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded w-full"
          >
            Save Session
          </button>
        </form>

        {/* SESSION HISTORY */}
        <div className="bg-slate-800 rounded-xl p-4 max-h-[400px] overflow-y-auto shadow-md">
          <h2 className="text-xl font-semibold mb-2">Golf Session History</h2>
          {loading ? (
            <p className="italic text-gray-400">Loading sessions...</p>
          ) : error ? (
            <p className="italic text-red-400">{error}</p>
          ) : logs.length === 0 ? (
            <p className="italic text-gray-400">No sessions logged yet.</p>
          ) : (
            <ul className="space-y-4">
              {logs
                .slice()
                .sort((a, b) => b.datetime.localeCompare(a.datetime))
                .map((log) => (
                  <li key={log.id} className="border-b border-slate-600 pb-2">
                    <div className="font-semibold text-white">
                      {format(new Date(log.datetime), "MMMM d, yyyy")}:{" "}
                      {locations.find((l) => l.id === log.location_id)?.name ||
                        "Unknown location"}
                    </div>
                    <div className="text-sm text-gray-300">
                      {log.data.holes} holes ·{" "}
                      {log.data.score?.toLocaleString()} holes ·{" "}
                      {log.data.players} players
                    </div>
                    {log.data.notes && (
                      <div className="text-sm text-gray-400 mt-1 italic">
                        {log.data.notes}
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
        <h1 className="text-3xl font-bold">Golf Statistics</h1>
        <StatisticsSection
          logs={logs}
          getDate={(log) => log.datetime}
          range={range}
          onRangeChange={setRange}
          computeStats={(filtered) => {
            const count = filtered.length || 1;

            const {
              totalHoles,
              totalScore,
              totalPlayers,
              nineHoleCount,
              eighteenHoleCount,
            } = filtered.reduce(
              (acc, l) => {
                const holes = l.data?.holes ?? 0;
                const score = l.data?.score ?? 0;
                const players = l.data?.players ?? 0;

                acc.totalHoles += holes;
                acc.totalScore += score;
                acc.totalPlayers += players;

                if (holes === 9) acc.nineHoleCount += 1;
                if (holes === 18) acc.eighteenHoleCount += 1;

                return acc;
              },
              {
                totalHoles: 0,
                totalScore: 0,
                totalPlayers: 0,
                nineHoleCount: 0,
                eighteenHoleCount: 0,
              },
            );

            return [
              { label: "Total rounds", value: filtered.length },
              { label: "9-hole sessions", value: nineHoleCount },
              { label: "18-hole sessions", value: eighteenHoleCount },
              {
                label: "Total holes",
                value: (totalHoles),
              },
              {
                label: "Average Score",
                value: (totalScore / count).toFixed(1),
              },
              {
                label: "Average Players",
                value: (totalPlayers / count).toFixed(1),
              },
            ];
          }}
        />

        <div className="bg-slate-800 rounded-xl overflow-hidden shadow-md">
          <MapContainer
            style={{ height: "75vh", width: "100%" }}
            center={[39.5, -106.0]}
            zoom={7}
            scrollWheelZoom={true}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
            />
            {groupedLogsByLocation.map(({ name, coordinates, logs }) => (
              <Marker key={name} position={coordinates}>
                <Tooltip direction="top">
                  <div className="text-sm">
                    <div className="font-semibold">{name}</div>
                    {logs.map((log) => (
                      <div key={log.id}>
                        {log.date} · {log.metric} holes
                      </div>
                    ))}
                  </div>
                </Tooltip>
              </Marker>
            ))}

            <FitBoundsPoints
              points={locations.map((l) => [l.lat, l.lon] as LatLngExpression)}
            />
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
