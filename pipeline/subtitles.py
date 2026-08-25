from __future__ import annotations

import re
from pathlib import Path

SENTENCE_SPLIT = re.compile(r"(?<=[.!?…])\s+")


def _timestamp(seconds: float) -> str:
    seconds = max(seconds, 0.0)
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    rest = seconds % 60
    return f"{hours}:{minutes:02d}:{rest:05.2f}"


def _clean(text: str) -> str:
    return text.replace("{", "(").replace("}", ")").replace("\n", " ").strip()


def split_lines(text: str, max_chars: int) -> list[str]:
    chunks: list[str] = []
    for sentence in SENTENCE_SPLIT.split(_clean(text)):
        sentence = sentence.strip()
        if not sentence:
            continue
        if len(sentence) <= max_chars:
            chunks.append(sentence)
            continue
        current = ""
        for word in sentence.split():
            candidate = f"{current} {word}".strip()
            if len(candidate) > max_chars and current:
                chunks.append(current)
                current = word
            else:
                current = candidate
        if current:
            chunks.append(current)
    return chunks or [_clean(text)]


def build_ass(
    scenes: list[dict],
    size: tuple[int, int],
    out_path: Path,
    font: str = "Arial",
) -> Path:
    width, height = size
    vertical = height > width
    font_size = int(height * (0.042 if vertical else 0.055))
    margin_v = int(height * (0.20 if vertical else 0.08))
    outline = max(2, int(font_size * 0.09))
    max_chars = 26 if vertical else 46

    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {width}
PlayResY: {height}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Main,{font},{font_size},&H00FFFFFF,&H00FFFFFF,&H00101010,&H80000000,-1,0,0,0,100,100,0,0,1,{outline},2,2,60,60,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    events: list[str] = []
    for scene in scenes:
        start = float(scene["start"])
        duration = float(scene["duration"])
        lines = split_lines(scene["narration"], max_chars)
        total_chars = sum(len(line) for line in lines) or 1
        cursor = start
        for line in lines:
            share = duration * (len(line) / total_chars)
            end = cursor + share
            events.append(
                f"Dialogue: 0,{_timestamp(cursor)},{_timestamp(end)},Main,,0,0,0,,{line}"
            )
            cursor = end

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(header + "\n".join(events) + "\n", encoding="utf-8")
    return out_path
