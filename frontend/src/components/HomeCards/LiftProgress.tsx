import { useEffect, useState } from "react";
import Card from "../Card";
import { formatDistanceToNow } from "date-fns";

const api = import.meta.env.VITE_API_URL || "http://localhost:8000"

export type LiftSet = { reps: number; weight: number };
export type LiftingLog = {
  id: number;
  log_date: string;
  press_type: "Bench" | "Overhead";
  deadlift_type?: "Deadlift" | "Power Clean";
  squat: { work: LiftSet[] };
  press: { work: LiftSet[] };
  deadlift: { work: LiftSet[] };
  pullups?: { reps: number }[];
  notes: string;
};

function getLatestWeight(
  logs: LiftingLog[],
  filterFn: (log: LiftingLog) => boolean,
  getSet: (log: LiftingLog) => LiftSet[] | { reps: number }[]
): number | null {
  const filtered = logs
    .filter(filterFn)
    .sort((a, b) => b.log_date.localeCompare(a.log_date));
  if (filtered.length === 0) return null;
  const sets = getSet(filtered[0]);
  if (!sets || sets.length === 0) return null;
  if ("weight" in sets[0]) {
    return (sets as LiftSet[])[0].weight;
  } else {
    return (sets as { reps: number }[])[0].reps;
  }
}

function estimateSessionsToGoal(
  current: number | null,
  goal: number,
  increment = 5
): number | null {
  if (current == null || current >= goal) return 0;
  return Math.ceil((goal - current) / increment);
}

export default function LiftProgress() {
  const [logs, setLogs] = useState<LiftingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [goal, setGoal] = useState({
    squat: 300,
    press: 150,
    deadlift: 350,
  });

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await fetch(`${api}/logs/lifting`);
        const data = await res.json();
        setLogs(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to fetch lifting logs:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  if (loading) {
    return (
      <Card title="🏋️‍♂️ Latest Lift">
        <p className="text-gray-400 italic">Loading...</p>
      </Card>
    );
  }

  if (logs.length === 0) {
    return (
      <Card title="🏋️‍♂️ Latest Lift">
        <p className="text-gray-400 italic">No lifting logs recorded yet.</p>
      </Card>
    );
  }

  const sortedLogs = [...logs].sort((a, b) =>
    b.log_date.localeCompare(a.log_date)
  );
  const latest = sortedLogs[0];
  const relativeDate = latest?.log_date
    ? formatDistanceToNow(new Date(latest.log_date), { addSuffix: true })
    : "";

  const squat = getLatestWeight(
    logs,
    () => true,
    (log) => log.squat.work
  );
  const press = getLatestWeight(
    logs,
    (log) => log.press_type === latest.press_type,
    (log) => log.press.work
  );
  const deadlift = getLatestWeight(
    logs,
    (log) =>
      (log.deadlift_type || "Deadlift") ===
      (latest.deadlift_type || "Deadlift"),
    (log) => log.deadlift.work
  );
  const pullups = getLatestWeight(
    logs,
    () => true,
    (log) => log.pullups ?? []
  );

  return (
    <Card
      title="🏋️‍♂️ Latest Lift"
      subtitle={
        <span className="text-gray-400">
          {latest.log_date} · {relativeDate}
        </span>
      }
      footer={
        latest.notes && (
          <p className="italic text-gray-400 whitespace-pre-line max-w-md">
            "{latest.notes}"
          </p>
        )
      }
    >
      <div className="mb-4">
        <p className="mb-1 font-semibold">
          Squat: <span className="ml-2 font-bold">{squat} lbs</span>
        </p>
        <p className="text-sm text-gray-300">
          Goal:
          <input
            type="number"
            className="ml-2 w-20 px-1 py-0.5 rounded bg-slate-700 text-white border border-slate-600"
            value={goal.squat}
            onChange={(e) =>
              setGoal({ ...goal, squat: Number(e.target.value) })
            }
          />{" "}
          → {estimateSessionsToGoal(squat, goal.squat)} sessions
        </p>
      </div>

      <div className="mb-4">
        <p className="mb-1 font-semibold">
          {latest.press_type}:{" "}
          <span className="ml-2 font-bold">{press} lbs</span>
        </p>
        <p className="text-sm text-gray-300">
          Goal:
          <input
            type="number"
            className="ml-2 w-20 px-1 py-0.5 rounded bg-slate-700 text-white border border-slate-600"
            value={goal.press}
            onChange={(e) =>
              setGoal({ ...goal, press: Number(e.target.value) })
            }
          />{" "}
          → {estimateSessionsToGoal(press, goal.press)} sessions
        </p>
      </div>

      <div className="mb-4">
        <p className="mb-1 font-semibold">
          {latest.deadlift_type || "Deadlift"}:{" "}
          <span className="ml-2 font-bold">{deadlift} lbs</span>
        </p>
        <p className="text-sm text-gray-300">
          Goal:
          <input
            type="number"
            className="ml-2 w-20 px-1 py-0.5 rounded bg-slate-700 text-white border border-slate-600"
            value={goal.deadlift}
            onChange={(e) =>
              setGoal({ ...goal, deadlift: Number(e.target.value) })
            }
          />{" "}
          → {estimateSessionsToGoal(deadlift, goal.deadlift)} sessions
        </p>
      </div>

      {pullups != null && (
        <div className="mb-4">
          <p className="mb-1 font-semibold">
            Pull-ups: <span className="ml-2 font-bold">{pullups} reps</span>
          </p>
        </div>
      )}
    </Card>
  );
}
