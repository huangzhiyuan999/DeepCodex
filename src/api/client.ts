import type {
  AgentTask,
  ApprovalInput,
  CreateTaskInput,
  RunEventHandler,
  SendMessageInput,
  Unsubscribe,
} from "./types";
import { mockClient } from "./mockClient";

export interface AgentClient {
  listTasks(): Promise<AgentTask[]>;
  createTask(input?: CreateTaskInput): Promise<AgentTask>;
  sendMessage(input: SendMessageInput): Promise<AgentTask>;
  startRun(taskId: string): Promise<AgentTask>;
  stopRun(taskId: string): Promise<AgentTask>;
  approveCommand(input: ApprovalInput): Promise<AgentTask>;
  subscribeRunEvents(taskId: string, handler: RunEventHandler): Unsubscribe;
}

export const agentClient: AgentClient = mockClient;
