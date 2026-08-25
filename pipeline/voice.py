from __future__ import annotations

import logging
from pathlib import Path

from ai import GeminiClient
from pipeline.media import wav_duration

STYLE_HINT = {
    "ai_stories": "Прочитай выразительно, с интригой, средний темп:",
    "kids": "Прочитай тепло и ласково, как сказку для малыша, неспешно:",
    "facts": "Прочитай бодро и энергично, как ведущий шоу:",
    "horror": "Прочитай тихо и напряжённо, с паузами, нагнетая тревогу:",
}


class VoiceOver:
    def __init__(self, ai: GeminiClient, logger: logging.Logger) -> None:
        self.ai = ai
        self.logger = logger

    async def render_scene(self, text: str, voice: str, preset_key: str, out_path: Path) -> float:
        hint = STYLE_HINT.get(preset_key, "Прочитай выразительно:")
        await self.ai.generate_speech(f"{hint} {text}", voice, out_path)
        duration = wav_duration(out_path)
        self.logger.info("Voice rendered | file=%s | duration=%.2fs", out_path.name, duration)
        return duration
