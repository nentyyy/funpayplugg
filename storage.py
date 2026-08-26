from __future__ import annotations

import asyncio
import json
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from threading import Lock
from typing import Any


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class JobStatus:
    QUEUED = "queued"
    SCRIPTING = "scripting"
    VISUALS = "visuals"
    VOICE = "voice"
    ASSEMBLING = "assembling"
    REVIEW = "review"
    UPLOADING = "uploading"
    PUBLISHED = "published"
    FAILED = "failed"
    CANCELLED = "cancelled"


ACTIVE_STATUSES = (
    JobStatus.QUEUED,
    JobStatus.SCRIPTING,
    JobStatus.VISUALS,
    JobStatus.VOICE,
    JobStatus.ASSEMBLING,
    JobStatus.UPLOADING,
)

STATUS_LABELS = {
    JobStatus.QUEUED: "в очереди",
    JobStatus.SCRIPTING: "пишу сценарий",
    JobStatus.VISUALS: "рисую кадры",
    JobStatus.VOICE: "озвучиваю",
    JobStatus.ASSEMBLING: "монтирую",
    JobStatus.REVIEW: "ждёт подтверждения",
    JobStatus.UPLOADING: "загружаю на YouTube",
    JobStatus.PUBLISHED: "опубликовано",
    JobStatus.FAILED: "ошибка",
    JobStatus.CANCELLED: "отменено",
}


@dataclass(slots=True)
class Job:
    id: int
    chat_id: int
    user_id: int
    preset: str
    topic: str
    status: str
    params: dict[str, Any]
    script: dict[str, Any] | None
    video_path: str | None
    thumbnail_path: str | None
    youtube_id: str | None
    error: str | None
    auto: int
    created_at: str
    updated_at: str

    @property
    def title(self) -> str:
        if self.script and self.script.get("title"):
            return str(self.script["title"])
        return self.topic

    @property
    def youtube_url(self) -> str | None:
        return f"https://youtu.be/{self.youtube_id}" if self.youtube_id else None


def _row_to_job(row: sqlite3.Row) -> Job:
    data = dict(row)
    data["params"] = json.loads(data["params"] or "{}")
    data["script"] = json.loads(data["script"]) if data["script"] else None
    return Job(**data)


class Storage:
    def __init__(self, database_path: Path) -> None:
        self.database_path = database_path
        self._lock = Lock()
        self._connection = sqlite3.connect(database_path, check_same_thread=False)
        self._connection.row_factory = sqlite3.Row

    async def init(self) -> None:
        await asyncio.to_thread(self._init_sync)

    def _init_sync(self) -> None:
        with self._lock:
            cursor = self._connection.cursor()
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS jobs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    chat_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    preset TEXT NOT NULL,
                    topic TEXT NOT NULL,
                    status TEXT NOT NULL,
                    params TEXT NOT NULL,
                    script TEXT,
                    video_path TEXT,
                    thumbnail_path TEXT,
                    youtube_id TEXT,
                    error TEXT,
                    auto INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS flow_usage (
                    name TEXT NOT NULL,
                    day TEXT NOT NULL,
                    used INTEGER NOT NULL DEFAULT 0,
                    blocked_until TEXT,
                    PRIMARY KEY (name, day)
                )
                """
            )
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)")
            self._connection.commit()

    async def create_job(
        self,
        chat_id: int,
        user_id: int,
        preset: str,
        topic: str,
        params: dict[str, Any],
        auto: bool = False,
    ) -> Job:
        return await asyncio.to_thread(self._create_job_sync, chat_id, user_id, preset, topic, params, auto)

    def _create_job_sync(
        self,
        chat_id: int,
        user_id: int,
        preset: str,
        topic: str,
        params: dict[str, Any],
        auto: bool,
    ) -> Job:
        now = utc_now_iso()
        with self._lock:
            cursor = self._connection.execute(
                """
                INSERT INTO jobs (chat_id, user_id, preset, topic, status, params, auto, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (chat_id, user_id, preset, topic, JobStatus.QUEUED, json.dumps(params, ensure_ascii=False),
                 int(auto), now, now),
            )
            self._connection.commit()
            row = self._connection.execute("SELECT * FROM jobs WHERE id = ?", (cursor.lastrowid,)).fetchone()
        return _row_to_job(row)

    async def get_job(self, job_id: int) -> Job | None:
        return await asyncio.to_thread(self._get_job_sync, job_id)

    def _get_job_sync(self, job_id: int) -> Job | None:
        with self._lock:
            row = self._connection.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
        return _row_to_job(row) if row else None

    async def next_queued(self) -> Job | None:
        return await asyncio.to_thread(self._next_queued_sync)

    def _next_queued_sync(self) -> Job | None:
        with self._lock:
            row = self._connection.execute(
                "SELECT * FROM jobs WHERE status = ? ORDER BY id LIMIT 1",
                (JobStatus.QUEUED,),
            ).fetchone()
        return _row_to_job(row) if row else None

    async def list_jobs(self, limit: int = 10, statuses: tuple[str, ...] | None = None) -> list[Job]:
        return await asyncio.to_thread(self._list_jobs_sync, limit, statuses)

    def _list_jobs_sync(self, limit: int, statuses: tuple[str, ...] | None) -> list[Job]:
        query = "SELECT * FROM jobs"
        args: list[Any] = []
        if statuses:
            placeholders = ",".join("?" for _ in statuses)
            query += f" WHERE status IN ({placeholders})"
            args.extend(statuses)
        query += " ORDER BY id DESC LIMIT ?"
        args.append(limit)
        with self._lock:
            rows = self._connection.execute(query, args).fetchall()
        return [_row_to_job(row) for row in rows]

    async def update_job(self, job_id: int, **fields: Any) -> None:
        await asyncio.to_thread(self._update_job_sync, job_id, fields)

    def _update_job_sync(self, job_id: int, fields: dict[str, Any]) -> None:
        if not fields:
            return
        for key in ("params", "script"):
            if key in fields and fields[key] is not None and not isinstance(fields[key], str):
                fields[key] = json.dumps(fields[key], ensure_ascii=False)
        assignments = ", ".join(f"{key} = ?" for key in fields)
        args = list(fields.values()) + [utc_now_iso(), job_id]
        with self._lock:
            self._connection.execute(
                f"UPDATE jobs SET {assignments}, updated_at = ? WHERE id = ?",
                args,
            )
            self._connection.commit()

    async def reset_stuck_jobs(self) -> int:
        return await asyncio.to_thread(self._reset_stuck_jobs_sync)

    def _reset_stuck_jobs_sync(self) -> int:
        busy = tuple(status for status in ACTIVE_STATUSES if status != JobStatus.QUEUED)
        placeholders = ",".join("?" for _ in busy)
        with self._lock:
            cursor = self._connection.execute(
                f"UPDATE jobs SET status = ?, updated_at = ? WHERE status IN ({placeholders})",
                (JobStatus.QUEUED, utc_now_iso(), *busy),
            )
            self._connection.commit()
        return cursor.rowcount

    async def get_setting(self, key: str, default: str | None = None) -> str | None:
        return await asyncio.to_thread(self._get_setting_sync, key, default)

    def _get_setting_sync(self, key: str, default: str | None) -> str | None:
        with self._lock:
            row = self._connection.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
        return row["value"] if row else default

    async def set_setting(self, key: str, value: str) -> None:
        await asyncio.to_thread(self._set_setting_sync, key, value)

    def _set_setting_sync(self, key: str, value: str) -> None:
        with self._lock:
            self._connection.execute(
                """
                INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
                """,
                (key, value, utc_now_iso()),
            )
            self._connection.commit()

    async def stats(self) -> dict[str, int]:
        return await asyncio.to_thread(self._stats_sync)

    def _stats_sync(self) -> dict[str, int]:
        with self._lock:
            rows = self._connection.execute("SELECT status, COUNT(*) AS total FROM jobs GROUP BY status").fetchall()
        return {row["status"]: row["total"] for row in rows}

    async def flow_usage(self, name: str, day: str) -> tuple[int, str | None]:
        return await asyncio.to_thread(self._flow_usage_sync, name, day)

    def _flow_usage_sync(self, name: str, day: str) -> tuple[int, str | None]:
        with self._lock:
            row = self._connection.execute(
                "SELECT used, blocked_until FROM flow_usage WHERE name = ? AND day = ?",
                (name, day),
            ).fetchone()
        if not row:
            return 0, None
        blocked = row["blocked_until"]
        if blocked and blocked <= utc_now_iso():
            blocked = None
        return row["used"], blocked

    async def flow_spend(self, name: str, day: str) -> None:
        await asyncio.to_thread(self._flow_spend_sync, name, day)

    def _flow_spend_sync(self, name: str, day: str) -> None:
        with self._lock:
            self._connection.execute(
                """
                INSERT INTO flow_usage (name, day, used) VALUES (?, ?, 1)
                ON CONFLICT(name, day) DO UPDATE SET used = flow_usage.used + 1
                """,
                (name, day),
            )
            self._connection.commit()

    async def flow_block(self, name: str, day: str, minutes: int) -> None:
        await asyncio.to_thread(self._flow_block_sync, name, day, minutes)

    def _flow_block_sync(self, name: str, day: str, minutes: int) -> None:
        until = (datetime.now(timezone.utc) + timedelta(minutes=minutes)).isoformat(timespec="seconds")
        with self._lock:
            self._connection.execute(
                """
                INSERT INTO flow_usage (name, day, used, blocked_until) VALUES (?, ?, 0, ?)
                ON CONFLICT(name, day) DO UPDATE SET blocked_until = excluded.blocked_until
                """,
                (name, day, until),
            )
            self._connection.commit()
