import type {
  AgentClient,
} from "./client";
import type {
  AgentTask,
  ApprovalInput,
  CreateTaskInput,
  RunEventHandler,
  SendMessageInput,
  Unsubscribe,
} from "./types";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

interface BackendTask {
  id: string;
  title: string;
  workspacePath?: string;
  workspace_path?: string;
  model?: string;
  status?: AgentTask["runStatus"];
  summary?: string;
  rolloutPath?: string;
  rollout_path?: string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`API ${response.status}: ${detail}`);
  }

  return (await response.json()) as T;
}

function toAgentTask(task: BackendTask): AgentTask {
  return {
    id: task.id,
    title: task.title,
    branch: "main",
    runStatus: task.status ?? "idle",
    summary: task.summary || "后端任务",
    meta: `${task.model || "deepseek-chat"} · ${task.workspacePath || task.workspace_path || "workspace"}`,
    files: [],
    terminal: [],
    context: [
      { label: "Source", value: "FastAPI backend" },
      { label: "Rollout", value: task.rolloutPath || task.rollout_path || "" },
    ],
    diff: [],
    messages: [],
  };
}

export const httpClient: AgentClient = {
  async listTasks() {
    const data = await requestJson<{ tasks: BackendTask[] }>("/api/tasks");
    return data.tasks.map(toAgentTask);
  },

  async createTask(input: CreateTaskInput = {}) {
    const data = await requestJson<{ id: string; title: string }>("/api/tasks", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return toAgentTask({ id: data.id, title: data.title, status: "idle" });
  },

  async sendMessage(input: SendMessageInput) {
    await requestJson<{ id: string }>("/api/runs", {
      method: "POST",
      body: JSON.stringify({ task_id: input.taskId, prompt: input.prompt }),
    });
    const tasks = await this.listTasks();
    return tasks.find((task) => task.id === input.taskId) ?? toAgentTask({ id: input.taskId, title: "Agent task", status: "running" });
  },

  async startRun(taskId: string) {
    return toAgentTask({ id: taskId, title: "Agent task", status: "running" });
  },

  async stopRun(taskId: string) {
    return toAgentTask({ id: taskId, title: "Agent task", status: "stopped", summary: "已停止" });
  },

  async approveCommand(input: ApprovalInput) {
    await requestJson<{ approvalId: string; decision: string }>(`/api/approvals/${input.approvalId}`, {
      method: "POST",
      body: JSON.stringify({ decision: input.decision }),
    });
    return toAgentTask({
      id: input.taskId,
      title: "Agent task",
      status: input.decision === "allow" ? "approved" : "denied",
    });
  },

  subscribeRunEvents(_taskId: string, _handler: RunEventHandler): Unsubscribe {
    return () => undefined;
  },
};
