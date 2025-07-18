import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { TooltipProps } from "recharts";

import { supabase } from "../../../api/supabaseClient";

const LIFTING_ACTIVITY_ID = "e07d19fd-c9a0-42f0-a110-01d532a5b66d";

interface SetEntry {
  reps: number;
  weight?: number; // optional for bodyweight exercises
  sets?: number; // optional, default 1 if missing
}

interface LiftSection {
  warmup: SetEntry[];
  work: SetEntry[];
}

interface LiftingLogData {
  squat?: LiftSection;
  bench?: LiftSection;
  overhead?: LiftSection;
  deadlift?: LiftSection;
  clean?: LiftSection;
  pullups?: { reps: number; sets?: number }[];
  notes?: string;
}

interface LogRow {
  id: number;
  user_id: string;
  activity_id: string;
  datetime: string;
  location_id?: number;
  data: LiftingLogData;
  created_at?: string;
  updated_at?: string;
}

export default function Lifts() {
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

  // Default empty lift section
  const emptyLiftSection = (): LiftSection => ({
    warmup: [
      { reps: 5, weight: 45, sets: 2 },
      { reps: 5, weight: 0, sets: 1 },
      { reps: 3, weight: 0, sets: 1 },
      { reps: 2, weight: 0, sets: 1 },
    ],
    work: [{ reps: 5, weight: 0, sets: 3 }],
  });

  const [squat, setSquat] = useState<LiftSection>(emptyLiftSection());
  const [bench, setBench] = useState<LiftSection>(emptyLiftSection());
  const [deadlift, setDeadlift] = useState<LiftSection>({
    warmup: [
      { reps: 5, weight: 0, sets: 1 },
      { reps: 3, weight: 0, sets: 1 },
    ],
    work: [{ reps: 5, weight: 0, sets: 1 }],
  });

  const [pullups, setPullups] = useState<{ reps: number; sets?: number }[]>([
    { reps: 0, sets: 1 },
  ]);

  const [overhead, setOverhead] = useState<LiftSection>(emptyLiftSection());
  const [clean, setClean] = useState<LiftSection>(emptyLiftSection());
  const [notes, setNotes] = useState("");

  // Fetch all logs for this user/activity (for charts, history)
  useEffect(() => {
    async function fetchAllLogs() {
      const { data, error } = await supabase
        .from("logs")
        .select("*")
        .eq("activity_id", LIFTING_ACTIVITY_ID)
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

      const end = new Date(selectedDate);
      end.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from("logs")
        .select("*")
        .eq("activity_id", LIFTING_ACTIVITY_ID)
        .gte("datetime", start)
        .lte("datetime", end)
        .limit(1)
        .single();

      if (error) {
        // If no row found, reset form
        if (error.code !== "PGRST116") {
          console.error("Error fetching log for date:", error);
        }
        resetForm();
        return;
      }

      if (data) {
        const d = data.data;
        setSquat(normalizeSets(d.squat ?? emptyLiftSection()));
        setBench(normalizeSets(d.bench ?? emptyLiftSection()));
        setDeadlift(normalizeSets(d.deadlift ?? { warmup: [], work: [] }));
        setPullups(
          (d.pullups as SetEntry[])?.map((p) => ({
            reps: p.reps,
            sets: p.sets ?? 1,
          })) || [{ reps: 0, sets: 1 }]
        );
        setOverhead(normalizeSets(d.overhead ?? emptyLiftSection()));
        setClean(normalizeSets(d.power ?? emptyLiftSection()));
        setNotes(d.notes ?? "");
      }
    }

    function resetForm() {
      setSquat(emptyLiftSection());
      setBench(emptyLiftSection());
      setDeadlift({
        warmup: [
          { reps: 5, weight: 0, sets: 1 },
          { reps: 3, weight: 0, sets: 1 },
        ],
        work: [{ reps: 5, weight: 0, sets: 1 }],
      });
      setPullups([{ reps: 0, sets: 1 }]);
      setOverhead(emptyLiftSection());
      setClean(emptyLiftSection());
      setNotes("");
    }

    fetchLogForDate();
  }, [date]);

  // Normalize sets: ensure sets is at least 1 everywhere
  function normalizeSets(lift: LiftSection): LiftSection {
    return {
      warmup: lift.warmup.map((s) => ({ ...s, sets: s.sets ?? 1 })),
      work: lift.work.map((s) => ({ ...s, sets: s.sets ?? 1 })),
    };
  }

  // On submit, validate and save log entry with upsert
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) throw authError;
    if (!user) throw new Error("User not authenticated");

    try {
      const validateWeights = (lift: LiftSection) => {
        for (const set of [...lift.warmup, ...lift.work]) {
          if (
            set.weight === null ||
            set.weight === undefined ||
            isNaN(Number(set.weight))
          ) {
            throw new Error("Empty or invalid weight input detected");
          }
          if (set.reps === undefined || set.reps === null || isNaN(set.reps)) {
            throw new Error("Empty or invalid reps input detected");
          }
          if (set.sets !== undefined && (set.sets < 1 || isNaN(set.sets))) {
            throw new Error("Sets must be at least 1");
          }
        }
      };

      validateWeights(squat);
      validateWeights(bench);
      validateWeights(deadlift);
      validateWeights(overhead);
      validateWeights(clean);

      const payload = {
        user_id: user.id,
        activity_id: LIFTING_ACTIVITY_ID,
        datetime: new Date(date).toISOString(),
        data: {
          squat: normalizeSets(squat),
          bench: normalizeSets(bench),
          deadlift: normalizeSets(deadlift),
          pullups: pullups.map((p) => ({
            reps: p.reps,
            sets: p.sets ?? 1,
          })),
          overhead: normalizeSets(overhead),
          clean: normalizeSets(clean),
          notes,
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
        .eq("activity_id", LIFTING_ACTIVITY_ID)
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

  // Prepare data for charts: max weight in working sets per date
  const formatTypedData = (
    lift: "squat" | "bench" | "overhead" | "deadlift" | "clean"
  ) => {
    return logs
      .filter((log) => log.data[lift])
      .map((log) => {
        const sets = log.data[lift]?.work || [];
        const maxWeight = Math.max(
          ...sets.map((s) => (typeof s.weight === "number" ? s.weight : 0))
        );

        return {
          date: log.datetime,
          weight: maxWeight,
        };
      })
      .filter((entry) => entry.weight > 0) // filter zero weight entries
      .sort((a, b) => a.date.localeCompare(b.date));
  };

  // Helper function to render a LiftSection input form with sets
  function renderLiftSection(
    section: LiftSection,
    setSection: React.Dispatch<React.SetStateAction<LiftSection>>,
    allowEmptyWeights = false
  ) {
    function updateSet(
      type: "warmup" | "work",
      index: number,
      field: "reps" | "weight" | "sets",
      value: number | ""
    ) {
      const updated = { ...section };
      updated[type][index] = {
        ...updated[type][index],
        [field]: value,
      };
      setSection(updated);
    }

    return (
      <div>
        <h3 className="font-semibold mb-1">Warm-up Sets</h3>
        <div className="flex gap-2 mb-1 font-semibold text-sm">
          <div className="w-full">Reps</div>
          <div className="w-full">Weight</div>
          <div className="w-full">Sets</div>
        </div>
        {section.warmup.map((set, i) => (
          <div key={"warmup" + i} className="flex gap-2 mb-2 items-center">
            <input
              type="number"
              min={0}
              value={set.reps}
              onChange={(e) =>
                updateSet("warmup", i, "reps", Number(e.target.value))
              }
              className="w-full p-1 border rounded"
            />
            <input
              type="number"
              min={0}
              value={set.weight}
              onChange={(e) => {
                const val = e.target.value === "" ? "" : Number(e.target.value);
                updateSet("warmup", i, "weight", val);
              }}
              className="w-24 p-1 border rounded"
              placeholder={allowEmptyWeights ? "Optional" : ""}
            />
            <input
              type="number"
              min={1}
              value={set.sets ?? 1}
              onChange={(e) =>
                updateSet("warmup", i, "sets", Number(e.target.value))
              }
              className="w-full p-1 border rounded"
              title="Number of repeated sets"
            />
          </div>
        ))}

        <h3 className="font-semibold mb-1 mt-4">Working Sets</h3>
        <div className="flex gap-2 mb-1 font-semibold text-sm">
          <div className="w-full">Reps</div>
          <div className="w-full">Weight</div>
          <div className="w-full">Sets</div>
        </div>
        {section.work.map((set, i) => (
          <div key={"work" + i} className="flex gap-2 mb-2 items-center">
            <input
              type="number"
              min={0}
              value={set.reps}
              onChange={(e) =>
                updateSet("work", i, "reps", Number(e.target.value))
              }
              className="w-full p-1 border rounded"
            />
            <input
              type="number"
              min={0}
              value={set.weight}
              onChange={(e) => {
                const val = e.target.value === "" ? "" : Number(e.target.value);
                updateSet("work", i, "weight", val);
              }}
              className="w-24 p-1 border rounded"
              placeholder={allowEmptyWeights ? "Optional" : ""}
            />
            <input
              type="number"
              min={1}
              value={set.sets ?? 1}
              onChange={(e) =>
                updateSet("work", i, "sets", Number(e.target.value))
              }
              className="w-full p-1 border rounded"
              title="Number of repeated sets"
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
      {/* LEFT COLUMN: Full Logging Form */}
      <div>
        <h1 className="text-3xl font-bold mb-4">Log Lifting Session</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          <input
            type="datetime-local"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="p-2 border"
            required
          />

          {/* ROW 1 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Back Squat */}
            <div className="p-4 border rounded shadow bg-slate-800 h-full flex flex-col justify-between">
              <h2 className="text-xl font-semibold mb-2">Back Squat</h2>
              {renderLiftSection(squat, setSquat)}
            </div>

            {/* Bench Press */}
            <div className="p-4 border rounded shadow bg-slate-800 h-full flex flex-col justify-between">
              <h2 className="text-xl font-semibold mb-2">Bench Press</h2>
              {renderLiftSection(bench, setBench)}
            </div>

            {/* Deadlift */}
            <div className="p-4 border rounded shadow bg-slate-800 h-full flex flex-col justify-between">
              <h2 className="text-xl font-semibold mb-2">Deadlift</h2>
              {renderLiftSection(deadlift, setDeadlift)}
            </div>
          </div>

          {/* ROW 2 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Pull-ups */}
            <div className="p-4 border rounded shadow bg-slate-800">
              <h2 className="text-xl font-semibold mb-2">
                Pull-ups (between sets)
              </h2>
              <div className="flex gap-4 mb-4 items-center">
                <div>
                  <label className="block text-sm mb-1"># of Sets</label>
                  <input
                    type="number"
                    min={0}
                    value={pullups.length}
                    onChange={(e) => {
                      const count = Number(e.target.value);
                      const reps = pullups[0]?.reps || 0;
                      const sets = pullups[0]?.sets ?? 1;
                      setPullups(
                        Array.from({ length: count }, () => ({ reps, sets }))
                      );
                    }}
                    className="p-1 border w-24"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Reps per Set</label>
                  <input
                    type="number"
                    min={0}
                    value={pullups[0]?.reps || 0}
                    onChange={(e) => {
                      const reps = Number(e.target.value);
                      setPullups(
                        pullups.map(() => ({
                          reps,
                          sets: pullups[0]?.sets ?? 1,
                        }))
                      );
                    }}
                    className="p-1 border w-24"
                  />
                </div>
              </div>
            </div>

            {/* Overhead Press */}
            <div className="p-4 border rounded shadow bg-slate-800 h-full flex flex-col justify-between">
              <h2 className="text-xl font-semibold mb-2">Overhead Press</h2>
              {renderLiftSection(overhead, setOverhead)}
            </div>

            {/* Power Clean */}
            <div className="p-4 border rounded shadow bg-slate-800 h-full flex flex-col justify-between">
              <h2 className="text-xl font-semibold mb-2">Power Clean</h2>
              {renderLiftSection(clean, setClean)}
            </div>
          </div>

          {/* ROW 3 */}
          <div className="p-4 border rounded shadow bg-slate-800">
            <label className="block font-semibold mb-1">Notes</label>
            <textarea
              className="w-full p-2 border rounded bg-slate-900"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
            />
          </div>

          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded font-semibold"
          >
            Save Log
          </button>
        </form>
      </div>

      {/* RIGHT COLUMN: Charts */}
      <div className="space-y-8">
        <h1 className="text-3xl font-bold mb-6">Performance Charts</h1>

        <div className="bg-slate-800 p-4 rounded-lg shadow-md">
          <ChartSection
            title="Squat (Back Squat)"
            data={formatTypedData("squat")}
            dataKey="weight"
            color="#4ade80"
          />
        </div>

        <div className="bg-slate-800 p-4 rounded-lg shadow-md">
          <ChartSection
            title={`Bench Press`}
            data={formatTypedData("bench")}
            dataKey="weight"
            color="#60a5fa"
          />
        </div>

        <div className="bg-slate-800 p-4 rounded-lg shadow-md">
          <ChartSection
            title={`Deadlift`}
            data={formatTypedData("deadlift")}
            dataKey="weight"
            color="#f87171"
          />
        </div>
      </div>
    </div>
  );
}

function ChartSection({
  title,
  data,
  dataKey,
  color,
}: {
  title: string;
  data: { date: string; weight: number }[];
  dataKey: string;
  color: string;
}) {
  if (!data.length) {
    return (
      <div>
        <h2 className="text-2xl font-semibold mb-2">{title}</h2>
        <p className="italic text-gray-400">No data available</p>
      </div>
    );
  }
  return (
    <div>
      <h2 className="text-2xl font-semibold mb-2">{title}</h2>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data}>
          <XAxis
            dataKey="date"
            tickFormatter={(str) => new Date(str).toLocaleDateString()}
          />
          <YAxis />
          <Tooltip content={<CustomTooltip />} />

          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={3}
            dot={{ r: 3 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: TooltipProps<number, string>) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-700 text-white p-2 rounded shadow-md text-sm">
        <div className="font-semibold">
          {new Date(label).toLocaleDateString(undefined, {
            weekday: "short",
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </div>
        <div>{payload[0].value} lbs</div>
      </div>
    );
  }

  return null;
};