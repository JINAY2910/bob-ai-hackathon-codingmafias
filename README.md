# 🚀 PortFlow

---

## 👥 Team

| Field | Value |
|---|---|
| **Team Name** | Coding Mafias |
| **Track** | Logistics & Ports |
| **Team Lead** | Bhumi Shah — 24it089@charusat.edu.in |
| **Members** | Yug Yadav, Jinay Shah, Bhavika Patel |

---

## 🎯 Problem Statement

Port scheduling is overwhelmingly manual and reactive, relying on spreadsheets to allocate berths and cranes. Because operators have zero visibility into future congestion, massive bottlenecks form offshore—causing extreme delays (up to 41 days of waiting time) and costing global supply chains billions of dollars in wasted fuel and stranded capital.

---

## 💡 Solution

PortFlow is an End-to-End Predictive Command Center that shifts operations from reactive to proactive. It uses AI to predict congestion hotspots days in advance, a heuristic algorithm to automatically assign incoming ships to physical berths and cranes, and an Alternate Routing Engine to detour delayed ships before they even arrive.

---

## ✨ Key Features

- **Feature 1:** Congestion Hotspot Prediction using an XGBoost AI model to forecast port gridlock before it happens.
- **Feature 2:** Berth & Crane Optimizer that acts as a heuristic scheduler strictly adhering to physical vessel constraints.
- **Feature 3:** Alternate Routing Engine that calculates global network viability scores to recommend the Top 3 detour ports.
- **Feature 4:** 72-Hour Shift Plan that auto-generates a localized, time-windowed itinerary for shift supervisors.
- **Feature 5:** IBM Bob Explainability Layer that translates raw AI probabilities into plain-English summaries.

---

## 🛠️ Tech Stack

| Category | Technologies |
|---|---|
| **Languages** | Python, JavaScript (JSX) |
| **Frameworks** | FastAPI, React, Vite, TailwindCSS |
| **IBM Technologies** | IBM Bob CLI (Watsonx powered) |
| **Databases** | Pandas/CSV (Static pre-computed datasets) |
| **Other** | Scikit-Learn, XGBoost |

---

## 📁 Repository Structure

```
├── src/                  # All source code (FastAPI backend + React frontend)
├── docs/                 # Written documentation
│   ├── problem-statement.md
│   ├── solution-overview.md
│   ├── architecture.md
│   └── setup-guide.md
├── demo/                 # Demo artifacts
│   ├── screenshots/      # App screenshots
│   └── demo-video-link.txt  # Link to demo video
├── presentation/         # Slide deck
└── submission.yaml       # Structured submission metadata
```

---

## ⚡ How to Run

```bash
# 1. Clone the repo and navigate into it
git clone https://github.com/JINAY2910/bob-ai-hackathon-codingmafias.git
cd bob-ai-hackathon-codingmafias

# 2. Start the Backend API (Terminal 1)
python3 -m venv .venv
source .venv/bin/activate
pip install fastapi uvicorn pandas xgboost scikit-learn numpy
uvicorn src.api.main:app --reload

# 3. Start the Frontend Dashboard (Terminal 2)
cd src/dashboard-ui
npm install
npm run dev
```
*Note: Ensure you have your `BOB_API_KEY` set in `src/.env` to enable the IBM Bob explainability feature!*

---

## 🖥️ Demo

| Artifact | Link |
|---|---|
| 📹 Demo Video | [See demo/demo-video-link.txt](demo/demo-video-link.txt) |
| 🌐 Live Demo | [See demo/live-demo-url.txt](demo/live-demo-url.txt) |
| 🖼️ Screenshots | [See demo/screenshots/](demo/screenshots/) |
| 📊 Presentation | [See presentation/](presentation/) |

---

## ⚠️ Known Limitations

- **Historical Data Constraint:** Because we are using 2019 hackathon data, the "72-hour rolling window" operates on a simulated date (e.g., Nov 1st, 2019) rather than today's actual date.
- **Geographic Distance Proxy:** We used "historical shipping lane traffic volume" as a proxy for geographic distance in our Alternate Routing engine to keep the MVP lightweight, rather than parsing raw PostGIS Hex coordinates.

---

## 🏅 What We're Most Proud Of

We are most proud of our **Optimizer's mathematical proof**. When we ran our heuristic scheduler against the full 1.48 million historical vessel records, it definitively proved that 858,000 vessels were fundamentally unassignable due to physical capacity constraints. This mathematically validated our entire project thesis: *Optimization alone is not enough; you must predict and reroute traffic before it arrives.*
