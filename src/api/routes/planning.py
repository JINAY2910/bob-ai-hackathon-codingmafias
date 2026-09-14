from fastapi import APIRouter
from datetime import datetime
from typing import Optional
from src.api.models import OperationsPlan
from src.planning.horizon_builder import generate_operations_plan

router = APIRouter()

@router.get("", response_model=OperationsPlan)
def get_operations_plan(port_id: int = 1, as_of: Optional[datetime] = None):
    """
    Generates the deterministic 72-hour Operations Plan.
    Combines prediction, optimization, and routing features.
    """
    return generate_operations_plan(port_id, as_of)
