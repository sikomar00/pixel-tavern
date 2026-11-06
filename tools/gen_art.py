"""픽셀 그림을 만든다: tools/scenes/<id>.py -> hooks/art/<id>.ts(SVG) + hooks/art/cells/<id>.ts(터미널용 칸 그림) + tools/preview/index.html.

실행: python tools/gen_art.py   (표준 라이브러리만 쓴다. 모드에는 로드되지 않는다.)
"""
from __future__ import annotations

import importlib
import sys
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
ROOT = TOOLS.parent
sys.path.insert(0, str(TOOLS))

from artlib import MAX_SVG_BYTES, write_preview, write_ts  # noqa: E402
from cellart import encode, write_cells_ts  # noqa: E402

SCENES = ["attic", "tearoom", "dungeon", "neon", "jazz", "camp", "library", "arcade", "drive", "station"]


def check_size(name: str, art: dict) -> int:
    """게이지와 글자를 끼워 넣은 최종 SVG가 한 장 한도 안인지 본다."""
    worst = len(art["scene"]) + max(len(g) for g in art["gauges"]) + len(art["labelSvg"])
    if worst > MAX_SVG_BYTES:
        raise ValueError(f"{name}: composed scene is {worst} bytes, over {MAX_SVG_BYTES}")
    return worst


def main() -> None:
    arts: dict[str, dict] = {}
    for name in SCENES:
        art = importlib.import_module(f"scenes.{name}").build()
        worst = check_size(name, art)
        write_ts(ROOT / "hooks" / "art" / f"{name}.ts", name, art)
        write_cells_ts(ROOT / "hooks" / "art" / "cells" / f"{name}.ts", name, encode(art["scene"], art["gauges"], art["strip"]))
        arts[name] = art
        print(f"{name}: scene {len(art['scene'])} B, strip {len(art['strip'])} B, worst composed {worst} B")
    write_preview(TOOLS / "preview" / "index.html", arts)
    print("preview:", TOOLS / "preview" / "index.html")


if __name__ == "__main__":
    main()
