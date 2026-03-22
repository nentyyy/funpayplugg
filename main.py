from __future__ import annotations

import asyncio
import os
from pathlib import Path

from config import load_settings
from fragment_client import FragmentClient
from funpay_client import FunPayClient
from logger import setup_logger
from services.orders import OrdersService
from services.stars import StarsService
from services.twiboost import TwiboostService
from storage import Storage
from twiboost_client import TwiboostClient


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
