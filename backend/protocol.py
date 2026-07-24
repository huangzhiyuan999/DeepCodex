from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


RunStatus = Literal[
    "idle",
    "running",
    "waiting_approval",
    "approved",
    "denied",
    "completed",
    "failed",
    "stopped",
]

ApprovalStatus = Literal["pending", "approved", "denied"]
MessageRole = Literal["user", "assistant", "tool", "system"]
DiffLineType = Literal["file", "add", "ctx", "remove"]
RunEventType = Literal[
    "task_updated",
    "message_added",
    "terminal_appended",
    "approval_requested",
    "approval_resolved",
    "tool_call_started",
    "tool_call_finished",
    "run_started",
    "run_stopped",
    "run_completed",
    "run_failed",
]


class ApiConfigDTO(BaseModel):
    provider: Literal["deepseek"] = "deepseek"
    base_url: str = Field(serialization_alias="baseUrl")
    model: str
    key_source: Literal["backend-env"] = Field(default="backend-env", serialization_alias="keySource")


class TaskDTO(BaseModel):
    id: str
    title: str
    workspace_path: str = Field(serialization_alias="workspacePath")
    model: str
    status: RunStatus
    summary: str = ""
    rollout_path: str = Field(serialization_alias="rolloutPath")
    created_at: str = Field(serialization_alias="createdAt")
    updated_at: str = Field(serialization_alias="updatedAt")


class MessageDTO(BaseModel):
    id: str
    task_id: str = Field(serialization_alias="taskId")
    parent_message_id: str | None = Field(default=None, serialization_alias="parentMessageId")
    role: MessageRole
    content: str
    item_json: dict[str, Any] = Field(default_factory=dict, serialization_alias="itemJson")
    created_at: str = Field(serialization_alias="createdAt")


class ApprovalDTO(BaseModel):
    id: str
    task_id: str = Field(serialization_alias="taskId")
    command: str
    description: str
    status: ApprovalStatus
    created_at: str = Field(serialization_alias="createdAt")
    updated_at: str = Field(serialization_alias="updatedAt")


class ToolCallDTO(BaseModel):
    id: str
    task_id: str = Field(serialization_alias="taskId")
    name: str
    status: str
    input_json: dict[str, Any] = Field(default_factory=dict, serialization_alias="inputJson")
    output_json: dict[str, Any] = Field(default_factory=dict, serialization_alias="outputJson")
    created_at: str = Field(serialization_alias="createdAt")
    updated_at: str = Field(serialization_alias="updatedAt")


class RunEventDTO(BaseModel):
    type: RunEventType
    task_id: str | None = Field(default=None, serialization_alias="taskId")
    run_id: str | None = Field(default=None, serialization_alias="runId")
    payload: dict[str, Any] = Field(default_factory=dict)
    created_at: str = Field(serialization_alias="createdAt")
