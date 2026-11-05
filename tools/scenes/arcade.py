"""장면 8: 오락실 (모험 / 밤). 85칸 폭, 4배 확대. 네온 GAME 간판, 불빛이 도는 오락기 세 대. 게이지는 LED 막대."""
from __future__ import annotations

from artlib import Art, Canvas, MARKER, bayer, blink, frames, make_strip, shapes, text, PANEL_ROWS

W, H = 85, 96
NAME = "arcade"
BASE = "#0a1530"
GAUGE_NAME = "컨텍스트"
P = {
    "wall": "#0a1530", "wall2": "#0f1d42", "wall3": "#070f24",
    "floor": "#150f2e", "floor2": "#231a4a", "floor3": "#3a2a7a",
    "cab": "#2a1a5a", "cab_hi": "#4a30a0", "cab_dk": "#160c34", "side": "#ff4f6d", "side2": "#ffe14d",
    "mar_a": "#ffe14d", "mar_b": "#ff4f6d", "mar_c": "#4fd1ff",
    "screen": "#06140f", "scr_g": "#5cff8a", "scr_g2": "#2fa85a", "scr_r": "#ff5a5a", "scr_c": "#4fd1ff", "scr_y": "#ffe14d",
    "panel": "#3a3a52", "panel_dk": "#22223a", "ball": "#ff4f6d", "stick": "#c9c9d6", "btn_a": "#ffe14d", "btn_b": "#4fd1ff", "btn_c": "#ff4f6d",
    "slot": "#ffcf33", "black": "#05050a",
    "neon": "#ff4fd8", "neon_hi": "#ffc0f2", "neon_dk": "#7a2a78", "teal": "#4fd1ff",
    "led_off": "#1a2548", "led_g": "#5cff8a", "led_y": "#ffe14d", "led_r": "#ff5a5a", "led_frame": "#3a4a8a",
    "muted": "#9fb4e6", "edge": "#3a4a8a",
}
GLYPHS = {
    "G": ["###", "#..", "#.#", "#.#", "###"],
    "A": [".#.", "#.#", "###", "#.#", "#.#"],
    "M": ["#.#", "###", "###", "#.#", "#.#"],
    "E": ["###", "#..", "##.", "#..", "###"],
}
CABS = (2, 31, 60)  # 오락기 세 대의 왼쪽 x(폭 22)
CAB_TOP = 24
LED_X, LED_Y = 22, 15  # LED 막대 20칸(칸마다 폭 2, 사이 1)


def wall(c: Canvas) -> None:
    c.rect(0, 0, W, 66, P["wall"])
    for x in range(0, W, 10):
        c.rect(x, 0, 1, 66, P["wall2"])
    for y in (6, 40):
        c.rect(0, y, W, 1, P["wall3"])
    c.rect(0, 0, W, 2, P["wall3"])


def floor(c: Canvas) -> None:
    c.rect(0, 66, W, 8, P["floor"])
    for x in range(W):  # 카펫 무늬: 비스듬한 줄
        for y in range(66, 74):
            if (x + y * 2) % 7 == 0:
                c.px(x, y, P["floor2"])
            elif (x - y * 2) % 11 == 0:
                c.px(x, y, P["floor3"])
    c.rect(0, 66, W, 1, P["edge"])


def sign(c: Canvas) -> list[tuple[int, int]]:
    cells: list[tuple[int, int]] = []
    x0 = 28
    for letter in "GAME":
        for gy, row in enumerate(GLYPHS[letter]):
            for gx, ch in enumerate(row):
                if ch == "#":
                    cells.extend((x0 + gx * 2 + dx, 3 + gy * 2 + dy) for dx in (0, 1) for dy in (0, 1))
        x0 += 8
    return cells


def cabinet(c: Canvas, x: int, art: int) -> None:
    w, top = 22, CAB_TOP
    c.rect(x, top, w, 42, P["cab"])
    c.rect(x, top, 1, 42, P["cab_hi"])
    c.rect(x + w - 1, top, 1, 42, P["cab_dk"])
    c.rect(x + 3, top + 1, w - 6, 5, P["black"])  # 마키(위 간판 칸)
    colors = (P["mar_a"], P["mar_b"], P["mar_c"])
    for i in range(w - 8):
        c.rect(x + 4 + i, top + 2, 1, 3, colors[(i // 3 + art) % 3])
    c.rect(x + 3, top + 8, w - 6, 15, P["panel_dk"])  # 화면 틀
    c.rect(x + 4, top + 9, w - 8, 13, P["screen"])
    c.rect(x + 1, top + 24, w - 2, 7, P["panel"])  # 조작판
    c.rect(x + 1, top + 24, w - 2, 1, P["cab_hi"])
    c.rect(x + 5, top + 26, 1, 3, P["stick"])
    c.ellipse(x + 5.5, top + 25.5, 1.6, 1.6, P["ball"])  # 조이스틱
    for i, color in enumerate((P["btn_a"], P["btn_b"], P["btn_c"])):
        c.rect(x + 10 + i * 3, top + 27, 2, 2, color)
    c.rect(x + 8, top + 33, 6, 3, P["black"])  # 동전 투입구
    c.rect(x + 10, top + 34, 2, 1, P["slot"])
    stripe = (P["side"], P["side2"], P["mar_c"])[art % 3]
    c.rect(x + 1, top + 37, w - 2, 1, stripe)  # 옆면 띠
    c.rect(x + 2, top + 38, w - 4, 4, P["cab_dk"])


def screens() -> str:
    """오락기 화면 안의 움직임: 침입자(왼쪽), 공 튀기기(가운데), 미로(오른쪽)."""
    out = []
    x, top = CABS[0], CAB_TOP
    bodies = []
    for k in range(2):  # 침입자 줄이 좌우로 움직인다
        c = Canvas(W, H)
        for row in range(2):
            for col in range(4):
                px, py = x + 6 + col * 3 + k, top + 11 + row * 3
                c.rect(px, py, 2, 1, P["scr_g"])
                c.px(px, py + 1, P["scr_g2"])
        c.rect(x + 10 + k * 2, top + 19, 3, 1, P["scr_c"])
        bodies.append(shapes(c.cells))
    out.append(frames(bodies, 1.0, 0.2))
    x = CABS[1]
    bodies = []
    for k in range(4):  # 공이 튄다
        c = Canvas(W, H)
        c.rect(x + 5, top + 10 + k * 2, 1, 4, P["scr_c"])
        c.rect(x + 16, top + 18 - k * 2, 1, 4, P["scr_c"])
        c.px(x + 8 + k * 2, top + 11 + (k % 2) * 5, P["scr_y"])
        bodies.append(shapes(c.cells))
    out.append(frames(bodies, 1.4, 0.4))
    x = CABS[2]
    bodies = []
    for k in range(3):  # 미로 속 먹보와 유령
        c = Canvas(W, H)
        for row in (12, 16, 20):
            c.rect(x + 5, top + row, 12, 1, P["scr_c"])
        c.rect(x + 6 + k * 3, top + 14, 2, 2, P["scr_y"])
        c.rect(x + 14 - k * 2, top + 18, 2, 2, P["scr_r"])
        bodies.append(shapes(c.cells))
    out.append(frames(bodies, 1.5, 0.7))
    return "".join(out)


def buttons() -> str:
    out = []
    for i, x in enumerate(CABS):
        for j, color in enumerate((P["btn_a"], P["btn_b"], P["btn_c"])):
            out.append(blink(x + 10 + j * 3, CAB_TOP + 27, 2, 2, color, "1;0.35;1;1", 1.6 + j * 0.3, i * 0.4 + j * 0.2))
    return "".join(out)


def sign_layer(cells: list[tuple[int, int]]) -> str:
    glow = Canvas(W, H)
    for (x, y) in cells:
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            if (x + dx, y + dy) not in cells:
                glow.px(x + dx, y + dy, P["neon_dk"])
    lit = Canvas(W, H)
    for (x, y) in cells:
        lit.px(x, y, P["neon_hi"] if (x + y) % 6 == 0 else P["neon"])
    flick = (
        '<g><animate attributeName="opacity" values="1;1;0.5;1;1;0.75;1" dur="3.1s" begin="-.4s" calcMode="discrete" repeatCount="indefinite"/>'
        + shapes(lit.cells)
        + "</g>"
    )
    return shapes(glow.cells) + flick


def led_frame(c: Canvas) -> None:
    c.rect(LED_X - 2, LED_Y - 2, 20 * 3 + 3, 7, P["led_frame"])
    c.rect(LED_X - 1, LED_Y - 1, 20 * 3 + 1, 5, P["black"])
    for i in range(20):
        c.rect(LED_X + i * 3, LED_Y, 2, 3, P["led_off"])


def gauge(level: int) -> str:
    """컨텍스트 게이지: LED 막대. 쓴 만큼 왼쪽부터 켜지고(초록 → 노랑 → 빨강), 가장 끝 불빛이 깜박인다."""
    c = Canvas(W, H)
    for i in range(level):
        color = P["led_g"] if i < 12 else P["led_y"] if i < 17 else P["led_r"]
        c.rect(LED_X + i * 3, LED_Y, 2, 3, color)
    blink_last = blink(LED_X + (level - 1) * 3, LED_Y, 2, 3, P["screen"], "0;0;1;0", 1.2, 0.1) if level else ""
    return shapes(c.cells) + (
        f'<g fill-opacity=".45">{blink_last}</g>' if level else ""
    )


def emblem(c: Canvas) -> None:
    c.ellipse(6.5, 5.5, 5, 5, P["edge"])
    c.ellipse(6.5, 5.5, 4.2, 4.2, P["wall3"])
    c.rect(5, 6, 1, 3, P["stick"])  # 조이스틱
    c.ellipse(5.5, 5, 1.8, 1.8, P["ball"])
    c.px(8, 3, P["scr_y"])


def build() -> dict:
    art = Art(NAME, W, PANEL_ROWS, BASE)
    c = Canvas(W, H)
    wall(c)
    floor(c)
    led_frame(c)
    for i, x in enumerate(CABS):
        cabinet(c, x, i)
    cells = sign(c)
    c.fade(66, 86)
    art.add(c)
    art.add(sign_layer(cells))
    art.add(screens() + buttons())
    art.add(MARKER)
    return {
        "base": BASE,
        "scene": art.svg(),
        "gauges": [gauge(i) for i in range(21)],
        "labelSvg": text(42.5, 21.5, GAUGE_NAME + " {{P}}%", 3.0, P["scr_g"], 700, "middle", 0.2),
        "labelName": GAUGE_NAME,
        "strip": make_strip(NAME, BASE, P["edge"], emblem, [P["neon"], P["scr_y"], P["teal"]]),
    }
