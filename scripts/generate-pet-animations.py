#!/usr/bin/env python3
"""Generate additional Nervy desktop-pet sprite rows and shareable interaction GIFs.

The desktop sprite rows stay deterministic for app-state rendering. Shareable interaction
GIFs are built from an independent generated PNG image pack instead of cropping the
existing spritesheet, so chat assets have their own source artwork.
"""
from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Callable

from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SRC_SHEET = ROOT / "src/assets/pets/nervy-sci-fi-kid/spritesheet.webp"
SRC_IMAGE_DIR = ROOT / "src/assets/pets/nervy-sci-fi-kid/images/source"
SRC_FRAME_DIR = ROOT / "src/assets/pets/nervy-sci-fi-kid/images/frames"
FINAL_SHEET = ROOT / "output/hatch-pet/nervy/final/spritesheet.webp"
PREVIEW_DIR = ROOT / "output/hatch-pet/nervy/qa/previews"
INTERACTION_DIR = ROOT / "output/hatch-pet/nervy/qa/interactions"
SRC_GIF_DIR = ROOT / "src/assets/pets/nervy-sci-fi-kid/gifs"
MANIFEST_PATH = ROOT / "output/hatch-pet/nervy/qa/animation-manifest.json"
CONTACT_SHEET_PATH = ROOT / "output/hatch-pet/nervy/qa/contact-sheet.png"
LEGACY_CONTACT_SHEET_PATH = ROOT / "output/hatch-pet/nervy/qa/new-animation-contact-sheet.png"

FRAME_W = 192
FRAME_H = 208
COLS = 8
BASE_ROWS = 9
BASE_HEIGHT = BASE_ROWS * FRAME_H
SPRITE_WIDTH = FRAME_W * COLS

# Existing rows in renderer.js. Kept here so preview regeneration remains complete.
EXISTING_ANIMATIONS = {
    "idle": {"row": 0, "frames": 6, "frameMs": 180, "label": "Idle"},
    "running-right": {"row": 1, "frames": 8, "frameMs": 90, "label": "Run Right"},
    "running-left": {"row": 2, "frames": 8, "frameMs": 90, "label": "Run Left"},
    "waving": {"row": 3, "frames": 4, "frameMs": 150, "label": "Wave"},
    "jumping": {"row": 4, "frames": 5, "frameMs": 120, "label": "Jump"},
    "failed": {"row": 5, "frames": 8, "frameMs": 170, "label": "Oops"},
    "waiting": {"row": 6, "frames": 6, "frameMs": 220, "label": "Wait"},
    "running": {"row": 7, "frames": 6, "frameMs": 110, "label": "Run"},
    "review": {"row": 8, "frames": 6, "frameMs": 160, "label": "Review"},
}

NEW_ANIMATIONS = {
    "sleep": {"row": 9, "frames": 6, "frameMs": 220, "label": "Rest / Sleep", "source": "rest/touch/low-energy"},
    "eat": {"row": 10, "frames": 6, "frameMs": 140, "label": "Feed / Energy", "source": "feed action"},
    "pat": {"row": 11, "frames": 6, "frameMs": 130, "label": "Pat / Trust", "source": "clean/touch action"},
    "dance": {"row": 12, "frames": 8, "frameMs": 105, "label": "Play / Dance", "source": "play/bright action"},
    "celebrate": {"row": 13, "frames": 8, "frameMs": 95, "label": "Task Complete", "source": "clear/review success"},
    "focus": {"row": 14, "frames": 8, "frameMs": 120, "label": "Focus / Study", "source": "work/study/tasks"},
    "sparkle": {"row": 15, "frames": 6, "frameMs": 115, "label": "Happy Sparkle", "source": "happy/high mood"},
    "stretch": {"row": 16, "frames": 6, "frameMs": 150, "label": "Idle Stretch", "source": "ambient idle"},
    "hydrate": {"row": 17, "frames": 6, "frameMs": 135, "label": "Hydrate / Water", "source": "short break energy care"},
    "meditate": {"row": 18, "frames": 6, "frameMs": 190, "label": "Calm / Breathe", "source": "calm reset"},
    "read": {"row": 19, "frames": 6, "frameMs": 150, "label": "Read / Review", "source": "review surface"},
    "cheer": {"row": 20, "frames": 8, "frameMs": 90, "label": "Cheer / Success", "source": "milestone success"},
    "morning": {"row": 21, "frames": 6, "frameMs": 140, "label": "Morning Wave", "source": "morning greeting"},
    "hug": {"row": 22, "frames": 6, "frameMs": 155, "label": "Hug / Comfort", "source": "comfort reassurance"},
    "surprise": {"row": 23, "frames": 6, "frameMs": 130, "label": "Surprise", "source": "unexpected alert"},
    "cry": {"row": 24, "frames": 6, "frameMs": 170, "label": "Cry / Sad", "source": "low mood"},
    "angry": {"row": 25, "frames": 6, "frameMs": 150, "label": "Angry / Pout", "source": "frustration"},
    "busy": {"row": 26, "frames": 6, "frameMs": 125, "label": "Busy / Work", "source": "workload"},
    "ok": {"row": 27, "frames": 6, "frameMs": 120, "label": "OK / Ready", "source": "confirmation"},
    "love": {"row": 28, "frames": 6, "frameMs": 135, "label": "Miss You", "source": "warm social"},
    "call": {"row": 29, "frames": 6, "frameMs": 130, "label": "Phone Call", "source": "chat call"},
}

INTERACTION_GIFS = {
    "tap-heart.gif": ["pat", "sparkle"],
    "feed-loop.gif": ["eat"],
    "focus-mode.gif": ["focus"],
    "play-dance.gif": ["dance"],
    "rest-sleep.gif": ["sleep"],
    "celebrate-finish.gif": ["celebrate", "sparkle"],
    "sparkle-happy.gif": ["sparkle"],
    "stretch-break.gif": ["stretch"],
    "hydrate-water.gif": ["hydrate"],
    "meditate-calm.gif": ["meditate"],
    "read-review.gif": ["read"],
    "cheer-success.gif": ["cheer"],
    "nervy-interactions-demo.gif": ["pat", "eat", "hydrate", "focus", "read", "meditate", "dance", "sleep", "cheer"],
}

IMAGE_PACK_SOURCES = {
    "idle-standing.png": {"label": "陪伴待机", "prompt": "full-body idle standing"},
    "run-right.png": {"label": "跟着移动", "prompt": "full-body running right"},
    "wave-morning.png": {"label": "早安挥手", "prompt": "good morning wave"},
    "jump-happy.png": {"label": "开心跳起", "prompt": "happy jump"},
    "cry-sad.png": {"label": "哭哭低落", "prompt": "sad crying"},
    "waiting-question.png": {"label": "等你回应", "prompt": "curious waiting"},
    "busy-laptop.png": {"label": "忙碌工作", "prompt": "busy laptop work"},
    "review-read.png": {"label": "复盘阅读", "prompt": "review reading"},
    "hydrate-water.png": {"label": "补水一下", "prompt": "hydration break"},
    "focus-mode.png": {"label": "一起专注", "prompt": "deep work with tablet"},
    "feed-loop.png": {"label": "喂食补能量", "prompt": "energy snack"},
    "meditate-calm.png": {"label": "安静呼吸", "prompt": "calm meditation"},
    "celebrate-finish.png": {"label": "完成庆祝", "prompt": "success celebration"},
    "rest-sleep.png": {"label": "晚安休息", "prompt": "sleepy rest"},
    "play-dance.png": {"label": "开心跳舞", "prompt": "playful dance"},
    "cheer-success.png": {"label": "加油好棒", "prompt": "supportive thumbs up"},
    "hug-comfort.png": {"label": "抱抱安慰", "prompt": "comfort hug"},
    "surprise-alert.png": {"label": "惊讶一下", "prompt": "surprised expression"},
    "angry-pout.png": {"label": "生气鼓脸", "prompt": "angry pout"},
    "love-miss.png": {"label": "想你爱心", "prompt": "miss you heart eyes"},
    "ok-ready.png": {"label": "OK 准备好", "prompt": "ok hand sign"},
    "stretch-break.png": {"label": "伸展放松", "prompt": "stretch break"},
    "sparkle-happy.png": {"label": "哈哈开心", "prompt": "happy laugh"},
    "phone-call.png": {"label": "通话陪伴", "prompt": "phone call"},
}

IMAGE_PACK_IDENTITY = {
    "identity": "elys-short-haired-sweater-girl",
    "generatedFromReference": True,
    "characterReference": "src/assets/pets/nervy-sci-fi-kid/reference/elys-sticker-reference.jpg",
    "fullBody": True,
    "identityTraits": [
        "short black bob hair",
        "cream knit sweater",
        "light cream rubber clogs with visible round holes",
        "warm sticker girl face",
        "white sticker outline",
    ],
    "avoidIdentity": [
        "star-core robot",
        "robot mascot",
        "animal mascot",
        "round teal glasses",
        "mint hoodie",
        "teal satchel",
        "different person",
    ],
}

INTERACTION_IMAGE_PACK = {
    "tap-heart.gif": {"sources": ["love-miss.png"], "label": "摸摸爱心", "tone": "heart"},
    "feed-loop.gif": {"sources": ["feed-loop.png"], "label": "喂食补能量", "tone": "feed"},
    "focus-mode.gif": {"sources": ["focus-mode.png"], "label": "一起专注", "tone": "focus"},
    "play-dance.gif": {"sources": ["play-dance.png"], "label": "开心跳舞", "tone": "dance"},
    "rest-sleep.gif": {"sources": ["rest-sleep.png"], "label": "安静休息", "tone": "sleep"},
    "celebrate-finish.gif": {"sources": ["celebrate-finish.png"], "label": "完成庆祝", "tone": "celebrate"},
    "sparkle-happy.gif": {"sources": ["sparkle-happy.png"], "label": "哈哈开心", "tone": "sparkle"},
    "stretch-break.gif": {"sources": ["stretch-break.png"], "label": "伸展放松", "tone": "stretch"},
    "hydrate-water.gif": {"sources": ["hydrate-water.png"], "label": "补水一下", "tone": "hydrate"},
    "meditate-calm.gif": {"sources": ["meditate-calm.png"], "label": "安静呼吸", "tone": "meditate"},
    "read-review.gif": {"sources": ["review-read.png"], "label": "复盘阅读", "tone": "read"},
    "cheer-success.gif": {"sources": ["cheer-success.png"], "label": "加油好棒", "tone": "cheer"},
    "morning-wave.gif": {"sources": ["wave-morning.png"], "label": "早安挥手", "tone": "morning"},
    "hug-comfort.gif": {"sources": ["hug-comfort.png"], "label": "抱抱安慰", "tone": "hug"},
    "surprise-alert.gif": {"sources": ["surprise-alert.png"], "label": "惊讶一下", "tone": "surprise"},
    "cry-sad.gif": {"sources": ["cry-sad.png"], "label": "哭哭低落", "tone": "cry"},
    "angry-pout.gif": {"sources": ["angry-pout.png"], "label": "生气鼓脸", "tone": "angry"},
    "busy-laptop.gif": {"sources": ["busy-laptop.png"], "label": "忙碌工作", "tone": "busy"},
    "ok-ready.gif": {"sources": ["ok-ready.png"], "label": "OK 准备好", "tone": "ok"},
    "love-miss.gif": {"sources": ["love-miss.png"], "label": "想你爱心", "tone": "love"},
    "phone-call.gif": {"sources": ["phone-call.png"], "label": "通话陪伴", "tone": "call"},
    "full-body-states-demo.gif": {
        "sources": [
            "idle-standing.png",
            "wave-morning.png",
            "cry-sad.png",
            "hug-comfort.png",
            "surprise-alert.png",
            "angry-pout.png",
            "love-miss.png",
            "ok-ready.png",
            "busy-laptop.png",
            "focus-mode.png",
            "hydrate-water.png",
            "feed-loop.png",
            "celebrate-finish.png",
            "play-dance.png",
            "rest-sleep.png",
            "phone-call.png",
        ],
        "label": "全身状态合集",
        "tone": "demo",
    },
}

SPRITE_ANIMATION_SOURCES = {
    "idle": {"source": "idle-standing.png", "tone": "idle"},
    "running-right": {"source": "run-right.png", "tone": "run"},
    "running-left": {"source": "run-right.png", "tone": "run", "mirror": True},
    "waving": {"source": "wave-morning.png", "tone": "morning"},
    "jumping": {"source": "jump-happy.png", "tone": "jump"},
    "failed": {"source": "cry-sad.png", "tone": "cry"},
    "waiting": {"source": "waiting-question.png", "tone": "waiting"},
    "running": {"source": "busy-laptop.png", "tone": "busy"},
    "review": {"source": "review-read.png", "tone": "read"},
    "sleep": {"source": "rest-sleep.png", "tone": "sleep"},
    "eat": {"source": "feed-loop.png", "tone": "feed"},
    "pat": {"source": "hug-comfort.png", "tone": "hug"},
    "dance": {"source": "play-dance.png", "tone": "dance"},
    "celebrate": {"source": "celebrate-finish.png", "tone": "celebrate"},
    "focus": {"source": "focus-mode.png", "tone": "focus"},
    "sparkle": {"source": "sparkle-happy.png", "tone": "sparkle"},
    "stretch": {"source": "stretch-break.png", "tone": "stretch"},
    "hydrate": {"source": "hydrate-water.png", "tone": "hydrate"},
    "meditate": {"source": "meditate-calm.png", "tone": "meditate"},
    "read": {"source": "review-read.png", "tone": "read"},
    "cheer": {"source": "cheer-success.png", "tone": "cheer"},
    "morning": {"source": "wave-morning.png", "tone": "morning"},
    "hug": {"source": "hug-comfort.png", "tone": "hug"},
    "surprise": {"source": "surprise-alert.png", "tone": "surprise"},
    "cry": {"source": "cry-sad.png", "tone": "cry"},
    "angry": {"source": "angry-pout.png", "tone": "angry"},
    "busy": {"source": "busy-laptop.png", "tone": "busy"},
    "ok": {"source": "ok-ready.png", "tone": "ok"},
    "love": {"source": "love-miss.png", "tone": "love"},
    "call": {"source": "phone-call.png", "tone": "call"},
}


def font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    candidates = [
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial Unicode.ttf",
    ]
    for candidate in candidates:
        if candidate and Path(candidate).exists():
            try:
                return ImageFont.truetype(candidate, size=size, index=0)
            except Exception:
                continue
    return ImageFont.load_default()


FONT_SMALL = font(12)
FONT_LABEL = font(15, bold=True)
FONT_BIG = font(22, bold=True)


def load_base_sheet() -> Image.Image:
    source = FINAL_SHEET if FINAL_SHEET.exists() else SRC_SHEET
    sheet = Image.open(source).convert("RGBA")
    if sheet.width != SPRITE_WIDTH or sheet.height < BASE_HEIGHT:
        raise ValueError(f"Unexpected spritesheet size: {sheet.size}")
    return sheet.crop((0, 0, SPRITE_WIDTH, BASE_HEIGHT))


def crop_frame(sheet: Image.Image, row: int, frame: int) -> Image.Image:
    x = (frame % COLS) * FRAME_W
    y = row * FRAME_H
    return sheet.crop((x, y, x + FRAME_W, y + FRAME_H)).convert("RGBA")


def paste_centered(canvas: Image.Image, sprite: Image.Image, *, dx: int = 0, dy: int = 0, scale: float = 1.0, rotate: float = 0.0, alpha: float = 1.0) -> None:
    work = sprite
    if scale != 1.0:
        work = work.resize((max(1, round(work.width * scale)), max(1, round(work.height * scale))), Image.Resampling.LANCZOS)
    if rotate:
        work = work.rotate(rotate, resample=Image.Resampling.BICUBIC, expand=True)
    if alpha < 1.0:
        a = work.getchannel("A").point(lambda value: int(value * alpha))
        work.putalpha(a)
    x = round((FRAME_W - work.width) / 2 + dx)
    y = round((FRAME_H - work.height) / 2 + dy)
    canvas.alpha_composite(work, (x, y))


def draw_shadow(canvas: Image.Image, *, width: int = 86, y: int = 176, alpha: int = 32) -> None:
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(shadow)
    d.ellipse((FRAME_W / 2 - width / 2, y, FRAME_W / 2 + width / 2, y + 14), fill=(41, 55, 92, alpha))
    canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(3)))


def draw_sparkle(draw: ImageDraw.ImageDraw, x: int, y: int, r: int, color=(91, 140, 255, 210)) -> None:
    draw.line((x - r, y, x + r, y), fill=color, width=2)
    draw.line((x, y - r, x, y + r), fill=color, width=2)
    draw.line((x - r // 2, y - r // 2, x + r // 2, y + r // 2), fill=color, width=1)
    draw.line((x - r // 2, y + r // 2, x + r // 2, y - r // 2), fill=color, width=1)


def draw_heart(draw: ImageDraw.ImageDraw, x: int, y: int, size: int, color=(255, 118, 172, 220)) -> None:
    r = size // 2
    draw.ellipse((x, y, x + r, y + r), fill=color)
    draw.ellipse((x + r, y, x + size, y + r), fill=color)
    draw.polygon([(x - 1, y + r // 2), (x + size + 1, y + r // 2), (x + size // 2, y + size + 2)], fill=color)


def draw_food(draw: ImageDraw.ImageDraw, frame: int) -> None:
    bowl_y = 164 + (frame % 2)
    draw.rounded_rectangle((126, bowl_y, 173, bowl_y + 18), radius=8, fill=(255, 246, 220, 235), outline=(231, 172, 72, 180), width=2)
    draw.arc((124, bowl_y - 9, 175, bowl_y + 15), 0, 180, fill=(231, 172, 72, 190), width=2)
    for i in range(4):
        cx = 134 + i * 9
        cy = bowl_y - 2 - ((frame + i) % 3)
        draw.ellipse((cx, cy, cx + 7, cy + 7), fill=(255, 183, 79, 230))
    draw.line((118, 145, 124, 163), fill=(34, 197, 94, 185), width=3)
    draw.ellipse((111, 137, 123, 148), fill=(87, 203, 117, 190))


def draw_sleep(draw: ImageDraw.ImageDraw, frame: int) -> None:
    wobble = math.sin(frame / 6 * math.tau)
    zs = [(126, 47, 18), (145, 30, 13), (160, 18, 10)]
    for idx, (x, y, size) in enumerate(zs):
        off = round(wobble * (3 + idx)) - frame // 3
        draw.text((x + off, y - frame * 2 + idx * 2), "Z", fill=(91, 140, 255, 180 - idx * 35), font=font(size, True))
    draw.arc((70, 120, 121, 155), 0, 180, fill=(139, 124, 246, 150), width=3)


def draw_eat(draw: ImageDraw.ImageDraw, frame: int) -> None:
    draw_food(draw, frame)
    if frame % 2 == 0:
        draw.ellipse((113, 131, 121, 139), fill=(255, 183, 79, 220))
    draw.text((119, 39 - (frame % 3)), "+", fill=(34, 197, 94, 210), font=FONT_BIG)
    draw_sparkle(draw, 139, 52 - (frame % 2), 6, (34, 197, 94, 190))


def draw_pat(draw: ImageDraw.ImageDraw, frame: int) -> None:
    hand_x = 86 + round(math.sin(frame / 6 * math.tau) * 8)
    hand_y = 35 + (frame % 2)
    draw.rounded_rectangle((hand_x, hand_y, hand_x + 34, hand_y + 18), radius=8, fill=(255, 220, 184, 230), outline=(230, 177, 123, 180), width=2)
    for i in range(4):
        draw.line((hand_x + 6 + i * 7, hand_y + 3, hand_x + 5 + i * 7, hand_y - 8), fill=(255, 220, 184, 230), width=4)
    draw.arc((76, 54, 126, 86), 200, 330, fill=(255, 139, 199, 170), width=3)
    draw_heart(draw, 130 + frame % 2, 50 - (frame % 3), 15)


def draw_dance(draw: ImageDraw.ImageDraw, frame: int) -> None:
    colors = [(91, 140, 255, 210), (255, 139, 199, 210), (34, 197, 94, 210)]
    for i, note in enumerate(["♪", "♫", "♪"]):
        x = 34 + i * 50 + round(math.sin((frame + i) / 8 * math.tau) * 5)
        y = 35 + (i % 2) * 18 - round(math.cos((frame + i) / 8 * math.tau) * 4)
        draw.text((x, y), note, fill=colors[i], font=font(22, True))
    draw_sparkle(draw, 156, 79 + (frame % 3), 7, (234, 179, 8, 190))


def draw_celebrate(draw: ImageDraw.ImageDraw, frame: int) -> None:
    confetti = [(32, 34), (54, 64), (142, 38), (162, 75), (92, 30), (125, 64), (24, 90), (170, 111)]
    palette = [(91, 140, 255, 230), (255, 139, 199, 230), (34, 197, 94, 230), (234, 179, 8, 230)]
    for i, (x, y) in enumerate(confetti):
        drop = (frame * (3 + i % 3) + i * 7) % 72
        color = palette[(frame + i) % len(palette)]
        draw.rounded_rectangle((x, y + drop, x + 7, y + drop + 3), radius=1, fill=color)
    draw.text((133, 42), "✓", fill=(34, 197, 94, 230), font=font(26, True))
    draw_sparkle(draw, 50, 39 + frame % 2, 8, (234, 179, 8, 210))


def draw_focus(draw: ImageDraw.ImageDraw, frame: int) -> None:
    y = 153 + (frame % 2)
    draw.rounded_rectangle((118, y, 176, y + 28), radius=6, fill=(237, 243, 255, 236), outline=(91, 140, 255, 180), width=2)
    draw.rectangle((124, y + 7, 170, y + 21), fill=(31, 42, 68, 230))
    cursor_x = 132 + (frame * 5) % 30
    draw.rectangle((cursor_x, y + 10, cursor_x + 3, y + 18), fill=(91, 140, 255, 255))
    draw.rounded_rectangle((111, y + 28, 183, y + 34), radius=5, fill=(182, 196, 224, 210))
    draw.arc((47, 55, 160, 143), 198, 335, fill=(91, 140, 255, 110), width=3)
    draw_sparkle(draw, 148, 62, 6, (91, 140, 255, 190))


def draw_sparkles(draw: ImageDraw.ImageDraw, frame: int) -> None:
    points = [(43, 50), (137, 44), (159, 89), (49, 116), (124, 132)]
    for i, (x, y) in enumerate(points):
        pulse = 5 + ((frame + i) % 3) * 2
        color = [(91, 140, 255, 205), (255, 139, 199, 205), (34, 197, 94, 205)][i % 3]
        draw_sparkle(draw, x, y + round(math.sin((frame + i) / 6 * math.tau) * 3), pulse, color)
    draw_heart(draw, 123, 59 - (frame % 2), 13, (255, 139, 199, 190))


def draw_stretch(draw: ImageDraw.ImageDraw, frame: int) -> None:
    draw.arc((39, 80, 74, 125), 230, 330, fill=(91, 140, 255, 130), width=3)
    draw.arc((121, 80, 160, 126), 210, 310, fill=(91, 140, 255, 130), width=3)
    draw.text((139, 46), "~", fill=(139, 124, 246, 180), font=font(26, True))


def draw_hydrate(draw: ImageDraw.ImageDraw, frame: int) -> None:
    y = 137 + (frame % 2)
    draw.rounded_rectangle((125, y, 154, y + 43), radius=9, fill=(225, 245, 255, 238), outline=(57, 150, 210, 185), width=2)
    draw.rounded_rectangle((132, y - 8, 147, y + 3), radius=4, fill=(91, 140, 255, 225))
    water_top = y + 16 - (frame % 3)
    draw.rounded_rectangle((129, water_top, 150, y + 37), radius=6, fill=(84, 190, 242, 160))
    draw.line((117, 134, 125, y + 8), fill=(84, 190, 242, 190), width=3)
    draw_sparkle(draw, 160, 119 + (frame % 2), 6, (84, 190, 242, 180))


def draw_meditate(draw: ImageDraw.ImageDraw, frame: int) -> None:
    pulse = 4 + (frame % 3)
    draw.arc((47 - pulse, 50 - pulse, 151 + pulse, 154 + pulse), 205, 335, fill=(139, 124, 246, 115), width=3)
    draw.arc((61, 62, 139, 143), 200, 340, fill=(34, 197, 94, 105), width=2)
    draw.text((141, 53 - frame % 2), "·", fill=(139, 124, 246, 190), font=font(28, True))
    draw.rounded_rectangle((70, 169, 122, 181), radius=7, fill=(139, 124, 246, 42), outline=(139, 124, 246, 92), width=1)


def draw_read(draw: ImageDraw.ImageDraw, frame: int) -> None:
    y = 148 + (frame % 2)
    draw.polygon([(112, y + 7), (145, y), (145, y + 42), (112, y + 48)], fill=(255, 250, 235, 238), outline=(91, 140, 255, 170))
    draw.polygon([(145, y), (177, y + 7), (177, y + 48), (145, y + 42)], fill=(239, 246, 255, 238), outline=(91, 140, 255, 170))
    draw.line((145, y + 2, 145, y + 42), fill=(91, 140, 255, 160), width=2)
    for i in range(3):
        line_y = y + 15 + i * 8
        draw.line((120, line_y, 139, line_y - 3), fill=(88, 99, 128, 120), width=1)
        draw.line((151, line_y - 2, 170, line_y), fill=(88, 99, 128, 120), width=1)
    draw_sparkle(draw, 111, 133 + frame % 2, 5, (91, 140, 255, 160))


def draw_cheer(draw: ImageDraw.ImageDraw, frame: int) -> None:
    palette = [(91, 140, 255, 230), (255, 139, 199, 230), (34, 197, 94, 230), (234, 179, 8, 230)]
    for i in range(9):
        x = 28 + i * 17
        y = 24 + ((frame * (2 + i % 3) + i * 11) % 86)
        color = palette[(frame + i) % len(palette)]
        draw.rounded_rectangle((x, y, x + 8, y + 4), radius=1, fill=color)
    draw_heart(draw, 132, 49 - (frame % 3), 15, (255, 139, 199, 210))
    draw_sparkle(draw, 54, 48 + (frame % 2), 8, (234, 179, 8, 210))
    draw.text((143, 74), "✓", fill=(34, 197, 94, 225), font=font(22, True))


def build_row(base_sheet: Image.Image, name: str, config: dict) -> Image.Image:
    row = Image.new("RGBA", (SPRITE_WIDTH, FRAME_H), (0, 0, 0, 0))
    frames = int(config["frames"])
    for frame in range(COLS):
        canvas = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
        draw_shadow(canvas)
        t = frame / max(1, frames)
        cycle = frame % frames
        if name == "sleep":
            base = crop_frame(base_sheet, EXISTING_ANIMATIONS["waiting"]["row"], cycle % 6)
            paste_centered(canvas, base, dx=-5 + (cycle % 2), dy=7 + (cycle % 2), scale=0.98, rotate=-6 + math.sin(t * math.tau) * 2, alpha=0.94)
            d = ImageDraw.Draw(canvas)
            draw_sleep(d, cycle)
        elif name == "eat":
            base = crop_frame(base_sheet, EXISTING_ANIMATIONS["waving"]["row"], cycle % 4)
            paste_centered(canvas, base, dx=-4, dy=-2 + (cycle % 2), scale=1.0, rotate=math.sin(t * math.tau) * 2)
            d = ImageDraw.Draw(canvas)
            draw_eat(d, cycle)
        elif name == "pat":
            base = crop_frame(base_sheet, EXISTING_ANIMATIONS["idle"]["row"], cycle % 6)
            paste_centered(canvas, base, dx=0, dy=1 + (cycle % 2), scale=1.0, rotate=math.sin(t * math.tau) * 3)
            d = ImageDraw.Draw(canvas)
            draw_pat(d, cycle)
        elif name == "dance":
            source = "jumping" if cycle % 2 else "running"
            base = crop_frame(base_sheet, EXISTING_ANIMATIONS[source]["row"], cycle % EXISTING_ANIMATIONS[source]["frames"])
            paste_centered(canvas, base, dx=round(math.sin(t * math.tau) * 8), dy=-5 + abs(round(math.sin(t * math.tau) * 5)), scale=1.0, rotate=math.sin(t * math.tau) * 8)
            d = ImageDraw.Draw(canvas)
            draw_dance(d, cycle)
        elif name == "celebrate":
            source = "jumping" if cycle % 2 else "waving"
            base = crop_frame(base_sheet, EXISTING_ANIMATIONS[source]["row"], cycle % EXISTING_ANIMATIONS[source]["frames"])
            paste_centered(canvas, base, dx=round(math.sin(t * math.tau) * 5), dy=-7 + (cycle % 2), scale=1.02, rotate=math.sin(t * math.tau) * 5)
            d = ImageDraw.Draw(canvas)
            draw_celebrate(d, cycle)
        elif name == "focus":
            base = crop_frame(base_sheet, EXISTING_ANIMATIONS["review"]["row"], cycle % 6)
            paste_centered(canvas, base, dx=-5, dy=-1 + (cycle % 2), scale=0.99, rotate=math.sin(t * math.tau) * 1.4)
            d = ImageDraw.Draw(canvas)
            draw_focus(d, cycle)
        elif name == "sparkle":
            base = crop_frame(base_sheet, EXISTING_ANIMATIONS["waving"]["row"], cycle % 4)
            paste_centered(canvas, base, dx=0, dy=-4 + (cycle % 2), scale=1.01, rotate=math.sin(t * math.tau) * 4)
            d = ImageDraw.Draw(canvas)
            draw_sparkles(d, cycle)
        elif name == "stretch":
            base = crop_frame(base_sheet, EXISTING_ANIMATIONS["idle"]["row"], cycle % 6)
            stretch = 1.0 + math.sin(t * math.tau) * 0.035
            paste_centered(canvas, base, dx=0, dy=-round((stretch - 1) * 38), scale=stretch, rotate=math.sin(t * math.tau) * 2)
            d = ImageDraw.Draw(canvas)
            draw_stretch(d, cycle)
        elif name == "hydrate":
            base = crop_frame(base_sheet, EXISTING_ANIMATIONS["idle"]["row"], cycle % 6)
            paste_centered(canvas, base, dx=-5, dy=-1 + (cycle % 2), scale=1.0, rotate=math.sin(t * math.tau) * 2)
            d = ImageDraw.Draw(canvas)
            draw_hydrate(d, cycle)
        elif name == "meditate":
            base = crop_frame(base_sheet, EXISTING_ANIMATIONS["waiting"]["row"], cycle % 6)
            paste_centered(canvas, base, dx=0, dy=3 + (cycle % 2), scale=0.98, rotate=math.sin(t * math.tau) * 1.2, alpha=0.96)
            d = ImageDraw.Draw(canvas)
            draw_meditate(d, cycle)
        elif name == "read":
            base = crop_frame(base_sheet, EXISTING_ANIMATIONS["review"]["row"], cycle % 6)
            paste_centered(canvas, base, dx=-8, dy=-1 + (cycle % 2), scale=0.99, rotate=math.sin(t * math.tau) * 1.5)
            d = ImageDraw.Draw(canvas)
            draw_read(d, cycle)
        elif name == "cheer":
            source = "jumping" if cycle % 2 else "waving"
            base = crop_frame(base_sheet, EXISTING_ANIMATIONS[source]["row"], cycle % EXISTING_ANIMATIONS[source]["frames"])
            paste_centered(canvas, base, dx=round(math.sin(t * math.tau) * 6), dy=-8 + (cycle % 2), scale=1.03, rotate=math.sin(t * math.tau) * 6)
            d = ImageDraw.Draw(canvas)
            draw_cheer(d, cycle)
        else:
            paste_centered(canvas, crop_frame(base_sheet, 0, cycle % 6))
        row.alpha_composite(canvas, (frame * FRAME_W, 0))
    return row


def source_animation_frame(
    sources: dict[str, Image.Image],
    name: str,
    frame: int,
    config: dict,
) -> Image.Image:
    spec = SPRITE_ANIMATION_SOURCES.get(name, {"source": "idle-standing.png", "tone": "idle"})
    sprite = fit_image_pack_sprite(sources[spec["source"]], max_w=154, max_h=190)
    if spec.get("mirror"):
        sprite = ImageOps.mirror(sprite)
    work, dx, dy = transformed_sprite(sprite, frame, spec["tone"])
    canvas = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
    x = round((FRAME_W - work.width) / 2 + dx)
    y = round((FRAME_H - work.height) / 2 + dy)
    canvas.alpha_composite(work, (x, y))
    return canvas


def build_source_row(sources: dict[str, Image.Image], name: str, config: dict) -> Image.Image:
    row = Image.new("RGBA", (SPRITE_WIDTH, FRAME_H), (0, 0, 0, 0))
    frames = int(config["frames"])
    for frame in range(COLS):
        canvas = source_animation_frame(sources, name, frame % frames, config)
        row.alpha_composite(canvas, (frame * FRAME_W, 0))
    return row


def save_animation_gif(sheet: Image.Image, name: str, config: dict, path: Path, *, label: str | None = None, badge: str | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    frame_count = int(config["frames"])
    duration = int(config["frameMs"])
    images = []
    for i in range(frame_count):
        sprite = crop_frame(sheet, int(config["row"]), i)
        if label or badge:
            canvas = Image.new("RGBA", (240, 260), (255, 255, 255, 0))
            bg = Image.new("RGBA", canvas.size, (255, 255, 255, 0))
            bd = ImageDraw.Draw(bg)
            bd.rounded_rectangle((10, 8, 230, 252), radius=30, fill=(255, 255, 255, 232), outline=(91, 140, 255, 42), width=2)
            bd.rounded_rectangle((24, 18, 216, 52), radius=16, fill=(245, 247, 251, 230))
            if label:
                bd.text((34, 27), label, fill=(35, 48, 75, 230), font=FONT_LABEL)
            if badge:
                bd.rounded_rectangle((158, 24, 206, 46), radius=10, fill=(91, 140, 255, 32))
                bd.text((168, 29), badge, fill=(91, 140, 255, 230), font=FONT_SMALL)
            canvas.alpha_composite(bg)
            canvas.alpha_composite(sprite, (24, 40))
            images.append(canvas.convert("P", palette=Image.Palette.ADAPTIVE, colors=255))
        else:
            images.append(sprite.convert("P", palette=Image.Palette.ADAPTIVE, colors=255))
    images[0].save(path, save_all=True, append_images=images[1:], duration=duration, loop=0, disposal=2, optimize=False)


def save_combined_interaction_gif(sheet: Image.Image, name: str, sequence: list[str], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    frames = []
    labels = {
        "pat": "摸摸互动",
        "eat": "喂食补能",
        "focus": "一起专注",
        "dance": "玩耍跳舞",
        "sleep": "休息回血",
        "celebrate": "完成庆祝",
        "sparkle": "开心闪光",
        "stretch": "伸展放松",
        "hydrate": "补水一下",
        "meditate": "安静呼吸",
        "read": "复盘阅读",
        "cheer": "成功欢呼",
    }
    for action in sequence:
        config = NEW_ANIMATIONS[action]
        for i in range(int(config["frames"])):
            sprite = crop_frame(sheet, int(config["row"]), i)
            canvas = Image.new("RGBA", (280, 280), (255, 255, 255, 0))
            d = ImageDraw.Draw(canvas)
            d.rounded_rectangle((12, 10, 268, 268), radius=34, fill=(255, 255, 255, 235), outline=(91, 140, 255, 48), width=2)
            d.rounded_rectangle((32, 22, 248, 57), radius=18, fill=(239, 246, 255, 230))
            d.text((48, 31), labels.get(action, action), fill=(35, 48, 75, 235), font=FONT_LABEL)
            d.text((204, 33), f"{i+1}/{config['frames']}", fill=(91, 140, 255, 210), font=FONT_SMALL)
            canvas.alpha_composite(sprite.resize((202, 219), Image.Resampling.LANCZOS), (39, 45))
            frames.append(canvas.convert("P", palette=Image.Palette.ADAPTIVE, colors=255))
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=92, loop=0, disposal=2, optimize=False)


def relative(path: Path) -> str:
    return str(path.relative_to(ROOT))


def load_image_pack_sources() -> dict[str, Image.Image]:
    sources: dict[str, Image.Image] = {}
    missing = []
    for file_name in IMAGE_PACK_SOURCES:
        path = SRC_IMAGE_DIR / file_name
        if not path.exists():
            missing.append(relative(path))
            continue
        sources[file_name] = Image.open(path).convert("RGBA")
    if missing:
        raise FileNotFoundError(f"Missing generated image-pack sources: {', '.join(missing)}")
    return sources


def crop_visible(image: Image.Image, *, padding: int = 18) -> Image.Image:
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        return image
    left = max(0, bbox[0] - padding)
    top = max(0, bbox[1] - padding)
    right = min(image.width, bbox[2] + padding)
    bottom = min(image.height, bbox[3] + padding)
    return image.crop((left, top, right, bottom))


def fit_image_pack_sprite(image: Image.Image, *, max_w: int = 188, max_h: int = 188) -> Image.Image:
    cropped = crop_visible(image)
    ratio = min(max_w / cropped.width, max_h / cropped.height)
    size = (max(1, round(cropped.width * ratio)), max(1, round(cropped.height * ratio)))
    return cropped.resize(size, Image.Resampling.LANCZOS)


def transformed_sprite(sprite: Image.Image, frame: int, tone: str) -> tuple[Image.Image, int, int]:
    phase = frame / 6 * math.tau
    dy = round(math.sin(phase) * 4)
    dx = 0
    rotate = math.sin(phase) * 2.5
    scale = 1.0
    if tone in {"dance", "cheer", "demo"}:
        dx = round(math.sin(phase) * 8)
        dy = -4 + round(abs(math.sin(phase)) * 6)
        rotate = math.sin(phase) * 8
        scale = 1.02
    elif tone in {"focus", "read"}:
        dx = -3 + round(math.sin(phase) * 2)
        dy = round(math.sin(phase) * 2)
        rotate = math.sin(phase) * 1.4
    elif tone == "busy":
        dx = -2 + round(math.sin(phase) * 2)
        dy = round(math.sin(phase) * 2)
        rotate = math.sin(phase) * 1.1
        scale = 0.99
    elif tone == "run":
        dx = round(math.sin(phase) * 7)
        dy = -2 + round(abs(math.sin(phase)) * 5)
        rotate = math.sin(phase) * 4.5
    elif tone == "jump":
        dy = -8 - round(abs(math.sin(phase)) * 8)
        rotate = math.sin(phase) * 5
        scale = 1.0 + abs(math.sin(phase)) * 0.025
    elif tone in {"morning", "wave", "ok"}:
        dx = round(math.sin(phase) * 3)
        dy = -1 + round(math.sin(phase) * 3)
        rotate = math.sin(phase) * 3.5
    elif tone in {"hug", "cry", "sad"}:
        dy = 2 + round(math.sin(phase) * 2)
        rotate = math.sin(phase) * 1.2
        scale = 0.99
    elif tone in {"surprise", "angry"}:
        dx = round(math.sin(phase * 2) * 2)
        dy = -1 + round(math.sin(phase * 2) * 2)
        rotate = math.sin(phase * 2) * 1.8
    elif tone == "love":
        dy = -2 + round(math.sin(phase) * 3)
        rotate = math.sin(phase) * 3
        scale = 1.0 + math.sin(phase) * 0.018
    elif tone == "call":
        dx = round(math.sin(phase) * 2)
        dy = round(math.sin(phase) * 2)
        rotate = math.sin(phase) * 2.2
    elif tone in {"sleep", "meditate"}:
        dy = 3 + round(math.sin(phase) * 2)
        rotate = math.sin(phase) * 1.2
        scale = 0.98
    elif tone == "stretch":
        scale = 1.0 + math.sin(phase) * 0.035
        dy = -round((scale - 1) * 44)
        rotate = math.sin(phase) * 2.5
    elif tone == "heart":
        dy = -2 + round(math.sin(phase) * 3)
        rotate = math.sin(phase) * 4
    elif tone in {"hydrate", "feed"}:
        dx = round(math.sin(phase) * 3)
        dy = round(math.sin(phase) * 3)
        rotate = math.sin(phase) * 2

    work = sprite
    if scale != 1.0:
        work = work.resize((max(1, round(work.width * scale)), max(1, round(work.height * scale))), Image.Resampling.LANCZOS)
    if rotate:
        work = work.rotate(rotate, resample=Image.Resampling.BICUBIC, expand=True)
    return work, dx, dy


def draw_image_pack_effects(draw: ImageDraw.ImageDraw, frame: int, tone: str) -> None:
    pulse = frame % 3
    if tone in {"heart", "sparkle"}:
        draw_heart(draw, 204, 72 - pulse, 18, (255, 118, 172, 225))
        draw_sparkle(draw, 70, 84 + pulse, 8, (234, 179, 8, 215))
    if tone in {"celebrate", "cheer", "demo"}:
        palette = [(91, 140, 255, 220), (255, 139, 199, 220), (34, 197, 94, 220), (234, 179, 8, 220)]
        for i in range(7):
            x = 50 + i * 27
            y = 72 + ((frame * (3 + i % 2) + i * 9) % 58)
            draw.rounded_rectangle((x, y, x + 9, y + 4), radius=1, fill=palette[(frame + i) % len(palette)])
    if tone == "hydrate":
        draw.line((207, 95, 214, 111), fill=(84, 190, 242, 210), width=3)
        draw_sparkle(draw, 219, 91 + pulse, 7, (84, 190, 242, 190))
    if tone == "feed":
        draw.rounded_rectangle((194, 175, 230, 190), radius=8, fill=(255, 246, 220, 235), outline=(231, 172, 72, 180), width=2)
        draw.ellipse((205, 166 - pulse, 214, 175 - pulse), fill=(255, 183, 79, 225))
    if tone in {"focus", "read"}:
        draw.rounded_rectangle((194, 167, 232, 196), radius=7, fill=(237, 243, 255, 230), outline=(91, 140, 255, 170), width=2)
        draw.rectangle((201, 176, 225, 188), fill=(31, 42, 68, 225))
    if tone == "sleep":
        draw.text((203, 70 - frame), "Z", fill=(91, 140, 255, 175), font=font(21, True))
    if tone == "meditate":
        draw.arc((55 - pulse, 72 - pulse, 226 + pulse, 226 + pulse), 205, 335, fill=(139, 124, 246, 120), width=3)
    if tone == "stretch":
        draw.arc((62, 96, 102, 152), 230, 330, fill=(91, 140, 255, 140), width=3)
        draw.arc((180, 96, 222, 152), 210, 310, fill=(91, 140, 255, 140), width=3)


def image_pack_frame(source: Image.Image, *, label: str, frame: int, tone: str, badge: str) -> Image.Image:
    canvas = Image.new("RGBA", (280, 280), (255, 255, 255, 0))
    d = ImageDraw.Draw(canvas)
    d.rounded_rectangle((12, 10, 268, 268), radius=28, fill=(255, 255, 255, 238), outline=(91, 140, 255, 48), width=2)
    d.rounded_rectangle((32, 22, 248, 57), radius=18, fill=(239, 246, 255, 230))
    d.text((48, 31), label, fill=(35, 48, 75, 235), font=FONT_LABEL)
    d.rounded_rectangle((210, 28, 238, 48), radius=9, fill=(91, 140, 255, 35))
    d.text((216, 32), badge, fill=(91, 140, 255, 230), font=FONT_SMALL)

    sprite = fit_image_pack_sprite(source)
    sprite, dx, dy = transformed_sprite(sprite, frame, tone)
    canvas.alpha_composite(sprite, (round((280 - sprite.width) / 2 + dx), round(61 + (184 - sprite.height) / 2 + dy)))
    draw_image_pack_effects(d, frame, tone)
    return canvas


def save_image_pack_interaction_gif(
    sources: dict[str, Image.Image],
    gif_name: str,
    config: dict,
    path: Path,
) -> dict:
    path.parent.mkdir(parents=True, exist_ok=True)
    key = Path(gif_name).stem
    frame_dir = SRC_FRAME_DIR / key
    if frame_dir.exists():
        for old in frame_dir.glob("*.png"):
            old.unlink()
    frame_dir.mkdir(parents=True, exist_ok=True)

    frames = []
    frame_paths = []
    source_files = config["sources"]
    tone = config["tone"]
    per_source_frames = 4 if len(source_files) > 1 else 6
    for source_index, source_name in enumerate(source_files):
        source = sources[source_name]
        for local_frame in range(per_source_frames):
            frame_number = len(frames) + 1
            frame = image_pack_frame(
                source,
                label=config["label"],
                frame=local_frame + source_index,
                tone=tone,
                badge="IMG",
            )
            frame_path = frame_dir / f"{key}-{frame_number:02d}.png"
            frame.save(frame_path)
            frame_paths.append(relative(frame_path))
            frames.append(frame.convert("P", palette=Image.Palette.ADAPTIVE, colors=255))

    frames[0].save(path, save_all=True, append_images=frames[1:], duration=118, loop=0, disposal=2, optimize=False)
    return {
        "sourceType": "generated-image-pack",
        "usesBaseSpritesheet": False,
        "sourceImages": [relative(SRC_IMAGE_DIR / source_name) for source_name in source_files],
        "frameImages": frame_paths,
    }


def save_contact_sheet(sheet: Image.Image) -> None:
    rows = list({**EXISTING_ANIMATIONS, **NEW_ANIMATIONS}.items())
    margin = 18
    label_w = 160
    preview_scale = 0.42
    thumb_w = round(FRAME_W * preview_scale)
    thumb_h = round(FRAME_H * preview_scale)
    row_h = thumb_h + 24
    contact = Image.new("RGBA", (label_w + COLS * thumb_w + margin * 2, margin * 2 + len(rows) * row_h), (248, 250, 255, 255))
    d = ImageDraw.Draw(contact)
    for idx, (name, config) in enumerate(rows):
        y = margin + idx * row_h
        d.text((margin, y + 18), f"{name}", fill=(24, 32, 51, 235), font=FONT_LABEL)
        d.text((margin, y + 38), config["label"], fill=(82, 96, 128, 220), font=FONT_SMALL)
        for frame in range(COLS):
            sprite = crop_frame(sheet, int(config["row"]), frame).resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
            x = margin + label_w + frame * thumb_w
            contact.alpha_composite(sprite, (x, y))
    CONTACT_SHEET_PATH.parent.mkdir(parents=True, exist_ok=True)
    rendered = contact.convert("RGB")
    rendered.save(CONTACT_SHEET_PATH)
    rendered.save(LEGACY_CONTACT_SHEET_PATH)


def main() -> None:
    image_pack_sources = load_image_pack_sources()
    all_animations = {**EXISTING_ANIMATIONS, **NEW_ANIMATIONS}
    rows = [build_source_row(image_pack_sources, name, config) for name, config in all_animations.items()]
    sheet = Image.new("RGBA", (SPRITE_WIDTH, FRAME_H * len(all_animations)), (0, 0, 0, 0))
    y = 0
    for row in rows:
        sheet.alpha_composite(row, (0, y))
        y += row.height

    for path in (SRC_SHEET, FINAL_SHEET):
        path.parent.mkdir(parents=True, exist_ok=True)
        sheet.save(path, format="WEBP", lossless=True, method=6)

    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    for name, config in all_animations.items():
        save_animation_gif(sheet, name, config, PREVIEW_DIR / f"{name}.gif")

    INTERACTION_DIR.mkdir(parents=True, exist_ok=True)
    SRC_GIF_DIR.mkdir(parents=True, exist_ok=True)
    interaction_gif_sources = {}
    for gif_name, config in INTERACTION_IMAGE_PACK.items():
        output_path = INTERACTION_DIR / gif_name
        interaction_gif_sources[gif_name] = save_image_pack_interaction_gif(image_pack_sources, gif_name, config, output_path)
        (SRC_GIF_DIR / gif_name).write_bytes(output_path.read_bytes())

    save_contact_sheet(sheet)
    manifest = {
        "frame": {"width": FRAME_W, "height": FRAME_H, "columns": COLS},
        "spritesheet": {
            **IMAGE_PACK_IDENTITY,
            "width": sheet.width,
            "height": sheet.height,
            "rows": len(all_animations),
            "src": str(SRC_SHEET.relative_to(ROOT)),
        },
        "petIdentity": {
            **IMAGE_PACK_IDENTITY,
            "appliesTo": ["spritesheet", "imagePack", "interactionGifs"],
        },
        "animations": all_animations,
        "newAnimations": NEW_ANIMATIONS,
        "imagePack": {
            **IMAGE_PACK_IDENTITY,
            "sourceType": "generated-image-pack",
            "usesBaseSpritesheet": False,
            "sourceDir": relative(SRC_IMAGE_DIR),
            "frameDir": relative(SRC_FRAME_DIR),
            "sources": {name: relative(SRC_IMAGE_DIR / name) for name in IMAGE_PACK_SOURCES},
            "prompts": {name: config["prompt"] for name, config in IMAGE_PACK_SOURCES.items()},
        },
        "interactionGifs": {name: relative(SRC_GIF_DIR / name) for name in INTERACTION_IMAGE_PACK},
        "interactionGifSources": interaction_gif_sources,
        "previewDir": relative(PREVIEW_DIR),
        "contactSheet": relative(CONTACT_SHEET_PATH),
    }
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
