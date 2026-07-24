import { Code2, FileCode2, GitCompare, ListTree, Terminal } from "lucide-react";
import type { ReactNode } from "react";
import type { AgentTask, ApiSettings, WorkspaceFile, WorkspaceTab } from "../types";

interface WorkspacePaneProps {
  task: AgentTask;
  activeFilePath: string;
  activeTab: WorkspaceTab;
  settings: ApiSettings;
  onFileSelect: (path: string) => void;
  onTabChange: (tab: WorkspaceTab) => void;
}

const tabs: Array<{ id: WorkspaceTab; label: string }> = [
  { id: "files", label: "Files" },
  { id: "diff", label: "Diff" },
  { id: "terminal", label: "Terminal" },
  { id: "context", label: "Context" },
];

export function WorkspacePane({ task, activeFilePath, activeTab, settings, onFileSelect, onTabChange }: WorkspacePaneProps) {
  const activeFile = task.files.find((file) => file.path === activeFilePath) ?? task.files[0];

  return (
    <aside className="workspace-pane" aria-label="工作区">
      <div className="tabs" role="tablist">
        {tabs.map((tab) => (
          <button className={`tab ${activeTab === tab.id ? "active" : ""}`} type="button" key={tab.id} onClick={() => onTabChange(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "files" && (
        <section className="workspace-section active">
          <SectionTitle icon={<ListTree size={14} />} label="Workspace" />
          <div className="file-tree">
            {task.files.map((file) => (
              <FileRow file={file} active={file.path === activeFile?.path} key={file.path} onSelect={onFileSelect} />
            ))}
          </div>
          {activeFile && (
            <div className="file-preview">
              <div className="preview-title">{activeFile.path}</div>
              <pre>
                <code>{activeFile.preview}</code>
              </pre>
            </div>
          )}
        </section>
      )}

      {activeTab === "diff" && (
        <section className="workspace-section active">
          <SectionTitle icon={<GitCompare size={14} />} label="Changes" />
          <div className="diff-view">
            {task.diff.map((line, index) =>
              line.type === "file" ? (
                <div className="diff-file" key={`${line.value}-${index}`}>
                  {line.value}
                </div>
              ) : (
                <pre key={`${line.value}-${index}`}>
                  <code>
                    <span className={`diff-${line.type}`}>{line.value || " "}</span>
                  </code>
                </pre>
              ),
            )}
          </div>
        </section>
      )}

      {activeTab === "terminal" && (
        <section className="workspace-section active">
          <SectionTitle icon={<Terminal size={14} />} label="Terminal" />
          <pre className="terminal-output">{task.terminal.join("\n")}</pre>
        </section>
      )}

      {activeTab === "context" && (
        <section className="workspace-section active">
          <SectionTitle icon={<Code2 size={14} />} label="Run Context" />
          <div className="context-list">
            {[...task.context, { label: "API Base URL", value: settings.baseUrl }, { label: "Key Source", value: "DEEPSEEK_API_KEY in backend .env" }].map((item) => (
              <div className="context-item" key={`${item.label}-${item.value}`}>
                <b>{item.label}</b>
                <span>{item.value}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </aside>
  );
}

function SectionTitle({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="section-title">
      {icon}
      {label}
    </div>
  );
}

function FileRow({ file, active, onSelect }: { file: WorkspaceFile; active: boolean; onSelect: (path: string) => void }) {
  return (
    <button className={`file-row ${active ? "active" : ""}`} type="button" onClick={() => onSelect(file.path)}>
      <FileCode2 size={14} />
      <span>{file.path}</span>
      <span className="file-badge">{file.badge ?? ""}</span>
    </button>
  );
}
