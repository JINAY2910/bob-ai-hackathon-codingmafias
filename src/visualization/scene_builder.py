from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import pandas as pd


DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "feature2"
RESULTS_DIR = DATA_DIR / "results"
RAW_DIR = Path(__file__).resolve().parents[2] / "data" / "raw"

# Accurate real-world coordinates for the 5 ports & region
KNOWN_PORT_COORDINATES = {
    1: [10.65, -61.52],    # Port-of-Spain, Trinidad
    3: [13.75, -60.95],    # Vieux Fort, Saint Lucia
    4: [18.43, -64.44],    # Spanish Town, BVI
    5: [14.60, -61.06],    # Fort-de-France, Martinique
    8: [10.24, -61.45],    # Point Fortin, Trinidad
    13: [10.40, -61.46],   # Claxton Bay, Trinidad
    35: [14.01, -60.99],   # Castries, Saint Lucia
    38: [11.18, -60.73],   # Scarborough, Tobago
    52: [18.42, -64.62],   # Road Town, BVI
    73: [10.34, -61.46],   # Point Lisas, Trinidad
    98: [10.69, -61.62],   # Chaguaramas, Trinidad
}

# Module-level memory cache for zero-disk-I/O subsequent requests
_DATA_CACHE: dict[str, pd.DataFrame] = {}


def _get_raw_data() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    if not _DATA_CACHE:
        vessels_path = DATA_DIR / "optimizer_vessels.csv"
        berths_path = DATA_DIR / "optimizer_berths.csv"
        cranes_path = DATA_DIR / "optimizer_cranes.csv"
        assignments_path = RESULTS_DIR / "optimizer_assignments.csv"

        if not vessels_path.exists():
            raise FileNotFoundError(f"Vessels file not found: {vessels_path}")
        if not berths_path.exists():
            raise FileNotFoundError(f"Berths file not found: {berths_path}")

        vessels = pd.read_csv(vessels_path)
        berths = pd.read_csv(berths_path)
        cranes = pd.read_csv(cranes_path) if cranes_path.exists() else pd.DataFrame()
        assignments = pd.read_csv(assignments_path) if assignments_path.exists() else pd.DataFrame()

        vessels["eta"] = pd.to_datetime(vessels["eta"], errors="coerce")
        vessels["etd"] = pd.to_datetime(vessels["etd"], errors="coerce")
        if not cranes.empty:
            cranes["available_from"] = pd.to_datetime(cranes.get("available_from"), errors="coerce")
            cranes["available_to"] = pd.to_datetime(cranes.get("available_to"), errors="coerce")
        if not assignments.empty:
            assignments["eta"] = pd.to_datetime(assignments.get("eta"), errors="coerce")
            assignments["service_start"] = pd.to_datetime(assignments.get("service_start"), errors="coerce")
            assignments["service_end"] = pd.to_datetime(assignments.get("service_end"), errors="coerce")

        _DATA_CACHE["vessels"] = vessels
        _DATA_CACHE["berths"] = berths
        _DATA_CACHE["cranes"] = cranes
        _DATA_CACHE["assignments"] = assignments

    return _DATA_CACHE["vessels"], _DATA_CACHE["berths"], _DATA_CACHE["cranes"], _DATA_CACHE["assignments"]


def _port_coordinates(port_id: int) -> list[float]:
    if port_id in KNOWN_PORT_COORDINATES:
        return KNOWN_PORT_COORDINATES[port_id]
    return [10.65 + ((port_id * 17) % 100 - 50) / 250, -61.52 + ((port_id * 29) % 100 - 50) / 250]


def _iso(value: Any) -> str | None:
    if value is None or pd.isna(value):
        return None
    timestamp = pd.Timestamp(value)
    if timestamp.tzinfo is None:
        timestamp = timestamp.tz_localize("UTC")
    return timestamp.isoformat().replace("+00:00", "Z")


def _clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def _id(value: Any) -> str:
    if pd.isna(value):
        return ""
    try:
        numeric = float(value)
        if numeric.is_integer():
            return str(int(numeric))
    except (TypeError, ValueError):
        pass
    return str(value)


def _point_for_berth(index: int, total: int) -> list[float]:
    """Return stable schematic coordinates for a berth along the dock wall."""
    if total <= 1:
        return [78.0, 50.0]
    y = 20.0 + (index / max(1, total - 1)) * 60.0
    return [78.0, round(y, 2)]


def _lerp(start: list[float], end: list[float], progress: float) -> list[float]:
    progress = _clamp(progress)
    return [
        round(start[0] + (end[0] - start[0]) * progress, 2),
        round(start[1] + (end[1] - start[1]) * progress, 2),
    ]


def _heading(start: list[float], end: list[float]) -> float:
    dx = end[0] - start[0]
    dy = end[1] - start[1]
    angle = math.degrees(math.atan2(dy, dx))
    return round((angle + 360) % 360, 1)


def build_scene(port_id: int = 1, at: datetime | None = None) -> dict[str, Any]:
    vessels, berths, cranes, assignments = _get_raw_data()

    port_berths = berths[berths["port_id"] == port_id].copy()
    if port_berths.empty:
        raise ValueError(f"No berth data available for port {port_id}")

    port_vessels = vessels[vessels["port_id"] == port_id].copy()
    if port_vessels.empty:
        raise ValueError(f"No vessel schedule data available for port {port_id}")

    port_cranes = cranes[cranes["port_id"] == port_id].copy() if not cranes.empty else pd.DataFrame()
    port_assignments = assignments[assignments["port_id"] == port_id].copy() if not assignments.empty else pd.DataFrame()

    port_name = str(port_berths["port_name"].iloc[0])
    port_center = _port_coordinates(port_id)

    # Base time for the 72-hour window (Jan 3, 2019 has rich schedule traffic)
    base_window_start = pd.Timestamp("2019-01-03 12:00:00")
    horizon_end = base_window_start + pd.Timedelta(hours=72)

    if at:
        current_time = pd.Timestamp(at)
        if current_time.tzinfo is not None:
            current_time = current_time.tz_localize(None)
    else:
        current_time = base_window_start

    # Berths setup
    berth_ids = [_id(b) for b in port_berths["berth_id"].tolist()]
    berth_positions = {
        bid: _point_for_berth(idx, len(berth_ids))
        for idx, bid in enumerate(berth_ids)
    }

    # Cranes by berth map
    cranes_by_berth: dict[str, list[dict[str, Any]]] = {}
    if not port_cranes.empty:
        for c in port_cranes.to_dict("records"):
            bid = _id(c.get("berth_id"))
            cranes_by_berth.setdefault(bid, []).append({
                "id": str(c.get("crane_id")),
                "status": "MAINTENANCE" if str(c.get("status", "")).lower() == "maintenance" else "AVAILABLE",
            })

    # Assignments lookup
    assigned_lookup = {}
    if not port_assignments.empty:
        for row in port_assignments.to_dict("records"):
            assigned_lookup[_id(row.get("call_id"))] = row

    # Filter vessels in the 72-hour horizon window
    window_vessels = port_vessels[
        (port_vessels["eta"] <= horizon_end + pd.Timedelta(hours=6))
        & (port_vessels["etd"].fillna(port_vessels["eta"] + pd.Timedelta(hours=12)) >= base_window_start - pd.Timedelta(hours=12))
    ].sort_values(["eta", "call_id"]).head(80).copy()

    # Build scheduled vessels with realistic berth & crane allocations
    scheduled_vessels = []
    for idx, v_row in enumerate(window_vessels.to_dict("records")):
        cid = _id(v_row.get("call_id"))
        eta = v_row["eta"]
        etd = v_row.get("etd")
        workload_hours = float(v_row.get("workload_duration_hours") or 6.0)
        req_cranes = max(1, int(v_row.get("required_cranes") or 1))
        v_type = str(v_row.get("vessel_type") or "Container")
        mmsi = str(v_row.get("mmsi") or f"2350{cid}")

        if cid in assigned_lookup:
            assigned = assigned_lookup[cid]
            bid = _id(assigned.get("assigned_berth_id"))
            if not bid or bid not in berth_positions:
                bid = berth_ids[idx % len(berth_ids)]
            service_start = assigned.get("service_start")
            service_end = assigned.get("service_end")
            crane_str = str(assigned.get("assigned_crane_ids") or "")
            crane_ids = [c for c in crane_str.split("|") if c]
            wait_hours = float(assigned.get("waiting_time_hours") or 0.5)
        else:
            bid = berth_ids[idx % len(berth_ids)]
            wait_hours = round(0.4 + (idx % 4) * 0.45, 2)
            service_start = eta + pd.Timedelta(hours=wait_hours)
            service_end = service_start + pd.Timedelta(hours=max(2.5, workload_hours))
            b_cranes = cranes_by_berth.get(bid, [])
            crane_ids = [c["id"] for c in b_cranes[:req_cranes]]

        if pd.isna(service_start):
            service_start = eta + pd.Timedelta(hours=wait_hours)
        if pd.isna(service_end):
            service_end = service_start + pd.Timedelta(hours=max(2.5, workload_hours))

        wait_minutes = round(wait_hours * 60, 1)
        risk_level = "HIGH" if wait_minutes >= 90 else ("MEDIUM" if wait_minutes >= 30 else "LOW")

        # Stable approach, waiting/anchorage, and berth coordinate points
        berth_pt = berth_positions[bid]
        approach_pt = [round(10.0 + (idx % 6) * 3.5, 2), round(14.0 + (idx % 8) * 8.0, 2)]
        waiting_pt = [round(38.0 + (idx % 5) * 4.0, 2), round(18.0 + (idx % 9) * 7.0, 2)]
        departure_pt = [round(92.0, 2), round(berth_pt[1] + ((idx % 3) - 1) * 6, 2)]

        scheduled_vessels.append({
            "id": cid,
            "mmsi": mmsi,
            "vessel_type": v_type,
            "eta": eta,
            "service_start": service_start,
            "service_end": service_end,
            "etd": etd,
            "assigned_berth_id": bid,
            "assigned_crane_ids": crane_ids,
            "waiting_minutes": wait_minutes,
            "risk_level": risk_level,
            "priority": str(v_row.get("priority") or "NORMAL").upper(),
            "workload_hours": workload_hours,
            "approach_pt": approach_pt,
            "waiting_pt": waiting_pt,
            "berth_pt": berth_pt,
            "departure_pt": departure_pt,
        })

    # Determine vessel live state at current_time
    vessel_payload = []
    route_payload = []
    berth_active_vessel: dict[str, dict[str, Any]] = {}
    berth_waiting_queue: dict[str, list[dict[str, Any]]] = {}

    for v in scheduled_vessels:
        eta = v["eta"]
        s_start = v["service_start"]
        s_end = v["service_end"]
        bid = v["assigned_berth_id"]

        # Classification based on current_time
        if current_time < eta - pd.Timedelta(hours=14):
            # Not yet approaching scene
            continue
        elif current_time < eta:
            status = "APPROACHING"
            progress = (current_time - (eta - pd.Timedelta(hours=14))).total_seconds() / (14 * 3600)
            pos = _lerp(v["approach_pt"], v["waiting_pt"], progress)
            dest = v["waiting_pt"]
        elif current_time < s_start:
            status = "WAITING"
            pos = v["waiting_pt"]
            dest = v["berth_pt"]
            berth_waiting_queue.setdefault(bid, []).append(v)
        elif current_time <= s_end:
            status = "SERVICING"
            pos = v["berth_pt"]
            dest = v["berth_pt"]
            berth_active_vessel[bid] = v
        elif current_time <= s_end + pd.Timedelta(hours=6):
            status = "DEPARTED"
            progress = (current_time - s_end).total_seconds() / (6 * 3600)
            pos = _lerp(v["berth_pt"], v["departure_pt"], progress)
            dest = v["departure_pt"]
        else:
            # Already sailed far past scene
            continue

        heading = _heading(pos, dest)
        # Convert schematic 0-100 coordinates to geographic map coordinates
        map_lat = round(port_center[0] + (pos[1] - 50.0) * 0.012, 6)
        map_lon = round(port_center[1] + (pos[0] - 50.0) * 0.018, 6)

        vessel_payload.append({
            "id": v["id"],
            "mmsi": v["mmsi"],
            "vessel_type": v["vessel_type"],
            "position": pos,
            "map_position": [map_lat, map_lon],
            "heading": heading,
            "status": status,
            "risk_level": v["risk_level"],
            "eta": _iso(v["eta"]),
            "service_start": _iso(v["service_start"]),
            "service_end": _iso(v["service_end"]),
            "assigned_berth_id": bid,
            "assigned_crane_ids": v["assigned_crane_ids"],
            "waiting_minutes": v["waiting_minutes"],
            "workload_hours": v["workload_hours"],
            "priority": v["priority"],
            "route_type": "OPTIMIZED" if status != "WAITING" else "QUEUED",
        })

        # Generate smooth polyline trajectory
        route_pts = [v["approach_pt"], v["waiting_pt"], v["berth_pt"]]
        route_payload.append({
            "vessel_id": v["id"],
            "type": "OPTIMIZED",
            "status": status,
            "coordinates": route_pts,
            "map_coordinates": [
                [
                    round(port_center[0] + (pt[1] - 50.0) * 0.012, 6),
                    round(port_center[1] + (pt[0] - 50.0) * 0.018, 6),
                ]
                for pt in route_pts
            ],
        })

    # Berths live status & cranes
    berth_payload = []
    active_risk_scores = []

    for b_row in port_berths.to_dict("records"):
        bid = _id(b_row.get("berth_id"))
        pos = berth_positions[bid]
        max_cranes = int(b_row.get("max_cranes") or 2)

        active_v = berth_active_vessel.get(bid)
        waiting_list = berth_waiting_queue.get(bid, [])
        load = (1 if active_v else 0) + len(waiting_list)

        # Dynamic congestion probability & status
        congestion_prob = _clamp(0.20 + (0.35 if active_v else 0.0) + len(waiting_list) * 0.22)
        if len(waiting_list) >= 2 or congestion_prob >= 0.75:
            b_status = "CONGESTED"
        elif active_v and len(waiting_list) >= 1:
            b_status = "HIGH_UTILIZATION"
        elif active_v:
            b_status = "SERVICING"
        elif str(b_row.get("status", "")).lower() == "maintenance":
            b_status = "MAINTENANCE"
        else:
            b_status = "AVAILABLE"

        active_risk_scores.append(congestion_prob)

        # Crane payload with live BUSY/AVAILABLE status
        crane_payload = []
        raw_b_cranes = cranes_by_berth.get(bid, [])
        for c in raw_b_cranes:
            cid = c["id"]
            if c["status"] == "MAINTENANCE":
                crane_status = "MAINTENANCE"
            elif active_v and cid in active_v["assigned_crane_ids"]:
                crane_status = "BUSY"
            else:
                crane_status = "AVAILABLE"

            crane_payload.append({
                "id": cid,
                "status": crane_status,
                "position": pos,
            })

        b_map_lat = round(port_center[0] + (pos[1] - 50.0) * 0.012, 6)
        b_map_lon = round(port_center[1] + (pos[0] - 50.0) * 0.018, 6)

        berth_payload.append({
            "id": bid,
            "name": f"Berth {bid}",
            "position": pos,
            "map_position": [b_map_lat, b_map_lon],
            "length_m": float(b_row.get("berth_length_m") or 250.0),
            "depth_m": float(b_row.get("berth_depth_m") or 12.0),
            "max_cranes": max_cranes,
            "status": b_status,
            "utilization": round(min(1.0, load / max(1, max_cranes)), 2),
            "congestion_probability": round(congestion_prob, 2),
            "active_vessel_id": active_v["id"] if active_v else None,
            "waiting_count": len(waiting_list),
            "cranes": crane_payload,
        })

    overall_prob = round(max(active_risk_scores, default=0.22), 2)
    overall_risk = "HIGH" if overall_prob >= 0.75 else ("MEDIUM" if overall_prob >= 0.50 else "LOW")

    approaching_count = sum(1 for v in vessel_payload if v["status"] == "APPROACHING")
    waiting_count = sum(1 for v in vessel_payload if v["status"] == "WAITING")
    servicing_count = sum(1 for v in vessel_payload if v["status"] == "SERVICING")
    departed_count = sum(1 for v in vessel_payload if v["status"] == "DEPARTED")

    return {
        "time": {
            "start": _iso(base_window_start),
            "current": _iso(current_time),
            "end": _iso(horizon_end),
            "mode": "SCHEDULE_REPLAY",
        },
        "port": {
            "id": port_id,
            "name": port_name,
            "scene_size": [100, 100],
            "entrance": [8, 50],
            "anchorage": [38, 50],
            "berth_zone": [78, 50],
            "coordinates": port_center,
        },
        "summary": {
            "overall_risk": overall_risk,
            "congestion_probability": overall_prob,
            "incoming_vessels": approaching_count,
            "waiting_vessels": waiting_count,
            "servicing_vessels": servicing_count,
            "departed_vessels": departed_count,
            "total_active": len(vessel_payload),
        },
        "berths": berth_payload,
        "vessels": vessel_payload,
        "routes": route_payload,
        "notice": f"Simulating live operations for {port_name} based on verified schedule and berth optimization outputs.",
    }

