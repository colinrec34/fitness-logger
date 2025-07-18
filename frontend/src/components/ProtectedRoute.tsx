// src/components/ProtectedRoute.tsx
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../api/supabaseClient";

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setIsAuthenticated(!!session?.user);
      setLoading(false);
    };

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session?.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return null; // or a loading spinner

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}
