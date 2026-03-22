from __future__ import annotations

import re
from typing import Iterable

from data import OrderType


STARS_KEYWORDS = ("звезды", "звёзды", "stars", "telegram stars")
USERNAME_RE = re.compile(r"(?<!\w)@([A-Za-z0-9_]{5,32})\b")
URL_RE = re.compile(r"https?://[^\s)>\]]+", re.IGNORECASE)
ORDER_ID_RE = re.compile(r"/orders/([A-Za-z0-9\-]+)/?")
AMOUNT_RE = re.compile(r"(\d+)\s*(?:зв[её]зд(?:[аы])?|stars?|шт\.?|pieces?)", re.IGNORECASE)
FIRST_INT_RE = re.compile(r"\b(\d{1,6})\b")


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def contains_any(value: str, keywords: Iterable[str]) -> bool:
    lowered = normalize_text(value).lower()
    return any(keyword in lowered for keyword in keywords)


def detect_order_type(lot_name: str, system_message_text: str = "") -> OrderType:
    haystack = f"{lot_name}\n{system_message_text}"
    if contains_any(haystack, STARS_KEYWORDS):
        return OrderType.STARS
    if normalize_text(haystack):
        return OrderType.TWIBOOST
    return OrderType.UNKNOWN


def extract_order_id(value: str) -> str | None:
    match = ORDER_ID_RE.search(value or "")
    return match.group(1) if match else None


def extract_username(value: str) -> str | None:
    match = USERNAME_RE.search(value or "")
    return f"@{match.group(1)}" if match else None


def extract_url(value: str) -> str | None:
    match = URL_RE.search(value or "")
    return match.group(0) if match else None


def extract_amount(value: str) -> int:
    text = value or ""
    match = AMOUNT_RE.search(text)
    if match:
        return int(match.group(1))

    candidates = [int(item) for item in FIRST_INT_RE.findall(text)]
    if not candidates:
        return 0
    return max(candidates)


def infer_service_name(lot_name: str) -> str:
    return normalize_text(lot_name)


def looks_like_confirmation(text: str) -> bool:
    return normalize_text(text) == "+"


def looks_like_rejection(text: str) -> bool:
    return normalize_text(text) == "-"


def looks_like_link(text: str) -> bool:
    return extract_url(text) is not None
