export interface GolfingLogData {
  location_id: string;
  holes?: number;
  score?: number;
  players?: number;
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
  id: string;
  user_id: string;
  activity_id: string;
  datetime: string;
  location_id?: string;
  data: GolfingLogData;
  created_at?: string;
  updated_at?: string;
}