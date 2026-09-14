import json
from typing import Dict, Any

class MockIBMBobLLM:
    """
    Mock implementation of the IBM Bob LLM for generating human-readable 
    executive summaries from structured operational JSON plans.
    """
    
    def __init__(self, model_version: str = "ibm-bob-v1"):
        self.model_version = model_version
        
    def generate_summary(self, plan_data: Dict[str, Any]) -> str:
        """
        Takes the deterministic operations plan and generates a plain-language explanation.
        In a real production system, this sends the JSON to WatsonX or OpenAI.
        """
        # We parse the incoming JSON to generate a context-aware mock response
        hotspots = plan_data.get("congestion_hotspots", [])
        actions = plan_data.get("critical_actions", [])
        
        summary = "Based on current predictions, "
        
        if not hotspots:
            summary += "the port is operating smoothly with no imminent congestion hotspots detected. "
        else:
            hs = hotspots[0]
            start_time = hs.get("start", "upcoming shift")
            prob = hs.get("probability", 0) * 100
            reasons = ", ".join(hs.get("reasons", ["high traffic"]))
            
            summary += (f"Berth {hs.get('berth_id')} is forecast to become highly congested "
                        f"(Risk: {prob:.0f}%) starting at {start_time} due to {reasons}. ")
                        
        if actions:
            urgent_actions = [a for a in actions if a.get("priority") in ["P0", "P1"]]
            if urgent_actions:
                act = urgent_actions[0]
                summary += (f"Immediate Approval Required ({act.get('priority')}): "
                            f"{act.get('description')} before {act.get('due_at')}. ")
            
        summary += ("\n\nIBM Bob Recommends: Execute the automated Optimizer assignments to minimize "
                    "vessel turnaround time and clear the backlog.")
                    
        return summary

# Singleton instance for the router to import
ibm_bob_llm = MockIBMBobLLM()

def generate_executive_summary(plan_data: Dict[str, Any]) -> str:
    """
    Wrapper function to be called by the horizon builder.
    """
    return ibm_bob_llm.generate_summary(plan_data)
