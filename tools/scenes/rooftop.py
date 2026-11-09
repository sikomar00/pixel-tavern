"""장면 11: 옥상 정원의 새벽 (아늑 / 새벽). 85칸 폭, 4배 확대. 해가 뜨는 도시 위 옥상, 줄 전구, 벤치 위 찻잔, 화분. 게이지는 화단에 꽃이 한 송이씩 핀다."""
from __future__ import annotations

import random

from artlib import Art, Canvas, MARKER, bayer, blink, frames, make_strip, shapes, text, PANEL_ROWS

W, H = 85, 96
NAME = "rooftop"
BASE = "#1c1830"
GAUGE_NAME = "컨텍스트"
P = {
    "sky0": "#1a1840", "sky1": "#3a2a6a", "sky2": "#8a4a8a", "sky3": "#e0708a", "sky4": "#ffb08a",
    "sun": "#ffe2a8", "sun_hi": "#fff4d0", "glow_a": "#c0607a", "glow_b": "#f08a80",
    "star": "#f4eeff", "far": "#4a3a6a", "near": "#2c2244", "near_hi": "#3a2e56", "win": "#ffd9a0", "win2": "#ff9ec2",
    "wall": "#3a2a4e", "wall_hi": "#5a4470", "wall_dk": "#2a1e3c", "floor": "#241c36", "floor2": "#2e2444", "joint": "#1a1428",
    "pole": "#4a3a58", "wire": "#6a5a78", "bulb": "#ffd36e", "bulb2": "#ff9ec2",
    "pot": "#b8553a", "pot_hi": "#d4704a", "pot_dk": "#7a3a2a", "leaf": "#3e8e5a", "leaf_hi": "#5fb87a", "leaf_dk": "#2a6a42",
    "seat": "#8a5a34", "seat_hi": "#a8744a", "leg": "#4a3020", "back": "#6e4628",
    "cup": "#f2ead8", "cup_dk": "#c8bca4", "steam": "#e8e0f4", "tea": "#8a4a2a",
    "soil": "#3a2a20", "box": "#6b4a2f", "box_hi": "#8a6240", "box_dk": "#3a2a1c", "stem": "#4fa86a",
    "f0": "#ff9ec2", "f1": "#ffd36e", "f2": "#c9a6ff", "f3": "#ff7a6a", "f4": "#fff1e0", "eye": "#ffe08a",
    "muted": "#c5b8dc", "edge": "#4a3a6a", "label": "#ffe6b8",
}
SUN_X, SUN_Y = 27, 41
BOX_X, BOX_Y = 46, 64  # 화단(게이지): 왼쪽 위 모서리
COLORS = ("f0", "f1", "f2", "f3", "f4")


def sky(c: Canvas) -> None:
    c.bands(0, 0, W, 44, [P["sky0"], P["sky1"], P["sky2"], P["sky3"], P["sky4"]])
    for x in range(W):  # 해 주변이 번지는 빛(점 무늬)
        for y in range(22, 46):
            d = ((x - SUN_X) / 30) ** 2 + ((y - SUN_Y) / 16) ** 2
            if d < 1 and bayer(x, y) < 11 * (1 - d):
                c.px(x, y, P["glow_b"] if d < 0.3 else P["glow_a"])
    c.ellipse(SUN_X + 0.5, SUN_Y, 8.5, 8.5, P["sun"])
    c.ellipse(SUN_X - 1.5, SUN_Y - 2.5, 3.2, 2.4, P["sun_hi"])


def skyline(c: Canvas) -> None:
    for x0, w, top in ((0, 9, 40), (9, 7, 36), (16, 10, 42), (44, 8, 39), (52, 10, 34), (62, 7, 40), (69, 9, 37), (78, 7, 41)):  # 먼 건물
        c.rect(x0, top, w, 52 - top, P["far"])
    for x0, w, top in ((3, 8, 46), (20, 9, 44), (38, 7, 47), (48, 9, 45), (66, 10, 46), (75, 9, 44)):  # 가까운 건물
        c.rect(x0, top, w, 52 - top, P["near"])
        c.rect(x0, top, w, 1, P["near_hi"])
    c.rect(55, 29, 1, 5, P["far"])  # 안테나
    c.px(55, 29, P["bulb2"])


def wall(c: Canvas) -> None:
    c.rect(0, 50, W, 7, P["wall"])
    c.rect(0, 50, W, 1, P["wall_hi"])
    c.rect(0, 56, W, 1, P["wall_dk"])
    for y in (52, 54):  # 벽돌 줄눈
        for x in range((y // 2) % 2 * 3, W, 6):
            c.px(x, y, P["wall_dk"])


def floor(c: Canvas) -> None:
    c.rect(0, 57, W, 30, P["floor"])
    for y in range(58, 88, 6):
        c.rect(0, y, W, 1, P["joint"])
    for x in range(0, W, 10):
        for y in range(57, 88):
            if bayer(x, y) < 3:
                c.px(x, y, P["floor2"])
    for x in range(W):  # 새벽빛이 바닥에 비친다
        for y in range(57, 70):
            d = ((x - SUN_X) / 26) ** 2 + ((y - 58) / 8) ** 2
            if d < 1 and bayer(x, y) < 6 * (1 - d):
                c.px(x, y, P["floor2"])


def poles(c: Canvas) -> None:
    for x in (3, 81):
        c.rect(x, 20, 2, 38, P["pole"])
        c.px(x, 19, P["wire"])


def wire_points() -> list[tuple[int, int]]:
    """왼쪽 기둥 꼭대기에서 오른쪽 기둥까지 아래로 처지는 줄(포물선)."""
    pts = []
    for x in range(4, 82):
        t = (x - 4) / 77
        pts.append((x, round(21 + 3 * t + 9 * 4 * t * (1 - t))))
    return pts


def string_lights(c: Canvas) -> None:
    for x, y in wire_points():
        c.px(x, y, P["wire"])


def bulbs() -> str:
    pts = wire_points()
    out = []
    for i, (x, y) in enumerate(pts[3::6]):
        color = P["bulb"] if i % 2 == 0 else P["bulb2"]
        out.append(blink(x, y + 1, 1, 2, color, "1;0.55;1;1", 2.6 + i % 3 * 0.4, i * 0.5))
    return "".join(out)


def plant(c: Canvas) -> None:
    c.rect(5, 60, 13, 3, P["pot"])  # 화분
    c.rect(6, 63, 11, 5, P["pot"])
    c.rect(5, 60, 13, 1, P["pot_hi"])
    c.rect(6, 67, 11, 1, P["pot_dk"])
    c.rect(7, 64, 1, 3, P["pot_hi"])
    for cx, cy, rx, ry, color in ((11, 54, 7, 5, P["leaf"]), (7, 49, 5, 4, P["leaf_dk"]), (15, 48, 6, 4, P["leaf"]), (11, 44, 4, 4, P["leaf_hi"]), (4, 55, 3, 3, P["leaf_dk"]), (18, 55, 3, 3, P["leaf_dk"])):
        c.ellipse(cx, cy, rx, ry, color)
    for x, y in ((9, 52), (13, 47), (6, 48), (16, 52), (11, 43), (12, 56)):  # 잎맥
        c.px(x, y, P["leaf_hi"])
    c.rect(11, 56, 1, 4, P["leaf_dk"])


def bench(c: Canvas) -> None:
    c.rect(24, 54, 22, 1, P["back"])  # 등받이
    c.rect(24, 56, 22, 1, P["back"])
    c.rect(24, 54, 1, 9, P["leg"])
    c.rect(45, 54, 1, 9, P["leg"])
    c.rect(23, 59, 24, 2, P["seat"])  # 앉는 판
    c.rect(23, 59, 24, 1, P["seat_hi"])
    c.rect(25, 61, 2, 5, P["leg"])
    c.rect(43, 61, 2, 5, P["leg"])
    c.rect(34, 56, 4, 3, P["cup"])  # 찻잔
    c.rect(34, 58, 4, 1, P["cup_dk"])
    c.rect(34, 56, 4, 1, P["tea"])
    c.px(38, 57, P["cup"])
    c.px(39, 57, P["cup_dk"])


def steam() -> str:
    bodies = []
    for k, drift in enumerate(((0, 1, 0), (1, 0, 1), (0, 1, 1))):
        c = Canvas(W, H)
        for t, dx in enumerate(drift):
            c.px(35 + dx + (t % 2), 54 - t * 2, P["steam"])
            c.px(36 + dx, 53 - t * 2, P["steam"])
        bodies.append(shapes(c.cells))
    return frames(bodies, 3.0, 0.2)


def twinkles() -> str:
    rng = random.Random(11)
    out = []
    for i in range(14):
        x, y = rng.randrange(2, W - 2), rng.randrange(1, 17)
        if i % 2 == 0:
            out.append(blink(x, y, 1, 1, P["star"], "1;0.3;1;1", 3 + i % 3, i * 0.41))
        else:
            out.append(f'<rect x="{x}" y="{y}" width="1" height="1" fill="{P["star"]}" fill-opacity=".6"/>')
    for i, (x, y) in enumerate(((5, 44), (22, 46), (40, 48), (52, 41), (70, 40), (80, 45), (13, 49), (58, 47))):  # 건물 창문 불빛
        out.append(blink(x, y, 1, 1, P["win"] if i % 3 else P["win2"], "1;1;0.2;1", 4 + i % 3, i * 0.7))
    return "".join(out)


def halo() -> str:
    values = ".10;.16;.09;.13"

    return (
        f'<ellipse cx="{SUN_X + 0.5}" cy="{SUN_Y}" rx="15" ry="9" fill="{P["sun"]}" fill-opacity="{values.split(";")[0]}">'
        f'<animate attributeName="fill-opacity" values="{values}" dur="3.6s" begin="-0.8s" calcMode="discrete" repeatCount="indefinite"/></ellipse>'
    )


def flower_pos(index: int) -> tuple[int, int, int]:
    """꽃 번호(0부터)의 (머리 왼쪽 x, 머리 위쪽 y, 줄). 번호가 짝수면 앞줄, 홀수면 뒷줄이고 왼쪽에서 오른쪽으로 핀다."""
    col, row = divmod(index, 2)
    x = BOX_X + 2 + round(col * 3.6) + (2 if row else 0)
    return x, (BOX_Y - 7 if row else BOX_Y - 4), row


def gauge(level: int) -> str:
    """컨텍스트 게이지: 화단. 쓴 만큼 꽃이 한 송이씩 핀다(20송이면 가득)."""
    c = Canvas(W, H)
    c.rect(BOX_X, BOX_Y, 38, 1, P["box_hi"])  # 화단 테두리·흙·몸통
    c.rect(BOX_X + 1, BOX_Y + 1, 36, 1, P["soil"])
    c.rect(BOX_X, BOX_Y + 2, 38, 5, P["box"])
    c.rect(BOX_X, BOX_Y + 7, 38, 1, P["box_dk"])
    for x in range(BOX_X + 6, BOX_X + 38, 8):
        c.rect(x, BOX_Y + 2, 1, 5, P["box_dk"])
    for index in sorted(range(level), key=lambda i: -(i % 2)):  # 뒷줄을 먼저 그려 앞줄이 위에 놓이게
        x, y, row = flower_pos(index)
        color = P[COLORS[(index // 2) % len(COLORS)]]
        c.rect(x + 1, y + 3, 1, BOX_Y + 1 - (y + 3), P["stem"])
        c.rect(x, y, 3, 3, color)
        c.px(x + 1, y + 1, P["eye"] if color != P["f1"] else P["f3"])
        c.px(x + 2 + (row == 0), y + 4, P["stem"])  # 잎 한 장
    return shapes(c.cells)


def emblem(c: Canvas) -> None:
    c.ellipse(6.5, 5.5, 5, 5, P["edge"])
    c.ellipse(6.5, 5.5, 4.2, 4.2, P["sky1"])
    c.rect(2, 8, 9, 1, P["near"])
    c.ellipse(6.5, 7.5, 2.4, 1.6, P["sun"])
    c.rect(6, 5, 1, 4, P["stem"])
    c.rect(4, 6, 2, 1, P["leaf_hi"])
    c.rect(7, 5, 2, 1, P["leaf_hi"])
    c.px(6, 4, P["f0"])


def build() -> dict:
    art = Art(NAME, W, PANEL_ROWS, BASE)
    c = Canvas(W, H)
    for draw in (sky, skyline, wall, floor, poles, string_lights, plant, bench):
        draw(c)
    c.fade(64, 86)
    art.add(c)
    art.add(halo() + twinkles() + bulbs() + steam())
    art.add(MARKER)
    return {
        "base": BASE,
        "scene": art.svg(),
        "gauges": [gauge(i) for i in range(21)],
        "labelSvg": text(65, 55, GAUGE_NAME + " {{P}}%", 3.0, P["label"], 700, "middle", 0.2),
        "labelName": GAUGE_NAME,
        "strip": make_strip(NAME, BASE, P["edge"], emblem, [P["bulb"], P["bulb2"]]),
    }
