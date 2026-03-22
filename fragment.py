from __future__ import annotations

import asyncio
import json
import logging

from playwright.async_api import Browser, BrowserContext, Page, async_playwright

from cfg import Settings
from data import FragmentResult


class FragmentClient:
    def __init__(self, settings: Settings, logger: logging.Logger) -> None:
        self.settings = settings
        self.logger = logger
        self._playwright = None
        self._browser: Browser | None = None
        self._context: BrowserContext | None = None
        self._page: Page | None = None
        self._lock = asyncio.Lock()

    async def start(self) -> None:
        async with self._lock:
            if self._page is not None:
                return
            self._playwright = await async_playwright().start()
            self._browser = await self._playwright.chromium.launch(headless=self.settings.fragment_headless)
            self._context = await self._browser.new_context()
            await self._context.add_cookies(
                [
                    {
                        "name": key,
                        "value": value,
                        "domain": ".fragment.com",
                        "path": "/",
                    }
                    for key, value in self.settings.fragment_cookies.items()
                ]
            )
            self._page = await self._context.new_page()
            self.logger.info("Fragment browser started")

    async def close(self) -> None:
        async with self._lock:
            if self._context:
                await self._context.close()
            if self._browser:
                await self._browser.close()
            if self._playwright:
                await self._playwright.stop()
            self._playwright = None
            self._browser = None
            self._context = None
            self._page = None

    async def send_stars(self, username: str, amount: int) -> FragmentResult:
        for attempt in range(1, self.settings.network_retries + 1):
            try:
                await self.start()
                assert self._page is not None
                await self._page.goto(self.settings.fragment_base_url, wait_until="networkidle", timeout=60_000)
                await self._try_fill(self._page, ["input[type='search']", "input[name='query']", "input[placeholder*='@']"], username)
                await self._try_click(self._page, ["button[type='submit']", "button:has-text('Search')", "button:has-text('Find')"])
                await self._page.wait_for_timeout(2_000)
                await self._try_click(
                    self._page,
                    [
                        f"text={username}",
                        f"a:has-text('{username}')",
                        f"button:has-text('{username}')",
                    ],
                )
                await self._page.wait_for_timeout(2_000)

                if not await self._try_fill(self._page, ["input[name='amount']", "input[inputmode='numeric']"], str(amount)):
                    await self._try_click(
                        self._page,
                        [
                            f"button:has-text('{amount}')",
                            f"text={amount} Stars",
                            f"text={amount} star",
                        ],
                    )

                await self._try_click(
                    self._page,
                    [
                        "button:has-text('Send')",
                        "button:has-text('Gift')",
                        "button:has-text('Continue')",
                    ],
                )
                await self._page.wait_for_timeout(4_000)
                content = await self._page.content()
                lowered = content.lower()
                self.logger.info("Fragment response captured | order_payload=%s", json.dumps({"username": username, "amount": amount}))

                if any(marker in lowered for marker in ["success", "sent", "completed", "done"]):
                    return FragmentResult(success=True, details="Stars sent", payload={"username": username, "amount": amount})
                if any(marker in lowered for marker in ["error", "failed", "not enough", "invalid"]):
                    return FragmentResult(success=False, details="Fragment returned error", payload={"username": username, "amount": amount})

                return FragmentResult(success=True, details="Stars flow submitted", payload={"username": username, "amount": amount})
            except Exception as error:  # noqa: BLE001
                self.logger.exception(
                    "Fragment send failed | username=%s | amount=%s | attempt=%s/%s",
                    username,
                    amount,
                    attempt,
                    self.settings.network_retries,
                )
                if attempt < self.settings.network_retries:
                    await asyncio.sleep(self.settings.retry_delay)
                else:
                    return FragmentResult(success=False, details=str(error), payload={"username": username, "amount": amount})
        return FragmentResult(success=False, details="Unexpected Fragment failure")

    async def _try_fill(self, page: Page, selectors: list[str], value: str) -> bool:
        for selector in selectors:
            locator = page.locator(selector).first
            try:
                if await locator.count():
                    await locator.fill(value)
                    return True
            except Exception:  # noqa: BLE001
                continue
        return False

    async def _try_click(self, page: Page, selectors: list[str]) -> bool:
        for selector in selectors:
            locator = page.locator(selector).first
            try:
                if await locator.count():
                    await locator.click()
                    return True
            except Exception:  # noqa: BLE001
                continue
        return False
