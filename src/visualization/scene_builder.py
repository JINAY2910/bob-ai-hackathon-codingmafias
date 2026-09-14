from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import pandas as pd


DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "feature2"
RESULTS_DIR = DATA_DIR / "results"
RAW_DIR = Path(__file__).resolve().parents[2] / "data" / "raw"

KNOWN_PORT_COORDINATES = {
    1: [10.65, -61.52],
    3: [13.98, -61.00],
    5: [14.60, -61.06],
    8: [10.24, -61.45],
    13: [10.40, -61.46],
    38: [11.18, -60.73],
    73: [10.34, -61.46],
    98: [10.69, -61.62],
}


def _read_csv(name: str) -> pd.DataFrame:
    path = DATA_DIR / name
    if not path.exists():
        raise FileNotFoundError(f"Visualization input not found: {path}")
    return pd.read_csv(path)


def _read_result(name: str) -> pd.DataFrame:
    path = RESULTS_DIR / name
    if not path.exists():
        raise FileNotFoundError(f"Visualization result not found: {path}")
    return pd.read_csv(path)


def _port_coordinates(port_id: int) -> list[float]:
    """Return [latitude, longitude]; fall back near Port of Spain for demo data."""
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


def _point_for_berth(berth_id: str, index: int, total: int) -> list[float]:
    """Return stable schematic coordinates for a berth in the browser scene."""
    if total <= 1:
        return [78.0, 50.0]
    y = 18.0 + (index / (total - 1)) * 64.0
    return [79.0, round(y, 2)]


def _lerp(start: list[float], end: list[float], progress: float) -> list[float]:
    progress = _clamp(progress)
    return [
        round(start[0] + (end[0] - start[0]) * progress, 2),
        round(start[1] + (end[1] - start[1]) * progress, 2),
    ]


def _heading(start: list[float], end: list[float]) -> float:
    import math

    return round(math.degrees(math.atan2(end[1] - start[1], end[0] - start[0])), 2)


def _risk_for_berth(
    berth_id: str,
    assigned: pd.DataFrame,
    current_time: pd.Timestamp,
) -> tuple[str, float, int]:
    active = assigned[
        (assigned["assigned_berth_id"].map(_id) == berth_id)
        & (assigned["service_start"] <= current_time)
        & (assigned["service_end"] >= current_time)
    ]
    waiting = assigned[
        (assigned["assigned_berth_id"].map(_id) == berth_id)
        & (assigned["eta"] <= current_time)
        & (assigned["service_start"] > current_time)
    ]
    load = len(active) + len(waiting)
    probability = _clamp(0.22 + load * 0.16 + waiting["waiting_time_hours"].fillna(0).mean() / 24 if len(waiting) else 0.22)
    if probability >= 0.75:
        return "CONGESTED", round(probability, 2), load
    if probability >= 0.5:
        return "HIGH_UTILIZATION", round(probability, 2), load
    if load:
        return "ASSIGNED", round(probability, 2), load
    return "AVAILABLE", round(probability, 2), load


def build_scene(port_id: int, at: datetime | None = None) -> dict[str, Any]:
    vessels = _read_csv("optimizer_vessels.csv")
    berths = _read_csv("optimizer_berths.csv")
    cranes = _read_csv("optimizer_cranes.csv")
    assignments = _read_result("optimizer_assignments.csv")

    for frame, columns in (
        (vessels, ["eta"]),
        (cranes, ["available_from", "available_to"]),
        (assignments, ["eta", "service_start", "service_end"]),
    ):
        for column in columns:
            frame[column] = pd.to_datetime(frame[column], errors="coerce")

    port_vessels = vessels[vessels["port_id"] == port_id].copy()
    port_berths = berths[berths["port_id"] == port_id].copy()
    port_cranes = cranes[cranes["port_id"] == port_id].copy()
    port_assignments = assignments[assignments["port_id"] == port_id].copy()

    if port_vessels.empty or port_berths.empty:
        raise ValueError(f"No visualization data available for port {port_id}")

    first_eta = port_vessels["eta"].min()
    current_time = pd.Timestamp(at) if at else first_eta + pd.Timedelta(hours=48)
    if current_time.tzinfo is not None:
        current_time = current_time.tz_localize(None)
    horizon_end = current_time + pd.Timedelta(hours=72)

    berth_ids = [_id(value) for value in port_berths["berth_id"].tolist()]
    berth_positions = {
        berth_id: _point_for_berth(berth_id, index, len(berth_ids))
        for index, berth_id in enumerate(berth_ids)
    }
    port_name = str(port_berths["port_name"].iloc[0])
    port_center = _port_coordinates(port_id)

    berth_payload = []
    for berth_id, row in zip(berth_ids, port_berths.to_dict("records")):
        risk, probability, load = _risk_for_berth(berth_id, port_assignments, current_time)
        berth_cranes = port_cranes[port_cranes["berth_id"].map(_id) == berth_id]
        crane_payload = []
        for crane in berth_cranes.to_dict("records"):
            busy = any(
                str(assignment.get("assigned_crane_ids", "")).find(str(crane["crane_id"])) >= 0
                and pd.notna(assignment.get("service_start"))
                and pd.notna(assignment.get("service_end"))
                and assignment["service_start"] <= current_time <= assignment["service_end"]
                for assignment in port_assignments.to_dict("records")
            )
            crane_payload.append({
                "id": str(crane["crane_id"]),
                "status": "MAINTENANCE" if str(crane["status"]).lower() == "maintenance" else ("BUSY" if busy else "AVAILABLE"),
                "position": berth_positions[berth_id],
                "available_from": _iso(crane["available_from"]),
                "available_to": _iso(crane["available_to"]),
            })
        berth_payload.append({
            "id": berth_id,
            "name": f"Berth {berth_id}",
            "position": berth_positions[berth_id],
            "length_m": float(row["berth_length_m"]),
            "depth_m": float(row["berth_depth_m"]),
            "max_cranes": int(row["max_cranes"]),
            "status": "MAINTENANCE" if str(row["status"]).lower() != "available" else risk,
            "utilization": round(min(1.25, load / max(1, int(row["max_cranes"]))), 2),
            "congestion_probability": probability,
            "cranes": crane_payload,
        })

    vessel_payload = []
    route_payload = []
    visible_assignments = port_assignments[
        (port_assignments["eta"] <= horizon_end)
        & (port_assignments["service_end"].fillna(port_assignments["eta"]) >= current_time - pd.Timedelta(hours=24))
    ].copy()
    visible_assignments = visible_assignments.sort_values(["eta", "call_id"]).head(80)

    for index, assignment in enumerate(visible_assignments.to_dict("records")):
        vessel_id = str(assignment["call_id"])
        berth_id = _id(assignment["assigned_berth_id"]) if pd.notna(assignment["assigned_berth_id"]) else None
        if not berth_id or berth_id not in berth_positions:
            continue
        berth_point = berth_positions[berth_id]
        approach_point = [round(13 + (index % 5) * 4, 2), round(16 + (index % 9) * 8, 2)]
        waiting_point = [round(42 + (index % 4) * 4, 2), round(15 + (index % 10) * 7, 2)]
        eta = assignment["eta"]
        service_start = assignment["service_start"]
        service_end = assignment["service_end"]
        if pd.isna(eta):
            continue

        if current_time < eta:
            status = "APPROACHING"
            progress = (current_time - (eta - pd.Timedelta(hours=12))).total_seconds() / (12 * 3600)
            position = _lerp(approach_point, waiting_point, progress)
            destination = waiting_point
        elif pd.notna(service_start) and current_time < service_start:
            status = "WAITING"
            position = waiting_point
            destination = berth_point
        elif pd.notna(service_end) and current_time <= service_end:
            status = "SERVICING"
            position = berth_point
            destination = berth_point
        else:
            status = "DEPARTED"
            progress = (current_time - service_end).total_seconds() / (12 * 3600) if pd.notna(service_end) else 1
            position = _lerp(berth_point, [93.0, berth_point[1]], progress)
            destination = [93.0, berth_point[1]]

        wait_minutes = round(float(assignment.get("waiting_time_hours") or 0) * 60, 1)
        risk_level = "HIGH" if wait_minutes >= 120 else ("MEDIUM" if wait_minutes >= 30 else "LOW")
        heading = _heading(position, destination)
        vessel_payload.append({
            "id": vessel_id,
            "mmsi": str(assignment.get("mmsi", "")),
            "position": position,
            "map_position": [
                round(port_center[0] + (position[1] - 50) * 0.012, 6),
                round(port_center[1] + (position[0] - 50) * 0.018, 6),
            ],
            "map_destination": [
                round(port_center[0] + (destination[1] - 50) * 0.012, 6),
                round(port_center[1] + (destination[0] - 50) * 0.018, 6),
            ],
            "heading": heading,
            "status": status,
            "risk_level": risk_level,
            "eta": _iso(eta),
            "service_start": _iso(service_start),
            "service_end": _iso(service_end),
            "assigned_berth_id": berth_id,
            "assigned_crane_ids": str(assignment.get("assigned_crane_ids") or "").split("|") if pd.notna(assignment.get("assigned_crane_ids")) else [],
            "waiting_minutes": wait_minutes,
            "route_type": "OPTIMIZED" if status != "WAITING" else "QUEUED",
        })
        route_payload.append({
            "vessel_id": vessel_id,
            "type": "OPTIMIZED",
            "status": status,
            "coordinates": [approach_point, waiting_point, berth_point],
            "map_coordinates": [
                [
                    round(port_center[0] + (point[1] - 50) * 0.012, 6),
                    round(port_center[1] + (point[0] - 50) * 0.018, 6),
                ]
                for point in [approach_point, waiting_point, berth_point]
            ],
        })

    active_risk = [item["congestion_probability"] for item in berth_payload]
    overall_risk = max(active_risk, default=0.0)
    return {
        "time": {
            "current": _iso(current_time),
            "start": _iso(current_time),
            "end": _iso(horizon_end),
            "mode": "SCHEDULE_REPLAY",
        },
        "port": {
            "id": port_id,
            "name": port_name,
            "scene_size": [100, 100],
            "entrance": [8, 50],
            "anchorage": [28, 50],
            "berth_zone": [79, 50],
            "coordinates": port_center,
        },
        "summary": {
            "overall_risk": "HIGH" if overall_risk >= 0.75 else ("MEDIUM" if overall_risk >= 0.5 else "LOW"),
            "congestion_probability": round(overall_risk, 2),
            "incoming_vessels": sum(1 for vessel in vessel_payload if vessel["status"] == "APPROACHING"),
            "waiting_vessels": sum(1 for vessel in vessel_payload if vessel["status"] == "WAITING"),
            "servicing_vessels": sum(1 for vessel in vessel_payload if vessel["status"] == "SERVICING"),
            "departed_vessels": sum(1 for vessel in vessel_payload if vessel["status"] == "DEPARTED"),
        },
        "berths": berth_payload,
        "vessels": vessel_payload,
        "routes": route_payload,
        "notice": "Positions are simulated from historical ETA and service schedules; they are not live AIS positions.",
    }
