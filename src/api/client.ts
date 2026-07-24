import type {
  AgentTask,
  ApprovalInput,
  CreateTaskInput,
  RunEventHandler,
  SendMessageInput,
  Unsubscribe,
} from "./types";
import { mockClient } from "./mockClient";
import { httpClient } from "./httpClient";

export interface AgentClient {
  listTasks(): Promise<AgentTask[]>;
  createTask(input?: CreateTaskInput): Promise<AgentTask>;
  sendMessage(input: SendMessageInput): Promise<AgentTask>;
  startRun(taskId: string): Promise<AgentTask>;
  stopRun(taskId: string): Promise<AgentTask>;
  approveCommand(input: ApprovalInput): Promise<AgentTask>;
  subscribeRunEvents(taskId: string, handler: RunEventHandler): Unsubscribe;
}

export const agentClient: AgentClient = import.meta.env.VITE_API_MODE === "real" ? httpClient : mockClient;
