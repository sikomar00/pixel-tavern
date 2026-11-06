"""방송 16곳에 곡 제목 조회 스크립트(hooks/title.ts의 TITLE_SCRIPT)를 실제로 돌려 본다. 한 줄로: python tools/title_check.py [방송 id ...]

방송마다 한 번씩 아주 잠깐(첫 메타데이터 한 덩어리, 보통 오디오 16KB 안팎) 접속한다. 소리는 나지 않는다.
결과: 제목이 나오면 제목, 방송이 제목을 안 보내면 "제목 없음"(정상), 접속 실패·시간 초과면 "실패"와 이유. 표준 라이브러리만 쓴다.
"""
from __future__ import annotations

import pathlib
import re
import subprocess
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parent.parent
LAUNCH = ["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command"]  # hooks/radio.ts의 LAUNCH와 같다
TIMEOUT_S = 20


def script() -> str:
    text = (ROOT / "hooks" / "title.ts").read_text(encoding="utf-8")
    found = re.search(r"export const TITLE_SCRIPT = `(.*?)`\n", text, re.S)
    if found is None:
        sys.exit("TITLE_SCRIPT를 찾지 못했다.")
    return found.group(1)


def stations() -> list[tuple[str, str]]:
    text = (ROOT / "hooks" / "scenes.ts").read_text(encoding="utf-8")
    return re.findall(r"id: '(\w+)'[^\n]*?stream: '(http[^']+)'", text)


def decode(stdout: str) -> str | None:
    for line in stdout.splitlines():
        if line.startswith("title:"):
            codes = [int(c) for c in line[len("title:"):].split(",") if c.strip().lstrip("-").isdigit()]
            return "".join(chr(c) for c in codes if 0 <= c <= 0xFFFF)
    return None


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    wanted = set(sys.argv[1:])
    body = script()
    for station_id, stream in stations():
        if wanted and station_id not in wanted:
            continue
        env = {**__import__("os").environ, "TAVERN_URL": stream}
        started = time.time()
        try:
            done = subprocess.run(["powershell.exe", *LAUNCH, body], capture_output=True, env=env, timeout=TIMEOUT_S)
        except subprocess.TimeoutExpired:
            print(f"{station_id:14} 실패   {TIMEOUT_S}초 안에 끝나지 않음")
            continue
        seconds = time.time() - started
        out = done.stdout.decode("utf-8", errors="replace")
        if done.returncode != 0:
            reason = done.stderr.decode("utf-8", errors="replace").strip().splitlines()[:1]
            print(f"{station_id:14} 실패   {seconds:4.1f}초  {reason[0][:90] if reason else '종료 코드 ' + str(done.returncode)}")
            continue
        title = decode(out)
        print(f"{station_id:14} {'제목 없음' if title is None else ('제목 비어 있음' if title == '' else '제목'):9} {seconds:4.1f}초  {title or ''}")


if __name__ == "__main__":
    main()
