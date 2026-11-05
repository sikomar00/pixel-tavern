"""장면 5: 재즈 바 (아늑 / 밤). 85칸 폭, 4배 확대. 무대의 조명 아래 색소폰과 콘트라베이스, 네온 간판, 바 카운터의 칵테일 잔."""
from __future__ import annotations

import math

from artlib import Art, Canvas, MARKER, bayer, blink, frames, make_strip, shapes, text, PANEL_ROWS

W, H = 85, 96
NAME = "jazz"
BASE = "#24101c"
GAUGE_NAME = "컨텍스트"
P = {
    "wall_a": "#24101c", "wall_b": "#2e1626", "wall_c": "#190b13",
    "cur_a": "#4a1828", "cur_b": "#5e2236", "cur_c": "#34111d",
    "beam_a": "#7a3a4c", "beam_b": "#8e4659", "beam_c": "#5a2a3a",
    "floor_a": "#2b1a1e", "floor_b": "#3a2428", "floor_hi": "#4d3135",
    "stage": "#4a2a22", "stage_hi": "#6e4034", "stage_dk": "#2f1b16",
    "wood0": "#1a0f0c", "wood1": "#3b2418", "wood2": "#5a3824", "wood_hi": "#80543a",
    "brass": "#d9a441", "brass_hi": "#f6d27a", "brass_dk": "#8a6422",
    "teal": "#4fc3c3", "teal_hi": "#a6ece6", "teal_dk": "#2a7b80",
    "spot": "#ffe9b0", "black": "#0c070b",
    "glass": "#9fd0da", "glass_hi": "#e8f6f8", "halo": "#ffd38a",
    "bass": "#6b3a22", "bass_hi": "#93593a", "bass_dk": "#3e2013",
    "muted": "#c9a9bd", "edge": "#5a2a44",
}
BOTTLES = ["#2f7f5e", "#a3483a", "#c99a2e", "#3b5ba5", "#6a3a7a", "#2f7f5e", "#b3643a"]
GLYPHS = {
    "J": ["..#", "..#", "..#", "#.#", ".#."],
    "A": [".#.", "#.#", "###", "#.#", "#.#"],
    "Z": ["###", "..#", ".#.", "#..", "###"],
}
BOWL_TOP, BOWL_ROWS, GLASS_CX = 34, 7, 75  # 칵테일 잔: 위에서부터 7줄의 V자 사발


def wall(c: Canvas) -> None:
    c.rect(0, 0, W, 50, P["wall_a"])
    for x in range(0, W, 14):  # 벽 판넬의 이음 줄
        c.rect(x, 5, 1, 44, P["wall_b"])
    for x in range(7, W, 14):
        for y in range(8, 48, 6):
            c.px(x, y, P["wall_c"])
    c.rect(0, 0, W, 4, P["wood0"])  # 천장 보
    c.rect(0, 4, W, 1, P["wood1"])
    c.rect(0, 49, W, 1, P["wood1"])  # 벽과 바닥의 경계


def floor(c: Canvas) -> None:
    c.rect(0, 50, W, 24, P["floor_a"])
    for y in (53, 57, 62, 68):
        c.rect(0, y, W, 1, P["floor_b"])
    for x in range(3, W, 11):  # 마룻바닥 이음
        for y0, y1 in ((50, 53), (54, 57), (58, 62), (63, 68), (69, 74)):
            if (x + y0) % 3 == 0:
                c.rect(x, y0, 1, y1 - y0, P["floor_b"])
    c.rect(0, 50, W, 1, P["floor_hi"])


def curtain(c: Canvas) -> None:
    """무대 뒤 커튼: 세로 주름, 위에서 스포트라이트가 비친다."""
    for x in range(2, 47):
        tone = (P["cur_b"], P["cur_a"], P["cur_c"], P["cur_a"])[(x // 2) % 4]
        c.rect(x, 6, 1, 38, tone)
    c.rect(2, 6, 45, 1, P["cur_c"])
    light = {P["cur_a"]: P["beam_a"], P["cur_b"]: P["beam_b"], P["cur_c"]: P["beam_c"]}
    for y in range(8, 44):  # 가운데 위에서 아래로 퍼지는 빛줄기(점 무늬로 흐려진다)
        half = 3 + (y - 8) * 0.42
        for x in range(int(24 - half), int(24 + half) + 1):
            if (x, y) in c.cells and bayer(x, y) < 5 - int(abs(x - 24) / max(half, 1) * 4):
                c.px(x, y, light.get(c.cells[(x, y)], c.cells[(x, y)]))
    c.rect(20, 2, 9, 3, P["black"])  # 조명 기구
    c.rect(22, 4, 5, 2, P["spot"])


def stage(c: Canvas) -> None:
    c.rect(2, 44, 45, 7, P["stage"])
    c.rect(2, 44, 45, 1, P["stage_hi"])
    c.rect(2, 50, 45, 1, P["stage_dk"])
    for x in range(6, 46, 8):
        c.rect(x, 45, 1, 5, P["stage_dk"])
    for x in range(13, 36):  # 바닥에 떨어진 빛 웅덩이
        if bayer(x, 45) < 9 - int(abs(x - 24) * 0.6):
            c.px(x, 45, P["stage_hi"])


def sax(c: Canvas) -> None:
    """스탠드에 세운 색소폰: 목, 몸통, 나팔."""
    c.line(12, 44, 14, 38, P["black"])  # 스탠드(삼각대)
    c.line(16, 44, 14, 38, P["black"])
    c.rect(14, 37, 1, 2, P["black"])
    c.rect(13, 25, 3, 13, P["brass"])  # 몸통
    c.rect(13, 25, 1, 13, P["brass_hi"])
    c.rect(15, 25, 1, 13, P["brass_dk"])
    c.line(14, 25, 18, 21, P["brass"], 2)  # 목
    c.rect(18, 19, 3, 2, P["black"])  # 마우스피스
    c.ellipse(17, 38, 4.2, 3.2, P["brass"])  # 나팔
    c.ellipse(17, 38, 3, 2.1, P["black"])
    c.px(14, 36, P["brass_hi"])
    for y in range(27, 36, 2):  # 키
        c.px(14, y, P["brass_hi"])


def bass(c: Canvas) -> None:
    """콘트라베이스: 윗몸통·아랫몸통, 긴 목, F자 구멍."""
    c.ellipse(36, 39, 6.4, 5.8, P["bass"])
    c.ellipse(36, 31, 4.4, 4.2, P["bass"])
    c.rect(34, 33, 5, 3, P["bass"])
    c.rect(36, 12, 2, 20, P["wood1"])  # 목
    c.rect(35, 10, 4, 3, P["wood2"])  # 머리
    c.px(34, 11, P["brass"])
    c.px(39, 11, P["brass"])
    c.ellipse(34, 38, 1.5, 3, P["bass_hi"])  # 빛 받는 쪽
    c.line(34, 36, 34, 41, P["bass_dk"])  # F자 구멍
    c.line(38, 36, 38, 41, P["bass_dk"])
    for x in (36, 37):  # 줄
        c.rect(x, 13, 1, 26, P["brass_hi"] if x == 36 else P["brass_dk"])
    c.rect(35, 45, 3, 1, P["black"])  # 엔드핀
    c.rect(36, 44, 1, 2, P["black"])


def sign(c: Canvas) -> list[tuple[int, int]]:
    """네온 간판 JAZZ(3x5 글자를 2배로)."""
    cells = []
    x0 = 51
    for letter in "JAZZ":
        for gy, row in enumerate(GLYPHS[letter]):
            for gx, ch in enumerate(row):
                if ch == "#":
                    cells.extend((x0 + gx * 2 + dx, 10 + gy * 2 + dy) for dx in (0, 1) for dy in (0, 1))
        x0 += 8
    return cells


def shelves(c: Canvas) -> None:
    for shelf_y, top in ((36, 29), (45, 38)):
        c.rect(51, shelf_y, 33, 1, P["wood2"])
        c.rect(51, shelf_y + 1, 33, 1, P["wood0"])
        for i, x in enumerate(range(53, 83, 4)):
            color = BOTTLES[(i + shelf_y) % len(BOTTLES)]
            height = 5 + (i * 3 + shelf_y) % 3
            c.rect(x, shelf_y - height, 3, height, color)
            c.rect(x + 1, shelf_y - height - 2, 1, 2, color)  # 병목
            c.px(x, shelf_y - height + 1, P["glass_hi"])  # 반짝임
    c.rect(49, 28, 2, 20, P["wood1"])  # 선반 옆 기둥
    c.rect(84, 28, 1, 20, P["wood1"])


def counter(c: Canvas) -> None:
    c.rect(50, 47, 35, 2, P["wood2"])
    c.rect(50, 47, 35, 1, P["wood_hi"])
    c.rect(50, 49, 35, 17, P["wood1"])
    for x in range(53, 85, 8):
        c.rect(x, 51, 1, 13, P["wood0"])
    c.rect(50, 64, 35, 1, P["brass_dk"])  # 발 받침대
    c.rect(50, 65, 35, 1, P["wood0"])
    for x in (56, 63):  # 잔
        c.rect(x, 44, 3, 3, P["glass"])
        c.px(x, 44, P["glass_hi"])


def cocktail_glass(c: Canvas) -> None:
    """게이지가 담기는 칵테일 잔(빈 잔)."""
    cx = GLASS_CX
    for k in range(BOWL_ROWS):
        half = 7 - k
        y = BOWL_TOP + k
        c.px(cx - half, y, P["glass"])
        c.px(cx + half, y, P["glass"])
    c.rect(cx - 7, BOWL_TOP, 15, 1, P["glass_hi"])  # 잔의 윗테두리
    c.px(cx, BOWL_TOP + BOWL_ROWS - 1, P["glass"])
    c.rect(cx, BOWL_TOP + BOWL_ROWS, 1, 5, P["glass"])  # 줄기
    c.rect(cx - 3, BOWL_TOP + BOWL_ROWS + 5, 7, 1, P["glass"])  # 받침
    c.px(cx - 6, BOWL_TOP + 1, P["glass_hi"])


def table(c: Canvas) -> None:
    c.ellipse(14, 59, 11, 2.4, P["wood2"])
    c.ellipse(14, 58, 11, 2.0, P["wood_hi"])
    c.rect(13, 61, 3, 7, P["wood1"])
    c.rect(9, 68, 11, 1, P["wood0"])
    c.rect(13, 54, 3, 4, P["glass"])  # 촛불 유리등
    c.rect(14, 51, 1, 3, P["brass_hi"])
    c.px(14, 50, P["spot"])


def flicker(body: str, values: str, dur: float, begin: float) -> str:
    """덩어리를 통째로 깜박인다(네온 간판처럼)."""
    return (
        f'<g><animate attributeName="opacity" values="{values}" dur="{dur:g}s" begin="-{begin:g}s" '
        f'calcMode="discrete" repeatCount="indefinite"/>{body}</g>'
    )


def halo(cx: float, cy: float, rx: float, ry: float, color: str, values: str, dur: float, begin: float) -> str:
    return (
        f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="{color}" fill-opacity="{values.split(";")[0]}">'
        f'<animate attributeName="fill-opacity" values="{values}" dur="{dur:g}s" begin="-{begin:g}s" '
        'calcMode="discrete" repeatCount="indefinite"/></ellipse>'
    )


def sign_layer(cells: list[tuple[int, int]]) -> str:
    glow = Canvas(W, H)
    for (x, y) in cells:
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            if (x + dx, y + dy) not in cells:
                glow.px(x + dx, y + dy, P["teal_dk"])
    lit = Canvas(W, H)
    for (x, y) in cells:
        lit.px(x, y, P["teal_hi"] if (x + y) % 5 == 0 else P["teal"])
    line = Canvas(W, H)
    line.rect(51, 22, 30, 1, P["teal_dk"])
    return shapes(glow.cells) + flicker(shapes(lit.cells), "1;1;0.55;1;1;0.8;1", 3.4, 0.6) + shapes(line.cells)


def notes() -> str:
    """색소폰 나팔에서 위로 떠오르는 음표(자리를 옮겨 가며 나타난다)."""
    path = [(22, 34), (24, 30), (26, 26), (28, 22), (30, 19)]
    bodies = []
    for x, y in path:
        c = Canvas(W, H)
        c.ellipse(x, y + 4, 1.8, 1.3, P["teal_hi"])
        c.rect(x + 1, y - 1, 1, 5, P["teal_hi"])
        c.px(x + 2, y - 1, P["teal_hi"])
        c.px(x + 3, y, P["teal_hi"])
        bodies.append(shapes(c.cells))
    return frames(bodies, 2.5, 0.2)


def gauge(level: int) -> str:
    """컨텍스트 게이지: 칵테일 잔. 쓴 만큼 아래에서부터 차오르고, 차 있으면 기포가 반짝인다."""
    rows = round(BOWL_ROWS * level * 5 / 100)
    if rows == 0:
        return ""
    c = Canvas(W, H)
    cx = GLASS_CX
    for i in range(rows):  # i=0 이 맨 아래 줄
        k = BOWL_ROWS - 1 - i
        inner = max(0, 7 - k - 1)
        y = BOWL_TOP + k
        c.rect(cx - inner, y, 2 * inner + 1, 1, P["teal_hi"] if i == rows - 1 else P["teal"])
    bubbles = blink(cx - 1, BOWL_TOP + BOWL_ROWS - 2, 1, 1, P["glass_hi"], "1;0;0;1", 2.0, 0.3) if rows >= 2 else ""
    return shapes(c.cells) + bubbles


def emblem(c: Canvas) -> None:
    c.ellipse(6.5, 5.5, 5, 5, P["edge"])
    c.ellipse(6.5, 5.5, 4.2, 4.2, P["black"])
    c.ellipse(5.4, 7.2, 1.7, 1.2, P["teal"])  # 음표
    c.rect(6, 2, 1, 6, P["teal"])
    c.px(7, 2, P["teal"])
    c.px(8, 3, P["teal"])


def build() -> dict:
    art = Art(NAME, W, PANEL_ROWS, BASE)
    c = Canvas(W, H)
    for draw in (wall, floor, curtain, stage, bass, sax, shelves, counter, cocktail_glass, table):
        draw(c)
    cells = sign(c)
    c.fade(64, 86)
    art.add(c)
    art.add(sign_layer(cells))
    art.add(
        halo(66, 14, 17, 7, P["teal"], ".07;.11;.05;.09", 3.4, 0.6)
        + halo(14.5, 52, 8, 5, P["halo"], ".12;.16;.10;.14", 2.2, 0.7)
        + blink(14, 27, 1, 1, P["glass_hi"], "1;0;1;1", 2.8, 0.9)
        + notes()
    )
    art.add(MARKER)
    return {
        "base": BASE,
        "scene": art.svg(),
        "gauges": [gauge(i) for i in range(21)],
        "labelSvg": text(67, 25.5, GAUGE_NAME + " {{P}}%", 3.0, P["teal"], 700, "middle", 0.2),
        "labelName": GAUGE_NAME,
        "strip": make_strip(NAME, BASE, P["edge"], emblem, [P["teal"], P["brass"]]),
    }
