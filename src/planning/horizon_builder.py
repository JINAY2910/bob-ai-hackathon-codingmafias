from __future__ import annotations

import pickle
import warnings
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import pandas as pd

from src.orchestration.llm_planner import generate_executive_summary


ROOT_DIR = Path(__file__).resolve().parents[2]
PROCESSED_DIR = ROOT_DIR / "data" / "processed"
FEATURE2_DIR = ROOT_DIR / "data" / "feature2"
RESULTS_DIR = FEATURE2_DIR / "results"
FEATURE3_FILE = ROOT_DIR / "data" / "feature3" / "alternate_routes.csv"
MODEL_FILE = ROOT_DIR / "models" / "congestion_model.pkl"

MODEL_FEATURES = [
    "active_vessels",
    "vessel_arrivals",
    "vessel_departures",
    "arrivals_next_1d",
    "arrivals_next_3d_sum",
    "total_berths",
    "berth_utilization_ratio",
]


def _as_naive_timestamp(value: datetime | pd.Timestamp) -> pd.Timestamp:
    timestamp = pd.Timestamp(value)
    if timestamp.tzinfo is not None:
        timestamp = timestamp.tz_localize(None)
    return timestamp


def _iso(value: Any) -> str | None:
    if value is None or pd.isna(value):
        return None
    timestamp = pd.Timestamp(value)
    if timestamp.tzinfo is None:
        timestamp = timestamp.tz_localize("UTC")
    return timestamp.isoformat().replace("+00:00", "Z")


def _id(value: Any) -> str:
    if pd.isna(value):
        return ""
    try:
        number = float(value)
        if number.is_integer():
            return str(int(number))
    except (TypeError, ValueError):
        pass
    return str(value)


def _require_file(path: Path) -> None:
    if not path.exists():
        raise FileNotFoundError(f"Required planning input is missing: {path}")


def _load_prediction_rows(port_id: int, start: pd.Timestamp, end: pd.Timestamp) -> pd.DataFrame:
    _require_file(PROCESSED_DIR / "engineered_features.csv")
    _require_file(MODEL_FILE)

    features = pd.read_csv(PROCESSED_DIR / "engineered_features.csv")
    features["date"] = pd.to_datetime(features["date"], errors="coerce")
    features = features[features["port"] == port_id].copy()
    features = features[(features["date"] >= start.normalize()) & (features["date"] < end.normalize())]
    if features.empty:
        return features

    with warnings.catch_warnings():
        warnings.simplefilter("ignore", category=UserWarning)
        with MODEL_FILE.open("rb") as model_file:
            model = pickle.load(model_file)
    features[MODEL_FEATURES] = features[MODEL_FEATURES].apply(pd.to_numeric, errors="coerce").fillna(0)
    features["congestion_probability"] = model.predict_proba(features[MODEL_FEATURES])[:, 1]
    features["congestion_probability"] = features["congestion_probability"].round(4)
    return features.sort_values("date")


def _load_assignments(port_id: int) -> pd.DataFrame:
    _require_file(RESULTS_DIR / "optimizer_assignments.csv")
    assignments = pd.read_csv(RESULTS_DIR / "optimizer_assignments.csv", low_memory=False)
    assignments = assignments[assignments["port_id"] == port_id].copy()
    for column in ["eta", "service_start", "service_end"]:
        assignments[column] = pd.to_datetime(assignments[column], errors="coerce")
    assignments["assigned_berth_id"] = assignments["assigned_berth_id"].map(_id)
    assignments["waiting_time_hours"] = pd.to_numeric(
        assignments["waiting_time_hours"], errors="coerce"
    ).fillna(0)
    return assignments


def _load_alternates(port_id: int) -> list[dict[str, Any]]:
    if not FEATURE3_FILE.exists():
        return []
    alternates = pd.read_csv(FEATURE3_FILE)
    rows = alternates[alternates["port_id"] == port_id]
    if rows.empty:
        return []
    row = rows.iloc[0]
    result = []
    for index in range(1, 4):
        alternate_id = row.get(f"alt_{index}_id")
        if pd.isna(alternate_id):
            continue
        result.append({
            "port_id": int(float(alternate_id)),
            "port_name": str(row.get(f"alt_{index}_name", "")),
            "capacity": float(row.get(f"alt_{index}_capacity", 0)),
            "score": float(row.get(f"alt_{index}_score", 0)),
        })
    return result


def _risk_level(probability: float) -> str:
    if probability >= 0.75:
        return "HIGH"
    if probability >= 0.5:
        return "MEDIUM"
    return "LOW"


def _assignments_in_window(
    assignments: pd.DataFrame,
    start: pd.Timestamp,
    end: pd.Timestamp,
) -> pd.DataFrame:
    return assignments[
        (assignments["eta"] < end)
        & (assignments["service_end"].fillna(assignments["eta"]) >= start)
    ].copy()


def _hotspots_for_shift(
    predictions: pd.DataFrame,
    shift_start: pd.Timestamp,
    shift_end: pd.Timestamp,
    assignments: pd.DataFrame,
) -> list[dict[str, Any]]:
    matching = predictions[
        (predictions["date"] >= shift_start.normalize())
        & (predictions["date"] < shift_end.normalize() + pd.Timedelta(days=1))
    ]
    if matching.empty:
        return []

    shift_assignments = _assignments_in_window(assignments, shift_start, shift_end)
    berth_load = shift_assignments.groupby("assigned_berth_id").size().sort_values(ascending=False)
    hotspots = []
    for _, prediction in matching.sort_values("congestion_probability", ascending=False).head(3).iterrows():
        probability = float(prediction["congestion_probability"])
        if probability < 0.35 and not berth_load.empty:
            continue
        berth_id = str(berth_load.index[0]) if not berth_load.empty else "PORT-WIDE"
        reasons = [
            f"{int(prediction.get('vessel_arrivals', 0))} arrivals scheduled for the day",
            f"projected berth utilization {float(prediction.get('berth_utilization_ratio', 0)):.2f}",
        ]
        hotspots.append({
            "start": _iso(max(shift_start, pd.Timestamp(prediction["date"]))),
            "end": _iso(min(shift_end, pd.Timestamp(prediction["date"]) + pd.Timedelta(days=1))),
            "berth_id": berth_id,
            "probability": round(probability, 4),
            "reasons": reasons,
        })
    return hotspots


def _planned_operations(
    shift_assignments: pd.DataFrame,
    shift_start: pd.Timestamp,
    shift_end: pd.Timestamp,
) -> list[dict[str, Any]]:
    operations = []
    for row in shift_assignments.sort_values(["eta", "call_id"]).head(80).to_dict("records"):
        eta = row["eta"]
        service_start = row["service_start"]
        service_end = row["service_end"]
        if pd.notna(service_end) and service_end < shift_start:
            action = "DEPART"
        elif pd.notna(service_start) and service_start <= shift_end:
            action = "SERVICE"
        else:
            action = "ARRIVE"
        cranes = str(row.get("assigned_crane_ids") or "").split("|")
        operations.append({
            "vessel_id": str(row["call_id"]),
            "action": action,
            "berth_id": str(row.get("assigned_berth_id") or "UNASSIGNED"),
            "cranes": [] if cranes == [""] else cranes,
        })
    return operations


def _actions_for_shift(
    shift_assignments: pd.DataFrame,
    hotspots: list[dict[str, Any]],
    shift_start: pd.Timestamp,
) -> list[dict[str, Any]]:
    actions = []
    high_wait = shift_assignments[
        (shift_assignments["waiting_time_hours"] >= 2)
        | (shift_assignments["status"].astype(str).str.lower() != "assigned")
    ].sort_values("waiting_time_hours", ascending=False)
    for index, row in enumerate(high_wait.head(8).to_dict("records")):
        wait_minutes = round(float(row["waiting_time_hours"]) * 60, 1)
        berth = row.get("assigned_berth_id") or "no feasible berth"
        actions.append({
            "action_id": f"review-{row['call_id']}",
            "priority": "P0" if wait_minutes >= 120 else "P1",
            "owner_role": "SHIFT_SUPERVISOR",
            "description": (
                f"Review Vessel {row['call_id']} at Berth {berth}; "
                f"estimated waiting time is {wait_minutes:g} minutes."
            ),
            "due_at": _iso(max(shift_start, row["eta"] - pd.Timedelta(hours=2))),
            "status": "PENDING_REVIEW",
            "fallback": "Hold vessel in anchorage and recalculate the next feasible slot.",
        })
    for hotspot_index, hotspot in enumerate(hotspots[:2]):
        actions.append({
            "action_id": f"monitor-{hotspot['berth_id']}-{shift_start.strftime('%Y%m%d%H')}-{hotspot_index}",
            "priority": "P1" if hotspot["probability"] >= 0.75 else "P2",
            "owner_role": "SHIFT_SUPERVISOR",
            "description": (
                f"Monitor Berth {hotspot['berth_id']} during the predicted "
                f"{hotspot['probability']:.0%} congestion window."
            ),
            "due_at": hotspot["start"],
            "status": "OPEN",
            "fallback": "Move the next compatible vessel to an available berth.",
        })
    return actions[:8]


def _contingencies(hotspots: list[dict[str, Any]], alternates: list[dict[str, Any]]) -> list[dict[str, str]]:
    if not hotspots:
        return []
    fallback = (
        f"Evaluate alternate port {alternates[0]['port_name']} (port {alternates[0]['port_id']})"
        if alternates else "Hold arrivals in anchorage and rerun the optimizer."
    )
    return [{
        "trigger": f"Berth {hotspots[0]['berth_id']} remains above planned capacity",
        "fallback": fallback,
    }]


def _default_as_of(port_id: int) -> pd.Timestamp:
    assignments = _load_assignments(port_id)
    first_eta = assignments["eta"].dropna().min()
    return first_eta.normalize() + pd.Timedelta(days=2)


def generate_operations_plan(
    port_id: int,
    as_of: datetime | None = None,
) -> dict[str, Any]:
    """Build a 72-hour plan from the trained model and real optimizer outputs."""
    start = _as_naive_timestamp(as_of) if as_of else _default_as_of(port_id)
    end = start + pd.Timedelta(hours=72)
    assignments = _load_assignments(port_id)
    predictions = _load_prediction_rows(port_id, start, end)
    alternates = _load_alternates(port_id)
    horizon_assignments = _assignments_in_window(assignments, start, end)
    assigned_horizon = horizon_assignments[horizon_assignments["status"].astype(str).str.lower().eq("assigned")]
    average_wait_hours = float(assigned_horizon["waiting_time_hours"].mean()) if not assigned_horizon.empty else 0.0
    max_wait_hours = float(assigned_horizon["waiting_time_hours"].max()) if not assigned_horizon.empty else 0.0
    unassigned_horizon = int((horizon_assignments["status"].astype(str).str.lower() != "assigned").sum())
    assignment_rate = (
        float(len(assigned_horizon) / len(horizon_assignments))
        if len(horizon_assignments)
        else 0.0
    )

    shifts = []
    all_hotspots = []
    all_actions = []
    for index in range(3):
        shift_start = start + pd.Timedelta(hours=index * 24)
        shift_end = shift_start + pd.Timedelta(hours=24)
        shift_assignments = _assignments_in_window(assignments, shift_start, shift_end)
        hotspots = _hotspots_for_shift(predictions, shift_start, shift_end, assignments)
        actions = _actions_for_shift(shift_assignments, hotspots, shift_start)
        contingencies = _contingencies(hotspots, alternates)
        all_hotspots.extend(hotspots)
        all_actions.extend(actions)
        shift_prob = max((item["probability"] for item in hotspots), default=0.0)
        shifts.append({
            "time_block": {"start": _iso(shift_start), "end": _iso(shift_end)},
            "risk": {"level": _risk_level(shift_prob), "hotspots": [item["berth_id"] for item in hotspots]},
            "planned_operations": _planned_operations(shift_assignments, shift_start, shift_end),
            "supervisor_actions": actions,
            "contingencies": contingencies,
        })

    overall_probability = max((item["probability"] for item in all_hotspots), default=0.0)
    plan = {
        "plan_id": f"plan-port-{port_id}-{start.strftime('%Y%m%d%H%M')}",
        "generated_at": _iso(start),
        "valid_until": _iso(end),
        "status": "READY_FOR_REVIEW",
        "executive_summary": "",
        "overall_risk": _risk_level(overall_probability),
        "shifts": shifts,
        "critical_actions": [action for action in all_actions if action["priority"] == "P0"],
        "congestion_hotspots": all_hotspots,
        "resource_plan": [{
            "port_id": port_id,
            "alternate_ports": alternates,
            "vessels_in_horizon": int(len(horizon_assignments)),
            "vessels_assigned": int(len(assigned_horizon)),
            "vessels_unassigned": unassigned_horizon,
            "assignment_rate": round(assignment_rate, 4),
            "average_wait_hours": round(average_wait_hours, 2),
            "maximum_wait_hours": round(max_wait_hours, 2),
        }],
        "contingencies": [item for shift in shifts for item in shift["contingencies"]],
        "assumptions": [
            "Historical schedule replay; not live AIS.",
            "Congestion probability is generated by the trained XGBoost model at port/day level.",
            "Berth-level hotspot attribution uses optimizer assignment load.",
        ],
        "model_metadata": {
            "prediction_model_version": "congestion_model.pkl",
            "optimizer_run_id": f"optimizer-assignments-port-{port_id}",
            "llm_model": "deterministic-explanation-v1",
            "rules_version": "not-configured",
        },
    }
    plan["executive_summary"] = generate_executive_summary(plan)
    return plan


# Backward-compatible import for older callers; the returned data is now real.
def generate_mock_operations_plan(port_id: int, as_of: datetime) -> dict[str, Any]:
    return generate_operations_plan(port_id, as_of)
