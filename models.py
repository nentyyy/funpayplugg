from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import Any


class OrderType(StrEnum):
    STARS = "stars"
    TWIBOOST = "twiboost"
    UNKNOWN = "unknown"


class OrderStatus(StrEnum):
    NEW = "new"
    WAITING_USERNAME = "waiting_username"
    WAITING_USERNAME_CONFIRM = "waiting_username_confirm"
    WAITING_LINK = "waiting_link"
    WAITING_LINK_CONFIRM = "waiting_link_confirm"
    PROCESSING = "processing"
    COMPLETED = "completed"
    PROBLEM = "problem"


@dataclass(slots=True)
class ParsedOrderData:
    order_id: str
    buyer_username: str
    chat_id: str
    lot_name: str
    order_type: OrderType
    amount: int
    system_message_text: str
    target_username: str | None = None
    target_link: str | None = None
    service_name: str | None = None


@dataclass(slots=True)
class OrderRecord:
    order_id: str
    buyer_username: str
    chat_id: str
    lot_name: str
    order_type: str
    amount: int
    system_message_text: str
    target_username: str | None
    target_link: str | None
    status: str
    twiboost_order_id: str | None
    created_at: str
    updated_at: str


@dataclass(slots=True)
class ChatMessage:
    message_id: str
    author: str
    text: str
    created_at: str | None = None
    is_system: bool = False
    is_outgoing: bool = False


@dataclass(slots=True)
class OrderPageData:
    order_id: str
    buyer_username: str
    chat_id: str
    lot_name: str
    system_message_text: str
    messages: list[ChatMessage] = field(default_factory=list)


@dataclass(slots=True)
class FragmentResult:
    success: bool
    details: str
    payload: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class TwiboostResult:
    success: bool
    details: str
    order_id: str | None = None
    payload: dict[str, Any] = field(default_factory=dict)


def utc_now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat()
