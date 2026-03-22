import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../api/supabaseClient";

export interface Activity {
  slug: string;
  display_name: string;
  placement_row: number;
  placement_col: number;
  is_active: boolean;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  activities: Activity[];
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<Activity[]>([]);

  async function fetchActivities() {
    const { data, error } = await supabase
      .from("activities")
      .select("slug, display_name, placement_row, placement_col, is_active");
    if (error) {
      console.error("Error fetching activities:", error);
      setActivities([]);
      return;
    }
    setActivities(data || []);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session) fetchActivities();
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session) {
        fetchActivities();
      } else {
        setActivities([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ user, loading, activities, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
