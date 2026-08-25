from __future__ import annotations

import logging
from pathlib import Path

from config import Settings
from pipeline.media import MediaError, run_ffmpeg
from pipeline.visuals import Visual

FPS = 30
VIDEO_ARGS = [
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "20",
    "-pix_fmt", "yuv420p",
    "-r", str(FPS),
    "-c:a", "aac",
    "-b:a", "192k",
    "-ar", "48000",
    "-ac", "2",
]


def _even(value: float) -> int:
    return int(value) // 2 * 2


class Assembler:
    def __init__(self, settings: Settings, logger: logging.Logger) -> None:
        self.settings = settings
        self.logger = logger

    async def build_scene(
        self,
        index: int,
        visual: Visual,
        audio_path: Path,
        duration: float,
        work_dir: Path,
    ) -> Path:
        width, height = self.settings.size
        out_path = work_dir / f"clip_{index:02d}.mp4"

        if visual.kind == "video":
            chain = (
                f"[0:v]scale={width}:{height}:force_original_aspect_ratio=increase,"
                f"crop={width}:{height},fps={FPS},setsar=1[v]"
            )
            args = [
                "-stream_loop", "-1", "-i", str(visual.path),
                "-i", str(audio_path),
                "-filter_complex", chain,
            ]
        else:
            frames = max(1, round(duration * FPS))
            big_w, big_h = _even(width * 1.5), _even(height * 1.5)
            if index % 2 == 0:
                zoom = "min(zoom+0.0007,1.18)"
            else:
                zoom = "if(lte(zoom,1.0),1.18,max(1.001,zoom-0.0007))"
            chain = (
                f"[0:v]scale={big_w}:{big_h}:force_original_aspect_ratio=increase,"
                f"crop={big_w}:{big_h},"
                f"zoompan=z='{zoom}':d={frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':"
                f"s={width}x{height}:fps={FPS},setsar=1[v]"
            )
            args = [
                "-loop", "1", "-framerate", str(FPS), "-i", str(visual.path),
                "-i", str(audio_path),
                "-filter_complex", chain,
            ]

        args += [
            "-map", "[v]",
            "-map", "1:a",
            "-t", f"{duration:.3f}",
            *VIDEO_ARGS,
            str(out_path),
        ]
        await run_ffmpeg(self.settings.ffmpeg_bin, args)
        return out_path

    async def finish(
        self,
        clips: list[Path],
        work_dir: Path,
        out_path: Path,
        subtitles_name: str | None = None,
        music_path: str | None = None,
    ) -> Path:
        list_path = work_dir / "clips.txt"
        list_path.write_text(
            "\n".join(f"file '{clip.name}'" for clip in clips) + "\n",
            encoding="utf-8",
        )

        base_args = ["-f", "concat", "-safe", "0", "-i", list_path.name]
        has_music = bool(music_path and Path(music_path).exists())
        if has_music:
            base_args += ["-stream_loop", "-1", "-i", str(Path(music_path).resolve())]

        if not subtitles_name and not has_music:
            await run_ffmpeg(
                self.settings.ffmpeg_bin,
                [*base_args, "-c", "copy", "-movflags", "+faststart", str(out_path.resolve())],
                cwd=work_dir,
            )
            return out_path

        async def _render(normalize: bool) -> None:
            filters: list[str] = []
            maps: list[str] = []

            if subtitles_name:
                style = f"force_style='Fontname={self.settings.subtitle_font}'"
                filters.append(f"[0:v]subtitles={subtitles_name}:{style}[v]")
                maps += ["-map", "[v]"]
            else:
                maps += ["-map", "0:v"]

            if has_music:
                mix = "amix=inputs=2:duration=first:dropout_transition=0"
                if normalize:
                    mix += ":normalize=0"
                filters.append(
                    f"[1:a]volume={self.settings.music_volume:.3f}[music];"
                    f"[0:a][music]{mix}[a]"
                )
                maps += ["-map", "[a]"]
            else:
                maps += ["-map", "0:a"]

            await run_ffmpeg(
                self.settings.ffmpeg_bin,
                [
                    *base_args,
                    "-filter_complex", ";".join(filters),
                    *maps,
                    *VIDEO_ARGS,
                    "-movflags", "+faststart",
                    str(out_path.resolve()),
                ],
                cwd=work_dir,
            )

        try:
            await _render(normalize=True)
        except MediaError as error:
            if not has_music:
                raise
            self.logger.warning("amix normalize=0 не поддерживается, повтор без него | %s", error)
            await _render(normalize=False)
        return out_path
