# PortFlow (Coding Mafias)

## Team
- **Team Name**: Coding Mafias
- **Track**: Logistics & Ports
- **Lead**: Yug Yadav
- **Members**: Jinay Shah, Bhumi Shah, Bhavika Patel

## Problem Statement
Port operators allocate berths, cranes, and yard space across hundreds of vessels manually in spreadsheets. Congestion hotspots are identified reactively, after vessels are already queuing, and by the time alternate routing decisions are made it is too late to help — the 2021 LA/Long Beach backlog had 100+ ships waiting offshore for weeks, costing global supply chains over $10B.

## Solution
PortFlow predicts congestion hotspots ahead of time using vessel schedule and berth capacity data, recommends alternate routing strategies for vessels likely to be delayed, optimises berth and crane assignments to reduce turnaround time, and generates a rolling 72-hour port operations plan for shift supervisors.

## Key Features
- Congestion hotspot prediction from vessel ETAs and berth/yard capacity data
- Berth and quay-crane assignment optimiser to reduce vessel waiting time
- Alternate routing recommendations for vessels facing predicted delays
- 72-hour rolling port operations plan generated for shift supervisors
- IBM Bob-guided investigation of why a hotspot is forming, in plain language

## Tech Stack
Our solution utilizes Python (FastAPI) for the prediction and optimisation backend. We leverage a lightweight optimisation library (such as OR-Tools or a Pyomo/CBC model) for berth-crane assignment. The dashboard is built using React to provide a fast and responsive user interface, while PostgreSQL or SQLite is used for schedule and berth data. We also use IBM Bob for planning and building the pipeline.

## How to Run
1. Install Python 3.10+ and Node.js 18+.
2. Clone this repository and place your dataset files into the `data/raw/` directory.
3. Copy `src/.env.example` to `src/.env` and update the variables as needed.
4. Run the data ingestion script and backend server using `python -m src.api.main` (from `src/` folder) and start the frontend using `npm run dev` in the `src/dashboard/` folder.

## Demo
- **Video**: [Demo Video Link](./demo/demo-video-link.txt)
- **Live Demo**: NOT DEPLOYED
- **Screenshots**: [View Screenshots](./demo/screenshots)

## Known Limitations
Real port sensor and AIS feeds aren't currently available for this prototype. As a result, a public dataset and a simulated vessel schedule stream are used instead of real-time incoming live data. The predictive model assumes deterministic travel times between ports, which may vary in real-world scenarios.

## What We're Most Proud Of
We are most proud of our congestion-hotspot prediction mechanism, which shifts the paradigm from just tracking current queues to proactively anticipating delays. Furthermore, generating a comprehensive 72-hour rolling operations plan brings immediate, actionable value to shift supervisors managing these immense logistics hubs.
