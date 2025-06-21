import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const api = import.meta.env.VITE_API_URL || "http://localhost:8000";

type SetEntry = { reps: number; weight: number | "" };
type LiftSection = { warmup: SetEntry[]; work: SetEntry[] };
type LiftingLog = {
  id: number;
  log_date: string;
  squat: LiftSection;
  press: LiftSection;
  press_type: "Bench" | "Overhead";
  deadlift: LiftSection;
  deadlift_type: "Deadlift" | "Power Clean";
  pullups?: { reps: number }[];
  notes: string;
};

export default function Lifts() {
  const [date, setDate] = useState(() => {
    const today = new Date();
    return new Date(today.getTime() - today.getTimezoneOffset() * 60000)
      .toISOString()
      .split("T")[0];
  });

  const [logs, setLogs] = useState<LiftingLog[]>([]);

  useEffect(() => {
    const fetchAllLogs = async () => {
      try {
        const response = await fetch(`${api}/logs/lifting`);
        const data = await response.json();
        if (Array.isArray(data)) {
          setLogs(data);
        } else {
          console.warn("Expected an array of logs, got:", data);
          setLogs([]);
        }
      } catch (err) {
        console.error("Failed to fetch logs:", err);
        setLogs([]);
      }
    };
    fetchAllLogs();
  }, []);

  useEffect(() => {
    const fetchLogForDate = async () => {
      try {
        const response = await fetch(
          `${api}/logs/lifting/${date}`
        );
        if (!response.ok) return;

        const data = await response.json();
        if (data) {
          setSquat(data.squat);
          setPressType(data.press_type);
          setPress(
            data.press?.warmup && data.press?.work
              ? data.press
              : { warmup: [], work: [] }
          );
          setPullType(data.deadlift_type || "Deadlift");
          setDeadlift(
            data.deadlift?.warmup && data.deadlift?.work
              ? data.deadlift
              : { warmup: [], work: [] }
          );
          setPullups(data.pullups || []);
          setNotes(data.notes || "");
        }
      } catch (err) {
        console.error("❌ Error fetching log for date:", err);
      }
    };

    fetchLogForDate();
  }, [date]);

  const [pressType, setPressType] = useState<"Bench" | "Overhead">("Bench");
  const [pullType, setPullType] = useState<"Deadlift" | "Power Clean">(
    "Deadlift"
  );
  const [squatType] = useState<"Back Squat">("Back Squat");

  const [squat, setSquat] = useState<LiftSection>({
    warmup: [
      { reps: 5, weight: 45 },
      { reps: 5, weight: 45 },
      { reps: 5, weight: 0 },
      { reps: 3, weight: 0 },
      { reps: 2, weight: 0 },
    ],
    work: [
      { reps: 5, weight: 0 },
      { reps: 5, weight: 0 },
      { reps: 5, weight: 0 },
    ],
  });

  const [press, setPress] = useState<LiftSection>({
    warmup: [
      { reps: 5, weight: 45 },
      { reps: 5, weight: 45 },
      { reps: 5, weight: 0 },
      { reps: 3, weight: 0 },
      { reps: 2, weight: 0 },
    ],
    work: [
      { reps: 5, weight: 0 },
      { reps: 5, weight: 0 },
      { reps: 5, weight: 0 },
    ],
  });

  const [deadlift, setDeadlift] = useState<LiftSection>({
    warmup: [
      { reps: 5, weight: 0 },
      { reps: 3, weight: 0 },
    ],
    work: [{ reps: 5, weight: 0 }],
  });

  const [pullups, setPullups] = useState<{ reps: number }[]>([{ reps: 0 }]);
  const [notes, setNotes] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validateWeights = (lift: LiftSection) => {
      for (const set of [...lift.warmup, ...lift.work]) {
        if (
          set.weight === "" ||
          set.weight === null ||
          set.weight === undefined
        ) {
          throw new Error("Empty weight input detected");
        }
      }
    };

    try {
      validateWeights(squat);
      validateWeights(press);
      validateWeights(deadlift);

      const payload = {
        date,
        squat,
        press_type: pressType,
        press,
        deadlift_type: pullType,
        deadlift,
        pullups,
        notes,
      };

      const response = await fetch(`${api}/logs/lifting`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(`Error: ${response.statusText}`);

      alert("Lifting session logged!");
    } catch (error) {
      console.error("❌ Submission error:", error);
      alert("Failed to save log. Make sure no input fields are empty.");
    }
  };

  const formatTypedData = (
    lift: "squat" | "press" | "deadlift",
    type?: "Bench" | "Overhead" | "Deadlift" | "Power Clean"
  ) => {
    return logs
      .filter((log) => {
        if (lift === "press") return log.press_type === type;
        if (lift === "deadlift")
          return (log.deadlift_type ?? "Deadlift") === type;
        return true;
      })
      .map((log) => {
        const sets = log[lift].work || [];
        const maxWeight = Math.max(
          ...sets.map((s) => (typeof s.weight === "number" ? s.weight : 0))
        );
        return {
          date: log.log_date,
          weight: maxWeight,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  };

  const renderLiftSection = (
    lift: LiftSection,
    setLift: (newVal: LiftSection) => void,
    simpleWarmup: boolean = false
  ) => {
    const updateWarmup = (index: number, weightStr: string) => {
      const weight = weightStr === "" ? "" : Number(weightStr);
      const warmup = [...lift.warmup];
      warmup[index] = { ...warmup[index], weight };
      setLift({ ...lift, warmup });
    };

    const updateDoubleWarmup = (weightStr: string) => {
      const weight = weightStr === "" ? "" : Number(weightStr);
      const warmup = [...lift.warmup];
      warmup[0] = { ...warmup[0], weight };
      warmup[1] = { ...warmup[1], weight };
      setLift({ ...lift, warmup });
    };

    const updateWorkWeight = (weightStr: string) => {
      const parsed = weightStr.trim() === "" ? "" : Number(weightStr);
      const weight: number | "" = parsed === "" || isNaN(parsed) ? "" : parsed;

      const work: SetEntry[] = lift.work.map((s) => ({
        ...s,
        weight,
      }));

      setLift({ ...lift, work });
    };

    return (
      <div className="mb-6 flex flex-col justify-between h-full">
        <div className="flex-grow flex flex-col justify-between">
          <div className="mb-4">
            <p className="font-medium mb-1">Warmup Sets:</p>
            {simpleWarmup ? (
              lift.warmup.map((set, i) => (
                <div
                  key={i}
                  className="grid grid-cols-3 gap-2 mb-1 items-center"
                >
                  <span className="text-sm">{set.reps} reps</span>
                  <input
                    type="number"
                    value={set.weight === "" ? "" : set.weight}
                    onChange={(e) => updateWarmup(i, e.target.value)}
                    className="p-1 border w-full"
                  />
                  <span className="text-xs text-gray-400">Warmup {i + 1}</span>
                </div>
              ))
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 mb-1 items-center">
                  <span className="text-sm">2 × 5 reps</span>
                  <input
                    type="number"
                    value={
                      lift.warmup[0].weight === "" ? "" : lift.warmup[0].weight
                    }
                    onChange={(e) => updateDoubleWarmup(e.target.value)}
                    className="p-1 border w-full"
                  />
                  <span className="text-xs text-gray-400">Warmups 1–2</span>
                </div>
                {lift.warmup.slice(2).map((set, i) => (
                  <div
                    key={i + 2}
                    className="grid grid-cols-3 gap-2 mb-1 items-center"
                  >
                    <span className="text-sm">{set.reps} reps</span>
                    <input
                      type="number"
                      value={set.weight === "" ? "" : set.weight}
                      onChange={(e) => updateWarmup(i + 2, e.target.value)}
                      className="p-1 border w-full"
                    />
                    <span className="text-xs text-gray-400">
                      Warmup {i + 3}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>

          <div className="mt-auto">
            <p className="font-medium mb-1">Work Sets:</p>
            <div className="grid grid-cols-3 gap-2 mb-1 items-center">
              <span className="text-sm">
                {lift.work[0].reps} reps × {lift.work.length}
              </span>
              <input
                type="number"
                value={lift.work[0].weight === "" ? "" : lift.work[0].weight}
                onChange={(e) => updateWorkWeight(e.target.value)}
                className="p-1 border w-full"
              />
              <span className="text-xs text-gray-400">All Sets</span>
            </div>
          </div>
        </div>
      </div>
    );
  };
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
      {/* LEFT COLUMN: Full Logging Form */}
      <div>
        <h1 className="text-3xl font-bold mb-4">Log Lifting Session</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="p-2 border"
            required
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Squat */}
            <div className="p-4 border rounded shadow bg-slate-800 h-full flex flex-col justify-between">
              <h2 className="text-xl font-semibold mb-2">{squatType}</h2>
              <div className="mb-4">
                <label className="block font-medium mb-1">Squat Type:</label>
                <select className="p-2 border w-full" disabled>
                  <option value="Back Squat">Back Squat</option>
                </select>
              </div>
              {renderLiftSection(squat, setSquat)}
            </div>

            {/* Press */}
            <div className="p-4 border rounded shadow bg-slate-800 h-full flex flex-col justify-between">
              <h2 className="text-xl font-semibold mb-2">{pressType} Press</h2>
              <div className="mb-4">
                <label className="block font-medium mb-1">Press Type:</label>
                <select
                  value={pressType}
                  onChange={(e) =>
                    setPressType(e.target.value as "Bench" | "Overhead")
                  }
                  className="p-2 border w-full"
                >
                  <option value="Bench">Bench Press</option>
                  <option value="Overhead">Overhead Press</option>
                </select>
              </div>
              {press && renderLiftSection(press, setPress)}
            </div>

            {/* Deadlift */}
            <div className="p-4 border rounded shadow bg-slate-800 h-full flex flex-col justify-between">
              <h2 className="text-xl font-semibold mb-2">{pullType}</h2>
              <div className="mb-4">
                <label className="block font-medium mb-1">Pull Type:</label>
                <select
                  value={pullType}
                  onChange={(e) =>
                    setPullType(e.target.value as "Deadlift" | "Power Clean")
                  }
                  className="p-2 border w-full"
                >
                  <option value="Deadlift">Deadlift</option>
                  <option value="Power Clean">Power Clean</option>
                </select>
              </div>
              {deadlift && renderLiftSection(deadlift, setDeadlift, true)}
            </div>
          </div>

          {/* Pull-ups */}
          <div className="p-4 border rounded shadow bg-slate-800">
            <h2 className="text-xl font-semibold mb-2">
              Pull-ups (between sets)
            </h2>
            <div className="flex gap-4 mb-4">
              <div>
                <label className="block text-sm mb-1"># of Sets</label>
                <input
                  type="number"
                  min={0}
                  value={pullups.length}
                  onChange={(e) => {
                    const count = Number(e.target.value);
                    const reps = pullups[0]?.reps || 0;
                    setPullups(Array.from({ length: count }, () => ({ reps })));
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
                    setPullups(pullups.map(() => ({ reps })));
                  }}
                  className="p-1 border w-24"
                />
              </div>
            </div>
          </div>

          <textarea
            placeholder="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="p-2 border w-full mt-6"
          />

          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            Save Lifting Session
          </button>
        </form>
      </div>

      {/* RIGHT COLUMN: Performance Graphs */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-4">
          Performance Over Time
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-slate-800 p-4 rounded shadow">
            <h3 className="text-white text-lg mb-2">Squat</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={formatTypedData("squat")} margin={{ top: 10, right: 20, bottom: 5, left: -24 }}>
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const { date, weight } = payload[0].payload;
                      return (
                        <div className="bg-slate-700 text-white p-2 rounded text-sm shadow">
                          <div className="font-semibold">
                            {new Date(date).toLocaleDateString()}
                          </div>
                          <div>
                            Weight:{" "}
                            <span className="font-bold">{weight} lbs</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line type="monotone" dataKey="weight" stroke="white" dot={false}/>
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Bench Press */}
          <div className="bg-slate-800 p-4 rounded shadow">
            <h3 className="text-white text-lg mb-2">Bench Press</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={formatTypedData("press", "Bench")} margin={{ top: 10, right: 20, bottom: 5, left: -24 }}>
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const { date, weight } = payload[0].payload;
                      return (
                        <div className="bg-slate-700 text-white p-2 rounded text-sm shadow">
                          <div className="font-semibold">
                            {new Date(date).toLocaleDateString()}
                          </div>
                          <div>
                            Weight:{" "}
                            <span className="font-bold">{weight} lbs</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line type="monotone" dataKey="weight" stroke="skyblue" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Overhead Press */}
          <div className="bg-slate-800 p-4 rounded shadow">
            <h3 className="text-white text-lg mb-2">Overhead Press</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={formatTypedData("press", "Overhead")} margin={{ top: 10, right: 20, bottom: 5, left: -24 }}>
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const { date, weight } = payload[0].payload;
                      return (
                        <div className="bg-slate-700 text-white p-2 rounded text-sm shadow">
                          <div className="font-semibold">
                            {new Date(date).toLocaleDateString()}
                          </div>
                          <div>
                            Weight:{" "}
                            <span className="font-bold">{weight} lbs</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line type="monotone" dataKey="weight" stroke="purple" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Deadlift */}
          <div className="bg-slate-800 p-4 rounded shadow">
            <h3 className="text-white text-lg mb-2">Deadlift</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={formatTypedData("deadlift", "Deadlift")} margin={{ top: 10, right: 20, bottom: 5, left: -24 }}>
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const { date, weight } = payload[0].payload;
                      return (
                        <div className="bg-slate-700 text-white p-2 rounded text-sm shadow">
                          <div className="font-semibold">
                            {new Date(date).toLocaleDateString()}
                          </div>
                          <div>
                            Weight:{" "}
                            <span className="font-bold">{weight} lbs</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line type="monotone" dataKey="weight" stroke="orange" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Power Clean */}
          <div className="bg-slate-800 p-4 rounded shadow">
            <h3 className="text-white text-lg mb-2">Power Clean</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={formatTypedData("deadlift", "Power Clean")} margin={{ top: 10, right: 20, bottom: 5, left: -24 }}>
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const { date, weight } = payload[0].payload;
                      return (
                        <div className="bg-slate-700 text-white p-2 rounded text-sm shadow">
                          <div className="font-semibold">
                            {new Date(date).toLocaleDateString()}
                          </div>
                          <div>
                            Weight:{" "}
                            <span className="font-bold">{weight} lbs</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line type="monotone" dataKey="weight" stroke="green" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
