export interface CourseData {
  holes?: number;
  pars?: number[]; // pars[i] = par for hole i+1, length === holes
}

export interface ShotPoint {
  lat: number;
  lon: number;
  accuracy?: number;
  club?: string;
  takenAt: string; // ISO timestamp
}

export interface HoleScore {
  hole: number;
  par?: number;
  strokes: number;
  shots?: ShotPoint[];
}

export interface GolfingLogData {
  location_id: string;
  holes?: number;
  score?: number;
  players?: number;
  notes?: string;
  holeScores?: HoleScore[];
};

export interface LocationRow {
    id: string;
    user_id: string;
    activity_id: string;
    name: string;
    lat: number;
    lon: number;
    data?: CourseData | null;
    created_at?: string;
}

export interface ActivitySettings {
  clubs?: string[];
}

export interface ActivityRow {
  id: string;
  user_id: string;
  slug: string;
  display_name: string;
  settings?: ActivitySettings | null;
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