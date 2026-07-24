import { initialTasks } from "../data/mockData";
import type {
  AgentMessage,
  AgentTask,
  ApprovalDecision,
  ApprovalInput,
  CreateTaskInput,
  RunEventHandler,
  SendMessageInput,
  Unsubscribe,
} from "./types";
import type { AgentClient } from "./client";

function cloneTask(task: AgentTask): AgentTask {
  return structuredClone(task);
}

function cloneTasks(tasks: AgentTask[]): AgentTask[] {
  return tasks.map(cloneTask);
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

class MockAgentClient implements AgentClient {
  private tasks = cloneTasks(initialTasks);

  private subscribers = new Map<string, Set<RunEventHandler>>();

  private timers = new Map<string, number[]>();

  async listTasks(): Promise<AgentTask[]> {
    return cloneTasks(this.tasks);
  }

  async createTask(input: CreateTaskInput = {}): Promise<AgentTask> {
    const task: AgentTask = {
      id: newId("task"),
      title: input.title || "新的前端任务",
      branch: "frontend",
      runStatus: "idle",
      summary: "待输入 · mock",
      meta: "workspace F:\\deepclaude · 前端原型",
      files: [{ path: "src/App.tsx", preview: "export function App() {" }],
      terminal: ["F:\\deepclaude> waiting for input"],
      context: [
        { label: "Mode", value: "Mock frontend task" },
        { label: "API", value: "DeepSeek backend proxy planned" },
      ],
      diff: [
        { type: "file", value: "src/App.tsx" },
        { type: "ctx", value: "No changes yet" },
      ],
      messages: [
        {
          id: newId("msg"),
          role: "assistant",
          title: "DeepClaude",
          text: "新任务已创建。输入需求后我会模拟 agent 执行流。",
        },
      ],
    };

    this.tasks = [task, ...this.tasks];
    this.emitTask(task.id);
    return cloneTask(task);
  }

  async sendMessage(input: SendMessageInput): Promise<AgentTask> {
    this.clearTimers(input.taskId);
    const task = this.requireTask(input.taskId);
    task.runStatus = "running";
    task.summary = "进行中 · 正在分析";
    task.pendingApprovalId = undefined;
    task.messages.push({
      id: newId("msg"),
      role: "user",
      title: "你",
      text: input.prompt,
    });
    this.emitTask(task.id);
    this.scheduleMockRun(task.id);
    return cloneTask(task);
  }

  async startRun(taskId: string): Promise<AgentTask> {
    const task = this.requireTask(taskId);
    task.runStatus = "running";
    task.summary = "进行中 · 已启动";
    this.emitTask(taskId);
    return cloneTask(task);
  }

  async stopRun(taskId: string): Promise<AgentTask> {
    this.clearTimers(taskId);
    const task = this.requireTask(taskId);
    if (task.pendingApprovalId) this.setApprovalStatus(task, task.pendingApprovalId, "denied");
    task.runStatus = "stopped";
    task.summary = "已停止 · 用户中断";
    task.pendingApprovalId = undefined;
    task.messages.push({
      id: newId("msg"),
      role: "assistant",
      title: "DeepClaude",
      text: "已停止当前模拟任务。",
    });
    this.emitTask(taskId);
    return cloneTask(task);
  }

  async approveCommand(input: ApprovalInput): Promise<AgentTask> {
    const task = this.requireTask(input.taskId);
    const approval = this.findApproval(task, input.approvalId);
    if (!approval || approval.status !== "pending") return cloneTask(task);

    if (input.decision === "deny") return this.denyApproval(task, input.approvalId);
    return this.allowApproval(task, input.approvalId);
  }

  subscribeRunEvents(taskId: string, handler: RunEventHandler): Unsubscribe {
    const handlers = this.subscribers.get(taskId) ?? new Set<RunEventHandler>();
    handlers.add(handler);
    this.subscribers.set(taskId, handlers);
    return () => {
      handlers.delete(handler);
      if (handlers.size === 0) this.subscribers.delete(taskId);
    };
  }

  private scheduleMockRun(taskId: string): void {
    const timers = [
      window.setTimeout(() => {
        const task = this.requireTask(taskId);
        task.messages.push({
          id: newId("msg"),
          role: "assistant",
          title: "DeepClaude",
          plan: [
            { label: "理解你的目标并整理上下文", status: "done" },
            { label: "检查相关文件和最近 diff", status: "running" },
            { label: "给出最小修改方案", status: "waiting" },
          ],
        });
        this.emitTask(taskId);
      }, 260),
      window.setTimeout(() => {
        const task = this.requireTask(taskId);
        task.summary = "进行中 · 读取文件";
        task.messages.push({
          id: newId("msg"),
          role: "tool",
          title: "工具调用",
          steps: [
            { name: "list_files", status: "done", meta: "扫描当前工作区文件树" },
            { name: "read_file", status: "done", meta: "读取活跃任务相关文件" },
          ],
        });
        this.emitTask(taskId);
      }, 820),
      window.setTimeout(() => {
        const task = this.requireTask(taskId);
        const approvalId = newId("approval");
        task.runStatus = "waiting_approval";
        task.summary = "需要确认 · 运行检查";
        task.pendingApprovalId = approvalId;
        task.messages.push({
          id: newId("msg"),
          role: "assistant",
          title: "DeepClaude",
          approval: {
            id: approvalId,
            command: "pytest",
            description: "模拟请求运行测试。真实后端接入后，这里会触发本地审批流。",
            status: "pending",
          },
        });
        this.emitTask(taskId);
      }, 1420),
    ];

    this.timers.set(taskId, timers);
  }

  private allowApproval(task: AgentTask, approvalId: string): AgentTask {
    this.setApprovalStatus(task, approvalId, "approved");
    task.runStatus = "approved";
    task.summary = "已允许 · 准备执行";
    task.pendingApprovalId = undefined;
    task.terminal.push("", "F:\\deepclaude> pytest", "collected 12 items");
    task.messages.push({
      id: newId("msg"),
      role: "tool",
      title: "工具调用",
      steps: [{ name: "run_command: pytest", status: "running", meta: "正在执行测试" }],
    });
    this.emitTask(task.id);

    const timer = window.setTimeout(() => {
      const latest = this.requireTask(task.id);
      latest.runStatus = "completed";
      latest.summary = "已完成 · 检查通过";
      latest.terminal.push("12 passed in 0.84s");
      latest.messages.push({
        id: newId("msg"),
        role: "tool",
        title: "工具调用",
        steps: [{ name: "run_command: pytest", status: "done", meta: "12 passed in 0.84s" }],
      });
      latest.messages.push({
        id: newId("msg"),
        role: "assistant",
        title: "DeepClaude",
        text: "检查通过。当前前端会把审批、终端输出和任务状态串起来，后续可直接替换成真实后端事件。",
      });
      this.emitTask(latest.id);
    }, 620);

    this.timers.set(task.id, [...(this.timers.get(task.id) ?? []), timer]);
    return cloneTask(task);
  }

  private denyApproval(task: AgentTask, approvalId: string): AgentTask {
    this.setApprovalStatus(task, approvalId, "denied");
    task.runStatus = "denied";
    task.summary = "已拒绝 · 命令未执行";
    task.pendingApprovalId = undefined;
    task.messages.push({
      id: newId("msg"),
      role: "assistant",
      title: "DeepClaude",
      text: "已拒绝执行命令。我会停在当前 diff，不继续运行检查。",
    });
    this.emitTask(task.id);
    return cloneTask(task);
  }

  private requireTask(taskId: string): AgentTask {
    const task = this.tasks.find((item) => item.id === taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    return task;
  }

  private emitTask(taskId: string): void {
    const task = cloneTask(this.requireTask(taskId));
    const handlers = this.subscribers.get(taskId);
    if (!handlers) return;
    handlers.forEach((handler) => handler({ type: "task_updated", task }));
  }

  private clearTimers(taskId: string): void {
    const timers = this.timers.get(taskId) ?? [];
    timers.forEach((timer) => window.clearTimeout(timer));
    this.timers.delete(taskId);
  }

  private findApproval(task: AgentTask, approvalId: string) {
    return task.messages.map((message) => message.approval).find((approval) => approval?.id === approvalId);
  }

  private setApprovalStatus(task: AgentTask, approvalId: string, decision: Exclude<ApprovalDecision, "allow" | "deny"> | "approved" | "denied") {
    task.messages = task.messages.map((message) => {
      if (message.approval?.id !== approvalId) return message;
      return {
        ...message,
        approval: {
          ...message.approval,
          status: decision,
        },
      };
    });
  }
}

export const mockClient = new MockAgentClient();
