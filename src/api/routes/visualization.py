from datetime import datetime

from fastapi import APIRouter, HTTPException, Query

from src.visualization.scene_builder import build_scene

router = APIRouter()


@router.get("/scene")
def get_visualization_scene(
    port_id: int = Query(1, ge=1),
    at: datetime | None = Query(None, description="Replay timestamp from the historical schedule"),
):
    """Return a schedule-replay scene for ships, berths, cranes, and routes."""
    try:
        return build_scene(port_id=port_id, at=at)
    except (FileNotFoundError, ValueError) as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
