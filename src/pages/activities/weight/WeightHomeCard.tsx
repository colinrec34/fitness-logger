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
const ACTIVITY_ID = "3bacbc7e-4e70-435a-8927-ccc7ff1568b7";

import type { LogRow } from "./types";

export default function WeightProgress() {
  const [userId, setUserId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

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

  //Getting log data
  useEffect(() => {
    async function fetchAllLogs() {
      if (!userId) return;
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
    date: format(new Date(log.datetime), "MMMM d, yyyy"),
    weight: log.data.weight,
  }));

  const sortedLogs = [...logs].sort((a, b) =>
    b.datetime.localeCompare(a.datetime)
  );
  const latest = sortedLogs[0];
  const formattedDatetime = latest.datetime
    ? format(new Date(latest.datetime), "MMMM d, yyyy")
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
