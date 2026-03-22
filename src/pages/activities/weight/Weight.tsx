import { useState, useEffect } from "react";
import WeightProgress from "./WeightHomeCard";

import { supabase } from "../../../api/supabaseClient";
import { useAuth } from "../../../context/AuthContext";
import { currentDatetimeLocal } from "../../../lib/datetimeLocal";
import type { LogRow } from "./types";

const ACTIVITY_ID = "3bacbc7e-4e70-435a-8927-ccc7ff1568b7";

export default function Weight() {
  const { user } = useAuth();
  const [datetime, setDatetime] = useState(currentDatetimeLocal);
  const [weight, setWeight] = useState<number | "">("");
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        setError("Failed to load weight data. Please refresh.");
        setLogs([]);
      } else if (data) {
        setLogs(data);
      }
      setLoading(false);
    }
    fetchAllLogs();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (weight === "") {
      alert("Please enter a weight.");
      return;
    }

    try {
      const payload = {
        user_id: user.id,
        activity_id: ACTIVITY_ID,
        datetime: new Date(datetime).toISOString(),
        data: { weight },
      };

      const { error } = await supabase
        .from("logs")
        .upsert(payload, { onConflict: "activity_id,datetime" });

      if (error) throw error;

      alert("Weight logged!");

      const { data: updatedLogs, error: fetchError } = await supabase
        .from("logs")
        .select("*")
        .eq("user_id", user.id)
        .eq("activity_id", ACTIVITY_ID)
        .order("datetime", { ascending: true });

      if (!fetchError && updatedLogs) setLogs(updatedLogs);
    } catch (err) {
      console.error("Submission error:", err);
      alert("Failed to save log. Please try again.");
    }
  };

  return (
    <div className="flex justify-center px-4 py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl w-full">
        {/* LEFT: Logging Form */}
        <div className="max-w-md w-full">
          <h1 className="text-3xl font-bold mb-6">Log Weight</h1>
          <form onSubmit={handleSubmit} className="space-y-4 mb-8">
            <div>
              <label className="block mb-1 font-medium">Date & Time</label>
              <input
                type="datetime-local"
                value={datetime}
                onChange={(e) => setDatetime(e.target.value)}
                className="w-full border px-3 py-2 rounded"
                required
              />
            </div>

            <div>
              <label className="block mb-1 font-medium">Weight (lbs)</label>
              <input
                type="number"
                value={weight}
                onChange={(e) =>
                  setWeight(
                    e.target.value === "" ? "" : parseFloat(e.target.value)
                  )
                }
                className="w-full border px-3 py-2 rounded"
                step="0.1"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded"
            >
              Save
            </button>
          </form>
        </div>

        {/* RIGHT: Progress Chart */}
        <div className="w-full">
          <h2 className="text-xl font-semibold text-white mb-4">
            Weight Progress
          </h2>
          {loading ? (
            <p className="text-gray-400 italic">Loading weight data...</p>
          ) : error ? (
            <p className="text-red-400 italic">{error}</p>
          ) : logs.length > 0 ? (
            <WeightProgress />
          ) : (
            <p className="text-gray-400 italic">No weight data yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
