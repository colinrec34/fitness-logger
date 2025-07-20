import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../api/supabaseClient";

interface Activity {
  slug: string;
  display_name: string;
  placement_row: number;
  placement_col: number;
}

export default function Navbar() {
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    async function fetchActivities() {
      const { data, error } = await supabase
        .from("activities")
        .select("slug, display_name, placement_row, placement_col")
        .eq("is_active", true);

      if (error) {
        console.error("Error fetching activities:", error);
        return;
      }

      const sorted = (data || []).sort((a, b) => {
        if (a.placement_row === b.placement_row) {
          return a.placement_col - b.placement_col;
        }
        return a.placement_row - b.placement_row;
      });

      setActivities(sorted);
    }

    fetchActivities();
  }, []);

  return (
    <nav className="bg-slate-900 text-white p-4 shadow flex justify-between">
      <div className="flex gap-4">
        <Link to="/" className="font-bold text-yellow-400">
          Dashboard
        </Link>
        {activities.map((activity) => (
          <Link
            key={activity.slug}
            to={`/${activity.slug}`}
            className="hover:text-yellow-300 transition"
          >
            {activity.display_name}
          </Link>
        ))}
      </div>
    </nav>
  );
}
