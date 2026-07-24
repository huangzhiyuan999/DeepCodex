import { X } from "lucide-react";
import type { ApiSettings } from "../types";

interface SettingsDialogProps {
  open: boolean;
  settings: ApiSettings;
  connectionState: string;
  onClose: () => void;
  onSave: (settings: ApiSettings) => void;
  onTestConnection: () => void;
}

export function SettingsDialog({ open, settings, connectionState, onClose, onSave, onTestConnection }: SettingsDialogProps) {
  if (!open) return null;

  return (
    <div className="dialog-backdrop" role="presentation">
      <form
        className="settings-panel"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          onSave({
            provider: "deepseek",
            baseUrl: String(formData.get("baseUrl")),
            model: String(formData.get("model")) as ApiSettings["model"],
            keySource: "backend-env",
          });
        }}
      >
        <div className="settings-header">
          <div>
            <h2>API 配置</h2>
            <p>前端不保存 DeepSeek Key。真实调用由本地 Python 后端读取 .env 后转发。</p>
          </div>
          <button className="icon-button" type="button" aria-label="关闭" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <label className="field">
          <span>Provider</span>
          <select name="provider" defaultValue="deepseek">
            <option value="deepseek">DeepSeek</option>
          </select>
        </label>

        <label className="field">
          <span>Base URL</span>
          <input name="baseUrl" type="url" defaultValue={settings.baseUrl} />
        </label>

        <label className="field">
          <span>Model</span>
          <select name="model" defaultValue={settings.model}>
            <option value="deepseek-chat">deepseek-chat</option>
            <option value="deepseek-reasoner">deepseek-reasoner</option>
          </select>
        </label>

        <label className="field">
          <span>Key Source</span>
          <input value="DEEPSEEK_API_KEY in backend .env" readOnly />
        </label>

        <div className="settings-note">
          后端建议提供 <code>GET /api/config</code>、<code>POST /api/tasks</code>、<code>POST /api/runs</code>、
          <code>GET /api/runs/:id/events</code> 和 <code>POST /api/approvals/:id</code>。
        </div>

        <div className="settings-actions">
          <span className="connection-state">{connectionState}</span>
          <button className="ghost-button" type="button" onClick={onTestConnection}>
            测试连接
          </button>
          <button className="send-button" type="submit">
            保存
          </button>
        </div>
      </form>
    </div>
  );
}
