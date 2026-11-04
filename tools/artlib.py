"""Pixel-art SVG helpers for pixel-tavern. Standard library only; the mod never loads this."""
from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Iterable

MAX_SVG_BYTES = 131072  # the desktop Svg element's source limit
MARKER = "<!--G-->"  # where the mod splices the gauge drawing and its label
BAYER = ((0, 8, 2, 10), (12, 4, 14, 6), (3, 11, 1, 9), (15, 7, 13, 5))
FONT = "'Malgun Gothic','Apple SD Gothic Neo','Noto Sans KR',sans-serif"
MONO = "Consolas,'SF Mono',monospace"

Cells = dict[tuple[int, int], str]


def bayer(x: int, y: int) -> int:
    return BAYER[y % 4][x % 4]


class Canvas:
    """A grid of colored cells. Colors are hex strings; absent cells are transparent."""

    def __init__(self, width: int, height: int) -> None:
        self.width, self.height = width, height
        self.cells: Cells = {}

    def px(self, x: int, y: int, color: str | None) -> None:
        if not (0 <= x < self.width and 0 <= y < self.height):
            return
        if color is None:
            self.cells.pop((x, y), None)
        else:
            self.cells[(x, y)] = color

    def rect(self, x: int, y: int, w: int, h: int, color: str) -> None:
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.px(xx, yy, color)

    def line(self, x0: int, y0: int, x1: int, y1: int, color: str, thick: int = 1) -> None:
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err = dx + dy
        while True:
            self.rect(x0 - thick // 2, y0 - thick // 2, thick, thick, color)
            if x0 == x1 and y0 == y1:
                return
            e2 = 2 * err
            if e2 >= dy:
                err, x0 = err + dy, x0 + sx
            if e2 <= dx:
                err, y0 = err + dx, y0 + sy

    def ellipse(self, cx: float, cy: float, rx: float, ry: float, color: str) -> None:
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1:
                    self.px(x, y, color)

    def bands(self, x: int, y: int, w: int, h: int, colors: list[str]) -> None:
        """Paint colors top to bottom; the last two rows of a band blend into the next."""
        n, size = len(colors), h / len(colors)
        for row in range(h):
            i = min(n - 1, int(row / size))
            into = row - i * size - (size - 2)  # >= 0 in the last two rows of the band
            for col in range(w):
                blend = i + 1 < n and into >= 0 and bayer(x + col, y + row) < (4 if into < 1 else 12)
                self.px(x + col, y + row, colors[i + 1] if blend else colors[i])

    def fade(self, y0: int, y1: int, keep_below: bool = False) -> None:
        """Dissolve cells into the background between y0 and y1 (a dither), and drop the rest."""
        for (x, y) in list(self.cells):
            if y >= y1:
                if not keep_below:
                    del self.cells[(x, y)]
            elif y >= y0 and bayer(x, y) < (y - y0) / (y1 - y0) * 16:
                del self.cells[(x, y)]


def merge(cells: Cells) -> dict[str, str]:
    """Greedy rectangle merge: one path `d` per color."""
    seen: set[tuple[int, int]] = set()
    out: dict[str, str] = {}
    for (x, y) in sorted(cells, key=lambda p: (p[1], p[0])):
        if (x, y) in seen:
            continue
        color = cells[(x, y)]
        w = 1
        while cells.get((x + w, y)) == color and (x + w, y) not in seen:
            w += 1
        h = 1
        while all(cells.get((x + i, y + h)) == color and (x + i, y + h) not in seen for i in range(w)):
            h += 1
        seen.update((x + i, y + j) for i in range(w) for j in range(h))
        out[color] = out.get(color, "") + f"M{x} {y}h{w}v{h}h-{w}z"
    return out


def region_d(points: Iterable[tuple[int, int]]) -> str:
    """A path `d` covering the given cells (for a clipPath)."""
    return "".join(merge({p: "x" for p in points}).values())


def shapes(cells: Cells) -> str:
    paths = "".join(f'<path fill="{c}" d="{d}"/>' for c, d in merge(cells).items())
    return f'<g shape-rendering="crispEdges">{paths}</g>'


def _begin(begin: float) -> str:
    return f"-{begin:g}s"  # a negative begin starts the loop already running


def blink(x: int, y: int, w: int, h: int, color: str, values: str, dur: float, begin: float) -> str:
    return (
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{color}" shape-rendering="crispEdges">'
        f'<animate attributeName="opacity" values="{values}" dur="{dur:g}s" begin="{_begin(begin)}" '
        f'calcMode="discrete" repeatCount="indefinite"/></rect>'
    )


def frames(bodies: list[str], dur: float, begin: float) -> str:
    """Show the bodies one after another, each for dur/len seconds, looping."""
    n = len(bodies)
    out = []
    for i, body in enumerate(bodies):
        vals = ";".join("1" if j == i else "0" for j in range(n))
        out.append(
            f'<g opacity="0"><animate attributeName="opacity" values="{vals}" dur="{dur:g}s" '
            f'begin="{_begin(begin)}" calcMode="discrete" repeatCount="indefinite"/>{body}</g>'
        )
    return "".join(out)


def drift(body: str, steps: list[tuple[int, int]], dur: float, begin: float, clip: str | None = None) -> str:
    """Move the body through the steps in jumps. The pattern must repeat at the last step."""
    vals = ";".join(f"{dx} {dy}" for dx, dy in steps)
    inner = (
        f'<g><animateTransform attributeName="transform" type="translate" values="{vals}" '
        f'dur="{dur:g}s" begin="{_begin(begin)}" calcMode="discrete" repeatCount="indefinite"/>{body}</g>'
    )
    return f'<g clip-path="{clip}">{inner}</g>' if clip else inner


def text(x: float, y: float, s: str, size: float, fill: str, weight: int = 400,
         anchor: str = "start", spacing: float = 0, family: str = FONT) -> str:
    s = s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return (
        f'<text x="{x:g}" y="{y:g}" font-size="{size:g}" fill="{fill}" font-weight="{weight}" '
        f'text-anchor="{anchor}" letter-spacing="{spacing:g}" font-family="{family}">{s}</text>'
    )


class Art:
    """One SVG drawing: layers stacked in the order they are added."""

    def __init__(self, name: str, width: int, height: int, base: str, scale: int = 4) -> None:
        self.name, self.width, self.height, self.base, self.scale = name, width, height, base, scale
        self.defs: list[str] = []
        self.layers: list[str] = []

    def clip(self, key: str, d: str) -> str:
        ident = f"{self.name}-{key}"  # unique per drawing so scenes never bleed into each other
        self.defs.append(f'<clipPath id="{ident}"><path d="{d}"/></clipPath>')
        return f"url(#{ident})"

    def add(self, layer: str | Canvas) -> None:
        self.layers.append(shapes(layer.cells) if isinstance(layer, Canvas) else layer)

    def svg(self) -> str:
        out = (
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {self.width} {self.height}" '
            f'width="{self.width * self.scale}" height="{self.height * self.scale}">'
            f'<defs>{"".join(self.defs)}</defs><rect width="{self.width}" height="{self.height}" fill="{self.base}"/>'
            f'{"".join(self.layers)}</svg>'
        )
        size = len(out.encode("utf-8"))
        if size > MAX_SVG_BYTES:
            raise ValueError(f"{self.name}: {size} bytes is over the {MAX_SVG_BYTES} limit")
        return out


def titles(title: str, motto: str, title_fill: str, muted: str) -> str:
    """패널 그림 아래쪽 글자: 제목과 모토. 그림은 이 자리를 비워 둔다."""
    return text(6, 84, title, 6.4, title_fill, 800, "start", 0.3) + text(6, 91, motto, 3.2, muted)


def make_strip(name: str, base: str, edge: str, emblem, lights: list[str]) -> str:
    """배너 배경(190x12 칸 = 760x48): 테두리, 왼쪽 엠블럼, 윗줄에서 깜박이는 불빛."""
    art = Art(name + "-strip", 190, 12, base)
    c = Canvas(190, 12)
    for rect in [(0, 0, 190, 1), (0, 11, 190, 1), (0, 0, 1, 12), (189, 0, 1, 12)]:
        c.rect(*rect, edge)
    emblem(c)
    art.add(c)
    art.add("".join(
        blink(x, 0, 1, 1, lights[i % len(lights)], "1;0.3;1;1", 2.4, i * 0.4)
        for i, x in enumerate(range(24, 184, 10))
    ))
    return art.svg()


def write_ts(out: Path, export: str, art: dict) -> None:
    body = json.dumps(art, ensure_ascii=False, indent=2)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        f"// Generated by tools/gen_art.py from tools/scenes. Do not edit by hand.\n"
        f"export const {export} = {body} as const\n",
        encoding="utf-8",
    )


PREVIEW = """<!doctype html><meta charset="utf-8"><title>pixel-tavern preview</title>
<style>
body{margin:0;background:#0a0a12;color:#aaa;font:14px sans-serif;padding:16px}
.scene{margin-bottom:24px}
.col{width:760px;margin-top:12px}.panel{width:340px}
.box{padding:0;border-radius:4px;overflow:hidden}
label{display:block;margin:6px 0}
svg{display:block}
</style>
<body><div id="root"></div>
<script>
const ART = __ART__;
const compose = (a, p) => {
  const l = Math.min(20, Math.max(0, Math.round(p / 5)));
  return a.scene.replace("<!--G-->", a.gauges[l] + a.labelSvg.replace("{{P}}", Math.round(p)));
};
const root = document.getElementById("root");
for (const [id, a] of Object.entries(ART)) {
  const row = document.createElement("div");
  row.className = "scene";
  row.innerHTML =
    '<div class="panel"><div class="box" style="background:' + a.base + '" data-scene></div>' +
    '<label>' + id + ' context <input type="range" min="0" max="100" value="42"> <b>42</b>%</label></div>' +
    '<div class="col"><div class="box" style="background:' + a.base + '">' + a.strip + '</div></div>';
  const slot = row.querySelector("[data-scene]");
  const input = row.querySelector("input");
  const draw = () => { slot.innerHTML = compose(a, +input.value); row.querySelector("b").textContent = input.value; };
  input.oninput = draw; draw();
  root.appendChild(row);
}
</script></body>
"""


def write_preview(out: Path, arts: dict[str, dict]) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(PREVIEW.replace("__ART__", json.dumps(arts, ensure_ascii=False)), encoding="utf-8")
