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
    <nav className="bg-slate-900 text-white p-4 shadow flex justify-between">
      <div className="flex gap-4">
        <Link to="/" className="font-bold text-yellow-400">
          Dashboard
        </Link>
        {navActivities.map((activity) => (
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
        {user && (
          <span className="text-sm text-slate-300">
            Signed in as {user.email}
          </span>
        )}
        {user && (
          <button
            onClick={signOut}
            className="bg-yellow-400 text-black px-3 py-1 rounded hover:bg-yellow-300 text-sm"
          >
            Logout
          </button>
        )}
      </div>
    </nav>
  );
}
