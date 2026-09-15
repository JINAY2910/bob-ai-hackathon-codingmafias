# Setup Guide

> **This file is read by the automated evaluation pipeline. Be precise and complete.**

## Prerequisites

Before you begin, ensure you have the following installed:

- [x] Python 3.10+
- [x] Node.js 18+ and npm
- [x] IBM Bob CLI installed and accessible in your system PATH
- [x] An active IBM Bob / watsonx.ai API Key

## Environment Variables

Copy `src/.env.example` to `src/.env` (or create a new `.env` file in the `src/` folder) and fill in the values:

```bash
touch src/.env
```

| Variable | Description | Required |
|---|---|---|
| `BOB_API_KEY` | Your IBM Bob API key | Yes |
| `USE_BOB` | Set to `True` to enable LLM generation | Yes |
| `PORT` | The port for the backend server (default 8000) | No |
| `DATA_DIR` | Path to the data directory (default `./data`) | No |

## Installation

```bash
# 1. Clone the repository
git clone https://github.com/JINAY2910/bob-ai-hackathon-codingmafias.git
cd bob-ai-hackathon-codingmafias

# 2. Install backend dependencies
python3 -m venv .venv
source .venv/bin/activate
pip install fastapi uvicorn pandas xgboost scikit-learn numpy

# 3. Install frontend dependencies
cd src/dashboard-ui
npm install
cd ../..
```

## Running the Application

You must run the backend and frontend simultaneously in separate terminals.

```bash
# Terminal 1: Start the backend (Ensure .venv is activated!)
source .venv/bin/activate
uvicorn src.api.main:app --reload

# Terminal 2: Start the frontend
cd src/dashboard-ui
npm run dev
```

The application will be available at: `http://localhost:5173` (Frontend) and `http://localhost:8000` (Backend API).

## Running Tests

*Testing scripts are integrated directly into our offline processing pipelines (`data_processing.py`, `train_model.py`). Run those to verify data integrity.*

## Quick Demo (Optional)

To verify the IBM Bob integration is working locally before launching the UI, you can run the LLM planner directly:

```bash
source .venv/bin/activate
python src/orchestration/llm_planner.py
```

## Troubleshooting

| Issue | Solution |
|---|---|
| `zsh: command not found: uvicorn` | Virtual environment not activated. Run `source .venv/bin/activate` in that specific terminal tab before running uvicorn. |
| Dashboard shows "Failed to fetch" | Backend is not running or CORS issue. Ensure Terminal 1 is running without errors and is on port `8000`. |
| Bob Summary says "Fallback" | Invalid IBM Bob API key or network timeout. Check that `BOB_API_KEY` in `src/.env` is correct and `USE_BOB=True`. |
| Missing CSV files on startup | The batch scripts haven't been run. Ensure the `data/processed` folder contains the output CSVs. |
