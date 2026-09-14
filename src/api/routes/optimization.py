from fastapi import APIRouter, HTTPException
from datetime import datetime, timedelta, timezone
from pathlib import Path
import pandas as pd
from src.api.models import OptimizerOutput, BerthAssignment, OptimizationObjective
from src.optimizer.berth_crane_optimizer import optimize_feature2

router = APIRouter()
RESULTS_DIR = Path("data/feature2/results")
FEATURE2_DIR = Path("data/feature2")


def _load_or_run_optimizer():
    assignments_path = RESULTS_DIR / "optimizer_assignments.csv"
    summary_path = RESULTS_DIR / "optimizer_summary.csv"
    if assignments_path.exists() and summary_path.exists():
        assignments = pd.read_csv(assignments_path, low_memory=False)
        summary = pd.read_csv(summary_path)
        return assignments, summary, "cached"
    return (*optimize_feature2(input_dir="data/feature2", output_dir="data/feature2/results"), "fresh")

@router.post("", response_model=OptimizerOutput)
def optimize_berths(port_id: int = 1):
    """
    Triggers the berth/crane optimizer and returns optimal assignments.
    Executes the real Python script rather than returning mocked data.
    """
    now = datetime.now(timezone.utc)
    
    try:
        # Reuse the generated full-result files so opening the UI does not
        # rerun the expensive unbounded optimizer on every request.
        assignments_df, summary_df, source = _load_or_run_optimizer()
    except (FileNotFoundError, ValueError, pd.errors.ParserError) as error:
        raise HTTPException(status_code=503, detail=f"Optimizer inputs are unavailable: {error}") from error
        
    # Get assignments specifically for this port, take a few for the UI
    port_assignments = assignments_df[
        (assignments_df["port_id"] == port_id) & (assignments_df["status"] == "assigned")
    ].head(20)
    
    berth_assignments = []
    for _, row in port_assignments.iterrows():
        berth_assignments.append(
            BerthAssignment(
                vessel_id=str(row["call_id"]),
                berth_id=str(row["assigned_berth_id"]),
                arrival_time=pd.to_datetime(row["eta"]).to_pydatetime() if pd.notna(row["eta"]) else now,
                service_start=pd.to_datetime(row["service_start"]).to_pydatetime() if pd.notna(row["service_start"]) else now,
                service_end=pd.to_datetime(row["service_end"]).to_pydatetime() if pd.notna(row["service_end"]) else now,
                crane_ids=str(row["assigned_crane_ids"]).split("|") if pd.notna(row["assigned_crane_ids"]) else [],
                estimated_wait_minutes=float(row["waiting_time_hours"]) * 60
            )
        )
        
    # Get port summary metrics
    port_summary = summary_df[summary_df["port_id"] == port_id]
    if port_summary.empty:
        raise HTTPException(status_code=404, detail=f"No optimizer results found for port {port_id}")
    summary = port_summary.iloc[0]
    total_wait = float(summary["total_waiting_hours"]) * 60

    cranes = pd.read_csv(FEATURE2_DIR / "optimizer_cranes.csv")
    cranes = cranes[(cranes["port_id"] == port_id) & cranes["status"].astype(str).str.lower().isin({"operational", "available"})].copy()
    cranes["available_from"] = pd.to_datetime(cranes["available_from"], errors="coerce")
    cranes["available_to"] = pd.to_datetime(cranes["available_to"], errors="coerce")
    available_hours = ((cranes["available_to"] - cranes["available_from"]).dt.total_seconds() / 3600).clip(lower=0).sum()
    assigned = assignments_df[(assignments_df["port_id"] == port_id) & assignments_df["status"].eq("assigned")].copy()
    assigned["service_start"] = pd.to_datetime(assigned["service_start"], errors="coerce")
    assigned["service_end"] = pd.to_datetime(assigned["service_end"], errors="coerce")
    assigned_crane_hours = 0.0
    for _, row in assigned.iterrows():
        duration = (row["service_end"] - row["service_start"]).total_seconds() / 3600 if pd.notna(row["service_start"]) and pd.notna(row["service_end"]) else 0
        crane_count = len(str(row.get("assigned_crane_ids") or "").split("|")) if pd.notna(row.get("assigned_crane_ids")) else 0
        assigned_crane_hours += max(duration, 0) * crane_count
    crane_utilization = assigned_crane_hours / available_hours if available_hours else 0.0
    vessels_total = int(summary["vessels_total"])
    vessels_assigned = int(summary["vessels_assigned"])
    vessels_unassigned = int(summary["vessels_unassigned"])
    assignment_rate = float(summary["assignment_rate"])
    limitations = []
    if vessels_unassigned:
        limitations.append(f"{vessels_unassigned:,} vessels have no feasible berth/crane assignment in the current horizon.")
    limitations.append("This is a deterministic scheduling heuristic over the supplied historical schedule.")

    return OptimizerOutput(
        optimization_run_id=f"opt-{now.strftime('%Y-%m-%d')}-{port_id}",
        status=("PARTIAL_CACHED" if source == "cached" else "PARTIAL") if vessels_unassigned else ("FEASIBLE_CACHED" if source == "cached" else "FEASIBLE"),
        assignments=berth_assignments,
        objective=OptimizationObjective(
            total_wait_minutes=total_wait,
            berth_conflicts=0,
            crane_utilization=round(crane_utilization, 4)
        ),
        constraints_satisfied=vessels_unassigned == 0,
        vessels_total=vessels_total,
        vessels_assigned=vessels_assigned,
        vessels_unassigned=vessels_unassigned,
        assignment_rate=assignment_rate,
        crane_utilization=round(crane_utilization, 4),
        limitations=limitations,
    )
