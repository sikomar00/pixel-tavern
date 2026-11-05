"""장면 10: 우주 정거장 (모험 / 우주). 85칸 폭, 4배 확대. 창밖의 지구와 별, 둥근 창틀, 아래의 관제 콘솔. 게이지는 산소 튜브."""
from __future__ import annotations

import math
import random

from artlib import Art, Canvas, MARKER, bayer, blink, frames, make_strip, shapes, text, PANEL_ROWS

W, H = 85, 96
NAME = "station"
BASE = "#06121f"
GAUGE_NAME = "컨텍스트"
P = {
    "space0": "#02060e", "space1": "#06121f", "star": "#f3f8ff", "star_b": "#a9d6ff",
    "ocean0": "#0c3a6a", "ocean1": "#1558a0", "ocean2": "#2a7cc8", "ocean3": "#5aa8e8", "rim": "#9fd8ff", "cloud": "#e8f4ff",
    "land": "#2f7a4a", "land2": "#4a9a5a", "night": "#06182e", "city": "#ffd36e",
    "hull": "#2a3a4a", "hull_hi": "#4a5e72", "hull_dk": "#16222e", "rivet": "#8aa0b4", "frame": "#5a7088",
    "con": "#101c28", "con_hi": "#22384c", "led_g": "#5cff8a", "led_y": "#ffe14d", "led_r": "#ff5a5a", "led_c": "#4fd1ff",
    "scr": "#041018", "scr_g": "#5cff8a", "scr_c": "#4fd1ff",
    "tube": "#9fd0e0", "tube_hi": "#e8f6f8", "fluid": "#4fd1ff", "fluid_hi": "#b8f0ff", "tube_dk": "#16303e",
    "sat": "#c9d2e6", "sat_p": "#4a7ad0", "black": "#02060e",
    "muted": "#a9c1d9", "edge": "#2a4a6a",
}
EARTH = (42, 80, 42)  # 지구의 중심 x, y, 반지름(창 아래쪽에 큰 호가 걸쳐 보인다)
TUBE_X, TUBE_TOP, TUBE_ROWS = 76, 22, 20  # 산소 튜브: 왼쪽 x, 맨 위 y, 칸 수(한 단계에 한 줄)


def space(c: Canvas) -> None:
    c.bands(0, 0, W, 62, [P["space0"], P["space0"], P["space1"]])


def earth(c: Canvas) -> None:
    cx, cy, r = EARTH
    rng = random.Random(4)
    for y in range(cy - r, 66):
        for x in range(cx - r, cx + r + 1):
            d = math.hypot(x - cx, y - cy)
            if d > r or not (0 <= x < W):
                continue
            t = (cy - y) / r  # 위쪽(가장자리)일수록 밝다
            shade = P["ocean0"] if t < 0.80 else P["ocean1"] if t < 0.90 else P["ocean2"] if t < 0.96 else P["ocean3"]
            if d > r - 1.2:
                shade = P["rim"]  # 대기층 가장자리의 얇은 빛
            if bayer(x, y) < 3 and d < r - 3:
                shade = P["ocean1"] if shade == P["ocean0"] else shade
            c.px(x, y, shade)
    for _ in range(26):  # 구름과 육지
        x, y = rng.randrange(14, 72), rng.randrange(48, 60)
        if math.hypot(x - cx, y - cy) < EARTH[2] - 4:
            color = P["cloud"] if rng.random() < 0.6 else P["land"]
            c.rect(x, y, rng.choice((2, 3, 4)), 1, color)
    for x, y in ((24, 54), (30, 51), (55, 52), (62, 55), (40, 57), (48, 54)):  # 어두운 쪽의 도시 불빛
        if math.hypot(x - cx, y - cy) < EARTH[2] - 2:
            c.px(x, y, P["city"])


def hull(c: Canvas) -> None:
    """둥근 창 바깥의 선체와 창틀."""
    cx, cy, rx, ry = 42.5, 30, 30, 28
    for y in range(74):  # 창 바깥은 선체
        for x in range(W):
            if not (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1 and y < 60):
                c.px(x, y, P["hull"])
    for i in range(0, 360, 6):  # 창틀 고리
        a = math.radians(i)
        for t in (0, 1):
            x, y = cx + (rx + 1 + t) * math.cos(a), cy + (ry + 1 + t) * math.sin(a)
            if 0 <= y < 60:
                c.px(round(x), round(y), P["frame"] if t else P["hull_hi"])
    for i in range(0, 360, 20):  # 리벳
        a = math.radians(i)
        x, y = cx + (rx + 4) * math.cos(a), cy + (ry + 4) * math.sin(a)
        if 0 <= x < W and 0 <= y < 60:
            c.px(round(x), round(y), P["rivet"])
    c.rect(0, 0, W, 2, P["hull_dk"])
    for x in range(0, W, 14):
        c.rect(x, 0, 1, 74, P["hull_dk"])
    c.rect(0, 60, W, 14, P["con"])  # 콘솔 면


def console(c: Canvas) -> None:
    c.rect(0, 59, W, 2, P["hull_hi"])
    c.rect(0, 61, W, 13, P["con"])
    for x in range(4, 80, 20):  # 작은 모니터 세 개
        c.rect(x, 63, 16, 8, P["hull_dk"])
        c.rect(x + 1, 64, 14, 6, P["scr"])
    for i in range(10):  # 스위치 줄
        c.rect(4 + i * 8, 72, 2, 1, P["con_hi"])


def tube_frame(c: Canvas) -> None:
    x = TUBE_X
    c.rect(x - 2, TUBE_TOP - 3, 8, TUBE_ROWS + 6, P["hull_dk"])
    c.rect(x - 1, TUBE_TOP - 2, 6, TUBE_ROWS + 4, P["tube_dk"])
    c.rect(x, TUBE_TOP, 4, TUBE_ROWS, P["black"])
    c.rect(x - 1, TUBE_TOP - 2, 6, 1, P["tube"])
    c.rect(x - 1, TUBE_TOP + TUBE_ROWS + 1, 6, 1, P["tube"])
    c.rect(x, TUBE_TOP, 1, TUBE_ROWS, P["tube_hi"])  # 유리의 빛
    for i in range(0, TUBE_ROWS, 5):
        c.px(x + 5, TUBE_TOP + i, P["rivet"])


def gauge(level: int) -> str:
    """컨텍스트 게이지: 산소 튜브. 쓴 만큼 아래에서부터 차오르고 기포가 오른다."""
    c = Canvas(W, H)
    for i in range(level):
        y = TUBE_TOP + TUBE_ROWS - 1 - i
        c.rect(TUBE_X + 1, y, 3, 1, P["fluid_hi"] if i == level - 1 else P["fluid"])
    bubble = blink(TUBE_X + 2, TUBE_TOP + TUBE_ROWS - level, 1, 1, P["tube_hi"], "1;0;0;1", 1.6, 0.2) if 1 < level < 20 else ""
    return shapes(c.cells) + bubble


def stars() -> str:
    rng = random.Random(31)
    out = []
    for i in range(34):
        x, y = rng.randrange(14, 72), rng.randrange(4, 50)
        if math.hypot(x - EARTH[0], y - EARTH[1]) < EARTH[2] + 2:
            continue
        color = P["star"] if i % 3 else P["star_b"]
        if i % 3 == 0:
            out.append(blink(x, y, 1, 1, color, "1;0.3;1;1", 2.5 + i % 4, i * 0.31))
        else:
            out.append(f'<rect x="{x}" y="{y}" width="1" height="1" fill="{color}" fill-opacity=".8"/>')
    return "".join(out)


def satellite() -> str:
    path = [(20, 24), (27, 22), (34, 21), (41, 20), (48, 21)]
    bodies = []
    for x, y in path:
        c = Canvas(W, H)
        c.rect(x, y, 2, 2, P["sat"])
        c.rect(x - 3, y, 2, 1, P["sat_p"])
        c.rect(x + 3, y, 2, 1, P["sat_p"])
        bodies.append(shapes(c.cells))
    return frames(bodies, 7.0, 0.0)


def lights() -> str:
    out = []
    for i, x in enumerate(range(4, 80, 20)):
        colors = (P["led_g"], P["led_c"], P["led_y"])
        for j in range(5):  # 모니터 안의 막대 그래프
            out.append(blink(x + 2 + j * 2, 65, 1, 4, colors[(i + j) % 3], "1;0.4;1;0.7", 1.4 + j * 0.2, i * 0.3 + j * 0.15))
    for i in range(10):
        out.append(blink(4 + i * 8, 71, 2, 1, P["led_r"] if i % 4 == 0 else P["led_g"], "1;0.3;1;1", 2 + i % 3, i * 0.2))
    return "".join(out)


def emblem(c: Canvas) -> None:
    c.ellipse(6.5, 5.5, 5, 5, P["edge"])
    c.ellipse(6.5, 5.5, 4.2, 4.2, P["space0"])
    c.ellipse(6.5, 8.5, 4.5, 3.2, P["ocean1"])
    c.rect(2, 7, 9, 1, P["rim"])
    c.px(8, 3, P["star"])
    c.px(4, 4, P["star_b"])


def build() -> dict:
    art = Art(NAME, W, PANEL_ROWS, BASE)
    c = Canvas(W, H)
    space(c)
    earth(c)
    hull(c)
    console(c)
    tube_frame(c)
    c.fade(66, 86)
    art.add(c)
    art.add(stars() + satellite() + lights())
    art.add(MARKER)
    return {
        "base": BASE,
        "scene": art.svg(),
        "gauges": [gauge(i) for i in range(21)],
        "labelSvg": text(42, 58.5, GAUGE_NAME + " {{P}}%", 3.0, P["star"], 700, "middle", 0.2),
        "labelName": GAUGE_NAME,
        "strip": make_strip(NAME, BASE, P["edge"], emblem, [P["led_c"], P["star"]]),
    }
