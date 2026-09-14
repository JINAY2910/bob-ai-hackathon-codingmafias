# PortFlow

<<<<<<< Updated upstream
**Track:** Logistics & Ports

**Team:** Coding Mafias
*   **Bhumi Shah** (Lead) - `24it089@charusat.edu.in`
*   **Yug Yadav** - `24it112@charusat.edu.in`
*   **Jinay Shah** - `24it091@charusat.edu.in`
*   **Bhavika Patel** - `24it062@charusat.edu.in`

---
=======
> **Demo mode:** PortFlow currently runs as a historical schedule simulator using 2019 public data. It is not connected to live AIS or port sensors. All forecasts and assignments should be treated as decision-support outputs, not production dispatch instructions.

## Team
- **Team Name**: Coding Mafias
- **Track**: Logistics & Ports
- **Lead**: Yug Yadav
- **Members**: Jinay Shah, Bhumi Shah, Bhavika Patel
>>>>>>> Stashed changes

## Problem Statement

Port scheduling is overwhelmingly manual and reactive. Operators allocate berths and cranes using spreadsheets. By the time congestion is noticed, massive queues of ships have already formed offshore. Our data analysis of 2019 historical data showed bottlenecks so severe that average waiting times spiked to 41 days. In 2021, the LA/Long Beach backlog cost global supply chains over $10B in stranded capital and wasted fuel.

## Solution

PortFlow is an End-to-End Predictive Command Center. It uses an XGBoost AI model to predict congestion hotspots 1-3 days in advance, a deterministic heuristic algorithm to perfectly optimize berth and crane assignments, and a Graph Search engine to recommend alternate routing detours. Finally, it generates a rolling 72-hour operational plan for shift supervisors, translated into plain English by IBM Bob.

## Key Features

*   **Congestion Hotspot Prediction:** Predicts port gridlock before it happens using ETAs and capacity data.
*   **Berth & Crane Optimizer:** Heuristic scheduler that strictly adheres to physical vessel constraints to minimize waiting time.
*   **Alternate Routing Engine:** Calculates viability scores across the global maritime network to recommend the Top 3 detour ports.
*   **72-Hour Shift Plan:** Auto-generates a localized, time-windowed itinerary for incoming vessels.
*   **IBM Bob Explainability:** Translates raw AI probabilities and utilization metrics into a human-readable 3-sentence summary.

## Tech Stack

*   **AI/Data:** Python, Pandas, Scikit-Learn, XGBoost
*   **Backend:** FastAPI, Uvicorn
*   **Frontend:** React, Vite, TailwindCSS (via UI components)
*   **IBM Tech:** IBM Bob CLI (Watsonx powered)

## How to Run

<<<<<<< Updated upstream
Please see [`docs/setup-guide.md`](docs/setup-guide.md) for complete, step-by-step instructions on running the backend and frontend simultaneously.

## Demo

*   **Demo Video:** [View our 3-minute Demo Video](demo/demo-video-link.txt)
*   **Live App:** [NOT DEPLOYED](demo/live-demo-url.txt)
*   **Screenshots:** See the `demo/screenshots/` folder.
=======
**1. Install backend dependencies**
```bash
python -m pip install -r requirements.txt
```

**2. Start the FastAPI Backend**
Run the backend server from the root of the project:
```bash
python -m uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload
```

**3. Start the React Dashboard**
In a new terminal window, start the frontend development server:
```bash
cd src/dashboard-ui
npm run dev
```

The dashboard includes a **3D Port Replay** view. It reads the schedule-backed scene from:
```text
GET /api/v1/visualization/scene?port_id=1&at=2019-01-03T12:00:00Z
```
The replay shows simulated vessel movement, berth risk, crane status, routes, direction, and service/departure times. Positions are derived from the historical schedule and are not live AIS positions.

The backend health check is available at `http://localhost:8000/health` and reports
`historical-simulation` mode so the UI never has to imply that the data is live.

**4. Run the ML Pipelines (Standalone)**
You can also run the underlying data engineering and machine learning scripts directly:
```bash
python src/data_processing.py
python src/feature_engineering.py
python src/train_model.py
python src/optimizer/run_optimizer.py
python src/routing/alternate_routing.py
```

## Demo
- **Video**: [Demo Video Link](./demo/demo-video-link.txt)
- **Live Demo**: NOT DEPLOYED
- **Screenshots**: [View Screenshots](./demo/screenshots)
- **Judge Runbook**: [Three-minute demo script](./docs/demo-runbook.md)
- **Implementation Changes**: [Complete change summary](./docs/implementation-changes.md)
>>>>>>> Stashed changes

## Known Limitations

*   **Historical Data Constraint:** Because we are using 2019 hackathon data, the "72-hour rolling window" operates on a simulated date (e.g., Nov 1st, 2019) rather than today's actual date.
*   **Geographic Distance:** We used "historical shipping lane traffic volume" as a proxy for geographic distance in our Alternate Routing engine to keep the MVP lightweight, rather than parsing raw PostGIS Hex coordinates.

## What We're Most Proud Of

We are most proud of our **Optimizer's mathematical proof**. When we ran our heuristic scheduler against the full 1.48 million historical vessel records, it definitively proved that 858,000 vessels were fundamentally unassignable due to physical capacity constraints. This mathematically validated our entire project thesis: *Optimization alone is not enough; you must predict and reroute traffic before it arrives.*
