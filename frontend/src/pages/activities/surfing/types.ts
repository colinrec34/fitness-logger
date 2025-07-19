export interface SurfLogData = {
  location_id: string;
  board?: string;
  wave_height: string;
  duration_minutes: number;
  waves_caught: number;
  notes?: string;
};

export interface LocationRow {
    id: string;
    user_id: string;
    activity_id: string;
    name: string;
    lat: number;
    lon: number;
    created_at?: string;
}

export interface LogRow {
  id: number;
  user_id: string;
  activity_id: string;
  datetime: string;
  location_id?: number;
  data: SurfLogData;
  created_at?: string;
  updated_at?: string;
}