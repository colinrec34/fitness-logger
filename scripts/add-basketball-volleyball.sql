-- Adds the basketball and volleyball activities for the main app user
-- (the one who owns the existing activities — the DB has stale extra accounts).
-- The UUIDs are fixed: they must match the hardcoded ACTIVITY_IDs in
-- src/pages/activities/basketball/* and src/pages/activities/volleyball/*.
--
-- Run on the home server:
--   docker exec -i fitness-logger-postgres-1 psql -U fitness -d fitness < scripts/add-basketball-volleyball.sql
--
-- Idempotent: re-running does nothing once the rows exist.

WITH me AS (
  SELECT user_id AS id FROM activities GROUP BY user_id ORDER BY count(*) DESC LIMIT 1
), next_row AS (
  SELECT COALESCE(MAX(placement_row), -1) + 1 AS row
  FROM activities, me
  WHERE activities.user_id = me.id
)
INSERT INTO activities (id, user_id, slug, display_name, is_active, placement_row, placement_col)
SELECT v.id::uuid, me.id, v.slug, v.display_name, true, next_row.row, v.col
FROM me, next_row,
  (VALUES
    ('f7a49b99-ab6f-4bc7-982f-ab1b9bd0b187', 'basketball', 'Basketball', 0),
    ('ff8c1476-8ec7-42e0-82fb-5c59bff6a026', 'volleyball', 'Volleyball', 1)
  ) AS v(id, slug, display_name, col)
ON CONFLICT (user_id, slug) DO NOTHING;
