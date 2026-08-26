from __future__ import annotations

import asyncio
import base64
import logging
import re
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from playwright.async_api import Page, async_playwright

from config import Settings
from storage import Storage

LAUNCH_ARGS = [
    "--disable-blink-features=AutomationControlled",
    "--disable-features=IsolateOrigins,site-per-process",
    "--no-first-run",
    "--no-default-browser-check",
]


class FlowError(RuntimeError):
    pass


class FlowExhausted(FlowError):
    """Все аккаунты выбрали дневной лимит или сидят в блоке."""


@dataclass(slots=True)
class FlowAccount:
    name: str
    profile_dir: Path


class FlowPool:
    """Раздаёт аккаунты по кругу, помня дневной расход и временные блокировки."""

    def __init__(self, settings: Settings, storage: Storage, logger: logging.Logger) -> None:
        self.settings = settings
        self.storage = storage
        self.logger = logger
        base = Path(settings.flow_profiles_dir)
        self.accounts = [FlowAccount(name, base / name) for name in settings.flow_accounts]

    async def acquire(self) -> FlowAccount:
        today = date.today().isoformat()
        for account in self.accounts:
            used, blocked = await self.storage.flow_usage(account.name, today)
            if blocked:
                self.logger.info("Flow: %s в блоке до %s", account.name, blocked)
                continue
            if used >= self.settings.flow_daily_limit:
                continue
            return account
        raise FlowExhausted("Все Flow-аккаунты исчерпали дневной лимит")

    async def available(self) -> int:
        """Сколько генераций суммарно осталось сегодня по живым профилям."""
        today = date.today().isoformat()
        total = 0
        for account in self.accounts:
            if not account.profile_dir.exists():
                continue
            used, blocked = await self.storage.flow_usage(account.name, today)
            if blocked:
                continue
            total += max(0, self.settings.flow_daily_limit - used)
        return total

    async def spend(self, account: FlowAccount) -> None:
        await self.storage.flow_spend(account.name, date.today().isoformat())

    async def block(self, account: FlowAccount, minutes: int = 60) -> None:
        await self.storage.flow_block(account.name, date.today().isoformat(), minutes)
        self.logger.warning("Flow: %s заблокирован на %s мин", account.name, minutes)

    async def report(self) -> list[tuple[str, int, str | None]]:
        today = date.today().isoformat()
        rows = []
        for account in self.accounts:
            used, blocked = await self.storage.flow_usage(account.name, today)
            rows.append((account.name, used, blocked))
        return rows


class FlowClient:
    """Гоняет Veo через веб-интерфейс Flow на живой сессии Chromium."""

    def __init__(self, settings: Settings, pool: FlowPool, logger: logging.Logger) -> None:
        self.settings = settings
        self.pool = pool
        self.logger = logger
        self._lock = asyncio.Lock()
        self._pattern = re.compile(settings.flow_video_pattern, re.IGNORECASE)

    async def generate(self, prompt: str, out_path: Path) -> Path:
        async with self._lock:
            account = await self.pool.acquire()
            self.logger.info("Flow: генерю на аккаунте %s", account.name)
            try:
                result = await self._generate_on(account, prompt, out_path)
            except FlowError:
                await self.pool.block(account, self.settings.flow_block_minutes)
                raise
            await self.pool.spend(account)
            return result

    async def _generate_on(self, account: FlowAccount, prompt: str, out_path: Path) -> Path:
        if not account.profile_dir.exists():
            raise FlowError(
                f"Профиль {account.name} не залогинен. Запусти: python login_flow.py --acc {account.name}"
            )

        async with async_playwright() as playwright:
            context = await playwright.chromium.launch_persistent_context(
                str(account.profile_dir),
                headless=self.settings.flow_headless,
                args=LAUNCH_ARGS,
                viewport={"width": 1440, "height": 900},
            )
            try:
                page = context.pages[0] if context.pages else await context.new_page()
                captured: list[str] = []

                def on_response(response) -> None:
                    headers = response.headers or {}
                    haystack = f"{response.url} {headers.get('content-type', '')}"
                    if self._pattern.search(haystack):
                        captured.append(response.url)
                    if self.settings.flow_debug:
                        self.logger.debug("Flow response | %s | %s", response.status, response.url[:180])

                page.on("response", on_response)

                await page.goto(self.settings.flow_url, wait_until="domcontentloaded", timeout=90_000)
                await self._ensure_logged_in(page, account)

                before = set(await self._video_sources(page))
                await self._submit_prompt(page, prompt)

                url = await self._wait_for_video(page, captured, before)
                data = await self._download(context, page, url)
            finally:
                await context.close()

        if not data:
            raise FlowError("Flow вернул пустой файл")
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_bytes(data)
        self.logger.info("Flow: скачал %.1f МБ в %s", len(data) / 1024 / 1024, out_path.name)
        return out_path

    async def _ensure_logged_in(self, page: Page, account: FlowAccount) -> None:
        if "accounts.google.com" in page.url or "signin" in page.url.lower():
            raise FlowError(
                f"Профиль {account.name} разлогинился. Перелогинься: python login_flow.py --acc {account.name}"
            )

    async def _submit_prompt(self, page: Page, prompt: str) -> None:
        selector = self.settings.flow_prompt_selector
        try:
            field = page.locator(selector).first
            await field.wait_for(state="visible", timeout=60_000)
            await field.click()
            await field.fill(prompt)
        except Exception as error:  # noqa: BLE001 - вёрстку Flow регулярно переписывают
            await self._dump(page, "prompt-not-found")
            raise FlowError(
                f"Не нашёл поле ввода по селектору '{selector}'. "
                "Поправь FLOW_PROMPT_SELECTOR в .env (скриншот в папке отладки)."
            ) from error

        submit_selector = self.settings.flow_submit_selector
        if submit_selector:
            try:
                await page.locator(submit_selector).first.click(timeout=15_000)
                return
            except Exception:  # noqa: BLE001 - кнопки может не быть, тогда просто Enter
                self.logger.debug("Flow: кнопка сабмита не сработала, жму Enter")
        await page.keyboard.press("Enter")

    async def _video_sources(self, page: Page) -> list[str]:
        try:
            return await page.eval_on_selector_all(
                "video",
                "els => els.map(e => e.currentSrc || e.src).filter(Boolean)",
            )
        except Exception:  # noqa: BLE001
            return []

    async def _wait_for_video(self, page: Page, captured: list[str], before: set[str]) -> str:
        deadline = self.settings.flow_timeout
        waited = 0
        step = 5
        while waited < deadline:
            await asyncio.sleep(step)
            waited += step

            fresh = [url for url in captured if url not in before]
            if fresh:
                return fresh[-1]

            for src in await self._video_sources(page):
                if src not in before:
                    return src

            if waited % 60 == 0:
                self.logger.info("Flow: жду рендер, %s сек", waited)

        await self._dump(page, "render-timeout")
        raise FlowError(f"Flow не отдал видео за {deadline} сек")

    async def _download(self, context, page: Page, url: str) -> bytes:
        if url.startswith("blob:"):
            encoded = await page.evaluate(
                """async (blobUrl) => {
                    const response = await fetch(blobUrl);
                    const buffer = await response.arrayBuffer();
                    let binary = '';
                    const bytes = new Uint8Array(buffer);
                    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
                    return btoa(binary);
                }""",
                url,
            )
            return base64.b64decode(encoded)

        response = await context.request.get(url)
        if not response.ok:
            raise FlowError(f"Скачивание вернуло {response.status}")
        return await response.body()

    async def _dump(self, page: Page, tag: str) -> None:
        if not self.settings.flow_debug:
            return
        debug_dir = Path(self.settings.flow_debug_dir)
        debug_dir.mkdir(parents=True, exist_ok=True)
        try:
            await page.screenshot(path=str(debug_dir / f"{tag}.png"), full_page=True)
            (debug_dir / f"{tag}.html").write_text(await page.content(), encoding="utf-8")
            self.logger.warning("Flow: отладка сохранена в %s (%s)", debug_dir, tag)
        except Exception as error:  # noqa: BLE001
            self.logger.warning("Не сохранил отладку | %s", error)
