import { useEffect, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import Card from "../../../components/Card";

import { supabase } from "../../../api/supabaseClient";
const WEIGHT_ACTIVITY_ID = "3bacbc7e-4e70-435a-8927-ccc7ff1568b7";

import type { LogRow } from "./types";

export default function WeightProgress() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  //Getting log data
  useEffect(() => {
    async function fetchAllLogs() {
      setLoading(true);
      const { data, error } = await supabase
        .from("logs")
        .select("*")
        .eq("activity_id", WEIGHT_ACTIVITY_ID)
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
  }, []);

  // Loading State
  if (loading) {
    return (
      <Card title="⚖️ Body Weight">
        <p className="text-gray-400 italic">Loading...</p>
      </Card>
    );
  }

  // If no logs loaded
  if (logs.length === 0) {
    return (
      <Card title="⚖️ Body Weight">
        <p className="text-gray-400 italic">No data available.</p>
      </Card>
    );
  }

  const chartData = logs.map((log) => ({
    date: format(new Date(log.datetime), "MMM d, yyyy"),
    weight: log.data.weight,
  }));

  const sortedLogs = [...logs].sort((a, b) =>
    b.datetime.localeCompare(a.datetime)
  );
  const latest = sortedLogs[0];
  const formattedDatetime = latest.datetime
    ? format(new Date(latest.datetime), "MMM d, yyyy")
    : "";
  const relativeDate = latest?.datetime
    ? formatDistanceToNow(new Date(latest.datetime), { addSuffix: true })
    : "";

  return (
    <Card
      title={`⚖️ Body Weight: ${latest.data.weight} lbs`}
      subtitle={
        <span className="text-gray-400">
          {formattedDatetime} · {relativeDate}
        </span>
      }
    >
      <div className="w-full h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 20, bottom: 5, left: -24 }}
          >
            <XAxis dataKey="date" fontSize={12} tickMargin={6} />
            <YAxis domain={[150, "auto"]} fontSize={12} />
            <Tooltip
              content={({ active, payload, label }) =>
                active && payload && payload.length ? (
                  <div className="bg-slate-600 p-3 rounded text-sm text-white shadow">
                    <p className="font-semibold">Date: {label}</p>
                    <p>Weight: {payload[0].value} lbs</p>
                  </div>
                ) : null
              }
            />
            <Line
              type="monotone"
              dataKey="weight"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
