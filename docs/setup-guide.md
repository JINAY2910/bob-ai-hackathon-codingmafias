# Setup Guide

## Prerequisites
- Python 3.10+
- Node.js 18+ (for the React dashboard)
- PostgreSQL or SQLite

## Environment Variables
Create a `.env` file in the `src/` directory using the provided `src/.env.example` as a template:
- `DATABASE_URL`: Connection string for your database (e.g., PostgreSQL or SQLite).
- `BOB_MCP_ENDPOINT`: Endpoint URL for the IBM Bob MCP integration.
- `PORT`: The port on which the API server will run (default: 8000).
- `DATA_DIR`: Path to the local dataset directory (default: `./data`).

## Data Setup
1. Manually place your dataset files into the `data/raw/` directory. (See `data/README.md` for details).
# TODO: finalize after dataset is added
2. Once the raw data is in place, run the ingestion script to process the data into `data/processed/`.

## Installation & Running
1. Install Python dependencies:
   ```bash
   cd src/
   pip install -r requirements.txt
   ```
2. Install Node.js dependencies for the dashboard:
   ```bash
   cd src/dashboard/
   npm install
   ```
3. Run the data ingestion script:
   ```bash
   python -m src.ingestion.run
   ```
4. Start the backend server:
   ```bash
   python -m src.api.main
   ```
5. Start the frontend dashboard:
   ```bash
   cd src/dashboard/
   npm run dev
   ```

## Verification
To verify the system is working, open `http://localhost:3000` (or the configured dashboard port) in your browser. You should see the 72-hour rolling plan populated with the processed data. The API health check can be verified at `http://localhost:8000/health`.

## Troubleshooting

| Error | Solution |
|-------|----------|
| Database connection failed | Verify that your database is running and `DATABASE_URL` is correct. |
| Data not found during ingestion | Ensure your dataset files are correctly placed in `data/raw/` before running the ingestion script. |
| Port 8000 is already in use | Change the `PORT` variable in your `.env` file or stop the conflicting service. |
