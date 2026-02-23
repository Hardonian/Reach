# Reach FastAPI Integration Integration kit for using Reach with FastAPI.

## Setup ```bash

pip install fastapi uvicorn reach-sdk

````

## Basic Example ```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from reach_sdk import create_client
import os

app = FastAPI(title="Reach Integration Example")

# Create Reach client reach = create_client(
    base_url=os.getenv("REACH_BASE_URL", "http://127.0.0.1:8787")
)

class CreateRunRequest(BaseModel):
    capabilities: list[str] | None = None
    plan_tier: str | None = None

class CreateCapsuleRequest(BaseModel):
    run_id: str

@app.get("/health")
async def health():
    """Check Reach server health"""
    try:
        return reach.health()
    except Exception as e:
        raise HTTPException(status_code=503, detail="Reach server unavailable")

@app.post("/runs")
async def create_run(request: CreateRunRequest):
    """Create a new run"""
    try:
        return reach.create_run(
            capabilities=request.capabilities,
            plan_tier=request.plan_tier
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/runs/{run_id}")
async def get_run(run_id: str):
    """Get run details"""
    try:
        return reach.get_run(run_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail="Run not found")

@app.get("/runs/{run_id}/events")
async def get_run_events(run_id: str, after: int | None = None):
    """Get run events"""
    try:
        return reach.get_run_events(run_id, after)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/runs/{run_id}/replay")
async def replay_run(run_id: str):
    """Replay a run"""
    try:
        return reach.replay_run(run_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/capsules")
async def create_capsule(request: CreateCapsuleRequest):
    """Create a capsule from a run"""
    try:
        return reach.create_capsule(request.run_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/packs")
async def search_packs(q: str | None = None):
    """Search packs in the registry"""
    try:
        return reach.search_packs(query=q)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/federation/status")
async def federation_status():
    """Get federation status"""
    try:
        return reach.get_federation_status()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
````

## Running ```bash

# Set environment variable export REACH_BASE_URL=http://127.0.0.1:8787

# Run the server uvicorn main:app --reload

```

## API Documentation FastAPI automatically generates interactive API documentation:

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## License Apache 2.0
```
