from __future__ import annotations

import asyncio
import shutil
import subprocess
import wave
from pathlib import Path


class MediaError(RuntimeError):
    pass


def ensure_ffmpeg(ffmpeg_bin: str, ffprobe_bin: str) -> None:
    for binary in (ffmpeg_bin, ffprobe_bin):
        if shutil.which(binary) is None:
            raise MediaError(
                f"Не найден {binary}. Установи ffmpeg и добавь его в PATH "
                "(или укажи FFMPEG_BIN/FFPROBE_BIN в .env)."
            )


async def run_ffmpeg(ffmpeg_bin: str, args: list[str], cwd: Path | None = None) -> None:
    command = [ffmpeg_bin, "-hide_banner", "-loglevel", "error", "-y", *args]

    def _call() -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            command,
            cwd=str(cwd) if cwd else None,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )

    result = await asyncio.to_thread(_call)
    if result.returncode != 0:
        tail = (result.stderr or "").strip().splitlines()[-8:]
        raise MediaError("ffmpeg упал:\n" + "\n".join(tail))


async def probe_duration(ffprobe_bin: str, path: Path) -> float:
    def _call() -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [
                ffprobe_bin,
                "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                str(path),
            ],
            capture_output=True,
            text=True,
        )

    result = await asyncio.to_thread(_call)
    if result.returncode != 0:
        raise MediaError(f"ffprobe не смог прочитать {path.name}")
    try:
        return float((result.stdout or "0").strip())
    except ValueError as error:
        raise MediaError(f"ffprobe вернул некорректную длительность для {path.name}") from error


def wav_duration(path: Path) -> float:
    with wave.open(str(path), "rb") as handle:
        frames = handle.getnframes()
        rate = handle.getframerate() or 1
    return frames / float(rate)


def file_size_mb(path: Path) -> float:
    return path.stat().st_size / (1024 * 1024)
