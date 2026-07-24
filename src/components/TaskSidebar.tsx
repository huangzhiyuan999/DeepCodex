import { Plus, Search, Settings } from "lucide-react";
import type { AgentTask, ApiSettings } from "../types";

interface TaskSidebarProps {
  tasks: AgentTask[];
  activeTaskId: string;
  searchTerm: string;
  settings: ApiSettings;
  onSearchChange: (value: string) => void;
  onTaskSelect: (taskId: string) => void;
  onNewTask: () => void;
  onOpenSettings: () => void;
}

const statusClass: Record<AgentTask["runStatus"], string> = {
  idle: "idle",
  running: "running",
  waiting_approval: "warn",
  approved: "running",
  denied: "stopped",
  completed: "done",
  failed: "stopped",
  stopped: "stopped",
};

export function TaskSidebar({
  tasks,
  activeTaskId,
  searchTerm,
  settings,
  onSearchChange,
  onTaskSelect,
  onNewTask,
  onOpenSettings,
}: TaskSidebarProps) {
  return (
    <aside className="task-sidebar" aria-label="任务列表">
      <div className="brand-row">
        <div className="brand-mark">D</div>
        <div>
          <div className="brand-name">DeepClaude</div>
          <div className="brand-subtitle">Local Agent Workspace</div>
        </div>
      </div>

      <button className="new-task-button" type="button" onClick={onNewTask}>
        <Plus size={16} />
        新建任务
      </button>

      <label className="search-box">
        <span>搜索</span>
        <div className="search-input-wrap">
          <Search size={15} />
          <input
            type="search"
            value={searchTerm}
            placeholder="任务、文件、命令"
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
      </label>

      <nav className="task-list" aria-label="任务">
        {tasks.map((task) => (
          <button
            className={`task-item ${task.id === activeTaskId ? "active" : ""}`}
            type="button"
            key={task.id}
            onClick={() => onTaskSelect(task.id)}
          >
            <div className="task-item-title">
              <span>{task.title}</span>
              <span className={`status-dot ${statusClass[task.runStatus]}`} />
            </div>
            <div className="task-meta">{task.summary}</div>
          </button>
        ))}
      </nav>

      <div className="api-card">
        <div className="api-card-header">
          <span>API</span>
          <strong>DeepSeek</strong>
        </div>
        <div className="api-meta">
          <span>模型</span>
          <b>{settings.model}</b>
        </div>
        <div className="api-meta">
          <span>Key</span>
          <b>后端 .env</b>
        </div>
        <button className="ghost-button" type="button" onClick={onOpenSettings}>
          <Settings size={15} />
          配置
        </button>
      </div>
    </aside>
  );
}
