from __future__ import annotations

import logging

from message_templates import generic_error, twiboost_completed, twiboost_started
from models import OrderStatus
from storage import Storage
from twiboost_client import TwiboostClient


class TwiboostService:
    def __init__(self, storage: Storage, twiboost_client: TwiboostClient, logger: logging.Logger) -> None:
        self.storage = storage
        self.twiboost_client = twiboost_client
        self.logger = logger

    async def start_processing(self, order_id: str, link: str, service_type: str, amount: int, send_message) -> None:
        await self.storage.update_status(order_id, OrderStatus.PROCESSING.value)
        create_result = await self.twiboost_client.create_order(link=link, service_type=service_type, amount=amount)
        self.logger.info(
            "Twiboost create result | order_id=%s | success=%s | details=%s",
            order_id,
            create_result.success,
            create_result.details,
        )
        if not create_result.success or not create_result.order_id:
            await self.storage.update_status(order_id, OrderStatus.PROBLEM.value)
            await send_message(order_id, generic_error())
            return

        await self.storage.update_twiboost_order_id(order_id, create_result.order_id, OrderStatus.PROCESSING.value)
        await send_message(order_id, twiboost_started())

    async def poll_processing(self, order_id: str, twiboost_order_id: str, send_message) -> None:
        status_result = await self.twiboost_client.check_status(twiboost_order_id)
        self.logger.info(
            "Twiboost status result | order_id=%s | twiboost_order_id=%s | success=%s | details=%s",
            order_id,
            twiboost_order_id,
            status_result.success,
            status_result.details,
        )
        if status_result.success:
            await self.storage.update_status(order_id, OrderStatus.COMPLETED.value)
            await send_message(order_id, twiboost_completed(order_id))
        elif status_result.details.lower() in {"failed", "error", "cancelled", "canceled"}:
            await self.storage.update_status(order_id, OrderStatus.PROBLEM.value)
            await send_message(order_id, generic_error())
