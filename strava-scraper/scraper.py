#!/usr/bin/env python3
"""Strava web-session scraper for fitness-logger.

Strava's API is paywalled, but the website's own endpoints still work with a
normal logged-in browser session. This authenticates with the browser session
cookie (_strava4_session — no password stored), lists activities via the
training page's JSON endpoint, downloads GPX for new runs/hikes, and POSTs
them to fitness-logger's /api/health-export ingest in the same workout format
Health Auto Export uses. Synced activity ids persist in a state file so
restarts don't re-download history; the ingest upserts on start time, so
re-delivery is harmless anyway.

First run backfills the full activity history (oldest pages last); after
that each poll only walks pages until it hits already-seen activities.
"""

import json
import logging
import math
import os
import sys
import time
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone

import requests

BASE_URL = os.environ.get("STRAVA_BASE_URL", "https://www.strava.com").rstrip("/")
SESSION_COOKIE = os.environ.get("STRAVA_SESSION_COOKIE", "")
INGEST_URL = os.environ.get("HEALTH_EXPORT_URL", "http://app:3000/api/health-export")
INGEST_TOKEN = os.environ.get("HEALTH_EXPORT_TOKEN", "")
STATE_FILE = os.environ.get("STATE_FILE", "/state/synced.json")
INTERVAL = int(os.environ.get("SYNC_INTERVAL_SECONDS", "3600"))
REQUEST_DELAY = float(os.environ.get("REQUEST_DELAY_SECONDS", "3"))
RUN_ONCE = os.environ.get("RUN_ONCE", "") == "1"

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)
GPX_NS = {"gpx": "http://www.topografix.com/GPX/1/1"}

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("strava-scraper")


class AuthError(Exception):
    """Session cookie is missing, expired, or rejected."""


# Passed per-request: jar-level cookies with an explicit domain don't match
# every host form (e.g. localhost in tests), per-request cookies always do.
AUTH_COOKIES = {"_strava4_session": SESSION_COOKIE}


def make_session():
    s = requests.Session()
    s.headers["User-Agent"] = USER_AGENT
    return s


def load_state():
    try:
        with open(STATE_FILE) as f:
            state = json.load(f)
            return {"ids": set(state.get("ids", [])), "backfill_done": state.get("backfill_done", False)}
    except (FileNotFoundError, json.JSONDecodeError):
        return {"ids": set(), "backfill_done": False}


def save_state(state):
    os.makedirs(os.path.dirname(STATE_FILE), exist_ok=True)
    tmp = STATE_FILE + ".tmp"
    with open(tmp, "w") as f:
        json.dump({"ids": sorted(state["ids"]), "backfill_done": state["backfill_done"]}, f)
    os.replace(tmp, STATE_FILE)


def list_activities(session, page):
    r = session.get(
        f"{BASE_URL}/athlete/training_activities",
        params={"page": page, "per_page": 20},
        headers={"Accept": "application/json, text/javascript", "X-Requested-With": "XMLHttpRequest"},
        cookies=AUTH_COOKIES,
        allow_redirects=False,
    )
    if r.status_code in (301, 302, 401, 403):
        raise AuthError(f"activity list returned {r.status_code} — the _strava4_session cookie has likely expired; copy a fresh one from a logged-in browser")
    r.raise_for_status()
    try:
        return r.json().get("models", [])
    except ValueError as e:
        raise AuthError(f"activity list was not JSON (got {r.headers.get('Content-Type')}) — likely a login page") from e


def classify(strava_type):
    t = str(strava_type or "").lower()
    if "run" in t:
        return "Run"
    if "hik" in t:
        return "Hike"
    return None


def fetch_gpx(session, activity_id):
    r = session.get(f"{BASE_URL}/activities/{activity_id}/export_gpx", cookies=AUTH_COOKIES, allow_redirects=False)
    if r.status_code == 200 and r.content.lstrip()[:5] == b"<?xml":
        return r.content
    log.warning("activity %s: no GPX available (status %s)", activity_id, r.status_code)
    return None


def haversine_m(lat1, lon1, lat2, lon2):
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def parse_gpx(gpx_bytes):
    """Returns (points [(lat, lon)], start, end, distance_m, elevation_gain_m)."""
    root = ET.fromstring(gpx_bytes)
    points, elevations, times = [], [], []
    for trkpt in root.iterfind(".//gpx:trkseg/gpx:trkpt", GPX_NS):
        lat, lon = float(trkpt.get("lat")), float(trkpt.get("lon"))
        points.append((lat, lon))
        ele = trkpt.find("gpx:ele", GPX_NS)
        elevations.append(float(ele.text) if ele is not None else None)
        t = trkpt.find("gpx:time", GPX_NS)
        times.append(datetime.fromisoformat(t.text.replace("Z", "+00:00")) if t is not None else None)

    distance = sum(haversine_m(*points[i - 1], *points[i]) for i in range(1, len(points)))

    # Moving-average smoothing before summing positive deltas, otherwise GPS
    # altitude noise inflates the gain badly.
    gain = 0.0
    eles = [e for e in elevations if e is not None]
    if len(eles) > 1:
        w = 5
        smoothed = [sum(eles[max(0, i - w + 1): i + 1]) / len(eles[max(0, i - w + 1): i + 1]) for i in range(len(eles))]
        gain = sum(max(0.0, smoothed[i] - smoothed[i - 1]) for i in range(1, len(smoothed)))

    stamps = [t for t in times if t is not None]
    start = min(stamps) if stamps else None
    end = max(stamps) if stamps else None
    return points, start, end, distance, gain


def parse_iso(value):
    if not isinstance(value, str):
        return None
    try:
        # Normalize Strava's "+0000" offset for older fromisoformat parsers.
        return datetime.fromisoformat(re.sub(r"([+-]\d{2})(\d{2})$", r"\1:\2", value.replace("Z", "+00:00")))
    except ValueError:
        return None


def raw_num(model, key):
    v = model.get(key)
    return float(v) if isinstance(v, (int, float)) and math.isfinite(v) else None


def to_workout(model, kind, gpx_bytes):
    """Strava's *_raw listing fields are authoritative (they match what Strava
    displays and exist even for GPS-less activities); GPX supplies the route,
    and is the fallback for metrics if the raw fields ever disappear."""
    points, g_start, g_end, g_dist, g_gain = parse_gpx(gpx_bytes) if gpx_bytes else ([], None, None, 0.0, 0.0)

    start = parse_iso(model.get("start_time")) or g_start
    if start is None:
        return None
    elapsed = raw_num(model, "elapsed_time_raw")
    if elapsed is None and g_start is not None and g_end is not None:
        elapsed = (g_end - g_start).total_seconds()
    end = start + timedelta(seconds=elapsed) if elapsed else (g_end or start)
    duration = raw_num(model, "moving_time_raw") or elapsed or 0

    distance = raw_num(model, "distance_raw")
    gain = raw_num(model, "elevation_gain_raw")
    return {
        "id": f"strava-{model['id']}",
        "name": model.get("name") or kind,
        "type": kind,
        "start": start.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S +0000"),
        "end": end.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S +0000"),
        "duration": duration,
        "distance": {"qty": round(distance if distance is not None else g_dist, 1), "units": "m"},
        "elevationUp": {"qty": round(gain if gain is not None else g_gain, 1), "units": "m"},
        "route": [{"lat": lat, "lon": lon} for lat, lon in points],
    }


def post_workout(workout):
    r = requests.post(
        INGEST_URL,
        json={"data": {"workouts": [workout]}},
        headers={"Authorization": f"Bearer {INGEST_TOKEN}"},
        timeout=120,
    )
    r.raise_for_status()
    return r.json()


def sync(session, state):
    page, imported = 1, 0
    while True:
        models = list_activities(session, page)
        if not models:
            if not state["backfill_done"]:
                state["backfill_done"] = True
                save_state(state)
                log.info("backfill complete (%d activities tracked)", len(state["ids"]))
            break

        new = [m for m in models if "id" in m and str(m["id"]) not in state["ids"]]
        for model in new:
            aid = str(model["id"])
            kind = classify(model.get("sport_type") or model.get("type") or model.get("display_type"))
            if kind is None:
                log.info("activity %s (%s): skipping type %r", aid, model.get("name"), model.get("sport_type") or model.get("display_type"))
                state["ids"].add(aid)
                save_state(state)
                continue

            gpx = None
            if model.get("has_latlng") is not False:
                time.sleep(REQUEST_DELAY)
                gpx = fetch_gpx(session, aid)
            workout = to_workout(model, kind, gpx)
            if workout is None:
                log.warning("activity %s (%s): no start time in listing or GPX, skipping", aid, model.get("name"))
                state["ids"].add(aid)
                save_state(state)
                continue

            result = post_workout(workout)
            log.info("activity %s (%s, %s): ingest %s", aid, workout["name"], kind, result.get("results", [{}])[0].get("status"))
            imported += 1
            state["ids"].add(aid)
            save_state(state)

        # After backfill, stop as soon as a page contains anything already seen.
        if state["backfill_done"] and len(new) < len(models):
            break
        page += 1
        time.sleep(REQUEST_DELAY)
    return imported


def main():
    missing = [k for k, v in {"STRAVA_SESSION_COOKIE": SESSION_COOKIE, "HEALTH_EXPORT_TOKEN": INGEST_TOKEN}.items() if not v]
    if missing:
        log.error("missing required env vars: %s", ", ".join(missing))
        sys.exit(1)

    state = load_state()
    log.info("starting: %d activities tracked, backfill_done=%s, polling every %ds", len(state["ids"]), state["backfill_done"], INTERVAL)
    while True:
        try:
            imported = sync(make_session(), state)
            log.info("sync finished: %d imported", imported)
        except AuthError as e:
            log.error("auth failure: %s", e)
        except requests.RequestException as e:
            log.error("sync failed: %s", e)
        if RUN_ONCE:
            break
        time.sleep(INTERVAL)


if __name__ == "__main__":
    main()
