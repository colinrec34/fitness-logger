// Exercises the real signup -> auth -> activity -> location -> log path
// against a running server + real Postgres. Run in CI after `prisma db push`,
// or locally against `npm run dev` + a local Postgres:
//   BASE_URL=http://localhost:3000 node scripts/smoke-test.mjs

const BASE = process.env.BASE_URL || "http://localhost:3000";

let failures = 0;

function assert(cond, msg) {
  if (cond) {
    console.log(`ok: ${msg}`);
  } else {
    failures++;
    console.error(`FAIL: ${msg}`);
  }
}

async function main() {
  const email = `smoke-${Date.now()}@example.com`;
  const password = "smoketest123";

  let res = await fetch(`${BASE}/api/health`);
  assert(res.status === 200, "GET /api/health returns 200");

  res = await fetch(`${BASE}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert(res.status === 201, "POST /api/auth/signup returns 201");
  const signup = await res.json();
  assert(!!signup.token, "signup response includes a token");
  const token = signup.token;
  const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  res = await fetch(`${BASE}/api/auth/me`, { headers: auth });
  assert(res.status === 200, "GET /api/auth/me returns 200 with a valid token");

  res = await fetch(`${BASE}/api/activities`);
  assert(res.status === 401, "GET /api/activities without a token is rejected");

  res = await fetch(`${BASE}/api/activities`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ slug: "smoke-golf", display_name: "Smoke Golf" }),
  });
  assert(res.status === 201, "POST /api/activities returns 201");
  const activity = await res.json();

  res = await fetch(`${BASE}/api/activities`, { headers: auth });
  assert(res.status === 200, "GET /api/activities returns 200");
  const activities = await res.json();
  assert(
    Array.isArray(activities) && activities.some((a) => a.id === activity.id),
    "created activity appears in the activities list"
  );

  res = await fetch(`${BASE}/api/locations`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ activity_id: activity.id, name: "Smoke Course", lat: 41.9, lon: -87.6 }),
  });
  assert(res.status === 201, "POST /api/locations returns 201");
  const location = await res.json();

  const datetime = new Date().toISOString();
  res = await fetch(`${BASE}/api/logs`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      activity_id: activity.id,
      datetime,
      location_id: location.id,
      data: { holes: 9, score: 40 },
    }),
  });
  assert(res.status === 200, "POST /api/logs (upsert) returns 200");

  res = await fetch(`${BASE}/api/logs?activity_id=${activity.id}`, { headers: auth });
  assert(res.status === 200, "GET /api/logs returns 200");
  const logs = await res.json();
  assert(Array.isArray(logs) && logs.length > 0, "created log appears in the logs list");

  if (failures > 0) {
    console.error(`\n${failures} smoke test check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll smoke tests passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
