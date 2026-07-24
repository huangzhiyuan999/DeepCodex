from __future__ import annotations

import asyncio
import json
from collections import defaultdict
from collections.abc import AsyncIterator
from dataclasses import asdict, dataclass
from typing import Any


@dataclass
class RunEvent:
    type: str
    payload: dict[str, Any]

    def to_sse(self) -> str:
        return f"event: {self.type}\ndata: {json.dumps(asdict(self), ensure_ascii=False)}\n\n"


class RunEventBus:
    def __init__(self) -> None:
        self._queues: dict[str, list[asyncio.Queue[RunEvent]]] = defaultdict(list)

    async def publish(self, run_id: str, event: RunEvent) -> None:
        for queue in list(self._queues[run_id]):
            await queue.put(event)

    async def subscribe(self, run_id: str) -> AsyncIterator[RunEvent]:
        queue: asyncio.Queue[RunEvent] = asyncio.Queue()
        self._queues[run_id].append(queue)
        try:
            while True:
                yield await queue.get()
        finally:
            self._queues[run_id].remove(queue)


event_bus = RunEventBus()
