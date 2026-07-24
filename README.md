# DeepClaude

DeepClaude is a local coding-agent workspace prototype. It borrows the core product ideas from Codex-style task execution and Claude-style conversation without copying their branding.

## Current Scope

The frontend is a Vite + React + TypeScript app with a mock agent client. The backend folder is a FastAPI skeleton prepared for DeepSeek, streaming run events, and command approvals.

## Project Structure

```text
F:\deepclaude
  backend
    main.py
    config.py
    deepseek_client.py
    run_events.py
    state
      store.py
    requirements.txt
  src
    api
      client.ts
      mockClient.ts
      types.ts
    components
      ChatPane.tsx
      SettingsDialog.tsx
      TaskSidebar.tsx
      WorkspacePane.tsx
    data
      mockData.ts
    utils
      settingsStorage.ts
    App.tsx
    main.tsx
    styles.css
```

## Frontend Commands

```powershell
npm install
npm run dev
npm run build
```

Node packages stay in local `node_modules` under `F:\deepclaude`.

## Backend Setup

Create a local virtual environment inside this folder:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

Python packages should stay inside `.venv`.

## Local Storage

The first storage module follows the CodeWhale-style local-first design:

```text
backend/data/deepclaude.sqlite
backend/data/session_index.jsonl
backend/data/sessions/*.jsonl
backend/data/logs/*.log
```

- SQLite stores structured state: tasks, messages, approvals, tool calls, checkpoints, jobs, workflow runs, and goals.
- JSONL stores append-only session events for replay, recovery, and debugging.
- Runtime data under `backend/data/` is ignored by Git.

## DeepSeek Config

Copy `.env.example` to `.env` when you are ready to call DeepSeek:

```env
DEEPSEEK_API_KEY=sk-your-deepseek-key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

The frontend must not store the DeepSeek key. It should call the local backend only.

## Frontend Features

- Responsive layout:
  - desktop: task list + chat + workspace
  - medium screens: workspace is collapsible
  - mobile: top switcher for tasks, chat, and workspace
- Dark workspace visual style closer to coding-agent tools
- Chat timeline with user messages, plans, tool calls, and approval cards
- Explicit run states: `idle`, `running`, `waiting_approval`, `approved`, `denied`, `completed`, `failed`, `stopped`
- Only one pending approval per task
- Approval buttons disable after allow or deny
- Files, Diff, Terminal, and Context workspace tabs
- API settings dialog for non-secret DeepSeek settings

## Planned Backend API

- `GET /api/config`
- `POST /api/tasks`
- `POST /api/runs`
- `GET /api/runs/:id/events`
- `POST /api/approvals/:id`
- `POST /api/runs/:id/stop`
