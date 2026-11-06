"""장면 그림(SVG)을 칸 격자로 바꾼다: 터미널의 색 블록 그림(Raster)용 데이터를 만든다. 표준 라이브러리만 쓴다. 모드에는 로드되지 않는다.

우리 그림이 쓰는 몇 가지 태그만 읽는다(path의 `M x y h w v h h-w z` 사각형, rect, ellipse, g의 opacity·clip-path, defs의 clipPath, 움직임 태그).
움직임은 모두 "첫 값"으로 굳힌다(hooks/still.ts의 정지 그림과 같은 규칙: 깜박임은 첫 값, 프레임은 첫 프레임, 이동은 첫 위치).
다른 태그를 만나면 조용히 넘기지 않고 오류를 낸다(그림을 새로 그리다 모르는 태그가 생기면 바로 알 수 있게).
입력은 tools/scenes가 직접 만든 믿을 수 있는 SVG뿐이다(바깥 파일을 읽지 않는다). 그래서 표준 XML 읽기를 그대로 쓴다.
"""
from __future__ import annotations

import re
import xml.etree.ElementTree as ET

NS = "{http://www.w3.org/2000/svg}"
Grid = list[list[str | None]]  # [y][x] = "#rrggbb"
SKIPPED = {"defs", "animate", "animateTransform", "text"}  # text: 글자는 터미널에서 따로 쓴다
PATH_RECT = re.compile(r"M(-?[\d.]+) (-?[\d.]+)h(-?[\d.]+)v(-?[\d.]+)h-?[\d.]+z")


def _rgb(color: str) -> tuple[int, int, int]:
    if not re.fullmatch(r"#[0-9a-fA-F]{6}", color):
        raise ValueError(f"읽을 수 없는 색: {color}")
    return int(color[1:3], 16), int(color[3:5], 16), int(color[5:7], 16)


def _blend(under: str | None, over: str, alpha: float) -> str:
    if under is None or alpha >= 1:
        return over.lower()
    a, b = _rgb(under), _rgb(over)
    return "#" + "".join(f"{round(u + (o - u) * alpha):02x}" for u, o in zip(a, b))


def _first_value(el: ET.Element, attribute: str) -> str | None:
    """요소 안 `<animate attributeName=...>`의 첫 값(없으면 None)."""
    for child in el:
        if child.tag == NS + "animate" and child.get("attributeName") == attribute:
            return child.get("values", "").split(";")[0]
    return None


def _translate(el: ET.Element) -> tuple[float, float]:
    for child in el:
        if child.tag == NS + "animateTransform":
            first = child.get("values", "0 0").split(";")[0].split()
            return float(first[0]), float(first[1])
    return 0.0, 0.0


def _path_cells(d: str) -> set[tuple[int, int]]:
    cells: set[tuple[int, int]] = set()
    for x, y, w, h in PATH_RECT.findall(d):
        for yy in range(int(float(y)), int(float(y)) + int(float(h))):
            for xx in range(int(float(x)), int(float(x)) + int(float(w))):
                cells.add((xx, yy))
    return cells


class _Raster:
    def __init__(self, width: int, height: int) -> None:
        self.width, self.height = width, height
        self.grid: Grid = [[None] * width for _ in range(height)]
        self.clips: dict[str, set[tuple[int, int]]] = {}

    def paint(self, x: int, y: int, color: str, alpha: float, clip: set[tuple[int, int]] | None) -> None:
        if 0 <= x < self.width and 0 <= y < self.height and (clip is None or (x, y) in clip) and alpha > 0:
            self.grid[y][x] = _blend(self.grid[y][x], color, alpha)

    def read_clips(self, root: ET.Element) -> None:
        for el in root.iter(NS + "clipPath"):
            self.clips[el.get("id", "")] = set().union(*(_path_cells(p.get("d", "")) for p in el.iter(NS + "path")))

    def draw(self, el: ET.Element, alpha: float, clip: set[tuple[int, int]] | None, dx: float, dy: float) -> None:
        tag = el.tag.removeprefix(NS)
        if tag in SKIPPED or tag == "clipPath":
            return
        own = _first_value(el, "opacity")
        own = float(own) if own is not None else float(el.get("opacity", "1"))
        alpha *= own
        fill_alpha = _first_value(el, "fill-opacity")
        fill_alpha = float(fill_alpha) if fill_alpha is not None else float(el.get("fill-opacity", "1"))
        fill = el.get("fill", "#000000")
        a = alpha * fill_alpha
        if tag == "g":
            ref = el.get("clip-path")
            if ref is not None:
                clip = self.clips[ref[len("url(#"):-1]]
            tx, ty = _translate(el)
            for child in el:
                self.draw(child, alpha, clip, dx + tx, dy + ty)
        elif tag == "rect":
            x, y, w, h = (float(el.get(k, "0")) for k in ("x", "y", "width", "height"))
            for yy in range(round(y + dy), round(y + dy + h)):
                for xx in range(round(x + dx), round(x + dx + w)):
                    self.paint(xx, yy, fill, a, clip)
        elif tag == "path":
            for xx, yy in _path_cells(el.get("d", "")):
                self.paint(round(xx + dx), round(yy + dy), fill, a, clip)
        elif tag == "ellipse":
            cx, cy, rx, ry = (float(el.get(k, "0")) for k in ("cx", "cy", "rx", "ry"))
            for yy in range(int(cy - ry) - 1, int(cy + ry) + 2):
                for xx in range(int(cx - rx) - 1, int(cx + rx) + 2):
                    if ((xx + 0.5 - cx) / rx) ** 2 + ((yy + 0.5 - cy) / ry) ** 2 <= 1:
                        self.paint(round(xx + dx), round(yy + dy), fill, a, clip)
        else:
            raise ValueError(f"모르는 태그 <{tag}>: tools/cellart.py가 읽을 수 있게 고치거나 그림에서 빼 주세요")


def rasterize(svg: str) -> Grid:
    """SVG 한 장을 칸 격자로(viewBox의 한 칸 = 격자 한 칸). 움직임은 첫 값으로 굳힌다."""
    root = ET.fromstring(svg)
    _, _, width, height = (int(float(v)) for v in root.get("viewBox", "").split())
    raster = _Raster(width, height)
    raster.read_clips(root)
    for child in root:
        raster.draw(child, 1.0, None, 0.0, 0.0)
    return raster.grid


# ---- 칸 그림 데이터(터미널용) 만들기 ----

SYMBOLS = "".join(chr(c) for c in range(33, 127) if c not in (34, 36, 39, 92, 96))  # 큰따옴표·$·작은따옴표·역슬래시·백틱을 뺀 89개(hooks/cells.ts의 SYMBOLS와 같은 표)
LEVELS = 20  # 게이지는 5% 단위(0~20)
EMBLEM_BOX = (1, 1, 13, 11)  # 배너 띠의 엠블럼(x0, y0, x1, y1 — 끝은 포함하지 않음): 12x10칸 = 터미널 12x5칸
MARKER = "<!--G-->"


class _Palette:
    def __init__(self) -> None:
        self.colors: list[str] = []

    def symbol(self, color: str | None) -> str:
        if color is None:
            raise ValueError("그림에 비어 있는 칸이 있다(바탕 사각형이 전체를 덮어야 한다)")
        if color not in self.colors:
            if len(self.colors) >= len(SYMBOLS):
                raise ValueError(f"색이 {len(SYMBOLS)}개를 넘었다")
            self.colors.append(color)
        return SYMBOLS[self.colors.index(color)]

    def row(self, cells: list[str | None]) -> str:
        return "".join(self.symbol(c) for c in cells)


def encode(scene: str, gauges: list[str], strip: str) -> dict:
    """장면 한 개의 터미널 그림 데이터: 팔레트, 장면 격자(게이지 0%), 게이지가 바뀌는 상자의 단계별 격자, 배너 엠블럼."""
    if len(gauges) != LEVELS + 1:
        raise ValueError(f"게이지 단계가 {LEVELS + 1}개가 아니다")
    palette = _Palette()
    grids = [rasterize(scene.replace(MARKER, gauge)) for gauge in gauges]
    base = grids[0]
    changed = [(x, y) for grid in grids[1:] for y, row in enumerate(grid) for x, c in enumerate(row) if c != base[y][x]]
    if not changed:
        raise ValueError("게이지 단계마다 그림이 같다")
    x0, x1 = min(x for x, _ in changed), max(x for x, _ in changed) + 1
    y0, y1 = min(y for _, y in changed), max(y for _, y in changed) + 1
    rows = [palette.row(row) for row in base]
    levels = [[palette.row(grid[y][x0:x1]) for y in range(y0, y1)] for grid in grids]
    mark = rasterize(strip)
    ex0, ey0, ex1, ey1 = EMBLEM_BOX
    emblem = [palette.row(mark[y][ex0:ex1]) for y in range(ey0, ey1)]

    return {"palette": palette.colors, "rows": rows, "gauge": {"x": x0, "y": y0, "levels": levels}, "emblem": emblem}


def write_cells_ts(out, export: str, data: dict) -> None:
    """한 장면의 칸 그림 데이터를 TS 파일로 쓴다. 칸 줄은 한 줄씩 보이게 적는다."""
    import json

    def lines(rows: list[str], indent: str) -> str:
        return "[\n" + "".join(f"{indent}  {json.dumps(r)},\n" for r in rows) + f"{indent}]"

    gauge = data["gauge"]
    levels = ",\n".join(f"      {lines(rows, '      ')}" for rows in gauge["levels"])
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        "// Generated by tools/gen_art.py (tools/cellart.py). Do not edit by hand.\n"
        f"export const {export} = {{\n"
        f"  palette: {json.dumps(data['palette'])},\n"
        f"  rows: {lines(data['rows'], '  ')},\n"
        f"  gauge: {{\n    x: {gauge['x']},\n    y: {gauge['y']},\n    levels: [\n{levels},\n    ],\n  }},\n"
        f"  emblem: {lines(data['emblem'], '  ')},\n"
        "} as const\n",
        encoding="utf-8",
    )
