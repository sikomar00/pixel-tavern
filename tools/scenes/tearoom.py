"""장면 2: 7080 다방 (아늑 / 레트로). 85x110 칸, 4배 확대."""
from __future__ import annotations

import math

from artlib import Art, Canvas, MARKER, frames, make_strip, shapes, text, PANEL_ROWS

W, H = 85, 96
NAME = "tearoom"
BASE = "#3b2417"
GAUGE_NAME = "컨텍스트"
P = {
    "wall_a": "#4a2e1c", "wall_b": "#55351f", "wall_c": "#3f2718",
    "wood0": "#24140c", "wood1": "#3a2316", "wood2": "#5a3a22", "wood_hi": "#7b5330", "rail": "#8a5a36",
    "cream": "#f1e8d6", "cream_sh": "#cbbfa8", "amber": "#e8a317", "rust": "#d9603b",
    "lamp": "#f6c354", "lamp_dk": "#b97a1c", "glow": "#ffd97a",
    "rec": "#0e0a0a", "rec_ln": "#2a2020", "mark": "#7a6868", "metal": "#b8b0a0", "metal_dk": "#7a7468",
    "glass": "#8fb8b8", "inside": "#2a1a12", "tea": "#b0602a", "tea_hi": "#e29a46", "steam": "#e6dcc8",
    "sky": "#e9c98a", "hill": "#6b4429", "hill2": "#523320",
    "muted": "#d8bfa0", "edge": "#6b4429",
}
COVERS = ["#d9603b", "#3f7f6a", "#4b5fae", "#e8a317", "#8a5ab0", "#b3434a"]
FADE_FROM, FADE_TO = 64, 78
TEA_ROWS = 9  # 컵 안쪽 높이(칸). 쓴 만큼 차오른다.


def wall(c: Canvas) -> None:
    c.rect(0, 0, W, 48, P["wall_a"])
    for x in range(W):  # 줄무늬 벽지
        if x % 8 < 4:
            c.rect(x, 7, 1, 40, P["wall_b"])
    for x in range(2, W, 8):
        for y in range(11, 46, 8):
            c.px(x, y, P["wall_c"])
    c.rect(0, 48, W, 24, P["wood1"])  # 징두리 판벽
    for x in range(3, W, 7):
        c.rect(x, 50, 1, 20, P["wood0"])
    c.rect(0, 48, W, 1, P["rail"])
    c.rect(0, 49, W, 1, P["wood2"])
    c.rect(0, 0, W, 4, P["wood0"])  # 천장 몰딩
    c.rect(0, 4, W, 2, P["wood1"])
    c.rect(0, 6, W, 1, P["rail"])


def picture(c: Canvas) -> None:
    c.rect(8, 14, 20, 16, P["wood2"])
    c.rect(8, 14, 20, 1, P["wood_hi"])
    c.rect(10, 16, 16, 12, P["sky"])
    c.ellipse(21, 21, 2.5, 2.5, P["rust"])
    for x in range(10, 26):
        top = 24 + round(2 * math.sin(x / 2.5))
        c.rect(x, top, 1, 28 - top, P["hill"] if x < 18 else P["hill2"])


def covers(c: Canvas) -> None:
    for i, color in enumerate(COVERS):
        x, y = 56 + (i % 3) * 9, 12 + (i // 3) * 9
        c.rect(x, y, 8, 8, color)
        c.rect(x, y + 7, 8, 1, P["wood0"])
        c.ellipse(x + 3.5, y + 3.5, 2.4, 2.4, P["rec"])
        c.px(x + 3, y + 3, P["cream"])
    c.rect(54, 30, 30, 1, P["rail"])


def lamp(c: Canvas) -> None:
    c.rect(42, 7, 1, 7, P["wood0"])
    for i, w in enumerate([5, 9, 13, 15, 17]):
        c.rect(42 - w // 2, 14 + i, w, 1, P["lamp"])
    c.rect(34, 19, 17, 1, P["lamp_dk"])
    c.rect(41, 20, 3, 1, P["glow"])


def counter(c: Canvas) -> None:
    c.rect(3, 54, 40, 2, P["wood2"])
    c.rect(3, 54, 40, 1, P["wood_hi"])
    c.rect(3, 56, 40, 11, P["wood1"])
    for x in range(8, 43, 9):
        c.rect(x, 58, 1, 8, P["wood0"])
    c.rect(6, 46, 28, 8, P["wood0"])  # 턴테이블 상자
    c.ellipse(18, 49, 9.5, 3.8, P["rec"])
    c.ellipse(18, 49, 6.5, 2.6, P["rec_ln"])
    c.ellipse(18, 49, 2.6, 1.2, P["rust"])
    c.px(18, 49, P["cream"])
    c.line(31, 46, 24, 51, P["metal"])  # 톤암
    c.px(23, 51, P["metal_dk"])
    c.px(23, 52, P["metal_dk"])


def table(c: Canvas) -> None:
    c.rect(54, 57, 31, 3, P["wood2"])
    c.rect(54, 57, 31, 1, P["wood_hi"])
    c.rect(56, 60, 27, 7, P["wood1"])
    c.rect(56, 60, 27, 1, P["wood0"])
    c.rect(62, 56, 16, 1, P["cream"])  # 받침 접시
    c.rect(65, 45, 1, 11, P["glass"])  # 유리 찻잔: 벽, 바닥, 테두리, 손잡이
    c.rect(74, 45, 1, 11, P["glass"])
    c.rect(65, 55, 10, 1, P["glass"])
    c.rect(66, 46, 8, TEA_ROWS, P["inside"])
    c.rect(65, 45, 10, 1, P["cream"])
    for x, y in [(75, 47), (76, 47), (77, 48), (77, 49), (77, 50), (76, 51), (75, 51)]:
        c.px(x, y, P["glass"])


def record_frames() -> str:
    """LP가 도는 것처럼 보이는 표식 두 개를 45도씩 옮긴다."""
    bodies = []
    for k in range(8):
        a = k * math.pi / 4
        cells = {
            (round(18 + 7.6 * math.cos(a + off)), round(49 + 3.0 * math.sin(a + off))): P["mark"]
            for off in (0, math.pi)
        }
        bodies.append(shapes(cells))
    return frames(bodies, 2.4, 0.3)


def lamp_halo() -> str:
    return (
        f'<ellipse cx="42.5" cy="22" rx="15" ry="11" fill="{P["glow"]}" fill-opacity=".10">'
        '<animate attributeName="fill-opacity" values=".10;.14;.09;.12" dur="2.2s" begin="-.7s" '
        'calcMode="discrete" repeatCount="indefinite"/></ellipse>'
    )


def gauge(level: int) -> str:
    """컨텍스트 게이지: 찻잔. 쓴 만큼 차가 차오르고, 차 있으면 김이 난다."""
    rows = round(TEA_ROWS * level * 5 / 100)
    if rows == 0:
        return ""
    c = Canvas(W, H)
    top = 55 - rows
    c.rect(66, top, 8, rows, P["tea"])
    c.rect(66, top, 8, 1, P["tea_hi"])
    steam = [
        [(68, 43), (69, 42), (68, 41), (69, 40), (71, 43), (70, 42), (71, 41), (70, 40)],
        [(69, 43), (68, 42), (69, 41), (68, 40), (70, 43), (71, 42), (70, 41), (71, 40)],
    ]
    return shapes(c.cells) + frames([shapes({p: P["steam"] for p in cells}) for cells in steam], 1.4, 0.2)


def emblem(c: Canvas) -> None:
    c.ellipse(6.5, 5.5, 5, 5, P["wood_hi"])
    c.ellipse(6.5, 5.5, 4.2, 4.2, P["rec"])
    c.ellipse(6.5, 5.5, 3, 3, P["rec_ln"])
    c.ellipse(6.5, 5.5, 1.6, 1.6, P["rust"])
    c.px(6, 5, P["cream"])


def build() -> dict:
    art = Art(NAME, W, PANEL_ROWS, BASE)
    c = Canvas(W, H)
    for draw in (wall, picture, covers, lamp, counter, table):
        draw(c)
    c.fade(64, 86)
    art.add(c)
    art.add(lamp_halo() + record_frames())
    art.add(MARKER)
    return {
        "base": BASE,
        "scene": art.svg(),
        "gauges": [gauge(i) for i in range(21)],
        "labelSvg": text(70, 36, GAUGE_NAME + " {{P}}%", 3.2, P["amber"], 700, "middle", 0.2),
        "labelName": GAUGE_NAME,
        "strip": make_strip(NAME, BASE, P["edge"], emblem, [P["lamp"], P["rust"]]),
    }
