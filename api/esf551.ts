import { createClient } from "@supabase/supabase-js";

const DEFAULT_WEIGHT_ACTIVITY_ID = "3bacbc7e-4e70-435a-8927-ccc7ff1568b7";

type MeasurementPayload = {
  device?: string;
  timestamp_iso?: string;
  timestamp_unix?: number;
  weight_lb?: number;
  weight_kg?: number;
};

type VercelRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

function getHeader(
  headers: Record<string, string | string[] | undefined>,
  name: string
) {
  const value = headers[name];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function parseBearerToken(
  headers: Record<string, string | string[] | undefined>
) {
  const auth = getHeader(headers, "authorization");
  if (!auth) return null;
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

function resolveTimestamp(payload: MeasurementPayload) {
  if (payload.timestamp_iso) {
    const parsed = new Date(payload.timestamp_iso);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  if (typeof payload.timestamp_unix === "number") {
    const parsed = new Date(payload.timestamp_unix * 1000);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date().toISOString();
}

function resolveWeightLb(payload: MeasurementPayload) {
  if (typeof payload.weight_lb === "number" && Number.isFinite(payload.weight_lb)) {
    return payload.weight_lb;
  }

  if (typeof payload.weight_kg === "number" && Number.isFinite(payload.weight_kg)) {
    return Math.round(payload.weight_kg * 2.20462 * 10) / 10;
  }

  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(204).json({});
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const expectedToken = process.env.ESF551_WEBHOOK_TOKEN;
  const providedToken = parseBearerToken(req.headers);
  if (!expectedToken || providedToken !== expectedToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const userId = process.env.ESF551_USER_ID;
  const activityId =
    process.env.ESF551_WEIGHT_ACTIVITY_ID || DEFAULT_WEIGHT_ACTIVITY_ID;

  if (!supabaseUrl || !serviceRoleKey || !userId) {
    return res.status(500).json({
      error: "Missing server configuration",
      missing: {
        supabaseUrl: !supabaseUrl,
        serviceRoleKey: !serviceRoleKey,
        userId: !userId,
      },
    });
  }

  const payload = (req.body ?? {}) as MeasurementPayload;
  if (payload.device && payload.device !== "esf-551") {
    return res.status(400).json({ error: "Unsupported device" });
  }

  const weightLb = resolveWeightLb(payload);
  if (weightLb == null) {
    return res.status(400).json({ error: "Missing weight measurement" });
  }

  const datetime = resolveTimestamp(payload);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const row = {
    user_id: userId,
    activity_id: activityId,
    datetime,
    data: {
      weight: weightLb,
    },
  };

  const { error } = await supabase
    .from("logs")
    .upsert(row, { onConflict: "activity_id,datetime" });

  if (error) {
    return res.status(500).json({
      error: "Failed to write log entry",
      details: error.message,
    });
  }

  return res.status(200).json({
    ok: true,
    datetime,
    weight_lb: weightLb,
  });
}
