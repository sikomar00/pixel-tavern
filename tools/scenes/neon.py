"""장면 4: 네온 펑크 성 (모험 / 펑크 · 비비드). 85x110 칸, 4배 확대."""
from __future__ import annotations

import random

from artlib import Art, Canvas, MARKER, blink, frames, make_strip, shapes, text, PANEL_ROWS

W, H = 85, 96
NAME = "neon"
BASE = "#120a1f"
GAUGE_NAME = "전기"
P = {
    "s0": "#0a0614", "s1": "#150a2a", "s2": "#241044", "s3": "#3a1560", "sil": "#07040f",
    "pink": "#ff2e88", "pink_hi": "#ffd0e8", "cyan": "#00e5ff", "violet": "#8a3aff", "yellow": "#ffd84a",
    "moon_in": "#2a0f48", "star": "#c9d8ff", "ground": "#0d0618", "ground_ln": "#2a1048", "beam": "#3a1d66",
    "glass": "#5a2a80", "cap": "#3a2a50", "dark": "#1a0830", "muted": "#c9a8e8", "edge": "#4a1f7a",
    "white": "#ffffff",
}
FADE_FROM, FADE_TO = 64, 78
TUBE_ROWS = 36  # 네온관 안쪽 높이(칸)
TUBE_BOTTOM = 48
BOLT = [(65, 38), (64, 39), (64, 40), (63, 41), (62, 42), (63, 42), (64, 42), (63, 43), (62, 44), (61, 45), (60, 46)]
Cell = tuple[int, int]


def castle() -> set[Cell]:
    s: set[Cell] = set()

    def add(x: int, y: int, w: int, h: int) -> None:
        s.update((xx, yy) for yy in range(y, y + h) for xx in range(x, x + w))

    add(14, 34, 28, 26)
    add(6, 26, 10, 34)
    add(40, 22, 10, 38)
    add(24, 12, 8, 22)
    for i in range(8):  # 뾰족한 지붕
        w = i + 1
        s.update((xx, 4 + i) for xx in range(28 - w // 2, 28 - w // 2 + w))
    for x0, x1, y in [(16, 39, 34), (6, 15, 26), (40, 49, 22)]:  # 총안
        for x in range(x0, x1 + 1):
            if (x // 2) % 2 == 0:
                s.discard((x, y))
                s.discard((x, y + 1))
    return s


def windows() -> list[tuple[int, int, str]]:
    spots = [(x, y) for x in (18, 23, 33) for y in (40, 47)]
    spots += [(9, y) for y in (30, 37, 44, 51)] + [(44, y) for y in (26, 33, 40, 47)] + [(27, 16), (27, 23)]
    r = random.Random(4)
    colors = [P["cyan"], P["pink"], P["yellow"], P["cyan"]]
    return [(x, y, r.choice(colors)) for x, y in spots if r.random() < 0.75]


def sky() -> Canvas:
    c = Canvas(W, H)
    c.bands(0, 0, W, 59, [P["s0"], P["s1"], P["s2"], P["s3"]])
    c.ellipse(60, 24, 9, 9, P["pink"])
    c.ellipse(60, 24, 7.6, 7.6, P["moon_in"])
    return c


def castle_canvas(s: set[Cell]) -> Canvas:
    c = Canvas(W, H)
    for (x, y) in s:
        if (x + 1, y) not in s and y > 12:
            color = P["pink"]  # 오른쪽 가장자리: 네온 림
        elif (x, y - 1) not in s:
            color = P["cyan"]  # 윗면
        else:
            color = P["sil"]
        c.px(x, y, color)
    for x0, heights in [(7, [5, 3, 6, 4]), (41, [4, 6, 3, 5])]:  # 모히칸 가시
        y0 = 25 if x0 == 7 else 21
        for i, h in enumerate(heights):
            c.rect(x0 + i * 2, y0 - h + 1, 1, h, P["pink"])
            c.px(x0 + i * 2, y0 - h + 1, P["pink_hi"])
    c.rect(25, 50, 7, 10, P["dark"])
    c.rect(24, 49, 9, 1, P["pink"])
    c.rect(24, 49, 1, 11, P["pink"])
    c.rect(32, 49, 1, 11, P["pink"])
    for x, y, color in windows():
        c.rect(x, y, 2, 3, color)
    c.rect(0, 59, W, 8, P["ground"])
    for y in (60, 62, 64):
        for x in range(W):
            if (x + y) % 6 < 2:
                c.px(x, y, P["ground_ln"])
    c.rect(72, 10, 8, 2, P["cap"])  # 네온관 틀
    c.rect(73, 12, 6, 38, P["glass"])
    c.rect(74, 13, 4, 36, P["dark"])
    c.rect(72, 50, 8, 2, P["cap"])
    return c


def beams() -> str:
    bodies = []
    for tx, ty in [(68, 2), (80, 10), (84, 20)]:
        c = Canvas(W, H)
        c.line(45, 21, tx, ty, P["beam"], 2)
        c.cells = {k: v for k, v in c.cells.items() if (k[0] + k[1]) % 2 == 0}
        bodies.append(shapes(c.cells))
    return frames(bodies, 4, 0.5)


def twinkles(s: set[Cell]) -> str:
    r = random.Random(9)
    out = []
    while len(out) < 12:
        x, y = r.randrange(2, 83), r.randrange(2, 40)
        if (x, y) not in s and (x - 60) ** 2 + (y - 24) ** 2 > 100 and x < 70:
            out.append(blink(x, y, 1, 1, P["star"] if len(out) % 2 else P["cyan"], "1;0.15;1;1", 3, len(out) * 0.6))
    return "".join(out)


def window_flicker() -> str:
    r = random.Random(2)
    return "".join(
        blink(x, y, 2, 3, color, "1;0.25;1;1", 2.8, i * 0.5)
        for i, (x, y, color) in enumerate(r.sample(windows(), 6))
    )


def bolt_frames() -> str:
    return frames([shapes({p: P["cyan"] for p in BOLT}), shapes({p: P["violet"] for p in BOLT})], 1.6, 0.3)


def gauge(level: int) -> str:
    """컨텍스트 게이지: 네온관. 쓴 만큼 아래서부터 분홍에서 청록으로 차오르고 불꽃이 튄다."""
    rows = round(TUBE_ROWS * level * 5 / 100)
    if rows == 0:
        return ""
    c = Canvas(W, H)
    for i in range(rows):
        f = i / TUBE_ROWS
        color = P["pink"] if f < 0.5 else P["violet"] if f < 0.8 else P["cyan"]
        c.rect(74, TUBE_BOTTOM - i, 4, 1, color)
        if color == P["pink"]:
            c.px(75, TUBE_BOTTOM - i, P["pink_hi"])
    top = TUBE_BOTTOM - rows + 1
    glow = (
        f'<rect x="71" y="{top - 1}" width="10" height="{rows + 2}" fill="{P["pink"]}" fill-opacity=".09" shape-rendering="crispEdges">'
        '<animate attributeName="fill-opacity" values=".09;.14;.07;.11" dur="1.3s" begin="-.4s" calcMode="discrete" repeatCount="indefinite"/></rect>'
    )
    out = glow + shapes(c.cells)
    if rows < TUBE_ROWS:
        spark = [{(73, top - 1): P["white"], (78, top - 1): P["white"]}, {(74, top - 1): P["white"], (77, top - 1): P["white"]}]
        out += frames([shapes(p) for p in spark], 0.5, 0.1)
    return out


def emblem(c: Canvas) -> None:
    c.ellipse(6.5, 5.5, 4.9, 4.9, P["pink"])
    c.ellipse(6.5, 5.5, 3.9, 3.9, P["dark"])
    for x, y in [(7, 2), (6, 3), (6, 4), (5, 5), (6, 5), (7, 5), (6, 6), (5, 7), (5, 8)]:
        c.px(x, y, P["cyan"])


def build() -> dict:
    art = Art(NAME, W, PANEL_ROWS, BASE)
    s = castle()
    back, front = sky(), castle_canvas(s)
    for canvas in (back, front):
        canvas.fade(FADE_FROM, FADE_TO)
    art.add(back)
    art.add(twinkles(s))
    art.add(beams())
    art.add(front)
    art.add(window_flicker() + bolt_frames())
    art.add(MARKER)
    return {
        "base": BASE,
        "scene": art.svg(),
        "gauges": [gauge(i) for i in range(21)],
        "labelSvg": text(75.5, 57, GAUGE_NAME + " {{P}}%", 3.2, P["pink"], 700, "middle", 0.2),
        "labelName": GAUGE_NAME,
        "strip": make_strip(NAME, BASE, P["edge"], emblem, [P["pink"], P["cyan"]]),
    }
