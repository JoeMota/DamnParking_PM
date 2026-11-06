#!/usr/bin/env python3
"""Build a 1:1 UTEP campus mesh from OpenStreetMap parking, roads, and buildings.

The outlines are the same real streets and lots visible on Google Maps.
OpenStreetMap supplies the coordinates. Sample Damn Parking capacities are
joined onto the matching garage or lot when the names line up.
"""
import json
import math
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "data" / "utep-campus.json"
CACHE = Path("/tmp/utep-osm")
BBOX = (31.7645, -106.5135, 31.7805, -106.4975)
ORIGIN_LAT = 31.7722
ORIGIN_LON = -106.5054
M_PER_LAT = 110540.0
M_PER_LON = 111320.0 * math.cos(math.radians(ORIGIN_LAT))

ROAD_WIDTH = {
    "motorway": 16,
    "trunk": 14,
    "primary": 13,
    "secondary": 11,
    "tertiary": 9,
    "unclassified": 7.5,
    "residential": 7.5,
    "service": 4.2,
}
BUILDING_HEIGHT = {
    "stadium": 28,
    "university": 16,
    "apartments": 18,
    "residential": 12,
    "hotel": 20,
    "hospital": 16,
    "retail": 8,
    "commercial": 10,
    "parking": 12,
    "roof": 4,
    "tank": 8,
}

# Sample database lots, matched onto the real named outline.
SAMPLE_LOTS = {
    "SBG": {"name": "Sun Bowl Garage", "capacity": 820, "open": 574, "match": "sun bowl parking garage"},
    "SCH": {"name": "Schuster Garage", "capacity": 610, "open": 427, "match": "schuster parking garage"},
    "GLR": {"name": "Glory Road Lot", "capacity": 210, "open": 164, "match": "glory road lot"},
    "UNE": {"name": "Union East Lot", "capacity": 180, "open": 140, "match": "university lot"},
    "ORG": {"name": "Oregon Street Lot", "capacity": 96, "open": 75, "match": "oregon"},
    "HAW": {"name": "Hawthorne Lot", "capacity": 160, "open": 125, "match": "hawthorne"},
    "MGY": {"name": "Memorial Gym Lot", "capacity": 140, "open": 109, "match": "memorial"},
    "MES": {"name": "Mesa Street Lot", "capacity": 42, "open": 33, "match": "mesa"},
}


def to_xz(lat, lon):
    x = (lon - ORIGIN_LON) * M_PER_LON
    z = (lat - ORIGIN_LAT) * M_PER_LAT
    return [round(x, 1), round(z, 1)]


def hypot(dx, dz):
    return math.hypot(dx, dz)


def simplify(points, epsilon):
    if len(points) < 3:
        return points

    def dp(seq):
        if len(seq) < 3:
            return seq
        ax, az = seq[0]
        bx, bz = seq[-1]
        abx, abz = bx - ax, bz - az
        ab2 = abx * abx + abz * abz
        worst = -1
        index = 0
        for i in range(1, len(seq) - 1):
            px, pz = seq[i]
            if ab2 == 0:
                dist = hypot(px - ax, pz - az)
            else:
                t = ((px - ax) * abx + (pz - az) * abz) / ab2
                t = max(0.0, min(1.0, t))
                dist = hypot(px - (ax + abx * t), pz - (az + abz * t))
            if dist > worst:
                worst = dist
                index = i
        if worst <= epsilon:
            return [seq[0], seq[-1]]
        return dp(seq[: index + 1])[:-1] + dp(seq[index:])

    return dp(points)


def clean_ring(coords, epsilon):
    pts = [to_xz(p["lat"], p["lon"]) for p in coords]
    deduped = []
    for pt in pts:
        if not deduped or hypot(pt[0] - deduped[-1][0], pt[1] - deduped[-1][1]) > 0.4:
            deduped.append(pt)
    if len(deduped) > 2 and hypot(deduped[0][0] - deduped[-1][0], deduped[0][1] - deduped[-1][1]) < 1:
        deduped.pop()
    return simplify(deduped, epsilon)


def clean_line(coords, epsilon):
    pts = [to_xz(p["lat"], p["lon"]) for p in coords]
    deduped = []
    for pt in pts:
        if not deduped or hypot(pt[0] - deduped[-1][0], pt[1] - deduped[-1][1]) > 0.8:
            deduped.append(pt)
    return simplify(deduped, epsilon)


def ring_area(pts):
    area = 0.0
    for i, (x, z) in enumerate(pts):
        nx, nz = pts[(i + 1) % len(pts)]
        area += x * nz - nx * z
    return abs(area) * 0.5


def centroid(pts):
    return [round(sum(p[0] for p in pts) / len(pts), 1), round(sum(p[1] for p in pts) / len(pts), 1)]


def download(name, query):
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f"{name}.json"
    if path.exists() and path.stat().st_size > 1000:
        return json.loads(path.read_text())
    url = "https://overpass-api.de/api/interpreter?" + urllib.parse.urlencode({"data": query})
    req = urllib.request.Request(url, headers={"User-Agent": "DamnParkingCampus/1.0 (educational)", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read().decode())
    path.write_text(json.dumps(data))
    return data


def load_sources():
    south, west, north, east = BBOX
    box = f"({south},{west},{north},{east})"
    parking = download("parking", f'[out:json][timeout:50];(way["amenity"="parking"]{box};);out geom;')
    roads = download(
        "roads",
        '[out:json][timeout:60];(way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|service)$"]'
        + box
        + ";);out geom;",
    )
    buildings = download(
        "buildings",
        f'[out:json][timeout:70];(way["building"]{box};way["leisure"="stadium"]{box};);out geom;',
    )
    return parking, roads, buildings


def estimate_capacity(area, kind):
    stalls = max(8, int(round(area / 28)))
    if kind == "garage":
        stalls *= 4
    return stalls


def match_sample(name):
    lowered = name.lower()
    for lot_id, sample in SAMPLE_LOTS.items():
        if sample["match"] in lowered:
            return lot_id, sample
    return None, None


def main():
    parking, roads, buildings = load_sources()
    road_out = []
    street_labels = {}
    for el in roads["elements"]:
        tags = el.get("tags") or {}
        kind = tags.get("highway")
        width = ROAD_WIDTH.get(kind)
        if not width:
            continue
        pts = clean_line(el.get("geometry") or [], 1.4 if kind == "service" else 2.0)
        if len(pts) < 2:
            continue
        road_out.append({"w": width, "p": pts})
        name = tags.get("name")
        if name and kind in {"primary", "secondary", "tertiary", "residential"}:
            length = sum(hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(pts, pts[1:]))
            current = street_labels.get(name)
            if not current or length > current["length"]:
                mid = pts[len(pts) // 2]
                street_labels[name] = {"name": name, "x": mid[0], "z": mid[1], "length": length}

    building_out = []
    for el in buildings["elements"]:
        tags = el.get("tags") or {}
        kind = tags.get("building") or ("stadium" if tags.get("leisure") == "stadium" else "yes")
        pts = clean_ring(el.get("geometry") or [], 1.1)
        if len(pts) < 3:
            continue
        area = ring_area(pts)
        if area < 30:
            continue
        height = BUILDING_HEIGHT.get(kind, 11)
        if tags.get("leisure") == "stadium":
            height = 28
        building_out.append({"h": height, "p": pts})

    used_samples = set()
    lot_out = []
    for el in parking["elements"]:
        tags = el.get("tags") or {}
        pts = clean_ring(el.get("geometry") or [], 0.9)
        if len(pts) < 3:
            continue
        area = ring_area(pts)
        if area < 80:
            continue
        name = (tags.get("name") or "").strip()
        kind = "garage" if tags.get("parking") == "multi-storey" or "garage" in name.lower() else "surface"
        sample_id, sample = match_sample(name) if name else (None, None)
        if sample_id in used_samples:
            sample_id, sample = None, None
        if sample_id:
            used_samples.add(sample_id)
        capacity = sample["capacity"] if sample else estimate_capacity(area, kind)
        open_stalls = sample["open"] if sample else max(1, capacity - max(4, capacity // 7))
        center = centroid(pts)
        lot_out.append({
            "name": name or "Parking",
            "kind": kind,
            "sampleId": sample_id,
            "capacity": capacity,
            "open": open_stalls,
            "area": round(area),
            "c": center,
            "p": pts,
        })

    target = next((lot for lot in lot_out if lot.get("sampleId") == "SBG"), None)
    if target is None:
        named = [lot for lot in lot_out if "sun bowl" in lot["name"].lower() and lot["kind"] == "garage"]
        target = named[0] if named else max(lot_out, key=lambda lot: lot["area"])

    def contains(x, z, pts):
        hit = False
        for i, (xi, zi) in enumerate(pts):
            xj, zj = pts[i - 1]
            if (zi > z) != (zj > z) and x < (xj - xi) * (z - zi) / (zj - zi) + xi:
                hit = not hit
        return hit

    spawn_z = min(p[1] for p in target["p"]) - 18
    spawn = {"x": round(target["c"][0], 1), "z": round(spawn_z, 1), "yaw": 0}
    while contains(spawn["x"], spawn["z"], target["p"]):
        spawn["z"] = round(spawn["z"] - 4, 1)

    payload = {
        "source": "OpenStreetMap",
        "copyright": "© OpenStreetMap contributors",
        "note": "Real UTEP streets, buildings, and parking outlines at 1 meter = 1 meter. The same places shown on Google Maps. Eight lots keep the sample Damn Parking capacities.",
        "origin": {"lat": ORIGIN_LAT, "lon": ORIGIN_LON},
        "spawn": spawn,
        "targetName": target["name"],
        "roads": road_out,
        "streets": [{"name": item["name"], "x": item["x"], "z": item["z"]} for item in street_labels.values()],
        "buildings": building_out,
        "lots": lot_out,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, separators=(",", ":")))
    print(f"wrote {OUT} roads={len(road_out)} buildings={len(building_out)} lots={len(lot_out)} bytes={OUT.stat().st_size}")
    print("target", target["name"], "samples", sorted(used_samples))


if __name__ == "__main__":
    main()
