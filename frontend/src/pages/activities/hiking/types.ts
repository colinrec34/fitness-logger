export interface Athlete {
    id: number,
    resource_state: number
}

export interface Map {
    id: string,
    resource_state: number,
    summary_polyline: string,
}

export interface HikeLogData {
  achievement_count: number,
  athlete: Athlete,
  athlete_count: number,
  average_speed: number,
  comment_count: number,
  commute: boolean,
  display_hide_heartrate_option: boolean,
  distance: number,
  elapsed_time: number,
  end_latlng: Array<number>,
  external_id: number,
  flagged: boolean,
  from_accepted_tag: boolean,
  gear_id: number,
  has_heartrate: boolean,
  has_kudoed: boolean,
  heartrate_opt_out: boolean,
  id: number,
  kudos_count: number,
  location_city: string,
  location_country: string,
  location_state: string,
  manual: boolean,
  map: Map,
  max_speed: number,
  moving_time: number,
  name: string,
  photo_count: number,
  pr_count: number,
  private: boolean,
  sport_type: string,
  start_date: string,
  start_date_local: string,
  start_latlng: Array<number>,
  timezone: string,
  total_elevation_gain: number,
  total_photo_count: number,
  trainer: boolean,
  type: string,
  upload_id: number,
  utc_offset: number,
  visibility: string,
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
  data: HikeLogData;
  created_at?: string;
  updated_at?: string;
}