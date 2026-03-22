from __future__ import annotations

import asyncio
import logging

from funpay_client import FunPayClient
from message_templates import (
    request_link,
    request_username,
    stars_intro,
    stars_reenter_username,
    twiboost_intro,
    twiboost_link_confirm,
    twiboost_reenter_link,
)
from models import OrderRecord, OrderStatus, OrderType, ParsedOrderData
from parser_utils import (
    detect_order_type,
    extract_amount,
    extract_url,
    extract_username,
    infer_service_name,
    looks_like_confirmation,
    looks_like_link,
    looks_like_rejection,
)
from services.stars import StarsService
from services.twiboost import TwiboostService
from storage import Storage


class OrdersService:
    def __init__(
        self,
        storage: Storage,
        funpay_client: FunPayClient,
        stars_service: StarsService,
        twiboost_service: TwiboostService,
        logger: logging.Logger,
    ) -> None:
        self.storage = storage
        self.funpay_client = funpay_client
        self.stars_service = stars_service
        self.twiboost_service = twiboost_service
        self.logger = logger

    async def poll_once(self) -> None:
        await self._discover_new_orders()
        await self._handle_active_orders()

    async def _discover_new_orders(self) -> None:
        order_ids = await self.funpay_client.fetch_recent_order_ids()
        for order_id in order_ids:
            existing = await self.storage.get_order(order_id)
            if existing:
                continue
            page = await self.funpay_client.fetch_order_page(order_id)
            payload = ParsedOrderData(
                order_id=order_id,
                buyer_username=page.buyer_username,
                chat_id=page.chat_id,
                lot_name=page.lot_name,
                order_type=detect_order_type(page.lot_name, page.system_message_text),
                amount=extract_amount(page.system_message_text or page.lot_name),
                system_message_text=page.system_message_text,
                target_username=extract_username(page.system_message_text),
                service_name=infer_service_name(page.lot_name),
            )
            initial_status = self._initial_status(payload)
            await self.storage.upsert_order(payload, initial_status.value)
            self.logger.info(
                "New order detected | order_id=%s | type=%s | buyer=%s | amount=%s",
                payload.order_id,
                payload.order_type.value,
                payload.buyer_username,
                payload.amount,
            )
            await self._send_initial_message(payload, initial_status)

    async def _handle_active_orders(self) -> None:
        orders = await self.storage.get_orders_for_monitoring()
        for order in orders:
            await self._handle_order_messages(order)
            if order.status == OrderStatus.PROCESSING.value and order.order_type == OrderType.TWIBOOST.value and order.twiboost_order_id:
                await self.twiboost_service.poll_processing(order.order_id, order.twiboost_order_id, self._send_text)

    async def _handle_order_messages(self, order: OrderRecord) -> None:
        page = await self.funpay_client.fetch_order_page(order.order_id)
        for message in page.messages:
            if message.is_system or message.is_outgoing:
                continue
            if await self.storage.is_message_processed(message.message_id):
                continue
            await self.storage.mark_message_processed(order.order_id, message.message_id)
            refreshed = await self.storage.get_order(order.order_id)
            if refreshed:
                await self._process_customer_message(refreshed, message.text)

    async def _process_customer_message(self, order: OrderRecord, text: str) -> None:
        self.logger.info("Incoming customer message | order_id=%s | text=%s", order.order_id, text)
        if order.order_type == OrderType.STARS.value:
            await self._process_stars_message(order, text)
            return
        if order.order_type == OrderType.TWIBOOST.value:
            await self._process_twiboost_message(order, text)

    async def _process_stars_message(self, order: OrderRecord, text: str) -> None:
        if order.status == OrderStatus.WAITING_USERNAME.value:
            username = extract_username(text)
            if not username:
                await self._send_text(order.order_id, request_username())
                return
            await self.storage.update_username(order.order_id, username, OrderStatus.WAITING_USERNAME_CONFIRM.value)
            await self._send_text(order.order_id, stars_intro(username, order.amount))
            return

        if order.status == OrderStatus.WAITING_USERNAME_CONFIRM.value:
            if looks_like_rejection(text):
                await self.storage.update_status(order.order_id, OrderStatus.WAITING_USERNAME.value)
                await self._send_text(order.order_id, stars_reenter_username())
                return
            if looks_like_confirmation(text):
                refreshed = await self.storage.get_order(order.order_id)
                if refreshed and refreshed.target_username:
                    await self.stars_service.start_processing(
                        order_id=order.order_id,
                        username=refreshed.target_username,
                        amount=order.amount,
                        send_message=self._send_text,
                    )
                else:
                    await self.storage.update_status(order.order_id, OrderStatus.WAITING_USERNAME.value)
                    await self._send_text(order.order_id, request_username())
                return

            maybe_username = extract_username(text)
            if maybe_username:
                await self.storage.update_username(order.order_id, maybe_username, OrderStatus.WAITING_USERNAME_CONFIRM.value)
                await self._send_text(order.order_id, stars_intro(maybe_username, order.amount))

    async def _process_twiboost_message(self, order: OrderRecord, text: str) -> None:
        if order.status == OrderStatus.WAITING_LINK.value:
            if not looks_like_link(text):
                await self._send_text(order.order_id, request_link())
                return
            link = extract_url(text)
            assert link is not None
            await self.storage.update_link(order.order_id, link, OrderStatus.WAITING_LINK_CONFIRM.value)
            await self._send_text(order.order_id, twiboost_link_confirm(link))
            return

        if order.status == OrderStatus.WAITING_LINK_CONFIRM.value:
            if looks_like_rejection(text):
                await self.storage.update_status(order.order_id, OrderStatus.WAITING_LINK.value)
                await self._send_text(order.order_id, twiboost_reenter_link())
                return
            if looks_like_confirmation(text):
                refreshed = await self.storage.get_order(order.order_id)
                if refreshed and refreshed.target_link:
                    await self.twiboost_service.start_processing(
                        order_id=order.order_id,
                        link=refreshed.target_link,
                        service_type=order.lot_name,
                        amount=order.amount,
                        send_message=self._send_text,
                    )
                else:
                    await self.storage.update_status(order.order_id, OrderStatus.WAITING_LINK.value)
                    await self._send_text(order.order_id, request_link())
                return
            if looks_like_link(text):
                link = extract_url(text)
                assert link is not None
                await self.storage.update_link(order.order_id, link, OrderStatus.WAITING_LINK_CONFIRM.value)
                await self._send_text(order.order_id, twiboost_link_confirm(link))

    def _initial_status(self, payload: ParsedOrderData) -> OrderStatus:
        if payload.order_type == OrderType.STARS:
            return OrderStatus.WAITING_USERNAME_CONFIRM if payload.target_username else OrderStatus.WAITING_USERNAME
        return OrderStatus.WAITING_LINK

    async def _send_initial_message(self, payload: ParsedOrderData, status: OrderStatus) -> None:
        if payload.order_type == OrderType.STARS:
            if status == OrderStatus.WAITING_USERNAME_CONFIRM:
                await self._send_text(payload.order_id, stars_intro(payload.target_username, payload.amount))
            else:
                await self._send_text(payload.order_id, request_username())
            return

        await self._send_text(payload.order_id, twiboost_intro())

    async def _send_text(self, order_id: str, text: str) -> None:
        try:
            await self.funpay_client.send_message(order_id, text)
        except Exception as error:  # noqa: BLE001
            self.logger.exception("Failed to send FunPay message | order_id=%s | error=%s", order_id, error)

    async def run_forever(self, polling_interval: int) -> None:
        while True:
            try:
                await self.poll_once()
            except Exception as error:  # noqa: BLE001
                self.logger.exception("Orders loop failed | error=%s", error)
            await asyncio.sleep(polling_interval)
