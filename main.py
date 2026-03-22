from __future__ import annotations

import asyncio
import os
from pathlib import Path

from cfg import load_settings
from db import Storage
from fragment import FragmentClient
from funpay import FunPayClient
from logs import setup_logger
from services.boost_job import TwiboostService
from services.runner import OrdersService
from services.stars_job import StarsService
from twiboost import TwiboostClient


def load_env_file(path: str = ".env") -> None:
    env_path = Path(path)
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


async def main() -> None:
    load_env_file()
    settings = load_settings()
    logger = setup_logger(settings.log_level)
    logger.info("Bot startup initiated")

    storage = Storage(settings.database_path)
    await storage.init()

    funpay_client = FunPayClient(settings, logger)
    fragment_client = FragmentClient(settings, logger)
    twiboost_client = TwiboostClient(settings, logger)

    stars_service = StarsService(storage, fragment_client, logger)
    twiboost_service = TwiboostService(storage, twiboost_client, logger)
    orders_service = OrdersService(storage, funpay_client, stars_service, twiboost_service, logger)

    try:
        await orders_service.run_forever(settings.polling_interval)
    finally:
        await fragment_client.close()


if __name__ == "__main__":
    asyncio.run(main())
