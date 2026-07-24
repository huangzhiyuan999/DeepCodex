import { useEffect, useMemo, useState } from "react";
import { ChatPane } from "./components/ChatPane";
import { SettingsDialog } from "./components/SettingsDialog";
import { TaskSidebar } from "./components/TaskSidebar";
import { WorkspacePane } from "./components/WorkspacePane";
import { agentClient } from "./api/client";
import type { AgentTask, ApiSettings, MobileView, RunEvent, WorkspaceTab } from "./types";
import { loadSettings, saveSettings } from "./utils/settingsStorage";

function upsertTask(tasks: AgentTask[], nextTask: AgentTask): AgentTask[] {
  const exists = tasks.some((task) => task.id === nextTask.id);
  if (!exists) return [nextTask, ...tasks];
  return tasks.map((task) => (task.id === nextTask.id ? nextTask : task));
}

export function App() {
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [activeTaskId, setActiveTaskId] = useState("");
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("files");
  const [activeFilePath, setActiveFilePath] = useState("");
  const [mobileView, setMobileView] = useState<MobileView>("chat");
  const [searchTerm, setSearchTerm] = useState("");
  const [prompt, setPrompt] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rightPaneVisible, setRightPaneVisible] = useState(false);
  const [settings, setSettings] = useState<ApiSettings>(() => loadSettings());
  const [connectionState, setConnectionState] = useState("DeepSeek proxy ready");

  useEffect(() => {
    agentClient.listTasks().then((loadedTasks) => {
      setTasks(loadedTasks);
      const firstTask = loadedTasks[0];
      if (!firstTask) return;
      setActiveTaskId(firstTask.id);
      setActiveFilePath(firstTask.files[0]?.path ?? "");
    });
  }, []);

  useEffect(() => {
    if (!activeTaskId) return;
    return agentClient.subscribeRunEvents(activeTaskId, handleRunEvent);
  }, [activeTaskId]);

  const visibleTasks = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return tasks;
    return tasks.filter((task) => `${task.title} ${task.summary} ${task.branch}`.toLowerCase().includes(query));
  }, [searchTerm, tasks]);

  const activeTask = tasks.find((task) => task.id === activeTaskId) ?? tasks[0];
  const connectionLabel = `${settings.model} · backend proxy`;

  function handleRunEvent(event: RunEvent) {
    if (event.type !== "task_updated") return;
    setTasks((current) => upsertTask(current, event.task));
  }

  function handleTaskSelect(taskId: string) {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    setActiveTaskId(taskId);
    setActiveFilePath(task.files[0]?.path ?? "");
    setMobileView("chat");
  }

  async function handleNewTask() {
    const task = await agentClient.createTask();
    setTasks((current) => upsertTask(current, task));
    setActiveTaskId(task.id);
    setActiveFilePath(task.files[0]?.path ?? "");
    setPrompt("");
    setMobileView("chat");
  }

  async function handleSubmit() {
    if (!activeTask) return;
    const text = prompt.trim();
    if (!text) return;

    setPrompt("");
    const task = await agentClient.sendMessage({ taskId: activeTask.id, prompt: text });
    setTasks((current) => upsertTask(current, task));
    setMobileView("chat");
  }

  async function handleApproval(approvalId: string, decision: "allow" | "deny") {
    if (!activeTask) return;
    const task = await agentClient.approveCommand({ taskId: activeTask.id, approvalId, decision });
    setTasks((current) => upsertTask(current, task));
    if (decision === "allow") {
      setActiveTab("terminal");
      setMobileView("workspace");
      setRightPaneVisible(true);
    }
  }

  async function handleStopRun() {
    if (!activeTask) return;
    const task = await agentClient.stopRun(activeTask.id);
    setTasks((current) => upsertTask(current, task));
  }

  function handleOpenTab(tab: WorkspaceTab) {
    setActiveTab(tab);
    setRightPaneVisible(true);
    setMobileView("workspace");
  }

  function handleSaveSettings(nextSettings: ApiSettings) {
    setSettings(nextSettings);
    saveSettings(nextSettings);
    setConnectionState(`${nextSettings.model} · backend proxy`);
    setSettingsOpen(false);
  }

  function handleTestConnection() {
    setConnectionState("DeepSeek proxy check simulated");
    window.setTimeout(() => setConnectionState(`${settings.model} · backend proxy`), 1400);
  }

  if (!activeTask) {
    return <div className="loading-screen">正在加载 DeepClaude 工作台...</div>;
  }

  return (
    <>
      <div className={`app-shell ${rightPaneVisible ? "" : "workspace-collapsed"} mobile-view-${mobileView}`}>
        <MobileNav activeView={mobileView} onViewChange={setMobileView} />

        <TaskSidebar
          tasks={visibleTasks}
          activeTaskId={activeTask.id}
          searchTerm={searchTerm}
          settings={settings}
          onSearchChange={setSearchTerm}
          onTaskSelect={handleTaskSelect}
          onNewTask={handleNewTask}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <ChatPane
          task={activeTask}
          prompt={prompt}
          connectionLabel={connectionLabel}
          onPromptChange={setPrompt}
          onSubmit={handleSubmit}
          onStopRun={handleStopRun}
          onToggleWorkspace={() => setRightPaneVisible((visible) => !visible)}
          onOpenTab={handleOpenTab}
          onApproval={handleApproval}
        />

        <WorkspacePane
          task={activeTask}
          activeFilePath={activeFilePath}
          activeTab={activeTab}
          settings={settings}
          onFileSelect={setActiveFilePath}
          onTabChange={setActiveTab}
        />
      </div>

      <SettingsDialog
        open={settingsOpen}
        settings={settings}
        connectionState={connectionState}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSaveSettings}
        onTestConnection={handleTestConnection}
      />
    </>
  );
}

function MobileNav({ activeView, onViewChange }: { activeView: MobileView; onViewChange: (view: MobileView) => void }) {
  return (
    <nav className="mobile-nav" aria-label="移动端视图切换">
      <button className={activeView === "tasks" ? "active" : ""} type="button" onClick={() => onViewChange("tasks")}>
        任务
      </button>
      <button className={activeView === "chat" ? "active" : ""} type="button" onClick={() => onViewChange("chat")}>
        对话
      </button>
      <button className={activeView === "workspace" ? "active" : ""} type="button" onClick={() => onViewChange("workspace")}>
        工作区
      </button>
    </nav>
  );
}
