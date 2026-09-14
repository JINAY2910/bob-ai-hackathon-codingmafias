# Solution Overview

PortFlow is an end-to-end Predictive Command Center designed to shift global port operations from a reactive state to a proactive state. 

## The Core Mechanism
PortFlow solves the scheduling bottleneck through a 4-pillar approach:

1.  **Predict (Early Warning System):**
    We train an XGBoost AI model on historical vessel ETA and physical berth capacity data to predict congestion hotspots 1-3 days before they happen. 

2.  **Optimize (Heuristic Scheduling):**
    We use a deterministic heuristic algorithm to automatically assign incoming vessels to physical berths and quay-cranes. This algorithm proves that optimization reduces average waiting time by finding the perfect docking slot while strictly adhering to physical constraints (vessel draft, berth length).

3.  **Mitigate (Alternate Routing):**
    If a port is predicted to be a hotspot, our Graph Search engine cross-references global shipping lane data (`segments_port2port.csv`) to instantly recommend the Top 3 alternate ports based on historical traffic flow and available parking spots.

4.  **Execute (72-Hour Plan & Explainability):**
    We slice the optimizer's master schedule to generate a rolling 72-hour operational shift plan. To ensure this plan is understandable, we route the metrics through the **IBM Bob LLM CLI**, which generates a 3-sentence, plain-English summary of the risks, bottlenecks, and recommended actions for the shift supervisor.

## What makes it different?
Naive alternatives simply build a dashboard displaying *current* active vessels. This doesn't solve the problem, because once a vessel is at the port, it's too late. PortFlow uses AI to predict the future state of the port and math to re-route ships *before* they arrive.

## Key Design Decisions
*   **XGBoost over Deep Learning:** We chose XGBoost for the prediction engine because it is robust to outliers (e.g., storms delaying ships) and handles class imbalance well (since "congestion" happens less frequently than "normal" days).
*   **Algorithm over AI for Scheduling:** We chose a deterministic algorithm (not Machine Learning) for the Berth Optimizer because port scheduling is a combinatorial optimization problem with strict physical laws (a 200m ship cannot dock at a 150m berth).
*   **IBM Bob as an "Explainability Layer":** We did not use LLMs to perform math. Instead, we used IBM Bob exclusively to translate raw probability scores and utilization metrics into human-readable alerts.

## The User Experience
A shift supervisor logs into a modern React/Vite web dashboard. They immediately see a map flagging their port as "High Risk" for tomorrow. Beside it, an IBM Bob-generated text box explains exactly why (e.g., "94% berth utilization expected"). Below that, they see their 72-hour shift itinerary detailing exactly which ships to assign to which cranes, and a list of alternate ports they can contact to divert incoming traffic.
