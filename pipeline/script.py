from __future__ import annotations

import logging
from typing import Any

from ai import AIError, GeminiClient
from prompts import Preset, TOPIC_PROMPT, SCRIPT_SYSTEM, script_prompt

SCRIPT_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "title": {"type": "STRING"},
        "description": {"type": "STRING"},
        "tags": {"type": "ARRAY", "items": {"type": "STRING"}},
        "thumbnail_prompt": {"type": "STRING"},
        "scenes": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "narration": {"type": "STRING"},
                    "visual_prompt": {"type": "STRING"},
                    "caption": {"type": "STRING"},
                },
                "required": ["narration", "visual_prompt"],
            },
        },
    },
    "required": ["title", "description", "tags", "scenes"],
}

TOPICS_SCHEMA: dict[str, Any] = {"type": "ARRAY", "items": {"type": "STRING"}}


class ScriptWriter:
    def __init__(self, ai: GeminiClient, logger: logging.Logger) -> None:
        self.ai = ai
        self.logger = logger

    async def suggest_topics(self, preset: Preset, language: str, count: int = 5) -> list[str]:
        prompt = TOPIC_PROMPT.format(count=count, seed=preset.topic_seed, language=language)
        data = await self.ai.generate_json(prompt, system=SCRIPT_SYSTEM, schema=TOPICS_SCHEMA)
        if isinstance(data, dict):
            data = next((value for value in data.values() if isinstance(value, list)), [])
        topics = [str(item).strip() for item in data if str(item).strip()]
        if not topics:
            raise AIError("Не удалось придумать темы")
        return topics[:count]

    async def write(
        self,
        preset: Preset,
        topic: str,
        scenes_count: int,
        scene_seconds: float,
        language: str,
        orientation: str,
    ) -> dict[str, Any]:
        prompt = script_prompt(preset, topic, scenes_count, scene_seconds, language, orientation)
        data = await self.ai.generate_json(prompt, system=SCRIPT_SYSTEM, schema=SCRIPT_SCHEMA)
        if not isinstance(data, dict):
            raise AIError("Сценарий пришёл в неожиданном формате")

        scenes = []
        for raw in data.get("scenes") or []:
            narration = str(raw.get("narration", "")).strip()
            visual_prompt = str(raw.get("visual_prompt", "")).strip()
            if not narration or not visual_prompt:
                continue
            scenes.append(
                {
                    "narration": narration,
                    "visual_prompt": f"{visual_prompt}. {preset.visual_style}",
                    "caption": str(raw.get("caption", "")).strip(),
                }
            )

        if not scenes:
            raise AIError("Модель не вернула ни одной сцены")

        scenes = scenes[:scenes_count]
        tags = [str(tag).strip().lstrip("#") for tag in data.get("tags") or [] if str(tag).strip()]

        return {
            "title": str(data.get("title") or topic).strip()[:95],
            "description": str(data.get("description") or "").strip(),
            "tags": tags[:15],
            "thumbnail_prompt": str(data.get("thumbnail_prompt") or scenes[0]["visual_prompt"]).strip(),
            "scenes": scenes,
            "topic": topic,
            "preset": preset.key,
        }
