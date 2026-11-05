"""SQLite persistence: profiles, jobs, evidence and the Crustdata credit log."""

from __future__ import annotations

import json
import sqlite3
import threading
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

SCHEMA = """
CREATE TABLE IF NOT EXISTS profiles (
    profile_id TEXT PRIMARY KEY,
    linkedin_url TEXT,
    person TEXT NOT NULL,
    derived TEXT NOT NULL,
    raw TEXT,
    goals TEXT,
    completed INTEGER NOT NULL DEFAULT 0,
    evidence_ids TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS jobs (
    job_id TEXT PRIMARY KEY,
    tool TEXT NOT NULL,
    profile_id TEXT,
    params TEXT NOT NULL,
    status TEXT NOT NULL,
    progress TEXT,
    result TEXT,
    error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS evidence (
    id TEXT PRIMARY KEY,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS credit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    source TEXT NOT NULL,
    status INTEGER,
    results INTEGER NOT NULL DEFAULT 0,
    estimated_credits REAL NOT NULL DEFAULT 0,
    reported_credits REAL,
    run_id TEXT,
    cache_key TEXT
);
"""


def utcnow_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


class Store:
    def __init__(self, path: Path | str):
        self.path = str(path)
        if self.path != ":memory:":
            Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._conn = sqlite3.connect(self.path, check_same_thread=False, isolation_level=None)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL" if self.path != ":memory:" else "PRAGMA journal_mode=MEMORY")
        self._conn.executescript(SCHEMA)

    def close(self) -> None:
        with self._lock:
            self._conn.close()

    def _exec(self, sql: str, params: tuple = ()) -> sqlite3.Cursor:
        with self._lock:
            return self._conn.execute(sql, params)

    # ---------- profiles ----------

    def save_profile(
        self,
        profile_id: str,
        linkedin_url: str | None,
        person: dict,
        derived: dict,
        raw: dict | None,
        evidence_ids: list[str],
    ) -> None:
        now = utcnow_iso()
        self._exec(
            "INSERT OR REPLACE INTO profiles (profile_id, linkedin_url, person, derived, raw, goals, completed,"
            " evidence_ids, created_at, updated_at) VALUES (?,?,?,?,?,NULL,0,?,?,?)",
            (profile_id, linkedin_url, json.dumps(person), json.dumps(derived), json.dumps(raw), json.dumps(evidence_ids), now, now),
        )

    def get_profile(self, profile_id: str) -> dict[str, Any] | None:
        row = self._exec("SELECT * FROM profiles WHERE profile_id = ?", (profile_id,)).fetchone()
        if row is None:
            return None
        return {
            "profile_id": row["profile_id"],
            "linkedin_url": row["linkedin_url"],
            "person": json.loads(row["person"]),
            "derived": json.loads(row["derived"]),
            "raw": json.loads(row["raw"]) if row["raw"] else None,
            "goals": json.loads(row["goals"]) if row["goals"] else None,
            "completed": bool(row["completed"]),
            "evidence_ids": json.loads(row["evidence_ids"] or "[]"),
            "created_at": row["created_at"],
        }

    def update_goals(self, profile_id: str, goals: dict, completed: bool | None = None) -> None:
        if completed is None:
            self._exec(
                "UPDATE profiles SET goals = ?, updated_at = ? WHERE profile_id = ?",
                (json.dumps(goals), utcnow_iso(), profile_id),
            )
        else:
            self._exec(
                "UPDATE profiles SET goals = ?, completed = ?, updated_at = ? WHERE profile_id = ?",
                (json.dumps(goals), int(completed), utcnow_iso(), profile_id),
            )

    # ---------- jobs ----------

    def create_job(self, job_id: str, tool: str, profile_id: str | None, params: dict) -> None:
        now = utcnow_iso()
        self._exec(
            "INSERT INTO jobs (job_id, tool, profile_id, params, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
            (job_id, tool, profile_id, json.dumps(params), "queued", now, now),
        )

    def update_job(self, job_id: str, **fields: Any) -> None:
        sets = []
        values: list[Any] = []
        for key in ("status", "progress", "result", "error"):
            if key in fields:
                value = fields[key]
                sets.append(f"{key} = ?")
                values.append(value if key == "status" or value is None else json.dumps(value))
        if not sets:
            return
        sets.append("updated_at = ?")
        values.append(utcnow_iso())
        values.append(job_id)
        self._exec(f"UPDATE jobs SET {', '.join(sets)} WHERE job_id = ?", tuple(values))

    def get_job(self, job_id: str) -> dict[str, Any] | None:
        row = self._exec("SELECT * FROM jobs WHERE job_id = ?", (job_id,)).fetchone()
        if row is None:
            return None
        return {
            "job_id": row["job_id"],
            "tool": row["tool"],
            "profile_id": row["profile_id"],
            "params": json.loads(row["params"]),
            "status": row["status"],
            "progress": json.loads(row["progress"]) if row["progress"] else None,
            "result": json.loads(row["result"]) if row["result"] else None,
            "error": json.loads(row["error"]) if row["error"] else None,
            "created_at": row["created_at"],
        }

    def fail_interrupted_jobs(self) -> int:
        cur = self._exec(
            "UPDATE jobs SET status = 'error', error = ?, updated_at = ? WHERE status IN ('queued', 'running')",
            (
                json.dumps(
                    {
                        "code": "interrupted",
                        "message": "This run was interrupted when the engine restarted.",
                        "hint": "Start it again; anything already fetched is cached, so it will be quick.",
                    }
                ),
                utcnow_iso(),
            ),
        )
        return cur.rowcount

    # ---------- evidence ----------

    def save_evidence(self, evidence: dict) -> None:
        self._exec(
            "INSERT OR REPLACE INTO evidence (id, body, created_at) VALUES (?,?,?)",
            (evidence["id"], json.dumps(evidence), utcnow_iso()),
        )

    def get_evidence(self, evidence_id: str) -> dict | None:
        row = self._exec("SELECT body FROM evidence WHERE id = ?", (evidence_id,)).fetchone()
        return json.loads(row["body"]) if row else None

    # ---------- credit log ----------

    def log_call(
        self,
        endpoint: str,
        source: str,
        status: int | None,
        results: int,
        estimated_credits: float,
        reported_credits: float | None,
        run_id: str | None,
        cache_key: str | None,
    ) -> None:
        self._exec(
            "INSERT INTO credit_log (ts, endpoint, source, status, results, estimated_credits, reported_credits, run_id,"
            " cache_key) VALUES (?,?,?,?,?,?,?,?,?)",
            (utcnow_iso(), endpoint, source, status, results, estimated_credits, reported_credits, run_id, cache_key),
        )

    def usage_since(self, since_iso: str) -> list[dict]:
        rows = self._exec(
            "SELECT endpoint, source, COUNT(*) AS calls, SUM(results) AS results, SUM(estimated_credits) AS est,"
            " SUM(reported_credits) AS rep FROM credit_log WHERE ts >= ? GROUP BY endpoint, source",
            (since_iso,),
        ).fetchall()
        return [dict(r) for r in rows]
