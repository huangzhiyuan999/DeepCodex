from __future__ import annotations

from dataclasses import dataclass

from ..config import Settings
from ..run_events import RunEvent, RunEventBus
from ..state import StateStore
from ..tools import WorkspaceTools


@dataclass(frozen=True)
class AgentRunRequest:
    run_id: str
    task_id: str
    prompt: str
    workspace_path: str


class AgentRuntime:
    def __init__(self, settings: Settings, store: StateStore, event_bus: RunEventBus) -> None:
        self.settings = settings
        self.store = store
        self.event_bus = event_bus

    async def run(self, request: AgentRunRequest) -> None:
        await self._publish(request, RunEvent(type="run_started", payload={"taskId": request.task_id}))
        self.store.update_task_status(request.task_id, "running", "运行中 · 正在整理工作区上下文")

        try:
            workspace = WorkspaceTools(request.workspace_path)
            files = workspace.list_files(max_entries=60)
            diff = workspace.git_diff(max_chars=12_000)
            summary = self._workspace_summary(files_count=len(files), diff_chars=len(diff))
            self.store.record_tool_call(
                request.task_id,
                name="workspace_context",
                status="done",
                input_json={"maxFiles": 60, "maxDiffChars": 12000},
                output_json={"filesCount": len(files), "diffChars": len(diff)},
            )
            await self._publish(
                request,
                RunEvent(
                    type="tool_call_finished",
                    payload={"taskId": request.task_id, "name": "workspace_context", "filesCount": len(files)},
                ),
            )

            assistant_text = await self._complete(request.prompt, summary)
            self.store.add_message(request.task_id, "assistant", assistant_text)
            self.store.update_job_status(request.run_id, "completed")
            self.store.update_task_status(request.task_id, "completed", "已完成 · agent 回复已生成")
            await self._publish(
                request,
                RunEvent(type="message_added", payload={"taskId": request.task_id, "role": "assistant", "content": assistant_text}),
            )
            await self._publish(request, RunEvent(type="run_completed", payload={"taskId": request.task_id}))
        except Exception as exc:
            self.store.update_job_status(request.run_id, "failed")
            self.store.update_task_status(request.task_id, "failed", f"失败 · {exc}")
            await self._publish(
                request,
                RunEvent(type="run_failed", payload={"taskId": request.task_id, "error": str(exc)}),
            )

    async def _publish(self, request: AgentRunRequest, event: RunEvent) -> None:
        await self.event_bus.publish(request.run_id, event)
        await self.event_bus.publish(f"task:{request.task_id}", event)

    async def _complete(self, prompt: str, workspace_summary: str) -> str:
        if not self.settings.deepseek_api_key:
            return (
                "DeepSeek API key 尚未配置，所以这次使用本地 fallback 回复。\n\n"
                f"我已收到你的请求：{prompt}\n\n"
                f"{workspace_summary}\n\n"
                "下一步接入真实 DeepSeek 流式响应后，这里会变成模型生成的内容。"
            )

        from ..deepseek_client import DeepSeekClient

        client = DeepSeekClient(self.settings)
        chunks: list[str] = []
        async for chunk in client.stream_chat(
            [
                {
                    "role": "system",
                    "content": "You are DeepClaude, a local coding agent. Be concise and action-oriented.",
                },
                {
                    "role": "user",
                    "content": f"{prompt}\n\nWorkspace summary:\n{workspace_summary}",
                },
            ]
        ):
            chunks.append(chunk)
        return "".join(chunks).strip()

    @staticmethod
    def _workspace_summary(files_count: int, diff_chars: int) -> str:
        return f"工作区上下文：已扫描 {files_count} 个文件条目，当前 git diff 长度约 {diff_chars} 字符。"
