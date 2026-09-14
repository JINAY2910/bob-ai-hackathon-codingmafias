from functools import lru_cache
from pathlib import Path
from fastapi import APIRouter, HTTPException
from datetime import timedelta
from typing import List
import pickle
import pandas as pd
from src.api.models import CongestionPrediction, Hotspot

router = APIRouter()

ROOT_DIR = Path(__file__).resolve().parents[3]
FEATURES_FILE = ROOT_DIR / "data" / "processed" / "engineered_features.csv"
MODEL_FILE = ROOT_DIR / "models" / "congestion_model.pkl"
MODEL_FEATURES = [
    "active_vessels", "vessel_arrivals", "vessel_departures",
    "arrivals_next_1d", "arrivals_next_3d_sum", "total_berths",
    "berth_utilization_ratio",
]


@lru_cache(maxsize=1)
def _load_predictions() -> List[CongestionPrediction]:
    if not FEATURES_FILE.exists() or not MODEL_FILE.exists():
        raise FileNotFoundError("Feature 1 engineered data or trained model is missing")
    features = pd.read_csv(FEATURES_FILE)
    features["date"] = pd.to_datetime(features["date"], errors="coerce")
    latest_date = features["date"].max()
    latest = features[features["date"].eq(latest_date)].copy()
    latest[MODEL_FEATURES] = latest[MODEL_FEATURES].apply(pd.to_numeric, errors="coerce").fillna(0)
    with MODEL_FILE.open("rb") as model_file:
        model = pickle.load(model_file)
    latest["probability"] = model.predict_proba(latest[MODEL_FEATURES])[:, 1]

    names_file = ROOT_DIR / "data" / "raw" / "ports.csv"
    names = pd.read_csv(names_file, sep="|", usecols=["id", "portname"])
    names["id"] = pd.to_numeric(names["id"], errors="coerce")
    latest = latest.merge(names, left_on="port", right_on="id", how="left")

    predictions = []
    for row in latest.sort_values("probability", ascending=False).itertuples(index=False):
        probability = float(row.probability)
        risk = "HIGH" if probability >= 0.75 else "MEDIUM" if probability >= 0.5 else "LOW"
        arrivals = int(row.vessel_arrivals)
        active_vessels = int(row.active_vessels)
        berth_ratio = float(row.berth_utilization_ratio)
        next_day = int(row.arrivals_next_1d)
        next_three_days = int(row.arrivals_next_3d_sum)
        reasons = []
        if arrivals:
            reasons.append(f"{arrivals} vessel arrivals in the observed day")
        else:
            reasons.append("No same-day arrivals; risk is driven by vessels already active or expected next")
        if active_vessels:
            reasons.append(f"{active_vessels} active vessels against {float(row.total_berths):.0f} berths")
        if berth_ratio >= 1:
            reasons.append(f"berth utilization at {berth_ratio:.2f}x capacity")
        elif berth_ratio >= 0.75:
            reasons.append(f"berth utilization at {berth_ratio:.0%} of capacity")
        if next_day or next_three_days:
            reasons.append(f"{next_day} arrivals next day and {next_three_days} projected over 3 days")
            if next_three_days > float(row.total_berths):
                reasons.append(
                    f"projected 3-day demand exceeds capacity ({next_three_days} arrivals vs {float(row.total_berths):.0f} berth)"
                )
        predictions.append(CongestionPrediction(
            port_id=int(row.port),
            port_name=str(row.portname) if pd.notna(row.portname) else f"Port {int(row.port)}",
            forecast_start=latest_date.to_pydatetime(),
            forecast_end=(latest_date + timedelta(days=1)).to_pydatetime(),
            risk_level=risk,
            congestion_probability=round(probability, 4),
            predicted_hotspots=[Hotspot(
                start=latest_date.to_pydatetime(),
                end=(latest_date + timedelta(days=1)).to_pydatetime(),
                berth_id="PORT-WIDE",
                probability=round(probability, 4),
                reasons=reasons,
            )] if probability >= 0.35 else [],
        ))
    return predictions


@router.get("", response_model=CongestionPrediction)
def get_hotspots(port_id: int = 1):
    """Return the real Feature 1 prediction for one port."""
    try:
        prediction = next(item for item in _load_predictions() if item.port_id == port_id)
    except FileNotFoundError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except StopIteration as error:
        raise HTTPException(status_code=404, detail=f"No prediction found for port {port_id}") from error
    return prediction


@router.get("/all", response_model=List[CongestionPrediction])
def get_all_hotspots():
    """Return the latest historical Feature 1 prediction for every port."""
    try:
        return _load_predictions()
    except FileNotFoundError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
