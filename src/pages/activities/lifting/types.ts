export interface SetEntry {
  reps: number;
  weight?: number; // optional for bodyweight exercises
  sets?: number; // optional, default 1 if missing
}

export interface LiftSection {
  warmup: SetEntry[];
  work: SetEntry[];
}

export interface LiftingLogData {
  squat?: LiftSection;
  bench?: LiftSection;
  overhead?: LiftSection;
  deadlift?: LiftSection;
  clean?: LiftSection;
  pullups?: { reps: number; sets?: number }[];
  notes?: string;
}

export interface LogRow {
  id: string;
  user_id: string;
  activity_id: string;
  datetime: string;
  location_id?: string | null;
  data: LiftingLogData;
  created_at?: string;
  updated_at?: string;
}

export interface LocationRow {
  id: string;
  user_id: string;
  activity_id: string;
  name: string;
  lat: number;
  lon: number;
  created_at?: string;
}
