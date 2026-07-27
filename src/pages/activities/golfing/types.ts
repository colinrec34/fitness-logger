export interface CourseData {
  holes?: number;
  pars?: number[]; // pars[i] = par for hole i+1, length === holes
}

export interface HoleScore {
  hole: number;
  par?: number;
  strokes: number;
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