from __future__ import annotations

import html
import logging
from dataclasses import dataclass
from pathlib import Path

from aiogram import Bot, F, Router
from aiogram.filters import Command, CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import CallbackQuery, FSInputFile, InlineKeyboardButton, InlineKeyboardMarkup, Message

from ai import GeminiClient
from config import Settings
from pipeline.media import file_size_mb
from pipeline.script import ScriptWriter
from prompts import PRESETS, VOICES, get_preset
from scheduler import AutoScheduler
from storage import ACTIVE_STATUSES, Job, JobStatus, STATUS_LABELS, Storage
from youtube import YouTubeUploader

TELEGRAM_FILE_LIMIT_MB = 48

PRIVACY_LABELS = {
    "private": "приватно",
    "unlisted": "по ссылке",
    "public": "публично",
}


@dataclass(slots=True)
class BotContext:
    settings: Settings
    storage: Storage
    ai: GeminiClient
    writer: ScriptWriter
    uploader: YouTubeUploader
    scheduler: AutoScheduler
    logger: logging.Logger


class NewVideo(StatesGroup):
    preset = State()
    topic = State()
    mode = State()
    publish = State()


def _preset_keyboard() -> InlineKeyboardMarkup:
    rows = [
        [InlineKeyboardButton(text=preset.title, callback_data=f"preset:{key}")]
        for key, preset in PRESETS.items()
    ]
    return InlineKeyboardMarkup(inline_keyboard=rows)


def _topic_keyboard(topics: list[str]) -> InlineKeyboardMarkup:
    rows = [[InlineKeyboardButton(text=topic[:60], callback_data=f"topic:{index}")] for index, topic in enumerate(topics)]
    rows.append([InlineKeyboardButton(text="🎲 Другие идеи", callback_data="topics:more")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def _mode_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="🖼 Картинки + движение (дёшево)", callback_data="mode:image")],
            [InlineKeyboardButton(text="🎬 Veo видео (дорого)", callback_data="mode:veo")],
            [InlineKeyboardButton(text="🧪 Тест без картинок (бесплатно)", callback_data="mode:gradient")],
        ]
    )


def _publish_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="👀 Сначала показать мне", callback_data="pub:review")],
            [InlineKeyboardButton(text="🔒 Сразу на YouTube (приватно)", callback_data="pub:private")],
            [InlineKeyboardButton(text="🔗 Сразу на YouTube (по ссылке)", callback_data="pub:unlisted")],
            [InlineKeyboardButton(text="🌍 Сразу на YouTube (публично)", callback_data="pub:public")],
        ]
    )


def _review_keyboard(job_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="🔒 Приватно", callback_data=f"upload:{job_id}:private"),
                InlineKeyboardButton(text="🔗 По ссылке", callback_data=f"upload:{job_id}:unlisted"),
                InlineKeyboardButton(text="🌍 Публично", callback_data=f"upload:{job_id}:public"),
            ],
            [InlineKeyboardButton(text="🔁 Перегенерировать", callback_data=f"regen:{job_id}")],
        ]
    )


def _job_line(job: Job) -> str:
    label = STATUS_LABELS.get(job.status, job.status)
    line = f"#{job.id} · {html.escape(job.title[:50])} · {label}"
    if job.youtube_url:
        line += f"\n{job.youtube_url}"
    return line


class TelegramNotifier:
    def __init__(self, bot: Bot, settings: Settings, logger: logging.Logger) -> None:
        self.bot = bot
        self.settings = settings
        self.logger = logger

    async def send(self, chat_id: int, text: str, **kwargs) -> None:
        try:
            await self.bot.send_message(chat_id, text, **kwargs)
        except Exception as error:  # noqa: BLE001 - уведомления не должны ронять воркер
            self.logger.warning("Не отправил сообщение в %s | %s", chat_id, error)

    async def on_status(self, job: Job, text: str) -> None:
        await self.send(job.chat_id, f"#{job.id} · {text}")

    async def on_ready(self, job: Job, video_path: Path) -> None:
        script = job.script or {}
        caption = (
            f"<b>#{job.id} · {html.escape(str(script.get('title', job.topic)))}</b>\n\n"
            f"{html.escape(str(script.get('description', '')))[:700]}"
        )
        size = file_size_mb(video_path)
        try:
            if size <= TELEGRAM_FILE_LIMIT_MB:
                await self.bot.send_video(
                    job.chat_id,
                    FSInputFile(video_path),
                    caption=caption,
                    parse_mode="HTML",
                    reply_markup=_review_keyboard(job.id),
                    supports_streaming=True,
                )
            else:
                await self.send(
                    job.chat_id,
                    f"{caption}\n\nФайл {size:.1f} МБ — больше лимита Telegram.\n<code>{video_path}</code>",
                    parse_mode="HTML",
                    reply_markup=_review_keyboard(job.id),
                )
        except Exception as error:  # noqa: BLE001
            self.logger.warning("Не отправил видео job=%s | %s", job.id, error)
            await self.send(job.chat_id, f"#{job.id} готово, но не отправилось в чат: <code>{video_path}</code>",
                             parse_mode="HTML", reply_markup=_review_keyboard(job.id))

    async def on_published(self, job: Job, url: str) -> None:
        await self.send(job.chat_id, f"✅ #{job.id} опубликовано: {url}")

    async def on_failed(self, job: Job, error: str) -> None:
        await self.send(job.chat_id, f"❌ #{job.id} ошибка:\n<code>{html.escape(error[:900])}</code>", parse_mode="HTML")


def build_router(ctx: BotContext) -> Router:
    router = Router()
    settings = ctx.settings
    storage = ctx.storage
    logger = ctx.logger

    @router.message(CommandStart())
    async def cmd_start(message: Message) -> None:
        if not settings.is_admin(message.from_user.id):
            await message.answer(f"Доступ закрыт. Твой ID: <code>{message.from_user.id}</code>", parse_mode="HTML")
            return
        await message.answer(
            "<b>Видеофабрика</b>\n\n"
            "Генерирую короткие видео: сценарий → кадры → озвучка → монтаж → YouTube.\n\n"
            "/new — новое видео\n"
            "/auto — автопостинг по расписанию\n"
            "/queue — очередь и последние работы\n"
            "/job N — карточка задачи\n"
            "/cancel N — отменить задачу\n"
            "/settings — текущие настройки\n"
            "/yt — проверить подключение YouTube\n"
            "/voices — список голосов\n"
            "/models — доступные модели Gemini",
            parse_mode="HTML",
        )

    @router.message(Command("new"))
    async def cmd_new(message: Message, state: FSMContext) -> None:
        if not settings.is_admin(message.from_user.id):
            return
        await state.clear()
        await state.set_state(NewVideo.preset)
        await message.answer("Выбери формат:", reply_markup=_preset_keyboard())

    @router.callback_query(F.data.startswith("preset:"))
    async def on_preset(callback: CallbackQuery, state: FSMContext) -> None:
        preset_key = callback.data.split(":", 1)[1]
        await state.update_data(preset=preset_key)
        await state.set_state(NewVideo.topic)
        await callback.message.edit_text(
            f"Формат: <b>{get_preset(preset_key).title}</b>\n\n"
            "Пришли тему одним сообщением или нажми кнопку, чтобы я придумал сам.",
            parse_mode="HTML",
            reply_markup=InlineKeyboardMarkup(
                inline_keyboard=[[InlineKeyboardButton(text="🎲 Придумай сам", callback_data="topics:more")]]
            ),
        )
        await callback.answer()

    @router.callback_query(F.data == "topics:more")
    async def on_topics(callback: CallbackQuery, state: FSMContext) -> None:
        data = await state.get_data()
        preset = get_preset(data.get("preset", ""))
        await callback.answer("Придумываю…")
        try:
            topics = await ctx.writer.suggest_topics(preset, settings.language, count=5)
        except Exception as error:  # noqa: BLE001
            await callback.message.answer(f"Не смог придумать темы: {error}")
            return
        await state.update_data(topics=topics)
        await state.set_state(NewVideo.topic)
        await callback.message.answer("Выбери тему:", reply_markup=_topic_keyboard(topics))

    @router.callback_query(F.data.startswith("topic:"))
    async def on_topic_pick(callback: CallbackQuery, state: FSMContext) -> None:
        index = int(callback.data.split(":", 1)[1])
        data = await state.get_data()
        topics = data.get("topics") or []
        if index >= len(topics):
            await callback.answer("Тема устарела, нажми /new", show_alert=True)
            return
        await state.update_data(topic=topics[index])
        await state.set_state(NewVideo.mode)
        await callback.message.edit_text(
            f"Тема: <b>{html.escape(topics[index])}</b>\n\nКак генерировать картинку?",
            parse_mode="HTML",
            reply_markup=_mode_keyboard(),
        )
        await callback.answer()

    @router.message(NewVideo.topic)
    async def on_topic_text(message: Message, state: FSMContext) -> None:
        topic = (message.text or "").strip()
        if len(topic) < 3:
            await message.answer("Слишком короткая тема, напиши подробнее.")
            return
        await state.update_data(topic=topic)
        await state.set_state(NewVideo.mode)
        await message.answer("Как генерировать картинку?", reply_markup=_mode_keyboard())

    @router.callback_query(F.data.startswith("mode:"))
    async def on_mode(callback: CallbackQuery, state: FSMContext) -> None:
        await state.update_data(visual_mode=callback.data.split(":", 1)[1])
        await state.set_state(NewVideo.publish)
        await callback.message.edit_text("Что делать с готовым видео?", reply_markup=_publish_keyboard())
        await callback.answer()

    @router.callback_query(F.data.startswith("pub:"))
    async def on_publish_choice(callback: CallbackQuery, state: FSMContext) -> None:
        choice = callback.data.split(":", 1)[1]
        data = await state.get_data()
        await state.clear()

        preset = get_preset(data.get("preset", ""))
        topic = data.get("topic")
        if not topic:
            await callback.answer("Потерял тему, начни заново: /new", show_alert=True)
            return

        auto_publish = choice != "review"
        if auto_publish and not settings.youtube_ready:
            await callback.message.answer("YouTube не подключён — сделаю видео и покажу тут. Настрой /yt.")
            auto_publish = False

        job = await storage.create_job(
            chat_id=callback.message.chat.id,
            user_id=callback.from_user.id,
            preset=preset.key,
            topic=topic,
            params={
                "visual_mode": data.get("visual_mode", settings.visual_mode),
                "voice": preset.voice,
                "scenes_count": settings.scenes_count,
                "scene_seconds": settings.scene_seconds,
                "language": settings.language,
                "subtitles": settings.subtitles,
                "privacy": choice if auto_publish else settings.youtube_privacy,
                "made_for_kids": preset.made_for_kids,
                "auto_publish": auto_publish,
            },
        )
        await callback.message.edit_text(
            f"Задача <b>#{job.id}</b> в очереди.\nТема: {html.escape(topic)}\n"
            f"Публикация: {'сразу, ' + PRIVACY_LABELS.get(choice, choice) if auto_publish else 'после проверки'}",
            parse_mode="HTML",
        )
        await callback.answer()

    @router.callback_query(F.data.startswith("upload:"))
    async def on_upload(callback: CallbackQuery) -> None:
        _, raw_id, privacy = callback.data.split(":")
        job = await storage.get_job(int(raw_id))
        if not job or not job.video_path:
            await callback.answer("Видео не найдено", show_alert=True)
            return
        if job.youtube_id:
            await callback.answer("Уже опубликовано", show_alert=True)
            return

        await callback.answer("Загружаю…")
        await storage.update_job(job.id, status=JobStatus.UPLOADING)
        job.params["privacy"] = privacy
        try:
            url = await ctx.uploader.publish(job, Path(job.video_path), Path(job.thumbnail_path) if job.thumbnail_path else None)
        except Exception as error:  # noqa: BLE001 - показываем причину пользователю
            logger.exception("Upload failed | job=%s", job.id)
            await storage.update_job(job.id, status=JobStatus.REVIEW, error=str(error)[:900])
            await callback.message.answer(f"❌ Не загрузилось: <code>{html.escape(str(error)[:800])}</code>", parse_mode="HTML")
            return
        await callback.message.answer(f"✅ #{job.id} на YouTube ({PRIVACY_LABELS.get(privacy, privacy)}): {url}")

    @router.callback_query(F.data.startswith("regen:"))
    async def on_regen(callback: CallbackQuery) -> None:
        job = await storage.get_job(int(callback.data.split(":", 1)[1]))
        if not job:
            await callback.answer("Задача не найдена", show_alert=True)
            return
        new_job = await storage.create_job(
            chat_id=job.chat_id,
            user_id=callback.from_user.id,
            preset=job.preset,
            topic=job.topic,
            params=job.params,
        )
        await callback.answer("Перегенерирую")
        await callback.message.answer(f"🔁 Новая попытка по теме «{html.escape(job.topic)}» — задача #{new_job.id}.")

    @router.message(Command("queue"))
    async def cmd_queue(message: Message) -> None:
        if not settings.is_admin(message.from_user.id):
            return
        active = await storage.list_jobs(limit=10, statuses=ACTIVE_STATUSES)
        recent = await storage.list_jobs(limit=8)
        parts = ["<b>В работе:</b>"]
        parts.append("\n".join(_job_line(job) for job in active) if active else "пусто")
        parts.append("\n<b>Последние:</b>")
        parts.append("\n".join(_job_line(job) for job in recent) if recent else "пусто")
        await message.answer("\n".join(parts), parse_mode="HTML", disable_web_page_preview=True)

    @router.message(Command("job"))
    async def cmd_job(message: Message) -> None:
        if not settings.is_admin(message.from_user.id):
            return
        parts = (message.text or "").split()
        if len(parts) < 2 or not parts[1].isdigit():
            await message.answer("Формат: /job 12")
            return
        job = await storage.get_job(int(parts[1]))
        if not job:
            await message.answer("Задача не найдена")
            return
        script = job.script or {}
        text = [
            f"<b>#{job.id}</b> · {STATUS_LABELS.get(job.status, job.status)}",
            f"Формат: {get_preset(job.preset).title}",
            f"Тема: {html.escape(job.topic)}",
        ]
        if script.get("title"):
            text.append(f"Заголовок: {html.escape(str(script['title']))}")
        if script.get("scenes"):
            text.append(f"Сцен: {len(script['scenes'])}")
        if job.video_path:
            text.append(f"Файл: <code>{job.video_path}</code>")
        if job.youtube_url:
            text.append(f"YouTube: {job.youtube_url}")
        if job.error:
            text.append(f"Ошибка: <code>{html.escape(job.error[:500])}</code>")
        markup = _review_keyboard(job.id) if job.status == JobStatus.REVIEW else None
        await message.answer("\n".join(text), parse_mode="HTML", reply_markup=markup, disable_web_page_preview=True)

    @router.message(Command("cancel"))
    async def cmd_cancel(message: Message) -> None:
        if not settings.is_admin(message.from_user.id):
            return
        parts = (message.text or "").split()
        if len(parts) < 2 or not parts[1].isdigit():
            await message.answer("Формат: /cancel 12")
            return
        job = await storage.get_job(int(parts[1]))
        if not job:
            await message.answer("Задача не найдена")
            return
        await storage.update_job(job.id, status=JobStatus.CANCELLED)
        await message.answer(f"#{job.id} отменена.")

    @router.message(Command("auto"))
    async def cmd_auto(message: Message) -> None:
        if not settings.is_admin(message.from_user.id):
            return
        parts = (message.text or "").split()
        enabled = await ctx.scheduler.is_enabled()
        if len(parts) > 1 and parts[1] in {"on", "off"}:
            enabled = parts[1] == "on"
            await ctx.scheduler.set_enabled(enabled)
        chat_hint = (
            f"\nЧат для автопостинга: <code>{settings.auto_notify_chat_id or 'не задан'}</code>"
            f"\nТекущий чат: <code>{message.chat.id}</code>"
        )
        await message.answer(
            f"Автопостинг: <b>{'включён' if enabled else 'выключен'}</b>\n"
            f"Расписание: {', '.join(settings.auto_times)}\n"
            f"Формат: {get_preset(settings.auto_preset).title}\n"
            f"Приватность: {PRIVACY_LABELS.get(settings.auto_privacy, settings.auto_privacy)}"
            f"{chat_hint}\n\n"
            "Переключить: /auto on | /auto off",
            parse_mode="HTML",
        )

    @router.message(Command("settings"))
    async def cmd_settings(message: Message) -> None:
        if not settings.is_admin(message.from_user.id):
            return
        width, height = settings.size
        await message.answer(
            "<b>Настройки</b>\n"
            f"Формат кадра: {width}x{height} ({settings.orientation})\n"
            f"Сцен по умолчанию: {settings.scenes_count} × ~{settings.scene_seconds:.0f} сек\n"
            f"Визуал: {settings.visual_mode}\n"
            f"Субтитры: {'да' if settings.subtitles else 'нет'}\n"
            f"Язык: {settings.language}\n"
            f"Голос по умолчанию: {settings.voice_name}\n\n"
            f"Текст: <code>{settings.text_model}</code>\n"
            f"Картинки: <code>{settings.image_model}</code>\n"
            f"Озвучка: <code>{settings.tts_model}</code>\n"
            f"Видео: <code>{settings.video_model}</code>\n\n"
            f"YouTube: {'подключён' if settings.youtube_ready else 'не подключён'}",
            parse_mode="HTML",
        )

    @router.message(Command("voices"))
    async def cmd_voices(message: Message) -> None:
        if not settings.is_admin(message.from_user.id):
            return
        await message.answer("Голоса Gemini TTS:\n" + ", ".join(VOICES) + "\n\nМеняется через TTS_VOICE в .env")

    @router.message(Command("models"))
    async def cmd_models(message: Message) -> None:
        if not settings.is_admin(message.from_user.id):
            return
        try:
            models = await ctx.ai.list_models()
        except Exception as error:  # noqa: BLE001
            await message.answer(f"Не получил список моделей: {error}")
            return
        interesting = [name for name in models if any(tag in name for tag in ("flash", "veo", "tts", "image", "pro"))]
        await message.answer("Доступно:\n<code>" + "\n".join(interesting[:60]) + "</code>", parse_mode="HTML")

    @router.message(Command("yt"))
    async def cmd_yt(message: Message) -> None:
        if not settings.is_admin(message.from_user.id):
            return
        try:
            channel = await ctx.uploader.check()
        except Exception as error:  # noqa: BLE001
            await message.answer(f"YouTube не подключён:\n<code>{html.escape(str(error)[:800])}</code>", parse_mode="HTML")
            return
        await message.answer(f"YouTube подключён: <b>{html.escape(channel)}</b>", parse_mode="HTML")

    return router
