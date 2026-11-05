"""장면 7: 마법 서재 (아늑 / 밤). 85칸 폭, 4배 확대. 양쪽 책장, 달이 뜬 아치 창, 책상 위에서 빛나는 책. 게이지는 모래시계."""
from __future__ import annotations

import random

from artlib import Art, Canvas, MARKER, bayer, blink, frames, make_strip, shapes, text, PANEL_ROWS

W, H = 85, 96
NAME = "library"
BASE = "#14232e"
GAUGE_NAME = "컨텍스트"
P = {
    "wall": "#14232e", "wall2": "#1a2d3a", "wall3": "#0e1a23",
    "wood0": "#1c120c", "wood1": "#3a2418", "wood2": "#5a3a22", "wood_hi": "#7d5232",
    "floor": "#1b1712", "floor2": "#2a231a",
    "sky0": "#070b1a", "sky1": "#0d1530", "sky2": "#16204a", "star": "#e9f1ff", "moon": "#f6f1d4", "moon_sh": "#cfc89a",
    "frame": "#6b7a86", "frame_dk": "#3b4650",
    "page": "#efe6cc", "page_sh": "#c9bd9d", "magic": "#c9a6ff", "magic_hi": "#efe0ff", "gold": "#f0c14a", "gold_dk": "#9a7424",
    "owl": "#7a5a3a", "owl_lt": "#b89468", "owl_dk": "#4a3624", "eye": "#ffd36e", "black": "#0a0a0a",
    "cand": "#e8e0c8", "f0": "#ff9a3a", "f1": "#ffe08a",
    "glass": "#9fd0e0", "glass_hi": "#e8f6f8", "sand": "#f0c14a", "sand_hi": "#ffe08a",
    "muted": "#a9bfd0", "edge": "#3b5568",
}
BOOKS = ["#8a3a3a", "#3a6a8a", "#5a8a4a", "#8a6a3a", "#6a3a8a", "#3a8a7a", "#a85a2a", "#4a4a8a"]
GLASS_X, GLASS_TOP = 58, 36  # 모래시계: 가운데 x, 맨 위 y. 위 칸 7줄, 목 1줄, 아래 칸 7줄
BULB = 7


def wall(c: Canvas) -> None:
    c.rect(0, 0, W, 52, P["wall"])
    for x in range(0, W, 9):
        c.rect(x, 4, 1, 46, P["wall2"])
    c.rect(0, 0, W, 4, P["wood0"])
    c.rect(0, 4, W, 1, P["wood1"])
    c.rect(0, 52, W, 22, P["floor"])
    for y in (56, 61, 67):
        c.rect(0, y, W, 1, P["floor2"])
    c.rect(0, 52, W, 1, P["wood1"])


def shelf(c: Canvas, x0: int, width: int, seed: int) -> None:
    rng = random.Random(seed)
    c.rect(x0, 5, width, 47, P["wood1"])
    for row, top in enumerate((7, 18, 29, 40)):
        c.rect(x0 + 1, top, width - 2, 10, P["wood0"])
        x = x0 + 2
        while x < x0 + width - 3:
            w, h = rng.choice((2, 2, 3)), rng.choice((6, 7, 8, 9))
            color = rng.choice(BOOKS)
            c.rect(x, top + 10 - h, w, h, color)
            c.px(x, top + 10 - h, P["wood_hi"])
            if rng.random() < 0.3:
                c.rect(x, top + 10 - h + 2, w, 1, P["gold"])
            x += w
        c.rect(x0 + 1, top + 10, width - 2, 1, P["wood2"])
    c.rect(x0 - (1 if x0 else 0), 4, width + 1, 1, P["wood2"])


def window(c: Canvas) -> None:
    """달이 뜬 아치 창."""
    x0, x1, top, bottom = 25, 53, 8, 42
    c.rect(x0 - 2, top + 8, x1 - x0 + 5, bottom - top - 8, P["frame_dk"])
    c.ellipse((x0 + x1) / 2, top + 14, (x1 - x0) / 2 + 2, 15, P["frame_dk"])
    c.rect(x0, top + 14, x1 - x0 + 1, bottom - top - 14, P["sky1"])
    c.ellipse((x0 + x1) / 2, top + 14, (x1 - x0) / 2, 13, P["sky1"])
    c.bands(x0, top + 1, x1 - x0 + 1, bottom - top - 1, [P["sky0"], P["sky1"], P["sky2"]])
    for x in range(x0, x1 + 1):  # 아치 바깥은 다시 벽 색으로 정리
        for y in range(top, top + 14):
            if ((x - (x0 + x1) / 2) / ((x1 - x0) / 2)) ** 2 + ((y - (top + 14)) / 13) ** 2 > 1:
                c.px(x, y, P["frame_dk"])
    c.ellipse(41, 18, 4, 4, P["moon"])
    c.px(40, 17, P["moon_sh"])
    c.px(42, 19, P["moon_sh"])
    c.rect(40, top, 2, bottom - top, P["frame"])  # 창살
    c.rect(x0, 26, x1 - x0 + 1, 2, P["frame"])
    c.rect(x0 - 2, bottom, x1 - x0 + 5, 2, P["wood2"])  # 창턱


def desk(c: Canvas) -> None:
    c.rect(20, 52, 46, 3, P["wood2"])
    c.rect(20, 52, 46, 1, P["wood_hi"])
    c.rect(22, 55, 42, 10, P["wood1"])
    c.rect(22, 55, 42, 1, P["wood0"])
    for x in (26, 58):
        c.rect(x, 56, 6, 8, P["wood0"])
        c.px(x + 2, 59, P["gold"])
    # 펼친 책
    c.rect(33, 47, 16, 5, P["page"])
    c.rect(40, 47, 2, 5, P["page_sh"])
    for y in (48, 50):
        c.rect(34, y, 5, 1, P["page_sh"])
        c.rect(43, y, 5, 1, P["page_sh"])
    c.rect(32, 52, 18, 1, P["wood0"])
    # 촛대와 잉크병
    c.rect(26, 47, 2, 5, P["cand"])
    c.rect(24, 52, 6, 1, P["gold_dk"])
    c.rect(52, 49, 3, 3, P["black"])
    c.px(53, 48, P["page"])  # 깃펜
    c.line(54, 48, 57, 44, P["page"])


def owl(c: Canvas) -> None:
    c.rect(6, 4, 1, 1, P["wood0"])
    c.ellipse(12, 5, 4.5, 4.5, P["owl"])
    c.ellipse(12, 7, 3, 3, P["owl_lt"])
    c.rect(8, 2, 2, 2, P["owl_dk"])
    c.rect(14, 2, 2, 2, P["owl_dk"])
    c.rect(9, 4, 2, 2, P["eye"])
    c.rect(13, 4, 2, 2, P["eye"])
    c.px(12, 6, P["gold_dk"])


def hourglass_frame(c: Canvas) -> None:
    cx = GLASS_X
    c.rect(cx - 6, GLASS_TOP - 2, 13, 2, P["wood2"])  # 위 뚜껑
    c.rect(cx - 6, GLASS_TOP + 2 * BULB + 1, 13, 2, P["wood2"])  # 아래 받침
    for k in range(BULB):  # 위 칸: 아래로 좁아지는 사다리꼴
        half = 5 - k * 4 // BULB
        c.px(cx - half, GLASS_TOP + k, P["glass"])
        c.px(cx + half, GLASS_TOP + k, P["glass"])
    c.px(cx, GLASS_TOP + BULB, P["glass"])
    for k in range(BULB):  # 아래 칸: 아래로 넓어지는 사다리꼴
        half = 1 + k * 4 // BULB
        c.px(cx - half, GLASS_TOP + BULB + 1 + k, P["glass"])
        c.px(cx + half, GLASS_TOP + BULB + 1 + k, P["glass"])
    c.px(cx - 4, GLASS_TOP + 1, P["glass_hi"])
    c.rect(cx - 6, GLASS_TOP, 1, 2 * BULB + 2, P["wood1"])
    c.rect(cx + 6, GLASS_TOP, 1, 2 * BULB + 2, P["wood1"])


def flame() -> str:
    bodies = []
    for k in range(3):
        c = Canvas(W, H)
        c.rect(26, 45 - (k % 2), 2, 2, P["f0"])
        c.rect(26 + (1 if k == 1 else 0), 44 - (k % 2), 1, 1, P["f1"])
        bodies.append(shapes(c.cells))
    return frames(bodies, 0.9, 0.2)


def magic() -> str:
    """책에서 떠오르는 빛 알갱이."""
    path = [(38, 44), (36, 40), (39, 36), (37, 32)]
    bodies = []
    for x, y in path:
        c = Canvas(W, H)
        c.px(x, y, P["magic_hi"])
        c.px(x + 9, y + 2, P["magic"])
        c.px(x + 4, y - 3, P["magic"])
        c.px(x - 3, y + 3, P["magic_hi"])
        bodies.append(shapes(c.cells))
    glow = (
        f'<ellipse cx="41" cy="48" rx="13" ry="5" fill="{P["magic"]}" fill-opacity=".10">'
        '<animate attributeName="fill-opacity" values=".10;.16;.09;.13" dur="2.6s" begin="-.5s" calcMode="discrete" repeatCount="indefinite"/></ellipse>'
    )
    return glow + frames(bodies, 3.0, 0.4)


def twinkles() -> str:
    rng = random.Random(11)
    out = []
    for i in range(9):
        x, y = rng.randrange(28, 51), rng.randrange(14, 40)
        if (x - 41) ** 2 + (y - 18) ** 2 < 30 or 40 <= x <= 41 or 26 <= y <= 27:
            continue
        out.append(blink(x, y, 1, 1, P["star"], "1;0.3;1;1", 3 + i % 3, i * 0.5))
    out.append(blink(10, 4, 4, 2, P["owl"], "1;1;1;0", 4.5, 1.2))  # 올빼미가 눈을 깜박인다
    return "".join(out)


def gauge(level: int) -> str:
    """컨텍스트 게이지: 모래시계. 위 칸의 모래가 아래 칸으로 떨어져 쌓인다."""
    c = Canvas(W, H)
    cx = GLASS_X
    bottom = round(BULB * level / 20)
    top = BULB - bottom
    for i in range(bottom):  # 아래 칸: 맨 아래 줄부터
        k = BULB - 1 - i
        half = max(0, 1 + k * 4 // BULB - 1)
        c.rect(cx - half, GLASS_TOP + BULB + 1 + k, 2 * half + 1, 1, P["sand_hi"] if i == bottom - 1 else P["sand"])
    for i in range(top):  # 위 칸: 목 쪽(아래)부터 남는다
        k = BULB - 1 - i
        half = max(0, 5 - k * 4 // BULB - 1)
        c.rect(cx - half, GLASS_TOP + k, 2 * half + 1, 1, P["sand"])
    stream = ""
    if 0 < level < 20:
        stream = blink(cx, GLASS_TOP + BULB, 1, 1 + BULB - bottom + 1 if bottom < BULB else 1, P["sand_hi"], "1;0.4;1;1", 1.2, 0.2)
    return shapes(c.cells) + stream


def emblem(c: Canvas) -> None:
    c.ellipse(6.5, 5.5, 5, 5, P["edge"])
    c.ellipse(6.5, 5.5, 4.2, 4.2, P["wall3"])
    c.rect(3, 4, 4, 5, P["page"])
    c.rect(6, 3, 4, 5, P["page_sh"])
    c.px(8, 2, P["magic_hi"])
    c.px(9, 1, P["magic"])


def build() -> dict:
    art = Art(NAME, W, PANEL_ROWS, BASE)
    c = Canvas(W, H)
    wall(c)
    shelf(c, 0, 21, 3)
    shelf(c, 65, 20, 5)
    for draw in (window, desk, owl, hourglass_frame):
        draw(c)
    c.fade(64, 86)
    art.add(c)
    art.add(twinkles() + flame() + magic())
    art.add(MARKER)
    return {
        "base": BASE,
        "scene": art.svg(),
        "gauges": [gauge(i) for i in range(21)],
        "labelSvg": text(42, 68.5, GAUGE_NAME + " {{P}}%", 3.0, P["magic"], 700, "middle", 0.2),
        "labelName": GAUGE_NAME,
        "strip": make_strip(NAME, BASE, P["edge"], emblem, [P["magic"], P["gold"]]),
    }
