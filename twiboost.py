from __future__ import annotations

import asyncio
import json
import logging
import time
from urllib.parse import urljoin

import requests

from cfg import Settings
from data import TwiboostResult


class TwiboostClient:
    def __init__(self, settings: Settings, logger: logging.Logger) -> None:
        self.settings = settings
        self.logger = logger
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": "Mozilla/5.0",
                "Accept": "application/json, text/plain, */*",
            }
        )

    async def create_order(self, link: str, service_type: str, amount: int) -> TwiboostResult:
        return await asyncio.to_thread(self._create_order_sync, link, service_type, amount)

    async def check_status(self, order_id: str) -> TwiboostResult:
        return await asyncio.to_thread(self._check_status_sync, order_id)

    def _create_order_sync(self, link: str, service_type: str, amount: int) -> TwiboostResult:
        try:
            payload = {"link": link, "service_type": service_type, "amount": amount}
            response_json = self._api_request("POST", self.settings.twiboost_create_order_path, json=payload)
            self.logger.info("Twiboost create_order response | %s", json.dumps(response_json, ensure_ascii=False))
            twiboost_order_id = str(
                response_json.get("order_id")
                or response_json.get("id")
                or response_json.get("data", {}).get("order_id")
                or ""
            )
            if twiboost_order_id:
                return TwiboostResult(
                    success=True,
                    details="Twiboost order created",
                    order_id=twiboost_order_id,
                    payload=response_json,
                )
            return TwiboostResult(success=False, details="Twiboost did not return order_id", payload=response_json)
        except Exception as error:  # noqa: BLE001
            self.logger.exception("Twiboost create_order failed")
            return TwiboostResult(success=False, details=str(error))

    def _check_status_sync(self, order_id: str) -> TwiboostResult:
        try:
            endpoint = self.settings.twiboost_status_path.format(order_id=order_id)
            response_json = self._api_request("GET", endpoint)
            self.logger.info("Twiboost check_status response | %s", json.dumps(response_json, ensure_ascii=False))
            status = str(response_json.get("status") or response_json.get("data", {}).get("status") or "")
            return TwiboostResult(
                success=status.lower() in {"completed", "done", "success", "finished"},
                details=status or "unknown",
                order_id=order_id,
                payload=response_json,
            )
        except Exception as error:  # noqa: BLE001
            self.logger.exception("Twiboost check_status failed")
            return TwiboostResult(success=False, details=str(error), order_id=order_id)

    def _api_request(self, method: str, path: str, **kwargs) -> dict:
        headers = dict(kwargs.pop("headers", {}))
        if self.settings.twiboost_api_key:
            headers["Authorization"] = f"Bearer {self.settings.twiboost_api_key}"

        last_error: Exception | None = None
        for attempt in range(1, self.settings.network_retries + 1):
            try:
                url = urljoin(f"{self.settings.twiboost_base_url}/", path.lstrip("/"))
                response = self.session.request(method, url, headers=headers, timeout=30, **kwargs)
                response.raise_for_status()
                content_type = response.headers.get("Content-Type", "")
                if "application/json" in content_type:
                    return response.json()
                return {"status": "unknown", "raw": response.text}
            except Exception as error:  # noqa: BLE001
                last_error = error
                self.logger.warning(
                    "Twiboost request failed | method=%s | path=%s | attempt=%s/%s | error=%s",
                    method,
                    path,
                    attempt,
                    self.settings.network_retries,
                    error,
                )
                if attempt == 1 and not self.settings.twiboost_api_key and self.settings.twiboost_username and self.settings.twiboost_password:
                    self._login_sync()
                if attempt < self.settings.network_retries:
                    time.sleep(self.settings.retry_delay)
        raise RuntimeError(f"Twiboost request failed after retries: {last_error}") from last_error

    def _login_sync(self) -> None:
        login_url = urljoin(f"{self.settings.twiboost_base_url}/", "login")
        credentials = {
            "username": self.settings.twiboost_username,
            "email": self.settings.twiboost_username,
            "password": self.settings.twiboost_password,
        }
        response = self.session.post(login_url, data=credentials, timeout=30)
        response.raise_for_status()
        self.logger.info("Twiboost login attempted via website form")
