import { supabase } from "../api/supabaseClient";

export type Location = {
  id: string;
  name: string;
  activity_id: number;
};

export async function fetchLocationsByActivity(activityId: number): Promise<Location[]> {
  const { data, error } = await supabase
    .from<Location>("locations")
    .select("id, name, activity_id")
    .eq("activity_id", activityId)
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching locations:", error);
    return [];
  }

  return data ?? [];
}
