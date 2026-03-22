from __future__ import annotations

import asyncio
import logging
import re
import time
from dataclasses import dataclass
from typing import Iterable
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from config import Settings
from models import ChatMessage, OrderPageData
from parser_utils import normalize_text


@dataclass(slots=True)
class SendResult:
    success: bool
    details: str


class FunPayClient:
    def __init__(self, settings: Settings, logger: logging.Logger) -> None:
        self.settings = settings
        self.logger = logger
        self.session = requests.Session()
        self.session.cookies.update(settings.funpay_cookies)
        self.session.headers.update(
            {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
                "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
            }
        )

    async def fetch_recent_order_ids(self, limit: int = 20) -> list[str]:
        return await asyncio.to_thread(self._fetch_recent_order_ids_sync, limit)

    def _fetch_recent_order_ids_sync(self, limit: int) -> list[str]:
        html = self._request_with_retries("GET", urljoin(self.settings.funpay_base_url, self.settings.funpay_orders_path))
        soup = BeautifulSoup(html, "html.parser")
        order_ids: list[str] = []
        for link in soup.find_all("a", href=True):
            match = re.search(r"/orders/([A-Za-z0-9\-]+)/?", link["href"])
            if not match:
                continue
            order_id = match.group(1)
            if order_id not in order_ids:
                order_ids.append(order_id)
            if len(order_ids) >= limit:
                break
        return order_ids

    async def fetch_order_page(self, order_id: str) -> OrderPageData:
        return await asyncio.to_thread(self._fetch_order_page_sync, order_id)

    def _fetch_order_page_sync(self, order_id: str) -> OrderPageData:
        url = f"{self.settings.funpay_base_url}/orders/{order_id}/"
        html = self._request_with_retries("GET", url)
        soup = BeautifulSoup(html, "html.parser")

        return OrderPageData(
            order_id=order_id,
            buyer_username=self._extract_buyer_username(soup),
            chat_id=self._extract_chat_id(soup, order_id),
            lot_name=self._extract_lot_name(soup),
            system_message_text=self._extract_system_message(soup),
            messages=self._extract_messages(soup),
        )

    async def send_message(self, order_id: str, text: str) -> SendResult:
        return await asyncio.to_thread(self._send_message_sync, order_id, text)

    def _send_message_sync(self, order_id: str, text: str) -> SendResult:
        url = f"{self.settings.funpay_base_url}/orders/{order_id}/"
        html = self._request_with_retries("GET", url)
        soup = BeautifulSoup(html, "html.parser")

        form = self._find_message_form(soup)
        if form is None:
            raise RuntimeError("Не найдена форма отправки сообщения на странице заказа FunPay.")

        action = form.get("action") or url
        target_url = urljoin(self.settings.funpay_base_url, action)
        payload: dict[str, str] = {}
        for input_tag in form.find_all("input"):
            name = input_tag.get("name")
            if name:
                payload[name] = input_tag.get("value", "")

        textarea = form.find("textarea")
        field_name = textarea.get("name", "message") if textarea else "message"
        payload[field_name] = text

        response_text = self._request_with_retries("POST", target_url, data=payload)
        self.logger.info("FunPay message sent | order_id=%s | text=%s", order_id, normalize_text(text))
        return SendResult(success=True, details=response_text[:500])

    def _request_with_retries(self, method: str, url: str, **kwargs) -> str:
        last_error: Exception | None = None
        for attempt in range(1, self.settings.network_retries + 1):
            try:
                response = self.session.request(method, url, timeout=self.settings.funpay_http_timeout, **kwargs)
                response.raise_for_status()
                return response.text
            except Exception as error:  # noqa: BLE001
                last_error = error
                self.logger.warning(
                    "FunPay request failed | method=%s | url=%s | attempt=%s/%s | error=%s",
                    method,
                    url,
                    attempt,
                    self.settings.network_retries,
                    error,
                )
                if attempt < self.settings.network_retries:
                    time.sleep(self.settings.retry_delay)
        raise RuntimeError(f"FunPay request failed after retries: {last_error}") from last_error

    def _extract_buyer_username(self, soup: BeautifulSoup) -> str:
        for link in soup.find_all("a", href=True):
            href = link["href"]
            if "/users/" in href:
                text = normalize_text(link.get_text(" ", strip=True))
                if text:
                    return text.lstrip("@")
        return "unknown_buyer"

    def _extract_chat_id(self, soup: BeautifulSoup, fallback: str) -> str:
        for tag in soup.find_all(attrs={"data-chat-id": True}):
            return str(tag.get("data-chat-id"))
        html = str(soup)
        match = re.search(r'"chatId"\s*:\s*"?(?P<chat_id>\d+)"?', html)
        return match.group("chat_id") if match else fallback

    def _extract_lot_name(self, soup: BeautifulSoup) -> str:
        selectors = ["h1", ".tc-item-header", ".media-user-name", ".page-header"]
        for selector in selectors:
            node = soup.select_one(selector)
            if node:
                text = normalize_text(node.get_text(" ", strip=True))
                if text:
                    return text
        title = normalize_text(soup.title.get_text(" ", strip=True)) if soup.title else ""
        return title or "Unknown lot"

    def _extract_system_message(self, soup: BeautifulSoup) -> str:
        candidates: list[str] = []
        for node in soup.find_all(["div", "li", "span", "p"]):
            classes = " ".join(node.get("class", []))
            text = normalize_text(node.get_text(" ", strip=True))
            if not text:
                continue
            if "system" in classes.lower() or "заказ" in text.lower() or "order" in text.lower():
                candidates.append(text)
        if candidates:
            return max(candidates, key=len)
        return normalize_text(soup.get_text("\n", strip=True))

    def _extract_messages(self, soup: BeautifulSoup) -> list[ChatMessage]:
        messages: list[ChatMessage] = []
        nodes: Iterable = soup.select("[data-id], .chat-msg-item, .message-item, .chat-message")
        seen_ids: set[str] = set()
        for index, node in enumerate(nodes, start=1):
            message_id = str(node.get("data-id") or node.get("id") or f"msg_{index}")
            if message_id in seen_ids:
                continue
            seen_ids.add(message_id)

            classes = " ".join(node.get("class", [])).lower()
            author = ""
            author_node = node.select_one(".chat-msg-author, .author, .media-user-name")
            if author_node:
                author = normalize_text(author_node.get_text(" ", strip=True)).lstrip("@")
            text = normalize_text(node.get_text(" ", strip=True))
            if not text:
                continue
            messages.append(
                ChatMessage(
                    message_id=message_id,
                    author=author,
                    text=text,
                    is_system="system" in classes,
                    is_outgoing="self" in classes or "outgoing" in classes or "me" in classes,
                )
            )
        return messages

    def _find_message_form(self, soup: BeautifulSoup):
        for form in soup.find_all("form"):
            if form.find("textarea"):
                return form
        return None
