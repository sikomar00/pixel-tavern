# 변경 기록

## 커밋 전(2026-11-05, 정밀 리뷰 결과)

사용자 승인 뒤 성격별로 나누어 커밋할 예정입니다.

- **fix(git)**: 백그라운드 `git status/log`에 `--no-optional-locks`, `-c core.fsmonitor=false`를 붙임. 사용자의 `git add·commit`이 `index.lock`으로 실패하는 일과 저장소 설정의 명령 실행을 막음. (`hooks/git.ts`)
- **fix(radio)**: 연결을 5번 못 하면 `gaveup`을 알리고 끝냄(패널 "연결 실패 + 이유", 토스트). 앱이 강제 종료돼 부모 프로세스가 사라지면 재생기가 스스로 끝남(고아 방지). 부모 PID를 못 읽으면 감시하지 않음. 재시도 한도는 `MAX_TRIES` 한 곳. (`hooks/radio.ts`)
- **fix(state)**: 파일 이름의 제어 문자를 기록할 때 뺌. 남아 있으면 엔진이 버튼을 거부해 패널이 통째로 사라졌음. (`hooks/state.ts`)
- **test**: `tests/safety.test.tsx` 4개 추가(70 → 74개), `tests/kit.tsx`에 실행 명령 기록(`spy.runs`).
- **chore(tools)**: `tools/player_check.py` — 실제 Windows 재생기 점검 3종(정상·죽은 주소·고아).
- **docs**: `docs/` 신설 — 리뷰 3종, 보안, 구조, 디자인, 계획, 시험 계획, 변경 기록.

## 이전 커밋(`git log`)

| 커밋 | 내용 |
|---|---|
| `271ff83` | test: 비유 이름이 화면 어디에도 없는지 확인 |
| `ac2ec1e` | refactor: 장면별 비유 이름 제거, 게이지는 기능 이름만 |
| `3abee43` | feat(art): 그림 속 게이지 글자를 "컨텍스트"로 다시 생성 |
| `564f53e` | test: 시험을 파일별로 나누고 공용 도우미 분리(70개) |
| `518198e` | feat: 배너를 숨겨도 사용량 한 줄 표시 |
| `a3c7a71` | test: 음악 카드·경고색 대비·오늘 기록 합치기 시험(69개) |

그 이전의 변경(배너·패널·음악·사용량 링·빠른 실행·도움말·접기 등)은 `git log`에 있습니다.
