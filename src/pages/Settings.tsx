import { useEffect, useState } from "react";
import { apiFetch } from "../api/supabaseClient";
import { useAuth } from "../context/AuthContext";
import type { Activity } from "../context/AuthContext";

function sortByPlacement(activities: Activity[]): Activity[] {
  return [...activities].sort((a, b) => {
    if (a.placement_row === b.placement_row) {
      return a.placement_col - b.placement_col;
    }
    return a.placement_row - b.placement_row;
  });
}

export default function Settings() {
  const { activities, refreshActivities } = useAuth();
  const [order, setOrder] = useState<Activity[]>([]);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setOrder(sortByPlacement(activities));
  }, [activities]);

  const dirty =
    order.map((a) => a.slug).join(",") !==
    sortByPlacement(activities).map((a) => a.slug).join(",");

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
    setStatus(null);
  }

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      await apiFetch("/activities/order", {
        method: "PUT",
        body: JSON.stringify({ slugs: order.map((a) => a.slug) }),
      });
      await refreshActivities();
      setStatus("Order saved.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to save order.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 max-w-screen-md mx-auto">
      <h1 className="text-2xl font-bold mb-2 text-white">⚙️ Settings</h1>
      <p className="text-gray-400 mb-6">
        Reorder your activities — this sets the order of the navbar links and
        the dashboard cards.
      </p>

      <div className="bg-slate-800 rounded-xl shadow-md divide-y divide-slate-700">
        {order.map((activity, i) => (
          <div
            key={activity.slug}
            className="flex items-center justify-between px-4 py-3"
          >
            <span className={activity.is_active ? "" : "text-gray-500"}>
              {activity.display_name}
              {!activity.is_active && " (inactive)"}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="bg-slate-700 px-3 py-1 rounded disabled:opacity-30 hover:bg-slate-600"
                aria-label={`Move ${activity.display_name} up`}
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === order.length - 1}
                className="bg-slate-700 px-3 py-1 rounded disabled:opacity-30 hover:bg-slate-600"
                aria-label={`Move ${activity.display_name} down`}
              >
                ↓
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-4">
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className="bg-blue-500 px-4 py-2 rounded text-white disabled:opacity-40 hover:bg-blue-400"
        >
          {saving ? "Saving..." : "Save order"}
        </button>
        {status && <span className="text-sm text-gray-300">{status}</span>}
      </div>
    </div>
  );
}
