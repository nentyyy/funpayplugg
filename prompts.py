from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class Preset:
    key: str
    title: str
    audience: str
    style: str
    visual_style: str
    voice: str
    made_for_kids: bool
    topic_seed: str


PRESETS: dict[str, Preset] = {
    "ai_stories": Preset(
        key="ai_stories",
        title="ИИ-истории",
        audience="взрослая аудитория 18-40, любители коротких историй",
        style=(
            "Короткая захватывающая история с неожиданным поворотом в конце. "
            "Первые 3 секунды - крючок, который невозможно пролистать. "
            "Живой разговорный язык, короткие предложения, нарастающее напряжение."
        ),
        visual_style=(
            "cinematic photorealistic still, dramatic moody lighting, shallow depth of field, "
            "film grain, 35mm lens, high detail, no text, no watermark"
        ),
        voice="Charon",
        made_for_kids=False,
        topic_seed="загадочные и вирусные короткие истории, городские легенды, необычные случаи из жизни",
    ),
    "kids": Preset(
        key="kids",
        title="Детские сказки",
        audience="дети 3-8 лет и их родители",
        style=(
            "Добрая поучительная сказка с простым сюжетом и понятной моралью в конце. "
            "Простые слова, короткие предложения, тёплая интонация, никакого страха и насилия."
        ),
        visual_style=(
            "cute 3d cartoon illustration for children, soft pastel colors, rounded shapes, "
            "warm friendly lighting, storybook style, no text, no watermark"
        ),
        voice="Aoede",
        made_for_kids=True,
        topic_seed="добрые сказки про животных, дружбу, помощь и смелость для малышей",
    ),
    "facts": Preset(
        key="facts",
        title="Факты и топы",
        audience="широкая аудитория, любители познавательного контента",
        style=(
            "Динамичная подборка удивительных фактов. Каждая сцена - один факт. "
            "Начинается с самого сильного факта, заканчивается вопросом к зрителю."
        ),
        visual_style=(
            "vivid photorealistic image, bright saturated colors, dynamic composition, "
            "high contrast, sharp focus, no text, no watermark"
        ),
        voice="Puck",
        made_for_kids=False,
        topic_seed="удивительные факты о космосе, науке, животных, истории и человеческом теле",
    ),
    "horror": Preset(
        key="horror",
        title="Крипи-истории",
        audience="аудитория 16+, фанаты крипипаст",
        style=(
            "Атмосферная крипи-история от первого лица. Нагнетание через детали и паузы, "
            "без крови и жести, финал оставляет мурашки."
        ),
        visual_style=(
            "dark cinematic photograph, night scene, fog, cold blue and green tones, "
            "eerie atmosphere, film grain, no text, no watermark"
        ),
        voice="Enceladus",
        made_for_kids=False,
        topic_seed="жуткие истории о ночных сменах, заброшенных местах, странных соседях",
    ),
}

DEFAULT_PRESET = "ai_stories"

VOICES = [
    "Zephyr", "Puck", "Charon", "Kore", "Fenrir", "Leda", "Orus", "Aoede",
    "Callirrhoe", "Autonoe", "Enceladus", "Iapetus", "Umbriel", "Algieba",
    "Despina", "Erinome", "Algenib", "Rasalgethi", "Laomedeia", "Achernar",
    "Alnilam", "Schedar", "Gacrux", "Pulcherrima", "Achird", "Zubenelgenubi",
    "Vindemiatrix", "Sadachbia", "Sadaltager", "Sulafat",
]


def get_preset(key: str) -> Preset:
    return PRESETS.get(key, PRESETS[DEFAULT_PRESET])


SCRIPT_SYSTEM = (
    "Ты сценарист вирусных коротких видео для YouTube. "
    "Ты пишешь сценарии, которые удерживают зрителя до последней секунды. "
    "Ты всегда возвращаешь только валидный JSON без пояснений."
)


def script_prompt(
    preset: Preset,
    topic: str,
    scenes_count: int,
    scene_seconds: float,
    language: str,
    orientation: str,
) -> str:
    words_per_scene = int(scene_seconds * 2.4)
    total_seconds = int(scenes_count * scene_seconds)
    return f"""Напиши сценарий вертикального видео для YouTube {"Shorts" if orientation == "vertical" else ""}.

ТЕМА: {topic}
ФОРМАТ: {preset.title}
АУДИТОРИЯ: {preset.audience}
СТИЛЬ: {preset.style}
ЯЗЫК ОЗВУЧКИ И МЕТАДАННЫХ: {language}
ДЛИТЕЛЬНОСТЬ: около {total_seconds} секунд, ровно {scenes_count} сцен.

ТРЕБОВАНИЯ К СЦЕНАМ:
- В каждой сцене поле narration - это текст диктора на языке {language}, примерно {words_per_scene} слов
  (это критично: сцена звучит около {scene_seconds:.0f} секунд).
- narration - это только произносимый текст. Без ремарок, без имён спикеров, без эмодзи, без markdown.
- Поле visual_prompt - подробное описание кадра НА АНГЛИЙСКОМ языке для генератора изображений/видео.
  Описывай конкретную сцену: кто, что делает, где, какой свет, ракурс, эмоция.
  Обязательно добавляй стилевые слова: {preset.visual_style}.
  Никакого текста и надписей в кадре.
- Поле caption - 2-5 слов крупным планом на языке {language} (подпись на экране), может быть пустым.
- Сцены должны связно продолжать друг друга и складываться в одну историю.

МЕТАДАННЫЕ ДЛЯ YOUTUBE:
- title: до 80 символов, цепляющий, без кликбейта-обмана, на языке {language}.
- description: 2-4 предложения на языке {language}, в конце 3-5 хештегов.
- tags: 8-15 ключевых слов на языке {language} без решёток.
- thumbnail_prompt: описание обложки НА АНГЛИЙСКОМ, один яркий кадр.

Верни JSON строго по схеме."""


TOPIC_PROMPT = """Придумай {count} свежих идей для коротких видео на YouTube.
Направление: {seed}
Язык: {language}

Каждая идея - одна строка, конкретная тема для отдельного видео, 4-10 слов.
Идеи должны быть разными между собой и цеплять с первого взгляда.
Верни JSON-массив строк."""
