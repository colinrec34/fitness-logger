export interface WeightLogData {
    weight: number;
}

export interface LogRow {
  id: number;
  user_id: string;
  activity_id: string;
  datetime: string;
  location_id?: number;
  data: WeightLogData;
  created_at?: string;
  updated_at?: string;
}