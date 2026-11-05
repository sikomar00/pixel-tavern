"""장면 9: 80년대 드라이브 (모험 / 석양). 85칸 폭, 4배 확대. 줄무늬 해, 격자 도로, 야자수, 컨버터블. 게이지는 계기판 바늘."""
from __future__ import annotations

import math
import random

from artlib import Art, Canvas, MARKER, bayer, blink, frames, make_strip, shapes, text, PANEL_ROWS

W, H = 85, 96
NAME = "drive"
BASE = "#240f3d"
GAUGE_NAME = "컨텍스트"
P = {
    "s0": "#150a30", "s1": "#2a1250", "s2": "#4a1a6a", "s3": "#7a2480", "s4": "#b03a86", "s5": "#e0607a", "s6": "#ff9a5a",
    "sun0": "#ffd36e", "sun1": "#ffb347", "sun2": "#ff8a4c", "sun3": "#ff5f8a", "sun4": "#e0407a",
    "mount": "#2a1450", "mount2": "#1c0e3c",
    "ground": "#120826", "grid": "#ff4fd8", "grid_dk": "#8a2a86", "road": "#0c0618", "dash": "#ffe14d",
    "palm": "#0b0620", "palm_hi": "#1c1040", "trunk": "#160a2a",
    "car": "#e8344f", "car_hi": "#ff6a7e", "car_dk": "#8a1a2c", "tail": "#ff3030", "tail_hi": "#ff9a9a", "chrome": "#c9d2e6", "black": "#07040f",
    "star": "#f3ecff", "teal": "#4fd1ff",
    "dial": "#1a0e30", "dial_edge": "#8a6adf", "tick": "#e8dcff", "needle": "#ff5f8a", "e_mark": "#ff5a5a", "f_mark": "#5cff8a",
    "muted": "#cdb0e8", "edge": "#6a3a9a",
}
HORIZON = 40
SUN_X, SUN_Y, SUN_R = 42, 34, 15
DIAL_X, DIAL_Y, DIAL_R = 73, 66, 9  # 계기판: 반원의 중심(아래쪽 가운데)


def sky(c: Canvas) -> None:
    c.bands(0, 0, W, HORIZON, [P["s0"], P["s1"], P["s2"], P["s3"], P["s4"], P["s5"], P["s6"]])


def sun(c: Canvas) -> None:
    colors = (P["sun0"], P["sun1"], P["sun2"], P["sun3"], P["sun4"])
    for y in range(SUN_Y - SUN_R, SUN_Y + SUN_R + 1):
        if y >= HORIZON:
            continue
        half = math.sqrt(max(0, SUN_R**2 - (y - SUN_Y) ** 2))
        t = (y - (SUN_Y - SUN_R)) / (2 * SUN_R)
        slit = y > SUN_Y + 1 and (y - SUN_Y) % 4 in (2, 3) and (y - SUN_Y) // 4 < 4  # 아래쪽으로 갈수록 두꺼워지는 틈
        if slit and (y - SUN_Y) % 4 < (y - SUN_Y) // 4 + 1:
            continue
        c.rect(round(SUN_X - half), y, round(2 * half) + 1, 1, colors[min(4, int(t * 5))])


def mountains(c: Canvas) -> None:
    for x in range(W):
        top = 33 + round(4 * math.sin(x / 6.5 + 0.5) + 3 * math.sin(x / 2.9))
        c.rect(x, top, 1, HORIZON - top, P["mount"])
    for x in range(W):
        top = 37 + round(2 * math.sin(x / 4.1 + 2))
        c.rect(x, top, 1, HORIZON - top, P["mount2"])


def ground(c: Canvas) -> None:
    c.rect(0, HORIZON, W, 34, P["ground"])
    c.rect(0, HORIZON, W, 1, P["grid"])
    for k in range(1, 9):  # 가로줄: 아래로 갈수록 간격이 벌어진다
        y = HORIZON + round(1.6 * k * k / 2.2) + k
        if y < 74:
            c.rect(0, y, W, 1, P["grid_dk"])
    for i in range(-14, 15):  # 세로줄: 소실점으로 모인다
        c.line(SUN_X + i, HORIZON + 1, SUN_X + i * 9, 73, P["grid_dk"])
    for y in range(HORIZON + 1, 74):  # 도로: 소실점에서 아래로 넓어지는 사다리꼴
        half = 1 + (y - HORIZON) * 0.52
        c.rect(round(SUN_X - half), y, round(2 * half) + 1, 1, P["road"])
        c.px(round(SUN_X - half), y, P["grid"])
        c.px(round(SUN_X + half), y, P["grid"])


def palm(c: Canvas, x: int, base: int, height: int, lean: int) -> None:
    for i in range(height):
        c.px(x + round(lean * (i / height) ** 2), base - i, P["trunk"])
        c.px(x + 1 + round(lean * (i / height) ** 2), base - i, P["trunk"])
    tx, ty = x + lean, base - height
    for dx, dy in ((-9, 3), (-6, -1), (-3, -3), (3, -3), (6, -1), (9, 3), (-7, 6), (7, 6)):
        c.line(tx, ty, tx + dx, ty + dy, P["palm"], 2)
        c.px(tx + dx, ty + dy + 1, P["palm_hi"])


def palms(c: Canvas) -> None:
    palm(c, 7, 50, 22, -3)
    palm(c, 16, 47, 15, 2)
    palm(c, 77, 50, 24, 3)
    palm(c, 68, 46, 14, -2)


def car(c: Canvas) -> None:
    x, y = 36, 58  # 뒤에서 본 컨버터블
    c.rect(x + 2, y, 14, 2, P["car_dk"])  # 트렁크 윗면
    c.rect(x, y + 2, 18, 6, P["car"])
    c.rect(x, y + 2, 18, 1, P["car_hi"])
    c.rect(x + 1, y + 8, 16, 2, P["car_dk"])
    c.rect(x + 5, y - 3, 8, 3, P["black"])  # 좌석 등받이
    c.rect(x + 4, y - 4, 10, 1, P["car_dk"])
    c.rect(x + 3, y + 4, 12, 2, P["black"])  # 번호판 칸
    c.rect(x + 6, y + 4, 6, 2, P["chrome"])
    c.rect(x + 1, y + 10, 4, 2, P["black"])  # 바퀴
    c.rect(x + 13, y + 10, 4, 2, P["black"])


def stars() -> str:
    rng = random.Random(21)
    out = []
    for i in range(18):
        x, y = rng.randrange(1, W - 1), rng.randrange(1, 20)
        if i % 2 == 0:
            out.append(blink(x, y, 1, 1, P["star"], "1;0.35;1;1", 3 + i % 3, i * 0.4))
        else:
            out.append(f'<rect x="{x}" y="{y}" width="1" height="1" fill="{P["star"]}" fill-opacity=".7"/>')
    return "".join(out)


def tail_glow() -> str:
    out = []
    for dx in (1, 14):
        out.append(
            f'<rect x="{36 + dx}" y="61" width="3" height="2" fill="{P["tail"]}"/>'
            f'<ellipse cx="{37.5 + dx}" cy="62" rx="4" ry="3" fill="{P["tail"]}" fill-opacity=".15">'
            '<animate attributeName="fill-opacity" values=".15;.25;.12;.2" dur="1.6s" begin="-.3s" calcMode="discrete" repeatCount="indefinite"/></ellipse>'
        )
    return "".join(out)


def road_dashes() -> str:
    """가운데 점선이 다가오는 것처럼 보인다(세 장면을 돌아가며 보인다)."""
    bodies = []
    for k in range(3):
        c = Canvas(W, H)
        for j in range(5):
            y = HORIZON + 2 + round(((j + k / 3) ** 1.7) * 5)
            if y < 73 and not (56 <= y <= 71):  # 자동차 뒤는 가린다
                c.rect(SUN_X, y, 1, max(1, (y - HORIZON) // 8), P["dash"])
        bodies.append(shapes(c.cells))
    return frames(bodies, 0.9, 0.0)


def dial_frame(c: Canvas) -> None:
    c.ellipse(DIAL_X, DIAL_Y, DIAL_R + 2, DIAL_R + 2, P["dial_edge"])
    c.ellipse(DIAL_X, DIAL_Y, DIAL_R + 1, DIAL_R + 1, P["dial"])
    for i in range(0, 21, 5):  # 눈금: 왼쪽(E)에서 오른쪽(F)까지 반원
        a = math.pi * (1 - i / 20)
        x, y = DIAL_X + math.cos(a) * (DIAL_R - 1), DIAL_Y - math.sin(a) * (DIAL_R - 1)
        c.px(round(x), round(y), P["e_mark"] if i == 0 else P["f_mark"] if i == 20 else P["tick"])
    c.rect(DIAL_X - 1, DIAL_Y - 1, 3, 3, P["dial_edge"])
    c.rect(DIAL_X - DIAL_R - 2, DIAL_Y + 1, 2 * DIAL_R + 5, 5, P["ground"])  # 반원 아래쪽을 땅 색으로 덮는다


def gauge(level: int) -> str:
    """컨텍스트 게이지: 계기판 바늘. 쓴 만큼 왼쪽(0)에서 오른쪽(가득)으로 돈다."""
    c = Canvas(W, H)
    a = math.pi * (1 - level / 20)
    ex, ey = DIAL_X + math.cos(a) * (DIAL_R - 2), DIAL_Y - math.sin(a) * (DIAL_R - 2)
    c.line(DIAL_X, DIAL_Y, round(ex), round(ey), P["needle"])
    c.px(DIAL_X, DIAL_Y, P["tick"])
    return shapes(c.cells)


def emblem(c: Canvas) -> None:
    c.ellipse(6.5, 5.5, 5, 5, P["edge"])
    c.ellipse(6.5, 5.5, 4.2, 4.2, P["s2"])
    for y in range(2, 8):
        half = math.sqrt(max(0, 3.4**2 - (y - 6) ** 2))
        if y % 2 == 0 or y < 5:
            c.rect(round(6.5 - half), y, round(2 * half) + 1, 1, P["sun1"] if y < 5 else P["sun3"])
    c.rect(2, 8, 9, 1, P["grid"])


def build() -> dict:
    art = Art(NAME, W, PANEL_ROWS, BASE)
    c = Canvas(W, H)
    for draw in (sky, sun, mountains, ground, palms, car, dial_frame):
        draw(c)
    c.fade(66, 86)
    art.add(c)
    art.add(stars() + tail_glow() + road_dashes())
    art.add(MARKER)
    return {
        "base": BASE,
        "scene": art.svg(),
        "gauges": [gauge(i) for i in range(21)],
        "labelSvg": text(73, 55.5, GAUGE_NAME + " {{P}}%", 3.0, P["sun0"], 700, "middle", 0.2),
        "labelName": GAUGE_NAME,
        "strip": make_strip(NAME, BASE, P["edge"], emblem, [P["sun1"], P["grid"]]),
    }
