"""장면 6: 숲속 캠프파이어 (아늑 / 밤). 85칸 폭, 4배 확대. 별 아래 소나무 숲, 텐트, 모닥불. 게이지는 장작더미가 쌓인다."""
from __future__ import annotations

import math
import random

from artlib import Art, Canvas, MARKER, bayer, blink, frames, make_strip, shapes, text, PANEL_ROWS

W, H = 85, 96
NAME = "camp"
BASE = "#0f1d1a"
GAUGE_NAME = "컨텍스트"
P = {
    "sky0": "#0a1626", "sky1": "#0e1f31", "sky2": "#132a3c", "sky3": "#1a3646",
    "star": "#e9f1ff", "moon": "#f4efd0", "moon_sh": "#cfc89a",
    "ridge": "#0c2030", "ground": "#0c1814", "ground2": "#12241d",
    "glow_a": "#3a2a1a", "glow_b": "#52371e",
    "pine": "#08130f", "pine_hi": "#102a20", "trunk": "#1c120c",
    "tent": "#8a3f2f", "tent_dk": "#5e2a20", "tent_hi": "#b25640", "door": "#f0a040", "door_hi": "#ffd36e", "rope": "#6a5c4a",
    "stone": "#6b6f74", "stone_dk": "#3f4347", "log": "#5a3a22", "log_hi": "#7d5232", "log_end": "#c9a070", "coal": "#ff5a2a",
    "f0": "#ff6a2a", "f1": "#ffa43a", "f2": "#ffe08a", "spark": "#ffd36e", "firefly": "#d9ff7a",
    "muted": "#a9cfc0", "edge": "#2a4a3c",
}
FIRE_X, FIRE_Y = 45, 62
PILE_X, PILE_Y = 59, 70  # 장작더미(게이지): 맨 아래 줄의 왼쪽 위 모서리


def sky(c: Canvas) -> None:
    c.bands(0, 0, W, 40, [P["sky0"], P["sky1"], P["sky2"], P["sky3"]])
    c.ellipse(70, 9, 5, 5, P["moon"])  # 초승달: 큰 원에서 어두운 원을 빼낸다
    c.ellipse(72.5, 8, 4.4, 4.4, P["sky0"])
    c.ellipse(68.5, 10.5, 1.2, 1.2, P["moon_sh"])


def ridge(c: Canvas) -> None:
    for x in range(W):
        top = 36 + round(4 * math.sin(x / 8.5) + 2.5 * math.sin(x / 3.7 + 1))
        c.rect(x, top, 1, 48 - top, P["ridge"])


def ground(c: Canvas) -> None:
    c.rect(0, 46, W, 28, P["ground"])
    for x in range(W):
        for y in range(46, 74):
            if bayer(x, y) < 2 and (x * 7 + y * 3) % 5 == 0:
                c.px(x, y, P["ground2"])
    for x in range(W):  # 모닥불이 비추는 땅(점 무늬로 퍼진다)
        for y in range(52, 72):
            d = ((x - FIRE_X) / 24) ** 2 + ((y - FIRE_Y) / 8) ** 2
            if d < 1 and bayer(x, y) < 10 * (1 - d):
                c.px(x, y, P["glow_b"] if d < 0.35 else P["glow_a"])


def pine(c: Canvas, cx: int, base: int, height: int, half: int) -> None:
    top = base - height
    for y in range(height):
        hw = (y * half) // height + (1 if y % 5 > 2 else 0)
        c.rect(cx - hw, top + y, 2 * hw + 1, 1, P["pine"])
        if y % 5 == 1 and hw > 1:  # 가지 끝에 닿는 달빛
            c.px(cx - hw + 1, top + y, P["pine_hi"])
    c.rect(cx - 1, base, 3, 4, P["trunk"])


def forest(c: Canvas) -> None:
    for cx, base, h, half in ((29, 52, 10, 3), (36, 51, 8, 3), (56, 51, 9, 3), (64, 52, 10, 4)):  # 멀리 있는 작은 나무
        pine(c, cx, base, h, half)
    for cx, base, h, half in ((5, 60, 30, 8), (15, 58, 24, 7), (79, 60, 32, 9), (69, 58, 22, 7)):  # 가까운 큰 나무
        pine(c, cx, base, h, half)


def tent(c: Canvas) -> None:
    ax, top, base = 29, 42, 58
    for y in range(top, base + 1):
        hw = (y - top) * 10 // (base - top)
        c.rect(ax - hw, y, hw + 1, 1, P["tent"])
        c.rect(ax + 1, y, hw, 1, P["tent_dk"])
        c.px(ax - hw, y, P["tent_hi"])
    for y in range(48, base + 1):  # 불빛이 새어 나오는 입구
        hw = (y - 48) * 4 // (base - 48)
        c.rect(ax - hw, y, 2 * hw + 1, 1, P["door"])
        if y > 52:
            c.rect(ax - hw // 2, y, hw + 1, 1, P["door_hi"])
    c.line(ax, top, 16, 62, P["rope"])
    c.line(ax + 1, top, 42, 61, P["rope"])
    c.px(16, 62, P["stone"])
    c.px(42, 61, P["stone"])


def fire_base(c: Canvas) -> None:
    for x in range(37, 54, 3):
        c.ellipse(x + 0.5, 64.5, 2.2, 1.4, P["stone"])
        c.px(x, 63, P["stone_dk"])
    c.line(39, 63, 50, 60, P["log"], 2)
    c.line(51, 63, 40, 60, P["log"], 2)
    c.rect(41, 59, 2, 1, P["log_hi"])
    c.rect(43, 61, 5, 1, P["coal"])
    c.px(45, 60, P["f1"])


def flame_frames() -> str:
    bodies = []
    for k, height in enumerate((11, 13, 12)):
        c = Canvas(W, H)
        for t in range(height):
            y = FIRE_Y - 1 - t
            w = max(1, round(5 * (1 - t / height) ** 0.7))
            sway = round(1.4 * math.sin(k * 2.1 + t * 0.55) * (t / height))
            cx = FIRE_X + sway
            c.rect(cx - w, y, 2 * w + 1, 1, P["f0"])
            if w > 2:
                c.rect(cx - (w - 2), y, 2 * (w - 2) + 1, 1, P["f1"])
            if w > 3 and t < height * 0.55:
                c.rect(cx - (w - 3), y, 2 * (w - 3) + 1, 1, P["f2"])
        bodies.append(shapes(c.cells))
    return frames(bodies, 0.9, 0.1)


def sparks() -> str:
    path = [(46, 46), (44, 42), (47, 38), (45, 34)]
    bodies = []
    for x, y in path:
        c = Canvas(W, H)
        c.px(x, y, P["spark"])
        c.px(x + 5, y + 6, P["f1"])
        c.px(x - 6, y + 9, P["spark"])
        bodies.append(shapes(c.cells))
    return frames(bodies, 3.2, 0.5)


def twinkles() -> str:
    rng = random.Random(7)
    out = []
    for i in range(26):
        x, y = rng.randrange(2, W - 2), rng.randrange(2, 30)
        if (x - 70) ** 2 + (y - 9) ** 2 < 49:
            continue
        if i % 2 == 0:
            out.append(blink(x, y, 1, 1, P["star"], "1;0.35;1;1", 3 + i % 3, i * 0.37))
        else:
            out.append(f'<rect x="{x}" y="{y}" width="1" height="1" fill="{P["star"]}" fill-opacity=".7"/>')
    for i, (x, y) in enumerate([(9, 50), (22, 56), (52, 48), (74, 52), (34, 66), (48, 50), (80, 64)]):
        out.append(blink(x, y, 1, 1, P["firefly"], "0;1;1;0;0", 3.6 + i % 3, i * 0.6))
    return "".join(out)


def halos() -> str:
    def halo(cx: float, cy: float, rx: float, ry: float, color: str, values: str, dur: float, begin: float) -> str:
        return (
            f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="{color}" fill-opacity="{values.split(";")[0]}">'
            f'<animate attributeName="fill-opacity" values="{values}" dur="{dur:g}s" begin="-{begin:g}s" '
            'calcMode="discrete" repeatCount="indefinite"/></ellipse>'
        )

    return halo(45.5, 56, 17, 10, P["f0"], ".09;.14;.08;.12", 1.8, 0.3) + halo(29.5, 54, 7, 6, P["door_hi"], ".10;.14;.09;.12", 2.2, 0.9)


def log_cells(index: int) -> tuple[int, int]:
    """장작 번호(0부터)의 왼쪽 위 모서리: 맨 아래 줄에 6개, 그 위로 5·4·3·2개를 쌓는다."""
    row, left = 0, index
    for count in (6, 5, 4, 3, 2):
        if left < count:
            break
        left -= count
        row += 1
    return PILE_X + row * 2 + left * 4, PILE_Y - 2 * (row + 1)


def gauge(level: int) -> str:
    """컨텍스트 게이지: 장작더미. 쓴 만큼 장작이 한 개씩 쌓인다(20개면 가득)."""
    c = Canvas(W, H)
    c.rect(PILE_X - 2, PILE_Y, 28, 1, P["trunk"])  # 바닥 받침
    for index in range(level):
        x, y = log_cells(index)
        c.rect(x, y, 4, 2, P["log"])
        c.px(x, y, P["log_hi"])
        c.px(x + 3, y + 1, P["log_end"])
    return shapes(c.cells)


def emblem(c: Canvas) -> None:
    c.ellipse(6.5, 5.5, 5, 5, P["edge"])
    c.ellipse(6.5, 5.5, 4.2, 4.2, P["ground"])
    for t in range(6):
        w = max(0, 2 - t // 2)
        c.rect(6 - w, 8 - t, 2 * w + 1, 1, P["f0"] if t < 3 else P["f1"])
    c.rect(6, 6, 1, 2, P["f2"])


def build() -> dict:
    art = Art(NAME, W, PANEL_ROWS, BASE)
    c = Canvas(W, H)
    for draw in (sky, ridge, ground, forest, tent, fire_base):
        draw(c)
    c.fade(64, 86)
    art.add(c)
    art.add(twinkles() + halos() + flame_frames() + sparks())
    art.add(MARKER)
    return {
        "base": BASE,
        "scene": art.svg(),
        "gauges": [gauge(i) for i in range(21)],
        "labelSvg": text(72, 55, GAUGE_NAME + " {{P}}%", 3.0, P["f1"], 700, "middle", 0.2),
        "labelName": GAUGE_NAME,
        "strip": make_strip(NAME, BASE, P["edge"], emblem, [P["f1"], P["firefly"]]),
    }
