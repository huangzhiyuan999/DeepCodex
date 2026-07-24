import type { AgentClient } from "./client";
import type {
  AgentMessage,
  AgentTask,
  ApprovalInput,
  CreateTaskInput,
  RunEventHandler,
  SendMessageInput,
  Unsubscribe,
} from "./types";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
const activeRunByTask = new Map<string, string>();

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
}

interface BackendMessage {
  id: string;
  taskId?: string;
  task_id?: string;
  parentMessageId?: string | null;
  parent_message_id?: string | null;
  role: AgentMessage["role"] | "system";
  content: string;
  itemJson?: Record<string, unknown>;
  item_json?: Record<string, unknown>;
  createdAt?: string;
  created_at?: string;
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

function toAgentMessage(message: BackendMessage): AgentMessage {
  const role = message.role === "system" ? "assistant" : message.role;
  return {
    id: message.id,
    role,
    title: role === "user" ? "你" : role === "tool" ? "工具调用" : "DeepClaude",
    text: message.content,
  };
}

async function refreshTask(taskId: string): Promise<AgentTask | undefined> {
  const data = await requestJson<{ task: BackendTask; messages: BackendMessage[] }>(`/api/tasks/${taskId}`);
  return {
    ...toAgentTask(data.task),
    messages: data.messages.map(toAgentMessage),
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
    const run = await requestJson<{ id: string }>("/api/runs", {
      method: "POST",
      body: JSON.stringify({ task_id: input.taskId, prompt: input.prompt }),
    });
    activeRunByTask.set(input.taskId, run.id);
    return (await refreshTask(input.taskId)) ?? toAgentTask({ id: input.taskId, title: "Agent task", status: "running" });
  },

  async startRun(taskId: string) {
    return toAgentTask({ id: taskId, title: "Agent task", status: "running" });
  },

  async stopRun(taskId: string) {
    const runId = activeRunByTask.get(taskId);
    if (runId) {
      await requestJson<{ id: string; status: string }>(`/api/runs/${runId}/stop`, { method: "POST" });
      activeRunByTask.delete(taskId);
    }
    return (await refreshTask(taskId)) ?? toAgentTask({ id: taskId, title: "Agent task", status: "stopped", summary: "已停止" });
  },

  async approveCommand(input: ApprovalInput) {
    await requestJson<{ approvalId: string; decision: string }>(`/api/approvals/${input.approvalId}`, {
      method: "POST",
      body: JSON.stringify({ decision: input.decision }),
    });
    return (
      (await refreshTask(input.taskId)) ??
      toAgentTask({
        id: input.taskId,
        title: "Agent task",
        status: input.decision === "allow" ? "approved" : "denied",
      })
    );
  },

  subscribeRunEvents(taskId: string, handler: RunEventHandler): Unsubscribe {
    const source = new EventSource(`${apiBaseUrl}/api/tasks/${taskId}/events`);
    const eventNames = ["run_started", "tool_call_finished", "message_added", "run_completed", "run_failed", "run_stopped"];

    const handleEvent = () => {
      void refreshTask(taskId).then((task) => {
        if (task) handler({ type: "task_updated", task });
      });
    };

    eventNames.forEach((eventName) => {
      source.addEventListener(eventName, handleEvent);
    });

    source.onerror = () => {
      source.close();
    };

    return () => source.close();
  },
};
