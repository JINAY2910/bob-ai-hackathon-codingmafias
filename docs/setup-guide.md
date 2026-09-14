# Setup Guide

This guide provides exact instructions to run the PortFlow application locally.

## Prerequisites
*   Python 3.10+
*   Node.js 18+ and npm
*   IBM Bob CLI (`bob` command available in your PATH)
*   An active IBM Bob API Key

## Environment Setup

Our application uses a `.env` file for the backend and LLM integration. 

1. Create a `.env` file in the `src/` directory.
2. Add the following variables (copy from `src/.env.example` if available):

```env
BOB_API_KEY=your_actual_api_key_here
USE_BOB=True
PORT=8000
DATA_DIR=./data
```

## Running the Project

To run PortFlow, you must start both the FastAPI Backend and the React Frontend simultaneously. Open two separate terminal windows at the root of the project.

### 1. Start the Backend API (Terminal 1)

```bash
# Create and activate a virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install the required Python packages
pip install fastapi uvicorn pandas xgboost scikit-learn numpy

# Start the FastAPI server
uvicorn src.api.main:app --reload
```
*The backend will now be running on `http://localhost:8000`.*

### 2. Start the Frontend Dashboard (Terminal 2)

```bash
# Navigate to the dashboard directory
cd src/dashboard-ui

# Install Node dependencies
npm install

# Start the Vite development server
npm run dev
```
*The frontend will now be running on `http://localhost:5173` (or the port Vite provides).*

## How to Verify it's Working

1. Open your browser to the Frontend URL (e.g., `http://localhost:5173`).
2. You should see the PortFlow Dashboard UI load successfully.
3. Click on a specific Port (e.g., "Port 1") to view its 72-Hour Operations Plan.
4. **Verifying IBM Bob:** At the top of the operations plan, you should see a short, plain-English summary (e.g., *"HIGH congestion risk at Port 1..."*). If you see this summary, the FastAPI backend has successfully contacted the IBM Bob CLI using your `.env` credentials!

## Troubleshooting

| Error | Cause | Solution |
| :--- | :--- | :--- |
| `zsh: command not found: uvicorn` | Virtual environment not activated. | Run `source .venv/bin/activate` in that specific terminal tab before running uvicorn. |
| Dashboard shows "Failed to fetch" | Backend is not running or CORS issue. | Ensure Terminal 1 is running without errors and is on port `8000`. |
| Bob Summary says "Fallback" | Invalid IBM Bob API key or network timeout. | Check that `BOB_API_KEY` in `src/.env` is correct and `USE_BOB=True`. |
| Missing CSV files on startup | The batch scripts haven't been run. | Ensure the `data/processed` folder contains the output CSVs (or run the python scripts in `src/` manually). |
