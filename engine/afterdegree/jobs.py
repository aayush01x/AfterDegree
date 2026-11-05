"""In-process async job runner. Every tool run is a job persisted to SQLite; progress is streamed over SSE."""

from __future__ import annotations

import asyncio
import json
import logging
import secrets
from collections.abc import AsyncIterator
from typing import Any

from .config import Settings
from .crustdata import CrustdataClient, CrustdataError
from .db import Store
from .toolkit import ToolContext, ToolInputError

log = logging.getLogger("afterdegree.jobs")


def new_job_id() -> str:
    return "job_" + secrets.token_hex(8)


class JobRunner:
    def __init__(self, store: Store, client: CrustdataClient, settings: Settings, llm: Any = None):
        self.store = store
        self.client = client
        self.settings = settings
        self.llm = llm
        self._tasks: set[asyncio.Task] = set()
        self._live: dict[str, dict] = {}
        self._changed: dict[str, asyncio.Event] = {}

    # ------------------------------------------------------------ state

    def _set(self, job_id: str, **fields: Any) -> None:
        state = self._live.setdefault(job_id, {})
        state.update(fields)
        self.store.update_job(job_id, **fields)
        ev = self._changed.get(job_id)
        if ev is not None:
            ev.set()

    def get(self, job_id: str) -> dict | None:
        row = self.store.get_job(job_id)
        if row is None:
            return None
        return {
            "job_id": row["job_id"],
            "tool": row["tool"],
            "status": row["status"],
            "progress": row["progress"],
            "result": row["result"],
            "error": row["error"],
        }

    # ------------------------------------------------------------ running

    def start(self, tool: str, run_fn, profile: dict, params: dict) -> str:
        job_id = new_job_id()
        self.store.create_job(job_id, tool, profile.get("profile_id"), params)
        self._changed[job_id] = asyncio.Event()
        task = asyncio.create_task(self._run(job_id, tool, run_fn, profile, params))
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)
        return job_id

    async def _run(self, job_id: str, tool: str, run_fn, profile: dict, params: dict) -> None:
        async def progress(step: str, done: int, total: int) -> None:
            self._set(job_id, status="running", progress={"step": step, "done": done, "total": max(total, done)})

        ctx = ToolContext(
            client=self.client,
            settings=self.settings,
            store=self.store,
            profile=profile,
            params=params,
            run_id=job_id,
            llm=self.llm,
            progress_fn=progress,
            mock=self.settings.mock,
        )
        self._set(job_id, status="running", progress={"step": "Starting", "done": 0, "total": 1})
        try:
            result = await run_fn(ctx)
            payload = json.loads(result.model_dump_json(by_alias=True))
            total = ctx.total_steps
            self._set(job_id, status="done", progress={"step": "Done", "done": total, "total": total}, result=payload)
        except ToolInputError as exc:
            self._set(job_id, status="error", error={"code": "bad_input", "message": exc.message, "hint": exc.hint})
        except CrustdataError as exc:
            self._set(job_id, status="error", error={"code": exc.code, "message": exc.message, "hint": exc.hint})
        except Exception:  # never leave a job hanging
            log.exception("tool %s failed", tool)
            self._set(
                job_id,
                status="error",
                error={
                    "code": "internal",
                    "message": "Something went wrong on my side while working this out.",
                    "hint": "Please try again; if it keeps happening, let the team know.",
                },
            )

    async def wait(self, job_id: str, timeout: float = 30.0) -> dict | None:
        """Test helper: wait until a job finishes."""
        loop = asyncio.get_running_loop()
        deadline = loop.time() + timeout
        while loop.time() < deadline:
            job = self.get(job_id)
            if job and job["status"] in ("done", "error"):
                return job
            await asyncio.sleep(0.02)
        return self.get(job_id)

    async def events(self, job_id: str, poll_s: float = 0.5) -> AsyncIterator[str]:
        """SSE stream: `progress` events while running, then one `done` or `error` event."""
        last = None
        event = self._changed.get(job_id)
        while True:
            if event is not None:
                event.clear()
            job = self.get(job_id)
            if job is None:
                yield _sse("error", {"code": "not_found", "message": "I couldn't find that run.", "hint": None})
                return
            if job["status"] == "done":
                yield _sse("done", job)
                return
            if job["status"] == "error":
                yield _sse("error", job["error"] or {})
                return
            snapshot = json.dumps(job["progress"], sort_keys=True)
            if snapshot != last and job["progress"] is not None:
                last = snapshot
                yield _sse("progress", job["progress"])
            if event is not None:
                try:
                    await asyncio.wait_for(event.wait(), timeout=poll_s * 10)
                except TimeoutError:
                    yield ": keep-alive\n\n"
            else:
                await asyncio.sleep(poll_s)

    async def shutdown(self) -> None:
        for t in list(self._tasks):
            t.cancel()
        if self._tasks:
            await asyncio.gather(*self._tasks, return_exceptions=True)


def _sse(event: str, data: Any) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"
