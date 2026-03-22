from __future__ import annotations

import logging

from db import Storage
from data import OrderStatus
from fragment import FragmentClient
from msg import generic_error, stars_completed, stars_delay, stars_processing


class StarsService:
    def __init__(self, storage: Storage, fragment_client: FragmentClient, logger: logging.Logger) -> None:
        self.storage = storage
        self.fragment_client = fragment_client
        self.logger = logger

    async def start_processing(self, order_id: str, username: str, amount: int, send_message) -> None:
        await self.storage.update_status(order_id, OrderStatus.PROCESSING.value)
        await send_message(order_id, stars_processing())
        result = await self.fragment_client.send_stars(username=username, amount=amount)
        self.logger.info("Fragment result | order_id=%s | success=%s | details=%s", order_id, result.success, result.details)

        if result.success:
            await self.storage.update_status(order_id, OrderStatus.COMPLETED.value)
            await send_message(order_id, stars_completed(order_id))
            return

        await self.storage.update_status(order_id, OrderStatus.PROBLEM.value)
        await send_message(order_id, stars_delay())
        await send_message(order_id, generic_error())
