# PortFlow Hackathon Demo Runbook

## Judge-facing positioning

PortFlow is a historical schedule simulator for port supervisors. It predicts port-day congestion, exposes the berth/crane assignment tradeoff, recommends alternate ports, and records a supervisor-approved diversion advisory. It is not connected to live AIS or port sensors.

## Start the demo

From the repository root:

```powershell
python -m pip install -r requirements.txt
Set-Location .\src\dashboard-ui
npm install
```

Open two terminals from the repository root.

**Terminal 1 — API**

```powershell
python -m uvicorn src.api.main:app --host 127.0.0.1 --port 8000
```

**Terminal 2 — dashboard**

```powershell
Set-Location .\src\dashboard-ui
npm run dev
```

Open the Vite URL, normally `http://localhost:5173`.

## Three-minute demo sequence

1. Start on **72-Hour Plan**. Point out that the plan is a historical simulation and show the risk, horizon, bottleneck, assignment coverage, and unassigned-vessel warning.
2. Open **Congestion Heatmap**. Select the highest-risk port and explain that the reasons come from the trained model inputs, not a generic alert.
3. Open **Berth Assignments**. Show that the optimizer reports partial coverage honestly instead of claiming every vessel is scheduled.
4. Open **Alternate Routes** and click **Recalculate**. Show the backend-derived recommendations, estimated wait, capacity, and reason.
5. Click **Issue Fleet Diversion Advisory**, confirm it, and point out the issued advisory ID and `historical-simulation` mode.
6. Open **3D Port Replay**. Explain that this is a schedule replay used to make the operational consequences visible, not live AIS.

## Claims to make

- The system moves from prediction to an operator action.
- Every displayed operational metric is computed from the repository data or explicitly labeled scenario data.
- The workflow is designed for supervisor review; it does not autonomously dispatch vessels.
- The current prototype is intentionally transparent about historical-data limitations.

## Claims not to make

- Do not call the replay live.
- Do not claim production deployment.
- Do not claim that the heuristic is a globally optimal schedule.
- Do not claim that an advisory changes real port operations; it is recorded in demo-mode API memory.

## Submission blockers

- Record a 3–5 minute video following the sequence above.
- Add at least three screenshots to `demo/screenshots/`.
- Add the actual slide deck to `presentation/`.
- Replace `demo/demo-video-link.txt` with the real video URL.
- Replace `demo/live-demo-url.txt` with a deployed URL, or clearly state that the judges should use the local runbook.
- Capture the final model metrics after any further retraining.
