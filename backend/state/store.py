from __future__ import annotations

import json
import sqlite3
from collections.abc import Iterable
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


SCHEMA_VERSION = 1


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class StateStore:
    """SQLite state store plus append-only JSONL session events.

    The default location is project-local: ``backend/data``. This keeps the
    prototype self-contained and avoids writing agent state into unrelated
    folders on the user's machine.
    """

    def __init__(self, data_dir: Path | str | None = None) -> None:
        self.data_dir = Path(data_dir) if data_dir else Path(__file__).resolve().parents[1] / "data"
        self.sessions_dir = self.data_dir / "sessions"
        self.logs_dir = self.data_dir / "logs"
        self.db_path = self.data_dir / "deepclaude.sqlite"
        self.session_index_path = self.data_dir / "session_index.jsonl"

        self.sessions_dir.mkdir(parents=True, exist_ok=True)
        self.logs_dir.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(self.db_path)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA foreign_keys = ON")
        self._conn.execute("PRAGMA journal_mode = WAL")
        self._migrate()

    def close(self) -> None:
        self._conn.close()

    def create_task(self, title: str, workspace_path: str, model: str = "deepseek-chat") -> str:
        task_id = self._new_id("task")
        now = utc_now()
        rollout_path = str(self.sessions_dir / f"{task_id}.jsonl")
        with self._conn:
            self._conn.execute(
                """
                INSERT INTO tasks (
                    id, title, workspace_path, model, status, rollout_path, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (task_id, title, workspace_path, model, "idle", rollout_path, now, now),
            )
        self.append_session_event(task_id, "task_created", {"title": title, "workspacePath": workspace_path})
        return task_id

    def update_task_status(self, task_id: str, status: str, summary: str | None = None) -> None:
        now = utc_now()
        with self._conn:
            self._conn.execute(
                "UPDATE tasks SET status = ?, summary = COALESCE(?, summary), updated_at = ? WHERE id = ?",
                (status, summary, now, task_id),
            )
        self.append_session_event(task_id, "task_status_updated", {"status": status, "summary": summary})

    def add_message(
        self,
        task_id: str,
        role: str,
        content: str,
        item_json: dict[str, Any] | None = None,
        parent_message_id: str | None = None,
    ) -> str:
        message_id = self._new_id("msg")
        now = utc_now()
        payload = item_json or {}
        with self._conn:
            self._conn.execute(
                """
                INSERT INTO messages (
                    id, task_id, parent_message_id, role, content, item_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (message_id, task_id, parent_message_id, role, content, json.dumps(payload, ensure_ascii=False), now),
            )
        self.append_session_event(
            task_id,
            "message_added",
            {"id": message_id, "role": role, "content": content, "item": payload},
        )
        return message_id

    def create_approval(self, task_id: str, command: str, description: str) -> str:
        approval_id = self._new_id("approval")
        now = utc_now()
        with self._conn:
            self._conn.execute(
                """
                INSERT INTO approvals (
                    id, task_id, command, description, status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (approval_id, task_id, command, description, "pending", now, now),
            )
        self.append_session_event(
            task_id,
            "approval_requested",
            {"id": approval_id, "command": command, "description": description},
        )
        return approval_id

    def resolve_approval(self, approval_id: str, status: str) -> None:
        now = utc_now()
        row = self._conn.execute("SELECT task_id FROM approvals WHERE id = ?", (approval_id,)).fetchone()
        if row is None:
            raise KeyError(f"Approval not found: {approval_id}")
        with self._conn:
            self._conn.execute(
                "UPDATE approvals SET status = ?, updated_at = ? WHERE id = ?",
                (status, now, approval_id),
            )
        self.append_session_event(row["task_id"], "approval_resolved", {"id": approval_id, "status": status})

    def record_tool_call(
        self,
        task_id: str,
        name: str,
        status: str,
        input_json: dict[str, Any] | None = None,
        output_json: dict[str, Any] | None = None,
    ) -> str:
        tool_call_id = self._new_id("tool")
        now = utc_now()
        with self._conn:
            self._conn.execute(
                """
                INSERT INTO tool_calls (
                    id, task_id, name, status, input_json, output_json, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    tool_call_id,
                    task_id,
                    name,
                    status,
                    json.dumps(input_json or {}, ensure_ascii=False),
                    json.dumps(output_json or {}, ensure_ascii=False),
                    now,
                    now,
                ),
            )
        self.append_session_event(task_id, "tool_call_recorded", {"id": tool_call_id, "name": name, "status": status})
        return tool_call_id

    def create_job(
        self,
        kind: str,
        status: str,
        task_id: str | None = None,
        payload_json: dict[str, Any] | None = None,
        job_id: str | None = None,
    ) -> str:
        resolved_job_id = job_id or self._new_id("job")
        now = utc_now()
        payload = payload_json or {}
        with self._conn:
            self._conn.execute(
                """
                INSERT INTO jobs (
                    id, task_id, kind, status, payload_json, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    resolved_job_id,
                    task_id,
                    kind,
                    status,
                    json.dumps(payload, ensure_ascii=False),
                    now,
                    now,
                ),
            )
        if task_id:
            self.append_session_event(
                task_id,
                "job_created",
                {"id": resolved_job_id, "kind": kind, "status": status, "payload": payload},
            )
        return resolved_job_id

    def update_job_status(self, job_id: str, status: str) -> dict[str, Any]:
        row = self._conn.execute("SELECT task_id, payload_json FROM jobs WHERE id = ?", (job_id,)).fetchone()
        if row is None:
            raise KeyError(f"Job not found: {job_id}")
        now = utc_now()
        with self._conn:
            self._conn.execute(
                "UPDATE jobs SET status = ?, updated_at = ? WHERE id = ?",
                (status, now, job_id),
            )
        job = {"id": job_id, "task_id": row["task_id"], "payload_json": json.loads(row["payload_json"] or "{}")}
        if row["task_id"]:
            self.append_session_event(row["task_id"], "job_status_updated", {"id": job_id, "status": status})
        return job

    def append_session_event(self, task_id: str, event_type: str, payload: dict[str, Any]) -> None:
        event = {
            "taskId": task_id,
            "type": event_type,
            "payload": payload,
            "createdAt": utc_now(),
        }
        session_path = self.sessions_dir / f"{task_id}.jsonl"
        self._append_jsonl(session_path, [event])
        self._append_jsonl(self.session_index_path, [event])

    def list_tasks(self) -> list[dict[str, Any]]:
        rows = self._conn.execute(
            """
            SELECT id, title, workspace_path, model, status, summary, rollout_path, created_at, updated_at
            FROM tasks
            ORDER BY updated_at DESC
            """
        ).fetchall()
        return [dict(row) for row in rows]

    def get_task(self, task_id: str) -> dict[str, Any]:
        row = self._conn.execute(
            """
            SELECT id, title, workspace_path, model, status, summary, rollout_path, created_at, updated_at
            FROM tasks
            WHERE id = ?
            """,
            (task_id,),
        ).fetchone()
        if row is None:
            raise KeyError(f"Task not found: {task_id}")
        return dict(row)

    def list_messages(self, task_id: str) -> list[dict[str, Any]]:
        rows = self._conn.execute(
            """
            SELECT id, parent_message_id, role, content, item_json, created_at
            FROM messages
            WHERE task_id = ?
            ORDER BY created_at ASC
            """,
            (task_id,),
        ).fetchall()
        messages: list[dict[str, Any]] = []
        for row in rows:
            item = dict(row)
            item["item_json"] = json.loads(item["item_json"] or "{}")
            messages.append(item)
        return messages

    def _migrate(self) -> None:
        with self._conn:
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS schema_meta (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                )
                """
            )
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS tasks (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    workspace_path TEXT NOT NULL,
                    model TEXT NOT NULL,
                    status TEXT NOT NULL,
                    summary TEXT NOT NULL DEFAULT '',
                    rollout_path TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS messages (
                    id TEXT PRIMARY KEY,
                    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                    parent_message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    item_json TEXT NOT NULL DEFAULT '{}',
                    created_at TEXT NOT NULL
                )
                """
            )
            self._conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_messages_task_created ON messages(task_id, created_at)"
            )
            self._conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role)"
            )
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS approvals (
                    id TEXT PRIMARY KEY,
                    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                    command TEXT NOT NULL,
                    description TEXT NOT NULL,
                    status TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS tool_calls (
                    id TEXT PRIMARY KEY,
                    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                    name TEXT NOT NULL,
                    status TEXT NOT NULL,
                    input_json TEXT NOT NULL DEFAULT '{}',
                    output_json TEXT NOT NULL DEFAULT '{}',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS checkpoints (
                    id TEXT PRIMARY KEY,
                    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                    label TEXT NOT NULL,
                    payload_json TEXT NOT NULL DEFAULT '{}',
                    created_at TEXT NOT NULL
                )
                """
            )
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS jobs (
                    id TEXT PRIMARY KEY,
                    task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
                    kind TEXT NOT NULL,
                    status TEXT NOT NULL,
                    payload_json TEXT NOT NULL DEFAULT '{}',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS workflow_runs (
                    id TEXT PRIMARY KEY,
                    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                    name TEXT NOT NULL,
                    status TEXT NOT NULL,
                    trace_json TEXT NOT NULL DEFAULT '{}',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS goals (
                    id TEXT PRIMARY KEY,
                    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                    objective TEXT NOT NULL,
                    status TEXT NOT NULL,
                    token_budget INTEGER,
                    token_used INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            self._conn.execute(
                "INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('version', ?)",
                (str(SCHEMA_VERSION),),
            )

    @staticmethod
    def _append_jsonl(path: Path, events: Iterable[dict[str, Any]]) -> None:
        with path.open("a", encoding="utf-8") as file:
            for event in events:
                file.write(json.dumps(event, ensure_ascii=False) + "\n")

    @staticmethod
    def _new_id(prefix: str) -> str:
        import uuid

        return f"{prefix}_{uuid.uuid4().hex}"
