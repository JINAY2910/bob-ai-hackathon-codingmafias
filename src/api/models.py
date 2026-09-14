from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class Hotspot(BaseModel):
    start: datetime
    end: datetime
    berth_id: str
    probability: float
    reasons: List[str]

class CongestionPrediction(BaseModel):
    port_id: int
    port_name: str
    forecast_start: datetime
    forecast_end: datetime
    risk_level: str
    congestion_probability: float
    predicted_hotspots: List[Hotspot]

class OptimizationObjective(BaseModel):
    total_wait_minutes: float
    berth_conflicts: int
    crane_utilization: float

class BerthAssignment(BaseModel):
    vessel_id: str
    berth_id: str
    arrival_time: datetime
    service_start: datetime
    service_end: datetime
    crane_ids: List[str]
    original_berth_id: Optional[str] = None
    change_type: Optional[str] = None
    estimated_wait_minutes: float

class OptimizerOutput(BaseModel):
    optimization_run_id: str
    status: str
    assignments: List[BerthAssignment]
    objective: OptimizationObjective
    constraints_satisfied: bool

class AlternateOption(BaseModel):
    berth_id: str
    expected_wait_minutes: float

class Recommendation(BaseModel):
    vessel_id: str
    recommendation_type: str
    current_option: AlternateOption
    recommended_option: AlternateOption
    reason: str
    confidence: float
    requires_supervisor_approval: bool

class RoutingRecommenderOutput(BaseModel):
    recommendations: List[Recommendation]

class CanonicalEvent(BaseModel):
    event_id: str
    event_type: str
    severity: str
    port_id: int
    vessel_id: str
    berth_id: Optional[str] = None
    recommended_berth_id: Optional[str] = None
    start_time: datetime
    end_time: datetime
    expected_impact: Dict[str, Any]
    reason_codes: List[str]
    confidence: float
    requires_approval: bool
    source_refs: List[str]

class ShiftAction(BaseModel):
    action_id: str
    priority: str
    owner_role: str
    description: str
    due_at: datetime
    status: str
    fallback: Optional[str] = None

class TimeBlock(BaseModel):
    start: datetime
    end: datetime

class Risk(BaseModel):
    level: str
    hotspots: List[str]

class PlannedOperation(BaseModel):
    vessel_id: str
    action: str
    berth_id: str
    cranes: List[str]

class Contingency(BaseModel):
    trigger: str
    fallback: str

class ShiftBlock(BaseModel):
    time_block: TimeBlock
    risk: Risk
    planned_operations: List[PlannedOperation]
    supervisor_actions: List[ShiftAction]
    contingencies: List[Contingency]

class OperationsPlan(BaseModel):
    plan_id: str
    generated_at: datetime
    valid_until: datetime
    status: str
    executive_summary: str
    overall_risk: str
    shifts: List[ShiftBlock]
    critical_actions: List[ShiftAction]
    congestion_hotspots: List[Hotspot]
    resource_plan: List[Dict[str, Any]]
    contingencies: List[Contingency]
    assumptions: List[str]
    model_metadata: Dict[str, str]
