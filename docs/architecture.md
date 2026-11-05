# 구조

작성일 2026-11-05, 기준 `49d7f01` + 코드 정리 확인 단계(커밋 전). 모드 이름 `pixel-tavern`, 명령 `/tavern`·`/tavern-diag`.

## 한 줄 설명

Claude Code 데스크톱의 "모드"(hooks 모듈)로, 프롬프트 위의 픽셀 배너(`AbovePrompt`)와 오른쪽 패널(`Pane`, 이름 "여관")을 그린다. 상태는 `$.state`(세션)·`$.store`(세션 너머), 바깥 세계는 `$.process`로 만난다.

## 파일과 역할

| 층 | 파일 | 줄 | 역할 |
|---|---|---|---|
| 데이터 | `scenes.ts` | 77 | 장면 4개(이름·팔레트·게이지 이름·방송 주소·방송 이름) |
| | `volume.ts`, `format.ts` | 10, 43 | 음량 5단계 표, 날짜·글자 서식 |
| | `art/` | — | 생성된 SVG(코드가 아니라 데이터). `tools/gen_art.py`가 만듦 |
| 상태 | `state.ts` | 314 | 상태 값(atom) 선언, 저장소 읽기·쓰기, 오늘 기록 합치기, 파일 기록 |
| 바깥 세계 | `git.ts` | 43 | `git status/log` 읽기(안전 옵션 포함) |
| | `radio.ts` | 153 | PowerShell 재생기 스크립트, 재생 상태, 다른 채팅 감지, 연결 포기 |
| 동작 | `actions.ts` | 181 | 버튼이 하는 일(장면·음악·커밋·정리 두 단계·접기·도움말) |
| | `alerts.ts` | 43 | 사용량 90% 알림 규칙 |
| 그림·화면 | `usage.ts`, `svg.ts`, `theme.ts` | 125, 54, 35 | 사용량 링 SVG, 글자 폭·잘라내기, 색·간격 |
| | `layout.tsx` | 109 | 공통 조각(머리글·접기·요약·`?`·카드·칩) |
| | `banner.tsx`, `panel.tsx` | 155, 349 | 배너, 패널(구역 순서는 아래) |
| | `music.tsx`, `help.tsx`, `diag.tsx` | 96, 100, 81 | 음악 구역, 도움말, 측정판 |
| 연결 | `register.tsx` | 168 | 이벤트에 훅을 연결(세션 시작, 도구 호출, 턴 끝, 그리기, 명령) |

패널 구역 순서(`panel.tsx`): (측정판) → 장면 선택 → 그림 → 음악 → 빠른 실행 → 사용량 → 작업 현황(커밋 로그 포함) → 파일.

## 의존 방향

```
register ─┬─ actions ── radio ── state ── git
          ├─ alerts                  └─ scenes · format · volume
          ├─ banner ── usage · svg · scenes · format
          └─ panel ─── layout · music · usage · diag · theme …
```

- 화면 파일은 상태를 직접 읽지 않고 `PanelData`/`BannerData`로 값을 받는다. 렌더 훅은 읽기만 한다(값을 쓰는 곳은 `actions`·`register`).
- 실행 시점 순환은 없다. `layout`·`music` → `panel`(`PanelData`), `panel` → `banner`(`BannerData`)는 타입만 가리킨다.
- 바깥 세계(git, 재생기 프로세스)는 각각 한 파일에 갇혀 있다.

## 데이터 흐름

이벤트(세션 시작·60초마다·턴 끝·도구 호출·버튼) → `register`/`actions`가 상태(atom)와 저장소를 갱신 → 상태를 읽는 `ui.render` 훅이 다시 그림.

- 60초마다 갱신하고(`refresh`), 턴이 끝나면 git을 바로 다시 읽는다(배너의 +N이 맞도록).
- `Edit/Write/NotebookEdit` 호출이 성공하면 `trackFile`이 파일을 기록한다(이 채팅 50개, 오늘 500개). 이때 제어 문자를 뺀다.
- 오늘 기록은 두 채팅이 같이 쓸 수 있어서 합칠 때 숫자는 큰 쪽, 파일은 합집합으로 한다(`mergeToday`).

## 재생기 수명

상태: `off → connecting → playing`, 그리고 `failed`(켜지 못함·스스로 끝남·연결 포기), `other`(다른 채팅이 가져감).

끝나는 길은 세 가지다.

1. ■ 또는 장면 바꿈: `listen`의 반복문을 `break`로 나오면 엔진이 자식 프로세스를 끈다.
2. 모드 다시 불러오기: 엔진이 자식을 함께 끈다(엔진 규칙, 미검증).
3. 앱 강제 종료: 재생기가 5초마다 부모 프로세스가 살아 있는지 보고 없으면 스스로 끝난다 [실측 4초 이내].

연결이 15초 동안 안 흐르면 다시 연결하고, 5번 실패하면 `gaveup`을 알리고 끝낸다. 한 번이라도 재생되면 횟수를 다시 센다.

## 저장하는 것(`$.store`)

`mood`(장면), `isHidden`(배너 숨김), `today`(오늘 기록), `volume`, `collapsed`(접은 구역), `introSeen`(첫 안내), `radioOwner`(음악을 켠 채팅의 이름표). 오늘 기록(`today`)에는 수정한 파일의 경로 목록이 들어간다. 개인 정보에 가까우므로 타임라인·프로젝트별 통계를 만들 때 무엇을 저장할지 다시 검토한다.

## 도구(모드에 로드되지 않음)

| 파일 | 역할 |
|---|---|
| `tools/gen_art.py`, `artlib.py`, `scenes/*.py` | 글자 격자 → 색칸을 합친 SVG(표준 라이브러리만) |
| `tools/render_panel.py`, `tree_dump.scenario.tsx` | 미리보기 HTML, 그려진 트리 덤프 |
| `tools/measured.json` | 실제 앱에서 잰 값(패널 약 388px, 51열×63줄, 글자 칸 7.72px 등) |
| `tools/player_check.py` | 실제 Windows 재생기 점검 3종 |
