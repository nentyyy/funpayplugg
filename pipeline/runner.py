from __future__ import annotations

import asyncio
import logging
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

from ai import GeminiClient
from config import Settings
from pipeline.assemble import Assembler
from pipeline.media import ensure_ffmpeg
from pipeline.script import ScriptWriter
from pipeline.subtitles import build_ass
from pipeline.visuals import VisualMaker
from pipeline.voice import VoiceOver
from prompts import get_preset
from storage import Job, JobStatus, Storage


class JobCancelled(RuntimeError):
    pass


class Notifier(Protocol):
    async def on_status(self, job: Job, text: str) -> None: ...

    async def on_ready(self, job: Job, video_path: Path) -> None: ...

    async def on_published(self, job: Job, url: str) -> None: ...

    async def on_failed(self, job: Job, error: str) -> None: ...


@dataclass(slots=True)
class Produced:
    video_path: Path
    thumbnail_path: Path | None
    duration: float


class VideoPipeline:
    def __init__(self, settings: Settings, storage: Storage, ai: GeminiClient, logger: logging.Logger) -> None:
        self.settings = settings
        self.storage = storage
        self.ai = ai
        self.logger = logger
        self.writer = ScriptWriter(ai, logger)
        self.voice = VoiceOver(ai, logger)
        self.visuals = VisualMaker(ai, settings, logger)
        self.assembler = Assembler(settings, logger)
        self.output_dir = Path("output")
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def param(self, job: Job, key: str, default: Any) -> Any:
        value = job.params.get(key)
        return default if value in (None, "") else value

    async def _guard(self, job: Job) -> None:
        fresh = await self.storage.get_job(job.id)
        if fresh and fresh.status == JobStatus.CANCELLED:
            raise JobCancelled("Задача отменена")

    async def produce(self, job: Job, notifier: Notifier) -> Produced:
        ensure_ffmpeg(self.settings.ffmpeg_bin, self.settings.ffprobe_bin)

        preset = get_preset(job.preset)
        work_dir = self.settings.work_dir / f"job_{job.id:05d}"
        work_dir.mkdir(parents=True, exist_ok=True)

        scenes_count = int(self.param(job, "scenes_count", self.settings.scenes_count))
        scene_seconds = float(self.param(job, "scene_seconds", self.settings.scene_seconds))
        language = str(self.param(job, "language", self.settings.language))
        voice_name = str(self.param(job, "voice", preset.voice or self.settings.voice_name))
        visual_mode = str(self.param(job, "visual_mode", self.settings.visual_mode))
        use_subtitles = bool(self.param(job, "subtitles", self.settings.subtitles))

        # 1. Сценарий
        await self._guard(job)
        await self.storage.update_job(job.id, status=JobStatus.SCRIPTING)
        await notifier.on_status(job, "Пишу сценарий…")
        script = job.script or await self.writer.write(
            preset, job.topic, scenes_count, scene_seconds, language, self.settings.orientation
        )
        await self.storage.update_job(job.id, script=script)
        job.script = script
        scenes = script["scenes"]
        await notifier.on_status(job, f"Сценарий готов: «{script['title']}» ({len(scenes)} сцен)")

        # 2. Озвучка
        await self._guard(job)
        await self.storage.update_job(job.id, status=JobStatus.VOICE)
        await notifier.on_status(job, "Озвучиваю сцены…")
        timeline: list[dict[str, Any]] = []
        cursor = 0.0
        for index, scene in enumerate(scenes):
            await self._guard(job)
            audio_path = work_dir / f"voice_{index:02d}.wav"
            duration = await self.voice.render_scene(scene["narration"], voice_name, preset.key, audio_path)
            duration = max(duration, 1.0) + 0.35
            timeline.append(
                {
                    "index": index,
                    "audio": audio_path,
                    "duration": duration,
                    "start": cursor,
                    "narration": scene["narration"],
                }
            )
            cursor += duration

        total_seconds = cursor
        await notifier.on_status(job, f"Озвучка готова, хронометраж ~{total_seconds:.0f} сек")

        # 3. Картинка / видео на каждую сцену
        await self._guard(job)
        await self.storage.update_job(job.id, status=JobStatus.VISUALS)
        await notifier.on_status(job, f"Генерирую визуал ({visual_mode})…")
        visuals = []
        for index, scene in enumerate(scenes):
            await self._guard(job)
            visuals.append(await self.visuals.render_scene(index, scene["visual_prompt"], visual_mode, work_dir))

        # 4. Монтаж
        await self._guard(job)
        await self.storage.update_job(job.id, status=JobStatus.ASSEMBLING)
        await notifier.on_status(job, "Монтирую видео…")
        clips = []
        for item, visual in zip(timeline, visuals):
            await self._guard(job)
            clips.append(
                await self.assembler.build_scene(
                    item["index"], visual, item["audio"], item["duration"], work_dir
                )
            )

        subtitles_name = None
        if use_subtitles:
            build_ass(timeline, self.settings.size, work_dir / "subs.ass")
            subtitles_name = "subs.ass"

        out_path = self.output_dir / f"job_{job.id:05d}.mp4"
        await self.assembler.finish(
            clips,
            work_dir,
            out_path,
            subtitles_name=subtitles_name,
            music_path=self.settings.music_path or None,
        )

        # 5. Обложка
        thumbnail_path = None
        if self.settings.thumbnail_enabled and script.get("thumbnail_prompt"):
            try:
                visual = await self.visuals.render_scene(99, script["thumbnail_prompt"], "image", work_dir)
                thumbnail_path = visual.path if visual.kind == "image" else None
            except Exception as error:  # noqa: BLE001 - обложка не критична
                self.logger.warning("Thumbnail failed | %s", error)
                thumbnail_path = None

        await self.storage.update_job(
            job.id,
            video_path=str(out_path),
            thumbnail_path=str(thumbnail_path) if thumbnail_path else None,
        )

        if not self.settings.keep_workdir:
            keep = {thumbnail_path} if thumbnail_path else set()
            for entry in work_dir.iterdir():
                if entry in keep:
                    continue
                if entry.is_file():
                    entry.unlink(missing_ok=True)
                else:
                    shutil.rmtree(entry, ignore_errors=True)

        return Produced(out_path, thumbnail_path, total_seconds)


class Worker:
    def __init__(
        self,
        settings: Settings,
        storage: Storage,
        pipeline: VideoPipeline,
        notifier: Notifier,
        logger: logging.Logger,
        uploader=None,
    ) -> None:
        self.settings = settings
        self.storage = storage
        self.pipeline = pipeline
        self.notifier = notifier
        self.logger = logger
        self.uploader = uploader

    async def run_forever(self) -> None:
        restored = await self.storage.reset_stuck_jobs()
        if restored:
            self.logger.info("Возвращено в очередь после рестарта: %s", restored)

        while True:
            job = await self.storage.next_queued()
            if job is None:
                await asyncio.sleep(3)
                continue
            try:
                await self.process(job)
            except Exception as error:  # noqa: BLE001 - воркер не должен умирать
                self.logger.exception("Job %s failed", job.id)
                await self.storage.update_job(job.id, status=JobStatus.FAILED, error=str(error)[:900])
                await self.notifier.on_failed(job, str(error))

    async def process(self, job: Job) -> None:
        self.logger.info("Job %s started | preset=%s | topic=%s", job.id, job.preset, job.topic)
        try:
            produced = await self.pipeline.produce(job, self.notifier)
        except JobCancelled:
            self.logger.info("Job %s cancelled", job.id)
            await self.notifier.on_status(job, "Задача отменена")
            return

        fresh = await self.storage.get_job(job.id) or job
        auto_publish = bool(fresh.params.get("auto_publish"))

        if not auto_publish or self.uploader is None:
            await self.storage.update_job(job.id, status=JobStatus.REVIEW, error=None)
            await self.notifier.on_ready(fresh, produced.video_path)
            return

        await self.storage.update_job(job.id, status=JobStatus.UPLOADING)
        await self.notifier.on_status(fresh, "Загружаю на YouTube…")
        url = await self.uploader.publish(fresh, produced.video_path, produced.thumbnail_path)
        await self.notifier.on_ready(fresh, produced.video_path)
        await self.notifier.on_published(fresh, url)
