"""실제 git으로 어려운 파일 이름이 든 저장소를 임시 폴더에 만들고, 모드가 읽는 `git status --porcelain=v1 -z -b` 출력을 찍는다.

tests/git.test.tsx 의 REAL_Z 가 이 출력이다. `python tools/git_fixture.py` 로 다시 만들어 비교할 수 있다.
표준 라이브러리와 git 만 쓰고 사용자의 저장소는 건드리지 않는다(임시 폴더에 만들고 끝나면 지운다).

Windows 에서는 파일 이름에 > " 탭 줄바꿈을 쓸 수 없어서 작업 폴더가 아니라 인덱스에 직접 넣는다. 이때 git 의 NTFS 보호
(core.protectNTFS)를 이 임시 저장소에서만 끈다. 역슬래시가 든 이름은 Windows 의 git 이 "/" 로 바꿔 버려서 만들 수 없다.
"""
import json
import os
import pathlib
import shutil
import stat
import subprocess
import tempfile

ZERO = '0' * 40
GIT = ['git', '-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'core.autocrlf=false', '-c', 'core.protectNTFS=false']
READ = ['git', '--no-optional-locks', '-c', 'core.fsmonitor=false', 'status', '--porcelain=v1', '-z', '-b']  # 모드가 쓰는 것과 같은 명령(hooks/git.ts)


def run(repo: pathlib.Path, args: list[str], data: bytes | None = None, check: bool = True) -> bytes:
    done = subprocess.run([*GIT, *args], cwd=repo, input=data, capture_output=True)
    if check and done.returncode != 0:
        raise SystemExit(f'git {args} 실패: {done.stderr.decode("utf-8", "replace")}')
    return done.stdout


def blob(repo: pathlib.Path, text: str) -> str:
    return run(repo, ['hash-object', '-w', '--stdin'], text.encode()).decode().strip()


def index_info(repo: pathlib.Path, entries: list[tuple[str, str]]) -> None:
    """(sha, 경로) 목록을 인덱스에 직접 넣는다. sha 가 ZERO 면 지운다. 넣은 것은 작업 폴더와 비교하지 않게 표시한다."""
    data = b''.join((f'0 {ZERO}\t' if sha == ZERO else f'100644 {sha} 0\t').encode() + path.encode() + b'\0' for sha, path in entries)
    run(repo, ['update-index', '-z', '--index-info'], data)
    present = ''.join(path + '\0' for sha, path in entries if sha != ZERO).encode()
    if present:
        run(repo, ['update-index', '-z', '--assume-unchanged', '--stdin'], present)


def write(repo: pathlib.Path, name: str, text: str) -> None:
    (repo / name).parent.mkdir(parents=True, exist_ok=True)
    (repo / name).write_text(text, encoding='utf-8', newline='\n')


def build(repo: pathlib.Path) -> str:
    run(repo, ['init', '-q', '-b', 'main'])
    for name in ('keep.txt', 'mod.txt', 'del.txt', 'conflict.txt', 'rr.txt', 'rm-src.txt', 'sp ace.txt', '한글 문서.md'):
        write(repo, name, f'{name}\n')
    run(repo, ['add', '-A'])
    run(repo, ['commit', '-q', '-m', 'init'])

    shas = {n: blob(repo, f'content of {n}\n') for n in ('arrow-old', 'rn1', 'gone', 'tab', 'nl')}
    index_info(repo, [(shas['arrow-old'], 'old -> name.txt'), (shas['rn1'], 'rn1.txt'), (shas['gone'], 'gone"q.txt'), (shas['tab'], 'tab\there.txt'), (shas['nl'], 'new\nline.txt')])
    run(repo, ['commit', '-q', '-m', 'tricky names'])

    # 합치기 충돌: conflict.txt 는 양쪽이 내용을 다르게 고쳐 UU, rr.txt 는 양쪽이 서로 다른 이름으로 바꿔(rename/rename) 이름 변경이 얽힌 충돌
    run(repo, ['checkout', '-q', '-b', 'other'])
    write(repo, 'conflict.txt', 'other side\n')
    run(repo, ['mv', 'rr.txt', 'rr-a.txt'])
    run(repo, ['commit', '-q', '-am', 'other'])
    run(repo, ['checkout', '-q', 'main'])
    write(repo, 'conflict.txt', 'main side\n')
    run(repo, ['mv', 'rr.txt', 'rr-b.txt'])
    run(repo, ['commit', '-q', '-am', 'main'])
    run(repo, ['merge', 'other'], check=False)

    index_info(repo, [
        (ZERO, 'rn1.txt'), (shas['rn1'], 'renamed -> to new -> name.txt'),  # 이름 변경: 새 이름에 " -> "
        (ZERO, 'old -> name.txt'), (shas['arrow-old'], 'plain-new.txt'),  # 이름 변경: 옛 이름에 " -> "
        (blob(repo, 'q\n'), 'q"uote.txt'), (blob(repo, 't\n'), 'tab\tnew.txt'), (blob(repo, 'n\n'), 'line\nbreak.txt'),  # 새 파일: 따옴표·탭·줄바꿈
        (blob(repo, 'e\n'), 'emoji😀.txt'), (blob(repo, 'u\n'), 'ünï côde.txt'),  # 새 파일: 이모지, 악센트와 공백
        (ZERO, 'gone"q.txt'),  # 삭제(따옴표)
    ])
    run(repo, ['mv', 'rm-src.txt', 'rm-dst.txt'])  # 이름을 바꾸고(index) 작업 폴더에서 또 고침(RM)
    write(repo, 'rm-dst.txt', 'renamed and changed\n')
    write(repo, 'mod.txt', 'changed\n')  # 작업 폴더의 변경
    (repo / 'del.txt').unlink()
    write(repo, 'untracked file.txt', 'x\n')
    write(repo, 'newdir/inner.txt', 'x\n')
    return subprocess.run(READ, cwd=repo, capture_output=True, check=True).stdout.decode('utf-8')


def force_remove(func, path, _info) -> None:
    os.chmod(path, stat.S_IWRITE)  # git 객체 파일은 읽기 전용이라 지우기 전에 풀어 준다
    func(path)


def main() -> None:
    repo = pathlib.Path(tempfile.mkdtemp(prefix='pixel-tavern-git-'))
    try:
        out = build(repo)
    finally:
        shutil.rmtree(repo, onerror=force_remove)
    print('칸(NUL로 나눔):')
    for part in out.split('\0'):
        print('  ', repr(part))
    print('\nREAL_Z =', json.dumps(out, ensure_ascii=False))


if __name__ == '__main__':
    main()
