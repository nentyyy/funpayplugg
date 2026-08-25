from __future__ import annotations

import asyncio
import json
import logging
import re
import wave
from pathlib import Path
from typing import Any

from google import genai
from google.genai import types

from config import Settings

JSON_BLOCK = re.compile(r"```(?:json)?\s*(.+?)\s*```", re.DOTALL)

TTS_SAMPLE_RATE = 24000
TTS_SAMPLE_WIDTH = 2
TTS_CHANNELS = 1


class AIError(RuntimeError):
    pass


def _extract_json(text: str) -> Any:
    cleaned = text.strip()
    match = JSON_BLOCK.search(cleaned)
    if match:
        cleaned = match.group(1)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        start = min((idx for idx in (cleaned.find("{"), cleaned.find("[")) if idx != -1), default=-1)
        end = max(cleaned.rfind("}"), cleaned.rfind("]"))
        if start == -1 or end <= start:
            raise AIError(f"Модель вернула не JSON: {text[:200]}")
        return json.loads(cleaned[start : end + 1])


def _inline_parts(response: Any) -> list[Any]:
    parts: list[Any] = []
    for candidate in getattr(response, "candidates", None) or []:
        content = getattr(candidate, "content", None)
        for part in getattr(content, "parts", None) or []:
            if getattr(part, "inline_data", None) is not None:
                parts.append(part.inline_data)
    return parts


def write_wav(path: Path, pcm: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(TTS_CHANNELS)
        handle.setsampwidth(TTS_SAMPLE_WIDTH)
        handle.setframerate(TTS_SAMPLE_RATE)
        handle.writeframes(pcm)


class GeminiClient:
    def __init__(self, settings: Settings, logger: logging.Logger) -> None:
        if not settings.gemini_api_key:
            raise AIError("GEMINI_API_KEY не задан")
        self.settings = settings
        self.logger = logger
        self.client = genai.Client(api_key=settings.gemini_api_key)

    async def _retry(self, func, *args, attempts: int = 3, delay: float = 4.0, **kwargs):
        last_error: Exception | None = None
        for attempt in range(1, attempts + 1):
            try:
                return await asyncio.to_thread(func, *args, **kwargs)
            except Exception as error:  # noqa: BLE001 - сетевые и квотные ошибки SDK
                last_error = error
                self.logger.warning("Gemini call failed | attempt=%s/%s | %s", attempt, attempts, error)
                if attempt < attempts:
                    await asyncio.sleep(delay * attempt)
        raise AIError(str(last_error))

    async def list_models(self) -> list[str]:
        def _call() -> list[str]:
            names = []
            for model in self.client.models.list():
                name = getattr(model, "name", "") or ""
                names.append(name.replace("models/", ""))
            return names

        return await self._retry(_call, attempts=2)

    async def generate_json(self, prompt: str, system: str | None = None, schema: dict | None = None) -> Any:
        def _call(use_schema: bool) -> str:
            config = types.GenerateContentConfig(
                system_instruction=system,
                response_mime_type="application/json",
                temperature=1.0,
            )
            if use_schema and schema:
                config.response_schema = schema
            response = self.client.models.generate_content(
                model=self.settings.text_model,
                contents=prompt,
                config=config,
            )
            return response.text or ""

        try:
            raw = await self._retry(_call, True, attempts=2)
        except AIError:
            self.logger.warning("Structured output failed, retrying without response_schema")
            raw = await self._retry(_call, False, attempts=2)
        return _extract_json(raw)

    async def generate_image(self, prompt: str, out_path: Path) -> Path:
        def _call() -> bytes:
            response = self.client.models.generate_content(
                model=self.settings.image_model,
                contents=prompt,
                config=types.GenerateContentConfig(response_modalities=["IMAGE"]),
            )
            for inline in _inline_parts(response):
                data = getattr(inline, "data", None)
                if data:
                    return data
            raise AIError("Модель не вернула изображение")

        data = await self._retry(_call)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_bytes(data)
        return out_path

    async def generate_speech(self, text: str, voice: str, out_path: Path) -> Path:
        def _call() -> bytes:
            response = self.client.models.generate_content(
                model=self.settings.tts_model,
                contents=text,
                config=types.GenerateContentConfig(
                    response_modalities=["AUDIO"],
                    speech_config=types.SpeechConfig(
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice)
                        )
                    ),
                ),
            )
            for inline in _inline_parts(response):
                data = getattr(inline, "data", None)
                if data:
                    return data
            raise AIError("Модель не вернула аудио")

        pcm = await self._retry(_call)
        write_wav(out_path, pcm)
        return out_path

    async def generate_video(self, prompt: str, out_path: Path, aspect_ratio: str) -> Path:
        settings = self.settings

        def _start() -> Any:
            config = types.GenerateVideosConfig(aspect_ratio=aspect_ratio, number_of_videos=1)
            return self.client.models.generate_videos(
                model=settings.video_model,
                prompt=prompt,
                config=config,
            )

        operation = await self._retry(_start, attempts=2)

        waited = 0
        while not getattr(operation, "done", False):
            if waited >= settings.veo_timeout:
                raise AIError("Veo не успел сгенерировать видео за отведённое время")
            await asyncio.sleep(settings.veo_poll_interval)
            waited += settings.veo_poll_interval
            operation = await self._retry(self.client.operations.get, operation, attempts=2)

        error = getattr(operation, "error", None)
        if error:
            raise AIError(f"Veo вернул ошибку: {error}")

        generated = getattr(getattr(operation, "response", None), "generated_videos", None) or []
        if not generated:
            raise AIError("Veo не вернул видео (возможно, промпт заблокирован фильтрами)")

        video = generated[0].video
        out_path.parent.mkdir(parents=True, exist_ok=True)

        def _download() -> None:
            data = getattr(video, "video_bytes", None)
            if not data:
                self.client.files.download(file=video)
                data = getattr(video, "video_bytes", None)
            if data:
                out_path.write_bytes(data)
            else:
                video.save(str(out_path))

        await self._retry(_download, attempts=2)
        return out_path
