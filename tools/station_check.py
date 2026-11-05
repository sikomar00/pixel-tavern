"""방송 목록(hooks/scenes.ts 의 STATIONS)의 모든 방송을 실제 재생기(hooks/radio.ts 의 PLAYER, 음량 0)에 한 곳씩 물려 본다. 소리는 나지 않는다.

  python tools/station_check.py              목록 전체(방송마다 최대 약 30초)
  python tools/station_check.py groovesalad  이름표(id)를 준 방송만

방송마다: playing 까지 걸린 시간, 이후 8초 동안 끊기지 않는지(retry·gaveup 신호 없음). 결과가 "정상"이 아닌 방송은 목록에서 빼거나 주소를 고친다.
새 방송을 더할 때 먼저 이 점검을 돌리고, 사용자에게 이름·서버·결과를 보여 주고 승인받은 뒤 더한다.

주의: 재생기는 시작할 때 이미 켜져 있던 다른 재생기를 끈다(설계). 이 점검을 돌리면 지금 듣고 있는 음악도 꺼진다. 인터넷 연결이 필요하다.
"""
import importlib.util
import pathlib
import re
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("player_check", ROOT / "tools" / "player_check.py")
pc = importlib.util.module_from_spec(spec)  # type: ignore[arg-type]
spec.loader.exec_module(pc)  # type: ignore[union-attr]

SCENES_TS = (ROOT / "hooks" / "scenes.ts").read_text(encoding="utf-8")


def stations() -> list[tuple[str, str, str]]:
    """scenes.ts 의 방송 항목(id, label, stream)을 목록 순서대로 꺼낸다."""
    return re.findall(r"id: '([a-z0-9]+)', label: '([^']+)', stream: '([^']+)'", SCENES_TS)


def check(name: str, url: str) -> bool:
    pc.stop_players()
    proc = pc.start(url)
    lines = pc.collect(proc)
    t0 = time.time()
    playing = None

    while time.time() - t0 < 22 and playing is None:
        time.sleep(0.5)
        playing = next((t for t, text in lines if text == "playing"), None)
    time.sleep(8 if playing is not None else 0)
    trouble = [text for _, text in lines if text.startswith("retry:") or text == "gaveup"]
    verdict = "정상" if playing is not None and not trouble else ("끊김" if playing is not None else "재생 안 됨")

    print(f"{verdict:6s} {name:36s} playing까지 {('%.1f초' % playing) if playing is not None else '-'}  끊김 신호 {trouble}")
    sys.stdout.flush()
    proc.kill()
    proc.wait()

    return verdict == "정상"


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[union-attr]
    only = sys.argv[1:]
    chosen = [item for item in stations() if not only or item[0] in only]

    if not chosen:
        sys.exit(__doc__)
    print(f"시작 전 켜져 있던 재생기: {pc.count_players()}개(있었다면 점검이 끈다)")
    try:
        results = [check(f"{label} ({sid})", url) for sid, label, url in chosen]
    finally:
        pc.stop_players()
    print(f"{sum(results)}/{len(results)}곳 정상 · 정리 후 남은 재생기: {pc.count_players()}개")


if __name__ == "__main__":
    main()
