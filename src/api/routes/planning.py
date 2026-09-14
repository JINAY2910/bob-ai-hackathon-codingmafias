from fastapi import APIRouter
from datetime import datetime, timedelta
from src.api.models import OperationsPlan
from src.planning.horizon_builder import generate_mock_operations_plan

router = APIRouter()

@router.get("", response_model=OperationsPlan)
def get_operations_plan(port_id: int = 1):
    """
    Generates the deterministic 72-hour Operations Plan.
    Combines prediction, optimization, and routing features.
    """
    now = datetime.utcnow()
    # In a full implementation, this calls:
    # 1. predictor
    # 2. optimizer
    # 3. router
    # 4. event_normalizer
    # 5. horizon_builder
    # 6. priority_engine
    # For MVP, we return a mock structured according to Phase 1 specs.
    
    plan = generate_mock_operations_plan(port_id, now)
    return plan
