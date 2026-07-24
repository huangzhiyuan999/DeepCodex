import {
  FileText,
  PanelRightOpen,
  Send,
  Square,
  Terminal,
  TextSearch,
} from "lucide-react";
import type {
  AgentMessage,
  AgentTask,
  ApprovalDecision,
  ApprovalRequest,
  WorkspaceTab,
} from "../types";

interface ChatPaneProps {
  task: AgentTask;
  prompt: string;
  connectionLabel: string;
  onPromptChange: (value: string) => void;
  onSubmit: () => void;
  onStopRun: () => void;
  onToggleWorkspace: () => void;
  onOpenTab: (tab: WorkspaceTab) => void;
  onApproval: (approvalId: string, action: ApprovalDecision) => void;
}

export function ChatPane({
  task,
  prompt,
  connectionLabel,
  onPromptChange,
  onSubmit,
  onStopRun,
  onToggleWorkspace,
  onOpenTab,
  onApproval,
}: ChatPaneProps) {
  const canStop = task.runStatus === "running" || task.runStatus === "waiting_approval";

  return (
    <main className="chat-pane">
      <header className="chat-header">
        <div>
          <h1>{task.title}</h1>
          <p>
            {task.branch} · {task.meta}
          </p>
        </div>
        <div className="header-actions">
          <button
            className="icon-button"
            type="button"
            title="显示或隐藏工作区"
            aria-label="显示或隐藏工作区"
            onClick={onToggleWorkspace}
          >
            <PanelRightOpen size={17} />
          </button>
        </div>
      </header>

      <div className="timeline-wrap">
        <ConversationIndex messages={task.messages} />
        <section className="timeline" aria-label="对话和执行流">
          {task.messages.map((message) => (
            <MessageCard key={message.id} message={message} onApproval={onApproval} />
          ))}
        </section>
      </div>

      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="composer-toolbar">
          <button className="tool-button" type="button" onClick={() => onOpenTab("files")}>
            <FileText size={14} />
            文件
          </button>
          <button className="tool-button" type="button" onClick={() => onOpenTab("terminal")}>
            <Terminal size={14} />
            终端
          </button>
          <button className="tool-button" type="button" onClick={() => onOpenTab("context")}>
            <TextSearch size={14} />
            上下文
          </button>
          <span>{connectionLabel}</span>
        </div>
        <div className="composer-row">
          <textarea
            rows={1}
            value={prompt}
            placeholder="让 DeepClaude 修改代码、解释 diff 或运行检查"
            onChange={(event) => onPromptChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSubmit();
              }
            }}
          />
          <button
            className={`send-button ${canStop ? "is-stopping" : ""}`}
            type={canStop ? "button" : "submit"}
            onClick={canStop ? onStopRun : undefined}
          >
            {canStop ? <Square size={14} /> : <Send size={15} />}
            {canStop ? "停止" : "发送"}
          </button>
        </div>
      </form>
    </main>
  );
}

function ConversationIndex({ messages }: { messages: AgentMessage[] }) {
  function jumpToMessage(messageId: string) {
    document.getElementById(`message-${messageId}`)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }

  return (
    <nav className="conversation-index" aria-label="对话索引">
      {messages.map((message) => (
        <button
          className={`index-mark ${message.role}`}
          type="button"
          key={message.id}
          aria-label={`定位到${message.title}`}
          onClick={() => jumpToMessage(message.id)}
        >
          <span className="index-line" />
          <span className="index-preview">
            <b>{previewTitle(message)}</b>
            <span>{previewText(message)}</span>
            <small>{previewMeta(message)}</small>
          </span>
        </button>
      ))}
    </nav>
  );
}

function previewTitle(message: AgentMessage): string {
  if (message.role === "user") return message.text || "用户消息";
  if (message.approval) return `请求审批：${message.approval.command}`;
  if (message.steps?.length) return `工具调用：${message.steps[0].name}`;
  if (message.plan?.length) return "执行计划";
  return message.text || message.title;
}

function previewText(message: AgentMessage): string {
  if (message.text) return message.text;
  if (message.approval) return message.approval.description;
  if (message.steps?.length) return message.steps.map((step) => step.name).join(" · ");
  if (message.plan?.length) return message.plan.map((item) => item.label).join(" · ");
  return message.title;
}

function previewMeta(message: AgentMessage): string {
  if (message.approval) return `${message.approval.status} · approval`;
  if (message.steps?.length) return `${message.steps.length} tool calls`;
  if (message.plan?.length) return `${message.plan.length} steps`;
  return message.role;
}

function MessageCard({
  message,
  onApproval,
}: {
  message: AgentMessage;
  onApproval: (approvalId: string, action: ApprovalDecision) => void;
}) {
  return (
    <article className={`message ${message.role}`} id={`message-${message.id}`}>
      <div className="message-title">{message.title}</div>
      <div className="message-body">
        {message.text && <p>{message.text}</p>}

        {message.plan && (
          <div className="plan">
            {message.plan.map((item, index) => (
              <div className={`plan-row ${item.status}`} key={item.label}>
                <span className="check">{item.status === "done" ? "✓" : index + 1}</span>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        )}

        {message.steps && (
          <div className="steps">
            {message.steps.map((step) => (
              <div className={`step ${step.status === "approval" ? "approval" : ""}`} key={step.name}>
                <div className="step-main">
                  <span>{step.name}</span>
                  <span className="step-pill">{step.status}</span>
                </div>
                <div className="step-meta">{step.meta}</div>
                {step.status === "approval" && <div className="step-meta">等待后端审批事件</div>}
              </div>
            ))}
          </div>
        )}

        {message.approval && (
          <div className="step approval">
            <div className="step-main">
              <span>run_command: {message.approval.command}</span>
              <span className="step-pill">approval</span>
            </div>
            <div className="step-meta">{message.approval.description}</div>
            <ApprovalActions approval={message.approval} onApproval={onApproval} />
          </div>
        )}
      </div>
    </article>
  );
}

function ApprovalActions({
  approval,
  onApproval,
}: {
  approval: ApprovalRequest;
  onApproval: (approvalId: string, action: ApprovalDecision) => void;
}) {
  const handled = approval.status !== "pending";
  const label = approval.status === "approved" ? "已允许" : approval.status === "denied" ? "已拒绝" : "";

  return (
    <div className="approval-actions">
      {handled && <span className={`approval-result ${approval.status}`}>{label}</span>}
      <button
        className="ghost-button"
        type="button"
        disabled={handled}
        onClick={() => onApproval(approval.id, "deny")}
      >
        拒绝
      </button>
      <button
        className="send-button"
        type="button"
        disabled={handled}
        onClick={() => onApproval(approval.id, "allow")}
      >
        允许
      </button>
    </div>
  );
}
