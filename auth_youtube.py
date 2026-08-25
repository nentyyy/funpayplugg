"""Разовый скрипт: получает YOUTUBE_REFRESH_TOKEN для загрузки видео.

Запуск на своей машине (нужен браузер):
    python auth_youtube.py

Перед этим в Google Cloud Console:
1. Создай проект и включи YouTube Data API v3.
2. OAuth consent screen -> External -> добавь себя в Test users.
3. Credentials -> Create credentials -> OAuth client ID -> Desktop app.
4. Скопируй Client ID и Client secret в .env.
"""

from __future__ import annotations

import os
import sys

from google_auth_oauthlib.flow import InstalledAppFlow

from config import load_env_file

SCOPES = ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube"]


def main() -> int:
    load_env_file()
    client_id = os.getenv("YOUTUBE_CLIENT_ID", "").strip()
    client_secret = os.getenv("YOUTUBE_CLIENT_SECRET", "").strip()

    if not client_id or not client_secret:
        print("Заполни YOUTUBE_CLIENT_ID и YOUTUBE_CLIENT_SECRET в .env")
        return 1

    flow = InstalledAppFlow.from_client_config(
        {
            "installed": {
                "client_id": client_id,
                "client_secret": client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": ["http://localhost"],
            }
        },
        SCOPES,
    )

    credentials = flow.run_local_server(port=0, prompt="consent", access_type="offline")

    if not credentials.refresh_token:
        print("Google не вернул refresh_token. Отзови доступ приложению и повтори.")
        return 1

    print("\nГотово. Добавь в .env строку:\n")
    print(f"YOUTUBE_REFRESH_TOKEN={credentials.refresh_token}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
