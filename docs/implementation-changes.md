# PortFlow Implementation Changes

This document summarizes the changes made during the credibility and hackathon-readiness implementation pass.

## 1. Backend API changes

### `src/api/main.py`

- Added `GET /health`.
- Health response identifies the application as:

  ```json
  {
    "status": "ok",
    "mode": "historical-simulation"
  }
  ```

- Replaced wildcard CORS configuration with configurable local origins.
- Supported environment variable:

  ```text
  CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
  ```

### `src/api/models.py`

Extended `OptimizerOutput` with:

- `vessels_total`
- `vessels_assigned`
- `vessels_unassigned`
- `assignment_rate`
- `crane_utilization`
- `limitations`

Added advisory models:

- `DiversionAdvisoryRequest`
- `DiversionAdvisory`

Extended `AlternateOption` with:

- `port_name`
- `available_capacity`

### `src/api/routes/optimization.py`

- Removed the fake failure response that returned an empty successful-looking result.
- Missing or invalid optimizer inputs now return an HTTP 503 error.
- Missing port results now return HTTP 404.
- Optimizer status is now honest:
  - `FEASIBLE`
  - `FEASIBLE_CACHED`
  - `PARTIAL`
  - `PARTIAL_CACHED`
- Added real vessel assignment counts.
- Added real assignment coverage.
- Added calculated crane utilization based on assigned crane-hours and available crane-hours.
- Added limitations explaining unassigned vessels and the heuristic nature of the scheduler.
- `constraints_satisfied` is no longer always `True`.

### `src/api/routes/alternate_routes.py`

- Replaced broad exception swallowing with explicit HTTP errors.
- Uses repository-root paths consistently.
- Routing wait estimates now use optimizer summary and berth capacity data instead of fixed values.
- Recommendations now expose alternate port names and capacity.
- Added advisory endpoints:

  ```text
  POST /api/v1/alternate-routes/advisory
  GET  /api/v1/alternate-routes/advisories
  ```

- Advisory records include:
  - Advisory ID
  - Origin port
  - Alternate port
  - Vessel ID
  - Reason
  - Issued timestamp
  - `historical-simulation` mode

- Advisories are stored in process memory for the current demo session.

## 2. Data and machine-learning changes

### `src/feature_engineering.py`

Fixed the grouped rolling calculation for:

```text
arrivals_next_3d_sum
```

The previous implementation could allow rolling values from one port to influence another port. The calculation is now performed independently within each port group.

### Generated model artifacts

After correcting feature engineering:

- Regenerated `data/processed/engineered_features.csv`.
- Retrained `models/congestion_model.pkl`.

The corrected model evaluation remained approximately:

- ROC-AUC: `0.9290`
- Accuracy: `0.8036`
- Congestion recall: `0.94`
- Congestion precision: `0.42`

These metrics should be presented with the precision/recall tradeoff, not accuracy alone.

## 3. Planning and explanation changes

### `src/planning/horizon_builder.py`

Added calculated planning metrics:

- Vessels in horizon
- Assigned vessels
- Unassigned vessels
- Assignment rate
- Average wait hours
- Maximum wait hours

These values are included in the generated resource plan.

### `src/orchestration/llm_planner.py`

Removed fabricated summary metrics such as:

- Fixed 94% berth utilization
- Fixed 6.4-hour waiting time
- Fixed four-crane recommendation

Executive summaries now use calculated assignment and waiting metrics. The fallback explanation explicitly reports assignment coverage and unassigned vessels.

## 4. Frontend changes

### `src/dashboard-ui/src/App.jsx`

- Removed the operations-plan mock fallback.
- The operations page now shows an error if the backend is unavailable instead of displaying fake operational data.
- Added historical-simulation labeling.
- Updated berth assignment cards to show:
  - Assignment coverage
  - Total vessels
  - Assigned vessels
  - Unassigned vessels
  - Partial optimizer status
- Added warning text for incomplete schedules.
- Added backend routing recommendation loading.
- Added live recommendation status panel.
- The diversion approval button now calls the advisory API.
- The UI displays the real issued advisory ID.
- Static diversion comparison values are explicitly labeled as scenario data.
- The 3D replay remains identified as a historical schedule replay, not live AIS.

### `src/dashboard-ui/src/index.css`

Added styles for:

- Partial optimizer warnings.
- Assignment coverage warnings.
- Backend-derived routing recommendations.

## 5. Dependency and documentation changes

### `requirements.txt`

Added a tracked Python dependency manifest containing:

- FastAPI
- Uvicorn
- Pandas
- NumPy
- Scikit-learn
- XGBoost
- Python-dotenv

### `README.md`

- Added an explicit historical-simulation disclaimer.
- Added backend dependency installation.
- Corrected dashboard startup path.
- Added health endpoint documentation.
- Linked the demo runbook.

### `docs/setup-guide.md`

- Removed references to PostgreSQL/SQLite that are not required by the current prototype.
- Removed references to nonexistent ingestion modules.
- Corrected `src/dashboard-ui` paths.
- Added reproducible data rebuild commands.
- Added advisory API verification commands.
- Documented in-memory advisory behavior.

### `docs/demo-runbook.md`

Added a judge-facing runbook containing:

- Exact startup commands.
- Three-minute demonstration sequence.
- Honest claims to make.
- Claims to avoid.
- Submission blockers.

## 6. Validation performed

The following checks passed:

```powershell
python -m compileall -q src
```

```powershell
Set-Location .\src\dashboard-ui
npm run build
```

Targeted backend checks passed for:

- Health endpoint behavior.
- Corrected feature/model pipeline.
- Partial optimizer reporting.
- Backend-derived routing recommendations.
- Advisory creation and listing.

Frontend lint completes with warnings, not errors. Remaining warnings include unused imports and React hook dependency warnings.

## 7. Current submission status

### Completed

- Honest backend metrics.
- Leakage correction.
- Model retraining.
- Backend routing recommendations.
- Advisory workflow.
- Historical-mode labeling.
- Reproducible setup documentation.
- Judge demo runbook.

### Still required before final submission

- Record a real 3–5 minute demo video.
- Replace `demo/demo-video-link.txt`.
- Add at least three screenshots to `demo/screenshots/`.
- Add the actual presentation deck to `presentation/`.
- Replace `demo/live-demo-url.txt` with a deployed URL or clearly retain the local-run instructions.
- Ideally make advisory approval trigger a measured before/after replanning result.
- Ideally replace the remaining static diversion comparison table with fully backend-derived values.

## 8. Important prototype limitation

PortFlow is currently a historical schedule simulator. It is not connected to live AIS, live port sensors, or a production database. Advisory records are stored only in API process memory and disappear when the backend restarts.
