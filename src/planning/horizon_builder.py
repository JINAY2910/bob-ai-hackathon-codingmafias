from datetime import datetime, timedelta
from typing import Dict, Any
from src.orchestration.llm_planner import generate_executive_summary

def generate_mock_operations_plan(port_id: int, as_of: datetime) -> Dict[str, Any]:
    """
    Mock implementation of the horizon builder to return a 72-hour plan.
    """
    valid_until = as_of + timedelta(days=3)
    
    plan = {
        "plan_id": f"plan-{as_of.strftime('%Y-%m-%d')}-001",
        "generated_at": as_of,
        "valid_until": valid_until,
        "status": "READY_FOR_REVIEW",
        "overall_risk": "HIGH",
        "shifts": [
            {
                "time_block": { "start": as_of, "end": as_of + timedelta(hours=24) },
                "risk": { "level": "HIGH", "hotspots": ["B3"] },
                "planned_operations": [
                    { "vessel_id": "VESSEL-X", "action": "ARRIVE", "berth_id": "B7", "cranes": ["Q2", "Q3"] }
                ],
                "supervisor_actions": [
                    { "action_id": "act-1001", "priority": "P0", "owner_role": "SHIFT_SUPERVISOR", "description": "Approve Vessel X reassignment from B3 to B7", "due_at": as_of + timedelta(minutes=30), "status": "PENDING_APPROVAL" }
                ],
                "contingencies": [
                    { "trigger": "B7 unavailable", "fallback": "Hold Vessel X offshore and assign B5" }
                ]
            },
            {
                "time_block": { "start": as_of + timedelta(hours=24), "end": as_of + timedelta(hours=48) },
                "risk": { "level": "MEDIUM", "hotspots": ["B1"] },
                "planned_operations": [
                    { "vessel_id": "VESSEL-Y", "action": "DEPART", "berth_id": "B1", "cranes": [] }
                ],
                "supervisor_actions": [
                    { "action_id": "act-1002", "priority": "P1", "owner_role": "MAINTENANCE_SUPERVISOR", "description": "Confirm crane maintenance schedule for Q4", "due_at": as_of + timedelta(hours=26), "status": "OPEN" }
                ],
                "contingencies": []
            },
            {
                "time_block": { "start": as_of + timedelta(hours=48), "end": as_of + timedelta(hours=72) },
                "risk": { "level": "LOW", "hotspots": [] },
                "planned_operations": [
                    { "vessel_id": "VESSEL-Z", "action": "ARRIVE", "berth_id": "B2", "cranes": ["Q1"] }
                ],
                "supervisor_actions": [],
                "contingencies": []
            }
        ],
        "critical_actions": [
            { "action_id": "act-1001", "priority": "P0", "owner_role": "SHIFT_SUPERVISOR", "description": "Approve Vessel X reassignment from B3 to B7", "due_at": as_of + timedelta(minutes=30), "status": "PENDING_APPROVAL" }
        ],
        "congestion_hotspots": [
            { "start": as_of + timedelta(hours=2), "end": as_of + timedelta(hours=6), "berth_id": "B3", "probability": 0.91, "reasons": ["12 arrivals expected in the next 24 hours"] }
        ],
        "resource_plan": [],
        "contingencies": [],
        "assumptions": ["Assuming deterministic travel times"],
        "model_metadata": {
            "prediction_model_version": "congestion-v1",
            "optimizer_run_id": "opt-456",
            "llm_model": "ibm-bob-v1",
            "rules_version": "port-manual-v3.2"
        }
    }
    
    # Let IBM Bob LLM generate the human-readable summary based on the deterministic events
    plan["executive_summary"] = generate_executive_summary(plan)
    
    return plan
