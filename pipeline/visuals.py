from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

from ai import GeminiClient
from config import Settings
from pipeline.media import MediaError, run_ffmpeg

PALETTE = [
    ("0x1f2a44", "0x0b1020"),
    ("0x3a1f44", "0x120b20"),
    ("0x1f4438", "0x0b201a"),
    ("0x44341f", "0x201709"),
    ("0x1f3444", "0x0b1720"),
    ("0x441f2a", "0x200b12"),
]

ASPECT_HINT = {
    "vertical": "vertical 9:16 full-frame composition, subject centered, generous headroom",
    "horizontal": "horizontal 16:9 widescreen composition, cinematic framing",
}


@dataclass(slots=True)
class Visual:
    kind: str
    path: Path


class VisualMaker:
    def __init__(self, ai: GeminiClient | None, settings: Settings, logger: logging.Logger) -> None:
        self.ai = ai
        self.settings = settings
        self.logger = logger

    async def render_scene(self, index: int, prompt: str, mode: str, work_dir: Path) -> Visual:
        if mode == "veo" and self.ai:
            try:
                path = await self.ai.generate_video(
                    prompt,
                    work_dir / f"scene_{index:02d}_src.mp4",
                    self.settings.aspect_ratio,
                )
                return Visual("video", path)
            except Exception as error:  # noqa: BLE001 - падаем в картинку, а не в отказ
                self.logger.warning("Veo failed on scene %s, falling back to image | %s", index, error)
                mode = "image"

        if mode == "image" and self.ai:
            hint = ASPECT_HINT.get(self.settings.orientation, ASPECT_HINT["vertical"])
            try:
                path = await self.ai.generate_image(
                    f"{prompt}. {hint}.",
                    work_dir / f"scene_{index:02d}.png",
                )
                return Visual("image", path)
            except Exception as error:  # noqa: BLE001 - одна плохая сцена не должна ронять ролик
                self.logger.warning("Image failed on scene %s, falling back to gradient | %s", index, error)

        return Visual("image", await self._gradient(index, work_dir))

    async def _gradient(self, index: int, work_dir: Path) -> Path:
        width, height = self.settings.size
        top, bottom = PALETTE[index % len(PALETTE)]
        out_path = work_dir / f"scene_{index:02d}.png"
        try:
            await run_ffmpeg(
                self.settings.ffmpeg_bin,
                [
                    "-f", "lavfi",
                    "-i", f"gradients=s={width}x{height}:c0={top}:c1={bottom}:x0=0:y0=0:x1={width}:y1={height}",
                    "-frames:v", "1",
                    str(out_path),
                ],
            )
        except MediaError:
            await run_ffmpeg(
                self.settings.ffmpeg_bin,
                ["-f", "lavfi", "-i", f"color=c={top}:s={width}x{height}", "-frames:v", "1", str(out_path)],
            )
        return out_path
