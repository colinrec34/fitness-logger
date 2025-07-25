import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../api/supabaseClient";
import { getUser } from "../api/supabaseClient";

interface Activity {
  slug: string;
  display_name: string;
  placement_row: number;
  placement_col: number;
}

export default function Navbar() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  async function fetchUser() {
    try {
      const user = await getUser();
      setUserEmail(user?.email ?? null);
    } catch (err) {
      console.error("Error fetching user:", err);
      setUserEmail(null);
    }
  }

  async function fetchActivities() {
    const { data, error } = await supabase
      .from("activities")
      .select("slug, display_name, placement_row, placement_col")
      .eq("is_active", true);

    if (error) {
      console.error("Error fetching activities:", error);
      setActivities([]);
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

  useEffect(() => {
    fetchUser();
    fetchActivities();
    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
      if (!session) {
        setActivities([]); // Clear activities on logout/session expiration
      } else {
        fetchActivities(); // Fetch on login
      }
    });

    return () => subscription.unsubscribe();
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
      <div className="flex items-center gap-4">
        {userEmail && (
          <span className="text-sm text-slate-300">
            Signed in as {userEmail}
          </span>
        )}
        {userEmail && (
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              setUserEmail(null);
              setActivities([]);
            }}
            className="bg-yellow-400 text-black px-3 py-1 rounded hover:bg-yellow-300 text-sm"
          >
            Logout
          </button>
        )}
      </div>
    </nav>
  );
}
