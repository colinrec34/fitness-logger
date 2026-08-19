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
import LocationSearchInput from "../../../components/LocationSearchInput";
import {
  filterLogsByRange,
  type TimeRange,
} from "../../../components/TimeRangeFilter";
import { haversineMeters, metersToYards } from "../../../lib/geo";

const ACTIVITY_ID = "8b6b6cf4-9cec-43db-926a-cce49dab38ff";

import type { ActivityRow, LocationRow, LogRow, ShotPoint } from "./types";

const DEFAULT_CLUBS = [
  "Driver",
  "3-Wood",
  "5-Wood",
  "Hybrid",
  "3-Iron",
  "4-Iron",
  "5-Iron",
  "6-Iron",
  "7-Iron",
  "8-Iron",
  "9-Iron",
  "PW",
  "SW",
  "Putter",
];

const ROUND_DRAFT_KEY = "golf_round_draft_v1";

interface RoundDraft {
  locationId: string;
  holes: number;
  pars: number[];
  holeScores: number[];
  shots: ShotPoint[][];
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

// Rough guess at the next club based on shot count so far and the hole's
// par: tee club, then (for par 4+) one mid-range approach, then wedge(s)
// closing in on the green, then putter for the last stroke. Always
// overridable in the dropdown before "Mark Shot" is pressed.
function suggestClub(par: number, shotsTakenOnHole: number, clubs: string[]): string {
  const pick = (candidates: string[]) =>
    candidates.find((c) => clubs.includes(c)) ?? clubs[0] ?? "";

  const lastIdx = Math.max(par - 1, 0);
  const idx = shotsTakenOnHole;

  if (idx >= lastIdx) return pick(["Putter"]);
  if (idx === lastIdx - 1) return pick(["SW", "PW", "Wedge"]);
  if (idx === 0) return par <= 3 ? pick(["6-Iron", "5-Iron", "7-Iron"]) : pick(["Driver"]);
  if (idx === 1 && par >= 4) return pick(["Hybrid", "3-Wood", "5-Wood"]);
  return pick(["SW", "PW", "Wedge"]);
}

function ParsGrid({
  pars,
  onChange,
  min = 3,
  max = 6,
}: {
  pars: number[];
  onChange: (index: number, value: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="grid grid-cols-6 gap-1">
      {pars.map((p, i) => (
        <div key={i} className="flex flex-col items-center">
          <span className="text-[10px] text-gray-400">{i + 1}</span>
          <input
            type="number"
            min={min}
            max={max}
            className="w-full p-1 rounded bg-slate-700 text-white text-center text-sm"
            value={p}
            onChange={(e) => onChange(i, parseInt(e.target.value || "0") || 0)}
          />
        </div>
      ))}
    </div>
  );
}

// Pads/truncates a per-hole score list to match the pars list, defaulting
// any newly-added hole's score to that hole's par (a reasonable starting
// guess to edit from, rather than always 0).
function resizeScores(scores: number[], pars: number[]): number[] {
  const next = scores.slice(0, pars.length);
  while (next.length < pars.length) next.push(pars[next.length] ?? 4);
  return next;
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

  const [showScorecard, setShowScorecard] = useState(false);
  const [logPars, setLogPars] = useState<number[]>(Array(18).fill(4));
  const [logHoleScores, setLogHoleScores] = useState<number[]>(Array(18).fill(4));

  const [clubs, setClubs] = useState<string[]>(DEFAULT_CLUBS);
  const [showClubs, setShowClubs] = useState(false);
  const [editClubs, setEditClubs] = useState<string[]>(DEFAULT_CLUBS);
  const [newClubName, setNewClubName] = useState("");

  const [showEditCourse, setShowEditCourse] = useState(false);
  const [editHoles, setEditHoles] = useState(18);
  const [editPars, setEditPars] = useState<number[]>(Array(18).fill(4));

  const [roundActive, setRoundActive] = useState(false);
  const [roundLocationId, setRoundLocationId] = useState("");
  const [roundHoles, setRoundHoles] = useState(0);
  const [roundPars, setRoundPars] = useState<number[]>([]);
  const [holeScores, setHoleScores] = useState<number[]>([]);
  const [roundShots, setRoundShots] = useState<ShotPoint[][]>([]);
  const [selectedClub, setSelectedClub] = useState("");
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

  function openScorecard() {
    const holes = form.holes || selectedLocation?.data?.holes || 18;
    const pars =
      selectedLocation?.data?.pars?.length === holes
        ? selectedLocation.data.pars
        : resizePars(logPars, holes);
    setLogPars(pars);
    setLogHoleScores((prev) => resizeScores(prev, pars));
    setShowScorecard(true);
  }

  // Keep the scorecard grid's length in sync if "Holes" changes while it's open.
  useEffect(() => {
    if (!showScorecard) return;
    setLogPars((prev) => resizePars(prev, form.holes || 0));
  }, [form.holes, showScorecard]);

  useEffect(() => {
    if (!showScorecard) return;
    setLogHoleScores((prev) => resizeScores(prev, logPars));
  }, [logPars, showScorecard]);

  // The total score field mirrors the scorecard's sum while it's open, so
  // they can never disagree.
  useEffect(() => {
    if (!showScorecard) return;
    const total = logHoleScores.reduce((a, b) => a + b, 0);
    setForm((f) => (f.score === total ? f : { ...f, score: total }));
  }, [logHoleScores, showScorecard]);

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
      shots: roundShots,
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
    roundShots,
    currentHole,
    roundPlayers,
    roundNotes,
    roundStartedAt,
  ]);

  useEffect(() => {
    if (!roundActive) return;
    const par = roundPars[currentHole];
    if (!par) return;
    const shotsSoFar = roundShots[currentHole]?.length ?? 0;
    setSelectedClub(suggestClub(par, shotsSoFar, clubs));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundActive, currentHole, roundShots[currentHole]?.length, roundPars[currentHole], clubs]);

  function resumeDraft() {
    if (!pendingDraft) return;
    setRoundLocationId(pendingDraft.locationId);
    setRoundHoles(pendingDraft.holes);
    setRoundPars(pendingDraft.pars);
    setHoleScores(pendingDraft.holeScores);
    setRoundShots(
      pendingDraft.shots ?? Array.from({ length: pendingDraft.holes }, () => [])
    );
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
    setRoundShots(Array.from({ length: holes }, () => []));
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

  function markShot() {
    if (!navigator.geolocation) {
      alert("Location isn't available on this device/browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const shot: ShotPoint = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          club: selectedClub || undefined,
          takenAt: new Date().toISOString(),
        };
        setRoundShots((prev) => {
          const next = prev.map((h) => [...h]);
          next[currentHole] = [...(next[currentHole] ?? []), shot];
          return next;
        });
      },
      (err) => alert(`Couldn't get location: ${err.message}`),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  function markPenaltyDrop() {
    adjustStroke(1);
    if (!navigator.geolocation) {
      alert("Penalty stroke added. Location isn't available on this device/browser, so the drop spot wasn't recorded.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const shot: ShotPoint = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          penalty: true,
          takenAt: new Date().toISOString(),
        };
        setRoundShots((prev) => {
          const next = prev.map((h) => [...h]);
          next[currentHole] = [...(next[currentHole] ?? []), shot];
          return next;
        });
      },
      (err) => alert(`Penalty stroke added, but couldn't get the drop location: ${err.message}`),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  function deleteShot(index: number) {
    const removed = roundShots[currentHole]?.[index];
    setRoundShots((prev) => {
      const next = prev.map((h) => [...h]);
      next[currentHole] = next[currentHole].filter((_, i) => i !== index);
      return next;
    });
    if (removed?.penalty) adjustStroke(-1);
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
          shots: roundShots[i]?.length ? roundShots[i] : undefined,
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
      setRoundShots([]);

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
    async function fetchClubs() {
      if (!user) return;
      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .eq("id", ACTIVITY_ID)
        .single();
      if (!error && data) {
        const activity = data as ActivityRow;
        if (activity.settings?.clubs?.length) setClubs(activity.settings.clubs);
      }
    }
    fetchClubs();
  }, [user]);

  function openClubsPanel() {
    setEditClubs(clubs.slice());
    setNewClubName("");
    setShowClubs(true);
  }

  function addClubToEdit() {
    const name = newClubName.trim();
    if (!name || editClubs.includes(name)) return;
    setEditClubs((prev) => [...prev, name]);
    setNewClubName("");
  }

  function removeClubFromEdit(index: number) {
    setEditClubs((prev) => prev.filter((_, i) => i !== index));
  }

  async function saveClubs() {
    try {
      const { error } = await supabase
        .from("activities")
        .update({ settings: { clubs: editClubs } })
        .eq("id", ACTIVITY_ID);
      if (error) throw error;

      setClubs(editClubs);
      setShowClubs(false);
    } catch (err) {
      console.error("Failed to save clubs:", err);
      alert(err instanceof Error ? err.message : "Error saving clubs.");
    }
  }

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
        const hs = data.data?.holeScores;
        if (hs?.length) {
          setLogPars(hs.map((h: { par?: number }) => h.par ?? 4));
          setLogHoleScores(hs.map((h: { strokes: number }) => h.strokes));
          setShowScorecard(true);
        } else {
          setShowScorecard(false);
        }
      } else {
        setForm({ location: "", holes: 0, score: 0, players: 0, notes: "" });
        setShowScorecard(false);
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
          ...(showScorecard && logHoleScores.length === form.holes
            ? {
                holeScores: logHoleScores.map((strokes, i) => ({
                  hole: i + 1,
                  par: logPars[i],
                  strokes,
                })),
              }
            : {}),
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
            onChange={(e) => {
              setForm({ ...form, location: e.target.value });
              setShowEditCourse(false);
            }}
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
            <button
              type="button"
              className="text-blue-400"
              onClick={() => (showClubs ? setShowClubs(false) : openClubsPanel())}
            >
              {showClubs ? "Cancel" : "Clubs"}
            </button>
          </div>

          {showClubs && (
            <div className="mt-2 space-y-2">
              <ul className="space-y-1">
                {editClubs.map((c, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between bg-slate-700 px-3 py-1 rounded"
                  >
                    <span>{c}</span>
                    <button
                      type="button"
                      onClick={() => removeClubFromEdit(i)}
                      className="text-red-400 px-2"
                      aria-label={`Remove ${c}`}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <input
                  className="flex-1 p-2 rounded bg-slate-700 text-white"
                  placeholder="Add a club (e.g. 4-Hybrid)"
                  value={newClubName}
                  onChange={(e) => setNewClubName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addClubToEdit();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={addClubToEdit}
                  className="bg-slate-600 px-3 py-1 rounded text-white"
                >
                  Add
                </button>
              </div>
              <button
                type="button"
                onClick={saveClubs}
                className="bg-blue-500 px-3 py-1 rounded text-white w-full"
              >
                Save Clubs
              </button>
            </div>
          )}

          {showAddLocation && (
            <div className="mt-2 space-y-2">
              <LocationSearchInput
                onSelect={(r) => {
                  setNewLocationName(r.shortName);
                  setNewLat(String(r.lat));
                  setNewLon(String(r.lon));
                }}
              />
              <input
                className="w-full p-2 rounded bg-slate-700 text-white"
                placeholder="Location name"
                value={newLocationName}
                onChange={(e) => setNewLocationName(e.target.value)}
              />
              {newLat && newLon && (
                <p className="text-xs text-gray-400">📍 {newLat}, {newLon}</p>
              )}
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
              <div className="flex items-center justify-between mb-1">
                <label className="block">Score</label>
                <button
                  type="button"
                  className="text-blue-400 text-sm"
                  onClick={() => (showScorecard ? setShowScorecard(false) : openScorecard())}
                >
                  {showScorecard ? "Hide scorecard" : "Enter scorecard by hole"}
                </button>
              </div>
              <input
                type="number"
                className="w-full p-2 rounded bg-slate-700 text-white disabled:opacity-60"
                value={form.score}
                disabled={showScorecard}
                onChange={(e) =>
                  setForm({ ...form, score: parseInt(e.target.value || "0") })
                }
              />
              {showScorecard && (
                <div className="mt-2 space-y-2">
                  <div>
                    <label className="block mb-1 text-xs text-gray-400">Par per hole</label>
                    <ParsGrid
                      pars={logPars}
                      onChange={(i, v) =>
                        setLogPars((prev) => prev.map((x, idx) => (idx === i ? v : x)))
                      }
                    />
                  </div>
                  <div>
                    <label className="block mb-1 text-xs text-gray-400">Your score per hole</label>
                    <ParsGrid
                      pars={logHoleScores}
                      min={1}
                      max={15}
                      onChange={(i, v) =>
                        setLogHoleScores((prev) => prev.map((x, idx) => (idx === i ? v : x)))
                      }
                    />
                  </div>
                  <p className="text-xs text-gray-400">
                    {(() => {
                      const total = logHoleScores.reduce((a, b) => a + b, 0);
                      const totalPar = logPars.reduce((a, b) => a + b, 0);
                      const diff = total - totalPar;
                      return `Total: ${total} (${diff >= 0 ? "+" : ""}${diff} vs par)`;
                    })()}
                  </p>
                </div>
              )}
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

                <div className="space-y-2">
                  <div className="flex gap-2">
                    <select
                      className="flex-1 p-2 rounded bg-slate-700 text-white text-sm"
                      value={selectedClub}
                      onChange={(e) => setSelectedClub(e.target.value)}
                    >
                      <option value="">Club (optional)</option>
                      {clubs.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={markShot}
                      className="px-4 py-2 rounded bg-slate-700 text-white text-sm font-semibold whitespace-nowrap"
                    >
                      📍 Mark Shot
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={markPenaltyDrop}
                    className="w-full px-4 py-2 rounded bg-red-900/40 border border-red-700 text-red-300 text-sm font-semibold"
                  >
                    🚫 Out of Bounds — Drop (+1 stroke)
                  </button>
                  {(roundShots[currentHole] ?? []).length > 0 && (
                    <ul className="text-sm text-gray-300 space-y-1">
                      {(roundShots[currentHole] ?? []).map((shot, i, arr) => {
                        const prev = arr[i - 1];
                        const yards = prev
                          ? Math.round(metersToYards(haversineMeters(prev, shot)))
                          : null;
                        return (
                          <li key={i} className="flex items-center justify-between">
                            <span>
                              {shot.penalty
                                ? "Out of bounds — drop (+1 penalty)"
                                : `${shot.club || "Shot"} ${i + 1}`}
                              {yards != null ? ` · ${yards} yd from previous` : !shot.penalty ? " · tee shot" : ""}
                            </span>
                            <button
                              type="button"
                              onClick={() => deleteShot(i)}
                              className="text-red-400 px-2"
                              aria-label="Delete shot"
                            >
                              ✕
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
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

            const yardsByClub = new Map<string, number[]>();
            for (const l of filtered) {
              for (const hole of l.data?.holeScores ?? []) {
                const shots = hole.shots;
                if (!shots || shots.length < 2) continue;
                for (let i = 0; i < shots.length - 1; i++) {
                  const club = shots[i].club;
                  if (!club) continue;
                  const yards = metersToYards(haversineMeters(shots[i], shots[i + 1]));
                  if (!yardsByClub.has(club)) yardsByClub.set(club, []);
                  yardsByClub.get(club)!.push(yards);
                }
              }
            }
            const clubAverages = [...yardsByClub.entries()]
              .map(([club, yards]) => ({
                club,
                avg: yards.reduce((a, b) => a + b, 0) / yards.length,
              }))
              .sort((a, b) => b.avg - a.avg);
            for (const { club, avg } of clubAverages) {
              stats.push({ label: `Avg yardage — ${club}`, value: `${Math.round(avg)} yd` });
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
