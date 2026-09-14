from fastapi import APIRouter
from datetime import datetime, timedelta
from typing import Optional
from src.api.models import CongestionPrediction, Hotspot

router = APIRouter()

@router.get("", response_model=CongestionPrediction)
def get_hotspots(port_id: int = 1):
    """
    Returns predicted congestion hotspots for a given port.
    Currently returns mocked data structured from the ML pipeline output.
    """
    # Mock data representing the prediction feature output
    now = datetime.utcnow()
    return CongestionPrediction(
        port_id=port_id,
        port_name="Port of Spain",
        forecast_start=now,
        forecast_end=now + timedelta(days=3),
        risk_level="HIGH",
        congestion_probability=0.87,
        predicted_hotspots=[
            Hotspot(
                start=now + timedelta(hours=14),
                end=now + timedelta(hours=18),
                berth_id="B3",
                probability=0.91,
                reasons=[
                    "12 arrivals expected in the next 24 hours",
                    "Berth utilization projected above 100%"
                ]
            )
        ]
    )
