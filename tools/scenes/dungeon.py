"""장면 3: 8비트 던전 (모험 / 비디오게임). 85x110 칸, 4배 확대."""
from __future__ import annotations

import random

from artlib import Art, Canvas, MARKER, bayer, blink, frames, make_strip, region_d, shapes, text, PANEL_ROWS

W, H = 85, 96
NAME = "dungeon"
BASE = "#0b2b26"
GAUGE_NAME = "컨텍스트"
P = {
    "mortar": "#0a2420", "brick": "#16443d", "brick_hi": "#1c5a50", "dark": "#04120f", "dark2": "#0a1f1b",
    "stone": "#1d5a50", "stone_hi": "#2a7a6c", "glow_floor": "#0d3f2c",
    "slime": "#6be04a", "slime_dk": "#3b9a2c", "slime_hi": "#c9ff9f", "white": "#ffffff", "black": "#0a0a0a",
    "wood": "#6b4429", "metal": "#4a5a5a", "f1": "#ff9a2e", "f2": "#ffd84a", "f3": "#fff1a0",
    "pot": "#4fd6ff", "pot_hi": "#bff3ff", "pot_lo": "#2aa0c8", "pot_dk": "#0f2f3a", "glass": "#6fc0d8",
    "cork": "#a8672e", "chest": "#7a4a22", "chest_hi": "#a8672e", "chest_dk": "#4a2a14", "gold": "#ffd84a",
    "floor": "#0d3a33", "floor_ln": "#082a25", "heart": "#ff4f6a", "heart_dk": "#3a1a22",
    "green": "#7cff4f", "bubble": "#dffaff", "muted": "#9fd8c4", "edge": "#14564a",
}
FADE_FROM, FADE_TO = 64, 78
FILL_ROWS = 14  # 물약 병 안쪽 높이(칸)
DX0, DX1, DY0, DB = 6, 26, 40, 62  # 문: 가로 6..26, 둥근 부분은 DY0 위, 바닥 DB
HEART = ["..XX.XX..", ".XXXXXXX.", ".XXXXXXX.", "..XXXXX..", "...XXX...", "....X...."]


def in_door(x: int, y: int, grow: int = 0) -> bool:
    if y > DB or x < DX0 - grow or x > DX1 + grow:
        return False
    if y >= DY0:
        return True
    return ((x - 16) / (10.5 + grow)) ** 2 + ((y - DY0) / (10 + grow)) ** 2 <= 1


def back() -> Canvas:
    c = Canvas(W, H)
    c.rect(0, 0, W, 70, P["mortar"])
    r = random.Random(5)
    for row in range(14):
        for x in range(-(4 if row % 2 else 0), W, 8):
            c.rect(x, row * 5, 7, 4, P["brick_hi"] if r.random() < 0.2 else P["brick"])
    for y in range(26, DB + 1):
        for x in range(DX0 - 3, DX1 + 4):
            if in_door(x, y, 3) and not in_door(x, y, 2):
                c.px(x, y, P["mortar"])
            elif in_door(x, y, 2) and not in_door(x, y, 1):
                c.px(x, y, P["stone"])
            elif in_door(x, y, 1) and not in_door(x, y):
                c.px(x, y, P["stone_hi"])
            elif in_door(x, y):
                c.px(x, y, P["glow_floor"] if y >= 56 and bayer(x, y) < (y - 55) * 2 else P["dark"])
    c.rect(52, 12, 29, 33, P["dark2"])  # 벽감
    c.rect(52, 12, 29, 1, P["mortar"])
    c.rect(52, 43, 29, 2, P["stone"])
    c.rect(52, 43, 29, 1, P["stone_hi"])
    c.rect(0, 62, W, 6, P["floor"])
    c.rect(0, 62, W, 1, P["edge"])
    for x in range(4, W, 10):
        c.rect(x, 63, 1, 2, P["floor_ln"])
    for x in range(9, W, 10):
        c.rect(x, 65, 1, 3, P["floor_ln"])
    c.rect(0, 65, W, 1, P["floor_ln"])
    return c


def hud(c: Canvas) -> None:
    c.rect(2, 2, 32, 11, P["dark"])
    c.rect(2, 2, 32, 1, P["edge"])
    for i in range(3):
        color = P["heart"] if i < 2 else P["heart_dk"]
        for dy, row in enumerate(HEART):
            for dx, ch in enumerate(row):
                if ch == "X":
                    c.px(4 + i * 10 + dx, 5 + dy, color)


def bottle(c: Canvas) -> None:
    c.rect(59, 24, 14, 16, P["glass"])
    c.rect(60, 25, 12, 14, P["pot_dk"])
    c.rect(62, 18, 8, 6, P["glass"])
    c.rect(63, 19, 6, 6, P["pot_dk"])
    c.rect(63, 15, 6, 3, P["cork"])
    c.rect(60, 26, 1, 3, P["pot_hi"])


def torch_and_chest(c: Canvas) -> None:
    c.rect(35, 34, 2, 7, P["wood"])
    c.rect(34, 33, 4, 2, P["metal"])
    c.rect(35, 41, 2, 2, P["metal"])
    c.rect(56, 54, 21, 4, P["chest_hi"])
    c.rect(57, 53, 19, 1, P["chest_hi"])
    c.rect(56, 58, 21, 5, P["chest"])
    c.rect(56, 58, 21, 1, P["chest_dk"])
    c.rect(60, 53, 1, 10, P["gold"])
    c.rect(72, 53, 1, 10, P["gold"])
    c.rect(65, 57, 3, 3, P["gold"])
    c.px(66, 58, P["black"])


def slime_frames() -> str:
    def slime(cy: float, rx: float, ry: float, eye_y: int) -> str:
        c = Canvas(W, H)
        c.ellipse(16, cy, rx, ry, P["slime"])
        c.rect(int(16 - rx), 60, int(rx * 2) + 1, 2, P["slime"])
        c.rect(int(16 - rx), 61, int(rx * 2) + 1, 1, P["slime_dk"])
        c.px(13, eye_y - 1, P["slime_hi"])
        for x in (14, 18):
            c.rect(x, eye_y, 1, 2, P["white"])
            c.px(x, eye_y + 1, P["black"])
        return shapes(c.cells)

    return frames([slime(58.5, 5.2, 3.6, 56), slime(59, 5.8, 3.0, 57)], 1.2, 0.3)


def torch_frames() -> str:
    f1, f2, f3 = P["f1"], P["f2"], P["f3"]
    shapes_rel = [
        [(0, 0, f1), (1, 0, f1), (0, -1, f1), (1, -1, f2), (1, -2, f2), (1, -3, f3)],
        [(0, 0, f1), (1, 0, f1), (0, -1, f2), (1, -1, f1), (0, -2, f2), (0, -3, f3)],
        [(0, 0, f1), (1, 0, f1), (0, -1, f1), (1, -1, f1), (0, -2, f2), (1, -2, f3)],
    ]
    bodies = [shapes({(36 + dx, 32 + dy): col for dx, dy, col in cells}) for cells in shapes_rel]
    halo = (
        f'<ellipse cx="37" cy="30" rx="9" ry="9" fill="{f1}" fill-opacity=".10">'
        '<animate attributeName="fill-opacity" values=".10;.15;.08;.12" dur=".9s" begin="-.2s" '
        'calcMode="discrete" repeatCount="indefinite"/></ellipse>'
    )
    return halo + frames(bodies, 0.9, 0.1)


def gauge(level: int) -> str:
    """컨텍스트 게이지: 마나 포션. 쓴 만큼 병이 차오르고 거품이 오른다."""
    rows = round(FILL_ROWS * level * 5 / 100)
    if rows == 0:
        return ""
    top = 39 - rows
    c = Canvas(W, H)
    c.rect(60, top, 12, rows, P["pot"])
    c.rect(60, top, 12, 1, P["pot_hi"])
    c.rect(60, 38, 12, 1, P["pot_lo"])
    out = shapes(c.cells)
    if rows >= 8:
        a = {(63, top + 3): P["bubble"], (68, top + 6): P["bubble"]}
        b = {(64, top + 4): P["bubble"], (67, top + 7): P["bubble"]}
        out += frames([shapes(a), shapes(b)], 1.2, 0.2)
    return out


def sparkles() -> str:
    return blink(57, 21, 1, 1, P["pot_hi"], "1;0;1;1", 2.6, 0.4) + blink(74, 27, 1, 1, P["pot_hi"], "1;1;0;1", 2.2, 1.1)


def emblem(c: Canvas) -> None:
    c.rect(1, 1, 11, 10, P["dark"])
    c.rect(1, 1, 11, 1, P["stone_hi"])
    c.ellipse(6.5, 7, 4.3, 3.2, P["slime"])
    c.rect(2, 8, 9, 2, P["slime"])
    for x in (5, 8):
        c.rect(x, 5, 1, 2, P["white"])
        c.px(x, 6, P["black"])


def build() -> dict:
    art = Art(NAME, W, PANEL_ROWS, BASE)
    wall = back()
    near = Canvas(W, H)
    for draw in (hud, bottle, torch_and_chest):
        draw(near)
    for canvas in (wall, near):
        canvas.fade(FADE_FROM, FADE_TO)
    art.add(wall)
    art.add(slime_frames())
    art.add(near)
    art.add(torch_frames() + sparkles() + blink(73, 55, 1, 1, P["white"], "1;0;0;1", 2.8, 0.6))
    art.add(MARKER)
    return {
        "base": BASE,
        "scene": art.svg(),
        "gauges": [gauge(i) for i in range(21)],
        "labelSvg": text(66, 50, GAUGE_NAME + " {{P}}%", 3.2, P["green"], 700, "middle", 0.2),
        "labelName": GAUGE_NAME,
        "strip": make_strip(NAME, BASE, P["edge"], emblem, [P["green"], P["f2"]]),
    }
