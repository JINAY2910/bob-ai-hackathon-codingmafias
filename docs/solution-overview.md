# Solution Overview

## What We Built

PortFlow is an end-to-end Predictive Command Center designed to shift global port operations from a reactive state to a proactive state. Instead of just showing shift supervisors what is happening right now, our dashboard predicts what will happen in 3 days, automatically schedules incoming ships to the perfect parking spots, and recommends alternate detour ports for ships that are going to get stuck.

## How It Works

1. **Predict:** An XGBoost AI model trains on historical vessel ETA and physical berth capacity data to predict congestion hotspots 1-3 days before they happen.
2. **Optimize:** A deterministic heuristic algorithm automatically assigns incoming vessels to physical berths and quay-cranes, strictly adhering to physical constraints (like vessel draft and berth length).
3. **Mitigate:** If a port is predicted to be a hotspot, our Graph Search engine cross-references global shipping lane data to instantly recommend the Top 3 alternate detour ports.
4. **Execute & Explain:** The backend slices the master schedule into a rolling 72-hour operational plan. It then uses the IBM Bob CLI to generate a 3-sentence, plain-English summary of the risks and bottlenecks for the shift supervisor.

## Architecture Diagram

> See [`architecture.md`](architecture.md) for the detailed diagram.

```
[Shift Supervisor] → [Frontend: React] → [API: FastAPI] → [IBM Bob CLI]
                                                ↓
                                      [Pre-computed CSV DBs]
                                      (XGBoost & Heuristics)
```

## Key Design Decisions

| Decision | Rationale |
|---|---|
| Used XGBoost for Prediction | XGBoost is highly robust to outliers (e.g., storms delaying ships) and handles class imbalance well (since "congestion" happens less frequently than "normal" days) compared to Deep Learning. |
| Deterministic Algorithm for Scheduling | Port scheduling is a combinatorial optimization problem with strict physical laws (a 200m ship cannot dock at a 150m berth). Mathematical heuristics are safer and more reliable here than Machine Learning. |
| Offline Batch Processing | By separating the heavy mathematical calculations from the API Serving layer, our dashboard UI loads instantly for the user, reading only static results. |

## IBM Technologies Used

- **IBM Bob CLI:** We integrated IBM Bob directly into our Python Orchestration layer (`llm_planner.py`). Instead of using an LLM to do raw math, we used IBM Bob as an "Explainability Layer". It takes the raw numerical probabilities and utilization metrics from our XGBoost model and translates them into a 3-sentence, plain-English executive summary for the shift supervisor (e.g., *"HIGH congestion risk at Port 1. Berth utilization is 94%..."*). We also built a robust fallback generator to ensure 100% demo reliability.
