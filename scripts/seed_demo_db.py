#!/usr/bin/env python3
"""Build the sample Damn Parking database used on the living portal.

The Sprint 2 estimate counts two internal data groups: lot information and
timestamped occupancy history. This script fills both with fabricated records
so a reviewer can inspect the data component. Nothing here is a live camera
feed or an official parking inventory.

Regenerate both artifacts from the repo root:

    python3 scripts/seed_demo_db.py
"""

from __future__ import annotations

import json
import math
import sqlite3
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "data" / "damn-parking.sqlite"
JSON_PATH = ROOT / "data" / "demo-db.json"

OFFSET = timezone(timedelta(hours=-6))  # El Paso, MDT, October 2026
WINDOW_START = date(2026, 10, 20)
WINDOW_DAYS = 5
DAY_START_MIN = 7 * 60
DAY_END_MIN = 19 * 60
STEP_MIN = 30

LOTS = [
    {
        "lot_id": "SBG",
        "name": "Sun Bowl Garage",
        "kind": "garage",
        "address": "Sample point near Sun Bowl Dr, El Paso, TX",
        "latitude": 31.7731,
        "longitude": -106.5072,
        "stall_capacity": 820,
        "permit_type": "commuter",
        "rate_note": "Sample permit garage. Not a published rate.",
        "walk_minutes": 8,
    },
    {
        "lot_id": "SCH",
        "name": "Schuster Garage",
        "kind": "garage",
        "address": "Sample point near Schuster Ave, El Paso, TX",
        "latitude": 31.7689,
        "longitude": -106.5018,
        "stall_capacity": 610,
        "permit_type": "commuter",
        "rate_note": "Sample permit garage. Not a published rate.",
        "walk_minutes": 6,
    },
    {
        "lot_id": "UNE",
        "name": "Union East Lot",
        "kind": "surface",
        "address": "Sample point near the Union, El Paso, TX",
        "latitude": 31.7716,
        "longitude": -106.5034,
        "stall_capacity": 180,
        "permit_type": "mixed",
        "rate_note": "Sample surface lot. Not a published rate.",
        "walk_minutes": 3,
    },
    {
        "lot_id": "MGY",
        "name": "Memorial Gym Lot",
        "kind": "surface",
        "address": "Sample point near Memorial Gym, El Paso, TX",
        "latitude": 31.7752,
        "longitude": -106.5051,
        "stall_capacity": 140,
        "permit_type": "commuter",
        "rate_note": "Sample surface lot. Not a published rate.",
        "walk_minutes": 9,
    },
    {
        "lot_id": "ORG",
        "name": "Oregon Street Lot",
        "kind": "surface",
        "address": "Sample point near Oregon St, El Paso, TX",
        "latitude": 31.7694,
        "longitude": -106.5046,
        "stall_capacity": 96,
        "permit_type": "visitor",
        "rate_note": "Sample visitor lot. Not a published rate.",
        "walk_minutes": 7,
    },
    {
        "lot_id": "GLR",
        "name": "Glory Road Lot",
        "kind": "surface",
        "address": "Sample point near Glory Rd, El Paso, TX",
        "latitude": 31.7768,
        "longitude": -106.5084,
        "stall_capacity": 210,
        "permit_type": "commuter",
        "rate_note": "Sample surface lot. Not a published rate.",
        "walk_minutes": 12,
    },
    {
        "lot_id": "HAW",
        "name": "Hawthorne Lot",
        "kind": "surface",
        "address": "Sample point near Hawthorne St, El Paso, TX",
        "latitude": 31.7672,
        "longitude": -106.5061,
        "stall_capacity": 160,
        "permit_type": "resident",
        "rate_note": "Sample resident lot. Not a published rate.",
        "walk_minutes": 11,
    },
    {
        "lot_id": "MES",
        "name": "Mesa Street Lot",
        "kind": "street",
        "address": "Sample curb spaces along Mesa St, El Paso, TX",
        "latitude": 31.7708,
        "longitude": -106.5009,
        "stall_capacity": 42,
        "permit_type": "visitor",
        "rate_note": "Sample street spaces. Not a published rate.",
        "walk_minutes": 5,
    },
]

META = {
    "title": "Damn Parking sample database",
    "purpose": (
        "Fabricated lot information and occupancy history for the living portal "
        "data component. Reviewers can inspect stored records without a live feed."
    ),
    "course": "UTEP CS 4390 / 5388",
    "team": "Team 1",
    "project": "Damn Parking",
    "is_live": "false",
    "is_official_inventory": "false",
    "source": "sample_camera_feed",
    "timezone": "America/Denver (MDT, UTC-6 in this window)",
    "window_start": "2026-10-20T07:00:00-06:00",
    "window_end": "2026-10-24T19:00:00-06:00",
    "ilf_lot_information": "lots",
    "ilf_occupancy_history": "occupancy_observations",
    "generator": "scripts/seed_demo_db.py",
}


def occupancy_ratio(kind: str, day_index: int, minute: int, lot_index: int) -> float:
    hour = minute / 60
    if hour <= 11.5:
        t = (hour - 7) / 4.5
    else:
        t = (19 - hour) / 7.5
    t = max(0.0, min(1.0, t))
    curve = t * t * (3 - 2 * t)
    floor = 0.36 if kind == "garage" else 0.28
    ceiling = {"garage": 0.93, "surface": 0.86, "street": 0.74}[kind]
    ratio = floor + (ceiling - floor) * curve
    if day_index == 4:
        ratio -= 0.06
    wobble = ((lot_index * 3 + day_index * 5 + minute // 30) % 5 - 2) * 0.008
    return max(0.05, min(0.98, ratio))


def confidence_for(lot_index: int, minute: int) -> float:
    return round(0.84 + ((lot_index * 2 + minute // 30) % 10) * 0.012, 3)


def camera_rows() -> list[dict]:
    per_kind = {"garage": 3, "surface": 2, "street": 1}
    facings = ("north rows", "south rows", "center aisle", "east curb")
    rows = []
    for lot in LOTS:
        count = per_kind[lot["kind"]]
        for index in range(1, count + 1):
            rows.append(
                {
                    "camera_id": f"{lot['lot_id']}-C{index}",
                    "lot_id": lot["lot_id"],
                    "label": f"{lot['name']} camera {index}",
                    "covers": facings[index - 1],
                    "status": "sample",
                }
            )
    return rows


def observation_rows() -> list[dict]:
    rows = []
    observation_id = 1
    for day_index in range(WINDOW_DAYS):
        day = WINDOW_START + timedelta(days=day_index)
        minute = DAY_START_MIN
        while minute <= DAY_END_MIN:
            stamp = datetime(
                day.year,
                day.month,
                day.day,
                minute // 60,
                minute % 60,
                tzinfo=OFFSET,
            ).isoformat()
            for lot_index, lot in enumerate(LOTS):
                capacity = lot["stall_capacity"]
                occupied = int(round(capacity * occupancy_ratio(lot["kind"], day_index, minute, lot_index)))
                occupied = max(0, min(capacity, occupied))
                rows.append(
                    {
                        "observation_id": observation_id,
                        "lot_id": lot["lot_id"],
                        "observed_at": stamp,
                        "occupied_stalls": occupied,
                        "open_stalls": capacity - occupied,
                        "source": "sample_camera_feed",
                        "confidence": confidence_for(lot_index, minute),
                        "is_sample": 1,
                    }
                )
                observation_id += 1
            minute += STEP_MIN
    return rows


def assert_consistent(lots: list[dict], observations: list[dict], cameras: list[dict]) -> None:
    capacity = {lot["lot_id"]: lot["stall_capacity"] for lot in lots}
    lot_ids = set(capacity)
    if len(lot_ids) != len(lots):
        raise SystemExit("duplicate lot ids")
    if not observations:
        raise SystemExit("no observations generated")
    seen_cameras = set()
    for camera in cameras:
        if camera["lot_id"] not in lot_ids:
            raise SystemExit(f"camera {camera['camera_id']} has unknown lot")
        if camera["camera_id"] in seen_cameras:
            raise SystemExit(f"duplicate camera {camera['camera_id']}")
        seen_cameras.add(camera["camera_id"])
    for row in observations:
        if row["lot_id"] not in lot_ids:
            raise SystemExit(f"observation {row['observation_id']} has unknown lot")
        if row["occupied_stalls"] + row["open_stalls"] != capacity[row["lot_id"]]:
            raise SystemExit(f"observation {row['observation_id']} does not match capacity")
        if row["is_sample"] != 1 or row["source"] != "sample_camera_feed":
            raise SystemExit(f"observation {row['observation_id']} is not marked sample")
        if not 0 <= row["confidence"] <= 1:
            raise SystemExit(f"observation {row['observation_id']} has a bad confidence")
    if math.isclose(observations[0]["confidence"], 0):
        raise SystemExit("confidence collapsed to zero")


SCHEMA = """
PRAGMA foreign_keys = ON;

CREATE TABLE dataset_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE lots (
    lot_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('garage', 'surface', 'street')),
    address TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    stall_capacity INTEGER NOT NULL CHECK (stall_capacity > 0),
    permit_type TEXT NOT NULL,
    rate_note TEXT NOT NULL,
    walk_minutes INTEGER NOT NULL CHECK (walk_minutes >= 0)
);

CREATE TABLE cameras (
    camera_id TEXT PRIMARY KEY,
    lot_id TEXT NOT NULL REFERENCES lots(lot_id),
    label TEXT NOT NULL,
    covers TEXT NOT NULL,
    status TEXT NOT NULL
);

CREATE TABLE occupancy_observations (
    observation_id INTEGER PRIMARY KEY,
    lot_id TEXT NOT NULL REFERENCES lots(lot_id),
    observed_at TEXT NOT NULL,
    occupied_stalls INTEGER NOT NULL CHECK (occupied_stalls >= 0),
    open_stalls INTEGER NOT NULL CHECK (open_stalls >= 0),
    source TEXT NOT NULL,
    confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    is_sample INTEGER NOT NULL CHECK (is_sample = 1)
);

CREATE INDEX idx_observations_lot_time
    ON occupancy_observations (lot_id, observed_at);

CREATE VIEW latest_occupancy AS
SELECT
    l.lot_id,
    l.name,
    l.kind,
    l.stall_capacity,
    o.observed_at,
    o.occupied_stalls,
    o.open_stalls,
    o.confidence,
    o.source
FROM lots AS l
JOIN occupancy_observations AS o ON o.lot_id = l.lot_id
WHERE o.observed_at = (
    SELECT MAX(o2.observed_at)
    FROM occupancy_observations AS o2
    WHERE o2.lot_id = l.lot_id
);
"""


def write_sqlite(lots: list[dict], cameras: list[dict], observations: list[dict]) -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    if DB_PATH.exists():
        DB_PATH.unlink()
    with sqlite3.connect(DB_PATH) as conn:
        conn.executescript(SCHEMA)
        conn.executemany(
            "INSERT INTO dataset_meta (key, value) VALUES (?, ?)",
            list(META.items()),
        )
        conn.executemany(
            """
            INSERT INTO lots (
                lot_id, name, kind, address, latitude, longitude,
                stall_capacity, permit_type, rate_note, walk_minutes
            ) VALUES (
                :lot_id, :name, :kind, :address, :latitude, :longitude,
                :stall_capacity, :permit_type, :rate_note, :walk_minutes
            )
            """,
            lots,
        )
        conn.executemany(
            """
            INSERT INTO cameras (camera_id, lot_id, label, covers, status)
            VALUES (:camera_id, :lot_id, :label, :covers, :status)
            """,
            cameras,
        )
        conn.executemany(
            """
            INSERT INTO occupancy_observations (
                observation_id, lot_id, observed_at, occupied_stalls, open_stalls,
                source, confidence, is_sample
            ) VALUES (
                :observation_id, :lot_id, :observed_at, :occupied_stalls, :open_stalls,
                :source, :confidence, :is_sample
            )
            """,
            observations,
        )
        conn.commit()
        latest = conn.execute("SELECT COUNT(*) FROM latest_occupancy").fetchone()[0]
        if latest != len(lots):
            raise SystemExit(f"latest_occupancy returned {latest} rows, expected {len(lots)}")


def write_json(lots: list[dict], cameras: list[dict], observations: list[dict]) -> None:
    payload = {
        "meta": META,
        "lots": lots,
        "cameras": cameras,
        "observations": observations,
    }
    JSON_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    cameras = camera_rows()
    observations = observation_rows()
    assert_consistent(LOTS, observations, cameras)
    write_sqlite(LOTS, cameras, observations)
    write_json(LOTS, cameras, observations)
    print(f"lots: {len(LOTS)}")
    print(f"cameras: {len(cameras)}")
    print(f"observations: {len(observations)}")
    print(f"sqlite: {DB_PATH.relative_to(ROOT)}")
    print(f"json: {JSON_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
