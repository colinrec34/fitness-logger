import { useEffect, useState } from "react";
import Card from "../../../components/Card";
import { format, formatDistanceToNow } from "date-fns";
import { supabase } from "../../../api/supabaseClient";

const ACTIVITY_ID = "e07d19fd-c9a0-42f0-a110-01d532a5b66d";

import type {
  LogRow,
} from "./types"

function estimateSessionsToGoal(
  current: number,
  goal: number,
  increment = 5
): number | null {
  if (current == null || current >= goal) return 0;
  return Math.ceil((goal - current) / increment);
}

export default function LiftProgress() {
  const [userId, setUserId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Default values for goals
  const [goal, setGoal] = useState({
    squat: 300,
    bench: 225,
    deadlift: 350,
    pullupsTotal: 100,
    overhead: 185,
    clean: 185,
  });

  // Getting the userId
  useEffect(() => {
    const getUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error("Failed to get user:", error.message);
        return;
      }
      setUserId(data?.user?.id || null);
    };

    getUser();
  }, []);

  // Fetching all logs
  useEffect(() => {
    async function fetchAllLogs() {
      setLoading(true);
      const { data, error } = await supabase
        .from("logs")
        .select("*")
        .eq("user_id", userId)
        .eq("activity_id", ACTIVITY_ID)
        .order("datetime", { ascending: true });

      if (error) {
        console.error("Error fetching logs:", error);
        setLogs([]);
      } else if (data) {
        setLogs(data);
      }
      setLoading(false);
    }
    fetchAllLogs();
  }, [userId]);

  // Loading state
  if (loading) {
    return (
      <Card title="🏋️‍♂️ Latest Lift">
        <p className="text-gray-400 italic">Loading...</p>
      </Card>
    );
  }

  // If no logs loaded
  if (logs.length === 0) {
    return (
      <Card title="🏋️‍♂️ Latest Lift">
        <p className="text-gray-400 italic">No logs recorded yet.</p>
      </Card>
    );
  }

  const sortedLogs = [...logs].sort((a, b) =>
    b.datetime.localeCompare(a.datetime)
  );
  const latest = sortedLogs[0];
  const formattedDatetime = latest.datetime ? format( new Date(latest.datetime), "MMMM d, yyyy")
  : "";
  const relativeDate = latest?.datetime
    ? formatDistanceToNow(new Date(latest.datetime), { addSuffix: true })
    : "";

  const squat = latest.data.squat?.work[0].weight ?? null;
  const bench = latest.data.bench?.work[0].weight ?? null;
  const deadlift = latest.data.deadlift?.work[0].weight ?? null;
  const pullupsTotal = latest.data.pullups
    ? latest.data.pullups.reduce((sum, set) => sum + (set.reps || 0), 0)
    : 0;

  const overhead = latest.data.overhead?.work[0].weight ?? null;
  const clean = latest.data.clean?.work[0].weight ?? null;

  return (
    <Card
      title="🏋️‍♂️ Latest Lift"
      subtitle={
        <span className="text-gray-400">
          {formattedDatetime} · {relativeDate}
        </span>
      }
      footer={
        latest.data.notes && (
          <p className="italic text-gray-400 whitespace-pre-line max-w-md">
            "{latest.data.notes}"
          </p>
        )
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
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
              →{" "}
              {typeof squat === "number"
                ? estimateSessionsToGoal(squat, goal.squat)
                : "—"}{" "}
              sessions
            </p>
          </div>

          <div className="mb-4">
            <p className="mb-1 font-semibold">
              Bench Press: <span className="ml-2 font-bold">{bench} lbs</span>
            </p>
            <p className="text-sm text-gray-300">
              Goal:
              <input
                type="number"
                className="ml-2 w-20 px-1 py-0.5 rounded bg-slate-700 text-white border border-slate-600"
                value={goal.bench}
                onChange={(e) =>
                  setGoal({ ...goal, bench: Number(e.target.value) })
                }
              />{" "}
              →{" "}
              {typeof bench === "number"
                ? estimateSessionsToGoal(bench, goal.bench)
                : "—"}{" "}
              sessions
            </p>
          </div>

          <div className="mb-4">
            <p className="mb-1 font-semibold">
              Deadlift:<span className="ml-2 font-bold">{deadlift} lbs</span>
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
              →{" "}
              {typeof deadlift === "number"
                ? estimateSessionsToGoal(deadlift, goal.deadlift)
                : "—"}{" "}
              sessions
            </p>
          </div>
        </div>

        <div>
          <div className="mb-4">
            <p className="mb-1 font-semibold">
              Total Pullups:{" "}
              <span className="ml-2 font-bold">{pullupsTotal} pullups</span>
            </p>
            <p className="text-sm text-gray-300">
              Goal:
              <input
                type="number"
                className="ml-2 w-20 px-1 py-0.5 rounded bg-slate-700 text-white border border-slate-600"
                value={goal.pullupsTotal}
                onChange={(e) =>
                  setGoal({ ...goal, pullupsTotal: Number(e.target.value) })
                }
              />{" "}
            </p>
          </div>

          <div className="mb-4">
            <p className="mb-1 font-semibold">
              Overhead Press: <span className="ml-2 font-bold">{overhead} lbs</span>
            </p>
            <p className="text-sm text-gray-300">
              Goal:
              <input
                type="number"
                className="ml-2 w-20 px-1 py-0.5 rounded bg-slate-700 text-white border border-slate-600"
                value={goal.overhead}
                onChange={(e) =>
                  setGoal({ ...goal, overhead: Number(e.target.value) })
                }
              />{" "}
              →{" "}
              {typeof overhead === "number"
                ? estimateSessionsToGoal(overhead, goal.overhead)
                : "—"}{" "}
              sessions
            </p>
          </div>

          <div className="mb-4">
            <p className="mb-1 font-semibold">
              Clean: <span className="ml-2 font-bold">{clean} lbs</span>
            </p>
            <p className="text-sm text-gray-300">
              Goal:
              <input
                type="number"
                className="ml-2 w-20 px-1 py-0.5 rounded bg-slate-700 text-white border border-slate-600"
                value={goal.clean}
                onChange={(e) =>
                  setGoal({ ...goal, clean: Number(e.target.value) })
                }
              />{" "}
              →{" "}
              {typeof clean === "number"
                ? estimateSessionsToGoal(clean, goal.clean)
                : "—"}{" "}
              sessions
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
