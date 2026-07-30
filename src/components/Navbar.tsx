import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, activities, signOut } = useAuth();

  const navActivities = activities
    .filter((a) => a.is_active)
    .sort((a, b) => {
      if (a.placement_row === b.placement_row) {
        return a.placement_col - b.placement_col;
      }
      return a.placement_row - b.placement_row;
    });

  return (
    <nav className="bg-slate-900 text-white p-4 shadow flex items-center justify-between gap-4">
      <div className="flex gap-4 overflow-x-auto scroll-hide min-w-0 flex-nowrap">
        <Link to="/" className="font-bold text-yellow-400 shrink-0">
          Dashboard
        </Link>
        {navActivities.map((activity) => (
          <Link
            key={activity.slug}
            to={`/${activity.slug}`}
            className="hover:text-yellow-300 transition shrink-0 whitespace-nowrap"
          >
            {activity.display_name}
          </Link>
        ))}
      </div>
      <div className="flex items-center gap-4 shrink-0">
        {user && (
          <Link
            to="/settings"
            className="hover:text-yellow-300 transition"
            aria-label="Settings"
          >
            ⚙️
          </Link>
        )}
        {user && (
          <span className="hidden sm:inline text-sm text-slate-300">
            Signed in as {user.email}
          </span>
        )}
        {user && (
          <button
            onClick={signOut}
            className="bg-yellow-400 text-black px-3 py-1 rounded hover:bg-yellow-300 text-sm shrink-0"
          >
            Logout
          </button>
        )}
      </div>
    </nav>
  );
}
