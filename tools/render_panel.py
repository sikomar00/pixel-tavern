"""패널을 실제 앱 없이 근사해서 HTML로 그린다. 한 줄로: python tools/render_panel.py

하는 일
  1. tools/tree_dump.scenario.tsx 를 잠깐 zz-tree.test.tsx 로 복사해 `claude plugin test` 로 돌린다(끝나면 지운다).
  2. 시험 도구가 내주는 패널 화면 구성 트리(JSON)를 HTML/CSS로 옮겨 그린다(tools/preview/tree-check.html).
  3. 상태마다 전체 높이와 구역별 높이를 알려 준다.

주의: 이것은 실제 앱 화면이 아니라 "이 가정으로 그리면 이렇다"는 근사다. 간격·글자·버튼 크기는 아래 기본값(내 추정)을 쓴다.
앱에서 /tavern-diag 측정판으로 실제 값을 재면 tools/measured.json 에 적어 넣는다. 적힌 값이 기본값을 덮어쓴다.
  { "width": 268, "step": {"xs": 4, "sm": 8, "md": 12, "lg": 16, "xl": 24}, "cell": [8, 16],
    "text": {"caption": 11, "footnote": 12, "body": 14, "heading": 17, "title": 22},
    "button": {"font": 13, "padding": [5, 10]}, "lineHeight": 1.4 }
tools/measured.json 에는 앱에서 잰 실제 값이 들어 있다(출처는 파일 안의 _출처). 표준 라이브러리만 쓴다.
"""
from __future__ import annotations

import argparse
import html
import json
import pathlib
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SCENARIO = ROOT / "tools" / "tree_dump.scenario.tsx"
TEMP_TEST = ROOT / "zz-tree.test.tsx"
MEASURED = ROOT / "tools" / "measured.json"
DEFAULTS = {
    "width": 268,
    "step": {"xs": 4, "sm": 8, "md": 12, "lg": 16, "xl": 24},
    "cell": [8, 16],  # 숫자로 준 칸 하나의 가로·세로 px
    "text": {"caption": 11, "footnote": 12, "body": 14, "heading": 17, "title": 22},
    "button": {"font": 13, "padding": [5, 10]},
    "lineHeight": 1.4,
}
WEIGHT = {"regular": 400, "medium": 500, "semibold": 600, "bold": 700}
JUSTIFY = {"flex-start": "flex-start", "center": "center", "flex-end": "flex-end", "space-between": "space-between"}


def load_settings() -> dict:
    settings = json.loads(json.dumps(DEFAULTS))
    if MEASURED.exists():
        for key, value in json.loads(MEASURED.read_text(encoding="utf-8")).items():
            if isinstance(value, dict):
                settings[key].update(value)
            else:
                settings[key] = value
    return settings


def run_scenarios() -> str:
    claude = shutil.which("claude")
    if claude is None:
        sys.exit("claude 명령을 찾지 못했다.")
    shutil.copyfile(SCENARIO, TEMP_TEST)
    try:
        done = subprocess.run([claude, "plugin", "test", str(ROOT)], capture_output=True, text=True, encoding="utf-8", errors="replace")
    finally:
        TEMP_TEST.unlink(missing_ok=True)
    output = done.stdout + done.stderr  # 시험 도구는 console.log를 표준 오류로 내보내기도 한다
    if "@@TREE@@" not in output:
        sys.exit("트리를 얻지 못했다:\n" + output[-2000:])
    return output


class Renderer:
    def __init__(self, settings: dict) -> None:
        self.s = settings

    def px(self, value, axis: str = "x"):
        if value is None:
            return None
        if isinstance(value, str):
            return self.s["step"].get(value)
        return value * self.s["cell"][0 if axis == "x" else 1]

    def box_css(self, p: dict) -> str:
        css = ["display:flex", f"flex-direction:{p.get('flexDirection', 'row')}", "box-sizing:border-box", "min-width:0"]
        if p.get("flexWrap") == "wrap":
            css.append("flex-wrap:wrap")
        if p.get("alignItems"):
            css.append(f"align-items:{p['alignItems']}")
        if p.get("justifyContent"):
            css.append(f"justify-content:{JUSTIFY.get(p['justifyContent'], 'flex-start')}")
        if p.get("gap") is not None:
            css.append(f"gap:{self.px(p['gap'])}px")
        if p.get("backgroundColor"):
            css.append(f"background:{p['backgroundColor']}")
        if p.get("flexGrow"):
            css.append(f"flex-grow:{p['flexGrow']}")
        pl = p.get("paddingLeft", p.get("paddingX", p.get("padding")))
        pr = p.get("paddingRight", p.get("paddingX", p.get("padding")))
        pt = p.get("paddingTop", p.get("paddingY", p.get("padding")))
        pb = p.get("paddingBottom", p.get("paddingY", p.get("padding")))
        css.append(f"padding:{self.px(pt, 'y') or 0}px {self.px(pr) or 0}px {self.px(pb, 'y') or 0}px {self.px(pl) or 0}px")
        if isinstance(p.get("width"), (int, float)):
            css.append(f"width:{p['width'] * self.s['cell'][0]}px")
        if p.get("overflow") == "hidden":
            css.append("overflow:hidden")
        if p.get("position") == "relative":
            css.append("position:relative")
        return ";".join(css)

    @staticmethod
    def text_of(node) -> str:
        if isinstance(node, str):
            return node
        return node.get("text") or "".join(Renderer.text_of(child) for child in node.get("children", []))

    def render(self, node) -> str:
        if isinstance(node, str):
            return html.escape(node)
        kind, p = node["type"], node.get("props", {})
        if kind == "Box":
            if p.get("display") == "none":
                return ""  # 호버 설명 창: 평소에는 숨겨져 있다
            return f'<div style="{self.box_css(p)}">{"".join(self.render(c) for c in node.get("children", []))}</div>'
        if kind == "Text":
            style = [f"font-size:{self.s['text'].get(p.get('size', 'body'), 14)}px", f"font-weight:{WEIGHT.get(p.get('weight', 'regular'), 400)}", f"line-height:{self.s['lineHeight']}"]
            style.append(f"color:{p['color']}" if p.get("color") else "color:#f2f0f7")
            if p.get("mono"):
                style.append("font-family:Consolas,monospace")
            if str(p.get("wrap", "")).startswith("truncate"):
                style.append("white-space:nowrap;overflow:hidden;text-overflow:ellipsis")
            return f'<div style="{";".join(style)}">{html.escape(self.text_of(node))}</div>'
        if kind == "Button":
            label = html.escape(p.get("label") or self.text_of(node))
            b = self.s["button"]
            if p.get("plain"):
                return f'<div style="font-size:{b["font"]}px;color:#f2f0f7;padding:2px 0;{"opacity:.55" if p.get("dimColor") else ""}">{label}</div>'
            bg = "rgba(255,255,255,.30)" if p.get("variant") == "primary" else "rgba(255,255,255,.12)"
            return (f'<div style="font-size:{b["font"]}px;color:#f2f0f7;background:{bg};border-radius:6px;'
                    f'padding:{b["padding"][0]}px {b["padding"][1]}px;white-space:nowrap">{label}</div>')
        if kind == "Select":
            options = {o["value"]: o["label"] for o in p.get("options", [])}
            shown = html.escape(options.get(p.get("value"), str(p.get("value", ""))))
            return (f'<div style="display:flex;align-items:center;gap:8px;flex-grow:1"><span style="font-size:12px;color:#aaa">{html.escape(p.get("label", ""))}</span>'
                    f'<span style="flex-grow:1;font-size:13px;color:#f2f0f7;background:rgba(255,255,255,.12);border-radius:6px;padding:5px 10px">{shown} ▾</span></div>')
        if kind == "Svg":
            width = min(self.s["width"], p.get("width", self.s["width"]))
            return f'<div style="width:{width}px;max-width:100%;line-height:0">{p.get("source", "")}</div>'
        return f"<div>[{kind}]</div>"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", default=str(ROOT / "tools" / "preview" / "tree-check.html"))
    args = parser.parse_args()
    settings = load_settings()
    output = run_scenarios()
    rows = [json.loads(line.split("@@TREE@@", 1)[1]) for line in output.splitlines() if "@@TREE@@" in line]
    renderer = Renderer(settings)
    width = settings["width"]
    parts = [
        '<!doctype html><meta charset="utf-8"><title>panel check</title><style>'
        "body{margin:0;padding:10px;background:#0d0d14;font-family:'Segoe UI','Malgun Gothic',sans-serif;display:flex;gap:16px;align-items:flex-start;color:#999}"
        f".col{{width:{width}px;flex:none}}.note{{font-size:11px;margin:0 0 6px}}svg{{display:block;width:100%;height:auto}}</style>"
    ]
    for row in rows:
        tree = row["tree"]
        base = tree["props"].get("backgroundColor", "#1b1b3a")
        parts.append(
            f'<div class="col"><p class="note">{row["id"]} — 폭 {width}px · 근사(실제 앱 아님)</p>'
            f'<div id="{row["id"]}" style="background:{base}">{renderer.render(tree)}</div></div>'
        )
    out = pathlib.Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(parts), encoding="utf-8")
    print(f"{len(rows)}개 상태를 그렸다 -> {out}")
    print("측정값 파일:", MEASURED if MEASURED.exists() else "없음(기본 가정 사용)")
    print("브라우저로 열어 보고, 높이는 개발자 도구에서 #상태이름 요소의 높이로 잰다.")


if __name__ == "__main__":
    main()
