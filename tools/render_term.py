"""터미널 화면(배너·패널)을 앱 없이 근사해서 HTML로 그린다. 한 줄로: python tools/render_term.py

tools/render_panel.py와 같은 방식이다: 시험 도구가 내주는 화면 구성 트리(터미널 화면 시나리오만)를 글자 칸 격자에 옮겨 그린다(tools/preview/term-check.html).
한글은 2칸, 그 밖은 1칸으로 세고, Raster는 칸마다 위 절반은 글자색·아래 절반은 배경색으로 칠한다(▀). 간격 이름은 터미널의 환산표를 쓴다.
주의: 실제 터미널이 아니라 "이 가정으로 그리면 이렇다"는 근사다. 표준 라이브러리만 쓴다.
"""
from __future__ import annotations

import base64
import html
import json
import pathlib
import struct
import sys
import unicodedata

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from render_panel import ROOT, run_scenarios  # noqa: E402

CELL_W, CELL_H = 8, 17  # 글자 칸 하나의 화면 크기(px)
ACROSS = {"xs": 1, "sm": 1, "md": 2, "lg": 3, "xl": 4}  # 가로(열)로 쓸 때 간격 이름의 칸 수
DOWN = {"xs": 0, "sm": 0, "md": 1, "lg": 1, "xl": 2}  # 세로(줄)로 쓸 때
FG, MUTED_ALPHA = "#d8d8d8", 0.6
JUSTIFY = {"flex-start": "flex-start", "center": "center", "flex-end": "flex-end", "space-between": "space-between"}


def cells_of(value, axis: str) -> int:
    if value is None:
        return 0
    if isinstance(value, str):
        return (ACROSS if axis == "x" else DOWN).get(value, 0)
    return int(value)


def width_of(text: str) -> int:
    return sum(2 if unicodedata.east_asian_width(c) in "WF" else 1 for c in text)


def box(p: dict, children: str) -> str:
    column = p.get("flexDirection", "row") == "column"
    css = ["display:flex", f"flex-direction:{'column' if column else 'row'}", "box-sizing:border-box", "min-width:0"]
    if p.get("flexWrap") == "wrap":
        css.append("flex-wrap:wrap")
    css.append(f"align-items:{p.get('alignItems', 'stretch')}")
    if p.get("justifyContent"):
        css.append(f"justify-content:{JUSTIFY.get(p['justifyContent'], 'flex-start')}")
    if p.get("gap") is not None:
        css.append(f"gap:{cells_of(p['gap'], 'y' if column else 'x') * (CELL_H if column else CELL_W)}px")
    if p.get("backgroundColor"):
        css.append(f"background:{p['backgroundColor']}")
    if p.get("flexGrow"):
        css.append(f"flex-grow:{p['flexGrow']}")
    if p.get("flexShrink") is not None:
        css.append(f"flex-shrink:{p['flexShrink']}")
    pad = p.get("padding")
    pl = cells_of(p.get("paddingLeft", p.get("paddingX", pad)), "x") * CELL_W
    pr = cells_of(p.get("paddingRight", p.get("paddingX", pad)), "x") * CELL_W
    pt = cells_of(p.get("paddingTop", p.get("paddingY", pad)), "y") * CELL_H
    pb = cells_of(p.get("paddingBottom", p.get("paddingY", pad)), "y") * CELL_H
    css.append(f"padding:{pt}px {pr}px {pb}px {pl}px")
    if isinstance(p.get("width"), (int, float)):
        css.append(f"width:{int(p['width']) * CELL_W}px;flex-shrink:0")
    if p.get("overflow") == "hidden":
        css.append("overflow:hidden")
    return f'<div style="{";".join(css)}">{children}</div>'


def text_html(s: str, color: str, bold: bool, dim: bool, truncate: bool) -> str:
    cells = "".join(f'<span style="display:inline-block;width:{width_of(c) * CELL_W}px">{html.escape(c)}</span>' for c in s)
    style = [f"color:{color}", f"font-weight:{700 if bold else 400}", f"height:{CELL_H}px", "white-space:nowrap", "font-family:Consolas,'Malgun Gothic',monospace", "font-size:14px", f"line-height:{CELL_H}px"]
    if dim:
        style.append(f"opacity:{MUTED_ALPHA}")
    if truncate:
        style.append("overflow:hidden;min-width:0")
    return f'<div style="{";".join(style)}">{cells}</div>'


def raster(p: dict) -> str:
    columns, rows = int(p["columns"]), int(p["rows"])
    data = base64.b64decode(p["cells"])
    if len(data) != columns * rows * 12:
        raise ValueError(f"Raster {p.get('key')}: cells가 {len(data)}바이트(기대 {columns * rows * 12})")
    out = []
    for i in range(columns * rows):
        _, fg, bg = struct.unpack_from("<III", data, i * 12)
        out.append(f'<div style="background:linear-gradient(#{fg:06x} 50%,#{bg:06x} 50%)"></div>')
    return f'<div style="display:grid;grid-template-columns:repeat({columns},{CELL_W}px);grid-auto-rows:{CELL_H}px;flex-shrink:0">{"".join(out)}</div>'


def text_of(node) -> str:
    if isinstance(node, str):
        return node
    return node.get("text") or "".join(text_of(child) for child in node.get("children", []))


def render(node) -> str:
    if isinstance(node, str):
        return html.escape(node)
    kind, p = node["type"], node.get("props", {})
    if kind == "Box":
        return "" if p.get("display") == "none" else box(p, "".join(render(c) for c in node.get("children", [])))
    if kind == "Text":
        bold = p.get("weight") in ("semibold", "bold") or p.get("bold") is True
        return text_html(text_of(node), p.get("color") or FG, bold, p.get("dimColor") is True, str(p.get("wrap", "")).startswith("truncate"))
    if kind == "Button":
        label = p.get("label") or text_of(node)
        shown = label if p.get("plain") else f"[ {label} ]"
        color = "#5fd7ff" if p.get("variant") == "primary" and not p.get("plain") else FG
        return text_html(shown, color, False, p.get("dimColor") is True, False)
    if kind == "Input":
        return text_html(f"▏{p.get('placeholder', '')}", "#8a8a8a", False, False, False)
    if kind == "Raster":
        return raster(p)
    return f"<div>[{kind}]</div>"


def main() -> None:
    output = run_scenarios()
    rows = [json.loads(line.split("@@TREE@@", 1)[1]) for line in output.splitlines() if "@@TREE@@" in line]
    rows = [row for row in rows if row.get("surface") == "terminal"]
    parts = [
        '<!doctype html><meta charset="utf-8"><title>terminal check</title><style>'
        "body{margin:0;padding:10px;background:#111;font-family:sans-serif;color:#999}"
        ".t{display:inline-block;vertical-align:top;margin:0 16px 16px 0;background:#000;padding:6px}.note{font-size:11px;margin:0 0 6px}</style>"
    ]
    for row in rows:
        tree = row["tree"]
        columns = int(row.get("columns", 80))
        parts.append(
            f'<div class="t" id="{row["id"]}"><p class="note">{row["id"]} — {columns}열 · 글자 칸 {CELL_W}x{CELL_H}px · 근사(실제 터미널 아님)</p>'
            f'<div style="width:{columns * CELL_W}px;overflow:hidden">{render(tree)}</div></div>'
        )
    out = ROOT / "tools" / "preview" / "term-check.html"
    out.write_text("\n".join(parts), encoding="utf-8")
    print(f"{len(rows)}개 상태를 그렸다 -> {out}")


if __name__ == "__main__":
    main()
