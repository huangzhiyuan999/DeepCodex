from __future__ import annotations

import subprocess
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class FileEntry:
    path: str
    kind: str
    size: int


@dataclass(frozen=True)
class SearchHit:
    path: str
    line: int
    preview: str


class WorkspaceTools:
    def __init__(self, workspace_root: Path | str) -> None:
        self.workspace_root = Path(workspace_root).resolve()
        if not self.workspace_root.exists():
            raise FileNotFoundError(f"Workspace does not exist: {self.workspace_root}")

    def list_files(self, max_entries: int = 400) -> list[FileEntry]:
        entries: list[FileEntry] = []
        for path in self.workspace_root.rglob("*"):
            if self._is_ignored(path):
                continue
            relative = path.relative_to(self.workspace_root).as_posix()
            entries.append(FileEntry(path=relative, kind="dir" if path.is_dir() else "file", size=path.stat().st_size if path.is_file() else 0))
            if len(entries) >= max_entries:
                break
        return entries

    def read_file(self, relative_path: str, max_chars: int = 40_000) -> str:
        path = self.resolve_path(relative_path)
        if not path.is_file():
            raise FileNotFoundError(f"File not found: {relative_path}")
        return path.read_text(encoding="utf-8", errors="replace")[:max_chars]

    def search_text(self, query: str, max_hits: int = 80) -> list[SearchHit]:
        if not query:
            return []
        hits: list[SearchHit] = []
        for path in self.workspace_root.rglob("*"):
            if self._is_ignored(path) or not path.is_file():
                continue
            try:
                for line_number, line in enumerate(path.read_text(encoding="utf-8", errors="replace").splitlines(), start=1):
                    if query.lower() in line.lower():
                        hits.append(
                            SearchHit(
                                path=path.relative_to(self.workspace_root).as_posix(),
                                line=line_number,
                                preview=line.strip()[:240],
                            )
                        )
                        if len(hits) >= max_hits:
                            return hits
            except OSError:
                continue
        return hits

    def git_diff(self, max_chars: int = 60_000) -> str:
        result = subprocess.run(
            ["git", "diff", "--no-ext-diff"],
            cwd=self.workspace_root,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            check=False,
        )
        return result.stdout[:max_chars]

    def resolve_path(self, relative_path: str) -> Path:
        path = (self.workspace_root / relative_path).resolve()
        if self.workspace_root != path and self.workspace_root not in path.parents:
            raise PermissionError(f"Path escapes workspace: {relative_path}")
        return path

    def _is_ignored(self, path: Path) -> bool:
        ignored_parts = {
            ".git",
            ".venv",
            "__pycache__",
            "node_modules",
            "dist",
            "backend/data",
        }
        relative = path.relative_to(self.workspace_root).as_posix()
        return any(part in ignored_parts for part in path.parts) or relative.startswith("backend/data/")
