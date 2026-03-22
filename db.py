from __future__ import annotations

import asyncio
import sqlite3
from pathlib import Path
from threading import Lock

from data import OrderRecord, ParsedOrderData, utc_now_iso


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
                CREATE TABLE IF NOT EXISTS orders (
                    order_id TEXT PRIMARY KEY,
                    buyer_username TEXT NOT NULL,
                    chat_id TEXT NOT NULL,
                    lot_name TEXT NOT NULL,
                    order_type TEXT NOT NULL,
                    amount INTEGER NOT NULL,
                    system_message_text TEXT NOT NULL,
                    target_username TEXT,
                    target_link TEXT,
                    status TEXT NOT NULL,
                    twiboost_order_id TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS processed_messages (
                    message_id TEXT PRIMARY KEY,
                    order_id TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
                """
            )
            self._connection.commit()

    async def upsert_order(self, payload: ParsedOrderData, status: str) -> None:
        await asyncio.to_thread(self._upsert_order_sync, payload, status)

    def _upsert_order_sync(self, payload: ParsedOrderData, status: str) -> None:
        now = utc_now_iso()
        with self._lock:
            self._connection.execute(
                """
                INSERT INTO orders (
                    order_id, buyer_username, chat_id, lot_name, order_type, amount,
                    system_message_text, target_username, target_link, status,
                    twiboost_order_id, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(order_id) DO UPDATE SET
                    buyer_username=excluded.buyer_username,
                    chat_id=excluded.chat_id,
                    lot_name=excluded.lot_name,
                    order_type=excluded.order_type,
                    amount=excluded.amount,
                    system_message_text=excluded.system_message_text,
                    target_username=COALESCE(excluded.target_username, orders.target_username),
                    target_link=COALESCE(excluded.target_link, orders.target_link),
                    updated_at=excluded.updated_at
                """,
                (
                    payload.order_id,
                    payload.buyer_username,
                    payload.chat_id,
                    payload.lot_name,
                    payload.order_type.value,
                    payload.amount,
                    payload.system_message_text,
                    payload.target_username,
                    payload.target_link,
                    status,
                    None,
                    now,
                    now,
                ),
            )
            self._connection.commit()

    async def get_order(self, order_id: str) -> OrderRecord | None:
        return await asyncio.to_thread(self._get_order_sync, order_id)

    def _get_order_sync(self, order_id: str) -> OrderRecord | None:
        with self._lock:
            row = self._connection.execute("SELECT * FROM orders WHERE order_id = ?", (order_id,)).fetchone()
        return OrderRecord(**dict(row)) if row else None

    async def get_orders_for_monitoring(self) -> list[OrderRecord]:
        return await asyncio.to_thread(self._get_orders_for_monitoring_sync)

    def _get_orders_for_monitoring_sync(self) -> list[OrderRecord]:
        with self._lock:
            rows = self._connection.execute(
                """
                SELECT * FROM orders
                WHERE status NOT IN ('completed')
                ORDER BY updated_at DESC
                """
            ).fetchall()
        return [OrderRecord(**dict(row)) for row in rows]

    async def update_status(self, order_id: str, status: str) -> None:
        await asyncio.to_thread(self._update_status_sync, order_id, status)

    def _update_status_sync(self, order_id: str, status: str) -> None:
        with self._lock:
            self._connection.execute(
                "UPDATE orders SET status = ?, updated_at = ? WHERE order_id = ?",
                (status, utc_now_iso(), order_id),
            )
            self._connection.commit()

    async def update_username(self, order_id: str, username: str, status: str | None = None) -> None:
        await asyncio.to_thread(self._update_username_sync, order_id, username, status)

    def _update_username_sync(self, order_id: str, username: str, status: str | None) -> None:
        with self._lock:
            if status:
                self._connection.execute(
                    "UPDATE orders SET target_username = ?, status = ?, updated_at = ? WHERE order_id = ?",
                    (username, status, utc_now_iso(), order_id),
                )
            else:
                self._connection.execute(
                    "UPDATE orders SET target_username = ?, updated_at = ? WHERE order_id = ?",
                    (username, utc_now_iso(), order_id),
                )
            self._connection.commit()

    async def update_link(self, order_id: str, link: str, status: str | None = None) -> None:
        await asyncio.to_thread(self._update_link_sync, order_id, link, status)

    def _update_link_sync(self, order_id: str, link: str, status: str | None) -> None:
        with self._lock:
            if status:
                self._connection.execute(
                    "UPDATE orders SET target_link = ?, status = ?, updated_at = ? WHERE order_id = ?",
                    (link, status, utc_now_iso(), order_id),
                )
            else:
                self._connection.execute(
                    "UPDATE orders SET target_link = ?, updated_at = ? WHERE order_id = ?",
                    (link, utc_now_iso(), order_id),
                )
            self._connection.commit()

    async def update_twiboost_order_id(self, order_id: str, twiboost_order_id: str, status: str | None = None) -> None:
        await asyncio.to_thread(self._update_twiboost_order_id_sync, order_id, twiboost_order_id, status)

    def _update_twiboost_order_id_sync(self, order_id: str, twiboost_order_id: str, status: str | None) -> None:
        with self._lock:
            if status:
                self._connection.execute(
                    """
                    UPDATE orders
                    SET twiboost_order_id = ?, status = ?, updated_at = ?
                    WHERE order_id = ?
                    """,
                    (twiboost_order_id, status, utc_now_iso(), order_id),
                )
            else:
                self._connection.execute(
                    """
                    UPDATE orders
                    SET twiboost_order_id = ?, updated_at = ?
                    WHERE order_id = ?
                    """,
                    (twiboost_order_id, utc_now_iso(), order_id),
                )
            self._connection.commit()

    async def is_message_processed(self, message_id: str) -> bool:
        return await asyncio.to_thread(self._is_message_processed_sync, message_id)

    def _is_message_processed_sync(self, message_id: str) -> bool:
        with self._lock:
            row = self._connection.execute(
                "SELECT 1 FROM processed_messages WHERE message_id = ?",
                (message_id,),
            ).fetchone()
        return row is not None

    async def mark_message_processed(self, order_id: str, message_id: str) -> None:
        await asyncio.to_thread(self._mark_message_processed_sync, order_id, message_id)

    def _mark_message_processed_sync(self, order_id: str, message_id: str) -> None:
        with self._lock:
            self._connection.execute(
                """
                INSERT OR IGNORE INTO processed_messages (message_id, order_id, created_at)
                VALUES (?, ?, ?)
                """,
                (message_id, order_id, utc_now_iso()),
            )
            self._connection.commit()
