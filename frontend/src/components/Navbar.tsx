import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../api/supabaseClient";

interface Activity {
  slug: string;
  display_name: string;
  placement_row: number;
  placement_col: number;
}

export default function Navbar() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const navigate = useNavigate();

  async function fetchActivities() {
    const { data, error } = await supabase
      .from("activities")
      .select("slug, display_name, placement_row, placement_col")
      .eq("is_active", true);

    if (error) {
      console.error("Error fetching activities:", error);
      return;
    }

    const sorted = (data || []).sort((a, b) =>
      a.placement_row === b.placement_row
        ? a.placement_col - b.placement_col
        : a.placement_row - b.placement_row
    );
    setActivities(sorted);
  }

  async function fetchUser() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    setUserEmail(session?.user?.email ?? null);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUserEmail(null);
    setActivities([]);
    navigate("/login");
  }

  useEffect(() => {
    fetchUser();
    fetchActivities();

    const { data: subscription } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUserEmail(session?.user?.email ?? null);

        // Optional: If activities are user-specific, refetch
        await fetchActivities();
      }
    );

    return () => {
      subscription?.subscription?.unsubscribe?.();
    };
  }, []);

  return (
    <nav className="bg-slate-900 text-white p-4 shadow flex justify-between items-center">
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
            onClick={handleLogout}
            className="bg-yellow-400 text-black px-3 py-1 rounded hover:bg-yellow-300 text-sm"
          >
            Logout
          </button>
        )}
      </div>
    </nav>
  );
}
