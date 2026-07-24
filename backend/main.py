from uuid import uuid4

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from .config import get_settings
from .run_events import RunEvent, event_bus

app = FastAPI(title="DeepClaude API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TaskCreateRequest(BaseModel):
    title: str | None = None


class RunCreateRequest(BaseModel):
    task_id: str
    prompt: str


class ApprovalRequest(BaseModel):
    decision: str


@app.get("/api/config")
async def get_config() -> dict[str, str]:
    settings = get_settings()
    return {
        "provider": "deepseek",
        "baseUrl": settings.deepseek_base_url,
        "model": settings.deepseek_model,
        "keySource": "backend-env",
    }


@app.post("/api/tasks")
async def create_task(request: TaskCreateRequest) -> dict[str, str]:
    return {"id": str(uuid4()), "title": request.title or "新的 Agent 任务"}


@app.post("/api/runs")
async def create_run(request: RunCreateRequest) -> dict[str, str]:
    run_id = str(uuid4())
    await event_bus.publish(run_id, RunEvent(type="run_started", payload={"taskId": request.task_id, "prompt": request.prompt}))
    return {"id": run_id}


@app.get("/api/runs/{run_id}/events")
async def stream_run_events(run_id: str) -> StreamingResponse:
    async def stream():
        async for event in event_bus.subscribe(run_id):
            yield event.to_sse()

    return StreamingResponse(stream(), media_type="text/event-stream")


@app.post("/api/approvals/{approval_id}")
async def approve_command(approval_id: str, request: ApprovalRequest) -> dict[str, str]:
    return {"approvalId": approval_id, "decision": request.decision}


@app.post("/api/runs/{run_id}/stop")
async def stop_run(run_id: str) -> dict[str, str]:
    await event_bus.publish(run_id, RunEvent(type="run_stopped", payload={"runId": run_id}))
    return {"id": run_id, "status": "stopped"}
