from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, HTTPException
import pandas as pd
from pathlib import Path
from src.api.models import (
    AlternateOption,
    DiversionAdvisory,
    DiversionAdvisoryRequest,
    Recommendation,
    RoutingRecommenderOutput,
)
from src.routing.alternate_routing import calculate_alternate_routes

router = APIRouter()
ROOT_DIR = Path(__file__).resolve().parents[3]
_advisories: dict[str, DiversionAdvisory] = {}

@router.get("", response_model=RoutingRecommenderOutput)
def get_alternate_routes(vessel_id: str, port_id: int = 1):
    """
    Returns alternate routing recommendations for a vessel.
    Executes real routing logic by loading the calculated alternate routes CSV.
    """
    raw_dir = ROOT_DIR / "data" / "raw"
    processed_dir = ROOT_DIR / "data" / "processed"
    output_path = ROOT_DIR / "data" / "feature3" / "alternate_routes.csv"
    
    try:
        if not output_path.exists():
            calculate_alternate_routes(str(raw_dir), str(processed_dir))
        df = pd.read_csv(output_path)
    except (FileNotFoundError, ValueError, pd.errors.ParserError) as error:
        raise HTTPException(status_code=503, detail=f"Routing inputs are unavailable: {error}") from error

    port_row = df[df["port_id"] == port_id]
    if port_row.empty:
        raise HTTPException(status_code=404, detail=f"No alternate routes found for port {port_id}")
        
    port_data = port_row.iloc[0]
    recommendations = []
    summary_path = ROOT_DIR / "data" / "feature2" / "results" / "optimizer_summary.csv"
    summaries = pd.read_csv(summary_path) if summary_path.exists() else pd.DataFrame()
    origin = summaries[summaries["port_id"] == port_id] if not summaries.empty else pd.DataFrame()
    origin_wait = float(origin.iloc[0]["average_waiting_hours"]) * 60 if not origin.empty else 0.0
    capacity_path = ROOT_DIR / "data" / "processed" / "berths_capacity.csv"
    capacities = pd.read_csv(capacity_path) if capacity_path.exists() else pd.DataFrame()
    origin_capacity = 0.0
    if not capacities.empty:
        origin_capacity_rows = capacities[capacities["port"] == port_id]
        if not origin_capacity_rows.empty:
            origin_capacity = float(origin_capacity_rows.iloc[0]["total_berths"])
    
    for i in range(1, 4):
        alt_id_col = f"alt_{i}_id"
        alt_name_col = f"alt_{i}_name"
        alt_score_col = f"alt_{i}_score"
        
        if alt_id_col in port_data and pd.notna(port_data[alt_id_col]):
            alt_capacity = float(port_data.get(f"alt_{i}_capacity", 0) or 0)
            capacity_ratio = origin_capacity / alt_capacity if alt_capacity > 0 and origin_capacity > 0 else 1.0
            estimated_alt_wait = origin_wait * min(capacity_ratio, 1.0)
            recommendations.append(
                Recommendation(
                    vessel_id=vessel_id,
                    recommendation_type="ALTERNATE_PORT",
                    current_option=AlternateOption(
                        berth_id=f"Port {port_id}",
                        expected_wait_minutes=round(origin_wait, 1),
                        port_name=str(port_data.get("port_name", f"Port {port_id}")),
                        available_capacity=origin_capacity,
                    ),
                    recommended_option=AlternateOption(
                        berth_id=f"Port {int(port_data[alt_id_col])}",
                        expected_wait_minutes=round(estimated_alt_wait, 1),
                        port_name=str(port_data[alt_name_col]),
                        available_capacity=alt_capacity,
                    ),
                    reason=(
                        f"Port {port_data[alt_name_col]} has viability score {float(port_data[alt_score_col]):.1f}, "
                        f"{alt_capacity:.0f} available berths in the capacity dataset, and a lower capacity-based wait estimate."
                    ),
                    confidence=0.6,
                    requires_supervisor_approval=True
                )
            )
            
    return RoutingRecommenderOutput(recommendations=recommendations)


@router.post("/advisory", response_model=DiversionAdvisory, status_code=201)
def issue_diversion_advisory(request: DiversionAdvisoryRequest):
    """Issue a demo-mode advisory and retain it for the current API process."""
    advisory = DiversionAdvisory(
        advisory_id=f"adv-{uuid4().hex[:10]}",
        status="ISSUED",
        origin_port_id=request.origin_port_id,
        alternate_port_id=request.alternate_port_id,
        vessel_id=request.vessel_id,
        reason=request.reason,
        mode="historical-simulation",
        issued_at=datetime.now(timezone.utc),
    )
    _advisories[advisory.advisory_id] = advisory
    return advisory


@router.get("/advisories", response_model=list[DiversionAdvisory])
def list_diversion_advisories():
    """Return advisories issued during the current demo API process."""
    return list(_advisories.values())
