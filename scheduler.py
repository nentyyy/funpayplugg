from __future__ import annotations

import asyncio
import logging
from datetime import datetime

from config import Settings
from pipeline.script import ScriptWriter
from prompts import get_preset
from storage import Storage

AUTO_KEY = "auto_enabled"
LAST_FIRE_KEY = "auto_last_fire"


class AutoScheduler:
    def __init__(
        self,
        settings: Settings,
        storage: Storage,
        writer: ScriptWriter,
        logger: logging.Logger,
        notify=None,
    ) -> None:
        self.settings = settings
        self.storage = storage
        self.writer = writer
        self.logger = logger
        self.notify = notify

    async def is_enabled(self) -> bool:
        stored = await self.storage.get_setting(AUTO_KEY)
        if stored is None:
            return self.settings.auto_enabled
        return stored == "1"

    async def set_enabled(self, enabled: bool) -> None:
        await self.storage.set_setting(AUTO_KEY, "1" if enabled else "0")

    async def pick_topic(self) -> str:
        preset = get_preset(self.settings.auto_preset)
        topics = await self.writer.suggest_topics(preset, self.settings.language, count=6)
        recent = {job.topic.lower() for job in await self.storage.list_jobs(limit=30)}
        for topic in topics:
            if topic.lower() not in recent:
                return topic
        return topics[0]

    async def enqueue(self, chat_id: int) -> int:
        preset = get_preset(self.settings.auto_preset)
        topic = await self.pick_topic()
        job = await self.storage.create_job(
            chat_id=chat_id,
            user_id=0,
            preset=preset.key,
            topic=topic,
            params={
                "visual_mode": self.settings.visual_mode,
                "voice": preset.voice,
                "scenes_count": self.settings.scenes_count,
                "scene_seconds": self.settings.scene_seconds,
                "language": self.settings.language,
                "subtitles": self.settings.subtitles,
                "privacy": self.settings.auto_privacy,
                "made_for_kids": preset.made_for_kids,
                "auto_publish": True,
            },
            auto=True,
        )
        self.logger.info("Auto job queued | id=%s | topic=%s", job.id, topic)
        return job.id

    async def run_forever(self) -> None:
        while True:
            try:
                await self._tick()
            except Exception as error:  # noqa: BLE001 - планировщик не должен падать
                self.logger.exception("Scheduler tick failed | %s", error)
            await asyncio.sleep(30)

    async def _tick(self) -> None:
        if not await self.is_enabled():
            return

        chat_id = self.settings.auto_notify_chat_id
        if not chat_id:
            self.logger.warning("AUTO_NOTIFY_CHAT_ID не задан, автопостинг простаивает")
            return

        now = datetime.now()
        slot = now.strftime("%H:%M")
        if slot not in self.settings.auto_times:
            return

        marker = f"{now.strftime('%Y-%m-%d')} {slot}"
        if await self.storage.get_setting(LAST_FIRE_KEY) == marker:
            return

        await self.storage.set_setting(LAST_FIRE_KEY, marker)
        job_id = await self.enqueue(chat_id)
        if self.notify:
            await self.notify(chat_id, f"Автозапуск по расписанию {slot}: задача #{job_id} в очереди.")
