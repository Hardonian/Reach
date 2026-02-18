"""
Reach FastAPI Integration Example

This example shows how to integrate Reach with a FastAPI application.

Prerequisites:
    1. Reach server running on http://127.0.0.1:8787
       Start with: reach serve
    2. Dependencies installed
       Run: pip install -r requirements.txt

Usage:
    uvicorn main:app --reload

Then visit:
    http://localhost:8000/docs  (Interactive API docs)
    http://localhost:8000/health
"""

import os
from typing import Any, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from reach_sdk import create_client
from reach_sdk.exceptions import ReachError

app = FastAPI(
    title="Reach FastAPI Example",
    description="Example integration of Reach with FastAPI",
    version="1.0.0",
)

# Create Reach client
reach = create_client(
    base_url=os.getenv("REACH_BASE_URL", "http://127.0.0.1:8787")
)


# Pydantic models
class CreateRunRequest(BaseModel):
    capabilities: Optional[list[str]] = None
    plan_tier: Optional[str] = "free"


class CreateCapsuleRequest(BaseModel):
    run_id: str


class HealthResponse(BaseModel):
    status: str
    reach: dict


# Endpoints
@app.get("/health", response_model=HealthResponse)
async def health():
    """Check server health"""
    try:
        reach_health = reach.health()
        return {"status": "ok", "reach": reach_health}
    except ReachError:
        raise HTTPException(
            status_code=503,
            detail="Reach server unavailable"
        )


@app.post("/api/runs")
async def create_run(request: CreateRunRequest):
    """Create a new run"""
    try:
        return reach.create_run(
            capabilities=request.capabilities,
            plan_tier=request.plan_tier
        )
    except ReachError as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/runs/{run_id}")
async def get_run(run_id: str):
    """Get run details"""
    try:
        return reach.get_run(run_id)
    except ReachError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/runs/{run_id}/events")
async def get_run_events(run_id: str, after: Optional[int] = None):
    """Get run events"""
    try:
        return reach.get_run_events(run_id, after)
    except ReachError as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/runs/{run_id}/replay")
async def replay_run(run_id: str):
    """Replay a run"""
    try:
        return reach.replay_run(run_id)
    except ReachError as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/capsules")
async def create_capsule(request: CreateCapsuleRequest):
    """Create a capsule from a run"""
    try:
        return reach.create_capsule(request.run_id)
    except ReachError as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/packs")
async def search_packs(q: Optional[str] = None):
    """Search packs in the registry"""
    try:
        return reach.search_packs(query=q)
    except ReachError as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/federation/status")
async def federation_status():
    """Get federation status"""
    try:
        return reach.get_federation_status()
    except ReachError as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.on_event("shutdown")
async def shutdown():
    """Cleanup on shutdown"""
    reach.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
