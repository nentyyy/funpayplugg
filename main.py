from __future__ import annotations

import asyncio

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.fsm.storage.memory import MemoryStorage

from ai import GeminiClient
from bot import BotContext, TelegramNotifier, build_router
from config import load_env_file, load_settings
from flow import FlowClient, FlowPool
from logs import setup_logger
from pipeline.runner import VideoPipeline, Worker
from pipeline.script import ScriptWriter
from scheduler import AutoScheduler
from storage import Storage
from youtube import YouTubeUploader


async def main() -> None:
    load_env_file()
    settings = load_settings()
    logger = setup_logger(settings.log_level)

    if not settings.telegram_token:
        raise SystemExit("TELEGRAM_BOT_TOKEN не задан в .env")

    storage = Storage(settings.database_path)
    await storage.init()

    ai = GeminiClient(settings, logger)

    flow_pool = FlowPool(settings, storage, logger)
    flow_client = FlowClient(settings, flow_pool, logger)
    writer = ScriptWriter(ai, logger)
    uploader = YouTubeUploader(settings, storage, logger)

    bot = Bot(settings.telegram_token, default=DefaultBotProperties(parse_mode=None))
    notifier = TelegramNotifier(bot, settings, logger)

    async def notify(chat_id: int, text: str) -> None:
        await notifier.send(chat_id, text)

    scheduler = AutoScheduler(settings, storage, writer, logger, notify=notify)
    pipeline = VideoPipeline(settings, storage, ai, logger, flow=flow_client)
    worker = Worker(settings, storage, pipeline, notifier, logger, uploader=uploader)

    dispatcher = Dispatcher(storage=MemoryStorage())
    dispatcher.include_router(
        build_router(
            BotContext(
                settings=settings,
                storage=storage,
                ai=ai,
                writer=writer,
                uploader=uploader,
                scheduler=scheduler,
                flow=flow_pool,
                logger=logger,
            )
        )
    )

    logger.info("Videobot startup | visual_mode=%s | orientation=%s", settings.visual_mode, settings.orientation)

    tasks = [
        asyncio.create_task(dispatcher.start_polling(bot, handle_signals=False)),
        asyncio.create_task(worker.run_forever()),
        asyncio.create_task(scheduler.run_forever()),
    ]
    try:
        await asyncio.gather(*tasks)
    finally:
        for task in tasks:
            task.cancel()
        await bot.session.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
