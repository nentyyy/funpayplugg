from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Dict


def _parse_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def _parse_int(value: str | None, default: int) -> int:
    try:
        return int(value) if value is not None else default
    except ValueError:
        return default


def parse_cookie_string(cookie_string: str) -> Dict[str, str]:
    cookies: Dict[str, str] = {}
    for chunk in cookie_string.split(";"):
        chunk = chunk.strip()
        if not chunk or "=" not in chunk:
            continue
        key, value = chunk.split("=", 1)
        cookies[key.strip()] = value.strip()
    return cookies


@dataclass(slots=True)
class Settings:
    funpay_cookies_raw: str
    funpay_base_url: str
    funpay_orders_path: str
    funpay_http_timeout: int
    fragment_cookies_raw: str
    fragment_base_url: str
    fragment_headless: bool
    twiboost_base_url: str
    twiboost_api_key: str
    twiboost_create_order_path: str
    twiboost_status_path: str
    twiboost_username: str
    twiboost_password: str
    database_path: Path
    polling_interval: int
    network_retries: int
    retry_delay: int
    log_level: str

    @property
    def funpay_cookies(self) -> Dict[str, str]:
        return parse_cookie_string(self.funpay_cookies_raw)

    @property
    def fragment_cookies(self) -> Dict[str, str]:
        return parse_cookie_string(self.fragment_cookies_raw)


def load_settings() -> Settings:
    database_path = Path(os.getenv("DATABASE_PATH", "data/bot.sqlite3")).expanduser()
    database_path.parent.mkdir(parents=True, exist_ok=True)

    return Settings(
        funpay_cookies_raw=os.getenv("FUNPAY_COOKIES", ""),
        funpay_base_url=os.getenv("FUNPAY_BASE_URL", "https://funpay.com").rstrip("/"),
        funpay_orders_path=os.getenv("FUNPAY_ORDERS_PATH", "/orders/"),
        funpay_http_timeout=_parse_int(os.getenv("FUNPAY_HTTP_TIMEOUT"), 30),
        fragment_cookies_raw=os.getenv("FRAGMENT_COOKIES", ""),
        fragment_base_url=os.getenv("FRAGMENT_BASE_URL", "https://fragment.com").rstrip("/"),
        fragment_headless=_parse_bool(os.getenv("FRAGMENT_HEADLESS"), True),
        twiboost_base_url=os.getenv("TWIBOOST_BASE_URL", "https://twiboost.com").rstrip("/"),
        twiboost_api_key=os.getenv("TWIBOOST_API_KEY", ""),
        twiboost_create_order_path=os.getenv("TWIBOOST_CREATE_ORDER_PATH", "/api/orders"),
        twiboost_status_path=os.getenv("TWIBOOST_STATUS_PATH", "/api/orders/{order_id}"),
        twiboost_username=os.getenv("TWIBOOST_USERNAME", ""),
        twiboost_password=os.getenv("TWIBOOST_PASSWORD", ""),
        database_path=database_path,
        polling_interval=_parse_int(os.getenv("POLLING_INTERVAL"), 10),
        network_retries=_parse_int(os.getenv("NETWORK_RETRIES"), 3),
        retry_delay=_parse_int(os.getenv("RETRY_DELAY"), 3),
        log_level=os.getenv("LOG_LEVEL", "INFO").upper(),
    )
