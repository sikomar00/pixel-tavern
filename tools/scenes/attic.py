"""장면 1: 비 오는 밤 다락방 (아늑 / 로파이). 85x110 칸, 4배 확대."""
from __future__ import annotations

import math
import random

from artlib import Art, Canvas, MARKER, bayer, blink, drift, frames, make_strip, region_d, shapes, text, titles

W, H = 85, 96
NAME = "attic"
BASE = "#1b1b3a"
GAUGE_NAME = "촛불"
P = {
    "wall0": "#17172f", "wall1": "#202046", "wall2": "#2a2a58",
    "beam0": "#2b1a12", "beam1": "#4a2e1c", "beam2": "#6b4429",
    "frame": "#5a3a22", "frame_hi": "#7b5330", "sill": "#6b4429",
    "sky0": "#080c26", "sky1": "#101a44", "sky2": "#1c2c68", "star": "#8fa0e0",
    "moon": "#f2ecc8", "city": "#0b0e22", "lit": "#ffd27a", "pink": "#ff7fb0",
    "rain": "#7fa4ff", "rain_hi": "#bcd0ff", "rain2": "#4a68b8", "rain2_hi": "#6f8ee0",
    "cat": "#07070f", "eye": "#ffcf6a", "amber": "#ffb347", "glow": "#ffdd99", "flame": "#e07a20",
    "cream": "#f1e3c4", "cream_sh": "#cdb98f", "wick": "#2a1d14",
    "red": "#b3434a", "green": "#3f7f6a", "blue": "#4b5fae", "violet": "#8a5ab0", "gold": "#e8c27a",
    "potion_g": "#7cf0c8", "potion_p": "#ff7fb0", "glass": "#a9b8e8",
    "mug": "#e8d8c0", "mug_sh": "#b9a88c", "steam": "#c9d2ff",
    "page": "#efe6cf", "page_sh": "#c9bd9e", "ink": "#4a4060",
    "wire": "#4a3a30", "dim_amber": "#8a6428", "dim_pink": "#8a3a5a",
    "edge": "#2f2f66", "muted": "#b9b3e6",
}

# 창: 위가 둥근 아치. 유리 영역(GL..GR 가로, 아래는 GB)
CX, ARCH_Y, RX, RY = 26.0, 36, 19.5, 20.0
GL, GR, GB = 7, 45, 61
FADE_FROM, FADE_TO = 64, 78  # 이 구간에서 그림이 배경색으로 녹는다 (글자 자리 확보)


def in_glass(x: int, y: int, grow: int = 0) -> bool:
    if y > GB + grow or x < GL - grow or x > GR + grow:
        return False
    if y >= ARCH_Y:
        return True
    return ((x - CX) / (RX + grow)) ** 2 + ((y - ARCH_Y) / (RY + grow)) ** 2 <= 1


GLASS = [(x, y) for y in range(10, GB + 1) for x in range(GL - 1, GR + 2) if in_glass(x, y)]
BUILDINGS = [(7, 6, 9), (13, 5, 14), (18, 6, 8), (24, 5, 17), (29, 6, 11), (35, 5, 15), (40, 6, 9)]
STARS = [(14, 26), (19, 21), (24, 29), (30, 19), (17, 34), (41, 33), (10, 37)]


def wire_y(x: int) -> int:
    return 8 + round(4 * (1 - ((x - 42.5) / 37.5) ** 2))


def back() -> tuple[Canvas, list[tuple[int, int, str]]]:
    """벽, 창 유리의 밤하늘, 달, 도시. 비는 이 위, 창틀과 고양이는 비 위에 온다."""
    c = Canvas(W, H)
    c.bands(0, 0, W, 72, [P["wall0"], P["wall1"], P["wall2"], P["wall1"]])
    for x in range(5, W, 11):  # 벽 널빤지 홈
        for y in range(8, 72):
            if (y // 3) % 2 == 0:
                c.px(x, y, P["wall0"])
    for (x, y) in GLASS:
        t = (y - 16) / 45
        high = t < 0.5
        mix = (1 - 2 * t) if high else (1 - 2 * (t - 0.5))
        light, dark = (P["sky2"], P["sky1"]) if high else (P["sky1"], P["sky0"])
        c.px(x, y, light if bayer(x, y) < mix * 16 else dark)
    for (x, y) in STARS:
        c.px(x, y, P["star"])
    c.ellipse(34, 27, 4.5, 4.5, P["moon"])
    c.ellipse(36, 26, 3.8, 3.8, P["sky1"])
    rng = random.Random(7)
    lit: list[tuple[int, int, str]] = []
    for bx, bw, bh in BUILDINGS:
        top = GB + 1 - bh
        c.rect(bx, top, bw, bh, P["city"])
        for wx in range(bx + 1, bx + bw - 1, 2):
            for wy in range(top + 2, GB - 1, 3):
                if rng.random() < 0.4:
                    lit.append((wx, wy, P["lit"] if rng.random() < 0.7 else P["pink"]))
    for (x, y, color) in lit:
        c.px(x, y, color)
    return c, lit


def front() -> Canvas:
    """서까래, 창틀, 고양이, 선반, 탁자와 그 위의 물건."""
    c = Canvas(W, H)
    for row, color in enumerate(["beam0", "beam0", "beam0", "beam1", "beam2", "beam1", "beam0"]):
        c.rect(0, row, W, 1, P[color])
    c.line(0, 16, 13, 6, P["beam1"], 3)
    c.line(84, 16, 71, 6, P["beam1"], 3)
    for y in range(12, 68):  # 창틀: 바깥 어둡게, 가운데 나무, 안쪽 밝게
        for x in range(2, 51):
            if in_glass(x, y, 3) and not in_glass(x, y, 2):
                c.px(x, y, P["beam0"])
            elif in_glass(x, y, 2) and not in_glass(x, y, 1):
                c.px(x, y, P["frame"])
            elif in_glass(x, y, 1) and not in_glass(x, y, 0):
                c.px(x, y, P["frame_hi"])
    c.rect(25, 16, 2, GB - 15, P["frame"])
    c.rect(GL, 40, GR - GL + 1, 2, P["frame"])
    c.rect(GL, 40, GR - GL + 1, 1, P["frame_hi"])
    c.rect(3, 62, 47, 3, P["sill"])
    c.rect(3, 62, 47, 1, P["frame_hi"])
    c.rect(3, 65, 47, 1, P["beam0"])
    cat(c)
    shelf(c)
    table(c)
    for x in range(5, 81):  # 꼬마전구 줄
        c.px(x, wire_y(x), P["wire"])
    for i, x in enumerate(range(10, 80, 8)):
        c.rect(x, wire_y(x) + 1, 1, 2, P["dim_amber"] if i % 2 == 0 else P["dim_pink"])
    return c


def cat(c: Canvas) -> None:
    k = P["cat"]
    c.ellipse(15, 58.5, 5.5, 4.2, k)
    c.ellipse(19.5, 52, 3.4, 3.1, k)
    for x, y in [(16, 48), (16, 49), (17, 49), (22, 48), (22, 49), (21, 49)]:
        c.px(x, y, k)
    for x, y in [(10, 61), (9, 60), (9, 59), (8, 58), (8, 57), (9, 56)]:
        c.px(x, y, k)


def shelf(c: Canvas) -> None:
    c.rect(55, 34, 28, 2, P["beam1"])
    c.rect(55, 34, 28, 1, P["beam2"])
    c.rect(58, 36, 2, 4, P["beam0"])
    c.rect(78, 36, 2, 4, P["beam0"])
    for x, top, h, color in [(65, 24, 10, "red"), (67, 23, 11, "green"), (69, 25, 9, "blue"), (71, 24, 10, "violet")]:
        c.rect(x, top, 2, h, P[color])
        c.rect(x, top + 3, 2, 1, P["gold"])
    c.rect(75, 29, 4, 5, P["potion_g"])
    c.rect(76, 27, 2, 2, P["glass"])
    c.rect(76, 26, 2, 1, P["beam2"])
    c.px(76, 30, "#d6fff0")
    c.rect(80, 30, 3, 4, P["potion_p"])
    c.px(81, 28, P["glass"])
    c.px(81, 29, P["glass"])
    c.px(81, 32, "#ffd0e4")


def table(c: Canvas) -> None:
    c.rect(52, 58, 33, 3, P["beam2"])
    c.rect(52, 58, 33, 1, P["frame_hi"])
    c.rect(52, 61, 33, 6, P["beam1"])
    c.rect(52, 61, 33, 1, P["beam0"])
    c.rect(57, 52, 5, 6, P["mug"])
    c.rect(61, 52, 1, 6, P["mug_sh"])
    c.rect(57, 52, 5, 1, P["beam1"])
    for x, y in [(62, 54), (63, 54), (63, 55), (62, 56)]:
        c.px(x, y, P["mug"])
    c.rect(66, 56, 6, 2, P["page"])
    c.rect(73, 56, 6, 2, P["page"])
    c.rect(66, 57, 6, 1, P["page_sh"])
    c.rect(73, 57, 6, 1, P["page_sh"])
    c.rect(72, 55, 1, 3, P["beam0"])
    for x in (67, 69, 74, 76):
        c.px(x, 56, P["ink"])
    c.rect(80, 54, 4, 4, P["potion_p"])
    c.rect(81, 52, 2, 2, P["glass"])
    c.rect(81, 51, 2, 1, P["beam2"])


def rain(seed: int, count: int, period: int, color: str, head: str) -> dict[tuple[int, int], str]:
    """세로 빗줄기. 세로로 period 칸마다 같은 모양이라 끊김 없이 이어진다."""
    r = random.Random(seed)
    cells: dict[tuple[int, int], str] = {}
    for x in sorted(r.sample(range(GL, GR + 1), count)):
        y0 = r.randrange(period)
        for k in range(-1, 6):
            for j in range(3):
                cells[(x, y0 + period * k + j)] = head if j == 2 else color
    return cells


def gauge(level: int) -> str:
    """컨텍스트 게이지: 촛불. 쓴 만큼 초가 짧아지고 촛농이 흐른다. level = 5% 단위."""
    used = level * 5
    h = max(1, round(16 * (1 - used / 100)))
    top = 34 - h
    c = Canvas(W, H)
    c.rect(59, top, 3, h, P["cream"])
    c.rect(61, top, 1, h, P["cream_sh"])
    c.px(59, top, "#fff6df")
    if used >= 25:
        c.rect(58, min(top + 2, 31), 1, 3, P["cream_sh"])
    if used >= 55:
        c.rect(62, min(top + 4, 31), 1, 2, P["cream_sh"])
    if used >= 40:
        c.px(58, 33, P["cream_sh"])
        c.px(62, 33, P["cream_sh"])
    if used >= 70:
        c.px(57, 33, P["cream_sh"])
        c.px(63, 33, P["cream_sh"])
        c.px(58, 32, P["cream_sh"])
    wy = top - 1
    c.px(60, wy, P["wick"])
    a, f, g = P["amber"], P["flame"], P["glow"]
    base = [(60, wy - 1, a), (59, wy - 1, f), (61, wy - 1, f)]
    flames = [
        shapes({(x, y): col for x, y, col in base + [(60, wy - 2, a), (60, wy - 3, g)]}),
        shapes({(x, y): col for x, y, col in base + [(60, wy - 2, a), (61, wy - 3, g)]}),
        shapes({(x, y): col for x, y, col in base + [(60, wy - 2, g)]}),
        shapes({(x, y): col for x, y, col in base + [(60, wy - 2, a), (59, wy - 3, g)]}),
    ]
    halo = (
        f'<ellipse cx="60.5" cy="{wy - 2}" rx="6" ry="6" fill="{g}" fill-opacity=".08">'
        f'<animate attributeName="fill-opacity" values=".08;.12;.09;.06" dur="1s" begin="-.3s" calcMode="discrete" repeatCount="indefinite"/></ellipse>'
    )
    return shapes(c.cells) + halo + frames(flames, 1, 0.2)


def label_svg() -> str:
    return text(69, 44, GAUGE_NAME + " {{P}}%", 3.2, P["amber"], 700, "middle", 0.2)


def overlays(lit: list[tuple[int, int, str]]) -> tuple[str, str]:
    """(비 뒤에서 반짝이는 것, 창틀 앞에서 반짝이는 것)"""
    behind = "".join(blink(x, y, 1, 1, "#ffffff", "1;0.15;1;1", 3.2, i * 0.55) for i, (x, y) in enumerate(STARS))
    pick = random.Random(3).sample(lit, min(6, len(lit)))
    behind += "".join(blink(x, y, 1, 1, col, "1;0.2;1;1", 3.6, i * 0.7) for i, (x, y, col) in enumerate(pick))
    ahead = "".join(
        blink(x, wire_y(x) + 1, 1, 2, P["amber"] if i % 2 == 0 else P["pink"], "1;0.35;1;1", 2.4, i * 0.4)
        for i, x in enumerate(range(10, 80, 8))
    )
    ahead += blink(18, 52, 1, 1, P["eye"], "1;1;1;1;0", 6, 0.5) + blink(21, 52, 1, 1, P["eye"], "1;1;1;1;0", 6, 0.5)
    steam = [[(58, 50), (59, 49), (58, 48), (59, 47)], [(59, 50), (58, 49), (59, 48), (58, 47)]]
    ahead += frames([shapes({p: P["steam"] for p in cells}) for cells in steam], 1.2, 0.4)
    return behind, ahead


def emblem(c: Canvas) -> None:
    """배너 왼쪽의 작은 아치 창: 나무 테두리, 밤하늘, 달, 도시."""
    for y in range(0, 12):
        for x in range(1, 14):
            inner = y >= 5 and 3 <= x <= 10 or y < 5 and ((x - 6.5) / 3.8) ** 2 + ((y - 5) / 3.8) ** 2 <= 1
            outer = y >= 5 and 2 <= x <= 11 or y < 5 and ((x - 6.5) / 4.8) ** 2 + ((y - 5) / 4.8) ** 2 <= 1
            if inner and 1 <= y <= 10:
                c.px(x, y, P["sky1"])
            elif outer and 0 <= y <= 11:
                c.px(x, y, P["frame_hi"])
    c.px(8, 3, P["moon"])
    c.px(9, 3, P["moon"])
    c.px(8, 4, P["moon"])
    c.px(5, 2, P["star"])
    c.rect(3, 8, 2, 3, P["city"])
    c.rect(5, 7, 2, 4, P["city"])
    c.rect(7, 8, 3, 3, P["city"])
    c.px(6, 8, P["lit"])
    c.px(4, 9, P["pink"])


def build() -> dict:
    art = Art(NAME, W, H, BASE)
    clip = art.clip("glass", region_d(GLASS))
    wall, lit = back()
    wall.fade(FADE_FROM, FADE_TO)
    near = front()
    near.fade(FADE_FROM, FADE_TO)
    behind, ahead = overlays(lit)
    art.add(wall)
    art.add(behind)
    art.add(drift(shapes(rain(7, 14, 12, P["rain"], P["rain_hi"])), [(0, 0), (0, 4), (0, 8)], 0.45, 0.1, clip))
    art.add(drift(shapes(rain(11, 10, 12, P["rain2"], P["rain2_hi"])), [(0, 0), (0, 3), (0, 6), (0, 9)], 0.64, 0.2, clip))
    art.add(near)
    art.add(ahead)
    art.add(MARKER)
    art.add(titles("비 오는 밤 다락방", "비는 오고, 코드는 따뜻하다", P["amber"], P["muted"]))
    return {
        "base": BASE,
        "scene": art.svg(),
        "gauges": [gauge(i) for i in range(21)],
        "labelSvg": label_svg(),
        "labelName": GAUGE_NAME,
        "strip": make_strip(NAME, BASE, P["edge"], emblem, [P["amber"], P["pink"]]),
    }
