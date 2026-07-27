import { useEffect, useRef, useState } from "react";
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

const ROUND_DRAFT_KEY = "golf_round_draft_v1";

interface RoundDraft {
  locationId: string;
  holes: number;
  pars: number[];
  holeScores: number[];
  currentHole: number;
  players: number;
  notes: string;
  startedAt: string;
}

function loadRoundDraft(): RoundDraft | null {
  try {
    const raw = localStorage.getItem(ROUND_DRAFT_KEY);
    return raw ? (JSON.parse(raw) as RoundDraft) : null;
  } catch {
    return null;
  }
}
function saveRoundDraft(draft: RoundDraft) {
  localStorage.setItem(ROUND_DRAFT_KEY, JSON.stringify(draft));
}
function clearRoundDraft() {
  localStorage.removeItem(ROUND_DRAFT_KEY);
}

function resizePars(pars: number[], holes: number): number[] {
  const next = pars.slice(0, holes);
  while (next.length < holes) next.push(4);
  return next;
}

function ParsGrid({
  pars,
  onChange,
}: {
  pars: number[];
  onChange: (index: number, value: number) => void;
}) {
  return (
    <div className="grid grid-cols-6 gap-1">
      {pars.map((p, i) => (
        <div key={i} className="flex flex-col items-center">
          <span className="text-[10px] text-gray-400">{i + 1}</span>
          <input
            type="number"
            min={3}
            max={6}
            className="w-full p-1 rounded bg-slate-700 text-white text-center text-sm"
            value={p}
            onChange={(e) => onChange(i, parseInt(e.target.value || "0") || 0)}
          />
        </div>
      ))}
    </div>
  );
}

export default function Golfing() {
  const { user } = useAuth();
  const [mode, setMode] = useState<"log" | "round">("log");
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
  const [newHoles, setNewHoles] = useState(18);
  const [newPars, setNewPars] = useState<number[]>(Array(18).fill(4));

  const [showEditCourse, setShowEditCourse] = useState(false);
  const [editHoles, setEditHoles] = useState(18);
  const [editPars, setEditPars] = useState<number[]>(Array(18).fill(4));

  const [roundActive, setRoundActive] = useState(false);
  const [roundLocationId, setRoundLocationId] = useState("");
  const [roundHoles, setRoundHoles] = useState(0);
  const [roundPars, setRoundPars] = useState<number[]>([]);
  const [holeScores, setHoleScores] = useState<number[]>([]);
  const [currentHole, setCurrentHole] = useState(0);
  const [roundPlayers, setRoundPlayers] = useState(2);
  const [roundNotes, setRoundNotes] = useState("");
  const [roundStartedAt, setRoundStartedAt] = useState<string | null>(null);
  const [pendingDraft, setPendingDraft] = useState<RoundDraft | null>(null);

  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLLIElement | null>>({});

  useEffect(() => {
    if (!highlightedId) return;
    const timer = setTimeout(() => setHighlightedId(null), 2000);
    return () => clearTimeout(timer);
  }, [highlightedId]);

  const scrollToLog = (id: string) => {
    cardRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
    setHighlightedId(id);
  };

  const [form, setForm] = useState({
    location: "",
    holes: 9,
    score: 0,
    players: 2,
    notes: "",
  });

  const selectedLocation = locations.find((l) => l.name === form.location);

  useEffect(() => {
    setPendingDraft(loadRoundDraft());
  }, []);

  useEffect(() => {
    const loc = locations.find((l) => l.name === form.location);
    if (!loc?.data?.holes || form.holes) return;
    setForm((f) => (f.holes ? f : { ...f, holes: loc.data!.holes! }));
    // Only re-run when the course changes, not on every holes edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.location, locations]);

  useEffect(() => {
    if (!roundActive || !roundStartedAt) return;
    saveRoundDraft({
      locationId: roundLocationId,
      holes: roundHoles,
      pars: roundPars,
      holeScores,
      currentHole,
      players: roundPlayers,
      notes: roundNotes,
      startedAt: roundStartedAt,
    });
  }, [
    roundActive,
    roundLocationId,
    roundHoles,
    roundPars,
    holeScores,
    currentHole,
    roundPlayers,
    roundNotes,
    roundStartedAt,
  ]);

  function resumeDraft() {
    if (!pendingDraft) return;
    setRoundLocationId(pendingDraft.locationId);
    setRoundHoles(pendingDraft.holes);
    setRoundPars(pendingDraft.pars);
    setHoleScores(pendingDraft.holeScores);
    setCurrentHole(pendingDraft.currentHole);
    setRoundPlayers(pendingDraft.players);
    setRoundNotes(pendingDraft.notes);
    setRoundStartedAt(pendingDraft.startedAt);
    setRoundActive(true);
    setMode("round");
    setPendingDraft(null);
  }

  function discardDraft() {
    clearRoundDraft();
    setPendingDraft(null);
  }

  function startRound() {
    const loc = selectedLocation;
    const holes = loc?.data?.holes;
    if (!loc || !holes) {
      alert('Pick a course with hole info saved first (use "Edit course info" above).');
      return;
    }
    const pars =
      loc.data?.pars?.length === holes ? loc.data.pars : Array(holes).fill(4);
    setRoundLocationId(loc.id);
    setRoundHoles(holes);
    setRoundPars(pars);
    setHoleScores(pars.slice());
    setCurrentHole(0);
    setRoundPlayers(form.players || 2);
    setRoundNotes("");
    setRoundStartedAt(new Date().toISOString());
    setRoundActive(true);
  }

  function adjustStroke(delta: number) {
    setHoleScores((prev) => {
      const next = [...prev];
      next[currentHole] = Math.max(1, (next[currentHole] ?? 4) + delta);
      return next;
    });
  }

  async function finishRound() {
    if (!user || !roundStartedAt) return;
    const totalScore = holeScores.reduce((a, b) => a + b, 0);
    const payload = {
      user_id: user.id,
      activity_id: ACTIVITY_ID,
      datetime: roundStartedAt,
      location_id: roundLocationId,
      data: {
        holes: roundHoles,
        score: totalScore,
        players: roundPlayers,
        notes: roundNotes,
        holeScores: holeScores.map((strokes, i) => ({
          hole: i + 1,
          par: roundPars[i],
          strokes,
        })),
      },
    };

    try {
      const { error } = await supabase
        .from("logs")
        .upsert(payload, { onConflict: "activity_id,datetime" });
      if (error) throw error;

      clearRoundDraft();
      setRoundActive(false);
      setRoundStartedAt(null);

      const totalPar = roundPars.reduce((a, b) => a + b, 0);
      const diff = totalScore - totalPar;
      alert(`Round saved! Score: ${totalScore} (${diff >= 0 ? "+" : ""}${diff})`);

      const { data: updatedLogs, error: fetchError } = await supabase
        .from("logs")
        .select("*")
        .eq("user_id", user.id)
        .eq("activity_id", ACTIVITY_ID)
        .order("datetime", { ascending: true });
      if (!fetchError && updatedLogs) setLogs(updatedLogs);
      setMode("log");
    } catch (err) {
      console.error("Failed to save round:", err);
      alert(err instanceof Error ? err.message : "Failed to save round.");
    }
  }

  async function refetchLocations() {
    if (!user) return;
    const { data } = await supabase
      .from("locations")
      .select("*")
      .eq("user_id", user.id)
      .eq("activity_id", ACTIVITY_ID);
    if (data) setLocations(data);
  }

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
        data: { holes: newHoles, pars: newPars },
      });

      if (error) throw error;

      setForm((f) => ({ ...f, location: newLocationName, holes: newHoles }));
      setNewLocationName("");
      setNewLat("");
      setNewLon("");
      setNewHoles(18);
      setNewPars(Array(18).fill(4));
      setShowAddLocation(false);
      await refetchLocations();
    } catch (err) {
      console.error("Failed to add location:", err);
      alert(err instanceof Error ? err.message : "Error adding location.");
    }
  }

  function openEditCourse() {
    if (!selectedLocation) return;
    const holes = selectedLocation.data?.holes ?? 18;
    setEditHoles(holes);
    setEditPars(resizePars(selectedLocation.data?.pars ?? [], holes));
    setShowEditCourse(true);
  }

  async function saveCourseInfo() {
    if (!selectedLocation) return;
    try {
      const { error } = await supabase
        .from("locations")
        .update({ data: { holes: editHoles, pars: editPars } })
        .eq("id", selectedLocation.id);
      if (error) throw error;

      setShowEditCourse(false);
      setForm((f) => (f.holes ? f : { ...f, holes: editHoles }));
      await refetchLocations();
    } catch (err) {
      console.error("Failed to save course info:", err);
      alert(err instanceof Error ? err.message : "Error saving course info.");
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

  const draftLocation = pendingDraft
    ? locations.find((l) => l.id === pendingDraft.locationId)
    : null;

  return (
    <div className="flex flex-col md:flex-row gap-8 p-6">
      {/* Left Column */}
      <div className="flex-1 space-y-6">
        <h1 className="text-3xl font-bold">Golf</h1>

        {pendingDraft && (
          <div className="bg-yellow-900/40 border border-yellow-600 rounded-xl p-4 flex items-center justify-between gap-4">
            <div className="text-sm">
              Resume in-progress round{draftLocation ? ` at ${draftLocation.name}` : ""}?
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={resumeDraft}
                className="bg-blue-600 px-3 py-1 rounded text-white text-sm"
              >
                Resume
              </button>
              <button
                type="button"
                onClick={discardDraft}
                className="bg-slate-600 px-3 py-1 rounded text-white text-sm"
              >
                Discard
              </button>
            </div>
          </div>
        )}

        <div className="bg-slate-800 p-6 rounded-xl shadow-md space-y-2">
          <label className="block mb-1">Course</label>
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

          <div className="flex gap-4">
            <button
              type="button"
              className="text-blue-400"
              onClick={() => setShowAddLocation((prev) => !prev)}
            >
              {showAddLocation ? "Cancel" : "+ Add new location"}
            </button>
            {selectedLocation && (
              <button
                type="button"
                className="text-blue-400"
                onClick={() => (showEditCourse ? setShowEditCourse(false) : openEditCourse())}
              >
                {showEditCourse ? "Cancel" : "Edit course info"}
              </button>
            )}
          </div>

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
              <div>
                <label className="block mb-1 text-sm">Holes</label>
                <input
                  type="number"
                  min={1}
                  max={36}
                  className="w-full p-2 rounded bg-slate-700 text-white"
                  value={newHoles}
                  onChange={(e) => {
                    const h = parseInt(e.target.value || "0") || 0;
                    setNewHoles(h);
                    setNewPars((prev) => resizePars(prev, h));
                  }}
                />
              </div>
              <div>
                <label className="block mb-1 text-sm">Par per hole</label>
                <ParsGrid
                  pars={newPars}
                  onChange={(i, v) =>
                    setNewPars((prev) => prev.map((x, idx) => (idx === i ? v : x)))
                  }
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

          {showEditCourse && selectedLocation && (
            <div className="mt-2 space-y-2">
              <div>
                <label className="block mb-1 text-sm">Holes</label>
                <input
                  type="number"
                  min={1}
                  max={36}
                  className="w-full p-2 rounded bg-slate-700 text-white"
                  value={editHoles}
                  onChange={(e) => {
                    const h = parseInt(e.target.value || "0") || 0;
                    setEditHoles(h);
                    setEditPars((prev) => resizePars(prev, h));
                  }}
                />
              </div>
              <div>
                <label className="block mb-1 text-sm">Par per hole</label>
                <ParsGrid
                  pars={editPars}
                  onChange={(i, v) =>
                    setEditPars((prev) => prev.map((x, idx) => (idx === i ? v : x)))
                  }
                />
              </div>
              <button
                type="button"
                onClick={saveCourseInfo}
                className="bg-blue-500 px-3 py-1 rounded text-white w-full"
              >
                Save Course Info
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("log")}
            className={`flex-1 py-2 rounded font-semibold ${
              mode === "log" ? "bg-blue-600 text-white" : "bg-slate-700 text-gray-300"
            }`}
          >
            Log a past round
          </button>
          <button
            type="button"
            onClick={() => setMode("round")}
            className={`flex-1 py-2 rounded font-semibold ${
              mode === "round" ? "bg-blue-600 text-white" : "bg-slate-700 text-gray-300"
            }`}
          >
            Start a round
          </button>
        </div>

        {mode === "log" && (
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
        )}

        {mode === "round" && (
          <div className="bg-slate-800 p-6 rounded-xl shadow-md space-y-4">
            {!roundActive ? (
              <>
                <p className="text-sm text-gray-300">
                  {selectedLocation?.data?.holes
                    ? `Ready to play ${selectedLocation.data.holes} holes at ${selectedLocation.name}.`
                    : 'Pick a course with hole info saved (use "Edit course info" above) to start a round.'}
                </p>
                <button
                  type="button"
                  onClick={startRound}
                  disabled={!selectedLocation?.data?.holes}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded w-full"
                >
                  Start Round
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setCurrentHole((h) => Math.max(0, h - 1))}
                    disabled={currentHole === 0}
                    className="px-3 py-2 rounded bg-slate-700 disabled:opacity-30"
                  >
                    ‹ Prev
                  </button>
                  <div className="text-lg font-semibold text-center">
                    Hole {currentHole + 1} of {roundHoles} · Par {roundPars[currentHole]}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentHole((h) => Math.min(roundHoles - 1, h + 1))
                    }
                    disabled={currentHole === roundHoles - 1}
                    className="px-3 py-2 rounded bg-slate-700 disabled:opacity-30"
                  >
                    Next ›
                  </button>
                </div>

                <div className="flex flex-wrap gap-1 justify-center">
                  {Array.from({ length: roundHoles }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setCurrentHole(i)}
                      className={`w-8 h-8 rounded-full text-sm ${
                        i === currentHole
                          ? "bg-blue-600 text-white"
                          : "bg-slate-700 text-gray-300"
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-center gap-6 py-4">
                  <button
                    type="button"
                    onClick={() => adjustStroke(-1)}
                    className="w-12 h-12 rounded-full bg-slate-700 text-2xl"
                  >
                    −
                  </button>
                  <div className="text-5xl font-bold w-20 text-center">
                    {holeScores[currentHole]}
                  </div>
                  <button
                    type="button"
                    onClick={() => adjustStroke(1)}
                    className="w-12 h-12 rounded-full bg-slate-700 text-2xl"
                  >
                    +
                  </button>
                </div>

                <div className="text-center text-sm text-gray-300">
                  {(() => {
                    const total = holeScores.reduce((a, b) => a + b, 0);
                    const totalPar = roundPars.reduce((a, b) => a + b, 0);
                    const diff = total - totalPar;
                    return `Total: ${total} (${diff >= 0 ? "+" : ""}${diff})`;
                  })()}
                </div>

                <div>
                  <label className="block mb-1 text-sm">Players</label>
                  <input
                    type="number"
                    className="w-full p-2 rounded bg-slate-700 text-white"
                    value={roundPlayers}
                    onChange={(e) =>
                      setRoundPlayers(parseInt(e.target.value || "0") || 0)
                    }
                  />
                </div>
                <div>
                  <label className="block mb-1 text-sm">Notes</label>
                  <textarea
                    className="w-full p-2 rounded bg-slate-700 text-white"
                    rows={2}
                    value={roundNotes}
                    onChange={(e) => setRoundNotes(e.target.value)}
                  />
                </div>

                <button
                  type="button"
                  onClick={finishRound}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded w-full"
                >
                  Finish Round
                </button>
              </>
            )}
          </div>
        )}

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
                  <li
                    key={log.id}
                    ref={(el) => {
                      cardRefs.current[log.id] = el;
                    }}
                    className={`border-b border-slate-600 pb-2 transition-shadow duration-300 ${
                      highlightedId === log.id ? "ring-2 ring-[#32CD32] rounded-lg" : ""
                    }`}
                  >
                    <div className="font-semibold text-white">
                      {format(new Date(log.datetime), "MMMM d, yyyy")}:{" "}
                      {locations.find((l) => l.id === log.location_id)?.name ||
                        "Unknown location"}
                    </div>
                    <div className="text-sm text-gray-300">
                      {log.data.holes} holes ·{" "}
                      {log.data.score?.toLocaleString()} strokes ·{" "}
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

            const parRounds = filtered.filter(
              (l) =>
                Array.isArray(l.data?.holeScores) &&
                l.data.holeScores.length > 0 &&
                l.data.holeScores.every((h) => h.par != null),
            );
            const avgVsPar = parRounds.length
              ? parRounds.reduce(
                  (sum, l) =>
                    sum +
                    l.data.holeScores!.reduce(
                      (s, h) => s + (h.strokes - (h.par ?? h.strokes)),
                      0,
                    ),
                  0,
                ) / parRounds.length
              : null;

            const stats = [
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

            if (avgVsPar !== null) {
              stats.push({
                label: "Avg Score vs Par",
                value: `${avgVsPar >= 0 ? "+" : ""}${avgVsPar.toFixed(1)}`,
              });
            }

            return stats;
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
              <Marker
                key={name}
                position={coordinates}
                eventHandlers={{
                  click: () => scrollToLog(logs[logs.length - 1].id),
                }}
              >
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
