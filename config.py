from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


def _bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def _int(value: str | None, default: int) -> int:
    try:
        return int(value) if value is not None and value.strip() else default
    except ValueError:
        return default


def _float(value: str | None, default: float) -> float:
    try:
        return float(value) if value is not None and value.strip() else default
    except ValueError:
        return default


def _list(value: str | None) -> list[str]:
    if not value:
        return []
    return [chunk.strip() for chunk in value.split(",") if chunk.strip()]


def _int_list(value: str | None) -> list[int]:
    result: list[int] = []
    for chunk in _list(value):
        try:
            result.append(int(chunk))
        except ValueError:
            continue
    return result


@dataclass(slots=True)
class Settings:
    telegram_token: str
    admin_ids: list[int]

    gemini_api_key: str
    text_model: str
    image_model: str
    tts_model: str
    video_model: str

    visual_mode: str
    orientation: str
    scenes_count: int
    scene_seconds: float
    voice_name: str
    language: str
    subtitles: bool
    subtitle_font: str
    music_path: str
    music_volume: float
    thumbnail_enabled: bool

    veo_poll_interval: int
    veo_timeout: int

    youtube_client_id: str
    youtube_client_secret: str
    youtube_refresh_token: str
    youtube_privacy: str
    youtube_category_id: str
    youtube_playlist_id: str
    youtube_made_for_kids: bool

    auto_enabled: bool
    auto_times: list[str]
    auto_preset: str
    auto_privacy: str
    auto_notify_chat_id: int

    database_path: Path
    work_dir: Path
    ffmpeg_bin: str
    ffprobe_bin: str
    keep_workdir: bool
    log_level: str

    presets: dict = field(default_factory=dict)

    @property
    def size(self) -> tuple[int, int]:
        return (1080, 1920) if self.orientation == "vertical" else (1920, 1080)

    @property
    def aspect_ratio(self) -> str:
        return "9:16" if self.orientation == "vertical" else "16:9"

    def is_admin(self, user_id: int) -> bool:
        return not self.admin_ids or user_id in self.admin_ids

    @property
    def youtube_ready(self) -> bool:
        return bool(self.youtube_client_id and self.youtube_client_secret and self.youtube_refresh_token)


def load_env_file(path: str = ".env") -> None:
    env_path = Path(path)
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def load_settings() -> Settings:
    database_path = Path(os.getenv("DATABASE_PATH", "data/videobot.sqlite3")).expanduser()
    database_path.parent.mkdir(parents=True, exist_ok=True)

    work_dir = Path(os.getenv("WORK_DIR", "work")).expanduser()
    work_dir.mkdir(parents=True, exist_ok=True)

    return Settings(
        telegram_token=os.getenv("TELEGRAM_BOT_TOKEN", ""),
        admin_ids=_int_list(os.getenv("TELEGRAM_ADMIN_IDS")),
        gemini_api_key=os.getenv("GEMINI_API_KEY", ""),
        text_model=os.getenv("GEMINI_TEXT_MODEL", "gemini-flash-latest"),
        image_model=os.getenv("GEMINI_IMAGE_MODEL", "gemini-2.5-flash-image"),
        tts_model=os.getenv("GEMINI_TTS_MODEL", "gemini-2.5-flash-preview-tts"),
        video_model=os.getenv("GEMINI_VIDEO_MODEL", "veo-3.1-fast-generate-preview"),
        visual_mode=os.getenv("VISUAL_MODE", "image").strip().lower(),
        orientation=os.getenv("ORIENTATION", "vertical").strip().lower(),
        scenes_count=_int(os.getenv("SCENES_COUNT"), 6),
        scene_seconds=_float(os.getenv("SCENE_SECONDS"), 8.0),
        voice_name=os.getenv("TTS_VOICE", "Kore"),
        language=os.getenv("CONTENT_LANGUAGE", "ru"),
        subtitles=_bool(os.getenv("SUBTITLES"), True),
        subtitle_font=os.getenv("SUBTITLE_FONT", "Arial"),
        music_path=os.getenv("MUSIC_PATH", ""),
        music_volume=_float(os.getenv("MUSIC_VOLUME"), 0.12),
        thumbnail_enabled=_bool(os.getenv("THUMBNAIL_ENABLED"), True),
        veo_poll_interval=_int(os.getenv("VEO_POLL_INTERVAL"), 15),
        veo_timeout=_int(os.getenv("VEO_TIMEOUT"), 900),
        youtube_client_id=os.getenv("YOUTUBE_CLIENT_ID", ""),
        youtube_client_secret=os.getenv("YOUTUBE_CLIENT_SECRET", ""),
        youtube_refresh_token=os.getenv("YOUTUBE_REFRESH_TOKEN", ""),
        youtube_privacy=os.getenv("YOUTUBE_PRIVACY", "private").strip().lower(),
        youtube_category_id=os.getenv("YOUTUBE_CATEGORY_ID", "24"),
        youtube_playlist_id=os.getenv("YOUTUBE_PLAYLIST_ID", ""),
        youtube_made_for_kids=_bool(os.getenv("YOUTUBE_MADE_FOR_KIDS"), False),
        auto_enabled=_bool(os.getenv("AUTO_ENABLED"), False),
        auto_times=_list(os.getenv("AUTO_TIMES")) or ["10:00", "19:00"],
        auto_preset=os.getenv("AUTO_PRESET", "ai_stories"),
        auto_privacy=os.getenv("AUTO_PRIVACY", "private").strip().lower(),
        auto_notify_chat_id=_int(os.getenv("AUTO_NOTIFY_CHAT_ID"), 0),
        database_path=database_path,
        work_dir=work_dir,
        ffmpeg_bin=os.getenv("FFMPEG_BIN", "ffmpeg"),
        ffprobe_bin=os.getenv("FFPROBE_BIN", "ffprobe"),
        keep_workdir=_bool(os.getenv("KEEP_WORKDIR"), False),
        log_level=os.getenv("LOG_LEVEL", "INFO").upper(),
    )
