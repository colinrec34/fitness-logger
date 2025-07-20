export interface SnorkelingLogData {
  location_id: string;
  duration?: number;
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
  data: SnorkelingLogData;
  created_at?: string;
  updated_at?: string;
}