from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from .routes import hotspots, optimization, planning, alternate_routes

app = FastAPI(
    title="PortFlow API",
    description="API for predicting congestion, optimizing berth allocations, and generating 72-hour operation plans.",
    version="1.0.0"
)

# CORS configuration for the React dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(hotspots.router, prefix="/api/v1/hotspots", tags=["Hotspots"])
app.include_router(optimization.router, prefix="/api/v1/optimize-berths", tags=["Optimization"])
app.include_router(alternate_routes.router, prefix="/api/v1/alternate-routes", tags=["Alternate Routing"])
app.include_router(planning.router, prefix="/api/v1/operations-plan", tags=["72-Hour Plan"])

@app.get("/")
def read_root():
    return {"message": "Welcome to the PortFlow API"}

if __name__ == "__main__":
    import uvicorn
    # Allow running with python src/api/main.py
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("src.api.main:app", host="0.0.0.0", port=port, reload=True)
