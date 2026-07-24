from __future__ import annotations

from functools import lru_cache
from uuid import uuid4

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from .config import get_settings
from .run_events import RunEvent, event_bus
from .state import StateStore

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
    workspace_path: str | None = None


class RunCreateRequest(BaseModel):
    task_id: str
    prompt: str


class ApprovalRequest(BaseModel):
    decision: str


@lru_cache
def get_store() -> StateStore:
    return StateStore()


@app.get("/api/config")
async def get_config() -> dict[str, str]:
    settings = get_settings()
    return {
        "provider": "deepseek",
        "baseUrl": settings.deepseek_base_url,
        "model": settings.deepseek_model,
        "keySource": "backend-env",
    }


@app.get("/api/tasks")
async def list_tasks() -> dict[str, object]:
    return {"tasks": get_store().list_tasks()}


@app.post("/api/tasks")
async def create_task(request: TaskCreateRequest) -> dict[str, str]:
    settings = get_settings()
    title = request.title or "新的 Agent 任务"
    workspace_path = request.workspace_path or str(settings.workspace_root)
    task_id = get_store().create_task(title=title, workspace_path=workspace_path, model=settings.deepseek_model)
    return {"id": task_id, "title": title}


@app.post("/api/runs")
async def create_run(request: RunCreateRequest) -> dict[str, str]:
    run_id = str(uuid4())
    store = get_store()
    store.create_job(
        job_id=run_id,
        task_id=request.task_id,
        kind="agent_run",
        status="running",
        payload_json={"prompt": request.prompt},
    )
    store.update_task_status(request.task_id, "running", "运行中 · 等待模型响应")
    store.add_message(request.task_id, "user", request.prompt)
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
    status = "approved" if request.decision == "allow" else "denied"
    get_store().resolve_approval(approval_id, status)
    return {"approvalId": approval_id, "decision": request.decision}


@app.post("/api/runs/{run_id}/stop")
async def stop_run(run_id: str) -> dict[str, str]:
    store = get_store()
    job = store.update_job_status(run_id, "stopped")
    task_id = job.get("task_id")
    if task_id:
        store.update_task_status(str(task_id), "stopped", "已停止 · 用户中断")
    await event_bus.publish(run_id, RunEvent(type="run_stopped", payload={"runId": run_id}))
    return {"id": run_id, "status": "stopped"}
