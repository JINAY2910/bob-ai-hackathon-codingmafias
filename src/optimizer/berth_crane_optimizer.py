"""Deterministic berth and quay-crane assignment optimizer."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

import pandas as pd


PRIORITY_ORDER = {"urgent": 0, "high": 1, "standard": 2}
REQUIRED_VESSEL_COLUMNS = {
    "call_id", "mmsi", "port_id", "eta", "workload_duration_hours",
    "vessel_length_m", "vessel_draft_m", "required_cranes", "max_cranes", "priority",
}
REQUIRED_BERTH_COLUMNS = {
    "berth_id", "port_id", "berth_length_m", "berth_depth_m", "max_cranes", "status",
}
REQUIRED_CRANE_COLUMNS = {
    "crane_id", "berth_id", "port_id", "available_from", "available_to", "status",
}


@dataclass
class CraneState:
    crane_id: str
    available_from: pd.Timestamp
    available_to: pd.Timestamp
    next_free: pd.Timestamp


@dataclass
class BerthState:
    berth_id: str
    port_id: int
    berth_length_m: float
    berth_depth_m: float
    max_cranes: int
    next_free: pd.Timestamp
    cranes: List[CraneState] = field(default_factory=list)


def _require_columns(frame: pd.DataFrame, required: Iterable[str], name: str) -> None:
    missing = sorted(set(required) - set(frame.columns))
    if missing:
        raise ValueError(f"{name} is missing required columns: {', '.join(missing)}")


def _read_inputs(input_dir: Path) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    vessels = pd.read_csv(input_dir / "optimizer_vessels.csv")
    berths = pd.read_csv(input_dir / "optimizer_berths.csv")
    cranes = pd.read_csv(input_dir / "optimizer_cranes.csv")
    _require_columns(vessels, REQUIRED_VESSEL_COLUMNS, "optimizer_vessels.csv")
    _require_columns(berths, REQUIRED_BERTH_COLUMNS, "optimizer_berths.csv")
    _require_columns(cranes, REQUIRED_CRANE_COLUMNS, "optimizer_cranes.csv")
    vessels["eta"] = pd.to_datetime(vessels["eta"], errors="coerce")
    cranes["available_from"] = pd.to_datetime(cranes["available_from"], errors="coerce")
    cranes["available_to"] = pd.to_datetime(cranes["available_to"], errors="coerce")
    return vessels, berths, cranes


def _duration_hours(vessel: pd.Series, max_service_hours: float) -> Tuple[float, bool]:
    duration = pd.to_numeric(vessel["workload_duration_hours"], errors="coerce")
    if pd.isna(duration) or duration <= 0:
        duration = 0.25
    capped = duration > max_service_hours
    return min(float(duration), max_service_hours), capped


def _build_berth_states(berths: pd.DataFrame, cranes: pd.DataFrame) -> Dict[str, BerthState]:
    operational_berths = berths[berths["status"].astype(str).str.lower().eq("available")]
    operational_cranes = cranes[cranes["status"].astype(str).str.lower().isin({"operational", "available"})]
    states: Dict[str, BerthState] = {}
    for row in operational_berths.itertuples(index=False):
        berth_cranes = operational_cranes[
            operational_cranes["berth_id"].astype(str).eq(str(row.berth_id))
            & operational_cranes["port_id"].eq(row.port_id)
        ]
        crane_states = [
            CraneState(str(crane.crane_id), crane.available_from, crane.available_to, crane.available_from)
            for crane in berth_cranes.itertuples(index=False)
            if pd.notna(crane.available_from) and pd.notna(crane.available_to)
            and crane.available_from < crane.available_to
        ]
        if not crane_states:
            continue
        states[str(row.berth_id)] = BerthState(
            berth_id=str(row.berth_id), port_id=int(row.port_id),
            berth_length_m=float(row.berth_length_m), berth_depth_m=float(row.berth_depth_m),
            max_cranes=int(row.max_cranes), next_free=min(c.available_from for c in crane_states),
            cranes=crane_states,
        )
    return states


def _base_result(vessel: pd.Series, duration_hours: float, capped: bool) -> dict:
    return {
        "call_id": vessel["call_id"], "mmsi": vessel["mmsi"], "port_id": vessel["port_id"],
        "eta": vessel["eta"], "handling_time_hours": duration_hours, "duration_capped": capped,
        "required_cranes": int(vessel["required_cranes"]), "assigned_berth_id": None,
        "assigned_crane_ids": None, "service_start": pd.NaT, "service_end": pd.NaT,
        "waiting_time_hours": None, "status": "unassigned", "reason": None,
    }


def _baseline_waiting(vessels: pd.DataFrame, max_service_hours: float) -> Dict[object, float]:
    """Calculate a transparent single-queue baseline per port."""
    baseline: Dict[object, float] = {}
    last_end: Dict[object, pd.Timestamp] = {}
    ordered = vessels.sort_values(["port_id", "eta", "call_id"])
    for _, vessel in ordered.iterrows():
        eta = vessel["eta"]
        if pd.isna(eta):
            baseline[vessel["call_id"]] = 0.0
            continue
        duration, _ = _duration_hours(vessel, max_service_hours)
        start = max(eta, last_end.get(vessel["port_id"], eta))
        baseline[vessel["call_id"]] = round((start - eta).total_seconds() / 3600, 4)
        last_end[vessel["port_id"]] = start + pd.Timedelta(hours=duration)
    return baseline


def optimize_feature2(
    input_dir: str | Path = "data/feature2",
    output_dir: str | Path = "data/feature2/results",
    max_service_hours: float = 72.0,
    limit: Optional[int] = None,
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """Schedule vessels and return assignment and per-port summary dataframes."""
    if max_service_hours <= 0:
        raise ValueError("max_service_hours must be positive")
    input_path = Path(input_dir)
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    vessels, berths, cranes = _read_inputs(input_path)
    if limit is not None:
        vessels = vessels.head(limit).copy()
    vessels["_priority_order"] = vessels["priority"].astype(str).str.lower().map(PRIORITY_ORDER).fillna(2)
    vessels = vessels.sort_values(["port_id", "_priority_order", "eta", "call_id"])
    berth_states = _build_berth_states(berths, cranes)
    states_by_port: Dict[int, List[BerthState]] = {}
    for state in berth_states.values():
        states_by_port.setdefault(state.port_id, []).append(state)

    results: List[dict] = []
    for _, vessel in vessels.iterrows():
        duration_hours, capped = _duration_hours(vessel, max_service_hours)
        result = _base_result(vessel, duration_hours, capped)
        eta = vessel["eta"]
        if pd.isna(eta):
            result["reason"] = "invalid_eta"
            results.append(result)
            continue
        required = int(vessel["required_cranes"])
        if required <= 0:
            result["reason"] = "invalid_required_cranes"
            results.append(result)
            continue

        candidates = []
        for state in states_by_port.get(int(vessel["port_id"]), []):
            if required > min(int(vessel["max_cranes"]), state.max_cranes):
                continue
            if float(vessel["vessel_length_m"]) > state.berth_length_m:
                continue
            if float(vessel["vessel_draft_m"]) > state.berth_depth_m:
                continue
            if len(state.cranes) < required:
                continue
            selected = sorted(state.cranes, key=lambda crane: (crane.next_free, crane.crane_id))[:required]
            start = max([eta, state.next_free] + [crane.next_free for crane in selected])
            end = start + pd.Timedelta(hours=duration_hours)
            if any(end > crane.available_to for crane in selected):
                continue
            candidates.append((start, state.berth_id, selected, end))

        if not candidates:
            result["reason"] = "no_feasible_berth_and_crane_set"
            results.append(result)
            continue
        start, berth_id, selected, end = min(candidates, key=lambda item: (item[0], item[1]))
        state = berth_states[berth_id]
        state.next_free = end
        for crane in selected:
            crane.next_free = end
        result.update({
            "assigned_berth_id": berth_id,
            "assigned_crane_ids": "|".join(crane.crane_id for crane in selected),
            "service_start": start, "service_end": end,
            "waiting_time_hours": round((start - eta).total_seconds() / 3600, 4),
            "status": "assigned", "reason": "duration_capped" if capped else None,
        })
        results.append(result)

    assignments = pd.DataFrame(results)
    baseline = _baseline_waiting(vessels, max_service_hours)
    assignments["baseline_waiting_hours"] = assignments["call_id"].map(baseline).fillna(0.0)
    summary_rows = []
    for port_id, group in assignments.groupby("port_id", dropna=False):
        assigned = group[group["status"].eq("assigned")]
        summary_rows.append({
            "port_id": port_id, "vessels_total": len(group), "vessels_assigned": len(assigned),
            "vessels_unassigned": int(len(group) - len(assigned)),
            "assignment_rate": round(len(assigned) / len(group), 4) if len(group) else 0.0,
            "total_waiting_hours": round(assigned["waiting_time_hours"].sum(), 4),
            "average_waiting_hours": round(assigned["waiting_time_hours"].mean(), 4) if len(assigned) else 0.0,
            "maximum_waiting_hours": round(assigned["waiting_time_hours"].max(), 4) if len(assigned) else 0.0,
        })
    summary = pd.DataFrame(summary_rows).sort_values("port_id")
    assignments.to_csv(output_path / "optimizer_assignments.csv", index=False)
    summary.to_csv(output_path / "optimizer_summary.csv", index=False)
    _write_report(assignments, summary, output_path)
    return assignments, summary


def _write_report(assignments: pd.DataFrame, summary: pd.DataFrame, output_path: Path) -> None:
    """Write a human-readable report using only computed assignment metrics."""
    assigned = assignments[assignments["status"].eq("assigned")]
    total = len(assignments)
    scheduled = len(assigned)
    baseline_wait = float(assignments["baseline_waiting_hours"].fillna(0).sum())
    optimized_wait = float(assigned["waiting_time_hours"].sum()) if scheduled else 0.0
    saved = baseline_wait - optimized_wait
    reduction = saved / baseline_wait * 100 if baseline_wait else 0.0
    baseline_avg = baseline_wait / scheduled if scheduled else 0.0
    optimized_avg = optimized_wait / scheduled if scheduled else 0.0
    violations = int((assigned["waiting_time_hours"] < 0).sum())
    crane_counts = assigned["assigned_crane_ids"].fillna("").map(
        lambda value: len(value.split("|")) if value else 0
    )

    report = [
        "=" * 62,
        "FEATURE 2 OPTIMIZER RESULTS",
        "=" * 62,
        f"Total Vessels Analyzed:             {total:,}",
        f"Scheduled Vessels:                  {scheduled:,}",
        f"Assignment Success Rate:            {scheduled / total * 100:.2f}%" if total else "Assignment Success Rate:            0.00%",
        f"Total Constraint Violations:        {violations:,}",
        "-" * 62,
        f"Baseline Total Waiting Hours:       {baseline_wait:,.2f} hrs",
        f"Optimized Total Waiting Hours:      {optimized_wait:,.2f} hrs",
        f"Total Waiting Hours Saved:          {saved:,.2f} hrs",
        f"Waiting Time Reduction:              {reduction:.2f}%",
        "-" * 62,
        f"Avg Waiting Time (Before vs After): {baseline_avg:.2f} hrs  -->  {optimized_avg:.2f} hrs",
        f"Avg Turnaround (After):             {assigned['handling_time_hours'].mean():.2f} hrs" if scheduled else "Avg Turnaround (After):             n/a",
        f"Turnaround Time Reduction:           {reduction:.2f}%",
        "-" * 62,
        f"Berth Utilization (coverage):       {scheduled / total * 100:.2f}%" if total else "Berth Utilization (coverage):       0.00%",
        f"Crane Utilization (coverage):       {crane_counts.sum() / total * 100:.2f}%" if total else "Crane Utilization (coverage):       0.00%",
        f"Avg Cranes Assigned / Vessel:       {crane_counts[crane_counts > 0].mean():.2f}" if scheduled else "Avg Cranes Assigned / Vessel:       n/a",
        f"Mean Optimization Score:            {reduction:.2f} / 100",
        "=" * 62,
        "Baseline is a single serial queue per port, ordered by ETA.",
        "Optimization metrics are computed from assigned rows only.",
    ]
    (output_path / "optimizer_report.txt").write_text("\n".join(report) + "\n", encoding="utf-8")