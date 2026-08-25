from __future__ import annotations

import asyncio
import logging
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload

from config import Settings
from prompts import get_preset
from storage import Job, JobStatus, Storage

SCOPES = ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube"]
TOKEN_URI = "https://oauth2.googleapis.com/token"


class YouTubeError(RuntimeError):
    pass


class YouTubeUploader:
    def __init__(self, settings: Settings, storage: Storage, logger: logging.Logger) -> None:
        self.settings = settings
        self.storage = storage
        self.logger = logger

    def _credentials(self) -> Credentials:
        if not self.settings.youtube_ready:
            raise YouTubeError(
                "YouTube не подключён. Заполни YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET и "
                "YOUTUBE_REFRESH_TOKEN (получить: python auth_youtube.py)."
            )
        creds = Credentials(
            token=None,
            refresh_token=self.settings.youtube_refresh_token,
            client_id=self.settings.youtube_client_id,
            client_secret=self.settings.youtube_client_secret,
            token_uri=TOKEN_URI,
            scopes=SCOPES,
        )
        creds.refresh(Request())
        return creds

    def _service(self):
        return build("youtube", "v3", credentials=self._credentials(), cache_discovery=False)

    async def check(self) -> str:
        def _call() -> str:
            service = self._service()
            response = service.channels().list(part="snippet,statistics", mine=True).execute()
            items = response.get("items") or []
            if not items:
                raise YouTubeError("Канал не найден для этого аккаунта")
            channel = items[0]
            title = channel["snippet"]["title"]
            subs = channel.get("statistics", {}).get("subscriberCount", "?")
            return f"{title} (подписчиков: {subs})"

        return await asyncio.to_thread(_call)

    async def publish(self, job: Job, video_path: Path, thumbnail_path: Path | None) -> str:
        script = job.script or {}
        preset = get_preset(job.preset)
        privacy = str(job.params.get("privacy") or self.settings.youtube_privacy)
        made_for_kids = bool(job.params.get("made_for_kids", preset.made_for_kids))

        title = (script.get("title") or job.topic)[:95]
        description = script.get("description") or ""
        tags = script.get("tags") or []
        if self.settings.orientation == "vertical" and "#shorts" not in description.lower():
            description = f"{description}\n\n#Shorts".strip()

        def _call() -> str:
            service = self._service()
            body = {
                "snippet": {
                    "title": title,
                    "description": description[:4900],
                    "tags": tags,
                    "categoryId": self.settings.youtube_category_id,
                },
                "status": {
                    "privacyStatus": privacy,
                    "selfDeclaredMadeForKids": made_for_kids,
                },
            }
            media = MediaFileUpload(str(video_path), chunksize=4 * 1024 * 1024, resumable=True, mimetype="video/mp4")
            request = service.videos().insert(part="snippet,status", body=body, media_body=media)

            response = None
            while response is None:
                status, response = request.next_chunk()
                if status:
                    self.logger.info("YouTube upload | job=%s | %.0f%%", job.id, status.progress() * 100)

            video_id = response["id"]

            if thumbnail_path and Path(thumbnail_path).exists():
                try:
                    service.thumbnails().set(videoId=video_id, media_body=MediaFileUpload(str(thumbnail_path))).execute()
                except HttpError as error:
                    self.logger.warning("Обложка не установлена (нужна верификация канала) | %s", error)

            if self.settings.youtube_playlist_id:
                try:
                    service.playlistItems().insert(
                        part="snippet",
                        body={
                            "snippet": {
                                "playlistId": self.settings.youtube_playlist_id,
                                "resourceId": {"kind": "youtube#video", "videoId": video_id},
                            }
                        },
                    ).execute()
                except HttpError as error:
                    self.logger.warning("Не удалось добавить в плейлист | %s", error)

            return video_id

        try:
            video_id = await asyncio.to_thread(_call)
        except HttpError as error:
            raise YouTubeError(f"YouTube API: {error}") from error

        url = f"https://youtu.be/{video_id}"
        await self.storage.update_job(job.id, youtube_id=video_id, status=JobStatus.PUBLISHED, error=None)
        self.logger.info("Published | job=%s | url=%s", job.id, url)
        return url
