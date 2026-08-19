import { apiFetch } from "../api/supabaseClient";

export interface GeocodeResult {
  displayName: string;
  shortName: string;
  lat: number;
  lon: number;
}

export async function searchPlaces(
  query: string,
  signal?: AbortSignal,
): Promise<GeocodeResult[]> {
  if (!query.trim()) return [];
  return apiFetch(`/geocode?q=${encodeURIComponent(query)}`, { signal });
}
