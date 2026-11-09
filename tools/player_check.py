"""실제 Windows에서 재생기 스크립트(hooks/radio.ts 의 PLAYER)를 소리 없이(음량 0) 돌려 보는 점검. 표준 라이브러리만 쓴다.

  python tools/player_check.py normal   정상 방송: 'playing'까지 걸리는 시간, CPU, 메모리, 끈 뒤 남는 재생기 (약 30초)
  python tools/player_check.py dead     죽은 주소: 점점 길게 기다리며 5번 다시 연결해 보고(15초·30초·60초·2분·2분) 'gaveup' 뒤 스스로 끝나는지 (약 6분)
  python tools/player_check.py orphan   부모(엔진 역할) 프로세스를 강제로 죽이면 재생기가 스스로 끝나는지 (약 40초)
  python tools/player_check.py kill     새 재생기가 켜질 때 옛 재생기만 끄고, 표식 글자만 든(또는 실행 인자만 같은) 다른 powershell은 건드리지 않는지 (약 35초)
  python tools/player_check.py quick    normal + orphan + kill 을 차례로 (약 2분). 재생기 스크립트(PLAYER)를 고칠 때마다 돌린다
  python tools/player_check.py all      quick + dead (약 8분)

각 점검은 항목마다 통과·실패를 판정해서 요약을 내고, 하나라도 실패하면 종료 코드 1로 끝난다. 실제 방송에 접속하므로 네트워크가 막혀 있으면 normal·orphan·kill이 실패한다.

주의: 재생기는 시작할 때 이미 켜져 있던 다른 재생기를 끈다(설계). 이 점검을 돌리면 지금 듣고 있는 음악도 꺼진다.
"""
import os
import pathlib
import re
import subprocess
import sys
import tempfile
import threading
import time

ROOT = pathlib.Path(__file__).resolve().parent.parent
NO_WINDOW = 0x08000000
STREAM = 'http://listen.reyfm.de/lofi_320kbps.mp3'  # hooks/scenes.ts 의 방송 주소 하나
DEAD_URL = 'http://127.0.0.1:9/'


RADIO_TS = (ROOT / 'hooks' / 'radio.ts').read_text(encoding='utf-8')


def launch_args() -> list[str]:
    """모드가 재생기를 띄울 때 쓰는 실행 인자(radio.ts 의 LAUNCH). 도구도 똑같이 띄워야 실제와 같은 명령줄이 된다."""
    return re.findall(r"'([^']+)'", re.search(r'const LAUNCH = \[(.+?)\]', RADIO_TS).group(1))  # type: ignore[union-attr]


def retry_ticks() -> list[str]:
    """radio.ts 의 RETRY_WAIT_TICKS(재연결 기다림, 반 초 단위) 값 목록. 길이가 시도 횟수 한도다."""
    ticks = re.search(r'export const RETRY_WAIT_TICKS = \[([^\]]+)\]', RADIO_TS).group(1)  # type: ignore[union-attr]

    return [part.strip() for part in ticks.split(',') if part.strip()]


def player_script() -> str:
    """radio.ts 에서 PLAYER 문자열을 꺼내 ${MARKER}, ${SIGNATURE}, ${RETRY_WAIT_TICKS...}, ${MAX_TRIES} 를 값으로 바꾼다."""
    body = RADIO_TS.split('export const PLAYER = `', 1)[1].split('\n`', 1)[0]
    marker = re.search(r"const MARKER = '([^']+)'", RADIO_TS).group(1)  # type: ignore[union-attr]

    return (body.replace('${MARKER}', marker).replace('${SIGNATURE}', ' '.join(launch_args()))
            .replace("${RETRY_WAIT_TICKS.join(', ')}", ', '.join(retry_ticks())).replace('${MAX_TRIES}', str(len(retry_ticks()))))


def ps(command: str) -> str:
    return subprocess.run(['powershell.exe', '-NoProfile', '-Command', command], capture_output=True, text=True, creationflags=NO_WINDOW).stdout.strip()


# 대괄호로 "radio"를 쪼개 둔다: 이 조회 명령 자신의 명령줄은 패턴에 걸리지 않는다.
PLAYERS = "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'powershell.exe' -and $_.CommandLine -like '*pixel-tavern-radi[o]*' }"


def count_players() -> int:
    return int(ps(f'@({PLAYERS}).Count') or 0)


def stop_players() -> None:
    ps(f'{PLAYERS} | ForEach-Object {{ Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }}')


def usage_of(pid: int) -> str:
    return ps(f"$p = Get-Process -Id {pid} -ErrorAction SilentlyContinue; if ($p) {{ '{{0:N1}}초 CPU, {{1:N0}} MB' -f $p.CPU, ($p.WorkingSet64/1MB) }} else {{ '없음' }}")


def start(url: str) -> subprocess.Popen:
    env = dict(os.environ, TAVERN_URL=url, TAVERN_VOLUME='0')
    argv = ['powershell.exe', *launch_args(), player_script()]

    return subprocess.Popen(argv, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding='utf-8', errors='replace', creationflags=NO_WINDOW)


def collect(proc: subprocess.Popen) -> list[tuple[float, str]]:
    """표준 출력 줄을 (경과 초, 내용)으로 계속 모은다."""
    lines: list[tuple[float, str]] = []
    t0 = time.time()

    def pump() -> None:
        for line in proc.stdout:  # type: ignore[union-attr]
            lines.append((time.time() - t0, line.strip()))

    threading.Thread(target=pump, daemon=True).start()

    return lines


Check = tuple[str, bool]  # (점검 이름, 통과 여부)


def normal() -> list[Check]:
    proc = start(STREAM)
    lines = collect(proc)

    time.sleep(14)
    early = usage_of(proc.pid)
    time.sleep(10)
    first = next((t for t, text in lines if text == 'playing'), None)
    print('정상 방송: playing 까지 ' + (f'{first:.1f}초' if first else '신호 없음'))
    print(f'자원(14초 / 24초 시점): {early} / {usage_of(proc.pid)}')
    proc.kill()
    proc.wait()
    time.sleep(1)
    left = count_players()
    print(f'끈 뒤 남은 재생기: {left}개')

    return [('playing 신호가 24초 안에 온다', first is not None), ('끈 뒤 남은 재생기가 0개다', left == 0)]


def dead() -> list[Check]:
    proc = start(DEAD_URL)
    lines = collect(proc)
    t0 = time.time()

    while proc.poll() is None and time.time() - t0 < 420:
        time.sleep(1)
    print('죽은 주소: connecting 시각(초) ' + str([round(t) for t, text in lines if text == 'connecting']))
    print('retry 신호(시각 초, 내용) ' + str([(round(t), text) for t, text in lines if text.startswith('retry:')]))
    print('gaveup 시각(초) ' + str([round(t) for t, text in lines if text == 'gaveup']))
    print('끝났나: ' + ('아직 살아 있음' if proc.poll() is None else f'예(종료 코드 {proc.poll()})'))
    code = proc.poll()
    proc.kill()
    retries = {text for _, text in lines if text.startswith('retry:')}

    return [
        ('연결을 정확히 5번 시도한다', len([1 for _, text in lines if text == 'connecting']) == len(retry_ticks())),
        ('retry:2~5 신호가 모두 온다', retries >= {'retry:2', 'retry:3', 'retry:4', 'retry:5'}),
        ('gaveup 신호가 한 번 온다', len([1 for _, text in lines if text == 'gaveup']) == 1),
        ('gaveup 뒤 스스로 끝난다(종료 코드 0)', code == 0),
    ]


def alive(proc: subprocess.Popen) -> bool:
    return proc.poll() is None


def kill() -> list[Check]:
    """새 재생기가 켜질 때 옛 재생기만 끄고, 표식 글자만 있거나 실행 인자만 같은 다른 프로세스는 건드리지 않는지 본다."""
    marker_only = subprocess.Popen(['powershell.exe', '-NoProfile', '-Command', 'Start-Sleep 120 # pixel-tavern-radio'], creationflags=NO_WINDOW)  # 표식만 있다
    signature_only = subprocess.Popen(['powershell.exe', '-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', 'Start-Sleep 120'], creationflags=NO_WINDOW)  # 서명만 있다
    first = start(STREAM)

    time.sleep(9)
    first_before = alive(first)
    print(f"두 번째 재생기를 켜기 전: 첫 재생기 {'살아 있음' if first_before else '꺼짐'}")
    second = start(STREAM)
    time.sleep(12)  # 두 번째가 시작할 때 이전 재생기를 끈다
    checks = [
        ('두 번째를 켜기 전에는 첫 재생기가 살아 있다', first_before),
        ('두 번째를 켜면 첫 재생기만 꺼진다', not alive(first)),
        ('두 번째 재생기는 살아 있다', alive(second)),
        ('표식 글자만 든 다른 powershell은 건드리지 않는다', alive(marker_only)),
        ('실행 인자만 같은 다른 powershell은 건드리지 않는다', alive(signature_only)),
    ]
    for proc in (marker_only, signature_only, second, first):
        proc.kill()

    return checks


def parent() -> None:
    """엔진 역할: 재생기를 자식으로 띄워 두고 기다린다. 점검이 이 프로세스를 강제로 죽인다."""
    start(STREAM)
    time.sleep(120)


def orphan() -> list[Check]:
    helper = subprocess.Popen([sys.executable, __file__, '--parent'], creationflags=NO_WINDOW)

    time.sleep(9)  # 재생기가 시작 5초 뒤 부모 감시를 켤 시간
    before = count_players()
    subprocess.run(['taskkill', '/F', '/PID', str(helper.pid)], capture_output=True, creationflags=NO_WINDOW)
    t0 = time.time()

    while time.time() - t0 < 30 and count_players() > 0:
        time.sleep(1)
    left = count_players()
    print(f'부모를 죽이기 전 재생기: {before}개')
    print('부모를 죽인 뒤: ' + (f'{time.time() - t0:.1f}초 만에 모두 끝남' if left == 0 else f'30초가 지나도 {left}개가 남음(고아)'))

    return [('부모를 죽이기 전에는 재생기가 1개 떠 있다', before == 1), ('부모를 죽이면 30초 안에 재생기가 모두 끝난다', left == 0)]


MODES = {'normal': [normal], 'dead': [dead], 'orphan': [orphan], 'kill': [kill], 'quick': [normal, orphan, kill], 'all': [normal, orphan, kill, dead]}


def main() -> None:
    if sys.argv[1:] == ['--parent']:
        return parent()
    steps = MODES.get(sys.argv[1] if len(sys.argv) > 1 else '')

    if steps is None:
        sys.exit(__doc__)
    results: list[Check] = []

    for step in steps:
        print(f'\n--- {step.__name__} ---')
        stop_players()
        try:
            results += [(f'{step.__name__}: {name}', ok) for name, ok in step()]
        finally:
            stop_players()
            print(f'정리 후 남은 재생기: {count_players()}개')
    print('\n=== 요약 ===')
    for name, ok in results:
        print(f"[{'통과' if ok else '실패'}] {name}")
    failed = [name for name, ok in results if not ok]

    print(f'통과 {len(results) - len(failed)}개, 실패 {len(failed)}개')
    if failed:
        sys.exit(1)


if __name__ == '__main__':
    main()
