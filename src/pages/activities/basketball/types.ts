export interface BasketballLogData {
  location_id: string;
  duration_min?: number;
  games?: number;
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
  data: BasketballLogData;
  created_at?: string;
  updated_at?: string;
}
