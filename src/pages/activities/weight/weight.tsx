import { useState, useEffect } from "react";
import WeightProgress from "./WeightHomeCard";

import { supabase } from "../../../api/supabaseClient";
import type { LogRow } from "./types";
const ACTIVITY_ID = "3bacbc7e-4e70-435a-8927-ccc7ff1568b7";

export default function Weight() {
  const [datetime, setDatetime] = useState(() => {
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

  const [userId, setUserId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);

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

  useEffect(() => {
    async function fetchAllLogs() {
      if (!userId) return;
      
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
    }
    fetchAllLogs();
  }, [userId]);

  const [weight, setWeight] = useState<number | "">("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) throw authError;
    if (!user) throw new Error("User not authenticated");

    if (weight === "") {
      alert("Please enter a weight.");
      return;
    }

    const payload = {
      user_id: user.id,
      activity_id: ACTIVITY_ID,
      datetime: new Date(datetime).toISOString(),
      data: {
        weight: weight,
      },
    };

    const { error } = await supabase
      .from("logs")
      .upsert(payload, { onConflict: "activity_id,datetime" });

    if (error) throw error;

    alert("Lifting session logged!");
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
          {logs.length > 0 ? (
            <WeightProgress />
          ) : (
            <p className="text-gray-400 italic">No weight data yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
