import type { AgentTask, ApiSettings } from "../api/types";

export const defaultSettings: ApiSettings = {
  provider: "deepseek",
  baseUrl: "https://api.deepseek.com",
  model: "deepseek-chat",
  keySource: "backend-env",
};

export const initialTasks: AgentTask[] = [
  {
    id: "search-tool",
    title: "实现文件搜索工具",
    branch: "main",
    runStatus: "running",
    summary: "进行中 · 3 个文件",
    meta: "workspace F:\\deepclaude · 需要检查 3 个文件",
    files: [
      { path: "src/deepclaude/agent.py", badge: "M", preview: "tools.register(SearchTextTool(workspace))" },
      { path: "src/deepclaude/workspace.py", preview: "def resolve_workspace_path(path: str) -> Path:" },
      { path: "src/deepclaude/tools/search.py", badge: "A", preview: "def search_text(root: Path, query: str) -> list[SearchHit]:" },
      { path: "tests/test_search_tool.py", badge: "A", preview: "def test_search_text_limits_workspace(tmp_path):" },
      { path: ".env.example", preview: "DEEPSEEK_API_KEY=sk-your-deepseek-key" },
    ],
    terminal: [
      "F:\\deepclaude> pytest",
      "collected 12 items",
      "",
      "tests/test_search_tool.py ...                                      [ 25%]",
      "tests/test_workspace.py ....                                       [ 58%]",
      "tests/test_agent_tools.py .....                                    [100%]",
      "",
      "12 passed in 0.84s",
    ],
    context: [
      { label: "Provider", value: "DeepSeek via local backend proxy" },
      { label: "Model", value: "deepseek-chat" },
      { label: "Workspace", value: "F:\\deepclaude" },
      { label: "Approval", value: "Shell commands and dependency installs require confirmation" },
    ],
    diff: [
      { type: "file", value: "src/deepclaude/tools/search.py" },
      { type: "add", value: "+def search_text(root: Path, query: str) -> list[SearchHit]:" },
      { type: "add", value: "+    return ripgrep(root, query, max_results=80)" },
      { type: "ctx", value: "" },
      { type: "file", value: "src/deepclaude/agent.py" },
      { type: "add", value: "+tools.register(SearchTextTool(workspace))" },
      { type: "ctx", value: "" },
      { type: "file", value: "tests/test_search_tool.py" },
      { type: "add", value: "+def test_search_text_limits_workspace(tmp_path):" },
      { type: "add", value: "+    assert search_text(tmp_path, \"agent\") == []" },
    ],
    messages: [
      {
        id: "m1",
        role: "user",
        title: "你",
        text: "帮我实现一个工作区内的文件搜索工具，命令输出要有限制，避免上下文爆掉。",
      },
      {
        id: "m2",
        role: "assistant",
        title: "DeepClaude",
        plan: [
          { label: "检查项目结构和工具注册方式", status: "done" },
          { label: "添加 search_text 工具并限制工作区边界", status: "done" },
          { label: "补充测试并运行 pytest", status: "waiting" },
        ],
      },
      {
        id: "m3",
        role: "tool",
        title: "工具调用",
        steps: [
          { name: "list_files", status: "done", meta: "发现 src/deepclaude/tools 和 tests 目录" },
          { name: "apply_patch", status: "done", meta: "新增 search.py，更新 agent.py 工具注册" },
          { name: "run_command: pytest", status: "approval", meta: "此命令会在当前工作区执行测试" },
        ],
      },
      {
        id: "m4",
        role: "assistant",
        title: "DeepClaude",
        text: "搜索工具已经接入工具注册表，并限制只能访问当前 workspace。下一步等待你允许运行测试，我会根据失败结果继续修正。",
      },
    ],
  },
  {
    id: "login-page",
    title: "实现登录页交互",
    branch: "ui/login",
    runStatus: "idle",
    summary: "等待检查 · UI",
    meta: "workspace F:\\deepclaude · 2 个组件",
    files: [
      { path: "frontend/src/pages/Login.tsx", badge: "M", preview: "export function LoginPage() {" },
      { path: "frontend/src/components/AuthForm.tsx", badge: "A", preview: "const schema = z.object({" },
    ],
    terminal: ["F:\\deepclaude> npm run build", "built in 1.62s"],
    context: [
      { label: "Mode", value: "Frontend prototype" },
      { label: "Design", value: "Claude-like calm chat + Codex-like task rail" },
      { label: "Risk", value: "Need mobile responsive pass" },
    ],
    diff: [
      { type: "file", value: "frontend/src/pages/Login.tsx" },
      { type: "add", value: "+<AuthForm onSubmit={startSession} />" },
      { type: "file", value: "frontend/src/components/AuthForm.tsx" },
      { type: "add", value: "+<button type=\"submit\">Continue</button>" },
    ],
    messages: [
      { id: "login-1", role: "user", title: "你", text: "先把登录页做成可交互版本，后端可以先 mock。" },
      { id: "login-2", role: "assistant", title: "DeepClaude", text: "登录页的输入、校验、loading 和错误状态已经模拟完成，等待你检查视觉效果。" },
    ],
  },
  {
    id: "tests",
    title: "修复测试失败",
    branch: "main",
    runStatus: "completed",
    summary: "已完成 · pytest",
    meta: "workspace F:\\deepclaude · 12 passed",
    files: [
      { path: "tests/test_agent_tools.py", badge: "M", preview: "assert result.exit_code == 0" },
      { path: "src/deepclaude/tools/shell.py", badge: "M", preview: "return CommandResult(stdout=trimmed)" },
    ],
    terminal: ["F:\\deepclaude> pytest", "12 passed in 0.84s"],
    context: [
      { label: "Result", value: "All tests passed" },
      { label: "Changed Files", value: "2" },
    ],
    diff: [
      { type: "file", value: "src/deepclaude/tools/shell.py" },
      { type: "add", value: "+stdout = limit_output(process.stdout, max_chars=12000)" },
      { type: "add", value: "+stderr = limit_output(process.stderr, max_chars=8000)" },
    ],
    messages: [
      { id: "tests-1", role: "user", title: "你", text: "测试挂了，帮我修。" },
      { id: "tests-2", role: "assistant", title: "DeepClaude", text: "失败原因是 shell 输出没有截断导致断言不稳定。我已经修复并重新跑过测试。" },
    ],
  },
  {
    id: "approval",
    title: "审批依赖安装",
    branch: "frontend",
    runStatus: "waiting_approval",
    summary: "需要确认 · npm install",
    meta: "workspace F:\\deepclaude · 等待用户确认",
    pendingApprovalId: "approval-install",
    files: [
      { path: "package.json", badge: "M", preview: "\"dependencies\": { \"@uiw/react-codemirror\": \"latest\" }" },
      { path: "package-lock.json", badge: "A", preview: "{ \"lockfileVersion\": 3 }" },
    ],
    terminal: ["F:\\deepclaude> npm install", "waiting for approval..."],
    context: [
      { label: "Command", value: "npm install" },
      { label: "Scope", value: "Local node_modules under F:\\deepclaude" },
      { label: "Needs Approval", value: "Network download" },
    ],
    diff: [
      { type: "file", value: "package.json" },
      { type: "add", value: "+\"@uiw/react-codemirror\": \"latest\"" },
    ],
    messages: [
      { id: "approval-1", role: "user", title: "你", text: "代码预览想加编辑器，看看需要哪些包。" },
      {
        id: "approval-2",
        role: "assistant",
        title: "工具调用",
        approval: {
          id: "approval-install",
          command: "npm install",
          description: "会下载前端依赖到当前项目的 node_modules，不会安装到全局。",
          status: "pending",
        },
      },
    ],
  },
];
