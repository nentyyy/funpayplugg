"""Разовый логин в Flow и отладка селекторов.

Логин (откроется окно Chromium, заходишь руками, сессия сохранится в профиль):
    python login_flow.py --acc acc1

Посмотреть, какие поля ввода и кнопки на странице (для FLOW_PROMPT_SELECTOR):
    python login_flow.py --acc acc1 --inspect

Прогнать один промпт и скачать результат, не запуская бота:
    python login_flow.py --acc acc1 --probe "cinematic shot of a lighthouse at night"
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

from playwright.async_api import async_playwright

from config import load_env_file, load_settings
from flow import LAUNCH_ARGS, FlowClient, FlowPool
from logs import setup_logger
from storage import Storage

INSPECT_JS = """
() => {
    const describe = (el) => {
        const attrs = ['id', 'name', 'placeholder', 'aria-label', 'data-testid', 'role']
            .map(a => el.getAttribute(a) ? `${a}="${el.getAttribute(a)}"` : null)
            .filter(Boolean).join(' ');
        const cls = (el.className || '').toString().split(/\\s+/).filter(Boolean).slice(0, 3).join('.');
        return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''} ${attrs}`.trim();
    };
    const out = { inputs: [], buttons: [] };
    document.querySelectorAll('textarea, input[type=text], [contenteditable=true]')
        .forEach(el => out.inputs.push(describe(el)));
    document.querySelectorAll('button, [role=button]')
        .forEach(el => out.buttons.push(describe(el) + ' :: ' + (el.innerText || '').trim().slice(0, 40)));
    return out;
}
"""


async def open_profile(settings, account_name: str, inspect: bool) -> None:
    profile_dir = Path(settings.flow_profiles_dir) / account_name
    profile_dir.mkdir(parents=True, exist_ok=True)

    async with async_playwright() as playwright:
        context = await playwright.chromium.launch_persistent_context(
            str(profile_dir),
            headless=False,
            args=LAUNCH_ARGS,
            viewport={"width": 1440, "height": 900},
        )
        page = context.pages[0] if context.pages else await context.new_page()
        await page.goto(settings.flow_url, wait_until="domcontentloaded", timeout=120_000)

        print(f"\nПрофиль: {profile_dir}")
        print("Залогинься в окне браузера и открой проект Flow.")

        if inspect:
            print("Когда страница с полем промпта открыта, нажми Enter здесь — сниму список селекторов.")
            await asyncio.to_thread(input)
            found = await page.evaluate(INSPECT_JS)
            print("\n--- поля ввода (кандидаты в FLOW_PROMPT_SELECTOR) ---")
            for item in found["inputs"]:
                print(" ", item)
            print("\n--- кнопки (кандидаты в FLOW_SUBMIT_SELECTOR) ---")
            for item in found["buttons"][:40]:
                print(" ", item)
            print(f"\nURL страницы: {page.url}")
            print("Его можно положить в FLOW_URL, чтобы бот заходил сразу в нужный проект.")
        else:
            print("Когда закончишь — нажми Enter здесь, сессия сохранится.")
            await asyncio.to_thread(input)

        await context.close()
    print("Готово, профиль сохранён.")


async def probe(settings, logger, account_name: str, prompt: str) -> int:
    storage = Storage(settings.database_path)
    await storage.init()

    settings.flow_accounts = [account_name]
    pool = FlowPool(settings, storage, logger)
    client = FlowClient(settings, pool, logger)

    out_path = Path("output") / f"flow_probe_{account_name}.mp4"
    try:
        await client.generate(prompt, out_path)
    except Exception as error:  # noqa: BLE001 - это отладочный скрипт, печатаем как есть
        print(f"\nНе получилось: {error}")
        print(f"Смотри скриншот и html в {settings.flow_debug_dir}")
        return 1
    print(f"\nОК: {out_path} ({out_path.stat().st_size / 1024 / 1024:.1f} МБ)")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Логин и отладка Flow-профилей")
    parser.add_argument("--acc", required=True, help="имя профиля, например acc1")
    parser.add_argument("--inspect", action="store_true", help="показать селекторы страницы")
    parser.add_argument("--probe", metavar="PROMPT", help="прогнать один промпт через профиль")
    args = parser.parse_args()

    load_env_file()
    settings = load_settings()
    logger = setup_logger(settings.log_level)

    if args.probe:
        return asyncio.run(probe(settings, logger, args.acc, args.probe))
    asyncio.run(open_profile(settings, args.acc, args.inspect))
    return 0


if __name__ == "__main__":
    sys.exit(main())
