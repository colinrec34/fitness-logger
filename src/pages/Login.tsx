import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../api/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { Eye, EyeOff } from "lucide-react";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) navigate("/");
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        navigate("/");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        if (!data.user) {
          setError("Login failed");
          return;
        }
        navigate("/");
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Authentication failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative">
      <form
        onSubmit={handleSubmit}
        className="bg-slate-800 p-6 rounded shadow-md w-full max-w-md"
      >
        <h2 className="text-xl font-bold text-white mb-4">
          {isSignUp ? "Sign Up" : "Login"}
        </h2>

        {error && <p className="text-red-400 mb-3">{error}</p>}

        <label className="block mb-2 text-white">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full mt-1 p-2 bg-slate-700 text-white rounded"
            required
            disabled={loading}
          />
        </label>

        <label className="block mb-4 text-white relative">
          Password
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full mt-1 p-2 pr-10 bg-slate-700 text-white rounded"
            required
            disabled={loading}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-1/2 text-blue-300 hover:text-yellow-400 flex items-center justify-center"
            style={{ transform: "translateY(20%)" }}
            disabled={loading}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </label>

        <button
          type="submit"
          className="w-full bg-yellow-500 text-black font-semibold py-2 rounded hover:bg-yellow-600 transition"
          disabled={loading}
        >
          {isSignUp ? "Sign Up" : "Log In"}
        </button>

        <button
          type="button"
          className="mt-4 w-full text-sm text-blue-400 underline"
          onClick={() => {
            setError(null);
            setIsSignUp(!isSignUp);
            setEmail("");
            setPassword("");
          }}
          disabled={loading}
        >
          {isSignUp
            ? "Already have an account? Log In"
            : "Don't have an account? Sign Up"}
        </button>
      </form>
    </div>
  );
}
