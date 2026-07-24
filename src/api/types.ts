export type RunStatus =
  | "idle"
  | "running"
  | "waiting_approval"
  | "approved"
  | "denied"
  | "completed"
  | "failed"
  | "stopped";

export type WorkspaceTab = "files" | "diff" | "terminal" | "context";

export type MobileView = "tasks" | "chat" | "workspace";

export type MessageRole = "user" | "assistant" | "tool";

export interface ApiSettings {
  provider: "deepseek";
  baseUrl: string;
  model: "deepseek-chat" | "deepseek-reasoner";
  keySource: "backend-env";
}

export interface PlanItem {
  label: string;
  status: "done" | "waiting" | "running";
}

export interface ToolStep {
  name: string;
  status: "queued" | "running" | "done" | "failed" | "approval";
  meta: string;
}

export type ApprovalStatus = "pending" | "approved" | "denied";

export interface ApprovalRequest {
  id: string;
  command: string;
  description: string;
  status: ApprovalStatus;
}

export interface AgentMessage {
  id: string;
  role: MessageRole;
  title: string;
  text?: string;
  plan?: PlanItem[];
  steps?: ToolStep[];
  approval?: ApprovalRequest;
}

export interface WorkspaceFile {
  path: string;
  badge?: string;
  preview: string;
}

export interface DiffLine {
  type: "file" | "add" | "ctx" | "remove";
  value: string;
}

export interface TaskContextItem {
  label: string;
  value: string;
}

export interface AgentTask {
  id: string;
  title: string;
  branch: string;
  runStatus: RunStatus;
  summary: string;
  meta: string;
  pendingApprovalId?: string;
  files: WorkspaceFile[];
  terminal: string[];
  context: TaskContextItem[];
  diff: DiffLine[];
  messages: AgentMessage[];
}

export interface CreateTaskInput {
  title?: string;
}

export interface SendMessageInput {
  taskId: string;
  prompt: string;
}

export type ApprovalDecision = "allow" | "deny";

export interface ApprovalInput {
  taskId: string;
  approvalId: string;
  decision: ApprovalDecision;
}

export type RunEvent =
  | { type: "task_updated"; task: AgentTask }
  | { type: "message_added"; taskId: string; message: AgentMessage }
  | { type: "terminal_appended"; taskId: string; lines: string[] };

export type RunEventHandler = (event: RunEvent) => void;

export type Unsubscribe = () => void;
